from copy import deepcopy
import json
import math

import pytest

from coaching_delivery import build_coaching_delivery
from pipeline.movement_evidence import build_movement_evidence, normalize_exercise_context
from pipeline.release_safety import withhold_unvalidated_assessment


def frames(n=60):
    return [{"frameIdx": i, "timeMs": i * 1000 / 30,
             "observationKind": "fresh_detection", "isDiscontinuous": False,
             "landmarks": [{"x": .2 + j * .02, "y": .3 + j * .02, "conf": .9} for j in range(17)]}
            for i in range(n)]


def report(data=None, **kwargs):
    defaults = dict(fps=30, width=1280, height=720,
                    quality={"status": "pass", "qualityVersion": "1.0.0",
                             "metrics": {"trackingEvidenceAvailable": True, "maxSimultaneousPersons": 1}},
                    exercise_context={"exerciseId": "assigned-drill-1"}, camera_view="SIDE")
    defaults.update(kwargs)
    return build_movement_evidence(frames() if data is None else data, **defaults)


def test_independent_of_strike_labels_and_never_a_clinical_assessment():
    data = frames()
    original = deepcopy(data)
    result = report(data)
    assert data == original
    assert result["status"] == "review_ready"
    assert result["coverage"]["usableRatio"] == 1
    assert result["windows"][0]["startFrame"] == 0
    assert result["windows"][0]["endFrame"] == 59
    assert result["windows"][0]["confidence"] is None
    assert result["context"]["exerciseVerified"] is False
    assert result["measurementPolicy"] == {
        "validationStatus": "NOT_VALIDATED", "assessmentEnabled": False,
        "clinicalUseEnabled": False, "automaticComparisonEnabled": False, "repetitionCount": None}
    json.dumps(result, allow_nan=False)


@pytest.mark.parametrize("reason,change", [
    ("NON_FRESH_POSE", {"observationKind": "cached_between_detection"}),
    ("NON_FRESH_POSE", {"observationKind": None}),
    ("TRACKING_BREAK", {"isDiscontinuous": True}),
    ("TRACKING_BREAK", {"diagnosticOnly": True}),
    ("MISSING_POSE", {"landmarks": []}),
])
def test_never_bridges_excluded_frames(reason, change):
    data = frames()
    data[30].update(change)
    result = report(data)
    assert result["coverage"]["usableFrames"] == 59
    assert result["coverage"]["excludedByReason"] == {reason: 1}
    assert [(w["startFrame"], w["endFrame"]) for w in result["windows"]] == [(0, 29), (31, 59)]


@pytest.mark.parametrize("value", [math.nan, math.inf, -.1, 1.1, None, True, "0.9"])
def test_invalid_landmarks_are_not_visible(value):
    data = frames()
    for f in data:
        f["landmarks"][9]["conf"] = value
    result = report(data)
    assert result["status"] == "recapture"
    assert not result["windows"]
    assert "LOW_VISIBILITY" in result["reasonCodes"]
    json.dumps(result, allow_nan=False)


def test_body_protocol_uses_only_required_joints():
    data = frames()
    for f in data:
        for kp in f["landmarks"][11:]:
            kp["conf"] = 0
    assert report(data)["status"] == "recapture"
    upper = report(data, exercise_context={"protocolId": "upper_body_v1", "purpose": "rehabilitation"})
    assert upper["status"] == "review_ready"
    assert upper["context"]["purpose"] == "rehabilitation"
    assert not upper["measurementPolicy"]["clinicalUseEnabled"]


@pytest.mark.parametrize("quality,code", [
    ({"status": "blocked"}, "QUALITY_BLOCKED"),
    ({"status": "pass"}, "TRACKING_UNVERIFIED"),
    ({"status": "pass", "metrics": {"trackingEvidenceAvailable": True, "maxSimultaneousPersons": 2}}, "MULTIPLE_PEOPLE"),
    ({}, "QUALITY_UNKNOWN"),
])
def test_global_gate_never_promotes_ambiguous_or_unknown_footage(quality, code):
    result = report(quality=quality)
    assert result["status"] == "recapture" and result["windows"] == []
    assert result["coverage"]["usableFrames"] == 0
    assert code in result["reasonCodes"]


@pytest.mark.parametrize("fps", [0, -1, math.nan, math.inf, 10])
def test_invalid_or_low_fps_abstains(fps):
    result = report(fps=fps)
    assert result["status"] == "recapture"
    json.dumps(result, allow_nan=False)


@pytest.mark.parametrize("field,value", [("timeMs", 0), ("timeMs", math.nan), ("frameIdx", 1), ("timeMs", 5000)])
def test_bad_chronology_fails_closed(field, value):
    data = frames()
    data[20][field] = value
    result = report(data)
    assert "INVALID_TIMING" in result["reasonCodes"]
    assert result["windows"] == []


def test_missing_frame_gap_splits_windows():
    data = frames()
    del data[30]
    result = report(data)
    assert [(w["startFrame"], w["endFrame"]) for w in result["windows"]] == [(0, 29), (31, 59)]


def test_empty_short_and_long_footage():
    assert report([])["status"] == "recapture"
    assert report(frames(5))["windows"] == []
    long = report(frames(600))
    assert len(long["windows"]) == 4
    assert all(w["sampleCount"] == 150 for w in long["windows"])


@pytest.mark.parametrize("context", [[], "jab", {"protocolId": "diagnose"}, {"purpose": "clearance"},
                                     {"exerciseId": ""}, {"exerciseId": "x" * 121}, {"approvedByDoctor": True}])
def test_context_does_not_accept_unknown_protocol_or_authority_fields(context):
    with pytest.raises(ValueError):
        normalize_exercise_context(context)


def test_missing_context_is_explicit_not_guessed_from_detections():
    result = report(exercise_context=None, camera_view=None)
    assert result["context"]["exerciseId"] is None
    assert "EXERCISE_NOT_DECLARED" in result["reasonCodes"]
    assert "CAMERA_NOT_DECLARED" in result["reasonCodes"]


def test_safety_and_delivery_keep_evidence_but_never_enable_assessment():
    raw = {"movementEvidence": report(), "actions": [], "analysisQuality": {"status": "pass"}}
    guarded = withhold_unvalidated_assessment(raw)
    assert guarded["movementEvidence"] == raw["movementEvidence"]
    delivery = build_coaching_delivery("job", guarded)
    assert delivery["provenance"]["movementEvidence"] == raw["movementEvidence"]
    delivery["provenance"]["movementEvidence"]["windows"].clear()
    assert raw["movementEvidence"]["windows"]


def test_process_rejects_bad_exercise_before_model_load(monkeypatch):
    import process_video
    monkeypatch.setattr(process_video, "YOLO", lambda *_: pytest.fail("Model must not load"))
    with pytest.raises(ValueError):
        process_video.process_video("unused.mp4", exercise_context={"purpose": "clearance"})
