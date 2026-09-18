"""
punch_analyzer.py — MMA-TMS Punch Analysis & Technique Rubric Engine
Phân tích và chấm điểm các đòn đấm (Cross, Jab, Hook) từ chuỗi frame YOLO-Pose landmarks
Tuân thủ tiêu chuẩn MMA-TMS Master Specification v3.0 (Mục 05.5, 08, 09.5, 10, 13.2).

Máy trạng thái cú đấm:
  GUARD -> EXTENDING -> IMPACT -> RETRACTING -> GUARD
"""

import math
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

from pose_math import (
    KP, Point, calculate_angle, calculate_speed,
    calculate_arm_length, calculate_directional_reach_speed,
    are_landmarks_valid,
)
from posture_gate import PostureGate, PostureState
from technique_rubric import (
    CriterionResult,
    CriterionStatus,
    TechniqueFinding,
    calculate_technique_score,
)


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
class PunchResult:
    """Kết quả phân tích một cú đấm hoàn chỉnh theo chuẩn Master Spec v3.0."""
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
    criterion_results: list[CriterionResult] = field(default_factory=list)
    findings: list[TechniqueFinding] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            # Tương thích 100% với frontend hiện hành
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
            # Mở rộng v3.0
            "criterionResults": [c.to_dict() if hasattr(c, "to_dict") else c for c in self.criterion_results],
            "findings": [f.to_dict() if hasattr(f, "to_dict") else f for f in self.findings],
        }


@dataclass
class PunchDetectorConfig:
    """
    Cấu hình các tham số và ngưỡng cho thuật toán phát hiện cú đấm temporal/event-based.
    Các giá trị được căn chỉnh thực nghiệm (empirically tuned engineering thresholds)
    kết hợp với nguyên lý cơ sinh học (biomechanical principles).
    Đơn vị vận tốc là normalized-image-units/second (u/s), KHÔNG PHẢI m/s vật lý.
    """
    # Ngưỡng tin cậy landmark từ YOLOv8-Pose
    min_confidence: float = 0.25

    # Vận tốc duỗi tay tối thiểu dọc theo trục vai-cổ tay (u/s) để kích hoạt pha EXTENDING
    min_extension_speed: float = 0.50

    # Tỷ lệ dịch chuyển vươn tay tối thiểu so với chiều dài cánh tay (ext_disp / arm_length)
    # Ngăn chặn các cử động nhỏ (chỉ tay, nói chuyện, chỉnh găng) kích hoạt cú đấm
    min_extension_disp_ratio: float = 0.30

    # Độ dịch chuyển tuyệt đối tối thiểu (u) để tránh các rung lắc vi mô
    min_extension_disp: float = 0.07

    # Độ mở cùi chỏ tối thiểu để xác nhận điểm chạm (Impact) của đòn thẳng (Cross/Jab)
    min_elbow_angle_straight: float = 135.0

    # Khoảng góc cùi chỏ cho đòn Hook
    min_elbow_angle_hook: float = 80.0
    max_elbow_angle_hook: float = 125.0

    # Tỷ lệ thu tay tối thiểu so với độ vươn tối đa để xác nhận hoàn tất chu trình đòn đấm
    # (retracted_dist / total_extension >= min_retraction_ratio)
    min_retraction_ratio: float = 0.35

    # Giới hạn thời gian của một chu trình cú đấm hợp lệ (ms)
    min_punch_duration_ms: float = 100.0   # Loại bỏ nhiễu spike 1-2 frame
    max_punch_duration_ms: float = 1200.0  # Quá thời gian này huỷ đòn (không tính là cú đấm)

    # Thời gian tối đa dừng ở pha IMPACT (ms) trước khi bắt buộc chuyển sang RETRACTING
    max_impact_duration_ms: float = 300.0

    # Cooldown giữa 2 cú đấm liên tiếp của CÙNG MỘT TAY (ms)
    refractory_cooldown_ms: float = 200.0


@dataclass
class SingleArmTracker:
    """
    Bộ theo dõi trạng thái động học độc lập cho một cánh tay (Left hoặc Right).
    Mô hình hóa cú đấm như một chu trình chuyển động hoàn chỉnh (complete motion cycle):
      GUARD -> EXTENDING -> IMPACT -> RETRACTING -> GUARD
    """
    arm: str  # "left" hoặc "right"
    config: PunchDetectorConfig = field(default_factory=PunchDetectorConfig)

    state: PunchState = PunchState.GUARD

    # Thông số của cú đấm hiện tại
    start_frame: int = 0
    start_time_ms: float = 0.0
    start_reach: float = 0.0
    start_elbow_angle: float = 0.0

    impact_frame: int = 0
    impact_time_ms: float = 0.0
    impact_reach: float = 0.0

    max_elbow_angle: float = 0.0
    peak_speed: float = 0.0
    max_reach: float = 0.0

    guard_dropped: bool = False
    guard_drop_frame: int = 0
    guard_drop_time_ms: float = 0.0
    max_guard_drop_dist: float = 0.0

    # Cache lịch sử frame trước để tính vi phân có hướng
    prev_wrist: Optional[Point] = field(default=None, repr=False)
    prev_reach: Optional[float] = field(default=None, repr=False)
    last_time_ms: float = field(default=0.0, repr=False)
    last_punch_end_time: float = field(default=-9999.0, repr=False)

    def _reset_to_guard(self):
        self.state = PunchState.GUARD
        self.start_frame = 0
        self.start_time_ms = 0.0
        self.start_reach = 0.0
        self.start_elbow_angle = 0.0
        self.impact_frame = 0
        self.impact_time_ms = 0.0
        self.impact_reach = 0.0
        self.max_elbow_angle = 0.0
        self.peak_speed = 0.0
        self.max_reach = 0.0
        self.guard_dropped = False
        self.guard_drop_frame = 0
        self.guard_drop_time_ms = 0.0
        self.max_guard_drop_dist = 0.0

    def reset_temporal_derivatives(self):
        """
        Xoá sạch lịch sử vi phân thời gian để ngăn vọt vận tốc ảo
        khi nhảy toạ độ (teleport), mất track hoặc đổi đối tượng.
        """
        self.prev_wrist = None
        self.prev_reach = None
        if self.state != PunchState.GUARD:
            self._reset_to_guard()

    def update(
        self,
        sh: Point,
        el: Point,
        wr: Point,
        opp_sh: Point,
        opp_wr: Point,
        frame_idx: int,
        time_ms: float,
        is_discontinuous: bool = False,
        is_ground: bool = False,
    ) -> Optional[dict]:
        """
        Cập nhật máy trạng thái cho cánh tay này.
        Trả về dict thông số cú đấm nếu vừa hoàn thành một chu trình đấm hợp lệ.
        """
        if is_discontinuous:
            self.reset_temporal_derivatives()

        if is_ground:
            # Ở tư thế nằm sàn / mat posting: huỷ chu trình đấm dở dang và chặn vươn tay mới
            if self.state != PunchState.GUARD:
                self._reset_to_guard()
            self.prev_wrist = wr
            reach = math.dist((wr.x, wr.y), (sh.x, sh.y))
            self.prev_reach = reach
            self.last_time_ms = time_ms
            return None

        dt = time_ms - self.last_time_ms
        if dt <= 0.0:
            dt = 16.67

        # Kiểm tra confidence tối thiểu
        conf_ok = are_landmarks_valid([sh, el, wr], self.config.min_confidence)

        if not conf_ok:
            self.reset_temporal_derivatives()
            self.last_time_ms = time_ms
            # Nếu đang trong cú đấm mà mất landmark quá lâu (> 400ms), huỷ đòn
            if self.state != PunchState.GUARD and (time_ms - self.start_time_ms > 400.0):
                self._reset_to_guard()
            return None

        # Chiều dài cánh tay giải phẫu (upper arm + forearm) — bất biến theo góc xoay thân
        arm_length = calculate_arm_length(sh, el, wr)
        if arm_length < 0.10:
            arm_length = 0.25  # Ngưỡng dự phòng an toàn

        # Độ vươn (khoảng cách cổ tay tới vai)
        reach = math.dist((wr.x, wr.y), (sh.x, sh.y))

        # Góc cùi chỏ
        elbow_angle = calculate_angle(sh, el, wr, min_confidence=self.config.min_confidence)
        if elbow_angle is None:
            self.reset_temporal_derivatives()
            self.last_time_ms = time_ms
            return None

        # Vận tốc tuyệt đối (scalar speed)
        wrist_speed = calculate_speed(self.prev_wrist, wr, dt)

        # Vận tốc duỗi có hướng (directional reach speed)
        prev_r = self.prev_reach if self.prev_reach is not None else reach
        reach_speed = calculate_directional_reach_speed(prev_r, reach, dt)

        # Cập nhật cache frame
        self.prev_wrist = wr
        self.prev_reach = reach
        self.last_time_ms = time_ms

        # Kiểm tra tay đối diện (Dropped Guard Check)
        if opp_wr.conf >= self.config.min_confidence and opp_sh.conf >= self.config.min_confidence:
            drop_dist = opp_wr.y - opp_sh.y
            if drop_dist > 0.10:
                if not self.guard_dropped:
                    self.guard_drop_frame = frame_idx
                    self.guard_drop_time_ms = time_ms
                self.guard_dropped = True
                if drop_dist > self.max_guard_drop_dist:
                    self.max_guard_drop_dist = drop_dist

        # The configured maximum duration applies in EVERY phase, including
        # a late retraction. A stale cycle is not evidence of a new punch.
        if self.state != PunchState.GUARD and time_ms - self.start_time_ms > self.config.max_punch_duration_ms:
            self._reset_to_guard()
            return None

        # ─── STATE MACHINE ───
        if self.state == PunchState.GUARD:
            # Cooldown giữa 2 cú đấm của cùng 1 tay
            if time_ms - self.last_punch_end_time < self.config.refractory_cooldown_ms:
                return None

            # Cổ tay không được rơi quá sâu dưới vai
            valid_height = (wr.y < sh.y + 0.20)

            # Điều kiện bắt đầu EXTENDING:
            # 1. Chiều cao hợp lệ
            # 2. Vận tốc duỗi có hướng dương và vượt ngưỡng (reach_speed >= min_extension_speed)
            #    hoặc cùi chỏ mở ra rõ rệt với tốc độ cổ tay cao
            # 3. Cùi chỏ chưa ở trạng thái duỗi thẳng sẵn (< 150°)
            is_launching = (
                valid_height and
                elbow_angle < 150.0 and
                (
                    reach_speed >= self.config.min_extension_speed or
                    (wrist_speed >= self.config.min_extension_speed * 1.1 and reach_speed > 0.25 and elbow_angle >= 85.0)
                )
            )

            if is_launching:
                self.state = PunchState.EXTENDING
                self.start_frame = frame_idx
                self.start_time_ms = time_ms
                # Include the displacement that crossed the launch threshold.
                # Using the current reach discards most of a fast/low-fps punch.
                self.start_reach = prev_r
                self.start_elbow_angle = elbow_angle
                self.max_reach = reach
                self.max_elbow_angle = elbow_angle
                self.peak_speed = wrist_speed
                self.guard_dropped = False
                self.guard_drop_frame = 0
                self.guard_drop_time_ms = 0.0
                self.max_guard_drop_dist = 0.0

        elif self.state == PunchState.EXTENDING:
            if elbow_angle > self.max_elbow_angle:
                self.max_elbow_angle = elbow_angle
            if wrist_speed > self.peak_speed:
                self.peak_speed = wrist_speed
            if reach > self.max_reach:
                self.max_reach = reach

            ext_disp = self.max_reach - self.start_reach
            disp_ratio = ext_disp / arm_length
            duration_ms = time_ms - self.start_time_ms

            # Kiểm tra chuyển sang IMPACT:
            # Cần cả: độ dịch chuyển tối thiểu (ext_disp >= 0.07) VÀ tỷ lệ vươn tay (disp_ratio >= 0.30)
            has_meaningful_disp = (
                ext_disp >= self.config.min_extension_disp and
                disp_ratio >= self.config.min_extension_disp_ratio
            )

            straight_impact = (
                self.max_elbow_angle >= self.config.min_elbow_angle_straight and
                has_meaningful_disp
            )

            hook_impact = (
                self.config.min_elbow_angle_hook <= self.max_elbow_angle <= self.config.max_elbow_angle_hook and
                has_meaningful_disp and
                reach_speed <= 0.10 and
                wrist_speed < self.peak_speed * 0.6
            )

            if straight_impact or hook_impact:
                self.state = PunchState.IMPACT
                self.impact_frame = frame_idx
                self.impact_time_ms = time_ms
                self.impact_reach = self.max_reach

            # Huỷ nếu quá thời gian hoặc tay rút về khi chưa đạt độ dịch chuyển tối thiểu
            elif duration_ms > self.config.max_punch_duration_ms:
                self._reset_to_guard()
            elif reach_speed < -0.35 and disp_ratio < self.config.min_extension_disp_ratio * 0.5:
                self._reset_to_guard()

        elif self.state == PunchState.IMPACT:
            if elbow_angle > self.max_elbow_angle:
                self.max_elbow_angle = elbow_angle
                self.impact_frame = frame_idx
                self.impact_time_ms = time_ms
            if reach > self.impact_reach:
                self.impact_reach = reach

            impact_dwell = time_ms - self.impact_time_ms

            # Chuyển sang RETRACTING khi:
            # 1. Góc cùi chỏ bắt đầu gập lại (> 8 độ so với max)
            # 2. Hoặc độ vươn bắt đầu rút về rõ rệt
            # 3. Hoặc thời gian dừng ở đỉnh vượt quá max_impact_duration_ms
            is_reversing = (
                elbow_angle < self.max_elbow_angle - 8.0 or
                reach < self.impact_reach - 0.03 or
                reach_speed < -0.20 or
                impact_dwell > self.config.max_impact_duration_ms
            )

            if is_reversing:
                self.state = PunchState.RETRACTING

        elif self.state == PunchState.RETRACTING:
            total_ext = max(self.impact_reach - self.start_reach, 0.02)
            retracted_dist = self.impact_reach - reach
            retraction_ratio = retracted_dist / total_ext
            duration_ms = time_ms - self.start_time_ms

            # Hoàn thành cú đấm khi:
            # 1. Tay đã thu về đủ tỷ lệ (retraction_ratio >= min_retraction_ratio)
            # 2. Hoặc cùi chỏ gập về sát thế thủ ban đầu (elbow_angle <= 105° và reach về sát start_reach)
            # 3. VÀ tổng thời gian chu trình >= min_punch_duration_ms (tránh noise 1-2 frame)
            retracted_enough = (
                retraction_ratio >= self.config.min_retraction_ratio or
                (elbow_angle <= 105.0 and reach <= self.start_reach + 0.05)
            )

            if retracted_enough and duration_ms >= self.config.min_punch_duration_ms:
                # XÁC NHẬN CÚ ĐẤM HỢP LỆ!
                punch_data = {
                    "arm": self.arm,
                    "max_elbow_angle": self.max_elbow_angle,
                    "peak_speed": self.peak_speed,
                    "guard_dropped": self.guard_dropped,
                    "guard_drop_frame": self.guard_drop_frame,
                    "guard_drop_time_ms": self.guard_drop_time_ms,
                    "start_frame": self.start_frame,
                    "impact_frame": self.impact_frame or frame_idx,
                    "end_frame": frame_idx,
                    "start_time_ms": self.start_time_ms,
                    "impact_time_ms": self.impact_time_ms or time_ms,
                    "end_time_ms": time_ms,
                }
                self.last_punch_end_time = time_ms
                self._reset_to_guard()
                return punch_data

            # Hết hạn thời gian ở RETRACTING
            elif duration_ms > self.config.max_punch_duration_ms:
                # Nếu đã thu tay được một phần (> 25%), vẫn công nhận
                if retraction_ratio >= 0.25 and duration_ms >= self.config.min_punch_duration_ms:
                    punch_data = {
                        "arm": self.arm,
                        "max_elbow_angle": self.max_elbow_angle,
                        "peak_speed": self.peak_speed,
                        "guard_dropped": self.guard_dropped,
                        "guard_drop_frame": self.guard_drop_frame,
                        "guard_drop_time_ms": self.guard_drop_time_ms,
                        "start_frame": self.start_frame,
                        "impact_frame": self.impact_frame or frame_idx,
                        "end_frame": frame_idx,
                        "start_time_ms": self.start_time_ms,
                        "impact_time_ms": self.impact_time_ms or time_ms,
                        "end_time_ms": time_ms,
                    }
                    self.last_punch_end_time = time_ms
                    self._reset_to_guard()
                    return punch_data
                else:
                    self._reset_to_guard()

        return None


@dataclass
class PunchAnalyzer:
    """
    Máy trạng thái phân tích đòn đấm (PunchAnalyzer) tích hợp Technique Rubric Engine & Evidence Tracking.
    Theo dõi cả 2 tay độc lập (SingleArmTracker) và trích xuất đặc trưng sinh trắc học
    tuân thủ MMA-TMS Master Specification v3.0 (Mục 05.5, 08, 09.5, 10, 13.2).
    """
    config: PunchDetectorConfig = field(default_factory=PunchDetectorConfig)
    state: PunchState = PunchState.GUARD
    active_arm: str = "none"  # "left", "right", hoặc "none"

    left_tracker: SingleArmTracker = field(init=False)
    right_tracker: SingleArmTracker = field(init=False)

    posture_gate: PostureGate = field(default_factory=PostureGate)
    # Lịch sử các cú đấm đã ghi nhận
    results: list[PunchResult] = field(default_factory=list, repr=False)

    def __post_init__(self):
        self.left_tracker = SingleArmTracker(arm="left", config=self.config)
        self.right_tracker = SingleArmTracker(arm="right", config=self.config)

    @property
    def max_elbow_angle(self) -> float:
        if self.active_arm == "right":
            return self.right_tracker.max_elbow_angle
        elif self.active_arm == "left":
            return self.left_tracker.max_elbow_angle
        return 0.0

    @property
    def peak_speed(self) -> float:
        if self.active_arm == "right":
            return self.right_tracker.peak_speed
        elif self.active_arm == "left":
            return self.left_tracker.peak_speed
        return 0.0

    def reset_temporal_derivatives(self):
        """Xoá sạch lịch sử vi phân thời gian của cả 2 tay."""
        self.right_tracker.reset_temporal_derivatives()
        self.left_tracker.reset_temporal_derivatives()
        self.state = PunchState.GUARD
        self.active_arm = "none"

    def update(
        self,
        keypoints: list[Point],
        frame_idx: int,
        time_ms: float,
        is_discontinuous: bool = False,
    ) -> Optional[PunchResult]:
        """
        Cập nhật máy trạng thái với dữ liệu keypoints của frame hiện tại.
        Trả về PunchResult nếu vừa hoàn thành một cú đấm.
        """
        if is_discontinuous:
            self.reset_temporal_derivatives()

        if len(keypoints) < 17:
            return None

        # Đánh giá ngữ cảnh tư thế (Standing / Crouched / Ground)
        posture_state, just_stood_up = self.posture_gate.update(keypoints)
        if just_stood_up:
            self.reset_temporal_derivatives()

        is_ground = (posture_state == PostureState.GROUND)

        l_sh = keypoints[KP.LEFT_SHOULDER]
        r_sh = keypoints[KP.RIGHT_SHOULDER]
        l_el = keypoints[KP.LEFT_ELBOW]
        r_el = keypoints[KP.RIGHT_ELBOW]
        l_wr = keypoints[KP.LEFT_WRIST]
        r_wr = keypoints[KP.RIGHT_WRIST]

        # Cập nhật tracker từng tay độc lập
        r_punch_data = self.right_tracker.update(
            sh=r_sh, el=r_el, wr=r_wr,
            opp_sh=l_sh, opp_wr=l_wr,
            frame_idx=frame_idx, time_ms=time_ms,
            is_discontinuous=is_discontinuous,
            is_ground=is_ground,
        )

        l_punch_data = self.left_tracker.update(
            sh=l_sh, el=l_el, wr=l_wr,
            opp_sh=r_sh, opp_wr=r_wr,
            frame_idx=frame_idx, time_ms=time_ms,
            is_discontinuous=is_discontinuous,
            is_ground=is_ground,
        )

        # Nếu đang ở tư thế nằm sàn / mat posting: cưỡng bức GUARD và không trả về cú đấm
        if is_ground:
            self.state = PunchState.GUARD
            self.active_arm = "none"
            return None

        # Đồng bộ trạng thái tổng thể cho frame (tương thích 100% với frontend)
        if self.right_tracker.state != PunchState.GUARD:
            self.state = self.right_tracker.state
            self.active_arm = "right"
        elif self.left_tracker.state != PunchState.GUARD:
            self.state = self.left_tracker.state
            self.active_arm = "left"
        else:
            self.state = PunchState.GUARD
            self.active_arm = "none"

        completed_data = r_punch_data or l_punch_data
        if completed_data:
            result = self._score_punch(**completed_data)
            self.results.append(result)
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
        guard_drop_frame: int = 0,
        guard_drop_time_ms: float = 0.0,
    ) -> PunchResult:
        """
        Đánh giá và chấm điểm đòn đấm theo Expert-defined Technique Rubric v3.0 (Mục 09.5).
        Áp dụng công thức chuẩn:
          Technique Score = Σ (criterion_score × weight) / Σ weight
        Sinh các Findings với đầy đủ Evidence Frame Range và Metadata truy xuất nguồn gốc.
        """
        action_id = f"punch_{len(self.results) + 1}"
        opp_arm = "left" if arm == "right" else "right"

        # ── 1. Phân loại kỹ thuật (Cross vs Jab vs Hook) ──
        if max_elbow_angle < 125.0:
            punch_type = "Hook"
        else:
            punch_type = "Cross" if arm == "right" else "Jab"

        criterion_results: list[CriterionResult] = []

        # ── 2. Tiêu chí 1: Độ vươn cùi chỏ / Góc móc (Extension / Hook Geometry) — Weight 0.40 ──
        ext_finding: Optional[TechniqueFinding] = None
        if punch_type in ("Cross", "Jab"):
            if max_elbow_angle >= 155.0:
                ext_score = 100.0
                ext_status = CriterionStatus.EXCELLENT
                ext_detail = f"✅ Duỗi tay hoàn hảo ({max_elbow_angle:.0f}°)"
                ext_finding = TechniqueFinding(
                    id=f"{action_id}_ext_perf",
                    action_id=action_id,
                    category="technique",
                    phase="impact",
                    title="Full Arm Extension (Duỗi tay tối đa)",
                    description=f"Cùi chỏ đạt độ mở {max_elbow_angle:.0f}°, tối ưu hóa sải tay và truyền toàn bộ lực phát động từ hông vào mục tiêu.",
                    severity="positive",
                    confidence=0.95,
                    frame_idx=impact_frame,
                    time_ms=impact_time_ms,
                    evidence_frame_start=start_frame,
                    evidence_frame_end=impact_frame,
                    evidence_timestamp_start_ms=start_time_ms,
                    evidence_timestamp_end_ms=impact_time_ms,
                    affected_body_part=f"{arm}_elbow",
                    metric_name="maxElbowAngle",
                    metric_value=max_elbow_angle,
                    metric_unit="degrees",
                    recommendation="Rất tốt! Tiếp tục duy trì khóa mềm khớp cùi chỏ ở điểm chạm để bảo vệ bao khớp.",
                )
            elif max_elbow_angle >= 140.0:
                ext_score = 80.0
                ext_status = CriterionStatus.GOOD
                ext_detail = f"✅ Duỗi tay tốt ({max_elbow_angle:.0f}°)"
                ext_finding = TechniqueFinding(
                    id=f"{action_id}_ext_good",
                    action_id=action_id,
                    category="technique",
                    phase="impact",
                    title="Good Arm Extension (Duỗi tay khá)",
                    description=f"Cùi chỏ mở {max_elbow_angle:.0f}°, đòn đánh có tầm với tốt nhưng chưa đạt cực đại.",
                    severity="info",
                    confidence=0.88,
                    frame_idx=impact_frame,
                    time_ms=impact_time_ms,
                    evidence_frame_start=start_frame,
                    evidence_frame_end=impact_frame,
                    evidence_timestamp_start_ms=start_time_ms,
                    evidence_timestamp_end_ms=impact_time_ms,
                    affected_body_part=f"{arm}_elbow",
                    metric_name="maxElbowAngle",
                    metric_value=max_elbow_angle,
                    metric_unit="degrees",
                    recommendation="Đẩy thêm vai về phía trước một chút để vươn hết tầm sải tay.",
                )
            else:
                ext_score = max(20.0, 70.0 - (140.0 - max_elbow_angle) * 1.5)
                ext_status = CriterionStatus.NEEDS_WORK
                ext_detail = f"⚠️ Tay chưa duỗi hết ({max_elbow_angle:.0f}°, cần > 140°)"
                ext_finding = TechniqueFinding(
                    id=f"{action_id}_ext_warn",
                    action_id=action_id,
                    category="technique",
                    phase="impact",
                    title="Incomplete Extension (Đấm với / Co tay)",
                    description=f"Cùi chỏ chỉ mở {max_elbow_angle:.0f}°, làm giảm 30-40% uy lực phát lực và khiến đòn đánh bị ngắn tầm.",
                    severity="warning",
                    confidence=0.92,
                    frame_idx=impact_frame,
                    time_ms=impact_time_ms,
                    evidence_frame_start=start_frame,
                    evidence_frame_end=impact_frame,
                    evidence_timestamp_start_ms=start_time_ms,
                    evidence_timestamp_end_ms=impact_time_ms,
                    affected_body_part=f"{arm}_elbow",
                    metric_name="maxElbowAngle",
                    metric_value=max_elbow_angle,
                    metric_unit="degrees",
                    recommendation="Xoay hông và đẩy vai phát lực theo đường thẳng, tránh co gập cánh tay khi chạm đích.",
                )
        else:
            # Hook
            if 85.0 <= max_elbow_angle <= 115.0:
                ext_score = 100.0
                ext_status = CriterionStatus.EXCELLENT
                ext_detail = f"✅ Khóa góc móc chuẩn ({max_elbow_angle:.0f}°)"
                ext_finding = TechniqueFinding(
                    id=f"{action_id}_hook_perf",
                    action_id=action_id,
                    category="technique",
                    phase="impact",
                    title="Optimal Hook Geometry (Góc móc chuẩn)",
                    description=f"Cùi chỏ giữ góc 90° chuẩn ({max_elbow_angle:.0f}°), tối ưu hóa đòn bẩy truyền lực xoay thân.",
                    severity="positive",
                    confidence=0.91,
                    frame_idx=impact_frame,
                    time_ms=impact_time_ms,
                    evidence_frame_start=start_frame,
                    evidence_frame_end=impact_frame,
                    evidence_timestamp_start_ms=start_time_ms,
                    evidence_timestamp_end_ms=impact_time_ms,
                    affected_body_part=f"{arm}_elbow",
                    metric_name="maxElbowAngle",
                    metric_value=max_elbow_angle,
                    metric_unit="degrees",
                    recommendation="Giữ cổ tay thẳng hàng với cẳng tay để tránh chấn thương khớp cổ tay.",
                )
            elif 75.0 <= max_elbow_angle < 85.0 or 115.0 < max_elbow_angle <= 130.0:
                ext_score = 75.0
                ext_status = CriterionStatus.GOOD
                ext_detail = f"✅ Góc móc khá ({max_elbow_angle:.0f}°)"
                ext_finding = TechniqueFinding(
                    id=f"{action_id}_hook_good",
                    action_id=action_id,
                    category="technique",
                    phase="impact",
                    title="Acceptable Hook Geometry (Góc móc khá)",
                    description=f"Cùi chỏ mở góc {max_elbow_angle:.0f}°, tạm đạt hiệu quả đòn bẩy.",
                    severity="info",
                    confidence=0.86,
                    frame_idx=impact_frame,
                    time_ms=impact_time_ms,
                    evidence_frame_start=start_frame,
                    evidence_frame_end=impact_frame,
                    evidence_timestamp_start_ms=start_time_ms,
                    evidence_timestamp_end_ms=impact_time_ms,
                    affected_body_part=f"{arm}_elbow",
                    metric_name="maxElbowAngle",
                    metric_value=max_elbow_angle,
                    metric_unit="degrees",
                    recommendation="Cố gắng giữ cẳng tay vuông góc với bắp tay (~90°) khi vung đòn móc.",
                )
            else:
                ext_score = 45.0
                ext_status = CriterionStatus.NEEDS_WORK
                ext_detail = f"⚠️ Góc móc chưa chuẩn ({max_elbow_angle:.0f}°, lý tưởng ~90°)"
                ext_finding = TechniqueFinding(
                    id=f"{action_id}_hook_warn",
                    action_id=action_id,
                    category="technique",
                    phase="impact",
                    title="Suboptimal Hook Angle (Góc móc quá hẹp hoặc quá rộng)",
                    description=f"Cùi chỏ mở góc {max_elbow_angle:.0f}°, làm phân tán lực xoay thân và dễ gây chấn thương cùi chỏ.",
                    severity="warning",
                    confidence=0.88,
                    frame_idx=impact_frame,
                    time_ms=impact_time_ms,
                    evidence_frame_start=start_frame,
                    evidence_frame_end=impact_frame,
                    evidence_timestamp_start_ms=start_time_ms,
                    evidence_timestamp_end_ms=impact_time_ms,
                    affected_body_part=f"{arm}_elbow",
                    metric_name="maxElbowAngle",
                    metric_value=max_elbow_angle,
                    metric_unit="degrees",
                    recommendation="Khóa chặt khớp cùi chỏ góc 90° trước khi xoay trục thân tung cú móc.",
                )

        criterion_results.append(CriterionResult(
            criterion_id="crit_punch_extension",
            criterion_name="Arm Extension / Hook Angle",
            phase="impact",
            feature_name="max_elbow_angle",
            observed_value=max_elbow_angle,
            score=ext_score,
            weight=0.40,
            confidence=ext_finding.confidence,
            status=ext_status,
            evidence_frame_start=start_frame,
            evidence_frame_end=impact_frame,
            evidence_timestamp_start_ms=start_time_ms,
            evidence_timestamp_end_ms=impact_time_ms,
            affected_body_part=f"{arm}_elbow",
            detail=ext_detail,
            finding=ext_finding,
        ))

        # ── 3. Tiêu chí 2: Thế thủ tay đối diện (Opposite Guard Protection) — Weight 0.35 ──
        guard_finding: Optional[TechniqueFinding] = None
        if not guard_dropped:
            guard_score = 100.0
            guard_status = CriterionStatus.EXCELLENT
            guard_detail = "✅ Tay đối diện giữ thủ che cằm tốt"
            guard_finding = TechniqueFinding(
                id=f"{action_id}_guard_ok",
                action_id=action_id,
                category="guard",
                phase="guard",
                title="Solid Defensive Guard (Thế thủ kín kẽ)",
                description="Tay phòng thủ vẫn giữ sát gò má/cằm trong suốt quá trình phát lực đấm, bảo vệ toàn diện vùng thái dương.",
                severity="positive",
                confidence=0.91,
                frame_idx=impact_frame,
                time_ms=impact_time_ms,
                evidence_frame_start=start_frame,
                evidence_frame_end=impact_frame,
                evidence_timestamp_start_ms=start_time_ms,
                evidence_timestamp_end_ms=impact_time_ms,
                affected_body_part=f"{opp_arm}_hand",
                metric_name="guardPreserved",
                metric_value=1.0,
                metric_unit="flag",
                recommendation="Tuyệt vời! Duy trì thói quen dán chặt găng vào cằm khi ra bất kỳ đòn tay nào.",
            )
        else:
            guard_score = 30.0
            guard_status = CriterionStatus.NEEDS_WORK
            guard_detail = "⚠️ Tay đối diện bị rớt thủ (Hở cằm!)"
            guard_finding = TechniqueFinding(
                id=f"{action_id}_guard_drop",
                action_id=action_id,
                category="guard",
                phase="guard",
                title="Dropped Opposite Guard (Hở cằm nguy hiểm)",
                description="Khi tung đòn đấm, tay đối diện bị hạ thấp qua xương đòn, mở toang góc đầu trước cú phản đòn (counter hook).",
                severity="critical",
                confidence=0.93,
                frame_idx=guard_drop_frame or impact_frame,
                time_ms=guard_drop_time_ms or impact_time_ms,
                evidence_frame_start=guard_drop_frame or start_frame,
                evidence_frame_end=impact_frame,
                evidence_timestamp_start_ms=guard_drop_time_ms or start_time_ms,
                evidence_timestamp_end_ms=impact_time_ms,
                affected_body_part=f"{opp_arm}_hand",
                metric_name="guardPreserved",
                metric_value=0.0,
                metric_unit="flag",
                recommendation="Dán chặt găng tay phòng thủ vào gò má. Tuyệt đối không thả lỏng tay đối diện khi ra đòn!",
            )

        criterion_results.append(CriterionResult(
            criterion_id="crit_punch_guard",
            criterion_name="Opposite Guard Protection",
            phase="guard",
            feature_name="guard_preserved",
            observed_value=1.0 if not guard_dropped else 0.0,
            score=guard_score,
            weight=0.35,
            confidence=guard_finding.confidence,
            status=guard_status,
            evidence_frame_start=guard_drop_frame or start_frame,
            evidence_frame_end=impact_frame,
            evidence_timestamp_start_ms=guard_drop_time_ms or start_time_ms,
            evidence_timestamp_end_ms=impact_time_ms,
            affected_body_part=f"{opp_arm}_hand",
            detail=guard_detail,
            finding=guard_finding,
        ))

        # ── 4. Tiêu chí 3: Tốc độ đòn (Peak Velocity) — Weight 0.25 ──
        speed_finding: Optional[TechniqueFinding] = None
        if peak_speed >= 1.2:
            speed_score = 100.0
            speed_status = CriterionStatus.EXCELLENT
            speed_detail = f"✅ Tốc độ ra đòn rất nhanh ({peak_speed:.2f} u/s)"
            speed_finding = TechniqueFinding(
                id=f"{action_id}_speed_high",
                action_id=action_id,
                category="speed",
                phase="impact",
                title="High Velocity Impact (Tốc độ đòn xuất sắc)",
                description=f"Tốc độ cổ tay đạt {peak_speed:.2f} u/s, tạo ra xung lượng va chạm lớn và khiến đối thủ rất khó tránh né.",
                severity="positive",
                confidence=0.89,
                frame_idx=impact_frame,
                time_ms=impact_time_ms,
                evidence_frame_start=start_frame,
                evidence_frame_end=impact_frame,
                evidence_timestamp_start_ms=start_time_ms,
                evidence_timestamp_end_ms=impact_time_ms,
                affected_body_part=f"{arm}_wrist",
                metric_name="peakSpeed",
                metric_value=peak_speed,
                metric_unit="u/s",
                recommendation="Tốc độ rất tốt! Giữ vững nhịp búng tay và thu về nhanh tương ứng.",
            )
        elif peak_speed >= 0.5:
            speed_score = 80.0
            speed_status = CriterionStatus.GOOD
            speed_detail = f"🔵 Tốc độ đòn trung bình ({peak_speed:.2f} u/s)"
            speed_finding = TechniqueFinding(
                id=f"{action_id}_speed_mid",
                action_id=action_id,
                category="speed",
                phase="impact",
                title="Moderate Punch Velocity (Tốc độ trung bình)",
                description=f"Tốc độ cổ tay đạt {peak_speed:.2f} u/s, duy trì ổn định.",
                severity="info",
                confidence=0.86,
                frame_idx=impact_frame,
                time_ms=impact_time_ms,
                evidence_frame_start=start_frame,
                evidence_frame_end=impact_frame,
                evidence_timestamp_start_ms=start_time_ms,
                evidence_timestamp_end_ms=impact_time_ms,
                affected_body_part=f"{arm}_wrist",
                metric_name="peakSpeed",
                metric_value=peak_speed,
                metric_unit="u/s",
                recommendation="Tập trung thư giãn vai trước cú đấm để tăng tốc độ bộc phát.",
            )
        else:
            speed_score = max(20.0, 70.0 - (0.5 - peak_speed) * 80.0)
            speed_status = CriterionStatus.NEEDS_WORK
            speed_detail = f"⚠️ Ra đòn còn chậm ({peak_speed:.2f} u/s)"
            speed_finding = TechniqueFinding(
                id=f"{action_id}_speed_low",
                action_id=action_id,
                category="speed",
                phase="impact",
                title="Low Punch Velocity (Tốc độ phát đòn chậm)",
                description=f"Tốc độ cổ tay chỉ đạt {peak_speed:.2f} u/s, dễ bị đối thủ bắt bài hoặc phản xạ né tránh.",
                severity="warning",
                confidence=0.85,
                frame_idx=impact_frame,
                time_ms=impact_time_ms,
                evidence_frame_start=start_frame,
                evidence_frame_end=impact_frame,
                evidence_timestamp_start_ms=start_time_ms,
                evidence_timestamp_end_ms=impact_time_ms,
                affected_body_part=f"{arm}_wrist",
                metric_name="peakSpeed",
                metric_value=peak_speed,
                metric_unit="u/s",
                recommendation="Thả lỏng toàn bộ cơ vai trước khi phát lực; chỉ siết chặt nắm đấm vào miligiây cuối cùng.",
            )

        criterion_results.append(CriterionResult(
            criterion_id="crit_punch_speed",
            criterion_name="Striking Velocity",
            phase="impact",
            feature_name="peak_speed",
            observed_value=peak_speed,
            score=speed_score,
            weight=0.25,
            confidence=speed_finding.confidence,
            status=speed_status,
            evidence_frame_start=start_frame,
            evidence_frame_end=impact_frame,
            evidence_timestamp_start_ms=start_time_ms,
            evidence_timestamp_end_ms=impact_time_ms,
            affected_body_part=f"{arm}_wrist",
            detail=speed_detail,
            finding=speed_finding,
        ))

        # ── Tổng hợp điểm số theo Rubric Weighted Sum ──
        score, grade, emoji = calculate_technique_score(criterion_results)
        details = [r.detail for r in criterion_results if r.status != CriterionStatus.INSUFFICIENT_EVIDENCE]
        findings = [r.finding for r in criterion_results if r.finding is not None]

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
            criterion_results=criterion_results,
            findings=findings,
        )
