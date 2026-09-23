"""
pipeline/assessment_engine.py — MMA-TMS Assessment Engine & Rubric Provenance Architecture

Tuân thủ nghiêm ngặt:
- MMA-TMS Master Specification v3.0 (Mục 05.5, 08, 09.5, 10, 13.2).
- Task 5 Canonical Contract Pack (Contract Gate 1 Approved).
- Nguyên tắc bất biến (Deep Immutability) và Zero Input Mutation.
- Deterministic Provenance: Tuyệt đối không chứa timestamp trong hash/equality.
- Evidence Gating: Khi thiếu bằng chứng, score=None, grade='NO_DATA',
  status=AssessmentStatus.INSUFFICIENT_EVIDENCE, assessment_confidence=None.
- Boundary adapters sử dụng isinstance an toàn.
- Không import cv2, torch, ultralytics.
"""

from __future__ import annotations

import copy
from dataclasses import dataclass, field
from enum import Enum
import math
from types import MappingProxyType
from typing import Any, Iterable, Mapping, Optional, Protocol, Sequence, runtime_checkable

from rubric_primitives import (
    MartialArt,
    VALID_MARTIAL_ARTS,
    SemVer,
    parse_semver,
)
from pipeline.analysis_context import AnalysisContext
from pipeline.rubric_registry import (
    RubricRegistry,
    RubricSelectionResult,
    RubricSelectionStatus,
    create_default_rubric_registry,
    get_default_rubric_registry,
)
from technique_rubric import (
    CriterionResult,
    CriterionStatus,
    TechniqueCriterion,
    TechniqueFinding,
    TechniqueRubric,
    RUBRIC_PUNCH_V3,
    RUBRIC_ROUND_KICK_V3,
    calculate_technique_score,
)


# ─────────────────────────────────────────────────────────────────────────────
# 0. Structural Metric Protocols
# ─────────────────────────────────────────────────────────────────────────────

@runtime_checkable
class MetricItemLike(Protocol):
    """
    Protocol/Interface đại diện cho bất kỳ đối tượng metric nào có các thuộc tính:
    value, unit, confidence (ví dụ: ActionMetricItem, KinematicMetricContract, v.v.).
    Đảm bảo tính trung lập về dependency, không phụ thuộc cứng vào action_result.py.
    """
    value: Any
    unit: str
    confidence: Optional[float]


# ─────────────────────────────────────────────────────────────────────────────
# 1. Enums & Domain Errors
# ─────────────────────────────────────────────────────────────────────────────

class AssessmentStatus(str, Enum):
    EXCELLENT = "excellent"
    GOOD = "good"
    FAIR = "fair"
    NEEDS_IMPROVEMENT = "needs_improvement"
    INSUFFICIENT_EVIDENCE = "insufficient_evidence"


class AssessmentError(Exception):
    """Lỗi cơ sở của Assessment Engine."""
    pass


class EvaluatorResolutionError(AssessmentError):
    """Lỗi phát sinh khi không thể resolve evaluator hoặc rubric phù hợp."""
    def __init__(self, message: str, selection_result: Optional[RubricSelectionResult] = None) -> None:
        super().__init__(message)
        self.selection_result = selection_result


class RubricResolutionError(AssessmentError):
    """Lỗi phát sinh khi việc lựa chọn rubric tại assessment boundary thất bại."""
    def __init__(self, message: str, selection_result: Optional[RubricSelectionResult] = None) -> None:
        super().__init__(message)
        self.selection_result = selection_result


# ─────────────────────────────────────────────────────────────────────────────
# 2. Canonical Contracts
# ─────────────────────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class AssessmentMetricItem:
    """
    Định lượng một đặc trưng cơ sinh học cho Assessment (Bất biến / Frozen).
    Đơn vị chuẩn hóa:
      - 'degree': Góc đo (độ)
      - 'normalized_image/s': Vận tốc chuẩn hóa theo ảnh (tuyệt đối không dùng m/s khi chưa calibrate vật lý)
      - 'ms': Thời lượng / mốc thời gian
      - 'flag': Cờ boolean
      - 'ratio': Tỷ lệ
    Giá trị `value` chỉ được phép là scalar: int, float, str, bool, hoặc None khi thiếu bằng chứng.
    Tuyệt đối từ chối NaN, Infinity, danh sách (list), dict, hoặc các object phức tạp.
    """
    value: int | float | str | bool | None = None
    unit: str = "degree"
    confidence: Optional[float] = None

    def __post_init__(self) -> None:
        if isinstance(self.unit, bool) or not isinstance(self.unit, str):
            raise TypeError(f"AssessmentMetricItem.unit must be a string, got {type(self.unit).__name__}.")
        if not self.unit.strip():
            raise ValueError("AssessmentMetricItem.unit cannot be empty.")
        if self.confidence is not None:
            if isinstance(self.confidence, bool) or not isinstance(self.confidence, (int, float)):
                raise TypeError(f"AssessmentMetricItem.confidence must be float or None, got {type(self.confidence).__name__}.")
            if math.isnan(self.confidence) or math.isinf(self.confidence) or not (0.0 <= self.confidence <= 1.0):
                raise ValueError(f"AssessmentMetricItem.confidence must be in [0.0, 1.0], got {self.confidence}.")
        if self.value is not None:
            if isinstance(self.value, bool):
                pass
            elif isinstance(self.value, (int, float)):
                if isinstance(self.value, float) and (math.isnan(self.value) or math.isinf(self.value)):
                    raise ValueError(f"AssessmentMetricItem.value cannot be NaN or Infinity, got {self.value}.")
            elif isinstance(self.value, str):
                pass
            else:
                raise TypeError(f"AssessmentMetricItem.value must be int, float, str, bool, or None, got {type(self.value).__name__}.")

    def to_dict(self) -> dict[str, Any]:
        val = self.value
        if isinstance(val, float) and not isinstance(val, bool):
            val = round(val, 3)
        return {
            "value": val,
            "unit": self.unit,
            "confidence": round(self.confidence, 2) if self.confidence is not None else None,
        }


def to_assessment_metric(
    item: Any,
    default_unit: str = "degree",
    confidence: Optional[float] = None,
) -> AssessmentMetricItem:
    """
    Adapter boundary function an toàn sử dụng isinstance để chuyển đổi
    các nguồn metric đa dạng sang AssessmentMetricItem bất biến.
    """
    if isinstance(item, AssessmentMetricItem):
        if confidence is not None and item.confidence is None:
            return AssessmentMetricItem(value=item.value, unit=item.unit, confidence=confidence)
        return item

    if isinstance(item, MetricItemLike) and not isinstance(item, (type, Mapping)):
        c = confidence if confidence is not None else item.confidence
        return AssessmentMetricItem(value=item.value, unit=item.unit, confidence=c)

    if item is None:
        return AssessmentMetricItem(value=None, unit=default_unit, confidence=None)

    if isinstance(item, (int, float, bool, str)):
        return AssessmentMetricItem(value=item, unit=default_unit, confidence=confidence)

    if isinstance(item, Mapping):
        val = item.get("value")
        u = item.get("unit", default_unit)
        c = item.get("confidence", confidence)
        return AssessmentMetricItem(value=val, unit=u, confidence=c)

    raise TypeError(f"Cannot convert unsupported type '{type(item).__name__}' to AssessmentMetricItem.")


@dataclass(frozen=True)
class AssessmentProvenance:
    """
    Truy vết nguồn gốc đánh giá chuyên môn (Assessment Provenance).
    Bất biến (frozen=True) và có tính xác định tuyệt đối (deterministic):
      - evaluator_id: Định danh của evaluator thực tế đã đánh giá
      - evaluator_version: Strict SemVer của evaluator
      - rubric_id: Định danh của rubric được sử dụng
      - rubric_version: Strict SemVer của rubric
      - rubric_status: Trạng thái rubric ('VALIDATED', 'DRAFT', 'DEPRECATED')
      - evidence_keys_used: Tuple các khóa bằng chứng / tiêu chí được sử dụng
      - is_discipline_specific: Cờ chỉ rõ đây là đánh giá theo môn võ cụ thể hay generic
    Tuyệt đối KHÔNG chứa evaluation_timestamp trong equality/hash để đảm bảo tính tất định.
    """
    evaluator_id: str
    evaluator_version: str
    rubric_id: str
    rubric_version: str
    rubric_status: str
    evidence_keys_used: tuple[str, ...] = ()
    is_discipline_specific: bool = False

    def __init__(
        self,
        evaluator_id: str,
        evaluator_version: str,
        rubric_id: str,
        rubric_version: str,
        rubric_status: str,
        evidence_keys_used: Iterable[str] = (),
        is_discipline_specific: bool = False,
    ) -> None:
        if isinstance(evaluator_id, bool) or not isinstance(evaluator_id, str) or not evaluator_id.strip():
            raise ValueError("evaluator_id must be a non-empty string.")
        if isinstance(evaluator_version, bool) or not isinstance(evaluator_version, str) or not evaluator_version.strip():
            raise ValueError("evaluator_version must be a non-empty string.")
        parse_semver(evaluator_version.strip())

        if isinstance(rubric_id, bool) or not isinstance(rubric_id, str) or not rubric_id.strip():
            raise ValueError("rubric_id must be a non-empty string.")
        if isinstance(rubric_version, bool) or not isinstance(rubric_version, str) or not rubric_version.strip():
            raise ValueError("rubric_version must be a non-empty string.")
        parse_semver(rubric_version.strip())

        if isinstance(rubric_status, bool) or not isinstance(rubric_status, str) or not rubric_status.strip():
            raise ValueError("rubric_status must be a non-empty string.")
        if not isinstance(is_discipline_specific, bool):
            raise TypeError("is_discipline_specific must be a strict boolean.")

        if isinstance(evidence_keys_used, (str, bool)) or not hasattr(evidence_keys_used, "__iter__"):
            raise TypeError("evidence_keys_used must be an iterable of strings.")
        keys_tuple = tuple(str(k).strip() for k in evidence_keys_used if str(k).strip())

        object.__setattr__(self, "evaluator_id", evaluator_id.strip())
        object.__setattr__(self, "evaluator_version", evaluator_version.strip())
        object.__setattr__(self, "rubric_id", rubric_id.strip())
        object.__setattr__(self, "rubric_version", rubric_version.strip())
        object.__setattr__(self, "rubric_status", rubric_status.strip())
        object.__setattr__(self, "evidence_keys_used", keys_tuple)
        object.__setattr__(self, "is_discipline_specific", is_discipline_specific)

    def to_dict(self) -> dict[str, Any]:
        return {
            "evaluatorId": self.evaluator_id,
            "evaluatorVersion": self.evaluator_version,
            "rubricId": self.rubric_id,
            "rubricVersion": self.rubric_version,
            "rubricStatus": self.rubric_status,
            "evidenceKeysUsed": list(self.evidence_keys_used),
            "isDisciplineSpecific": self.is_discipline_specific,
        }


def deep_freeze(obj: Any) -> Any:
    """
    Đóng băng sâu đệ quy bất kỳ cấu trúc dữ liệu nào:
    - Nếu đối tượng có phương thức to_dict(), chuyển thành dict rồi freeze đệ quy.
    - Mapping (dict, MappingProxyType, ...) -> MappingProxyType với tất cả keys/values được deep_freeze.
    - Iterable sequence (list, tuple, set, frozenset) -> tuple với tất cả phần tử được deep_freeze.
    - Chuỗi (str, bytes) -> giữ nguyên.
    - Scalar (int, float, str, bool, None, enums) -> giữ nguyên.
    """
    if hasattr(obj, "to_dict") and callable(getattr(obj, "to_dict")):
        obj = obj.to_dict()

    if isinstance(obj, Mapping):
        return MappingProxyType({k: deep_freeze(v) for k, v in obj.items()})
    elif isinstance(obj, (list, tuple, set, frozenset)):
        return tuple(deep_freeze(item) for item in obj)
    return obj


def deep_unfreeze(obj: Any) -> Any:
    """
    Mở đóng băng sâu đệ quy bất kỳ cấu trúc dữ liệu nào (để serialize to_dict):
    - Mapping (MappingProxyType, dict, ...) -> dict chuẩn với tất cả keys/values được deep_unfreeze.
    - Iterable sequence (tuple, list, set, frozenset) -> list chuẩn với tất cả phần tử được deep_unfreeze.
    - Enum -> enum.value (để đảm bảo JSON serializable chuẩn).
    - Chuỗi (str, bytes) -> giữ nguyên.
    - Scalar -> giữ nguyên.
    """
    if isinstance(obj, Mapping):
        return {k: deep_unfreeze(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple, set, frozenset)):
        return [deep_unfreeze(item) for item in obj]
    elif isinstance(obj, Enum):
        return obj.value
    return obj


@dataclass(frozen=True)
class AssessmentResult:
    """
    Kết quả đánh giá chất lượng kỹ thuật (AssessmentResult).
    Hoàn toàn bất biến và được đóng băng sâu (deep-frozen):
      - score: Điểm kỹ thuật (0 - 100) hoặc None khi thiếu evidence
      - grade: Nhãn đánh giá ('PERFECT', 'GOOD', 'FAIR', 'NEEDS WORK', 'NO_DATA')
      - status: AssessmentStatus enum
      - assessment_confidence: Derived rubric evidence confidence [0.0, 1.0] hoặc None
      - provenance: AssessmentProvenance
      - criteria: tuple[MappingProxyType, ...] chứa chi tiết tiêu chí đã đóng băng
      - findings: tuple[MappingProxyType, ...] chứa các phát hiện kỹ thuật đã đóng băng
      - metrics: MappingProxyType[str, AssessmentMetricItem] chứa các đặc trưng đo đạc
      - primary_error: Mã lỗi máy đọc được hoặc None
    """
    score: Optional[int]
    grade: str
    status: AssessmentStatus
    assessment_confidence: Optional[float]
    provenance: AssessmentProvenance
    criteria: tuple[MappingProxyType, ...]
    findings: tuple[MappingProxyType, ...]
    metrics: MappingProxyType[str, AssessmentMetricItem]
    primary_error: Optional[str] = None

    def __init__(
        self,
        score: Optional[int],
        grade: str,
        status: AssessmentStatus | str,
        assessment_confidence: Optional[float],
        provenance: AssessmentProvenance,
        criteria: Iterable[Mapping[str, Any] | Any] = (),
        findings: Iterable[Mapping[str, Any] | Any] = (),
        metrics: Optional[Mapping[str, Any]] = None,
        primary_error: Optional[str] = None,
    ) -> None:
        # Validate score
        if score is not None:
            if isinstance(score, bool) or not isinstance(score, (int, float)):
                raise TypeError(f"score must be an integer, float, or None, got {type(score).__name__}.")
            score_int = int(round(score))
            if not (0 <= score_int <= 100):
                raise ValueError(f"score must be between 0 and 100, got {score_int}.")
        else:
            score_int = None

        # Validate grade
        if isinstance(grade, bool) or not isinstance(grade, str) or not grade.strip():
            raise ValueError("grade must be a non-empty string.")
        grade_clean = grade.strip()

        # Validate status
        if isinstance(status, AssessmentStatus):
            status_enum = status
        elif isinstance(status, str):
            try:
                status_enum = AssessmentStatus(status.strip())
            except ValueError:
                raise ValueError(f"Invalid AssessmentStatus '{status}'. Must be one of {[s.value for s in AssessmentStatus]}.")
        else:
            raise TypeError(f"status must be an AssessmentStatus or str, got {type(status).__name__}.")

        # Validate assessment_confidence
        if assessment_confidence is not None:
            if isinstance(assessment_confidence, bool) or not isinstance(assessment_confidence, (int, float)):
                raise TypeError(f"assessment_confidence must be float or None, got {type(assessment_confidence).__name__}.")
            if math.isnan(assessment_confidence) or math.isinf(assessment_confidence) or not (0.0 <= assessment_confidence <= 1.0):
                raise ValueError(f"assessment_confidence must be in [0.0, 1.0], got {assessment_confidence}.")
            conf_val = round(float(assessment_confidence), 2)
        else:
            conf_val = None

        # Evidence Gating Invariant:
        # Nếu status là INSUFFICIENT_EVIDENCE hoặc grade là NO_DATA,
        # score và assessment_confidence phải là None!
        if status_enum == AssessmentStatus.INSUFFICIENT_EVIDENCE or grade_clean == "NO_DATA":
            score_int = None
            conf_val = None
            status_enum = AssessmentStatus.INSUFFICIENT_EVIDENCE
            grade_clean = "NO_DATA"

        # Validate provenance
        if not isinstance(provenance, AssessmentProvenance):
            raise TypeError(f"provenance must be an AssessmentProvenance instance, got {type(provenance).__name__}.")

        # Deep freeze criteria
        frozen_criteria: list[MappingProxyType] = []
        for c in criteria:
            frozen = deep_freeze(c)
            if not isinstance(frozen, Mapping):
                raise TypeError(f"Criterion item must be a Mapping or have to_dict(), got {type(c).__name__}.")
            frozen_criteria.append(frozen)

        # Deep freeze findings
        frozen_findings: list[MappingProxyType] = []
        for f in findings:
            frozen = deep_freeze(f)
            if not isinstance(frozen, Mapping):
                raise TypeError(f"Finding item must be a Mapping or have to_dict(), got {type(f).__name__}.")
            frozen_findings.append(frozen)

        # Deep freeze metrics
        frozen_metrics: dict[str, AssessmentMetricItem] = {}
        if metrics:
            for k, v in metrics.items():
                frozen_metrics[str(k)] = to_assessment_metric(v)

        # Primary error
        p_err = str(primary_error).strip() if primary_error is not None and str(primary_error).strip() else None

        object.__setattr__(self, "score", score_int)
        object.__setattr__(self, "grade", grade_clean)
        object.__setattr__(self, "status", status_enum)
        object.__setattr__(self, "assessment_confidence", conf_val)
        object.__setattr__(self, "provenance", provenance)
        object.__setattr__(self, "criteria", tuple(frozen_criteria))
        object.__setattr__(self, "findings", tuple(frozen_findings))
        object.__setattr__(self, "metrics", MappingProxyType(frozen_metrics))
        object.__setattr__(self, "primary_error", p_err)

    def to_dict(self) -> dict[str, Any]:
        return {
            "score": self.score,
            "grade": self.grade,
            "status": self.status.value,
            "assessmentConfidence": self.assessment_confidence,
            "provenance": self.provenance.to_dict(),
            "criteria": [deep_unfreeze(c) for c in self.criteria],
            "findings": [deep_unfreeze(f) for f in self.findings],
            "metrics": {k: v.to_dict() for k, v in self.metrics.items()},
            "primaryError": self.primary_error,
        }

    def to_legacy_dict(self) -> dict[str, Any]:
        """Tương thích ngược 100% với ActionAssessment.to_dict()."""
        return {
            "rubricId": self.provenance.rubric_id,
            "score": self.score,
            "grade": self.grade,
            "status": self.status.value,
            "primaryError": self.primary_error,
            "criteria": [deep_unfreeze(c) for c in self.criteria],
            "findings": [deep_unfreeze(f) for f in self.findings],
        }


@dataclass(frozen=True)
class AssessmentInput:
    """
    Model đầu vào chuẩn hóa cho Assessment Engine.
    Bất biến (frozen=True) và bảo vệ dữ liệu nguồn.
    Tuyệt đối KHÔNG lưu trữ detector / raw action objects trong state nội bộ.
    """
    action_id: str = ""
    technique: str = ""
    family: str = ""
    criterion_results: tuple[Any, ...] = ()
    findings: tuple[Any, ...] = ()
    metrics: MappingProxyType[str, AssessmentMetricItem] = field(default_factory=lambda: MappingProxyType({}))
    context: Optional[AnalysisContext] = None
    requested_rubric_version: Optional[str] = None
    quality_status: Optional[str] = None

    def __post_init__(self) -> None:
        if not isinstance(self.criterion_results, tuple):
            object.__setattr__(self, "criterion_results", tuple(self.criterion_results))
        if not isinstance(self.findings, tuple):
            object.__setattr__(self, "findings", tuple(self.findings))
        if not isinstance(self.metrics, MappingProxyType):
            m_dict = {str(k): to_assessment_metric(v) for k, v in self.metrics.items()}
            object.__setattr__(self, "metrics", MappingProxyType(m_dict))

    @classmethod
    def from_punch(
        cls,
        punch: Any,
        action_id: str = "",
        context: Optional[AnalysisContext] = None,
        requested_rubric_version: Optional[str] = None,
        quality_status: Optional[str] = None,
    ) -> AssessmentInput:
        crit_results = tuple(getattr(punch, "criterion_results", ()))
        findings = tuple(getattr(punch, "findings", ()))
        p_type = getattr(punch, "punch_type", "punch")
        tech = str(p_type).lower() if p_type else "punch"
        q_status = quality_status or getattr(punch, "quality_status", None)
        return cls(
            action_id=action_id,
            technique=tech,
            family="punch",
            criterion_results=crit_results,
            findings=findings,
            context=context,
            requested_rubric_version=requested_rubric_version,
            quality_status=q_status,
        )

    @classmethod
    def from_kick(
        cls,
        kick: Any,
        action_id: str = "",
        context: Optional[AnalysisContext] = None,
        requested_rubric_version: Optional[str] = None,
        quality_status: Optional[str] = None,
    ) -> AssessmentInput:
        crit_results = tuple(getattr(kick, "criterion_results", ()))
        findings = tuple(getattr(kick, "findings", ()))
        k_type = getattr(kick, "kick_type", "round_kick")
        tech = str(k_type).lower() if k_type else "round_kick"
        q_status = quality_status or getattr(kick, "quality_status", None)
        return cls(
            action_id=action_id,
            technique=tech,
            family="kick",
            criterion_results=crit_results,
            findings=findings,
            context=context,
            requested_rubric_version=requested_rubric_version,
            quality_status=q_status,
        )


# ─────────────────────────────────────────────────────────────────────────────
# 3. Rubric & Evidence Calculations
# ─────────────────────────────────────────────────────────────────────────────

def compute_derived_rubric_confidence(criterion_results: Iterable[Any]) -> Optional[float]:
    """
    Derived rubric evidence confidence: Trung bình có trọng số các tiêu chí rubric hợp lệ.
    LƯU Ý: Đây là derived rubric evidence confidence, KHÔNG PHẢI xác suất đã calibrate.
    Chỉ dùng các tiêu chí có:
      - status != 'insufficient_evidence'
      - weight > 0
      - confidence hợp lệ trong đoạn [0.0, 1.0]
    Nếu không có tiêu chí hợp lệ hoặc tổng trọng số <= 0, trả về None.
    Tiêu chí insufficient_evidence tuyệt đối không được làm tăng confidence.
    """
    valid: list[tuple[float, float]] = []
    for c in criterion_results:
        if isinstance(c, Mapping):
            status = c.get("status")
            status_str = status.value if hasattr(status, "value") else str(status)
            weight = c.get("weight", 0.0)
            conf = c.get("confidence", None)
        else:
            status = getattr(c, "status", None)
            status_str = status.value if hasattr(status, "value") else str(status)
            weight = getattr(c, "weight", 0.0)
            conf = getattr(c, "confidence", None)

        if status_str == CriterionStatus.INSUFFICIENT_EVIDENCE.value:
            continue

        if weight is not None and conf is not None:
            if not isinstance(weight, bool) and isinstance(weight, (int, float)) and weight > 0:
                if not isinstance(conf, bool) and isinstance(conf, (int, float)) and 0.0 <= conf <= 1.0:
                    valid.append((float(conf), float(weight)))

    if not valid:
        return None

    total_weight = sum(w for _, w in valid)
    if total_weight <= 0:
        return None

    weighted_sum = sum(conf * w for conf, w in valid)
    return round(weighted_sum / total_weight, 2)


def calculate_score_and_grade(
    criterion_results: Iterable[Any],
) -> tuple[Optional[int], str, AssessmentStatus]:
    """
    Tính điểm tổng hợp kỹ thuật, phân hạng (grade) và trạng thái (status).
    Chỉ những tiêu chí có đủ dữ liệu quan sát (status != 'insufficient_evidence')
    mới được tính vào điểm tổng.
    Nếu không có tiêu chí hợp lệ:
      score = None, grade = "NO_DATA", status = AssessmentStatus.INSUFFICIENT_EVIDENCE.
    """
    valid: list[tuple[float, float]] = []
    for c in criterion_results:
        if isinstance(c, Mapping):
            status = c.get("status")
            status_str = status.value if hasattr(status, "value") else str(status)
            weight = c.get("weight", 0.0)
            score = c.get("score", 0.0)
        else:
            status = getattr(c, "status", None)
            status_str = status.value if hasattr(status, "value") else str(status)
            weight = getattr(c, "weight", 0.0)
            score = getattr(c, "score", 0.0)

        if status_str == CriterionStatus.INSUFFICIENT_EVIDENCE.value:
            continue

        if weight is not None and score is not None:
            if not isinstance(weight, bool) and isinstance(weight, (int, float)) and weight > 0:
                if not isinstance(score, bool) and isinstance(score, (int, float)):
                    valid.append((float(score), float(weight)))

    if not valid:
        return None, "NO_DATA", AssessmentStatus.INSUFFICIENT_EVIDENCE

    total_weight = sum(w for _, w in valid)
    if total_weight <= 0:
        return None, "NO_DATA", AssessmentStatus.INSUFFICIENT_EVIDENCE

    weighted_sum = sum(score * w for score, w in valid)
    final_score = int(round(max(0.0, min(100.0, weighted_sum / total_weight))))

    if final_score >= 90:
        grade = "PERFECT"
        status = AssessmentStatus.EXCELLENT
    elif final_score >= 75:
        grade = "GOOD"
        status = AssessmentStatus.GOOD
    elif final_score >= 55:
        grade = "FAIR"
        status = AssessmentStatus.FAIR
    else:
        grade = "NEEDS WORK"
        status = AssessmentStatus.NEEDS_IMPROVEMENT

    return final_score, grade, status


def _find_criterion(criteria: Iterable[Any], criterion_id: str) -> Optional[Any]:
    for c in criteria:
        cid = c.get("criterionId") if isinstance(c, Mapping) else getattr(c, "criterion_id", None)
        if cid == criterion_id:
            return c
    return None


def _is_criterion_insufficient(c: Optional[Any]) -> bool:
    if c is None:
        return False
    status = c.get("status") if isinstance(c, Mapping) else getattr(c, "status", None)
    status_str = status.value if hasattr(status, "value") else str(status)
    return status_str == CriterionStatus.INSUFFICIENT_EVIDENCE.value


def _extract_metric_item(
    source_obj: Any,
    attr_name: str,
    unit: str,
    criterion: Optional[Any] = None,
    val_type: str = "float",
    round_digits: int = 1,
) -> AssessmentMetricItem:
    """
    Trích xuất metric an toàn từ source object, đảm bảo zero-mutation và không tạo dữ liệu giả.
    """
    if _is_criterion_insufficient(criterion):
        return AssessmentMetricItem(value=None, unit=unit, confidence=None)

    raw_val = None
    if isinstance(source_obj, Mapping):
        raw_val = source_obj.get(attr_name)
    elif hasattr(source_obj, attr_name):
        raw_val = getattr(source_obj, attr_name)

    if raw_val is None:
        return AssessmentMetricItem(value=None, unit=unit, confidence=None)

    if val_type == "float":
        val = round(float(raw_val), round_digits)
    elif val_type == "bool":
        val = bool(raw_val)
    elif val_type == "int":
        val = int(raw_val)
    else:
        val = str(raw_val)

    conf = None
    if criterion is not None:
        c_conf = criterion.get("confidence") if isinstance(criterion, Mapping) else getattr(criterion, "confidence", None)
        if c_conf is not None and isinstance(c_conf, (int, float)) and 0.0 <= c_conf <= 1.0:
            conf = float(c_conf)

    return AssessmentMetricItem(value=val, unit=unit, confidence=conf)


# ─────────────────────────────────────────────────────────────────────────────
# 4. TechniqueEvaluator Protocol & Evaluator Implementations
# ─────────────────────────────────────────────────────────────────────────────

@runtime_checkable
class TechniqueEvaluator(Protocol):
    """
    Protocol/Interface định nghĩa hợp đồng của một Technique Evaluator.
    """
    evaluator_id: str
    evaluator_version: str

    def can_evaluate(
        self,
        technique: str,
        context: Optional[AnalysisContext] = None,
    ) -> bool:
        """Kiểm tra evaluator có hỗ trợ kỹ thuật và ngữ cảnh tương ứng không."""
        ...

    def evaluate(
        self,
        action_or_input: Any,
        context: Optional[AnalysisContext] = None,
        rubric: Optional[TechniqueRubric] = None,
        raw_action: Optional[Any] = None,
    ) -> AssessmentResult:
        """Đánh giá kỹ thuật và trả về AssessmentResult bất biến."""
        ...


class DefaultPunchEvaluator:
    """
    Evaluator chuẩn hóa cho các đòn đấm Generic:
    - Hỗ trợ: generic (context is None hoặc martial_art='generic').
    - Kỹ thuật: 'punch', 'jab', 'cross', 'hook', 'straight_punch'.
    - Metrics trích xuất: maxElbowAngle, peakSpeed, guardPreserved.
    """
    evaluator_id: str = "default_punch_evaluator"
    evaluator_version: str = "1.0.0"

    SUPPORTED_TECHNIQUES = frozenset({"punch", "jab", "cross", "hook", "straight_punch"})
    SUPPORTED_MARTIAL_ARTS = frozenset({
        None,
        MartialArt.GENERIC.value,
    })

    def can_evaluate(
        self,
        technique: str,
        context: Optional[AnalysisContext] = None,
    ) -> bool:
        if isinstance(technique, bool) or not isinstance(technique, str):
            return False
        tech_clean = technique.strip().lower()
        if tech_clean not in self.SUPPORTED_TECHNIQUES:
            return False

        if context is None:
            return True

        if not isinstance(context, AnalysisContext):
            return False

        ma = context.martial_art
        if ma == MartialArt.UNKNOWN.value:
            return False
        return ma in self.SUPPORTED_MARTIAL_ARTS

    def evaluate(
        self,
        action_or_input: Any,
        context: Optional[AnalysisContext] = None,
        rubric: Optional[TechniqueRubric] = None,
        raw_action: Optional[Any] = None,
        quality_status: Optional[str] = None,
    ) -> AssessmentResult:
        # Chuẩn hóa input sang AssessmentInput (không lưu trữ raw_action trong state)
        if isinstance(action_or_input, AssessmentInput):
            inp = action_or_input
            eff_context = context if context is not None else inp.context
            detector_source = raw_action
        else:
            inp = AssessmentInput.from_punch(action_or_input, context=context, quality_status=quality_status)
            eff_context = context
            detector_source = raw_action or action_or_input

        # Rubric selection
        actual_rubric = rubric or RUBRIC_PUNCH_V3
        if not isinstance(actual_rubric, TechniqueRubric):
            raise TypeError(f"rubric must be a TechniqueRubric instance, got {type(actual_rubric).__name__}.")

        criteria_list = inp.criterion_results
        findings_list = inp.findings
        raw = detector_source if detector_source is not None else {}

        # Derived rubric evidence confidence & scores
        assessment_conf = compute_derived_rubric_confidence(criteria_list)
        score, grade, status = calculate_score_and_grade(criteria_list)

        # Quality propagation
        eff_quality = None
        if quality_status is not None:
            eff_quality = str(quality_status).upper()
        elif inp.quality_status:
            eff_quality = str(inp.quality_status).upper()
        elif eff_context is not None and hasattr(eff_context, "quality_status") and getattr(eff_context, "quality_status"):
            eff_quality = str(getattr(eff_context, "quality_status")).upper()
        elif raw is not None and hasattr(raw, "quality_status") and getattr(raw, "quality_status"):
            eff_quality = str(getattr(raw, "quality_status")).upper()

        if eff_quality == "BLOCKED":
            score = None
            grade = "NO_DATA"
            status = AssessmentStatus.INSUFFICIENT_EVIDENCE
            assessment_conf = None
            blocked_criteria = []
            for c in criteria_list:
                c_dict = copy.deepcopy(c.to_dict() if hasattr(c, "to_dict") else dict(c))
                c_dict["score"] = None
                c_dict["status"] = CriterionStatus.INSUFFICIENT_EVIDENCE.value
                c_dict["confidence"] = None
                c_dict["detail"] = "Blocked due to video quality failure"
                blocked_criteria.append(c_dict)
            criteria_list = tuple(blocked_criteria)
        elif eff_quality == "DEGRADED":
            degraded_criteria = []
            for c in criteria_list:
                c_dict = copy.deepcopy(c.to_dict() if hasattr(c, "to_dict") else dict(c))
                c_conf = c_dict.get("confidence")
                if c_conf is not None and isinstance(c_conf, (int, float)):
                    if float(c_conf) < 0.55:
                        c_dict["status"] = CriterionStatus.INSUFFICIENT_EVIDENCE.value
                        c_dict["score"] = None
                        c_dict["confidence"] = None
                        c_dict["detail"] = "Abstained under degraded video quality"
                    else:
                        c_dict["confidence"] = round(float(c_conf) * 0.75, 2)
                degraded_criteria.append(c_dict)
            criteria_list = tuple(degraded_criteria)
            assessment_conf = compute_derived_rubric_confidence(criteria_list)
            score, grade, status = calculate_score_and_grade(criteria_list)
            if assessment_conf is None or grade == "NO_DATA":
                score = None
                grade = "NO_DATA"
                status = AssessmentStatus.INSUFFICIENT_EVIDENCE
                assessment_conf = None

        # Evidence Gating
        if assessment_conf is None or grade == "NO_DATA":
            score = None
            grade = "NO_DATA"
            status = AssessmentStatus.INSUFFICIENT_EVIDENCE
            assessment_conf = None

        # Evidence keys used from rubric
        evidence_keys = tuple(c.id for c in actual_rubric.criteria)

        # Tìm criterion tương ứng để gán confidence cho metrics
        crit_ext = _find_criterion(criteria_list, "crit_punch_extension")
        crit_speed = _find_criterion(criteria_list, "crit_punch_speed")
        crit_guard = _find_criterion(criteria_list, "crit_punch_guard")

        # Trích xuất metrics an toàn
        if eff_quality == "BLOCKED":
            metrics_dict: dict[str, AssessmentMetricItem] = {
                "maxElbowAngle": AssessmentMetricItem(value=None, unit="degree", confidence=None),
                "peakSpeed": AssessmentMetricItem(value=None, unit="normalized_image/s", confidence=None),
                "guardPreserved": AssessmentMetricItem(value=None, unit="flag", confidence=None),
            }
        else:
            metrics_dict = {
                "maxElbowAngle": _extract_metric_item(
                    raw, "max_elbow_angle", unit="degree", criterion=crit_ext, val_type="float", round_digits=1
                ),
                "peakSpeed": _extract_metric_item(
                    raw, "peak_speed", unit="normalized_image/s", criterion=crit_speed, val_type="float", round_digits=3
                ),
                "guardPreserved": _extract_metric_item(
                    raw, "guard_preserved", unit="flag", criterion=crit_guard, val_type="bool"
                ),
            }

        # Nếu caller truyền thêm metrics trong AssessmentInput, merge an toàn
        for k, v in inp.metrics.items():
            if eff_quality == "BLOCKED":
                metrics_dict[k] = AssessmentMetricItem(value=None, unit=getattr(v, "unit", "ratio"), confidence=None)
            else:
                metrics_dict[k] = to_assessment_metric(v)

        # Evaluator generic không được tự nhận là discipline-specific
        provenance = AssessmentProvenance(
            evaluator_id=self.evaluator_id,
            evaluator_version=self.evaluator_version,
            rubric_id=actual_rubric.id,
            rubric_version=actual_rubric.version,
            rubric_status=actual_rubric.status,
            evidence_keys_used=evidence_keys,
            is_discipline_specific=False,
        )

        return AssessmentResult(
            score=score,
            grade=grade,
            status=status,
            assessment_confidence=assessment_conf,
            provenance=provenance,
            criteria=criteria_list,
            findings=findings_list,
            metrics=metrics_dict,
        )


class DefaultKickEvaluator:
    """
    Evaluator chuẩn hóa cho các đòn đá Generic:
    - Hỗ trợ: generic (context is None hoặc martial_art='generic').
    - Kỹ thuật: 'round_kick', 'kick'.
    - Metrics trích xuất: minChamberAngle, maxExtensionAngle, peakSpeed, hipAngle.
    """
    evaluator_id: str = "default_kick_evaluator"
    evaluator_version: str = "1.0.0"

    SUPPORTED_TECHNIQUES = frozenset({"round_kick", "kick"})
    SUPPORTED_MARTIAL_ARTS = frozenset({
        None,
        MartialArt.GENERIC.value,
    })

    def can_evaluate(
        self,
        technique: str,
        context: Optional[AnalysisContext] = None,
    ) -> bool:
        if isinstance(technique, bool) or not isinstance(technique, str):
            return False
        tech_clean = technique.strip().lower()
        if tech_clean not in self.SUPPORTED_TECHNIQUES:
            return False

        if context is None:
            return True

        if not isinstance(context, AnalysisContext):
            return False

        ma = context.martial_art
        if ma == MartialArt.UNKNOWN.value:
            return False
        return ma in self.SUPPORTED_MARTIAL_ARTS

    def evaluate(
        self,
        action_or_input: Any,
        context: Optional[AnalysisContext] = None,
        rubric: Optional[TechniqueRubric] = None,
        raw_action: Optional[Any] = None,
        quality_status: Optional[str] = None,
    ) -> AssessmentResult:
        if isinstance(action_or_input, AssessmentInput):
            inp = action_or_input
            eff_context = context if context is not None else inp.context
            detector_source = raw_action
        else:
            inp = AssessmentInput.from_kick(action_or_input, context=context, quality_status=quality_status)
            eff_context = context
            detector_source = raw_action or action_or_input

        actual_rubric = rubric or RUBRIC_ROUND_KICK_V3
        if not isinstance(actual_rubric, TechniqueRubric):
            raise TypeError(f"rubric must be a TechniqueRubric instance, got {type(actual_rubric).__name__}.")

        criteria_list = inp.criterion_results
        findings_list = inp.findings
        raw = detector_source if detector_source is not None else {}

        assessment_conf = compute_derived_rubric_confidence(criteria_list)
        score, grade, status = calculate_score_and_grade(criteria_list)

        # Quality propagation
        eff_quality = None
        if quality_status is not None:
            eff_quality = str(quality_status).upper()
        elif inp.quality_status:
            eff_quality = str(inp.quality_status).upper()
        elif eff_context is not None and hasattr(eff_context, "quality_status") and getattr(eff_context, "quality_status"):
            eff_quality = str(getattr(eff_context, "quality_status")).upper()
        elif raw is not None and hasattr(raw, "quality_status") and getattr(raw, "quality_status"):
            eff_quality = str(getattr(raw, "quality_status")).upper()

        if eff_quality == "BLOCKED":
            score = None
            grade = "NO_DATA"
            status = AssessmentStatus.INSUFFICIENT_EVIDENCE
            assessment_conf = None
            blocked_criteria = []
            for c in criteria_list:
                c_dict = copy.deepcopy(c.to_dict() if hasattr(c, "to_dict") else dict(c))
                c_dict["score"] = None
                c_dict["status"] = CriterionStatus.INSUFFICIENT_EVIDENCE.value
                c_dict["confidence"] = None
                c_dict["detail"] = "Blocked due to video quality failure"
                blocked_criteria.append(c_dict)
            criteria_list = tuple(blocked_criteria)
        elif eff_quality == "DEGRADED":
            degraded_criteria = []
            for c in criteria_list:
                c_dict = copy.deepcopy(c.to_dict() if hasattr(c, "to_dict") else dict(c))
                c_conf = c_dict.get("confidence")
                if c_conf is not None and isinstance(c_conf, (int, float)):
                    if float(c_conf) < 0.55:
                        c_dict["status"] = CriterionStatus.INSUFFICIENT_EVIDENCE.value
                        c_dict["score"] = None
                        c_dict["confidence"] = None
                        c_dict["detail"] = "Abstained under degraded video quality"
                    else:
                        c_dict["confidence"] = round(float(c_conf) * 0.75, 2)
                degraded_criteria.append(c_dict)
            criteria_list = tuple(degraded_criteria)
            assessment_conf = compute_derived_rubric_confidence(criteria_list)
            score, grade, status = calculate_score_and_grade(criteria_list)
            if assessment_conf is None or grade == "NO_DATA":
                score = None
                grade = "NO_DATA"
                status = AssessmentStatus.INSUFFICIENT_EVIDENCE
                assessment_conf = None

        # Evidence Gating
        if assessment_conf is None or grade == "NO_DATA":
            score = None
            grade = "NO_DATA"
            status = AssessmentStatus.INSUFFICIENT_EVIDENCE
            assessment_conf = None

        evidence_keys = tuple(c.id for c in actual_rubric.criteria)

        crit_chamber = _find_criterion(criteria_list, "crit_kick_chamber")
        crit_ext = _find_criterion(criteria_list, "crit_kick_extension")
        crit_speed = _find_criterion(criteria_list, "crit_kick_speed")
        crit_posture = _find_criterion(criteria_list, "crit_kick_posture")

        if eff_quality == "BLOCKED":
            metrics_dict: dict[str, AssessmentMetricItem] = {
                "minChamberAngle": AssessmentMetricItem(value=None, unit="degree", confidence=None),
                "maxExtensionAngle": AssessmentMetricItem(value=None, unit="degree", confidence=None),
                "peakSpeed": AssessmentMetricItem(value=None, unit="normalized_image/s", confidence=None),
                "hipAngle": AssessmentMetricItem(value=None, unit="degree", confidence=None),
            }
        else:
            metrics_dict = {
                "minChamberAngle": _extract_metric_item(
                    raw, "min_chamber_angle", unit="degree", criterion=crit_chamber, val_type="float", round_digits=1
                ),
                "maxExtensionAngle": _extract_metric_item(
                    raw, "max_extension_angle", unit="degree", criterion=crit_ext, val_type="float", round_digits=1
                ),
                "peakSpeed": _extract_metric_item(
                    raw, "peak_speed", unit="normalized_image/s", criterion=crit_speed, val_type="float", round_digits=3
                ),
                "hipAngle": _extract_metric_item(
                    raw, "hip_angle", unit="degree", criterion=crit_posture, val_type="float", round_digits=1
                ),
            }

        for k, v in inp.metrics.items():
            metrics_dict[k] = to_assessment_metric(v)

        # Evaluator generic không được tự nhận là discipline-specific
        provenance = AssessmentProvenance(
            evaluator_id=self.evaluator_id,
            evaluator_version=self.evaluator_version,
            rubric_id=actual_rubric.id,
            rubric_version=actual_rubric.version,
            rubric_status=actual_rubric.status,
            evidence_keys_used=evidence_keys,
            is_discipline_specific=False,
        )

        return AssessmentResult(
            score=score,
            grade=grade,
            status=status,
            assessment_confidence=assessment_conf,
            provenance=provenance,
            criteria=criteria_list,
            findings=findings_list,
            metrics=metrics_dict,
        )


# ─────────────────────────────────────────────────────────────────────────────
# 5. Canonical Rubric Registry for Assessment Engine
# ─────────────────────────────────────────────────────────────────────────────

def create_assessment_rubric_registry() -> RubricRegistry:
    """
    Tạo RubricRegistry mặc định cho Assessment Engine.
    Chỉ sử dụng các rubric canonical đã được phê duyệt từ create_default_rubric_registry():
      - RUBRIC_ROUND_KICK_V3: ('generic', 'round_kick', '3.0.0')
      - RUBRIC_PUNCH_V3: ('generic', 'punch', '3.0.0')
    Tuyệt đối không đăng ký rubric chưa được thẩm định.
    """
    return create_default_rubric_registry()


_ASSESSMENT_DEFAULT_RUBRIC_REGISTRY: Optional[RubricRegistry] = None


def get_assessment_rubric_registry() -> RubricRegistry:
    """Trả về RubricRegistry toàn cục được deep-freeze cho Assessment Engine."""
    global _ASSESSMENT_DEFAULT_RUBRIC_REGISTRY
    if _ASSESSMENT_DEFAULT_RUBRIC_REGISTRY is None:
        _ASSESSMENT_DEFAULT_RUBRIC_REGISTRY = create_assessment_rubric_registry().freeze()
    return _ASSESSMENT_DEFAULT_RUBRIC_REGISTRY


# ─────────────────────────────────────────────────────────────────────────────
# 6. Evaluator Registry & Assessment Engine
# ─────────────────────────────────────────────────────────────────────────────

class EvaluatorRegistry:
    """
    Registry quản lý các TechniqueEvaluator.
    Hỗ trợ đăng ký evaluator theo evaluator_id và tìm kiếm evaluator phù hợp.
    """
    def __init__(self) -> None:
        self._evaluators: dict[str, TechniqueEvaluator] = {}
        self._ordered_evaluators: list[TechniqueEvaluator] = []

    def register(self, evaluator: TechniqueEvaluator) -> None:
        if not isinstance(evaluator, TechniqueEvaluator):
            raise TypeError(f"evaluator must implement TechniqueEvaluator protocol, got {type(evaluator).__name__}.")
        eid = evaluator.evaluator_id
        if eid in self._evaluators:
            raise ValueError(f"Evaluator ID '{eid}' is already registered.")
        self._evaluators[eid] = evaluator
        self._ordered_evaluators.append(evaluator)

    def get_by_id(self, evaluator_id: str) -> Optional[TechniqueEvaluator]:
        return self._evaluators.get(evaluator_id)

    def find_evaluator(
        self,
        technique: str,
        context: Optional[AnalysisContext] = None,
    ) -> Optional[TechniqueEvaluator]:
        """Tìm evaluator đầu tiên có thể đánh giá kỹ thuật và context này."""
        for ev in self._ordered_evaluators:
            if ev.can_evaluate(technique, context):
                return ev
        return None

    def list_evaluators(self) -> tuple[TechniqueEvaluator, ...]:
        return tuple(self._ordered_evaluators)


def create_default_evaluator_registry() -> EvaluatorRegistry:
    """Khởi tạo EvaluatorRegistry mặc định với DefaultPunchEvaluator và DefaultKickEvaluator."""
    reg = EvaluatorRegistry()
    reg.register(DefaultPunchEvaluator())
    reg.register(DefaultKickEvaluator())
    return reg


class AssessmentEngine:
    """
    Trái tim của kiến trúc Assessment (Task 5).
    Kết nối AnalysisContext, RubricRegistry và TechniqueEvaluator.
    """
    def __init__(
        self,
        rubric_registry: Optional[RubricRegistry] = None,
        evaluator_registry: Optional[EvaluatorRegistry] = None,
    ) -> None:
        self.rubric_registry = rubric_registry or get_assessment_rubric_registry()
        self.evaluator_registry = evaluator_registry or create_default_evaluator_registry()

    def resolve(
        self,
        technique: str,
        context: Optional[AnalysisContext] = None,
        requested_version: Optional[str] = None,
        allow_draft: bool = False,
        allow_deprecated_for_replay: bool = False,
    ) -> tuple[TechniqueEvaluator, TechniqueRubric]:
        """
        Phân giải Evaluator và Rubric từ context và technique:
        1. Kiểm tra validation nghiêm ngặt các tham số.
        2. Từ chối martial_art 'unknown' bằng RubricResolutionError.
        3. Tra cứu Rubric qua RubricRegistry.select_rubric.
        4. Tra cứu Evaluator qua EvaluatorRegistry.
        5. Đảm bảo tính tương thích và ngăn chặn stamping rubric giả.
        """
        # Validate technique
        if isinstance(technique, bool) or not isinstance(technique, str) or not technique.strip():
            raise TypeError("technique must be a non-empty string.")
        tech_clean = technique.strip().lower()

        # Validate context
        if context is not None and not isinstance(context, AnalysisContext):
            raise TypeError(f"context must be an AnalysisContext or None, got {type(context).__name__}.")

        # Validate requested_version
        if requested_version is not None:
            if isinstance(requested_version, bool) or not isinstance(requested_version, str) or not requested_version.strip():
                raise TypeError("requested_version must be a non-empty string or None.")

        # Fail-fast check cho martial_art == 'unknown'
        if context is not None and context.martial_art == MartialArt.UNKNOWN.value:
            sel_err = RubricSelectionResult(
                status=RubricSelectionStatus.UNSUPPORTED_MARTIAL_ART,
                requested_martial_art=MartialArt.UNKNOWN.value,
                requested_technique=tech_clean,
                reason="Martial art is 'unknown'; cannot select or stamp rubric for technique.",
            )
            raise RubricResolutionError(sel_err.reason, selection_result=sel_err)

        # Lựa chọn rubric (với fallback chuẩn cho generic punch và kick)
        target_ma = context.martial_art if context and context.martial_art else MartialArt.GENERIC.value
        lookup_tech = tech_clean
        if target_ma == MartialArt.GENERIC.value:
            if tech_clean in {"cross", "jab", "hook", "straight_punch"}:
                avail_generic = self.rubric_registry.list_techniques(MartialArt.GENERIC.value)
                if tech_clean not in avail_generic:
                    lookup_tech = "punch"
            elif tech_clean in {"kick"}:
                avail_generic = self.rubric_registry.list_techniques(MartialArt.GENERIC.value)
                if tech_clean not in avail_generic:
                    lookup_tech = "round_kick"

        sel_result = self.rubric_registry.select_rubric(
            context=context,
            technique=lookup_tech,
            version=requested_version,
            allow_draft=allow_draft,
            allow_deprecated_for_replay=allow_deprecated_for_replay,
        )

        if sel_result.status != RubricSelectionStatus.SELECTED or sel_result.rubric is None:
            raise RubricResolutionError(
                f"Failed to select rubric for technique '{tech_clean}': {sel_result.reason}",
                selection_result=sel_result,
            )

        rubric = sel_result.rubric

        # Tìm evaluator phù hợp
        evaluator = self.evaluator_registry.find_evaluator(tech_clean, context)
        if evaluator is None:
            ma_name = context.martial_art if context else "generic"
            raise EvaluatorResolutionError(
                f"No evaluator available to assess technique '{tech_clean}' in discipline '{ma_name}'.",
                selection_result=sel_result,
            )

        return evaluator, rubric

    def evaluate(
        self,
        action_or_input: Any,
        technique: Optional[str] = None,
        context: Optional[AnalysisContext] = None,
        requested_version: Optional[str] = None,
        allow_draft: bool = False,
        allow_deprecated_for_replay: bool = False,
        raw_action: Optional[Any] = None,
        quality_status: Optional[str] = None,
    ) -> AssessmentResult:
        """
        Thực hiện đánh giá chuyên môn toàn diện cho một hành động.
        """
        # Xác định technique
        if technique is not None:
            tech = technique
        elif isinstance(action_or_input, AssessmentInput):
            tech = action_or_input.technique
        elif hasattr(action_or_input, "punch_type"):
            tech = str(getattr(action_or_input, "punch_type")).lower()
        elif hasattr(action_or_input, "kick_type"):
            tech = str(getattr(action_or_input, "kick_type")).lower()
        elif isinstance(action_or_input, Mapping):
            tech = str(action_or_input.get("technique") or action_or_input.get("punch_type") or action_or_input.get("kick_type") or "punch").lower()
        else:
            tech = "punch"

        eff_context = context
        if eff_context is None and isinstance(action_or_input, AssessmentInput):
            eff_context = action_or_input.context

        evaluator, rubric = self.resolve(
            technique=tech,
            context=eff_context,
            requested_version=requested_version,
            allow_draft=allow_draft,
            allow_deprecated_for_replay=allow_deprecated_for_replay,
        )

        try:
            return evaluator.evaluate(
                action_or_input=action_or_input,
                context=eff_context,
                rubric=rubric,
                raw_action=raw_action,
                quality_status=quality_status,
            )
        except TypeError:
            return evaluator.evaluate(
                action_or_input=action_or_input,
                context=eff_context,
                rubric=rubric,
                raw_action=raw_action,
            )


# ─────────────────────────────────────────────────────────────────────────────
# 7. Global Singleton & Convenience Helpers
# ─────────────────────────────────────────────────────────────────────────────

_GLOBAL_ASSESSMENT_ENGINE: Optional[AssessmentEngine] = None


def get_default_assessment_engine() -> AssessmentEngine:
    """Trả về AssessmentEngine toàn cục mặc định."""
    global _GLOBAL_ASSESSMENT_ENGINE
    if _GLOBAL_ASSESSMENT_ENGINE is None:
        _GLOBAL_ASSESSMENT_ENGINE = AssessmentEngine()
    return _GLOBAL_ASSESSMENT_ENGINE


def resolve_evaluator(
    technique: str,
    context: Optional[AnalysisContext] = None,
    rubric_registry: Optional[RubricRegistry] = None,
    requested_version: Optional[str] = None,
    allow_draft: bool = False,
    allow_deprecated_for_replay: bool = False,
) -> tuple[TechniqueEvaluator, TechniqueRubric]:
    """Helper cấp module để phân giải evaluator và rubric nhanh chóng."""
    engine = AssessmentEngine(rubric_registry=rubric_registry) if rubric_registry else get_default_assessment_engine()
    return engine.resolve(
        technique=technique,
        context=context,
        requested_version=requested_version,
        allow_draft=allow_draft,
        allow_deprecated_for_replay=allow_deprecated_for_replay,
    )


def evaluate_action(
    action_or_input: Any,
    technique: Optional[str] = None,
    context: Optional[AnalysisContext] = None,
    requested_version: Optional[str] = None,
    allow_draft: bool = False,
    allow_deprecated_for_replay: bool = False,
    raw_action: Optional[Any] = None,
    quality_status: Optional[str] = None,
) -> AssessmentResult:
    """Helper cấp module để đánh giá action nhanh chóng."""
    engine = get_default_assessment_engine()
    return engine.evaluate(
        action_or_input=action_or_input,
        technique=technique,
        context=context,
        requested_version=requested_version,
        allow_draft=allow_draft,
        allow_deprecated_for_replay=allow_deprecated_for_replay,
        raw_action=raw_action,
        quality_status=quality_status,
    )
