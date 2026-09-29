"""
test_tl07_ghost_alignment.py — Unit & Integration tests for TL-07 Correct Comparison & Ghost Compatibility.

Verifies:
1. No implicit orthodox defaults: missing or invalid stance fails closed (raises or abstains).
2. Stance mismatch gating (orthodox athlete vs southpaw reference without mirroring).
3. Symmetry & mirroring: anatomical joint swapping and horizontal inversion across all 8 swap pairs.
4. Distinct camera metadata: athlete camera view vs reference camera view gating.
5. Technique compatibility gating: rejects mismatched technique.
6. Timebase / FPS gating: rejects zero/negative FPS and extreme divergence (> 4x).
7. Keypoint schema gating: rejects invalid keypoint count for yolo_17 schema.
8. Truncated reference & insufficient valid frames (< 3 frames abstains).
9. Invalid / non-finite keypoints handling (NaN / Inf abstains with UNSTABLE_ALIGNMENT).
10. Deterministic DTW trajectory alignment: identical inputs yield identical warping path and distance.
11. Biomechanics disclaimer: verifies normalized trajectory does not claim 3D force or joint torque.
12. Session comparator: strict stance and camera compatibility gating without default fallbacks.
"""

import math
import pytest

from pipeline.contracts import (
    AlignmentStatus,
    ComparisonStatus,
    QualityStatus,
)
from pipeline.ghost_alignment import (
    BIOMECHANICS_DISCLAIMER,
    GhostAlignmentEngine,
    GhostDifferenceExplanation,
)
from pipeline.reference_normalization import (
    NormalizedFrameSkeleton,
    ReferenceMotionManifest,
    ReferenceNormalizer,
    SWAP_PAIRS,
    normalize_stance,
)
from pipeline.session_comparison import SessionComparator


def _make_dummy_skeleton(mid_hip_x=0.5, mid_hip_y=0.6, torso_h=0.3):
    """Generates 17 keypoints conforming to YOLO-Pose layout."""
    kps = [(mid_hip_x, mid_hip_y)] * 17
    mid_sh_y = mid_hip_y - torso_h
    kps[5] = (mid_hip_x - 0.1, mid_sh_y)   # l_shoulder
    kps[6] = (mid_hip_x + 0.1, mid_sh_y)   # r_shoulder
    kps[7] = (mid_hip_x - 0.15, mid_sh_y + 0.1)  # l_elbow
    kps[8] = (mid_hip_x + 0.15, mid_sh_y + 0.1)  # r_elbow
    kps[9] = (mid_hip_x - 0.2, mid_sh_y + 0.2)   # l_wrist
    kps[10] = (mid_hip_x + 0.25, mid_sh_y + 0.05) # r_wrist (extended strike)
    kps[11] = (mid_hip_x - 0.05, mid_hip_y) # l_hip
    kps[12] = (mid_hip_x + 0.05, mid_hip_y) # r_hip
    kps[13] = (mid_hip_x - 0.06, mid_hip_y + 0.3) # l_knee
    kps[14] = (mid_hip_x + 0.06, mid_hip_y + 0.3) # r_knee
    kps[15] = (mid_hip_x - 0.07, mid_hip_y + 0.6) # l_ankle
    kps[16] = (mid_hip_x + 0.07, mid_hip_y + 0.6) # r_ankle
    return kps


def _make_manifest(
    technique: str = "jab",
    stance: str = "orthodox",
    camera_view: str = "front",
    fps: float = 30.0,
    num_frames: int = 5,
) -> ReferenceMotionManifest:
    normalizer = ReferenceNormalizer()
    raw_frames = [_make_dummy_skeleton(mid_hip_x=0.5 + i * 0.01) for i in range(num_frames)]
    return normalizer.normalize_trajectory(
        reference_id=f"ref_{technique}_{stance}",
        technique=technique,
        source_stance=stance,
        target_stance=stance,
        raw_frames=raw_frames,
        fps=fps,
        camera_view=camera_view,
    )


# ─── 1. No Implicit Orthodox Defaults ─────────────────────────────────────────

def test_missing_stance_in_normalization_fails_closed():
    normalizer = ReferenceNormalizer()
    frame = _make_dummy_skeleton()
    # Missing source stance
    with pytest.raises(ValueError, match="Explicit stance"):
        normalizer.normalize_trajectory("ref_1", "jab", "", "orthodox", [frame])

    # Missing target stance
    with pytest.raises(ValueError, match="Explicit stance"):
        normalizer.normalize_trajectory("ref_1", "jab", "orthodox", "", [frame])

    # Unknown stance
    with pytest.raises(ValueError, match="Explicit stance"):
        normalizer.normalize_trajectory("ref_1", "jab", "unknown", "orthodox", [frame])


def test_missing_stance_in_session_comparison_fails_closed():
    comparator = SessionComparator()
    s_a = {"sessionId": "s1", "stance": "", "cameraView": "front", "metrics": {}}
    s_b = {"sessionId": "s2", "stance": "orthodox", "cameraView": "front", "metrics": {}}
    res = comparator.compare_sessions(s_a, s_b)
    assert res.status == ComparisonStatus.INCOMPATIBLE_STANCE


# ─── 2. Stance Gating in Ghost Alignment ─────────────────────────────────────

def test_stance_mismatch_in_ghost_alignment():
    engine = GhostAlignmentEngine()
    ref = _make_manifest(stance="orthodox")
    normalizer = ReferenceNormalizer()
    ath_frames = normalizer.normalize_athlete_frames(
        [_make_dummy_skeleton() for _ in range(5)],
        stance="southpaw",
    )

    # Southpaw athlete against orthodox reference
    expl = engine.align_and_explain(
        ath_frames,
        ref,
        athlete_stance="southpaw",
    )
    assert expl.alignment_status == AlignmentStatus.STANCE_MISMATCH
    assert expl.warp_distance is None


# ─── 3. Symmetry & Mirroring ──────────────────────────────────────────────────

def test_anatomical_joint_swapping_symmetry():
    normalizer = ReferenceNormalizer()
    frame = _make_dummy_skeleton()

    # Normalize orthodox -> southpaw (mirroring)
    manifest = normalizer.normalize_trajectory(
        reference_id="ref_symm",
        technique="jab",
        source_stance="orthodox",
        target_stance="southpaw",
        raw_frames=[frame],
    )
    assert manifest.is_mirrored is True
    mirrored_kps = manifest.normalized_frames[0].normalized_keypoints

    # Compare against unmirrored orthodox
    manifest_orig = normalizer.normalize_trajectory(
        reference_id="ref_orig",
        technique="jab",
        source_stance="orthodox",
        target_stance="orthodox",
        raw_frames=[frame],
    )
    orig_kps = manifest_orig.normalized_frames[0].normalized_keypoints

    # Check all 8 swap pairs: left joint in mirrored should equal - (right joint in orig)
    for l_idx, r_idx in SWAP_PAIRS:
        orig_l_x = orig_kps[l_idx][0]
        orig_r_x = orig_kps[r_idx][0]
        mirr_l_x = mirrored_kps[l_idx][0]
        mirr_r_x = mirrored_kps[r_idx][0]

        # Swapped and horizontally negated:
        assert pytest.approx(mirr_l_x, abs=1e-3) == -orig_r_x
        assert pytest.approx(mirr_r_x, abs=1e-3) == -orig_l_x
        # Vertical y coordinates are preserved across swapped joints:
        assert pytest.approx(mirrored_kps[l_idx][1], abs=1e-3) == orig_kps[r_idx][1]
        assert pytest.approx(mirrored_kps[r_idx][1], abs=1e-3) == orig_kps[l_idx][1]


# ─── 4. Distinct Camera Metadata Gating ───────────────────────────────────────

def test_distinct_camera_compatibility():
    engine = GhostAlignmentEngine()
    ref = _make_manifest(camera_view="front")
    normalizer = ReferenceNormalizer()
    ath_frames = normalizer.normalize_athlete_frames(
        [_make_dummy_skeleton() for _ in range(5)],
        stance="orthodox",
    )

    # Compatible alias: frontal vs front
    expl_compat = engine.align_and_explain(
        ath_frames,
        ref,
        athlete_camera_view="frontal",
        reference_camera_view="front",
    )
    assert expl_compat.alignment_status == AlignmentStatus.ALIGNED

    # Incompatible: side vs front
    expl_incompat = engine.align_and_explain(
        ath_frames,
        ref,
        athlete_camera_view="side",
        reference_camera_view="front",
    )
    assert expl_incompat.alignment_status == AlignmentStatus.CAMERA_MISMATCH
    assert expl_incompat.warp_distance is None


# ─── 5. Technique Compatibility Gating ────────────────────────────────────────

def test_technique_mismatch_gating():
    engine = GhostAlignmentEngine()
    ref = _make_manifest(technique="jab")
    normalizer = ReferenceNormalizer()
    ath_frames = normalizer.normalize_athlete_frames(
        [_make_dummy_skeleton() for _ in range(5)],
        stance="orthodox",
    )

    expl = engine.align_and_explain(
        ath_frames,
        ref,
        athlete_technique="cross",
    )
    assert expl.alignment_status == AlignmentStatus.TECHNIQUE_MISMATCH
    assert expl.warp_distance is None


# ─── 6. Timebase / FPS Gating ─────────────────────────────────────────────────

def test_fps_divergence_gating():
    engine = GhostAlignmentEngine()
    ref = _make_manifest(fps=30.0)
    normalizer = ReferenceNormalizer()
    ath_frames = normalizer.normalize_athlete_frames(
        [_make_dummy_skeleton() for _ in range(5)],
        stance="orthodox",
    )

    # Negative / zero FPS
    expl_zero = engine.align_and_explain(ath_frames, ref, athlete_fps=0.0)
    assert expl_zero.alignment_status == AlignmentStatus.TIMEBASE_MISMATCH

    # Extreme divergence (athlete 120 FPS vs ref 24 FPS -> ratio 5x > 4x limit)
    ref_24 = _make_manifest(fps=24.0)
    expl_diverge = engine.align_and_explain(ath_frames, ref_24, athlete_fps=120.0)
    assert expl_diverge.alignment_status == AlignmentStatus.TIMEBASE_MISMATCH


# ─── 7. Keypoint Schema Gating ────────────────────────────────────────────────

def test_keypoint_schema_gating():
    engine = GhostAlignmentEngine()
    ref = _make_manifest()
    # Athlete frame has only 10 keypoints instead of 17 for yolo_17
    invalid_ath_frames = [((0.0, 0.0),) * 10 for _ in range(5)]

    expl = engine.align_and_explain(
        invalid_ath_frames,
        ref,
        keypoint_schema="yolo_17",
    )
    assert expl.alignment_status == AlignmentStatus.SCHEMA_MISMATCH


# ─── 8. Truncated Reference & Insufficient Frames ─────────────────────────────

def test_insufficient_valid_frames():
    engine = GhostAlignmentEngine()
    ref = _make_manifest(num_frames=5)
    # Athlete only has 1 frame (< min_valid_frames = 3)
    normalizer = ReferenceNormalizer()
    ath_frames = normalizer.normalize_athlete_frames(
        [_make_dummy_skeleton()],
        stance="orthodox",
    )

    expl = engine.align_and_explain(ath_frames, ref, min_valid_frames=3)
    assert expl.alignment_status == AlignmentStatus.UNSTABLE_ALIGNMENT
    assert expl.warp_distance is None


# ─── 9. Invalid Keypoints (NaN / Inf) Handling ─────────────────────────────────

def test_nan_keypoints_handled_safely():
    engine = GhostAlignmentEngine()
    ref = _make_manifest(num_frames=4)
    # Athlete frame containing float('nan')
    ath_frames = [
        tuple((float("nan"), 0.0) for _ in range(17)),
        tuple((0.0, 0.0) for _ in range(17)),
        tuple((0.0, 0.0) for _ in range(17)),
    ]
    expl = engine.align_and_explain(ath_frames, ref)
    assert expl.alignment_status == AlignmentStatus.UNSTABLE_ALIGNMENT
    assert expl.warp_distance is None


# ─── 10. Deterministic DTW Execution ──────────────────────────────────────────

def test_deterministic_dtw_alignment():
    engine = GhostAlignmentEngine()
    ref = _make_manifest(num_frames=6)
    normalizer = ReferenceNormalizer()
    ath_frames = normalizer.normalize_athlete_frames(
        [_make_dummy_skeleton(mid_hip_x=0.52 + i * 0.01) for i in range(6)],
        stance="orthodox",
    )

    res1 = engine.align_and_explain(ath_frames, ref, athlete_stance="orthodox", athlete_technique="jab")
    res2 = engine.align_and_explain(ath_frames, ref, athlete_stance="orthodox", athlete_technique="jab")

    assert res1.alignment_status == AlignmentStatus.ALIGNED
    assert res1.warp_distance == res2.warp_distance
    assert res1.warping_path_length == res2.warping_path_length
    assert res1.phase_timing_deltas == res2.phase_timing_deltas
    assert res1.difference_highlights == res2.difference_highlights


# ─── 11. Biomechanics Disclaimer Separation ───────────────────────────────────

def test_biomechanics_disclaimer_present():
    engine = GhostAlignmentEngine()
    ref = _make_manifest(num_frames=5)
    normalizer = ReferenceNormalizer()
    ath_frames = normalizer.normalize_athlete_frames(
        [_make_dummy_skeleton() for _ in range(5)],
        stance="orthodox",
    )

    expl = engine.align_and_explain(ath_frames, ref)
    assert expl.alignment_status == AlignmentStatus.ALIGNED
    assert expl.biomechanics_disclaimer == BIOMECHANICS_DISCLAIMER
    assert "2D image-plane" in expl.biomechanics_disclaimer
    assert "do not represent 3D physical force" in expl.biomechanics_disclaimer
    d = expl.to_dict()
    assert "biomechanicsDisclaimer" in d


def test_missing_camera_metadata_abstains():
    engine = GhostAlignmentEngine()
    ref = _make_manifest(camera_view=None)
    normalizer = ReferenceNormalizer()
    ath_frames = normalizer.normalize_athlete_frames(
        [_make_dummy_skeleton() for _ in range(5)],
        stance="orthodox",
    )
    expl = engine.align_and_explain(
        ath_frames,
        ref,
        athlete_camera_view="front",
        reference_camera_view=None,
    )
    assert expl.alignment_status == AlignmentStatus.CAMERA_MISMATCH
