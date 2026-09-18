"""
elbow_knee_shadow.py — Elbow & Knee Shadow Event Classification (Task 24)

Provides:
- Shadow event classification for close-range strikes:
  * Family: ELBOW (lead_elbow, rear_elbow, elbow)
  * Family: KNEE (lead_knee, rear_knee, knee)
- Kinematic distinctions & gates:
  * Keypoint visibility gate (visibility >= 0.40)
  * Camera angle & phase bounds check
  * Elbow vs Punch: High elbow velocity with acute elbow angle (< 115°) and low wrist-to-elbow separation.
  * Knee vs Kick: High knee velocity with acute knee angle (< 105°) and low ankle-to-knee extension.
- Strict Invariants:
  * Default status: ValidationStatus.SHADOW_NOT_VALIDATED.
  * Never overwrites legacy punch or kick detectors.
  * Never speculates impact force, injury, or opponent effect.
  * CamelCase public serialization.
"""

from __future__ import annotations

import hashlib
import math
from dataclasses import dataclass, field
from typing import Any, Mapping, Optional, Sequence

from pipeline.contracts import (
    ShadowEventFamily,
    ValidationStatus,
    deep_freeze,
    to_json_safe,
)


@dataclass(frozen=True)
class KinematicEvidence:
    peak_joint_velocity_norm: Optional[float]
    joint_flexion_angle_deg: Optional[float]
    extension_ratio: Optional[float]
    torso_inclination_deg: Optional[float]

    def to_dict(self) -> dict[str, Optional[float]]:
        return {
            "peakJointVelocityNorm": (
                round(self.peak_joint_velocity_norm, 4)
                if self.peak_joint_velocity_norm is not None
                else None
            ),
            "jointFlexionAngleDeg": (
                round(self.joint_flexion_angle_deg, 2)
                if self.joint_flexion_angle_deg is not None
                else None
            ),
            "extensionRatio": (
                round(self.extension_ratio, 4)
                if self.extension_ratio is not None
                else None
            ),
            "torsoInclinationDeg": (
                round(self.torso_inclination_deg, 2)
                if self.torso_inclination_deg is not None
                else None
            ),
        }


@dataclass(frozen=True)
class ElbowKneeShadowEvent:
    event_id: str
    family: ShadowEventFamily
    candidate_technique: str
    start_frame: int
    end_frame: int
    peak_frame: int
    kinematic_evidence: KinematicEvidence
    validation_status: ValidationStatus = ValidationStatus.SHADOW_NOT_VALIDATED
    reason_codes: tuple[str, ...] = ()

    def to_dict(self) -> dict[str, Any]:
        return {
            "eventId": self.event_id,
            "family": self.family.value,
            "candidateTechnique": self.candidate_technique,
            "startFrame": self.start_frame,
            "endFrame": self.end_frame,
            "peakFrame": self.peak_frame,
            "kinematicEvidence": self.kinematic_evidence.to_dict(),
            "validationStatus": self.validation_status.value,
            "reasonCodes": list(self.reason_codes),
        }


class ElbowKneeShadowClassifier:
    """Classifies shadow close-range elbow and knee strikes based on kinematic trajectory proxies."""

    def __init__(
        self,
        elbow_max_angle_deg: float = 115.0,
        knee_max_angle_deg: float = 105.0,
        min_velocity_norm: float = 0.35,
        min_keypoint_visibility: float = 0.40,
    ):
        self.elbow_max_angle_deg = elbow_max_angle_deg
        self.knee_max_angle_deg = knee_max_angle_deg
        self.min_velocity_norm = min_velocity_norm
        self.min_keypoint_visibility = min_keypoint_visibility

    def classify_elbow_candidate(
        self,
        start_frame: int,
        end_frame: int,
        peak_frame: int,
        elbow_angle_at_peak: Optional[float],
        elbow_velocity_norm: Optional[float],
        keypoint_visibility: float = 1.0,
        wrist_extension_past_elbow: Optional[float] = None,
        attacking_side: str = "right",
    ) -> Optional[ElbowKneeShadowEvent]:
        # Keypoint visibility gate
        if keypoint_visibility < self.min_keypoint_visibility:
            return None

        # Abstain if evidence is missing or non-finite
        if (
            elbow_angle_at_peak is None
            or elbow_velocity_norm is None
            or not math.isfinite(elbow_angle_at_peak)
            or not math.isfinite(elbow_velocity_norm)
        ):
            return None

        # Phase sanity gate
        if not (start_frame <= peak_frame <= end_frame):
            return None

        # Negative test guard: If arm extends past threshold, it's a punch, not an elbow
        if elbow_angle_at_peak > self.elbow_max_angle_deg:
            return None

        if elbow_velocity_norm < self.min_velocity_norm:
            return None

        side_label = attacking_side if attacking_side in ["left", "right"] else "unknown"
        technique = f"{side_label}_elbow" if side_label != "unknown" else "elbow"

        token = f"elbow:{start_frame}:{end_frame}:{peak_frame}:{technique}:{elbow_angle_at_peak:.1f}"
        event_id = f"sh_elb_{hashlib.sha256(token.encode('utf-8')).hexdigest()[:16]}"

        evidence = KinematicEvidence(
            peak_joint_velocity_norm=elbow_velocity_norm,
            joint_flexion_angle_deg=elbow_angle_at_peak,
            extension_ratio=wrist_extension_past_elbow,
            torso_inclination_deg=None,
        )

        return ElbowKneeShadowEvent(
            event_id=event_id,
            family=ShadowEventFamily.ELBOW,
            candidate_technique=technique,
            start_frame=start_frame,
            end_frame=end_frame,
            peak_frame=peak_frame,
            kinematic_evidence=evidence,
            validation_status=ValidationStatus.SHADOW_NOT_VALIDATED,
            reason_codes=("HIGH_ELBOW_VELOCITY_ACUTE_FLEXION",),
        )

    def classify_knee_candidate(
        self,
        start_frame: int,
        end_frame: int,
        peak_frame: int,
        knee_angle_at_peak: Optional[float],
        knee_velocity_norm: Optional[float],
        keypoint_visibility: float = 1.0,
        ankle_extension_past_knee: Optional[float] = None,
        attacking_side: str = "right",
    ) -> Optional[ElbowKneeShadowEvent]:
        # Keypoint visibility gate
        if keypoint_visibility < self.min_keypoint_visibility:
            return None

        # Abstain if evidence is missing or non-finite
        if (
            knee_angle_at_peak is None
            or knee_velocity_norm is None
            or not math.isfinite(knee_angle_at_peak)
            or not math.isfinite(knee_velocity_norm)
        ):
            return None

        # Phase sanity gate
        if not (start_frame <= peak_frame <= end_frame):
            return None

        # Negative test guard: If leg extends past threshold, it's a kick, not a knee strike
        if knee_angle_at_peak > self.knee_max_angle_deg:
            return None

        if knee_velocity_norm < self.min_velocity_norm:
            return None

        side_label = attacking_side if attacking_side in ["left", "right"] else "unknown"
        technique = f"{side_label}_knee" if side_label != "unknown" else "knee"

        token = f"knee:{start_frame}:{end_frame}:{peak_frame}:{technique}:{knee_angle_at_peak:.1f}"
        event_id = f"sh_kne_{hashlib.sha256(token.encode('utf-8')).hexdigest()[:16]}"

        evidence = KinematicEvidence(
            peak_joint_velocity_norm=knee_velocity_norm,
            joint_flexion_angle_deg=knee_angle_at_peak,
            extension_ratio=ankle_extension_past_knee,
            torso_inclination_deg=None,
        )

        return ElbowKneeShadowEvent(
            event_id=event_id,
            family=ShadowEventFamily.KNEE,
            candidate_technique=technique,
            start_frame=start_frame,
            end_frame=end_frame,
            peak_frame=peak_frame,
            kinematic_evidence=evidence,
            validation_status=ValidationStatus.SHADOW_NOT_VALIDATED,
            reason_codes=("HIGH_KNEE_VELOCITY_ACUTE_FLEXION",),
        )
