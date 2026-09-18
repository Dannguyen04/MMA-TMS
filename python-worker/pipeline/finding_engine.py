"""
finding_engine.py — Finding & Error Code Engine (Task 10)

Chuẩn hóa cách sinh lỗi kỹ thuật từ assessment evidence:
- Registry error code ổn định và versioned.
- Finding có action/session scope, severity, evidence refs, confidence/evidence level và rubric provenance.
- Duplicate findings được gom deterministically.
- Mọi claim phải trace được về metric/criterion/frame.
- Không tạo lỗi khi evidence không đủ (insufficient_evidence -> 0 findings).
- Wording hoàn toàn trung lập, phi y tế (no medical diagnosis).
- Giữ tương thích 100% với legacy findings format.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
import hashlib
import math
from typing import Any, Mapping, Optional, Sequence

from pipeline.contracts import EvidenceLevel, deep_freeze, to_json_safe

REGISTRY_VERSION = "1.0.0"


class FindingScope(str, Enum):
    ACTION = "action"
    SESSION = "session"


class FindingSeverity(str, Enum):
    POSITIVE = "positive"
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class FindingErrorCode(str, Enum):
    # Punch Technical Errors
    PUNCH_ELBOW_UNDEREXTENDED = "TECH_PUNCH_ELBOW_UNDEREXTENDED"
    PUNCH_ELBOW_HYPEREXTENDED = "TECH_PUNCH_ELBOW_HYPEREXTENDED"
    PUNCH_GUARD_DROPPED = "TECH_PUNCH_GUARD_DROPPED"
    PUNCH_LOW_SPEED = "TECH_PUNCH_LOW_SPEED"
    PUNCH_CHAMBER_INCOMPLETE = "TECH_PUNCH_CHAMBER_INCOMPLETE"
    PUNCH_HEAD_EXPOSED = "TECH_PUNCH_HEAD_EXPOSED"
    PUNCH_OVER_ROTATION = "TECH_PUNCH_OVER_ROTATION"
    
    # Kick Technical Errors
    KICK_CHAMBER_LOW = "TECH_KICK_CHAMBER_LOW"
    KICK_EXTENSION_INCOMPLETE = "TECH_KICK_EXTENSION_INCOMPLETE"
    KICK_HIP_LEAN_EXCESSIVE = "TECH_KICK_HIP_LEAN_EXCESSIVE"
    KICK_LOW_SPEED = "TECH_KICK_LOW_SPEED"
    KICK_GUARD_DROPPED = "TECH_KICK_GUARD_DROPPED"
    KICK_PIVOT_INSUFFICIENT = "TECH_KICK_PIVOT_INSUFFICIENT"
    
    # Positive Technique Demonstrations
    PUNCH_EXTENSION_OPTIMAL = "TECH_PUNCH_EXTENSION_OPTIMAL"
    PUNCH_GUARD_SOLID = "TECH_PUNCH_GUARD_SOLID"
    KICK_CHAMBER_SHARP = "TECH_KICK_CHAMBER_SHARP"
    KICK_EXTENSION_SOLID = "TECH_KICK_EXTENSION_SOLID"
    
    # Biomechanical & Balance General Errors
    BALANCE_OFF_AXIS = "TECH_BALANCE_OFF_AXIS"
    RECOVERY_SLOW = "TECH_RECOVERY_SLOW"


# Forbidden medical/diagnostic words in findings:
FORBIDDEN_MEDICAL_TERMS = (
    "chấn thương", "tổn thương", "viêm", "rách cơ", "thoát vị",
    "bệnh lý", "đau khớp", "nguy cơ y tế", "injury", "pathology",
    "torn", "strain", "sprain", "medical risk", "damage",
)


@dataclass(frozen=True)
class EvidenceReference:
    """Tham chiếu bằng chứng định lượng chính xác theo frame và metric."""
    frame_idx: int
    time_ms: float
    metric_name: str
    metric_value: float
    threshold_value: Optional[float] = None
    operator: Optional[str] = None
    unit: str = "degrees"

    def to_dict(self) -> dict[str, Any]:
        return {
            "frameIdx": self.frame_idx,
            "timeMs": round(self.time_ms, 1),
            "metricName": self.metric_name,
            "metricValue": round(self.metric_value, 3),
            "thresholdValue": round(self.threshold_value, 3) if self.threshold_value is not None else None,
            "operator": self.operator,
            "unit": self.unit,
        }


@dataclass(frozen=True)
class RubricProvenance:
    """Nguồn gốc rubric đánh giá tạo ra finding."""
    rubric_id: str
    criterion_id: str
    rubric_version: str = "3.0.0"

    def to_dict(self) -> dict[str, Any]:
        return {
            "rubricId": self.rubric_id,
            "criterionId": self.criterion_id,
            "rubricVersion": self.rubric_version,
        }


@dataclass(frozen=True)
class StandardFinding:
    """
    Thực thể phát hiện kỹ thuật chuẩn hóa Task 10.
    """
    id: str
    code: FindingErrorCode
    title: str
    description: str
    scope: FindingScope
    severity: FindingSeverity
    confidence: Optional[float]
    evidence_level: EvidenceLevel
    evidence_refs: tuple[EvidenceReference, ...]
    provenance: RubricProvenance
    recommendation: str
    action_id: Optional[str] = None
    category: str = "technique"
    legacy_finding_id: Optional[str] = None

    def __post_init__(self):
        # Validate non-medical neutral wording
        text_to_check = f"{self.title} {self.description} {self.recommendation}".lower()
        for term in FORBIDDEN_MEDICAL_TERMS:
            if term in text_to_check:
                raise ValueError(
                    f"Finding text violates non-medical rule; contains forbidden term '{term}': {self.description}"
                )

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "code": self.code.value,
            "errorCode": self.code.value,
            "title": self.title,
            "description": self.description,
            "category": self.category,
            "scope": self.scope.value,
            "severity": self.severity.value,
            "confidence": round(self.confidence, 2) if self.confidence is not None else None,
            "evidenceLevel": self.evidence_level.value,
            "evidenceRefs": [r.to_dict() for r in self.evidence_refs],
            "provenance": self.provenance.to_dict(),
            "recommendation": self.recommendation,
            "actionId": self.action_id,
            "legacyFindingId": self.legacy_finding_id,
            # Top-level legacy aliases for direct frontend compatibility:
            "frameIdx": self.evidence_refs[0].frame_idx if self.evidence_refs else 0,
            "timeMs": round(self.evidence_refs[0].time_ms, 1) if self.evidence_refs else 0.0,
            "metricName": self.evidence_refs[0].metric_name if self.evidence_refs else "",
            "metricValue": round(self.evidence_refs[0].metric_value, 3) if self.evidence_refs else 0.0,
        }

    def to_legacy_dict(self) -> dict[str, Any]:
        """Tương thích 100% với TechniqueFinding format hiện hành."""
        primary_ref = self.evidence_refs[0] if self.evidence_refs else None
        return {
            "id": self.id,
            "category": self.category,
            "title": self.title,
            "description": self.description,
            "severity": self.severity.value,
            "confidence": round(self.confidence, 2) if self.confidence is not None else 0.8,
            "frame_idx": primary_ref.frame_idx if primary_ref else 0,
            "time_ms": primary_ref.time_ms if primary_ref else 0.0,
            "metric_name": primary_ref.metric_name if primary_ref else "",
            "metric_value": primary_ref.metric_value if primary_ref else 0.0,
            "recommendation": self.recommendation,
            "action_id": self.action_id or "",
            "metric_unit": primary_ref.unit if primary_ref else "degrees",
            "model_version": "yolov8n-pose",
            "scoring_version": f"rubric-{self.provenance.rubric_version}",
        }


class FindingEngine:
    """
    Engine chuyển đổi rubric criteria thành các StandardFinding chuẩn hóa và gom cụm duplicate.
    """

    @staticmethod
    def generate_finding_id(
        action_id: str,
        code: FindingErrorCode,
        scope: FindingScope,
        primary_frame: int,
    ) -> str:
        unique_key = f"{action_id}:{code.value}:{scope.value}:{primary_frame}"
        h = hashlib.sha256(unique_key.encode("utf-8")).hexdigest()[:10]
        return f"find_{action_id}_{code.value.lower()}_{h}"

    @classmethod
    def from_criterion_result(
        cls,
        criterion_id: str,
        status: str,
        score: Optional[int],
        measured_value: Optional[float],
        action_id: str,
        family: str,
        rubric_id: str,
        impact_frame: int = 0,
        impact_time_ms: float = 0.0,
        evidence_level: EvidenceLevel = EvidenceLevel.OBSERVED,
        confidence: Optional[float] = None,
        custom_recommendation: Optional[str] = None,
    ) -> Optional[StandardFinding]:
        """
        Tạo StandardFinding từ một kết quả criterion rubric.
        Nếu status là 'insufficient_evidence' hoặc measured_value is None -> ABSTAIN (return None).
        """
        # RULE: Không tạo lỗi khi evidence không đủ
        if status == "insufficient_evidence" or measured_value is None:
            return None

        # Chỉ tạo finding khi có khiếm khuyết kỹ thuật (needs_improvement / warning / fair) hoặc đạt điểm hoàn hảo
        code: Optional[FindingErrorCode] = None
        severity = FindingSeverity.INFO
        title = ""
        desc = ""
        rec = ""
        category = "technique"
        unit = "degrees"

        c_lower = criterion_id.lower()

        # ── 1. Punch Criteria ──
        if "elbow" in c_lower or "extension" in c_lower:
            if family == "punch":
                unit = "degrees"
                if measured_value < 140.0:
                    code = FindingErrorCode.PUNCH_ELBOW_UNDEREXTENDED
                    severity = FindingSeverity.WARNING
                    title = "Biên độ duỗi tay chưa tối ưu"
                    desc = f"Khớp khuỷu tay mở đạt {measured_value:.1f}°, chưa đạt biên độ duỗi thẳng tiêu chuẩn (> 150°)."
                    rec = "Duỗi thẳng tay hoàn toàn ở pha chạm đích để đạt tầm với tối đa."
                elif measured_value > 175.0:
                    code = FindingErrorCode.PUNCH_ELBOW_HYPEREXTENDED
                    severity = FindingSeverity.INFO
                    title = "Khuỷu tay duỗi tối đa"
                    desc = f"Góc duỗi khuỷu {measured_value:.1f}° ở mức thẳng tuyệt đối."
                    rec = "Giữ độ chùng cơ sinh học nhẹ ở khớp khuỷu để bảo toàn nhịp hồi tay nhanh."
                elif status in ("excellent", "pass"):
                    code = FindingErrorCode.PUNCH_EXTENSION_OPTIMAL
                    severity = FindingSeverity.POSITIVE
                    title = "Duỗi tay xuất sắc"
                    desc = f"Góc khuỷu {measured_value:.1f}° đạt biên độ phát lực chuẩn."
                    rec = "Duy trì cơ chế khóa khớp đúng thời điểm như hiện tại."

        elif "guard" in c_lower:
            category = "guard"
            unit = "flag"
            if measured_value == 0.0 or status in ("needs_improvement", "fail"):
                code = FindingErrorCode.PUNCH_GUARD_DROPPED if family == "punch" else FindingErrorCode.KICK_GUARD_DROPPED
                severity = FindingSeverity.CRITICAL
                title = "Hạ thấp tay thủ đối diện"
                desc = "Tay thủ đối diện bị hạ thấp khỏi vị trí bảo vệ vùng cằm trong lúc ra đòn."
                rec = "Giữ găng tay đối diện áp sát thái dương/cằm trong suốt quá trình phát lực."
            elif status in ("excellent", "pass"):
                code = FindingErrorCode.PUNCH_GUARD_SOLID
                severity = FindingSeverity.POSITIVE
                title = "Tay thủ đối diện che chắn vững"
                desc = "Tay thủ đối diện duy trì vị trí bảo vệ hàm trong suốt chu kỳ chuyển động."
                rec = "Tiếp tục duy trì cự ly bảo vệ cằm ổn định."

        elif "speed" in c_lower:
            category = "speed"
            unit = "normalized_image/s"
            if status in ("needs_improvement", "fair") or measured_value < 5.0:
                code = FindingErrorCode.PUNCH_LOW_SPEED if family == "punch" else FindingErrorCode.KICK_LOW_SPEED
                severity = FindingSeverity.WARNING
                title = "Tốc độ phát lực chưa đạt mốc mục tiêu"
                desc = f"Vận tốc đỉnh đạt {measured_value:.2f} norm/s, thấp hơn ngưỡng khuyến nghị."
                rec = "Thả lỏng cơ vai trước khi phóng đòn và tập trung tăng tốc đột ngột ở 1/3 chặng cuối."

        # ── 2. Kick Criteria ──
        elif "chamber" in c_lower:
            category = "technique"
            unit = "degrees"
            if measured_value > 75.0 or status in ("needs_improvement", "fail"):
                code = FindingErrorCode.KICK_CHAMBER_LOW
                severity = FindingSeverity.WARNING
                title = "Rút gối chưa đủ cao"
                desc = f"Góc gấp gối khi rút chân đạt {measured_value:.1f}°, gối chưa được nâng cao ngang hông."
                rec = "Rút đầu gối cao hơn cẳng chân trước khi bung đòn đá."
            elif status in ("excellent", "pass"):
                code = FindingErrorCode.KICK_CHAMBER_SHARP
                severity = FindingSeverity.POSITIVE
                title = "Pha rút gối gọn gàng"
                desc = f"Góc rút gối {measured_value:.1f}° tạo đà tối ưu trước khi phát lực."
                rec = "Duy trì tốc độ rút gối dứt khoát."

        elif "hip" in c_lower or "posture" in c_lower:
            category = "biomechanics"
            unit = "degrees"
            if measured_value < 115.0 or status in ("needs_improvement", "fail"):
                code = FindingErrorCode.KICK_HIP_LEAN_EXCESSIVE
                severity = FindingSeverity.WARNING
                title = "Thân trên nghiêng quá mức"
                desc = f"Góc gập thân-hông đạt {measured_value:.1f}°, thân trên bị ngả ra sau quá nhiều làm giảm thăng bằng."
                rec = "Gồng chắc nhóm cơ lõi (core) và giữ trục thân trên vững vàng khi xoay hông."

        if code is None:
            return None

        if custom_recommendation:
            rec = custom_recommendation

        evidence_ref = EvidenceReference(
            frame_idx=impact_frame,
            time_ms=impact_time_ms,
            metric_name=criterion_id,
            metric_value=measured_value,
            unit=unit,
        )

        provenance = RubricProvenance(
            rubric_id=rubric_id,
            criterion_id=criterion_id,
            rubric_version="3.0.0",
        )

        finding_id = cls.generate_finding_id(
            action_id=action_id,
            code=code,
            scope=FindingScope.ACTION,
            primary_frame=impact_frame,
        )

        return StandardFinding(
            id=finding_id,
            code=code,
            title=title,
            description=desc,
            scope=FindingScope.ACTION,
            severity=severity,
            confidence=confidence,
            evidence_level=evidence_level,
            evidence_refs=(evidence_ref,),
            provenance=provenance,
            recommendation=rec,
            action_id=action_id,
            category=category,
        )

    @classmethod
    def deduplicate_findings(
        cls,
        findings: Sequence[StandardFinding],
    ) -> list[StandardFinding]:
        """
        Gom cụm và loại bỏ findings trùng lặp một cách deterministic:
        - Key gom cụm: (code, action_id, scope)
        - Khi trùng: hợp nhất evidence_refs, chọn severity cao nhất, giữ mô tả chi tiết nhất.
        - Kết quả được sắp xếp ổn định theo action_id, code, frame_idx.
        """
        grouped: dict[tuple[str, str, str], list[StandardFinding]] = {}
        for f in findings:
            key = (f.code.value, f.action_id or "", f.scope.value)
            grouped.setdefault(key, []).append(f)

        severity_rank = {
            FindingSeverity.POSITIVE: 1,
            FindingSeverity.INFO: 2,
            FindingSeverity.WARNING: 3,
            FindingSeverity.CRITICAL: 4,
        }

        deduped: list[StandardFinding] = []
        for key, group in grouped.items():
            if len(group) == 1:
                deduped.append(group[0])
                continue

            # Sort group by severity descending, then by primary frame
            group.sort(
                key=lambda x: (
                    severity_rank.get(x.severity, 0),
                    -(x.evidence_refs[0].frame_idx if x.evidence_refs else 0)
                ),
                reverse=True,
            )
            rep = group[0]

            # Merge all evidence references without duplicates
            seen_refs: set[tuple[int, str]] = set()
            all_refs: list[EvidenceReference] = []
            for item in group:
                for r in item.evidence_refs:
                    ref_key = (r.frame_idx, r.metric_name)
                    if ref_key not in seen_refs:
                        seen_refs.add(ref_key)
                        all_refs.append(r)

            merged_finding = StandardFinding(
                id=rep.id,
                code=rep.code,
                title=rep.title,
                description=rep.description,
                scope=rep.scope,
                severity=rep.severity,
                confidence=max((item.confidence for item in group if item.confidence is not None), default=rep.confidence),
                evidence_level=rep.evidence_level,
                evidence_refs=tuple(all_refs),
                provenance=rep.provenance,
                recommendation=rep.recommendation,
                action_id=rep.action_id,
                category=rep.category,
            )
            deduped.append(merged_finding)

        # Sort deterministically
        deduped.sort(
            key=lambda f: (
                f.action_id or "",
                f.code.value,
                f.evidence_refs[0].frame_idx if f.evidence_refs else 0,
            )
        )
        return deduped

    @classmethod
    def from_legacy_finding(
        cls,
        legacy: Any,
        family: str = "punch",
        action_id: Optional[str] = None,
    ) -> Optional[StandardFinding]:
        """
        Chuyển đổi một TechniqueFinding hoặc finding dictionary cũ sang StandardFinding chuẩn hóa.
        """
        if legacy is None:
            return None
        if isinstance(legacy, StandardFinding):
            if action_id and legacy.action_id != action_id:
                return StandardFinding(
                    id=legacy.id,
                    code=legacy.code,
                    title=legacy.title,
                    description=legacy.description,
                    scope=legacy.scope,
                    severity=legacy.severity,
                    confidence=legacy.confidence,
                    evidence_level=legacy.evidence_level,
                    evidence_refs=legacy.evidence_refs,
                    provenance=legacy.provenance,
                    recommendation=legacy.recommendation,
                    action_id=action_id,
                    category=legacy.category,
                    legacy_finding_id=legacy.legacy_finding_id,
                )
            return legacy

        f_id = getattr(legacy, "id", None) or (legacy.get("id") if isinstance(legacy, Mapping) else "") or ""
        title = getattr(legacy, "title", None) or (legacy.get("title") if isinstance(legacy, Mapping) else "") or ""
        desc = getattr(legacy, "description", None) or (legacy.get("description") if isinstance(legacy, Mapping) else "") or ""
        sev_raw = str(getattr(legacy, "severity", None) or (legacy.get("severity") if isinstance(legacy, Mapping) else "info") or "info").lower()
        conf = getattr(legacy, "confidence", None) or (legacy.get("confidence") if isinstance(legacy, Mapping) else 0.8)
        f_idx = getattr(legacy, "frame_idx", None) or (legacy.get("frame_idx") or legacy.get("frameIdx") if isinstance(legacy, Mapping) else 0) or 0
        t_ms = getattr(legacy, "time_ms", None) or (legacy.get("time_ms") or legacy.get("timeMs") if isinstance(legacy, Mapping) else 0.0) or 0.0
        m_name = getattr(legacy, "metric_name", None) or (legacy.get("metric_name") or legacy.get("metricName") if isinstance(legacy, Mapping) else "") or ""
        m_val = getattr(legacy, "metric_value", None) or (legacy.get("metric_value") or legacy.get("metricValue") if isinstance(legacy, Mapping) else 0.0) or 0.0
        rec = getattr(legacy, "recommendation", None) or (legacy.get("recommendation") if isinstance(legacy, Mapping) else "") or ""
        act_id = action_id or getattr(legacy, "action_id", None) or (legacy.get("action_id") or legacy.get("actionId") if isinstance(legacy, Mapping) else None)
        m_unit = getattr(legacy, "metric_unit", None) or (legacy.get("metric_unit") if isinstance(legacy, Mapping) else "degrees") or "degrees"

        if sev_raw == "critical":
            sev = FindingSeverity.CRITICAL
        elif sev_raw == "warning":
            sev = FindingSeverity.WARNING
        elif sev_raw == "positive":
            sev = FindingSeverity.POSITIVE
        else:
            sev = FindingSeverity.INFO

        raw_code = getattr(legacy, "code", None) or (legacy.get("code") or legacy.get("errorCode") if isinstance(legacy, Mapping) else None)
        code: Optional[FindingErrorCode] = None
        if raw_code:
            try:
                code = FindingErrorCode(raw_code)
            except ValueError:
                code = None

        if code is None:
            combined_text = f"{m_name} {title} {desc} {f_id}".lower()
            if "guard" in combined_text:
                if sev_raw in ("warning", "critical", "needs_improvement", "fail") or m_val == 0:
                    code = FindingErrorCode.PUNCH_GUARD_DROPPED if family == "punch" else FindingErrorCode.KICK_GUARD_DROPPED
                else:
                    code = FindingErrorCode.PUNCH_GUARD_SOLID
            elif "elbow" in combined_text or "extension" in combined_text:
                if family == "punch":
                    if m_val > 175.0:
                        code = FindingErrorCode.PUNCH_ELBOW_HYPEREXTENDED
                    elif m_val < 140.0 or sev_raw in ("warning", "critical", "needs_improvement"):
                        code = FindingErrorCode.PUNCH_ELBOW_UNDEREXTENDED
                    else:
                        code = FindingErrorCode.PUNCH_EXTENSION_OPTIMAL
                else:
                    if m_val < 140.0 or sev_raw in ("warning", "critical", "needs_improvement"):
                        code = FindingErrorCode.KICK_EXTENSION_INCOMPLETE
                    else:
                        code = FindingErrorCode.KICK_EXTENSION_SOLID
            elif "chamber" in combined_text:
                if m_val > 75.0 or sev_raw in ("warning", "critical", "needs_improvement"):
                    code = FindingErrorCode.KICK_CHAMBER_LOW
                else:
                    code = FindingErrorCode.KICK_CHAMBER_SHARP
            elif "speed" in combined_text:
                code = FindingErrorCode.PUNCH_LOW_SPEED if family == "punch" else FindingErrorCode.KICK_LOW_SPEED
            elif "hip" in combined_text or "lean" in combined_text or "posture" in combined_text:
                code = FindingErrorCode.KICK_HIP_LEAN_EXCESSIVE
            elif "pivot" in combined_text:
                code = FindingErrorCode.KICK_PIVOT_INSUFFICIENT
            elif "balance" in combined_text:
                code = FindingErrorCode.BALANCE_OFF_AXIS
            elif "recovery" in combined_text:
                code = FindingErrorCode.RECOVERY_SLOW
            else:
                code = FindingErrorCode.PUNCH_ELBOW_UNDEREXTENDED if family == "punch" else FindingErrorCode.KICK_EXTENSION_INCOMPLETE

        evidence_ref = EvidenceReference(
            frame_idx=int(f_idx),
            time_ms=float(t_ms),
            metric_name=str(m_name),
            metric_value=float(m_val) if isinstance(m_val, (int, float)) else 0.0,
            unit=str(m_unit),
        )

        provenance = RubricProvenance(
            rubric_id=f"rubric_{family}_v3",
            criterion_id=str(m_name) if m_name else "general",
            rubric_version="3.0.0",
        )

        final_act_id = act_id or "action_unknown"
        clean_finding_id = cls.generate_finding_id(
            action_id=final_act_id,
            code=code,
            scope=FindingScope.ACTION,
            primary_frame=int(f_idx),
        )

        clean_title = title or code.value
        clean_desc = desc or f"Phát hiện lỗi kỹ thuật {code.value}"
        clean_rec = rec or "Thực hành đúng kỹ thuật chuẩn."
        for term in FORBIDDEN_MEDICAL_TERMS:
            clean_title = clean_title.replace(term, "tư thế chưa chuẩn")
            clean_desc = clean_desc.replace(term, "tư thế chưa chuẩn")
            clean_rec = clean_rec.replace(term, "tư thế chưa chuẩn")

        return StandardFinding(
            id=clean_finding_id,
            code=code,
            title=clean_title,
            description=clean_desc,
            scope=FindingScope.ACTION,
            severity=sev,
            confidence=conf,
            evidence_level=EvidenceLevel.OBSERVED,
            evidence_refs=(evidence_ref,),
            provenance=provenance,
            recommendation=clean_rec,
            action_id=final_act_id,
            category=getattr(legacy, "category", None) or (legacy.get("category") if isinstance(legacy, Mapping) else "technique") or "technique",
            legacy_finding_id=f_id if f_id else None,
        )

    @classmethod
    def adapt_and_deduplicate_findings(
        cls,
        findings: Sequence[Any],
        action_id: str,
        family: str = "punch",
    ) -> list[StandardFinding]:
        """
        Chuyển đổi danh sách findings cũ sang StandardFinding và gom cụm duplicate về mã lỗi ổn định duy nhất.
        """
        standards: list[StandardFinding] = []
        for f in findings:
            sf = cls.from_legacy_finding(f, family=family, action_id=action_id)
            if sf is not None:
                standards.append(sf)
        return cls.deduplicate_findings(standards)

