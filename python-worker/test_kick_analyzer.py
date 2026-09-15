"""
test_kick_analyzer.py — Unit tests cho KickAnalyzer & Round Kick Rubric Engine
Kiểm tra vòng đời cú đá vòng cầu, rubric scoring theo tiêu chí, và chuỗi bằng chứng (evidence tracking).
"""

import unittest
from pose_math import Point
from kick_analyzer import KickAnalyzer, KickState, KickResult


class TestKickAnalyzer(unittest.TestCase):

    def setUp(self):
        self.analyzer = KickAnalyzer()

    def test_initial_state(self):
        self.assertEqual(self.analyzer.state, KickState.IDLE)
        self.assertEqual(len(self.analyzer.results), 0)

    def test_round_kick_lifecycle_and_rubric_scoring(self):
        """Kiểm tra toàn bộ chu trình 1 cú đá xuất sắc và các tiêu chí rubric được tính đúng."""
        # 1. Khởi đầu IDLE (chân đứng thẳng knee_angle = 170)
        self.analyzer.update(knee_angle=170, hip_angle=170, ankle=Point(0.5, 0.8), frame_idx=0, time_ms=0)
        self.assertEqual(self.analyzer.state, KickState.IDLE)

        # 2. Bắt đầu rút gối (CHAMBERING): knee_angle = 60, speed = 0.2
        self.analyzer.update(knee_angle=60, hip_angle=150, ankle=Point(0.5, 0.7), frame_idx=5, time_ms=100)
        self.assertEqual(self.analyzer.state, KickState.CHAMBERING)
        self.assertEqual(self.analyzer.min_chamber_angle, 60)

        # 3. Bung chân (EXTENDING): gối mở lên 100 và tốc độ chân > 0.4
        self.analyzer.update(knee_angle=100, hip_angle=140, ankle=Point(0.6, 0.5), frame_idx=10, time_ms=200)
        self.assertEqual(self.analyzer.state, KickState.EXTENDING)

        # 4. Đạt đỉnh impact: gối duỗi 165 độ, tốc độ cực đại
        self.analyzer.update(knee_angle=165, hip_angle=145, ankle=Point(0.8, 0.4), frame_idx=15, time_ms=300)
        self.assertEqual(self.analyzer.max_extension_angle, 165)

        # 5. Thu chân (RECOVERING) -> kết thúc cú đá
        res = self.analyzer.update(knee_angle=140, hip_angle=160, ankle=Point(0.7, 0.6), frame_idx=20, time_ms=400)
        self.assertEqual(self.analyzer.state, KickState.RECOVERING)

        # 6. Kiểm tra kết quả KickResult
        self.assertIsNotNone(res)
        self.assertGreaterEqual(res.score, 80)
        self.assertIn(res.grade, ["GOOD", "PERFECT"])
        self.assertEqual(res.min_chamber_angle, 60)
        self.assertEqual(res.max_extension_angle, 165)

        # 7. Kiểm tra Criterion Results
        self.assertEqual(len(res.criterion_results), 4)
        crit_ids = [c.criterion_id for c in res.criterion_results]
        self.assertIn("crit_kick_chamber", crit_ids)
        self.assertIn("crit_kick_extension", crit_ids)
        self.assertIn("crit_kick_speed", crit_ids)
        self.assertIn("crit_kick_posture", crit_ids)

        # 8. Kiểm tra Findings sinh ra
        self.assertGreater(len(res.findings), 0)
        ext_finding = next((f for f in res.findings if "ext" in f.id), None)
        self.assertIsNotNone(ext_finding)
        self.assertEqual(ext_finding.severity, "positive")
        self.assertEqual(ext_finding.phase, "impact")
        self.assertEqual(ext_finding.evidence_frame_start, 5)   # chamber_peak_frame
        self.assertEqual(ext_finding.evidence_frame_end, 15)    # impact_frame

        # 9. Kiểm tra to_dict()
        d = res.to_dict()
        self.assertIn("score", d)
        self.assertIn("criterionResults", d)
        self.assertIn("findings", d)
        self.assertIn("impactFrame", d)
        self.assertEqual(d["impactFrame"], 15)

    def test_shallow_chamber_generates_warning_finding(self):
        """Cú đá rút gối nông (min angle = 90) phải bị chấm điểm thấp cho tiêu chí chamber và sinh warning finding."""
        # Chambering với góc nông 90 độ
        self.analyzer.update(knee_angle=170, hip_angle=170, ankle=Point(0.5, 0.8), frame_idx=0, time_ms=0)
        self.analyzer.update(knee_angle=90, hip_angle=150, ankle=Point(0.5, 0.7), frame_idx=5, time_ms=100)
        self.assertEqual(self.analyzer.state, KickState.CHAMBERING)

        # Bung chân
        self.analyzer.update(knee_angle=110, hip_angle=140, ankle=Point(0.6, 0.5), frame_idx=10, time_ms=200)
        # Impact
        self.analyzer.update(knee_angle=155, hip_angle=145, ankle=Point(0.8, 0.4), frame_idx=15, time_ms=300)
        # Recover
        res = self.analyzer.update(knee_angle=135, hip_angle=160, ankle=Point(0.7, 0.6), frame_idx=20, time_ms=400)

        self.assertIsNotNone(res)
        chamber_crit = next(c for c in res.criterion_results if c.criterion_id == "crit_kick_chamber")
        self.assertEqual(chamber_crit.status, "needs_work")
        self.assertLess(chamber_crit.score, 70)

        # Phải có finding cảnh báo rút gối nông
        warn_finding = next((f for f in res.findings if "chamber_warn" in f.id), None)
        self.assertIsNotNone(warn_finding)
        self.assertEqual(warn_finding.severity, "warning")


if __name__ == "__main__":
    unittest.main()

