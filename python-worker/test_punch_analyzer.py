"""
test_punch_analyzer.py — Unit tests cho PunchAnalyzer và Technique Findings Engine
Chạy: python test_punch_analyzer.py
"""

import unittest
from pose_math import KP, Point
from punch_analyzer import PunchAnalyzer, PunchState, PunchResult, TechniqueFinding


def create_kps(
    r_elbow=(0.55, 0.45),
    r_wrist=(0.52, 0.35),
    l_elbow=(0.45, 0.45),
    l_wrist=(0.48, 0.35),
    r_shoulder=(0.60, 0.35),
    l_shoulder=(0.40, 0.35),
) -> list[Point]:
    """Tạo 17 keypoints với toạ độ xác định."""
    kps = [Point(x=0.5, y=0.5, conf=0.9) for _ in range(17)]
    kps[KP.NOSE] = Point(x=0.5, y=0.25, conf=0.9)

    kps[KP.LEFT_SHOULDER] = Point(x=l_shoulder[0], y=l_shoulder[1], conf=0.9)
    kps[KP.RIGHT_SHOULDER] = Point(x=r_shoulder[0], y=r_shoulder[1], conf=0.9)

    kps[KP.LEFT_ELBOW] = Point(x=l_elbow[0], y=l_elbow[1], conf=0.9)
    kps[KP.LEFT_WRIST] = Point(x=l_wrist[0], y=l_wrist[1], conf=0.9)

    kps[KP.RIGHT_ELBOW] = Point(x=r_elbow[0], y=r_elbow[1], conf=0.9)
    kps[KP.RIGHT_WRIST] = Point(x=r_wrist[0], y=r_wrist[1], conf=0.9)

    return kps


class TestPunchAnalyzer(unittest.TestCase):

    def setUp(self):
        self.analyzer = PunchAnalyzer()

    def test_initial_state(self):
        self.assertEqual(self.analyzer.state, PunchState.GUARD)
        self.assertEqual(len(self.analyzer.results), 0)

    def test_cross_punch_lifecycle_and_findings(self):
        """Kiểm tra toàn bộ chu trình một cú đấm Cross tay phải chuẩn mực."""
        # 1. Trạng thái Guard (góc gập ~30 độ)
        kps_guard = create_kps(
            r_elbow=(0.62, 0.45), r_wrist=(0.60, 0.35),
            l_elbow=(0.38, 0.45), l_wrist=(0.40, 0.35),
        )
        self.analyzer.update(kps_guard, frame_idx=0, time_ms=0)
        self.assertEqual(self.analyzer.state, PunchState.GUARD)

        # 2. Vươn tay (Extending): cùi chỏ mở ra ~115 độ
        kps_ext = create_kps(
            r_elbow=(0.68, 0.42), r_wrist=(0.78, 0.38),
            l_elbow=(0.38, 0.45), l_wrist=(0.40, 0.35),
        )
        self.analyzer.update(kps_ext, frame_idx=5, time_ms=100)
        self.assertEqual(self.analyzer.state, PunchState.EXTENDING)
        self.assertEqual(self.analyzer.active_arm, "right")

        # 3. Đạt Impact (Duỗi thẳng 180 độ)
        kps_impact = create_kps(
            r_elbow=(0.75, 0.35), r_wrist=(0.95, 0.35),
            l_elbow=(0.38, 0.45), l_wrist=(0.40, 0.35),
        )
        self.analyzer.update(kps_impact, frame_idx=10, time_ms=200)
        self.assertEqual(self.analyzer.state, PunchState.IMPACT)

        # 4. Thu tay (Retracting)
        kps_retract = create_kps(
            r_elbow=(0.70, 0.42), r_wrist=(0.78, 0.38),
            l_elbow=(0.38, 0.45), l_wrist=(0.40, 0.35),
        )
        self.analyzer.update(kps_retract, frame_idx=15, time_ms=300)
        self.assertEqual(self.analyzer.state, PunchState.RETRACTING)

        # 5. Về lại Guard (Hoàn thành đòn đấm)
        kps_back = create_kps(
            r_elbow=(0.62, 0.45), r_wrist=(0.60, 0.35),
            l_elbow=(0.38, 0.45), l_wrist=(0.40, 0.35),
        )
        res = self.analyzer.update(kps_back, frame_idx=20, time_ms=450)

        # Kiểm tra kết quả chấm điểm
        self.assertIsNotNone(res)
        self.assertEqual(res.punch_type, "Cross")
        self.assertEqual(res.arm, "right")
        self.assertTrue(res.guard_preserved)
        self.assertGreaterEqual(res.score, 80)
        self.assertIn(res.grade, ["GOOD", "PERFECT"])

        # Kiểm tra các Findings theo chuẩn MMA-TMS
        self.assertGreater(len(res.findings), 0)
        finding_categories = [f.category for f in res.findings]
        self.assertIn("technique", finding_categories)
        self.assertIn("guard", finding_categories)

        # Kiểm tra to_dict() serialization
        res_dict = res.to_dict()
        self.assertEqual(res_dict["punchType"], "Cross")
        self.assertIn("findings", res_dict)
        self.assertIsInstance(res_dict["findings"], list)

    def test_dropped_guard_generates_critical_warning(self):
        """Kiểm tra việc hạ tay đối diện (rớt thủ) bị phạt điểm và sinh finding cảnh báo."""
        # 1. Guard với tay trái đặt thấp dưới cằm (thủ lỏng/hạ thấp)
        kps_guard = create_kps(
            r_elbow=(0.62, 0.45), r_wrist=(0.60, 0.35),
            l_elbow=(0.38, 0.52), l_wrist=(0.40, 0.55),
        )
        self.analyzer.update(kps_guard, frame_idx=0, time_ms=0)

        # 2. Extending với tay trái rớt sâu xuống dưới bụng (y = 0.60 so với vai = 0.35)
        kps_ext = create_kps(
            r_elbow=(0.68, 0.42), r_wrist=(0.78, 0.38),
            l_elbow=(0.38, 0.55), l_wrist=(0.40, 0.60), # rớt thủ sâu
        )
        self.analyzer.update(kps_ext, frame_idx=5, time_ms=100)
        self.assertEqual(self.analyzer.state, PunchState.EXTENDING)

        # 3. Impact
        kps_impact = create_kps(
            r_elbow=(0.75, 0.35), r_wrist=(0.95, 0.35),
            l_elbow=(0.38, 0.55), l_wrist=(0.40, 0.60),
        )
        self.analyzer.update(kps_impact, frame_idx=10, time_ms=200)

        # 4. Retract
        kps_retract = create_kps(
            r_elbow=(0.70, 0.42), r_wrist=(0.78, 0.38),
            l_elbow=(0.38, 0.55), l_wrist=(0.40, 0.60),
        )
        self.analyzer.update(kps_retract, frame_idx=15, time_ms=300)

        # 5. Back to guard
        kps_back = create_kps(
            r_elbow=(0.62, 0.45), r_wrist=(0.60, 0.35),
            l_elbow=(0.38, 0.45), l_wrist=(0.40, 0.35),
        )
        res = self.analyzer.update(kps_back, frame_idx=20, time_ms=450)

        self.assertIsNotNone(res)
        self.assertFalse(res.guard_preserved)
        # Phải có finding với severity = critical
        dropped_guard_findings = [f for f in res.findings if f.id.endswith("_guard_drop")]
        self.assertEqual(len(dropped_guard_findings), 1)
        self.assertEqual(dropped_guard_findings[0].severity, "critical")


if __name__ == "__main__":
    unittest.main()
