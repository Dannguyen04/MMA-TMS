"""
ghost_alignment.py — Temporal Alignment & Ghost Difference Engine (Task 30 & TL-07)

Provides:
- Dynamic Time Warping (DTW) alignment between athlete action and reference motion.
- Window-bounded DTW (Sakoe-Chiba band) with O(N * W) complexity guard.
- Strict Gating:
  * Quality Gating: Abstains with AlignmentStatus.QUALITY_BLOCKED under blocked quality.
  * Camera Gating: Distinct reference and athlete camera metadata with alias normalization;
    abstains with AlignmentStatus.CAMERA_MISMATCH on angle divergence.
  * Stance Gating: Abstains with AlignmentStatus.STANCE_MISMATCH on missing or mismatched stance.
  * Technique Gating: Abstains with AlignmentStatus.TECHNIQUE_MISMATCH on incompatible technique.
  * Timebase / FPS Gating: Abstains with AlignmentStatus.TIMEBASE_MISMATCH on invalid/divergent timebase.
  * Schema & Truncation Gating: Abstains with AlignmentStatus.SCHEMA_MISMATCH or UNSTABLE_ALIGNMENT
    when keypoint schema diverges, frames are truncated, or valid frame count is insufficient.
- Trajectory spatial displacement, phase timing deltas in seconds, and explainable highlights.
- Invariants:
  * Trajectory comparison is strictly normalized 2D image-plane displacement.
  * No claims of 3D biomechanics, joint torque, or physical force.
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
from pipeline.personalized_baseline import (
    are_camera_views_compatible,
    normalize_camera_view,
    normalize_stance,
)
from pipeline.reference_normalization import ReferenceMotionManifest


BIOMECHANICS_DISCLAIMER = (
    "Trajectory comparisons reflect 2D image-plane normalized skeleton displacement "
    "and do not represent 3D physical force or medical biomechanical assessment."
)


@dataclass(frozen=True)
class GhostDifferenceExplanation:
    alignment_status: AlignmentStatus
    warp_distance: Optional[float]
    mean_trajectory_displacement_norm: Optional[float]
    warping_path_length: int
    phase_timing_deltas: Mapping[str, float]
    difference_highlights: tuple[str, ...]
    athlete_camera_view: Optional[str] = None
    reference_camera_view: Optional[str] = None
    athlete_stance: Optional[str] = None
    reference_stance: Optional[str] = None
    biomechanics_disclaimer: str = BIOMECHANICS_DISCLAIMER

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {
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
            "biomechanicsDisclaimer": self.biomechanics_disclaimer,
        }
        if self.athlete_camera_view is not None:
            d["athleteCameraView"] = self.athlete_camera_view
        if self.reference_camera_view is not None:
            d["referenceCameraView"] = self.reference_camera_view
        if self.athlete_stance is not None:
            d["athleteStance"] = self.athlete_stance
        if self.reference_stance is not None:
            d["referenceStance"] = self.reference_stance
        return d


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
        camera_compatible: Optional[bool] = None,
        *,
        athlete_camera_view: Optional[str] = None,
        reference_camera_view: Optional[str] = None,
        athlete_stance: Optional[str] = None,
        athlete_technique: Optional[str] = None,
        keypoint_schema: Optional[str] = None,
        min_valid_frames: int = 3,
    ) -> GhostDifferenceExplanation:
        ref_camera = reference_camera_view or reference_manifest.camera_view

        # 1. Quality Gate
        if quality_status == QualityStatus.BLOCKED:
            return GhostDifferenceExplanation(
                alignment_status=AlignmentStatus.QUALITY_BLOCKED,
                warp_distance=None,
                mean_trajectory_displacement_norm=None,
                warping_path_length=0,
                phase_timing_deltas={},
                difference_highlights=("ALIGNMENT_ABSTAINED_DUE_TO_BLOCKED_QUALITY",),
                athlete_camera_view=athlete_camera_view,
                reference_camera_view=ref_camera,
                athlete_stance=athlete_stance,
                reference_stance=reference_manifest.stance,
            )

        # 2. Technique Compatibility Gate
        if athlete_technique is not None:
            if reference_manifest.technique and athlete_technique != reference_manifest.technique:
                return GhostDifferenceExplanation(
                    alignment_status=AlignmentStatus.TECHNIQUE_MISMATCH,
                    warp_distance=None,
                    mean_trajectory_displacement_norm=None,
                    warping_path_length=0,
                    phase_timing_deltas={},
                    difference_highlights=(
                        f"Technique mismatch: athlete technique '{athlete_technique}' "
                        f"does not match reference technique '{reference_manifest.technique}'.",
                    ),
                    athlete_camera_view=athlete_camera_view,
                    reference_camera_view=ref_camera,
                    athlete_stance=athlete_stance,
                    reference_stance=reference_manifest.stance,
                )

        # 3. Explicit Stance Compatibility Gate
        if athlete_stance is not None:
            norm_ath_stance = normalize_stance(athlete_stance)
            norm_ref_stance = normalize_stance(reference_manifest.stance)
            if norm_ath_stance is None:
                return GhostDifferenceExplanation(
                    alignment_status=AlignmentStatus.STANCE_MISMATCH,
                    warp_distance=None,
                    mean_trajectory_displacement_norm=None,
                    warping_path_length=0,
                    phase_timing_deltas={},
                    difference_highlights=(
                        f"Athlete stance '{athlete_stance}' is invalid or missing explicit stance ('orthodox'/'southpaw').",
                    ),
                    athlete_camera_view=athlete_camera_view,
                    reference_camera_view=ref_camera,
                    athlete_stance=athlete_stance,
                    reference_stance=reference_manifest.stance,
                )
            if norm_ref_stance is not None and norm_ath_stance != norm_ref_stance:
                return GhostDifferenceExplanation(
                    alignment_status=AlignmentStatus.STANCE_MISMATCH,
                    warp_distance=None,
                    mean_trajectory_displacement_norm=None,
                    warping_path_length=0,
                    phase_timing_deltas={},
                    difference_highlights=(
                        f"Stance mismatch: athlete stance '{athlete_stance}' "
                        f"does not match reference stance '{reference_manifest.stance}'.",
                    ),
                    athlete_camera_view=athlete_camera_view,
                    reference_camera_view=ref_camera,
                    athlete_stance=athlete_stance,
                    reference_stance=reference_manifest.stance,
                )

        # 4. Camera Compatibility Gate
        if camera_compatible is False:
            return GhostDifferenceExplanation(
                alignment_status=AlignmentStatus.CAMERA_MISMATCH,
                warp_distance=None,
                mean_trajectory_displacement_norm=None,
                warping_path_length=0,
                phase_timing_deltas={},
                difference_highlights=("ALIGNMENT_ABSTAINED_DUE_TO_CAMERA_MISMATCH",),
                athlete_camera_view=athlete_camera_view,
                reference_camera_view=ref_camera,
                athlete_stance=athlete_stance,
                reference_stance=reference_manifest.stance,
            )

        if athlete_camera_view is not None:
            if not are_camera_views_compatible(athlete_camera_view, ref_camera):
                return GhostDifferenceExplanation(
                    alignment_status=AlignmentStatus.CAMERA_MISMATCH,
                    warp_distance=None,
                    mean_trajectory_displacement_norm=None,
                    warping_path_length=0,
                    phase_timing_deltas={},
                    difference_highlights=(
                        f"Camera view mismatch: athlete camera '{athlete_camera_view}' "
                        f"is incompatible with reference camera '{ref_camera}'.",
                    ),
                    athlete_camera_view=athlete_camera_view,
                    reference_camera_view=ref_camera,
                    athlete_stance=athlete_stance,
                    reference_stance=reference_manifest.stance,
                )

        # 5. Timebase / FPS Gate
        if athlete_fps <= 0 or reference_manifest.fps <= 0:
            return GhostDifferenceExplanation(
                alignment_status=AlignmentStatus.TIMEBASE_MISMATCH,
                warp_distance=None,
                mean_trajectory_displacement_norm=None,
                warping_path_length=0,
                phase_timing_deltas={},
                difference_highlights=("Invalid zero or negative FPS timebase.",),
                athlete_camera_view=athlete_camera_view,
                reference_camera_view=ref_camera,
                athlete_stance=athlete_stance,
                reference_stance=reference_manifest.stance,
            )

        fps_ratio = athlete_fps / reference_manifest.fps
        if fps_ratio < 0.25 or fps_ratio > 4.0:
            return GhostDifferenceExplanation(
                alignment_status=AlignmentStatus.TIMEBASE_MISMATCH,
                warp_distance=None,
                mean_trajectory_displacement_norm=None,
                warping_path_length=0,
                phase_timing_deltas={},
                difference_highlights=(
                    f"Timebase divergence: athlete FPS ({athlete_fps}) vs reference FPS "
                    f"({reference_manifest.fps}) exceeds 4x bounds.",
                ),
                athlete_camera_view=athlete_camera_view,
                reference_camera_view=ref_camera,
                athlete_stance=athlete_stance,
                reference_stance=reference_manifest.stance,
            )

        # 6. Keypoint Schema Gate
        if keypoint_schema is not None:
            expected_kps = 17 if keypoint_schema == "yolo_17" else None
            if expected_kps is not None:
                for f in athlete_normalized_frames:
                    if len(f) > 0 and len(f) != expected_kps:
                        return GhostDifferenceExplanation(
                            alignment_status=AlignmentStatus.SCHEMA_MISMATCH,
                            warp_distance=None,
                            mean_trajectory_displacement_norm=None,
                            warping_path_length=0,
                            phase_timing_deltas={},
                            difference_highlights=(
                                f"Keypoint schema mismatch: expected {expected_kps} keypoints "
                                f"for {keypoint_schema}, got {len(f)}.",
                            ),
                            athlete_camera_view=athlete_camera_view,
                            reference_camera_view=ref_camera,
                            athlete_stance=athlete_stance,
                            reference_stance=reference_manifest.stance,
                        )

        # 7. Valid Frame Count & Bounds
        n = len(athlete_normalized_frames)
        m = len(reference_manifest.normalized_frames)

        if n < min_valid_frames or m < min_valid_frames or n > self.max_allowed_frames or m > self.max_allowed_frames:
            return GhostDifferenceExplanation(
                alignment_status=AlignmentStatus.UNSTABLE_ALIGNMENT,
                warp_distance=None,
                mean_trajectory_displacement_norm=None,
                warping_path_length=0,
                phase_timing_deltas={},
                difference_highlights=(
                    f"Trajectory length out of bounds or insufficient valid frames "
                    f"(athlete: {n}, reference: {m}, required >= {min_valid_frames}).",
                ),
                athlete_camera_view=athlete_camera_view,
                reference_camera_view=ref_camera,
                athlete_stance=athlete_stance,
                reference_stance=reference_manifest.stance,
            )

        # 8. Dynamic Time Warping (DTW) with Sakoe-Chiba window
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
                    # Missing or non-finite frame keypoint data
                    return GhostDifferenceExplanation(
                        alignment_status=AlignmentStatus.UNSTABLE_ALIGNMENT,
                        warp_distance=None,
                        mean_trajectory_displacement_norm=None,
                        warping_path_length=0,
                        phase_timing_deltas={},
                        difference_highlights=("INVALID_OR_MISSING_KEYPOINTS_IN_ALIGNMENT",),
                        athlete_camera_view=athlete_camera_view,
                        reference_camera_view=ref_camera,
                        athlete_stance=athlete_stance,
                        reference_stance=reference_manifest.stance,
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
                athlete_camera_view=athlete_camera_view,
                reference_camera_view=ref_camera,
                athlete_stance=athlete_stance,
                reference_stance=reference_manifest.stance,
            )

        # 9. Backtrack Warping Path
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

        # 10. Timing Differences in Seconds
        ath_duration_s = n / athlete_fps
        ref_duration_s = m / reference_manifest.fps
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
            athlete_camera_view=athlete_camera_view,
            reference_camera_view=ref_camera,
            athlete_stance=athlete_stance,
            reference_stance=reference_manifest.stance,
        )
