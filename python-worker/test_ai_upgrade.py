import copy
from dataclasses import replace
import math

import pytest

from coaching_delivery import build_coaching_delivery
from pipeline.strike_events import EventDetectorConfig, detect_punch_events
from test_punch_event_detector_v2 import _frame
from ai_upgrade_benchmark import digest, verify, ROOT, timing


def sequence(fps=25, peaks=(400, 700, 1000), arm="left"):
    frames = []
    for i in range(round(1.5 * fps)):
        t = i * 1000 / fps
        extent = .08 + max(max(0, 1-abs(t-p)/120) for p in peaks)*.2
        f = _frame(**{f"{arm}_extension": extent})
        f.update(frameIdx=i, timeMs=t, observationKind="fresh_detection")
        frames.append(f)
    return frames


@pytest.mark.parametrize("fps", [25, 50, 100])
def test_combo_detection_is_time_based_and_does_not_wait_for_guard(fps):
    result = detect_punch_events(sequence(fps), fps, training_mode="heavy_bag")
    assert len(result["events"]) == 3
    assert all(e["confidence"] is None and e["technique"] == "unknown_punch" for e in result["events"])
    assert [e["impactTimeMs"] for e in result["events"]] == pytest.approx([400, 700, 1000], abs=1000/fps)


def test_overlapping_opposite_arms_are_not_suppressed_by_time_only():
    frames = sequence(peaks=(600,))
    right = sequence(peaks=(600,), arm="right")
    for a, b in zip(frames, right):
        a["landmarks"][10] = b["landmarks"][10]
    result = detect_punch_events(frames, 25, training_mode="shadow_boxing")
    assert {e["side"] for e in result["events"]} == {"left", "right"}


@pytest.mark.parametrize("change", ["gap", "cached", "jump", "ground", "low_confidence", "invalid"])
def test_invalid_evidence_cannot_generate_a_strike(change):
    frames = sequence(peaks=(600,))
    for f in frames[12:19]:
        if change == "gap": f["landmarks"] = []
        if change == "cached": f["observationKind"] = "cached_between_detection"
        if change == "jump": f["isDiscontinuous"] = True
        if change == "ground": f["posture"] = "ground"
        if change == "low_confidence": f["landmarks"][9]["conf"] = .1
        if change == "invalid": f["landmarks"][9]["x"] = math.nan
    result = detect_punch_events(frames, 25, training_mode="heavy_bag")
    assert result["events"] == []
    assert result["invalidFrameReasons"]


def test_nms_suppresses_only_same_arm_neighbors_and_reports_evidence():
    frames = sequence(peaks=(400, 700, 1000))
    result = detect_punch_events(frames, 25, training_mode="heavy_bag", config=replace(EventDetectorConfig(), refractory_ms=650))
    assert len(result["events"]) == 1
    assert any(r["reasonCode"] == "TEMPORAL_NMS" for r in result["rejected"])


@pytest.mark.parametrize("fps", [0, -1, math.nan, math.inf, True])
def test_invalid_fps_rejected(fps):
    with pytest.raises(ValueError): detect_punch_events([], fps, training_mode="heavy_bag")


def test_undeclared_context_abstains():
    assert detect_punch_events(sequence(), 25, training_mode=None)["events"] == []


@pytest.mark.parametrize("gap_after", [11, 18])
def test_extended_boundaries_do_not_cross_timestamp_gap(monkeypatch, gap_after):
    from pipeline import strike_events
    frames = [{"frameIdx": i, "timeMs": i * 40 + (500 if i > gap_after else 0),
               "testReach": max(.7, 1.5 - abs(i - 15) * .1)} for i in range(31)]
    monkeypatch.setattr(strike_events, "_feature", lambda frame, *args: (
        {"reach": frame["testReach"], "elbowAngleDeg": 150}, None))
    events = detect_punch_events(frames, 25, training_mode="shadow_boxing")["events"]
    assert events
    assert all(e["startFrame"] > gap_after if gap_after < 15 else e["endFrame"] <= gap_after for e in events)


def test_delivery_keeps_missing_confidence_null_and_suppresses_degraded_score():
    result = {"analysisQuality": {"status": "degraded"}, "actions": [{"id": "action_1",
        "confidence": {"detection": None, "assessment": .95},
        "assessment": {"score": 90, "findings": [{"id": "finding_1"}]}}]}
    frozen = copy.deepcopy(result)
    delivery = build_coaching_delivery("job", result)
    assert delivery["actions"][0]["confidence"] is None
    assert delivery["actions"][0]["overallScore"] is None
    assert delivery["actions"][0]["assessmentStatus"] == "INSUFFICIENT_EVIDENCE"
    assert delivery["actions"][0]["findings"] == []  # Unvalidated claims cannot escape via callbacks.
    assert result == frozen


def test_manifest_tampering_fails_closed():
    with pytest.raises(ValueError, match="Frozen input changed"):
        verify({"schemaVersion": "1.0.0", "inputs": [{"path": "requirements.txt", "sha256": "0"*64}]})


def test_zero_timing_error_and_no_matches_are_distinct():
    assert timing([{"impact_error_ms": 0}])["p95Ms"] == 0
    assert timing([])["p95Ms"] is None
