"""
contracts.py — Data Contracts Cho Pipeline Tách Tầng (Task 2)

Khai báo các dataclass trung gian thuần túy:
- PoseObservation: dữ liệu skeleton từ YOLO/Tracker ở frame hiện tại.
- FrameContext: metadata thời gian và kích thước video.
- UpperBodyFrameFeatures: góc khuỷu, các khớp tay và cờ fallback hiển thị.
- LowerBodyFrameFeatures: góc gối, hông, cổ chân, tư thế và tính hợp lệ hình học.
- FrameAnalysisResult: kết quả phân tích frame có adapter tạo legacy dict.

Nguyên tắc:
- Field nullable khi thiếu evidence.
- Không chứa logic threshold.
- Không phụ thuộc frontend.
"""

from dataclasses import dataclass, field
from enum import Enum
import math
from types import MappingProxyType
from typing import Optional, Any, Mapping, Sequence

from pose_math import Point, get_angle_color_label


def deep_freeze(obj: Any) -> Any:
    """
    Freeze data structures recursively into immutable types:
    - Mapping -> MappingProxyType (mapping keys must be strings)
    - list / tuple -> tuple
    - set / frozenset -> raises TypeError ('are rejected from analysis payloads; use tuple')
    - float -> must be finite (NaN/inf raises ValueError)
    - bytes -> raises TypeError
    """
    if isinstance(obj, (set, frozenset)):
        raise TypeError(f"{type(obj).__name__} are rejected from analysis payloads; use tuple")
    if isinstance(obj, bytes):
        raise TypeError(f"bytes are rejected from analysis payloads: {obj!r}")
    if isinstance(obj, float):
        if not math.isfinite(obj):
            raise ValueError(f"Float value must be finite, got {obj}")
        return obj
    if isinstance(obj, (int, str, bool)) or obj is None or isinstance(obj, Enum):
        return obj
    if hasattr(obj, "to_dict") and callable(getattr(obj, "to_dict")):
        obj = obj.to_dict()
    if isinstance(obj, Mapping):
        frozen_dict = {}
        for k, v in obj.items():
            if not isinstance(k, str):
                raise TypeError(f"Mapping keys must be strings, got {type(k).__name__}")
            frozen_dict[k] = deep_freeze(v)
        return MappingProxyType(frozen_dict)
    if isinstance(obj, (list, tuple)):
        return tuple(deep_freeze(item) for item in obj)
    return obj


def to_json_safe(obj: Any) -> Any:
    """
    Convert data structures recursively to JSON-safe primitives:
    - Mapping / MappingProxyType -> fresh dict
    - tuple / list -> fresh list
    - Enum -> enum.value
    - float NaN / inf -> None
    - bytes -> raises TypeError
    """
    if isinstance(obj, bytes):
        raise TypeError("bytes cannot be converted to json-safe primitive")
    if isinstance(obj, float):
        if not math.isfinite(obj):
            return None
        return obj
    if isinstance(obj, (int, str, bool)) or obj is None:
        return obj
    if isinstance(obj, Enum):
        return obj.value
    if isinstance(obj, Mapping):
        return {str(k): to_json_safe(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple, set, frozenset)):
        return [to_json_safe(item) for item in obj]
    if hasattr(obj, "to_dict") and callable(getattr(obj, "to_dict")):
        return to_json_safe(obj.to_dict())
    return obj


LEGACY_ELBOW_DISPLAY_FALLBACK_DEG: float = 75.0


class ObservationKind(str, Enum):
    FRESH_DETECTION = "fresh_detection"
    CACHED_BETWEEN_DETECTION = "cached_between_detection"
    MISSING_DETECTION = "missing_detection"


class EvidenceLevel(str, Enum):
    OBSERVED = "observed"
    DERIVED_PROXY = "derived_proxy"
    UNAVAILABLE = "unavailable"


class ValidationStatus(str, Enum):
    VALIDATED = "VALIDATED"
    NOT_VALIDATED = "NOT_VALIDATED"
    SHADOW_NOT_VALIDATED = "SHADOW_NOT_VALIDATED"
    REJECTED = "REJECTED"
    NOT_EVALUABLE = "NOT_EVALUABLE"


class QualityStatus(str, Enum):
    EXCELLENT = "EXCELLENT"
    GOOD = "GOOD"
    ACCEPTABLE = "ACCEPTABLE"
    DEGRADED = "DEGRADED"
    BLOCKED = "BLOCKED"


class CalibrationStatus(str, Enum):
    CALIBRATED = "CALIBRATED"
    NOT_CALIBRATED = "NOT_CALIBRATED"
    HEURISTIC_ONLY = "HEURISTIC_ONLY"


class SequenceCandidateType(str, Enum):
    SINGLE = "SINGLE"
    REPEATED_STRIKE = "REPEATED_STRIKE"
    TWO_ACTION_COMBINATION = "TWO_ACTION_COMBINATION"
    MULTI_ACTION_COMBINATION = "MULTI_ACTION_COMBINATION"
    UNKNOWN = "UNKNOWN"


class ShadowEventFamily(str, Enum):
    ELBOW = "ELBOW"
    KNEE = "KNEE"
    TAKEDOWN = "TAKEDOWN"
    CLINCH = "CLINCH"


class ShadowGrapplingState(str, Enum):
    APPROACH = "APPROACH"
    LEVEL_CHANGE = "LEVEL_CHANGE"
    CONTACT_TRANSITION = "CONTACT_TRANSITION"
    CLINCH_LIKE = "CLINCH_LIKE"
    TAKEDOWN_LIKE = "TAKEDOWN_LIKE"
    UNKNOWN = "UNKNOWN"


class ActiveLearningReason(str, Enum):
    LOW_CONFIDENCE = "LOW_CONFIDENCE"
    MODEL_DISAGREEMENT = "MODEL_DISAGREEMENT"
    NOVELTY_OUTLIER = "NOVELTY_OUTLIER"
    UNDERREPRESENTED_SLICE = "UNDERREPRESENTED_SLICE"
    BOUNDARY_UNCERTAINTY = "BOUNDARY_UNCERTAINTY"


class BaselineEligibilityStatus(str, Enum):
    ELIGIBLE = "ELIGIBLE"
    INSUFFICIENT_SESSIONS = "INSUFFICIENT_SESSIONS"
    INSUFFICIENT_REFERENCES = "INSUFFICIENT_REFERENCES"
    POOR_QUALITY = "POOR_QUALITY"
    INCONSISTENT_TECHNIQUE = "INCONSISTENT_TECHNIQUE"
    INCOMPATIBLE_STANCE = "INCOMPATIBLE_STANCE"
    INCOMPATIBLE_CAMERA = "INCOMPATIBLE_CAMERA"
    INCOMPATIBLE_RUBRIC = "INCOMPATIBLE_RUBRIC"
    LEAKAGE_DETECTED = "LEAKAGE_DETECTED"
    STALE = "STALE"
    NOT_APPLICABLE = "NOT_APPLICABLE"


class ComparisonStatus(str, Enum):
    COMPATIBLE = "COMPATIBLE"
    INCOMPATIBLE_CAMERA = "INCOMPATIBLE_CAMERA"
    INCOMPATIBLE_STANCE = "INCOMPATIBLE_STANCE"
    INSUFFICIENT_QUALITY = "INSUFFICIENT_QUALITY"
    UNKNOWN_MISMATCH = "UNKNOWN_MISMATCH"


class AlignmentStatus(str, Enum):
    ALIGNED = "ALIGNED"
    CAMERA_MISMATCH = "CAMERA_MISMATCH"
    QUALITY_BLOCKED = "QUALITY_BLOCKED"
    PHASE_MISMATCH = "PHASE_MISMATCH"
    UNSTABLE_ALIGNMENT = "UNSTABLE_ALIGNMENT"
    STANCE_MISMATCH = "STANCE_MISMATCH"
    TECHNIQUE_MISMATCH = "TECHNIQUE_MISMATCH"
    TIMEBASE_MISMATCH = "TIMEBASE_MISMATCH"
    SCHEMA_MISMATCH = "SCHEMA_MISMATCH"


@dataclass
class PoseObservation:
    """
    Quan sát tư thế tại một frame nhất định sau khi tracking/cache đã quyết định keypoints.
    """
    keypoints: Optional[list[Point]] = None
    observation_kind: ObservationKind = ObservationKind.FRESH_DETECTION
    is_discontinuous: bool = False
    confidence: Optional[float] = None


@dataclass
class FrameContext:
    """Ngữ cảnh thời gian và metadata của frame."""
    frame_idx: int
    time_ms: float
    fps: float = 30.0
    img_w: int = 1080
    img_h: int = 1920


@dataclass
class UpperBodyFrameFeatures:
    """
    Đặc trưng thân trên theo frame.
    Lưu ý: left_elbow_angle và right_elbow_angle ở Task 2 dùng cho hiển thị legacy frame record.
    Cờ is_left_fallback và is_right_fallback chỉ rõ góc là đo lường thực tế hay fallback 75.0 độ.
    """
    left_elbow_angle: Optional[float] = None
    right_elbow_angle: Optional[float] = None
    is_left_fallback: bool = False
    is_right_fallback: bool = False
    left_shoulder: Optional[Point] = None
    right_shoulder: Optional[Point] = None
    left_elbow: Optional[Point] = None
    right_elbow: Optional[Point] = None
    left_wrist: Optional[Point] = None
    right_wrist: Optional[Point] = None
    left_arm_valid: bool = False
    right_arm_valid: bool = False


@dataclass
class LowerBodyFrameFeatures:
    """Đặc trưng thân dưới và validity gating theo frame."""
    active_leg: str = "none"  # "left" | "right" | "none"
    knee_angle: Optional[float] = None
    hip_angle: Optional[float] = None
    active_ankle: Optional[Point] = None
    landmarks_valid: bool = False
    geometry_valid: bool = False
    rejection_reason: str = "NONE"
    posture: str = "standing"  # "standing" | "crouched" | "ground"
    left_hip_conf: float = 0.0
    left_knee_conf: float = 0.0
    left_ankle_conf: float = 0.0
    right_hip_conf: float = 0.0
    right_knee_conf: float = 0.0
    right_ankle_conf: float = 0.0


@dataclass
class FrameAnalysisResult:
    """
    Kết quả phân tích một frame do ActionPipeline trả về.
    Tách biệt với naming của frontend JSON, cung cấp to_legacy_dict() để chuyển đổi an toàn.
    """
    frame_idx: int
    time_ms: float
    observation_kind: ObservationKind
    is_discontinuous: bool
    filtered_keypoints: list[Point] = field(default_factory=list)
    upper_body: Optional[UpperBodyFrameFeatures] = None
    lower_body: Optional[LowerBodyFrameFeatures] = None
    punch_state: str = "guard"
    punch_state_label: str = "Thế thủ (Guard)"
    active_arm: str = "none"
    kick_state: str = "idle"
    kick_state_label: str = "Chờ (Idle)"
    kick_previous_state: str = "idle"
    kick_transition_reason: str = "NONE"
    kick_rejection_reason: str = "NONE"
    speed: float = 0.0

    def to_legacy_dict(self) -> dict[str, Any]:
        """
        Chuyển đổi sang dict tương thích 100% cấu trúc frame_records của process_video.py.
        """
        # Nhánh không có detection (missing detection)
        if not self.filtered_keypoints:
            return {
                "frameIdx":             self.frame_idx,
                "timeMs":               round(self.time_ms, 1),
                "activeLeg":            "none",
                "kneeAngle":            None,
                "hipAngle":             None,
                "elbowAngleLeft":       None,
                "elbowAngleRight":      None,
                "activeArm":            "none",
                "punchState":           self.punch_state,
                "punchStateLabel":      self.punch_state_label,
                "speed":                0,
                "kickState":            self.kick_state,
                "kickStateLabel":       self.kick_state_label,
                "kickPreviousState":    self.kick_previous_state,
                "kickTransitionReason": self.kick_transition_reason,
                "kickRejectionReason":  self.kick_rejection_reason,
                "landmarksValid":       False,
                "geometryValid":        False,
                "leftHipConf":          0.0,
                "leftKneeConf":         0.0,
                "leftAnkleConf":        0.0,
                "rightHipConf":         0.0,
                "rightKneeConf":        0.0,
                "rightAnkleConf":       0.0,
                "angleColorLabel":      "none",
                "landmarks":            [],
            }

        # Nhánh có detection hợp lệ
        lower = self.lower_body
        upper = self.upper_body
        knee_angle = lower.knee_angle if lower else None
        hip_angle = lower.hip_angle if lower else None
        l_elbow_angle = upper.left_elbow_angle if upper else None
        r_elbow_angle = upper.right_elbow_angle if upper else None

        return {
            "frameIdx":             self.frame_idx,
            "timeMs":               round(self.time_ms, 1),
            "isDiscontinuous":      self.is_discontinuous,
            "activeLeg":            lower.active_leg if lower else "none",
            "kneeAngle":            round(knee_angle, 1) if knee_angle is not None else None,
            "hipAngle":             round(hip_angle, 1) if hip_angle is not None else None,
            "elbowAngleLeft":       round(l_elbow_angle, 1) if l_elbow_angle is not None else None,
            "elbowAngleRight":      round(r_elbow_angle, 1) if r_elbow_angle is not None else None,
            "activeArm":            self.active_arm,
            "punchState":           self.punch_state,
            "punchStateLabel":      self.punch_state_label,
            "kickState":            self.kick_state,
            "kickStateLabel":       self.kick_state_label,
            "kickPreviousState":    self.kick_previous_state,
            "kickTransitionReason": self.kick_transition_reason,
            "kickRejectionReason":  self.kick_rejection_reason,
            "landmarksValid":       lower.landmarks_valid if lower else False,
            "geometryValid":        lower.geometry_valid if lower else False,
            "leftHipConf":          lower.left_hip_conf if lower else 0.0,
            "leftKneeConf":         lower.left_knee_conf if lower else 0.0,
            "leftAnkleConf":        lower.left_ankle_conf if lower else 0.0,
            "rightHipConf":         lower.right_hip_conf if lower else 0.0,
            "rightKneeConf":        lower.right_knee_conf if lower else 0.0,
            "rightAnkleConf":       lower.right_ankle_conf if lower else 0.0,
            "angleColorLabel":      get_angle_color_label(knee_angle) if lower else "none",
            "landmarks": [
                {"x": round(p.x, 4), "y": round(p.y, 4), "conf": round(p.conf, 3)}
                for p in self.filtered_keypoints
            ],
        }


def _check_finite_number(val: Any, name: str) -> None:
    """Helper to reject NaN and Infinity."""
    if isinstance(val, float):
        if not math.isfinite(val):
            raise ValueError(f"Field '{name}' must be finite, got {val}")


def validate_contract_payload(payload: Mapping[str, Any]) -> dict[str, Any]:
    """
    Validates that an analysis payload strictly conforms to the MMA-TMS contract:
    - Finite numbers only (strictly rejects NaN and Infinity)
    - Closed enum sets for action family, sides, stance, and statuses
    - Legacy punch/kick array consistency with actions
    """
    if not isinstance(payload, Mapping):
        raise TypeError(f"Payload must be a mapping, got {type(payload).__name__}")

    # Recursive check for NaN / Inf
    def _scan_finite(obj: Any, path: str = "root") -> None:
        if isinstance(obj, float):
            if not math.isfinite(obj):
                raise ValueError(f"Non-finite float found at {path}: {obj}")
        elif isinstance(obj, Mapping):
            for k, v in obj.items():
                _scan_finite(v, f"{path}.{k}")
        elif isinstance(obj, (list, tuple)):
            for idx, item in enumerate(obj):
                _scan_finite(item, f"{path}[{idx}]")

    _scan_finite(payload)

    # Validate meta if present
    if "meta" in payload:
        meta = payload["meta"]
        if not isinstance(meta, Mapping):
            raise TypeError("meta must be a mapping")
        for num_field in ("fps", "totalFrames", "durationMs"):
            if num_field in meta:
                val = meta[num_field]
                if not isinstance(val, (int, float)) or isinstance(val, bool) or val < 0:
                    raise ValueError(f"meta.{num_field} must be a non-negative number")

    # Validate actions if present
    actions = payload.get("actions")
    if actions is not None:
        if not isinstance(actions, Sequence) or isinstance(actions, (str, bytes)):
            raise TypeError("actions must be a list/sequence")

        valid_families = {"punch", "kick", "other_strike", "non_strike"}
        valid_sides = {"left", "right", "unknown"}
        valid_limb_roles = {"lead", "rear", "unknown"}
        valid_stances = {"orthodox", "southpaw", "switch", "unknown"}
        valid_assessment_statuses = {"excellent", "good", "fair", "needs_improvement", "insufficient_evidence"}

        for idx, act in enumerate(actions):
            if not isinstance(act, Mapping):
                raise TypeError(f"actions[{idx}] must be a mapping")
            act_id = act.get("id")
            if not act_id or not isinstance(act_id, str):
                raise ValueError(f"actions[{idx}].id must be a non-empty string")

            fam = act.get("family")
            if fam not in valid_families:
                raise ValueError(f"actions[{idx}].family '{fam}' not in {valid_families}")

            side = act.get("attackingSide")
            if side not in valid_sides:
                raise ValueError(f"actions[{idx}].attackingSide '{side}' not in {valid_sides}")

            limb = act.get("limbRole")
            if limb not in valid_limb_roles:
                raise ValueError(f"actions[{idx}].limbRole '{limb}' not in {valid_limb_roles}")

            st = act.get("stance")
            if st not in valid_stances:
                raise ValueError(f"actions[{idx}].stance '{st}' not in {valid_stances}")

            # Validate phases
            phases = act.get("phases")
            if not isinstance(phases, Mapping):
                raise TypeError(f"actions[{idx}].phases must be a mapping")

            # Validate assessment
            ass = act.get("assessment")
            if isinstance(ass, Mapping):
                st_val = ass.get("status")
                if st_val and st_val not in valid_assessment_statuses:
                    raise ValueError(f"actions[{idx}].assessment.status '{st_val}' not in {valid_assessment_statuses}")

    # Legacy parity checks: punches & kicks vs actions
    punches = payload.get("punches")
    kicks = payload.get("kicks")
    if actions is not None:
        action_punches = [a for a in actions if a.get("family") == "punch"]
        action_kicks = [a for a in actions if a.get("family") == "kick"]

        if punches is not None and isinstance(punches, Sequence) and not isinstance(punches, (str, bytes)):
            if len(punches) != len(action_punches):
                raise ValueError(
                    f"Legacy punches count ({len(punches)}) does not match actions punch count ({len(action_punches)})"
                )
            for p_idx, (p_item, a_item) in enumerate(zip(punches, action_punches)):
                p_score = p_item.get("score")
                a_score = a_item.get("assessment", {}).get("score")
                if p_score != a_score:
                    raise ValueError(
                        f"Punch score mismatch at index {p_idx}: legacy={p_score}, action={a_score}"
                    )

        if kicks is not None and isinstance(kicks, Sequence) and not isinstance(kicks, (str, bytes)):
            if len(kicks) != len(action_kicks):
                raise ValueError(
                    f"Legacy kicks count ({len(kicks)}) does not match actions kick count ({len(action_kicks)})"
                )
            for k_idx, (k_item, a_item) in enumerate(zip(kicks, action_kicks)):
                k_score = k_item.get("score")
                a_score = a_item.get("assessment", {}).get("score")
                if k_score != a_score:
                    raise ValueError(
                        f"Kick score mismatch at index {k_idx}: legacy={k_score}, action={a_score}"
                    )

    return to_json_safe(payload)
