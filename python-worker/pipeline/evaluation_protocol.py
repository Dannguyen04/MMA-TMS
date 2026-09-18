"""
evaluation_protocol.py — Evaluation Protocol & Metric Governance (Task 19)

Provides:
- Strict Athlete/Group Split Validation (preventing data leakage).
- Robust Metric Calculation (Precision, Recall, F1, Accuracy, Abstention Rate).
- Minimum-Support Gating & Exact Wilson Score Confidence Intervals.
- Slice Disaggregation (technique, stance, side, quality, camera view).
- Machine-readable Missing Data Reports.
- Explicit separation between Target NFRs and Measured Empirical Results.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Mapping, Optional, Sequence

from pipeline.contracts import ValidationStatus, QualityStatus, deep_freeze, to_json_safe


def _approx_z_score(confidence: float) -> float:
    """Approximates the normal distribution two-tailed critical value z for a given confidence."""
    if confidence <= 0.0 or confidence >= 1.0:
        raise ValueError(f"Confidence must be strictly between 0 and 1, got {confidence}")
    # Common exact lookup values
    if math.isclose(confidence, 0.95, rel_tol=1e-3):
        return 1.95996
    if math.isclose(confidence, 0.90, rel_tol=1e-3):
        return 1.64485
    if math.isclose(confidence, 0.99, rel_tol=1e-3):
        return 2.57583
    # Rational approximation for inverse normal CDF (Acklam / Beasley-Springer-Moro)
    p = 1.0 - (1.0 - confidence) / 2.0
    # Winitzki approximation for erf inverse
    a = 0.147
    x = 2 * p - 1.0
    log_term = math.log(1.0 - x * x)
    term1 = 2.0 / (math.pi * a) + log_term / 2.0
    term2 = log_term / a
    erfinv = math.copysign(math.sqrt(math.sqrt(term1 * term1 - term2) - term1), x)
    return math.sqrt(2.0) * erfinv


def calculate_wilson_interval(successes: int, total: int, confidence: float = 0.95) -> tuple[float, float]:
    """Calculates Wilson score confidence interval for a binomial proportion."""
    if total <= 0:
        return (0.0, 0.0)
    if successes < 0 or successes > total:
        raise ValueError(f"Successes {successes} must be between 0 and total {total}")
    z = _approx_z_score(confidence)
    p_hat = successes / total
    z2 = z * z
    denominator = 1 + z2 / total
    centre = (p_hat + z2 / (2 * total)) / denominator
    half_width = z * math.sqrt((p_hat * (1 - p_hat) + z2 / (4 * total)) / total) / denominator
    low = max(0.0, centre - half_width)
    high = min(1.0, centre + half_width)
    return (round(low, 4), round(high, 4))


@dataclass(frozen=True)
class SplitLeakageAudit:
    has_leakage: bool
    train_count: int
    val_count: int
    test_count: int
    overlapping_ids: tuple[str, ...]
    details: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "hasLeakage": self.has_leakage,
            "trainCount": self.train_count,
            "valCount": self.val_count,
            "testCount": self.test_count,
            "overlappingIds": list(self.overlapping_ids),
            "details": self.details,
        }


def validate_split_leakage(
    train_athlete_ids: Sequence[str],
    val_athlete_ids: Sequence[str],
    test_athlete_ids: Sequence[str],
) -> SplitLeakageAudit:
    """Validates that no athlete IDs overlap across train, validation, and test splits."""
    train_set = set(train_athlete_ids)
    val_set = set(val_athlete_ids)
    test_set = set(test_athlete_ids)

    overlap_train_val = train_set.intersection(val_set)
    overlap_train_test = train_set.intersection(test_set)
    overlap_val_test = val_set.intersection(test_set)

    all_overlaps = sorted(list(overlap_train_val.union(overlap_train_test).union(overlap_val_test)))
    has_leakage = len(all_overlaps) > 0

    if has_leakage:
        details = f"Leakage detected: {len(all_overlaps)} athlete(s) appear in multiple splits: {all_overlaps}"
    else:
        details = "No athlete leakage detected across splits."

    return SplitLeakageAudit(
        has_leakage=has_leakage,
        train_count=len(train_set),
        val_count=len(val_set),
        test_count=len(test_set),
        overlapping_ids=tuple(all_overlaps),
        details=details,
    )


@dataclass(frozen=True)
class AthleteGroupSplitManifest:
    manifest_id: str
    train_group_ids: tuple[str, ...]
    val_group_ids: tuple[str, ...]
    test_group_ids: tuple[str, ...]
    protocol_version: str = "1.0.0"

    def validate_disjoint(self) -> SplitLeakageAudit:
        return validate_split_leakage(self.train_group_ids, self.val_group_ids, self.test_group_ids)


@dataclass(frozen=True)
class EvaluationMetricResult:
    metric_name: str
    value: Optional[float]
    support_count: int
    ci_low: Optional[float] = None
    ci_high: Optional[float] = None
    status: ValidationStatus = ValidationStatus.VALIDATED
    reason: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "metricName": self.metric_name,
            "value": round(self.value, 4) if self.value is not None else None,
            "supportCount": self.support_count,
            "ciLow": round(self.ci_low, 4) if self.ci_low is not None else None,
            "ciHigh": round(self.ci_high, 4) if self.ci_high is not None else None,
            "status": self.status.value,
            "reason": self.reason,
        }


@dataclass(frozen=True)
class EvaluationManifest:
    protocol_version: str = "1.0.0"
    min_support_per_slice: int = 30
    split_policy: str = "athlete_grouped"
    nfr_targets: Mapping[str, float] = field(
        default_factory=lambda: {
            "punch_precision": 0.85,
            "punch_recall": 0.80,
            "kick_precision": 0.85,
            "kick_recall": 0.80,
        }
    )

    def to_dict(self) -> dict[str, Any]:
        return {
            "protocolVersion": self.protocol_version,
            "minSupportPerSlice": self.min_support_per_slice,
            "splitPolicy": self.split_policy,
            "nfrTargets": dict(self.nfr_targets),
        }


@dataclass(frozen=True)
class SliceFilter:
    technique: Optional[str] = None
    stance: Optional[str] = None
    attacking_side: Optional[str] = None
    quality_status: Optional[str] = None
    camera_view: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "technique": self.technique,
            "stance": self.stance,
            "attackingSide": self.attacking_side,
            "qualityStatus": self.quality_status,
            "cameraView": self.camera_view,
        }


@dataclass(frozen=True)
class EvaluationSliceReport:
    slice_filter: SliceFilter
    sample_count: int
    metrics: Mapping[str, EvaluationMetricResult]
    is_sufficiently_supported: bool
    status: ValidationStatus = ValidationStatus.VALIDATED

    def to_dict(self) -> dict[str, Any]:
        return {
            "sliceFilter": self.slice_filter.to_dict(),
            "sampleCount": self.sample_count,
            "metrics": {k: v.to_dict() for k, v in self.metrics.items()},
            "isSufficientlySupported": self.is_sufficiently_supported,
            "status": self.status.value,
        }


@dataclass(frozen=True)
class MissingDataReport:
    report_version: str = "1.0.0"
    missing_techniques: tuple[str, ...] = ()
    underrepresented_slices: tuple[str, ...] = ()
    unsupported_features: tuple[str, ...] = ()
    audit_notes: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "reportVersion": self.report_version,
            "missingTechniques": list(self.missing_techniques),
            "underrepresentedSlices": list(self.underrepresented_slices),
            "unsupportedFeatures": list(self.unsupported_features),
            "auditNotes": self.audit_notes,
        }


class MetricGovernanceEngine:
    """Evaluates empirical predictions against ground truth under governance rules."""

    def __init__(self, manifest: Optional[EvaluationManifest] = None):
        self.manifest = manifest or EvaluationManifest()

    def evaluate_binary_predictions(
        self,
        y_true: Sequence[int],
        y_pred: Sequence[int],
        metric_prefix: str = "binary",
        abstained_count: int = 0,
    ) -> dict[str, EvaluationMetricResult]:
        if len(y_true) != len(y_pred):
            raise ValueError(f"Length mismatch: len(y_true)={len(y_true)} vs len(y_pred)={len(y_pred)}")

        # Validate inputs are strictly binary {0, 1}
        for yt, yp in zip(y_true, y_pred):
            if yt not in (0, 1) or yp not in (0, 1):
                raise ValueError(f"Inputs must be binary 0 or 1, got yt={yt}, yp={yp}")

        n = len(y_true)
        total_eval_samples = n + abstained_count
        abstention_rate = abstained_count / total_eval_samples if total_eval_samples > 0 else 0.0

        if n < self.manifest.min_support_per_slice:
            return {
                f"{metric_prefix}_precision": EvaluationMetricResult(
                    metric_name=f"{metric_prefix}_precision",
                    value=None,
                    support_count=n,
                    status=ValidationStatus.NOT_EVALUABLE,
                    reason=f"Insufficient sample support (n={n} < min={self.manifest.min_support_per_slice})",
                ),
                f"{metric_prefix}_recall": EvaluationMetricResult(
                    metric_name=f"{metric_prefix}_recall",
                    value=None,
                    support_count=n,
                    status=ValidationStatus.NOT_EVALUABLE,
                    reason=f"Insufficient sample support (n={n} < min={self.manifest.min_support_per_slice})",
                ),
                f"{metric_prefix}_f1": EvaluationMetricResult(
                    metric_name=f"{metric_prefix}_f1",
                    value=None,
                    support_count=n,
                    status=ValidationStatus.NOT_EVALUABLE,
                    reason=f"Insufficient sample support (n={n} < min={self.manifest.min_support_per_slice})",
                ),
                f"{metric_prefix}_abstention_rate": EvaluationMetricResult(
                    metric_name=f"{metric_prefix}_abstention_rate",
                    value=abstention_rate,
                    support_count=total_eval_samples,
                    status=ValidationStatus.VALIDATED,
                ),
            }

        tp = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 1 and yp == 1)
        fp = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 0 and yp == 1)
        fn = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 1 and yp == 0)
        tn = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 0 and yp == 0)

        # Precision
        pred_positives = tp + fp
        if pred_positives > 0:
            prec_val = tp / pred_positives
            ci_low, ci_high = calculate_wilson_interval(tp, pred_positives)
        else:
            prec_val = None
            ci_low, ci_high = None, None

        # Recall
        actual_positives = tp + fn
        if actual_positives > 0:
            rec_val = tp / actual_positives
            r_low, r_high = calculate_wilson_interval(tp, actual_positives)
        else:
            rec_val = None
            r_low, r_high = None, None

        # F1 Score
        if prec_val is not None and rec_val is not None and (prec_val + rec_val) > 0:
            f1_val = 2.0 * (prec_val * rec_val) / (prec_val + rec_val)
        else:
            f1_val = None

        # Accuracy
        acc_val = (tp + tn) / n
        a_low, a_high = calculate_wilson_interval(tp + tn, n)

        return {
            f"{metric_prefix}_precision": EvaluationMetricResult(
                metric_name=f"{metric_prefix}_precision",
                value=prec_val,
                support_count=pred_positives,
                ci_low=ci_low,
                ci_high=ci_high,
                status=ValidationStatus.VALIDATED if prec_val is not None else ValidationStatus.NOT_EVALUABLE,
            ),
            f"{metric_prefix}_recall": EvaluationMetricResult(
                metric_name=f"{metric_prefix}_recall",
                value=rec_val,
                support_count=actual_positives,
                ci_low=r_low,
                ci_high=r_high,
                status=ValidationStatus.VALIDATED if rec_val is not None else ValidationStatus.NOT_EVALUABLE,
            ),
            f"{metric_prefix}_f1": EvaluationMetricResult(
                metric_name=f"{metric_prefix}_f1",
                value=f1_val,
                support_count=actual_positives,
                status=ValidationStatus.VALIDATED if f1_val is not None else ValidationStatus.NOT_EVALUABLE,
            ),
            f"{metric_prefix}_accuracy": EvaluationMetricResult(
                metric_name=f"{metric_prefix}_accuracy",
                value=acc_val,
                support_count=n,
                ci_low=a_low,
                ci_high=a_high,
                status=ValidationStatus.VALIDATED,
            ),
            f"{metric_prefix}_abstention_rate": EvaluationMetricResult(
                metric_name=f"{metric_prefix}_abstention_rate",
                value=abstention_rate,
                support_count=total_eval_samples,
                status=ValidationStatus.VALIDATED,
            ),
        }
