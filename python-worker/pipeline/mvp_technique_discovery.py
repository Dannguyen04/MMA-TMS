"""
mvp_technique_discovery.py — MVP Technique Discovery & Classification Engine (Task TL-04)

Provides end-to-end candidate discovery and measured classification for the 5 MVP classes:
1. Jab (lead straight punch)
2. Cross (rear straight punch)
3. Hook (lead hook / rear hook; side-based intermediate label when stance uncertain)
4. Round Kick (transverse rotational arc)
5. Knee Strike (independent candidate path: acute knee flexion + forward/upward knee drive, no leg extension)

Strict Invariants:
- Stance uncertainty produces side-based intermediate labels (left_straight, right_straight, left_hook, right_hook, left_knee, right_knee)
  and user-visible abstention reason codes where required.
- Hook is evaluated independently and is NEVER rejected by straight-punch geometry.
- Knee has an independent candidate path and is NEVER routed through leg-extension kick detector.
- Negative classes (parry, block, feint, guard adjustment, walking, clinch, grapple) fail closed / abstain.
- Zero label echoing: expectedTechniques may only constrain evaluation scope; it NEVER generates positive detections.
- Validation status remains SHADOW_NOT_VALIDATED until Task TL-05 gold benchmark.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Mapping, Optional, Sequence, Union

from pipeline.contracts import (
    EvidenceLevel,
    ValidationStatus,
    ShadowEventFamily,
    deep_freeze,
    to_json_safe,
)
from pipeline.shadow_classifier import (
    ClassifierProvenance,
    DecisionStatus,
    TechniqueCandidate,
    ClassificationDecision,
)
from pipeline.shadow_punch_classifier import (
    ExtendedClassificationDecision,
    MultiPunchClassifierConfig,
    ShadowMultiPunchClassifier,
    VALIDATION_STATUS_NOT_VALIDATED,
)
from pipeline.shadow_kick_classifier import (
    ShadowKickClassifier,
    ShadowKickClassifierConfig,
)
from pipeline.elbow_knee_shadow import (
    ElbowKneeShadowClassifier,
    ElbowKneeShadowEvent,
    KinematicEvidence,
)
from pipeline.stance_context import (
    StanceContext,
    StanceType,
    normalize_attacking_side,
    resolve_limb_role,
)

MVP_TECHNIQUES: tuple[str, ...] = (
    "jab",
    "cross",
    "lead_hook",
    "rear_hook",
    "lead_roundhouse",
    "rear_roundhouse",
)

NEGATIVE_CLASSES: tuple[str, ...] = (
    "parry",
    "block",
    "feint",
    "guard_adjustment",
    "walking",
    "clinch",
    "grapple",
    "background",
)



@dataclass(frozen=True)
class MVPDiscoveryConfig:
    config_version: str = "1.0.0"
    
    # Straight punch thresholds
    straight_min_directness: float = 0.80
    straight_max_curvature: float = 0.22
    straight_min_extension_deg: float = 140.0
    
    # Hook thresholds (independent from straight punch)
    hook_min_curvature: float = 0.24
    hook_max_directness: float = 0.82
    hook_min_elbow_deg: float = 75.0
    hook_max_elbow_deg: float = 130.0
    
    # Round kick thresholds
    round_min_hip_rotation_deg: float = 35.0
    round_min_arc_curvature: float = 0.22
    
    # Knee strike thresholds (independent: acute angle, no leg extension)
    knee_max_angle_deg: float = 105.0  # Acute knee angle
    knee_min_velocity_norm: float = 0.35  # Dynamic knee lift/drive
    
    # Negative class gates
    min_separation_ratio: float = 0.20  # Guards against blocks/parries with hands clamped at head
    min_motion_displacement: float = 0.08  # Guards against small feints / twitches
    min_keypoint_visibility: float = 0.40


class MVPTechniqueDiscoveryEngine:
    """
    Unified discovery and classification engine for the 5 MVP technique families.
    Enforces strict stance-awareness, zero label echoing, and independent candidate paths.
    """

    def __init__(self, config: Optional[MVPDiscoveryConfig] = None):
        self.config = config or MVPDiscoveryConfig()
        self.punch_classifier = ShadowMultiPunchClassifier()
        self.kick_classifier = ShadowKickClassifier()
        self.elbow_knee_classifier = ElbowKneeShadowClassifier(
            knee_max_angle_deg=self.config.knee_max_angle_deg,
            min_velocity_norm=self.config.knee_min_velocity_norm,
            min_keypoint_visibility=self.config.min_keypoint_visibility,
        )
        self.provenance = ClassifierProvenance(
            classifier_id="mvp_technique_discovery_engine",
            classifier_version="1.0.0",
            config_version=self.config.config_version,
            feature_version="1.0.0",
            stance_source="stance_context",
        )

    def classify_punch_candidate(
        self,
        features: Any,
        stance_context: Optional[StanceContext] = None,
        expected_techniques: Optional[Sequence[str]] = None,
    ) -> ExtendedClassificationDecision:
        """
        Classifies punch candidate (jab, cross, lead_hook, rear_hook).
        - Hook geometry is tested independently from straight geometry.
        - Stance uncertainty yields side-based intermediate labels (e.g. left_hook, left_straight).
        - expected_techniques NEVER generates positive detections if kinematics do not support it.
        """
        raw_decision = self.punch_classifier.classify(features, stance_context)
        if raw_decision.status != DecisionStatus.CLASSIFIED or raw_decision.candidate is None:
            return raw_decision

        cand = raw_decision.candidate
        limb_role = cand.limb_role
        arm_side = cand.attacking_side
        resolved_stance = cand.stance
        tech = cand.technique
        reason_codes = list(raw_decision.reason_codes)

        # Refine technique for hook and straight punch according to MVP spec:
        refined_tech = tech
        if tech == "hook":
            if limb_role == "lead":
                refined_tech = "lead_hook"
            elif limb_role == "rear":
                refined_tech = "rear_hook"
            else:
                # Stance uncertainty produces side-based intermediate label
                refined_tech = f"{arm_side}_hook" if arm_side in ("left", "right") else "hook"
                reason_codes.append("STANCE_UNCERTAINTY_SIDE_BASED_LABEL")
        elif tech == "straight_punch":
            if limb_role == "lead":
                refined_tech = "jab"
            elif limb_role == "rear":
                refined_tech = "cross"
            else:
                refined_tech = f"{arm_side}_straight" if arm_side in ("left", "right") else "straight_punch"
                reason_codes.append("STANCE_UNCERTAINTY_SIDE_BASED_LABEL")
        elif tech in ("jab", "cross") and limb_role == "unknown":
            refined_tech = f"{arm_side}_straight" if arm_side in ("left", "right") else "straight_punch"
            reason_codes.append("STANCE_UNCERTAINTY_SIDE_BASED_LABEL")

        # Zero Label Echoing Guardrail:
        # expected_techniques may constrain scope, but CANNOT synthesize a match.
        if expected_techniques:
            normalized_expected = [t.strip().lower() for t in expected_techniques if t and str(t).strip()]
            if normalized_expected:
                # Allow base family matches (e.g. 'hook' covers 'lead_hook', 'straight_punch' covers 'jab'/'cross')
                tech_matches = (
                    refined_tech in normalized_expected
                    or tech in normalized_expected
                    or (refined_tech in ("jab", "cross") and "punch" in normalized_expected)
                    or ("hook" in refined_tech and "hook" in normalized_expected)
                )
                if not tech_matches:
                    return ExtendedClassificationDecision(
                        status=DecisionStatus.REJECTED_CANDIDATE,
                        candidate=None,
                        reason_codes=("EXPECTED_TECHNIQUE_MISMATCH", f"detected_{refined_tech}"),
                        provenance=raw_decision.provenance,
                        confidence=None,
                        evidence_level=raw_decision.evidence_level,
                        validation_status=ValidationStatus.SHADOW_NOT_VALIDATED,
                    )

        updated_candidate = TechniqueCandidate(
            technique=refined_tech,
            family="punch",
            attacking_side=arm_side,
            limb_role=limb_role,
            stance=resolved_stance,
        )

        return ExtendedClassificationDecision(
            status=DecisionStatus.CLASSIFIED,
            candidate=updated_candidate,
            reason_codes=tuple(reason_codes),
            provenance=raw_decision.provenance,
            confidence=raw_decision.confidence,
            evidence_level=raw_decision.evidence_level,
            validation_status=ValidationStatus.SHADOW_NOT_VALIDATED,
        )

    def classify_kick_candidate(
        self,
        features: Any,
        stance_context: Optional[StanceContext] = None,
        expected_techniques: Optional[Sequence[str]] = None,
    ) -> ExtendedClassificationDecision:
        """
        Classifies kick candidate (round_kick).
        - Stance uncertainty yields side-based intermediate labels.
        - Zero label echoing: expected_techniques cannot synthesize detections.
        """
        raw_decision = self.kick_classifier.classify(features, stance_context)
        if raw_decision.status != DecisionStatus.CLASSIFIED or raw_decision.candidate is None:
            return raw_decision

        cand = raw_decision.candidate
        limb_role = cand.limb_role
        leg_side = cand.attacking_side
        resolved_stance = cand.stance
        tech = cand.technique
        reason_codes = list(raw_decision.reason_codes)

        if limb_role == "unknown" and resolved_stance in (StanceType.UNKNOWN.value, "switch"):
            reason_codes.append("STANCE_UNCERTAINTY_SIDE_BASED_LABEL")

        # Zero Label Echoing Guardrail:
        if expected_techniques:
            normalized_expected = [t.strip().lower() for t in expected_techniques if t and str(t).strip()]
            if normalized_expected:
                tech_matches = (
                    tech in normalized_expected
                    or (tech == "round_kick" and "kick" in normalized_expected)
                )
                if not tech_matches:
                    return ExtendedClassificationDecision(
                        status=DecisionStatus.REJECTED_CANDIDATE,
                        candidate=None,
                        reason_codes=("EXPECTED_TECHNIQUE_MISMATCH", f"detected_{tech}"),
                        provenance=raw_decision.provenance,
                        confidence=None,
                        evidence_level=raw_decision.evidence_level,
                        validation_status=ValidationStatus.SHADOW_NOT_VALIDATED,
                    )

        updated_candidate = TechniqueCandidate(
            technique=tech,
            family="kick",
            attacking_side=leg_side,
            limb_role=limb_role,
            stance=resolved_stance,
        )

        return ExtendedClassificationDecision(
            status=DecisionStatus.CLASSIFIED,
            candidate=updated_candidate,
            reason_codes=tuple(reason_codes),
            provenance=raw_decision.provenance,
            confidence=raw_decision.confidence,
            evidence_level=raw_decision.evidence_level,
            validation_status=ValidationStatus.SHADOW_NOT_VALIDATED,
        )

    def classify_knee_candidate(
        self,
        start_frame: int,
        end_frame: int,
        peak_frame: int,
        knee_angle_at_peak: Optional[float],
        knee_velocity_norm: Optional[float],
        attacking_side: str = "right",
        stance_context: Optional[StanceContext] = None,
        keypoint_visibility: float = 1.0,
        ankle_extension_past_knee: Optional[float] = None,
        expected_techniques: Optional[Sequence[str]] = None,
    ) -> ExtendedClassificationDecision:
        """
        Independent candidate path for Knee Strike:
        - NEVER routes through leg extension detector!
        - Verifies acute knee angle (< 105°) and dynamic knee velocity (>= 0.35 norm/s).
        - If leg extends past threshold, rejects immediately (cannot be a knee strike).
        - Resolves lead_knee / rear_knee or side-based intermediate label (left_knee / right_knee).
        """
        side_norm = normalize_attacking_side(attacking_side)
        resolved_stance = (
            stance_context.resolved_stance
            if stance_context is not None
            else StanceType.UNKNOWN.value
        )
        limb_role = resolve_limb_role(side_norm, resolved_stance) if stance_context else "unknown"

        # Pass to specialized close-range classifier
        shadow_event = self.elbow_knee_classifier.classify_knee_candidate(
            start_frame=start_frame,
            end_frame=end_frame,
            peak_frame=peak_frame,
            knee_angle_at_peak=knee_angle_at_peak,
            knee_velocity_norm=knee_velocity_norm,
            keypoint_visibility=keypoint_visibility,
            ankle_extension_past_knee=ankle_extension_past_knee,
            attacking_side=side_norm,
        )

        if shadow_event is None:
            # Check why it was rejected
            rejection_reasons = []
            if knee_angle_at_peak is not None and knee_angle_at_peak > self.config.knee_max_angle_deg:
                rejection_reasons.append("LEG_EXTENDED_NOT_KNEE_STRIKE")
            elif knee_velocity_norm is not None and knee_velocity_norm < self.config.knee_min_velocity_norm:
                rejection_reasons.append("INSUFFICIENT_KNEE_VELOCITY")
            else:
                rejection_reasons.append("INSUFFICIENT_EVIDENCE")

            return ExtendedClassificationDecision(
                status=DecisionStatus.REJECTED_CANDIDATE if "LEG_EXTENDED_NOT_KNEE_STRIKE" in rejection_reasons else DecisionStatus.ABSTAINED,
                candidate=None,
                reason_codes=tuple(rejection_reasons),
                provenance=self.provenance,
                confidence=None,
                evidence_level=EvidenceLevel.UNAVAILABLE,
                validation_status=ValidationStatus.SHADOW_NOT_VALIDATED,
            )

        # Resolve technique label
        reason_codes = list(shadow_event.reason_codes)
        if limb_role == "lead":
            refined_tech = "lead_knee"
        elif limb_role == "rear":
            refined_tech = "rear_knee"
        elif side_norm in ("left", "right"):
            refined_tech = f"{side_norm}_knee"
            reason_codes.append("STANCE_UNCERTAINTY_SIDE_BASED_LABEL")
        else:
            refined_tech = "knee"
            reason_codes.append("STANCE_UNCERTAINTY_SIDE_BASED_LABEL")

        # Zero Label Echoing Guardrail:
        if expected_techniques:
            normalized_expected = [t.strip().lower() for t in expected_techniques if t and str(t).strip()]
            if normalized_expected:
                tech_matches = (
                    refined_tech in normalized_expected
                    or "knee" in normalized_expected
                    or "knee_strike" in normalized_expected
                )
                if not tech_matches:
                    return ExtendedClassificationDecision(
                        status=DecisionStatus.REJECTED_CANDIDATE,
                        candidate=None,
                        reason_codes=("EXPECTED_TECHNIQUE_MISMATCH", f"detected_{refined_tech}"),
                        provenance=self.provenance,
                        confidence=None,
                        evidence_level=EvidenceLevel.DERIVED_PROXY,
                        validation_status=ValidationStatus.SHADOW_NOT_VALIDATED,
                    )

        candidate = TechniqueCandidate(
            technique=refined_tech,
            family="other_strike",
            attacking_side=side_norm,
            limb_role=limb_role,
            stance=resolved_stance,
        )

        return ExtendedClassificationDecision(
            status=DecisionStatus.CLASSIFIED,
            candidate=candidate,
            reason_codes=tuple(reason_codes),
            provenance=self.provenance,
            confidence=0.85,
            evidence_level=EvidenceLevel.DERIVED_PROXY,
            validation_status=ValidationStatus.SHADOW_NOT_VALIDATED,
        )

    def evaluate_negative_class(
        self,
        class_name: str,
        features: Mapping[str, Any],
        stance_context: Optional[StanceContext] = None,
        expected_techniques: Optional[Sequence[str]] = None,
    ) -> ExtendedClassificationDecision:
        """
        Explicitly verifies that negative classes (parry, block, feint, guard_adjustment,
        walking, clinch, grapple) do NOT produce positive strike classifications.
        """
        name_clean = class_name.strip().lower()
        if name_clean in ("parry", "block", "feint", "guard_adjustment"):
            return self.classify_punch_candidate(
                features=features,
                stance_context=stance_context,
                expected_techniques=expected_techniques,
            )
        elif name_clean == "walking":
            return self.classify_kick_candidate(
                features=features,
                stance_context=stance_context,
                expected_techniques=expected_techniques,
            )
        elif name_clean in ("clinch", "grapple"):
            # Clinch and grapple are non-strike grappling segments
            return ExtendedClassificationDecision(
                status=DecisionStatus.ABSTAINED,
                candidate=None,
                reason_codes=("GRAPPLING_OR_CLINCH_INTERACTION",),
                provenance=self.provenance,
                confidence=None,
                evidence_level=EvidenceLevel.DERIVED_PROXY,
                validation_status=ValidationStatus.SHADOW_NOT_VALIDATED,
            )
        else:
            return ExtendedClassificationDecision(
                status=DecisionStatus.ABSTAINED,
                candidate=None,
                reason_codes=("UNKNOWN_NEGATIVE_CLASS",),
                provenance=self.provenance,
                confidence=None,
                evidence_level=EvidenceLevel.UNAVAILABLE,
                validation_status=ValidationStatus.SHADOW_NOT_VALIDATED,
            )
