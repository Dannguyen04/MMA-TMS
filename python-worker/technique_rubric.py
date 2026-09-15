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

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


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


@dataclass
class TechniqueCriterion:
    """Định nghĩa tiêu chí trong bảng Rubric chuyên gia."""
    id: str
    name: str
    description: str
    feature_name: str
    phase: str
    weight: float
    required_confidence: float = 0.30
    evaluation_method: str = "threshold"


@dataclass
class TechniqueRubric:
    """Bảng tiêu chí chuẩn hóa do chuyên gia định nghĩa (Expert-defined Rubric)."""
    id: str
    technique_type: str
    version: str = "3.0.0"
    status: str = "VALIDATED"
    source_type: str = "EXPERT_DEFINED"
    expert_reference: str = "MMA-TMS Expert Biomechanics Panel 2026"
    scoring_method: str = "WEIGHTED_SUM"
    criteria: list[TechniqueCriterion] = field(default_factory=list)


# ─────────────────────────────────────────────────────────────────────────────
# Pre-configured Expert Rubrics (v3.0)
# ─────────────────────────────────────────────────────────────────────────────

RUBRIC_ROUND_KICK_V3 = TechniqueRubric(
    id="rubric_round_kick_v3",
    technique_type="round_kick",
    version="3.0.0",
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
    technique_type="punch",
    version="3.0.0",
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

