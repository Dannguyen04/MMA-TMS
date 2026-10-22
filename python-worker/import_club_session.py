"""Nhập một video buổi quay CLB thành gói gán nhãn toàn timeline.

Gói chỉ chứa mã ẩn danh (sourceVideoId, fighterId, sessionId), tham chiếu đồng ý do
chủ CLB cấp và số liệu giải mã thực. Không lưu tên file gốc, không tạo nhãn gợi ý,
không đặt dataUseApproved/coachConfirmed/goldEligible. Timeline ban đầu trống:
khoảng chưa gán là "chưa biết", không phải background.

Ví dụ:
  .venv\\Scripts\\python.exe import_club_session.py --video D:\\club\\raw\\clip.mp4 \\
      --source-video-id F007_S1 --fighter-id F007 --session-id S1 \\
      --consent-ref CONSENT-F007 --camera-view front --declared-stance orthodox \\
      --output local-data/review_packs/F007_S1
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import shutil
import statistics
import sys

import cv2

import review_timeline as rt

ROOT = Path(__file__).resolve().parent
CAMERA_VIEWS = ("front", "side", "diagonal")
MIN_FPS = 20.0          # LOW_FPS của worker (movement_evidence.py); chỉ cảnh báo ở đây
EXPECTED_FPS = 30.0     # kế hoạch quay: 30 fps, tốc độ không đổi
FPS_TOLERANCE = 0.5
JITTER_FRACTION = 0.5   # dao động mốc thời gian > nửa frame thì nghi VFR


def sha256_file(path):
    hasher = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for chunk in iter(lambda: stream.read(1 << 20), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def probe_club_video(path):
    """Giải mã toàn bộ; ghi FPS khai báo, số frame giải mã và dao động mốc thời gian.

    Không kết luận video có VFR hay không: OpenCV có thể suy mốc từ chỉ số frame nên
    `variableFrameRateVerified` luôn False; chỉ ghi cảnh báo khi thấy dao động.
    """
    capture = cv2.VideoCapture(str(path))
    if not capture.isOpened():
        raise ValueError("Không giải mã được video")
    fps = capture.get(cv2.CAP_PROP_FPS)
    declared = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
    width, height = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH)), int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
    count, stamps = 0, []
    while True:
        ok, _ = capture.read()
        if not ok:
            break
        count += 1
        stamps.append(capture.get(cv2.CAP_PROP_POS_MSEC))
    capture.release()
    if not math.isfinite(fps) or fps <= 0 or count == 0:
        raise ValueError("FPS không hợp lệ hoặc video rỗng")
    deltas = [b - a for a, b in zip(stamps, stamps[1:])]
    jitter = None
    if deltas and all(math.isfinite(d) for d in deltas):
        median = statistics.median(deltas)
        jitter = round(max(abs(d - median) for d in deltas), 3)
    return {"fps": fps, "decodedFrames": count, "declaredFrames": declared, "width": width, "height": height,
            "durationMs": count * 1000 / fps, "timingBasis": "decoded_frame_index_over_reported_fps",
            "variableFrameRateVerified": False, "timestampJitterMs": jitter}


def probe_warnings(meta):
    """Cảnh báo kỹ thuật; không chặn nhập. Người quay/AI engineer quyết định quay lại."""
    out = []
    if meta["fps"] < MIN_FPS:
        out.append("LOW_FPS")
    elif abs(meta["fps"] - EXPECTED_FPS) > FPS_TOLERANCE:
        out.append("FPS_NOT_30")
    if meta["declaredFrames"] and meta["declaredFrames"] != meta["decodedFrames"]:
        out.append("FRAME_COUNT_MISMATCH")
    jitter = meta.get("timestampJitterMs")
    if jitter is not None and jitter > JITTER_FRACTION * 1000 / meta["fps"]:
        out.append("VFR_SUSPECTED")
    return out


def write_json(path, value):
    with path.open("x", encoding="utf-8") as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2, allow_nan=False)


def require_id(name, value, optional=False):
    if value is None and optional:
        return None
    if not rt.is_id(value):
        raise ValueError(f"{name} chỉ gồm chữ không dấu, số, '.', '_', '-' (tối đa 64 ký tự); "
                         "không dùng tên thật, email hoặc số điện thoại")
    return value


def build_session_pack(video, output, *, source_video_id, fighter_id, session_id, consent_reference=None,
                       camera_view=None, declared_stance=None, guide_version=None, probe=probe_club_video):
    video = Path(video)
    output = Path(output)
    require_id("sourceVideoId", source_video_id)
    require_id("fighterId", fighter_id)
    require_id("sessionId", session_id)
    require_id("consentReference", consent_reference, optional=True)
    if camera_view is not None and camera_view not in CAMERA_VIEWS:
        raise ValueError(f"cameraView phải là một trong {CAMERA_VIEWS}")
    if declared_stance is not None and declared_stance not in rt.STANCES:
        raise ValueError(f"declaredStance phải là một trong {rt.STANCES}")
    if guide_version is not None and not rt.is_id(guide_version):
        raise ValueError("guideVersion chỉ gồm chữ không dấu, số, '.', '_', '-'")
    if not video.is_file():
        raise ValueError("Không tìm thấy file video")
    if output.exists():
        raise ValueError("Dùng thư mục output mới; gói gán nhãn là bất biến")
    meta = probe(video)  # lỗi giải mã dừng trước khi tạo thư mục
    checksum = sha256_file(video)
    output.mkdir(parents=True)
    try:
        return _write_pack(video, output, meta, checksum, source_video_id, fighter_id, session_id,
                           consent_reference, camera_view, declared_stance, guide_version)
    except BaseException:
        shutil.rmtree(output, ignore_errors=True)  # không để lại gói dở dang trông như hợp lệ
        raise


def _write_pack(video, output, meta, checksum, source_video_id, fighter_id, session_id,
                consent_reference, camera_view, declared_stance, guide_version):
    media = output / "media"
    media.mkdir()
    target = media / f"{source_video_id}.mp4"
    shutil.copyfile(video, target)
    if sha256_file(target) != checksum:
        raise ValueError("Checksum bản sao video không khớp")
    warnings = probe_warnings(meta)
    if consent_reference is None:
        warnings.append("NO_CONSENT_REFERENCE")
    record = {"sourceVideoId": source_video_id, "path": f"media/{source_video_id}.mp4", "sha256": checksum,
              **meta, "warnings": warnings, "fighterId": fighter_id, "sessionId": session_id,
              "cameraView": camera_view, "declaredStance": declared_stance,
              "consentReference": consent_reference,
              # Các cờ dưới đây chỉ chủ CLB / luồng xác thực của dự án được đổi; công cụ này không.
              "consentVerified": False, "identityVerified": False, "dataUseApproved": False}
    index = {"schemaVersion": rt.PACK_SCHEMA, "status": "PENDING_ANNOTATION", "coachConfirmedCount": 0,
             "goldEligibleCount": 0, "productionEligible": False, "dataUseApproved": False,
             "annotationCoverage": "unverified", "guideVersion": guide_version, "video": record,
             "modelPrefillUsed": False,
             "policy": "Mọi file xuất là khai báo chưa xác thực của người gán; khoảng hở là chưa biết, không phải background."}
    index["packId"] = hashlib.sha256(
        json.dumps(index, sort_keys=True, ensure_ascii=False, allow_nan=False).encode("utf-8")).hexdigest()
    write_json(output / "review_index.json", index)
    template = (ROOT / "review_tools/club_timeline.html").read_text(encoding="utf-8")
    core = (ROOT / "review_tools/timeline_core.js").read_text(encoding="utf-8")
    if "</script" in core.lower():
        raise ValueError("timeline_core.js không được chứa thẻ đóng script")
    # An toàn trong thẻ application/json kể cả khi metadata chứa ký tự đặc biệt.
    embedded = json.dumps(index, ensure_ascii=False, allow_nan=False).replace("<", "\\u003c")
    html = template.replace("/*__TIMELINE_CORE_JS__*/", core).replace("__REVIEW_DATA_JSON__", embedded)
    (output / "review.html").write_text(html, encoding="utf-8")
    (output / "README.md").write_text(
        "# Gói gán nhãn toàn timeline\n\n"
        "Chạy `serve_coach_review_dataset.py <thư mục này>` rồi mở review.html.\n"
        "Mỗi người gán dùng browser profile riêng và mã người gán riêng; không xem gợi ý mô hình.\n"
        "File xuất có `status: LOCAL_REVIEW_UNVERIFIED`; không phải xác nhận HLV hay gold.\n"
        "So hai người gán bằng `review_agreement.py`.\n", encoding="utf-8")
    return {"packId": index["packId"], "sourceVideoId": source_video_id, "sha256": checksum,
            "fps": meta["fps"], "decodedFrames": meta["decodedFrames"], "durationMs": meta["durationMs"],
            "warnings": warnings, "output": str(output)}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--video", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--source-video-id", required=True)
    parser.add_argument("--fighter-id", required=True)
    parser.add_argument("--session-id", required=True)
    parser.add_argument("--consent-ref", help="Mã tham chiếu bản đồng ý do chủ CLB giữ (không phải tên/nội dung)")
    parser.add_argument("--camera-view", choices=CAMERA_VIEWS)
    parser.add_argument("--declared-stance", choices=rt.STANCES, help="Thế thủ khai báo của buổi (ghi nhận, không tự gán vào khoảng)")
    parser.add_argument("--guide-version", help="Phiên bản hướng dẫn nhãn, ví dụ v1")
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    args = parser.parse_args(argv)
    report = build_session_pack(args.video, args.output, source_video_id=args.source_video_id,
                                fighter_id=args.fighter_id, session_id=args.session_id,
                                consent_reference=args.consent_ref, camera_view=args.camera_view,
                                declared_stance=args.declared_stance, guide_version=args.guide_version)
    print(json.dumps(report, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
