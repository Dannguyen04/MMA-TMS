"""
session_aggregation.py — Session Aggregation & Priority Engine (Task 11)

Tổng hợp các action thành session insights:
- Thống kê counts/distributions theo family, technique, side, và assessment status.
- Minh bạch mẫu số (denominator transparency): Hiển thị rõ tỷ lệ unknown/abstained/degraded,
  tuyệt đối KHÔNG âm thầm loại bỏ khỏi mẫu số.
- Thuật toán xếp hạng deterministic cho TỐI ĐA 3 priority findings theo công thức công khai:
    priority_score = severity_weight * frequency_factor * quality_weight * recency_factor
- Hỗ trợ đầy đủ trường hợp empty session (0 actions) và session thiếu evidence.
- Không cherry-pick action tốt hay xấu.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
import math
from typing import Any, Mapping, Optional, Sequence

from pipeline.contracts import deep_freeze, to_json_safe
from pipeline.finding_engine import (
    FindingErrorCode,
    FindingScope,
    FindingSeverity,
    StandardFinding,
)


@dataclass(frozen=True)
class SessionCoverageSummary:
    """Thống kê mẫu số minh bạch (Denominator Transparency)."""
    total_detected_actions: int
    assessed_actions_count: int
    insufficient_evidence_count: int
    insufficient_evidence_rate: float
    unknown_technique_count: int
    unknown_technique_rate: float
    degraded_quality_count: int
    degraded_quality_rate: float

    def to_dict(self) -> dict[str, Any]:
        return {
            "totalDetectedActions": self.total_detected_actions,
            "assessedActionsCount": self.assessed_actions_count,
            "insufficientEvidenceCount": self.insufficient_evidence_count,
            "insufficientEvidenceRate": round(self.insufficient_evidence_rate, 3),
            "unknownTechniqueCount": self.unknown_technique_count,
            "unknownTechniqueRate": round(self.unknown_technique_rate, 3),
            "degradedQualityCount": self.degraded_quality_count,
            "degradedQualityRate": round(self.degraded_quality_rate, 3),
        }


@dataclass(frozen=True)
class PriorityFindingSummary:
    """Finding ưu tiên hàng đầu trong buổi tập với đầy đủ bằng chứng và điểm ưu tiên."""
    rank: int
    code: str
    title: str
    description: str
    severity: str
    frequency: int
    priority_score: float
    affected_action_ids: tuple[str, ...]
    representative_frame: int
    representative_time_ms: float
    primary_recommendation: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "rank": self.rank,
            "code": self.code,
            "title": self.title,
            "description": self.description,
            "severity": self.severity,
            "frequency": self.frequency,
            "priorityScore": round(self.priority_score, 2),
            "affectedActionIds": list(self.affected_action_ids),
            "representativeFrame": self.representative_frame,
            "representativeTimeMs": round(self.representative_time_ms, 1),
            "primaryRecommendation": self.primary_recommendation,
        }


@dataclass(frozen=True)
class SessionInsights:
    """Tổng hợp toàn bộ insights của phiên phân tích."""
    status: str  # "completed" | "empty_session" | "insufficient_evidence" | "blocked"
    total_actions: int
    family_distribution: Mapping[str, int]
    technique_distribution: Mapping[str, int]
    side_distribution: Mapping[str, int]
    status_distribution: Mapping[str, int]
    coverage_summary: SessionCoverageSummary
    priority_findings: tuple[PriorityFindingSummary, ...]
    session_version: str = "1.0.0"
    quality_status: Optional[str] = None
    adjusted_evidence_level: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        d = {
            "status": self.status,
            "totalActions": self.total_actions,
            "familyDistribution": dict(self.family_distribution),
            "techniqueDistribution": dict(self.technique_distribution),
            "sideDistribution": dict(self.side_distribution),
            "statusDistribution": dict(self.status_distribution),
            "coverageSummary": self.coverage_summary.to_dict(),
            "priorityFindings": [p.to_dict() for p in self.priority_findings],
            "sessionVersion": self.session_version,
        }
        if self.quality_status is not None:
            d["qualityStatus"] = self.quality_status
        if self.adjusted_evidence_level is not None:
            d["adjustedEvidenceLevel"] = self.adjusted_evidence_level
        return d


class SessionAggregationEngine:
    """
    Engine tổng hợp buổi tập và tính toán 3 ưu tiên lỗi kỹ thuật lớn nhất.
    """

    SEVERITY_WEIGHTS = {
        FindingSeverity.CRITICAL.value: 4.0,
        FindingSeverity.WARNING.value: 2.5,
        FindingSeverity.INFO.value: 1.0,
        FindingSeverity.POSITIVE.value: 0.0,  # Positive demonstrations do not compete for error correction priority
        "critical": 4.0,
        "warning": 2.5,
        "info": 1.0,
        "positive": 0.0,
    }

    EVIDENCE_WEIGHTS = {
        "observed": 1.0,
        "derived_proxy": 0.7,
        "unavailable": 0.0,
    }

    @classmethod
    def aggregate_session(
        cls,
        actions: Sequence[Mapping[str, Any]],
        quality_status: Optional[str] = "pass",
    ) -> SessionInsights:
        """
        Tổng hợp danh sách actions thành SessionInsights với tối đa 3 priority findings.
        """
        total = len(actions)

        # 1. Handle Empty Session
        if total == 0:
            coverage = SessionCoverageSummary(
                total_detected_actions=0,
                assessed_actions_count=0,
                insufficient_evidence_count=0,
                insufficient_evidence_rate=0.0,
                unknown_technique_count=0,
                unknown_technique_rate=0.0,
                degraded_quality_count=0,
                degraded_quality_rate=0.0,
            )
            adj_level = (
                "unavailable" if quality_status == "blocked"
                else "derived_proxy" if quality_status == "degraded"
                else "observed"
            )
            return SessionInsights(
                status="blocked" if quality_status == "blocked" else "empty_session",
                total_actions=0,
                family_distribution={},
                technique_distribution={},
                side_distribution={},
                status_distribution={},
                coverage_summary=coverage,
                priority_findings=(),
                quality_status=quality_status,
                adjusted_evidence_level=adj_level,
            )

        family_counts: dict[str, int] = {}
        technique_counts: dict[str, int] = {}
        side_counts: dict[str, int] = {}
        status_counts: dict[str, int] = {}

        insufficient_ev_count = 0
        unknown_tech_count = 0
        degraded_count = 0

        all_candidate_findings: list[dict[str, Any]] = []

        for idx, act in enumerate(actions):
            fam = str(act.get("family", "unknown"))
            tech = str(act.get("technique", "unknown"))
            side = str(act.get("attackingSide", "unknown"))
            
            assessment = act.get("assessment", {})
            astatus = str(assessment.get("status", "unknown"))

            family_counts[fam] = family_counts.get(fam, 0) + 1
            technique_counts[tech] = technique_counts.get(tech, 0) + 1
            side_counts[side] = side_counts.get(side, 0) + 1
            status_counts[astatus] = status_counts.get(astatus, 0) + 1

            if astatus == "insufficient_evidence":
                insufficient_ev_count += 1

            if tech in ("unknown", "", "other_strike", "non_strike"):
                unknown_tech_count += 1

            # Quality gate influence
            act_quality = act.get("qualityStatus", quality_status)
            if act_quality == "degraded":
                degraded_count += 1

            # Collect findings for ranking
            findings = assessment.get("findings", [])
            for f in findings:
                f_copy = dict(f)
                f_copy["action_idx"] = idx
                f_copy["action_id"] = act.get("id", f"action_{idx}")
                all_candidate_findings.append(f_copy)

        insufficient_rate = insufficient_ev_count / total
        unknown_rate = unknown_tech_count / total
        degraded_rate = degraded_count / total
        assessed_count = total - insufficient_ev_count

        coverage = SessionCoverageSummary(
            total_detected_actions=total,
            assessed_actions_count=assessed_count,
            insufficient_evidence_count=insufficient_ev_count,
            insufficient_evidence_rate=insufficient_rate,
            unknown_technique_count=unknown_tech_count,
            unknown_technique_rate=unknown_rate,
            degraded_quality_count=degraded_count,
            degraded_quality_rate=degraded_rate,
        )

        session_status = "completed"
        if quality_status == "blocked":
            session_status = "blocked"
            return SessionInsights(
                status="blocked",
                total_actions=total,
                family_distribution=family_counts,
                technique_distribution=technique_counts,
                side_distribution=side_counts,
                status_distribution=status_counts,
                coverage_summary=coverage,
                priority_findings=(),
                quality_status="blocked",
                adjusted_evidence_level="unavailable",
            )
        elif insufficient_rate >= 0.99:
            session_status = "insufficient_evidence"

        # 2. Group findings by code for priority ranking
        grouped_findings: dict[str, list[dict[str, Any]]] = {}
        for f in all_candidate_findings:
            # Finding code can be code, id or title
            code = f.get("code") or f.get("id") or f.get("metric_name") or "UNKNOWN_ERROR"
            grouped_findings.setdefault(code, []).append(f)

        ranked_candidates: list[tuple[float, str, PriorityFindingSummary]] = []

        for code, group in grouped_findings.items():
            first_f = group[0]
            severity_str = str(first_f.get("severity", "info")).lower()
            sev_weight = cls.SEVERITY_WEIGHTS.get(severity_str, 1.0)
            if sev_weight <= 0.0:
                # Skip positive or zero-weight findings from error priorities
                continue

            frequency = len(group)
            freq_factor = 1.0 + math.log2(frequency) if frequency > 0 else 1.0

            # Evidence quality factor
            ev_level = str(first_f.get("evidenceLevel", first_f.get("evidence_level", "observed"))).lower()
            quality_factor = cls.EVIDENCE_WEIGHTS.get(ev_level, 1.0)

            # Recency factor: normalized position of the latest occurrence
            max_idx = max(item["action_idx"] for item in group)
            recency_factor = 1.0 + 0.2 * (max_idx / total if total > 0 else 0.0)

            # Formula
            priority_score = sev_weight * freq_factor * quality_factor * recency_factor

            affected_action_ids = tuple(dict.fromkeys(item["action_id"] for item in group))
            rep_frame = first_f.get("frameIdx", first_f.get("frame_idx", 0))
            rep_time = first_f.get("timeMs", first_f.get("time_ms", 0.0))
            title = first_f.get("title", code)
            desc = first_f.get("description", "")
            rec = first_f.get("recommendation", "Thực hành đúng kỹ thuật chuẩn.")

            summary_item = PriorityFindingSummary(
                rank=0,  # assigned after sorting
                code=code,
                title=title,
                description=desc,
                severity=severity_str,
                frequency=frequency,
                priority_score=priority_score,
                affected_action_ids=affected_action_ids,
                representative_frame=rep_frame,
                representative_time_ms=rep_time,
                primary_recommendation=rec,
            )

            # Tuple for deterministic sort: (-priority_score, code, representative_frame)
            ranked_candidates.append((-priority_score, code, summary_item))

        # 3. Deterministic sort and pick TOP 3
        ranked_candidates.sort(key=lambda x: (x[0], x[1], x[2].representative_frame))

        top_3: list[PriorityFindingSummary] = []
        for i, (_, _, item) in enumerate(ranked_candidates[:3]):
            top_3.append(
                PriorityFindingSummary(
                    rank=i + 1,
                    code=item.code,
                    title=item.title,
                    description=item.description,
                    severity=item.severity,
                    frequency=item.frequency,
                    priority_score=item.priority_score,
                    affected_action_ids=item.affected_action_ids,
                    representative_frame=item.representative_frame,
                    representative_time_ms=item.representative_time_ms,
                    primary_recommendation=item.primary_recommendation,
                )
            )

        adj_level = (
            "unavailable" if quality_status == "blocked"
            else "derived_proxy" if quality_status == "degraded"
            else "observed"
        )
        return SessionInsights(
            status=session_status,
            total_actions=total,
            family_distribution=family_counts,
            technique_distribution=technique_counts,
            side_distribution=side_counts,
            status_distribution=status_counts,
            coverage_summary=coverage,
            priority_findings=tuple(top_3),
            quality_status=quality_status,
            adjusted_evidence_level=adj_level,
        )

