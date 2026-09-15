"""
process_video.py — YOLO-Pose video processing pipeline

Luồng xử lý:
  1. Nhận đường dẫn video (local hoặc URL)
  2. Dùng YOLOv8-Pose trích xuất landmarks từng frame
  3. Áp dụng EMA filter
  4. Chạy KickAnalyzer qua từng frame
  5. Xuất JSON { frames: [...], kicks: [...], summary: {...} }

Chạy thử:
  python process_video.py --input sample.mp4 --output result.json
  python process_video.py --input sample.mp4 --model yolov8n-pose  # nhanh, CPU
  python process_video.py --input sample.mp4 --model yolov8x-pose  # chính xác, cần GPU
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

try:
    from ultralytics import YOLO
except ImportError:
    print("❌ Chưa cài ultralytics. Chạy: pip install ultralytics", file=sys.stderr)
    sys.exit(1)

try:
    from tqdm import tqdm
    HAS_TQDM = True
except ImportError:
    HAS_TQDM = False

from kick_analyzer import KickAnalyzer, KickState, KICK_STATE_LABELS
from punch_analyzer import PunchAnalyzer, PunchState, PUNCH_STATE_LABELS
from pose_math import (
    KP, EMAState, Point,
    apply_ema, calculate_angle, detect_active_leg,
    parse_yolo_keypoints, get_angle_color_label,
)
from joint_health_tracker import SessionHealthMonitor, estimate_torso_length


# ─── Cấu hình EMA ───
EMA_ALPHA = 0.35
# Số frame tối thiểu giữa 2 lần detect để tránh spam YOLO (tiết kiệm CPU)
DETECT_EVERY_N_FRAMES = 1  # 1 = mỗi frame; 2 = cách 1 frame


def download_video_if_url(path_or_url: str) -> str:
    """Nếu input là URL, tải về tmp và trả về local path."""
    if path_or_url.startswith(("http://", "https://")):
        import urllib.request
        import tempfile
        import uuid
        tmp_dir = Path(tempfile.gettempdir()) / "martial-arts-worker"
        tmp_dir.mkdir(parents=True, exist_ok=True)
        tmp_path = str(tmp_dir / f"input_{uuid.uuid4().hex[:8]}.mp4")
        print(f"⬇️  Đang tải video từ URL: {path_or_url} -> {tmp_path}")
        urllib.request.urlretrieve(path_or_url, tmp_path)
        return tmp_path
    return path_or_url


def process_video(
    input_path: str,
    model_name: str = "yolov8n-pose",
    output_path: Optional[str] = None,
    conf_threshold: float = 0.5,
    max_frames: Optional[int] = None,
    verbose: bool = True,
) -> dict:
    """
    Pipeline chính: xử lý video và trả về dict kết quả JSON.

    Parameters
    ----------
    input_path    : Đường dẫn video MP4 (local) hoặc URL
    model_name    : Tên model YOLO ('yolov8n-pose', 'yolov8s-pose', 'yolov8x-pose')
    output_path   : Nếu chỉ định, ghi JSON ra file này
    conf_threshold: Ngưỡng confidence tối thiểu để chấp nhận detection
    max_frames    : Giới hạn số frame (dùng để test nhanh)
    verbose       : In tiến trình

    Returns
    -------
    dict với cấu trúc:
    {
      "meta": { videoPath, model, fps, totalFrames, durationMs },
      "frames": [ { frameIdx, timeMs, activeLeg, kneeAngle, hipAngle, speed,
                    kickState, landmarks: [{x,y,conf}, ...] } ],
      "kicks": [ KickResult.to_dict(), ... ],
      "summary": { totalKicks, avgScore, bestScore, bestKickIdx }
    }
    """
    # ── 1. Tải model ──
    if verbose:
        print(f"🤖 Đang tải model {model_name}...")
    model = YOLO(model_name)

    # ── 2. Mở video ──
    local_path = download_video_if_url(input_path)
    cap = cv2.VideoCapture(local_path)

    if not cap.isOpened():
        raise ValueError(f"Không thể mở video: {local_path}")

    fps         = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    img_w       = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    img_h       = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    if max_frames:
        total_frames = min(total_frames, max_frames)

    if verbose:
        print(f"📹 Video: {img_w}x{img_h} @ {fps:.1f}fps — {total_frames} frames")

    # ── 3. Khởi tạo state ──
    ema_states: dict[int, EMAState] = {i: EMAState() for i in range(17)}
    kick_analyzer  = KickAnalyzer()
    punch_analyzer = PunchAnalyzer()
    health_monitor = SessionHealthMonitor()  # Anomaly Detection pipeline

    frame_records  = []
    last_ankle: Optional[Point] = None
    last_time_ms = 0.0
    last_keypoints: Optional[list[Point]] = None  # cache frame trước

    iterator = range(total_frames)
    if HAS_TQDM and verbose:
        iterator = tqdm(iterator, desc="Xử lý frame", unit="frame")

    # ── 4. Vòng lặp frame ──
    for frame_idx in iterator:
        ret, frame = cap.read()
        if not ret:
            break

        time_ms = (frame_idx / fps) * 1000.0

        # Chạy YOLO mỗi N frame (hoặc mỗi frame)
        run_detect = (frame_idx % DETECT_EVERY_N_FRAMES == 0)
        keypoints: Optional[list[Point]] = None

        if run_detect:
            results = model(frame, conf=conf_threshold, verbose=False)

            # Chọn người có bounding box lớn nhất (người chính diễn)
            best_person = _select_main_person(results)

            if best_person is not None:
                raw_kps = best_person.tolist()   # [[x,y,conf], ...]
                keypoints = parse_yolo_keypoints(raw_kps, img_w, img_h)
                last_keypoints = keypoints
            else:
                keypoints = last_keypoints  # dùng cache nếu mất detection
        else:
            keypoints = last_keypoints

        # ── 5. EMA Filter ──
        filtered_kps: list[Point] = []
        if keypoints:
            for i, kp in enumerate(keypoints):
                filtered = apply_ema(kp, ema_states[i], EMA_ALPHA)
                filtered_kps.append(filtered)
        else:
            # Không có detection: ghi frame rỗng
            frame_records.append({
                "frameIdx":        frame_idx,
                "timeMs":          round(time_ms, 1),
                "activeLeg":       "none",
                "kneeAngle":       0,
                "hipAngle":        0,
                "elbowAngleLeft":  0,
                "elbowAngleRight": 0,
                "activeArm":       "none",
                "punchState":      punch_analyzer.state.value,
                "punchStateLabel": PUNCH_STATE_LABELS[punch_analyzer.state],
                "speed":           0,
                "kickState":       kick_analyzer.state.value,
                "kickStateLabel":  KICK_STATE_LABELS[kick_analyzer.state],
                "landmarks":       [],
            })
            continue

        # ── 6. Tính metrics chân & máy trạng thái đá ──
        active_leg = detect_active_leg(filtered_kps)

        if active_leg == "left":
            hip_idx, knee_idx, ankle_idx, shoulder_idx = (
                KP.LEFT_HIP, KP.LEFT_KNEE, KP.LEFT_ANKLE, KP.LEFT_SHOULDER
            )
        else:
            hip_idx, knee_idx, ankle_idx, shoulder_idx = (
                KP.RIGHT_HIP, KP.RIGHT_KNEE, KP.RIGHT_ANKLE, KP.RIGHT_SHOULDER
            )

        hip      = filtered_kps[hip_idx]
        knee     = filtered_kps[knee_idx]
        ankle    = filtered_kps[ankle_idx]
        shoulder = filtered_kps[shoulder_idx]

        knee_angle = calculate_angle(hip, knee, ankle)
        hip_angle  = calculate_angle(shoulder, hip, knee) if shoulder.conf > 0.3 else 0.0

        kick_result = kick_analyzer.update(
            knee_angle=knee_angle,
            hip_angle=hip_angle,
            ankle=ankle,
            frame_idx=frame_idx,
            time_ms=time_ms,
        )

        # ── 6b. Hook Kick vào Health Monitor ──
        if kick_result is not None:
            torso_len = estimate_torso_length(filtered_kps)
            health_monitor.on_kick_event(
                leg=active_leg if active_leg in ("left", "right") else "right",
                max_extension_angle=kick_result.max_extension_angle,
                peak_speed=kick_result.peak_speed,
                time_ms=time_ms,
                torso_length=torso_len,
            )

        # ── 7. Tính metrics tay & máy trạng thái đấm ──
        l_sh = filtered_kps[KP.LEFT_SHOULDER]
        r_sh = filtered_kps[KP.RIGHT_SHOULDER]
        l_el = filtered_kps[KP.LEFT_ELBOW]
        r_el = filtered_kps[KP.RIGHT_ELBOW]
        l_wr = filtered_kps[KP.LEFT_WRIST]
        r_wr = filtered_kps[KP.RIGHT_WRIST]

        l_elbow_angle = calculate_angle(l_sh, l_el, l_wr) if min(l_sh.conf, l_el.conf, l_wr.conf) > 0.25 else 75.0
        r_elbow_angle = calculate_angle(r_sh, r_el, r_wr) if min(r_sh.conf, r_el.conf, r_wr.conf) > 0.25 else 75.0

        punch_result = punch_analyzer.update(
            keypoints=filtered_kps,
            frame_idx=frame_idx,
            time_ms=time_ms,
        )

        # ── 7b. Hook Punch vào Health Monitor ──
        if punch_result is not None:
            torso_len = estimate_torso_length(filtered_kps)
            health_monitor.on_punch_event(
                punch_type=punch_result.punch_type,
                arm=punch_result.arm,
                max_elbow_angle=punch_result.max_elbow_angle,
                peak_speed=punch_result.peak_speed,
                time_ms=time_ms,
                torso_length=torso_len,
            )

        # ── 8. Ghi record frame ──
        frame_records.append({
            "frameIdx":        frame_idx,
            "timeMs":          round(time_ms, 1),
            "activeLeg":       active_leg,
            "kneeAngle":       round(knee_angle, 1),
            "hipAngle":        round(hip_angle, 1),
            "elbowAngleLeft":  round(l_elbow_angle, 1),
            "elbowAngleRight": round(r_elbow_angle, 1),
            "activeArm":       punch_analyzer.active_arm,
            "punchState":      punch_analyzer.state.value,
            "punchStateLabel": PUNCH_STATE_LABELS[punch_analyzer.state],
            "kickState":       kick_analyzer.state.value,
            "kickStateLabel":  KICK_STATE_LABELS[kick_analyzer.state],
            "angleColorLabel": get_angle_color_label(knee_angle),
            "landmarks": [
                {"x": round(p.x, 4), "y": round(p.y, 4), "conf": round(p.conf, 3)}
                for p in filtered_kps
            ],
        })

        last_time_ms = time_ms

    cap.release()

    # Dọn dẹp video tạm tải từ URL để giải phóng ổ đĩa
    if local_path != input_path and os.path.exists(local_path):
        try:
            os.remove(local_path)
            if verbose:
                print(f"🧹 Đã xóa file video tạm: {local_path}")
        except Exception:
            pass

    # ── 9. Tổng hợp kết quả (Kicks, Punches, Findings) ──
    kicks_dicts   = [r.to_dict() for r in kick_analyzer.results]
    punches_dicts = [p.to_dict() for p in punch_analyzer.results]

    all_findings = []
    for p in punch_analyzer.results:
        for f in p.findings:
            all_findings.append(f.to_dict())

    all_scores = [r.score for r in kick_analyzer.results] + [p.score for p in punch_analyzer.results]
    total_punches = len(punch_analyzer.results)
    total_kicks   = len(kick_analyzer.results)

    if total_punches > total_kicks:
        primary_action = "punch"
    elif total_kicks > total_punches:
        primary_action = "kick"
    else:
        primary_action = "mixed" if (total_punches > 0) else "idle"

    # ── Anomaly Detection: thu thập tất cả alerts đã xác nhận ──
    confirmed_alerts = [a.to_dict() for a in health_monitor.get_confirmed_alerts()]
    joint_states     = health_monitor.get_joint_states()

    summary = {
        "totalKicks":         total_kicks,
        "totalPunches":       total_punches,
        "primaryAction":      primary_action,
        "avgScore":           round(sum(all_scores) / len(all_scores), 1) if all_scores else 0,
        "bestScore":          max(all_scores) if all_scores else 0,
        "bestKickIdx":        [r.score for r in kick_analyzer.results].index(max([r.score for r in kick_analyzer.results])) if kick_analyzer.results else -1,
        "bestPunchIdx":       [p.score for p in punch_analyzer.results].index(max([p.score for p in punch_analyzer.results])) if punch_analyzer.results else -1,
        "healthAlertCount":   len(confirmed_alerts),
        "jointHealthStates":  joint_states,
    }

    output = {
        "meta": {
            "videoPath":    input_path,
            "model":        model_name,
            "fps":          round(fps, 2),
            "totalFrames":  len(frame_records),
            "durationMs":   round((len(frame_records) / fps) * 1000, 1),
            "imgWidth":     img_w,
            "imgHeight":    img_h,
            "processedAt":  time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        },
        "frames":        frame_records,
        "kicks":         kicks_dicts,
        "punches":       punches_dicts,
        "findings":      all_findings,
        "healthAlerts":  confirmed_alerts,  # ← Anomaly Detection output
        "summary":       summary,
    }

    # ── 10. Xuất file JSON ──
    if output_path:
        out_file = Path(output_path)
        out_file.parent.mkdir(parents=True, exist_ok=True)
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False, indent=2)
        if verbose:
            print(f"\n✅ Đã lưu kết quả: {out_file}")

    if verbose:
        print(f"\n📊 Tổng kết:")
        print(f"   • Frames: {len(frame_records)}")
        print(f"   • Hành động chính: {summary['primaryAction'].upper()}")
        print(f"   • Cú đấm phát hiện: {summary['totalPunches']}")
        print(f"   • Cú đá phát hiện: {summary['totalKicks']}")
        print(f"   • AI Technique Findings: {len(all_findings)}")
        if all_scores:
            print(f"   • Điểm trung bình: {summary['avgScore']}")
            print(f"   • Điểm cao nhất: {summary['bestScore']}")
        if confirmed_alerts:
            print(f"   ⚠️  Health Alerts (CONFIRMED_IMPAIRMENT): {len(confirmed_alerts)}")
            for a in confirmed_alerts:
                print(f"      – {a['joint']}: avg_ROM={a['avgRomRatio']:.0%}, severity={a['severity']}")
        else:
            print(f"   ✅ Không phát hiện dấu hiệu chấn thương cơ học")

    return output


def _select_main_person(yolo_results) -> Optional[np.ndarray]:
    """
    Từ output của YOLO, chọn người có bounding box diện tích lớn nhất.
    Trả về mảng keypoints [[x,y,conf], ...] của người đó.
    """
    best_area = 0
    best_kps  = None

    for result in yolo_results:
        if result.keypoints is None:
            continue
        boxes    = result.boxes
        keypoints = result.keypoints

        for i in range(len(boxes)):
            box = boxes[i].xyxy[0].tolist()  # [x1, y1, x2, y2]
            area = (box[2] - box[0]) * (box[3] - box[1])
            if area > best_area:
                best_area = area
                # keypoints.data shape: [N_persons, 17, 3]
                best_kps = keypoints.data[i].cpu().numpy()  # [17, 3]

    return best_kps


# ─── CLI entry point ───
if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Phân tích kỹ thuật võ thuật từ video dùng YOLO-Pose"
    )
    parser.add_argument("--input",  "-i", required=True,
                        help="Đường dẫn video MP4 hoặc URL")
    parser.add_argument("--output", "-o", default="result.json",
                        help="File JSON output (mặc định: result.json)")
    parser.add_argument("--model",  "-m", default="yolov8n-pose",
                        choices=["yolov8n-pose", "yolov8s-pose", "yolov8m-pose",
                                 "yolov8l-pose", "yolov8x-pose"],
                        help="Model YOLO-Pose (n=nhanh/CPU, x=chính xác/GPU)")
    parser.add_argument("--conf",   "-c", type=float, default=0.5,
                        help="Ngưỡng confidence (0–1, mặc định: 0.5)")
    parser.add_argument("--max-frames", type=int, default=None,
                        help="Giới hạn số frame (dùng để test nhanh)")

    args = parser.parse_args()

    try:
        process_video(
            input_path=args.input,
            model_name=args.model,
            output_path=args.output,
            conf_threshold=args.conf,
            max_frames=args.max_frames,
        )
    except KeyboardInterrupt:
        print("\n⛔ Đã dừng.")
    except Exception as e:
        print(f"❌ Lỗi: {e}", file=sys.stderr)
        raise

