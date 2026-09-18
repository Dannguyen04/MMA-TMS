"""
ghost_alignment.py — Temporal Alignment & Ghost Difference Engine (Task 30)

Provides:
- Dynamic Time Warping (DTW) alignment between athlete action and reference motion.
- Window-bounded DTW (Sakoe-Chiba band) with O(N * W) complexity guard.
- Trajectory spatial displacement, phase timing deltas in seconds, and explainable highlights.
- Quality and Camera Gating:
  * Abstains with AlignmentStatus.QUALITY_BLOCKED under blocked quality.
  * Abstains with AlignmentStatus.CAMERA_MISMATCH when camera angles diverge.
  * Abstains with AlignmentStatus.UNSTABLE_ALIGNMENT when frames/keypoints are missing or invalid.
- Invariants:
  * Deterministic execution.
  * CamelCase public serialization matching TypeScript worker-result.ts.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Mapping, Optional, Sequence

from pipeline.contracts import (
    AlignmentStatus,
    QualityStatus,
    ValidationStatus,
    deep_freeze,
    to_json_safe,
)
from pipeline.reference_normalization import ReferenceMotionManifest


@dataclass(frozen=True)
class GhostDifferenceExplanation:
    alignment_status: AlignmentStatus
    warp_distance: Optional[float]
    mean_trajectory_displacement_norm: Optional[float]
    warping_path_length: int
    phase_timing_deltas: Mapping[str, float]
    difference_highlights: tuple[str, ...]

    def to_dict(self) -> dict[str, Any]:
        return {
            "alignmentStatus": self.alignment_status.value,
            "warpDistance": (
                round(self.warp_distance, 4) if self.warp_distance is not None else None
            ),
            "meanTrajectoryDisplacementNorm": (
                round(self.mean_trajectory_displacement_norm, 4)
                if self.mean_trajectory_displacement_norm is not None
                else None
            ),
            "warpingPathLength": self.warping_path_length,
            "phaseTimingDeltas": {
                k: round(v, 4) for k, v in self.phase_timing_deltas.items()
            },
            "differenceHighlights": list(self.difference_highlights),
        }


def _euclidean_frame_distance(
    kps_a: Sequence[tuple[float, float]],
    kps_b: Sequence[tuple[float, float]],
) -> Optional[float]:
    if not kps_a or not kps_b or len(kps_a) != len(kps_b):
        return None
    for p in kps_a:
        if not math.isfinite(p[0]) or not math.isfinite(p[1]):
            return None
    for p in kps_b:
        if not math.isfinite(p[0]) or not math.isfinite(p[1]):
            return None

    n = len(kps_a)
    dist_sq = sum(
        (kps_a[i][0] - kps_b[i][0]) ** 2 + (kps_a[i][1] - kps_b[i][1]) ** 2
        for i in range(n)
    )
    return math.sqrt(dist_sq / n)


class GhostAlignmentEngine:
    """Performs DTW trajectory alignment and extracts explainable differences."""

    def __init__(self, max_allowed_frames: int = 600, window_size: int = 45):
        self.max_allowed_frames = max_allowed_frames
        self.window_size = window_size

    def align_and_explain(
        self,
        athlete_normalized_frames: Sequence[Sequence[tuple[float, float]]],
        reference_manifest: ReferenceMotionManifest,
        athlete_fps: float = 30.0,
        quality_status: QualityStatus = QualityStatus.GOOD,
        camera_compatible: bool = True,
    ) -> GhostDifferenceExplanation:
        # 1. Quality Gate
        if quality_status == QualityStatus.BLOCKED:
            return GhostDifferenceExplanation(
                alignment_status=AlignmentStatus.QUALITY_BLOCKED,
                warp_distance=None,
                mean_trajectory_displacement_norm=None,
                warping_path_length=0,
                phase_timing_deltas={},
                difference_highlights=("ALIGNMENT_ABSTAINED_DUE_TO_BLOCKED_QUALITY",),
            )

        # 2. Camera Gate
        if not camera_compatible:
            return GhostDifferenceExplanation(
                alignment_status=AlignmentStatus.CAMERA_MISMATCH,
                warp_distance=None,
                mean_trajectory_displacement_norm=None,
                warping_path_length=0,
                phase_timing_deltas={},
                difference_highlights=("ALIGNMENT_ABSTAINED_DUE_TO_CAMERA_MISMATCH",),
            )

        n = len(athlete_normalized_frames)
        m = len(reference_manifest.normalized_frames)

        if n == 0 or m == 0 or n > self.max_allowed_frames or m > self.max_allowed_frames:
            return GhostDifferenceExplanation(
                alignment_status=AlignmentStatus.UNSTABLE_ALIGNMENT,
                warp_distance=None,
                mean_trajectory_displacement_norm=None,
                warping_path_length=0,
                phase_timing_deltas={},
                difference_highlights=("TRAJECTORY_LENGTH_OUT_OF_BOUNDS_OR_EMPTY",),
            )

        # 3. Dynamic Time Warping (DTW) with Sakoe-Chiba window
        dtw_matrix = [[float("inf")] * (m + 1) for _ in range(n + 1)]
        dtw_matrix[0][0] = 0.0

        for i in range(1, n + 1):
            kps_ath = athlete_normalized_frames[i - 1]
            j_start = max(1, i - self.window_size)
            j_end = min(m, i + self.window_size)

            for j in range(j_start, j_end + 1):
                kps_ref = reference_manifest.normalized_frames[j - 1].normalized_keypoints
                cost = _euclidean_frame_distance(kps_ath, kps_ref)
                if cost is None:
                    # Missing/invalid frame keypoint data
                    return GhostDifferenceExplanation(
                        alignment_status=AlignmentStatus.UNSTABLE_ALIGNMENT,
                        warp_distance=None,
                        mean_trajectory_displacement_norm=None,
                        warping_path_length=0,
                        phase_timing_deltas={},
                        difference_highlights=("INVALID_OR_MISSING_KEYPOINTS_IN_ALIGNMENT",),
                    )

                dtw_matrix[i][j] = cost + min(
                    dtw_matrix[i - 1][j],
                    dtw_matrix[i][j - 1],
                    dtw_matrix[i - 1][j - 1],
                )

        if math.isinf(dtw_matrix[n][m]):
            return GhostDifferenceExplanation(
                alignment_status=AlignmentStatus.UNSTABLE_ALIGNMENT,
                warp_distance=None,
                mean_trajectory_displacement_norm=None,
                warping_path_length=0,
                phase_timing_deltas={},
                difference_highlights=("ALIGNMENT_PATH_DIVERGED_OUTSIDE_WINDOW",),
            )

        # 4. Backtrack warping path
        i, j = n, m
        path: list[tuple[int, int]] = []
        while i > 0 and j > 0:
            path.append((i - 1, j - 1))
            steps = [
                (dtw_matrix[i - 1][j - 1], i - 1, j - 1),
                (dtw_matrix[i - 1][j], i - 1, j),
                (dtw_matrix[i][j - 1], i, j - 1),
            ]
            _, i, j = min(steps, key=lambda x: x[0])

        path.reverse()
        total_cost = dtw_matrix[n][m]
        warp_distance = total_cost / max(1, len(path))

        # 5. Timing differences in seconds
        ath_duration_s = n / (athlete_fps if athlete_fps > 0 else 30.0)
        ref_duration_s = m / (reference_manifest.fps if reference_manifest.fps > 0 else 30.0)
        duration_diff_s = ath_duration_s - ref_duration_s

        highlights = []
        if abs(duration_diff_s) > 0.05:
            direction = "faster" if duration_diff_s < 0 else "slower"
            highlights.append(
                f"Athlete executed action {abs(duration_diff_s):.2f}s {direction} than reference baseline."
            )

        if warp_distance > 0.35:
            highlights.append("Observed spatial trajectory difference relative to reference form.")
        else:
            highlights.append("Trajectory conforms closely to reference baseline motion.")

        return GhostDifferenceExplanation(
            alignment_status=AlignmentStatus.ALIGNED,
            warp_distance=warp_distance,
            mean_trajectory_displacement_norm=warp_distance,
            warping_path_length=len(path),
            phase_timing_deltas={
                "durationDiffSec": float(duration_diff_s),
                "athleteDurationSec": float(ath_duration_s),
                "referenceDurationSec": float(ref_duration_s),
            },
            difference_highlights=tuple(highlights),
        )
