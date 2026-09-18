"""
model_registry.py — Model Registry, Reproducibility & Drift Signals (Task 22)

Provides:
- Immutable ModelArtifactManifest and RunManifest.
- SHA256 integrity verification and runtime environment provenance.
- DriftSignalReport computing observable distribution shifts:
  * Quality distribution drift (Total Variation Distance)
  * Feature metric distribution shifts (normalized mean difference with zero-variance safety)
  * Prediction & abstention rate shifts
- Multi-signal drift alerting rule (preventing unilateral false alerts).
"""

from __future__ import annotations

import hashlib
import json
import math
import re
from datetime import datetime, timezone
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Mapping, Optional, Sequence

from pipeline.contracts import QualityStatus, ValidationStatus, deep_freeze, to_json_safe

SHA256_HEX_REGEX = re.compile(r"^[0-9a-fA-F]{64}$")


@dataclass(frozen=True)
class ModelArtifactManifest:
    model_id: str
    model_name: str
    model_version: str
    weights_sha256: str
    framework: str
    feature_version: str
    input_contract_version: str
    created_at_utc: str

    def __post_init__(self):
        if not SHA256_HEX_REGEX.match(self.weights_sha256):
            raise ValueError(f"Invalid SHA-256 hash: {self.weights_sha256}")

    def verify_file_integrity(self, file_path: str | Path) -> bool:
        p = Path(file_path)
        if not p.exists() or not p.is_file():
            return False
        h = hashlib.sha256()
        with open(p, "rb") as f:
            while chunk := f.read(65536):
                h.update(chunk)
        return h.hexdigest().lower() == self.weights_sha256.lower()

    def to_dict(self) -> dict[str, Any]:
        return {
            "modelId": self.model_id,
            "modelName": self.model_name,
            "modelVersion": self.model_version,
            "weightsSha256": self.weights_sha256,
            "framework": self.framework,
            "featureVersion": self.feature_version,
            "inputContractVersion": self.input_contract_version,
            "createdAtUtc": self.created_at_utc,
        }


@dataclass(frozen=True)
class RunManifest:
    run_id: str
    timestamp_utc: str
    model_manifest_id: str
    environment_digest: str
    random_seed: int
    config_digest: str
    input_digest: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "runId": self.run_id,
            "timestampUtc": self.timestamp_utc,
            "modelManifestId": self.model_manifest_id,
            "environmentDigest": self.environment_digest,
            "randomSeed": self.random_seed,
            "configDigest": self.config_digest,
            "inputDigest": self.input_digest,
        }


@dataclass(frozen=True)
class MetricDistributionSummary:
    mean: float
    std_dev: float
    p25: float
    p50: float
    p75: float
    count: int

    def to_dict(self) -> dict[str, Any]:
        return {
            "mean": round(self.mean, 4),
            "stdDev": round(self.std_dev, 4),
            "p25": round(self.p25, 4),
            "p50": round(self.p50, 4),
            "p75": round(self.p75, 4),
            "count": self.count,
        }


def summarize_distribution(values: Sequence[float]) -> Optional[MetricDistributionSummary]:
    if not values:
        return None
    for x in values:
        if not math.isfinite(x):
            raise ValueError(f"Values must be finite numbers, got {x}")

    n = len(values)
    mean = sum(values) / n
    variance = sum((x - mean) ** 2 for x in values) / n if n > 1 else 0.0
    std_dev = math.sqrt(variance)
    sorted_vals = sorted(values)

    def percentile(p: float) -> float:
        idx = int(p * (n - 1))
        return sorted_vals[idx]

    return MetricDistributionSummary(
        mean=mean,
        std_dev=std_dev,
        p25=percentile(0.25),
        p50=percentile(0.50),
        p75=percentile(0.75),
        count=n,
    )


@dataclass(frozen=True)
class DriftSignalReport:
    report_id: str
    evaluated_at_utc: str
    quality_drift_detected: bool
    feature_drift_detected: bool
    prediction_drift_detected: bool
    overall_drift_alert: bool
    signals: Mapping[str, Any]
    recommendation: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "reportId": self.report_id,
            "evaluatedAtUtc": self.evaluated_at_utc,
            "qualityDriftDetected": self.quality_drift_detected,
            "featureDriftDetected": self.feature_drift_detected,
            "predictionDriftDetected": self.prediction_drift_detected,
            "overallDriftAlert": self.overall_drift_alert,
            "signals": dict(self.signals),
            "recommendation": self.recommendation,
        }


class DriftMonitor:
    """Computes distribution shift signals and issues composite drift signal alerts."""

    def __init__(
        self,
        quality_shift_threshold: float = 0.20,
        feature_shift_threshold: float = 0.25,
        prediction_shift_threshold: float = 0.20,
    ):
        self.quality_shift_threshold = quality_shift_threshold
        self.feature_shift_threshold = feature_shift_threshold
        self.prediction_shift_threshold = prediction_shift_threshold

    def evaluate_drift(
        self,
        baseline_quality_dist: Mapping[str, float],
        current_quality_dist: Mapping[str, float],
        baseline_metric_vals: Sequence[float],
        current_metric_vals: Sequence[float],
        baseline_abstain_rate: float,
        current_abstain_rate: float,
        evaluation_timestamp_utc: Optional[str] = None,
    ) -> DriftSignalReport:
        # Validate probability distributions sum to ~1.0
        b_sum = sum(baseline_quality_dist.values())
        c_sum = sum(current_quality_dist.values())
        if not math.isclose(b_sum, 1.0, rel_tol=1e-2) and b_sum > 0:
            raise ValueError(f"Baseline quality distribution must sum to 1.0, got {b_sum}")
        if not math.isclose(c_sum, 1.0, rel_tol=1e-2) and c_sum > 0:
            raise ValueError(f"Current quality distribution must sum to 1.0, got {c_sum}")

        # 1. Quality Drift: measure total variation distance
        all_keys = set(baseline_quality_dist.keys()).union(current_quality_dist.keys())
        tv_dist = 0.5 * sum(
            abs(baseline_quality_dist.get(k, 0.0) - current_quality_dist.get(k, 0.0))
            for k in all_keys
        )
        quality_drift = tv_dist >= self.quality_shift_threshold

        # 2. Feature Drift: normalized mean difference with zero-variance protection
        b_summary = summarize_distribution(baseline_metric_vals)
        c_summary = summarize_distribution(current_metric_vals)
        feature_shift = 0.0
        feature_drift = False
        feature_status = "NORMAL"

        if b_summary and c_summary:
            if b_summary.std_dev > 1e-6:
                feature_shift = abs(c_summary.mean - b_summary.mean) / b_summary.std_dev
                feature_drift = feature_shift >= self.feature_shift_threshold
            else:
                # Zero variance baseline: cannot compute normalized z-shift; use raw mean difference
                raw_diff = abs(c_summary.mean - b_summary.mean)
                feature_status = "ZERO_VARIANCE_BASELINE"
                feature_drift = raw_diff > 10.0  # raw difference threshold

        # 3. Prediction / Abstention Drift
        pred_shift = abs(current_abstain_rate - baseline_abstain_rate)
        prediction_drift = pred_shift >= self.prediction_shift_threshold

        # Composite multi-signal rule: overall drift requires at least 2 active signals
        active_signals_count = sum([quality_drift, feature_drift, prediction_drift])
        overall_alert = active_signals_count >= 2

        recommendation = (
            "Composite distribution drift signals detected across multiple dimensions; review dataset distribution."
            if overall_alert
            else "Distribution within acceptable statistical tolerances."
        )

        ts = evaluation_timestamp_utc or datetime.now(timezone.utc).isoformat()
        token = f"{tv_dist}:{feature_shift}:{pred_shift}:{ts}"
        report_id = f"drift_{hashlib.sha256(token.encode('utf-8')).hexdigest()[:16]}"

        return DriftSignalReport(
            report_id=report_id,
            evaluated_at_utc=ts,
            quality_drift_detected=quality_drift,
            feature_drift_detected=feature_drift,
            prediction_drift_detected=prediction_drift,
            overall_drift_alert=overall_alert,
            signals={
                "qualityTvDistance": round(tv_dist, 4),
                "featureMeanShiftNorm": round(feature_shift, 4),
                "featureStatus": feature_status,
                "abstentionRateShift": round(pred_shift, 4),
                "activeSignalCount": active_signals_count,
            },
            recommendation=recommendation,
        )
