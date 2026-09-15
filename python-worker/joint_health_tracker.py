"""
joint_health_tracker.py — MMA-TMS Phase 3: Anomaly Detection & Joint Health Monitoring

Giải quyết bài toán phân biệt Đòn nhử (Feint) khỏi tổn thương thực sự,
và theo dõi sức khỏe khớp xuyên suốt một trận/session luyện tập.

== Bốn bẫy kỹ thuật được xử lý ==
1. Jerk Noise Amplification — Smoothing trước khi vi phân, chuẩn hóa theo Torso Length.
2. Inactive Limb Penalty   — Chỉ update tracker của chi CHỦ ĐỘNG trong đòn đó.
3. Limb Disuse / False Neg — Thêm trạng thái SUSPECTED_AVOIDANCE khi chi ngừng hoạt động.
4. Technique-Aware Baseline — Baseline ROM gắn với loại kỹ thuật (Straight vs Hook vs Kick...).

== State Machine ==
    HEALTHY
       │ 1 đòn lệch chuẩn đáng ngờ
       ▼
    SUSPECTED ──────────────────────────────────────────┐
       │ Chi ngừng hoạt động trong window                │ ROM ≥ 90% baseline
       │ (các chi khác vẫn đánh)                         │ + velocity bình thường
       ▼                                                  │
  SUSPECTED_AVOIDANCE                              De-flag ↓
       │ Sau window timeout / N đòn ROM thấp        HEALTHY ←─┘
       ▼
  CONFIRMED_IMPAIRMENT  ← Duy nhất trạng thái này mới xuất Alert ra ngoài
"""

from __future__ import annotations

import collections
import logging
import math
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

log = logging.getLogger(__name__)

# ─── Hằng số mặc định ────────────────────────────────────────────────────────

# Ngưỡng ROM (tỷ lệ so với baseline của kỹ thuật) dưới đây bị coi là "thiếu ROM"
ROM_LOW_THRESHOLD       = 0.60   # < 60% baseline → low ROM
ROM_RECOVERY_THRESHOLD  = 0.90   # ≥ 90% baseline → de-flag về HEALTHY

# Cửa sổ quan sát sau khi vào SUSPECTED (giây)
WINDOW_SEC_MIN    = 60.0
WINDOW_SEC_MAX    = 120.0

# Số đòn liên tiếp ROM thấp để escalate lên CONFIRMED_IMPAIRMENT
CONSECUTIVE_LOW_ROM_LIMIT = 5

# Ngưỡng tần suất sử dụng: nếu chi khác vẫn ra đòn nhưng chi này không,
# sau bao nhiêu giây tự chuyển sang SUSPECTED_AVOIDANCE
DISUSE_SEC_TRIGGER = 60.0

# Kích thước buffer lịch sử vận tốc để tính acceleration & jerk
VELOCITY_HISTORY_SIZE = 8

# Savitzky-Golay-like smoothing window cho velocity buffer trước khi tính jerk
# (Moving average đơn giản để tránh import scipy)
JERK_SMOOTH_WINDOW = 3

# Jerk threshold (đã chuẩn hóa theo torso_length/s³).
# Hiệu chỉnh thực nghiệm với tọa độ YOLO-Pose chuẩn hóa 0–1 ở 30fps:
#   - Chuyển động MƯỢT (feint có chủ đích): velocity tăng đều ~0.01 u/frame → jerk ≈ 0–80
#   - Chuyển động GIẬT CỤC (né đau/co cơ): dao động ±0.5 u/frame → jerk ≈ 200–2000
# Ngưỡng 120.0 tách biệt rõ hai chế độ trên.
JERK_SMOOTH_THRESHOLD = 120.0    # dimensionless (u / torso / s³)

# Ngưỡng velocity tối thiểu để được coi là đòn nhử có chủ ý (không phải run tay)
MIN_FEINT_VELOCITY_RATIO = 0.20  # ≥ 20% baseline velocity

# ─── Baseline ROM theo loại kỹ thuật ─────────────────────────────────────────

# Giá trị chuẩn góc khuỷu tay (độ) tại điểm impact, theo kỹ thuật
# Nguồn: punch_analyzer.py + biomechanics literature
BASELINE_ROM_BY_TECHNIQUE: dict[str, float] = {
    "Cross":     165.0,   # đòn thẳng tay phải
    "Jab":       160.0,   # đòn thẳng tay trái
    "Hook":      100.0,   # đòn móc (góc khuỷu ~90–110°)
    "Uppercut":   90.0,   # đòn móc lên (góc khuỷu ~80–100°)
    "Kick":      155.0,   # góc duỗi gối trong đá vòng cầu
    "default":   160.0,   # fallback
}

# Baseline velocity ratio — dùng để đánh giá velocity đòn là bình thường hay không
# (sẽ được tính thích ứng từ lịch sử session, giá trị này là seed ban đầu)
BASELINE_VELOCITY_SEED = 0.6   # u/s


# ─── Enums ───────────────────────────────────────────────────────────────────

class JointName(str, Enum):
    LEFT_SHOULDER  = "LEFT_SHOULDER"
    RIGHT_SHOULDER = "RIGHT_SHOULDER"
    LEFT_ELBOW     = "LEFT_ELBOW"
    RIGHT_ELBOW    = "RIGHT_ELBOW"
    LEFT_HIP       = "LEFT_HIP"
    RIGHT_HIP      = "RIGHT_HIP"
    LEFT_KNEE      = "LEFT_KNEE"
    RIGHT_KNEE     = "RIGHT_KNEE"


class JointHealthState(str, Enum):
    HEALTHY               = "HEALTHY"
    SUSPECTED             = "SUSPECTED"
    SUSPECTED_AVOIDANCE   = "SUSPECTED_AVOIDANCE"  # Chi ngừng dùng — nghi né đau
    CONFIRMED_IMPAIRMENT  = "CONFIRMED_IMPAIRMENT"


class MotionClass(str, Enum):
    TACTICAL_FEINT  = "TACTICAL_FEINT"   # Đòn nhử chiến thuật
    POWER_STRIKE    = "POWER_STRIKE"     # Đòn hết lực
    PARTIAL_STRIKE  = "PARTIAL_STRIKE"   # Đòn trung gian
    UNKNOWN         = "UNKNOWN"


# ─── Dataclasses ─────────────────────────────────────────────────────────────

@dataclass
class AlertPayload:
    """Cấu trúc cảnh báo xuất ra ngoài hệ thống."""
    joint:                  str
    state:                  str
    severity:               str         # "medium" | "high" | "critical"
    trigger_time_ms:        float
    window_start_ms:        float
    consecutive_low_rom:    int
    avg_rom_ratio:          float
    motion_class:           str
    recommendation:         str

    def to_dict(self) -> dict:
        return {
            "joint":               self.joint,
            "state":               self.state,
            "severity":            self.severity,
            "triggerTimeMs":       round(self.trigger_time_ms, 1),
            "windowStartMs":       round(self.window_start_ms, 1),
            "consecutiveLowRom":   self.consecutive_low_rom,
            "avgRomRatio":         round(self.avg_rom_ratio, 3),
            "motionClass":         self.motion_class,
            "recommendation":      self.recommendation,
        }


# ─── FeintFilter ─────────────────────────────────────────────────────────────

class FeintFilter:
    """
    Phân loại chuyển động thành TACTICAL_FEINT / POWER_STRIKE / PARTIAL_STRIKE.

    Xử lý Bẫy #1 — Jerk Noise Amplification:
    - Velocity buffer được làm mượt bằng moving average trước khi tính acceleration.
    - Jerk được chuẩn hóa theo torso_length (chiều dài thân người ước tính từ keypoints).
    - Kết quả: "Dimensionless Jerk" không phụ thuộc khoảng cách camera.
    """

    def __init__(self, torso_length: float = 0.30):
        """
        Args:
            torso_length: Chiều dài thân người (đơn vị chuẩn hóa 0–1).
                          Mặc định 0.30 (30% chiều cao ảnh) — sẽ được cập nhật động.
        """
        self.torso_length = max(torso_length, 0.05)  # tránh chia 0
        # Lịch sử velocity (đơn vị: normalized/s)
        self._vel_history: collections.deque[float] = collections.deque(
            maxlen=VELOCITY_HISTORY_SIZE
        )
        # Lịch sử timestamp tương ứng
        self._time_history: collections.deque[float] = collections.deque(
            maxlen=VELOCITY_HISTORY_SIZE
        )

    def update_torso(self, torso_length: float) -> None:
        """Cập nhật ước tính chiều dài thân người (gọi mỗi frame từ keypoints)."""
        if torso_length > 0.02:
            # EMA để tránh nhảy đột ngột khi detection lệch
            self.torso_length = 0.15 * torso_length + 0.85 * self.torso_length

    def push_velocity(self, velocity: float, time_ms: float) -> None:
        """Đẩy vận tốc mới vào buffer (gọi mỗi frame/đòn)."""
        self._vel_history.append(velocity)
        self._time_history.append(time_ms)

    def compute_smooth_jerk(self) -> float:
        """
        Tính Dimensionless Jerk từ buffer velocity đã làm mượt.

        Quy trình:
        1. Làm mượt velocity buffer bằng moving average (window = JERK_SMOOTH_WINDOW).
        2. Tính acceleration từ velocity đã mượt.
        3. Tính jerk từ acceleration.
        4. Chuẩn hóa theo torso_length.

        Returns:
            Dimensionless jerk (không âm). Giá trị 0.0 nếu chưa đủ dữ liệu.
        """
        vels = list(self._vel_history)
        times = list(self._time_history)

        if len(vels) < 4:
            return 0.0

        # Bước 1: Làm mượt velocity bằng moving average
        w = JERK_SMOOTH_WINDOW
        smooth_vels = []
        for i in range(len(vels)):
            lo = max(0, i - w // 2)
            hi = min(len(vels), lo + w)
            smooth_vels.append(sum(vels[lo:hi]) / (hi - lo))

        # Bước 2: Tính acceleration từ smooth_vels
        accels = []
        for i in range(1, len(smooth_vels)):
            dt_s = (times[i] - times[i - 1]) / 1000.0
            if dt_s <= 0:
                continue
            accels.append((smooth_vels[i] - smooth_vels[i - 1]) / dt_s)

        if len(accels) < 2:
            return 0.0

        # Bước 3: Tính jerk từ acceleration
        jerks = []
        for i in range(1, len(accels)):
            # Dùng thời điểm giữa để ánh xạ jerk
            idx = i  # chỉ số trong accels tương ứng với vels index i+1
            dt_s = (times[min(idx + 1, len(times) - 1)] - times[idx]) / 1000.0
            if dt_s <= 0:
                continue
            jerks.append(abs((accels[i] - accels[i - 1]) / dt_s))

        if not jerks:
            return 0.0

        # Lấy giá trị jerk đỉnh (worst-case trong window)
        raw_jerk = max(jerks)

        # Bước 4: Chuẩn hóa theo torso_length → Dimensionless Jerk
        dimensionless_jerk = raw_jerk / max(self.torso_length, 0.05)
        return dimensionless_jerk

    def classify(
        self,
        rom_ratio: float,
        velocity_ratio: float,
        technique: str = "default",
    ) -> MotionClass:
        """
        Phân loại chuyển động.

        Quy tắc Feint:
            rom_ratio < 0.65          — biên độ thấp
            AND jerk <= SMOOTH_THRESHOLD — chuyển động mượt (có chủ đích)
            AND velocity_ratio >= MIN_FEINT_VELOCITY_RATIO — không phải run tay

        Args:
            rom_ratio:       actual_rom / baseline_rom của kỹ thuật này.
            velocity_ratio:  actual_velocity / baseline_velocity.
            technique:       Loại kỹ thuật (Cross, Jab, Hook, Kick,...).

        Returns:
            MotionClass enum value.
        """
        jerk = self.compute_smooth_jerk()

        is_low_rom = rom_ratio < 0.65
        is_smooth  = jerk <= JERK_SMOOTH_THRESHOLD
        is_intentional = velocity_ratio >= MIN_FEINT_VELOCITY_RATIO

        if is_low_rom and is_smooth and is_intentional:
            return MotionClass.TACTICAL_FEINT

        if rom_ratio >= ROM_RECOVERY_THRESHOLD:
            return MotionClass.POWER_STRIKE

        return MotionClass.PARTIAL_STRIKE


# ─── JointHealthTracker ───────────────────────────────────────────────────────

class JointHealthTracker:
    """
    Theo dõi sức khỏe một khớp đơn lẻ (ví dụ: LEFT_SHOULDER).

    Xử lý Bẫy #2, #3, #4.
    """

    def __init__(self, joint: JointName, window_sec: float = WINDOW_SEC_MAX):
        self.joint = joint
        self.window_sec = window_sec

        self.state: JointHealthState = JointHealthState.HEALTHY

        # Thống kê trong cửa sổ quan sát
        self._window_start_ms: float = 0.0
        self._consecutive_low_rom: int = 0
        self._rom_ratio_history: list[float] = []
        self._last_active_ms: float = -1.0   # Lần cuối chi này ra đòn
        self._last_other_active_ms: float = -1.0  # Lần cuối CÁC chi khác ra đòn
        self._trigger_time_ms: float = 0.0

        # Alert đã xây dựng (chỉ tồn tại khi CONFIRMED_IMPAIRMENT)
        self._active_alert: Optional[AlertPayload] = None

        # Feint filter riêng cho từng khớp
        self.feint_filter = FeintFilter()

        # Adaptive baseline velocity (EMA từ lịch sử HEALTHY)
        self._baseline_velocity: float = BASELINE_VELOCITY_SEED
        self._healthy_velocity_samples: int = 0

    # ── Public API ──

    def update(
        self,
        rom_ratio: float,
        velocity: float,
        technique: str,
        time_ms: float,
        is_active_limb: bool = True,
    ) -> Optional[AlertPayload]:
        """
        Cập nhật tracker với một sự kiện đòn đánh.

        Xử lý Bẫy #2: Chỉ gọi hàm này khi `is_active_limb=True`.
        Nếu chi không tham gia đòn đánh, gọi `mark_other_limb_active()` thay thế.

        Args:
            rom_ratio:      actual_rom / baseline_rom (0.0 – 1.0+).
            velocity:       Vận tốc đỉnh của chi này (u/s).
            technique:      Loại kỹ thuật (Cross, Jab, Hook, Kick,...).
            time_ms:        Timestamp của đòn (ms từ đầu video/session).
            is_active_limb: True nếu chi này là chi CHỦ ĐỘNG trong đòn đó.

        Returns:
            AlertPayload nếu vừa chuyển sang CONFIRMED_IMPAIRMENT, else None.
        """
        if not is_active_limb:
            # Bẫy #2: chi không tham gia — không update ROM counter
            return None

        velocity_ratio = velocity / max(self._baseline_velocity, 0.01)

        # Push velocity vào feint filter buffer
        self.feint_filter.push_velocity(velocity, time_ms)
        motion_class = self.feint_filter.classify(rom_ratio, velocity_ratio, technique)

        self._last_active_ms = time_ms

        return self._transition(rom_ratio, velocity_ratio, motion_class, time_ms)

    def mark_other_limb_active(self, time_ms: float) -> None:
        """
        Báo cho tracker biết một chi KHÁC vừa ra đòn tại timestamp này.
        Dùng để phát hiện Bẫy #3: chi bị nghi ngờ ngừng sử dụng khi chi khác vẫn hoạt động.
        """
        self._last_other_active_ms = time_ms
        self._check_disuse(time_ms)

    def get_active_alert(self) -> Optional[AlertPayload]:
        """Trả về alert hiện tại (None nếu chưa CONFIRMED_IMPAIRMENT)."""
        return self._active_alert

    def reset(self) -> None:
        """Reset tracker về HEALTHY (dùng khi bắt đầu session mới)."""
        self.state = JointHealthState.HEALTHY
        self._consecutive_low_rom = 0
        self._rom_ratio_history.clear()
        self._active_alert = None

    # ── Internal Transition Logic ──

    def _transition(
        self,
        rom_ratio: float,
        velocity_ratio: float,
        motion_class: MotionClass,
        time_ms: float,
    ) -> Optional[AlertPayload]:
        """Máy trạng thái chính."""

        if self.state == JointHealthState.HEALTHY:
            return self._from_healthy(rom_ratio, velocity_ratio, motion_class, time_ms)

        elif self.state == JointHealthState.SUSPECTED:
            return self._from_suspected(rom_ratio, velocity_ratio, motion_class, time_ms)

        elif self.state == JointHealthState.SUSPECTED_AVOIDANCE:
            # Nếu chi đột nhiên ra đòn lại với ROM bình thường → de-flag
            if rom_ratio >= ROM_RECOVERY_THRESHOLD:
                self._enter_healthy("SUSPECTED_AVOIDANCE → HEALTHY (chi hồi phục, ra đòn bình thường)")
            else:
                # Vẫn thấp → escalate
                return self._escalate_to_confirmed(rom_ratio, motion_class, time_ms)

        elif self.state == JointHealthState.CONFIRMED_IMPAIRMENT:
            pass  # Terminal state trong session này

        return None

    def _from_healthy(
        self,
        rom_ratio: float,
        velocity_ratio: float,
        motion_class: MotionClass,
        time_ms: float,
    ) -> Optional[AlertPayload]:
        """Logic khi đang HEALTHY."""
        if motion_class == MotionClass.TACTICAL_FEINT:
            # Đòn nhử rõ ràng — không phạt, không theo dõi
            log.debug(f"[{self.joint.value}] TACTICAL_FEINT tại {time_ms:.0f}ms — bỏ qua")
            return None

        if rom_ratio < ROM_LOW_THRESHOLD:
            # Một đòn lệch chuẩn đơn lẻ → chuyển SUSPECTED
            log.info(f"[{self.joint.value}] ROM={rom_ratio:.2f} thấp → SUSPECTED tại {time_ms:.0f}ms")
            self._enter_suspected(rom_ratio, time_ms)
        elif self.state == JointHealthState.HEALTHY:
            # Đòn bình thường → cập nhật adaptive baseline
            self._update_baseline_velocity(velocity_ratio, time_ms)

        return None

    def _from_suspected(
        self,
        rom_ratio: float,
        velocity_ratio: float,
        motion_class: MotionClass,
        time_ms: float,
    ) -> Optional[AlertPayload]:
        """Logic khi đang SUSPECTED."""
        elapsed_sec = (time_ms - self._window_start_ms) / 1000.0

        # De-flagging: ROM ≥ 90% baseline VÀ velocity bình thường
        if rom_ratio >= ROM_RECOVERY_THRESHOLD and velocity_ratio >= 0.70:
            log.info(
                f"[{self.joint.value}] De-flag SUSPECTED → HEALTHY tại {time_ms:.0f}ms "
                f"(ROM={rom_ratio:.2f})"
            )
            self._enter_healthy("Recovered — ROM ≥ 90% baseline with normal velocity")
            return None

        # Vẫn thấp ROM
        if motion_class != MotionClass.TACTICAL_FEINT:
            self._consecutive_low_rom += 1
            self._rom_ratio_history.append(rom_ratio)

        # Điều kiện escalate: N đòn liên tiếp không vượt ngưỡng
        if self._consecutive_low_rom >= CONSECUTIVE_LOW_ROM_LIMIT:
            return self._escalate_to_confirmed(rom_ratio, motion_class, time_ms)

        # Hết cửa sổ thời gian mà vẫn còn SUSPECTED và có đòn → escalate
        if elapsed_sec >= self.window_sec and self._consecutive_low_rom >= 2:
            log.info(
                f"[{self.joint.value}] Window timeout ({elapsed_sec:.0f}s) — escalate tới CONFIRMED"
            )
            return self._escalate_to_confirmed(rom_ratio, motion_class, time_ms)

        return None

    def _check_disuse(self, time_ms: float) -> None:
        """
        Xử lý Bẫy #3: Limb Disuse Detection.

        Nếu đang SUSPECTED mà chi này im lặng (không ra đòn) trong khi chi khác
        vẫn hoạt động, và khoảng lặng này vượt DISUSE_SEC_TRIGGER → SUSPECTED_AVOIDANCE.
        """
        if self.state not in (JointHealthState.SUSPECTED,):
            return

        # Chi này im lặng bao lâu?
        if self._last_active_ms < 0:
            return  # Chưa từng ra đòn

        silence_sec = (time_ms - self._last_active_ms) / 1000.0

        # Chi khác ra đòn trong cùng khoảng → xác nhận cơ thể vẫn vận động
        other_active_recently = (
            self._last_other_active_ms > self._last_active_ms
        )

        if silence_sec >= DISUSE_SEC_TRIGGER and other_active_recently:
            log.warning(
                f"[{self.joint.value}] Im lặng {silence_sec:.0f}s trong khi chi khác vẫn hoạt động "
                f"→ SUSPECTED_AVOIDANCE tại {time_ms:.0f}ms"
            )
            self.state = JointHealthState.SUSPECTED_AVOIDANCE

    # ── State Entry Helpers ──

    def _enter_suspected(self, rom_ratio: float, time_ms: float) -> None:
        self.state = JointHealthState.SUSPECTED
        self._window_start_ms = time_ms
        self._trigger_time_ms = time_ms
        self._consecutive_low_rom = 1
        self._rom_ratio_history = [rom_ratio]

    def _enter_healthy(self, reason: str = "") -> None:
        self.state = JointHealthState.HEALTHY
        self._consecutive_low_rom = 0
        self._rom_ratio_history.clear()
        self._active_alert = None
        if reason:
            log.debug(f"[{self.joint.value}] → HEALTHY: {reason}")

    def _escalate_to_confirmed(
        self,
        rom_ratio: float,
        motion_class: MotionClass,
        time_ms: float,
    ) -> AlertPayload:
        self.state = JointHealthState.CONFIRMED_IMPAIRMENT

        avg_rom = (
            sum(self._rom_ratio_history) / len(self._rom_ratio_history)
            if self._rom_ratio_history
            else rom_ratio
        )

        severity = "critical" if avg_rom < 0.40 else "high"

        alert = AlertPayload(
            joint=self.joint.value,
            state=self.state.value,
            severity=severity,
            trigger_time_ms=time_ms,
            window_start_ms=self._window_start_ms,
            consecutive_low_rom=self._consecutive_low_rom,
            avg_rom_ratio=round(avg_rom, 3),
            motion_class=motion_class.value,
            recommendation=self._build_recommendation(avg_rom),
        )
        self._active_alert = alert

        log.warning(
            f"🚨 [{self.joint.value}] CONFIRMED_IMPAIRMENT — avg_ROM={avg_rom:.2f}, "
            f"consecutive_low={self._consecutive_low_rom}, severity={severity}"
        )
        return alert

    def _update_baseline_velocity(self, velocity_ratio: float, time_ms: float) -> None:
        """Cập nhật adaptive baseline velocity từ các đòn HEALTHY."""
        # EMA với trọng số thấp để baseline ổn định
        self._baseline_velocity = (
            0.05 * (velocity_ratio * self._baseline_velocity)
            + 0.95 * self._baseline_velocity
        )
        self._healthy_velocity_samples += 1

    def _build_recommendation(self, avg_rom_ratio: float) -> str:
        side = "trái" if "LEFT" in self.joint.value else "phải"
        region = "vai" if "SHOULDER" in self.joint.value else (
            "khuỷu tay" if "ELBOW" in self.joint.value else (
                "hông" if "HIP" in self.joint.value else "gối"
            )
        )
        if avg_rom_ratio < 0.40:
            return (
                f"NGỪNG THI ĐẤU NGAY — Khớp {region} {side} có dấu hiệu tổn thương nghiêm trọng "
                f"(ROM chỉ đạt {avg_rom_ratio*100:.0f}% baseline). Kiểm tra y tế ngay lập tức."
            )
        return (
            f"Theo dõi khớp {region} {side} — ROM liên tục thấp ({avg_rom_ratio*100:.0f}% baseline). "
            f"Xem xét cho võ sĩ nghỉ ngơi và kiểm tra chấn thương sau hiệp đấu."
        )


# ─── SessionHealthMonitor ─────────────────────────────────────────────────────

class SessionHealthMonitor:
    """
    Aggregate nhiều JointHealthTracker cho một session.

    Điểm tích hợp vào process_video.py:
        monitor = SessionHealthMonitor()

        # Sau punch_analyzer.update():
        monitor.on_punch_event(punch_result, keypoints, time_ms)

        # Sau kick_analyzer.update():
        monitor.on_kick_event(kick_result, keypoints, time_ms)

        # Cuối video:
        alerts = monitor.get_confirmed_alerts()
    """

    def __init__(self):
        self._trackers: dict[JointName, JointHealthTracker] = {
            j: JointHealthTracker(j) for j in JointName
        }
        self._confirmed_alerts: list[AlertPayload] = []

    # ── Punch Events ──

    def on_punch_event(
        self,
        punch_type: str,       # "Cross" | "Jab" | "Hook" | "Uppercut"
        arm: str,              # "left" | "right"
        max_elbow_angle: float,
        peak_speed: float,
        time_ms: float,
        torso_length: float = 0.30,
    ) -> list[AlertPayload]:
        """
        Xử lý một sự kiện đòn đấm hoàn thành từ PunchAnalyzer.

        Xử lý Bẫy #2: Xác định chính xác khớp nào là CHỦ ĐỘNG.
        Xử lý Bẫy #4: Baseline ROM gắn với punch_type.

        Returns:
            Danh sách AlertPayload mới phát sinh (thường rỗng hoặc 1 phần tử).
        """
        baseline_rom = BASELINE_ROM_BY_TECHNIQUE.get(punch_type, BASELINE_ROM_BY_TECHNIQUE["default"])
        rom_ratio = max_elbow_angle / baseline_rom

        # Xác định khớp CHỦ ĐỘNG vs không tham gia
        if arm == "left":
            active_joints    = {JointName.LEFT_SHOULDER, JointName.LEFT_ELBOW}
            inactive_joints  = {JointName.RIGHT_SHOULDER, JointName.RIGHT_ELBOW}
        else:
            active_joints    = {JointName.RIGHT_SHOULDER, JointName.RIGHT_ELBOW}
            inactive_joints  = {JointName.LEFT_SHOULDER, JointName.LEFT_ELBOW}

        new_alerts: list[AlertPayload] = []

        # Cập nhật torso trong feint filter của khớp chủ động
        for j in active_joints:
            self._trackers[j].feint_filter.update_torso(torso_length)
            alert = self._trackers[j].update(
                rom_ratio=rom_ratio,
                velocity=peak_speed,
                technique=punch_type,
                time_ms=time_ms,
                is_active_limb=True,
            )
            if alert:
                self._confirmed_alerts.append(alert)
                new_alerts.append(alert)

        # Bẫy #2: Khớp đối diện chỉ nhận mark_other_limb_active
        for j in inactive_joints:
            self._trackers[j].mark_other_limb_active(time_ms)

        # Hip/Knee cũng nhận mark (họ không tham gia trực tiếp vào đòn đấm tay)
        for j in (JointName.LEFT_HIP, JointName.RIGHT_HIP,
                  JointName.LEFT_KNEE, JointName.RIGHT_KNEE):
            self._trackers[j].mark_other_limb_active(time_ms)

        return new_alerts

    # ── Kick Events ──

    def on_kick_event(
        self,
        leg: str,                  # "left" | "right"
        max_extension_angle: float,
        peak_speed: float,
        time_ms: float,
        torso_length: float = 0.30,
    ) -> list[AlertPayload]:
        """
        Xử lý một sự kiện cú đá hoàn thành từ KickAnalyzer.

        Returns:
            Danh sách AlertPayload mới phát sinh.
        """
        baseline_rom = BASELINE_ROM_BY_TECHNIQUE["Kick"]
        rom_ratio = max_extension_angle / baseline_rom

        if leg == "left":
            active_joints   = {JointName.LEFT_HIP, JointName.LEFT_KNEE}
            inactive_joints = {JointName.RIGHT_HIP, JointName.RIGHT_KNEE}
        else:
            active_joints   = {JointName.RIGHT_HIP, JointName.RIGHT_KNEE}
            inactive_joints = {JointName.LEFT_HIP, JointName.LEFT_KNEE}

        new_alerts: list[AlertPayload] = []

        for j in active_joints:
            self._trackers[j].feint_filter.update_torso(torso_length)
            alert = self._trackers[j].update(
                rom_ratio=rom_ratio,
                velocity=peak_speed,
                technique="Kick",
                time_ms=time_ms,
                is_active_limb=True,
            )
            if alert:
                self._confirmed_alerts.append(alert)
                new_alerts.append(alert)

        for j in inactive_joints:
            self._trackers[j].mark_other_limb_active(time_ms)

        # Vai không tham gia đá — nhận mark
        for j in (JointName.LEFT_SHOULDER, JointName.RIGHT_SHOULDER,
                  JointName.LEFT_ELBOW, JointName.RIGHT_ELBOW):
            self._trackers[j].mark_other_limb_active(time_ms)

        return new_alerts

    # ── Queries ──

    def get_confirmed_alerts(self) -> list[dict]:
        """Trả về tất cả alert CONFIRMED_IMPAIRMENT đã phát sinh trong session, dạng dict."""
        return [a.to_dict() for a in self._confirmed_alerts]

    def get_joint_states(self) -> dict[str, str]:
        """Snapshot trạng thái tất cả khớp tại thời điểm hiện tại."""
        return {j.value: t.state.value for j, t in self._trackers.items()}

    def get_tracker(self, joint: JointName) -> JointHealthTracker:
        """Lấy tracker của một khớp cụ thể (dùng trong tests)."""
        return self._trackers[joint]


# ─── Utility: Tính Torso Length từ keypoints ──────────────────────────────────

def estimate_torso_length(keypoints: list) -> float:
    """
    Ước tính chiều dài thân người từ keypoints YOLO-Pose.

    Torso = trung bình khoảng cách (shoulder → hip) của 2 bên.
    Dùng để chuẩn hóa Dimensionless Jerk.

    Args:
        keypoints: list[Point] dài 17, định dạng COCO.

    Returns:
        Torso length (0.0–1.0 tọa độ chuẩn hóa). Trả về 0.30 nếu confidence thấp.
    """
    if len(keypoints) < 13:
        return 0.30

    # Import lazy để tránh circular
    from pose_math import KP

    l_sh = keypoints[KP.LEFT_SHOULDER]
    r_sh = keypoints[KP.RIGHT_SHOULDER]
    l_hip = keypoints[KP.LEFT_HIP]
    r_hip = keypoints[KP.RIGHT_HIP]

    valid_sides = []
    if l_sh.conf > 0.3 and l_hip.conf > 0.3:
        valid_sides.append(math.dist((l_sh.x, l_sh.y), (l_hip.x, l_hip.y)))
    if r_sh.conf > 0.3 and r_hip.conf > 0.3:
        valid_sides.append(math.dist((r_sh.x, r_sh.y), (r_hip.x, r_hip.y)))

    if not valid_sides:
        return 0.30

    return sum(valid_sides) / len(valid_sides)
