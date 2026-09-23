"""
action_result.py — MMA-TMS Unified Action Result Model & Adapters

Mô hình dữ liệu chuẩn hóa đại diện cho một hành động võ thuật (đấm, đá)
tuân thủ MARTIAL-ARTS-AI-COACHING-SPEC-v1 và MMA-TMS-MASTER-SPECIFICATION-v2.

Nguyên tắc bắt buộc:
1. Tách bạch 3 chiều confidence: detection, classification, assessment.
2. Không gán cứng stance=orthodox; chuẩn hóa qua normalize_stance(), chỉ suy ra lead/rear khi có stance hợp lệ.
3. Không bịa metric khi thiếu evidence: value=None và confidence=None khi criterion là insufficient_evidence.
4. primaryError giữ None trong Task 1 (chờ Coaching MVP).
5. Không mutate dữ liệu detector gốc (PunchResult, KickResult, CriterionResult, TechniqueFinding).
"""

from __future__ import annotations

import copy
import math
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional

from technique_rubric import (
    CriterionStatus,
    TechniqueRubric,
    RUBRIC_PUNCH_V3,
    RUBRIC_ROUND_KICK_V3,
)
from pipeline.stance_context import (
    VALID_STANCES,
    StanceType,
    StanceSource,
    StanceContext,
    normalize_stance,
    normalize_attacking_side,
    resolve_limb_role,
    resolve_stance_context,
)
from pipeline.classification import (
    ClassifiedTechnique,
    classify_punch,
    classify_kick,
)
from pipeline.analysis_context import (
    AnalysisContext,
    MartialArt,
)
from pipeline.rubric_registry import (
    RubricSelectionStatus,
    RubricSelectionResult,
    RubricRegistry,
    get_default_rubric_registry,
)
from pipeline.contracts import EvidenceLevel
from pipeline.assessment_engine import (
    AssessmentStatus as EngineAssessmentStatus,
    AssessmentResult,
    evaluate_action,
)
from pipeline.temporal_phases import (
    TemporalPhaseSequence,
    segment_from_action_result,
)
from pipeline.kinematic_features import (
    KinematicFeatureSet,
    extract_kinematic_features,
)
from pipeline.shadow_classifier import (
    ShadowClassifier,
    ClassificationDecision,
    _unwrap_value,
)
from pipeline.shadow_punch_classifier import (
    ShadowMultiPunchClassifier,
    ExtendedClassificationDecision,
)
from pipeline.shadow_kick_classifier import (
    ShadowKickClassifier,
)
from pipeline.finding_engine import (
    FindingEngine,
    StandardFinding,
)
from pipeline.mvp_technique_discovery import (
    MVPTechniqueDiscoveryEngine,
)


class ActionFamily(str, Enum):
    PUNCH = "punch"
    KICK = "kick"
    OTHER_STRIKE = "other_strike"
    NON_STRIKE = "non_strike"


class AttackingSide(str, Enum):
    LEFT = "left"
    RIGHT = "right"
    UNKNOWN = "unknown"


class LimbRole(str, Enum):
    LEAD = "lead"
    REAR = "rear"
    UNKNOWN = "unknown"


class Stance(str, Enum):
    ORTHODOX = "orthodox"
    SOUTHPAW = "southpaw"
    SWITCH = "switch"
    UNKNOWN = "unknown"


class ReviewStatus(str, Enum):
    AI_GENERATED = "ai_generated"
    NEEDS_REVIEW = "needs_review"
    COACH_APPROVED = "coach_approved"
    COACH_CORRECTED = "coach_corrected"
    COACH_REJECTED = "coach_rejected"
    INSUFFICIENT_EVIDENCE = "insufficient_evidence"


class AssessmentStatus(str, Enum):
    EXCELLENT = "excellent"
    GOOD = "good"
    FAIR = "fair"
    NEEDS_IMPROVEMENT = "needs_improvement"
    INSUFFICIENT_EVIDENCE = "insufficient_evidence"


@dataclass
class ActionConfidence:
    """
    Ba chiều confidence độc lập:
    - detection: Độ tin cậy phát hiện sự tồn tại của action (hiện tại null vì detector dùng heuristic thresholds).
    - classification: Độ tin cậy gán nhãn kỹ thuật (hiện tại null vì chưa có multi-class calibrated classifier).
    - assessment: Derived rubric evidence confidence (tính từ trung bình có trọng số các tiêu chí rubric hợp lệ).
      LƯU Ý: Đây là derived rubric evidence confidence, KHÔNG PHẢI xác suất thống kê đã được calibrate.
    """
    detection: Optional[float] = None
    classification: Optional[float] = None
    assessment: Optional[float] = None

    def to_dict(self) -> dict[str, Optional[float]]:
        return {
            "detection": round(self.detection, 2) if self.detection is not None else None,
            "classification": round(self.classification, 2) if self.classification is not None else None,
            "assessment": round(self.assessment, 2) if self.assessment is not None else None,
        }


@dataclass
class ActionPhases:
    """
    Mốc thời gian và frame ranh giới từng pha chuyển động.
    Các trường chưa có nguồn đo thực tế từ detector phải giữ None.
    """
    startFrame: int
    chamberFrame: Optional[int] = None
    launchFrame: Optional[int] = None
    peakFrame: Optional[int] = None
    impactFrame: int = 0
    endFrame: int = 0

    startTimeMs: float = 0.0
    chamberTimeMs: Optional[float] = None
    launchTimeMs: Optional[float] = None
    peakTimeMs: Optional[float] = None
    impactTimeMs: float = 0.0
    endTimeMs: float = 0.0

    # Loại va chạm/tiếp xúc: "peak_extension_proxy" cho punch, "max_extension_proxy" cho kick
    impactType: str = "peak_extension_proxy"

    def to_dict(self) -> dict[str, Any]:
        return {
            "startFrame": self.startFrame,
            "chamberFrame": self.chamberFrame,
            "launchFrame": self.launchFrame,
            "peakFrame": self.peakFrame,
            "impactFrame": self.impactFrame,
            "endFrame": self.endFrame,
            "startTimeMs": round(self.startTimeMs, 1),
            "chamberTimeMs": round(self.chamberTimeMs, 1) if self.chamberTimeMs is not None else None,
            "launchTimeMs": round(self.launchTimeMs, 1) if self.launchTimeMs is not None else None,
            "peakTimeMs": round(self.peakTimeMs, 1) if self.peakTimeMs is not None else None,
            "impactTimeMs": round(self.impactTimeMs, 1),
            "endTimeMs": round(self.endTimeMs, 1),
            "impactType": self.impactType,
        }


@dataclass
class ActionMetricItem:
    """
    Định lượng một đặc trưng cơ sinh học.
    Đơn vị vận tốc chuẩn hóa là 'normalized_image/s' (phần trăm kích thước ảnh / giây),
    tuyệt đối KHÔNG ngụ ý là vận tốc vật lý m/s.
    Nếu thiếu bằng chứng hoặc thuộc tính không tồn tại, value và confidence phải là None.
    """
    value: float | int | bool | str | None
    unit: str  # "degree", "normalized_image/s", "ms", "flag", "ratio"
    confidence: Optional[float] = None
    evidenceConfidence: Optional[float] = None
    framesUsed: Optional[list[int]] = None
    source: Optional[str] = None
    methodVersion: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        val = self.value
        if isinstance(val, float):
            if not math.isfinite(val):
                val = None
            else:
                val = round(val, 3)
        res: dict[str, Any] = {
            "value": val,
            "unit": self.unit,
            "confidence": round(self.confidence, 2) if (self.confidence is not None and math.isfinite(self.confidence)) else None,
        }
        if self.evidenceConfidence is not None:
            res["evidenceConfidence"] = round(self.evidenceConfidence, 2) if math.isfinite(self.evidenceConfidence) else None
        if self.framesUsed is not None:
            res["framesUsed"] = [int(f) for f in self.framesUsed]
        if self.source is not None:
            res["source"] = str(self.source)
        if self.methodVersion is not None:
            res["methodVersion"] = str(self.methodVersion)
        return res


@dataclass
class ActionAssessment:
    """Kết quả đánh giá chất lượng kỹ thuật theo rubric."""
    rubricId: Optional[str]
    score: Optional[int]
    grade: str
    status: str  # "excellent" | "good" | "fair" | "needs_improvement" | "insufficient_evidence"
    primaryError: Optional[str] = None  # Machine-readable stable code (giữ None trong Task 1)
    criteria: list[dict[str, Any]] = field(default_factory=list)
    findings: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "rubricId": self.rubricId,
            "score": self.score,
            "grade": self.grade,
            "status": self.status,
            "primaryError": self.primaryError,
            "criteria": self.criteria,
            "findings": self.findings,
        }


@dataclass
class ActionReview:
    """Trạng thái kiểm duyệt chuyên môn."""
    status: str = ReviewStatus.AI_GENERATED.value
    reviewerId: Optional[str] = None
    reviewNotes: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "reviewerId": self.reviewerId,
            "reviewNotes": self.reviewNotes,
        }


@dataclass
class ActionResult:
    """
    Mô hình kết quả thống nhất cho một hành động võ thuật (Punch hoặc Kick).
    Lưu ý:
    - `id` (ví dụ: action_001) chỉ cam kết duy nhất và deterministic trong cùng một analysis revision.
    - `sourceActionId` là bắt buộc, lưu ID nguồn gốc từ detector (ví dụ: punch_1, kick_1).
    - `schemaVersion` không lặp lại ở đây mà đặt ở top-level output của analysis result.
    """
    id: str
    sourceActionId: str
    family: str  # "punch" | "kick"
    technique: str  # "cross", "jab", "hook", "round_kick", etc.
    attackingSide: str  # "left" | "right" | "unknown"
    limbRole: str  # "lead" | "rear" | "unknown"
    stance: str  # "orthodox" | "southpaw" | "switch" | "unknown"
    confidence: ActionConfidence
    phases: ActionPhases
    metrics: dict[str, ActionMetricItem]
    assessment: ActionAssessment
    review: ActionReview
    modelVersion: Optional[str] = None
    rubricVersion: Optional[str] = "3.0.0"
    shadowClassification: Optional[dict[str, Any]] = None

    def to_dict(self) -> dict[str, Any]:
        d = {
            "id": self.id,
            "sourceActionId": self.sourceActionId,
            "family": self.family,
            "technique": self.technique,
            "attackingSide": self.attackingSide,
            "limbRole": self.limbRole,
            "stance": self.stance,
            "confidence": self.confidence.to_dict(),
            "phases": self.phases.to_dict(),
            "metrics": {k: v.to_dict() for k, v in self.metrics.items()},
            "assessment": self.assessment.to_dict(),
            "review": self.review.to_dict(),
            "modelVersion": self.modelVersion,
            "rubricVersion": self.rubricVersion,
        }
        if self.shadowClassification is not None:
            d["shadowClassification"] = self.shadowClassification
        return d


# ─────────────────────────────────────────────────────────────────────────────
# Helper & Normalization Functions
# ─────────────────────────────────────────────────────────────────────────────

# Re-exported from pipeline.stance_context for backward compatibility:
# VALID_STANCES, normalize_stance, normalize_attacking_side, resolve_limb_role, resolve_stance_context, StanceContext


def compute_derived_rubric_confidence(criterion_results: list[Any]) -> Optional[float]:
    """
    Derived rubric evidence confidence: Trung bình có trọng số các tiêu chí rubric hợp lệ.
    LƯU Ý: Đây là derived rubric evidence confidence, KHÔNG PHẢI xác suất đã calibrate.
    Chỉ dùng các tiêu chí có:
    - status != 'insufficient_evidence'
    - weight > 0
    - confidence hợp lệ trong đoạn [0.0, 1.0]
    Nếu không có tiêu chí hợp lệ hoặc tổng trọng số <= 0, trả về None.
    """
    valid = []
    for c in criterion_results:
        status = getattr(c, "status", None)
        status_str = status.value if hasattr(status, "value") else str(status)
        if status_str == CriterionStatus.INSUFFICIENT_EVIDENCE.value:
            continue
        weight = getattr(c, "weight", 0.0)
        conf = getattr(c, "confidence", None)
        if weight > 0 and conf is not None and isinstance(conf, (int, float)) and 0.0 <= conf <= 1.0:
            valid.append((float(conf), float(weight)))

    if not valid:
        return None

    total_weight = sum(w for _, w in valid)
    if total_weight <= 0:
        return None

    weighted_sum = sum(conf * w for conf, w in valid)
    return round(weighted_sum / total_weight, 2)


def resolve_assessment_status(
    score: Optional[int],
    grade: Optional[str] = None,
    assessment_confidence: Optional[float] = None,
    has_valid_criteria: bool = True,
) -> str:
    """
    Xác định assessment status tuân thủ nguyên tắc evidence gating:
    - Nếu score is None, hoặc grade == "NO_DATA", hoặc không có criterion hợp lệ (has_valid_criteria is False),
      hoặc assessment_confidence is None: trả về 'insufficient_evidence'.
    - Các trường hợp còn lại phân loại theo score:
        >= 90: 'excellent'
        >= 75: 'good'
        >= 55: 'fair'
        < 55:  'needs_improvement'
    """
    if score is None or grade == "NO_DATA" or not has_valid_criteria or assessment_confidence is None:
        return AssessmentStatus.INSUFFICIENT_EVIDENCE.value

    if score >= 90:
        return AssessmentStatus.EXCELLENT.value
    elif score >= 75:
        return AssessmentStatus.GOOD.value
    elif score >= 55:
        return AssessmentStatus.FAIR.value
    return AssessmentStatus.NEEDS_IMPROVEMENT.value


def copy_criteria_and_findings(
    criterion_results: list[Any],
    findings: list[Any],
    target_action_id: str,
    family: str = "punch",
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """
    Tạo bản sao độc lập (deep copy) của criteria và findings, đồng thời
    remap trường `actionId` của cả criteria và findings sang `target_action_id`.
    TUYỆT ĐỐI KHÔNG MUTATE đối tượng gốc trong PunchResult/KickResult.
    """
    remapped_criteria = []
    for c in criterion_results:
        c_dict = copy.deepcopy(c.to_dict() if hasattr(c, "to_dict") else dict(c))
        c_dict["actionId"] = target_action_id
        remapped_criteria.append(c_dict)

    remapped_findings = []
    for f in findings:
        f_dict = copy.deepcopy(f.to_dict() if hasattr(f, "to_dict") else dict(f))
        f_dict["actionId"] = target_action_id
        remapped_findings.append(f_dict)

    return remapped_criteria, remapped_findings


def _find_criterion(criteria: list[Any], criterion_id: str) -> Optional[Any]:
    for c in criteria:
        if getattr(c, "criterion_id", None) == criterion_id:
            return c
    return None


def _is_criterion_insufficient(c: Optional[Any]) -> bool:
    if c is None:
        return False
    status = getattr(c, "status", None)
    status_str = status.value if hasattr(status, "value") else str(status)
    return status_str == CriterionStatus.INSUFFICIENT_EVIDENCE.value


def extract_metric(
    source_obj: Any,
    attr_name: str,
    unit: str,
    criterion: Optional[Any] = None,
    val_type: str = "float",
    round_digits: int = 1,
    evidence_confidence: Optional[float] = None,
    frames_used: Optional[list[int]] = None,
    source: Optional[str] = None,
    method_version: Optional[str] = None,
) -> ActionMetricItem:
    """
    Trích xuất metric an toàn, không bịa dữ liệu giả mạo:
    - Nếu thuộc tính nguồn không tồn tại hoặc là None -> value = None, confidence = None.
    - Nếu criterion tương ứng có status 'insufficient_evidence' -> value = None, confidence = None.
    - Tuyệt đối không dùng 0.0 hay false làm fallback khi thiếu dữ liệu.
    - Từ chối float không hữu hạn (NaN/Inf) bằng cách trả về None.
    """
    if _is_criterion_insufficient(criterion):
        return ActionMetricItem(value=None, unit=unit, confidence=None)

    if not hasattr(source_obj, attr_name):
        return ActionMetricItem(value=None, unit=unit, confidence=None)

    raw_val = getattr(source_obj, attr_name)
    if raw_val is None:
        return ActionMetricItem(value=None, unit=unit, confidence=None)

    if val_type == "float":
        try:
            flt_val = float(raw_val)
            if not math.isfinite(flt_val):
                return ActionMetricItem(value=None, unit=unit, confidence=None)
            val = round(flt_val, round_digits)
        except (ValueError, TypeError):
            return ActionMetricItem(value=None, unit=unit, confidence=None)
    elif val_type == "bool":
        val = bool(raw_val)
    elif val_type == "int":
        try:
            val = int(raw_val)
        except (ValueError, TypeError):
            return ActionMetricItem(value=None, unit=unit, confidence=None)
    else:
        val = str(raw_val)

    conf = None
    if criterion is not None:
        c_conf = getattr(criterion, "confidence", None)
        if c_conf is not None and isinstance(c_conf, (int, float)) and math.isfinite(c_conf) and 0.0 <= c_conf <= 1.0:
            conf = float(c_conf)

    return ActionMetricItem(
        value=val,
        unit=unit,
        confidence=conf,
        evidenceConfidence=evidence_confidence,
        framesUsed=frames_used,
        source=source,
        methodVersion=method_version,
    )


def _resolve_model_version(
    model_version: Optional[str],
    findings_list: list[Any],
) -> Optional[str]:
    """
    Xác định modelVersion theo thứ tự ưu tiên:
    1. model_version do pipeline/process_video truyền vào (nếu khác None và không rỗng sau strip)
       là nguồn ưu tiên cao nhất vì đây là model thực sự đã chạy inference.
    2. Chỉ lấy finding.model_version làm fallback khi model_version là None hoặc chuỗi rỗng.
    3. Nếu cả hai đều không có, trả None (null trong JSON), tuyệt đối không tự mặc định yolov8n-pose.
    """
    if model_version is not None and str(model_version).strip():
        return str(model_version).strip()

    if findings_list:
        for f in findings_list:
            if hasattr(f, "model_version") and f.model_version:
                f_ver = str(f.model_version).strip()
                if f_ver:
                    return f_ver
            elif isinstance(f, dict) and f.get("modelVersion"):
                f_ver = str(f.get("modelVersion")).strip()
                if f_ver:
                    return f_ver

    return None


# ─────────────────────────────────────────────────────────────────────────────
# Rubric Resolution & Assessment Boundary (Task 4)
# ─────────────────────────────────────────────────────────────────────────────

class RubricSelectionError(RuntimeError):
    """
    Lỗi phát sinh khi việc lựa chọn rubric tại assessment boundary thất bại,
    hoặc khi context yêu cầu môn võ cụ thể nhưng hệ thống chưa có rubric/evaluator
    tương ứng, nhằm ngăn chặn việc tạo assessment giả mạo.
    """
    def __init__(self, message: str, selection_result: Optional[RubricSelectionResult] = None):
        super().__init__(message)
        self.selection_result = selection_result


def resolve_action_rubric(
    classified_technique: ClassifiedTechnique,
    analysis_context: Optional[AnalysisContext] = None,
    rubric_registry: Optional[RubricRegistry] = None,
    requested_version: Optional[str] = None,
) -> RubricSelectionResult:
    """
    Ranh giới lựa chọn Rubric cho Action (Assessment Boundary):
    Flow:
      AnalysisContext -> ClassifiedTechnique -> RubricRegistry.select_rubric -> RubricSelectionResult

    Quy tắc tuân thủ Task 4 (§4.6):
    1. Khi analysis_context is None (legacy call style):
       Chọn rubric generic mặc định (RUBRIC_PUNCH_V3 cho punch, RUBRIC_ROUND_KICK_V3 cho kick).
    2. Khi analysis_context có martial_art='generic' (hoặc None):
       Lựa chọn trong generic namespace.
    3. Khi analysis_context có martial_art='unknown':
       Từ chối bằng UNSUPPORTED_MARTIAL_ART, không bao giờ rơi về generic.
    4. Khi analysis_context có môn võ cụ thể (vd: 'boxing', 'muay_thai'):
       Tra cứu registry theo exact martial art.
       Nếu không có rubric hoặc chưa có evaluator cho môn võ đó trong Task 4:
       Trả về structured failure (UNSUPPORTED_MARTIAL_ART / UNSUPPORTED_TECHNIQUE / VERSION_NOT_FOUND),
       TUYỆT ĐỐI KHÔNG giả lập rubric hay gán rubric khác.
    """
    reg = rubric_registry or get_default_rubric_registry()

    if analysis_context is not None and not isinstance(analysis_context, AnalysisContext):
        return RubricSelectionResult(
            status=RubricSelectionStatus.INVALID_CONTEXT,
            reason=f"analysis_context must be an AnalysisContext instance or None, got {type(analysis_context).__name__}.",
            requested_technique=getattr(classified_technique, "technique", None),
            requested_version=str(requested_version) if requested_version is not None else None,
        )

    if analysis_context is None:
        default_tech = "punch" if classified_technique.family == "punch" else "round_kick"
        return reg.select_rubric(context=None, technique=default_tech, version=requested_version)

    if analysis_context.martial_art in (None, MartialArt.GENERIC.value):
        default_tech = "punch" if classified_technique.family == "punch" else "round_kick"
        return reg.select_rubric(context=analysis_context, technique=default_tech, version=requested_version)

    return reg.select_rubric(
        context=analysis_context,
        technique=classified_technique.technique,
        version=requested_version,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Adapters
# ─────────────────────────────────────────────────────────────────────────────

def action_from_punch(
    punch: Any,
    action_id: str,
    source_action_id: str,
    stance: Optional[str] = "unknown",
    model_version: Optional[str] = None,
    rubric_version: Optional[str] = None,
    classified_technique: Optional[ClassifiedTechnique] = None,
    stance_context: Optional[StanceContext] = None,
    analysis_context: Optional[AnalysisContext] = None,
    rubric_registry: Optional[RubricRegistry] = None,
    keypoints_trajectory: Optional[Sequence[Any]] = None,
    fps: float = 30.0,
    execute_shadow_classifier: Optional[bool] = None,
    quality_status: Optional[str] = None,
) -> ActionResult:
    """
    Adapter chuyển đổi một PunchResult sang ActionResult thống nhất.
    Nhận ClassifiedTechnique làm nguồn duy nhất cho:
      family, technique, attackingSide, limbRole, stance, classification confidence.
    Adapter không được tự normalize hoặc phân loại lần thứ hai.
    """
    if classified_technique is None:
        if stance_context is not None:
            ctx = stance_context
        elif stance is not None and normalize_stance(stance) != "unknown":
            ctx = resolve_stance_context(user_stance=stance)
        else:
            ctx = resolve_stance_context()
        classified_technique = classify_punch(punch, ctx)
    else:
        ctx = stance_context or resolve_stance_context(user_stance=stance)

    criteria_list = getattr(punch, "criterion_results", [])
    findings_list = getattr(punch, "findings", [])
    assessment_conf = compute_derived_rubric_confidence(criteria_list)

    # Bản sao độc lập và remap actionId cả criteria và findings
    criteria_dicts, findings_dicts = copy_criteria_and_findings(
        criteria_list, findings_list, target_action_id=action_id
    )

    # Tìm các criterion tương ứng
    crit_ext = _find_criterion(criteria_list, "crit_punch_extension")
    crit_speed = _find_criterion(criteria_list, "crit_punch_speed")
    crit_guard = _find_criterion(criteria_list, "crit_punch_guard")

    # Metrics trích xuất an toàn (không bịa số nếu thiếu evidence)
    metrics: dict[str, ActionMetricItem] = {
        "maxElbowAngle": extract_metric(
            punch, "max_elbow_angle", unit="degree", criterion=crit_ext, val_type="float", round_digits=1
        ),
        "peakSpeed": extract_metric(
            punch, "peak_speed", unit="normalized_image/s", criterion=crit_speed, val_type="float", round_digits=3
        ),
        "guardPreserved": extract_metric(
            punch, "guard_preserved", unit="flag", criterion=crit_guard, val_type="bool"
        ),
    }

    # Rubric Provenance & Assessment Boundary:
    if rubric_version is not None:
        if isinstance(rubric_version, bool) or not isinstance(rubric_version, str):
            raise TypeError(
                f"rubric_version must be a string or None, got {type(rubric_version).__name__}."
            )
        if not rubric_version.strip():
            raise ValueError("rubric_version cannot be empty or whitespace.")

    if analysis_context is not None:
        if not isinstance(analysis_context, AnalysisContext):
            raise TypeError(
                f"analysis_context must be an AnalysisContext instance or None, got {type(analysis_context).__name__}."
            )
        if analysis_context.martial_art == MartialArt.UNKNOWN.value:
            selection = resolve_action_rubric(
                classified_technique=classified_technique,
                analysis_context=analysis_context,
                rubric_registry=rubric_registry,
                requested_version=rubric_version,
            )
            raise RubricSelectionError(
                f"Martial art is 'unknown'; cannot select or stamp rubric for {classified_technique.family} technique '{classified_technique.technique}'.",
                selection_result=selection,
            )
        elif analysis_context.is_discipline_aware():
            selection = resolve_action_rubric(
                classified_technique=classified_technique,
                analysis_context=analysis_context,
                rubric_registry=rubric_registry,
                requested_version=rubric_version,
            )
            raise RubricSelectionError(
                f"Discipline '{analysis_context.martial_art}' requested for punch technique '{classified_technique.technique}', "
                "but no discipline-specific evaluator is integrated in Task 4. Cannot stamp false rubric metadata onto legacy evaluation.",
                selection_result=selection,
            )

    if rubric_version is not None and rubric_version.strip() != RUBRIC_PUNCH_V3.version:
        raise ValueError(
            f"rubric_version override '{rubric_version}' conflicts with actual evaluated rubric version '{RUBRIC_PUNCH_V3.version}'."
        )

    rub_id = RUBRIC_PUNCH_V3.id
    rub_ver = RUBRIC_PUNCH_V3.version
    mod_ver = _resolve_model_version(model_version, findings_list)

    start_f = getattr(punch, "start_frame", 0)
    start_t = getattr(punch, "start_time_ms", 0.0)
    impact_f = getattr(punch, "impact_frame", 0)
    impact_t = getattr(punch, "impact_time_ms", 0.0)
    end_f = getattr(punch, "end_frame", 0)
    end_t = getattr(punch, "end_time_ms", 0.0)

    temporal_seq: Optional[TemporalPhaseSequence] = None
    if keypoints_trajectory is not None and len(keypoints_trajectory) > 0:
        temporal_seq = segment_from_action_result(
            punch,
            fps=fps,
            keypoints_trajectory=keypoints_trajectory,
        )
        b_prep = temporal_seq.boundaries.get("preparation")
        b_launch = temporal_seq.boundaries.get("launch")
        b_peak = temporal_seq.boundaries.get("peak")
        b_rec = temporal_seq.boundaries.get("recovery")

        phases = ActionPhases(
            startFrame=b_prep.frame_idx if (b_prep and b_prep.frame_idx is not None) else start_f,
            chamberFrame=None,
            launchFrame=b_launch.frame_idx if (b_launch and b_launch.evidence.level != EvidenceLevel.UNAVAILABLE) else None,
            peakFrame=b_peak.frame_idx if (b_peak and b_peak.evidence.level != EvidenceLevel.UNAVAILABLE) else None,
            impactFrame=b_peak.frame_idx if (b_peak and b_peak.frame_idx is not None) else impact_f,
            endFrame=b_rec.frame_idx if (b_rec and b_rec.frame_idx is not None) else end_f,
            startTimeMs=b_prep.time_ms if (b_prep and b_prep.time_ms is not None) else start_t,
            chamberTimeMs=None,
            launchTimeMs=b_launch.time_ms if (b_launch and b_launch.evidence.level != EvidenceLevel.UNAVAILABLE) else None,
            peakTimeMs=b_peak.time_ms if (b_peak and b_peak.evidence.level != EvidenceLevel.UNAVAILABLE) else None,
            impactTimeMs=b_peak.time_ms if (b_peak and b_peak.time_ms is not None) else impact_t,
            endTimeMs=b_rec.time_ms if (b_rec and b_rec.time_ms is not None) else end_t,
            impactType=temporal_seq.impact_type,
        )
    else:
        phases = ActionPhases(
            startFrame=start_f,
            chamberFrame=None,
            launchFrame=None,
            peakFrame=None,
            impactFrame=impact_f,
            endFrame=end_f,
            startTimeMs=start_t,
            chamberTimeMs=None,
            launchTimeMs=None,
            peakTimeMs=None,
            impactTimeMs=impact_t,
            endTimeMs=end_t,
            impactType="peak_extension_proxy",
        )

    # Kinematics Feature Extraction (Task 7)
    kinematics: Optional[KinematicFeatureSet] = None
    if keypoints_trajectory is not None and len(keypoints_trajectory) > 0:
        win_start = max(0, start_f)
        win_end = min(end_f + 1, len(keypoints_trajectory))
        window_frames = keypoints_trajectory[win_start:win_end]
        kinematics = extract_kinematic_features(
            frames=window_frames,
            action_family="punch",
            arm_side=classified_technique.attacking_side,
            stance=ctx.resolved_stance,
            temporal_phases=temporal_seq,
        )
        if kinematics is not None and hasattr(kinematics, "metrics"):
            for m_name, m_contract in kinematics.metrics.items():
                if m_name not in metrics or metrics[m_name].value is None:
                    val = getattr(m_contract, "value", None)
                    unit = getattr(m_contract, "unit", "ratio")
                    conf = getattr(m_contract, "confidence", None)
                    ev_conf = getattr(m_contract, "evidence_confidence", getattr(m_contract, "evidenceConfidence", None))
                    frames_u = getattr(m_contract, "frames_used", getattr(m_contract, "framesUsed", None))
                    src = getattr(m_contract, "source", None) or "kinematic_features"
                    meth_ver = getattr(m_contract, "method_version", getattr(m_contract, "methodVersion", None))
                    metrics[m_name] = ActionMetricItem(
                        value=val,
                        unit=unit,
                        confidence=conf,
                        evidenceConfidence=ev_conf,
                        framesUsed=list(frames_u) if frames_u is not None else None,
                        source=src,
                        methodVersion=meth_ver,
                    )

    # Shadow Classification (Task 8)
    should_run_shadow = (
        execute_shadow_classifier is True
        or (execute_shadow_classifier is None and keypoints_trajectory is not None)
    )
    shadow_classification: Optional[dict[str, Any]] = None
    if should_run_shadow:
        shadow_classifier = ShadowMultiPunchClassifier()
        decision = shadow_classifier.classify(
            features=kinematics,
            stance_context=ctx,
        )
        shadow_classification = decision.to_dict()

    # Task 5 Assessment Engine Integration:
    # Pass punch only as transient raw_action (not stored in AssessmentInput or AssessmentResult)
    eval_tech = (
        classified_technique.technique
        if classified_technique.technique in {"cross", "jab", "hook", "straight_punch", "punch"}
        else "punch"
    )
    eff_quality = None
    if quality_status is not None:
        eff_quality = str(quality_status).upper()
    elif hasattr(punch, "quality_status") and getattr(punch, "quality_status"):
        eff_quality = str(getattr(punch, "quality_status")).upper()
    elif analysis_context is not None and hasattr(analysis_context, "quality_status") and getattr(analysis_context, "quality_status"):
        eff_quality = str(getattr(analysis_context, "quality_status")).upper()

    assessment_res = evaluate_action(
        action_or_input=punch,
        technique=eval_tech,
        context=analysis_context,
        requested_version=rubric_version,
        raw_action=punch,
        quality_status=eff_quality,
    )

    if eff_quality in ("BLOCKED", "DEGRADED"):
        criteria_dicts = []
        for c in assessment_res.criteria:
            c_dict = copy.deepcopy(c.to_dict() if hasattr(c, "to_dict") else dict(c))
            c_dict["actionId"] = action_id
            criteria_dicts.append(c_dict)

    if eff_quality == "BLOCKED":
        for k in list(metrics.keys()):
            metrics[k] = ActionMetricItem(value=None, unit=metrics[k].unit, confidence=None)

    status_str = (
        assessment_res.status.value
        if hasattr(assessment_res.status, "value")
        else str(assessment_res.status)
    )

    assessment = ActionAssessment(
        rubricId=assessment_res.provenance.rubric_id,
        score=assessment_res.score,
        grade=assessment_res.grade,
        status=status_str,
        primaryError=assessment_res.primary_error,
        criteria=criteria_dicts,
        findings=findings_dicts,
    )

    return ActionResult(
        id=action_id,
        sourceActionId=source_action_id,
        family=classified_technique.family,
        technique=classified_technique.technique,
        attackingSide=classified_technique.attacking_side,
        limbRole=classified_technique.limb_role,
        stance=classified_technique.stance,
        confidence=ActionConfidence(
            detection=None,
            classification=classified_technique.confidence,
            assessment=assessment_res.assessment_confidence,
        ),
        phases=phases,
        metrics=metrics,
        assessment=assessment,
        review=ActionReview(),
        modelVersion=mod_ver,
        rubricVersion=assessment_res.provenance.rubric_version,
        shadowClassification=shadow_classification,
    )


def action_from_kick(
    kick: Any,
    action_id: str,
    source_action_id: str,
    stance: Optional[str] = "unknown",
    model_version: Optional[str] = None,
    rubric_version: Optional[str] = None,
    classified_technique: Optional[ClassifiedTechnique] = None,
    stance_context: Optional[StanceContext] = None,
    analysis_context: Optional[AnalysisContext] = None,
    rubric_registry: Optional[RubricRegistry] = None,
    keypoints_trajectory: Optional[Sequence[Any]] = None,
    fps: float = 30.0,
    execute_shadow_classifier: Optional[bool] = None,
    quality_status: Optional[str] = None,
) -> ActionResult:
    """
    Adapter chuyển đổi một KickResult sang ActionResult thống nhất.
    Nhận ClassifiedTechnique làm nguồn duy nhất cho:
      family, technique, attackingSide, limbRole, stance, classification confidence.
    Adapter không được tự normalize hoặc phân loại lần thứ hai.
    """
    if classified_technique is None:
        if stance_context is not None:
            ctx = stance_context
        elif stance is not None and normalize_stance(stance) != "unknown":
            ctx = resolve_stance_context(user_stance=stance)
        else:
            ctx = resolve_stance_context()
        classified_technique = classify_kick(kick, ctx)
    else:
        ctx = stance_context or resolve_stance_context(user_stance=stance)

    criteria_list = getattr(kick, "criterion_results", [])
    findings_list = getattr(kick, "findings", [])
    assessment_conf = compute_derived_rubric_confidence(criteria_list)

    # Bản sao độc lập và remap actionId cả criteria và findings
    criteria_dicts, findings_dicts = copy_criteria_and_findings(
        criteria_list, findings_list, target_action_id=action_id, family="kick"
    )

    # Tìm các criterion tương ứng
    crit_cham = _find_criterion(criteria_list, "crit_kick_chamber")
    crit_ext = _find_criterion(criteria_list, "crit_kick_extension")
    crit_speed = _find_criterion(criteria_list, "crit_kick_speed")

    # Metrics trích xuất an toàn (không bịa số nếu thiếu evidence)
    metrics: dict[str, ActionMetricItem] = {
        "minChamberAngle": extract_metric(
            kick, "min_chamber_angle", unit="degree", criterion=crit_cham, val_type="float", round_digits=1
        ),
        "maxExtensionAngle": extract_metric(
            kick, "max_extension_angle", unit="degree", criterion=crit_ext, val_type="float", round_digits=1
        ),
        "peakSpeed": extract_metric(
            kick, "peak_speed", unit="normalized_image/s", criterion=crit_speed, val_type="float", round_digits=3
        ),
    }

    # Rubric Provenance & Assessment Boundary:
    if rubric_version is not None:
        if isinstance(rubric_version, bool) or not isinstance(rubric_version, str):
            raise TypeError(
                f"rubric_version must be a string or None, got {type(rubric_version).__name__}."
            )
        if not rubric_version.strip():
            raise ValueError("rubric_version cannot be empty or whitespace.")

    if analysis_context is not None:
        if not isinstance(analysis_context, AnalysisContext):
            raise TypeError(
                f"analysis_context must be an AnalysisContext instance or None, got {type(analysis_context).__name__}."
            )
        if analysis_context.martial_art == MartialArt.UNKNOWN.value:
            selection = resolve_action_rubric(
                classified_technique=classified_technique,
                analysis_context=analysis_context,
                rubric_registry=rubric_registry,
                requested_version=rubric_version,
            )
            raise RubricSelectionError(
                f"Martial art is 'unknown'; cannot select or stamp rubric for {classified_technique.family} technique '{classified_technique.technique}'.",
                selection_result=selection,
            )
        elif analysis_context.is_discipline_aware():
            selection = resolve_action_rubric(
                classified_technique=classified_technique,
                analysis_context=analysis_context,
                rubric_registry=rubric_registry,
                requested_version=rubric_version,
            )
            raise RubricSelectionError(
                f"Discipline '{analysis_context.martial_art}' requested for kick technique '{classified_technique.technique}', "
                "but no discipline-specific evaluator is integrated in Task 4. Cannot stamp false rubric metadata onto legacy evaluation.",
                selection_result=selection,
            )

    if rubric_version is not None and rubric_version.strip() != RUBRIC_ROUND_KICK_V3.version:
        raise ValueError(
            f"rubric_version override '{rubric_version}' conflicts with actual evaluated rubric version '{RUBRIC_ROUND_KICK_V3.version}'."
        )

    rub_id = RUBRIC_ROUND_KICK_V3.id
    rub_ver = RUBRIC_ROUND_KICK_V3.version
    mod_ver = _resolve_model_version(model_version, findings_list)

    start_f = getattr(kick, "start_frame", 0)
    start_t = getattr(kick, "start_time_ms", 0.0)
    impact_f = getattr(kick, "impact_frame", 0)
    impact_t = getattr(kick, "impact_time_ms", 0.0)
    end_f = getattr(kick, "end_frame", 0)
    end_t = getattr(kick, "end_time_ms", 0.0)
    chamber_peak_frame = getattr(kick, "chamber_peak_frame", 0)
    chamber_peak_time_ms = getattr(kick, "chamber_peak_time_ms", 0.0)
    chamber_frame_val = chamber_peak_frame if chamber_peak_frame > 0 else None
    chamber_time_val = chamber_peak_time_ms if chamber_peak_frame > 0 else None

    temporal_seq: Optional[TemporalPhaseSequence] = None
    if keypoints_trajectory is not None and len(keypoints_trajectory) > 0:
        temporal_seq = segment_from_action_result(
            kick,
            fps=fps,
            keypoints_trajectory=keypoints_trajectory,
        )
        b_prep = temporal_seq.boundaries.get("preparation")
        b_launch = temporal_seq.boundaries.get("launch")
        b_peak = temporal_seq.boundaries.get("peak")
        b_rec = temporal_seq.boundaries.get("recovery")

        phases = ActionPhases(
            startFrame=b_prep.frame_idx if (b_prep and b_prep.frame_idx is not None) else start_f,
            chamberFrame=chamber_frame_val,
            launchFrame=b_launch.frame_idx if (b_launch and b_launch.evidence.level != EvidenceLevel.UNAVAILABLE) else None,
            peakFrame=b_peak.frame_idx if (b_peak and b_peak.evidence.level != EvidenceLevel.UNAVAILABLE) else None,
            impactFrame=b_peak.frame_idx if (b_peak and b_peak.frame_idx is not None) else impact_f,
            endFrame=b_rec.frame_idx if (b_rec and b_rec.frame_idx is not None) else end_f,
            startTimeMs=b_prep.time_ms if (b_prep and b_prep.time_ms is not None) else start_t,
            chamberTimeMs=chamber_time_val,
            launchTimeMs=b_launch.time_ms if (b_launch and b_launch.evidence.level != EvidenceLevel.UNAVAILABLE) else None,
            peakTimeMs=b_peak.time_ms if (b_peak and b_peak.evidence.level != EvidenceLevel.UNAVAILABLE) else None,
            impactTimeMs=b_peak.time_ms if (b_peak and b_peak.time_ms is not None) else impact_t,
            endTimeMs=b_rec.time_ms if (b_rec and b_rec.time_ms is not None) else end_t,
            impactType=temporal_seq.impact_type,
        )
    else:
        phases = ActionPhases(
            startFrame=start_f,
            chamberFrame=chamber_frame_val,
            launchFrame=None,
            peakFrame=None,
            impactFrame=impact_f,
            endFrame=end_f,
            startTimeMs=start_t,
            chamberTimeMs=chamber_time_val,
            launchTimeMs=None,
            peakTimeMs=None,
            impactTimeMs=impact_t,
            endTimeMs=end_t,
            impactType="max_extension_proxy",
        )

    # Kinematics Feature Extraction (Task 7)
    kinematics: Optional[KinematicFeatureSet] = None
    if keypoints_trajectory is not None and len(keypoints_trajectory) > 0:
        win_start = max(0, start_f)
        win_end = min(end_f + 1, len(keypoints_trajectory))
        window_frames = keypoints_trajectory[win_start:win_end]
        kinematics = extract_kinematic_features(
            frames=window_frames,
            action_family="kick",
            arm_side=classified_technique.attacking_side,
            stance=ctx.resolved_stance,
            temporal_phases=temporal_seq,
        )
        if kinematics is not None and hasattr(kinematics, "metrics"):
            for m_name, m_contract in kinematics.metrics.items():
                if m_name not in metrics or metrics[m_name].value is None:
                    val = getattr(m_contract, "value", None)
                    unit = getattr(m_contract, "unit", "ratio")
                    conf = getattr(m_contract, "confidence", None)
                    ev_conf = getattr(m_contract, "evidence_confidence", getattr(m_contract, "evidenceConfidence", None))
                    frames_u = getattr(m_contract, "frames_used", getattr(m_contract, "framesUsed", None))
                    src = getattr(m_contract, "source", None) or "kinematic_features"
                    meth_ver = getattr(m_contract, "method_version", getattr(m_contract, "methodVersion", None))
                    metrics[m_name] = ActionMetricItem(
                        value=val,
                        unit=unit,
                        confidence=conf,
                        evidenceConfidence=ev_conf,
                        framesUsed=list(frames_u) if frames_u is not None else None,
                        source=src,
                        methodVersion=meth_ver,
                    )

    # Task 5 Assessment Engine Integration:
    # Pass kick only as transient raw_action (not stored in AssessmentInput or AssessmentResult)
    eval_tech = (
        classified_technique.technique
        if classified_technique.technique in {"round_kick", "kick"}
        else "round_kick"
    )
    eff_quality = None
    if quality_status is not None:
        eff_quality = str(quality_status).upper()
    elif hasattr(kick, "quality_status") and getattr(kick, "quality_status"):
        eff_quality = str(getattr(kick, "quality_status")).upper()
    elif analysis_context is not None and hasattr(analysis_context, "quality_status") and getattr(analysis_context, "quality_status"):
        eff_quality = str(getattr(analysis_context, "quality_status")).upper()

    assessment_res = evaluate_action(
        action_or_input=kick,
        technique=eval_tech,
        context=analysis_context,
        requested_version=rubric_version,
        raw_action=kick,
        quality_status=eff_quality,
    )

    if eff_quality in ("BLOCKED", "DEGRADED"):
        criteria_dicts = []
        for c in assessment_res.criteria:
            c_dict = copy.deepcopy(c.to_dict() if hasattr(c, "to_dict") else dict(c))
            c_dict["actionId"] = action_id
            criteria_dicts.append(c_dict)

    if eff_quality == "BLOCKED":
        for k in list(metrics.keys()):
            metrics[k] = ActionMetricItem(value=None, unit=metrics[k].unit, confidence=None)

    status_str = (
        assessment_res.status.value
        if hasattr(assessment_res.status, "value")
        else str(assessment_res.status)
    )

    assessment = ActionAssessment(
        rubricId=assessment_res.provenance.rubric_id,
        score=assessment_res.score,
        grade=assessment_res.grade,
        status=status_str,
        primaryError=assessment_res.primary_error,
        criteria=criteria_dicts,
        findings=findings_dicts,
    )

    # Shadow Classification (Task 16)
    should_run_shadow = (
        execute_shadow_classifier is True
        or (execute_shadow_classifier is None and keypoints_trajectory is not None)
    )
    shadow_classification: Optional[dict[str, Any]] = None
    if should_run_shadow:
        shadow_classifier = ShadowKickClassifier()
        has_cham = (phases.chamberFrame is not None) or (chamber_frame_val is not None)
        has_ext = (phases.peakFrame is not None) or (impact_f > 0)
        kick_features: dict[str, Any] = {
            "attacking_side": classified_technique.attacking_side,
            "has_chamber_phase": has_cham,
            "has_extension_phase": has_ext,
            "hip_rotation_angle": None,
            "forward_trajectory_linearity": None,
            "arc_curvature": None,
            "lateral_displacement_ratio": None,
            "torso_lean_angle": None,
        }
        if kinematics is not None and hasattr(kinematics, "metrics"):
            m = kinematics.metrics
            if "hip_rotation" in m or "hip_rotation_angle" in m:
                val = _unwrap_value(m.get("hip_rotation") or m.get("hip_rotation_angle"))
                if val is not None:
                    kick_features["hip_rotation_angle"] = val
            if "forward_trajectory_linearity" in m or "trajectory_directness" in m:
                val = _unwrap_value(m.get("forward_trajectory_linearity") or m.get("trajectory_directness"))
                if val is not None:
                    kick_features["forward_trajectory_linearity"] = val
            if "arc_curvature" in m or "tangential_curvature" in m:
                val = _unwrap_value(m.get("arc_curvature") or m.get("tangential_curvature"))
                if val is not None:
                    kick_features["arc_curvature"] = val
            if "lateral_displacement_ratio" in m:
                val = _unwrap_value(m.get("lateral_displacement_ratio"))
                if val is not None:
                    kick_features["lateral_displacement_ratio"] = val
            if "torso_lean_angle" in m or "torso_lean" in m or "trunk_lean_angle" in m:
                val = _unwrap_value(m.get("torso_lean_angle") or m.get("torso_lean") or m.get("trunk_lean_angle"))
                if val is not None:
                    kick_features["torso_lean_angle"] = val

        decision = shadow_classifier.classify(
            features=kick_features,
            stance_context=ctx,
        )
        shadow_classification = decision.to_dict()

    return ActionResult(
        id=action_id,
        sourceActionId=source_action_id,
        family=classified_technique.family,
        technique=classified_technique.technique,
        attackingSide=classified_technique.attacking_side,
        limbRole=classified_technique.limb_role,
        stance=classified_technique.stance,
        confidence=ActionConfidence(
            detection=None,
            classification=classified_technique.confidence,
            assessment=assessment_res.assessment_confidence,
        ),
        phases=phases,
        metrics=metrics,
        assessment=assessment,
        review=ActionReview(),
        modelVersion=mod_ver,
        rubricVersion=assessment_res.provenance.rubric_version,
        shadowClassification=shadow_classification,
    )


def build_actions_list(
    punches: list[Any],
    kicks: list[Any],
    stance: Optional[str] = None,
    model_version: Optional[str] = None,
    rubric_version: Optional[str] = None,
    stance_context: Optional[StanceContext] = None,
    analysis_context: Optional[AnalysisContext] = None,
    rubric_registry: Optional[RubricRegistry] = None,
    keypoints_trajectory: Optional[Sequence[Any]] = None,
    fps: float = 30.0,
    execute_shadow_classifier: Optional[bool] = None,
    quality_status: Optional[str] = None,
) -> list[ActionResult]:
    """
    Tập hợp danh sách PunchResult và KickResult, sắp xếp với tie-breaker đầy đủ:
      impactTimeMs -> impactFrame -> startTimeMs -> family -> sourceActionId
    Đánh số action ID duy nhất và deterministic trong revision (action_001, action_002, ...).

    Quy tắc phân giải stance:
    1. stance_context được ưu tiên cao nhất nếu được truyền vào.
    2. Nếu không có context: nếu stance hợp lệ khác unknown, bọc thành user-declared context.
    3. Nếu cả hai thiếu hoặc unknown: tạo unknown context.

    Quy tắc phân giải rubric:
    - analysis_context được truyền xuống action_from_punch / action_from_kick.
    - Nếu analysis_context là None: giữ nguyên hành vi legacy tương thích 100%.
    """
    if analysis_context is not None and not isinstance(analysis_context, AnalysisContext):
        raise TypeError(
            f"analysis_context must be an AnalysisContext instance or None, got {type(analysis_context).__name__}."
        )
    if rubric_version is not None:
        if isinstance(rubric_version, bool) or not isinstance(rubric_version, str):
            raise TypeError(
                f"rubric_version must be a string or None, got {type(rubric_version).__name__}."
            )
        if not rubric_version.strip():
            raise ValueError("rubric_version cannot be empty or whitespace.")

    if stance_context is not None:
        ctx = stance_context
    elif stance is not None and normalize_stance(stance) != "unknown":
        ctx = resolve_stance_context(user_stance=stance)
    else:
        ctx = resolve_stance_context()

    raw_items: list[tuple[Any, str, str]] = []

    for i, p in enumerate(punches):
        source_id = f"punch_{i + 1}"
        if getattr(p, "findings", None):
            first_f = p.findings[0]
            if hasattr(first_f, "action_id") and first_f.action_id:
                source_id = first_f.action_id
        raw_items.append((p, ActionFamily.PUNCH.value, source_id))

    for j, k in enumerate(kicks):
        source_id = f"kick_{j + 1}"
        if getattr(k, "findings", None):
            first_f = k.findings[0]
            if hasattr(first_f, "action_id") and first_f.action_id:
                source_id = first_f.action_id
        raw_items.append((k, ActionFamily.KICK.value, source_id))

    # Tie-breaker: impactTimeMs -> impactFrame -> startTimeMs -> family -> sourceActionId
    def sort_key(item: tuple[Any, str, str]) -> tuple[float, int, float, str, str]:
        obj, family, source_id = item
        impact_t = getattr(obj, "impact_time_ms", 0.0)
        impact_f = getattr(obj, "impact_frame", 0)
        start_t = getattr(obj, "start_time_ms", 0.0)
        return (impact_t, impact_f, start_t, family, source_id)

    raw_items.sort(key=sort_key)

    actions: list[ActionResult] = []
    for idx, (item, family, source_id) in enumerate(raw_items):
        action_id = f"action_{idx + 1:03d}"
        if family == ActionFamily.PUNCH.value:
            ct = classify_punch(item, ctx)
            action = action_from_punch(
                punch=item,
                action_id=action_id,
                source_action_id=source_id,
                stance=ctx.resolved_stance,
                model_version=model_version,
                rubric_version=rubric_version,
                classified_technique=ct,
                stance_context=ctx,
                analysis_context=analysis_context,
                rubric_registry=rubric_registry,
                keypoints_trajectory=keypoints_trajectory,
                fps=fps,
                execute_shadow_classifier=execute_shadow_classifier,
                quality_status=quality_status,
            )
        else:
            ct = classify_kick(item, ctx)
            action = action_from_kick(
                kick=item,
                action_id=action_id,
                source_action_id=source_id,
                stance=ctx.resolved_stance,
                model_version=model_version,
                rubric_version=rubric_version,
                classified_technique=ct,
                stance_context=ctx,
                analysis_context=analysis_context,
                rubric_registry=rubric_registry,
                keypoints_trajectory=keypoints_trajectory,
                fps=fps,
                execute_shadow_classifier=execute_shadow_classifier,
                quality_status=quality_status,
            )
        actions.append(action)

    return actions
