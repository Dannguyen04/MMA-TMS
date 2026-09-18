"""
kick_analyzer.py — MMA-TMS Round Kick Analysis & Technique Rubric Engine
Phân tích, phát hiện pha và chấm điểm kỹ thuật cú đá vòng cầu (Round Kick)
Tuân thủ MMA-TMS Master Specification v3.0 (Mục 05.5, 08, 09.5, 10, 13.2).

Máy trạng thái (Phase State Machine):
  IDLE -> CHAMBERING -> EXTENDING -> RECOVERING -> IDLE
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

from pose_math import Point, calculate_speed
from technique_rubric import (
    CriterionResult,
    CriterionStatus,
    TechniqueFinding,
    calculate_technique_score,
)


class KickState(str, Enum):
    IDLE       = "idle"         # Đứng thủ
    CHAMBERING = "chambering"    # Rút gối
    EXTENDING  = "extending"     # Bung chân / duỗi gối
    RECOVERING = "recovering"    # Thu chân về thế thủ


KICK_STATE_LABELS = {
    KickState.IDLE:       "Đứng thủ",
    KickState.CHAMBERING: "Rút gối",
    KickState.EXTENDING:  "Bung chân",
    KickState.RECOVERING: "Thu chân",
}


@dataclass
class KickResult:
    """
    Kết quả chấm điểm và phân tích một cú đá hoàn chỉnh theo chuẩn Master Spec v3.0.
    """
    score: int
    grade: str
    emoji: str
    details: list[str]
    min_chamber_angle: float
    max_extension_angle: float
    peak_speed: float
    # Frame range & timestamp của cú đá
    start_frame: int = 0
    end_frame: int = 0
    start_time_ms: float = 0.0
    end_time_ms: float = 0.0
    # Mở rộng chuẩn Spec v3.0:
    impact_frame: int = 0
    impact_time_ms: float = 0.0
    chamber_peak_frame: int = 0
    chamber_peak_time_ms: float = 0.0
    active_leg: str = "right"
    criterion_results: list[CriterionResult] = field(default_factory=list)
    findings: list[TechniqueFinding] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            # Tương thích 100% với frontend hiện hành
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
            # Mở rộng v3.0
            "impactFrame": self.impact_frame,
            "impactTimeMs": round(self.impact_time_ms, 1),
            "chamberPeakFrame": self.chamber_peak_frame,
            "chamberPeakTimeMs": round(self.chamber_peak_time_ms, 1),
            "activeLeg": self.active_leg,
            "criterionResults": [c.to_dict() if hasattr(c, "to_dict") else c for c in self.criterion_results],
            "findings": [f.to_dict() if hasattr(f, "to_dict") else f for f in self.findings],
        }


@dataclass
class KickFrameFeatures:
    """
    Đặc trưng frame phục vụ kiểm tra tính hợp lệ và phân tích đòn đá (Phase 2A).
    """
    frame_idx: int
    time_ms: float
    active_leg: str = "none"  # "left", "right", hoặc "none"
    knee_angle: Optional[float] = None
    hip_angle: Optional[float] = None
    ankle: Optional[Point] = None
    speed: float = 0.0
    landmarks_valid: bool = False
    geometry_valid: bool = False
    rejection_reason: Optional[str] = None


@dataclass
class KickAnalyzer:
    """
    Máy trạng thái phân tích cú đá tích hợp Technique Rubric Engine & Evidence Tracking.
    Xử lý tuần tự từng frame video.
    Phase 2A: Tích hợp Kick Input & Geometry Validity Gate.
    """
    state: KickState = KickState.IDLE
    min_chamber_angle: float = 180.0
    max_extension_angle: float = 0.0
    peak_speed: float = 0.0
    kick_start_frame: int = 0
    kick_start_time_ms: float = 0.0
    chamber_peak_frame: int = 0
    chamber_peak_time_ms: float = 0.0
    impact_frame: int = 0
    impact_time_ms: float = 0.0
    active_leg: str = "right"

    # EXPERIMENTAL / REQUIRES POSITIVE-KICK BENCHMARK CALIBRATION:
    # Dung sai số frame invalid liên tiếp trước khi hủy bỏ chu trình đá dở dang
    max_consecutive_invalid_frames: int = 2
    # Same minimum evidence duration as punch cycles; rejects single-frame
    # pose jitter independently of the video's frame rate.
    min_cycle_duration_ms: float = 100.0
    _invalid_streak: int = field(default=0, repr=False)
    last_transition_reason: str = field(default="NONE", repr=False)
    last_rejection_reason: str = field(default="NONE", repr=False)

    _last_ankle: Optional[Point] = field(default=None, repr=False)
    _last_time_ms: float = field(default=0.0, repr=False)

    # Lịch sử tất cả các cú đá đã hoàn thành trong video
    results: list[KickResult] = field(default_factory=list, repr=False)

    def _reset_to_idle(self):
        """Hủy bỏ chu trình đá dở dang về IDLE mà không chấm điểm."""
        self.state = KickState.IDLE
        self._invalid_streak = 0
        self.min_chamber_angle = 180.0
        self.max_extension_angle = 0.0
        self.peak_speed = 0.0
        self._last_ankle = None

    def reset_motion(self):
        """Discard an incomplete cycle on track loss/cut; retain finished events."""
        self._reset_to_idle()
        self.last_transition_reason = "ABORTED_DISCONTINUITY"

    def update(
        self,
        knee_angle: Optional[float] = None,
        hip_angle: Optional[float] = None,
        ankle: Optional[Point] = None,
        frame_idx: int = 0,
        time_ms: float = 0.0,
        active_leg: str = "right",
        landmarks_valid: Optional[bool] = None,
        geometry_valid: Optional[bool] = None,
        rejection_reason: Optional[str] = None,
        features: Optional[KickFrameFeatures] = None,
    ) -> Optional[KickResult]:
        """
        Cập nhật máy trạng thái với dữ liệu frame hiện tại.
        Áp dụng Validity Gate (Phase 2A):
        - active_leg == "none" OR required landmarks invalid OR required geometry invalid
          => KHÔNG THỂ bắt đầu cú đá mới (remain IDLE).
        - Nếu đang trong cú đá dở dang mà dữ liệu invalid vượt quá max_consecutive_invalid_frames:
          => HỦY chu trình đá về IDLE mà KHÔNG chấm điểm (không sinh KickResult).
        """
        if features is not None:
            frame_idx = features.frame_idx
            time_ms = features.time_ms
            active_leg = features.active_leg
            knee_angle = features.knee_angle
            hip_angle = features.hip_angle
            ankle = features.ankle
            landmarks_valid = features.landmarks_valid
            geometry_valid = features.geometry_valid
            rejection_reason = features.rejection_reason

        # Tương thích ngược: nếu không truyền cờ validity nhưng có knee_angle và active_leg != 'none'
        if landmarks_valid is None:
            landmarks_valid = (knee_angle is not None)
        if geometry_valid is None:
            geometry_valid = (knee_angle is not None)

        # ── PHASE 2A VALIDITY GATE ──
        is_valid_input = (
            active_leg in ("left", "right") and
            landmarks_valid and
            geometry_valid and
            knee_angle is not None
        )

        if not is_valid_input:
            self._last_ankle = None
            self._last_time_ms = time_ms
            if self.state == KickState.IDLE:
                self._invalid_streak = 0
                self.last_transition_reason = "NONE"
                self.last_rejection_reason = rejection_reason or (
                    "ACTIVE_LEG_NONE" if active_leg == "none" else "INVALID_INPUT"
                )
                return None
            else:
                # Đang trong cú đá dở dang: xử lý dung sai frame invalid
                self._invalid_streak += 1
                if self._invalid_streak > self.max_consecutive_invalid_frames:
                    # Vượt quá dung sai -> hủy bỏ cú đá dở dang, KHÔNG chấm điểm
                    self._reset_to_idle()
                    self.last_transition_reason = "ABORTED_INVALID_INPUT"
                    self.last_rejection_reason = rejection_reason or "EXCEEDED_INVALID_TOLERANCE"
                    return None
                else:
                    # Giữ nguyên trạng thái, không bịa góc (do not fabricate geometry)
                    self.last_transition_reason = "HOLDING_INVALID_INPUT"
                    self.last_rejection_reason = rejection_reason or "TEMPORARILY_INVALID_INPUT"
                    return None

        # Never differentiate different legs or bridge an invalid observation.
        if active_leg != self.active_leg:
            self.reset_motion()
        self.active_leg = active_leg
        speed = calculate_speed(self._last_ankle, ankle, time_ms - self._last_time_ms) if ankle else 0.0
        self._last_ankle = ankle
        self._last_time_ms = time_ms
        self.peak_speed = max(self.peak_speed, speed)

        # Input hợp lệ: reset streak invalid
        self._invalid_streak = 0
        self.last_rejection_reason = "NONE"
        result = None

        if self.state == KickState.IDLE:
            self._handle_idle(knee_angle, frame_idx, time_ms)
        elif self.state == KickState.CHAMBERING:
            self._handle_chambering(knee_angle, speed, frame_idx, time_ms)
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
            self.chamber_peak_frame = frame_idx
            self.chamber_peak_time_ms = time_ms
            self.impact_frame = frame_idx
            self.impact_time_ms = time_ms
            self.last_transition_reason = "CHAMBERING_TRIGGERED"
        else:
            self.last_transition_reason = "NONE"

    def _handle_chambering(self, knee_angle: float, speed: float, frame_idx: int, time_ms: float):
        if knee_angle < self.min_chamber_angle:
            self.min_chamber_angle = knee_angle
            self.chamber_peak_frame = frame_idx
            self.chamber_peak_time_ms = time_ms

        # Chân bắt đầu vung ra nhanh -> pha bung chân
        if knee_angle > self.min_chamber_angle + 15 and speed > 0.4:
            self.state = KickState.EXTENDING
            self.max_extension_angle = knee_angle
            self.impact_frame = frame_idx
            self.impact_time_ms = time_ms
            self.last_transition_reason = "EXTENDING_TRIGGERED"
            return

        # Hủy nếu chân về thẳng (đá hụt)
        if knee_angle > 165:
            self.state = KickState.IDLE
            self.last_transition_reason = "RESET_IDLE"
        else:
            self.last_transition_reason = "NONE"

    def _handle_extending(
        self,
        knee_angle: float,
        hip_angle: Optional[float],
        frame_idx: int,
        time_ms: float,
    ) -> Optional[KickResult]:
        if knee_angle > self.max_extension_angle:
            self.max_extension_angle = knee_angle
            self.impact_frame = frame_idx
            self.impact_time_ms = time_ms

        # Góc bắt đầu giảm -> chân đang thu về
        if knee_angle < self.max_extension_angle - 15:
            self.state = KickState.RECOVERING
            if time_ms - self.kick_start_time_ms < self.min_cycle_duration_ms:
                self._reset_to_idle()
                self.last_transition_reason = "REJECTED_SHORT_CYCLE"
                return None
            self.last_transition_reason = "RECOVERING_TRIGGERED"
            result = self._score_kick(
                hip_angle=hip_angle,
                start_frame=self.kick_start_frame,
                end_frame=frame_idx,
                start_time_ms=self.kick_start_time_ms,
                end_time_ms=time_ms,
            )
            self.results.append(result)
            return result

        self.last_transition_reason = "NONE"
        return None

    def _handle_recovering(self, knee_angle: float):
        if knee_angle > 155 or knee_angle < 60:
            self.state = KickState.IDLE
            self.last_transition_reason = "RESET_IDLE"
        else:
            self.last_transition_reason = "NONE"

    def _score_kick(
        self,
        hip_angle: Optional[float],
        start_frame: int,
        end_frame: int,
        start_time_ms: float,
        end_time_ms: float,
    ) -> KickResult:
        """
        Chấm điểm cú đá theo Expert-defined Technique Rubric v3.0:
        Áp dụng công thức trọng số chuẩn:
          Technique Score = Σ (criterion_score × weight) / Σ weight
        Đồng thời xây dựng chuỗi bằng chứng (Evidence Chain) cho từng Finding.
        """
        action_id = f"kick_{len(self.results) + 1}"
        leg = self.active_leg
        chamber_peak_frame = self.chamber_peak_frame or start_frame
        chamber_peak_time_ms = self.chamber_peak_time_ms or start_time_ms
        impact_frame = self.impact_frame or end_frame
        impact_time_ms = self.impact_time_ms or end_time_ms

        criterion_results: list[CriterionResult] = []

        # ── Tiêu chí 1: Rút gối (Knee Chamber Depth) — Weight 0.35 ──
        chamber_finding: Optional[TechniqueFinding] = None
        if self.min_chamber_angle <= 0.0 or self.min_chamber_angle >= 180.0:
            # Evidence Gating: Không có dữ liệu góc gối hợp lệ -> bỏ qua tiêu chí khỏi mẫu số
            criterion_results.append(CriterionResult(
                criterion_id="crit_kick_chamber",
                criterion_name="Knee Chamber Depth",
                phase="chamber",
                feature_name="min_chamber_angle",
                observed_value=0.0,
                score=0.0,
                weight=0.35,
                confidence=0.0,
                status=CriterionStatus.INSUFFICIENT_EVIDENCE,
                evidence_frame_start=start_frame,
                evidence_frame_end=chamber_peak_frame,
                evidence_timestamp_start_ms=start_time_ms,
                evidence_timestamp_end_ms=chamber_peak_time_ms,
                affected_body_part=f"{leg}_knee",
                detail="⚪ Không đủ dữ liệu góc gối rút",
                finding=None,
            ))
        elif self.min_chamber_angle <= 55.0:
            chamber_score = 100.0
            chamber_status = CriterionStatus.EXCELLENT
            chamber_detail = f"✅ Rút gối xuất sắc ({self.min_chamber_angle:.0f}°)"
            chamber_finding = TechniqueFinding(
                id=f"{action_id}_chamber_perf",
                action_id=action_id,
                category="technique",
                phase="chamber",
                title="Optimal Knee Chamber (Rút gối xuất sắc)",
                description=f"Gối co gập sâu đạt {self.min_chamber_angle:.0f}°, tích lũy thế năng và tạo đòn bẩy bung cẳng chân tối ưu.",
                severity="positive",
                confidence=0.94,
                frame_idx=chamber_peak_frame,
                time_ms=chamber_peak_time_ms,
                evidence_frame_start=start_frame,
                evidence_frame_end=chamber_peak_frame,
                evidence_timestamp_start_ms=start_time_ms,
                evidence_timestamp_end_ms=chamber_peak_time_ms,
                affected_body_part=f"{leg}_knee",
                metric_name="minChamberAngle",
                metric_value=self.min_chamber_angle,
                metric_unit="degrees",
                recommendation="Tuyệt vời! Tiếp tục duy trì độ rút gối nhanh và gọn gàng này.",
            )
            criterion_results.append(CriterionResult(
                criterion_id="crit_kick_chamber",
                criterion_name="Knee Chamber Depth",
                phase="chamber",
                feature_name="min_chamber_angle",
                observed_value=self.min_chamber_angle,
                score=chamber_score,
                weight=0.35,
                confidence=chamber_finding.confidence,
                status=chamber_status,
                evidence_frame_start=start_frame,
                evidence_frame_end=chamber_peak_frame,
                evidence_timestamp_start_ms=start_time_ms,
                evidence_timestamp_end_ms=chamber_peak_time_ms,
                affected_body_part=f"{leg}_knee",
                detail=chamber_detail,
                finding=chamber_finding,
            ))
        elif self.min_chamber_angle <= 75.0:
            chamber_score = 85.0
            chamber_status = CriterionStatus.GOOD
            chamber_detail = f"✅ Rút gối tốt ({self.min_chamber_angle:.0f}°)"
            chamber_finding = TechniqueFinding(
                id=f"{action_id}_chamber_good",
                action_id=action_id,
                category="technique",
                phase="chamber",
                title="Good Knee Chamber (Rút gối tốt)",
                description=f"Gối rút ở mức {self.min_chamber_angle:.0f}°, đảm bảo được quỹ đạo ra đòn cơ bản.",
                severity="info",
                confidence=0.90,
                frame_idx=chamber_peak_frame,
                time_ms=chamber_peak_time_ms,
                evidence_frame_start=start_frame,
                evidence_frame_end=chamber_peak_frame,
                evidence_timestamp_start_ms=start_time_ms,
                evidence_timestamp_end_ms=chamber_peak_time_ms,
                affected_body_part=f"{leg}_knee",
                metric_name="minChamberAngle",
                metric_value=self.min_chamber_angle,
                metric_unit="degrees",
                recommendation="Có thể nâng cao gối và ép cẳng chân sát đùi hơn một chút (<55°) để tăng thêm lực đòn bẩy.",
            )
            criterion_results.append(CriterionResult(
                criterion_id="crit_kick_chamber",
                criterion_name="Knee Chamber Depth",
                phase="chamber",
                feature_name="min_chamber_angle",
                observed_value=self.min_chamber_angle,
                score=chamber_score,
                weight=0.35,
                confidence=chamber_finding.confidence,
                status=chamber_status,
                evidence_frame_start=start_frame,
                evidence_frame_end=chamber_peak_frame,
                evidence_timestamp_start_ms=start_time_ms,
                evidence_timestamp_end_ms=chamber_peak_time_ms,
                affected_body_part=f"{leg}_knee",
                detail=chamber_detail,
                finding=chamber_finding,
            ))
        else:
            chamber_score = max(20.0, 75.0 - (self.min_chamber_angle - 75.0) * 1.5)
            chamber_status = CriterionStatus.NEEDS_WORK
            chamber_detail = f"⚠️ Rút gối chưa sâu ({self.min_chamber_angle:.0f}°, cần < 75°)"
            chamber_finding = TechniqueFinding(
                id=f"{action_id}_chamber_warn",
                action_id=action_id,
                category="technique",
                phase="chamber",
                title="Shallow Knee Chamber (Rút gối nông)",
                description=f"Gối chỉ gập {self.min_chamber_angle:.0f}°, đòn đá bị 'quét chân' thay vì búng gập, làm giảm uy lực và dễ bị cản phá.",
                severity="warning",
                confidence=0.92,
                frame_idx=chamber_peak_frame,
                time_ms=chamber_peak_time_ms,
                evidence_frame_start=start_frame,
                evidence_frame_end=chamber_peak_frame,
                evidence_timestamp_start_ms=start_time_ms,
                evidence_timestamp_end_ms=chamber_peak_time_ms,
                affected_body_part=f"{leg}_knee",
                metric_name="minChamberAngle",
                metric_value=self.min_chamber_angle,
                metric_unit="degrees",
                recommendation="Nâng đầu gối hướng về mục tiêu trước khi vung cẳng chân ra ngoài.",
            )
            criterion_results.append(CriterionResult(
                criterion_id="crit_kick_chamber",
                criterion_name="Knee Chamber Depth",
                phase="chamber",
                feature_name="min_chamber_angle",
                observed_value=self.min_chamber_angle,
                score=chamber_score,
                weight=0.35,
                confidence=chamber_finding.confidence,
                status=chamber_status,
                evidence_frame_start=start_frame,
                evidence_frame_end=chamber_peak_frame,
                evidence_timestamp_start_ms=start_time_ms,
                evidence_timestamp_end_ms=chamber_peak_time_ms,
                affected_body_part=f"{leg}_knee",
                detail=chamber_detail,
                finding=chamber_finding,
            ))

        # ── Tiêu chí 2: Bung chân (Extension at Impact) — Weight 0.35 ──
        extension_finding: Optional[TechniqueFinding] = None
        if self.max_extension_angle >= 160.0:
            extension_score = 100.0
            extension_status = CriterionStatus.EXCELLENT
            extension_detail = f"✅ Bung chân xuất sắc ({self.max_extension_angle:.0f}°)"
            extension_finding = TechniqueFinding(
                id=f"{action_id}_ext_perf",
                action_id=action_id,
                category="technique",
                phase="impact",
                title="Full Leg Extension (Bung chân tối đa)",
                description=f"Gối duỗi mở góc {self.max_extension_angle:.0f}° tại điểm chạm, tối ưu hóa toàn bộ tầm với và truyền lực va chạm trọn vẹn.",
                severity="positive",
                confidence=0.95,
                frame_idx=impact_frame,
                time_ms=impact_time_ms,
                evidence_frame_start=chamber_peak_frame,
                evidence_frame_end=impact_frame,
                evidence_timestamp_start_ms=chamber_peak_time_ms,
                evidence_timestamp_end_ms=impact_time_ms,
                affected_body_part=f"{leg}_knee",
                metric_name="maxExtensionAngle",
                metric_value=self.max_extension_angle,
                metric_unit="degrees",
                recommendation="Kỹ thuật bung chân rất tốt! Lưu ý giữ khớp khóa mềm để bảo toàn khớp gối.",
            )
        elif self.max_extension_angle >= 140.0:
            extension_score = 80.0
            extension_status = CriterionStatus.GOOD
            extension_detail = f"✅ Bung chân tốt ({self.max_extension_angle:.0f}°)"
            extension_finding = TechniqueFinding(
                id=f"{action_id}_ext_good",
                action_id=action_id,
                category="technique",
                phase="impact",
                title="Good Leg Extension (Bung chân khá)",
                description=f"Gối mở góc {self.max_extension_angle:.0f}°, đòn đánh đạt tầm với tốt nhưng chưa duỗi hết biên độ.",
                severity="info",
                confidence=0.90,
                frame_idx=impact_frame,
                time_ms=impact_time_ms,
                evidence_frame_start=chamber_peak_frame,
                evidence_frame_end=impact_frame,
                evidence_timestamp_start_ms=chamber_peak_time_ms,
                evidence_timestamp_end_ms=impact_time_ms,
                affected_body_part=f"{leg}_knee",
                metric_name="maxExtensionAngle",
                metric_value=self.max_extension_angle,
                metric_unit="degrees",
                recommendation="Đẩy thêm hông trụ về trước để duỗi chân chạm bia dài hơn.",
            )
        else:
            extension_score = max(20.0, 70.0 - (140.0 - self.max_extension_angle) * 1.5)
            extension_status = CriterionStatus.NEEDS_WORK
            extension_detail = f"⚠️ Chân chưa thẳng ({self.max_extension_angle:.0f}°, cần > 140°)"
            extension_finding = TechniqueFinding(
                id=f"{action_id}_ext_warn",
                action_id=action_id,
                category="technique",
                phase="impact",
                title="Incomplete Extension (Chân co / Chưa duỗi hết)",
                description=f"Gối chỉ mở {self.max_extension_angle:.0f}°, đòn đá bị với hoặc chân bị co gập ở điểm chạm làm mất 30-40% lực xuyên thấu.",
                severity="warning",
                confidence=0.93,
                frame_idx=impact_frame,
                time_ms=impact_time_ms,
                evidence_frame_start=chamber_peak_frame,
                evidence_frame_end=impact_frame,
                evidence_timestamp_start_ms=chamber_peak_time_ms,
                evidence_timestamp_end_ms=impact_time_ms,
                affected_body_part=f"{leg}_knee",
                metric_name="maxExtensionAngle",
                metric_value=self.max_extension_angle,
                metric_unit="degrees",
                recommendation="Tập trung giải phóng khớp gối và vung cẳng chân ra hết tầm ngay khi chạm đích.",
            )

        criterion_results.append(CriterionResult(
            criterion_id="crit_kick_extension",
            criterion_name="Full Leg Extension at Impact",
            phase="impact",
            feature_name="max_extension_angle",
            observed_value=self.max_extension_angle,
            score=extension_score,
            weight=0.35,
            confidence=extension_finding.confidence,
            status=extension_status,
            evidence_frame_start=chamber_peak_frame,
            evidence_frame_end=impact_frame,
            evidence_timestamp_start_ms=chamber_peak_time_ms,
            evidence_timestamp_end_ms=impact_time_ms,
            affected_body_part=f"{leg}_knee",
            detail=extension_detail,
            finding=extension_finding,
        ))

        # ── Tiêu chí 3: Tốc độ đòn đá (Striking Velocity) — Weight 0.15 ──
        speed_finding: Optional[TechniqueFinding] = None
        if self.peak_speed >= 1.5:
            speed_score = 100.0
            speed_status = CriterionStatus.EXCELLENT
            speed_detail = f"✅ Tốc độ mạnh ({self.peak_speed:.2f} u/s)"
            speed_finding = TechniqueFinding(
                id=f"{action_id}_speed_high",
                action_id=action_id,
                category="speed",
                phase="impact",
                title="High Striking Velocity (Tốc độ đòn đá mạnh)",
                description=f"Vận tốc cổ chân đạt {self.peak_speed:.2f} u/s, tạo xung lượng va chạm dũng mãnh.",
                severity="positive",
                confidence=0.89,
                frame_idx=impact_frame,
                time_ms=impact_time_ms,
                evidence_frame_start=chamber_peak_frame,
                evidence_frame_end=impact_frame,
                evidence_timestamp_start_ms=chamber_peak_time_ms,
                evidence_timestamp_end_ms=impact_time_ms,
                affected_body_part=f"{leg}_ankle",
                metric_name="peakSpeed",
                metric_value=self.peak_speed,
                metric_unit="u/s",
                recommendation="Tốc độ búng đòn rất tốt! Giữ vững tốc độ thu chân nhanh tương ứng.",
            )
        elif self.peak_speed >= 0.8:
            speed_score = 80.0
            speed_status = CriterionStatus.GOOD
            speed_detail = f"🔵 Tốc độ trung bình ({self.peak_speed:.2f} u/s)"
            speed_finding = TechniqueFinding(
                id=f"{action_id}_speed_mid",
                action_id=action_id,
                category="speed",
                phase="impact",
                title="Moderate Striking Velocity (Tốc độ trung bình)",
                description=f"Vận tốc cổ chân đạt {self.peak_speed:.2f} u/s, duy trì ổn định.",
                severity="info",
                confidence=0.85,
                frame_idx=impact_frame,
                time_ms=impact_time_ms,
                evidence_frame_start=chamber_peak_frame,
                evidence_frame_end=impact_frame,
                evidence_timestamp_start_ms=chamber_peak_time_ms,
                evidence_timestamp_end_ms=impact_time_ms,
                affected_body_part=f"{leg}_ankle",
                metric_name="peakSpeed",
                metric_value=self.peak_speed,
                metric_unit="u/s",
                recommendation="Gia tăng tốc độ xoay hông và bật mạnh cổ chân để tăng thêm gia tốc đòn.",
            )
        else:
            speed_score = max(20.0, 70.0 - (0.8 - self.peak_speed) * 60.0)
            speed_status = CriterionStatus.NEEDS_WORK
            speed_detail = f"⚠️ Đá còn chậm ({self.peak_speed:.2f} u/s)"
            speed_finding = TechniqueFinding(
                id=f"{action_id}_speed_low",
                action_id=action_id,
                category="speed",
                phase="impact",
                title="Low Striking Velocity (Đá còn chậm)",
                description=f"Vận tốc cổ chân chỉ đạt {self.peak_speed:.2f} u/s, dễ bị đối thủ nhận biết đường đá và đỡ gạt.",
                severity="warning",
                confidence=0.86,
                frame_idx=impact_frame,
                time_ms=impact_time_ms,
                evidence_frame_start=chamber_peak_frame,
                evidence_frame_end=impact_frame,
                evidence_timestamp_start_ms=chamber_peak_time_ms,
                evidence_timestamp_end_ms=impact_time_ms,
                affected_body_part=f"{leg}_ankle",
                metric_name="peakSpeed",
                metric_value=self.peak_speed,
                metric_unit="u/s",
                recommendation="Thả lỏng khớp gối và cơ đùi trước khi ra đòn; phát lực bộc phát từ gót chân trụ xoay.",
            )

        criterion_results.append(CriterionResult(
            criterion_id="crit_kick_speed",
            criterion_name="Striking Velocity",
            phase="impact",
            feature_name="peak_speed",
            observed_value=self.peak_speed,
            score=speed_score,
            weight=0.15,
            confidence=speed_finding.confidence,
            status=speed_status,
            evidence_frame_start=chamber_peak_frame,
            evidence_frame_end=impact_frame,
            evidence_timestamp_start_ms=chamber_peak_time_ms,
            evidence_timestamp_end_ms=impact_time_ms,
            affected_body_part=f"{leg}_ankle",
            detail=speed_detail,
            finding=speed_finding,
        ))

        # ── Tiêu chí 4: Tư thế thân & mở hông (Torso & Hip Alignment) — Weight 0.15 ──
        if hip_angle is not None and hip_angle > 0.0:
            if hip_angle >= 135.0:
                hip_score = 100.0
                hip_status = CriterionStatus.EXCELLENT
                hip_detail = f"✅ Mở hông xuất sắc ({hip_angle:.0f}°)"
                hip_finding = TechniqueFinding(
                    id=f"{action_id}_hip_perf",
                    action_id=action_id,
                    category="posture",
                    phase="impact",
                    title="Optimal Hip Turn (Mở hông và thân chuẩn)",
                    description=f"Góc mở thân-hông đạt {hip_angle:.0f}°, trọng tâm vững vàng và truyền lực xoay hoàn chỉnh.",
                    severity="positive",
                    confidence=0.88,
                    frame_idx=impact_frame,
                    time_ms=impact_time_ms,
                    evidence_frame_start=impact_frame,
                    evidence_frame_end=impact_frame,
                    evidence_timestamp_start_ms=impact_time_ms,
                    evidence_timestamp_end_ms=impact_time_ms,
                    affected_body_part=f"{leg}_hip",
                    metric_name="hipAngle",
                    metric_value=hip_angle,
                    metric_unit="degrees",
                    recommendation="Thế hông rất đẹp! Tiếp tục giữ thăng bằng trục thân khi thu chân về.",
                )
            elif hip_angle >= 115.0:
                hip_score = 80.0
                hip_status = CriterionStatus.GOOD
                hip_detail = f"✅ Trục thân ổn định ({hip_angle:.0f}°)"
                hip_finding = TechniqueFinding(
                    id=f"{action_id}_hip_good",
                    action_id=action_id,
                    category="posture",
                    phase="impact",
                    title="Stable Hip Posture (Trục thân ổn định)",
                    description=f"Góc mở thân-hông đạt {hip_angle:.0f}°, đáp ứng tốt yêu cầu kỹ thuật.",
                    severity="info",
                    confidence=0.84,
                    frame_idx=impact_frame,
                    time_ms=impact_time_ms,
                    evidence_frame_start=impact_frame,
                    evidence_frame_end=impact_frame,
                    evidence_timestamp_start_ms=impact_time_ms,
                    evidence_timestamp_end_ms=impact_time_ms,
                    affected_body_part=f"{leg}_hip",
                    metric_name="hipAngle",
                    metric_value=hip_angle,
                    metric_unit="degrees",
                    recommendation="Nghiêng nhẹ thân trên ngược lại hướng đá để hông mở rộng thêm góc xoay.",
                )
            else:
                hip_score = 50.0
                hip_status = CriterionStatus.NEEDS_WORK
                hip_detail = f"⚠️ Gập thân khi đá ({hip_angle:.0f}°, nên > 115°)"
                hip_finding = TechniqueFinding(
                    id=f"{action_id}_hip_warn",
                    action_id=action_id,
                    category="posture",
                    phase="impact",
                    title="Forward Trunk Lean (Gập thân người khi đá)",
                    description=f"Góc thân-hông chỉ {hip_angle:.0f}°, thân bị gập ra phía trước làm kẹt khớp hông và giảm lực đá.",
                    severity="warning",
                    confidence=0.86,
                    frame_idx=impact_frame,
                    time_ms=impact_time_ms,
                    evidence_frame_start=impact_frame,
                    evidence_frame_end=impact_frame,
                    evidence_timestamp_start_ms=impact_time_ms,
                    evidence_timestamp_end_ms=impact_time_ms,
                    affected_body_part=f"{leg}_hip",
                    metric_name="hipAngle",
                    metric_value=hip_angle,
                    metric_unit="degrees",
                    recommendation="Mở khớp hông và đẩy xương chậu về phía mục tiêu, không gập người về phía trước.",
                )

            criterion_results.append(CriterionResult(
                criterion_id="crit_kick_posture",
                criterion_name="Torso & Hip Alignment",
                phase="impact",
                feature_name="hip_angle",
                observed_value=hip_angle,
                score=hip_score,
                weight=0.15,
                confidence=hip_finding.confidence,
                status=hip_status,
                evidence_frame_start=impact_frame,
                evidence_frame_end=impact_frame,
                evidence_timestamp_start_ms=impact_time_ms,
                evidence_timestamp_end_ms=impact_time_ms,
                affected_body_part=f"{leg}_hip",
                detail=hip_detail,
                finding=hip_finding,
            ))
        else:
            # Evidence Gating: Không có đủ độ tin cậy của vai -> bỏ qua tiêu chí này khỏi mẫu số
            criterion_results.append(CriterionResult(
                criterion_id="crit_kick_posture",
                criterion_name="Torso & Hip Alignment",
                phase="impact",
                feature_name="hip_angle",
                observed_value=0.0,
                score=0.0,
                weight=0.15,
                confidence=0.0,
                status=CriterionStatus.INSUFFICIENT_EVIDENCE,
                evidence_frame_start=impact_frame,
                evidence_frame_end=impact_frame,
                evidence_timestamp_start_ms=impact_time_ms,
                evidence_timestamp_end_ms=impact_time_ms,
                affected_body_part=f"{leg}_hip",
                detail="⚪ Không đủ dữ liệu góc hông",
                finding=None,
            ))

        # ── Tổng hợp điểm số theo Rubric Weighted Sum ──
        score, grade, emoji = calculate_technique_score(criterion_results)
        details = [r.detail for r in criterion_results if r.status != CriterionStatus.INSUFFICIENT_EVIDENCE]
        findings = [r.finding for r in criterion_results if r.finding is not None]

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
            impact_frame=impact_frame,
            impact_time_ms=impact_time_ms,
            chamber_peak_frame=chamber_peak_frame,
            chamber_peak_time_ms=chamber_peak_time_ms,
            active_leg=leg,
            criterion_results=criterion_results,
            findings=findings,
        )
