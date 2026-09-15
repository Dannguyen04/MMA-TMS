"""
test_technique_rubric.py — Unit tests cho Technique Rubric Engine & Evidence Tracking
Kiểm tra tính điểm theo trọng số, evidence gating khi thiếu dữ liệu, và sinh finding hợp lệ.
"""

import unittest
from technique_rubric import (
    CriterionResult,
    CriterionStatus,
    TechniqueFinding,
    TechniqueRubric,
    RUBRIC_ROUND_KICK_V3,
    RUBRIC_PUNCH_V3,
    calculate_technique_score,
)


class TestTechniqueRubric(unittest.TestCase):

    def test_rubrics_exist_and_validated(self):
        """Kiểm tra các bảng rubric mặc định đã đăng ký đúng chuẩn v3.0."""
        self.assertEqual(RUBRIC_ROUND_KICK_V3.version, "3.0.0")
        self.assertEqual(RUBRIC_ROUND_KICK_V3.status, "VALIDATED")
        self.assertEqual(len(RUBRIC_ROUND_KICK_V3.criteria), 4)

        self.assertEqual(RUBRIC_PUNCH_V3.version, "3.0.0")
        self.assertEqual(RUBRIC_PUNCH_V3.status, "VALIDATED")
        self.assertEqual(len(RUBRIC_PUNCH_V3.criteria), 3)

        # Tổng trọng số của mỗi rubric phải xấp xỉ 1.0
        total_kick_w = sum(c.weight for c in RUBRIC_ROUND_KICK_V3.criteria)
        self.assertAlmostEqual(total_kick_w, 1.0, places=2)

        total_punch_w = sum(c.weight for c in RUBRIC_PUNCH_V3.criteria)
        self.assertAlmostEqual(total_punch_w, 1.0, places=2)

    def test_calculate_technique_score_perfect(self):
        """Tất cả tiêu chí đạt 100 điểm -> Điểm tổng = 100, PERFECT, 🟢."""
        results = [
            CriterionResult(
                criterion_id="c1", criterion_name="Criterion 1", phase="impact",
                feature_name="f1", observed_value=100.0, score=100.0, weight=0.5,
                confidence=0.9, status=CriterionStatus.EXCELLENT,
                evidence_frame_start=10, evidence_frame_end=20,
                evidence_timestamp_start_ms=100.0, evidence_timestamp_end_ms=200.0,
                affected_body_part="arm", detail="✅ Perfect",
            ),
            CriterionResult(
                criterion_id="c2", criterion_name="Criterion 2", phase="impact",
                feature_name="f2", observed_value=100.0, score=100.0, weight=0.5,
                confidence=0.9, status=CriterionStatus.EXCELLENT,
                evidence_frame_start=10, evidence_frame_end=20,
                evidence_timestamp_start_ms=100.0, evidence_timestamp_end_ms=200.0,
                affected_body_part="guard", detail="✅ Perfect",
            ),
        ]
        score, grade, emoji = calculate_technique_score(results)
        self.assertEqual(score, 100)
        self.assertEqual(grade, "PERFECT")
        self.assertEqual(emoji, "🟢")

    def test_calculate_technique_score_weighted(self):
        """Điểm tiêu chí 1: 100 (w=0.4), tiêu chí 2: 50 (w=0.6) -> Điểm tổng = 70 (FAIR)."""
        results = [
            CriterionResult(
                criterion_id="c1", criterion_name="Criterion 1", phase="impact",
                feature_name="f1", observed_value=100.0, score=100.0, weight=0.4,
                confidence=0.9, status=CriterionStatus.EXCELLENT,
                evidence_frame_start=10, evidence_frame_end=20,
                evidence_timestamp_start_ms=100.0, evidence_timestamp_end_ms=200.0,
                affected_body_part="arm", detail="✅ Good",
            ),
            CriterionResult(
                criterion_id="c2", criterion_name="Criterion 2", phase="impact",
                feature_name="f2", observed_value=50.0, score=50.0, weight=0.6,
                confidence=0.9, status=CriterionStatus.NEEDS_WORK,
                evidence_frame_start=10, evidence_frame_end=20,
                evidence_timestamp_start_ms=100.0, evidence_timestamp_end_ms=200.0,
                affected_body_part="guard", detail="⚠️ Warning",
            ),
        ]
        score, grade, emoji = calculate_technique_score(results)
        # 100 * 0.4 + 50 * 0.6 = 40 + 30 = 70
        self.assertEqual(score, 70)
        self.assertEqual(grade, "FAIR")
        self.assertEqual(emoji, "🟠")

    def test_evidence_gating_omits_insufficient_evidence(self):
        """
        Evidence Gating: Khi một tiêu chí thiếu dữ liệu quan sát (INSUFFICIENT_EVIDENCE),
        nó không được tính vào mẫu số trọng số (weight), không hạ thấp điểm oan của athlete.
        """
        results = [
            CriterionResult(
                criterion_id="c1", criterion_name="Criterion 1", phase="impact",
                feature_name="f1", observed_value=80.0, score=80.0, weight=0.4,
                confidence=0.9, status=CriterionStatus.GOOD,
                evidence_frame_start=10, evidence_frame_end=20,
                evidence_timestamp_start_ms=100.0, evidence_timestamp_end_ms=200.0,
                affected_body_part="arm", detail="✅ Good",
            ),
            CriterionResult(
                criterion_id="c2", criterion_name="Criterion 2", phase="impact",
                feature_name="f2", observed_value=0.0, score=0.0, weight=0.6,
                confidence=0.0, status=CriterionStatus.INSUFFICIENT_EVIDENCE,
                evidence_frame_start=0, evidence_frame_end=0,
                evidence_timestamp_start_ms=0.0, evidence_timestamp_end_ms=0.0,
                affected_body_part="hip", detail="⚪ No Data",
            ),
        ]
        score, grade, emoji = calculate_technique_score(results)
        # Chỉ tính trên c1: score = 80, grade = GOOD
        self.assertEqual(score, 80)
        self.assertEqual(grade, "GOOD")
        self.assertEqual(emoji, "🟡")

    def test_finding_to_dict_has_all_required_spec_fields(self):
        """Kiểm tra serialization của TechniqueFinding có đầy đủ trường theo Master Spec v3.0."""
        finding = TechniqueFinding(
            id="f_001",
            action_id="kick_1",
            category="technique",
            phase="chamber",
            title="Optimal Chamber",
            description="Deep knee bend",
            severity="positive",
            confidence=0.95,
            frame_idx=15,
            time_ms=250.0,
            evidence_frame_start=10,
            evidence_frame_end=15,
            evidence_timestamp_start_ms=166.7,
            evidence_timestamp_end_ms=250.0,
            affected_body_part="left_knee",
            metric_name="minChamberAngle",
            metric_value=50.0,
            metric_unit="degrees",
            recommendation="Keep it up",
            model_version="yolov8n-pose",
            scoring_version="rubric-v3.0.0",
        )
        d = finding.to_dict()
        # Frontend fields
        self.assertEqual(d["id"], "f_001")
        self.assertEqual(d["category"], "technique")
        self.assertEqual(d["frameIdx"], 15)
        self.assertEqual(d["timeMs"], 250.0)
        # Spec v3.0 fields
        self.assertEqual(d["actionId"], "kick_1")
        self.assertEqual(d["phase"], "chamber")
        self.assertEqual(d["evidenceFrameStart"], 10)
        self.assertEqual(d["evidenceFrameEnd"], 15)
        self.assertEqual(d["affectedBodyPart"], "left_knee")
        self.assertEqual(d["metricUnit"], "degrees")
        self.assertEqual(d["scoringVersion"], "rubric-v3.0.0")


if __name__ == "__main__":
    unittest.main()

