"""
shadow_kick_classifier.py — Kick Technique Shadow Classification (Task 16)

Mở rộng kick classifier ở chế độ shadow:
  Candidates: front_kick | round_kick | side_kick | unknown

Nguyên tắc:
1. Bằng chứng cơ sinh học (biomechanical evidence):
   - front_kick: Quỹ đạo duỗi thẳng hướng tâm theo mặt phẳng đứng dọc (sagittal), khớp gối rút thẳng
     lên phía trước rồi bung cẳng chân thẳng tới trước, độ xoay hông tối thiểu.
   - round_kick: Quỹ đạo xoay vòng cung theo mặt phẳng ngang (transverse), xoay hông lớn (> 35°),
     đầu gối gập và xoay quanh trục chân trụ.
   - side_kick: Quỹ đạo đạp thẳng ngang (frontal/lateral plane), rút gối ép sát ngực/hông đối diện,
     thân trên ngả đối trọng, gót chân hướng thẳng mục tiêu.
2. Camera-view & Occlusion limitations -> ABSTAIN:
   - Góc quay camera không phân biệt được mặt phẳng cử động -> CAMERA_VIEW_UNSUITABLE_FOR_KICK_PLANE.
   - Khớp cổ chân hoặc gối bị che khuất -> ANKLE_TRAJECTORY_OCCLUDED.
   - Thiếu pha chambering hoặc extension -> MISSING_KICK_PHASES.
3. Không ghi đè legacy detector (kicks vẫn lưu output gốc).
4. Khớp gối / cùi chỏ (knee / elbow detection) KHÔNG thuộc Task 16 và được đánh dấu roadmap riêng.
5. Chưa có gold dataset -> Trạng thái bắt buộc là SHADOW_NOT_VALIDATED.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
import math
from typing import Any, Mapping, Optional

from pipeline.contracts import EvidenceLevel
from pipeline.shadow_classifier import (
    ClassifierProvenance,
    DecisionStatus,
    TechniqueCandidate,
    ClassificationDecision,
)
from pipeline.shadow_punch_classifier import (
    ExtendedClassificationDecision,
    VALIDATION_STATUS_NOT_VALIDATED,
)
from pipeline.stance_context import (
    StanceContext,
    StanceType,
    normalize_attacking_side,
    resolve_limb_role,
)


@dataclass(frozen=True)
class ShadowKickClassifierConfig:
    config_version: str = "1.0.0"
    # Front kick thresholds (sagittal plane dominance)
    front_min_knee_flexion_deg: float = 60.0
    front_max_hip_rotation_deg: float = 30.0
    front_min_forward_linearity: float = 0.75
    
    # Round kick thresholds (transverse rotational arc)
    round_min_hip_rotation_deg: float = 35.0
    round_min_arc_curvature: float = 0.22
    
    # Side kick thresholds (lateral extension & torso counterbalance)
    side_min_lateral_displacement_ratio: float = 0.65
    side_min_torso_lean_deg: float = 25.0
    side_min_chamber_tuck_deg: float = 50.0


class ShadowKickClassifier:
    """
    Classifier shadow cho các đòn đá Front Kick, Roundhouse Kick, Side Kick.
    """

    def __init__(self, config: Optional[ShadowKickClassifierConfig] = None):
        self.config = config or ShadowKickClassifierConfig()
        self.provenance = ClassifierProvenance(
            classifier_id="shadow_kick_technique_classifier",
            classifier_version="1.0.0",
            config_version=self.config.config_version,
            feature_version="1.0.0",
            stance_source="stance_context",
        )

    def classify(
        self,
        features: Any,
        stance_context: Optional[StanceContext] = None,
    ) -> ExtendedClassificationDecision:
        """
        Phân loại đòn đá ở chế độ shadow.
        """
        if features is None:
            return ExtendedClassificationDecision(
                status=DecisionStatus.ABSTAINED,
                candidate=None,
                reason_codes=("INSUFFICIENT_EVIDENCE",),
                provenance=self.provenance,
                confidence=None,
                evidence_level=EvidenceLevel.UNAVAILABLE,
            )

        if hasattr(features, "metrics") and isinstance(features.metrics, Mapping):
            m = features.metrics
            arm_val = getattr(features, "arm", getattr(features, "arm_side", getattr(features, "attacking_side", getattr(features, "active_leg", None))))
            features = {
                "attacking_side": arm_val,
                "has_chamber_phase": getattr(features, "has_chamber_phase", None),
                "has_extension_phase": getattr(features, "has_extension_phase", None),
                "hip_rotation_angle": getattr(m.get("hip_rotation_angle") or m.get("hip_rotation"), "value", None),
                "forward_trajectory_linearity": getattr(m.get("forward_trajectory_linearity") or m.get("trajectory_directness"), "value", None),
                "arc_curvature": getattr(m.get("arc_curvature") or m.get("tangential_curvature"), "value", None),
                "lateral_displacement_ratio": getattr(m.get("lateral_displacement_ratio"), "value", None),
                "torso_lean_angle": getattr(m.get("torso_lean_angle") or m.get("torso_lean"), "value", None),
                "is_evidence_missing": False,
            }
        elif isinstance(features, Mapping):
            features = dict(features)
        else:
            return ExtendedClassificationDecision(
                status=DecisionStatus.ABSTAINED,
                candidate=None,
                reason_codes=("INSUFFICIENT_EVIDENCE",),
                provenance=self.provenance,
                confidence=None,
                evidence_level=EvidenceLevel.UNAVAILABLE,
            )

        # 1. Guardrail: Missing or occluded evidence
        if features.get("is_evidence_missing", False):
            return ExtendedClassificationDecision(
                status=DecisionStatus.ABSTAINED,
                candidate=None,
                reason_codes=("INSUFFICIENT_EVIDENCE",),
                provenance=self.provenance,
                confidence=None,
                evidence_level=EvidenceLevel.UNAVAILABLE,
            )

        # Check camera view / occlusion flags
        if features.get("is_camera_view_unsuitable", False):
            return ExtendedClassificationDecision(
                status=DecisionStatus.ABSTAINED,
                candidate=None,
                reason_codes=("CAMERA_VIEW_UNSUITABLE_FOR_KICK_PLANE",),
                provenance=self.provenance,
                confidence=None,
                evidence_level=EvidenceLevel.DERIVED_PROXY,
            )

        if features.get("is_ankle_occluded", False):
            return ExtendedClassificationDecision(
                status=DecisionStatus.ABSTAINED,
                candidate=None,
                reason_codes=("ANKLE_TRAJECTORY_OCCLUDED",),
                provenance=self.provenance,
                confidence=None,
                evidence_level=EvidenceLevel.DERIVED_PROXY,
            )

        # R3.1: Evidence-derived abstention; missing fields do NOT default to complete
        has_chamber = features.get("has_chamber_phase")
        has_extension = features.get("has_extension_phase")
        if has_chamber is not True or has_extension is not True:
            return ExtendedClassificationDecision(
                status=DecisionStatus.ABSTAINED,
                candidate=None,
                reason_codes=("MISSING_KICK_PHASES",),
                provenance=self.provenance,
                confidence=None,
                evidence_level=EvidenceLevel.DERIVED_PROXY,
            )

        # 2. Extract Biomechanical Metrics
        leg_side = normalize_attacking_side(
            features.get("attacking_side") or features.get("active_leg") or features.get("leg")
        )
        hip_rotation = features.get("hip_rotation_angle")  # degrees
        forward_linearity = features.get("forward_trajectory_linearity")  # 0.0 - 1.0
        arc_curvature = features.get("arc_curvature")  # 0.0 - 1.0
        lateral_displacement = features.get("lateral_displacement_ratio")  # ratio
        torso_lean = features.get("torso_lean_angle")  # degrees

        if hip_rotation is None:
            return ExtendedClassificationDecision(
                status=DecisionStatus.ABSTAINED,
                candidate=None,
                reason_codes=("MISSING_KINEMATIC_FEATURES",),
                provenance=self.provenance,
                confidence=None,
                evidence_level=EvidenceLevel.UNAVAILABLE,
            )

        # 3. Resolve Stance Context & Limb Role
        if stance_context is None:
            resolved_stance = StanceType.UNKNOWN.value
            stance_source = "unknown"
        else:
            raw_stance = getattr(stance_context, "resolved_stance", getattr(stance_context, "stance", StanceType.UNKNOWN.value))
            resolved_stance = raw_stance.value if hasattr(raw_stance, "value") else str(raw_stance)
            raw_source = getattr(stance_context, "source", "unknown")
            stance_source = raw_source.value if hasattr(raw_source, "value") else str(raw_source)

        limb_role = resolve_limb_role(leg_side, resolved_stance)
        if limb_role is None:
            limb_role = "unknown"

        provenance = ClassifierProvenance(
            classifier_id=self.provenance.classifier_id,
            classifier_version=self.provenance.classifier_version,
            config_version=self.provenance.config_version,
            feature_version=self.provenance.feature_version,
            stance_source=stance_source,
        )

        # 4. Pattern Classification Logic
        # Case A: Front Kick (low hip rotation, high forward linearity)
        if hip_rotation <= self.config.front_max_hip_rotation_deg:
            if forward_linearity is None:
                return ExtendedClassificationDecision(
                    status=DecisionStatus.ABSTAINED,
                    candidate=None,
                    reason_codes=("MISSING_KINEMATIC_FEATURES",),
                    provenance=self.provenance,
                    confidence=None,
                    evidence_level=EvidenceLevel.UNAVAILABLE,
                )
            if forward_linearity >= self.config.front_min_forward_linearity:
                candidate = TechniqueCandidate(
                    technique="front_kick",
                    family="kick",
                    attacking_side=leg_side,
                    limb_role=limb_role,
                    stance=resolved_stance,
                )
                return ExtendedClassificationDecision(
                    status=DecisionStatus.CLASSIFIED,
                    candidate=candidate,
                    reason_codes=("FRONT_KICK_SAGITTAL_MATCHED",),
                    provenance=provenance,
                    evidence_level=EvidenceLevel.DERIVED_PROXY,
                )

        # Case B: Side Kick (high lateral displacement, significant torso lean)
        # Check if candidate exhibits side kick tendencies
        is_lateral_high = (
            lateral_displacement is not None
            and lateral_displacement >= self.config.side_min_lateral_displacement_ratio
        )
        is_torso_lean_high = (
            torso_lean is not None
            and torso_lean >= self.config.side_min_torso_lean_deg
        )

        if is_lateral_high and torso_lean is None:
            return ExtendedClassificationDecision(
                status=DecisionStatus.ABSTAINED,
                candidate=None,
                reason_codes=("MISSING_KINEMATIC_FEATURES",),
                provenance=self.provenance,
                confidence=None,
                evidence_level=EvidenceLevel.UNAVAILABLE,
            )
        if is_torso_lean_high and lateral_displacement is None:
            return ExtendedClassificationDecision(
                status=DecisionStatus.ABSTAINED,
                candidate=None,
                reason_codes=("MISSING_KINEMATIC_FEATURES",),
                provenance=self.provenance,
                confidence=None,
                evidence_level=EvidenceLevel.UNAVAILABLE,
            )

        if is_lateral_high and is_torso_lean_high:
            candidate = TechniqueCandidate(
                technique="side_kick",
                family="kick",
                attacking_side=leg_side,
                limb_role=limb_role,
                stance=resolved_stance,
            )
            return ExtendedClassificationDecision(
                status=DecisionStatus.CLASSIFIED,
                candidate=candidate,
                reason_codes=("SIDE_KICK_LATERAL_MATCHED",),
                provenance=provenance,
                evidence_level=EvidenceLevel.DERIVED_PROXY,
            )

        # Case C: Roundhouse Kick (high hip rotation, transverse arc curvature)
        if hip_rotation >= self.config.round_min_hip_rotation_deg:
            if arc_curvature is None:
                return ExtendedClassificationDecision(
                    status=DecisionStatus.ABSTAINED,
                    candidate=None,
                    reason_codes=("MISSING_KINEMATIC_FEATURES",),
                    provenance=self.provenance,
                    confidence=None,
                    evidence_level=EvidenceLevel.UNAVAILABLE,
                )
            if arc_curvature >= self.config.round_min_arc_curvature:
                candidate = TechniqueCandidate(
                    technique="round_kick",
                    family="kick",
                    attacking_side=leg_side,
                    limb_role=limb_role,
                    stance=resolved_stance,
                )
                return ExtendedClassificationDecision(
                    status=DecisionStatus.CLASSIFIED,
                    candidate=candidate,
                    reason_codes=("ROUNDHOUSE_TRANSVERSE_MATCHED",),
                    provenance=provenance,
                    evidence_level=EvidenceLevel.DERIVED_PROXY,
                )

        # Case D: Ambiguous motion
        return ExtendedClassificationDecision(
            status=DecisionStatus.ABSTAINED,
            candidate=None,
            reason_codes=("AMBIGUOUS_KICK_TRAJECTORY",),
            provenance=provenance,
            confidence=None,
            evidence_level=EvidenceLevel.DERIVED_PROXY,
        )

