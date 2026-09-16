"""
pipeline/analysis_context.py — MMA-TMS Analysis Context Contract & Normalization

Cung cấp mô hình ngữ cảnh phân tích nội bộ (AnalysisContext) bất biến (immutable),
có kiểm soát chặt chẽ các trường thông tin đầu vào phục vụ cho việc lựa chọn rubric,
phân loại kỹ thuật và đánh giá chuyên môn theo đặc thù môn võ (Discipline-Aware).

Tuân thủ:
- docs/MARTIAL-ARTS-AI-COACHING-SPEC-v1.md (§2.5, §3.1, §10, §17).
- MMA-TMS Master Specification v3.0.
- Task 4 Acceptance Criteria.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Any, Iterable, Optional


from rubric_primitives import (
    MartialArt,
    VALID_MARTIAL_ARTS,
    normalize_martial_art,
)


class TrainingMode(str, Enum):
    SINGLE_TECHNIQUE = "single_technique"
    COMBINATION = "combination"
    SHADOWBOXING = "shadowboxing"
    HEAVY_BAG = "heavy_bag"
    PAD_WORK = "pad_work"
    SPARRING = "sparring"
    FREE_PRACTICE = "free_practice"
    UNKNOWN = "unknown"


class CameraView(str, Enum):
    FRONT = "front"
    SIDE = "side"
    FRONT_45 = "front_45"
    SIDE_45 = "side_45"
    UNKNOWN = "unknown"


class TargetType(str, Enum):
    HEAVY_BAG = "heavy_bag"
    PAD_WORK = "pad_work"
    SHADOWBOXING = "shadowboxing"
    PARTNER = "partner"
    NONE = "none"
    UNKNOWN = "unknown"


class SkillLevel(str, Enum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"
    COMPETITOR = "competitor"
    UNKNOWN = "unknown"


VALID_TRAINING_MODES = {item.value for item in TrainingMode}
VALID_CAMERA_VIEWS = {item.value for item in CameraView}
VALID_TARGET_TYPES = {item.value for item in TargetType}
VALID_SKILL_LEVELS = {item.value for item in SkillLevel}


def normalize_training_mode(val: Optional[str]) -> Optional[str]:
    """
    Chuẩn hóa training_mode:
    - None -> None (omitted).
    - bool hoặc non-str -> TypeError / ValueError.
    - Chuỗi rỗng/whitespace -> ValueError.
    - Map alias (space/dash to underscore).
    - Invalid -> ValueError.
    """
    if val is None:
        return None
    if isinstance(val, bool) or not isinstance(val, str):
        raise TypeError(f"training_mode must be a string or None, got {type(val).__name__}.")
    s = val.strip().lower().replace(" ", "_").replace("-", "_")
    if not s:
        raise ValueError("training_mode cannot be empty or whitespace.")
    if s not in VALID_TRAINING_MODES:
        raise ValueError(
            f"Invalid training_mode '{val}'. Must be one of {sorted(VALID_TRAINING_MODES)}."
        )
    return s


def normalize_camera_view(val: Optional[str]) -> Optional[str]:
    """
    Chuẩn hóa camera_view:
    - None -> None (omitted).
    - bool hoặc non-str -> TypeError / ValueError.
    - Chuỗi rỗng/whitespace -> ValueError.
    - Map alias (vd: '45' -> 'front_45').
    - Invalid -> ValueError.
    """
    if val is None:
        return None
    if isinstance(val, bool) or not isinstance(val, str):
        raise TypeError(f"camera_view must be a string or None, got {type(val).__name__}.")
    s = val.strip().lower().replace(" ", "_").replace("-", "_")
    if not s:
        raise ValueError("camera_view cannot be empty or whitespace.")
    alias_map = {
        "45": CameraView.FRONT_45.value,
        "angle_45": CameraView.FRONT_45.value,
    }
    canonical = alias_map.get(s, s)
    if canonical not in VALID_CAMERA_VIEWS:
        raise ValueError(
            f"Invalid camera_view '{val}'. Must be one of {sorted(VALID_CAMERA_VIEWS)}."
        )
    return canonical


def normalize_target_type(val: Optional[str]) -> Optional[str]:
    """
    Chuẩn hóa target_type:
    - None -> None (omitted).
    - bool hoặc non-str -> TypeError / ValueError.
    - Chuỗi rỗng/whitespace -> ValueError.
    - Invalid -> ValueError.
    """
    if val is None:
        return None
    if isinstance(val, bool) or not isinstance(val, str):
        raise TypeError(f"target_type must be a string or None, got {type(val).__name__}.")
    s = val.strip().lower().replace(" ", "_").replace("-", "_")
    if not s:
        raise ValueError("target_type cannot be empty or whitespace.")
    if s not in VALID_TARGET_TYPES:
        raise ValueError(
            f"Invalid target_type '{val}'. Must be one of {sorted(VALID_TARGET_TYPES)}."
        )
    return s


def normalize_skill_level(val: Optional[str]) -> Optional[str]:
    """
    Chuẩn hóa skill_level:
    - None -> None (omitted).
    - bool hoặc non-str -> TypeError / ValueError.
    - Chuỗi rỗng/whitespace -> ValueError.
    - Alias: 'elite' -> 'competitor'.
    - Invalid -> ValueError.
    """
    if val is None:
        return None
    if isinstance(val, bool) or not isinstance(val, str):
        raise TypeError(f"skill_level must be a string or None, got {type(val).__name__}.")
    s = val.strip().lower().replace(" ", "_").replace("-", "_")
    if not s:
        raise ValueError("skill_level cannot be empty or whitespace.")
    alias_map = {
        "elite": SkillLevel.COMPETITOR.value,
        "pro": SkillLevel.COMPETITOR.value,
    }
    canonical = alias_map.get(s, s)
    if canonical not in VALID_SKILL_LEVELS:
        raise ValueError(
            f"Invalid skill_level '{val}'. Must be one of {sorted(VALID_SKILL_LEVELS)}."
        )
    return canonical


def normalize_expected_techniques(val: Optional[Iterable[str]]) -> tuple[str, ...]:
    """
    Chuẩn hóa danh sách kỹ thuật kỳ vọng (expected_techniques):
    - None -> tuple rỗng ().
    - Chuỗi đơn lẻ -> TypeError (phải truyền iterable như list/tuple).
    - bool -> TypeError.
    - Từng phần tử phải là chuỗi không rỗng sau strip(), chuẩn hóa lowercase.
    - Trả về tuple bất biến.
    """
    if val is None:
        return ()
    if isinstance(val, (str, bool)) or not hasattr(val, "__iter__"):
        raise TypeError(
            f"expected_techniques must be an iterable of strings (e.g. list, tuple), got {type(val).__name__}."
        )

    norm_items = []
    for item in val:
        if isinstance(item, bool) or not isinstance(item, str):
            raise TypeError(
                f"expected_techniques elements must be strings, got {type(item).__name__}."
            )
        clean = item.strip().lower().replace(" ", "_").replace("-", "_")
        if not clean:
            raise ValueError("expected_techniques elements cannot be empty or whitespace.")
        norm_items.append(clean)
    return tuple(norm_items)


def normalize_requested_rubric_version(val: Optional[str]) -> Optional[str]:
    """
    Chuẩn hóa requested_rubric_version:
    - None -> None (omitted).
    - bool hoặc non-str -> TypeError / ValueError.
    - Chuỗi rỗng/whitespace -> ValueError.
    """
    if val is None:
        return None
    if isinstance(val, bool) or not isinstance(val, str):
        raise TypeError(
            f"requested_rubric_version must be a string or None, got {type(val).__name__}."
        )
    s = val.strip()
    if not s:
        raise ValueError("requested_rubric_version cannot be empty or whitespace.")
    return s


@dataclass(frozen=True)
class AnalysisContext:
    """
    Ngữ cảnh phân tích võ thuật nội bộ (AnalysisContext).
    Hoàn toàn bất biến (immutable / frozen=True).

    Các trường hỗ trợ:
    - martial_art: Môn võ ('boxing', 'muay_thai', 'karate', 'taekwondo', 'generic', 'unknown', v.v.)
    - training_mode: Chế độ tập ('single_technique', 'combination', 'heavy_bag', 'shadowboxing', v.v.)
    - expected_techniques: Tuple các kỹ thuật dự kiến xuất hiện (bất biến)
    - camera_view: Góc máy quay ('front', 'side', 'front_45', 'side_45', 'unknown')
    - target_type: Loại đích đánh ('heavy_bag', 'pad_work', 'shadowboxing', 'partner', 'none', 'unknown')
    - skill_level: Trình độ võ sĩ ('beginner', 'intermediate', 'advanced', 'competitor', 'unknown')
    - requested_rubric_version: Phiên bản rubric yêu cầu cụ thể (nếu có)
    """
    martial_art: Optional[str] = None
    training_mode: Optional[str] = None
    expected_techniques: tuple[str, ...] = ()
    camera_view: Optional[str] = None
    target_type: Optional[str] = None
    skill_level: Optional[str] = None
    requested_rubric_version: Optional[str] = None

    def __init__(
        self,
        martial_art: Optional[str] = None,
        training_mode: Optional[str] = None,
        expected_techniques: Optional[Iterable[str]] = None,
        camera_view: Optional[str] = None,
        target_type: Optional[str] = None,
        skill_level: Optional[str] = None,
        requested_rubric_version: Optional[str] = None,
    ) -> None:
        norm_ma = normalize_martial_art(martial_art)
        norm_tm = normalize_training_mode(training_mode)
        norm_et = normalize_expected_techniques(expected_techniques)
        norm_cv = normalize_camera_view(camera_view)
        norm_tt = normalize_target_type(target_type)
        norm_sl = normalize_skill_level(skill_level)
        norm_ver = normalize_requested_rubric_version(requested_rubric_version)

        # Cross-field invariant: Nếu training_mode là 'single_technique',
        # danh sách expected_techniques không được chứa nhiều hơn 1 kỹ thuật.
        if norm_tm == TrainingMode.SINGLE_TECHNIQUE.value and len(norm_et) > 1:
            raise ValueError(
                f"training_mode 'single_technique' cannot specify multiple expected_techniques: {norm_et}."
            )

        object.__setattr__(self, "martial_art", norm_ma)
        object.__setattr__(self, "training_mode", norm_tm)
        object.__setattr__(self, "expected_techniques", norm_et)
        object.__setattr__(self, "camera_view", norm_cv)
        object.__setattr__(self, "target_type", norm_tt)
        object.__setattr__(self, "skill_level", norm_sl)
        object.__setattr__(self, "requested_rubric_version", norm_ver)

    def is_discipline_aware(self) -> bool:
        """Kiểm tra context có định danh môn võ cụ thể hợp lệ hay không (khác None và unknown)."""
        return bool(
            self.martial_art
            and self.martial_art not in (MartialArt.UNKNOWN.value, MartialArt.GENERIC.value)
        )

    def to_dict(self) -> dict[str, Any]:
        """Biểu diễn dict nội bộ (phục vụ log/audit, KHÔNG xuất ra public contract v1.0.0)."""
        return {
            "martialArt": self.martial_art,
            "trainingMode": self.training_mode,
            "expectedTechniques": list(self.expected_techniques),
            "cameraView": self.camera_view,
            "targetType": self.target_type,
            "skillLevel": self.skill_level,
            "requestedRubricVersion": self.requested_rubric_version,
        }

