"""
test_integration_wave2.py — Cross-Module Pipeline Integration & Benchmark Performance Tests (Waves 2-4)

Owned Exclusively by: Agent F (Integration and Performance Specialist)
Integration Gate: Wave 2 (APPROVED)
Repository: d:\\test\\ai\\python-worker

Architecture & Pipeline Execution Flow:
  Temporal Phases (Task 6)
       │
       ▼
  Kinematic Features (Task 7)
       │
       ▼
  Shadow Classifier (Task 8) [SHADOW MODE: Zero legacy regression]
       │
       ▼
  Assessment Engine (Task 5)

Wave 2 Execution Principles:
1. Cross-Module Flow: End-to-end integration across all 4 tasks on both punch and kick trajectories.
2. Synthetic Trajectories: Validates both straight punch (cross/jab) and round kick (+ missing detection).
3. Shadow Mode Isolation: The shadow classifier runs in shadow mode; its output is a ClassificationDecision.
   It does NOT overwrite legacy technique in the video pipeline (legacy technique remains "punch" / "round_kick").
4. Deterministic Execution: Multiple executions yield bit-for-bit identical JSON structures and SHA256 hashes.
5. Benchmark Latency: Measures latency across 100+ iterations, strictly enforcing the < 10.0ms per technique budget.
6. Dynamic Import Gating: WAVE2_READY gate keeps the suite runnable both pre- and post-Agent C/D delivery.
"""

from __future__ import annotations

from dataclasses import dataclass, field
import hashlib
import json
import math
import time
from types import MappingProxyType
from typing import Any, Callable, Mapping, Optional, Sequence
import unittest

# ─────────────────────────────────────────────────────────────────────────────
# Approved Canonical Module Imports (Tasks 5 & 6)
# ─────────────────────────────────────────────────────────────────────────────

from pose_math import Point, KP, calculate_angle, PoseValidityConfig
from create_golden_baseline import (
    generate_punch_sequence,
    generate_kick_nodetect_sequence,
)
from pipeline.contracts import EvidenceLevel
from pipeline.analysis_context import AnalysisContext
from pipeline.stance_context import (
    StanceContext,
    StanceSource,
    StanceType,
)
from pipeline.temporal_phases import (
    CANONICAL_PHASES,
    EvidenceLevel as PhaseEvidenceLevel,
    PhaseEvidence,
    PhaseBoundary,
    TemporalPhaseSequence,
    TemporalPhaseConfig,
    calculate_tolerance_ms,
    segment_punch_phases,
    segment_kick_phases,
    extract_temporal_phases,
    segment_from_action_result,
)
from pipeline.assessment_engine import (
    AssessmentEngine,
    AssessmentInput,
    AssessmentResult,
    AssessmentProvenance,
    AssessmentMetricItem,
    AssessmentStatus,
    get_default_assessment_engine,
    evaluate_action,
    to_assessment_metric,
)
from technique_rubric import (
    CriterionResult,
    CriterionStatus,
    TechniqueRubric,
    RUBRIC_PUNCH_V3,
    RUBRIC_ROUND_KICK_V3,
)

# ─────────────────────────────────────────────────────────────────────────────
# Dynamic Import Gate: Wave 2 Production Implementations (Tasks 7 & 8)
# ─────────────────────────────────────────────────────────────────────────────

try:
    from pipeline.kinematic_features import (
        KinematicMetricContract,
        KinematicFeatureSet,
        extract_kinematic_features,
    )
    from pipeline.shadow_classifier import (
        ShadowClassifier,
        ShadowClassifierConfig,
        ClassificationDecision,
        DecisionStatus,
        TechniqueCandidate,
        ClassifierProvenance,
        classify_shadow_punch,
    )
    WAVE2_READY = True
except ImportError:
    WAVE2_READY = False
    KinematicMetricContract = None  # type: ignore
    KinematicFeatureSet = None  # type: ignore
    extract_kinematic_features = None  # type: ignore
    ShadowClassifier = None  # type: ignore
    ShadowClassifierConfig = None  # type: ignore
    ClassificationDecision = None  # type: ignore
    DecisionStatus = None  # type: ignore
    TechniqueCandidate = None  # type: ignore
    ClassifierProvenance = None  # type: ignore
    classify_shadow_punch = None  # type: ignore


# ─────────────────────────────────────────────────────────────────────────────
# Synthetic Trajectory Generator Fixtures
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class SyntheticPoseFrame:
    """Khung xương pose phục vụ kiểm thử quỹ đạo động học tổng hợp."""
    frame_idx: int
    time_ms: float
    landmarks: dict[int, Optional[Point]]


def generate_linear_straight_punch(
    num_frames: int = 10,
    fps: float = 30.0,
    start_x: float = 0.30,
    end_x: float = 0.60,
    y: float = 0.45,
    arm_side: str = "right",
    conf: float = 0.95,
) -> list[SyntheticPoseFrame]:
    """Tạo quỹ đạo đấm thẳng lý tưởng (straight punch / jab / cross)."""
    frames: list[SyntheticPoseFrame] = []
    shoulder_x, shoulder_y = 0.20, 0.45

    for i in range(num_frames):
        alpha = i / (num_frames - 1) if num_frames > 1 else 0.0
        time_ms = (i / fps) * 1000.0

        wrist_x = start_x + alpha * (end_x - start_x)
        wrist_y = y
        elbow_x = shoulder_x + 0.5 * (wrist_x - shoulder_x)
        elbow_y = y + (1.0 - alpha) * 0.08

        sh_idx = KP.LEFT_SHOULDER if arm_side == "left" else KP.RIGHT_SHOULDER
        el_idx = KP.LEFT_ELBOW if arm_side == "left" else KP.RIGHT_ELBOW
        wr_idx = KP.LEFT_WRIST if arm_side == "left" else KP.RIGHT_WRIST

        landmarks = {
            sh_idx: Point(x=shoulder_x, y=shoulder_y, conf=conf),
            el_idx: Point(x=elbow_x, y=elbow_y, conf=conf),
            wr_idx: Point(x=wrist_x, y=wrist_y, conf=conf),
        }
        frames.append(SyntheticPoseFrame(frame_idx=i, time_ms=time_ms, landmarks=landmarks))

    return frames


def generate_curved_hook_punch(
    num_frames: int = 10,
    fps: float = 30.0,
    radius: float = 0.20,
    center_x: float = 0.35,
    center_y: float = 0.45,
    arm_side: str = "right",
    conf: float = 0.90,
) -> list[SyntheticPoseFrame]:
    """Tạo quỹ đạo đấm vòng cung (hook punch) có độ cong rõ rệt."""
    frames: list[SyntheticPoseFrame] = []
    shoulder_x, shoulder_y = 0.20, 0.45

    for i in range(num_frames):
        alpha = i / (num_frames - 1) if num_frames > 1 else 0.0
        time_ms = (i / fps) * 1000.0

        theta = -math.pi / 2 + alpha * (3 * math.pi / 4)
        wrist_x = center_x + radius * math.cos(theta)
        wrist_y = center_y + radius * math.sin(theta)

        elbow_x = shoulder_x + 0.5 * (wrist_x - shoulder_x) - 0.05
        elbow_y = shoulder_y + 0.5 * (wrist_y - shoulder_y) + 0.05

        sh_idx = KP.LEFT_SHOULDER if arm_side == "left" else KP.RIGHT_SHOULDER
        el_idx = KP.LEFT_ELBOW if arm_side == "left" else KP.RIGHT_ELBOW
        wr_idx = KP.LEFT_WRIST if arm_side == "left" else KP.RIGHT_WRIST

        landmarks = {
            sh_idx: Point(x=shoulder_x, y=shoulder_y, conf=conf),
            el_idx: Point(x=elbow_x, y=elbow_y, conf=conf),
            wr_idx: Point(x=wrist_x, y=wrist_y, conf=conf),
        }
        frames.append(SyntheticPoseFrame(frame_idx=i, time_ms=time_ms, landmarks=landmarks))

    return frames


def normalize_trajectory_to_frames(trajectory: Sequence[Any], fps: float = 30.0) -> list[Any]:
    """Chuẩn hóa chuỗi dữ liệu đầu vào thành định dạng frame đồng nhất."""
    normalized: list[Any] = []
    for idx, f in enumerate(trajectory):
        if hasattr(f, "landmarks") or hasattr(f, "keypoints") or isinstance(f, dict):
            normalized.append(f)
        elif isinstance(f, (list, tuple)):
            # List of Point objects
            lms = {i: pt for i, pt in enumerate(f) if pt is not None}
            normalized.append(SyntheticPoseFrame(
                frame_idx=idx,
                time_ms=round((idx / fps) * 1000.0, 2),
                landmarks=lms,
            ))
        elif f is None:
            normalized.append(SyntheticPoseFrame(
                frame_idx=idx,
                time_ms=round((idx / fps) * 1000.0, 2),
                landmarks={},
            ))
        else:
            normalized.append(f)
    return normalized


# ─────────────────────────────────────────────────────────────────────────────
# Contract Test Doubles (Contract-Conforming Mocks for Pre-Completion & Tests)
# ─────────────────────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class MockKinematicMetric:
    """Contract-conforming mock metric matching Task 7 specifications."""
    name: str
    value: Optional[float] = None
    unit: str = "degree"
    confidence: Optional[float] = None
    evidence_level: str = "derived_proxy"
    evidence_quality: str = "GOOD"
    frames_used: Optional[tuple[int, ...]] = None
    time_window_ms: Optional[tuple[float, float]] = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "value": round(self.value, 4) if isinstance(self.value, float) else self.value,
            "unit": self.unit,
            "confidence": round(self.confidence, 4) if self.confidence is not None else None,
            "evidenceLevel": self.evidence_level,
            "evidenceQuality": self.evidence_quality,
            "framesUsed": list(self.frames_used) if self.frames_used is not None else None,
            "timeWindowMs": list(self.time_window_ms) if self.time_window_ms is not None else None,
        }


@dataclass(frozen=True)
class MockKinematicFeatureSet:
    """Contract-conforming mock feature set matching Task 7 specifications."""
    action_family: str
    metrics: MappingProxyType[str, MockKinematicMetric]
    feature_version: str = "1.0.0"
    arm_side: str = "right"
    quality_summary: MappingProxyType[str, float] = field(
        default_factory=lambda: MappingProxyType({"overallConfidence": 0.92})
    )

    def to_dict(self) -> dict[str, Any]:
        return {
            "actionFamily": self.action_family,
            "featureVersion": self.feature_version,
            "armSide": self.arm_side,
            "metrics": {k: v.to_dict() for k, v in self.metrics.items()},
            "qualitySummary": dict(self.quality_summary),
        }


def mock_extract_kinematic_features(
    trajectory: Sequence[Any],
    phases: TemporalPhaseSequence,
    arm_or_leg: str = "right",
    action_family: str = "punch",
) -> MockKinematicFeatureSet:
    """
    Contract-faithful calculation of kinematic features from trajectory and temporal phases.
    Calculates strike extension kinematics between launch/prep and peak.
    """
    metrics_map: dict[str, MockKinematicMetric] = {}
    fps = phases.fps
    win_start = phases.window_start_frame
    win_end = phases.window_end_frame

    frame_indices = tuple(range(win_start, min(win_end + 1, len(trajectory))))
    t_start = (win_start / fps) * 1000.0
    t_end = (win_end / fps) * 1000.0
    time_win = (round(t_start, 1), round(t_end, 1))

    if action_family == "punch":
        sh_idx = KP.LEFT_SHOULDER if arm_or_leg == "left" else KP.RIGHT_SHOULDER
        el_idx = KP.LEFT_ELBOW if arm_or_leg == "left" else KP.RIGHT_ELBOW
        wr_idx = KP.LEFT_WRIST if arm_or_leg == "left" else KP.RIGHT_WRIST

        # Sử dụng phase boundaries từ Task 6 để xác định cửa sổ bung đòn (extension phase)
        peak_b = phases.boundaries.get("peak")
        launch_b = phases.boundaries.get("launch")
        prep_b = phases.boundaries.get("preparation")

        strike_start = (
            launch_b.frame_idx if launch_b and launch_b.frame_idx is not None
            else (prep_b.frame_idx if prep_b and prep_b.frame_idx is not None else win_start)
        )
        strike_end = (
            peak_b.frame_idx if peak_b and peak_b.frame_idx is not None else win_end
        )
        strike_indices = tuple(range(strike_start, min(strike_end + 1, len(trajectory))))

        wrists: list[Point] = []
        elbow_angles: list[float] = []

        norm_frames = normalize_trajectory_to_frames(trajectory, fps)

        for f_idx in strike_indices:
            frame = norm_frames[f_idx]
            lms = getattr(frame, "landmarks", None) or getattr(frame, "keypoints", None)
            if isinstance(lms, dict) and wr_idx in lms:
                sh, el, wr = lms.get(sh_idx), lms.get(el_idx), lms.get(wr_idx)
                if sh and el and wr and min(sh.conf, el.conf, wr.conf) > 0.35:
                    wrists.append(wr)
                    ang = calculate_angle(sh, el, wr)
                    if ang is not None:
                        elbow_angles.append(ang)

        if len(wrists) >= 2:
            dx = wrists[-1].x - wrists[0].x
            dy = wrists[-1].y - wrists[0].y
            disp = math.sqrt(dx * dx + dy * dy)

            path_len = 0.0
            for i in range(len(wrists) - 1):
                p1, p2 = wrists[i], wrists[i + 1]
                step_dx = p2.x - p1.x
                step_dy = p2.y - p1.y
                path_len += math.sqrt(step_dx * step_dx + step_dy * step_dy)

            directness = round(disp / path_len, 4) if path_len > 1e-6 else 1.0
            tangential_curvature = round(max(0.0, 1.0 - directness) * 0.5, 4)
            max_ext = max(elbow_angles) if elbow_angles else 165.0
            reach_ratio = 0.92

            metrics_map["wrist_displacement"] = MockKinematicMetric(
                name="wrist_displacement", value=round(disp, 4), unit="normalized_image",
                confidence=0.92, frames_used=strike_indices, time_window_ms=time_win
            )
            metrics_map["wrist_path_length"] = MockKinematicMetric(
                name="wrist_path_length", value=round(path_len, 4), unit="normalized_image",
                confidence=0.92, frames_used=strike_indices, time_window_ms=time_win
            )
            metrics_map["trajectory_directness"] = MockKinematicMetric(
                name="trajectory_directness", value=directness, unit="ratio",
                confidence=0.90, frames_used=strike_indices, time_window_ms=time_win
            )
            metrics_map["tangential_curvature"] = MockKinematicMetric(
                name="tangential_curvature", value=tangential_curvature, unit="ratio",
                confidence=0.88, frames_used=strike_indices, time_window_ms=time_win
            )
            metrics_map["max_tangential_curvature"] = MockKinematicMetric(
                name="max_tangential_curvature", value=tangential_curvature, unit="ratio",
                confidence=0.88, frames_used=strike_indices, time_window_ms=time_win
            )
            metrics_map["peak_extension"] = MockKinematicMetric(
                name="peak_extension", value=round(max_ext, 1), unit="degree",
                confidence=0.95, frames_used=strike_indices, time_window_ms=time_win
            )
            metrics_map["elbow_extension_angle"] = MockKinematicMetric(
                name="elbow_extension_angle", value=round(max_ext, 1), unit="degree",
                confidence=0.95, frames_used=strike_indices, time_window_ms=time_win
            )
            metrics_map["max_elbow_angle"] = MockKinematicMetric(
                name="max_elbow_angle", value=round(max_ext, 1), unit="degree",
                confidence=0.95, frames_used=strike_indices, time_window_ms=time_win
            )
            metrics_map["reach_ratio"] = MockKinematicMetric(
                name="reach_ratio", value=reach_ratio, unit="ratio",
                confidence=0.89, frames_used=strike_indices, time_window_ms=time_win
            )
        else:
            metrics_map["wrist_displacement"] = MockKinematicMetric(
                name="wrist_displacement", value=None, unit="normalized_image",
                confidence=None, evidence_level="unavailable", evidence_quality="INSUFFICIENT"
            )

    elif action_family == "kick":
        hip_idx = KP.LEFT_HIP if arm_or_leg == "left" else KP.RIGHT_HIP
        knee_idx = KP.LEFT_KNEE if arm_or_leg == "left" else KP.RIGHT_KNEE
        ankle_idx = KP.LEFT_ANKLE if arm_or_leg == "left" else KP.RIGHT_ANKLE

        knee_angles: list[float] = []
        norm_frames = normalize_trajectory_to_frames(trajectory, fps)

        for f_idx in frame_indices:
            frame = norm_frames[f_idx]
            lms = getattr(frame, "landmarks", None) or getattr(frame, "keypoints", None)
            if isinstance(lms, dict) and ankle_idx in lms:
                h, k, a = lms.get(hip_idx), lms.get(knee_idx), lms.get(ankle_idx)
                if h and k and a and min(h.conf, k.conf, a.conf) > 0.35:
                    ang = calculate_angle(h, k, a)
                    if ang is not None:
                        knee_angles.append(ang)

        if knee_angles:
            max_ext = max(knee_angles)
            min_chamber = min(knee_angles)
            metrics_map["max_extension_angle"] = MockKinematicMetric(
                name="max_extension_angle", value=round(max_ext, 1), unit="degree",
                confidence=0.94, frames_used=frame_indices, time_window_ms=time_win
            )
            metrics_map["knee_extension_angle"] = MockKinematicMetric(
                name="knee_extension_angle", value=round(max_ext, 1), unit="degree",
                confidence=0.94, frames_used=frame_indices, time_window_ms=time_win
            )
            metrics_map["min_chamber_angle"] = MockKinematicMetric(
                name="min_chamber_angle", value=round(min_chamber, 1), unit="degree",
                confidence=0.91, frames_used=frame_indices, time_window_ms=time_win
            )
            metrics_map["knee_chamber_angle"] = MockKinematicMetric(
                name="knee_chamber_angle", value=round(min_chamber, 1), unit="degree",
                confidence=0.91, frames_used=frame_indices, time_window_ms=time_win
            )
            metrics_map["hip_angle"] = MockKinematicMetric(
                name="hip_angle", value=148.5, unit="degree",
                confidence=0.88, frames_used=frame_indices, time_window_ms=time_win
            )
            metrics_map["peak_speed"] = MockKinematicMetric(
                name="peak_speed", value=1.45, unit="normalized_image/s",
                confidence=0.85, frames_used=frame_indices, time_window_ms=time_win
            )
        else:
            metrics_map["max_extension_angle"] = MockKinematicMetric(
                name="max_extension_angle", value=None, unit="degree",
                confidence=None, evidence_level="unavailable", evidence_quality="INSUFFICIENT"
            )

    return MockKinematicFeatureSet(
        action_family=action_family,
        metrics=MappingProxyType(metrics_map),
        feature_version="1.0.0",
        arm_side=arm_or_leg,
    )


@dataclass(frozen=True)
class MockTechniqueCandidate:
    """Contract-conforming candidate matching Task 8 specifications."""
    technique: str
    family: str
    attacking_side: str
    limb_role: str
    stance: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "technique": self.technique,
            "family": self.family,
            "attackingSide": self.attacking_side,
            "limbRole": self.limb_role,
            "stance": self.stance,
        }


@dataclass(frozen=True)
class MockClassificationDecision:
    """Contract-conforming classification decision matching Task 8 specifications."""
    status: str
    candidate: Optional[MockTechniqueCandidate]
    confidence: Optional[float]
    evidence_level: str
    reason_codes: tuple[str, ...]

    def to_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "candidate": self.candidate.to_dict() if self.candidate else None,
            "confidence": self.confidence,
            "evidenceLevel": self.evidence_level,
            "reasonCodes": list(self.reason_codes),
        }


class MockShadowClassifier:
    """Contract-conforming shadow classifier matching Task 8 specifications."""

    def classify(
        self,
        features: Any,
        stance_context: Optional[StanceContext],
        arm: str = "right",
    ) -> MockClassificationDecision:
        # Case A: Missing evidence
        if features is None:
            return MockClassificationDecision(
                status="abstained", candidate=None, confidence=None,
                evidence_level="unavailable", reason_codes=("INSUFFICIENT_EVIDENCE",)
            )

        # Extract features
        arm_in = getattr(features, "arm_side", getattr(features, "arm", arm))
        if hasattr(features, "metrics"):
            m = features.metrics
            directness = m["trajectory_directness"].value if "trajectory_directness" in m else None
            curvature = m["tangential_curvature"].value if "tangential_curvature" in m else (
                m["max_tangential_curvature"].value if "max_tangential_curvature" in m else None
            )
            extension = m["elbow_extension_angle"].value if "elbow_extension_angle" in m else (
                m["peak_extension"].value if "peak_extension" in m else None
            )
            reach = m["reach_ratio"].value if "reach_ratio" in m else None
        elif isinstance(features, Mapping):
            directness = features.get("trajectory_directness", 0.95)
            curvature = features.get("tangential_curvature", 0.05)
            extension = features.get("elbow_extension_deg", 165.0)
            reach = features.get("reach_ratio", 0.90)
        else:
            directness = getattr(features, "trajectory_directness", 0.95)
            curvature = getattr(features, "tangential_curvature", 0.05)
            extension = getattr(features, "elbow_extension_deg", 165.0)
            reach = getattr(features, "reach_ratio", 0.90)

        if directness is None or extension is None:
            return MockClassificationDecision(
                status="abstained", candidate=None, confidence=None,
                evidence_level="unavailable", reason_codes=("INSUFFICIENT_EVIDENCE",)
            )

        # Case B: Stance resolution
        resolved_stance = stance_context.resolved_stance if stance_context else "unknown"
        if not stance_context or resolved_stance in ("unknown", "switch") or not arm_in or arm_in == "unknown":
            return MockClassificationDecision(
                status="abstained", candidate=None, confidence=None,
                evidence_level="derived_proxy", reason_codes=("UNRESOLVED_STANCE_OR_LIMB",)
            )

        # Case C: Rejections for curved or low-extension punches
        reasons: list[str] = []
        if (directness is not None and directness < 0.82) or (curvature is not None and curvature > 0.20):
            reasons.append("CURVED_TRAJECTORY_REJECTED")
        if (extension is not None and extension < 140.0) or (reach is not None and reach < 0.70):
            reasons.append("INSUFFICIENT_EXTENSION_OR_REACH")

        if reasons:
            return MockClassificationDecision(
                status="rejected_candidate", candidate=None, confidence=None,
                evidence_level="derived_proxy", reason_codes=tuple(reasons)
            )

        # Case D: Nominal Straight Punch Classification
        if resolved_stance == "orthodox":
            if arm_in == "left":
                technique, limb_role = "jab", "lead"
            else:
                technique, limb_role = "cross", "rear"
        elif resolved_stance == "southpaw":
            if arm_in == "right":
                technique, limb_role = "jab", "lead"
            else:
                technique, limb_role = "cross", "rear"
        else:
            return MockClassificationDecision(
                status="abstained", candidate=None, confidence=None,
                evidence_level="derived_proxy", reason_codes=("UNRESOLVED_STANCE_OR_LIMB",)
            )

        candidate = MockTechniqueCandidate(
            technique=technique,
            family="punch",
            attacking_side=arm_in,
            limb_role=limb_role,
            stance=resolved_stance,
        )
        return MockClassificationDecision(
            status="classified",
            candidate=candidate,
            confidence=None,  # Zero fabricated confidence per spec
            evidence_level="derived_proxy",
            reason_codes=(),
        )

    def abstain_for_kick(self) -> MockClassificationDecision:
        return MockClassificationDecision(
            status="abstained",
            candidate=None,
            confidence=None,
            evidence_level="derived_proxy",
            reason_codes=("NON_PUNCH_ACTION_FAMILY",),
        )


# ─────────────────────────────────────────────────────────────────────────────
# Cross-Module Pipeline Orchestrator (Integration Harness)
# ─────────────────────────────────────────────────────────────────────────────

def create_sample_criteria_for_pipeline(
    action_family: str = "punch",
    extension_angle: float = 165.0,
    sufficient: bool = True,
) -> list[CriterionResult]:
    """Tạo criteria mẫu phục vụ kiểm thử tích hợp chuẩn với Rubric Registry."""
    if action_family == "punch":
        if not sufficient:
            return [
                CriterionResult(
                    criterion_id="crit_punch_extension", criterion_name="Arm Extension",
                    phase="impact", feature_name="max_elbow_angle", observed_value=0.0,
                    score=0.0, weight=0.40, confidence=0.0,
                    status=CriterionStatus.INSUFFICIENT_EVIDENCE.value,
                    evidence_frame_start=0, evidence_frame_end=0,
                    evidence_timestamp_start_ms=0.0, evidence_timestamp_end_ms=0.0,
                    affected_body_part="right_elbow", detail="Thiếu dữ liệu",
                )
            ]
        return [
            CriterionResult(
                criterion_id="crit_punch_extension", criterion_name="Arm Extension",
                phase="impact", feature_name="max_elbow_angle", observed_value=extension_angle,
                score=95.0, weight=0.40, confidence=0.90,
                status=CriterionStatus.EXCELLENT.value,
                evidence_frame_start=10, evidence_frame_end=15,
                evidence_timestamp_start_ms=333.3, evidence_timestamp_end_ms=500.0,
                affected_body_part="right_elbow", detail="Độ duỗi tay xuất sắc",
            ),
            CriterionResult(
                criterion_id="crit_punch_guard", criterion_name="Guard Protection",
                phase="impact", feature_name="guard_preserved", observed_value=1.0,
                score=90.0, weight=0.35, confidence=0.85,
                status=CriterionStatus.GOOD.value,
                evidence_frame_start=10, evidence_frame_end=15,
                evidence_timestamp_start_ms=333.3, evidence_timestamp_end_ms=500.0,
                affected_body_part="left_wrist", detail="Tay thủ bảo vệ cằm",
            ),
            CriterionResult(
                criterion_id="crit_punch_speed", criterion_name="Striking Velocity",
                phase="impact", feature_name="peak_speed", observed_value=1.35,
                score=88.0, weight=0.25, confidence=0.80,
                status=CriterionStatus.GOOD.value,
                evidence_frame_start=10, evidence_frame_end=15,
                evidence_timestamp_start_ms=333.3, evidence_timestamp_end_ms=500.0,
                affected_body_part="right_wrist", detail="Tốc độ ra đòn chuẩn",
            ),
        ]
    else:  # kick
        if not sufficient:
            return [
                CriterionResult(
                    criterion_id="crit_kick_extension", criterion_name="Leg Extension",
                    phase="impact", feature_name="max_extension_angle", observed_value=0.0,
                    score=0.0, weight=0.35, confidence=0.0,
                    status=CriterionStatus.INSUFFICIENT_EVIDENCE.value,
                    evidence_frame_start=0, evidence_frame_end=0,
                    evidence_timestamp_start_ms=0.0, evidence_timestamp_end_ms=0.0,
                    affected_body_part="right_knee", detail="Thiếu dữ liệu",
                )
            ]
        return [
            CriterionResult(
                criterion_id="crit_kick_extension", criterion_name="Leg Extension",
                phase="impact", feature_name="max_extension_angle", observed_value=extension_angle,
                score=92.0, weight=0.35, confidence=0.92,
                status=CriterionStatus.EXCELLENT.value,
                evidence_frame_start=12, evidence_frame_end=18,
                evidence_timestamp_start_ms=400.0, evidence_timestamp_end_ms=600.0,
                affected_body_part="right_knee", detail="Bung gối căng hoàn hảo",
            ),
            CriterionResult(
                criterion_id="crit_kick_chamber", criterion_name="Chamber Angle",
                phase="chamber", feature_name="min_chamber_angle", observed_value=48.5,
                score=88.0, weight=0.30, confidence=0.88,
                status=CriterionStatus.GOOD.value,
                evidence_frame_start=5, evidence_frame_end=10,
                evidence_timestamp_start_ms=166.7, evidence_timestamp_end_ms=333.3,
                affected_body_part="right_knee", detail="Rút gối cao và gọn",
            ),
            CriterionResult(
                criterion_id="crit_kick_speed", criterion_name="Strike Speed",
                phase="impact", feature_name="peak_speed", observed_value=1.45,
                score=85.0, weight=0.35, confidence=0.82,
                status=CriterionStatus.GOOD.value,
                evidence_frame_start=10, evidence_frame_end=15,
                evidence_timestamp_start_ms=333.3, evidence_timestamp_end_ms=500.0,
                affected_body_part="right_ankle", detail="Tốc độ vung đòn tốt",
            ),
        ]


def run_cross_module_pipeline(
    trajectory: Sequence[Any],
    action_family: str = "punch",
    arm_or_leg: str = "right",
    window_start_frame: int = 5,
    window_end_frame: int = 20,
    fps: float = 30.0,
    impact_frame: Optional[int] = None,
    impact_time_ms: Optional[float] = None,
    stance_context: Optional[StanceContext] = None,
    criteria: Optional[Sequence[CriterionResult]] = None,
    use_mock: bool = True,
) -> dict[str, Any]:
    """
    Điều phối trọn vẹn chu trình xử lý 4 giai đoạn (Stages 1-4):
      1. Temporal Phases (Task 6)
      2. Kinematic Features (Task 7)
      3. Shadow Classifier (Task 8) [SHADOW MODE: Không overwrite legacy technique]
      4. Assessment Engine (Task 5)
    Trả về payload JSON hoàn chỉnh, bảo đảm zero legacy regression và tính tất định.
    """
    normalized_frames = normalize_trajectory_to_frames(trajectory, fps)

    # ── STAGE 1: Temporal Phases (Task 6) ──────────────────────────────────
    if action_family == "punch":
        phases = segment_punch_phases(
            window_start_frame=window_start_frame,
            window_end_frame=window_end_frame,
            fps=fps,
            impact_frame=impact_frame,
            impact_time_ms=impact_time_ms,
            keypoints_trajectory=trajectory,
            arm=arm_or_leg,
        )
    elif action_family == "kick":
        phases = segment_kick_phases(
            window_start_frame=window_start_frame,
            window_end_frame=window_end_frame,
            fps=fps,
            impact_frame=impact_frame,
            impact_time_ms=impact_time_ms,
            keypoints_trajectory=trajectory,
            active_leg=arm_or_leg,
        )
    else:
        phases = extract_temporal_phases(
            action_family=action_family,
            window_start_frame=window_start_frame,
            window_end_frame=window_end_frame,
            fps=fps,
            impact_frame=impact_frame,
            impact_time_ms=impact_time_ms,
        )

    # ── STAGE 2: Kinematic Features (Task 7) ───────────────────────────────
    if not use_mock and WAVE2_READY:
        kinematics = extract_kinematic_features(  # type: ignore
            frames=normalized_frames[window_start_frame:min(window_end_frame + 1, len(normalized_frames))],
            action_family=action_family,
            arm_side=arm_or_leg,
            active_limb=arm_or_leg,
            stance=stance_context.resolved_stance if stance_context else None,
            temporal_phases=phases,
        )
    else:
        kinematics = mock_extract_kinematic_features(
            trajectory=trajectory,
            phases=phases,
            arm_or_leg=arm_or_leg,
            action_family=action_family,
        )

    # ── STAGE 3: Shadow Classifier (Task 8) ────────────────────────────────
    # Chạy ở shadow mode: Phân loại chẩn đoán không thay đổi legacy pipeline
    if action_family == "punch":
        if not use_mock and WAVE2_READY:
            classifier = ShadowClassifier()  # type: ignore
            shadow_decision = classifier.classify(kinematics, stance_context)
        else:
            classifier = MockShadowClassifier()
            shadow_decision = classifier.classify(kinematics, stance_context, arm=arm_or_leg)
    else:
        if not use_mock and WAVE2_READY:
            shadow_decision = ClassificationDecision(
                status=DecisionStatus.ABSTAINED,
                candidate=None,
                reason_codes=("NON_PUNCH_ACTION_FAMILY",),
                provenance=ClassifierProvenance(classifier_id="shadow_jab_cross_classifier"),
                confidence=None,
                evidence_level=EvidenceLevel.DERIVED_PROXY,
            )
        else:
            shadow_decision = MockShadowClassifier().abstain_for_kick()

    # ── STAGE 4: Assessment Engine (Task 5) ────────────────────────────────
    # Legacy technique bảo toàn 100%: "punch" hoặc "round_kick" (zero regression)
    legacy_technique = "round_kick" if action_family == "kick" else "punch"

    # Ánh xạ kinematic metrics sang AssessmentMetricItem
    assessment_metrics: dict[str, AssessmentMetricItem] = {}
    if hasattr(kinematics, "metrics"):
        for m_name, m_val in kinematics.metrics.items():
            val = getattr(m_val, "value", None)
            unit = getattr(m_val, "unit", "degree")
            conf = getattr(m_val, "confidence", None)
            assessment_metrics[m_name] = AssessmentMetricItem(
                value=val,
                unit=unit,
                confidence=conf,
            )

    # Bổ sung phase durations từ Task 6
    if phases.is_complete:
        prep_b = phases.boundaries.get("preparation")
        peak_b = phases.boundaries.get("peak")
        rec_b = phases.boundaries.get("recovery")
        if prep_b and peak_b and prep_b.time_ms is not None and peak_b.time_ms is not None:
            assessment_metrics["launchDurationMs"] = AssessmentMetricItem(
                value=round(peak_b.time_ms - prep_b.time_ms, 1),
                unit="ms",
                confidence=1.0,
            )
        if peak_b and rec_b and peak_b.time_ms is not None and rec_b.time_ms is not None:
            assessment_metrics["retractionDurationMs"] = AssessmentMetricItem(
                value=round(rec_b.time_ms - peak_b.time_ms, 1),
                unit="ms",
                confidence=1.0,
            )

    # Tạo AssessmentInput chuẩn hóa
    ext_deg = assessment_metrics.get("peak_extension", assessment_metrics.get("max_extension_angle", AssessmentMetricItem(value=165.0))).value
    effective_criteria = criteria if criteria is not None else create_sample_criteria_for_pipeline(
        action_family=action_family,
        extension_angle=float(ext_deg) if ext_deg is not None else 160.0,
    )

    assessment_input = AssessmentInput(
        action_id=f"act_{action_family}_{window_start_frame}_{window_end_frame}",
        technique=legacy_technique,
        family=action_family,
        criterion_results=tuple(effective_criteria),
        findings=(),
        metrics=MappingProxyType(assessment_metrics),
    )

    assessment_res = evaluate_action(
        action_or_input=assessment_input,
        technique=legacy_technique,
    )

    # ── ASSEMBLE COMBINED INTEGRATION PAYLOAD ──────────────────────────────
    return {
        "actionId": assessment_input.action_id,
        "actionFamily": action_family,
        "legacyTechnique": legacy_technique,
        "resolvedTechnique": legacy_technique,
        "phases": phases.to_dict(),
        "kinematics": kinematics.to_dict(),
        "shadowClassification": shadow_decision.to_dict(),
        "assessment": assessment_res.to_dict(),
        "meta": {
            "fps": fps,
            "pipelineStages": [
                "temporal_phases (task 6)",
                "kinematic_features (task 7)",
                "shadow_classifier (task 8)",
                "assessment_engine (task 5)",
            ],
            "isLiveModuleExecution": bool(not use_mock and WAVE2_READY),
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# Test Suite 1: Architecture Gate & Contract Readiness
# ─────────────────────────────────────────────────────────────────────────────

class TestWave2ArchitectureGateAndContracts(unittest.TestCase):
    """Kiểm tra điều kiện tiên quyết và tính sẵn sàng của kiến trúc Wave 2."""

    def test_wave2_gate_defined(self) -> None:
        """Cờ WAVE2_READY phải được định nghĩa dưới dạng boolean nghiêm ngặt."""
        self.assertIsInstance(WAVE2_READY, bool)

    def test_task6_temporal_phases_contract_readiness(self) -> None:
        """Task 6 temporal phases phải đầy đủ các symbols canonical đã được Gate 2 phê duyệt."""
        self.assertEqual(len(CANONICAL_PHASES), 5)
        self.assertEqual(CANONICAL_PHASES, ("preparation", "launch", "peak", "retraction", "recovery"))
        self.assertTrue(callable(segment_punch_phases))
        self.assertTrue(callable(segment_kick_phases))
        self.assertTrue(callable(extract_temporal_phases))

    def test_task5_assessment_engine_contract_readiness(self) -> None:
        """Task 5 assessment engine phải đầy đủ các symbols canonical và default engine hoạt động."""
        engine = get_default_assessment_engine()
        self.assertIsInstance(engine, AssessmentEngine)
        self.assertTrue(callable(evaluate_action))

    def test_contract_mock_parity_with_specifications(self) -> None:
        """Mock test doubles phải đảm bảo tính bất biến và tuân thủ định dạng to_dict()."""
        m = MockKinematicMetric(name="test_m", value=12.5, unit="degree")
        self.assertEqual(m.value, 12.5)
        d = m.to_dict()
        self.assertEqual(d["name"], "test_m")
        self.assertEqual(d["unit"], "degree")

        cand = MockTechniqueCandidate(
            technique="jab", family="punch", attacking_side="left",
            limb_role="lead", stance="orthodox"
        )
        dec = MockClassificationDecision(
            status="classified", candidate=cand, confidence=None,
            evidence_level="derived_proxy", reason_codes=()
        )
        dec_dict = dec.to_dict()
        self.assertEqual(dec_dict["status"], "classified")
        self.assertEqual(dec_dict["candidate"]["technique"], "jab")
        self.assertIsNone(dec_dict["confidence"])


# ─────────────────────────────────────────────────────────────────────────────
# Test Suite 2: Cross-Module Pipeline Integration Flow
# ─────────────────────────────────────────────────────────────────────────────

class TestPipelineIntegrationFlow(unittest.TestCase):
    """
    Kiểm thử luồng tích hợp xuyên module hoàn chỉnh:
      Temporal Phases -> Kinematic Features -> Shadow Classifier -> Assessment Engine
    """

    def setUp(self) -> None:
        self.orthodox_context = StanceContext(
            resolved_stance="orthodox",
            source=StanceSource.COACH_DECLARED.value,
            requested_stance="orthodox",
            is_authoritative=True,
        )
        self.southpaw_context = StanceContext(
            resolved_stance="southpaw",
            source=StanceSource.COACH_DECLARED.value,
            requested_stance="southpaw",
            is_authoritative=True,
        )
        self.switch_context = StanceContext(
            resolved_stance="switch",
            source=StanceSource.COACH_DECLARED.value,
            requested_stance="switch",
            is_authoritative=True,
        )
        self.unknown_context = StanceContext(
            resolved_stance="unknown",
            source=StanceSource.UNKNOWN.value,
            requested_stance=None,
            is_authoritative=False,
        )

    def test_punch_pipeline_flow_orthodox_rear_cross(self) -> None:
        """
        Luồng hoàn chỉnh cho cú Cross tay phải (Orthodox):
        - Task 6 phát hiện đủ 5 pha thời gian (preparation -> recovery).
        - Task 7 tính directness ~1.0, displacement, peak extension.
        - Task 8 phân loại thành 'cross' (rear limb trong orthodox stance) ở SHADOW MODE.
        - Pipeline legacy technique bảo toàn là 'punch' (zero regression).
        - Task 5 chấm điểm theo rubric đấm v3.0, gán provenance chuẩn xác.
        """
        punch_seq = generate_linear_straight_punch(10, 30.0, arm_side="right")
        payload = run_cross_module_pipeline(
            trajectory=punch_seq,
            action_family="punch",
            arm_or_leg="right",
            window_start_frame=0,
            window_end_frame=9,
            fps=30.0,
            impact_frame=8,
            impact_time_ms=(8 / 30.0) * 1000.0,
            stance_context=self.orthodox_context,
            use_mock=True,
        )

        # 1. Zero Legacy Regression: Legacy pipeline technique remains "punch"
        self.assertEqual(payload["actionFamily"], "punch")
        self.assertEqual(payload["legacyTechnique"], "punch")
        self.assertEqual(payload["resolvedTechnique"], "punch")

        # 2. Stage 1 (Phases) verification
        phases = payload["phases"]
        self.assertEqual(phases["actionFamily"], "punch")
        self.assertEqual(phases["impactType"], "peak_extension_proxy")
        self.assertTrue(phases["isComplete"])
        self.assertEqual(len(phases["boundaries"]), 5)
        self.assertIn("peak", phases["boundaries"])

        # 3. Stage 2 (Kinematics) verification
        kinematics = payload["kinematics"]
        self.assertIn("wrist_displacement", kinematics["metrics"])
        self.assertIn("trajectory_directness", kinematics["metrics"])
        self.assertIn("elbow_extension_angle", kinematics["metrics"])

        # 4. Stage 3 (Classifier in Shadow Mode) verification
        decision = payload["shadowClassification"]
        self.assertEqual(decision["status"], "classified")
        self.assertIsNotNone(decision["candidate"])
        self.assertEqual(decision["candidate"]["technique"], "cross")
        self.assertEqual(decision["candidate"]["limbRole"], "rear")
        self.assertEqual(decision["candidate"]["stance"], "orthodox")
        self.assertIsNone(decision["confidence"])  # Bắt buộc None khi chưa calibrate

        # 5. Stage 4 (Assessment Engine) verification
        assessment = payload["assessment"]
        self.assertIsNotNone(assessment["score"])
        self.assertGreaterEqual(assessment["score"], 85)
        self.assertEqual(assessment["grade"], "PERFECT")
        self.assertEqual(assessment["status"], "excellent")
        self.assertEqual(assessment["provenance"]["rubricId"], "rubric_punch_v3")
        self.assertEqual(assessment["provenance"]["evaluatorId"], "default_punch_evaluator")

    def test_punch_pipeline_flow_orthodox_lead_jab(self) -> None:
        """Luồng đấm Jab tay trái (Orthodox lead limb)."""
        punch_seq = generate_linear_straight_punch(10, 30.0, arm_side="left")
        payload = run_cross_module_pipeline(
            trajectory=punch_seq,
            action_family="punch",
            arm_or_leg="left",
            window_start_frame=0,
            window_end_frame=9,
            fps=30.0,
            impact_frame=8,
            impact_time_ms=(8 / 30.0) * 1000.0,
            stance_context=self.orthodox_context,
            use_mock=True,
        )
        self.assertEqual(payload["legacyTechnique"], "punch")
        self.assertEqual(payload["shadowClassification"]["status"], "classified")
        self.assertEqual(payload["shadowClassification"]["candidate"]["technique"], "jab")
        self.assertEqual(payload["shadowClassification"]["candidate"]["limbRole"], "lead")

    def test_punch_pipeline_flow_southpaw_lead_jab(self) -> None:
        """Luồng đấm Jab tay phải (Southpaw lead limb)."""
        punch_seq = generate_linear_straight_punch(10, 30.0, arm_side="right")
        payload = run_cross_module_pipeline(
            trajectory=punch_seq,
            action_family="punch",
            arm_or_leg="right",
            window_start_frame=0,
            window_end_frame=9,
            fps=30.0,
            impact_frame=8,
            impact_time_ms=(8 / 30.0) * 1000.0,
            stance_context=self.southpaw_context,
            use_mock=True,
        )
        self.assertEqual(payload["legacyTechnique"], "punch")
        self.assertEqual(payload["shadowClassification"]["status"], "classified")
        self.assertEqual(payload["shadowClassification"]["candidate"]["technique"], "jab")
        self.assertEqual(payload["shadowClassification"]["candidate"]["limbRole"], "lead")

    def test_punch_pipeline_flow_southpaw_rear_cross(self) -> None:
        """Luồng đấm Cross tay trái (Southpaw rear limb)."""
        punch_seq = generate_linear_straight_punch(10, 30.0, arm_side="left")
        payload = run_cross_module_pipeline(
            trajectory=punch_seq,
            action_family="punch",
            arm_or_leg="left",
            window_start_frame=0,
            window_end_frame=9,
            fps=30.0,
            impact_frame=8,
            impact_time_ms=(8 / 30.0) * 1000.0,
            stance_context=self.southpaw_context,
            use_mock=True,
        )
        self.assertEqual(payload["legacyTechnique"], "punch")
        self.assertEqual(payload["shadowClassification"]["status"], "classified")
        self.assertEqual(payload["shadowClassification"]["candidate"]["technique"], "cross")
        self.assertEqual(payload["shadowClassification"]["candidate"]["limbRole"], "rear")

    def test_kick_pipeline_flow_round_kick(self) -> None:
        """
        Luồng hoàn chỉnh cho cú đá Round Kick chân phải:
        - Task 6 phát hiện preparation, chamber launch, peak knee extension, retraction, recovery.
        - Task 7 tính góc gối cực đại, góc gập chamber, góc hông.
        - Task 8 kích hoạt cơ chế abstain an toàn (không phân loại nhầm đòn đá thành đấm).
        - Task 5 chấm điểm bằng DefaultKickEvaluator với rubric_round_kick_v3.
        """
        kick_seq = generate_kick_nodetect_sequence()
        payload = run_cross_module_pipeline(
            trajectory=kick_seq,
            action_family="kick",
            arm_or_leg="right",
            window_start_frame=5,
            window_end_frame=24,
            fps=30.0,
            stance_context=self.orthodox_context,
            use_mock=True,
        )

        self.assertEqual(payload["actionFamily"], "kick")
        self.assertEqual(payload["legacyTechnique"], "round_kick")

        # Phases
        phases = payload["phases"]
        self.assertEqual(phases["actionFamily"], "kick")
        self.assertEqual(phases["impactType"], "max_extension_proxy")
        self.assertTrue(phases["isComplete"])
        self.assertEqual(len(phases["boundaries"]), 5)

        # Kinematics
        kinematics = payload["kinematics"]
        self.assertIn("max_extension_angle", kinematics["metrics"])
        self.assertIn("min_chamber_angle", kinematics["metrics"])

        # Classifier Abstention (kicks are outside jab/cross scope)
        decision = payload["shadowClassification"]
        self.assertEqual(decision["status"], "abstained")
        self.assertIsNone(decision["candidate"])
        self.assertIn("NON_PUNCH_ACTION_FAMILY", decision["reasonCodes"])

        # Assessment Engine
        assessment = payload["assessment"]
        self.assertIsNotNone(assessment["score"])
        self.assertGreaterEqual(assessment["score"], 80)
        self.assertEqual(assessment["provenance"]["rubricId"], "rubric_round_kick_v3")
        self.assertEqual(assessment["provenance"]["evaluatorId"], "default_kick_evaluator")

    def test_kick_pipeline_with_missing_detection_frames(self) -> None:
        """Kiểm tra khả năng chịu lỗi khi video có frame None (camera bị che hoặc mất tracking)."""
        kick_seq = generate_kick_nodetect_sequence()  # Frames 25-29 are None
        payload = run_cross_module_pipeline(
            trajectory=kick_seq,
            action_family="kick",
            arm_or_leg="right",
            window_start_frame=20,
            window_end_frame=28,  # Trúng vào vùng None frames
            fps=30.0,
            stance_context=self.orthodox_context,
            use_mock=True,
        )
        self.assertIsInstance(payload, dict)
        self.assertIn("phases", payload)
        self.assertIn("assessment", payload)

    def test_pipeline_flow_unresolved_stance_abstention(self) -> None:
        """Stance là switch hoặc unknown khiến classifier abstain nhưng pipeline vẫn hoàn thành an toàn."""
        punch_seq = generate_linear_straight_punch(10, 30.0, arm_side="right")
        payload = run_cross_module_pipeline(
            trajectory=punch_seq,
            action_family="punch",
            arm_or_leg="right",
            window_start_frame=0,
            window_end_frame=9,
            fps=30.0,
            stance_context=self.switch_context,
            use_mock=True,
        )
        decision = payload["shadowClassification"]
        self.assertEqual(decision["status"], "abstained")
        self.assertIsNone(decision["candidate"])
        self.assertIn("UNRESOLVED_STANCE_OR_LIMB", decision["reasonCodes"])
        self.assertEqual(payload["legacyTechnique"], "punch")
        self.assertIsNotNone(payload["assessment"]["score"])

    def test_pipeline_flow_curved_punch_rejection(self) -> None:
        """Đòn đấm có quỹ đạo vòng cung (hook) bị shadow classifier từ chối với lý do rõ ràng."""
        hook_seq = generate_curved_hook_punch(10, 30.0, arm_side="right")
        payload = run_cross_module_pipeline(
            trajectory=hook_seq,
            action_family="punch",
            arm_or_leg="right",
            window_start_frame=0,
            window_end_frame=9,
            fps=30.0,
            stance_context=self.orthodox_context,
            use_mock=True,
        )
        decision = payload["shadowClassification"]
        self.assertEqual(decision["status"], "rejected_candidate")
        self.assertIsNone(decision["candidate"])
        self.assertIn("CURVED_TRAJECTORY_REJECTED", decision["reasonCodes"])

    def test_insufficient_evidence_flow_to_assessment(self) -> None:
        """Khi evidence rỗng hoặc thiếu, assessment trả về status=insufficient_evidence, score=None, grade=NO_DATA."""
        punch_seq = generate_linear_straight_punch(10, 30.0, arm_side="right")
        insufficient_criteria = create_sample_criteria_for_pipeline(
            action_family="punch", sufficient=False
        )
        payload = run_cross_module_pipeline(
            trajectory=punch_seq,
            action_family="punch",
            arm_or_leg="right",
            window_start_frame=0,
            window_end_frame=9,
            fps=30.0,
            stance_context=self.orthodox_context,
            criteria=insufficient_criteria,
            use_mock=True,
        )
        assessment = payload["assessment"]
        self.assertIsNone(assessment["score"])
        self.assertEqual(assessment["grade"], "NO_DATA")
        self.assertEqual(assessment["status"], "insufficient_evidence")
        self.assertIsNone(assessment["assessmentConfidence"])


# ─────────────────────────────────────────────────────────────────────────────
# Test Suite 3: Deterministic Execution & JSON Serialization Integrity
# ─────────────────────────────────────────────────────────────────────────────

class TestPipelineDeterminismAndSerialization(unittest.TestCase):
    """
    Xác minh tính bất biến và tất định tuyệt đối (deterministic):
    Chạy 2 lần với cùng input phải sinh payload bit-for-bit giống hệt nhau (SHA256 trùng khớp).
    """

    def setUp(self) -> None:
        self.context = StanceContext(
            resolved_stance="orthodox",
            source=StanceSource.COACH_DECLARED.value,
            requested_stance="orthodox",
            is_authoritative=True,
        )

    def test_punch_pipeline_deterministic_payload(self) -> None:
        """Chạy pipeline đấm 2 lần cho chuỗi JSON và mã băm SHA256 giống hệt 100%."""
        punch_seq = generate_linear_straight_punch(10, 30.0, arm_side="right")

        payload_1 = run_cross_module_pipeline(
            trajectory=punch_seq, action_family="punch", arm_or_leg="right",
            window_start_frame=0, window_end_frame=9, stance_context=self.context, use_mock=True
        )
        payload_2 = run_cross_module_pipeline(
            trajectory=punch_seq, action_family="punch", arm_or_leg="right",
            window_start_frame=0, window_end_frame=9, stance_context=self.context, use_mock=True
        )

        json_1 = json.dumps(payload_1, sort_keys=True, ensure_ascii=False)
        json_2 = json.dumps(payload_2, sort_keys=True, ensure_ascii=False)

        self.assertEqual(json_1, json_2)
        hash_1 = hashlib.sha256(json_1.encode("utf-8")).hexdigest()
        hash_2 = hashlib.sha256(json_2.encode("utf-8")).hexdigest()
        self.assertEqual(hash_1, hash_2)

    def test_kick_pipeline_deterministic_payload(self) -> None:
        """Chạy pipeline đá 2 lần cho chuỗi JSON và mã băm SHA256 giống hệt 100%."""
        kick_seq = generate_kick_nodetect_sequence()

        payload_1 = run_cross_module_pipeline(
            trajectory=kick_seq, action_family="kick", arm_or_leg="right",
            window_start_frame=5, window_end_frame=24, stance_context=self.context, use_mock=True
        )
        payload_2 = run_cross_module_pipeline(
            trajectory=kick_seq, action_family="kick", arm_or_leg="right",
            window_start_frame=5, window_end_frame=24, stance_context=self.context, use_mock=True
        )

        json_1 = json.dumps(payload_1, sort_keys=True, ensure_ascii=False)
        json_2 = json.dumps(payload_2, sort_keys=True, ensure_ascii=False)

        self.assertEqual(json_1, json_2)
        hash_1 = hashlib.sha256(json_1.encode("utf-8")).hexdigest()
        hash_2 = hashlib.sha256(json_2.encode("utf-8")).hexdigest()
        self.assertEqual(hash_1, hash_2)

    def test_json_safety_no_nan_or_infinity(self) -> None:
        """Payload JSON tuyệt đối không chứa ký tự NaN, Infinity hoặc -Infinity."""
        punch_seq = generate_linear_straight_punch(10, 30.0, arm_side="right")
        payload = run_cross_module_pipeline(
            trajectory=punch_seq, action_family="punch", arm_or_leg="right",
            window_start_frame=0, window_end_frame=9, stance_context=self.context, use_mock=True
        )
        json_str = json.dumps(payload)
        self.assertNotIn("NaN", json_str)
        self.assertNotIn("Infinity", json_str)
        self.assertNotIn("-Infinity", json_str)

        # Lossless round-trip
        parsed = json.loads(json_str)
        self.assertEqual(parsed["actionId"], payload["actionId"])

    def test_deep_immutability_and_zero_input_mutation(self) -> None:
        """Kiểm tra việc thực thi pipeline không làm thay đổi bất kỳ trường nào của input trajectory."""
        punch_seq = generate_linear_straight_punch(10, 30.0, arm_side="right")
        first_frame_x_before = punch_seq[0].landmarks[KP.RIGHT_WRIST].x
        first_frame_y_before = punch_seq[0].landmarks[KP.RIGHT_WRIST].y

        _ = run_cross_module_pipeline(
            trajectory=punch_seq, action_family="punch", arm_or_leg="right",
            window_start_frame=0, window_end_frame=9, stance_context=self.context, use_mock=True
        )

        self.assertEqual(punch_seq[0].landmarks[KP.RIGHT_WRIST].x, first_frame_x_before)
        self.assertEqual(punch_seq[0].landmarks[KP.RIGHT_WRIST].y, first_frame_y_before)


# ─────────────────────────────────────────────────────────────────────────────
# Test Suite 4: Mock/Fixture Offline Benchmark (< 10ms Fallback Contract Verification)
# NOTE: These tests measure contract mock / fixture performance ONLY.
# DO NOT claim production latency from mock execution.
# ─────────────────────────────────────────────────────────────────────────────

class TestMockFixtureBenchmarkPerformance(unittest.TestCase):
    """
    Kiểm chuẩn hiệu năng trên CONTRACT MOCK / FIXTURE (Offline Fallback Harness):
    Đo đạc độ trễ xử lý per-technique qua 100 lần chạy lặp trên mock doubles.
    LƯU Ý: Đây là benchmark trên Mock Doubles, KHÔNG ĐƯỢC COI LÀ HIỆU NĂNG PRODUCTION.
    (Do NOT claim production latency from mock execution).
    """

    NUM_ITERATIONS: int = 100
    PERFORMANCE_BUDGET_MS: float = 10.0

    def setUp(self) -> None:
        self.context = StanceContext(
            resolved_stance="orthodox",
            source=StanceSource.COACH_DECLARED.value,
            requested_stance="orthodox",
            is_authoritative=True,
        )

    def test_mock_punch_benchmark_latency_under_10ms(self) -> None:
        """Đo lường độ trễ mock pipeline cho đòn đấm qua 100 iterations (use_mock=True)."""
        punch_seq = generate_linear_straight_punch(10, 30.0, arm_side="right")
        latencies_ms: list[float] = []

        # Warm-up (5 iterations)
        for _ in range(5):
            _ = run_cross_module_pipeline(
                trajectory=punch_seq, action_family="punch", arm_or_leg="right",
                window_start_frame=0, window_end_frame=9, stance_context=self.context, use_mock=True
            )

        # Benchmark Measurement
        for _ in range(self.NUM_ITERATIONS):
            t0 = time.perf_counter()
            _ = run_cross_module_pipeline(
                trajectory=punch_seq, action_family="punch", arm_or_leg="right",
                window_start_frame=0, window_end_frame=9, stance_context=self.context, use_mock=True
            )
            t1 = time.perf_counter()
            latencies_ms.append((t1 - t0) * 1000.0)

        latencies_ms.sort()
        min_ms = latencies_ms[0]
        mean_ms = sum(latencies_ms) / len(latencies_ms)
        median_ms = latencies_ms[len(latencies_ms) // 2]
        p95_ms = latencies_ms[int(len(latencies_ms) * 0.95)]
        max_ms = latencies_ms[-1]

        # In kết quả benchmark ra output để lưu vết
        print(f"\n[BENCHMARK MOCK/FIXTURE] Punch Mock Pipeline ({self.NUM_ITERATIONS} iterations, use_mock=True):")
        print(f"  Min:    {min_ms:.3f} ms")
        print(f"  Mean:   {mean_ms:.3f} ms (Budget: < {self.PERFORMANCE_BUDGET_MS} ms)")
        print(f"  Median: {median_ms:.3f} ms")
        print(f"  P95:    {p95_ms:.3f} ms")
        print(f"  Max:    {max_ms:.3f} ms")

        # Kiểm tra điều kiện bất biến hiệu năng
        self.assertLess(mean_ms, self.PERFORMANCE_BUDGET_MS, f"Mean latency {mean_ms:.3f} ms exceeds {self.PERFORMANCE_BUDGET_MS} ms")
        self.assertLess(p95_ms, self.PERFORMANCE_BUDGET_MS, f"P95 latency {p95_ms:.3f} ms exceeds {self.PERFORMANCE_BUDGET_MS} ms")

    def test_mock_kick_benchmark_latency_under_10ms(self) -> None:
        """Đo lường độ trễ mock pipeline cho đòn đá qua 100 iterations (use_mock=True)."""
        kick_seq = generate_kick_nodetect_sequence()
        latencies_ms: list[float] = []

        # Warm-up (5 iterations)
        for _ in range(5):
            _ = run_cross_module_pipeline(
                trajectory=kick_seq, action_family="kick", arm_or_leg="right",
                window_start_frame=5, window_end_frame=24, stance_context=self.context, use_mock=True
            )

        # Benchmark Measurement
        for _ in range(self.NUM_ITERATIONS):
            t0 = time.perf_counter()
            _ = run_cross_module_pipeline(
                trajectory=kick_seq, action_family="kick", arm_or_leg="right",
                window_start_frame=5, window_end_frame=24, stance_context=self.context, use_mock=True
            )
            t1 = time.perf_counter()
            latencies_ms.append((t1 - t0) * 1000.0)

        latencies_ms.sort()
        min_ms = latencies_ms[0]
        mean_ms = sum(latencies_ms) / len(latencies_ms)
        median_ms = latencies_ms[len(latencies_ms) // 2]
        p95_ms = latencies_ms[int(len(latencies_ms) * 0.95)]
        max_ms = latencies_ms[-1]

        print(f"\n[BENCHMARK MOCK/FIXTURE] Kick Mock Pipeline ({self.NUM_ITERATIONS} iterations, use_mock=True):")
        print(f"  Min:    {min_ms:.3f} ms")
        print(f"  Mean:   {mean_ms:.3f} ms (Budget: < {self.PERFORMANCE_BUDGET_MS} ms)")
        print(f"  Median: {median_ms:.3f} ms")
        print(f"  P95:    {p95_ms:.3f} ms")
        print(f"  Max:    {max_ms:.3f} ms")

        self.assertLess(mean_ms, self.PERFORMANCE_BUDGET_MS, f"Mean latency {mean_ms:.3f} ms exceeds {self.PERFORMANCE_BUDGET_MS} ms")
        self.assertLess(p95_ms, self.PERFORMANCE_BUDGET_MS, f"P95 latency {p95_ms:.3f} ms exceeds {self.PERFORMANCE_BUDGET_MS} ms")

    def test_mock_mixed_workload_throughput(self) -> None:
        """Kiểm tra thông lượng hỗn hợp mock (xen kẽ đấm và đá liên tục 100 lần, use_mock=True)."""
        punch_seq = generate_linear_straight_punch(10, 30.0, arm_side="right")
        kick_seq = generate_kick_nodetect_sequence()
        t0 = time.perf_counter()

        for i in range(50):
            _ = run_cross_module_pipeline(
                trajectory=punch_seq, action_family="punch", arm_or_leg="right",
                window_start_frame=0, window_end_frame=9, stance_context=self.context, use_mock=True
            )
            _ = run_cross_module_pipeline(
                trajectory=kick_seq, action_family="kick", arm_or_leg="right",
                window_start_frame=5, window_end_frame=24, stance_context=self.context, use_mock=True
            )

        total_elapsed_ms = (time.perf_counter() - t0) * 1000.0
        avg_per_technique = total_elapsed_ms / 100.0
        print(f"\n[BENCHMARK MOCK/FIXTURE] Mixed Workload Mock (100 techniques total, use_mock=True):")
        print(f"  Total time: {total_elapsed_ms:.2f} ms")
        print(f"  Avg/tech:   {avg_per_technique:.3f} ms (Throughput: {1000.0 / avg_per_technique:.0f} tech/sec)")

        self.assertLess(avg_per_technique, self.PERFORMANCE_BUDGET_MS)


# ─────────────────────────────────────────────────────────────────────────────
# Test Suite 5: Live Wave 2 Pipeline Integration (Gated via WAVE2_READY)
# ─────────────────────────────────────────────────────────────────────────────

@unittest.skipUnless(WAVE2_READY, "Wave 2 live implementation pending: pipeline.kinematic_features and pipeline.shadow_classifier")
class TestLiveWave2PipelineIntegration(unittest.TestCase):
    """
    Kiểm thử tích hợp trên mã nguồn thực tế khi Agent C và Agent D bàn giao:
    pipeline/kinematic_features.py và pipeline/shadow_classifier.py.
    """

    def setUp(self) -> None:
        self.orthodox_context = StanceContext(
            resolved_stance="orthodox",
            source=StanceSource.COACH_DECLARED.value,
            requested_stance="orthodox",
            is_authoritative=True,
        )
        self.southpaw_context = StanceContext(
            resolved_stance="southpaw",
            source=StanceSource.COACH_DECLARED.value,
            requested_stance="southpaw",
            is_authoritative=True,
        )

    def test_live_punch_pipeline_orthodox_cross(self) -> None:
        """Thực thi chu trình đấm Cross thực tế trên module live Tasks 5, 6, 7, 8."""
        punch_seq = generate_linear_straight_punch(10, 30.0, arm_side="right")
        payload = run_cross_module_pipeline(
            trajectory=punch_seq,
            action_family="punch",
            arm_or_leg="right",
            window_start_frame=0,
            window_end_frame=9,
            fps=30.0,
            stance_context=self.orthodox_context,
            use_mock=False,
        )
        self.assertTrue(payload["meta"]["isLiveModuleExecution"])
        self.assertEqual(payload["legacyTechnique"], "punch")
        self.assertEqual(payload["shadowClassification"]["status"], "classified")
        self.assertEqual(payload["shadowClassification"]["candidate"]["technique"], "cross")
        self.assertEqual(payload["shadowClassification"]["candidate"]["limbRole"], "rear")
        self.assertEqual(payload["shadowClassification"]["candidate"]["stance"], "orthodox")
        self.assertIsNone(payload["shadowClassification"]["confidence"])
        self.assertEqual(payload["assessment"]["provenance"]["rubricId"], "rubric_punch_v3")

    def test_live_punch_pipeline_orthodox_jab(self) -> None:
        """Thực thi chu trình đấm Jab thực tế trên module live Tasks 5, 6, 7, 8."""
        punch_seq = generate_linear_straight_punch(10, 30.0, arm_side="left")
        payload = run_cross_module_pipeline(
            trajectory=punch_seq,
            action_family="punch",
            arm_or_leg="left",
            window_start_frame=0,
            window_end_frame=9,
            fps=30.0,
            stance_context=self.orthodox_context,
            use_mock=False,
        )
        self.assertTrue(payload["meta"]["isLiveModuleExecution"])
        self.assertEqual(payload["legacyTechnique"], "punch")
        self.assertEqual(payload["shadowClassification"]["status"], "classified")
        self.assertEqual(payload["shadowClassification"]["candidate"]["technique"], "jab")
        self.assertEqual(payload["shadowClassification"]["candidate"]["limbRole"], "lead")

    def test_live_punch_pipeline_southpaw_jab(self) -> None:
        """Thực thi chu trình đấm Jab Southpaw thực tế trên module live."""
        punch_seq = generate_linear_straight_punch(10, 30.0, arm_side="right")
        payload = run_cross_module_pipeline(
            trajectory=punch_seq,
            action_family="punch",
            arm_or_leg="right",
            window_start_frame=0,
            window_end_frame=9,
            fps=30.0,
            stance_context=self.southpaw_context,
            use_mock=False,
        )
        self.assertEqual(payload["shadowClassification"]["candidate"]["technique"], "jab")
        self.assertEqual(payload["shadowClassification"]["candidate"]["limbRole"], "lead")

    def test_live_curved_punch_hook_rejection(self) -> None:
        """Kiểm tra live shadow classifier từ chối đòn cong hook."""
        hook_seq = generate_curved_hook_punch(10, 30.0, arm_side="right")
        payload = run_cross_module_pipeline(
            trajectory=hook_seq,
            action_family="punch",
            arm_or_leg="right",
            window_start_frame=0,
            window_end_frame=9,
            fps=30.0,
            stance_context=self.orthodox_context,
            use_mock=False,
        )
        self.assertEqual(payload["shadowClassification"]["status"], "rejected_candidate")
        self.assertIn("CURVED_TRAJECTORY_REJECTED", payload["shadowClassification"]["reasonCodes"])

    def test_live_kick_pipeline_e2e(self) -> None:
        """Thực thi chu trình đá thực tế trên module live."""
        kick_seq = generate_kick_nodetect_sequence()
        payload = run_cross_module_pipeline(
            trajectory=kick_seq,
            action_family="kick",
            arm_or_leg="right",
            window_start_frame=5,
            window_end_frame=24,
            fps=30.0,
            stance_context=self.orthodox_context,
            use_mock=False,
        )
        self.assertTrue(payload["meta"]["isLiveModuleExecution"])
        self.assertEqual(payload["legacyTechnique"], "round_kick")
        self.assertEqual(payload["assessment"]["provenance"]["rubricId"], "rubric_round_kick_v3")

    def test_live_pipeline_determinism(self) -> None:
        """Kiểm tra tính tất định của live modules."""
        punch_seq = generate_linear_straight_punch(10, 30.0, arm_side="right")
        p1 = run_cross_module_pipeline(
            trajectory=punch_seq, action_family="punch", arm_or_leg="right",
            window_start_frame=0, window_end_frame=9, stance_context=self.orthodox_context, use_mock=False
        )
        p2 = run_cross_module_pipeline(
            trajectory=punch_seq, action_family="punch", arm_or_leg="right",
            window_start_frame=0, window_end_frame=9, stance_context=self.orthodox_context, use_mock=False
        )
        json_1 = json.dumps(p1, sort_keys=True)
        json_2 = json.dumps(p2, sort_keys=True)
        self.assertEqual(json_1, json_2)
        self.assertEqual(hashlib.sha256(json_1.encode()).hexdigest(), hashlib.sha256(json_2.encode()).hexdigest())

    def test_live_pipeline_benchmark_smoke_under_10ms(self) -> None:
        """Kiểm tra hiệu năng module live tuân thủ < 10ms budget (50 iterations smoke test)."""
        punch_seq = generate_linear_straight_punch(10, 30.0, arm_side="right")
        latencies: list[float] = []
        for _ in range(50):
            t0 = time.perf_counter()
            _ = run_cross_module_pipeline(
                trajectory=punch_seq, action_family="punch", arm_or_leg="right",
                window_start_frame=0, window_end_frame=9, stance_context=self.orthodox_context, use_mock=False
            )
            latencies.append((time.perf_counter() - t0) * 1000.0)

        mean_ms = sum(latencies) / len(latencies)
        print(f"\n[BENCHMARK PRODUCTION LIVE SMOKE] Live Module Pipeline Mean Latency: {mean_ms:.3f} ms")
        self.assertLess(mean_ms, 10.0)


# ─────────────────────────────────────────────────────────────────────────────
# Test Suite 6: Live Production Pipeline Benchmarks (< 10.0 ms Budget)
# ─────────────────────────────────────────────────────────────────────────────

@unittest.skipUnless(WAVE2_READY, "Wave 2 live implementation required: pipeline.kinematic_features and pipeline.shadow_classifier")
class TestProductionBenchmarkPerformance(unittest.TestCase):
    """
    Kiểm chuẩn hiệu năng thực thi trên LIVE PRODUCTION PIPELINE:
    Thực thi 100% mã nguồn production thật (use_mock=False):
      - Stage 1: segment_punch_phases / segment_kick_phases / extract_temporal_phases (Task 6)
      - Stage 2: extract_kinematic_features (Task 7)
      - Stage 3: ShadowClassifier / ClassificationDecision (Task 8)
      - Stage 4: evaluate_action / AssessmentEngine (Task 5)

    Yêu cầu nghiệm thu Wave 3:
      - Đo đạc 100 iterations (+ 5 warm-up) cho từng production path.
      - Thống kê chi tiết: Min, Mean, Median, P95, Max, Throughput (tech/sec).
      - Ngân sách hiệu năng: Mean latency < 10.0 ms, P95 < 10.0 ms.
      - RÕ RÀNG PHÂN BIỆT VỚI MOCK BENCHMARK: Không bao giờ claim production latency từ mock execution.
    """

    NUM_ITERATIONS: int = 100
    WARMUP_ITERATIONS: int = 5
    PERFORMANCE_BUDGET_MS: float = 10.0

    def setUp(self) -> None:
        self.orthodox_context = StanceContext(
            resolved_stance="orthodox",
            source=StanceSource.COACH_DECLARED.value,
            requested_stance="orthodox",
            is_authoritative=True,
        )
        self.switch_context = StanceContext(
            resolved_stance="switch",
            source=StanceSource.COACH_DECLARED.value,
            requested_stance="switch",
            is_authoritative=True,
        )

    def _execute_production_benchmark(
        self,
        name: str,
        pipeline_call: Callable[[], dict[str, Any]],
    ) -> dict[str, float]:
        """Chạy benchmark chuẩn xác và tính toán chi tiết min, mean, median, p95, max, throughput."""
        # 1. Warm-up
        for _ in range(self.WARMUP_ITERATIONS):
            _ = pipeline_call()

        # 2. Measurement
        latencies_ms: list[float] = []
        t_start = time.perf_counter()
        for _ in range(self.NUM_ITERATIONS):
            t0 = time.perf_counter()
            _ = pipeline_call()
            t1 = time.perf_counter()
            latencies_ms.append((t1 - t0) * 1000.0)
        t_total_sec = time.perf_counter() - t_start

        latencies_ms.sort()
        min_ms = latencies_ms[0]
        mean_ms = sum(latencies_ms) / len(latencies_ms)
        median_ms = latencies_ms[len(latencies_ms) // 2]
        p95_ms = latencies_ms[int(len(latencies_ms) * 0.95)]
        max_ms = latencies_ms[-1]
        throughput = self.NUM_ITERATIONS / t_total_sec if t_total_sec > 0 else 0.0

        # In kết quả chuẩn hóa
        print(f"\n[BENCHMARK PRODUCTION] {name} ({self.NUM_ITERATIONS} iterations, use_mock=False):")
        print(f"  Min:        {min_ms:.3f} ms")
        print(f"  Mean:       {mean_ms:.3f} ms (Budget: < {self.PERFORMANCE_BUDGET_MS} ms)")
        print(f"  Median:     {median_ms:.3f} ms")
        print(f"  P95:        {p95_ms:.3f} ms")
        print(f"  Max:        {max_ms:.3f} ms")
        print(f"  Throughput: {throughput:.0f} tech/sec")

        self.assertLess(
            mean_ms,
            self.PERFORMANCE_BUDGET_MS,
            f"Mean latency {mean_ms:.3f} ms exceeds budget {self.PERFORMANCE_BUDGET_MS} ms",
        )
        self.assertLess(
            p95_ms,
            self.PERFORMANCE_BUDGET_MS,
            f"P95 latency {p95_ms:.3f} ms exceeds budget {self.PERFORMANCE_BUDGET_MS} ms",
        )

        return {
            "min_ms": min_ms,
            "mean_ms": mean_ms,
            "median_ms": median_ms,
            "p95_ms": p95_ms,
            "max_ms": max_ms,
            "throughput": throughput,
        }

    def test_production_punch_benchmark_latency_under_10ms(self) -> None:
        """Đo lường độ trễ production pipeline cho đòn đấm (use_mock=False)."""
        punch_seq = generate_linear_straight_punch(10, 30.0, arm_side="right")
        call_fn = lambda: run_cross_module_pipeline(
            trajectory=punch_seq,
            action_family="punch",
            arm_or_leg="right",
            window_start_frame=0,
            window_end_frame=9,
            fps=30.0,
            stance_context=self.orthodox_context,
            use_mock=False,
        )
        # Smoke verification payload trước benchmark
        payload = call_fn()
        self.assertTrue(payload["meta"]["isLiveModuleExecution"])
        self.assertEqual(payload["legacyTechnique"], "punch")
        self.assertEqual(payload["shadowClassification"]["candidate"]["technique"], "cross")

        self._execute_production_benchmark("Punch Production Path", call_fn)

    def test_production_kick_benchmark_latency_under_10ms(self) -> None:
        """Đo lường độ trễ production pipeline cho đòn đá (use_mock=False)."""
        kick_seq = generate_kick_nodetect_sequence()
        call_fn = lambda: run_cross_module_pipeline(
            trajectory=kick_seq,
            action_family="kick",
            arm_or_leg="right",
            window_start_frame=5,
            window_end_frame=24,
            fps=30.0,
            stance_context=self.orthodox_context,
            use_mock=False,
        )
        payload = call_fn()
        self.assertTrue(payload["meta"]["isLiveModuleExecution"])
        self.assertEqual(payload["legacyTechnique"], "round_kick")
        self.assertEqual(payload["shadowClassification"]["status"], "abstained")

        self._execute_production_benchmark("Kick Production Path", call_fn)

    def test_production_missing_evidence_path_latency_under_10ms(self) -> None:
        """Đo lường độ trễ production pipeline khi thiếu dữ liệu landmark (use_mock=False)."""
        missing_punch_seq = [
            SyntheticPoseFrame(frame_idx=i, time_ms=i * 33.3, landmarks={})
            for i in range(10)
        ]
        crit_insufficient = create_sample_criteria_for_pipeline("punch", sufficient=False)
        call_fn = lambda: run_cross_module_pipeline(
            trajectory=missing_punch_seq,
            action_family="punch",
            arm_or_leg="right",
            window_start_frame=0,
            window_end_frame=9,
            fps=30.0,
            stance_context=self.orthodox_context,
            criteria=crit_insufficient,
            use_mock=False,
        )
        payload = call_fn()
        self.assertTrue(payload["meta"]["isLiveModuleExecution"])
        self.assertEqual(payload["shadowClassification"]["status"], "abstained")
        self.assertIn("INSUFFICIENT_EVIDENCE", payload["shadowClassification"]["reasonCodes"])

        self._execute_production_benchmark("Missing Evidence Path", call_fn)

    def test_production_stance_abstention_path_latency_under_10ms(self) -> None:
        """Đo lường độ trễ production pipeline khi stance không xác định (use_mock=False)."""
        punch_seq = generate_linear_straight_punch(10, 30.0, arm_side="right")
        call_fn = lambda: run_cross_module_pipeline(
            trajectory=punch_seq,
            action_family="punch",
            arm_or_leg="right",
            window_start_frame=0,
            window_end_frame=9,
            fps=30.0,
            stance_context=self.switch_context,
            use_mock=False,
        )
        payload = call_fn()
        self.assertTrue(payload["meta"]["isLiveModuleExecution"])
        self.assertEqual(payload["shadowClassification"]["status"], "abstained")
        self.assertIn("UNRESOLVED_STANCE_OR_LIMB", payload["shadowClassification"]["reasonCodes"])

        self._execute_production_benchmark("Stance Abstention Path", call_fn)

    def test_production_mixed_workload_throughput(self) -> None:
        """Đo lường thông lượng hỗn hợp xen kẽ đấm và đá production thật (use_mock=False)."""
        punch_seq = generate_linear_straight_punch(10, 30.0, arm_side="right")
        kick_seq = generate_kick_nodetect_sequence()

        # Warm-up (5 pairs)
        for _ in range(5):
            _ = run_cross_module_pipeline(
                trajectory=punch_seq, action_family="punch", arm_or_leg="right",
                window_start_frame=0, window_end_frame=9, stance_context=self.orthodox_context, use_mock=False,
            )
            _ = run_cross_module_pipeline(
                trajectory=kick_seq, action_family="kick", arm_or_leg="right",
                window_start_frame=5, window_end_frame=24, stance_context=self.orthodox_context, use_mock=False,
            )

        t0 = time.perf_counter()
        for _ in range(50):
            _ = run_cross_module_pipeline(
                trajectory=punch_seq, action_family="punch", arm_or_leg="right",
                window_start_frame=0, window_end_frame=9, stance_context=self.orthodox_context, use_mock=False,
            )
            _ = run_cross_module_pipeline(
                trajectory=kick_seq, action_family="kick", arm_or_leg="right",
                window_start_frame=5, window_end_frame=24, stance_context=self.orthodox_context, use_mock=False,
            )

        total_elapsed_ms = (time.perf_counter() - t0) * 1000.0
        avg_per_technique = total_elapsed_ms / 100.0
        throughput = 1000.0 / avg_per_technique if avg_per_technique > 0 else 0.0

        print(f"\n[BENCHMARK PRODUCTION] Mixed Workload (100 techniques total, use_mock=False):")
        print(f"  Total time: {total_elapsed_ms:.2f} ms")
        print(f"  Avg/tech:   {avg_per_technique:.3f} ms (Budget: < {self.PERFORMANCE_BUDGET_MS} ms)")
        print(f"  Throughput: {throughput:.0f} tech/sec")

        self.assertLess(avg_per_technique, self.PERFORMANCE_BUDGET_MS)


if __name__ == "__main__":
    unittest.main()
