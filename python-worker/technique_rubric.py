"""
technique_rubric.py — MMA-TMS Technique Rubric Engine & Evidence Tracking
Tuân thủ tiêu chuẩn MMA-TMS Master Specification v3.0 (Mục 05.5, 08, 09.5, 10, 13.2).

Bao gồm:
  - TechniqueFinding: Chuỗi bằng chứng đầy đủ (Evidence Chain)
  - CriterionResult: Kết quả đánh giá từng tiêu chí
  - TechniqueCriterion & TechniqueRubric: Bảng tiêu chí chuyên gia (Expert Rubric)
  - Bộ Rubric chuẩn hóa v3.0: Round Kick, Jab, Cross, Hook
  - Công thức tính điểm có trọng số (Weighted Rubric Scoring) kết hợp Evidence Gating
"""

import math
import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Iterable, Optional, Sequence

from rubric_primitives import (
    VALID_MARTIAL_ARTS,
    SEMVER_REGEX,
)


class CriterionStatus(str, Enum):
    EXCELLENT = "excellent"
    GOOD = "good"
    NEEDS_WORK = "needs_work"
    INSUFFICIENT_EVIDENCE = "insufficient_evidence"


@dataclass
class TechniqueFinding:
    """
    Thực thể Finding theo MMA-TMS Master Specification v3.0 (Mục 05.5 FR-AI-007, FR-AI-008 & Mục 08).
    Đảm bảo tính truy xuất nguồn gốc bằng chứng (Evidence Traceability):
      Insight -> Finding -> Metric -> Phase -> Action -> PoseData -> Video Frame
    """
    id: str
    category: str                           # "technique" | "guard" | "speed" | "posture" | "biomechanics"
    title: str                              # Tiêu đề phát hiện
    description: str                        # Mô tả sinh cơ học chi tiết
    severity: str                           # "positive" | "info" | "warning" | "critical"
    confidence: float                       # Độ tin cậy (0.0 - 1.0)
    frame_idx: int                          # Primary keyframe (tương thích ngược với frontend)
    time_ms: float                          # Primary timestamp (ms)
    metric_name: str                        # Tên metric (e.g., "maxElbowAngle", "minChamberAngle")
    metric_value: float                     # Giá trị đo lường
    recommendation: str                     # Lời khuyên cải thiện kỹ thuật

    # Mở rộng chuẩn Spec v3.0:
    action_id: str = ""                     # ID hành động (e.g. "kick_1", "punch_2")
    phase: str = "impact"                   # "chamber" | "extension" | "impact" | "retract" | "guard"
    metric_unit: str = "degrees"            # "degrees" | "u/s" | "ms" | "ratio" | "flag"
    evidence_frame_start: int = 0
    evidence_frame_end: int = 0
    evidence_timestamp_start_ms: float = 0.0
    evidence_timestamp_end_ms: float = 0.0
    affected_body_part: str = "body"        # e.g., "right_elbow", "left_knee", "opposite_guard"
    model_version: str = "yolov8n-pose"
    scoring_version: str = "rubric-v3.0.0"

    def to_dict(self) -> dict:
        return {
            # Các trường hiện hành frontend đang render (tương thích 100%)
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
            # Các trường mở rộng theo Master Spec v3.0
            "actionId": self.action_id,
            "phase": self.phase,
            "metricUnit": self.metric_unit,
            "evidenceFrameStart": self.evidence_frame_start,
            "evidenceFrameEnd": self.evidence_frame_end,
            "evidenceTimestampStartMs": round(self.evidence_timestamp_start_ms, 1),
            "evidenceTimestampEndMs": round(self.evidence_timestamp_end_ms, 1),
            "affectedBodyPart": self.affected_body_part,
            "modelVersion": self.model_version,
            "scoringVersion": self.scoring_version,
        }


@dataclass
class CriterionResult:
    """
    Kết quả đánh giá định lượng cho một tiêu chí cụ thể (Mục 09.5 & 13.2).
    """
    criterion_id: str
    criterion_name: str
    phase: str
    feature_name: str
    observed_value: float
    score: float                            # 0.0 - 100.0
    weight: float                           # Trọng số tiêu chí (e.g., 0.35)
    confidence: float                       # 0.0 - 1.0
    status: str                             # "excellent" | "good" | "needs_work" | "insufficient_evidence"
    evidence_frame_start: int
    evidence_frame_end: int
    evidence_timestamp_start_ms: float
    evidence_timestamp_end_ms: float
    affected_body_part: str
    detail: str                             # Dòng đánh giá tóm tắt có emoji
    finding: Optional[TechniqueFinding] = None

    def to_dict(self) -> dict:
        return {
            "criterionId": self.criterion_id,
            "criterionName": self.criterion_name,
            "phase": self.phase,
            "featureName": self.feature_name,
            "observedValue": round(self.observed_value, 2),
            "score": round(self.score, 1),
            "weight": self.weight,
            "confidence": round(self.confidence, 2),
            "status": self.status,
            "evidenceFrameStart": self.evidence_frame_start,
            "evidenceFrameEnd": self.evidence_frame_end,
            "evidenceTimestampStartMs": round(self.evidence_timestamp_start_ms, 1),
            "evidenceTimestampEndMs": round(self.evidence_timestamp_end_ms, 1),
            "affectedBodyPart": self.affected_body_part,
            "detail": self.detail,
        }


VALID_RUBRIC_STATUSES = {"DRAFT", "VALIDATED", "DEPRECATED"}
VALID_SCORING_METHODS = {"WEIGHTED_SUM"}
VALID_SOURCE_TYPES = {"EXPERT_DEFINED", "FEDERATION_STANDARD", "DATA_DRIVEN"}
IDENTIFIER_REGEX = re.compile(r"^[a-z][a-z0-9_]*$")


@dataclass(frozen=True)
class TechniqueCriterion:
    """Định nghĩa tiêu chí trong bảng Rubric chuyên gia (Bất biến / Frozen)."""
    id: str
    name: str
    description: str
    feature_name: str
    phase: str
    weight: float
    required_confidence: float = 0.30
    evaluation_method: str = "threshold"

    def __post_init__(self) -> None:
        for field_name in ("id", "name", "feature_name", "phase", "evaluation_method"):
            val = getattr(self, field_name)
            if isinstance(val, bool) or not isinstance(val, str):
                raise TypeError(f"TechniqueCriterion.{field_name} must be a string, got {type(val).__name__}.")
            if not val.strip():
                raise ValueError(f"TechniqueCriterion.{field_name} must be a non-empty string.")

        # Invariant: weight phải là số dương hữu hạn, không nhận bool, NaN hoặc Infinity
        if isinstance(self.weight, bool) or not isinstance(self.weight, (int, float)):
            raise ValueError(f"TechniqueCriterion.weight must be a finite number, got {self.weight!r}.")
        if math.isnan(self.weight) or math.isinf(self.weight) or self.weight <= 0.0:
            raise ValueError(f"TechniqueCriterion.weight must be positive and finite, got {self.weight}.")

        # Invariant: required_confidence phải là số trong đoạn [0.0, 1.0], không nhận bool, NaN hoặc Infinity
        if isinstance(self.required_confidence, bool) or not isinstance(self.required_confidence, (int, float)):
            raise ValueError(f"TechniqueCriterion.required_confidence must be a number, got {self.required_confidence!r}.")
        if math.isnan(self.required_confidence) or math.isinf(self.required_confidence) or not (0.0 <= self.required_confidence <= 1.0):
            raise ValueError(f"TechniqueCriterion.required_confidence must be in [0.0, 1.0], got {self.required_confidence}.")


@dataclass(frozen=True)
class TechniqueRubric:
    """
    Bảng tiêu chí chuẩn hóa do chuyên gia định nghĩa (Expert-defined Rubric).
    Bất biến (frozen=True).
    Canonical identity:
      id, martial_art, technique, version, status, source_type, criteria.
    Tương thích ngược:
      Hỗ trợ alias 'technique_type' cả trong constructor và property access.
      'technique' là trường canonical duy nhất, không tạo hai nguồn chân lý.
    """
    id: str
    technique: str
    martial_art: str = "generic"
    version: str = "3.0.0"
    status: str = "VALIDATED"
    source_type: str = "EXPERT_DEFINED"
    expert_reference: str = "MMA-TMS Expert Biomechanics Panel 2026"
    scoring_method: str = "WEIGHTED_SUM"
    criteria: tuple[TechniqueCriterion, ...] = ()
    technique_type: str = ""

    def __init__(
        self,
        id: str,
        technique: Optional[str] = None,
        version: str = "3.0.0",
        status: str = "VALIDATED",
        source_type: str = "EXPERT_DEFINED",
        expert_reference: str = "MMA-TMS Expert Biomechanics Panel 2026",
        scoring_method: str = "WEIGHTED_SUM",
        criteria: Iterable[TechniqueCriterion] = (),
        martial_art: str = "generic",
        technique_type: Optional[str] = None,
    ) -> None:
        # Validate id
        if isinstance(id, bool) or not isinstance(id, str):
            raise TypeError(f"TechniqueRubric.id must be a string, got {type(id).__name__}.")
        if not id.strip():
            raise ValueError("TechniqueRubric.id must be a non-empty string.")

        # Validate martial_art in taxonomy
        if isinstance(martial_art, bool) or not isinstance(martial_art, str):
            raise TypeError(f"TechniqueRubric.martial_art must be a string, got {type(martial_art).__name__}.")
        norm_ma = martial_art.strip().lower()
        if not norm_ma:
            raise ValueError("TechniqueRubric.martial_art cannot be empty or whitespace.")
        if norm_ma not in VALID_MARTIAL_ARTS:
            raise ValueError(
                f"TechniqueRubric.martial_art '{martial_art}' is not recognized in martial art taxonomy. "
                f"Must be one of {sorted(VALID_MARTIAL_ARTS)}."
            )

        # Validate version as strict SemVer 2.0.0
        if isinstance(version, bool) or not isinstance(version, str):
            raise TypeError(f"TechniqueRubric.version must be a string, got {type(version).__name__}.")
        ver_clean = version.strip()
        if not ver_clean:
            raise ValueError("TechniqueRubric.version cannot be empty or whitespace.")
        if not SEMVER_REGEX.match(ver_clean):
            raise ValueError(
                f"TechniqueRubric.version '{version}' is not a valid SemVer 2.0.0 string. "
                "Expected 'MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]'."
            )

        # Validate technique & technique_type (reject non-string/empty types even if alias is provided)
        if technique is not None:
            if isinstance(technique, bool) or not isinstance(technique, str):
                raise TypeError(f"TechniqueRubric.technique must be a string, got {type(technique).__name__}.")
            if not technique.strip():
                raise ValueError("TechniqueRubric.technique cannot be empty.")
        if technique_type is not None:
            if isinstance(technique_type, bool) or not isinstance(technique_type, str):
                raise TypeError(f"TechniqueRubric.technique_type must be a string, got {type(technique_type).__name__}.")
            if not technique_type.strip():
                raise ValueError("TechniqueRubric.technique_type cannot be empty.")
        if technique is None and technique_type is None:
            raise ValueError(f"TechniqueRubric.technique must be provided for rubric '{id}'.")

        t = technique.strip().lower() if technique is not None else None
        tt = technique_type.strip().lower() if technique_type is not None else None

        if t and tt and t != tt:
            raise ValueError(
                f"Conflicting technique ('{technique}') and technique_type ('{technique_type}') in rubric '{id}'."
            )
        canon_tech = t or tt
        if not canon_tech or not IDENTIFIER_REGEX.match(canon_tech):
            raise ValueError(
                f"Technique identifier '{canon_tech}' in rubric '{id}' is invalid. "
                "Must match '^[a-z][a-z0-9_]*$'."
            )

        # Validate status
        if isinstance(status, bool) or not isinstance(status, str):
            raise TypeError(f"TechniqueRubric.status must be a string, got {type(status).__name__}.")
        status_clean = status.strip()
        if status_clean not in VALID_RUBRIC_STATUSES:
            raise ValueError(
                f"TechniqueRubric.status must be one of {sorted(VALID_RUBRIC_STATUSES)}, got '{status}'."
            )

        # Validate scoring_method
        if isinstance(scoring_method, bool) or not isinstance(scoring_method, str):
            raise TypeError(f"TechniqueRubric.scoring_method must be a string, got {type(scoring_method).__name__}.")
        scoring_clean = scoring_method.strip()
        if scoring_clean not in VALID_SCORING_METHODS:
            raise ValueError(
                f"TechniqueRubric.scoring_method must be one of {sorted(VALID_SCORING_METHODS)}, got '{scoring_method}'."
            )

        # Validate source_type
        if isinstance(source_type, bool) or not isinstance(source_type, str):
            raise TypeError(f"TechniqueRubric.source_type must be a string, got {type(source_type).__name__}.")
        norm_source = source_type.strip()
        if not norm_source:
            raise ValueError("TechniqueRubric.source_type cannot be empty or whitespace.")
        if norm_source not in VALID_SOURCE_TYPES:
            raise ValueError(
                f"TechniqueRubric.source_type must be one of {sorted(VALID_SOURCE_TYPES)}, got '{source_type}'."
            )

        # Validate expert_reference
        if isinstance(expert_reference, bool) or not isinstance(expert_reference, str):
            raise TypeError(f"TechniqueRubric.expert_reference must be a string, got {type(expert_reference).__name__}.")
        expert_clean = expert_reference.strip()
        if not expert_clean:
            raise ValueError("TechniqueRubric.expert_reference must be a non-empty string.")

        # Criteria: defensive copy & validation
        crit_tuple = tuple(criteria)
        if not crit_tuple:
            raise ValueError(f"TechniqueRubric.criteria cannot be empty in rubric '{id}'.")

        seen_criterion_ids = set()
        for c in crit_tuple:
            if not isinstance(c, TechniqueCriterion):
                raise TypeError(
                    f"TechniqueRubric.criteria elements must be TechniqueCriterion instances, got {type(c).__name__}."
                )
            if c.id in seen_criterion_ids:
                raise ValueError(
                    f"Duplicate criterion ID '{c.id}' in rubric '{id}'."
                )
            seen_criterion_ids.add(c.id)

        # Cross-field invariant: tổng trọng số phải hợp lệ theo scoring_method
        if scoring_method == "WEIGHTED_SUM":
            total_weight = sum(c.weight for c in crit_tuple)
            if abs(total_weight - 1.0) > 1e-4:
                raise ValueError(
                    f"Total criterion weight for WEIGHTED_SUM in rubric '{id}' must sum to 1.0, got {total_weight:.4f}."
                )

        object.__setattr__(self, "id", id.strip())
        object.__setattr__(self, "technique", canon_tech)
        object.__setattr__(self, "technique_type", canon_tech)
        object.__setattr__(self, "martial_art", norm_ma)
        object.__setattr__(self, "version", version.strip())
        object.__setattr__(self, "status", status)
        object.__setattr__(self, "source_type", norm_source)
        object.__setattr__(self, "expert_reference", expert_reference.strip())
        object.__setattr__(self, "scoring_method", scoring_method)
        object.__setattr__(self, "criteria", crit_tuple)


# ─────────────────────────────────────────────────────────────────────────────
# Pre-configured Expert Rubrics (v3.0) — Legacy Generic Namespace
# ─────────────────────────────────────────────────────────────────────────────

RUBRIC_ROUND_KICK_V3 = TechniqueRubric(
    id="rubric_round_kick_v3",
    martial_art="generic",
    technique="round_kick",
    version="3.0.0",
    status="VALIDATED",
    source_type="EXPERT_DEFINED",
    expert_reference="MMA-TMS Expert Biomechanics Panel 2026",
    scoring_method="WEIGHTED_SUM",
    criteria=[
        TechniqueCriterion(
            id="crit_kick_chamber",
            name="Knee Chamber Depth",
            description="Độ co gập rút gối ở pha khởi phát đòn đá (chuẩn < 75°, tối ưu < 55°)",
            feature_name="min_chamber_angle",
            phase="chamber",
            weight=0.35,
            required_confidence=0.30,
        ),
        TechniqueCriterion(
            id="crit_kick_extension",
            name="Full Leg Extension at Impact",
            description="Độ duỗi thẳng của gối tại pha chạm đích (chuẩn > 140°, tối ưu > 160°)",
            feature_name="max_extension_angle",
            phase="impact",
            weight=0.35,
            required_confidence=0.30,
        ),
        TechniqueCriterion(
            id="crit_kick_speed",
            name="Striking Velocity",
            description="Vận tốc búng cổ chân cực đại lúc va chạm (chuẩn > 0.8 u/s, tối ưu > 1.5 u/s)",
            feature_name="peak_speed",
            phase="impact",
            weight=0.15,
            required_confidence=0.25,
        ),
        TechniqueCriterion(
            id="crit_kick_posture",
            name="Torso & Hip Alignment",
            description="Góc mở thân-hông tại pha bung chân, giữ thăng bằng và phát lực xoay hông",
            feature_name="hip_angle",
            phase="impact",
            weight=0.15,
            required_confidence=0.25,
        ),
    ],
)

RUBRIC_PUNCH_V3 = TechniqueRubric(
    id="rubric_punch_v3",
    martial_art="generic",
    technique="punch",
    version="3.0.0",
    status="VALIDATED",
    source_type="EXPERT_DEFINED",
    expert_reference="MMA-TMS Expert Biomechanics Panel 2026",
    scoring_method="WEIGHTED_SUM",
    criteria=[
        TechniqueCriterion(
            id="crit_punch_extension",
            name="Arm Extension / Hook Angle",
            description="Độ duỗi thẳng cùi chỏ (Cross/Jab > 140°) hoặc khóa góc vuông chuẩn (Hook 85°-115°)",
            feature_name="max_elbow_angle",
            phase="impact",
            weight=0.40,
            required_confidence=0.30,
        ),
        TechniqueCriterion(
            id="crit_punch_guard",
            name="Opposite Guard Protection",
            description="Tay đối diện duy trì che cằm/thái dương trong suốt quá trình phát lực đấm",
            feature_name="guard_preserved",
            phase="impact",
            weight=0.35,
            required_confidence=0.30,
        ),
        TechniqueCriterion(
            id="crit_punch_speed",
            name="Striking Velocity",
            description="Tốc độ vung cổ tay cực đại tạo xung lượng va chạm",
            feature_name="peak_speed",
            phase="impact",
            weight=0.25,
            required_confidence=0.25,
        ),
    ],
)


# ─────────────────────────────────────────────────────────────────────────────
# Rubric Scoring Engine Function
# ─────────────────────────────────────────────────────────────────────────────

def calculate_technique_score(criterion_results: list[CriterionResult]) -> tuple[int, str, str]:
    """
    Tính điểm tổng hợp kỹ thuật theo công thức chuẩn Master Spec v3.0 (Mục 09.5):
      Technique Score = Σ (criterion_score × criterion_weight) / Σ criterion_weight

    Chỉ những tiêu chí có đủ dữ liệu quan sát (status != 'insufficient_evidence')
    mới được tính vào điểm tổng. Nếu thiếu bằng chứng, hệ thống loại trừ trọng số đó
    và chỉ tính trên các tiêu chí hợp lệ.
    """
    valid_results = [
        r for r in criterion_results
        if r.status != CriterionStatus.INSUFFICIENT_EVIDENCE and r.weight > 0
    ]

    if not valid_results:
        return 0, "NO_DATA", "⚪"

    total_weight = sum(r.weight for r in valid_results)
    if total_weight <= 0:
        return 0, "NO_DATA", "⚪"

    weighted_sum = sum(r.score * r.weight for r in valid_results)
    final_score = int(round(max(0.0, min(100.0, weighted_sum / total_weight))))

    if final_score >= 90:
        grade, emoji = "PERFECT", "🟢"
    elif final_score >= 75:
        grade, emoji = "GOOD", "🟡"
    elif final_score >= 55:
        grade, emoji = "FAIR", "🟠"
    else:
        grade, emoji = "NEEDS WORK", "🔴"

    return final_score, grade, emoji

