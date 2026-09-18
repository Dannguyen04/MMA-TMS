"""
pipeline/rubric_registry.py — MMA-TMS Discipline-Aware Rubric Registry

Module chịu trách nhiệm quản lý, đăng ký và lựa chọn rubric kỹ thuật theo ngữ cảnh:
- Canonical key: (martial_art, technique, version).
- Deterministic selection & exact match.
- Strict SemVer 2.0.0 ordering (10.0.0 > 2.0.0, 1.0.0 > 1.0.0-rc.1, build metadata neutrality).
- Governance status enforcement:
  * Latest: chỉ chọn VALIDATED, không tự ý chọn DRAFT/DEPRECATED.
  * Exact DRAFT: yêu cầu allow_draft=True.
  * Exact DEPRECATED: yêu cầu allow_deprecated_for_replay=True.
- Deep-freeze default registry (MappingProxyType và immutable tuple snapshots).
- Không cross-discipline fallback (không âm thầm gán generic/boxing cho muay_thai).
- Tương thích ngược với generic/legacy rubrics.
- Bất biến và an toàn trước mutation.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from types import MappingProxyType
from typing import Mapping, Optional

from rubric_primitives import (
    MartialArt,
    VALID_MARTIAL_ARTS,
    SEMVER_REGEX,
    SemVer,
    parse_semver,
)
from pipeline.analysis_context import AnalysisContext
from technique_rubric import (
    RUBRIC_PUNCH_V3,
    RUBRIC_ROUND_KICK_V3,
    TechniqueRubric,
)


class RubricSelectionStatus(str, Enum):
    SELECTED = "selected"
    NOT_REGISTERED = "not_registered"
    UNSUPPORTED_MARTIAL_ART = "unsupported_martial_art"
    UNSUPPORTED_TECHNIQUE = "unsupported_technique"
    VERSION_NOT_FOUND = "version_not_found"
    INVALID_CONTEXT = "invalid_context"
    RUBRIC_NOT_SELECTABLE = "rubric_not_selectable"


@dataclass(frozen=True)
class RubricSelectionResult:
    """
    Kết quả có cấu trúc khi lựa chọn rubric từ RubricRegistry.
    Bất biến (frozen=True).
    - status: Trạng thái lựa chọn
    - rubric: Đối tượng TechniqueRubric nếu status == SELECTED, ngược lại None
    - reason: Mô tả chi tiết lý do thành công / thất bại
    - requested_martial_art: Môn võ được yêu cầu
    - requested_technique: Kỹ thuật được yêu cầu
    - requested_version: Phiên bản được yêu cầu hoặc phiên bản latest được chọn
    - available_versions: Danh sách các phiên bản khả dụng cho (martial_art, technique)
    """
    status: RubricSelectionStatus
    rubric: Optional[TechniqueRubric] = None
    reason: str = ""
    requested_martial_art: Optional[str] = None
    requested_technique: Optional[str] = None
    requested_version: Optional[str] = None
    available_versions: tuple[str, ...] = ()


class RubricRegistry:
    """
    Registry độc lập lưu trữ và tra cứu các bảng TechniqueRubric theo khóa canonical:
      (martial_art, technique, version)
    Hỗ trợ:
    - Deep Sealing/Freezing: Đóng băng toàn diện bằng MappingProxyType và tuple snapshots,
      ngăn chặn tuyệt đối mutation, clear, pop, append hoặc bypass `_frozen=False`.
    - Strict SemVer 2.0.0: Từ chối semantic duplicates khi đăng ký.
    - Governance status: Ưu tiên VALIDATED, bảo vệ DRAFT (allow_draft),
      bảo vệ DEPRECATED (allow_deprecated_for_replay).
    """

    def __init__(self) -> None:
        self._rubrics_by_key: dict[tuple[str, str, str], TechniqueRubric] | Mapping[tuple[str, str, str], TechniqueRubric] = {}
        self._rubrics_by_id: dict[str, TechniqueRubric] | Mapping[str, TechniqueRubric] = {}
        self._versions_by_art_tech: dict[tuple[str, str], list[str]] | Mapping[tuple[str, str], tuple[str, ...]] = {}
        self._frozen: bool = False

    @property
    def is_frozen(self) -> bool:
        """Kiểm tra registry có đang ở trạng thái đóng băng hay không."""
        return self._frozen

    def freeze(self) -> RubricRegistry:
        """
        Deep-freeze registry:
        - Đặt cờ `_frozen = True`.
        - Chuyển toàn bộ internal maps thành MappingProxyType (read-only mapping).
        - Chuyển toàn bộ version collections thành immutable tuples.
        - Chống mọi thao tác mutate, clear, pop, append kể cả khi caller cố tình gán `_frozen = False`.
        - Trả về chính self để hỗ trợ fluent chaining.
        """
        if self._frozen:
            return self

        self._frozen = True
        frozen_versions = {
            k: tuple(v) for k, v in self._versions_by_art_tech.items()
        }
        self._rubrics_by_key = MappingProxyType(dict(self._rubrics_by_key))
        self._rubrics_by_id = MappingProxyType(dict(self._rubrics_by_id))
        self._versions_by_art_tech = MappingProxyType(frozen_versions)
        return self

    def clone(self) -> RubricRegistry:
        """
        Tạo một bản sao mới hoàn toàn độc lập và chưa đóng băng (unfrozen) của registry,
        sao chép toàn bộ các rubric đã đăng ký sang mutable structures mới.
        Mọi thay đổi trên clone không bao giờ ảnh hưởng đến registry gốc.
        """
        new_reg = RubricRegistry()
        for rubric in self.list_registered_rubrics():
            new_reg.register(rubric)
        return new_reg

    def register(self, rubric: TechniqueRubric) -> None:
        """
        Đăng ký một TechniqueRubric vào registry:
        - Từ chối nếu registry đã bị đóng băng (frozen hoặc MappingProxyType).
        - Khóa lựa chọn canonical: (martial_art, technique, version).
        - Kiểm tra tính hợp lệ của SemVer 2.0.0.
        - Từ chối duplicate canonical key.
        - Từ chối semantic duplicate version (vd: 1.0.0+b1 và 1.0.0+b2).
        - Từ chối duplicate rubric ID có definition khác.
        """
        if self._frozen or isinstance(self._rubrics_by_key, MappingProxyType):
            raise RuntimeError(
                "Cannot register rubric: RubricRegistry is sealed/frozen. "
                "Call clone() to create a mutable copy if you need to register custom rubrics."
            )

        if not isinstance(rubric, TechniqueRubric):
            raise TypeError(
                f"rubric must be a TechniqueRubric instance, got {type(rubric).__name__}."
            )

        # Validate SemVer 2.0.0 của rubric version
        sem_ver = parse_semver(rubric.version)

        ma = rubric.martial_art.strip().lower()
        tech = rubric.technique.strip().lower()
        ver = rubric.version.strip()
        key = (ma, tech, ver)
        art_tech = (ma, tech)

        # 1. Từ chối duplicate exact key
        if key in self._rubrics_by_key:
            existing = self._rubrics_by_key[key]
            raise ValueError(
                f"Duplicate rubric key {key} already registered with ID '{existing.id}'."
            )

        # 2. Từ chối semantic duplicate version (SemVer precedence equivalence)
        existing_versions = self._versions_by_art_tech.get(art_tech, [])
        for ev in existing_versions:
            if SemVer(ev) == sem_ver:
                raise ValueError(
                    f"Semantic duplicate version '{ver}' already registered for ({ma}, {tech}) "
                    f"with precedence-equivalent version '{ev}'."
                )

        # 3. Từ chối duplicate rubric ID có definition khác
        if rubric.id in self._rubrics_by_id:
            existing = self._rubrics_by_id[rubric.id]
            if existing != rubric:
                raise ValueError(
                    f"Rubric ID '{rubric.id}' is already registered with a different definition."
                )
            raise ValueError(
                f"Rubric ID '{rubric.id}' is already registered."
            )

        # Lưu trữ an toàn
        assert isinstance(self._rubrics_by_key, dict)
        assert isinstance(self._rubrics_by_id, dict)
        assert isinstance(self._versions_by_art_tech, dict)

        self._rubrics_by_key[key] = rubric
        self._rubrics_by_id[rubric.id] = rubric

        if art_tech not in self._versions_by_art_tech:
            self._versions_by_art_tech[art_tech] = []
        self._versions_by_art_tech[art_tech].append(ver)

    def get(self, martial_art: str, technique: str, version: str) -> Optional[TechniqueRubric]:
        """Tra cứu chính xác (exact-match) theo (martial_art, technique, version)."""
        if isinstance(martial_art, bool) or not isinstance(martial_art, str):
            return None
        if isinstance(technique, bool) or not isinstance(technique, str):
            return None
        if isinstance(version, bool) or not isinstance(version, str):
            return None

        ma_clean = martial_art.strip().lower()
        tech_clean = technique.strip().lower()
        ver_clean = version.strip()
        if not ma_clean or not tech_clean or not ver_clean:
            return None

        key = (ma_clean, tech_clean, ver_clean)
        return self._rubrics_by_key.get(key)

    def get_by_id(self, rubric_id: str) -> Optional[TechniqueRubric]:
        """Tra cứu rubric theo ID."""
        if isinstance(rubric_id, bool) or not isinstance(rubric_id, str):
            return None
        rid_clean = rubric_id.strip()
        if not rid_clean:
            return None
        return self._rubrics_by_id.get(rid_clean)

    def list_available_versions(self, martial_art: str, technique: str) -> tuple[str, ...]:
        """
        Liệt kê các phiên bản khả dụng cho (martial_art, technique),
        sắp xếp theo strict SemVer 2.0.0 giảm dần (phiên bản mới nhất đứng đầu),
        kết hợp deterministic raw string tie-breaker.
        Luôn trả về immutable tuple snapshot.
        """
        if isinstance(martial_art, bool) or not isinstance(martial_art, str):
            return ()
        if isinstance(technique, bool) or not isinstance(technique, str):
            return ()

        ma_clean = martial_art.strip().lower()
        tech_clean = technique.strip().lower()
        if not ma_clean or not tech_clean:
            return ()

        art_tech = (ma_clean, tech_clean)
        versions = self._versions_by_art_tech.get(art_tech, ())
        # Sắp xếp theo SemVer giảm dần, tie-breaker bằng raw string
        sorted_versions = sorted(
            versions,
            key=lambda v: (SemVer(v), v),
            reverse=True,
        )
        return tuple(sorted_versions)

    def list_versions(self, martial_art: str, technique: str) -> tuple[str, ...]:
        """Alias cho list_available_versions."""
        return self.list_available_versions(martial_art, technique)

    def list_techniques(self, martial_art: str) -> tuple[str, ...]:
        """Liệt kê các kỹ thuật đã đăng ký cho môn võ cụ thể. Trả về immutable tuple."""
        if isinstance(martial_art, bool) or not isinstance(martial_art, str):
            return ()
        ma_clean = martial_art.strip().lower()
        if not ma_clean:
            return ()
        techniques = sorted({tech for (art, tech) in self._versions_by_art_tech.keys() if art == ma_clean})
        return tuple(techniques)

    def list_martial_arts(self) -> tuple[str, ...]:
        """Liệt kê tất cả các môn võ có ít nhất 1 rubric trong registry. Trả về immutable tuple."""
        arts = sorted({art for (art, _) in self._versions_by_art_tech.keys()})
        return tuple(arts)

    def list_registered_rubrics(self) -> tuple[TechniqueRubric, ...]:
        """Trả về tuple tất cả các rubric đã đăng ký trong registry."""
        return tuple(self._rubrics_by_key.values())

    def select_rubric(
        self,
        context: Optional[AnalysisContext],
        technique: str,
        version: Optional[str] = None,
        allow_draft: bool = False,
        allow_deprecated_for_replay: bool = False,
    ) -> RubricSelectionResult:
        """
        Lựa chọn rubric theo AnalysisContext và technique:
        1. Kiểm tra validation type trước khi gọi .strip() cho mọi tham số.
        2. Policy thống nhất:
           - context is None: legacy generic path -> generic namespace.
           - context.martial_art is None: caller chưa chỉ định discipline -> dùng generic namespace.
           - context.martial_art == 'generic': explicit generic path -> generic namespace.
           - context.martial_art == 'unknown': explicit unknown -> từ chối bằng UNSUPPORTED_MARTIAL_ART.
           - context.martial_art là môn võ cụ thể: tra cứu chính xác, cấm cross-discipline fallback.
        3. Governance rules:
           - Latest query (version omitted): CHỈ chọn VALIDATED. DRAFT và DEPRECATED không thể win latest.
             Nếu không có version VALIDATED nào, trả về RUBRIC_NOT_SELECTABLE.
           - Exact query:
             * DRAFT chỉ được chọn khi allow_draft=True, ngược lại trả RUBRIC_NOT_SELECTABLE.
             * DEPRECATED chỉ được chọn khi allow_deprecated_for_replay=True, ngược lại trả RUBRIC_NOT_SELECTABLE.
        """
        # Kiểm tra kiểu nghiêm ngặt của policy flags
        if not isinstance(allow_draft, bool):
            raise TypeError(
                f"allow_draft must be a strict boolean, got {type(allow_draft).__name__}."
            )
        if not isinstance(allow_deprecated_for_replay, bool):
            raise TypeError(
                f"allow_deprecated_for_replay must be a strict boolean, got {type(allow_deprecated_for_replay).__name__}."
            )

        # Kiểm tra tính hợp lệ của context trước khi truy cập thuộc tính
        if context is not None and not isinstance(context, AnalysisContext):
            return RubricSelectionResult(
                status=RubricSelectionStatus.INVALID_CONTEXT,
                reason="context must be an instance of AnalysisContext or None.",
                requested_technique=str(technique) if isinstance(technique, str) else None,
                requested_version=version if isinstance(version, str) else None,
            )

        # Kiểm tra technique: validate type trước khi gọi .strip()
        if isinstance(technique, bool) or not isinstance(technique, str):
            return RubricSelectionResult(
                status=RubricSelectionStatus.INVALID_CONTEXT,
                reason=f"technique must be a non-empty string, got {type(technique).__name__}.",
                requested_martial_art=context.martial_art if context else None,
                requested_version=version if isinstance(version, str) else None,
            )
        tech_clean = technique.strip().lower()
        if not tech_clean:
            return RubricSelectionResult(
                status=RubricSelectionStatus.INVALID_CONTEXT,
                reason="technique must be a non-empty string.",
                requested_martial_art=context.martial_art if context else None,
                requested_version=version if isinstance(version, str) else None,
            )

        # Kiểm tra version nếu có truyền trực tiếp: validate type trước khi gọi .strip()
        if version is not None:
            if isinstance(version, bool) or not isinstance(version, str):
                return RubricSelectionResult(
                    status=RubricSelectionStatus.INVALID_CONTEXT,
                    reason=f"version must be a string or None, got {type(version).__name__}.",
                    requested_martial_art=context.martial_art if context else None,
                    requested_technique=tech_clean,
                )
            if not version.strip():
                return RubricSelectionResult(
                    status=RubricSelectionStatus.INVALID_CONTEXT,
                    reason="version cannot be empty or whitespace.",
                    requested_martial_art=context.martial_art if context else None,
                    requested_technique=tech_clean,
                )

        # Phân giải môn võ và phiên bản yêu cầu theo policy thống nhất
        if context is None:
            # Case 1: context omitted hoàn toàn -> legacy generic path
            target_ma = MartialArt.GENERIC.value
            req_ver = version
        else:
            # Case 2: context có mặt:
            # Nếu martial_art is None: caller cung cấp context (vd: camera, mode) nhưng chưa yêu cầu discipline -> dùng generic
            # Tuyệt đối KHÔNG đồng nhất martial_art is None với explicit "unknown"
            if context.martial_art is None:
                target_ma = MartialArt.GENERIC.value
            else:
                target_ma = context.martial_art
            req_ver = version or context.requested_rubric_version

        # Case 3: Explicit martial_art == 'unknown'
        if target_ma == MartialArt.UNKNOWN.value:
            return RubricSelectionResult(
                status=RubricSelectionStatus.UNSUPPORTED_MARTIAL_ART,
                requested_martial_art=target_ma,
                requested_technique=tech_clean,
                requested_version=req_ver,
                reason="Martial art is 'unknown'; cannot select discipline-aware rubric.",
            )

        # Case 4: Tra cứu môn võ trong registry
        registered_arts = self.list_martial_arts()
        if target_ma not in registered_arts:
            return RubricSelectionResult(
                status=RubricSelectionStatus.UNSUPPORTED_MARTIAL_ART,
                requested_martial_art=target_ma,
                requested_technique=tech_clean,
                requested_version=req_ver,
                reason=f"No rubrics registered for martial art '{target_ma}'.",
            )

        # Case 5: Tra cứu technique trong môn võ
        avail_techniques = self.list_techniques(target_ma)
        if tech_clean not in avail_techniques:
            return RubricSelectionResult(
                status=RubricSelectionStatus.UNSUPPORTED_TECHNIQUE,
                requested_martial_art=target_ma,
                requested_technique=tech_clean,
                requested_version=req_ver,
                reason=f"Technique '{tech_clean}' is not supported for martial art '{target_ma}'. Available techniques: {avail_techniques}.",
            )

        avail_versions = self.list_available_versions(target_ma, tech_clean)

        # Case 6: Exact version request
        if req_ver is not None and req_ver.strip():
            exact_ver = req_ver.strip()
            # Kiểm tra cú pháp SemVer của requested version
            try:
                SemVer(exact_ver)
            except (ValueError, TypeError) as err:
                return RubricSelectionResult(
                    status=RubricSelectionStatus.VERSION_NOT_FOUND,
                    requested_martial_art=target_ma,
                    requested_technique=tech_clean,
                    requested_version=exact_ver,
                    available_versions=avail_versions,
                    reason=f"Invalid version format '{exact_ver}': {err}",
                )

            rubric = self.get(target_ma, tech_clean, exact_ver)
            if rubric is not None:
                # Governance checks cho exact version:
                if rubric.status == "DRAFT" and not allow_draft:
                    return RubricSelectionResult(
                        status=RubricSelectionStatus.RUBRIC_NOT_SELECTABLE,
                        rubric=None,
                        requested_martial_art=target_ma,
                        requested_technique=tech_clean,
                        requested_version=exact_ver,
                        available_versions=avail_versions,
                        reason=f"Rubric '{rubric.id}' (v{exact_ver}) is in DRAFT status and cannot be used for production assessment without allow_draft=True.",
                    )
                if rubric.status == "DEPRECATED" and not allow_deprecated_for_replay:
                    return RubricSelectionResult(
                        status=RubricSelectionStatus.RUBRIC_NOT_SELECTABLE,
                        rubric=None,
                        requested_martial_art=target_ma,
                        requested_technique=tech_clean,
                        requested_version=exact_ver,
                        available_versions=avail_versions,
                        reason=f"Rubric '{rubric.id}' (v{exact_ver}) is DEPRECATED and cannot be selected for production assessment without allow_deprecated_for_replay=True.",
                    )
                return RubricSelectionResult(
                    status=RubricSelectionStatus.SELECTED,
                    rubric=rubric,
                    requested_martial_art=target_ma,
                    requested_technique=tech_clean,
                    requested_version=exact_ver,
                    available_versions=avail_versions,
                    reason=f"Successfully selected exact rubric '{rubric.id}'.",
                )
            return RubricSelectionResult(
                status=RubricSelectionStatus.VERSION_NOT_FOUND,
                requested_martial_art=target_ma,
                requested_technique=tech_clean,
                requested_version=exact_ver,
                available_versions=avail_versions,
                reason=f"Version '{exact_ver}' not found for {target_ma}/{tech_clean}. Available versions: {avail_versions}.",
            )

        # Case 7: Latest version request (version omitted) -> Governance: CHỈ chọn VALIDATED
        if not avail_versions:
            return RubricSelectionResult(
                status=RubricSelectionStatus.NOT_REGISTERED,
                requested_martial_art=target_ma,
                requested_technique=tech_clean,
                reason=f"No versions available for {target_ma}/{tech_clean}.",
            )

        registered_for_tech: list[TechniqueRubric] = []
        for v in avail_versions:
            r = self.get(target_ma, tech_clean, v)
            if r is not None:
                registered_for_tech.append(r)

        validated_candidates = [r for r in registered_for_tech if r.status == "VALIDATED"]

        if not validated_candidates:
            # Không có phiên bản VALIDATED nào cho production
            versions_status = [f"{r.version} ({r.status})" for r in registered_for_tech]
            return RubricSelectionResult(
                status=RubricSelectionStatus.RUBRIC_NOT_SELECTABLE,
                rubric=None,
                requested_martial_art=target_ma,
                requested_technique=tech_clean,
                available_versions=avail_versions,
                reason=(
                    f"No VALIDATED rubrics available for {target_ma}/{tech_clean}. "
                    f"Available non-production versions: {versions_status}."
                ),
            )

        # Sắp xếp các ứng viên VALIDATED theo SemVer giảm dần
        sorted_validated = sorted(
            validated_candidates,
            key=lambda r: (SemVer(r.version), r.version),
            reverse=True,
        )
        selected_rubric = sorted_validated[0]

        return RubricSelectionResult(
            status=RubricSelectionStatus.SELECTED,
            rubric=selected_rubric,
            requested_martial_art=target_ma,
            requested_technique=tech_clean,
            requested_version=selected_rubric.version,
            available_versions=avail_versions,
            reason=f"Successfully selected latest VALIDATED rubric '{selected_rubric.id}' (v{selected_rubric.version}).",
        )


def create_default_rubric_registry() -> RubricRegistry:
    """
    Khởi tạo RubricRegistry mặc định và đăng ký các rubric chuẩn hiện hành
    dưới namespace 'generic':
    - RUBRIC_ROUND_KICK_V3: ('generic', 'round_kick', '3.0.0')
    - RUBRIC_PUNCH_V3: ('generic', 'punch', '3.0.0')
    """
    registry = RubricRegistry()
    registry.register(RUBRIC_ROUND_KICK_V3)
    registry.register(RUBRIC_PUNCH_V3)
    return registry


_GLOBAL_DEFAULT_REGISTRY: Optional[RubricRegistry] = None


def get_default_rubric_registry() -> RubricRegistry:
    """
    Trả về RubricRegistry toàn cục với các rubric mặc định đã nạp sẵn.
    Registry này được deep-frozen (MappingProxyType và immutable snapshots)
    để bảo vệ chống ghi đè, chống ô nhiễm runtime hoặc cache poisoning.
    """
    global _GLOBAL_DEFAULT_REGISTRY
    if _GLOBAL_DEFAULT_REGISTRY is None:
        _GLOBAL_DEFAULT_REGISTRY = create_default_rubric_registry().freeze()
    return _GLOBAL_DEFAULT_REGISTRY
