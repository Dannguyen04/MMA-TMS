"""
tests/test_joint_state_machine.py — Unit Tests for JointHealthTracker & FeintFilter

Chạy: python -m pytest python-worker/tests/test_joint_state_machine.py -v
  hoặc: cd python-worker && python -m pytest tests/test_joint_state_machine.py -v

== Danh sách Test Cases ==
  TC-1: Feint không kích hoạt SUSPECTED (hoặc de-flag ngay nếu có)
  TC-2: Real Impairment → CONFIRMED_IMPAIRMENT (5 đòn ROM thấp + Jerk cao)
  TC-3: Rolling Window Timeout → CONFIRMED_IMPAIRMENT (không đủ đòn nhưng hết giờ)
  TC-4: Chi không tham gia đòn đánh KHÔNG bị phạt (Bẫy #2 — Inactive Limb)
  TC-5: Limb Disuse → SUSPECTED_AVOIDANCE, KHÔNG tự de-flag về HEALTHY (Bẫy #3)
"""

import sys
import os

# Đảm bảo import được từ thư mục python-worker khi chạy từ root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import unittest
from joint_health_tracker import (
    JointHealthState,
    JointName,
    JointHealthTracker,
    SessionHealthMonitor,
    FeintFilter,
    MotionClass,
    JERK_SMOOTH_THRESHOLD,
    ROM_LOW_THRESHOLD,
    ROM_RECOVERY_THRESHOLD,
    CONSECUTIVE_LOW_ROM_LIMIT,
    DISUSE_SEC_TRIGGER,
)


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _feed_smooth_velocity(tracker: JointHealthTracker, base_vel: float = 0.5, n: int = 8):
    """
    Điền buffer velocity với chuyển động THỰC SỰ MƯỢT:
    Velocity gần như không đổi (biến thiên nhỏ < 0.01 u/frame) → Jerk ≈ 0.
    """
    for i in range(n):
        t_ms = float(i * 33)  # ~30fps
        # Chỉ dùng noise cực nhỏ (0.5%) → jerk gần 0
        vel = base_vel + 0.005 * (i % 2)  # dao động 0.005 u/frame
        tracker.feint_filter.push_velocity(vel, t_ms)


def _feed_jerky_velocity(tracker: JointHealthTracker, base_vel: float = 0.8, n: int = 8):
    """
    Điền buffer velocity với chuyển động GIẬT CỤC (Jerk cao » 120).
    Mô phỏng né đau hoặc phản xạ cơ bất thường.
    Dùng dạng sóng xung kiểu on/off (0 → base_vel → 0 ...) để jerk cực lớn.
    """
    for i in range(n):
        t_ms = float(i * 33)
        # Xen kẽ giữa 0 và base_vel: tạo đạo hàm gia tốc cực kỳ lớn
        vel = base_vel if (i % 2 == 0) else 0.0
        tracker.feint_filter.push_velocity(vel, t_ms)


# ─── TC-1: Feint & Recovery ───────────────────────────────────────────────────

class TestTC1_FeintAndRecovery(unittest.TestCase):
    """
    TC-1: Vai trái tung đòn nhử (ROM 50%, Jerk mượt) không kích hoạt CONFIRMED_IMPAIRMENT.
    Nếu vào SUSPECTED, đòn tiếp theo ROM 95% → de-flag về HEALTHY ngay lập tức.
    """

    def setUp(self):
        self.tracker = JointHealthTracker(JointName.LEFT_SHOULDER)
        self.tracker.feint_filter.update_torso(0.30)

    def test_smooth_feint_does_not_trigger_suspected(self):
        """Đòn nhử mượt (ROM 50%, Jerk thấp) → Phân loại TACTICAL_FEINT → Không vào SUSPECTED."""
        # Điền buffer với velocity gần không đổi (≈0.40) ở timestamps liên tục 33ms/frame
        _feed_smooth_velocity(self.tracker, base_vel=0.4, n=8)

        # Xác nhận jerk thấp trên buffer đã điền
        jerk = self.tracker.feint_filter.compute_smooth_jerk()
        self.assertLess(
            jerk,
            JERK_SMOOTH_THRESHOLD,
            f"Buffer mượt phải tạo Jerk < {JERK_SMOOTH_THRESHOLD}, nhận được {jerk:.2f}"
        )

        # Xác nhận FeintFilter phân loại đúng
        rom_ratio = 0.50
        velocity_ratio = 0.35
        motion_class = self.tracker.feint_filter.classify(rom_ratio, velocity_ratio)
        self.assertEqual(
            motion_class,
            MotionClass.TACTICAL_FEINT,
            f"Jerk={jerk:.2f} — Nên là TACTICAL_FEINT"
        )

        # Update tracker, giữ timestamp liên tục (t=8*33=264ms) để jerk không nhảy
        # velocity=0.40 gần bằng base_vel trong buffer → push không tạo spike acceleration
        alert = self.tracker.update(
            rom_ratio=rom_ratio,
            velocity=0.40,
            technique="Jab",
            time_ms=264.0,
            is_active_limb=True,
        )

        self.assertIsNone(alert, "Đòn nhử TACTICAL_FEINT không được sinh Alert")
        self.assertEqual(
            self.tracker.state,
            JointHealthState.HEALTHY,
            "Tracker phải giữ HEALTHY sau đòn nhử mượt"
        )

    def test_low_rom_enters_suspected_then_recovery_deflag(self):
        """
        ROM 50% với velocity trung bình (PARTIAL_STRIKE hoặc không rõ) → vào SUSPECTED.
        Đòn tiếp theo ROM 95% + velocity bình thường → de-flag về HEALTHY.
        """
        # Giả lập trường hợp jerk cao hơn ngưỡng (không phải feint)
        _feed_jerky_velocity(self.tracker, base_vel=0.8, n=8)

        rom_ratio_low = 0.50
        alert1 = self.tracker.update(
            rom_ratio=rom_ratio_low,
            velocity=0.6,
            technique="Jab",
            time_ms=5000.0,
            is_active_limb=True,
        )

        # Có thể vào SUSPECTED (tùy jerk)
        # Điều quan trọng: chưa CONFIRMED_IMPAIRMENT
        self.assertIsNone(alert1, "1 đòn đơn lẻ không nên sinh CONFIRMED_IMPAIRMENT")
        self.assertNotEqual(
            self.tracker.state,
            JointHealthState.CONFIRMED_IMPAIRMENT,
            "1 đòn đơn lẻ không đủ để CONFIRMED_IMPAIRMENT"
        )

        # Đòn tiếp theo: ROM hồi phục 95%
        _feed_smooth_velocity(self.tracker, base_vel=0.7, n=4)
        alert2 = self.tracker.update(
            rom_ratio=0.95,
            velocity=0.7,
            technique="Jab",
            time_ms=6000.0,
            is_active_limb=True,
        )

        self.assertIsNone(alert2, "Đòn hồi phục không sinh Alert")
        self.assertEqual(
            self.tracker.state,
            JointHealthState.HEALTHY,
            "Sau ROM 95%, tracker PHẢI de-flag về HEALTHY"
        )
        self.assertEqual(
            self.tracker._consecutive_low_rom,
            0,
            "consecutive_low_rom phải reset về 0 sau de-flag"
        )


# ─── TC-2: Real Impairment ────────────────────────────────────────────────────

class TestTC2_RealImpairment(unittest.TestCase):
    """
    TC-2: Vai trái có Jerk cao và 5 đòn liên tiếp ROM ≤ 60% trong 90s
    → Chuyển sang CONFIRMED_IMPAIRMENT.
    """

    def setUp(self):
        self.tracker = JointHealthTracker(JointName.LEFT_SHOULDER)
        self.tracker.feint_filter.update_torso(0.30)

    def test_five_consecutive_low_rom_confirms_impairment(self):
        """5 đòn ROM ≤ 60% liên tiếp với Jerk cao → CONFIRMED_IMPAIRMENT."""
        # Đòn đầu tiên: vào SUSPECTED
        _feed_jerky_velocity(self.tracker, base_vel=1.0, n=8)
        alert = self.tracker.update(
            rom_ratio=0.55,
            velocity=0.8,
            technique="Jab",
            time_ms=10_000.0,  # t = 10s
            is_active_limb=True,
        )
        self.assertIsNone(alert)
        self.assertEqual(self.tracker.state, JointHealthState.SUSPECTED)

        # Đòn 2–5: ROM vẫn thấp, Jerk vẫn cao
        final_alert = None
        for i in range(2, CONSECUTIVE_LOW_ROM_LIMIT + 1):
            _feed_jerky_velocity(self.tracker, base_vel=1.0, n=4)
            t_ms = 10_000.0 + i * 15_000.0  # mỗi đòn cách nhau ~15s, tổng ~90s
            final_alert = self.tracker.update(
                rom_ratio=0.50,
                velocity=0.7,
                technique="Jab",
                time_ms=t_ms,
                is_active_limb=True,
            )

        # Phải sinh Alert sau đòn thứ 5
        self.assertIsNotNone(
            final_alert,
            f"Sau {CONSECUTIVE_LOW_ROM_LIMIT} đòn ROM thấp phải sinh AlertPayload"
        )
        self.assertEqual(
            self.tracker.state,
            JointHealthState.CONFIRMED_IMPAIRMENT,
            "Tracker PHẢI ở CONFIRMED_IMPAIRMENT"
        )
        self.assertEqual(final_alert.joint, JointName.LEFT_SHOULDER.value)
        self.assertIn(final_alert.severity, ("high", "critical"))
        self.assertEqual(
            final_alert.consecutive_low_rom,
            CONSECUTIVE_LOW_ROM_LIMIT,
            f"consecutive_low_rom phải = {CONSECUTIVE_LOW_ROM_LIMIT}"
        )
        self.assertLessEqual(
            final_alert.avg_rom_ratio,
            ROM_LOW_THRESHOLD + 0.01,
            "avg_rom_ratio phải dưới ngưỡng thấp"
        )

    def test_confirmed_alert_is_in_get_confirmed_alerts(self):
        """Alert CONFIRMED_IMPAIRMENT phải xuất hiện trong SessionHealthMonitor.get_confirmed_alerts()."""
        monitor = SessionHealthMonitor()
        tracker = monitor.get_tracker(JointName.LEFT_SHOULDER)
        tracker.feint_filter.update_torso(0.30)

        # Khởi đầu buffer với jerk cao
        _feed_jerky_velocity(tracker, base_vel=1.0, n=8)

        for i in range(CONSECUTIVE_LOW_ROM_LIMIT):
            _feed_jerky_velocity(tracker, base_vel=0.9, n=4)
            # Baseline Jab = 160°, ROM 55% → 160*0.55 = 88° elbow angle
            monitor.on_punch_event(
                punch_type="Jab",
                arm="left",
                max_elbow_angle=88.0,   # 55% của 160°
                peak_speed=0.7,
                time_ms=float(10_000 + i * 15_000),
                torso_length=0.30,
            )

        # get_confirmed_alerts() trả về list[dict]
        confirmed = monitor.get_confirmed_alerts()
        self.assertGreater(
            len(confirmed),
            0,
            "SessionHealthMonitor.get_confirmed_alerts() phải trả về ít nhất 1 alert"
        )
        # Đây là dict (sau .to_dict()) — truy cập bằng key string
        self.assertEqual(confirmed[0]["state"], "CONFIRMED_IMPAIRMENT")
        self.assertEqual(confirmed[0]["joint"], "LEFT_SHOULDER")


# ─── TC-3: Rolling Window Timeout ────────────────────────────────────────────

class TestTC3_WindowTimeout(unittest.TestCase):
    """
    TC-3: Vào SUSPECTED với 2 đòn ROM thấp, hết cửa sổ thời gian → CONFIRMED_IMPAIRMENT.
    Edge case: N đòn không đủ nhưng window timeout kích hoạt escalation.
    """

    def test_window_timeout_with_multiple_low_rom_escalates(self):
        tracker = JointHealthTracker(JointName.RIGHT_KNEE, window_sec=30.0)  # window ngắn 30s
        tracker.feint_filter.update_torso(0.30)

        # Đòn 1: vào SUSPECTED
        _feed_jerky_velocity(tracker, base_vel=1.0, n=8)
        tracker.update(
            rom_ratio=0.55,
            velocity=0.7,
            technique="Kick",
            time_ms=0.0,
            is_active_limb=True,
        )
        self.assertEqual(tracker.state, JointHealthState.SUSPECTED)

        # Đòn 2: vẫn thấp, nhưng chưa đủ 5 đòn
        _feed_jerky_velocity(tracker, base_vel=0.9, n=4)
        tracker.update(
            rom_ratio=0.52,
            velocity=0.65,
            technique="Kick",
            time_ms=10_000.0,  # t = 10s
            is_active_limb=True,
        )
        self.assertNotEqual(tracker.state, JointHealthState.CONFIRMED_IMPAIRMENT,
                            "Chưa đủ đòn/window → chưa CONFIRMED")

        # Đòn 3: hết window (>30s) với consecutive >= 2
        _feed_jerky_velocity(tracker, base_vel=0.8, n=4)
        alert = tracker.update(
            rom_ratio=0.50,
            velocity=0.6,
            technique="Kick",
            time_ms=35_000.0,  # t = 35s, vượt window_sec=30s
            is_active_limb=True,
        )

        self.assertIsNotNone(alert, "Timeout window PHẢI trigger CONFIRMED_IMPAIRMENT")
        self.assertEqual(tracker.state, JointHealthState.CONFIRMED_IMPAIRMENT)


# ─── TC-4: Inactive Limb Not Penalized ───────────────────────────────────────

class TestTC4_InactiveLimbNotPenalized(unittest.TestCase):
    """
    TC-4 (Bẫy #2): Võ sĩ đấm 10 cú tay TRÁI liên tiếp.
    Tracker của tay PHẢI PHẢI giữ nguyên HEALTHY, consecutive_low_rom = 0.

    Điểm mấu chốt: on_punch_event chỉ update tracker của arm chủ động,
    tay kia chỉ nhận mark_other_limb_active().
    """

    def test_right_shoulder_stays_healthy_during_left_jabs(self):
        """10 cú Jab trái → RIGHT_SHOULDER và RIGHT_ELBOW không bị penalize."""
        monitor = SessionHealthMonitor()

        right_shoulder_tracker = monitor.get_tracker(JointName.RIGHT_SHOULDER)
        right_elbow_tracker    = monitor.get_tracker(JointName.RIGHT_ELBOW)
        left_shoulder_tracker  = monitor.get_tracker(JointName.LEFT_SHOULDER)

        # 10 cú Jab trái với ROM thấp (để kiểm tra tay phải)
        for i in range(10):
            monitor.on_punch_event(
                punch_type="Jab",
                arm="left",
                max_elbow_angle=85.0,   # ~53% baseline (160°) — thấp nhưng chỉ cho tay trái
                peak_speed=0.6,
                time_ms=float(i * 8_000),
                torso_length=0.30,
            )

        # Tay phải KHÔNG ĐƯỢC bị ảnh hưởng
        self.assertEqual(
            right_shoulder_tracker.state,
            JointHealthState.HEALTHY,
            "RIGHT_SHOULDER phải giữ HEALTHY khi không tham gia đòn Jab trái"
        )
        self.assertEqual(
            right_elbow_tracker.state,
            JointHealthState.HEALTHY,
            "RIGHT_ELBOW phải giữ HEALTHY khi không tham gia đòn Jab trái"
        )
        self.assertEqual(
            right_shoulder_tracker._consecutive_low_rom,
            0,
            "consecutive_low_rom của RIGHT_SHOULDER phải = 0 (không bị tính)"
        )

    def test_active_left_shoulder_is_updated(self):
        """Xác nhận LEFT_SHOULDER vẫn được update (tay chủ động bị theo dõi đúng)."""
        monitor = SessionHealthMonitor()
        left_shoulder_tracker = monitor.get_tracker(JointName.LEFT_SHOULDER)

        # Điền buffer jerky để không classify là TACTICAL_FEINT
        _feed_jerky_velocity(left_shoulder_tracker, base_vel=0.9, n=8)

        for i in range(CONSECUTIVE_LOW_ROM_LIMIT):
            _feed_jerky_velocity(left_shoulder_tracker, base_vel=0.8, n=4)
            monitor.on_punch_event(
                punch_type="Jab",
                arm="left",
                max_elbow_angle=88.0,
                peak_speed=0.7,
                time_ms=float(5_000 + i * 12_000),
                torso_length=0.30,
            )

        # LEFT_SHOULDER PHẢI bị update và có thể reach CONFIRMED
        self.assertGreater(
            left_shoulder_tracker._consecutive_low_rom,
            0,
            "LEFT_SHOULDER (chi chủ động) phải có consecutive_low_rom > 0"
        )

    def test_cross_right_does_not_penalize_left(self):
        """10 cú Cross phải → LEFT_SHOULDER và LEFT_ELBOW không bị penalize."""
        monitor = SessionHealthMonitor()
        left_shoulder = monitor.get_tracker(JointName.LEFT_SHOULDER)
        left_elbow    = monitor.get_tracker(JointName.LEFT_ELBOW)

        for i in range(10):
            monitor.on_punch_event(
                punch_type="Cross",
                arm="right",
                max_elbow_angle=88.0,   # ~53% baseline Cross (165°)
                peak_speed=0.7,
                time_ms=float(i * 8_000),
                torso_length=0.30,
            )

        self.assertEqual(left_shoulder.state, JointHealthState.HEALTHY,
                         "LEFT_SHOULDER phải HEALTHY khi chỉ tay phải đấm")
        self.assertEqual(left_shoulder._consecutive_low_rom, 0)
        self.assertEqual(left_elbow._consecutive_low_rom, 0)


# ─── TC-5: Limb Disuse / False Negative ───────────────────────────────────────

class TestTC5_LimbDisuseAvoidance(unittest.TestCase):
    """
    TC-5 (Bẫy #3): Khớp vai trái vào SUSPECTED lúc t=10s.
    Từ t=10s đến t=100s không có đòn nào của khớp này,
    nhưng các khớp khác vẫn hoạt động bình thường.
    → Trạng thái KHÔNG ĐƯỢC tự de-flag về HEALTHY.
    → Phải chuyển sang SUSPECTED_AVOIDANCE.
    """

    def test_silent_joint_does_not_deflag_to_healthy(self):
        """
        Khớp im lặng sau khi bị SUSPECTED trong khi chi khác ra đòn
        → KHÔNG tự de-flag về HEALTHY.
        """
        monitor = SessionHealthMonitor()
        left_sh = monitor.get_tracker(JointName.LEFT_SHOULDER)
        left_sh.feint_filter.update_torso(0.30)

        # Bước 1: Kích hoạt SUSPECTED cho vai trái
        _feed_jerky_velocity(left_sh, base_vel=1.0, n=8)
        monitor.on_punch_event(
            punch_type="Jab",
            arm="left",
            max_elbow_angle=88.0,   # 55% baseline → LOW
            peak_speed=0.7,
            time_ms=10_000.0,       # t = 10s
            torso_length=0.30,
        )
        self.assertEqual(
            left_sh.state,
            JointHealthState.SUSPECTED,
            "Sau đòn ROM thấp, phải vào SUSPECTED"
        )

        # Bước 2: Các chi khác vẫn hoạt động (Cross phải liên tục)
        # Vai trái IM LẶNG hoàn toàn
        # Giả lập DISUSE_SEC_TRIGGER + 10s để trigger disuse
        other_activity_time = 10_000.0 + (DISUSE_SEC_TRIGGER + 10) * 1000.0
        for i in range(5):
            t_ms = 10_000.0 + (i + 1) * (DISUSE_SEC_TRIGGER / 5) * 1000.0
            monitor.on_punch_event(
                punch_type="Cross",
                arm="right",
                max_elbow_angle=165.0,  # Tay phải bình thường
                peak_speed=1.0,
                time_ms=t_ms,
                torso_length=0.30,
            )

        # Bước cuối: check state của vai trái
        # Sau khi mark_other_limb_active được gọi nhiều lần qua on_punch_event Cross phải
        final_state = left_sh.state
        self.assertNotEqual(
            final_state,
            JointHealthState.HEALTHY,
            "Vai trái KHÔNG ĐƯỢC tự de-flag về HEALTHY khi nó im lặng"
        )
        # Phải là SUSPECTED hoặc SUSPECTED_AVOIDANCE (không bao giờ là HEALTHY hay CONFIRMED)
        self.assertIn(
            final_state,
            (JointHealthState.SUSPECTED, JointHealthState.SUSPECTED_AVOIDANCE),
            f"Trạng thái phải là SUSPECTED hoặc SUSPECTED_AVOIDANCE, nhận được: {final_state}"
        )

    def test_disuse_triggers_suspected_avoidance(self):
        """
        Im lặng đủ lâu (> DISUSE_SEC_TRIGGER) trong khi chi khác hoạt động
        → Chuyển sang SUSPECTED_AVOIDANCE.
        """
        monitor = SessionHealthMonitor()
        left_sh = monitor.get_tracker(JointName.LEFT_SHOULDER)
        left_sh.feint_filter.update_torso(0.30)

        # Kích hoạt SUSPECTED
        _feed_jerky_velocity(left_sh, base_vel=1.0, n=8)
        monitor.on_punch_event(
            punch_type="Jab",
            arm="left",
            max_elbow_angle=88.0,
            peak_speed=0.7,
            time_ms=10_000.0,
            torso_length=0.30,
        )
        self.assertEqual(left_sh.state, JointHealthState.SUSPECTED)

        # Giả lập chi khác hoạt động sau đúng DISUSE_SEC_TRIGGER giây im lặng
        trigger_time_ms = 10_000.0 + DISUSE_SEC_TRIGGER * 1000.0 + 5_000.0
        monitor.on_punch_event(
            punch_type="Cross",
            arm="right",
            max_elbow_angle=165.0,
            peak_speed=1.0,
            time_ms=trigger_time_ms,
            torso_length=0.30,
        )

        # Lúc này mark_other_limb_active đã được gọi với timestamp đủ xa
        # → _check_disuse phải đã kích hoạt
        self.assertEqual(
            left_sh.state,
            JointHealthState.SUSPECTED_AVOIDANCE,
            f"Phải là SUSPECTED_AVOIDANCE sau {DISUSE_SEC_TRIGGER}s im lặng, "
            f"nhận được: {left_sh.state}"
        )

    def test_recovery_from_suspected_avoidance_on_normal_strike(self):
        """
        Từ SUSPECTED_AVOIDANCE, nếu chi đột nhiên ra đòn bình thường (ROM ≥ 90%)
        → De-flag về HEALTHY.
        """
        monitor = SessionHealthMonitor()
        left_sh = monitor.get_tracker(JointName.LEFT_SHOULDER)
        left_sh.feint_filter.update_torso(0.30)

        # 1. Vào SUSPECTED_AVOIDANCE
        _feed_jerky_velocity(left_sh, base_vel=1.0, n=8)
        left_sh.state = JointHealthState.SUSPECTED_AVOIDANCE  # Đặt trực tiếp để test
        left_sh._window_start_ms = 0.0
        left_sh._last_active_ms = 10_000.0

        # 2. Ra đòn bình thường với ROM ≥ 90%
        _feed_smooth_velocity(left_sh, base_vel=0.8, n=4)
        alert = left_sh.update(
            rom_ratio=0.95,       # 95% baseline → bình thường
            velocity=0.8,
            technique="Jab",
            time_ms=80_000.0,
            is_active_limb=True,
        )

        self.assertIsNone(alert)
        self.assertEqual(
            left_sh.state,
            JointHealthState.HEALTHY,
            "Từ SUSPECTED_AVOIDANCE, ra đòn ROM ≥ 90% → De-flag về HEALTHY"
        )


# ─── Bonus: FeintFilter Unit Tests ───────────────────────────────────────────

class TestFeintFilter(unittest.TestCase):
    """Kiểm tra trực tiếp FeintFilter."""

    def test_smooth_motion_classifies_as_feint(self):
        """Chuyển động mượt với ROM thấp → TACTICAL_FEINT."""
        ff = FeintFilter(torso_length=0.30)
        _feed_smooth_velocity_ff(ff, base_vel=0.3, n=8)
        result = ff.classify(rom_ratio=0.50, velocity_ratio=0.30)
        self.assertEqual(result, MotionClass.TACTICAL_FEINT)

    def test_full_rom_classifies_as_power_strike(self):
        """ROM ≥ 90% → POWER_STRIKE."""
        ff = FeintFilter(torso_length=0.30)
        result = ff.classify(rom_ratio=0.95, velocity_ratio=1.0)
        self.assertEqual(result, MotionClass.POWER_STRIKE)

    def test_jerk_buffer_insufficient_returns_zero(self):
        """Chưa đủ sample → jerk = 0.0."""
        ff = FeintFilter(torso_length=0.30)
        ff.push_velocity(0.5, 0.0)
        ff.push_velocity(0.6, 33.0)
        self.assertEqual(ff.compute_smooth_jerk(), 0.0)

    def test_torso_normalization(self):
        """Dimensionless Jerk phải khác nhau khi torso_length khác nhau với cùng raw motion."""
        ff_near = FeintFilter(torso_length=0.50)  # võ sĩ gần camera
        ff_far  = FeintFilter(torso_length=0.15)  # võ sĩ xa camera

        import math
        vels = [0.0, 2.0, 0.5, 3.0, 0.2, 2.8, 0.3, 3.1]
        for i, v in enumerate(vels):
            t = float(i * 33)
            ff_near.push_velocity(v, t)
            ff_far.push_velocity(v, t)

        jerk_near = ff_near.compute_smooth_jerk()
        jerk_far  = ff_far.compute_smooth_jerk()

        # Cùng chuyển động thực tế nhưng xa camera → torso nhỏ → dimensionless jerk LỚN hơn
        self.assertGreater(
            jerk_far, jerk_near,
            "Dimensionless Jerk với torso nhỏ phải lớn hơn (chuẩn hóa phải tách biệt khoảng cách camera)"
        )


def _feed_smooth_velocity_ff(ff: FeintFilter, base_vel: float = 0.5, n: int = 8):
    """Helper: đẩy velocity hầu như không đổi vào FeintFilter → Jerk gần 0."""
    for i in range(n):
        t_ms = float(i * 33)
        vel = base_vel + 0.005 * (i % 2)  # biến thiên cực nhỏ
        ff.push_velocity(vel, t_ms)


# ─── Entry point ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    unittest.main(verbosity=2)
