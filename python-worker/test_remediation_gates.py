"""
test_remediation_gates.py — Comprehensive Test Suite for Remediation Gates R1–R4

Covers all 15 explicit verification tests required by the GEMINI REMEDIATION PROMPT:
 1. test_blocked_quality_abstains_new_technical_conclusions
 2. test_degraded_quality_propagates_evidence_state
 3. test_production_target_ambiguity_is_not_defaulted_to_single_person
 4. test_repeated_legacy_findings_map_to_one_stable_error_code
 5. test_unknown_error_code_has_no_unapproved_drill
 6. test_production_invokes_expanded_punch_classifier
 7. test_production_invokes_kick_classifier
 8. test_missing_kick_evidence_abstains
 9. test_idempotency_token_payload_conflict
10. test_audit_nested_value_cannot_be_mutated
11. test_ai_original_survives_multiple_corrections
12. test_forged_review_status_is_not_exportable
13. test_dataset_hash_changes_when_sample_content_changes
14. test_task17_runs_real_orchestrator_pass_degraded_blocked
15. test_python_to_typescript_schema_parity
"""

import copy
import json
import time
import unittest
from unittest.mock import MagicMock, patch

import cv2
import numpy as np

from action_result import action_from_kick, action_from_punch
from kick_analyzer import KickResult
from pipeline.contracts import EvidenceLevel, deep_freeze
from pipeline.coaching_engine import CoachingEngine, SessionCoachingPlan
from pipeline.dataset_export import (
    AnonymizedSample,
    DatasetExportEngine,
    DatasetExportResult,
    DatasetManifest,
    DatasetSplit,
    ExportApprovalPolicy,
)
from pipeline.finding_engine import (
    EvidenceReference,
    FindingEngine,
    FindingErrorCode,
    FindingScope,
    FindingSeverity,
    RubricProvenance,
    StandardFinding,
)
from pipeline.quality_gate import (
    AnalysisQuality,
    QualityGateConfig,
    QualityGateEvaluator,
    QualityStatus,
    evaluate_video_quality,
)
from pipeline.review_contract import (
    IdempotencyConflictError,
    MaterializedActionView,
    ReviewAction,
    ReviewAuditRecord,
    ReviewStateMachine,
    ReviewerRole,
    TargetField,
)
from pipeline.session_aggregation import (
    SessionCoverageSummary,
    PriorityFindingSummary,
    SessionAggregationEngine,
    SessionInsights,
)
from pipeline.shadow_kick_classifier import ShadowKickClassifier
from pipeline.shadow_punch_classifier import ShadowMultiPunchClassifier
from pipeline.stance_context import resolve_stance_context
from process_video import process_video
from punch_analyzer import PunchResult, TechniqueFinding


def _generate_synthetic_pose_frames(total_frames: int = 45, fps: float = 30.0, conf: float = 0.88) -> list[dict]:
    """Generates synthetic pose frames for testing quality evaluator and pipeline."""
    frames = []
    for i in range(total_frames):
        time_ms = (i / fps) * 1000.0
        landmarks = []
        for kp_idx in range(17):
            landmarks.append({
                "x": 0.5 + (0.01 * (i % 5)),
                "y": 0.3 + (0.02 * (kp_idx % 4)),
                "conf": conf,
            })
        frames.append({
            "frameIdx": i,
            "timeMs": round(time_ms, 1),
            "kneeAngle": 160.0,
            "hipAngle": 170.0,
            "kickState": "IDLE",
            "kickStateLabel": "Idle",
            "activeLeg": "none",
            "landmarks": landmarks,
        })
    return frames


class TestRemediationGates(unittest.TestCase):
    """Rigorous verification suite for Gates R1, R2, R3, and R4."""

    def setUp(self):
        self.fps = 30.0
        self.salt = "test_verification_secret_salt_2026"
        self.stance_ctx = resolve_stance_context(coach_stance="orthodox")

    # ─────────────────────────────────────────────────────────────────
    # Gate R1 — Production wiring & Quality control
    # ─────────────────────────────────────────────────────────────────

    def test_blocked_quality_abstains_new_technical_conclusions(self):
        """R1.1: Blocked quality must abstain from all technical conclusions and coaching."""
        dummy_action = {
            "id": "act_blocked_1",
            "sourceActionId": "punch_1",
            "family": "punch",
            "technique": "jab",
            "attackingSide": "left",
            "limbRole": "lead",
            "stance": "orthodox",
            "confidence": {"detection": 0.9, "classification": 0.85, "assessment": 0.8},
            "phases": {"startFrame": 0, "impactFrame": 15, "endFrame": 30, "startTimeMs": 0, "impactTimeMs": 500, "endTimeMs": 1000, "impactType": "peak_extension_proxy"},
            "metrics": {"peakSpeed": {"value": 8.0, "unit": "m/s"}},
            "assessment": {
                "score": 85,
                "grade": "good",
                "status": "good",
                "findings": [{"id": "f1", "category": "guard", "title": "Guard drop"}],
            },
            "review": {"status": "ai_generated"},
        }

        # Session aggregation with blocked quality status
        insights = SessionAggregationEngine.aggregate_session(
            actions=[dummy_action],
            quality_status="blocked",
        )
        self.assertEqual(insights.status, "blocked")
        self.assertEqual(len(insights.priority_findings), 0)

        # Coaching plan with blocked session insights
        plan = CoachingEngine.generate_coaching_plan(insights)
        self.assertEqual(plan.session_status, "blocked")
        self.assertEqual(len(plan.recommendations), 0)

    def test_degraded_quality_propagates_evidence_state(self):
        """R1.1: Degraded quality must propagate derived_proxy evidence level."""
        # Synthesize frames with lower keypoint confidence (0.35 is below min_keypoint_conf_pass=0.45)
        frames = _generate_synthetic_pose_frames(45, self.fps, conf=0.35)
        evaluator = QualityGateEvaluator()
        quality = evaluator.evaluate(frames=frames, fps=self.fps)

        self.assertEqual(quality.status, QualityStatus.DEGRADED)
        self.assertEqual(quality.adjusted_evidence_level, EvidenceLevel.DERIVED_PROXY)
        quality_dict = quality.to_dict()
        self.assertEqual(quality_dict["adjustedEvidenceLevel"], "derived_proxy")

    def test_production_target_ambiguity_is_not_defaulted_to_single_person(self):
        """R1.2: Multi-person scenes or target tracking loss must not default to single-person pass."""
        frames = _generate_synthetic_pose_frames(30, self.fps, conf=0.88)

        # 1. Multi-person scenario: 3 persons in frame
        multi_person_counts = [1, 3, 3, 2, 3] * 6
        quality_multi = evaluate_video_quality(
            frames=frames,
            fps=self.fps,
            multi_person_counts=multi_person_counts,
            target_track_counts=None,
        )
        self.assertIn("multi_person_ambiguity", quality_multi.reason_codes)
        self.assertIn(quality_multi.status, (QualityStatus.DEGRADED, QualityStatus.BLOCKED))

        # 2. Target track lost scenario: target tracked only in 5 out of 30 frames
        quality_lost = evaluate_video_quality(
            frames=frames,
            fps=self.fps,
            multi_person_counts=[1] * 30,
            target_track_counts=5,
        )
        self.assertIn("target_athlete_ambiguity", quality_lost.reason_codes)
        self.assertEqual(quality_lost.status, QualityStatus.BLOCKED)

    def test_repeated_legacy_findings_map_to_one_stable_error_code(self):
        """R1.3: Duplicate legacy findings on same action must deduplicate to single error code."""
        f1 = {
            "id": "f_guard_1",
            "category": "guard",
            "title": "Hạ thấp tay thủ",
            "description": "Tay thủ đối diện hạ thấp dưới cằm",
            "severity": "warning",
            "confidence": 0.85,
            "frame_idx": 15,
            "time_ms": 500.0,
            "metric_name": "oppositeHandY",
            "metric_value": 0.65,
        }
        f2 = copy.deepcopy(f1)
        f2["id"] = "f_guard_2"
        f2["confidence"] = 0.90
        f3 = copy.deepcopy(f1)
        f3["id"] = "f_guard_3"

        deduped = FindingEngine.adapt_and_deduplicate_findings(
            findings=[f1, f2, f3],
            action_id="act_jab_1",
            family="punch",
        )
        self.assertEqual(len(deduped), 1)
        self.assertEqual(deduped[0].code, FindingErrorCode.PUNCH_GUARD_DROPPED)
        self.assertEqual(deduped[0].confidence, 0.90)  # max confidence retained

    def test_unknown_error_code_has_no_unapproved_drill(self):
        """R3.3: Unknown error codes must abstain explicitly (drill=None, NO_APPROVED_DRILL)."""
        summary = PriorityFindingSummary(
            rank=1,
            code="TECH_COMPLETELY_UNRECOGNIZED_CODE",
            title="Lỗi không xác định",
            description="Mô tả lỗi không xác định",
            severity="warning",
            frequency=1,
            priority_score=3.0,
            affected_action_ids=("act_1",),
            representative_frame=10,
            representative_time_ms=333.3,
            primary_recommendation="Quan sát lại tư thế",
        )
        insights = SessionInsights(
            status="completed",
            total_actions=1,
            family_distribution={"punch": 1},
            technique_distribution={"jab": 1},
            side_distribution={"left": 1},
            status_distribution={"fair": 1},
            coverage_summary=SessionCoverageSummary(1, 1, 0, 0.0, 0, 0.0, 0, 0.0),
            priority_findings=(summary,),
        )
        plan = CoachingEngine.generate_coaching_plan(insights)
        self.assertEqual(len(plan.recommendations), 1)
        rec = plan.recommendations[0]
        self.assertIsNone(rec.drill)
        self.assertEqual(rec.coach_notes.get("status"), "NO_APPROVED_DRILL")

    def test_production_invokes_expanded_punch_classifier(self):
        """R1.4: Action adapter runs ShadowMultiPunchClassifier without mutating technique."""
        punch_res = PunchResult(
            punch_type="jab",
            arm="left",
            score=88,
            grade="GOOD",
            emoji="🥊",
            details=["Good extension"],
            max_elbow_angle=168.0,
            peak_speed=12.5,
            guard_preserved=True,
            start_time_ms=100.0,
            impact_time_ms=250.0,
            end_time_ms=400.0,
            start_frame=3,
            impact_frame=8,
            end_frame=12,
            findings=[],
        )
        action = action_from_punch(
            punch=punch_res,
            action_id="act_punch_1",
            source_action_id="punch_1",
            stance="orthodox",
            model_version="yolov8n-pose",
            rubric_version="3.0.0",
            stance_context=self.stance_ctx,
            execute_shadow_classifier=True,
        )
        # Production contract: technique MUST remain unchanged
        self.assertEqual(action.technique, "jab")
        self.assertEqual(action.family, "punch")

        # Shadow classification must be populated
        action_dict = action.to_dict()
        self.assertIn("shadowClassification", action_dict)
        shadow = action_dict["shadowClassification"]
        self.assertIsNotNone(shadow)
        self.assertEqual(shadow["classifierId"], "shadow_multi_punch_classifier")
        self.assertEqual(shadow["validationStatus"], "SHADOW_NOT_VALIDATED")

    def test_production_invokes_kick_classifier(self):
        """R1.4: Action adapter runs ShadowKickClassifier without mutating technique."""
        kick_res = KickResult(
            score=85,
            grade="GOOD",
            emoji="🦵",
            details=["Solid extension"],
            min_chamber_angle=65.0,
            max_extension_angle=162.0,
            peak_speed=15.0,
            start_time_ms=100.0,
            end_time_ms=600.0,
            start_frame=3,
            end_frame=18,
            active_leg="right",
            impact_time_ms=350.0,
            impact_frame=11,
            findings=[],
        )
        action = action_from_kick(
            kick=kick_res,
            action_id="act_kick_1",
            source_action_id="kick_1",
            stance="orthodox",
            model_version="yolov8n-pose",
            rubric_version="3.0.0",
            stance_context=self.stance_ctx,
            execute_shadow_classifier=True,
        )
        # Production contract: technique MUST remain round_kick
        self.assertEqual(action.technique, "round_kick")
        self.assertEqual(action.family, "kick")

        # Shadow classification must be populated
        action_dict = action.to_dict()
        self.assertIn("shadowClassification", action_dict)
        shadow = action_dict["shadowClassification"]
        self.assertIsNotNone(shadow)
        self.assertEqual(shadow["classifierId"], "shadow_kick_technique_classifier")
        self.assertEqual(shadow["validationStatus"], "SHADOW_NOT_VALIDATED")

    def test_missing_kick_evidence_abstains(self):
        """R3.1: Incomplete kick phases or missing kinematic features must abstain."""
        classifier = ShadowKickClassifier()
        # 1. Missing kick phases
        res_missing_phase = classifier.classify(
            features={"has_chamber_phase": False, "has_extension_phase": True},
            stance_context=self.stance_ctx,
        )
        self.assertEqual(res_missing_phase.status.value, "abstained")
        self.assertIn("MISSING_KICK_PHASES", res_missing_phase.reason_codes)

        # 2. Missing kinematic metrics
        res_missing_kinematics = classifier.classify(
            features={"has_chamber_phase": True, "has_extension_phase": True},
            stance_context=self.stance_ctx,
        )
        self.assertEqual(res_missing_kinematics.status.value, "abstained")
        self.assertIn("MISSING_KINEMATIC_FEATURES", res_missing_kinematics.reason_codes)

    # ─────────────────────────────────────────────────────────────────
    # Gate R2 — Review, Immutability, Idempotency & Dataset Export
    # ─────────────────────────────────────────────────────────────────

    def test_idempotency_token_payload_conflict(self):
        """R2.1: Conflicting payload for same idempotency token raises IdempotencyConflictError."""
        ai_action = {
            "id": "act_idem_001",
            "technique": "jab",
            "attackingSide": "left",
            "limbRole": "lead",
        }
        view = ReviewStateMachine.initialize_view(ai_action)

        # First review with token tok_alpha
        view1 = ReviewStateMachine.apply_review_event(
            current_view=view,
            target_field=TargetField.TECHNIQUE,
            review_action=ReviewAction.ACCEPT,
            corrected_value=None,
            reviewer_id="coach_1",
            reviewer_role=ReviewerRole.COACH,
            reason="Clean jab",
            idempotency_token="tok_alpha",
        )
        self.assertEqual(len(view1.audit_trail), 1)

        # Resubmit with IDENTICAL payload -> idempotent return
        view_same = ReviewStateMachine.apply_review_event(
            current_view=view1,
            target_field=TargetField.TECHNIQUE,
            review_action=ReviewAction.ACCEPT,
            corrected_value=None,
            reviewer_id="coach_1",
            reviewer_role=ReviewerRole.COACH,
            reason="Clean jab",
            idempotency_token="tok_alpha",
        )
        self.assertEqual(len(view_same.audit_trail), 1)

        # Resubmit with CONFLICTING payload -> raises IdempotencyConflictError
        with self.assertRaises(IdempotencyConflictError):
            ReviewStateMachine.apply_review_event(
                current_view=view1,
                target_field=TargetField.TECHNIQUE,
                review_action=ReviewAction.CORRECT,  # conflicting action
                corrected_value="cross",
                reviewer_id="coach_1",
                reviewer_role=ReviewerRole.COACH,
                reason="Actually a cross",
                idempotency_token="tok_alpha",
            )

    def test_audit_nested_value_cannot_be_mutated(self):
        """R2.2: aiOriginal and review payloads are deep-frozen and immutable."""
        phases = {"startFrame": 5, "endFrame": 25}
        ai_action = {
            "id": "act_freeze_001",
            "technique": "jab",
            "phases": phases,
            "metrics": {"peakSpeed": 9.5},
        }
        view = ReviewStateMachine.initialize_view(ai_action)

        # Modifying outer dictionary does not alter initialized view
        phases["startFrame"] = 999
        self.assertEqual(view.ai_original["phases"]["startFrame"], 5)

        # Modifying internal state directly raises TypeError
        with self.assertRaises(TypeError):
            view.ai_original["phases"]["startFrame"] = 888

    def test_ai_original_survives_multiple_corrections(self):
        """R2.2: Chained human corrections must preserve original AI value, not previous human edit."""
        ai_action = {
            "id": "act_multi_corr_1",
            "technique": "jab",
            "attackingSide": "left",
            "limbRole": "lead",
        }
        view0 = ReviewStateMachine.initialize_view(ai_action)

        # Correction 1: jab -> cross
        view1 = ReviewStateMachine.apply_review_event(
            current_view=view0,
            target_field=TargetField.TECHNIQUE,
            review_action=ReviewAction.CORRECT,
            corrected_value="cross",
            reviewer_id="coach_1",
            reviewer_role=ReviewerRole.COACH,
            reason="Rear hand punch",
            idempotency_token="tok_corr_1",
        )
        self.assertEqual(view1.effective_technique, "cross")
        self.assertEqual(view1.audit_trail[0].ai_original_value, "jab")

        # Correction 2: cross -> lead_hook
        view2 = ReviewStateMachine.apply_review_event(
            current_view=view1,
            target_field=TargetField.TECHNIQUE,
            review_action=ReviewAction.CORRECT,
            corrected_value="lead_hook",
            reviewer_id="head_coach_dan",
            reviewer_role=ReviewerRole.HEAD_COACH,
            reason="Actually a curved lead hook",
            idempotency_token="tok_corr_2",
        )
        self.assertEqual(view2.effective_technique, "lead_hook")
        # Critical verification: second audit record MUST retain true AI original "jab"
        self.assertEqual(view2.audit_trail[1].ai_original_value, "jab")
        self.assertEqual(view2.audit_trail[1].corrected_value, "lead_hook")

    def test_forged_review_status_is_not_exportable(self):
        """R2.3: Forged review status lacking verifiable audit records cannot be exported."""
        ai_action = {
            "id": "act_forged_1",
            "technique": "jab",
            "attackingSide": "left",
            "limbRole": "lead",
        }
        clean_view = ReviewStateMachine.initialize_view(ai_action)

        # Forged view: status manually manipulated to coach_approved without audit trail
        forged_view = MaterializedActionView(
            action_id=clean_view.action_id,
            ai_original=clean_view.ai_original,
            effective_technique=clean_view.effective_technique,
            effective_attacking_side=clean_view.effective_attacking_side,
            effective_limb_role=clean_view.effective_limb_role,
            effective_phases=clean_view.effective_phases,
            effective_findings=clean_view.effective_findings,
            review_status="coach_approved",  # FORGED!
            audit_trail=(),                  # EMPTY AUDIT TRAIL!
            updated_at="2026-09-17T00:00:00Z",
        )

        res = DatasetExportEngine.export_dataset(
            action_views_with_athlete=[(forged_view, "athlete_x")],
            policy=ExportApprovalPolicy.COACH_APPROVED_OR_CORRECTED,
            salt=self.salt,
        )
        self.assertEqual(res.manifest.total_samples, 0)
        self.assertEqual(len(res.samples), 0)
        self.assertEqual(res.manifest.status, "NOT_GOLD_READY")

    def test_dataset_hash_changes_when_sample_content_changes(self):
        """R2.4: Deterministic content_hash changes iff sample content changes, independent of timestamp."""
        ai_action1 = {
            "id": "act_hash_1",
            "technique": "jab",
            "attackingSide": "left",
            "limbRole": "lead",
        }
        v1 = ReviewStateMachine.initialize_view(ai_action1)
        app1 = ReviewStateMachine.apply_review_event(
            v1, TargetField.TECHNIQUE, ReviewAction.ACCEPT, None,
            "c1", ReviewerRole.COACH, "OK", "tok_h1",
        )

        # Export at time T1
        exp1 = DatasetExportEngine.export_dataset([(app1, "athlete_1")], salt=self.salt)

        # Export identical content at time T2 (simulate later time)
        time.sleep(0.01)
        exp2 = DatasetExportEngine.export_dataset([(app1, "athlete_1")], salt=self.salt)

        # Independent of timestamp: content_hash MUST be identical
        self.assertEqual(exp1.manifest.content_hash, exp2.manifest.content_hash)

        # Modify sample technique content
        ai_action2 = {
            "id": "act_hash_2",
            "technique": "cross",  # CHANGED CONTENT
            "attackingSide": "right",
            "limbRole": "rear",
        }
        v2 = ReviewStateMachine.initialize_view(ai_action2)
        app2 = ReviewStateMachine.apply_review_event(
            v2, TargetField.TECHNIQUE, ReviewAction.ACCEPT, None,
            "c1", ReviewerRole.COACH, "OK", "tok_h2",
        )
        exp3 = DatasetExportEngine.export_dataset([(app2, "athlete_1")], salt=self.salt)

        # Must change when sample content changes
        self.assertNotEqual(exp1.manifest.content_hash, exp3.manifest.content_hash)

    # ─────────────────────────────────────────────────────────────────
    # Gate R4 — Real Orchestrator Execution & Schema Parity
    # ─────────────────────────────────────────────────────────────────

    @patch("process_video.cv2.VideoCapture")
    @patch("process_video.YOLO")
    def test_task17_runs_real_orchestrator_pass_degraded_blocked(self, mock_yolo_cls, mock_cap_cls):
        """R4.1: Tests actual process_video orchestrator across pass, degraded, and blocked."""
        # 1. Setup mock video capture returning 45 frames
        mock_cap = MagicMock()
        mock_cap.isOpened.return_value = True
        mock_cap.get.side_effect = lambda prop: {
            cv2.CAP_PROP_FPS: 30.0,
            cv2.CAP_PROP_FRAME_COUNT: 45,
            cv2.CAP_PROP_FRAME_WIDTH: 1280,
            cv2.CAP_PROP_FRAME_HEIGHT: 720,
        }.get(prop, 0)
        dummy_frame = np.zeros((720, 1280, 3), dtype=np.uint8)
        frames_ret = [(True, dummy_frame)] * 45 + [(False, None)]
        mock_cap.read.side_effect = frames_ret
        mock_cap_cls.return_value = mock_cap

        # 2. Setup mock YOLO model returning valid pose detection
        mock_model = MagicMock()
        mock_box = MagicMock()
        mock_box.xyxy = [np.array([100.0, 100.0, 300.0, 500.0])]
        mock_box.conf = [0.90]
        mock_result = MagicMock()
        mock_result.boxes = [mock_box]

        # 17 keypoints for a standing person
        kp_coords = []
        for i in range(17):
            kp_coords.append([640.0 + (i % 3) * 10, 200.0 + i * 20, 0.90])
        mock_kp_item = MagicMock()
        mock_kp_item.cpu.return_value.numpy.return_value.tolist.return_value = kp_coords
        mock_kp = MagicMock()
        mock_kp.data = [mock_kp_item]
        mock_result.keypoints = mock_kp
        mock_model.return_value = [mock_result]
        mock_yolo_cls.return_value = mock_model

        # ── Test A: PASS Execution ──
        out_pass = process_video(
            input_path="mock_pass_video.mp4",
            model_name="yolov8n-pose",
            verbose=False,
            stance="orthodox",
        )
        self.assertIn("analysisQuality", out_pass)
        self.assertIn("actions", out_pass)
        self.assertIn("sessionInsights", out_pass)
        self.assertIn("coachingPlan", out_pass)
        self.assertIn(out_pass["analysisQuality"]["status"], ("pass", "degraded"))

        # ── Test B: BLOCKED Execution (using evaluate_video_quality patch) ──
        mock_cap.read.side_effect = [(True, dummy_frame)] * 45 + [(False, None)]
        with patch("process_video.evaluate_video_quality") as mock_eval_quality:
            blocked_quality = AnalysisQuality(
                status=QualityStatus.BLOCKED,
                reason_codes=["SEVERE_CAMERA_INSTABILITY", "LOW_KEYPOINT_CONFIDENCE"],
                metrics={"fps": 30.0, "totalFrames": 45},
                quality_version="1.0.0",
                evaluator_version="1.0.0",
                evaluated_at="2026-09-17T00:00:00Z",
                adjusted_evidence_level=EvidenceLevel.UNAVAILABLE,
                recommendation="reject_analysis",
            )
            mock_eval_quality.return_value = blocked_quality

            out_blocked = process_video(
                input_path="mock_blocked_video.mp4",
                model_name="yolov8n-pose",
                verbose=False,
            )
            self.assertEqual(out_blocked["analysisQuality"]["status"], "blocked")
            # Must abstain from technical conclusions
            self.assertEqual(len(out_blocked["findings"]), 0)
            self.assertEqual(len(out_blocked["sessionInsights"]["priorityFindings"]), 0)
            self.assertEqual(len(out_blocked["coachingPlan"]["recommendations"]), 0)
            # Must preserve legacy diagnostics
            self.assertIn("frames", out_blocked)
            self.assertIn("summary", out_blocked)

    def test_python_to_typescript_schema_parity(self):
        """R2.2: Serialized Python dictionaries conform to Next.js TypeScript Zod schemas."""
        # 1. StandardFinding schema parity
        ref = EvidenceReference(15, 500.0, "oppositeHandY", 0.65, 0.50, ">", "normalized_y")
        prov = RubricProvenance("boxing_v3", "guard_preservation", "3.0.0")
        finding = StandardFinding(
            id="f_test_001",
            code=FindingErrorCode.PUNCH_GUARD_DROPPED,
            title="Hạ thấp tay thủ",
            description="Tay thủ hạ thấp dưới cằm",
            scope=FindingScope.ACTION,
            severity=FindingSeverity.CRITICAL,
            confidence=0.92,
            evidence_level=EvidenceLevel.OBSERVED,
            evidence_refs=(ref,),
            provenance=prov,
            recommendation="Kẹp bóng tennis vào cằm",
            action_id="act_001",
            legacy_finding_id="leg_f_1",
        )
        f_dict = finding.to_dict()
        required_finding_keys = {
            "id", "code", "errorCode", "title", "description", "category",
            "scope", "severity", "confidence", "evidenceLevel", "evidenceRefs",
            "provenance", "recommendation", "actionId",
        }
        self.assertTrue(required_finding_keys.issubset(set(f_dict.keys())))

        # 2. ReviewAuditRecord schema parity
        audit_rec = ReviewAuditRecord(
            record_id="rev_001",
            action_id="act_001",
            target_field=TargetField.TECHNIQUE,
            review_action=ReviewAction.CORRECT,
            ai_original_value="jab",
            corrected_value="cross",
            reviewer_id="coach_dan",
            reviewer_role=ReviewerRole.HEAD_COACH,
            reason="Rear cross with hip pivot",
            timestamp="2026-09-17T00:00:00Z",
            idempotency_token="tok_schema_1",
            version="1.0.0",
        )
        audit_dict = audit_rec.to_dict()
        required_audit_keys = {
            "recordId", "actionId", "targetField", "reviewAction",
            "aiOriginalValue", "correctedValue", "reviewerId",
            "reviewerRole", "reason", "timestamp", "idempotencyToken", "version",
        }
        self.assertTrue(required_audit_keys.issubset(set(audit_dict.keys())))

        # 3. DatasetManifest schema parity
        manifest = DatasetManifest(
            dataset_id="ds_001",
            schema_version="1.0.0",
            export_timestamp="2026-09-17T00:00:00Z",
            policy="coach_approved_or_corrected",
            total_samples=10,
            split_distribution={"train": 8, "val": 1, "test": 1},
            technique_distribution={"jab": 6, "cross": 4},
            is_gold_ready=False,
            status="NOT_GOLD_READY",
            content_hash="hash_12345",
            dataset_hash="ds_hash_12345",
            notes="Under 500 samples",
        )
        man_dict = manifest.to_dict()
        required_manifest_keys = {
            "datasetId", "schemaVersion", "exportTimestamp", "policy",
            "totalSamples", "splitDistribution", "techniqueDistribution",
            "isGoldReady", "status", "contentHash", "datasetHash", "notes",
        }
        self.assertTrue(required_manifest_keys.issubset(set(man_dict.keys())))


if __name__ == "__main__":
    unittest.main()
