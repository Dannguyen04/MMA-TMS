import csv
import json
from pathlib import Path

from pipeline.public_dataset import build_manifest


def test_ucf_groups_do_not_cross_splits(tmp_path: Path):
    class_dir = tmp_path / "BoxingPunchingBag"
    class_dir.mkdir()
    for name in ("v_BoxingPunchingBag_g01_c01.avi", "v_BoxingPunchingBag_g01_c02.avi", "v_BoxingPunchingBag_g02_c01.avi"):
        (class_dir / name).write_bytes(b"video")

    manifest = build_manifest("ucf101", tmp_path)
    assert manifest["leakageAudit"]["passed"] is True
    g01 = [sample for sample in manifest["samples"] if sample["groupId"].endswith(":g01")]
    assert len(g01) == 2
    assert len({sample["split"] for sample in g01}) == 1
    assert all(sample["eligibleForTechniqueTraining"] is False for sample in g01)


def test_boxing_dataset_keeps_coarse_labels_and_source_video_group(tmp_path: Path):
    (tmp_path / "videos").mkdir()
    for name in ("a.mp4", "b.mp4", "c.mp4"):
        (tmp_path / "videos" / name).write_bytes(b"video")
    with (tmp_path / "metadata.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["file_name", "label", "source_video"])
        writer.writeheader()
        writer.writerow({"file_name": "videos/a.mp4", "label": "head_left_hand", "source_video": "bout_01.mp4"})
        writer.writerow({"file_name": "videos/b.mp4", "label": "block_right_hand", "source_video": "bout_01.mp4"})
        writer.writerow({"file_name": "videos/c.mp4", "label": "head_right_hand", "source_video": "bout_02.mp4"})

    manifest = build_manifest("boxing_dataset", tmp_path)
    assert manifest["coarseDetectionCount"] == 2
    assert manifest["hardNegativeCount"] == 1
    assert manifest["techniqueTrainingCount"] == 0
    bout_01 = [sample for sample in manifest["samples"] if sample["sourceVideo"] == "bout_01.mp4"]
    assert len({sample["split"] for sample in bout_01}) == 1


def test_coach_labelled_data_is_technique_eligible(tmp_path: Path):
    (tmp_path / "jab.mp4").write_bytes(b"video")
    with (tmp_path / "metadata.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["file_name", "label", "athlete_id"])
        writer.writeheader()
        writer.writerow({"file_name": "jab.mp4", "label": "jab", "athlete_id": "athlete_01"})

    manifest = build_manifest("mma_tms_technique", tmp_path)
    assert manifest["techniqueTrainingCount"] == 1
    assert manifest["samples"][0]["eligibleForTechniqueTraining"] is True


def test_manifest_is_reproducible(tmp_path: Path):
    class_dir = tmp_path / "Punch"
    class_dir.mkdir()
    (class_dir / "v_Punch_g01_c01.avi").write_bytes(b"video")
    first = build_manifest("ucf101", tmp_path)
    second = build_manifest("ucf101", tmp_path)
    assert first["manifestSha256"] == second["manifestSha256"]
    assert json.dumps(first, sort_keys=True) == json.dumps(second, sort_keys=True)
