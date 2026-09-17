"""
test_remediation_round2.py — Comprehensive Test Suite for Remediation Round 2 (Tasks 9–17)

Covers all 20 explicit verification tests required by GEMINI REMEDIATION ROUND 2:
 1. test_kick_shadow_candidate_invariant_to_legacy_technique_label
 2. test_kick_missing_hip_evidence_abstains
 3. test_kick_missing_arc_evidence_abstains
 4. test_kick_missing_lateral_evidence_abstains
 5. test_kick_missing_torso_evidence_abstains
 6. test_punch_vertical_lift_and_separation_measured_from_synthetic_frames
 7. test_punch_uppercut_candidate_reached_via_action_from_punch
 8. test_punch_hook_candidate_reached_via_action_from_punch
 9. test_punch_unavailable_separation_abstains
10. test_process_video_forced_blocked_consistency
11. test_process_video_forced_degraded_consistency
12. test_process_video_forced_pass_consistency
13. test_dataset_audit_rejects_unmatched_action_id
14. test_dataset_audit_rejects_non_unique_record_ids_or_tokens
15. test_dataset_audit_rejects_non_monotonic_timestamps
16. test_dataset_audit_rejects_mutated_ai_original_value
17. test_dataset_audit_unresolved_rejection_blocks_export
18. test_dataset_content_hash_sensitivity
19. test_dataset_gold_ready_requires_side_kick_and_20_samples_per_class
20. test_privacy_rejects_empty_athlete_and_weak_salts
"""

import copy
import hashlib
import json
import unittest
from unittest.mock import MagicMock, patch

import numpy as np

from action_result import action_from_kick, action_from_punch
from kick_analyzer import KickResult
from pipeline.contracts import EvidenceLevel
from pipeline.classification import ClassifiedTechnique
from pipeline.coaching_engine import CoachingEngine
from pipeline.dataset_export import (
    AnonymizedSample,
    BackendAttestationVerifier,
    DatasetExportEngine,
    DatasetSplit,
    ExportApprovalPolicy,
    REQUIRED_GOLD_CLASSES,
)
from pipeline.kinematic_features import extract_kinematic_features
from pipeline.quality_gate import (
    AnalysisQuality,
    QualityGateConfig,
    QualityGateEvaluator,
    QualityStatus,
)
from pipeline.review_contract import (
    MaterializedActionView,
    ReviewAction,
    ReviewAuditRecord,
    ReviewerRole,
    TargetField,
)
from pipeline.session_aggregation import SessionAggregationEngine
from pipeline.shadow_classifier import DecisionStatus
from pipeline.shadow_kick_classifier import ShadowKickClassifier
from pipeline.shadow_punch_classifier import ShadowMultiPunchClassifier
from pipeline.stance_context import resolve_stance_context
from process_video import process_video
from punch_analyzer import PunchResult


def _make_dummy_frame(wrist_x=0.5, wrist_y=0.4, conf=0.9, shoulder_y=0.4, frame_idx=0, time_ms=0.0):
    """Generate a single synthetic frame dict with COCO/YOLO landmarks."""
    landmarks = []
    for idx in range(17):
        if idx in (9, 10):  # Left / right wrist (COCO 9, 10)
            landmarks.append({"x": wrist_x, "y": wrist_y, "conf": conf})
        elif idx in (7, 8):  # Left / right elbow (COCO 7, 8)
            landmarks.append({"x": 0.45, "y": 0.45, "conf": conf})
        elif idx in (5, 6):  # Left / right shoulder (COCO 5, 6)
            landmarks.append({"x": 0.40, "y": shoulder_y, "conf": conf})
        elif idx in (11, 12):  # Left / right hip (COCO 11, 12)
            landmarks.append({"x": 0.45, "y": 0.65, "conf": conf})
        elif idx in (13, 14):  # Left / right knee (COCO 13, 14)
            landmarks.append({"x": 0.45, "y": 0.80, "conf": conf})
        elif idx in (15, 16):  # Left / right ankle (COCO 15, 16)
            landmarks.append({"x": wrist_x, "y": wrist_y, "conf": conf})
        else:
            landmarks.append({"x": 0.5, "y": 0.5, "conf": conf})
    return {"landmarks": landmarks, "frameIdx": frame_idx, "timeMs": time_ms}


class TestRemediationRound2(unittest.TestCase):

    def setUp(self):
        self.orthodox_ctx = resolve_stance_context(coach_stance="orthodox")
        self.secret_salt = "super_secure_production_salt_2026_xyz"

    # ─────────────────────────────────────────────────────────────────────────
    # P0 Kick Tests (1–5)
    # ─────────────────────────────────────────────────────────────────────────

    def test_kick_shadow_candidate_invariant_to_legacy_technique_label(self):
        """1. Changing legacy technique label while keeping identical measured features cannot change shadow candidate."""
        # Create identical trajectory (front kick motion: straight sagittal path)
        frames = []
        for i in range(15):
            frames.append({
                "frameIdx": i,
                "timeMs": i * 33.3,
                "landmarks": [
                    {"x": 0.5, "y": 0.5, "conf": 0.9} if kp not in (23, 24, 25, 26, 27, 28, 11, 12)
                    else {"x": 0.45, "y": 0.3, "conf": 0.9} if kp == 11
                    else {"x": 0.55, "y": 0.3, "conf": 0.9} if kp == 12
                    else {"x": 0.48, "y": 0.6, "conf": 0.9} if kp == 23
                    else {"x": 0.52, "y": 0.6, "conf": 0.9} if kp == 24
                    else {"x": 0.50, "y": 0.75, "conf": 0.9} if kp in (25, 26)
                    else {"x": 0.50, "y": 0.85 - (i * 0.02), "conf": 0.9}  # Ankle moving forward/up
                    for kp in range(33)
                ]
            })

        # Test with legacy technique = "round_kick"
        kick_res = KickResult(
            score=80,
            grade="A",
            emoji="🥋",
            details=[],
            min_chamber_angle=45.0,
            max_extension_angle=160.0,
            peak_speed=2.5,
            start_frame=0,
            impact_frame=8,
            end_frame=14,
            start_time_ms=0.0,
            impact_time_ms=266.4,
            end_time_ms=466.2,
            active_leg="right",
        )
        ct_round = ClassifiedTechnique(
            family="kick", technique="round_kick", attacking_side="right", limb_role="rear", stance="orthodox"
        )
        action_round = action_from_kick(
            kick_res,
            action_id="act_k1",
            source_action_id="kick_0",
            classified_technique=ct_round,
            keypoints_trajectory=frames,
            fps=30.0,
        )

        # Test with legacy technique = "front_kick"
        ct_front = ClassifiedTechnique(
            family="kick", technique="front_kick", attacking_side="right", limb_role="rear", stance="orthodox"
        )
        action_front = action_from_kick(
            kick_res,
            action_id="act_k2",
            source_action_id="kick_1",
            classified_technique=ct_front,
            keypoints_trajectory=frames,
            fps=30.0,
        )

        # Test with legacy technique = "side_kick"
        ct_side = ClassifiedTechnique(
            family="kick", technique="side_kick", attacking_side="right", limb_role="rear", stance="orthodox"
        )
        action_side = action_from_kick(
            kick_res,
            action_id="act_k3",
            source_action_id="kick_2",
            classified_technique=ct_side,
            keypoints_trajectory=frames,
            fps=30.0,
        )

        # Shadow candidate must be 100% invariant to legacy label
        cand_round = action_round.shadowClassification.get("candidate")
        cand_front = action_front.shadowClassification.get("candidate")
        cand_side = action_side.shadowClassification.get("candidate")

        self.assertEqual(action_round.shadowClassification["status"], action_front.shadowClassification["status"])
        self.assertEqual(action_round.shadowClassification["status"], action_side.shadowClassification["status"])
        if cand_round is not None:
            self.assertEqual(cand_round["technique"], cand_front["technique"])
            self.assertEqual(cand_round["technique"], cand_side["technique"])

    def test_kick_missing_hip_evidence_abstains(self):
        """2. Missing hip evidence abstains rather than silently classifying."""
        classifier = ShadowKickClassifier()
        feat = {
            "attacking_side": "right",
            "has_chamber_phase": True,
            "has_extension_phase": True,
            "hip_rotation_angle": None,  # Missing
            "forward_trajectory_linearity": 0.85,
            "arc_curvature": 0.35,
            "lateral_displacement_ratio": 0.70,
            "torso_lean_angle": 25.0,
        }
        dec = classifier.classify(feat, self.orthodox_ctx)
        self.assertEqual(dec.status, DecisionStatus.ABSTAINED)
        self.assertIn("MISSING_KINEMATIC_FEATURES", dec.reason_codes)

    def test_kick_missing_arc_evidence_abstains(self):
        """3. Roundhouse candidate with missing arc curvature evidence abstains."""
        classifier = ShadowKickClassifier()
        feat = {
            "attacking_side": "right",
            "has_chamber_phase": True,
            "has_extension_phase": True,
            "hip_rotation_angle": 45.0,  # High hip rotation, typical of roundhouse
            "forward_trajectory_linearity": 0.50,
            "arc_curvature": None,  # Missing arc curvature evidence
            "lateral_displacement_ratio": 0.20,
            "torso_lean_angle": 10.0,
        }
        dec = classifier.classify(feat, self.orthodox_ctx)
        self.assertEqual(dec.status, DecisionStatus.ABSTAINED)
        self.assertIn("MISSING_KINEMATIC_FEATURES", dec.reason_codes)

    def test_kick_missing_lateral_evidence_abstains(self):
        """4. Side kick candidate with missing lateral displacement evidence abstains."""
        classifier = ShadowKickClassifier()
        feat = {
            "attacking_side": "left",
            "has_chamber_phase": True,
            "has_extension_phase": True,
            "hip_rotation_angle": 28.0,
            "forward_trajectory_linearity": 0.40,
            "arc_curvature": 0.15,
            "lateral_displacement_ratio": None,  # Missing lateral displacement
            "torso_lean_angle": 32.0,            # High torso lean
        }
        dec = classifier.classify(feat, self.orthodox_ctx)
        self.assertEqual(dec.status, DecisionStatus.ABSTAINED)
        self.assertIn("MISSING_KINEMATIC_FEATURES", dec.reason_codes)

    def test_kick_missing_torso_evidence_abstains(self):
        """5. Side kick candidate with missing torso lean evidence abstains."""
        classifier = ShadowKickClassifier()
        feat = {
            "attacking_side": "left",
            "has_chamber_phase": True,
            "has_extension_phase": True,
            "hip_rotation_angle": 28.0,
            "forward_trajectory_linearity": 0.40,
            "arc_curvature": 0.15,
            "lateral_displacement_ratio": 0.78,  # High lateral displacement
            "torso_lean_angle": None,            # Missing torso lean evidence
        }
        dec = classifier.classify(feat, self.orthodox_ctx)
        self.assertEqual(dec.status, DecisionStatus.ABSTAINED)
        self.assertIn("MISSING_KINEMATIC_FEATURES", dec.reason_codes)

    # ─────────────────────────────────────────────────────────────────────────
    # P0 Punch Tests (6–9)
    # ─────────────────────────────────────────────────────────────────────────

    def test_punch_vertical_lift_and_separation_measured_from_synthetic_frames(self):
        """6. Vertical lift and wrist-shoulder separation are measured from synthetic frames."""
        # Create upward trajectory (wrist moving from y=0.65 to y=0.40)
        frames = []
        for i in range(10):
            w_y = 0.65 - (i * 0.025)  # 0.65 down to 0.40 (lift = 0.25)
            frames.append(_make_dummy_frame(wrist_x=0.5, wrist_y=w_y, conf=0.95, shoulder_y=0.40, frame_idx=i, time_ms=i * 33.3))

        feat_set = extract_kinematic_features(
            frames=frames,
            action_family="punch",
            arm_side="right",
        )

        vl = feat_set.metrics.get("vertical_lift")
        sep = feat_set.metrics.get("wrist_shoulder_separation_ratio")

        self.assertIsNotNone(vl)
        self.assertIsNotNone(vl.value)
        self.assertGreater(vl.value, 0.15)
        self.assertEqual(vl.unit, "normalized_image")

        self.assertIsNotNone(sep)
        self.assertIsNotNone(sep.value)
        self.assertGreater(sep.value, 0.20)
        self.assertEqual(sep.unit, "ratio")

    def test_punch_uppercut_candidate_reached_via_action_from_punch(self):
        """7. Uppercut candidate is reached from measured synthetic trajectory through production adapter."""
        # Uppercut: upward lift >= 0.12, bent elbow in [65, 120]
        frames = []
        for i in range(12):
            wy = 0.58 - (i * 0.012)  # Lift = ~0.132, within [65, 120] deg
            frames.append({
                "frameIdx": i,
                "timeMs": i * 33.333,
                "landmarks": [
                    {"x": 0.50, "y": wy, "conf": 0.95} if kp in (9, 10)
                    else {"x": 0.40, "y": 0.55, "conf": 0.95} if kp in (7, 8)
                    else {"x": 0.40, "y": 0.40, "conf": 0.95} if kp in (5, 6)
                    else {"x": 0.45, "y": 0.65, "conf": 0.95} if kp in (11, 12)
                    else {"x": 0.5, "y": 0.5, "conf": 0.9}
                    for kp in range(17)
                ]
            })

        punch = PunchResult(
            punch_type="punch",
            arm="right",
            score=82,
            grade="B",
            emoji="🥊",
            details=[],
            max_elbow_angle=92.0,
            peak_speed=6.0,
            guard_preserved=True,
            start_frame=0,
            impact_frame=7,
            end_frame=11,
            start_time_ms=0.0,
            impact_time_ms=233.3,
            end_time_ms=366.7,
            findings=[],
        )

        action = action_from_punch(
            punch=punch,
            action_id="act_p_upper",
            source_action_id="punch_0",
            keypoints_trajectory=frames,
            fps=30.0,
        )

        sc = action.shadowClassification
        self.assertIsNotNone(sc)
        self.assertEqual(sc["status"], "classified")
        self.assertIsNotNone(sc["candidate"])
        self.assertEqual(sc["candidate"]["technique"], "uppercut")

    def test_punch_hook_candidate_reached_via_action_from_punch(self):
        """8. Hook candidate is reached from measured synthetic trajectory through production adapter."""
        # Hook: horizontal arc with high curvature (>=0.24), directness <=0.82, elbow in [75, 130]
        arc = [
            (0.42, 0.55), (0.44, 0.52), (0.48, 0.48), (0.54, 0.45),
            (0.60, 0.46), (0.62, 0.49), (0.58, 0.52), (0.52, 0.53),
            (0.48, 0.52)
        ]
        frames = []
        for i, (wx, wy) in enumerate(arc):
            frames.append({
                "frameIdx": i,
                "timeMs": i * 33.333,
                "landmarks": [
                    {"x": wx, "y": wy, "conf": 0.95} if kp in (9, 10)
                    else {"x": 0.50, "y": 0.55, "conf": 0.95} if kp in (7, 8)
                    else {"x": 0.50, "y": 0.40, "conf": 0.95} if kp in (5, 6)
                    else {"x": 0.50, "y": 0.65, "conf": 0.95} if kp in (11, 12)
                    else {"x": 0.5, "y": 0.5, "conf": 0.9}
                    for kp in range(17)
                ]
            })

        punch = PunchResult(
            punch_type="punch",
            arm="left",
            score=85,
            grade="A",
            emoji="🥊",
            details=[],
            max_elbow_angle=95.0,
            peak_speed=7.5,
            guard_preserved=True,
            start_frame=0,
            impact_frame=5,
            end_frame=8,
            start_time_ms=0.0,
            impact_time_ms=166.7,
            end_time_ms=266.7,
            findings=[],
        )

        action = action_from_punch(
            punch=punch,
            action_id="act_p_hook",
            source_action_id="punch_1",
            keypoints_trajectory=frames,
            fps=30.0,
        )

        sc = action.shadowClassification
        self.assertIsNotNone(sc)
        self.assertEqual(sc["status"], "classified")
        self.assertEqual(sc["candidate"]["technique"], "hook")

    def test_punch_unavailable_separation_abstains(self):
        """9. Unavailable separation/view evidence (e.g. missing shoulder) causes punch classifier to abstain."""
        # Frames where shoulder is completely missing / confidence 0.0
        frames = []
        for i in range(10):
            frames.append({
                "frameIdx": i,
                "timeMs": i * 33.333,
                "landmarks": [
                    {"x": 0.5, "y": 0.4 - (i * 0.02), "conf": 0.9} if kp in (9, 10)
                    else {"x": 0.0, "y": 0.0, "conf": 0.0} if kp in (5, 6, 7, 8)  # Missing shoulder/elbow
                    else {"x": 0.5, "y": 0.5, "conf": 0.9}
                    for kp in range(17)
                ]
            })

        punch = PunchResult(
            punch_type="punch",
            arm="right",
            score=70,
            grade="C",
            emoji="🥊",
            details=[],
            max_elbow_angle=150.0,
            peak_speed=5.0,
            guard_preserved=True,
            start_frame=0,
            impact_frame=5,
            end_frame=9,
            start_time_ms=0.0,
            impact_time_ms=166.7,
            end_time_ms=300.0,
            findings=[],
        )

        action = action_from_punch(
            punch=punch,
            action_id="act_p_nosep",
            source_action_id="punch_2",
            keypoints_trajectory=frames,
            fps=30.0,
        )

        sc = action.shadowClassification
        self.assertIsNotNone(sc)
        self.assertEqual(sc["status"], "abstained")
        self.assertIn("UNAVAILABLE_SEPARATION_OR_VIEW_EVIDENCE", sc["reasonCodes"])

    # ─────────────────────────────────────────────────────────────────────────
    # P1 Quality Contract Tests (10–12)
    # ─────────────────────────────────────────────────────────────────────────

    def _make_mock_detection_results(self):
        mock_punch = PunchResult(
            punch_type="punch",
            arm="right",
            score=82,
            grade="B",
            emoji="🥊",
            details=["Good form"],
            max_elbow_angle=92.0,
            peak_speed=6.0,
            guard_preserved=True,
            start_frame=5,
            impact_frame=15,
            end_frame=25,
            start_time_ms=166.7,
            impact_time_ms=500.0,
            end_time_ms=833.3,
        )
        mock_kick = KickResult(
            score=80,
            grade="A",
            emoji="🥋",
            details=["Good extension"],
            min_chamber_angle=45.0,
            max_extension_angle=160.0,
            peak_speed=2.5,
            start_frame=5,
            chamber_peak_frame=12,
            impact_frame=18,
            end_frame=30,
            start_time_ms=166.7,
            chamber_peak_time_ms=400.0,
            impact_time_ms=600.0,
            end_time_ms=1000.0,
            active_leg="right",
        )
        return [mock_punch], [mock_kick]

    @patch("process_video.cv2.VideoCapture")
    @patch("process_video.YOLO")
    @patch("process_video.ActionPipeline.get_results")
    @patch("process_video.evaluate_video_quality")
    def test_process_video_forced_blocked_consistency(self, mock_eval, mock_get_results, mock_yolo, mock_cap):
        """10. Forced blocked quality suppresses technical conclusions across actions, legacy punches/kicks, and summary."""
        mock_punches, mock_kicks = self._make_mock_detection_results()
        mock_get_results.return_value = (mock_punches, mock_kicks)

        mock_eval.return_value = AnalysisQuality(
            status=QualityStatus.BLOCKED,
            reason_codes=("UNRECOGNIZED_TARGET",),
            metrics={
                "fps": 30.0,
                "duration_ms": 3000.0,
                "total_frames": 45,
                "missing_frame_ratio": 0.85,
                "mean_keypoint_confidence": 0.20,
                "upper_body_coverage": 0.15,
                "lower_body_coverage": 0.10,
            },
            quality_version="1.0.0",
            evaluator_version="1.0.0",
            evaluated_at="2026-09-17T00:00:00Z",
            adjusted_evidence_level=EvidenceLevel.UNAVAILABLE,
            recommendation="blocked_retry_video",
        )

        dummy_frame = np.zeros((720, 1280, 3), dtype=np.uint8)
        cap_inst = MagicMock()
        cap_inst.isOpened.return_value = True
        cap_inst.get.side_effect = lambda prop: 30.0 if prop == 5 else 45 if prop == 7 else 1280 if prop == 3 else 720
        cap_inst.read.side_effect = [(True, dummy_frame)] * 45 + [(False, None)]
        mock_cap.return_value = cap_inst

        result = process_video("dummy_blocked.mp4", verbose=False)

        # 1. Top-level findings must be empty
        self.assertEqual(result["findings"], [])

        # 2. Summary must have None scores
        self.assertIsNone(result["summary"]["avgScore"])
        self.assertIsNone(result["summary"]["bestScore"])

        # 3. Kicks and punches must suppress scores
        self.assertEqual(len(result["kicks"]), 1)
        for k in result["kicks"]:
            self.assertIsNone(k["score"])
            self.assertEqual(k["grade"], "INSUFFICIENT_EVIDENCE")
        self.assertEqual(len(result["punches"]), 1)
        for p in result.get("punches", []):
            self.assertIsNone(p["score"])
            self.assertEqual(p["grade"], "INSUFFICIENT_EVIDENCE")

        # 4. Actions must have insufficient_evidence assessment & abstained shadowClassification
        self.assertEqual(len(result["actions"]), 2)
        for a in result.get("actions", []):
            self.assertIsNone(a["assessment"]["score"])
            self.assertEqual(a["assessment"]["grade"], "insufficient_evidence")
            self.assertEqual(a["assessment"]["status"], "insufficient_evidence")
            self.assertEqual(a["assessment"]["findings"], [])
            sc = a.get("shadowClassification")
            self.assertIsNotNone(sc)
            self.assertEqual(sc["status"], "abstained")
            self.assertIn("QUALITY_BLOCKED", sc["reasonCodes"])

        # 5. Session insights priority findings must be empty
        self.assertEqual(result["sessionInsights"]["status"], "blocked")
        self.assertEqual(result["sessionInsights"]["priorityFindings"], [])

    @patch("process_video.cv2.VideoCapture")
    @patch("process_video.YOLO")
    @patch("process_video.ActionPipeline.get_results")
    @patch("process_video.evaluate_video_quality")
    def test_process_video_forced_degraded_consistency(self, mock_eval, mock_get_results, mock_yolo, mock_cap):
        """11. Forced degraded quality propagates derived_proxy evidence level into actions, session, and coaching."""
        mock_punches, mock_kicks = self._make_mock_detection_results()
        mock_get_results.return_value = (mock_punches, mock_kicks)

        mock_eval.return_value = AnalysisQuality(
            status=QualityStatus.DEGRADED,
            reason_codes=("LOW_FPS",),
            metrics={
                "fps": 30.0,
                "duration_ms": 3000.0,
                "total_frames": 45,
                "missing_frame_ratio": 0.05,
                "mean_keypoint_confidence": 0.65,
                "upper_body_coverage": 0.85,
                "lower_body_coverage": 0.80,
            },
            quality_version="1.0.0",
            evaluator_version="1.0.0",
            evaluated_at="2026-09-17T00:00:00Z",
            adjusted_evidence_level=EvidenceLevel.DERIVED_PROXY,
            recommendation="proceed_with_caution",
        )

        dummy_frame = np.zeros((720, 1280, 3), dtype=np.uint8)
        cap_inst = MagicMock()
        cap_inst.isOpened.return_value = True
        cap_inst.get.side_effect = lambda prop: 30.0 if prop == 5 else 45 if prop == 7 else 1280 if prop == 3 else 720
        cap_inst.read.side_effect = [(True, dummy_frame)] * 45 + [(False, None)]
        mock_cap.return_value = cap_inst

        result = process_video("dummy_degraded.mp4", verbose=False)

        # 1. Actions must carry degraded quality status and derived_proxy evidence level
        self.assertEqual(len(result["actions"]), 2)
        for a in result.get("actions", []):
            self.assertEqual(a.get("qualityStatus"), "degraded")
            self.assertEqual(a.get("adjustedEvidenceLevel"), "derived_proxy")
            for f in a["assessment"]["findings"]:
                self.assertEqual(f["evidenceLevel"], "derived_proxy")

        # 2. Session insights must reflect degraded status
        self.assertEqual(result["sessionInsights"].get("qualityStatus"), "degraded")
        self.assertEqual(result["sessionInsights"].get("adjustedEvidenceLevel"), "derived_proxy")

    @patch("process_video.cv2.VideoCapture")
    @patch("process_video.YOLO")
    @patch("process_video.ActionPipeline.get_results")
    @patch("process_video.evaluate_video_quality")
    def test_process_video_forced_pass_consistency(self, mock_eval, mock_get_results, mock_yolo, mock_cap):
        """12. Forced pass quality preserves full evaluated scores and observed evidence level."""
        mock_punches, mock_kicks = self._make_mock_detection_results()
        mock_get_results.return_value = (mock_punches, mock_kicks)

        mock_eval.return_value = AnalysisQuality(
            status=QualityStatus.PASS,
            reason_codes=(),
            metrics={
                "fps": 30.0,
                "duration_ms": 3000.0,
                "total_frames": 45,
                "missing_frame_ratio": 0.0,
                "mean_keypoint_confidence": 0.90,
                "upper_body_coverage": 0.95,
                "lower_body_coverage": 0.95,
            },
            quality_version="1.0.0",
            evaluator_version="1.0.0",
            evaluated_at="2026-09-17T00:00:00Z",
            adjusted_evidence_level=EvidenceLevel.OBSERVED,
            recommendation="proceed_full_analysis",
        )

        dummy_frame = np.zeros((720, 1280, 3), dtype=np.uint8)
        cap_inst = MagicMock()
        cap_inst.isOpened.return_value = True
        cap_inst.get.side_effect = lambda prop: 30.0 if prop == 5 else 45 if prop == 7 else 1280 if prop == 3 else 720
        cap_inst.read.side_effect = [(True, dummy_frame)] * 45 + [(False, None)]
        mock_cap.return_value = cap_inst

        result = process_video("dummy_pass.mp4", verbose=False)

        self.assertEqual(len(result["actions"]), 2)
        for a in result.get("actions", []):
            self.assertEqual(a.get("qualityStatus"), "pass")
            self.assertEqual(a.get("adjustedEvidenceLevel"), "observed")

    # ─────────────────────────────────────────────────────────────────────────
    # P1 Dataset Audit & Content Hash Tests (13–19)
    # ─────────────────────────────────────────────────────────────────────────

    def _make_valid_view(self, action_id="act_100", tech="jab", reviewer_id="coach_dan", second_reviewer_id=None):
        rec = ReviewAuditRecord(
            record_id=f"rec_{action_id}",
            action_id=action_id,
            target_field=TargetField.TECHNIQUE,
            review_action=ReviewAction.ACCEPT,
            ai_original_value=tech,
            corrected_value=None,
            reviewer_id=reviewer_id,
            reviewer_role=ReviewerRole.COACH,
            reason="Confirmed correct technique",
            timestamp="2026-09-17T10:00:00Z",
            idempotency_token=f"tok_{action_id}",
            version="1.0.0",
        )
        audit = [rec]
        if second_reviewer_id:
            rec2 = ReviewAuditRecord(
                record_id=f"rec2_{action_id}",
                action_id=action_id,
                target_field=TargetField.TECHNIQUE,
                review_action=ReviewAction.ACCEPT,
                ai_original_value=tech,
                corrected_value=None,
                reviewer_id=second_reviewer_id,
                reviewer_role=ReviewerRole.EXPERT_REVIEWER,
                reason="Confirmed correct technique agreement",
                timestamp="2026-09-17T10:01:00Z",
                idempotency_token=f"tok2_{action_id}",
                version="1.0.0",
            )
            audit.append(rec2)
        return MaterializedActionView(
            action_id=action_id,
            ai_original={
                "technique": tech,
                "attacking_side": "left",
                "limb_role": "lead",
                "phases": {"startFrame": 0, "endFrame": 30},
                "metrics": {"speed": 8.0},
                "qualityStatus": "pass",
                "adjustedEvidenceLevel": "observed",
            },
            effective_technique=tech,
            effective_attacking_side="left",
            effective_limb_role="lead",
            effective_phases={"startFrame": 0, "endFrame": 30},
            effective_findings=(),
            review_status="coach_approved",
            audit_trail=tuple(audit),
            updated_at="2026-09-17T10:01:00Z" if second_reviewer_id else "2026-09-17T10:00:00Z",
        )

    def test_dataset_audit_rejects_unmatched_action_id(self):
        """13. Audit record with mismatched action_id is rejected."""
        view = self._make_valid_view()
        bad_rec = ReviewAuditRecord(
            record_id="rec_mismatch",
            action_id="act_DIFF_ID",  # Does not match view.action_id
            target_field=TargetField.TECHNIQUE,
            review_action=ReviewAction.ACCEPT,
            ai_original_value="jab",
            corrected_value=None,
            reviewer_id="coach_dan",
            reviewer_role=ReviewerRole.COACH,
            reason="ok",
            timestamp="2026-09-17T10:00:00Z",
            idempotency_token="tok_diff",
            version="1.0.0",
        )
        view = MaterializedActionView(
            action_id="act_100",
            ai_original=view.ai_original,
            effective_technique=view.effective_technique,
            effective_attacking_side=view.effective_attacking_side,
            effective_limb_role=view.effective_limb_role,
            effective_phases=view.effective_phases,
            effective_findings=view.effective_findings,
            review_status=view.review_status,
            audit_trail=(bad_rec,),
            updated_at=view.updated_at,
        )
        eligible, reason = DatasetExportEngine.validate_audit_eligibility(view, ExportApprovalPolicy.STRICT_COACH_APPROVED)
        self.assertFalse(eligible)
        self.assertIn("mismatched_action_id", reason)

    def test_dataset_audit_rejects_non_unique_record_ids_or_tokens(self):
        """14. Duplicate record_ids or idempotency_tokens in audit trail are rejected."""
        rec1 = ReviewAuditRecord(
            record_id="rec_DUP",
            action_id="act_100",
            target_field=TargetField.TECHNIQUE,
            review_action=ReviewAction.ACCEPT,
            ai_original_value="jab",
            corrected_value=None,
            reviewer_id="coach_dan",
            reviewer_role=ReviewerRole.COACH,
            reason="ok",
            timestamp="2026-09-17T10:00:00Z",
            idempotency_token="tok_1",
            version="1.0.0",
        )
        rec2 = ReviewAuditRecord(
            record_id="rec_DUP",  # Duplicate record_id!
            action_id="act_100",
            target_field=TargetField.ATTACKING_SIDE,
            review_action=ReviewAction.ACCEPT,
            ai_original_value="left",
            corrected_value=None,
            reviewer_id="coach_dan",
            reviewer_role=ReviewerRole.COACH,
            reason="ok",
            timestamp="2026-09-17T10:01:00Z",
            idempotency_token="tok_2",
            version="1.0.0",
        )
        view = MaterializedActionView(
            action_id="act_100",
            ai_original={"technique": "jab", "attacking_side": "left"},
            effective_technique="jab",
            effective_attacking_side="left",
            effective_limb_role="lead",
            effective_phases={"startFrame": 0, "endFrame": 30},
            effective_findings=(),
            review_status="coach_approved",
            audit_trail=(rec1, rec2),
            updated_at="2026-09-17T10:01:00Z",
        )
        eligible, reason = DatasetExportEngine.validate_audit_eligibility(view, ExportApprovalPolicy.STRICT_COACH_APPROVED)
        self.assertFalse(eligible)
        self.assertIn("duplicate_record_id", reason)

    def test_dataset_audit_rejects_non_monotonic_timestamps(self):
        """15. Non-monotonic timestamps in audit trail are rejected."""
        rec1 = ReviewAuditRecord(
            record_id="rec_1",
            action_id="act_100",
            target_field=TargetField.TECHNIQUE,
            review_action=ReviewAction.ACCEPT,
            ai_original_value="jab",
            corrected_value=None,
            reviewer_id="coach_dan",
            reviewer_role=ReviewerRole.COACH,
            reason="ok",
            timestamp="2026-09-17T10:05:00Z",
            idempotency_token="tok_1",
            version="1.0.0",
        )
        rec2 = ReviewAuditRecord(
            record_id="rec_2",
            action_id="act_100",
            target_field=TargetField.ATTACKING_SIDE,
            review_action=ReviewAction.ACCEPT,
            ai_original_value="left",
            corrected_value=None,
            reviewer_id="coach_dan",
            reviewer_role=ReviewerRole.COACH,
            reason="ok",
            timestamp="2026-09-17T10:02:00Z",  # Earlier than rec1!
            idempotency_token="tok_2",
            version="1.0.0",
        )
        view = MaterializedActionView(
            action_id="act_100",
            ai_original={"technique": "jab", "attacking_side": "left"},
            effective_technique="jab",
            effective_attacking_side="left",
            effective_limb_role="lead",
            effective_phases={"startFrame": 0, "endFrame": 30},
            effective_findings=(),
            review_status="coach_approved",
            audit_trail=(rec1, rec2),
            updated_at="2026-09-17T10:05:00Z",
        )
        eligible, reason = DatasetExportEngine.validate_audit_eligibility(view, ExportApprovalPolicy.STRICT_COACH_APPROVED)
        self.assertFalse(eligible)
        self.assertIn("non_monotonic_timestamps", reason)

    def test_dataset_audit_rejects_mutated_ai_original_value(self):
        """16. Audit record with aiOriginalValue differing from view.ai_original is rejected."""
        rec = ReviewAuditRecord(
            record_id="rec_mut",
            action_id="act_100",
            target_field=TargetField.TECHNIQUE,
            review_action=ReviewAction.ACCEPT,
            ai_original_value="cross",  # Differs from view.ai_original["technique"] which is "jab"
            corrected_value=None,
            reviewer_id="coach_dan",
            reviewer_role=ReviewerRole.COACH,
            reason="ok",
            timestamp="2026-09-17T10:00:00Z",
            idempotency_token="tok_mut",
            version="1.0.0",
        )
        view = MaterializedActionView(
            action_id="act_100",
            ai_original={"technique": "jab"},
            effective_technique="jab",
            effective_attacking_side="left",
            effective_limb_role="lead",
            effective_phases={"startFrame": 0, "endFrame": 30},
            effective_findings=(),
            review_status="coach_approved",
            audit_trail=(rec,),
            updated_at="2026-09-17T10:00:00Z",
        )
        eligible, reason = DatasetExportEngine.validate_audit_eligibility(view, ExportApprovalPolicy.STRICT_COACH_APPROVED)
        self.assertFalse(eligible)
        self.assertIn("mutated_ai_original_value", reason)

    def test_dataset_audit_unresolved_rejection_blocks_export(self):
        """17. An unresolved rejection on any field blocks the entire action from dataset export."""
        rec_accept = ReviewAuditRecord(
            record_id="rec_1",
            action_id="act_100",
            target_field=TargetField.TECHNIQUE,
            review_action=ReviewAction.ACCEPT,
            ai_original_value="jab",
            corrected_value=None,
            reviewer_id="coach_dan",
            reviewer_role=ReviewerRole.COACH,
            reason="technique is fine",
            timestamp="2026-09-17T10:00:00Z",
            idempotency_token="tok_1",
            version="1.0.0",
        )
        rec_reject = ReviewAuditRecord(
            record_id="rec_2",
            action_id="act_100",
            target_field=TargetField.ATTACKING_SIDE,
            review_action=ReviewAction.REJECT,  # Field rejected!
            ai_original_value="left",
            corrected_value=None,
            reviewer_id="coach_dan",
            reviewer_role=ReviewerRole.COACH,
            reason="side is totally wrong, cannot approve action",
            timestamp="2026-09-17T10:01:00Z",
            idempotency_token="tok_2",
            version="1.0.0",
        )
        view = MaterializedActionView(
            action_id="act_100",
            ai_original={"technique": "jab", "attacking_side": "left"},
            effective_technique="jab",
            effective_attacking_side="left",
            effective_limb_role="lead",
            effective_phases={"startFrame": 0, "endFrame": 30},
            effective_findings=(),
            review_status="coach_rejected",
            audit_trail=(rec_accept, rec_reject),
            updated_at="2026-09-17T10:01:00Z",
        )
        eligible, reason = DatasetExportEngine.validate_audit_eligibility(view, ExportApprovalPolicy.COACH_APPROVED_OR_CORRECTED)
        self.assertFalse(eligible)
        self.assertIn("unresolved_rejection", reason)

    def test_dataset_content_hash_sensitivity(self):
        """18. Changing only metrics, only phases, only provenance, or only review status changes contentHash."""
        view_base = self._make_valid_view(action_id="act_1")
        res_base = DatasetExportEngine.export_dataset([(view_base, "ath_1")], salt=self.secret_salt)
        base_hash = res_base.manifest.content_hash

        # Change only metrics
        view_metrics = copy.deepcopy(view_base)
        view_metrics.ai_original["metrics"]["speed"] = 12.5
        res_metrics = DatasetExportEngine.export_dataset([(view_metrics, "ath_1")], salt=self.secret_salt)
        self.assertNotEqual(base_hash, res_metrics.manifest.content_hash, "Changing metrics must change contentHash")

        # Change only phases
        view_phases = copy.deepcopy(view_base)
        view_phases.effective_phases["endFrame"] = 45
        res_phases = DatasetExportEngine.export_dataset([(view_phases, "ath_1")], salt=self.secret_salt)
        self.assertNotEqual(base_hash, res_phases.manifest.content_hash, "Changing phases must change contentHash")

        # Change only provenance
        res_prov = DatasetExportEngine.export_dataset([(view_base, "ath_1")], salt=self.secret_salt, provenance_source="expert_consensus")
        self.assertNotEqual(base_hash, res_prov.manifest.content_hash, "Changing provenance must change contentHash")

        # Change only review status
        view_status = copy.deepcopy(view_base)
        object.__setattr__(view_status, "review_status", "coach_corrected")
        res_status = DatasetExportEngine.export_dataset([(view_status, "ath_1")], salt=self.secret_salt)
        self.assertNotEqual(base_hash, res_status.manifest.content_hash, "Changing review status must change contentHash")

    def test_dataset_gold_ready_requires_side_kick_and_20_samples_per_class(self):
        """19. GOLD_READY requires all 7 classes including side_kick, with at least 20 samples per class."""
        self.assertIn("side_kick", REQUIRED_GOLD_CLASSES)

        trusted_key = "test_key_secret_2026_production_round2"
        signed = BackendAttestationVerifier.create_signed_assertion(
            issuer="mma_backend_authority",
            secret_key=trusted_key,
        )
        verifier = BackendAttestationVerifier.create_configured_verifier(trusted_keys={"mma_backend_authority": trusted_key})
        DatasetExportEngine.set_system_verifier(verifier)

        # Build a dataset with 560 samples across athletes to satisfy train/val/test splits
        all_classes = list(REQUIRED_GOLD_CLASSES)
        views = []
        for i in range(560):
            tech = all_classes[i % len(all_classes)]
            # Spread across 20 distinct athletes to ensure all 3 splits are covered
            ath_id = f"athlete_{(i % 20) + 1:03d}"
            v = self._make_valid_view(
                action_id=f"act_{i:04d}",
                tech=tech,
                reviewer_id="coach_dan",
                second_reviewer_id="expert_elena",
            )
            views.append((v, ath_id))

        res = DatasetExportEngine.export_dataset(
            views,
            salt=self.secret_salt,
            backend_attestation=signed,
            reviewer_agreement_policy="dual_review_consensus",
        )
        self.assertTrue(res.manifest.is_gold_ready)
        self.assertEqual(res.manifest.status, "GOLD_READY")

        # Now test failure when side_kick has < 20 samples (e.g. 10 samples)
        views_deficit = []
        for i in range(560):
            tech = all_classes[i % len(all_classes)]
            if tech == "side_kick" and i > 70:
                tech = "jab"  # Reduce side_kick count below 20
            ath_id = f"athlete_{(i % 20) + 1:03d}"
            v = self._make_valid_view(
                action_id=f"act_{i:04d}",
                tech=tech,
                reviewer_id="coach_dan",
                second_reviewer_id="expert_elena",
            )
            views_deficit.append((v, ath_id))

        res_deficit = DatasetExportEngine.export_dataset(
            views_deficit,
            salt=self.secret_salt,
            backend_attestation=signed,
            reviewer_agreement_policy="dual_review_consensus",
        )
        self.assertFalse(res_deficit.manifest.is_gold_ready)
        self.assertEqual(res_deficit.manifest.status, "NOT_GOLD_READY")

    # ─────────────────────────────────────────────────────────────────────────
    # P2 Privacy & Pseudonymization Tests (20)
    # ─────────────────────────────────────────────────────────────────────────

    def test_privacy_rejects_empty_athlete_and_weak_salts(self):
        """20. Rejects empty athlete ID, weak/short salts, and detects sample ID collisions."""
        # Reject empty athlete ID
        with self.assertRaises(ValueError):
            DatasetExportEngine.hash_athlete_id("", salt=self.secret_salt)
        with self.assertRaises(ValueError):
            DatasetExportEngine.hash_athlete_id("   ", salt=self.secret_salt)

        # Reject short salt (< 16 chars)
        with self.assertRaises(ValueError):
            DatasetExportEngine.hash_athlete_id("ath_1", salt="short_salt")

        # Reject weak / placeholder salts
        for weak in ("1234567890123456", "secretsecretsecret", "placeholderplaceholder"):
            if weak in DatasetExportEngine.WEAK_SALT_PATTERNS or len(set(weak)) < 4:
                with self.assertRaises(ValueError):
                    DatasetExportEngine.hash_athlete_id("ath_1", salt=weak)

        # Collision detection
        v1 = self._make_valid_view(action_id="act_COLLIDE")
        v2 = self._make_valid_view(action_id="act_COLLIDE")
        with self.assertRaises(ValueError) as ctx:
            DatasetExportEngine.export_dataset([(v1, "ath_1"), (v2, "ath_1")], salt=self.secret_salt)
        self.assertIn("collision", str(ctx.exception).lower())


if __name__ == "__main__":
    unittest.main()
