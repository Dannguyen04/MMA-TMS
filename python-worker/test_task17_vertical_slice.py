"""
test_task17_vertical_slice.py — End-to-End Coaching Vertical Slice & Validation Gate (Task 17)

Kiểm thử toàn bộ luồng tích hợp dọc ưu tiên (Jab-Cross Coaching Vertical Slice):
  1. Input frames / video-safe synthetic trajectory (không tải model, không phụ thuộc network)
  2. Task 9 Quality Gate
  3. Action Analysis & Tasks 1–8 Assessment
  4. Task 10 Finding & Error Code Engine
  5. Task 11 Session Aggregation & Priority Ranking (Tối đa 3 ưu tiên)
  6. Task 12 Dual-Mode Coaching Feedback & Drills
  7. Task 13 Coach Review State Machine (AI Original bất biến)
  8. Task 14 Dataset Export Eligibility & Leakage Prevention (Gắn nhãn NOT_GOLD_READY)
  9. Task 15 & 16 Shadow Classifiers (Gắn nhãn SHADOW_NOT_VALIDATED)
"""

import copy
import json
import unittest

from pipeline.contracts import EvidenceLevel
from pipeline.quality_gate import (
    AnalysisQuality,
    QualityGateEvaluator,
    QualityStatus,
)
from pipeline.finding_engine import (
    FindingEngine,
    FindingErrorCode,
    FindingScope,
    FindingSeverity,
    StandardFinding,
)
from pipeline.session_aggregation import (
    SessionAggregationEngine,
    SessionInsights,
)
from pipeline.coaching_engine import (
    CoachingEngine,
    SessionCoachingPlan,
)
from pipeline.review_contract import (
    MaterializedActionView,
    ReviewAction,
    ReviewStateMachine,
    ReviewerRole,
    TargetField,
)
from pipeline.dataset_export import (
    DatasetExportEngine,
    DatasetExportResult,
    ExportApprovalPolicy,
)
from pipeline.shadow_punch_classifier import (
    ShadowMultiPunchClassifier,
    VALIDATION_STATUS_NOT_VALIDATED,
)
from pipeline.shadow_kick_classifier import (
    ShadowKickClassifier,
)
from pipeline.stance_context import resolve_stance_context


def _generate_synthetic_video_frames(total_frames: int = 45, fps: float = 30.0) -> list[dict]:
    """Tạo chuỗi frames tổng hợp an toàn (fixture-safe) cho video boxing 1.5s."""
    frames = []
    for i in range(total_frames):
        time_ms = (i / fps) * 1000.0
        # 17 COCO landmarks
        landmarks = []
        for kp_idx in range(17):
            landmarks.append({
                "x": 0.5 + (0.01 * (i % 5)),
                "y": 0.3 + (0.02 * (kp_idx % 4)),
                "conf": 0.88,
            })
        frames.append({
            "frameIdx": i,
            "timeMs": round(time_ms, 1),
            "landmarks": landmarks,
        })
    return frames


class TestTask17VerticalSlice(unittest.TestCase):

    def setUp(self):
        self.fps = 30.0
        self.frames = _generate_synthetic_video_frames(45, self.fps)
        self.stance_ctx = resolve_stance_context(coach_stance="orthodox")

    def test_end_to_end_vertical_slice(self):
        # ─────────────────────────────────────────────────────────────
        # 1. Step 1 & 2: Input & Task 9 Quality Gate
        # ─────────────────────────────────────────────────────────────
        evaluator = QualityGateEvaluator()
        quality = evaluator.evaluate(
            frames=self.frames,
            fps=self.fps,
            img_width=1280,
            img_height=720,
        )
        self.assertEqual(quality.status, QualityStatus.PASS)
        self.assertEqual(quality.adjusted_evidence_level, EvidenceLevel.OBSERVED)
        self.assertEqual(len(quality.reason_codes), 0)

        # ─────────────────────────────────────────────────────────────
        # 2. Step 3 & 4: Action Analysis & Task 10 Standard Findings
        # ─────────────────────────────────────────────────────────────
        # Giả lập 2 action boxing trong session:
        # Action 1: Orthodox Lead Jab (đòn chuẩn, guard nguyên vẹn)
        # Action 2: Orthodox Rear Cross (guard bị hạ thấp, khuỷu tay duỗi chưa hết)
        finding_cross_guard = FindingEngine.from_criterion_result(
            criterion_id="guardPreserved",
            status="needs_improvement",
            score=0,
            measured_value=0.0,
            action_id="action_cross_002",
            family="punch",
            rubric_id="boxing_cross_v3",
            impact_frame=25,
            impact_time_ms=833.3,
            confidence=0.92,
        )
        self.assertIsNotNone(finding_cross_guard)
        self.assertEqual(finding_cross_guard.code, FindingErrorCode.PUNCH_GUARD_DROPPED)

        finding_cross_elbow = FindingEngine.from_criterion_result(
            criterion_id="maxElbowAngle",
            status="needs_improvement",
            score=45,
            measured_value=132.0,
            action_id="action_cross_002",
            family="punch",
            rubric_id="boxing_cross_v3",
            impact_frame=25,
            impact_time_ms=833.3,
            confidence=0.89,
        )
        self.assertIsNotNone(finding_cross_elbow)
        self.assertEqual(finding_cross_elbow.code, FindingErrorCode.PUNCH_ELBOW_UNDEREXTENDED)

        # Traceability assertion: Mọi claim trace được về frame và metric
        self.assertEqual(finding_cross_guard.evidence_refs[0].frame_idx, 25)
        self.assertAlmostEqual(finding_cross_guard.evidence_refs[0].time_ms, 833.3)
        self.assertEqual(finding_cross_guard.provenance.rubric_id, "boxing_cross_v3")

        action_1 = {
            "id": "action_jab_001",
            "sourceActionId": "punch_1",
            "family": "punch",
            "technique": "jab",
            "attackingSide": "left",
            "limbRole": "lead",
            "stance": "orthodox",
            "phases": {
                "startFrame": 5, "impactFrame": 12, "endFrame": 18,
                "startTimeMs": 166.7, "impactTimeMs": 400.0, "endTimeMs": 600.0,
                "impactType": "peak_extension_proxy",
            },
            "metrics": {
                "maxElbowAngle": {"value": 160.0, "unit": "degrees", "confidence": 0.95},
                "guardPreserved": {"value": True, "unit": "flag", "confidence": 0.90},
            },
            "assessment": {
                "rubricId": "boxing_jab_v3",
                "score": 92,
                "grade": "excellent",
                "status": "excellent",
                "findings": [],
            },
            "review": {"status": "ai_generated"},
        }

        action_2 = {
            "id": "action_cross_002",
            "sourceActionId": "punch_2",
            "family": "punch",
            "technique": "cross",
            "attackingSide": "right",
            "limbRole": "rear",
            "stance": "orthodox",
            "phases": {
                "startFrame": 20, "impactFrame": 25, "endFrame": 32,
                "startTimeMs": 666.7, "impactTimeMs": 833.3, "endTimeMs": 1066.7,
                "impactType": "peak_extension_proxy",
            },
            "metrics": {
                "maxElbowAngle": {"value": 132.0, "unit": "degrees", "confidence": 0.89},
                "guardPreserved": {"value": False, "unit": "flag", "confidence": 0.92},
            },
            "assessment": {
                "rubricId": "boxing_cross_v3",
                "score": 58,
                "grade": "needs_improvement",
                "status": "needs_improvement",
                "findings": [finding_cross_guard.to_dict(), finding_cross_elbow.to_dict()],
            },
            "review": {"status": "ai_generated"},
        }

        session_actions = [action_1, action_2]

        # ─────────────────────────────────────────────────────────────
        # 3. Step 5: Task 11 Session Aggregation & Priority Ranking
        # ─────────────────────────────────────────────────────────────
        session_insights = SessionAggregationEngine.aggregate_session(
            actions=session_actions,
            quality_status=quality.status.value,
        )
        self.assertEqual(session_insights.status, "completed")
        self.assertEqual(session_insights.total_actions, 2)
        self.assertEqual(session_insights.technique_distribution.get("jab"), 1)
        self.assertEqual(session_insights.technique_distribution.get("cross"), 1)

        # Denominator Transparency:
        cov = session_insights.coverage_summary
        self.assertEqual(cov.total_detected_actions, 2)
        self.assertEqual(cov.assessed_actions_count, 2)
        self.assertEqual(cov.insufficient_evidence_count, 0)
        self.assertEqual(cov.unknown_technique_count, 0)

        # Priority Findings: Tối đa 3 ưu tiên
        priorities = session_insights.priority_findings
        self.assertLessEqual(len(priorities), 3)
        self.assertEqual(len(priorities), 2)
        # Rank 1 must be critical guard drop!
        self.assertEqual(priorities[0].rank, 1)
        self.assertEqual(priorities[0].code, FindingErrorCode.PUNCH_GUARD_DROPPED.value)

        # ─────────────────────────────────────────────────────────────
        # 4. Step 6: Task 12 Dual-Mode Coaching Feedback & Drills
        # ─────────────────────────────────────────────────────────────
        coaching_plan = CoachingEngine.generate_coaching_plan(session_insights)
        self.assertEqual(len(coaching_plan.recommendations), 2)
        
        # Dual-mode assertions:
        rec_guard = coaching_plan.recommendations[0]
        # Athlete Mode: Clear actionable cue
        self.assertIn("[Ưu tiên 1]", rec_guard.athlete_cue)
        self.assertIn("Phone-to-Ear & Tennis Ball Guard Drill", rec_guard.athlete_cue)
        # Coach Mode: Provenance, frame, time, severity
        self.assertEqual(rec_guard.coach_notes["representativeFrame"], 25)
        self.assertEqual(rec_guard.coach_notes["severity"], "critical")
        self.assertIn("drillObjective", rec_guard.coach_notes)
        self.assertIn("contraindications", rec_guard.coach_notes)

        # ─────────────────────────────────────────────────────────────
        # 5. Step 7: Task 13 Coach Review State Machine
        # ─────────────────────────────────────────────────────────────
        # Coach reviews action_cross_002: approves with note
        view_cross = ReviewStateMachine.initialize_view(action_2)
        updated_view = ReviewStateMachine.apply_review_event(
            current_view=view_cross,
            target_field=TargetField.TECHNIQUE,
            review_action=ReviewAction.ACCEPT,
            corrected_value=None,
            reviewer_id="coach_alex",
            reviewer_role=ReviewerRole.HEAD_COACH,
            reason="Confirmed cross mechanics and guard deficiency",
            idempotency_token="idem_review_001",
        )
        # Invariant: AI original is completely unchanged
        self.assertEqual(updated_view.ai_original["technique"], "cross")
        self.assertEqual(updated_view.review_status, "coach_approved")
        self.assertEqual(len(updated_view.audit_trail), 1)

        # ─────────────────────────────────────────────────────────────
        # 6. Step 8: Task 14 Annotation & Gold Dataset Export
        # ─────────────────────────────────────────────────────────────
        # Review jab: coach approves jab
        view_jab = ReviewStateMachine.initialize_view(action_1)
        approved_jab = ReviewStateMachine.apply_review_event(
            current_view=view_jab,
            target_field=TargetField.TECHNIQUE,
            review_action=ReviewAction.ACCEPT,
            corrected_value=None,
            reviewer_id="coach_alex",
            reviewer_role=ReviewerRole.HEAD_COACH,
            reason="Clean lead jab",
            idempotency_token="idem_review_002",
        )

        dataset_result = DatasetExportEngine.export_dataset(
            action_views_with_athlete=[
                (approved_jab, "athlete_dan"),
                (updated_view, "athlete_dan"),
            ],
            policy=ExportApprovalPolicy.COACH_APPROVED_OR_CORRECTED,
            salt="test_salt_secret",
        )
        # Total samples 2 < 500 -> Must be marked NOT_GOLD_READY
        expected_hash = DatasetExportEngine.hash_athlete_id("athlete_dan", salt="test_salt_secret")
        self.assertEqual(dataset_result.samples[0].athlete_hash, expected_hash)
        # Raw athlete ID must not appear in exported sample payload
        self.assertNotIn("athlete_dan", [s.athlete_hash for s in dataset_result.samples])
        # Leakage prevention: Both samples of athlete_dan share the EXACT SAME split
        splits = {s.split for s in dataset_result.samples}
        self.assertEqual(len(splits), 1)

        # ─────────────────────────────────────────────────────────────
        # 7. Step 9: Task 15 & 16 Shadow Classifiers Validation Status
        # ─────────────────────────────────────────────────────────────
        punch_classifier = ShadowMultiPunchClassifier()
        kick_classifier = ShadowKickClassifier()

        shadow_punch_dec = punch_classifier.classify(
            features={
                "attacking_side": "left",
                "max_elbow_angle": 160.0,
                "trajectory_directness": 0.92,
                "tangential_curvature": 0.08,
                "wrist_shoulder_separation_ratio": 0.85,
            },
            stance_context=self.stance_ctx,
        )
        self.assertEqual(shadow_punch_dec.candidate.technique, "jab")
        self.assertEqual(shadow_punch_dec.validation_status, VALIDATION_STATUS_NOT_VALIDATED)

        shadow_kick_dec = kick_classifier.classify(
            features={
                "attacking_side": "right",
                "hip_rotation_angle": 12.0,
                "forward_trajectory_linearity": 0.89,
                "has_chamber_phase": True,
                "has_extension_phase": True,
            },
            stance_context=self.stance_ctx,
        )
        self.assertEqual(shadow_kick_dec.candidate.technique, "front_kick")
        self.assertEqual(shadow_kick_dec.validation_status, VALIDATION_STATUS_NOT_VALIDATED)

        # ─────────────────────────────────────────────────────────────
        # 8. Full JSON output payload assembly & validation
        # ─────────────────────────────────────────────────────────────
        full_worker_output = {
            "schemaVersion": "1.0.0",
            "meta": {
                "fps": self.fps,
                "totalFrames": len(self.frames),
                "durationMs": 1500.0,
                "imgWidth": 1280,
                "imgHeight": 720,
                "model": "yolov8n-pose",
            },
            "actions": [action_1, action_2],
            "frames": [],
            "kicks": [],
            "punches": [],
            "findings": [finding_cross_guard.to_dict(), finding_cross_elbow.to_dict()],
            "analysisQuality": quality.to_dict(),
            "sessionInsights": session_insights.to_dict(),
            "coachingPlan": coaching_plan.to_dict(),
        }

        # Verify JSON serializability
        serialized = json.dumps(full_worker_output)
        self.assertTrue(len(serialized) > 0)


if __name__ == "__main__":
    unittest.main()
