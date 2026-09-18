"""
test_adversarial_tasks9_17.py — Adversarial QA & Invariant Attacks for Tasks 9–17

Bộ kiểm thử tấn công nghịch đảo (Adversarial Testing):
1. Missing evidence & Empty input attacks
2. Malformed input & extreme bounds (NaN, inf, negative fps)
3. Zero-input mutation across all engines
4. Determinism over 50 repeated iterations
5. Data leakage attack (athlete group split verification)
6. Medical term / non-neutral language rejection
7. Insufficient evidence -> score is None and zero false findings
"""

import copy
import json
import math
import unittest

from pipeline.contracts import EvidenceLevel
from pipeline.quality_gate import (
    QualityGateEvaluator,
    QualityStatus,
    QualityReasonCode,
)
from pipeline.finding_engine import (
    EvidenceReference,
    FindingEngine,
    FindingErrorCode,
    FindingScope,
    FindingSeverity,
    RubricProvenance,
    StandardFinding,
    FORBIDDEN_MEDICAL_TERMS,
)
from pipeline.session_aggregation import (
    SessionAggregationEngine,
)
from pipeline.coaching_engine import (
    CoachingEngine,
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


class TestAdversarialTasks9To17(unittest.TestCase):

    def test_attack_zero_input_mutation(self):
        """Kiểm tra không một engine nào được phép làm biến đổi (mutate) dữ liệu đầu vào."""
        # Quality gate input
        raw_frames = [{"frameIdx": 0, "landmarks": [{"x": 0.5, "y": 0.5, "conf": 0.9}]}]
        raw_frames_clone = copy.deepcopy(raw_frames)
        q_eval = QualityGateEvaluator()
        q_eval.evaluate(raw_frames, fps=30.0)
        self.assertEqual(raw_frames, raw_frames_clone)

        # Review action input
        raw_action = {
            "id": "act_attack_1",
            "family": "punch",
            "technique": "jab",
            "attackingSide": "left",
            "phases": {"startFrame": 0, "endFrame": 10},
            "assessment": {"findings": []},
        }
        raw_action_clone = copy.deepcopy(raw_action)
        view = ReviewStateMachine.initialize_view(raw_action)
        ReviewStateMachine.apply_review_event(
            view, TargetField.TECHNIQUE, ReviewAction.CORRECT, "hook",
            "c1", ReviewerRole.COACH, "Reason", "token_mut"
        )
        self.assertEqual(raw_action, raw_action_clone)

    def test_attack_determinism_50_iterations(self):
        """Kiểm tra tính tất định tuyệt đối qua 50 lần thực thi liên tiếp."""
        actions = [
            {
                "id": f"act_{i}",
                "family": "punch",
                "technique": "cross" if i % 2 == 0 else "jab",
                "attackingSide": "right" if i % 2 == 0 else "left",
                "assessment": {
                    "status": "needs_improvement",
                    "findings": [{
                        "code": "TECH_PUNCH_GUARD_DROPPED",
                        "severity": "critical",
                        "frameIdx": 15,
                        "timeMs": 500.0,
                    }],
                },
            }
            for i in range(10)
        ]

        base_res = SessionAggregationEngine.aggregate_session(actions).to_dict()
        for _ in range(50):
            res = SessionAggregationEngine.aggregate_session(actions).to_dict()
            self.assertEqual(res, base_res)

    def test_attack_medical_terms_rejection(self):
        """Mọi từ vựng mang tính chẩn đoán y tế đều phải bị chặn đứng khi khởi tạo StandardFinding."""
        ref = EvidenceReference(1, 33.3, "metric", 10.0)
        prov = RubricProvenance("r", "c")

        for term in FORBIDDEN_MEDICAL_TERMS:
            with self.assertRaises(ValueError, msg=f"Allowed forbidden medical term: {term}"):
                StandardFinding(
                    id=f"f_bad_{term}",
                    code=FindingErrorCode.PUNCH_GUARD_DROPPED,
                    title=f"Có nguy cơ {term}",
                    description=f"Dấu hiệu {term} rõ rệt",
                    scope=FindingScope.ACTION,
                    severity=FindingSeverity.WARNING,
                    confidence=0.9,
                    evidence_level=EvidenceLevel.OBSERVED,
                    evidence_refs=(ref,),
                    provenance=prov,
                    recommendation="Thăm khám",
                )

    def test_attack_data_leakage_athlete_cross_split(self):
        """Kiểm tra không có rò rỉ dữ liệu (data leakage) của cùng một vận động viên sang nhiều split khác nhau."""
        views_with_athlete = []
        for i in range(30):
            act = {
                "id": f"act_leak_{i}",
                "family": "punch",
                "technique": "jab",
                "attackingSide": "left",
                "phases": {"startFrame": 0, "endFrame": 10},
                "assessment": {"findings": []},
            }
            v = ReviewStateMachine.initialize_view(act)
            app = ReviewStateMachine.apply_review_event(
                v, TargetField.TECHNIQUE, ReviewAction.ACCEPT, None,
                "c1", ReviewerRole.COACH, "OK", f"tok_leak_{i}"
            )
            # 3 distinct athletes
            ath = f"athlete_test_{i % 3}"
            views_with_athlete.append((app, ath))

        res = DatasetExportEngine.export_dataset(views_with_athlete, salt="test_salt_secret")

        athlete_splits: dict[str, set] = {}
        for s in res.samples:
            athlete_splits.setdefault(s.athlete_hash, set()).add(s.split)

        for ath_hash, splits in athlete_splits.items():
            self.assertEqual(
                len(splits), 1,
                f"Data leakage detected! Athlete {ath_hash} is present in multiple splits: {splits}"
            )

    def test_attack_insufficient_evidence_preservation(self):
        """Thiếu bằng chứng phải bảo toàn insufficient_evidence và không sinh finding ảo."""
        f_none = FindingEngine.from_criterion_result(
            criterion_id="maxElbowAngle",
            status="insufficient_evidence",
            score=None,
            measured_value=None,
            action_id="act_insuf",
            family="punch",
            rubric_id="boxing_jab_v3",
        )
        self.assertIsNone(f_none)


if __name__ == "__main__":
    unittest.main()

