"""
pipeline/stance_context.py — MMA-TMS Unified Stance Context & Resolution

Module chịu trách nhiệm duy nhất cho:
1. Chuẩn hóa thế thủ (stance) và bên tấn công (attacking_side).
2. Phân giải vai trò chi (lead / rear) dựa trên stance và bên tấn công.
3. Phân giải ngữ cảnh thế thủ (StanceContext) theo thứ tự ưu tiên 5 tầng:
   coach_declared -> user_declared -> athlete_profile -> visual_estimate -> unknown.

Nguyên tắc bắt buộc:
- Tuyệt đối không suy diễn stance từ vị trí tay hoặc chân bằng heuristic chưa kiểm chứng.
- Stance chỉ chấp nhận 'orthodox', 'southpaw', 'switch', 'unknown'.
- Chỉ gán 'lead'/'rear' khi stance là 'orthodox' hoặc 'southpaw'. 'switch', 'unknown' và invalid luôn trả về 'unknown'.
- Giá trị 'unknown', rỗng hoặc invalid không chặn fallback xuống nguồn ưu tiên thấp hơn.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from enum import Enum
from typing import Any, Optional


class StanceType(str, Enum):
    ORTHODOX = "orthodox"
    SOUTHPAW = "southpaw"
    SWITCH = "switch"
    UNKNOWN = "unknown"


class StanceSource(str, Enum):
    COACH_DECLARED = "coach_declared"
    USER_DECLARED = "user_declared"
    ATHLETE_PROFILE = "athlete_profile"
    VISUAL_ESTIMATE = "visual_estimate"
    UNKNOWN = "unknown"


VALID_STANCES = {
    StanceType.ORTHODOX.value,
    StanceType.SOUTHPAW.value,
    StanceType.SWITCH.value,
    StanceType.UNKNOWN.value,
}

DECLARED_STANCES = {
    StanceType.ORTHODOX.value,
    StanceType.SOUTHPAW.value,
    StanceType.SWITCH.value,
}


@dataclass(frozen=True)
class StanceContext:
    """
    Ngữ cảnh thế thủ toàn video.
    - requested_stance: Yêu cầu thế thủ nguyên bản từ nguồn khai báo được chọn
      (coach, user, athlete_profile, visual_estimate) trước khi chuẩn hóa; None nếu fallback về unknown.
    - resolved_stance: Thế thủ đã chuẩn hóa và phân giải ('orthodox' | 'southpaw' | 'switch' | 'unknown').
    - source: Nguồn phân giải quyết định ('coach_declared' | 'user_declared' | 'athlete_profile' | 'visual_estimate' | 'unknown').
    - confidence: Độ tin cậy ước lượng [0.0, 1.0], CHỈ có ở visual_estimate; None với tất cả nguồn khác.
    - is_authoritative: True khi do coach hoặc user khai báo thế thủ hợp lệ (orthodox/southpaw/switch).
    """
    resolved_stance: str
    source: str
    requested_stance: Optional[str] = None
    confidence: Optional[float] = None
    is_authoritative: bool = False

    def __post_init__(self) -> None:
        # Invariant: source hợp lệ theo StanceSource
        valid_sources = {s.value for s in StanceSource}
        if self.source not in valid_sources:
            raise ValueError(
                f"Invalid source '{self.source}'. Must be one of {sorted(valid_sources)}."
            )

        # Invariant: resolved_stance hợp lệ theo VALID_STANCES
        if self.resolved_stance not in VALID_STANCES:
            raise ValueError(
                f"Invalid resolved_stance '{self.resolved_stance}'. Must be one of {sorted(VALID_STANCES)}."
            )

        # Cross-field validation theo 4 nhóm source:
        if self.source == StanceSource.UNKNOWN.value:
            # 1. source == "unknown":
            # - resolved_stance phải là "unknown".
            # - requested_stance phải là None.
            # - confidence phải là None.
            # - is_authoritative phải là False.
            if self.resolved_stance != StanceType.UNKNOWN.value:
                raise ValueError(
                    f"When source is 'unknown', resolved_stance must be 'unknown', got '{self.resolved_stance}'."
                )
            if self.requested_stance is not None:
                raise ValueError(
                    f"When source is 'unknown', requested_stance must be None, got '{self.requested_stance}'."
                )
            if self.confidence is not None:
                raise ValueError(
                    f"When source is 'unknown', confidence must be None, got {self.confidence}."
                )
            if self.is_authoritative is not False:
                raise ValueError(
                    f"When source is 'unknown', is_authoritative must be False, got {self.is_authoritative}."
                )

        elif self.source in (StanceSource.COACH_DECLARED.value, StanceSource.USER_DECLARED.value):
            # 2. source in {"coach_declared", "user_declared"}:
            # - resolved_stance phải thuộc orthodox/southpaw/switch.
            # - requested_stance phải tồn tại và sau normalize phải bằng resolved_stance.
            # - confidence phải là None.
            # - is_authoritative phải là True.
            if self.resolved_stance not in DECLARED_STANCES:
                raise ValueError(
                    f"When source is '{self.source}', resolved_stance must be one of {sorted(DECLARED_STANCES)}, got '{self.resolved_stance}'."
                )
            if self.requested_stance is None:
                raise ValueError(
                    f"When source is '{self.source}', requested_stance is required and cannot be None."
                )
            if normalize_stance(self.requested_stance) != self.resolved_stance:
                raise ValueError(
                    f"When source is '{self.source}', normalized requested_stance '{normalize_stance(self.requested_stance)}' "
                    f"must match resolved_stance '{self.resolved_stance}'."
                )
            if self.confidence is not None:
                raise ValueError(
                    f"When source is '{self.source}', confidence must be None, got {self.confidence}."
                )
            if self.is_authoritative is not True:
                raise ValueError(
                    f"When source is '{self.source}', is_authoritative must be True, got {self.is_authoritative}."
                )

        elif self.source == StanceSource.ATHLETE_PROFILE.value:
            # 3. source == "athlete_profile":
            # - resolved_stance phải thuộc orthodox/southpaw/switch.
            # - requested_stance phải tồn tại và normalize bằng resolved_stance.
            # - confidence phải là None.
            # - is_authoritative phải là False.
            if self.resolved_stance not in DECLARED_STANCES:
                raise ValueError(
                    f"When source is 'athlete_profile', resolved_stance must be one of {sorted(DECLARED_STANCES)}, got '{self.resolved_stance}'."
                )
            if self.requested_stance is None:
                raise ValueError(
                    "When source is 'athlete_profile', requested_stance is required and cannot be None."
                )
            if normalize_stance(self.requested_stance) != self.resolved_stance:
                raise ValueError(
                    f"When source is 'athlete_profile', normalized requested_stance '{normalize_stance(self.requested_stance)}' "
                    f"must match resolved_stance '{self.resolved_stance}'."
                )
            if self.confidence is not None:
                raise ValueError(
                    f"When source is 'athlete_profile', confidence must be None, got {self.confidence}."
                )
            if self.is_authoritative is not False:
                raise ValueError(
                    f"When source is 'athlete_profile', is_authoritative must be False, got {self.is_authoritative}."
                )

        elif self.source == StanceSource.VISUAL_ESTIMATE.value:
            # 4. source == "visual_estimate":
            # - resolved_stance phải thuộc orthodox/southpaw/switch.
            # - requested_stance phải tồn tại và normalize bằng resolved_stance.
            # - confidence là bắt buộc, phải hữu hạn và trong [0,1].
            # - is_authoritative phải là False.
            if self.resolved_stance not in DECLARED_STANCES:
                raise ValueError(
                    f"When source is 'visual_estimate', resolved_stance must be one of {sorted(DECLARED_STANCES)}, got '{self.resolved_stance}'."
                )
            if self.requested_stance is None:
                raise ValueError(
                    "When source is 'visual_estimate', requested_stance is required and cannot be None."
                )
            if normalize_stance(self.requested_stance) != self.resolved_stance:
                raise ValueError(
                    f"When source is 'visual_estimate', normalized requested_stance '{normalize_stance(self.requested_stance)}' "
                    f"must match resolved_stance '{self.resolved_stance}'."
                )
            if self.confidence is None:
                raise ValueError(
                    "When source is 'visual_estimate', confidence is required and cannot be None."
                )
            if isinstance(self.confidence, bool) or not isinstance(self.confidence, (int, float)):
                raise ValueError(
                    f"Invalid confidence '{self.confidence}'. Must be a numeric float/int, not bool or non-numeric."
                )
            if math.isnan(self.confidence) or math.isinf(self.confidence):
                raise ValueError(
                    f"Invalid confidence '{self.confidence}'. Must be a finite number, not NaN or Infinity."
                )
            if not (0.0 <= float(self.confidence) <= 1.0):
                raise ValueError(
                    f"Confidence out of bounds: {self.confidence}. Must be in [0.0, 1.0]."
                )
            if self.is_authoritative is not False:
                raise ValueError(
                    f"When source is 'visual_estimate', is_authoritative must be False, got {self.is_authoritative}."
                )

    def to_dict(self) -> dict[str, Any]:
        """Dictionary nội bộ dùng cho logging/diagnostics (không xuất ra public ActionResult v1.0.0)."""
        return {
            "requestedStance": self.requested_stance,
            "resolvedStance": self.resolved_stance,
            "source": self.source,
            "confidence": round(self.confidence, 2) if self.confidence is not None else None,
            "isAuthoritative": self.is_authoritative,
        }


def normalize_stance(stance: Any) -> str:
    """
    Chuẩn hóa thế thủ (stance):
    - Chỉ chấp nhận 'orthodox', 'southpaw', 'switch', 'unknown'.
    - Trim khoảng trắng và lowercase.
    - Bất kỳ giá trị nào không hợp lệ (hoặc None/rỗng) đều trở thành 'unknown'.
    """
    if stance is None:
        return StanceType.UNKNOWN.value
    cleaned = str(stance).strip().lower()
    if cleaned in VALID_STANCES:
        return cleaned
    return StanceType.UNKNOWN.value


def normalize_attacking_side(side: Any) -> str:
    """Chuẩn hóa bên tấn công, trả về 'left', 'right' hoặc 'unknown'."""
    if side is None:
        return "unknown"
    side_norm = str(side).strip().lower()
    if side_norm in ("left", "right"):
        return side_norm
    return "unknown"


def resolve_limb_role(attacking_side: str, stance: str) -> str:
    """
    Suy luận vai trò chi (lead/rear) dựa trên thế thủ (stance) và bên tấn công (attacking_side).
    Cả attacking_side và stance đều được chuẩn hóa trước khi ánh xạ.
    - orthodox: left -> lead, right -> rear
    - southpaw: right -> lead, left -> rear
    - switch / unknown: luôn trả về 'unknown' (switch không tạo lead/rear)
    """
    side_norm = normalize_attacking_side(attacking_side)
    stance_norm = normalize_stance(stance)

    if side_norm not in ("left", "right") or stance_norm not in ("orthodox", "southpaw"):
        return "unknown"

    if stance_norm == StanceType.ORTHODOX.value:
        return "lead" if side_norm == "left" else "rear"
    elif stance_norm == StanceType.SOUTHPAW.value:
        return "lead" if side_norm == "right" else "rear"

    return "unknown"


def _clean_declared(val: Optional[str]) -> Optional[str]:
    """
    Lấy giá trị khai báo nếu thuộc tập {'orthodox', 'southpaw', 'switch'}.
    Giá trị 'unknown', chuỗi rỗng hoặc giá trị invalid trả về None để cho phép fallback.
    """
    if val is None:
        return None
    cleaned = str(val).strip().lower()
    if cleaned in DECLARED_STANCES:
        return cleaned
    return None


def resolve_stance_context(
    coach_stance: Optional[str] = None,
    user_stance: Optional[str] = None,
    athlete_profile_stance: Optional[str] = None,
    visual_estimate_stance: Optional[str] = None,
    visual_estimate_confidence: Optional[float] = None,
) -> StanceContext:
    """
    Phân giải ngữ cảnh stance theo thứ tự ưu tiên 5 tầng:
    1. Coach declared hợp lệ (orthodox/southpaw/switch) -> is_authoritative = True
    2. User declared hợp lệ (orthodox/southpaw/switch) -> is_authoritative = True
    3. Athlete profile hợp lệ (orthodox/southpaw/switch) -> is_authoritative = False (Task 3)
    4. Visual estimate hợp lệ (orthodox/southpaw/switch) + confidence in [0, 1] -> is_authoritative = False (Task 3)
    5. Unknown (mặc định) -> is_authoritative = False

    LƯU Ý:
    - Giá trị 'unknown', chuỗi rỗng và giá trị không hợp lệ KHÔNG chặn fallback xuống nguồn ưu tiên thấp hơn.
    - switch vẫn được chấp nhận là resolved_stance nhưng không suy ra lead/rear.
    """
    # 1. Coach declared
    coach_clean = _clean_declared(coach_stance)
    if coach_clean is not None:
        return StanceContext(
            resolved_stance=coach_clean,
            source=StanceSource.COACH_DECLARED.value,
            requested_stance=coach_stance,
            confidence=None,
            is_authoritative=True,
        )

    # 2. User declared
    user_clean = _clean_declared(user_stance)
    if user_clean is not None:
        return StanceContext(
            resolved_stance=user_clean,
            source=StanceSource.USER_DECLARED.value,
            requested_stance=user_stance,
            confidence=None,
            is_authoritative=True,
        )

    # 3. Athlete profile
    profile_clean = _clean_declared(athlete_profile_stance)
    if profile_clean is not None:
        return StanceContext(
            resolved_stance=profile_clean,
            source=StanceSource.ATHLETE_PROFILE.value,
            requested_stance=athlete_profile_stance,
            confidence=None,
            is_authoritative=False,
        )

    # 4. Visual estimate (hợp lệ và confidence là số hữu hạn trong [0.0, 1.0], không nhận bool)
    visual_clean = _clean_declared(visual_estimate_stance)
    if (
        visual_clean is not None
        and visual_estimate_confidence is not None
        and not isinstance(visual_estimate_confidence, bool)
        and isinstance(visual_estimate_confidence, (int, float))
        and not math.isnan(visual_estimate_confidence)
        and not math.isinf(visual_estimate_confidence)
        and 0.0 <= float(visual_estimate_confidence) <= 1.0
    ):
        return StanceContext(
            resolved_stance=visual_clean,
            source=StanceSource.VISUAL_ESTIMATE.value,
            requested_stance=visual_estimate_stance,
            confidence=round(float(visual_estimate_confidence), 2),
            is_authoritative=False,
        )

    # 5. Fallback: Unknown
    return StanceContext(
        resolved_stance=StanceType.UNKNOWN.value,
        source=StanceSource.UNKNOWN.value,
        requested_stance=None,
        confidence=None,
        is_authoritative=False,
    )

