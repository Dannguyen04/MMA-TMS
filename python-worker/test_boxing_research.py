import numpy as np
import pytest

from pipeline.boxing_research import (LABELS, SPLITS, normalize_label, pose_features,
    classification_metrics, evaluate_intervals, interval_matches, softmax, read_labels)


def clip():
    pose = np.ones((12, 17, 2), dtype=np.float32) * .5
    pose[:, [5, 6], 1] = .2
    pose[:, [11, 12], 1] = .7
    pose[:, 9, 0] = np.linspace(.3, .8, len(pose))
    return pose


def test_splits_are_disjoint_and_v6_quarantined():
    videos = [v for group in SPLITS.values() for v in group]
    assert len(videos) == len(set(videos))
    assert "V6" not in videos


@pytest.mark.parametrize("value,expected", [("Jab ", "jab"), ("Rear uppercut", "rear_uppercut"), ("Lead hook", "lead_hook")])
def test_label_normalization(value, expected):
    assert normalize_label(value) == expected


def test_unknown_label_not_guessed():
    with pytest.raises(ValueError):
        normalize_label("left")


def test_features_are_padding_translation_and_uniform_scale_invariant():
    raw = clip()
    original = pose_features(raw)
    assert original.shape == (25, 85)
    padded = np.pad(raw, ((0, 13), (0, 0), (0, 0)))
    np.testing.assert_allclose(original, pose_features(padded))
    np.testing.assert_allclose(original, pose_features(raw * 2 + .1), atol=1e-6)


@pytest.mark.parametrize("kind", ["empty", "nan", "gap", "zero_scale", "wrong_shape"])
def test_invalid_pose_is_rejected(kind):
    raw = clip()
    if kind == "empty": raw[:] = 0
    if kind == "nan": raw[2, 5, 0] = np.nan
    if kind == "gap": raw[5] = 0
    if kind == "zero_scale": raw[:, [5, 6], 1] = .7
    if kind == "wrong_shape": raw = raw[..., :1]
    with pytest.raises(ValueError): pose_features(raw)


def test_missing_joint_has_mask_and_no_velocity_spike():
    raw = clip()
    raw[:, 9] = 0
    features = pose_features(raw)
    assert (features[:, 18:20] == 0).all()
    assert (features[:, 52:54] == 0).all()
    assert (features[:, 77] == 0).all()


def event(start, end, label="jab"):
    return {"startFrame": start, "endFrame": end, "technique": label}


def test_duplicate_predictions_cannot_inflate_recall():
    result = evaluate_intervals([event(0, 20)], [event(1, 19), event(1, 19)])
    assert (result["tp"], result["fp"], result["fn"]) == (1, 1, 0)
    assert result["impactTimingErrorMs"] is None


def test_matching_maximizes_cardinality_not_greedy_overlap():
    matches = interval_matches([event(0, 9), event(10, 19)], [event(0, 19), event(0, 3)], .1)
    assert len(matches) == 2


def test_missing_events_and_abstentions_stay_in_classification_denominator():
    result = evaluate_intervals([event(0, 9), event(20, 29, "cross")], [event(0, 9)])
    metrics = result["classificationAcrossAllAnnotatedEvents"]
    assert metrics["accuracy"] == .5 and metrics["abstained"] == 1
    assert metrics["perClass"]["cross"]["recall"] == 0


def test_interval_threshold_and_disjoint_events():
    assert not interval_matches([event(0, 9)], [event(10, 20)], .1)
    with pytest.raises(ValueError): interval_matches([], [], 0)


def test_metrics_and_probabilities():
    result = classification_metrics(LABELS, LABELS)
    assert result["accuracy"] == 1 and result["macroF1"] == 1
    np.testing.assert_allclose(softmax([[1000, 1000]]), [[.5, .5]])


def test_invalid_source_intervals_never_shift_pose_label_row_alignment(tmp_path):
    path = tmp_path / "source.csv"
    path.write_text("start_frame,end_frame,class\n10,20,Jab\n40,30,Cross\n50,60,Lead hook\n")
    with pytest.raises(ValueError): read_labels(path)
    rows = read_labels(path, allow_invalid_intervals=True)
    assert len(rows) == 3 and not rows[1]["validInterval"]
    assert rows[2]["id"] == "2" and rows[2]["technique"] == "lead_hook"
