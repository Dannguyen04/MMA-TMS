import json
from pathlib import Path

import numpy as np
import pytest

import build_coach_review_dataset as builder


def row(index, start, end, technique="jab"):
    return {"id": str(index), "startFrame": start, "endFrame": end, "technique": technique}


def test_unlabelled_gaps_never_become_background_or_coach_confirmed():
    tasks, rejected = builder.review_windows([row(0, 2, 5)], 12, 30)
    assert not rejected
    gaps = [t for t in tasks if t["taskKind"] == "unlabelled_context"]
    assert [(t["startFrame"], t["endFrameExclusive"]) for t in gaps] == [(0, 2), (6, 12)]
    assert all(t["suggestedTechnique"] is None for t in gaps)


def test_shared_inclusive_boundaries_are_preserved_and_flagged():
    tasks, _ = builder.review_windows([row(0, 1, 5), row(1, 5, 9, "cross")], 12, 30)
    labelled = [t for t in tasks if t["suggestedTechnique"]]
    assert labelled[0]["endFrameExclusive"] == 6 and labelled[1]["startFrame"] == 5
    assert all("SOURCE_LABEL_BOUNDARY_OVERLAP" in t["reviewReasons"] for t in labelled)


def test_out_of_range_source_rows_are_quarantined_without_silent_clipping():
    tasks, rejected = builder.review_windows([row(0, 1, 30)], 20, 30)
    assert len(rejected) == 1 and all(t["suggestedTechnique"] is None for t in tasks)


@pytest.mark.parametrize("fps", [0, -1, float("nan")])
def test_invalid_timing_rejected(fps):
    with pytest.raises(ValueError): builder.review_windows([], 20, fps)


def fixture_data(tmp_path, monkeypatch):
    data = tmp_path / "data"
    (data / "clean_annotation_data").mkdir(parents=True)
    (data / "clean_annotation_data/V1.csv").write_text("start_frame,end_frame,class\n1,5,Jab\n")
    (data / "adam_gt.csv").write_text("start_frame,end_frame,class\n1,5,Jab\n")
    (data / "adam.mp4").write_bytes(b"test-only-not-real-video")
    audit = {"inputHashes": {"test": "hash"}, "videos": [{"rejected": []}], "excluded": []}
    expected = tmp_path / "audit.json"
    expected.write_text(json.dumps(audit))
    groups = {"V1": (np.ones((1, 25, 85), dtype=np.float32), np.array([0]), [0])}
    monkeypatch.setattr(builder, "prepare", lambda _: (groups, audit))
    monkeypatch.setattr(builder, "probe_video", lambda _: {"fps": 30, "decodedFrames": 12, "declaredFrames": 12,
        "width": 320, "height": 240, "durationMs": 400, "variableFrameRateVerified": False})
    return data, expected


def test_pack_never_fabricates_approval_identity_or_split(tmp_path, monkeypatch):
    data, expected = fixture_data(tmp_path, monkeypatch)
    output = tmp_path / "pack"
    report = builder.build_pack(data, output, validation_directory=tmp_path / "unused", expected_audit=expected)
    assert report["coachConfirmed"] == report["goldEligible"] == 0
    index = json.loads((output / "review_index.json").read_text(encoding="utf-8"))
    assert index["researchSampleCount"] == 1 and not index["productionEligible"]
    assert all(t["technique"] is None and not t["coachConfirmed"] and t["assignedSplit"] is None for t in index["tasks"])
    research = json.loads((output / "research_samples.json").read_text(encoding="utf-8"))["samples"][0]
    assert research["fighterId"] is None and research["sessionId"] is None and not research["rgbAvailableInPack"]
    assert builder.digest(output / "review_index.json") == report["artifactHashes"]["review_index.json"]
    with np.load(output / "research_features.npz", allow_pickle=False) as archive:
        assert archive["features"].shape == (1, 25, 85)
    with pytest.raises(ValueError, match="immutable"):
        builder.build_pack(data, output, validation_directory=tmp_path / "unused", expected_audit=expected)


def test_changed_pinned_data_rejected_before_output(tmp_path, monkeypatch):
    data, expected = fixture_data(tmp_path, monkeypatch)
    expected.write_text(json.dumps({"inputHashes": {"changed": "hash"}}))
    with pytest.raises(ValueError, match="hashes differ"):
        builder.build_pack(data, tmp_path / "pack", validation_directory=tmp_path / "unused", expected_audit=expected)
    assert not (tmp_path / "pack").exists()
