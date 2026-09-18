"""
pipeline/classification.py — MMA-TMS Technique Classification Boundary

Module chịu trách nhiệm tách biệt ranh giới phân loại kỹ thuật (Classification)
khỏi tầng phát hiện chuyển động (Detection FSM) và tầng đánh giá (Assessment).

Nguyên tắc bắt buộc:
1. Độc lập runtime: Không import trực tiếp PunchAnalyzer, KickAnalyzer,
   PunchResult, KickResult hay action_result.py.
2. Bảo toàn nhãn legacy (Task 3):
   - PunchResult Cross giữ nguyên "cross".
   - PunchResult Jab giữ nguyên "jab".
   - KickResult giữ nguyên "round_kick".
   - KHÔNG dùng lead/rear để hoán đổi jab/cross trong task này (technical debt được giữ để zero regression).
3. Đơn nguồn chân lý: Cung cấp ClassifiedTechnique chứa đủ:
   - family, technique, attacking_side, limb_role, stance, confidence.
   Adapter ActionResult sẽ đọc trực tiếp từ ClassifiedTechnique, không phân loại lần hai.
4. Trường nội bộ: label_source = "legacy_detector_label" và confidence = None.
   Không xuất label_source ra ActionResult public v1.0.0.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

from pipeline.stance_context import (
    StanceContext,
    normalize_attacking_side,
    resolve_limb_role,
)


@dataclass(frozen=True)
class ClassifiedTechnique:
    """
    Kết quả phân loại kỹ thuật độc lập ranh giới:
    - family: "punch" | "kick"
    - technique: tên kỹ thuật chuẩn hóa (vd: "cross", "jab", "round_kick")
    - attacking_side: "left" | "right" | "unknown"
    - limb_role: "lead" | "rear" | "unknown"
    - stance: "orthodox" | "southpaw" | "switch" | "unknown"
    - confidence: Optional[float] = None (chưa calibrate model phân loại trong Task 3)
    - label_source: trường nội bộ ("legacy_detector_label"), không xuất ra public contract v1.0.0
    """
    family: str
    technique: str
    attacking_side: str
    limb_role: str
    stance: str
    confidence: Optional[float] = None
    label_source: str = "legacy_detector_label"


def classify_punch(
    punch: Any,
    stance_context: StanceContext,
) -> ClassifiedTechnique:
    """
    Phân loại cú đấm từ PunchResult / duck-typed punch candidate.
    - technique: Đọc từ punch.punch_type, fallback 'unknown'. Giữ nguyên nhãn legacy (cross/jab).
    - attacking_side: Đọc từ punch.arm ('left', 'right', 'unknown').
    - stance: Lấy từ stance_context.resolved_stance.
    - limb_role: Phân giải từ attacking_side và stance_context qua resolve_limb_role.
    - confidence: Luôn None trong Task 3.
    """
    raw_type = str(getattr(punch, "punch_type", "unknown") or "unknown").strip().lower()
    raw_arm = getattr(punch, "arm", None)
    side = normalize_attacking_side(raw_arm)
    stance = stance_context.resolved_stance
    limb_role = resolve_limb_role(side, stance)

    return ClassifiedTechnique(
        family="punch",
        technique=raw_type,
        attacking_side=side,
        limb_role=limb_role,
        stance=stance,
        confidence=None,
        label_source="legacy_detector_label",
    )


def classify_kick(
    kick: Any,
    stance_context: StanceContext,
) -> ClassifiedTechnique:
    """
    Phân loại cú đá từ KickResult / duck-typed kick candidate.
    - technique: Luôn là 'round_kick' trong Task 3 (bảo toàn nhãn legacy, không đọc hay tin tưởng kick.kick_type).
    - attacking_side: Đọc từ kick.active_leg ('left', 'right', 'unknown').
    - stance: Lấy từ stance_context.resolved_stance.
    - limb_role: Phân giải từ attacking_side và stance_context qua resolve_limb_role.
    - confidence: Luôn None trong Task 3.
    """
    technique = "round_kick"
    raw_leg = getattr(kick, "active_leg", None)
    side = normalize_attacking_side(raw_leg)
    stance = stance_context.resolved_stance
    limb_role = resolve_limb_role(side, stance)

    return ClassifiedTechnique(
        family="kick",
        technique=technique,
        attacking_side=side,
        limb_role=limb_role,
        stance=stance,
        confidence=None,
        label_source="legacy_detector_label",
    )

