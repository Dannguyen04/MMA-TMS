"""
personalized_baseline.py — Personalized Baseline Engine (Task 27 & TL-06)

Provides:
- Statistical aggregation of an athlete's historical performance metrics.
- Baseline eligibility validation:
  * Athlete ID ownership & cross-athlete leakage prevention
  * Explicit stance verification (orthodox or southpaw, no implicit defaults)
  * Camera view compatibility gating
  * Coach-approved, active, and non-revoked reference validation
  * Pose quality filtering (rejects BLOCKED or DEGRADED)
  * Martial art and technique consistency
  * Rubric version compatibility
  * Metric definition and unit consistency
  * Duplicate session/reference ID rejection
  * Train/test split leakage protection
  * Staleness evaluation using timezone-aware timestamps and max_age_days
  * Configurable minimum valid sample count (product default: 5 references)
- Invariants:
  * Never substitutes population defaults for personal baseline.
  * Deterministic calculation with full session/action provenance, invalidation rules, and camelCase serialization.
"""

from __future__ import annotations

import hashlib
import math
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Mapping, Optional, Sequence

from pipeline.contracts import (
    BaselineEligibilityStatus,
    QualityStatus,
    deep_freeze,
    to_json_safe,
)

VALID_STANCES = {"orthodox", "southpaw"}


def normalize_stance(val: Optional[str]) -> Optional[str]:
    """Strict normalization of stance; returns None if missing, empty, or unknown."""
    if val is None or not isinstance(val, str):
        return None
    s = val.strip().lower()
    return s if s in VALID_STANCES else None


def normalize_camera_view(val: Optional[str]) -> Optional[str]:
    """Normalize camera view string to standard canonical tokens."""
    if val is None:
        return None
    if isinstance(val, bool) or not isinstance(val, str):
        return None
    s = val.strip().lower().replace(" ", "_").replace("-", "_")
    if not s:
        return None
    alias_map = {
        "frontal": "front",
        "sagittal": "side",
        "left_side": "side",
        "right_side": "side",
        "45": "front_45",
        "angle_45": "front_45",
        "diagonal_front": "front_45",
        "diagonal_side": "side_45",
    }
    return alias_map.get(s, s)


def are_camera_views_compatible(view_a: Optional[str], view_b: Optional[str]) -> bool:
    """Returns True if two camera views are compatible for baseline comparison."""
    if not view_a or not view_b:
        return False
    norm_a = normalize_camera_view(view_a)
    norm_b = normalize_camera_view(view_b)
    if not norm_a or not norm_b or norm_a == "unknown" or norm_b == "unknown":
        return False
    return norm_a == norm_b


def _parse_timestamp_utc(ts_str: Optional[str]) -> Optional[datetime]:
    if not ts_str:
        return None
    try:
        norm_ts = str(ts_str).replace("Z", "+00:00")
        dt = datetime.fromisoformat(norm_ts)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


@dataclass(frozen=True)
class BaselineConfig:
    min_references: int = 5  # Product default aligned to spec's 5-10 references
    max_age_days: int = 180
    allowed_quality_statuses: tuple[str, ...] = ("EXCELLENT", "GOOD", "ACCEPTABLE")
    require_coach_approval: bool = True
    require_explicit_stance: bool = True
    require_camera_compatibility: bool = True
    enforce_leakage_protection: bool = True
    policy_version: str = "baseline_policy_v1.0"
    config_version: str = "baseline_cfg_v1.0"

    def to_dict(self) -> dict[str, Any]:
        return {
            "minReferences": self.min_references,
            "maxAgeDays": self.max_age_days,
            "allowedQualityStatuses": list(self.allowed_quality_statuses),
            "requireCoachApproval": self.require_coach_approval,
            "requireExplicitStance": self.require_explicit_stance,
            "requireCameraCompatibility": self.require_camera_compatibility,
            "enforceLeakageProtection": self.enforce_leakage_protection,
            "policyVersion": self.policy_version,
            "configVersion": self.config_version,
        }


@dataclass(frozen=True)
class BaselineMetricSummary:
    metric_name: str
    mean: float
    median: float
    std_dev: float
    p25: float
    p75: float
    sample_count: int
    unit: Optional[str] = None
    definition: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        res: dict[str, Any] = {
            "metricName": self.metric_name,
            "mean": round(self.mean, 4),
            "median": round(self.median, 4),
            "stdDev": round(self.std_dev, 4),
            "p25": round(self.p25, 4),
            "p75": round(self.p75, 4),
            "sampleCount": self.sample_count,
        }
        if self.unit is not None:
            res["unit"] = self.unit
        if self.definition is not None:
            res["definition"] = self.definition
        return res


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
    # TL-06 extended metadata
    martial_art: Optional[str] = None
    camera_view: Optional[str] = None
    source_action_ids: tuple[str, ...] = ()
    source_revisions: tuple[str, ...] = ()
    approved_by_coach_ids: tuple[str, ...] = ()
    policy_version: str = "baseline_policy_v1.0"
    config_version: str = "baseline_cfg_v1.0"
    generated_at: str = ""
    invalidation_rules: Mapping[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "baselineId": self.baseline_id,
            "athleteId": self.athlete_id,
            "martialArt": self.martial_art,
            "technique": self.technique,
            "stance": self.stance,
            "cameraView": self.camera_view,
            "baselineVersion": self.baseline_version,
            "policyVersion": self.policy_version,
            "configVersion": self.config_version,
            "sessionCount": self.session_count,
            "sampleCount": self.session_count,
            "eligibilityStatus": self.eligibility_status.value,
            "metricSummaries": {k: v.to_dict() for k, v in self.metric_summaries.items()},
            "sourceSessionIds": list(self.source_session_ids),
            "sourceActionIds": list(self.source_action_ids),
            "sourceRevisions": list(self.source_revisions),
            "approvedByCoachIds": list(self.approved_by_coach_ids),
            "generatedAt": self.generated_at,
            "invalidationRules": dict(self.invalidation_rules),
            "isActive": self.is_active,
        }


class BaselineEngine:
    """Builds personalized baselines from historical session/reference data with strict validation."""

    def __init__(
        self,
        min_sessions: Optional[int] = None,
        max_age_days: Optional[int] = None,
        config: Optional[BaselineConfig] = None,
        min_references: Optional[int] = None,
        require_coach_approval: Optional[bool] = None,
    ):
        base_cfg = config or BaselineConfig()
        effective_min = min_references or min_sessions or base_cfg.min_references
        effective_max_age = max_age_days if max_age_days is not None else base_cfg.max_age_days
        effective_coach_appr = (
            require_coach_approval
            if require_coach_approval is not None
            else (False if min_sessions is not None and config is None and min_references is None else base_cfg.require_coach_approval)
        )

        self._legacy_mode = (
            min_sessions is not None and min_references is None and config is None
        )

        self.config = BaselineConfig(
            min_references=effective_min,
            max_age_days=effective_max_age,
            allowed_quality_statuses=base_cfg.allowed_quality_statuses,
            require_coach_approval=effective_coach_appr,
            require_explicit_stance=base_cfg.require_explicit_stance,
            require_camera_compatibility=base_cfg.require_camera_compatibility,
            enforce_leakage_protection=base_cfg.enforce_leakage_protection,
            policy_version=base_cfg.policy_version,
            config_version=base_cfg.config_version,
        )
        self.min_sessions = effective_min
        self.min_references = effective_min
        self.max_age_days = effective_max_age

    def compute_baseline(
        self,
        athlete_id: str,
        technique: str,
        stance: str,
        historical_sessions: Optional[Sequence[Mapping[str, Any]]] = None,
        *,
        historical_references: Optional[Sequence[Mapping[str, Any]]] = None,
        camera_view: Optional[str] = None,
        martial_art: Optional[str] = None,
        rubric_version: Optional[str] = None,
        evaluation_split: Optional[str] = "train",
        current_time_utc: Optional[datetime] = None,
        config: Optional[BaselineConfig] = None,
    ) -> PersonalizedBaseline:
        cfg = config or self.config
        now_dt = current_time_utc or datetime.now(timezone.utc)
        generated_at = now_dt.isoformat()

        # 1. Enforce explicit stance
        norm_stance = normalize_stance(stance)
        if norm_stance is None:
            # Stance cannot be empty, None, or default; reject immediately
            return PersonalizedBaseline(
                baseline_id=f"pbase_invalid_stance_{hashlib.sha256((athlete_id or '').encode()).hexdigest()[:16]}",
                athlete_id=athlete_id or "",
                technique=technique or "",
                stance=stance or "",
                baseline_version="1.0.0",
                session_count=0,
                eligibility_status=BaselineEligibilityStatus.INCOMPATIBLE_STANCE,
                metric_summaries={},
                source_session_ids=(),
                is_active=False,
                martial_art=martial_art,
                camera_view=camera_view,
                policy_version=cfg.policy_version,
                config_version=cfg.config_version,
                generated_at=generated_at,
                invalidation_rules={
                    "reason": "Explicit stance ('orthodox' or 'southpaw') is required.",
                    "provided_stance": stance,
                },
            )

        norm_cam = normalize_camera_view(camera_view)

        # Candidates pool
        candidates = list(historical_references or []) if historical_references is not None else list(historical_sessions or [])

        seen_ids: set[str] = set()
        eligible_sessions: list[Mapping[str, Any]] = []

        cross_athlete_leakage_detected = False
        split_leakage_detected = False
        camera_mismatch_detected = False
        rubric_mismatch_detected = False
        all_stale = True if candidates else False

        for s in candidates:
            # Identifier
            s_id = str(
                s.get("sessionId")
                or s.get("session_id")
                or s.get("id")
                or s.get("referenceId")
                or s.get("reference_id")
                or ""
            )
            if not s_id or s_id in seen_ids:
                continue
            seen_ids.add(s_id)

            # Athlete ownership verification & cross-athlete leakage
            s_ath = str(s.get("athleteId") or s.get("athlete_id") or s.get("fighterId") or s.get("fighter_id") or "")
            if s_ath and s_ath != athlete_id:
                cross_athlete_leakage_detected = True
                continue

            # Train / test split leakage check
            s_split = str(s.get("split") or s.get("datasetSplit") or s.get("dataset_split") or "").lower()
            if cfg.enforce_leakage_protection and s_split in {"test", "eval", "gold", "benchmark", "validation"}:
                if evaluation_split in {"train", None}:
                    split_leakage_detected = True
                    continue

            # Martial art match
            if martial_art:
                s_ma = str(s.get("martialArt") or s.get("martial_art") or "")
                if s_ma and s_ma.lower() != martial_art.lower():
                    continue

            # Technique match
            s_tech = str(s.get("technique") or s.get("techniqueType") or s.get("technique_type") or "")
            if s_tech != technique:
                continue

            # Stance match
            s_stance = normalize_stance(s.get("stance"))
            if s_stance is None or s_stance != norm_stance:
                continue

            # Camera view match / compatibility
            if norm_cam is not None and cfg.require_camera_compatibility:
                s_cam = s.get("cameraView") or s.get("camera_view") or s.get("cameraAngle") or s.get("camera_angle")
                if not are_camera_views_compatible(norm_cam, s_cam):
                    camera_mismatch_detected = True
                    continue

            # Quality check
            q_status = s.get("qualityStatus") or s.get("quality_status") or QualityStatus.GOOD
            if isinstance(q_status, QualityStatus):
                q_val = q_status.value
            else:
                q_val = str(q_status).upper()

            if q_val in ["BLOCKED", "DEGRADED"] or q_val not in cfg.allowed_quality_statuses:
                continue

            # Coach approval & reference status check
            s_status = str(s.get("status") or "active").lower()
            if s_status in ["revoked", "superseded"]:
                continue

            if cfg.require_coach_approval:
                coach_id = (
                    s.get("approvedByCoachId")
                    or s.get("approved_by_coach_id")
                    or s.get("selectedById")
                    or s.get("selected_by_id")
                    or s.get("approvedById")
                    or s.get("approved_by_id")
                    or s.get("coachId")
                    or s.get("coach_id")
                )
                if not coach_id:
                    continue

            # Rubric compatibility check
            if rubric_version:
                s_rubric = s.get("rubricVersion") or s.get("rubric_version") or s.get("rubricId") or s.get("rubric_id")
                if s_rubric and str(s_rubric) != str(rubric_version):
                    rubric_mismatch_detected = True
                    continue

            # Staleness check
            s_ts = _parse_timestamp_utc(
                s.get("timestamp")
                or s.get("createdAt")
                or s.get("created_at")
                or s.get("processedAt")
                or s.get("updatedAt")
            )
            if s_ts is not None:
                age_days = (now_dt - s_ts).total_seconds() / 86400.0
                if age_days <= cfg.max_age_days:
                    all_stale = False
                    eligible_sessions.append(s)
            else:
                all_stale = False
                eligible_sessions.append(s)

        # Collect provenance identifiers
        source_session_ids = tuple(
            str(s.get("sessionId") or s.get("session_id") or s.get("id") or "") for s in eligible_sessions if (s.get("sessionId") or s.get("session_id") or s.get("id"))
        )
        source_action_ids = tuple(
            str(s.get("actionId") or s.get("action_id") or "") for s in eligible_sessions if (s.get("actionId") or s.get("action_id"))
        )
        source_revisions = tuple(
            str(s.get("analysisId") or s.get("analysis_id") or s.get("revision") or "") for s in eligible_sessions if (s.get("analysisId") or s.get("analysis_id") or s.get("revision"))
        )
        approved_by_coach_ids = tuple(
            sorted({
                str(
                    s.get("approvedByCoachId")
                    or s.get("approved_by_coach_id")
                    or s.get("selectedById")
                    or s.get("selected_by_id")
                    or s.get("approvedById")
                    or s.get("approved_by_id")
                    or s.get("coachId")
                    or s.get("coach_id")
                    or ""
                )
                for s in eligible_sessions
                if (
                    s.get("approvedByCoachId")
                    or s.get("approved_by_coach_id")
                    or s.get("selectedById")
                    or s.get("selected_by_id")
                    or s.get("approvedById")
                    or s.get("approved_by_id")
                    or s.get("coachId")
                    or s.get("coach_id")
                )
            })
        )

        token = f"{athlete_id}:{martial_art or 'any'}:{technique}:{norm_stance}:{norm_cam or 'any'}:{sorted(source_session_ids)}:{sorted(source_action_ids)}"
        baseline_id = f"pbase_{hashlib.sha256(token.encode('utf-8')).hexdigest()[:16]}"

        invalidation_rules: dict[str, Any] = {
            "max_age_days": cfg.max_age_days,
            "required_stance": norm_stance,
            "required_camera_view": norm_cam,
            "invalidation_triggers": [
                "COACH_REVOCATION",
                "STANCE_MISMATCH",
                "CAMERA_VIEW_MISMATCH",
                "MAX_AGE_EXCEEDED",
                "QUALITY_DEGRADATION",
                "ATHLETE_MISMATCH",
            ],
            "minimum_sample_threshold": cfg.min_references,
            "policy_version": cfg.policy_version,
            "config_version": cfg.config_version,
        }

        # Check leakage failure
        if not eligible_sessions and (cross_athlete_leakage_detected or split_leakage_detected):
            return PersonalizedBaseline(
                baseline_id=baseline_id,
                athlete_id=athlete_id,
                technique=technique,
                stance=norm_stance,
                baseline_version="1.0.0",
                session_count=0,
                eligibility_status=BaselineEligibilityStatus.LEAKAGE_DETECTED,
                metric_summaries={},
                source_session_ids=source_session_ids,
                is_active=False,
                martial_art=martial_art,
                camera_view=norm_cam,
                source_action_ids=source_action_ids,
                source_revisions=source_revisions,
                approved_by_coach_ids=approved_by_coach_ids,
                policy_version=cfg.policy_version,
                config_version=cfg.config_version,
                generated_at=generated_at,
                invalidation_rules=invalidation_rules,
            )

        # Check staleness
        if all_stale and len(candidates) >= cfg.min_references:
            return PersonalizedBaseline(
                baseline_id=baseline_id,
                athlete_id=athlete_id,
                technique=technique,
                stance=norm_stance,
                baseline_version="1.0.0",
                session_count=len(eligible_sessions),
                eligibility_status=BaselineEligibilityStatus.STALE,
                metric_summaries={},
                source_session_ids=source_session_ids,
                is_active=False,
                martial_art=martial_art,
                camera_view=norm_cam,
                source_action_ids=source_action_ids,
                source_revisions=source_revisions,
                approved_by_coach_ids=approved_by_coach_ids,
                policy_version=cfg.policy_version,
                config_version=cfg.config_version,
                generated_at=generated_at,
                invalidation_rules=invalidation_rules,
            )

        # Check sample count
        if len(eligible_sessions) < cfg.min_references:
            # Use INSUFFICIENT_SESSIONS for legacy session mode, INSUFFICIENT_REFERENCES for reference mode
            status = (
                BaselineEligibilityStatus.INSUFFICIENT_SESSIONS
                if self._legacy_mode
                else BaselineEligibilityStatus.INSUFFICIENT_REFERENCES
            )
            return PersonalizedBaseline(
                baseline_id=baseline_id,
                athlete_id=athlete_id,
                technique=technique,
                stance=norm_stance,
                baseline_version="1.0.0",
                session_count=len(eligible_sessions),
                eligibility_status=status,
                metric_summaries={},
                source_session_ids=source_session_ids,
                is_active=False,
                martial_art=martial_art,
                camera_view=norm_cam,
                source_action_ids=source_action_ids,
                source_revisions=source_revisions,
                approved_by_coach_ids=approved_by_coach_ids,
                policy_version=cfg.policy_version,
                config_version=cfg.config_version,
                generated_at=generated_at,
                invalidation_rules=invalidation_rules,
            )

        # Metric aggregation with unit and definition consistency checking
        metric_values: dict[str, list[float]] = {}
        metric_units: dict[str, Optional[str]] = {}
        metric_definitions: dict[str, Optional[str]] = {}
        incompatible_metric_keys: set[str] = set()

        for s in eligible_sessions:
            metrics_dict = s.get("metrics") or {}
            for k, val_entry in metrics_dict.items():
                if k in incompatible_metric_keys:
                    continue

                if isinstance(val_entry, (int, float)):
                    if math.isfinite(val_entry):
                        metric_values.setdefault(k, []).append(float(val_entry))
                elif isinstance(val_entry, Mapping):
                    val = val_entry.get("value")
                    unit = val_entry.get("unit")
                    defn = val_entry.get("definition")

                    if not isinstance(val, (int, float)) or not math.isfinite(val):
                        continue

                    # Check unit consistency
                    if k in metric_units and metric_units[k] != unit:
                        incompatible_metric_keys.add(k)
                        metric_values.pop(k, None)
                        continue
                    metric_units[k] = unit

                    # Check definition consistency
                    if k in metric_definitions and metric_definitions[k] != defn:
                        incompatible_metric_keys.add(k)
                        metric_values.pop(k, None)
                        continue
                    metric_definitions[k] = defn

                    metric_values.setdefault(k, []).append(float(val))

        summaries: dict[str, BaselineMetricSummary] = {}
        for m_name, vals in metric_values.items():
            if len(vals) >= cfg.min_references:
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
                    unit=metric_units.get(m_name),
                    definition=metric_definitions.get(m_name),
                )

        is_active = len(summaries) > 0
        eligibility_status = (
            BaselineEligibilityStatus.ELIGIBLE
            if is_active
            else (
                BaselineEligibilityStatus.INSUFFICIENT_SESSIONS
                if self._legacy_mode
                else BaselineEligibilityStatus.INSUFFICIENT_REFERENCES
            )
        )

        return PersonalizedBaseline(
            baseline_id=baseline_id,
            athlete_id=athlete_id,
            technique=technique,
            stance=norm_stance,
            baseline_version="1.0.0",
            session_count=len(eligible_sessions),
            eligibility_status=eligibility_status,
            metric_summaries=summaries,
            source_session_ids=source_session_ids,
            is_active=is_active,
            martial_art=martial_art,
            camera_view=norm_cam,
            source_action_ids=source_action_ids,
            source_revisions=source_revisions,
            approved_by_coach_ids=approved_by_coach_ids,
            policy_version=cfg.policy_version,
            config_version=cfg.config_version,
            generated_at=generated_at,
            invalidation_rules=invalidation_rules,
        )
