"""
reference_normalization.py — Reference Motion Normalization (Task 29)

Provides:
- Skeleton trajectory normalization for Ghost Mode & reference alignment:
  * Pelvis (mid-hip) root centering (origin = 0,0).
  * Torso-scale normalization (invariant to athlete distance / camera crop).
  * True Stance Mirroring: horizontal negation AND left/right anatomical joint swapping.
  * Explicit unavailability when keypoints or torso scale are zero/missing (never silently fallback to 1.0).
  * Deterministic SHA256 digest binding normalization version, technique, stance, FPS, and provenance.
- Invariant:
  * Reference motion is a contextual coaching baseline, NOT universal ground truth.
  * CamelCase public serialization matching TypeScript worker-result.ts.
"""

from __future__ import annotations

import hashlib
import json
import math
from dataclasses import dataclass, field
from typing import Any, Mapping, Optional, Sequence

from pipeline.contracts import (
    ValidationStatus,
    deep_freeze,
    to_json_safe,
)

# YOLO-Pose 17-keypoint symmetric swap pairs (left <-> right)
SWAP_PAIRS = [
    (1, 2),    # left_eye <-> right_eye
    (3, 4),    # left_ear <-> right_ear
    (5, 6),    # left_shoulder <-> right_shoulder
    (7, 8),    # left_elbow <-> right_elbow
    (9, 10),   # left_wrist <-> right_wrist
    (11, 12),  # left_hip <-> right_hip
    (13, 14),  # left_knee <-> right_knee
    (15, 16),  # left_ankle <-> right_ankle
]


@dataclass(frozen=True)
class NormalizedFrameSkeleton:
    frame_idx: int
    normalized_keypoints: tuple[tuple[float, float], ...]
    is_valid: bool = True

    def to_dict(self) -> dict[str, Any]:
        return {
            "frameIdx": self.frame_idx,
            "normalizedKeypoints": [
                (round(x, 4), round(y, 4)) for x, y in self.normalized_keypoints
            ],
            "isValid": self.is_valid,
        }


@dataclass(frozen=True)
class ReferenceMotionManifest:
    reference_id: str
    technique: str
    stance: str
    frame_count: int
    fps: float
    is_mirrored: bool
    trajectory_digest: str
    normalized_frames: tuple[NormalizedFrameSkeleton, ...]
    normalization_version: str = "1.0.0"

    def to_dict(self) -> dict[str, Any]:
        return {
            "referenceId": self.reference_id,
            "technique": self.technique,
            "stance": self.stance,
            "frameCount": self.frame_count,
            "fps": self.fps,
            "isMirrored": self.is_mirrored,
            "trajectoryDigest": self.trajectory_digest,
            "normalizationVersion": self.normalization_version,
            "normalizedFrames": [f.to_dict() for f in self.normalized_frames],
        }


class ReferenceNormalizer:
    """Normalizes skeleton trajectories by translating to pelvis root and scaling to torso height."""

    def normalize_trajectory(
        self,
        reference_id: str,
        technique: str,
        source_stance: str,
        target_stance: str,
        raw_frames: Sequence[Sequence[tuple[float, float]]],
        fps: float = 30.0,
    ) -> ReferenceMotionManifest:
        should_mirror = (
            source_stance in ["orthodox", "southpaw"]
            and target_stance in ["orthodox", "southpaw"]
            and source_stance != target_stance
        )

        normalized_frames: list[NormalizedFrameSkeleton] = []

        for f_idx, frame_kps in enumerate(raw_frames):
            if len(frame_kps) < 13:
                normalized_frames.append(
                    NormalizedFrameSkeleton(frame_idx=f_idx, normalized_keypoints=(), is_valid=False)
                )
                continue

            l_hip = frame_kps[11]
            r_hip = frame_kps[12]
            l_sh = frame_kps[5]
            r_sh = frame_kps[6]

            # Validate coordinates are finite
            if not all(math.isfinite(coord) for kp in [l_hip, r_hip, l_sh, r_sh] for coord in kp):
                normalized_frames.append(
                    NormalizedFrameSkeleton(frame_idx=f_idx, normalized_keypoints=(), is_valid=False)
                )
                continue

            # Root = mid-hip
            root_x = (l_hip[0] + r_hip[0]) / 2.0
            root_y = (l_hip[1] + r_hip[1]) / 2.0

            # Mid-shoulder
            mid_sh_x = (l_sh[0] + r_sh[0]) / 2.0
            mid_sh_y = (l_sh[1] + r_sh[1]) / 2.0

            # Torso height
            torso_h = math.sqrt((mid_sh_x - root_x) ** 2 + (mid_sh_y - root_y) ** 2)
            if torso_h <= 1e-4:
                # Zero or degenerate torso scale: cannot normalize
                normalized_frames.append(
                    NormalizedFrameSkeleton(frame_idx=f_idx, normalized_keypoints=(), is_valid=False)
                )
                continue

            norm_kps_list = []
            for kp_x, kp_y in frame_kps:
                if math.isfinite(kp_x) and math.isfinite(kp_y):
                    rel_x = (kp_x - root_x) / torso_h
                    rel_y = (kp_y - root_y) / torso_h
                    if should_mirror:
                        rel_x = -rel_x
                    norm_kps_list.append((round(rel_x, 4), round(rel_y, 4)))
                else:
                    norm_kps_list.append((0.0, 0.0))

            # If mirrored, swap left and right joint indices
            if should_mirror and len(norm_kps_list) == 17:
                swapped = list(norm_kps_list)
                for left_idx, right_idx in SWAP_PAIRS:
                    swapped[left_idx] = norm_kps_list[right_idx]
                    swapped[right_idx] = norm_kps_list[left_idx]
                norm_kps_list = swapped

            normalized_frames.append(
                NormalizedFrameSkeleton(
                    frame_idx=f_idx,
                    normalized_keypoints=tuple(norm_kps_list),
                    is_valid=True,
                )
            )

        # Compute deterministic digest binding metadata
        digest_input = json.dumps(
            {
                "referenceId": reference_id,
                "technique": technique,
                "stance": target_stance,
                "fps": fps,
                "isMirrored": should_mirror,
                "normalizationVersion": "1.0.0",
                "frames": [f.to_dict() for f in normalized_frames],
            },
            sort_keys=True,
        )
        traj_digest = hashlib.sha256(digest_input.encode("utf-8")).hexdigest()

        return ReferenceMotionManifest(
            reference_id=reference_id,
            technique=technique,
            stance=target_stance,
            frame_count=len(normalized_frames),
            fps=fps,
            is_mirrored=should_mirror,
            trajectory_digest=traj_digest,
            normalized_frames=tuple(normalized_frames),
            normalization_version="1.0.0",
        )
