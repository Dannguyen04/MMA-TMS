"""
test_task29_reference_normalization.py — Tests for Task 29 Reference Motion Normalization
"""

import pytest
from pipeline.reference_normalization import (
    NormalizedFrameSkeleton,
    ReferenceMotionManifest,
    ReferenceNormalizer,
)


def _make_dummy_skeleton(mid_hip_y=0.6, mid_sh_y=0.3):
    # 17 keypoints matching YOLO-Pose structure
    kps = [(0.5, 0.2)] * 17
    kps[5] = (0.45, mid_sh_y)  # l_shoulder
    kps[6] = (0.55, mid_sh_y)  # r_shoulder
    kps[11] = (0.48, mid_hip_y)  # l_hip
    kps[12] = (0.52, mid_hip_y)  # r_hip
    # Right wrist extending out
    kps[10] = (0.80, 0.35)
    return kps


def test_root_centering_and_scaling():
    normalizer = ReferenceNormalizer()
    frame_0 = _make_dummy_skeleton()
    manifest = normalizer.normalize_trajectory(
        reference_id="ref_jab_orth",
        technique="jab",
        source_stance="orthodox",
        target_stance="orthodox",
        raw_frames=[frame_0],
    )
    assert manifest.is_mirrored is False
    assert manifest.frame_count == 1
    norm_kps = manifest.normalized_frames[0].normalized_keypoints
    # Mid-hip should be at (0, 0)
    mid_hip_x = (norm_kps[11][0] + norm_kps[12][0]) / 2.0
    mid_hip_y = (norm_kps[11][1] + norm_kps[12][1]) / 2.0
    assert pytest.approx(mid_hip_x, abs=1e-3) == 0.0
    assert pytest.approx(mid_hip_y, abs=1e-3) == 0.0


def test_stance_aware_mirroring():
    normalizer = ReferenceNormalizer()
    frame_0 = _make_dummy_skeleton()
    manifest = normalizer.normalize_trajectory(
        reference_id="ref_jab_orth",
        technique="jab",
        source_stance="orthodox",
        target_stance="southpaw",  # Target stance is southpaw -> must mirror!
        raw_frames=[frame_0],
    )
    assert manifest.is_mirrored is True
    assert manifest.stance == "southpaw"
    # Keypoint 10 (right wrist) was positive relative to root (0.80 - 0.50 = 0.30 > 0).
    # After mirror with SWAP_PAIRS, it swaps into keypoint 9 (left wrist) and becomes negative.
    left_wrist_x = manifest.normalized_frames[0].normalized_keypoints[9][0]
    assert left_wrist_x < 0.0


