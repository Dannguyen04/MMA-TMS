"""
test_task30_ghost_alignment.py — Tests for Task 30 Ghost DTW Alignment
"""

import pytest
from pipeline.contracts import AlignmentStatus, QualityStatus
from pipeline.ghost_alignment import (
    GhostAlignmentEngine,
    GhostDifferenceExplanation,
)
from pipeline.reference_normalization import (
    NormalizedFrameSkeleton,
    ReferenceMotionManifest,
)


def _make_ref_manifest():
    # 3 frames of reference
    f0 = NormalizedFrameSkeleton(0, ((0.0, 0.0), (0.1, 0.2)))
    f1 = NormalizedFrameSkeleton(1, ((0.0, 0.0), (0.2, 0.3)))
    f2 = NormalizedFrameSkeleton(2, ((0.0, 0.0), (0.3, 0.4)))
    return ReferenceMotionManifest(
        reference_id="ref_test",
        technique="jab",
        stance="orthodox",
        frame_count=3,
        fps=30.0,
        is_mirrored=False,
        trajectory_digest="abc123digest",
        normalized_frames=(f0, f1, f2),
    )


def test_clean_dtw_alignment():
    engine = GhostAlignmentEngine()
    ref = _make_ref_manifest()
    # Athlete with slightly shifted 3 frames
    ath_frames = [
        ((0.0, 0.0), (0.12, 0.22)),
        ((0.0, 0.0), (0.22, 0.32)),
        ((0.0, 0.0), (0.32, 0.42)),
    ]
    expl = engine.align_and_explain(ath_frames, ref)
    assert expl.alignment_status == AlignmentStatus.ALIGNED
    assert expl.warp_distance is not None
    assert expl.warp_distance < 0.10
    assert expl.warping_path_length >= 3
    assert len(expl.difference_highlights) > 0


def test_quality_blocked_abstains():
    engine = GhostAlignmentEngine()
    ref = _make_ref_manifest()
    ath_frames = [((0.0, 0.0), (0.1, 0.2))]
    expl = engine.align_and_explain(ath_frames, ref, quality_status=QualityStatus.BLOCKED)
    assert expl.alignment_status == AlignmentStatus.QUALITY_BLOCKED
    assert expl.warp_distance is None


def test_camera_mismatch_abstains():
    engine = GhostAlignmentEngine()
    ref = _make_ref_manifest()
    ath_frames = [((0.0, 0.0), (0.1, 0.2))]
    expl = engine.align_and_explain(ath_frames, ref, camera_compatible=False)
    assert expl.alignment_status == AlignmentStatus.CAMERA_MISMATCH
    assert expl.warp_distance is None

