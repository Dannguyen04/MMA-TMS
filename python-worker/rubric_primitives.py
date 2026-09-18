"""
rubric_primitives.py — MMA-TMS Dependency-Neutral Rubric & Taxonomy Primitives

Module chứa các primitive contracts dùng chung giữa các tầng:
- MartialArt enum & taxonomy constants
- normalize_martial_art
- Strict SemVer 2.0.0 implementation (SemVer, parse_semver, SEMVER_REGEX)

Module này hoàn toàn độc lập, CHỈ sử dụng thư viện chuẩn Python (stdlib),
không phụ thuộc vào `technique_rubric` hay `pipeline`, bảo đảm không bao giờ
gây ra circular import giữa các modules tầng thấp và tầng cao.
"""

from __future__ import annotations

from enum import Enum
from functools import total_ordering
import re
from typing import Optional


# ─────────────────────────────────────────────────────────────────────────────
# 1. Martial Arts Taxonomy & Normalization
# ─────────────────────────────────────────────────────────────────────────────

class MartialArt(str, Enum):
    BOXING = "boxing"
    MUAY_THAI = "muay_thai"
    KICKBOXING = "kickboxing"
    KARATE = "karate"
    TAEKWONDO = "taekwondo"
    MMA = "mma"
    GENERIC = "generic"
    UNKNOWN = "unknown"


VALID_MARTIAL_ARTS = frozenset(item.value for item in MartialArt)


def normalize_martial_art(val: Optional[str]) -> Optional[str]:
    """
    Chuẩn hóa martial_art:
    - None -> None (omitted).
    - bool hoặc non-str -> TypeError.
    - Chuỗi rỗng hoặc chỉ whitespace -> ValueError.
    - Trim, lowercase, map alias.
    - Nếu không thuộc taxonomy -> ValueError (không âm thầm chuyển thành unknown hay môn võ khác).
    """
    if val is None:
        return None
    if isinstance(val, bool) or not isinstance(val, str):
        raise TypeError(f"martial_art must be a string or None, got {type(val).__name__}.")
    s = val.strip().lower()
    if not s:
        raise ValueError("martial_art cannot be empty or whitespace.")

    alias_map = {
        "muay thai": MartialArt.MUAY_THAI.value,
        "muay-thai": MartialArt.MUAY_THAI.value,
        "kick boxing": MartialArt.KICKBOXING.value,
        "kick-boxing": MartialArt.KICKBOXING.value,
        "tae kwon do": MartialArt.TAEKWONDO.value,
        "tae-kwon-do": MartialArt.TAEKWONDO.value,
        "legacy": MartialArt.GENERIC.value,
    }
    canonical = alias_map.get(s, s)
    if canonical not in VALID_MARTIAL_ARTS:
        raise ValueError(
            f"Invalid martial_art '{val}'. Must be one of {sorted(VALID_MARTIAL_ARTS)}."
        )
    return canonical


# ─────────────────────────────────────────────────────────────────────────────
# 2. Strict SemVer 2.0.0 Specification Engine
# ─────────────────────────────────────────────────────────────────────────────

# Official SemVer 2.0.0 specification regex:
# MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]
SEMVER_REGEX = re.compile(
    r"^(?P<major>0|[1-9]\d*)\.(?P<minor>0|[1-9]\d*)\.(?P<patch>0|[1-9]\d*)"
    r"(?:-(?P<prerelease>(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?"
    r"(?:\+(?P<buildmetadata>[0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$"
)


@total_ordering
class SemVer:
    """
    Biểu diễn và so sánh phiên bản tuân thủ chặt chẽ đặc tả Semantic Versioning 2.0.0:
    - So sánh số học MAJOR, MINOR, PATCH (10.0.0 > 2.0.0).
    - Phiên bản chính thức có thứ tự ưu tiên cao hơn pre-release (1.0.0 > 1.0.0-rc.1).
    - So sánh từng identifier của pre-release: số vs số, chuỗi vs chuỗi (ASCII), số < chuỗi.
    - Build metadata hoàn toàn không ảnh hưởng đến thứ tự ưu tiên (1.0.0+b1 == 1.0.0+b2).
    - Từ chối các chuỗi không hợp lệ (vd: 'banana', '1.0', 'v1.0.0', '01.0.0').
    """

    def __init__(self, raw: str) -> None:
        if isinstance(raw, bool) or not isinstance(raw, str):
            raise TypeError(f"Version must be a string, got {type(raw).__name__}.")
        raw_str = raw.strip()
        m = SEMVER_REGEX.match(raw_str)
        if not m:
            raise ValueError(
                f"Invalid SemVer 2.0.0 string: '{raw}'. Expected 'MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]'."
            )
        self.raw = raw_str
        self.major = int(m.group("major"))
        self.minor = int(m.group("minor"))
        self.patch = int(m.group("patch"))
        self.prerelease_str = m.group("prerelease")
        self.build_str = m.group("buildmetadata")

        if self.prerelease_str:
            self.prerelease: tuple[int | str, ...] = tuple(
                int(part) if part.isdigit() else part
                for part in self.prerelease_str.split(".")
            )
        else:
            self.prerelease = ()

    @property
    def core(self) -> tuple[int, int, int]:
        return (self.major, self.minor, self.patch)

    def __eq__(self, other: object) -> bool:
        if isinstance(other, str):
            try:
                other = SemVer(other)
            except Exception:
                return False
        if not isinstance(other, SemVer):
            return NotImplemented
        # Theo SemVer 2.0.0 §10: build metadata không ảnh hưởng thứ tự ưu tiên và so sánh bằng
        return (
            self.major == other.major
            and self.minor == other.minor
            and self.patch == other.patch
            and self.prerelease == other.prerelease
        )

    def __lt__(self, other: object) -> bool:
        if isinstance(other, str):
            other = SemVer(other)
        if not isinstance(other, SemVer):
            return NotImplemented

        # 1. So sánh core (major, minor, patch)
        if self.core != other.core:
            return self.core < other.core

        # 2. So sánh prerelease theo SemVer 2.0.0 §11
        # Bản không có prerelease có thứ tự ưu tiên cao hơn bản có prerelease
        if not self.prerelease and other.prerelease:
            return False  # self > other
        if self.prerelease and not other.prerelease:
            return True   # self < other
        if not self.prerelease and not other.prerelease:
            return False  # equal precedence

        # Cả hai cùng có prerelease: so sánh từng identifier từ trái qua phải
        for p1, p2 in zip(self.prerelease, other.prerelease):
            if p1 == p2:
                continue
            is_p1_int = isinstance(p1, int)
            is_p2_int = isinstance(p2, int)
            if is_p1_int and is_p2_int:
                return p1 < p2
            elif is_p1_int and not is_p2_int:
                # Numeric identifiers always have lower precedence than non-numeric
                return True
            elif not is_p1_int and is_p2_int:
                return False
            else:
                return str(p1) < str(p2)

        # Nếu prefix giống nhau, tập identifier dài hơn có ưu tiên cao hơn
        return len(self.prerelease) < len(other.prerelease)

    def __hash__(self) -> int:
        return hash((self.major, self.minor, self.patch, self.prerelease))

    def __str__(self) -> str:
        return self.raw

    def __repr__(self) -> str:
        return f"SemVer('{self.raw}')"


def parse_semver(version_str: str) -> SemVer:
    """
    Phân tích và kiểm tra tính hợp lệ của chuỗi phiên bản theo chuẩn SemVer 2.0.0.
    Trả về đối tượng SemVer có khả năng so sánh số học chính xác.
    """
    return SemVer(version_str)

