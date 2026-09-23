"""
session_comparison.py — Session-to-Session Comparison Engine (Task 28 & TL-07)

Provides:
- Strict compatibility gating across sessions:
  * Explicit stance gating (no implicit defaults; rejects missing/invalid stance).
  * Camera angle compatibility gating with alias normalization.
  * Technique matching.
  * Quality status gating (rejects BLOCKED or DEGRADED).
- Quantitative metric deltas (deltaValue, deltaPercent).
- Safe zero-denominator handling: percent delta is None (undefined) when baseline value is zero.
- Neutral, evidence-backed observed difference descriptors with full provenance.
- Invariants:
  * Missing metrics do not evaluate to 0 or fake improvement/regression.
  * Neutral wording: "Observed Difference", strictly avoiding ungrounded claims of superiority.
  * CamelCase public serialization matching TypeScript worker-result.ts.
"""

from __future__ import annotations

import hashlib
import math
from dataclasses import dataclass, field
from typing import Any, Mapping, Optional, Sequence

from pipeline.contracts import (
    ComparisonStatus,
    QualityStatus,
    ValidationStatus,
    deep_freeze,
    to_json_safe,
)
from pipeline.personalized_baseline import (
    are_camera_views_compatible,
    normalize_camera_view,
    normalize_stance,
)


@dataclass(frozen=True)
class MetricDelta:
    metric_name: str
    session_a_value: Optional[float]
    session_b_value: Optional[float]
    delta_value: Optional[float]
    delta_percent: Optional[float]

    def to_dict(self) -> dict[str, Any]:
        return {
            "metricName": self.metric_name,
            "sessionAValue": (
                round(self.session_a_value, 4) if self.session_a_value is not None else None
            ),
            "sessionBValue": (
                round(self.session_b_value, 4) if self.session_b_value is not None else None
            ),
            "deltaValue": (
                round(self.delta_value, 4) if self.delta_value is not None else None
            ),
            "deltaPercent": (
                round(self.delta_percent, 2) if self.delta_percent is not None else None
            ),
        }


@dataclass(frozen=True)
class SessionComparisonDelta:
    comparison_id: str
    status: ComparisonStatus
    session_a_id: str
    session_b_id: str
    metric_deltas: Mapping[str, MetricDelta]
    observed_differences: tuple[str, ...]
    reason_codes: tuple[str, ...] = ()

    def to_dict(self) -> dict[str, Any]:
        return {
            "comparisonId": self.comparison_id,
            "status": self.status.value,
            "sessionAId": self.session_a_id,
            "sessionBId": self.session_b_id,
            "metricDeltas": {k: v.to_dict() for k, v in self.metric_deltas.items()},
            "observedDifferences": list(self.observed_differences),
            "reasonCodes": list(self.reason_codes),
        }


class SessionComparator:
    """Compares two sessions and computes compatibility-gated observable deltas."""

    def compare_sessions(
        self,
        session_a: Mapping[str, Any],
        session_b: Mapping[str, Any],
    ) -> SessionComparisonDelta:
        s_a_id = str(session_a.get("sessionId") or session_a.get("session_id") or "session_A")
        s_b_id = str(session_b.get("sessionId") or session_b.get("session_id") or "session_B")
        token = f"comp:{s_a_id}:{s_b_id}"
        comp_id = f"cmp_{hashlib.sha256(token.encode('utf-8')).hexdigest()[:16]}"

        # 1. Quality Gate
        q_a = session_a.get("qualityStatus") or session_a.get("quality_status") or QualityStatus.GOOD
        q_b = session_b.get("qualityStatus") or session_b.get("quality_status") or QualityStatus.GOOD
        q_a_val = q_a.value if isinstance(q_a, QualityStatus) else str(q_a).upper()
        q_b_val = q_b.value if isinstance(q_b, QualityStatus) else str(q_b).upper()

        if q_a_val in ["BLOCKED", "DEGRADED"] or q_b_val in ["BLOCKED", "DEGRADED"]:
            return SessionComparisonDelta(
                comparison_id=comp_id,
                status=ComparisonStatus.INSUFFICIENT_QUALITY,
                session_a_id=s_a_id,
                session_b_id=s_b_id,
                metric_deltas={},
                observed_differences=(),
                reason_codes=("ONE_OR_BOTH_SESSIONS_HAVE_INSUFFICIENT_QUALITY",),
            )

        # 2. Camera Gate (Strict: if camera view is unknown or incompatible, reject compatibility)
        cam_a = session_a.get("cameraView") or session_a.get("camera_view")
        cam_b = session_b.get("cameraView") or session_b.get("camera_view")
        if not are_camera_views_compatible(cam_a, cam_b):
            return SessionComparisonDelta(
                comparison_id=comp_id,
                status=ComparisonStatus.INCOMPATIBLE_CAMERA,
                session_a_id=s_a_id,
                session_b_id=s_b_id,
                metric_deltas={},
                observed_differences=(),
                reason_codes=(f"CAMERA_VIEW_INCOMPATIBLE_{cam_a}_VS_{cam_b}",),
            )

        # 3. Stance Gate (Strict: if stance is missing or different, reject compatibility)
        st_a = normalize_stance(session_a.get("stance"))
        st_b = normalize_stance(session_b.get("stance"))
        if st_a is None or st_b is None or st_a != st_b:
            raw_a = session_a.get("stance")
            raw_b = session_b.get("stance")
            return SessionComparisonDelta(
                comparison_id=comp_id,
                status=ComparisonStatus.INCOMPATIBLE_STANCE,
                session_a_id=s_a_id,
                session_b_id=s_b_id,
                metric_deltas={},
                observed_differences=(),
                reason_codes=(f"STANCE_INCOMPATIBLE_{raw_a}_VS_{raw_b}",),
            )

        # 4. Technique Gate (if provided, must match)
        tech_a = session_a.get("technique") or session_a.get("techniqueType") or session_a.get("technique_type")
        tech_b = session_b.get("technique") or session_b.get("techniqueType") or session_b.get("technique_type")
        if tech_a and tech_b and str(tech_a) != str(tech_b):
            return SessionComparisonDelta(
                comparison_id=comp_id,
                status=ComparisonStatus.UNKNOWN_MISMATCH,
                session_a_id=s_a_id,
                session_b_id=s_b_id,
                metric_deltas={},
                observed_differences=(),
                reason_codes=(f"TECHNIQUE_MISMATCH_{tech_a}_VS_{tech_b}",),
            )

        # 5. Compute Deltas
        metrics_a = session_a.get("metrics", {})
        metrics_b = session_b.get("metrics", {})
        all_metric_keys = set(metrics_a.keys()).union(metrics_b.keys())

        deltas: dict[str, MetricDelta] = {}
        differences: list[str] = []

        for m_name in sorted(all_metric_keys):
            val_a = metrics_a.get(m_name)
            val_b = metrics_b.get(m_name)

            if (
                isinstance(val_a, (int, float))
                and isinstance(val_b, (int, float))
                and math.isfinite(val_a)
                and math.isfinite(val_b)
            ):
                d_val = float(val_b) - float(val_a)
                # If baseline value is 0.0, percent delta is undefined/None (not 0.0)
                if abs(float(val_a)) > 1e-6:
                    d_pct = (d_val / abs(float(val_a))) * 100.0
                else:
                    d_pct = None

                deltas[m_name] = MetricDelta(
                    metric_name=m_name,
                    session_a_value=float(val_a),
                    session_b_value=float(val_b),
                    delta_value=d_val,
                    delta_percent=d_pct,
                )
                pct_str = f" ({d_pct:+.1f}%)" if d_pct is not None else ""
                differences.append(
                    f"Observed difference in {m_name}: {d_val:+.2f}{pct_str}"
                )
            else:
                deltas[m_name] = MetricDelta(
                    metric_name=m_name,
                    session_a_value=float(val_a) if (isinstance(val_a, (int, float)) and math.isfinite(val_a)) else None,
                    session_b_value=float(val_b) if (isinstance(val_b, (int, float)) and math.isfinite(val_b)) else None,
                    delta_value=None,
                    delta_percent=None,
                )

        return SessionComparisonDelta(
            comparison_id=comp_id,
            status=ComparisonStatus.COMPATIBLE,
            session_a_id=s_a_id,
            session_b_id=s_b_id,
            metric_deltas=deltas,
            observed_differences=tuple(differences),
            reason_codes=("SUCCESSFULLY_COMPARED",),
        )
