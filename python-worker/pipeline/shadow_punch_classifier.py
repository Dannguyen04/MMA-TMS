"""
shadow_punch_classifier.py — Hook & Uppercut Shadow Classification (Task 15)

Mở rộng punch shadow classifier cho 4 kỹ thuật cơ bản:
  Candidates: jab | cross | hook | uppercut | unknown

Nguyên tắc:
1. Phân biệt động học (kinematic distinction):
   - Straight (jab / cross): Directness cao (> 0.80), Curvature thấp (< 0.22), Extension lớn (> 140°).
   - Hook: Curvature cao (> 0.25), góc khuỷu gập đặc trưng (80°–125°), quỹ đạo cung ngang.
   - Uppercut: Gia tốc/vận tốc nâng theo phương đứng hướng lên (d_y < -0.15 norm/s), góc khuỷu gập (70°–115°).
2. Stance-aware:
   - Khi có stance hợp lệ (orthodox | southpaw):
     * Lead straight -> jab, Rear straight -> cross
     * Lead hook vs Rear hook (đều có base technique = "hook", limbRole xác định lead/rear)
     * Lead uppercut vs Rear uppercut (base technique = "uppercut", limbRole xác định lead/rear)
   - Khi stance là unknown: candidate.technique = "hook" | "uppercut" | "unknown", limbRole = "unknown".
3. Abstain-first:
   - Khi góc quay, độ phân tách cổ tay-vai, hoặc visibility không đủ -> ABSTAINED.
4. Trạng thái kiểm định:
   - Bắt buộc gắn validation_status = "SHADOW_NOT_VALIDATED" do chưa có gold benchmark.
5. Tuyệt đối KHÔNG ghi đè legacy detector technique.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
import math
from typing import Any, Mapping, Optional, Union

from pipeline.contracts import EvidenceLevel
from pipeline.shadow_classifier import (
    ClassifierProvenance,
    DecisionStatus,
    TechniqueCandidate,
    ClassificationDecision,
)
from pipeline.stance_context import (
    StanceContext,
    StanceType,
    normalize_attacking_side,
    resolve_limb_role,
)

VALIDATION_STATUS_NOT_VALIDATED = "SHADOW_NOT_VALIDATED"


@dataclass(frozen=True)
class MultiPunchClassifierConfig:
    config_version: str = "2.0.0"
    # Straight punch thresholds
    straight_min_directness: float = 0.80
    straight_max_curvature: float = 0.22
    straight_min_extension_deg: float = 140.0
    
    # Hook thresholds
    hook_min_curvature: float = 0.24
    hook_max_directness: float = 0.82
    hook_min_elbow_deg: float = 75.0
    hook_max_elbow_deg: float = 130.0
    
    # Uppercut thresholds
    uppercut_min_vertical_lift: float = 0.12  # normalized upward displacement
    uppercut_min_elbow_deg: float = 65.0
    uppercut_max_elbow_deg: float = 120.0
    
    # Ambiguity thresholds
    min_feature_confidence: float = 0.35


class ExtendedClassificationDecision(ClassificationDecision):
    """Mở rộng ClassificationDecision với validation_status theo Task 15."""
    def __init__(
        self,
        status: DecisionStatus,
        candidate: Optional[TechniqueCandidate],
        reason_codes: tuple[str, ...],
        provenance: ClassifierProvenance,
        confidence: Optional[float] = None,
        evidence_level: EvidenceLevel = EvidenceLevel.DERIVED_PROXY,
        validation_status: str = VALIDATION_STATUS_NOT_VALIDATED,
    ):
        super().__init__(
            status=status,
            candidate=candidate,
            reason_codes=reason_codes,
            provenance=provenance,
            confidence=confidence,
            evidence_level=evidence_level,
        )
        object.__setattr__(self, "validation_status", validation_status)

    def to_dict(self) -> dict[str, Any]:
        d = super().to_dict()
        d["validationStatus"] = getattr(self, "validation_status", VALIDATION_STATUS_NOT_VALIDATED)
        return d


class ShadowMultiPunchClassifier:
    """
    Classifier shadow cho Jab, Cross, Hook, Uppercut.
    """

    def __init__(self, config: Optional[MultiPunchClassifierConfig] = None):
        self.config = config or MultiPunchClassifierConfig()
        self.provenance = ClassifierProvenance(
            classifier_id="shadow_multi_punch_classifier",
            classifier_version="2.0.0",
            config_version=self.config.config_version,
            feature_version="2.0.0",
            stance_source="stance_context",
        )

    def classify(
        self,
        features: Any,
        stance_context: Optional[StanceContext] = None,
    ) -> ExtendedClassificationDecision:
        """
        Phân loại đòn đấm ở chế độ shadow.
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
            arm_val = getattr(features, "arm", getattr(features, "arm_side", getattr(features, "attacking_side", None)))
            vl_metric = m.get("vertical_lift") or m.get("vertical_delta_y")
            sep_metric = m.get("wrist_shoulder_separation_ratio")
            curv_metric = m.get("max_tangential_curvature") or m.get("tangential_curvature") or m.get("curvature")
            dir_metric = m.get("trajectory_directness") or m.get("directness")
            ang_metric = m.get("max_elbow_angle") or m.get("elbow_extension_deg") or m.get("elbow_extension_angle")
            features = {
                "attacking_side": arm_val,
                "max_elbow_angle": getattr(ang_metric, "value", None) if ang_metric is not None else None,
                "trajectory_directness": getattr(dir_metric, "value", None) if dir_metric is not None else None,
                "tangential_curvature": getattr(curv_metric, "value", None) if curv_metric is not None else None,
                "vertical_lift": getattr(vl_metric, "value", None) if vl_metric is not None else None,
                "wrist_shoulder_separation_ratio": getattr(sep_metric, "value", None) if sep_metric is not None else None,
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

        # 1. Guardrail: Check missing or low-confidence evidence
        if features.get("is_evidence_missing", False):
            return ExtendedClassificationDecision(
                status=DecisionStatus.ABSTAINED,
                candidate=None,
                reason_codes=("INSUFFICIENT_EVIDENCE",),
                provenance=self.provenance,
                confidence=None,
                evidence_level=EvidenceLevel.UNAVAILABLE,
            )

        # Extract features safely (avoid `or` treating 0.0 as falsy)
        arm_side = normalize_attacking_side(
            features.get("attacking_side") or features.get("arm") or features.get("arm_side")
        )
        elbow_angle = features.get("max_elbow_angle")
        if elbow_angle is None:
            elbow_angle = features.get("elbow_extension_deg")
        if elbow_angle is None:
            elbow_angle = features.get("elbow_extension_angle")

        directness = features.get("trajectory_directness")
        if directness is None:
            directness = features.get("directness")

        curvature = features.get("tangential_curvature")
        if curvature is None:
            curvature = features.get("curvature")
        if curvature is None:
            curvature = features.get("max_tangential_curvature")

        vertical_lift = features.get("vertical_lift")
        if vertical_lift is None:
            vertical_lift = features.get("vertical_delta_y")

        separation_ratio = features.get("wrist_shoulder_separation_ratio")

        # 2. Guardrail: Camera view / wrist separation check
        if separation_ratio is None:
            return ExtendedClassificationDecision(
                status=DecisionStatus.ABSTAINED,
                candidate=None,
                reason_codes=("UNAVAILABLE_SEPARATION_OR_VIEW_EVIDENCE",),
                provenance=self.provenance,
                confidence=None,
                evidence_level=EvidenceLevel.UNAVAILABLE,
            )

        if separation_ratio < 0.20:
            return ExtendedClassificationDecision(
                status=DecisionStatus.ABSTAINED,
                candidate=None,
                reason_codes=("INSUFFICIENT_SEPARATION_OR_VIEW",),
                provenance=self.provenance,
                confidence=None,
                evidence_level=EvidenceLevel.DERIVED_PROXY,
            )

        # Check sufficiency of mandatory measurements
        if elbow_angle is None or directness is None or curvature is None:
            return ExtendedClassificationDecision(
                status=DecisionStatus.ABSTAINED,
                candidate=None,
                reason_codes=("MISSING_KINEMATIC_FEATURES",),
                provenance=self.provenance,
                confidence=None,
                evidence_level=EvidenceLevel.UNAVAILABLE,
            )

        # 3. Resolve Stance & Limb Role
        if stance_context is None:
            resolved_stance = StanceType.UNKNOWN.value
            stance_source = "unknown"
        else:
            raw_stance = getattr(stance_context, "resolved_stance", getattr(stance_context, "stance", StanceType.UNKNOWN.value))
            resolved_stance = raw_stance.value if hasattr(raw_stance, "value") else str(raw_stance)
            raw_source = getattr(stance_context, "source", "unknown")
            stance_source = raw_source.value if hasattr(raw_source, "value") else str(raw_source)

        limb_role = resolve_limb_role(arm_side, resolved_stance)
        if limb_role is None:
            limb_role = "unknown"

        # Update provenance with resolved stance source
        provenance = ClassifierProvenance(
            classifier_id=self.provenance.classifier_id,
            classifier_version=self.provenance.classifier_version,
            config_version=self.provenance.config_version,
            feature_version=self.provenance.feature_version,
            stance_source=stance_source,
        )

        # 4. Pattern Classification Logic
        # Case A: Uppercut (vertical trajectory from low to high with bent elbow)
        if (
            vertical_lift is not None
            and vertical_lift >= self.config.uppercut_min_vertical_lift
            and self.config.uppercut_min_elbow_deg <= elbow_angle <= self.config.uppercut_max_elbow_deg
        ):
            candidate = TechniqueCandidate(
                technique="uppercut",
                family="punch",
                attacking_side=arm_side,
                limb_role=limb_role,
                stance=resolved_stance,
            )
            return ExtendedClassificationDecision(
                status=DecisionStatus.CLASSIFIED,
                candidate=candidate,
                reason_codes=("UPPERCUT_KINEMATICS_MATCHED",),
                provenance=provenance,
                evidence_level=EvidenceLevel.DERIVED_PROXY,
            )

        # Case B: Hook (high curvature, moderate directness, bent elbow)
        if (
            curvature >= self.config.hook_min_curvature
            and directness <= self.config.hook_max_directness
            and self.config.hook_min_elbow_deg <= elbow_angle <= self.config.hook_max_elbow_deg
        ):
            candidate = TechniqueCandidate(
                technique="hook",
                family="punch",
                attacking_side=arm_side,
                limb_role=limb_role,
                stance=resolved_stance,
            )
            return ExtendedClassificationDecision(
                status=DecisionStatus.CLASSIFIED,
                candidate=candidate,
                reason_codes=("HOOK_CURVATURE_MATCHED",),
                provenance=provenance,
                evidence_level=EvidenceLevel.DERIVED_PROXY,
            )

        # Case C: Straight Punch (jab or cross)
        if (
            directness >= self.config.straight_min_directness
            and curvature <= self.config.straight_max_curvature
            and elbow_angle >= self.config.straight_min_extension_deg
        ):
            if limb_role == "lead":
                technique = "jab"
            elif limb_role == "rear":
                technique = "cross"
            else:
                technique = "straight_punch"

            candidate = TechniqueCandidate(
                technique=technique,
                family="punch",
                attacking_side=arm_side,
                limb_role=limb_role,
                stance=resolved_stance,
            )
            return ExtendedClassificationDecision(
                status=DecisionStatus.CLASSIFIED,
                candidate=candidate,
                reason_codes=("STRAIGHT_PUNCH_MATCHED",),
                provenance=provenance,
                evidence_level=EvidenceLevel.DERIVED_PROXY,
            )

        # If non-extended punch failed hook and uppercut due to missing vertical lift evidence:
        if elbow_angle < self.config.straight_min_extension_deg and vertical_lift is None:
            return ExtendedClassificationDecision(
                status=DecisionStatus.ABSTAINED,
                candidate=None,
                reason_codes=("MISSING_KINEMATIC_FEATURES",),
                provenance=provenance,
                confidence=None,
                evidence_level=EvidenceLevel.UNAVAILABLE,
            )

        # Case D: Ambiguous motion that fits no clean kinematic envelope -> ABSTAIN
        return ExtendedClassificationDecision(
            status=DecisionStatus.ABSTAINED,
            candidate=None,
            reason_codes=("AMBIGUOUS_MOTION_TRAJECTORY",),
            provenance=provenance,
            confidence=None,
            evidence_level=EvidenceLevel.DERIVED_PROXY,
        )
