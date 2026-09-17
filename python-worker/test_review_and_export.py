"""
test_review_and_export.py — Unit, Invariant, and Leakage Tests for Tasks 13 & 14
"""

import copy
import json
import unittest

from pipeline.dataset_export import (
    DatasetExportEngine,
    ExportApprovalPolicy,
    DatasetSplit,
)
from pipeline.review_contract import (
    MaterializedActionView,
    ReviewAction,
    ReviewAuditRecord,
    ReviewStateMachine,
    ReviewerRole,
    TargetField,
)


def _make_dummy_ai_action(action_id: str, technique: str = "jab") -> dict:
    return {
        "id": action_id,
        "sourceActionId": f"{action_id}_detector",
        "family": "punch",
        "technique": technique,
        "attackingSide": "left",
        "limbRole": "lead",
        "stance": "orthodox",
        "phases": {
            "startFrame": 10,
            "impactFrame": 20,
            "endFrame": 30,
            "startTimeMs": 333.3,
            "impactTimeMs": 666.7,
            "endTimeMs": 1000.0,
        },
        "metrics": {
            "maxElbowAngle": {"value": 155.0, "unit": "degrees", "confidence": 0.9}
        },
        "assessment": {
            "rubricId": "boxing_jab_v3",
            "score": 85,
            "grade": "good",
            "status": "good",
            "findings": [],
        },
    }


class TestReviewAndAuditContract(unittest.TestCase):

    def test_ai_original_preservation_invariant(self):
        ai_action = _make_dummy_ai_action("act_001", "jab")
        view = ReviewStateMachine.initialize_view(ai_action)
        orig_technique_in_ai = view.ai_original["technique"]

        # Apply coach correction: change technique from 'jab' to 'hook'
        updated_view = ReviewStateMachine.apply_review_event(
            current_view=view,
            target_field=TargetField.TECHNIQUE,
            review_action=ReviewAction.CORRECT,
            corrected_value="hook",
            reviewer_id="coach_dan",
            reviewer_role=ReviewerRole.COACH,
            reason="Curved horizontal trajectory observed on video",
            idempotency_token="token_001",
        )

        # Invariant: AI original is completely unchanged!
        self.assertEqual(updated_view.ai_original["technique"], orig_technique_in_ai)
        self.assertEqual(updated_view.ai_original["technique"], "jab")
        # Invariant: Effective technique in materialized view is updated!
        self.assertEqual(updated_view.effective_technique, "hook")
        self.assertEqual(updated_view.review_status, "coach_corrected")
        self.assertEqual(len(updated_view.audit_trail), 1)

    def test_idempotency_token(self):
        ai_action = _make_dummy_ai_action("act_002", "cross")
        view = ReviewStateMachine.initialize_view(ai_action)

        token = "unique_req_12345"
        v1 = ReviewStateMachine.apply_review_event(
            current_view=view,
            target_field=TargetField.TECHNIQUE,
            review_action=ReviewAction.ACCEPT,
            corrected_value=None,
            reviewer_id="coach_mike",
            reviewer_role=ReviewerRole.HEAD_COACH,
            reason="Confirmed clean straight punch",
            idempotency_token=token,
        )
        self.assertEqual(len(v1.audit_trail), 1)

        # Apply exact same token again
        v2 = ReviewStateMachine.apply_review_event(
            current_view=v1,
            target_field=TargetField.TECHNIQUE,
            review_action=ReviewAction.ACCEPT,
            corrected_value=None,
            reviewer_id="coach_mike",
            reviewer_role=ReviewerRole.HEAD_COACH,
            reason="Confirmed clean straight punch",
            idempotency_token=token,
        )
        # Audit record is NOT duplicated
        self.assertEqual(len(v2.audit_trail), 1)
        self.assertEqual(v1, v2)

    def test_review_rejection(self):
        ai_action = _make_dummy_ai_action("act_003", "cross")
        view = ReviewStateMachine.initialize_view(ai_action)

        rejected = ReviewStateMachine.apply_review_event(
            current_view=view,
            target_field=TargetField.TECHNIQUE,
            review_action=ReviewAction.REJECT,
            corrected_value=None,
            reviewer_id="coach_dan",
            reviewer_role=ReviewerRole.COACH,
            reason="Not an intentional strike (arm reset motion)",
            idempotency_token="reject_token_99",
        )
        self.assertEqual(rejected.review_status, "coach_rejected")


class TestDatasetExport(unittest.TestCase):

    def test_dataset_export_filtering_and_not_gold_ready(self):
        # Setup 3 actions: 1 approved, 1 corrected, 1 rejected
        a1 = _make_dummy_ai_action("a1", "jab")
        v1 = ReviewStateMachine.initialize_view(a1)
        v1_approved = ReviewStateMachine.apply_review_event(
            v1, TargetField.TECHNIQUE, ReviewAction.ACCEPT, None,
            "c1", ReviewerRole.COACH, "OK", "tok1"
        )

        a2 = _make_dummy_ai_action("a2", "cross")
        v2 = ReviewStateMachine.initialize_view(a2)
        v2_corrected = ReviewStateMachine.apply_review_event(
            v2, TargetField.TECHNIQUE, ReviewAction.CORRECT, "cross",
            "c1", ReviewerRole.COACH, "Confirmed", "tok2"
        )

        a3 = _make_dummy_ai_action("a3", "jab")
        v3 = ReviewStateMachine.initialize_view(a3)
        v3_rejected = ReviewStateMachine.apply_review_event(
            v3, TargetField.TECHNIQUE, ReviewAction.REJECT, None,
            "c1", ReviewerRole.COACH, "False detection", "tok3"
        )

        dataset = DatasetExportEngine.export_dataset(
            action_views_with_athlete=[
                (v1_approved, "athlete_alice"),
                (v2_corrected, "athlete_bob"),
                (v3_rejected, "athlete_alice"),
            ],
            policy=ExportApprovalPolicy.COACH_APPROVED_OR_CORRECTED,
            salt="test_salt_secret",
        )

        # Rejected action a3 must NOT be exported!
        self.assertEqual(dataset.manifest.total_samples, 2)
        exported_ids = [s.sample_id for s in dataset.samples]
        self.assertEqual(len(exported_ids), 2)

        # Total samples 2 < 500 -> Must be marked NOT_GOLD_READY
        self.assertFalse(dataset.manifest.is_gold_ready)
        self.assertEqual(dataset.manifest.status, "NOT_GOLD_READY")

    def test_athlete_group_split_prevents_leakage(self):
        # 10 actions from the SAME athlete
        actions = []
        for i in range(10):
            a = _make_dummy_ai_action(f"act_{i}", "jab")
            v = ReviewStateMachine.initialize_view(a)
            app = ReviewStateMachine.apply_review_event(
                v, TargetField.TECHNIQUE, ReviewAction.ACCEPT, None,
                "c1", ReviewerRole.COACH, "OK", f"t_{i}"
            )
            actions.append((app, "athlete_isolated_99"))

        dataset = DatasetExportEngine.export_dataset(actions, salt="test_salt_secret")
        self.assertEqual(dataset.manifest.total_samples, 10)

        # All 10 samples must have the EXACT SAME split
        assigned_splits = {s.split for s in dataset.samples}
        self.assertEqual(len(assigned_splits), 1, "Data leakage! Athlete samples distributed across multiple splits")

    def test_json_safe_export(self):
        a = _make_dummy_ai_action("act_json", "jab")
        v = ReviewStateMachine.initialize_view(a)
        app = ReviewStateMachine.apply_review_event(
            v, TargetField.TECHNIQUE, ReviewAction.ACCEPT, None,
            "c1", ReviewerRole.COACH, "OK", "t_json"
        )
        res = DatasetExportEngine.export_dataset([(app, "athlete_x")], salt="test_salt_secret")
        d = res.to_dict()
        serialized = json.dumps(d)
        deserialized = json.loads(serialized)
        self.assertIn("manifest", deserialized)
        self.assertIn("samples", deserialized)
        self.assertEqual(deserialized["manifest"]["status"], "NOT_GOLD_READY")


if __name__ == "__main__":
    unittest.main()

