"""
pipeline/temporal_phases.py — MMA-TMS Temporal Phase Segmentation & Contract Pack (Task 6)

Triển khai hợp đồng dữ liệu chuẩn hóa (Canonical Contract Pack) và thuật toán phân đoạn
các pha thời gian (temporal phases) cho các đòn đánh (đấm và đá) từ quỹ đạo landmark.

Tuân thủ:
- MMA-TMS Master Specification v3.0
- Task 6 Acceptance Criteria & Approved Contract Gate 1 & 2
- Canonical Phases: preparation -> launch -> peak -> retraction -> recovery
- Strict Bi-directional Nullability & Frame/Time Consistency Validation
- Config Injection via versioned TemporalPhaseConfig & upstream PoseValidityConfig
- Zero Fabricated Phase Confidence Constants (confidence is None unless deterministically measured)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
import math
import re
from types import MappingProxyType
from typing import Any, Mapping, Optional, Sequence, Union

from pose_math import (
    KP, Point, calculate_angle, calculate_speed,
    calculate_directional_reach_speed, are_landmarks_valid,
    PoseValidityConfig,
)

try:
    from rubric_primitives import SEMVER_REGEX
except ImportError:
    SEMVER_REGEX = re.compile(
        r"^(?P<major>0|[1-9]\d*)\.(?P<minor>0|[1-9]\d*)\.(?P<patch>0|[1-9]\d*)"
        r"(?:-(?P<prerelease>(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?"
        r"(?:\+(?P<buildmetadata>[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$"
    )


CANONICAL_PHASES: tuple[str, ...] = (
    "preparation",
    "launch",
    "peak",
    "retraction",
    "recovery",
)


def calculate_tolerance_ms(fps: float) -> float:
    """
    Tính dung sai thời gian chuẩn hóa: tolerance_ms = 0.5 * (1000.0 / fps) + 0.2 ms.
    Phản ánh dung sai nửa chu kỳ frame kết hợp jitter làm tròn timestamp.
    """
    if isinstance(fps, bool) or not isinstance(fps, (int, float)):
        raise TypeError(f"fps must be a float or int, got {type(fps).__name__}")
    if fps <= 0 or not math.isfinite(fps):
        raise ValueError(f"fps must be positive and finite, got {fps}")
    return 0.5 * (1000.0 / fps) + 0.2


@dataclass(frozen=True)
class PhaseValidityConfig:
    """
    Bản sao bất biến (transitively immutable) các tham số kiểm tra landmark.
    """
    min_landmark_confidence: float = 0.35
    min_segment_length: float = 0.02

    def __post_init__(self) -> None:
        if isinstance(self.min_landmark_confidence, bool) or not isinstance(self.min_landmark_confidence, (int, float)):
            raise TypeError(f"min_landmark_confidence must be a float, got {type(self.min_landmark_confidence).__name__}")
        if not math.isfinite(self.min_landmark_confidence):
            raise ValueError("min_landmark_confidence must be finite")
        if not (0.0 <= float(self.min_landmark_confidence) <= 1.0):
            raise ValueError(f"min_landmark_confidence must be in [0, 1], got {self.min_landmark_confidence}")
        object.__setattr__(self, "min_landmark_confidence", float(self.min_landmark_confidence))

        if isinstance(self.min_segment_length, bool) or not isinstance(self.min_segment_length, (int, float)):
            raise TypeError(f"min_segment_length must be a float, got {type(self.min_segment_length).__name__}")
        if not math.isfinite(self.min_segment_length) or float(self.min_segment_length) < 0.0:
            raise ValueError(f"min_segment_length must be non-negative and finite, got {self.min_segment_length}")
        object.__setattr__(self, "min_segment_length", float(self.min_segment_length))

    def to_dict(self) -> dict[str, Any]:
        return {
            "minLandmarkConfidence": self.min_landmark_confidence,
            "minSegmentLength": self.min_segment_length,
        }


@dataclass(frozen=True)
class TemporalPhaseConfig:
    """
    Cấu hình phiên bản bất biến bắc cầu (transitively immutable) cho thuật toán phân đoạn pha thời gian (Task 6).
    """
    config_version: str = "1.0.0"
    min_retraction_delta_deg: float = 10.0
    recovery_elbow_angle_deg: float = 85.0
    recovery_knee_angle_deg: float = 110.0
    pose_config: PhaseValidityConfig = field(default_factory=PhaseValidityConfig)

    def __post_init__(self) -> None:
        # 1. Validate config_version (non-empty SemVer string)
        if isinstance(self.config_version, bool) or not isinstance(self.config_version, str):
            raise TypeError(f"config_version must be a str, got {type(self.config_version).__name__}")
        ver = self.config_version.strip()
        if not ver:
            raise ValueError("config_version cannot be empty or whitespace")
        if not SEMVER_REGEX.match(ver):
            raise ValueError(f"Invalid SemVer config_version: '{self.config_version}'. Expected 'MAJOR.MINOR.PATCH...'")
        object.__setattr__(self, "config_version", ver)

        # 2. Validate numeric fields:
        # min_retraction_delta_deg > 0
        if isinstance(self.min_retraction_delta_deg, bool) or not isinstance(self.min_retraction_delta_deg, (int, float)):
            raise TypeError(f"min_retraction_delta_deg must be float, got {type(self.min_retraction_delta_deg).__name__}")
        if not math.isfinite(self.min_retraction_delta_deg) or float(self.min_retraction_delta_deg) <= 0.0:
            raise ValueError(f"min_retraction_delta_deg must be > 0 and finite, got {self.min_retraction_delta_deg}")
        object.__setattr__(self, "min_retraction_delta_deg", float(self.min_retraction_delta_deg))

        # recovery_elbow_angle_deg in (0, 180)
        if isinstance(self.recovery_elbow_angle_deg, bool) or not isinstance(self.recovery_elbow_angle_deg, (int, float)):
            raise TypeError(f"recovery_elbow_angle_deg must be float, got {type(self.recovery_elbow_angle_deg).__name__}")
        if not math.isfinite(self.recovery_elbow_angle_deg) or not (0.0 < float(self.recovery_elbow_angle_deg) < 180.0):
            raise ValueError(f"recovery_elbow_angle_deg must be in (0, 180), got {self.recovery_elbow_angle_deg}")
        object.__setattr__(self, "recovery_elbow_angle_deg", float(self.recovery_elbow_angle_deg))

        # recovery_knee_angle_deg in (0, 180)
        if isinstance(self.recovery_knee_angle_deg, bool) or not isinstance(self.recovery_knee_angle_deg, (int, float)):
            raise TypeError(f"recovery_knee_angle_deg must be float, got {type(self.recovery_knee_angle_deg).__name__}")
        if not math.isfinite(self.recovery_knee_angle_deg) or not (0.0 < float(self.recovery_knee_angle_deg) < 180.0):
            raise ValueError(f"recovery_knee_angle_deg must be in (0, 180), got {self.recovery_knee_angle_deg}")
        object.__setattr__(self, "recovery_knee_angle_deg", float(self.recovery_knee_angle_deg))

        # 3. Transitive immutability: snapshot pose_config into PhaseValidityConfig
        if isinstance(self.pose_config, PhaseValidityConfig):
            frozen_pose = self.pose_config
        elif self.pose_config is None:
            frozen_pose = PhaseValidityConfig()
        elif hasattr(self.pose_config, "min_landmark_confidence"):
            frozen_pose = PhaseValidityConfig(
                min_landmark_confidence=getattr(self.pose_config, "min_landmark_confidence", 0.35),
                min_segment_length=getattr(self.pose_config, "min_segment_length", 0.02),
            )
        else:
            raise TypeError(f"pose_config must be PhaseValidityConfig or PoseValidityConfig, got {type(self.pose_config).__name__}")
        object.__setattr__(self, "pose_config", frozen_pose)

    def to_dict(self) -> dict[str, Any]:
        return {
            "configVersion": self.config_version,
            "minRetractionDeltaDeg": self.min_retraction_delta_deg,
            "recoveryElbowAngleDeg": self.recovery_elbow_angle_deg,
            "recoveryKneeAngleDeg": self.recovery_knee_angle_deg,
            "poseConfig": self.pose_config.to_dict(),
        }


# Re-export canonical EvidenceLevel from pipeline.contracts
from pipeline.contracts import EvidenceLevel


@dataclass(frozen=True)
class PhaseEvidence:
    """
    Thông tin bằng chứng và độ tin cậy cho một biên pha thời gian.
    Chỉ lưu confidence số thực khi có công thức đo lường tất định (deterministic evidence).
    Mặc định là None (không bịa đặt hằng số xác suất ảo).
    """
    level: EvidenceLevel
    confidence: Optional[float] = None
    source_signal: str = ""

    def __post_init__(self) -> None:
        if isinstance(self.level, str) and not isinstance(self.level, EvidenceLevel):
            object.__setattr__(self, "level", EvidenceLevel(self.level))
        elif not isinstance(self.level, EvidenceLevel):
            raise TypeError(f"level must be an EvidenceLevel, got {type(self.level).__name__}")

        if self.confidence is not None:
            if isinstance(self.confidence, bool) or not isinstance(self.confidence, (int, float)):
                raise TypeError(f"confidence must be float, int, or None, got {type(self.confidence).__name__}")
            if not math.isfinite(self.confidence):
                raise ValueError("confidence must be finite")
            if not (0.0 <= float(self.confidence) <= 1.0):
                raise ValueError(f"confidence must be between 0.0 and 1.0, got {self.confidence}")
            object.__setattr__(self, "confidence", float(self.confidence))

        if not isinstance(self.source_signal, str):
            raise TypeError(f"source_signal must be a str, got {type(self.source_signal).__name__}")

    def to_dict(self) -> dict[str, Any]:
        return {
            "level": self.level.value,
            "confidence": round(self.confidence, 4) if self.confidence is not None else None,
            "sourceSignal": self.source_signal,
        }


@dataclass(frozen=True)
class PhaseBoundary:
    """
    Điểm biên chuyển pha thời gian.

    Quy tắc Bi-directional Nullability bắt buộc:
    - frame_idx is None iff time_ms is None
    - frame_idx is None iff evidence.level == EvidenceLevel.UNAVAILABLE
    """
    frame_idx: Optional[int]
    time_ms: Optional[float]
    evidence: PhaseEvidence

    def __post_init__(self) -> None:
        if not isinstance(self.evidence, PhaseEvidence):
            raise TypeError(f"evidence must be a PhaseEvidence instance, got {type(self.evidence).__name__}")

        # Bi-directional nullability check:
        # 1. frame_idx is None iff time_ms is None
        if (self.frame_idx is None) != (self.time_ms is None):
            raise ValueError(
                f"Bi-directional nullability violated: frame_idx is {self.frame_idx} "
                f"while time_ms is {self.time_ms}. Both must be None or both must be non-None."
            )

        # 2. frame_idx is None iff evidence.level == EvidenceLevel.UNAVAILABLE
        if self.frame_idx is None:
            if self.evidence.level != EvidenceLevel.UNAVAILABLE:
                raise ValueError(
                    f"Bi-directional nullability violated: frame_idx is None, but evidence.level is "
                    f"'{self.evidence.level.value}' (expected '{EvidenceLevel.UNAVAILABLE.value}')."
                )
        else:
            if self.evidence.level == EvidenceLevel.UNAVAILABLE:
                raise ValueError(
                    f"Bi-directional nullability violated: frame_idx is {self.frame_idx} (non-null), "
                    f"but evidence.level is '{EvidenceLevel.UNAVAILABLE.value}'."
                )

        # Non-null bounds checks
        if self.frame_idx is not None:
            if isinstance(self.frame_idx, bool) or not isinstance(self.frame_idx, int):
                raise TypeError(f"frame_idx must be an int, got {type(self.frame_idx).__name__}")
            if self.frame_idx < 0:
                raise ValueError(f"frame_idx must be non-negative, got {self.frame_idx}")

        if self.time_ms is not None:
            if isinstance(self.time_ms, bool) or not isinstance(self.time_ms, (int, float)):
                raise TypeError(f"time_ms must be float or int, got {type(self.time_ms).__name__}")
            if not math.isfinite(self.time_ms):
                raise ValueError("time_ms must be finite")
            if self.time_ms < 0.0:
                raise ValueError(f"time_ms must be non-negative, got {self.time_ms}")
            object.__setattr__(self, "time_ms", float(self.time_ms))

    @classmethod
    def unavailable(cls, source_signal: str = "none") -> PhaseBoundary:
        """Tạo biên pha dạng unavailable tiêu chuẩn."""
        return cls(
            frame_idx=None,
            time_ms=None,
            evidence=PhaseEvidence(
                level=EvidenceLevel.UNAVAILABLE,
                confidence=None,
                source_signal=source_signal,
            ),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "frameIdx": self.frame_idx,
            "timeMs": round(self.time_ms, 1) if self.time_ms is not None else None,
            "evidence": self.evidence.to_dict(),
        }


@dataclass(frozen=True)
class TemporalPhaseSequence:
    """
    Chuỗi pha thời gian hoàn chỉnh cho một hành động đánh (punch / kick).

    Bất biến (immutable):
    - boundaries lưu dưới dạng MappingProxyType[str, PhaseBoundary]
    - anomalies lưu dưới dạng tuple[str, ...]
    """
    action_family: str
    impact_type: str
    fps: float
    window_start_frame: int
    window_end_frame: int
    window_start_time_ms: float
    window_end_time_ms: float
    boundaries: MappingProxyType[str, PhaseBoundary] = field(
        default_factory=lambda: MappingProxyType({})
    )
    anomalies: tuple[str, ...] = field(default_factory=tuple)

    def __post_init__(self) -> None:
        # 1. Chuẩn hóa boundaries thành MappingProxyType
        if not isinstance(self.boundaries, MappingProxyType):
            if not isinstance(self.boundaries, Mapping):
                raise TypeError(f"boundaries must be a Mapping, got {type(self.boundaries).__name__}")
            object.__setattr__(self, "boundaries", MappingProxyType(dict(self.boundaries)))

        # 2. Chuẩn hóa anomalies thành tuple
        if not isinstance(self.anomalies, tuple):
            if isinstance(self.anomalies, (str, bool)) or not hasattr(self.anomalies, "__iter__"):
                raise TypeError(f"anomalies must be an iterable of strings, got {type(self.anomalies).__name__}")
            for a in self.anomalies:
                if not isinstance(a, str):
                    raise TypeError(f"Each anomaly must be a str, got {type(a).__name__}")
            object.__setattr__(self, "anomalies", tuple(self.anomalies))

        # 3. Validation: fps > 0 and finite
        if isinstance(self.fps, bool) or not isinstance(self.fps, (int, float)):
            raise TypeError(f"fps must be a float or int, got {type(self.fps).__name__}")
        if self.fps <= 0 or not math.isfinite(self.fps):
            raise ValueError(f"fps must be positive and finite, got {self.fps}")
        object.__setattr__(self, "fps", float(self.fps))

        # 4. Validation: frame & time non-negativity and ordering (start <= end)
        if isinstance(self.window_start_frame, bool) or not isinstance(self.window_start_frame, int):
            raise TypeError(f"window_start_frame must be an int, got {type(self.window_start_frame).__name__}")
        if self.window_start_frame < 0:
            raise ValueError(f"window_start_frame must be non-negative, got {self.window_start_frame}")

        if isinstance(self.window_end_frame, bool) or not isinstance(self.window_end_frame, int):
            raise TypeError(f"window_end_frame must be an int, got {type(self.window_end_frame).__name__}")
        if self.window_end_frame < 0:
            raise ValueError(f"window_end_frame must be non-negative, got {self.window_end_frame}")

        if self.window_start_frame > self.window_end_frame:
            raise ValueError(
                f"Invalid frame ordering: window_start_frame ({self.window_start_frame}) "
                f"> window_end_frame ({self.window_end_frame})"
            )

        if isinstance(self.window_start_time_ms, bool) or not isinstance(self.window_start_time_ms, (int, float)):
            raise TypeError(f"window_start_time_ms must be float or int, got {type(self.window_start_time_ms).__name__}")
        if not math.isfinite(self.window_start_time_ms) or self.window_start_time_ms < 0.0:
            raise ValueError(f"window_start_time_ms must be non-negative and finite, got {self.window_start_time_ms}")
        object.__setattr__(self, "window_start_time_ms", float(self.window_start_time_ms))

        if isinstance(self.window_end_time_ms, bool) or not isinstance(self.window_end_time_ms, (int, float)):
            raise TypeError(f"window_end_time_ms must be float or int, got {type(self.window_end_time_ms).__name__}")
        if not math.isfinite(self.window_end_time_ms) or self.window_end_time_ms < 0.0:
            raise ValueError(f"window_end_time_ms must be non-negative and finite, got {self.window_end_time_ms}")
        object.__setattr__(self, "window_end_time_ms", float(self.window_end_time_ms))

        if self.window_start_time_ms > self.window_end_time_ms:
            raise ValueError(
                f"Invalid time ordering: window_start_time_ms ({self.window_start_time_ms}) "
                f"> window_end_time_ms ({self.window_end_time_ms})"
            )

        # 5. Cross-field impact_type validation
        if self.action_family == "punch":
            if self.impact_type != "peak_extension_proxy":
                raise ValueError(
                    f"Cross-field validation failed: action_family 'punch' requires "
                    f"impact_type 'peak_extension_proxy', got '{self.impact_type}'"
                )
        elif self.action_family == "kick":
            if self.impact_type != "max_extension_proxy":
                raise ValueError(
                    f"Cross-field validation failed: action_family 'kick' requires "
                    f"impact_type 'max_extension_proxy', got '{self.impact_type}'"
                )
        else:
            raise ValueError(
                f"Unsupported action_family '{self.action_family}'. Expected 'punch' or 'kick'."
            )

        # 6. Frame/time consistency & containment in action window
        frame_duration_ms = 1000.0 / self.fps
        tolerance_ms = calculate_tolerance_ms(self.fps)

        for phase_name, b in self.boundaries.items():
            if not isinstance(b, PhaseBoundary):
                raise TypeError(f"Boundary '{phase_name}' must be a PhaseBoundary, got {type(b).__name__}")

            if b.frame_idx is not None and b.time_ms is not None:
                # Containment in action window (frame index)
                if b.frame_idx < self.window_start_frame or b.frame_idx > self.window_end_frame:
                    raise ValueError(
                        f"Boundary '{phase_name}' frame_idx {b.frame_idx} is outside action window "
                        f"[{self.window_start_frame}, {self.window_end_frame}]"
                    )

                # Containment in action window (time with tolerance)
                if (b.time_ms < self.window_start_time_ms - tolerance_ms or
                    b.time_ms > self.window_end_time_ms + tolerance_ms):
                    raise ValueError(
                        f"Boundary '{phase_name}' time_ms {b.time_ms} ms is outside action window "
                        f"[{self.window_start_time_ms}, {self.window_end_time_ms}] ms (tolerance={tolerance_ms:.2f} ms)"
                    )

                # Frame/time consistency relative to window start:
                # expected_time_ms = window_start_time_ms + (b.frame_idx - window_start_frame) * (1000.0 / fps)
                expected_time_ms = self.window_start_time_ms + (b.frame_idx - self.window_start_frame) * frame_duration_ms
                delta = abs(b.time_ms - expected_time_ms)
                if delta > tolerance_ms:
                    raise ValueError(
                        f"Frame/time consistency violated for boundary '{phase_name}': "
                        f"time_ms={b.time_ms} ms, expected_time_ms={expected_time_ms:.2f} ms "
                        f"(delta={delta:.2f} ms > tolerance={tolerance_ms:.2f} ms at fps={self.fps})"
                    )

        # 7. Monotonic ordering among sequential non-null boundaries (preparation, launch, peak, retraction, recovery)
        active_phases: list[tuple[str, PhaseBoundary]] = [
            (phase_name, self.boundaries[phase_name])
            for phase_name in CANONICAL_PHASES
            if phase_name in self.boundaries and self.boundaries[phase_name].frame_idx is not None
        ]
        for i in range(len(active_phases) - 1):
            name_curr, b_curr = active_phases[i]
            name_next, b_next = active_phases[i + 1]
            if b_curr.frame_idx is not None and b_next.frame_idx is not None:
                if b_curr.frame_idx > b_next.frame_idx:
                    raise ValueError(
                        f"Monotonic frame ordering violated: phase '{name_curr}' (frame {b_curr.frame_idx}) "
                        f"occurs after phase '{name_next}' (frame {b_next.frame_idx})"
                    )
            if b_curr.time_ms is not None and b_next.time_ms is not None:
                if b_curr.time_ms > b_next.time_ms + 1e-6:
                    raise ValueError(
                        f"Monotonic time ordering violated: phase '{name_curr}' ({b_curr.time_ms} ms) "
                        f"occurs after phase '{name_next}' ({b_next.time_ms} ms)"
                    )

    @property
    def is_complete(self) -> bool:
        """
        True iff anomalies empty, peak boundary present and non-null, valid window.
        """
        if len(self.anomalies) > 0:
            return False
        peak = self.boundaries.get("peak")
        if peak is None or peak.frame_idx is None or peak.time_ms is None:
            return False
        if peak.evidence.level == EvidenceLevel.UNAVAILABLE:
            return False
        valid_window = (
            0 <= self.window_start_frame <= self.window_end_frame
            and 0.0 <= self.window_start_time_ms <= self.window_end_time_ms
        )
        return valid_window

    def to_dict(self) -> dict[str, Any]:
        """Chuyển đổi sang dict tương thích JSON."""
        return {
            "actionFamily": self.action_family,
            "impactType": self.impact_type,
            "fps": self.fps,
            "windowStartFrame": self.window_start_frame,
            "windowEndFrame": self.window_end_frame,
            "windowStartTimeMs": round(self.window_start_time_ms, 1),
            "windowEndTimeMs": round(self.window_end_time_ms, 1),
            "boundaries": {
                name: b.to_dict() for name, b in self.boundaries.items()
            },
            "anomalies": list(self.anomalies),
            "isComplete": self.is_complete,
        }


# ─── Helper Functions For Trajectory Analysis ───

def _extract_frame_points(frame_data: Any) -> Optional[list[Point]]:
    """
    Trích xuất danh sách Point từ frame_data đa hình (list[Point], dict, PoseObservation, v.v.).
    """
    if frame_data is None:
        return None
    if isinstance(frame_data, list):
        if not frame_data:
            return []
        if isinstance(frame_data[0], Point):
            return frame_data
        if isinstance(frame_data[0], dict):
            return [
                Point(x=p.get("x", 0.0), y=p.get("y", 0.0), conf=p.get("conf", 1.0))
                for p in frame_data
            ]
    if hasattr(frame_data, "filtered_keypoints"):
        return frame_data.filtered_keypoints
    if hasattr(frame_data, "keypoints"):
        return frame_data.keypoints
    if isinstance(frame_data, dict):
        landmarks = frame_data.get("landmarks")
        if landmarks is not None and isinstance(landmarks, list):
            return [
                Point(x=p.get("x", 0.0), y=p.get("y", 0.0), conf=p.get("conf", 1.0))
                if isinstance(p, dict) else p
                for p in landmarks
            ]
    return None


def calculate_arm_reach(
    points: Optional[list[Point]],
    arm: str = "right",
    pose_config: Union[PhaseValidityConfig, PoseValidityConfig, None] = None,
) -> Optional[float]:
    """
    Tính khoảng cách từ cổ tay đến vai (reach) của cánh tay.
    Sử dụng pose_config.min_landmark_confidence (mặc định 0.35 từ PhaseValidityConfig).
    """
    if not points or len(points) <= KP.RIGHT_WRIST:
        return None
    cfg = pose_config or PhaseValidityConfig()
    sh_idx = KP.LEFT_SHOULDER if arm == "left" else KP.RIGHT_SHOULDER
    wr_idx = KP.LEFT_WRIST if arm == "left" else KP.RIGHT_WRIST
    sh = points[sh_idx]
    wr = points[wr_idx]
    if not are_landmarks_valid([sh, wr], min_confidence=cfg.min_landmark_confidence):
        return None
    return math.dist((wr.x, wr.y), (sh.x, sh.y))


def calculate_arm_elbow_angle(
    points: Optional[list[Point]],
    arm: str = "right",
    pose_config: Union[PhaseValidityConfig, PoseValidityConfig, None] = None,
) -> Optional[float]:
    """
    Tính góc cùi chỏ của cánh tay.
    Sử dụng pose_config (mặc định PhaseValidityConfig() với min_landmark_confidence=0.35).
    """
    if not points or len(points) <= KP.RIGHT_WRIST:
        return None
    cfg = pose_config or PhaseValidityConfig()
    sh_idx = KP.LEFT_SHOULDER if arm == "left" else KP.RIGHT_SHOULDER
    el_idx = KP.LEFT_ELBOW if arm == "left" else KP.RIGHT_ELBOW
    wr_idx = KP.LEFT_WRIST if arm == "left" else KP.RIGHT_WRIST
    return calculate_angle(points[sh_idx], points[el_idx], points[wr_idx], config=cfg)


def calculate_leg_knee_angle(
    points: Optional[list[Point]],
    leg: str = "right",
    pose_config: Union[PhaseValidityConfig, PoseValidityConfig, None] = None,
) -> Optional[float]:
    """
    Tính góc khớp gối của chân.
    Sử dụng pose_config (mặc định PhaseValidityConfig() với min_landmark_confidence=0.35).
    """
    if not points or len(points) <= KP.RIGHT_ANKLE:
        return None
    cfg = pose_config or PhaseValidityConfig()
    hip_idx = KP.LEFT_HIP if leg == "left" else KP.RIGHT_HIP
    knee_idx = KP.LEFT_KNEE if leg == "left" else KP.RIGHT_KNEE
    ank_idx = KP.LEFT_ANKLE if leg == "left" else KP.RIGHT_ANKLE
    return calculate_angle(points[hip_idx], points[knee_idx], points[ank_idx], config=cfg)


# ─── Phase Segmentation Logic ───

def segment_punch_phases(
    window_start_frame: int,
    window_end_frame: int,
    fps: float = 30.0,
    window_start_time_ms: Optional[float] = None,
    window_end_time_ms: Optional[float] = None,
    impact_frame: Optional[int] = None,
    impact_time_ms: Optional[float] = None,
    keypoints_trajectory: Optional[Sequence[Any]] = None,
    arm: str = "auto",
    anomalies: Optional[Sequence[str]] = None,
    config: Optional[TemporalPhaseConfig] = None,
) -> TemporalPhaseSequence:
    """
    Trích xuất các biên pha thời gian chuẩn hóa cho đòn đấm (Punch)
    từ quỹ đạo landmark và cửa sổ hành động.
    """
    if fps <= 0 or not math.isfinite(fps):
        raise ValueError(f"fps must be positive and finite, got {fps}")

    cfg = config or TemporalPhaseConfig()
    frame_duration_ms = 1000.0 / fps
    if window_start_time_ms is None:
        window_start_time_ms = (window_start_frame / fps) * 1000.0
    if window_end_time_ms is None:
        window_end_time_ms = (window_end_frame / fps) * 1000.0

    detected_anomalies: list[str] = list(anomalies or [])

    if window_start_frame > window_end_frame or window_start_time_ms > window_end_time_ms:
        raise ValueError(
            f"Invalid window: frame [{window_start_frame}, {window_end_frame}], "
            f"time [{window_start_time_ms}, {window_end_time_ms}]"
        )

    # 1. Phân tích arm nếu 'auto'
    selected_arm = arm
    reach_by_frame: dict[int, float] = {}
    elbow_by_frame: dict[int, float] = {}

    if keypoints_trajectory is not None and len(keypoints_trajectory) > 0:
        if selected_arm == "auto":
            r_disp = 0.0
            l_disp = 0.0
            r_reaches = []
            l_reaches = []
            for f_idx in range(window_start_frame, min(window_end_frame + 1, len(keypoints_trajectory))):
                pts = _extract_frame_points(keypoints_trajectory[f_idx])
                r_r = calculate_arm_reach(pts, arm="right", pose_config=cfg.pose_config)
                l_r = calculate_arm_reach(pts, arm="left", pose_config=cfg.pose_config)
                if r_r is not None:
                    r_reaches.append(r_r)
                if l_r is not None:
                    l_reaches.append(l_r)
            if r_reaches:
                r_disp = max(r_reaches) - min(r_reaches)
            if l_reaches:
                l_disp = max(l_reaches) - min(l_reaches)
            selected_arm = "right" if r_disp >= l_disp else "left"

        # Thu thập reach và elbow angle sử dụng pose_config từ cfg
        for f_idx in range(window_start_frame, min(window_end_frame + 1, len(keypoints_trajectory))):
            pts = _extract_frame_points(keypoints_trajectory[f_idx])
            r_val = calculate_arm_reach(pts, arm=selected_arm, pose_config=cfg.pose_config)
            e_val = calculate_arm_elbow_angle(pts, arm=selected_arm, pose_config=cfg.pose_config)
            if r_val is not None:
                reach_by_frame[f_idx] = r_val
            if e_val is not None:
                elbow_by_frame[f_idx] = e_val

    # 2. Xác định Peak Boundary (impact_type = peak_extension_proxy)
    peak_frame: Optional[int] = None
    peak_evidence: Optional[PhaseEvidence] = None

    if impact_frame is not None and window_start_frame <= impact_frame <= window_end_frame:
        peak_frame = impact_frame
        peak_evidence = PhaseEvidence(
            level=EvidenceLevel.DERIVED_PROXY,
            confidence=None,
            source_signal="detector_impact_frame",
        )
    elif reach_by_frame:
        peak_frame = max(reach_by_frame.keys(), key=lambda f: reach_by_frame[f])
        peak_evidence = PhaseEvidence(
            level=EvidenceLevel.DERIVED_PROXY,
            confidence=None,
            source_signal="trajectory_reach_peak",
        )
    elif elbow_by_frame:
        peak_frame = max(elbow_by_frame.keys(), key=lambda f: elbow_by_frame[f])
        peak_evidence = PhaseEvidence(
            level=EvidenceLevel.DERIVED_PROXY,
            confidence=None,
            source_signal="trajectory_elbow_peak",
        )
    else:
        peak_frame = None

    boundaries: dict[str, PhaseBoundary] = {}
    if peak_frame is None:
        detected_anomalies.append("missing_peak_boundary")
        boundaries["preparation"] = PhaseBoundary(
            frame_idx=window_start_frame,
            time_ms=window_start_time_ms,
            evidence=PhaseEvidence(
                level=EvidenceLevel.DERIVED_PROXY,
                confidence=None,
                source_signal="window_start_fallback",
            ),
        )
        boundaries["launch"] = PhaseBoundary.unavailable(source_signal="unresolved_launch")
        boundaries["peak"] = PhaseBoundary.unavailable(source_signal="unresolved_peak")
        boundaries["retraction"] = PhaseBoundary.unavailable(source_signal="unresolved_retraction")
        boundaries["recovery"] = PhaseBoundary(
            frame_idx=window_end_frame,
            time_ms=window_end_time_ms,
            evidence=PhaseEvidence(
                level=EvidenceLevel.DERIVED_PROXY,
                confidence=None,
                source_signal="window_end_fallback",
            ),
        )
        return TemporalPhaseSequence(
            action_family="punch",
            impact_type="peak_extension_proxy",
            fps=fps,
            window_start_frame=window_start_frame,
            window_end_frame=window_end_frame,
            window_start_time_ms=window_start_time_ms,
            window_end_time_ms=window_end_time_ms,
            boundaries=MappingProxyType(boundaries),
            anomalies=tuple(detected_anomalies),
        )

    # 3. Preparation Boundary
    prep_frame = window_start_frame
    prep_time_ms = window_start_time_ms
    boundaries["preparation"] = PhaseBoundary(
        frame_idx=prep_frame,
        time_ms=prep_time_ms,
        evidence=PhaseEvidence(
            level=EvidenceLevel.DERIVED_PROXY,
            confidence=None,
            source_signal="wrist_extension_onset",
        ),
    )

    # 4. Launch Boundary: giữa prep và peak
    launch_frame = prep_frame
    if peak_frame > prep_frame:
        best_delta = -1.0
        best_f = prep_frame + (peak_frame - prep_frame) // 2
        for f in range(prep_frame, peak_frame):
            if f in reach_by_frame and (f + 1) in reach_by_frame:
                delta = reach_by_frame[f + 1] - reach_by_frame[f]
                if delta > best_delta:
                    best_delta = delta
                    best_f = f
        launch_frame = max(prep_frame, min(best_f, peak_frame))
    else:
        launch_frame = prep_frame

    launch_time_ms = round(window_start_time_ms + (launch_frame - window_start_frame) * frame_duration_ms, 1)
    boundaries["launch"] = PhaseBoundary(
        frame_idx=launch_frame,
        time_ms=launch_time_ms,
        evidence=PhaseEvidence(
            level=EvidenceLevel.DERIVED_PROXY,
            confidence=None,
            source_signal="reach_velocity_launch",
        ),
    )

    # Peak boundary non-null
    if impact_time_ms is not None and abs(impact_time_ms - (window_start_time_ms + (peak_frame - window_start_frame) * frame_duration_ms)) <= calculate_tolerance_ms(fps):
        peak_time_ms = impact_time_ms
    else:
        peak_time_ms = round(window_start_time_ms + (peak_frame - window_start_frame) * frame_duration_ms, 1)

    boundaries["peak"] = PhaseBoundary(
        frame_idx=peak_frame,
        time_ms=peak_time_ms,
        evidence=peak_evidence or PhaseEvidence(
            level=EvidenceLevel.DERIVED_PROXY,
            confidence=None,
            source_signal="wrist_reach_peak",
        ),
    )

    # 5. Retraction Boundary: ngay sau peak khi tay bắt đầu thu về
    retract_frame = peak_frame
    if window_end_frame > peak_frame:
        found_retract = False
        # Sử dụng cfg.min_retraction_delta_deg nếu có góc khuỷu
        if elbow_by_frame and peak_frame in elbow_by_frame:
            pk_elbow = elbow_by_frame[peak_frame]
            for f in range(peak_frame + 1, window_end_frame + 1):
                if f in elbow_by_frame and elbow_by_frame[f] < pk_elbow - cfg.min_retraction_delta_deg:
                    retract_frame = f
                    found_retract = True
                    break
        if not found_retract and reach_by_frame and peak_frame in reach_by_frame:
            pk_reach = reach_by_frame[peak_frame]
            for f in range(peak_frame + 1, window_end_frame + 1):
                if f in reach_by_frame and reach_by_frame[f] < pk_reach - 0.02:
                    retract_frame = f
                    found_retract = True
                    break
        if not found_retract:
            retract_frame = peak_frame + max(1, (window_end_frame - peak_frame) // 2)

    retract_frame = max(peak_frame, min(retract_frame, window_end_frame))
    retract_time_ms = round(window_start_time_ms + (retract_frame - window_start_frame) * frame_duration_ms, 1)

    boundaries["retraction"] = PhaseBoundary(
        frame_idx=retract_frame,
        time_ms=retract_time_ms,
        evidence=PhaseEvidence(
            level=EvidenceLevel.DERIVED_PROXY,
            confidence=None,
            source_signal="wrist_retraction_onset",
        ),
    )

    # 6. Recovery Boundary: trở về thế thủ
    rec_frame = window_end_frame
    rec_time_ms = round(
        window_start_time_ms
        + (rec_frame - window_start_frame) * frame_duration_ms,
        1,
    )
    boundaries["recovery"] = PhaseBoundary(
        frame_idx=rec_frame,
        time_ms=rec_time_ms,
        evidence=PhaseEvidence(
            level=EvidenceLevel.DERIVED_PROXY,
            confidence=None,
            source_signal="guard_return_frame",
        ),
    )

    return TemporalPhaseSequence(
        action_family="punch",
        impact_type="peak_extension_proxy",
        fps=fps,
        window_start_frame=window_start_frame,
        window_end_frame=window_end_frame,
        window_start_time_ms=window_start_time_ms,
        window_end_time_ms=window_end_time_ms,
        boundaries=MappingProxyType(boundaries),
        anomalies=tuple(detected_anomalies),
    )


def segment_kick_phases(
    window_start_frame: int,
    window_end_frame: int,
    fps: float = 30.0,
    window_start_time_ms: Optional[float] = None,
    window_end_time_ms: Optional[float] = None,
    chamber_peak_frame: Optional[int] = None,
    chamber_peak_time_ms: Optional[float] = None,
    impact_frame: Optional[int] = None,
    impact_time_ms: Optional[float] = None,
    keypoints_trajectory: Optional[Sequence[Any]] = None,
    active_leg: str = "auto",
    anomalies: Optional[Sequence[str]] = None,
    config: Optional[TemporalPhaseConfig] = None,
) -> TemporalPhaseSequence:
    """
    Trích xuất các biên pha thời gian chuẩn hóa cho đòn đá (Kick)
    từ quỹ đạo landmark và cửa sổ hành động.
    """
    if fps <= 0 or not math.isfinite(fps):
        raise ValueError(f"fps must be positive and finite, got {fps}")

    cfg = config or TemporalPhaseConfig()
    frame_duration_ms = 1000.0 / fps
    if window_start_time_ms is None:
        window_start_time_ms = (window_start_frame / fps) * 1000.0
    if window_end_time_ms is None:
        window_end_time_ms = (window_end_frame / fps) * 1000.0

    detected_anomalies: list[str] = list(anomalies or [])

    if window_start_frame > window_end_frame or window_start_time_ms > window_end_time_ms:
        raise ValueError(
            f"Invalid window: frame [{window_start_frame}, {window_end_frame}], "
            f"time [{window_start_time_ms}, {window_end_time_ms}]"
        )

    # 1. Thu thập dữ liệu góc gối
    selected_leg = active_leg
    knee_by_frame: dict[int, float] = {}

    if keypoints_trajectory is not None and len(keypoints_trajectory) > 0:
        if selected_leg == "auto":
            r_angles = []
            l_angles = []
            for f_idx in range(window_start_frame, min(window_end_frame + 1, len(keypoints_trajectory))):
                pts = _extract_frame_points(keypoints_trajectory[f_idx])
                rk = calculate_leg_knee_angle(pts, leg="right", pose_config=cfg.pose_config)
                lk = calculate_leg_knee_angle(pts, leg="left", pose_config=cfg.pose_config)
                if rk is not None:
                    r_angles.append(rk)
                if lk is not None:
                    l_angles.append(lk)
            r_range = (max(r_angles) - min(r_angles)) if r_angles else 0.0
            l_range = (max(l_angles) - min(l_angles)) if l_angles else 0.0
            selected_leg = "right" if r_range >= l_range else "left"

        for f_idx in range(window_start_frame, min(window_end_frame + 1, len(keypoints_trajectory))):
            pts = _extract_frame_points(keypoints_trajectory[f_idx])
            k_val = calculate_leg_knee_angle(pts, leg=selected_leg, pose_config=cfg.pose_config)
            if k_val is not None:
                knee_by_frame[f_idx] = k_val

    # 2. Peak Boundary (impact_type = max_extension_proxy)
    peak_frame: Optional[int] = None
    peak_evidence: Optional[PhaseEvidence] = None

    if impact_frame is not None and window_start_frame <= impact_frame <= window_end_frame:
        peak_frame = impact_frame
        peak_evidence = PhaseEvidence(
            level=EvidenceLevel.DERIVED_PROXY,
            confidence=None,
            source_signal="detector_impact_frame",
        )
    elif knee_by_frame:
        peak_frame = max(knee_by_frame.keys(), key=lambda f: knee_by_frame[f])
        peak_evidence = PhaseEvidence(
            level=EvidenceLevel.DERIVED_PROXY,
            confidence=None,
            source_signal="trajectory_knee_extension_peak",
        )
    else:
        peak_frame = None

    boundaries: dict[str, PhaseBoundary] = {}
    if peak_frame is None:
        detected_anomalies.append("missing_peak_boundary")
        boundaries["preparation"] = PhaseBoundary(
            frame_idx=window_start_frame,
            time_ms=window_start_time_ms,
            evidence=PhaseEvidence(
                level=EvidenceLevel.DERIVED_PROXY,
                confidence=None,
                source_signal="window_start_fallback",
            ),
        )
        boundaries["launch"] = PhaseBoundary.unavailable(source_signal="unresolved_launch")
        boundaries["peak"] = PhaseBoundary.unavailable(source_signal="unresolved_peak")
        boundaries["retraction"] = PhaseBoundary.unavailable(source_signal="unresolved_retraction")
        boundaries["recovery"] = PhaseBoundary(
            frame_idx=window_end_frame,
            time_ms=window_end_time_ms,
            evidence=PhaseEvidence(
                level=EvidenceLevel.DERIVED_PROXY,
                confidence=None,
                source_signal="window_end_fallback",
            ),
        )
        return TemporalPhaseSequence(
            action_family="kick",
            impact_type="max_extension_proxy",
            fps=fps,
            window_start_frame=window_start_frame,
            window_end_frame=window_end_frame,
            window_start_time_ms=window_start_time_ms,
            window_end_time_ms=window_end_time_ms,
            boundaries=MappingProxyType(boundaries),
            anomalies=tuple(detected_anomalies),
        )

    # 3. Preparation Boundary
    prep_frame = window_start_frame
    prep_time_ms = window_start_time_ms
    boundaries["preparation"] = PhaseBoundary(
        frame_idx=prep_frame,
        time_ms=prep_time_ms,
        evidence=PhaseEvidence(
            level=EvidenceLevel.DERIVED_PROXY,
            confidence=None,
            source_signal="chamber_initiation",
        ),
    )

    # 4. Launch Boundary: chamber peak inflection
    launch_frame = prep_frame
    if chamber_peak_frame is not None and prep_frame <= chamber_peak_frame <= peak_frame:
        launch_frame = chamber_peak_frame
    elif knee_by_frame:
        candidate_frames = [f for f in range(prep_frame, peak_frame + 1) if f in knee_by_frame]
        if candidate_frames:
            launch_frame = min(candidate_frames, key=lambda f: knee_by_frame[f])
    else:
        launch_frame = prep_frame + (peak_frame - prep_frame) // 2

    launch_frame = max(prep_frame, min(launch_frame, peak_frame))
    launch_time_ms = round(window_start_time_ms + (launch_frame - window_start_frame) * frame_duration_ms, 1)
    boundaries["launch"] = PhaseBoundary(
        frame_idx=launch_frame,
        time_ms=launch_time_ms,
        evidence=PhaseEvidence(
            level=EvidenceLevel.DERIVED_PROXY,
            confidence=None,
            source_signal="chamber_peak_inflection",
        ),
    )

    # Peak boundary
    if impact_time_ms is not None and abs(impact_time_ms - (window_start_time_ms + (peak_frame - window_start_frame) * frame_duration_ms)) <= calculate_tolerance_ms(fps):
        peak_time_ms = impact_time_ms
    else:
        peak_time_ms = round(window_start_time_ms + (peak_frame - window_start_frame) * frame_duration_ms, 1)

    boundaries["peak"] = PhaseBoundary(
        frame_idx=peak_frame,
        time_ms=peak_time_ms,
        evidence=peak_evidence or PhaseEvidence(
            level=EvidenceLevel.DERIVED_PROXY,
            confidence=None,
            source_signal="knee_extension_peak",
        ),
    )

    # 5. Retraction Boundary: bắt đầu gập chân lại sau peak
    retract_frame = peak_frame
    if window_end_frame > peak_frame:
        found_retract = False
        if knee_by_frame and peak_frame in knee_by_frame:
            pk_angle = knee_by_frame[peak_frame]
            for f in range(peak_frame + 1, window_end_frame + 1):
                if f in knee_by_frame and knee_by_frame[f] < pk_angle - cfg.min_retraction_delta_deg:
                    retract_frame = f
                    found_retract = True
                    break
        if not found_retract:
            retract_frame = peak_frame + max(1, (window_end_frame - peak_frame) // 2)

    retract_frame = max(peak_frame, min(retract_frame, window_end_frame))
    retract_time_ms = round(window_start_time_ms + (retract_frame - window_start_frame) * frame_duration_ms, 1)

    boundaries["retraction"] = PhaseBoundary(
        frame_idx=retract_frame,
        time_ms=retract_time_ms,
        evidence=PhaseEvidence(
            level=EvidenceLevel.DERIVED_PROXY,
            confidence=None,
            source_signal="knee_flexion_onset",
        ),
    )

    # 6. Recovery Boundary
    rec_frame = window_end_frame
    rec_time_ms = round(
        window_start_time_ms
        + (rec_frame - window_start_frame) * frame_duration_ms,
        1,
    )
    boundaries["recovery"] = PhaseBoundary(
        frame_idx=rec_frame,
        time_ms=rec_time_ms,
        evidence=PhaseEvidence(
            level=EvidenceLevel.DERIVED_PROXY,
            confidence=None,
            source_signal="stance_recovery",
        ),
    )

    return TemporalPhaseSequence(
        action_family="kick",
        impact_type="max_extension_proxy",
        fps=fps,
        window_start_frame=window_start_frame,
        window_end_frame=window_end_frame,
        window_start_time_ms=window_start_time_ms,
        window_end_time_ms=window_end_time_ms,
        boundaries=MappingProxyType(boundaries),
        anomalies=tuple(detected_anomalies),
    )


def extract_temporal_phases(
    action_family: str,
    window_start_frame: int,
    window_end_frame: int,
    fps: float = 30.0,
    config: Optional[TemporalPhaseConfig] = None,
    **kwargs: Any,
) -> TemporalPhaseSequence:
    """
    Hàm entry point thống nhất để trích xuất temporal phases theo action_family.
    """
    if action_family == "punch":
        return segment_punch_phases(
            window_start_frame=window_start_frame,
            window_end_frame=window_end_frame,
            fps=fps,
            config=config,
            **kwargs,
        )
    elif action_family == "kick":
        return segment_kick_phases(
            window_start_frame=window_start_frame,
            window_end_frame=window_end_frame,
            fps=fps,
            config=config,
            **kwargs,
        )
    else:
        raise ValueError(
            f"Unsupported action_family '{action_family}'. Expected 'punch' or 'kick'."
        )


def segment_from_action_result(
    action_data: Union[dict, Any],
    fps: float = 30.0,
    keypoints_trajectory: Optional[Sequence[Any]] = None,
    config: Optional[TemporalPhaseConfig] = None,
) -> TemporalPhaseSequence:
    """
    Adapter tiện ích nhận PunchResult, KickResult hoặc dict hành động,
    tự động nhận diện action_family và phân đoạn temporal phases.
    """
    if isinstance(action_data, dict):
        d = action_data
    elif hasattr(action_data, "to_dict"):
        d = action_data.to_dict()
    else:
        d = vars(action_data)

    start_frame = d.get("start_frame", d.get("startFrame", 0))
    end_frame = d.get("end_frame", d.get("endFrame", 0))
    start_time_ms = d.get("start_time_ms", d.get("startTimeMs", None))
    end_time_ms = d.get("end_time_ms", d.get("endTimeMs", None))
    impact_frame = d.get("impact_frame", d.get("impactFrame", None))
    impact_time_ms = d.get("impact_time_ms", d.get("impactTimeMs", None))

    is_kick = (
        "punch_type" not in d
        and "punchType" not in d
        and ("min_chamber_angle" in d or "minChamberAngle" in d or d.get("action_type") == "kick" or d.get("actionType") == "kick")
    )

    if is_kick:
        chamber_peak_frame = d.get("chamber_peak_frame", d.get("chamberPeakFrame", None))
        chamber_peak_time_ms = d.get("chamber_peak_time_ms", d.get("chamberPeakTimeMs", None))
        active_leg = d.get("active_leg", d.get("activeLeg", "auto"))
        return segment_kick_phases(
            window_start_frame=start_frame,
            window_end_frame=end_frame,
            fps=fps,
            window_start_time_ms=start_time_ms,
            window_end_time_ms=end_time_ms,
            chamber_peak_frame=chamber_peak_frame,
            chamber_peak_time_ms=chamber_peak_time_ms,
            impact_frame=impact_frame,
            impact_time_ms=impact_time_ms,
            keypoints_trajectory=keypoints_trajectory,
            active_leg=active_leg,
            config=config,
        )
    else:
        arm = d.get("arm", "auto")
        anomalies = []
        if d.get("guard_dropped") or d.get("guardDropped"):
            anomalies.append("dropped_guard_anomaly")
        return segment_punch_phases(
            window_start_frame=start_frame,
            window_end_frame=end_frame,
            fps=fps,
            window_start_time_ms=start_time_ms,
            window_end_time_ms=end_time_ms,
            impact_frame=impact_frame,
            impact_time_ms=impact_time_ms,
            keypoints_trajectory=keypoints_trajectory,
            arm=arm,
            anomalies=anomalies,
            config=config,
        )
