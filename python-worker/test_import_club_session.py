import json
from pathlib import Path

import cv2
import numpy as np
import pytest

import import_club_session as importer
import review_timeline as rt


def make_video(path, frames=30, fps=30.0):
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"mp4v"), fps, (64, 48))
    assert writer.isOpened()
    for index in range(frames):
        writer.write(np.full((48, 64, 3), index * 5 % 255, dtype=np.uint8))
    writer.release()
    return path


def fake_probe(**override):
    meta = {"fps": 30.0, "decodedFrames": 600, "declaredFrames": 600, "width": 1920, "height": 1080,
            "durationMs": 20000.0, "timingBasis": "decoded_frame_index_over_reported_fps",
            "variableFrameRateVerified": False, "timestampJitterMs": 0.0}
    meta.update(override)
    return lambda _: meta


def common(**extra):
    return {"source_video_id": "F007_S1", "fighter_id": "F007", "session_id": "S1", **extra}


def test_import_real_video_records_hash_timing_ids_and_no_confirmation(tmp_path):
    source = make_video(tmp_path / "NguyenVanA-private-clip.mp4")
    report = importer.build_session_pack(source, tmp_path / "pack", consent_reference="CONSENT-F007",
                                         camera_view="front", declared_stance="orthodox", guide_version="v1",
                                         **common())
    pack = tmp_path / "pack"
    index = json.loads((pack / "review_index.json").read_text(encoding="utf-8"))
    video = index["video"]
    assert video["sha256"] == importer.sha256_file(source) == importer.sha256_file(pack / "media/F007_S1.mp4")
    assert video["decodedFrames"] == 30 and video["fps"] == pytest.approx(30.0) and video["durationMs"] == pytest.approx(1000.0)
    assert (video["width"], video["height"]) == (64, 48) and video["variableFrameRateVerified"] is False
    assert (video["fighterId"], video["sessionId"], video["sourceVideoId"]) == ("F007", "S1", "F007_S1")
    assert (video["consentReference"], video["cameraView"], video["declaredStance"]) == ("CONSENT-F007", "front", "orthodox")
    assert report["packId"] == index["packId"] and index["guideVersion"] == "v1"
    # không cờ nào được tự đặt: đồng ý, danh tính, quyền dùng dữ liệu, HLV, gold, tiền gán nhãn
    assert (video["consentVerified"], video["identityVerified"], video["dataUseApproved"]) == (False, False, False)
    assert (index["dataUseApproved"], index["productionEligible"], index["modelPrefillUsed"]) == (False, False, False)
    assert index["coachConfirmedCount"] == 0 and index["goldEligibleCount"] == 0 and index["annotationCoverage"] == "unverified"
    assert "intervals" not in index and "tasks" not in index  # timeline bắt đầu trống


def test_original_file_name_never_leaks_into_the_pack(tmp_path):
    source = make_video(tmp_path / "NguyenVanA-private-clip.mp4")
    importer.build_session_pack(source, tmp_path / "pack", **common())
    for path in (tmp_path / "pack").rglob("*"):
        assert "NguyenVanA" not in path.name and "private" not in path.name
        if path.suffix in {".json", ".html", ".md"}:
            assert "NguyenVanA" not in path.read_text(encoding="utf-8")


def test_html_embeds_shared_core_and_safe_metadata_and_pack_is_immutable(tmp_path):
    importer.build_session_pack(make_video(tmp_path / "v.mp4"), tmp_path / "pack", consent_reference="C-1", **common())
    html = (tmp_path / "pack/review.html").read_text(encoding="utf-8")
    core = (Path(importer.ROOT) / "review_tools/timeline_core.js").read_text(encoding="utf-8")
    assert core in html and "__REVIEW_DATA_JSON__" not in html and "__TIMELINE_CORE_JS__" not in html
    assert html.count("</script>") == 3  # dữ liệu JSON, lõi timeline, giao diện: không thẻ script thừa từ dữ liệu
    data = html.split('id="reviewData">')[1].split("</script>")[0]
    assert json.loads(data)["video"]["sourceVideoId"] == "F007_S1" and "<" not in data
    with pytest.raises(ValueError, match="bất biến"):
        importer.build_session_pack(tmp_path / "v.mp4", tmp_path / "pack", **common())


@pytest.mark.parametrize("field,value", [
    ("source_video_id", "Nguyễn Văn A"), ("fighter_id", "an@club.vn"), ("session_id", "buổi 1"),
    ("fighter_id", "Nguyen Van A"), ("consent_reference", "0912 345 678"), ("guide_version", "v 1"),
])
def test_ids_with_names_or_contact_details_are_rejected_before_anything_is_written(tmp_path, field, value):
    kwargs = common()
    kwargs[field] = value
    with pytest.raises(ValueError):
        importer.build_session_pack(make_video(tmp_path / "v.mp4"), tmp_path / "pack", **kwargs)
    assert not (tmp_path / "pack").exists()


@pytest.mark.parametrize("kwargs", [{"camera_view": "top"}, {"declared_stance": "switching"}])
def test_enumerated_metadata_is_validated(tmp_path, kwargs):
    with pytest.raises(ValueError):
        importer.build_session_pack(make_video(tmp_path / "v.mp4"), tmp_path / "pack", **common(**kwargs))


def test_missing_or_undecodable_video_leaves_no_pack(tmp_path):
    with pytest.raises(ValueError, match="Không tìm thấy"):
        importer.build_session_pack(tmp_path / "missing.mp4", tmp_path / "pack", **common())
    bogus = tmp_path / "bogus.mp4"
    bogus.write_bytes(b"not a video")
    with pytest.raises(ValueError):
        importer.build_session_pack(bogus, tmp_path / "pack2", **common())
    assert not (tmp_path / "pack").exists() and not (tmp_path / "pack2").exists()


def test_failure_while_writing_removes_the_partial_pack(tmp_path, monkeypatch):
    def boom(*_):
        raise OSError("disk full")
    monkeypatch.setattr(importer.shutil, "copyfile", boom)
    with pytest.raises(OSError):
        importer.build_session_pack(make_video(tmp_path / "v.mp4"), tmp_path / "pack", **common())
    assert not (tmp_path / "pack").exists()


@pytest.mark.parametrize("override,expected", [
    ({"fps": 15.0}, ["LOW_FPS"]), ({"fps": 24.0}, ["FPS_NOT_30"]), ({"fps": 29.97}, []),
    ({"decodedFrames": 597}, ["FRAME_COUNT_MISMATCH"]), ({"timestampJitterMs": 30.0}, ["VFR_SUSPECTED"]),
    ({"timestampJitterMs": 5.0}, []), ({"timestampJitterMs": None}, []),
])
def test_probe_warnings_flag_but_do_not_block(tmp_path, override, expected):
    report = importer.build_session_pack(make_video(tmp_path / "v.mp4"), tmp_path / "pack", consent_reference="C1",
                                         probe=fake_probe(**override), **common())
    assert report["warnings"] == expected
    index = json.loads((tmp_path / "pack/review_index.json").read_text(encoding="utf-8"))
    assert index["video"]["variableFrameRateVerified"] is False


def test_missing_consent_reference_is_flagged_not_invented(tmp_path):
    report = importer.build_session_pack(make_video(tmp_path / "v.mp4"), tmp_path / "pack", **common())
    assert "NO_CONSENT_REFERENCE" in report["warnings"]
    index = json.loads((tmp_path / "pack/review_index.json").read_text(encoding="utf-8"))
    assert index["video"]["consentReference"] is None


def test_cli_main_imports_and_prints_report(tmp_path, capsys):
    source = make_video(tmp_path / "v.mp4")
    code = importer.main(["--video", str(source), "--output", str(tmp_path / "pack"), "--source-video-id", "F001_S2",
                          "--fighter-id", "F001", "--session-id", "S2", "--camera-view", "side"])
    assert code == 0
    assert json.loads(capsys.readouterr().out)["sourceVideoId"] == "F001_S2"
    assert (tmp_path / "pack/media/F001_S2.mp4").is_file() and rt.PACK_SCHEMA == "club_timeline_pack_v1"
