"""
test_kick_validity_gate.py — Phase 2A Kick Input & Geometry Validity Gate Unit Tests
Tuân thủ đầy đủ các yêu cầu kiểm thử Tasks 10 (Cases A -> H) cùng các chỉ đạo bổ sung:
- Case A: active_leg == "none" -> IDLE, 0 events, 0 scores.
- Case B: ankle confidence cực thấp -> calculate_angle is None, không thể bắt đầu kick.
- Case C: missing point -> calculate_angle is None (không bao giờ trả về 0.0).
- Case D: degenerate vectors (gối và cổ chân trùng điểm) -> calculate_angle is None.
- Case E: valid geometry -> calculate_angle trả về góc chính xác.
- Case F: invalid angle không bao giờ chấm điểm hoặc sinh "Optimal Knee Chamber".
- Case G: valid right leg -> landmarks_valid=True, geometry_valid=True, knee_angle là float, qua validity gate.
- Case H: valid left leg -> tương tự cho chân trái.
- Case I: experimental invalid frame tolerance -> abort chu trình khi vượt quá tolerance mà không chấm điểm.
"""

import math
import unittest
from pose_math import (
    KP, Point, PoseValidityConfig, calculate_angle,
    is_landmark_valid, are_landmarks_valid, detect_active_leg,
)
from kick_analyzer import KickAnalyzer, KickState, KickResult, KickFrameFeatures
from technique_rubric import CriterionStatus


class TestKickValidityGate(unittest.TestCase):

    def setUp(self):
        self.config = PoseValidityConfig(min_landmark_confidence=0.35, min_segment_length=0.02)
        self.analyzer = KickAnalyzer(max_consecutive_invalid_frames=2)

    def test_case_a_active_leg_none(self):
        """Case A — active leg none: trạng thái giữ nguyên IDLE, không sinh event, không sinh score."""
        # Dù knee_angle nhỏ (ví dụ 45 độ), nhưng active_leg='none'
        res = self.analyzer.update(
            knee_angle=45.0,
            hip_angle=120.0,
            ankle=Point(0.5, 0.9, conf=0.8),
            frame_idx=10,
            time_ms=400.0,
            active_leg="none",
            landmarks_valid=False,
            geometry_valid=False,
            rejection_reason="ACTIVE_LEG_NONE",
        )
        self.assertIsNone(res)
        self.assertEqual(self.analyzer.state, KickState.IDLE)
        self.assertEqual(len(self.analyzer.results), 0)
        self.assertEqual(self.analyzer.last_transition_reason, "NONE")
        self.assertEqual(self.analyzer.last_rejection_reason, "ACTIVE_LEG_NONE")

    def test_case_b_ankle_confidence_extremely_low(self):
        """Case B — ankle confidence extremely low: hip=0.90, knee=0.07, ankle=0.01 -> knee_angle is None, kick cannot start."""
        hip = Point(0.5, 0.5, conf=0.90)
        knee = Point(0.5, 0.7, conf=0.07)
        ankle = Point(0.5, 0.9, conf=0.01)

        knee_angle = calculate_angle(hip, knee, ankle, config=self.config)
        self.assertIsNone(knee_angle, "calculate_angle phải trả về None khi conf thấp")

        # Đưa vào KickAnalyzer: không thể bắt đầu kick
        res = self.analyzer.update(
            knee_angle=knee_angle,
            hip_angle=None,
            ankle=ankle,
            frame_idx=1,
            time_ms=40.0,
            active_leg="right",
            landmarks_valid=False,
            geometry_valid=False,
            rejection_reason="INSUFFICIENT_LOWER_BODY_CONFIDENCE",
        )
        self.assertIsNone(res)
        self.assertEqual(self.analyzer.state, KickState.IDLE)
        self.assertEqual(len(self.analyzer.results), 0)

    def test_case_c_missing_point(self):
        """Case C — missing point: ankle = None -> calculate_angle(...) = None, KHÔNG PHẢI 0.0."""
        hip = Point(0.5, 0.5, conf=0.9)
        knee = Point(0.5, 0.7, conf=0.8)
        ankle = None

        angle = calculate_angle(hip, knee, ankle, config=self.config)
        self.assertIsNone(angle)
        self.assertNotEqual(angle, 0.0, "Không được dùng 0.0 làm sentinel cho điểm bị thiếu")

        # Cả khi cả 3 điểm đều None
        self.assertIsNone(calculate_angle(None, None, None))

    def test_case_d_degenerate_vectors(self):
        """Case D — degenerate vectors: knee và ankle gần trùng nhau (khoảng cách < min_segment_length)."""
        hip = Point(0.5, 0.4, conf=0.9)
        knee = Point(0.5, 0.7, conf=0.9)
        # Ankle cách knee chỉ 0.005 (nhỏ hơn min_segment_length 0.02)
        ankle = Point(0.5, 0.705, conf=0.9)

        angle = calculate_angle(hip, knee, ankle, config=self.config)
        self.assertIsNone(angle, "calculate_angle phải trả về None cho vector suy biến / trùng điểm")

    def test_case_e_valid_geometry(self):
        """Case E — valid geometry: landmark độ tin cậy cao, hình học rõ ràng -> trả về góc chính xác."""
        # Tam giác vuông cân tại B: A=(0.5, 0.2), B=(0.5, 0.5), C=(0.8, 0.5) -> góc 90 độ
        hip = Point(0.5, 0.2, conf=0.95)
        knee = Point(0.5, 0.5, conf=0.95)
        ankle = Point(0.8, 0.5, conf=0.95)

        angle = calculate_angle(hip, knee, ankle, config=self.config)
        self.assertIsNotNone(angle)
        self.assertAlmostEqual(angle, 90.0, delta=0.5)

    def test_case_f_invalid_angle_cannot_score(self):
        """Case F — invalid angle cannot score: knee_angle = None không sinh technique score hay 'Optimal Knee Chamber'."""
        # Giả sử gọi _score_kick khi min_chamber_angle chưa từng được quan sát hợp lệ (180.0 hoặc 0.0)
        self.analyzer.min_chamber_angle = 180.0  # Giá trị khởi tạo chưa có observation hợp lệ
        res = self.analyzer._score_kick(
            hip_angle=None,
            start_frame=0,
            end_frame=10,
            start_time_ms=0.0,
            end_time_ms=300.0,
        )
        chamber_crit = next(c for c in res.criterion_results if c.criterion_id == "crit_kick_chamber")
        self.assertEqual(chamber_crit.status, CriterionStatus.INSUFFICIENT_EVIDENCE)
        self.assertEqual(chamber_crit.score, 0.0)
        self.assertIsNone(chamber_crit.finding)
        self.assertNotIn("Optimal Knee Chamber", [f.title for f in res.findings])

    def test_case_g_valid_right_leg(self):
        """Case G (Amended) — valid right leg: kiểm tra frame hợp lệ vượt qua validity boundary."""
        hip = Point(0.6, 0.5, conf=0.92)
        knee = Point(0.6, 0.7, conf=0.88)
        ankle = Point(0.7, 0.85, conf=0.85)

        landmarks_valid = are_landmarks_valid([hip, knee, ankle], min_confidence=self.config.min_landmark_confidence)
        knee_angle = calculate_angle(hip, knee, ankle, config=self.config)
        geometry_valid = (knee_angle is not None)

        self.assertTrue(landmarks_valid)
        self.assertTrue(geometry_valid)
        self.assertIsInstance(knee_angle, float)
        self.assertTrue(math.isfinite(knee_angle))

        # Đưa vào analyzer với active_leg="right"
        self.analyzer.update(
            knee_angle=knee_angle,
            hip_angle=140.0,
            ankle=ankle,
            frame_idx=5,
            time_ms=160.0,
            active_leg="right",
            landmarks_valid=landmarks_valid,
            geometry_valid=geometry_valid,
            rejection_reason="NONE",
        )
        # Phase 2A không reject frame này
        self.assertEqual(self.analyzer.last_rejection_reason, "NONE")
        self.assertEqual(self.analyzer.active_leg, "right")

    def test_case_h_valid_left_leg(self):
        """Case H (Amended) — valid left leg: kiểm tra chân trái hợp lệ vượt qua validity boundary."""
        hip = Point(0.4, 0.5, conf=0.91)
        knee = Point(0.4, 0.68, conf=0.89)
        ankle = Point(0.3, 0.82, conf=0.87)

        landmarks_valid = are_landmarks_valid([hip, knee, ankle], min_confidence=self.config.min_landmark_confidence)
        knee_angle = calculate_angle(hip, knee, ankle, config=self.config)
        geometry_valid = (knee_angle is not None)

        self.assertTrue(landmarks_valid)
        self.assertTrue(geometry_valid)
        self.assertIsInstance(knee_angle, float)
        self.assertTrue(math.isfinite(knee_angle))

        # Đưa vào analyzer với active_leg="left"
        self.analyzer.update(
            knee_angle=knee_angle,
            hip_angle=140.0,
            ankle=ankle,
            frame_idx=5,
            time_ms=160.0,
            active_leg="left",
            landmarks_valid=landmarks_valid,
            geometry_valid=geometry_valid,
            rejection_reason="NONE",
        )
        self.assertEqual(self.analyzer.last_rejection_reason, "NONE")
        self.assertEqual(self.analyzer.active_leg, "left")

    def test_case_i_invalid_frame_tolerance(self):
        """Case I (Amendment 2) — invalid frame tolerance: streak <= tolerance thì giữ trạng thái, vượt quá thì abort về IDLE."""
        ankle = Point(0.6, 0.7, conf=0.9)
        # Frame 1: Bắt đầu chambering hợp lệ
        self.analyzer.update(
            knee_angle=80.0, hip_angle=140.0, ankle=ankle, frame_idx=1, time_ms=33.0,
            active_leg="right", landmarks_valid=True, geometry_valid=True
        )
        self.assertEqual(self.analyzer.state, KickState.CHAMBERING)

        # Frame 2: Invalid lần 1 (streak = 1 <= max_tolerance 2) -> giữ trạng thái, không bịa góc
        self.analyzer.update(
            knee_angle=None, hip_angle=None, ankle=None, frame_idx=2, time_ms=66.0,
            active_leg="right", landmarks_valid=False, geometry_valid=False,
            rejection_reason="INSUFFICIENT_LOWER_BODY_CONFIDENCE"
        )
        self.assertEqual(self.analyzer.state, KickState.CHAMBERING)
        self.assertEqual(self.analyzer.last_transition_reason, "HOLDING_INVALID_INPUT")
        self.assertEqual(self.analyzer._invalid_streak, 1)

        # Frame 3: Invalid lần 2 (streak = 2 <= max_tolerance 2) -> vẫn giữ trạng thái
        self.analyzer.update(
            knee_angle=None, hip_angle=None, ankle=None, frame_idx=3, time_ms=100.0,
            active_leg="right", landmarks_valid=False, geometry_valid=False,
            rejection_reason="INSUFFICIENT_LOWER_BODY_CONFIDENCE"
        )
        self.assertEqual(self.analyzer.state, KickState.CHAMBERING)
        self.assertEqual(self.analyzer._invalid_streak, 2)

        # Frame 4: Invalid lần 3 (streak = 3 > max_tolerance 2) -> abort về IDLE mà KHÔNG chấm điểm
        res = self.analyzer.update(
            knee_angle=None, hip_angle=None, ankle=None, frame_idx=4, time_ms=133.0,
            active_leg="right", landmarks_valid=False, geometry_valid=False,
            rejection_reason="INSUFFICIENT_LOWER_BODY_CONFIDENCE"
        )
        self.assertIsNone(res)
        self.assertEqual(self.analyzer.state, KickState.IDLE)
        self.assertEqual(self.analyzer.last_transition_reason, "ABORTED_INVALID_INPUT")
        self.assertEqual(len(self.analyzer.results), 0, "Không được ghi nhận kick khi bị abort do mất landmark")


if __name__ == "__main__":
    unittest.main()

