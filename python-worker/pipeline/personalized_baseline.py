"""
personalized_baseline.py — Personalized Baseline Engine (Task 27)

Provides:
- Statistical aggregation of an athlete's historical performance metrics.
- Baseline eligibility validation:
  * Minimum session count requirement (min_sessions >= 3)
  * Quality filtering (rejects BLOCKED or DEGRADED sessions)
  * Stance and technique consistency
  * Strict Athlete ID ownership verification
  * Duplicate session ID rejection
  * Staleness evaluation using timezone-aware session timestamps and max_age_days
- Invariants:
  * Never substitutes population defaults for personal baseline.
  * Deterministic calculation with full session provenance and camelCase serialization.
"""

from __future__ import annotations

import hashlib
import math
from datetime import datetime, timezone
from dataclasses import dataclass, field
from typing import Any, Mapping, Optional, Sequence

from pipeline.contracts import (
    BaselineEligibilityStatus,
    QualityStatus,
    ValidationStatus,
    deep_freeze,
    to_json_safe,
)


@dataclass(frozen=True)
class BaselineMetricSummary:
    metric_name: str
    mean: float
    median: float
    std_dev: float
    p25: float
    p75: float
    sample_count: int

    def to_dict(self) -> dict[str, Any]:
        return {
            "metricName": self.metric_name,
            "mean": round(self.mean, 4),
            "median": round(self.median, 4),
            "stdDev": round(self.std_dev, 4),
            "p25": round(self.p25, 4),
            "p75": round(self.p75, 4),
            "sampleCount": self.sample_count,
        }


@dataclass(frozen=True)
class PersonalizedBaseline:
    baseline_id: str
    athlete_id: str
    technique: str
    stance: str
    baseline_version: str
    session_count: int
    eligibility_status: BaselineEligibilityStatus
    metric_summaries: Mapping[str, BaselineMetricSummary]
    source_session_ids: tuple[str, ...]
    is_active: bool

    def to_dict(self) -> dict[str, Any]:
        return {
            "baselineId": self.baseline_id,
            "athleteId": self.athlete_id,
            "technique": self.technique,
            "stance": self.stance,
            "baselineVersion": self.baseline_version,
            "sessionCount": self.session_count,
            "eligibilityStatus": self.eligibility_status.value,
            "metricSummaries": {k: v.to_dict() for k, v in self.metric_summaries.items()},
            "sourceSessionIds": list(self.source_session_ids),
            "isActive": self.is_active,
        }


def _parse_timestamp_utc(ts_str: Optional[str]) -> Optional[datetime]:
    if not ts_str:
        return None
    try:
        # Normalize trailing Z to +00:00
        norm_ts = ts_str.replace("Z", "+00:00")
        dt = datetime.fromisoformat(norm_ts)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


class BaselineEngine:
    """Builds personalized baselines from historical session data with strict validation."""

    def __init__(self, min_sessions: int = 3, max_age_days: int = 180):
        self.min_sessions = min_sessions
        self.max_age_days = max_age_days

    def compute_baseline(
        self,
        athlete_id: str,
        technique: str,
        stance: str,
        historical_sessions: Sequence[Mapping[str, Any]],
        current_time_utc: Optional[datetime] = None,
    ) -> PersonalizedBaseline:
        now_dt = current_time_utc or datetime.now(timezone.utc)
        seen_session_ids: set[str] = set()
        eligible_sessions: list[Mapping[str, Any]] = []

        all_stale = True if historical_sessions else False

        for s in historical_sessions:
            s_id = str(s.get("sessionId") or s.get("session_id") or "")
            if not s_id or s_id in seen_session_ids:
                continue  # Reject duplicate or missing session IDs
            seen_session_ids.add(s_id)

            # Athlete ownership verification
            s_ath = str(s.get("athleteId") or s.get("athlete_id") or athlete_id)
            if s_ath != athlete_id:
                continue  # Reject session from different athlete

            # Quality check
            q_status = s.get("qualityStatus") or s.get("quality_status") or QualityStatus.GOOD
            if isinstance(q_status, QualityStatus):
                q_val = q_status.value
            else:
                q_val = str(q_status).upper()

            if q_val in ["BLOCKED", "DEGRADED"]:
                continue

            # Technique and stance consistency
            s_tech = str(s.get("technique") or "")
            s_stance = str(s.get("stance") or "")
            if s_tech != technique or s_stance != stance:
                continue

            # Staleness check
            s_ts = _parse_timestamp_utc(s.get("timestamp") or s.get("createdAt") or s.get("processedAt"))
            if s_ts is not None:
                age_days = (now_dt - s_ts).total_seconds() / 86400.0
                if age_days <= self.max_age_days:
                    all_stale = False
                    eligible_sessions.append(s)
            else:
                all_stale = False
                eligible_sessions.append(s)

        source_session_ids = tuple(
            str(s.get("sessionId") or s.get("session_id")) for s in eligible_sessions
        )
        token = f"{athlete_id}:{technique}:{stance}:{sorted(source_session_ids)}"
        baseline_id = f"pbase_{hashlib.sha256(token.encode('utf-8')).hexdigest()[:16]}"

        if all_stale and len(historical_sessions) >= self.min_sessions:
            return PersonalizedBaseline(
                baseline_id=baseline_id,
                athlete_id=athlete_id,
                technique=technique,
                stance=stance,
                baseline_version="1.0.0",
                session_count=len(eligible_sessions),
                eligibility_status=BaselineEligibilityStatus.STALE,
                metric_summaries={},
                source_session_ids=source_session_ids,
                is_active=False,
            )

        if len(eligible_sessions) < self.min_sessions:
            return PersonalizedBaseline(
                baseline_id=baseline_id,
                athlete_id=athlete_id,
                technique=technique,
                stance=stance,
                baseline_version="1.0.0",
                session_count=len(eligible_sessions),
                eligibility_status=BaselineEligibilityStatus.INSUFFICIENT_SESSIONS,
                metric_summaries={},
                source_session_ids=source_session_ids,
                is_active=False,
            )

        # Aggregate metrics
        metric_values: dict[str, list[float]] = {}
        for s in eligible_sessions:
            for k, v in s.get("metrics", {}).items():
                if isinstance(v, (int, float)) and math.isfinite(v):
                    metric_values.setdefault(k, []).append(float(v))

        summaries = {}
        for m_name, vals in metric_values.items():
            if len(vals) >= self.min_sessions:
                n = len(vals)
                m_mean = sum(vals) / n
                m_var = sum((x - m_mean) ** 2 for x in vals) / n if n > 1 else 0.0
                m_std = math.sqrt(m_var)
                sorted_vals = sorted(vals)
                p25 = sorted_vals[int(0.25 * (n - 1))]
                p50 = sorted_vals[int(0.50 * (n - 1))]
                p75 = sorted_vals[int(0.75 * (n - 1))]

                summaries[m_name] = BaselineMetricSummary(
                    metric_name=m_name,
                    mean=m_mean,
                    median=p50,
                    std_dev=m_std,
                    p25=p25,
                    p75=p75,
                    sample_count=n,
                )

        is_active = len(summaries) > 0

        return PersonalizedBaseline(
            baseline_id=baseline_id,
            athlete_id=athlete_id,
            technique=technique,
            stance=stance,
            baseline_version="1.0.0",
            session_count=len(eligible_sessions),
            eligibility_status=BaselineEligibilityStatus.ELIGIBLE if is_active else BaselineEligibilityStatus.INSUFFICIENT_SESSIONS,
            metric_summaries=summaries,
            source_session_ids=source_session_ids,
            is_active=is_active,
        )
