"""
grappling_shadow.py — Takedown & Clinch Shadow Event Segmentation (Task 25)

Provides:
- Shadow event segmentation for grappling interactions:
  * States: APPROACH, LEVEL_CHANGE, CONTACT_TRANSITION, CLINCH_LIKE, TAKEDOWN_LIKE, UNKNOWN
- Multi-Person Proximity & Ambiguity Gate:
  * Single-person input: Strictly abstains with UNSUPPORTED_MULTI_PERSON_EVIDENCE / NOT_EVALUABLE.
  * >2 persons input: Strictly abstains with MULTI_PERSON_AMBIGUITY_MORE_THAN_TWO / NOT_EVALUABLE.
  * TAKEDOWN_LIKE state: Requires BOTH vertical level change AND physical contact/proximity.
- Strict Invariants:
  * Default status: ValidationStatus.SHADOW_NOT_VALIDATED (or NOT_EVALUABLE).
  * Never speculates takedown points, referee scores, or biomechanical control.
  * CamelCase public serialization.
"""

from __future__ import annotations

import hashlib
import math
from dataclasses import dataclass, field
from typing import Any, Mapping, Optional, Sequence

from pipeline.contracts import (
    ShadowGrapplingState,
    ValidationStatus,
    deep_freeze,
    to_json_safe,
)


@dataclass(frozen=True)
class GrapplingShadowSegment:
    segment_id: str
    state: ShadowGrapplingState
    start_frame: int
    end_frame: int
    level_change_displacement_norm: Optional[float]
    proximity_distance_norm: Optional[float]
    multi_person_ambiguity: bool
    validation_status: ValidationStatus = ValidationStatus.SHADOW_NOT_VALIDATED
    reason_codes: tuple[str, ...] = ()

    def to_dict(self) -> dict[str, Any]:
        return {
            "segmentId": self.segment_id,
            "state": self.state.value,
            "startFrame": self.start_frame,
            "endFrame": self.end_frame,
            "levelChangeDisplacementNorm": (
                round(self.level_change_displacement_norm, 4)
                if self.level_change_displacement_norm is not None
                else None
            ),
            "proximityDistanceNorm": (
                round(self.proximity_distance_norm, 4)
                if self.proximity_distance_norm is not None
                else None
            ),
            "multiPersonAmbiguity": self.multi_person_ambiguity,
            "validationStatus": self.validation_status.value,
            "reasonCodes": list(self.reason_codes),
        }


class GrapplingShadowSegmenter:
    """Segments shadow grappling events based on observable multi-person proximity and level changes."""

    def __init__(
        self,
        min_clinch_iou: float = 0.30,
        min_level_change_drop: float = 0.20,
        max_contact_distance_norm: float = 0.35,
    ):
        self.min_clinch_iou = min_clinch_iou
        self.min_level_change_drop = min_level_change_drop
        self.max_contact_distance_norm = max_contact_distance_norm

    def segment_interaction(
        self,
        start_frame: int,
        end_frame: int,
        person_count: int,
        bounding_box_iou: Optional[float] = None,
        torso_distance_norm: Optional[float] = None,
        hip_drop_norm: Optional[float] = None,
    ) -> GrapplingShadowSegment:
        token = f"grapple:{start_frame}:{end_frame}:{person_count}"
        segment_id = f"sh_grp_{hashlib.sha256(token.encode('utf-8')).hexdigest()[:16]}"

        # Guard 1: Single person -> abstain
        if person_count < 2:
            return GrapplingShadowSegment(
                segment_id=segment_id,
                state=ShadowGrapplingState.UNKNOWN,
                start_frame=start_frame,
                end_frame=end_frame,
                level_change_displacement_norm=None,
                proximity_distance_norm=None,
                multi_person_ambiguity=False,
                validation_status=ValidationStatus.NOT_EVALUABLE,
                reason_codes=("UNSUPPORTED_MULTI_PERSON_EVIDENCE",),
            )

        # Guard 2: More than two persons -> ambiguity
        if person_count > 2:
            return GrapplingShadowSegment(
                segment_id=segment_id,
                state=ShadowGrapplingState.UNKNOWN,
                start_frame=start_frame,
                end_frame=end_frame,
                level_change_displacement_norm=None,
                proximity_distance_norm=None,
                multi_person_ambiguity=True,
                validation_status=ValidationStatus.NOT_EVALUABLE,
                reason_codes=("MULTI_PERSON_AMBIGUITY_MORE_THAN_TWO",),
            )

        # Contact / Proximity check
        has_proximity = (
            (bounding_box_iou is not None and bounding_box_iou >= self.min_clinch_iou)
            or (torso_distance_norm is not None and torso_distance_norm <= self.max_contact_distance_norm)
        )

        reasons = []
        if hip_drop_norm is not None and hip_drop_norm >= self.min_level_change_drop:
            if has_proximity:
                state = ShadowGrapplingState.TAKEDOWN_LIKE
                reasons.append("SIGNIFICANT_LEVEL_CHANGE_WITH_PROXIMITY_CONTACT")
            else:
                state = ShadowGrapplingState.LEVEL_CHANGE
                reasons.append("SOLITARY_LEVEL_CHANGE_WITHOUT_OPPONENT_PROXIMITY")
        elif bounding_box_iou is not None and bounding_box_iou >= self.min_clinch_iou:
            state = ShadowGrapplingState.CLINCH_LIKE
            reasons.append("HIGH_BOUNDING_BOX_INTERSECTION_OVER_UNION")
        elif torso_distance_norm is not None and torso_distance_norm <= self.max_contact_distance_norm:
            state = ShadowGrapplingState.CONTACT_TRANSITION
            reasons.append("TORSO_PROXIMITY_CONTACT_TRANSITION")
        else:
            state = ShadowGrapplingState.APPROACH
            reasons.append("TWO_PERSON_APPROACH_PHASE")

        return GrapplingShadowSegment(
            segment_id=segment_id,
            state=state,
            start_frame=start_frame,
            end_frame=end_frame,
            level_change_displacement_norm=hip_drop_norm,
            proximity_distance_norm=torso_distance_norm,
            multi_person_ambiguity=False,
            validation_status=ValidationStatus.SHADOW_NOT_VALIDATED,
            reason_codes=tuple(reasons),
        )
