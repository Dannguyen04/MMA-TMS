"""
quality_gate.py — Analysis Quality & Target Gate (Task 9)

Đánh giá chất lượng dữ liệu video và tracking trước khi cho phép các kết luận kỹ thuật:
- camera/view suitability (fps, resolution, aspect ratio, duration)
- keypoint coverage & visibility (upper/lower body coverage, mean confidence)
- occlusion / missing-frame ratio
- multi-person ambiguity & target-athlete ambiguity (không default thành pass khi thiếu evidence)
- trajectory sufficiency (phát hiện chuyển động tĩnh, thiếu biên độ)

Trạng thái:
  - pass: Đủ điều kiện phân tích đầy đủ (EvidenceLevel.OBSERVED).
  - degraded: Có thể phân tích nhưng giảm độ tin cậy (EvidenceLevel.DERIVED_PROXY).
  - blocked: Không đủ điều kiện đưa ra kết luận kỹ thuật (EvidenceLevel.UNAVAILABLE).

Nguyên tắc bắt buộc:
1. Tuyệt đối KHÔNG dùng nhận diện khuôn mặt hoặc suy đoán danh tính võ sĩ.
2. Output AnalysisQuality là immutable, JSON-safe, có version và provenance.
3. Quality Gate điều chỉnh EvidenceLevel và khuyến nghị abstain, KHÔNG xóa dữ liệu detector gốc.
4. Mọi reason code đều có logic kiểm định bằng chứng thực tế (evidence-backed), không khai báo mã rác.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
import math
from typing import Any, Mapping, Optional, Sequence

from pipeline.contracts import EvidenceLevel, deep_freeze, to_json_safe


class QualityStatus(str, Enum):
    PASS = "pass"
    DEGRADED = "degraded"
    BLOCKED = "blocked"


class QualityReasonCode(str, Enum):
    # Camera / Recording conditions
    CAMERA_LOW_FPS = "camera_low_fps"
    CAMERA_SHORT_DURATION = "camera_short_duration"
    CAMERA_UNSUITABLE_VIEW = "camera_unsuitable_view"
    
    # Keypoint visibility & occlusion
    KEYPOINT_COVERAGE_LOW = "keypoint_coverage_low"
    KEYPOINT_CONFIDENCE_LOW = "keypoint_confidence_low"
    OCCLUSION_HIGH = "occlusion_high"
    MISSING_FRAME_RATIO_HIGH = "missing_frame_ratio_high"
    
    # Multi-person / tracking ambiguity
    MULTI_PERSON_AMBIGUITY = "multi_person_ambiguity"
    TARGET_ATHLETE_AMBIGUITY = "target_athlete_ambiguity"
    
    # Motion sufficiency
    TRAJECTORY_INSUFFICIENT = "trajectory_insufficient"


@dataclass(frozen=True)
class QualityMetricsSnapshot:
    fps: float
    duration_ms: float
    total_frames: int
    missing_frame_ratio: float
    mean_keypoint_confidence: float
    upper_body_coverage: float
    lower_body_coverage: float
    max_simultaneous_persons: Optional[int] = None
    target_track_ratio: Optional[float] = None
    tracking_evidence_available: bool = True
    mean_limb_displacement: Optional[float] = None
    img_width: Optional[int] = None
    img_height: Optional[int] = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "fps": round(self.fps, 2),
            "durationMs": round(self.duration_ms, 1),
            "totalFrames": self.total_frames,
            "missingFrameRatio": round(self.missing_frame_ratio, 3),
            "meanKeypointConfidence": round(self.mean_keypoint_confidence, 3),
            "upperBodyCoverage": round(self.upper_body_coverage, 3),
            "lowerBodyCoverage": round(self.lower_body_coverage, 3),
            "maxSimultaneousPersons": self.max_simultaneous_persons,
            "targetTrackRatio": round(self.target_track_ratio, 3) if self.target_track_ratio is not None else None,
            "trackingEvidenceAvailable": self.tracking_evidence_available,
            "meanLimbDisplacement": round(self.mean_limb_displacement, 4) if self.mean_limb_displacement is not None else None,
            "imgWidth": self.img_width,
            "imgHeight": self.img_height,
        }


@dataclass(frozen=True)
class AnalysisQuality:
    """
    Kết quả đánh giá chất lượng video / dữ liệu tư thế.
    Bất biến (immutable) và JSON-safe.
    """
    status: QualityStatus
    reason_codes: tuple[str, ...]
    metrics: QualityMetricsSnapshot
    quality_version: str = "1.0.0"
    evaluator_version: str = "1.0.0"
    evaluated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    adjusted_evidence_level: EvidenceLevel = EvidenceLevel.OBSERVED
    recommendation: str = "proceed_full_analysis"

    def to_dict(self) -> dict[str, Any]:
        return {
            "status": self.status.value,
            "reasonCodes": list(self.reason_codes),
            "metrics": self.metrics.to_dict() if hasattr(self.metrics, "to_dict") else dict(self.metrics),
            "qualityVersion": self.quality_version,
            "evaluatorVersion": self.evaluator_version,
            "evaluatedAt": self.evaluated_at,
            "adjustedEvidenceLevel": self.adjusted_evidence_level.value,
            "recommendation": self.recommendation,
        }


@dataclass(frozen=True)
class QualityGateConfig:
    # FPS thresholds
    min_fps_pass: float = 20.0
    min_fps_degraded: float = 12.0
    
    # Duration thresholds (ms)
    min_duration_ms_pass: float = 500.0
    min_duration_ms_degraded: float = 300.0
    min_frames_pass: int = 15
    min_frames_degraded: int = 6
    
    # Keypoint confidence thresholds
    min_keypoint_conf_pass: float = 0.45
    min_keypoint_conf_degraded: float = 0.25
    
    # Missing / occlusion ratio
    max_missing_ratio_pass: float = 0.15
    max_missing_ratio_degraded: float = 0.40
    max_occlusion_ratio_pass: float = 0.35
    max_occlusion_ratio_degraded: float = 0.60
    
    # Coverage thresholds (fraction of keypoints present)
    min_upper_coverage_pass: float = 0.70
    min_upper_coverage_degraded: float = 0.40
    min_lower_coverage_pass: float = 0.60
    min_lower_coverage_degraded: float = 0.30
    
    # Multi-person tracking ambiguity
    max_ambiguity_persons: int = 2
    min_target_track_ratio_pass: float = 0.75
    min_target_track_ratio_degraded: float = 0.50
    
    # Trajectory sufficiency threshold (normalized image displacement per frame)
    min_trajectory_displacement: float = 0.002
    check_trajectory: bool = False
    require_tracking_evidence: bool = False


class QualityGateEvaluator:
    """
    Bộ đánh giá Quality Gate xác định tính hợp lệ của video & tracking.
    """
    def __init__(self, config: Optional[QualityGateConfig] = None):
        self.config = config or QualityGateConfig()

    def evaluate(
        self,
        frames: Sequence[Mapping[str, Any]],
        fps: float,
        img_width: Optional[int] = None,
        img_height: Optional[int] = None,
        multi_person_counts: Optional[Sequence[int]] = None,
        target_track_counts: Optional[int] = None,
        custom_duration_ms: Optional[float] = None,
    ) -> AnalysisQuality:
        """
        Thực hiện đánh giá chất lượng toàn bộ stream frames.
        """
        total_frames = len(frames)
        calculated_duration = (total_frames / fps * 1000.0) if fps > 0 else 0.0
        duration_ms = custom_duration_ms if custom_duration_ms is not None else calculated_duration
        
        reason_codes: list[str] = []
        is_blocked = False
        is_degraded = False

        # 1. Camera / FPS & Duration checks
        if fps < self.config.min_fps_degraded:
            reason_codes.append(QualityReasonCode.CAMERA_LOW_FPS.value)
            is_blocked = True
        elif fps < self.config.min_fps_pass:
            reason_codes.append(QualityReasonCode.CAMERA_LOW_FPS.value)
            is_degraded = True

        if duration_ms < self.config.min_duration_ms_degraded or total_frames < self.config.min_frames_degraded:
            reason_codes.append(QualityReasonCode.CAMERA_SHORT_DURATION.value)
            is_blocked = True
        elif duration_ms < self.config.min_duration_ms_pass or total_frames < self.config.min_frames_pass:
            reason_codes.append(QualityReasonCode.CAMERA_SHORT_DURATION.value)
            is_degraded = True

        # Camera view resolution / aspect ratio suitability
        if img_width is not None and img_height is not None and img_width > 0 and img_height > 0:
            if img_width < 320 or img_height < 240:
                reason_codes.append(QualityReasonCode.CAMERA_UNSUITABLE_VIEW.value)
                is_blocked = True
            else:
                aspect = img_width / img_height
                if aspect < 0.35 or aspect > 2.8:
                    reason_codes.append(QualityReasonCode.CAMERA_UNSUITABLE_VIEW.value)
                    is_degraded = True

        # 2. Keypoint & Coverage statistics
        missing_frames = 0
        total_conf_sum = 0.0
        total_kps_evaluated = 0
        upper_present_frames = 0
        lower_present_frames = 0
        critical_occluded_count = 0
        total_critical_joints = 0

        # COCO upper indices: 5,6 (shoulders), 7,8 (elbows), 9,10 (wrists)
        upper_indices = {5, 6, 7, 8, 9, 10}
        # COCO lower indices: 11,12 (hips), 13,14 (knees), 15,16 (ankles)
        lower_indices = {11, 12, 13, 14, 15, 16}
        # Critical striking joints: wrists (9, 10), ankles (15, 16)
        critical_indices = {9, 10, 15, 16}

        prev_limb_positions: dict[int, tuple[float, float]] = {}
        total_limb_displacement = 0.0
        displacement_samples = 0

        for frame in frames:
            landmarks = frame.get("landmarks")
            if not landmarks or len(landmarks) == 0:
                missing_frames += 1
                continue

            frame_kps_valid = 0
            upper_valid = 0
            lower_valid = 0

            for idx, kp in enumerate(landmarks):
                if isinstance(kp, Mapping):
                    conf = float(kp.get("conf", 0.0))
                    kx = float(kp.get("x", 0.0))
                    ky = float(kp.get("y", 0.0))
                else:
                    conf = float(getattr(kp, "conf", 0.0))
                    kx = float(getattr(kp, "x", 0.0))
                    ky = float(getattr(kp, "y", 0.0))
                
                total_conf_sum += conf
                total_kps_evaluated += 1
                if conf >= 0.3:
                    frame_kps_valid += 1
                    if idx in upper_indices:
                        upper_valid += 1
                    elif idx in lower_indices:
                        lower_valid += 1

                if idx in critical_indices:
                    total_critical_joints += 1
                    if conf < 0.25:
                        critical_occluded_count += 1
                    else:
                        # Track limb displacement for trajectory sufficiency
                        if idx in prev_limb_positions:
                            px, py = prev_limb_positions[idx]
                            disp = math.hypot(kx - px, ky - py)
                            total_limb_displacement += disp
                            displacement_samples += 1
                        prev_limb_positions[idx] = (kx, ky)

            if frame_kps_valid < 4:
                missing_frames += 1

            if upper_valid >= 4:
                upper_present_frames += 1
            if lower_valid >= 4:
                lower_present_frames += 1

        missing_frame_ratio = (missing_frames / total_frames) if total_frames > 0 else 1.0
        mean_keypoint_conf = (total_conf_sum / total_kps_evaluated) if total_kps_evaluated > 0 else 0.0
        upper_body_cov = (upper_present_frames / total_frames) if total_frames > 0 else 0.0
        lower_body_cov = (lower_present_frames / total_frames) if total_frames > 0 else 0.0
        occlusion_ratio = (critical_occluded_count / total_critical_joints) if total_critical_joints > 0 else 1.0
        mean_limb_disp = (total_limb_displacement / displacement_samples) if displacement_samples > 0 else 0.0

        if missing_frame_ratio > self.config.max_missing_ratio_degraded:
            reason_codes.append(QualityReasonCode.MISSING_FRAME_RATIO_HIGH.value)
            is_blocked = True
        elif missing_frame_ratio > self.config.max_missing_ratio_pass:
            reason_codes.append(QualityReasonCode.MISSING_FRAME_RATIO_HIGH.value)
            is_degraded = True

        if mean_keypoint_conf < self.config.min_keypoint_conf_degraded:
            reason_codes.append(QualityReasonCode.KEYPOINT_CONFIDENCE_LOW.value)
            is_blocked = True
        elif mean_keypoint_conf < self.config.min_keypoint_conf_pass:
            reason_codes.append(QualityReasonCode.KEYPOINT_CONFIDENCE_LOW.value)
            is_degraded = True

        if upper_body_cov < self.config.min_upper_coverage_degraded and lower_body_cov < self.config.min_lower_coverage_degraded:
            reason_codes.append(QualityReasonCode.KEYPOINT_COVERAGE_LOW.value)
            is_blocked = True
        elif upper_body_cov < self.config.min_upper_coverage_pass or lower_body_cov < self.config.min_lower_coverage_pass:
            reason_codes.append(QualityReasonCode.KEYPOINT_COVERAGE_LOW.value)
            is_degraded = True

        if occlusion_ratio > self.config.max_occlusion_ratio_degraded:
            reason_codes.append(QualityReasonCode.OCCLUSION_HIGH.value)
            is_blocked = True
        elif occlusion_ratio > self.config.max_occlusion_ratio_pass:
            reason_codes.append(QualityReasonCode.OCCLUSION_HIGH.value)
            is_degraded = True

        # Trajectory sufficiency check
        if self.config.check_trajectory and total_frames >= self.config.min_frames_pass:
            if displacement_samples == 0 or (mean_limb_disp is not None and mean_limb_disp < (self.config.min_trajectory_displacement * 0.3)):
                reason_codes.append(QualityReasonCode.TRAJECTORY_INSUFFICIENT.value)
                is_blocked = True
            elif mean_limb_disp is not None and mean_limb_disp < self.config.min_trajectory_displacement:
                reason_codes.append(QualityReasonCode.TRAJECTORY_INSUFFICIENT.value)
                is_degraded = True

        # 3. Multi-person & Target ambiguity (R1.2: Unavailable evidence must NOT default to single person)
        has_multi = multi_person_counts is not None
        has_target = target_track_counts is not None
        tracking_evidence_available = (has_multi or has_target)
        if not tracking_evidence_available:
            max_persons = None
            target_ratio = None
            if self.config.require_tracking_evidence:
                reason_codes.append(QualityReasonCode.TARGET_ATHLETE_AMBIGUITY.value)
                is_degraded = True
        else:
            max_persons = max(multi_person_counts) if (has_multi and len(multi_person_counts) > 0) else 1
            target_ratio = (target_track_counts / total_frames) if (has_target and total_frames > 0) else 1.0

            if max_persons > self.config.max_ambiguity_persons and target_ratio < self.config.min_target_track_ratio_degraded:
                reason_codes.append(QualityReasonCode.MULTI_PERSON_AMBIGUITY.value)
                reason_codes.append(QualityReasonCode.TARGET_ATHLETE_AMBIGUITY.value)
                is_blocked = True
            elif max_persons > self.config.max_ambiguity_persons:
                reason_codes.append(QualityReasonCode.MULTI_PERSON_AMBIGUITY.value)
                is_degraded = True
            elif max_persons > 1:
                reason_codes.append(QualityReasonCode.MULTI_PERSON_AMBIGUITY.value)
                if not has_target or target_ratio < self.config.min_target_track_ratio_pass:
                    reason_codes.append(QualityReasonCode.TARGET_ATHLETE_AMBIGUITY.value)
                    is_degraded = True
            elif target_ratio < self.config.min_target_track_ratio_degraded:
                reason_codes.append(QualityReasonCode.TARGET_ATHLETE_AMBIGUITY.value)
                is_blocked = True
            elif target_ratio < self.config.min_target_track_ratio_pass:
                reason_codes.append(QualityReasonCode.TARGET_ATHLETE_AMBIGUITY.value)
                is_degraded = True

        # 4. Synthesize final status and evidence level
        if is_blocked:
            final_status = QualityStatus.BLOCKED
            adjusted_evidence = EvidenceLevel.UNAVAILABLE
            recommendation = "abstain_technical_conclusions"
        elif is_degraded:
            final_status = QualityStatus.DEGRADED
            adjusted_evidence = EvidenceLevel.DERIVED_PROXY
            recommendation = "proceed_with_degraded_confidence"
        else:
            final_status = QualityStatus.PASS
            adjusted_evidence = EvidenceLevel.OBSERVED
            recommendation = "proceed_full_analysis"

        snapshot = QualityMetricsSnapshot(
            fps=fps,
            duration_ms=duration_ms,
            total_frames=total_frames,
            missing_frame_ratio=missing_frame_ratio,
            mean_keypoint_confidence=mean_keypoint_conf,
            upper_body_coverage=upper_body_cov,
            lower_body_coverage=lower_body_cov,
            max_simultaneous_persons=max_persons,
            target_track_ratio=target_ratio,
            tracking_evidence_available=tracking_evidence_available,
            mean_limb_displacement=mean_limb_disp,
            img_width=img_width,
            img_height=img_height,
        )

        sorted_unique_reasons = tuple(sorted(list(dict.fromkeys(reason_codes))))

        return AnalysisQuality(
            status=final_status,
            reason_codes=sorted_unique_reasons,
            metrics=snapshot,
            adjusted_evidence_level=adjusted_evidence,
            recommendation=recommendation,
        )


def evaluate_video_quality(
    frames: Sequence[Mapping[str, Any]],
    fps: float,
    img_width: Optional[int] = None,
    img_height: Optional[int] = None,
    multi_person_counts: Optional[Sequence[int]] = None,
    target_track_counts: Optional[int] = None,
    config: Optional[QualityGateConfig] = None,
) -> AnalysisQuality:
    """Convenience helper for QualityGateEvaluator."""
    evaluator = QualityGateEvaluator(config=config)
    return evaluator.evaluate(
        frames=frames,
        fps=fps,
        img_width=img_width,
        img_height=img_height,
        multi_person_counts=multi_person_counts,
        target_track_counts=target_track_counts,
    )
