"""
kick_analyzer.py — Port của kickStateMachine.js sang Python
Phân tích và chấm điểm cú đá vòng cầu từ chuỗi frame

Máy trạng thái:
  IDLE → CHAMBERING → EXTENDING → RECOVERING → IDLE
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

from pose_math import Point, calculate_speed


class KickState(str, Enum):
    IDLE       = "idle"
    CHAMBERING = "chambering"
    EXTENDING  = "extending"
    RECOVERING = "recovering"


KICK_STATE_LABELS = {
    KickState.IDLE:       "Đứng thủ",
    KickState.CHAMBERING: "Rút gối",
    KickState.EXTENDING:  "Bung chân",
    KickState.RECOVERING: "Thu chân",
}


@dataclass
class KickResult:
    """Kết quả chấm điểm một cú đá hoàn chỉnh."""
    score: int
    grade: str
    emoji: str
    details: list[str]
    min_chamber_angle: float
    max_extension_angle: float
    peak_speed: float
    # Frame range của cú đá này trong video
    start_frame: int = 0
    end_frame: int = 0
    start_time_ms: float = 0.0
    end_time_ms: float = 0.0

    def to_dict(self) -> dict:
        return {
            "score": self.score,
            "grade": self.grade,
            "emoji": self.emoji,
            "details": self.details,
            "minChamberAngle": round(self.min_chamber_angle, 1),
            "maxExtensionAngle": round(self.max_extension_angle, 1),
            "peakSpeed": round(self.peak_speed, 3),
            "startFrame": self.start_frame,
            "endFrame": self.end_frame,
            "startTimeMs": round(self.start_time_ms, 1),
            "endTimeMs": round(self.end_time_ms, 1),
        }


@dataclass
class KickAnalyzer:
    """
    Máy trạng thái phân tích cú đá — port của KickStateMachine.js.
    Xử lý tuần tự từng frame video.
    """
    state: KickState = KickState.IDLE
    min_chamber_angle: float = 180.0
    max_extension_angle: float = 0.0
    peak_speed: float = 0.0
    kick_start_frame: int = 0
    kick_start_time_ms: float = 0.0

    _last_ankle: Optional[Point] = field(default=None, repr=False)
    _last_time_ms: float = field(default=0.0, repr=False)

    # Lịch sử tất cả các cú đá đã hoàn thành trong video
    results: list[KickResult] = field(default_factory=list, repr=False)

    def update(
        self,
        knee_angle: float,
        hip_angle: float,
        ankle: Optional[Point],
        frame_idx: int,
        time_ms: float,
    ) -> Optional[KickResult]:
        """
        Cập nhật máy trạng thái với dữ liệu frame hiện tại.
        Trả về KickResult nếu vừa hoàn thành một cú đá, None nếu chưa.
        """
        # Tính tốc độ
        dt = time_ms - self._last_time_ms
        speed = 0.0
        if ankle:
            speed = calculate_speed(self._last_ankle, ankle, dt)
            self._last_ankle = ankle
        self._last_time_ms = time_ms

        if speed > self.peak_speed:
            self.peak_speed = speed

        result = None

        if self.state == KickState.IDLE:
            self._handle_idle(knee_angle, frame_idx, time_ms)
        elif self.state == KickState.CHAMBERING:
            self._handle_chambering(knee_angle, speed)
        elif self.state == KickState.EXTENDING:
            result = self._handle_extending(knee_angle, hip_angle, frame_idx, time_ms)
        elif self.state == KickState.RECOVERING:
            self._handle_recovering(knee_angle)

        return result

    def _handle_idle(self, knee_angle: float, frame_idx: int, time_ms: float):
        if knee_angle < 120:
            self.state = KickState.CHAMBERING
            self.min_chamber_angle = knee_angle
            self.max_extension_angle = 0.0
            self.peak_speed = 0.0
            self.kick_start_frame = frame_idx
            self.kick_start_time_ms = time_ms

    def _handle_chambering(self, knee_angle: float, speed: float):
        if knee_angle < self.min_chamber_angle:
            self.min_chamber_angle = knee_angle

        # Chân bắt đầu vung ra nhanh → pha bung chân
        if knee_angle > self.min_chamber_angle + 15 and speed > 0.4:
            self.state = KickState.EXTENDING
            return

        # Hủy nếu chân về thẳng (đá hụt)
        if knee_angle > 165:
            self.state = KickState.IDLE

    def _handle_extending(
        self,
        knee_angle: float,
        hip_angle: float,
        frame_idx: int,
        time_ms: float,
    ) -> Optional[KickResult]:
        if knee_angle > self.max_extension_angle:
            self.max_extension_angle = knee_angle

        # Góc bắt đầu giảm → chân đang thu về
        if knee_angle < self.max_extension_angle - 15:
            self.state = KickState.RECOVERING
            result = self._score_kick(
                hip_angle=hip_angle,
                start_frame=self.kick_start_frame,
                end_frame=frame_idx,
                start_time_ms=self.kick_start_time_ms,
                end_time_ms=time_ms,
            )
            self.results.append(result)
            return result

        return None

    def _handle_recovering(self, knee_angle: float):
        if knee_angle > 155 or knee_angle < 60:
            self.state = KickState.IDLE

    def _score_kick(
        self,
        hip_angle: float,
        start_frame: int,
        end_frame: int,
        start_time_ms: float,
        end_time_ms: float,
    ) -> KickResult:
        """Chấm điểm cú đá — port của _scoreKick() trong kickStateMachine.js."""
        score = 100
        details = []

        # Tiêu chí 1: Rút gối (chamber depth)
        if self.min_chamber_angle <= 55:
            details.append(f"✅ Rút gối xuất sắc ({self.min_chamber_angle:.0f}°)")
        elif self.min_chamber_angle <= 75:
            details.append(f"✅ Rút gối tốt ({self.min_chamber_angle:.0f}°)")
        else:
            score -= 25
            details.append(f"⚠️ Rút gối chưa sâu ({self.min_chamber_angle:.0f}°, cần < 75°)")

        # Tiêu chí 2: Bung chân (extension)
        if self.max_extension_angle >= 160:
            details.append(f"✅ Bung chân xuất sắc ({self.max_extension_angle:.0f}°)")
        elif self.max_extension_angle >= 140:
            score -= 10
            details.append(f"✅ Bung chân tốt ({self.max_extension_angle:.0f}°)")
        else:
            score -= 30
            details.append(
                f"⚠️ Chân chưa thẳng ({self.max_extension_angle:.0f}°, cần > 140°)"
            )

        # Tiêu chí 3: Tốc độ đỉnh
        if self.peak_speed >= 1.5:
            details.append(f"✅ Tốc độ mạnh ({self.peak_speed:.2f} u/s)")
        elif self.peak_speed >= 0.8:
            score -= 5
            details.append(f"🔵 Tốc độ trung bình ({self.peak_speed:.2f} u/s)")
        else:
            score -= 20
            details.append(f"⚠️ Đá còn chậm ({self.peak_speed:.2f} u/s)")

        score = max(0, min(100, score))

        if score >= 90:
            grade, emoji = "PERFECT", "🟢"
        elif score >= 75:
            grade, emoji = "GOOD", "🟡"
        elif score >= 55:
            grade, emoji = "FAIR", "🟠"
        else:
            grade, emoji = "NEEDS WORK", "🔴"

        return KickResult(
            score=score,
            grade=grade,
            emoji=emoji,
            details=details,
            min_chamber_angle=self.min_chamber_angle,
            max_extension_angle=self.max_extension_angle,
            peak_speed=self.peak_speed,
            start_frame=start_frame,
            end_frame=end_frame,
            start_time_ms=start_time_ms,
            end_time_ms=end_time_ms,
        )

