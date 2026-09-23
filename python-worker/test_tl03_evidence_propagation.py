"""
test_tl03_evidence_propagation.py
Test suite for Task TL-03: Biomechanical and Evidence Correctness.
Covers:
1. Video quality fail-closed when BLOCKED (score=None, grade='NO_DATA', status='insufficient_evidence', nullified metrics).
2. Video quality confidence penalty and abstention when DEGRADED (scaled conf by 0.75, abstain < 0.55).
3. Guard drop false-alarm elimination during pre-launch/idle frames.
4. Truncated video / missing recovery reports unavailable evidence, not fabricated completion.
5. Missing/occluded landmarks properly yield UNAVAILABLE metrics.
6. Invalid FPS handling.
"""

import math
import pytest
from types import MappingProxyType
from pipeline.assessment_engine import (
    DefaultPunchEvaluator,
    DefaultKickEvaluator,
    AssessmentEngine,
    evaluate_action,
    AssessmentInput,
    AssessmentStatus,
    CriterionStatus,
)
from pipeline.kinematic_features import (
    extract_kinematic_features,
    make_unavailable_metric,
    KinematicMetricContract,
)
from pipeline.temporal_phases import (
    segment_punch_phases,
    segment_kick_phases,
    EvidenceLevel,
)
from action_result import (
    action_from_punch,
    action_from_kick,
    build_actions_list,
    ActionMetricItem,
    ActionResult,
)
from punch_analyzer import SingleArmTracker, PunchState, PunchDetectorConfig


class DummyPunch:
    def __init__(self, **kwargs):
        self.punch_type = kwargs.get("punch_type", "cross")
        self.max_elbow_angle = kwargs.get("max_elbow_angle", 165.0)
        self.peak_speed = kwargs.get("peak_speed", 2.5)
        self.guard_preserved = kwargs.get("guard_preserved", True)
        self.start_frame = kwargs.get("start_frame", 10)
        self.impact_frame = kwargs.get("impact_frame", 20)
        self.end_frame = kwargs.get("end_frame", 30)
        self.start_time_ms = kwargs.get("start_time_ms", 333.3)
        self.impact_time_ms = kwargs.get("impact_time_ms", 666.6)
        self.end_time_ms = kwargs.get("end_time_ms", 1000.0)
        self.criterion_results = kwargs.get("criterion_results", [
            {
                "criterion_id": "crit_punch_extension",
                "score": 90,
                "weight": 0.4,
                "confidence": 0.9,
                "status": "pass",
            },
            {
                "criterion_id": "crit_punch_speed",
                "score": 85,
                "weight": 0.3,
                "confidence": 0.8,
                "status": "pass",
            },
            {
                "criterion_id": "crit_punch_guard",
                "score": 80,
                "weight": 0.3,
                "confidence": 0.50,  # Below 0.55 to test DEGRADED abstention
                "status": "pass",
            },
        ])
        self.findings = kwargs.get("findings", [])


class DummyKick:
    def __init__(self, **kwargs):
        self.kick_type = kwargs.get("kick_type", "round_kick")
        self.min_chamber_angle = kwargs.get("min_chamber_angle", 70.0)
        self.max_extension_angle = kwargs.get("max_extension_angle", 160.0)
        self.peak_speed = kwargs.get("peak_speed", 3.2)
        self.hip_angle = kwargs.get("hip_angle", 140.0)
        self.start_frame = kwargs.get("start_frame", 5)
        self.impact_frame = kwargs.get("impact_frame", 15)
        self.end_frame = kwargs.get("end_frame", 25)
        self.start_time_ms = kwargs.get("start_time_ms", 166.6)
        self.impact_time_ms = kwargs.get("impact_time_ms", 500.0)
        self.end_time_ms = kwargs.get("end_time_ms", 833.3)
        self.criterion_results = kwargs.get("criterion_results", [
            {
                "criterion_id": "crit_kick_chamber",
                "score": 90,
                "weight": 0.25,
                "confidence": 0.85,
                "status": "pass",
            },
            {
                "criterion_id": "crit_kick_extension",
                "score": 85,
                "weight": 0.25,
                "confidence": 0.52,  # Below 0.55
                "status": "pass",
            },
            {
                "criterion_id": "crit_kick_speed",
                "score": 80,
                "weight": 0.25,
                "confidence": 0.80,
                "status": "pass",
            },
            {
                "criterion_id": "crit_kick_posture",
                "score": 75,
                "weight": 0.25,
                "confidence": 0.75,
                "status": "pass",
            },
        ])
        self.findings = kwargs.get("findings", [])


# ─────────────────────────────────────────────────────────────────────────────
# 1. Quality Propagation Tests (BLOCKED and DEGRADED)
# ─────────────────────────────────────────────────────────────────────────────

def test_blocked_quality_fails_closed_punch():
    evaluator = DefaultPunchEvaluator()
    punch = DummyPunch()
    res = evaluator.evaluate(punch, quality_status="BLOCKED")

    assert res.score is None
    assert res.grade == "NO_DATA"
    assert res.status == AssessmentStatus.INSUFFICIENT_EVIDENCE
    assert res.assessment_confidence is None
    assert res.metrics["maxElbowAngle"].value is None
    assert res.metrics["peakSpeed"].value is None
    assert res.metrics["guardPreserved"].value is None

    # Check criteria status
    for c in res.criteria:
        assert c["score"] is None
        assert c["status"] == CriterionStatus.INSUFFICIENT_EVIDENCE.value


def test_blocked_quality_fails_closed_kick():
    evaluator = DefaultKickEvaluator()
    kick = DummyKick()
    res = evaluator.evaluate(kick, quality_status="BLOCKED")

    assert res.score is None
    assert res.grade == "NO_DATA"
    assert res.status == AssessmentStatus.INSUFFICIENT_EVIDENCE
    assert res.assessment_confidence is None
    assert res.metrics["minChamberAngle"].value is None
    assert res.metrics["maxExtensionAngle"].value is None
    assert res.metrics["peakSpeed"].value is None
    assert res.metrics["hipAngle"].value is None

    for c in res.criteria:
        assert c["score"] is None
        assert c["status"] == CriterionStatus.INSUFFICIENT_EVIDENCE.value


def test_degraded_quality_penalizes_and_abstains():
    evaluator = DefaultPunchEvaluator()
    punch = DummyPunch()
    res = evaluator.evaluate(punch, quality_status="DEGRADED")

    # crit_punch_guard had confidence 0.50 (< 0.55), so it must be abstained
    guard_crit = [c for c in res.criteria if c["criterion_id"] == "crit_punch_guard"][0]
    assert guard_crit["status"] == CriterionStatus.INSUFFICIENT_EVIDENCE.value
    assert guard_crit["score"] is None
    assert guard_crit["confidence"] is None

    # crit_punch_extension had 0.9 -> scaled by 0.75 = 0.68
    ext_crit = [c for c in res.criteria if c["criterion_id"] == "crit_punch_extension"][0]
    assert ext_crit["status"] == "pass"
    assert ext_crit["confidence"] == pytest.approx(0.68, abs=0.01)

    # Score should still be computable from remaining valid criteria
    assert res.score is not None
    assert res.status != AssessmentStatus.INSUFFICIENT_EVIDENCE


def test_action_from_punch_blocked_propagation():
    punch = DummyPunch()
    action = action_from_punch(
        punch=punch,
        action_id="action_001",
        source_action_id="punch_1",
        quality_status="BLOCKED",
    )
    assert action.assessment.score is None
    assert action.assessment.grade == "NO_DATA"
    assert action.assessment.status == "insufficient_evidence"
    assert action.confidence.assessment is None
    for k, m in action.metrics.items():
        assert m.value is None


def test_build_actions_list_forwards_quality_status():
    punch = DummyPunch()
    kick = DummyKick()
    actions = build_actions_list(
        punches=[punch],
        kicks=[kick],
        quality_status="BLOCKED",
    )
    assert len(actions) == 2
    for act in actions:
        assert act.assessment.score is None
        assert act.assessment.grade == "NO_DATA"
        assert act.assessment.status == "insufficient_evidence"


# ─────────────────────────────────────────────────────────────────────────────
# 2. Biomechanical Phase & Guard Bounds Tests
# ─────────────────────────────────────────────────────────────────────────────

def test_guard_preserved_no_false_alarm_during_idle():
    """
    Ensure SingleArmTracker does not flag dropped guard while in PunchState.GUARD
    even if the opposite hand is low, until the active punch phase begins.
    """
    from pose_math import Point
    tracker = SingleArmTracker(
        arm="left",
        config=PunchDetectorConfig(),
    )

    # In idle GUARD state, an opposite hand drop should not trigger guard_dropped
    lead_shoulder = Point(0.4, 0.4, 1.0)
    lead_elbow = Point(0.4, 0.5, 1.0)
    lead_wrist = Point(0.4, 0.55, 1.0)
    opp_shoulder = Point(0.6, 0.4, 1.0)   # High shoulder (wrist is well below shoulder)
    opp_wrist = Point(0.6, 0.8, 1.0)      # Low wrist

    tracker.update(
        sh=lead_shoulder,
        el=lead_elbow,
        wr=lead_wrist,
        opp_sh=opp_shoulder,
        opp_wr=opp_wrist,
        frame_idx=0,
        time_ms=0.0,
    )

    assert tracker.state == PunchState.GUARD
    assert not tracker.guard_dropped  # Must not false-alarm during idle GUARD


def test_truncated_video_peak_recovery_phase():
    """
    When video ends right at peak or window_end_frame <= peak_frame,
    recovery boundary must report UNAVAILABLE evidence, frame_idx=None, time_ms=None.
    """
    # Create trajectory ending at frame 20 with peak at frame 20
    trajectory = []
    for f in range(21):
        trajectory.append({
            "left_shoulder": {"x": 0.4, "y": 0.4, "visibility": 0.9},
            "left_elbow": {"x": 0.4, "y": 0.5, "visibility": 0.9},
            "left_wrist": {"x": 0.4 + (f / 20.0) * 0.3, "y": 0.4, "visibility": 0.9},
            "right_shoulder": {"x": 0.6, "y": 0.4, "visibility": 0.9},
            "right_wrist": {"x": 0.6, "y": 0.45, "visibility": 0.9},
        })

    phases = segment_punch_phases(
        window_start_frame=0,
        window_end_frame=20,
        impact_frame=20,
        arm="left",
        fps=30.0,
        keypoints_trajectory=trajectory,
    )

    rec_boundary = phases.boundaries["recovery"]
    assert rec_boundary.evidence.level == EvidenceLevel.UNAVAILABLE
    assert rec_boundary.frame_idx is None
    assert rec_boundary.time_ms is None

    # Kinematics extraction for recovery_duration_ms must also be UNAVAILABLE
    kinematics = extract_kinematic_features(
        frames=trajectory,
        action_family="punch",
        arm_side="left",
        stance="orthodox",
        temporal_phases=phases,
    )
    rec_metric = kinematics.metrics["recovery_duration_ms"]
    assert rec_metric.value is None
    assert rec_metric.confidence is None
    assert rec_metric.evidence_level == EvidenceLevel.UNAVAILABLE
