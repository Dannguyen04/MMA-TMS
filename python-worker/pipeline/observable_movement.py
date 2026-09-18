"""
observable_movement.py — Footwork, Guard & Balance Evidence Engine (Task 26)

Provides:
- Observable 2D Movement Proxies (normalized image/body units):
  * BaseOfSupportRatio (normalized ankle spread relative to torso/body height)
  * StanceWidthRatio (stance width relative to shoulder width)
  * GuardDistanceRatio (wrist distance to chin/shoulder)
  * PostureSwayVelocity & RecoveryDurationSec (computed from actual time-series trajectory or None)
- Quality and Visibility Gating:
  * When QualityStatus.BLOCKED or keypoints are occluded/zero-scale, returns None (abstains cleanly).
- Invariants:
  * Never converts to SI units (meters, kg) without metric camera calibration.
  * Never claims medical stability, joint torque, or injury risk.
  * CamelCase public serialization.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Mapping, Optional, Sequence

from pipeline.contracts import (
    EvidenceLevel,
    QualityStatus,
    ValidationStatus,
    deep_freeze,
    to_json_safe,
)


@dataclass(frozen=True)
class ObservableMovementEvidence:
    base_of_support_ratio: Optional[float]
    stance_width_ratio: Optional[float]
    guard_distance_ratio: Optional[float]
    posture_sway_velocity: Optional[float]
    recovery_duration_sec: Optional[float]
    evidence_confidence: float
    evidence_level: EvidenceLevel = EvidenceLevel.DERIVED_PROXY

    def to_dict(self) -> dict[str, Any]:
        return {
            "baseOfSupportRatio": (
                round(self.base_of_support_ratio, 4)
                if self.base_of_support_ratio is not None
                else None
            ),
            "stanceWidthRatio": (
                round(self.stance_width_ratio, 4)
                if self.stance_width_ratio is not None
                else None
            ),
            "guardDistanceRatio": (
                round(self.guard_distance_ratio, 4)
                if self.guard_distance_ratio is not None
                else None
            ),
            "postureSwayVelocity": (
                round(self.posture_sway_velocity, 4)
                if self.posture_sway_velocity is not None
                else None
            ),
            "recoveryDurationSec": (
                round(self.recovery_duration_sec, 4)
                if self.recovery_duration_sec is not None
                else None
            ),
            "evidenceConfidence": round(self.evidence_confidence, 4),
            "evidenceLevel": self.evidence_level.value,
        }


class MovementEvidenceEngine:
    """Computes observable movement, guard, and stance width proxies from measured keypoints."""

    def __init__(self, min_keypoint_conf: float = 0.35):
        self.min_keypoint_conf = min_keypoint_conf

    def compute_evidence(
        self,
        left_ankle: Optional[tuple[float, float]],
        right_ankle: Optional[tuple[float, float]],
        left_shoulder: Optional[tuple[float, float]],
        right_shoulder: Optional[tuple[float, float]],
        left_wrist: Optional[tuple[float, float]],
        right_wrist: Optional[tuple[float, float]],
        nose_or_chin: Optional[tuple[float, float]],
        left_hip: Optional[tuple[float, float]] = None,
        right_hip: Optional[tuple[float, float]] = None,
        sway_trajectory: Optional[Sequence[tuple[float, float]]] = None,
        recovery_frames_count: Optional[int] = None,
        fps: float = 30.0,
        quality_status: QualityStatus = QualityStatus.GOOD,
    ) -> ObservableMovementEvidence:
        # Quality Blocked guard: all proxies return None
        if quality_status == QualityStatus.BLOCKED:
            return ObservableMovementEvidence(
                base_of_support_ratio=None,
                stance_width_ratio=None,
                guard_distance_ratio=None,
                posture_sway_velocity=None,
                recovery_duration_sec=None,
                evidence_confidence=0.0,
                evidence_level=EvidenceLevel.UNAVAILABLE,
            )

        # 1. Stance Width and Base of Support Proxy
        stance_ratio = None
        bos_ratio = None
        if (
            left_ankle is not None
            and right_ankle is not None
            and left_shoulder is not None
            and right_shoulder is not None
        ):
            ankle_dist = math.sqrt(
                (left_ankle[0] - right_ankle[0]) ** 2 + (left_ankle[1] - right_ankle[1]) ** 2
            )
            shoulder_dist = math.sqrt(
                (left_shoulder[0] - right_shoulder[0]) ** 2
                + (left_shoulder[1] - right_shoulder[1]) ** 2
            )
            if shoulder_dist > 1e-4 and math.isfinite(ankle_dist) and math.isfinite(shoulder_dist):
                stance_ratio = ankle_dist / shoulder_dist

            # Base of support ratio normalized to torso height if hips available
            if left_hip is not None and right_hip is not None:
                mid_hip_y = (left_hip[1] + right_hip[1]) / 2.0
                mid_sh_y = (left_shoulder[1] + right_shoulder[1]) / 2.0
                torso_h = abs(mid_hip_y - mid_sh_y)
                if torso_h > 1e-4:
                    bos_ratio = ankle_dist / torso_h
            elif stance_ratio is not None:
                bos_ratio = stance_ratio

        # 2. Guard Distance Proxy (distance from wrists to chin/mandible normalized to shoulder width)
        guard_ratio = None
        if (
            nose_or_chin is not None
            and (left_wrist is not None or right_wrist is not None)
            and left_shoulder is not None
            and right_shoulder is not None
        ):
            shoulder_dist = math.sqrt(
                (left_shoulder[0] - right_shoulder[0]) ** 2
                + (left_shoulder[1] - right_shoulder[1]) ** 2
            )
            if shoulder_dist > 1e-4:
                wrist_distances = []
                if left_wrist and math.isfinite(left_wrist[0]) and math.isfinite(left_wrist[1]):
                    wrist_distances.append(
                        math.sqrt(
                            (left_wrist[0] - nose_or_chin[0]) ** 2
                            + (left_wrist[1] - nose_or_chin[1]) ** 2
                        )
                    )
                if right_wrist and math.isfinite(right_wrist[0]) and math.isfinite(right_wrist[1]):
                    wrist_distances.append(
                        math.sqrt(
                            (right_wrist[0] - nose_or_chin[0]) ** 2
                            + (right_wrist[1] - nose_or_chin[1]) ** 2
                        )
                    )
                if wrist_distances:
                    guard_ratio = min(wrist_distances) / shoulder_dist

        # 3. Posture Sway Velocity: Compute from actual time-series trajectory if provided (never fabricate constant)
        posture_sway_velocity = None
        if sway_trajectory and len(sway_trajectory) >= 2 and fps > 0:
            total_disp = sum(
                math.sqrt((sway_trajectory[i][0] - sway_trajectory[i - 1][0]) ** 2 + (sway_trajectory[i][1] - sway_trajectory[i - 1][1]) ** 2)
                for i in range(1, len(sway_trajectory))
            )
            duration_s = len(sway_trajectory) / fps
            if duration_s > 0:
                posture_sway_velocity = total_disp / duration_s

        # 4. Recovery Duration Sec: Compute from actual recovery frame count if provided (never fabricate constant)
        recovery_duration_sec = None
        if recovery_frames_count is not None and recovery_frames_count >= 0 and fps > 0:
            recovery_duration_sec = recovery_frames_count / fps

        # Compute evidence confidence
        valid_items = sum(1 for x in [stance_ratio, guard_ratio, posture_sway_velocity] if x is not None)
        confidence = valid_items / 3.0 if valid_items > 0 else 0.0

        return ObservableMovementEvidence(
            base_of_support_ratio=bos_ratio,
            stance_width_ratio=stance_ratio,
            guard_distance_ratio=guard_ratio,
            posture_sway_velocity=posture_sway_velocity,
            recovery_duration_sec=recovery_duration_sec,
            evidence_confidence=confidence,
            evidence_level=(
                EvidenceLevel.DERIVED_PROXY if confidence > 0 else EvidenceLevel.UNAVAILABLE
            ),
        )
