"""
test_posture_gate.py — Unit tests cho PostureGate & Ground Context Filtering
Tuân thủ Master Specification v3.0 & Sprint 2 Architecture.
Chạy: python test_posture_gate.py
"""

import unittest
from pose_math import Point, KP
from posture_gate import PostureGate, PostureState
from punch_analyzer import PunchAnalyzer, PunchState


def make_test_keypoints(
    sh_y: float = 0.30,
    hip_y: float = 0.55,
    ank_y: float = 0.90,
    dx: float = 0.02,
    conf: float = 0.90,
) -> list[Point]:
    """Tạo 17 keypoints giả lập theo toạ độ dọc và độ lệch ngang."""
    kps = [Point(0.5, 0.5, 0.0) for _ in range(17)]

    # Shoulder (5, 6)
    kps[KP.LEFT_SHOULDER]  = Point(0.5 - dx/2.0 - 0.05, sh_y, conf)
    kps[KP.RIGHT_SHOULDER] = Point(0.5 - dx/2.0 + 0.05, sh_y, conf)

    # Hip (11, 12)
    kps[KP.LEFT_HIP]  = Point(0.5 + dx/2.0 - 0.04, hip_y, conf)
    kps[KP.RIGHT_HIP] = Point(0.5 + dx/2.0 + 0.04, hip_y, conf)

    # Knee (13, 14)
    knee_y = (hip_y + ank_y) / 2.0
    kps[KP.LEFT_KNEE]  = Point(0.48, knee_y, conf)
    kps[KP.RIGHT_KNEE] = Point(0.52, knee_y, conf)

    # Ankle (15, 16)
    kps[KP.LEFT_ANKLE]  = Point(0.47, ank_y, conf)
    kps[KP.RIGHT_ANKLE] = Point(0.53, ank_y, conf)

    # Elbows and Wrists (để punch tracker có thể đọc)
    kps[KP.LEFT_ELBOW]  = Point(0.45, sh_y + 0.10, conf)
    kps[KP.RIGHT_ELBOW] = Point(0.55, sh_y + 0.10, conf)
    kps[KP.LEFT_WRIST]  = Point(0.45, sh_y + 0.05, conf)
    kps[KP.RIGHT_WRIST] = Point(0.55, sh_y + 0.05, conf)

    return kps


class TestPostureGate(unittest.TestCase):

    def setUp(self):
        self.gate = PostureGate(consecutive_ground_frames=3, consecutive_stand_frames=2)

    def test_1_standing_boxer(self):
        """Test 1: Võ sĩ đứng thủ chuẩn (thân thẳng, góc ~ 5°) -> STANDING."""
        kps = make_test_keypoints(sh_y=0.30, hip_y=0.55, ank_y=0.90, dx=0.02)
        state, just_stood = self.gate.update(kps)
        self.assertEqual(state, PostureState.STANDING)
        self.assertFalse(just_stood)

    def test_2_forward_lean_strike(self):
        """Test 2: VĐV nghiêng người ra đòn thẳng hoặc overhand (góc ~ 30-35°) -> CROUCHED, KHÔNG PHẢI GROUND."""
        # dx=0.15, dy=0.25 => angle = arctan(0.15/0.25) = 31°
        kps = make_test_keypoints(sh_y=0.30, hip_y=0.55, ank_y=0.90, dx=0.15)
        for _ in range(5):
            state, just_stood = self.gate.update(kps)
        self.assertEqual(state, PostureState.CROUCHED)
        self.assertFalse(just_stood)

    def test_3_defensive_slip_and_duck(self):
        """Test 3: VĐV cúi né đòn (duck/slip) sâu (góc ~ 38°, chân đứng vững) -> CROUCHED, KHÔNG PHẢI GROUND."""
        # dx=0.18, dy=0.22 => angle = 39°
        kps = make_test_keypoints(sh_y=0.40, hip_y=0.62, ank_y=0.90, dx=0.18)
        for _ in range(5):
            state, _ = self.gate.update(kps)
        self.assertEqual(state, PostureState.CROUCHED)

    def test_4_momentary_slip_hysteresis_blocks_false_ground(self):
        """Test 4: Một cú chúi người ngã tạm thời chỉ 2 frame -> hysteresis chặn, KHÔNG rơi vào GROUND."""
        stand_kps = make_test_keypoints(sh_y=0.30, hip_y=0.55, ank_y=0.90, dx=0.02)
        self.gate.update(stand_kps)

        # 2 frame chúi người xuống sàn (góc 70 độ)
        dive_kps = make_test_keypoints(sh_y=0.70, hip_y=0.60, ank_y=0.62, dx=0.30)
        st1, _ = self.gate.update(dive_kps)
        st2, _ = self.gate.update(dive_kps)

        # Sau 2 frame, vẫn chưa đủ ngưỡng 3 frame để chuyển sang GROUND
        self.assertNotEqual(st1, PostureState.GROUND)
        self.assertNotEqual(st2, PostureState.GROUND)

        # Frame thứ 3 đứng dậy
        st3, _ = self.gate.update(stand_kps)
        self.assertEqual(st3, PostureState.STANDING)

    def test_5_sustained_ground_grappling(self):
        """Test 5: VĐV nằm sàn hoặc vật lộn trên 3 frame -> chuyển sang GROUND."""
        ground_kps = make_test_keypoints(sh_y=0.75, hip_y=0.70, ank_y=0.72, dx=0.35)
        for f in range(5):
            state, _ = self.gate.update(ground_kps)

        self.assertEqual(state, PostureState.GROUND)

    def test_6_standing_recovery_triggers_derivative_reset_flag(self):
        """Test 6: VĐV đứng dậy từ GROUND -> sau 2 frame đứng, kích hoạt cờ just_stood_up=True."""
        ground_kps = make_test_keypoints(sh_y=0.75, hip_y=0.70, ank_y=0.72, dx=0.35)
        for _ in range(4):
            self.gate.update(ground_kps)
        self.assertEqual(self.gate.current_state, PostureState.GROUND)

        stand_kps = make_test_keypoints(sh_y=0.30, hip_y=0.55, ank_y=0.90, dx=0.02)
        st1, flag1 = self.gate.update(stand_kps)
        self.assertEqual(st1, PostureState.GROUND)  # frame 1: vẫn đang xác nhận đứng dậy
        self.assertFalse(flag1)

        st2, flag2 = self.gate.update(stand_kps)
        self.assertEqual(st2, PostureState.STANDING)  # frame 2: xác nhận đứng dậy!
        self.assertTrue(flag2)  # Cờ just_stood_up kích hoạt!

    def test_7_punch_analyzer_suppresses_punch_on_ground(self):
        """Test 7: Tích hợp với PunchAnalyzer — khi ở GROUND, động tác vung tay KHÔNG sinh punch."""
        analyzer = PunchAnalyzer()

        # Tạo chuỗi frame ở GROUND với chuyển động tay nhanh
        for f in range(10):
            # Tư thế nằm sàn
            kps = make_test_keypoints(sh_y=0.75, hip_y=0.70, ank_y=0.72, dx=0.35)
            # Tay vung mạnh như khi đấm/chống sàn
            kps[KP.RIGHT_WRIST] = Point(0.55 + 0.05 * f, 0.70, 0.95)
            res = analyzer.update(kps, frame_idx=f, time_ms=f * 16.7)
            self.assertIsNone(res)

        # Trạng thái punch phải bị giữ ở GUARD
        self.assertEqual(analyzer.state, PunchState.GUARD)


if __name__ == "__main__":
    unittest.main()

