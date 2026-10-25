import numpy as np
import pytest

from pipeline.pose_normalizer import NormalizerConfig, PoseNormalizer

QUALITY = {"status": "pass", "metrics": {"trackingEvidenceAvailable": True, "maxSimultaneousPersons": 1}}


def frames(count=10, fps=30, width=640, height=480):
    result = []
    for i in range(count):
        pixels = np.tile([300., 200.], (17, 1))
        pixels[[5, 6], 1] = 150
        pixels[[11, 12], 1] = 250
        pixels[9, 0] = 310 + 60 * i / fps
        result.append({"frameIdx": i, "timeMs": 1000 * i / fps,
                       "observationKind": "fresh_detection", "trackId": "a",
                       "landmarks": [{"x": x / width, "y": y / height, "conf": .9} for x, y in pixels]})
    return result


def transform(data, **kwargs):
    return PoseNormalizer(NormalizerConfig(**kwargs)).transform(data, width=640, height=480, quality=QUALITY)


def test_resampling_preserves_physical_velocity_and_duration():
    a, _ = transform(frames(31, 30))
    b, _ = transform(frames(61, 60))
    np.testing.assert_allclose(a[0]["positions"], b[0]["positions"], atol=1e-6)
    np.testing.assert_allclose(a[0]["velocity"][1:, 9, 0], .6, atol=1e-6)
    assert a[0]["timestamps_ms"][-1] == 1000
    assert not a[0]["velocity_mask"][0].any()


def test_geometry_uses_image_aspect_and_is_translation_scale_invariant():
    data = frames()
    expected, _ = transform(data)
    wide = frames(width=1280)
    actual, _ = PoseNormalizer().transform(wide, width=1280, height=480, quality=QUALITY)
    np.testing.assert_allclose(expected[0]["positions"], actual[0]["positions"], atol=1e-6)
    for f in data:
        for p in f["landmarks"]:
            p["x"] = p["x"] * .7 + .1
            p["y"] = p["y"] * .7 + .1
    actual, _ = transform(data)
    np.testing.assert_allclose(expected[0]["positions"], actual[0]["positions"], atol=1e-6)


def test_coordinates_are_not_clamped_and_root_motion_is_preserved():
    data = frames()
    for i, f in enumerate(data):
        f["landmarks"][9]["x"] = .9
        for p in f["landmarks"]:
            p["x"] += i / 640
    sequences, _ = transform(data)
    assert sequences[0]["positions"][0, 9, 0] > 1
    np.testing.assert_allclose(sequences[0]["root_velocity"][1:, 0], .3, atol=1e-6)


@pytest.mark.parametrize("kind", ["cached", "discontinuous", "missing_torso", "identity", "frame_gap", "time_gap"])
def test_no_run_crosses_unreliable_evidence(kind):
    data = frames(15)
    if kind == "cached": data[7]["observationKind"] = "cached"
    if kind == "discontinuous": data[7]["isDiscontinuous"] = True
    if kind == "missing_torso": data[7]["landmarks"][11]["conf"] = .1
    if kind == "identity":
        for f in data[7:]: f["trackId"] = "b"
    if kind == "frame_gap":
        for f in data[7:]: f["frameIdx"] += 1
    if kind == "time_gap":
        for f in data[7:]: f["timeMs"] += 200
    sequences, report = transform(data)
    assert len(sequences) == 2
    assert sequences[0]["timestamps_ms"][-1] < sequences[1]["timestamps_ms"][0]
    assert report["productionEligible"] is False


def test_missing_joint_does_not_become_origin_or_velocity_spike():
    data = frames(15)
    data[7]["landmarks"][9]["conf"] = .1
    seq = transform(data, target_fps=60)[0][0]
    assert not seq["mask"][13:16, 9].any()
    assert not seq["positions"][13:16, 9].any()
    assert not seq["velocity"][13:17, 9].any()
    assert not seq["confidence"][13:16, 9].any()


def test_downsampling_does_not_hide_missing_joint_in_velocity():
    data = frames(31, 60)
    data[1]["landmarks"][9]["conf"] = .1
    seq = transform(data)[0][0]
    assert seq["mask"][0:2, 9].all()
    assert not seq["velocity_mask"][1, 9]


@pytest.mark.parametrize("bad", [float("nan"), -1, 0])
def test_invalid_timestamps_rejected(bad):
    data = frames()
    data[4]["timeMs"] = bad
    with pytest.raises(ValueError): transform(data)


def test_variable_frame_rate_uses_timestamps():
    data = frames(6)
    for f, t in zip(data, [0, 20, 55, 90, 140, 180]):
        f["timeMs"] = t
        f["landmarks"][9]["x"] = (310 + .06 * t) / 640
    seq = transform(data)[0][0]
    np.testing.assert_allclose(seq["velocity"][1:, 9, 0], .6, atol=1e-6)
    assert seq["timestamps_ms"][-1] <= 180


def test_unverified_or_multi_person_quality_is_blocked():
    for quality in ({}, {"status": "blocked"}, {"status": "pass", "metrics": {
            "trackingEvidenceAvailable": True, "maxSimultaneousPersons": 2}}):
        sequences, report = PoseNormalizer().transform(frames(), width=640, height=480, quality=quality)
        assert not sequences and report["status"] == "unavailable"


def test_export_is_numeric_hashed_and_does_not_overwrite(tmp_path):
    import json
    from prepare_temporal_pose import export_pose
    from pipeline.boxing_research import digest
    source = tmp_path / "worker.json"
    source.write_text(json.dumps({"meta": {"imgWidth": 640, "imgHeight": 480},
                                  "analysisQuality": QUALITY, "frames": frames()}), encoding="utf-8")
    output = tmp_path / "output"
    report = export_pose(source, output, NormalizerConfig())
    artifact = report["segmentsManifest"][0]
    assert digest(output / artifact["path"]) == artifact["sha256"]
    with np.load(output / artifact["path"], allow_pickle=False) as data:
        assert data["features"].shape == (10, 85)
    with pytest.raises(FileExistsError): export_pose(source, output, NormalizerConfig())
