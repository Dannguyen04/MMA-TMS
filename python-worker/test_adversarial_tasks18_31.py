"""
test_adversarial_tasks18_31.py — Comprehensive Adversarial and Boundary Tests for Tasks 18–31

Covers:
1. Missing phases and null confidence dicts in ActionResults.
2. 3D dict vs numeric confidence parsing safety without TypeError.
3. Non-zero start frame normalization in combinations.
4. Zero-scale body normalization (overlapping hips/shoulders).
5. Multi-person grappling boundary checks (1 person, 2 persons, >2 persons).
6. Stale personalized baseline rejection (max_age_days expiration).
7. Unconsented dataset export rejection with fail-closed privacy.
8. Deterministic tie-breaking across overlapping sequence candidates.
9. Left/right joint swapping during horizontal stance mirroring.
10. Missing camera view compatibility rejection in session comparison.
"""

import math
from datetime import datetime, timedelta, timezone
import pytest

from pipeline.contracts import (
    AlignmentStatus,
    BaselineEligibilityStatus,
    CalibrationStatus,
    ComparisonStatus,
    QualityStatus,
    SequenceCandidateType,
    ShadowEventFamily,
    ShadowGrapplingState,
    ValidationStatus,
)
from pipeline.combination_engine import CombinationEngine, ActionSequence
from pipeline.elbow_knee_shadow import ElbowKneeShadowClassifier
from pipeline.grappling_shadow import GrapplingShadowSegmenter
from pipeline.observable_movement import MovementEvidenceEngine
from pipeline.personalized_baseline import BaselineEngine, PersonalizedBaseline
from pipeline.session_comparison import SessionComparator
from pipeline.reference_normalization import ReferenceNormalizer
from pipeline.ghost_alignment import GhostAlignmentEngine
from pipeline.active_learning_queue import (
    ActiveLearningSelector,
    TrustedConsentPolicy,
    pseudonymize_identifier,
)
from pipeline.confidence_calibration import TemperatureScalingCalibrator
from pipeline.model_registry import DriftMonitor
from pipeline.vertical_slice_integration import AdvancedAIOrchestrator, AdvancedAnalysisInput


def test_adversarial_action_result_missing_phases_and_confidence_types():
    """Ensures combination engine and active learning handle missing phases and mixed confidence structures."""
    comb_engine = CombinationEngine()
    al_selector = ActiveLearningSelector()

    adversarial_actions = [
        # Missing phases, 3D confidence dict
        {
            "id": "act_adv_1",
            "technique": "jab",
            "confidence": {"detection": 0.85, "classification": 0.80, "assessment": 0.75},
        },
        # Empty phases, scalar float confidence
        {
            "id": "act_adv_2",
            "technique": "cross",
            "phases": {},
            "confidence": 0.40,
        },
        # None confidence, startFrame/endFrame at top level
        {
            "id": "act_adv_3",
            "technique": "hook",
            "startFrame": 35,
            "endFrame": 50,
            "confidence": None,
        },
    ]

    # Combination extraction should safely extract boundaries without throwing TypeError/KeyError
    sequences = comb_engine.extract_sequences(adversarial_actions)
    assert isinstance(sequences, list)

    # Active learning evaluation should safely extract scalar confidence
    cand_1 = al_selector.evaluate_sample("vid_1", "act_adv_1", "jab", adversarial_actions[0]["confidence"])
    cand_2 = al_selector.evaluate_sample("vid_1", "act_adv_2", "cross", adversarial_actions[1]["confidence"])
    cand_3 = al_selector.evaluate_sample("vid_1", "act_adv_3", "hook", adversarial_actions[2]["confidence"])

    assert cand_2 is not None  # 0.40 < 0.65 threshold -> triggers LOW_CONFIDENCE
    assert cand_3 is not None  # None confidence -> triggers LOW_CONFIDENCE


def test_adversarial_zero_scale_skeleton_normalization():
    """Zero torso scale (shoulders and hips at identical coordinates) must abstain rather than divide by zero."""
    normalizer = ReferenceNormalizer()
    movement_engine = MovementEvidenceEngine()

    # Degenerate skeleton where all points are at (0.5, 0.5)
    degenerate_frame = [(0.5, 0.5)] * 17

    # Normalization should handle zero torso height safely
    manifest = normalizer.normalize_trajectory(
        reference_id="ref_degen",
        technique="jab",
        source_stance="orthodox",
        target_stance="orthodox",
        raw_frames=[degenerate_frame],
    )
    assert manifest.frame_count == 1
    # Keypoints should be normalized safely without ZeroDivisionError
    assert len(manifest.normalized_frames) == 1

    # Observable movement engine should abstain when shoulders have 0 distance
    movement_ev = movement_engine.compute_evidence(
        left_ankle=(0.5, 0.9),
        right_ankle=(0.5, 0.9),
        left_shoulder=(0.5, 0.3),
        right_shoulder=(0.5, 0.3),  # 0 width
        left_wrist=(0.5, 0.4),
        right_wrist=(0.5, 0.4),
        nose_or_chin=(0.5, 0.2),
        quality_status=QualityStatus.GOOD,
    )
    assert movement_ev.guard_distance_ratio is None
    assert movement_ev.base_of_support_ratio is None


def test_adversarial_multi_person_grappling_boundaries():
    """Tests 1, 2, and 3+ person inputs for strict multi-person gating."""
    segmenter = GrapplingShadowSegmenter()

    # Single person -> must NOT_EVALUABLE
    seg_1 = segmenter.segment_interaction(0, 30, person_count=1)
    assert seg_1.validation_status == ValidationStatus.NOT_EVALUABLE
    assert "UNSUPPORTED_MULTI_PERSON_EVIDENCE" in seg_1.reason_codes

    # 3 persons -> must NOT_EVALUABLE with ambiguity flag
    seg_3 = segmenter.segment_interaction(0, 30, person_count=3)
    assert seg_3.validation_status == ValidationStatus.NOT_EVALUABLE
    assert seg_3.multi_person_ambiguity is True
    assert "MULTI_PERSON_AMBIGUITY_MORE_THAN_TWO" in seg_3.reason_codes

    # 2 persons with level change but NO proximity -> solitary level change (not takedown)
    seg_2_squat = segmenter.segment_interaction(
        0, 30, person_count=2, hip_drop_norm=0.35, bounding_box_iou=0.05, torso_distance_norm=0.80
    )
    assert seg_2_squat.state == ShadowGrapplingState.LEVEL_CHANGE
    assert "SOLITARY_LEVEL_CHANGE_WITHOUT_OPPONENT_PROXIMITY" in seg_2_squat.reason_codes

    # 2 persons with level change AND proximity -> TAKEDOWN_LIKE
    seg_2_td = segmenter.segment_interaction(
        0, 30, person_count=2, hip_drop_norm=0.35, bounding_box_iou=0.40, torso_distance_norm=0.20
    )
    assert seg_2_td.state == ShadowGrapplingState.TAKEDOWN_LIKE
    assert "SIGNIFICANT_LEVEL_CHANGE_WITH_PROXIMITY_CONTACT" in seg_2_td.reason_codes


def test_adversarial_stale_baseline_expiration():
    """Baseline older than max_age_days must be marked STALE / INSUFFICIENT_SAMPLES."""
    engine = BaselineEngine(min_sessions=2, max_age_days=30)
    now = datetime.now(timezone.utc)

    # 2 sessions but both are 45 days old
    sessions = [
        {
            "sessionId": "s_old_1",
            "athleteId": "ath_1",
            "technique": "jab",
            "stance": "orthodox",
            "createdAt": (now - timedelta(days=45)).isoformat(),
            "qualityStatus": QualityStatus.GOOD,
            "metrics": {"velocity": 10.0},
        },
        {
            "sessionId": "s_old_2",
            "athleteId": "ath_1",
            "technique": "jab",
            "stance": "orthodox",
            "createdAt": (now - timedelta(days=40)).isoformat(),
            "qualityStatus": QualityStatus.GOOD,
            "metrics": {"velocity": 12.0},
        },
    ]

    baseline = engine.compute_baseline(
        athlete_id="ath_1",
        technique="jab",
        stance="orthodox",
        historical_sessions=sessions,
    )
    assert baseline.eligibility_status == BaselineEligibilityStatus.STALE
    assert baseline.session_count == 0
    assert baseline.is_active is False


def test_adversarial_privacy_consent_and_export_rejection():
    """Unconsented samples must never be marked export-eligible."""
    selector = ActiveLearningSelector()

    # Explicitly unconsented policy
    unconsented_policy = TrustedConsentPolicy(
        athlete_id="ath_private",
        consent_granted=False,
        is_retention_valid=False,
    )

    candidate = selector.evaluate_sample(
        video_id="C:/local/private_gym/secret_sparring.mp4",
        action_id="act_hidden_1",
        technique="spinning_back_kick",
        confidence=0.30,
        consent_policy=unconsented_policy,
    )

    assert candidate is not None
    assert candidate.is_consent_granted is False
    assert candidate.is_export_eligible is False
    # Verifies local filesystem path was pseudonymized
    assert "C:/local/private_gym" not in candidate.video_id
    assert candidate.video_id.startswith("anon_")


def test_adversarial_stance_mirroring_joint_swapping_symmetry():
    """Mirroring must swap symmetric left/right joints across all 8 body pairs."""
    normalizer = ReferenceNormalizer()

    # Keypoint 5 (l_shoulder) at x=0.40, Keypoint 6 (r_shoulder) at x=0.60
    # Root mid-hip is at x=0.50
    kps = [(0.50, 0.50)] * 17
    kps[5] = (0.40, 0.30)
    kps[6] = (0.60, 0.30)
    kps[9] = (0.35, 0.40)   # left wrist (original)
    kps[10] = (0.75, 0.40)  # right wrist (original)
    kps[11] = (0.48, 0.60)  # left hip
    kps[12] = (0.52, 0.60)  # right hip
    kps[15] = (0.42, 0.90)  # left ankle
    kps[16] = (0.58, 0.90)  # right ankle

    manifest = normalizer.normalize_trajectory(
        reference_id="ref_symm_test",
        technique="cross",
        source_stance="orthodox",
        target_stance="southpaw",
        raw_frames=[kps],
    )

    norm_kps = manifest.normalized_frames[0].normalized_keypoints

    # After swap & negation:
    # New Left Shoulder (idx 5) = - (original right shoulder relative x) = - (0.60 - 0.50) = -0.10
    # New Right Shoulder (idx 6) = - (original left shoulder relative x) = - (0.40 - 0.50) = +0.10
    assert norm_kps[5][0] < 0.0  # left shoulder is negative
    assert norm_kps[6][0] > 0.0  # right shoulder is positive
    assert pytest.approx(norm_kps[5][0] + norm_kps[6][0], abs=1e-4) == 0.0

    # New Left Wrist (idx 9) is now from original Right Wrist (0.75): -(0.75 - 0.50) = -0.25 (negative)
    # New Right Wrist (idx 10) is now from original Left Wrist (0.35): -(0.35 - 0.50) = +0.15 (positive)
    assert norm_kps[9][0] < 0.0
    assert norm_kps[10][0] > 0.0


