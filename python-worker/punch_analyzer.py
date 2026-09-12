"""
punch_analyzer.py — MMA-TMS Phase 2: Punch Analysis & Technique Findings Engine
Phân tích và chấm điểm các đòn đấm (Cross, Jab, Hook) từ chuỗi frame YOLO-Pose landmarks
Tuân thủ tiêu chuẩn MMA-TMS Master Specification (Mục 08 - Insight Architecture).

Máy trạng thái cú đấm:
  GUARD → EXTENDING → IMPACT → RETRACTING → GUARD
"""

import math
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

from pose_math import KP, Point, calculate_angle, calculate_speed


class PunchState(str, Enum):
    GUARD      = "guard"       # Thế thủ (hai tay trước ngực/cằm)
    EXTENDING  = "extending"   # Vươn tay ra đòn
    IMPACT     = "impact"      # Điểm chạm / duỗi tối đa
    RETRACTING = "retracting"  # Thu tay về vị trí thủ


PUNCH_STATE_LABELS = {
    PunchState.GUARD:      "Thế thủ",
    PunchState.EXTENDING:  "Ra đòn đấm",
    PunchState.IMPACT:     "Điểm chạm (Impact)",
    PunchState.RETRACTING: "Thu tay về",
}


@dataclass
class TechniqueFinding:
    """
    Thực thể Finding & Insight theo Mục 08 MMA-TMS Master Specification:
    Metric -> Finding -> Insight -> Recommendation
    """
    id: str
    category: str          # "technique" | "guard" | "speed" | "posture"
    title: str             # Tên phát hiện
    description: str       # Giải thích hiện tượng sinh cơ học
    severity: str          # "positive" | "info" | "warning" | "critical"
    confidence: float      # Độ tin cậy của AI (0.0 - 1.0)
    frame_idx: int         # Frame xảy ra hiện tượng
    time_ms: float         # Thời điểm ms
    metric_name: str       # Tên chỉ số đo lường
    metric_value: float    # Giá trị đo lường
    recommendation: str    # Lời khuyên hành động (AI Coach recommendation)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "category": self.category,
            "title": self.title,
            "description": self.description,
            "severity": self.severity,
            "confidence": round(self.confidence, 2),
            "frameIdx": self.frame_idx,
            "timeMs": round(self.time_ms, 1),
            "metricName": self.metric_name,
            "metricValue": round(self.metric_value, 1),
            "recommendation": self.recommendation,
        }


@dataclass
class PunchResult:
    """Kết quả phân tích một cú đấm hoàn chỉnh."""
    punch_type: str        # "Cross", "Jab", "Hook"
    arm: str               # "left", "right"
    score: int             # Điểm kỹ thuật (0 - 100)
    grade: str             # "PERFECT", "GOOD", "FAIR", "NEEDS WORK"
    emoji: str             # Biểu tượng đánh giá
    details: list[str]     # Các tiêu chí đánh giá tóm tắt
    max_elbow_angle: float # Góc cùi chỏ duỗi tối đa (độ)
    peak_speed: float      # Tốc độ cổ tay cao nhất (u/s)
    guard_preserved: bool  # Tay đối diện có che cằm hay bị rơi (dropped guard)
    start_frame: int = 0
    impact_frame: int = 0
    end_frame: int = 0
    start_time_ms: float = 0.0
    impact_time_ms: float = 0.0
    end_time_ms: float = 0.0
    findings: list[TechniqueFinding] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "punchType": self.punch_type,
            "arm": self.arm,
            "score": self.score,
            "grade": self.grade,
            "emoji": self.emoji,
            "details": self.details,
            "maxElbowAngle": round(self.max_elbow_angle, 1),
            "peakSpeed": round(self.peak_speed, 3),
            "guardPreserved": self.guard_preserved,
            "startFrame": self.start_frame,
            "impactFrame": self.impact_frame,
            "endFrame": self.end_frame,
            "startTimeMs": round(self.start_time_ms, 1),
            "impactTimeMs": round(self.impact_time_ms, 1),
            "endTimeMs": round(self.end_time_ms, 1),
            "findings": [f.to_dict() for f in self.findings],
        }


@dataclass
class PunchAnalyzer:
    """
    Máy trạng thái phân tích đòn đấm (PunchAnalyzer) theo MMA-TMS Master Specification.
    Theo dõi cả 2 tay độc lập và trích xuất đặc trưng sinh trắc học.
    """
    state: PunchState = PunchState.GUARD
    active_arm: str = "none"  # "left", "right", hoặc "none"

    # Trạng thái trong cú đấm hiện tại
    max_elbow_angle: float = 0.0
    peak_speed: float = 0.0
    punch_start_frame: int = 0
    punch_start_time_ms: float = 0.0
    punch_impact_frame: int = 0
    punch_impact_time_ms: float = 0.0
    guard_dropped: bool = False
    max_guard_drop_dist: float = 0.0

    # Cache toạ độ frame trước để tính tốc độ
    _last_left_wrist: Optional[Point] = field(default=None, repr=False)
    _last_right_wrist: Optional[Point] = field(default=None, repr=False)
    _last_time_ms: float = field(default=0.0, repr=False)

    # Lịch sử các cú đấm đã ghi nhận
    results: list[PunchResult] = field(default_factory=list, repr=False)

    def update(
        self,
        keypoints: list[Point],
        frame_idx: int,
        time_ms: float,
    ) -> Optional[PunchResult]:
        """
        Cập nhật máy trạng thái với dữ liệu keypoints của frame hiện tại.
        Trả về PunchResult nếu vừa hoàn thành một cú đấm.
        """
        if len(keypoints) < 17:
            return None

        l_sh = keypoints[KP.LEFT_SHOULDER]
        r_sh = keypoints[KP.RIGHT_SHOULDER]
        l_el = keypoints[KP.LEFT_ELBOW]
        r_el = keypoints[KP.RIGHT_ELBOW]
        l_wr = keypoints[KP.LEFT_WRIST]
        r_wr = keypoints[KP.RIGHT_WRIST]

        # Kiểm tra confidence tối thiểu
        min_conf = 0.25
        dt = time_ms - self._last_time_ms

        l_speed = 0.0
        r_speed = 0.0
        if l_wr.conf > min_conf:
            l_speed = calculate_speed(self._last_left_wrist, l_wr, dt)
            self._last_left_wrist = l_wr
        if r_wr.conf > min_conf:
            r_speed = calculate_speed(self._last_right_wrist, r_wr, dt)
            self._last_right_wrist = r_wr
        self._last_time_ms = time_ms

        # Tính góc cùi chỏ
        l_elbow_angle = calculate_angle(l_sh, l_el, l_wr) if min(l_sh.conf, l_el.conf, l_wr.conf) > min_conf else 75.0
        r_elbow_angle = calculate_angle(r_sh, r_el, r_wr) if min(r_sh.conf, r_el.conf, r_wr.conf) > min_conf else 75.0

        # Khoảng cách từ cổ tay đến vai
        l_reach = math.dist((l_wr.x, l_wr.y), (l_sh.x, l_sh.y))
        r_reach = math.dist((r_wr.x, r_wr.y), (r_sh.x, r_sh.y))

        result = None

        if self.state == PunchState.GUARD:
            self._handle_guard(
                l_elbow_angle, r_elbow_angle,
                l_speed, r_speed,
                l_reach, r_reach,
                l_wr, r_wr,
                l_sh, r_sh,
                frame_idx, time_ms
            )

        elif self.state == PunchState.EXTENDING:
            self._handle_extending(
                l_elbow_angle, r_elbow_angle,
                l_speed, r_speed,
                l_wr, r_wr, l_sh, r_sh,
                frame_idx, time_ms
            )

        elif self.state == PunchState.IMPACT:
            self._handle_impact(
                l_elbow_angle, r_elbow_angle,
                l_speed, r_speed,
                frame_idx, time_ms
            )

        elif self.state == PunchState.RETRACTING:
            result = self._handle_retracting(
                l_elbow_angle, r_elbow_angle,
                l_wr, r_wr, l_sh, r_sh,
                frame_idx, time_ms
            )

        return result

    _last_punch_time: float = field(default=-9999.0, repr=False)

    def _handle_guard(
        self,
        l_angle: float, r_angle: float,
        l_speed: float, r_speed: float,
        l_reach: float, r_reach: float,
        l_wr: Point, r_wr: Point,
        l_sh: Point, r_sh: Point,
        frame_idx: int, time_ms: float
    ):
        """Ở trạng thái GUARD, phát hiện thời điểm tay bắt đầu phóng ra."""
        # Cooldown tối thiểu 300ms giữa 2 đòn đấm liên tiếp để tránh đếm trùng frame
        if time_ms - self._last_punch_time < 300.0:
            return

        r_valid_height = (r_wr.y < r_sh.y + 0.15) if (r_wr.conf > 0.25 and r_sh.conf > 0.25) else True
        l_valid_height = (l_wr.y < l_sh.y + 0.15) if (l_wr.conf > 0.25 and l_sh.conf > 0.25) else True

        # Tay ra đòn: cùi chỏ mở từ vị trí thủ và phóng ra với tốc độ rõ rệt
        if r_valid_height and (85.0 <= r_angle <= 135.0 or r_speed > 0.35) and r_speed >= l_speed and r_reach > 0.14:
            self.state = PunchState.EXTENDING
            self.active_arm = "right"
            self.max_elbow_angle = r_angle
            self.peak_speed = r_speed
            self.punch_start_frame = frame_idx
            self.punch_start_time_ms = time_ms
            self.guard_dropped = False
            self.max_guard_drop_dist = 0.0

        elif l_valid_height and (85.0 <= l_angle <= 135.0 or l_speed > 0.35) and l_speed >= r_speed and l_reach > 0.14:
            self.state = PunchState.EXTENDING
            self.active_arm = "left"
            self.max_elbow_angle = l_angle
            self.peak_speed = l_speed
            self.punch_start_frame = frame_idx
            self.punch_start_time_ms = time_ms
            self.guard_dropped = False
            self.max_guard_drop_dist = 0.0

    def _handle_extending(
        self,
        l_angle: float, r_angle: float,
        l_speed: float, r_speed: float,
        l_wr: Point, r_wr: Point,
        l_sh: Point, r_sh: Point,
        frame_idx: int, time_ms: float
    ):
        """Tay đang vươn ra đòn đấm."""
        active_angle = r_angle if self.active_arm == "right" else l_angle
        active_speed = r_speed if self.active_arm == "right" else l_speed

        if active_angle > self.max_elbow_angle:
            self.max_elbow_angle = active_angle

        if active_speed > self.peak_speed:
            self.peak_speed = active_speed

        # Kiểm tra tay đối diện (Opposite Guard Check)
        opp_wr = l_wr if self.active_arm == "right" else r_wr
        opp_sh = l_sh if self.active_arm == "right" else r_sh

        # Nếu cổ tay đối diện tụt sâu dưới xương đòn vai (> 0.10 chiều cao chuẩn hóa)
        if opp_wr.conf > 0.3 and opp_sh.conf > 0.3:
            drop_dist = opp_wr.y - opp_sh.y
            if drop_dist > 0.10:
                self.guard_dropped = True
                if drop_dist > self.max_guard_drop_dist:
                    self.max_guard_drop_dist = drop_dist

        # Chuyển sang IMPACT khi cùi chỏ mở cực đại (> 140°) hoặc đạt đỉnh
        if active_angle >= 140.0:
            self.state = PunchState.IMPACT
            self.punch_impact_frame = frame_idx
            self.punch_impact_time_ms = time_ms

        elif active_angle > 110.0 and active_speed < self.peak_speed * 0.5:
            # Đối với đòn Hook hoặc đòn đấm dừng lại ở đỉnh
            self.state = PunchState.IMPACT
            self.punch_impact_frame = frame_idx
            self.punch_impact_time_ms = time_ms

        # Hủy nếu đòn đấm kéo dài quá 1.5s mà không chạm đích hoặc góc bị co lại quá sớm
        elif (time_ms - self.punch_start_time_ms > 1500) or (active_angle < 65.0):
            self.state = PunchState.GUARD
            self.active_arm = "none"

    def _handle_impact(
        self,
        l_angle: float, r_angle: float,
        l_speed: float, r_speed: float,
        frame_idx: int, time_ms: float
    ):
        """Ở pha IMPACT (duỗi tối đa/chạm mục tiêu), ghi nhận góc cực đại rồi chuyển sang thu tay."""
        active_angle = r_angle if self.active_arm == "right" else l_angle
        if active_angle > self.max_elbow_angle:
            self.max_elbow_angle = active_angle
            self.punch_impact_frame = frame_idx
            self.punch_impact_time_ms = time_ms

        # Ngay sau khi đạt đỉnh (hoặc góc bắt đầu giảm > 8 độ), chuyển sang RETRACTING
        if active_angle < self.max_elbow_angle - 8.0 or (time_ms - self.punch_impact_time_ms > 120):
            self.state = PunchState.RETRACTING

    def _handle_retracting(
        self,
        l_angle: float, r_angle: float,
        l_wr: Point, r_wr: Point,
        l_sh: Point, r_sh: Point,
        frame_idx: int, time_ms: float
    ) -> Optional[PunchResult]:
        """Thu tay về thế thủ ban đầu."""
        active_angle = r_angle if self.active_arm == "right" else l_angle
        active_wr = r_wr if self.active_arm == "right" else l_wr
        active_sh = r_sh if self.active_arm == "right" else l_sh

        reach = math.dist((active_wr.x, active_wr.y), (active_sh.x, active_sh.y))

        # Đòn kết thúc khi cùi chỏ gập lại về < 100° hoặc tay về sát vai hoặc quá thời gian
        if active_angle < 100.0 or reach < 0.25 or (time_ms - self.punch_start_time_ms > 1800):
            result = self._score_punch(
                arm=self.active_arm,
                max_elbow_angle=self.max_elbow_angle,
                peak_speed=self.peak_speed,
                guard_dropped=self.guard_dropped,
                start_frame=self.punch_start_frame,
                impact_frame=self.punch_impact_frame or frame_idx,
                end_frame=frame_idx,
                start_time_ms=self.punch_start_time_ms,
                impact_time_ms=self.punch_impact_time_ms or time_ms,
                end_time_ms=time_ms,
            )
            self.results.append(result)
            self.state = PunchState.GUARD
            self.active_arm = "none"
            self._last_punch_time = time_ms
            return result

        return None

    def _score_punch(
        self,
        arm: str,
        max_elbow_angle: float,
        peak_speed: float,
        guard_dropped: bool,
        start_frame: int,
        impact_frame: int,
        end_frame: int,
        start_time_ms: float,
        impact_time_ms: float,
        end_time_ms: float,
    ) -> PunchResult:
        """
        Đánh giá và chấm điểm đòn đấm sinh cơ học theo MMA-TMS Specification (Mục 08).
        Phân loại đòn: Cross, Jab, hoặc Hook.
        Sinh Findings & Recommendations cho Fighter & Coach.
        """
        score = 100
        details = []
        findings: list[TechniqueFinding] = []
        punch_id = f"punch_{len(self.results) + 1}"

        # ── 1. Phân loại kỹ thuật (Cross vs Jab vs Hook) ──
        if max_elbow_angle < 125.0:
            punch_type = "Hook"
        else:
            punch_type = "Cross" if arm == "right" else "Jab"

        # ── 2. Tiêu chí 1: Độ vươn cùi chỏ (Extension) ──
        if punch_type in ("Cross", "Jab"):
            if max_elbow_angle >= 155.0:
                details.append(f"✅ Duỗi tay hoàn hảo ({max_elbow_angle:.0f}°)")
                findings.append(TechniqueFinding(
                    id=f"{punch_id}_ext_perf",
                    category="technique",
                    title="Full Arm Extension (Duỗi tay tối đa)",
                    description=f"Cùi chỏ đạt độ mở {max_elbow_angle:.0f}°, tối ưu hóa sải tay và truyền toàn bộ lực phát động từ hông vào mục tiêu.",
                    severity="positive",
                    confidence=0.95,
                    frame_idx=impact_frame,
                    time_ms=impact_time_ms,
                    metric_name="maxElbowAngle",
                    metric_value=max_elbow_angle,
                    recommendation="Rất tốt! Tiếp tục duy trì khóa mềm khớp cùi chỏ ở điểm chạm để bảo vệ bao khớp.",
                ))
            elif max_elbow_angle >= 140.0:
                score -= 10
                details.append(f"✅ Duỗi tay tốt ({max_elbow_angle:.0f}°)")
                findings.append(TechniqueFinding(
                    id=f"{punch_id}_ext_good",
                    category="technique",
                    title="Good Arm Extension (Duỗi tay khá)",
                    description=f"Cùi chỏ mở {max_elbow_angle:.0f}°, đòn đánh có tầm với tốt nhưng chưa đạt cực đại.",
                    severity="info",
                    confidence=0.88,
                    frame_idx=impact_frame,
                    time_ms=impact_time_ms,
                    metric_name="maxElbowAngle",
                    metric_value=max_elbow_angle,
                    recommendation="Đẩy thêm vai về phía trước một chút để vươn hết tầm sải tay.",
                ))
            else:
                score -= 30
                details.append(f"⚠️ Tay chưa duỗi hết ({max_elbow_angle:.0f}°, cần > 140°)")
                findings.append(TechniqueFinding(
                    id=f"{punch_id}_ext_warn",
                    category="technique",
                    title="Incomplete Extension (Đấm với / Co tay)",
                    description=f"Cùi chỏ chỉ mở {max_elbow_angle:.0f}°, làm giảm 30-40% uy lực phát lực và khiến đòn đánh bị ngắn tầm.",
                    severity="warning",
                    confidence=0.92,
                    frame_idx=impact_frame,
                    time_ms=impact_time_ms,
                    metric_name="maxElbowAngle",
                    metric_value=max_elbow_angle,
                    recommendation="Xoay hông và đẩy vai phát lực theo đường thẳng, tránh co gập cánh tay khi chạm đích.",
                ))
        else:
            # Hook
            if 85.0 <= max_elbow_angle <= 115.0:
                details.append(f"✅ Khóa góc móc chuẩn ({max_elbow_angle:.0f}°)")
                findings.append(TechniqueFinding(
                    id=f"{punch_id}_hook_perf",
                    category="technique",
                    title="Optimal Hook Geometry (Góc móc chuẩn)",
                    description=f"Cùi chỏ giữ góc 90° chuẩn ({max_elbow_angle:.0f}°), tối ưu hóa đòn bẩy truyền lực xoay thân.",
                    severity="positive",
                    confidence=0.91,
                    frame_idx=impact_frame,
                    time_ms=impact_time_ms,
                    metric_name="maxElbowAngle",
                    metric_value=max_elbow_angle,
                    recommendation="Giữ cổ tay thẳng hàng với cẳng tay để tránh chấn thương khớp cổ tay.",
                ))
            else:
                score -= 15
                details.append(f"⚠️ Góc móc chưa chuẩn ({max_elbow_angle:.0f}°, lý tưởng ~90°)")

        # ── 3. Tiêu chí 2: Thế thủ tay đối diện (Opposite Guard Protection) ──
        if not guard_dropped:
            details.append("✅ Tay đối diện giữ thủ che cằm tốt")
            findings.append(TechniqueFinding(
                id=f"{punch_id}_guard_ok",
                category="guard",
                title="Solid Defensive Guard (Thế thủ kín kẽ)",
                description="Tay phòng thủ vẫn giữ sát gò má/cằm trong suốt quá trình phát lực đấm, bảo vệ toàn diện vùng thái dương.",
                severity="positive",
                confidence=0.91,
                frame_idx=impact_frame,
                time_ms=impact_time_ms,
                metric_name="guardPreserved",
                metric_value=1.0,
                recommendation="Tuyệt vời! Duy trì thói quen dán chặt găng vào cằm khi ra bất kỳ đòn tay nào.",
            ))
        else:
            score -= 25
            details.append("⚠️ Tay đối diện bị rớt thủ (Hở cằm!)")
            findings.append(TechniqueFinding(
                id=f"{punch_id}_guard_drop",
                category="guard",
                title="Dropped Opposite Guard (Hở cằm nguy hiểm)",
                description="Khi tung đòn đấm, tay đối diện bị hạ thấp qua xương đòn, mở toang góc đầu trước cú phản đòn (counter hook).",
                severity="critical",
                confidence=0.93,
                frame_idx=impact_frame,
                time_ms=impact_time_ms,
                metric_name="guardPreserved",
                metric_value=0.0,
                recommendation="Dán chặt găng tay phòng thủ vào gò má. Tuyệt đối không thả lỏng tay đối diện khi ra đòn!",
            ))

        # ── 4. Tiêu chí 3: Tốc độ đòn (Peak Velocity) ──
        if peak_speed >= 1.2:
            details.append(f"✅ Tốc độ ra đòn rất nhanh ({peak_speed:.2f} u/s)")
            findings.append(TechniqueFinding(
                id=f"{punch_id}_speed_high",
                category="speed",
                title="High Velocity Impact (Tốc độ đòn xuất sắc)",
                description=f"Tốc độ cổ tay đạt {peak_speed:.2f} u/s, tạo ra xung lượng va chạm lớn và khiến đối thủ rất khó tránh né.",
                severity="positive",
                confidence=0.89,
                frame_idx=impact_frame,
                time_ms=impact_time_ms,
                metric_name="peakSpeed",
                metric_value=peak_speed,
                recommendation="Tốc độ rất tốt! Giữ vững nhịp búng tay và thu về nhanh tương ứng.",
            ))
        elif peak_speed >= 0.5:
            score -= 5
            details.append(f"🔵 Tốc độ đòn trung bình ({peak_speed:.2f} u/s)")
        else:
            score -= 20
            details.append(f"⚠️ Ra đòn còn chậm ({peak_speed:.2f} u/s)")
            findings.append(TechniqueFinding(
                id=f"{punch_id}_speed_low",
                category="speed",
                title="Low Punch Velocity (Tốc độ phát đòn chậm)",
                description=f"Tốc độ cổ tay chỉ đạt {peak_speed:.2f} u/s, dễ bị đối thủ bắt bài hoặc phản xạ né tránh.",
                severity="warning",
                confidence=0.85,
                frame_idx=impact_frame,
                time_ms=impact_time_ms,
                metric_name="peakSpeed",
                metric_value=peak_speed,
                recommendation="Thả lỏng toàn bộ cơ vai trước khi phát lực; chỉ siết chặt nắm đấm vào miligiây cuối cùng.",
            ))

        score = max(0, min(100, score))

        if score >= 90:
            grade, emoji = "PERFECT", "🟢"
        elif score >= 75:
            grade, emoji = "GOOD", "🟡"
        elif score >= 55:
            grade, emoji = "FAIR", "🟠"
        else:
            grade, emoji = "NEEDS WORK", "🔴"

        return PunchResult(
            punch_type=punch_type,
            arm=arm,
            score=score,
            grade=grade,
            emoji=emoji,
            details=details,
            max_elbow_angle=max_elbow_angle,
            peak_speed=peak_speed,
            guard_preserved=not guard_dropped,
            start_frame=start_frame,
            impact_frame=impact_frame,
            end_frame=end_frame,
            start_time_ms=start_time_ms,
            impact_time_ms=impact_time_ms,
            end_time_ms=end_time_ms,
            findings=findings,
        )
