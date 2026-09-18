"""
confidence_calibration.py — Confidence Calibration & Selective Prediction (Task 20)

Provides:
- CalibratedPrediction with strict separation of rawScore, calibratedConfidence, and evidenceConfidence.
- Platt Scaling (logistic sigmoid) and Temperature Scaling Calibrators with explicit fit() and provenance.
- Calibration error metrics: ECE (Expected Calibration Error), MCE (Max Calibration Error), Brier Score.
- Selective Prediction and Abstention thresholding.
- Fallback to CalibrationStatus.NOT_CALIBRATED or HEURISTIC_ONLY when uncalibrated or un-fitted.
"""

from __future__ import annotations

import hashlib
import math
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Mapping, Optional, Sequence

from pipeline.contracts import CalibrationStatus, ValidationStatus, deep_freeze, to_json_safe


@dataclass(frozen=True)
class CalibratorProvenance:
    calibrator_type: str
    calibrator_version: str
    dataset_digest: str
    training_split_name: str
    fitted_at_utc: str

    def to_dict(self) -> dict[str, str]:
        return {
            "calibratorType": self.calibrator_type,
            "calibratorVersion": self.calibrator_version,
            "datasetDigest": self.dataset_digest,
            "trainingSplitName": self.training_split_name,
            "fittedAtUtc": self.fitted_at_utc,
        }


@dataclass(frozen=True)
class CalibratedPrediction:
    raw_score: Optional[float]
    calibrated_confidence: Optional[float]
    evidence_confidence: Optional[float]
    calibration_status: CalibrationStatus
    abstention_decision: bool
    abstention_reason: Optional[str] = None
    provenance: Optional[CalibratorProvenance] = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "rawScore": round(self.raw_score, 4) if self.raw_score is not None else None,
            "calibratedConfidence": (
                round(self.calibrated_confidence, 4)
                if self.calibrated_confidence is not None
                else None
            ),
            "evidenceConfidence": (
                round(self.evidence_confidence, 4)
                if self.evidence_confidence is not None
                else None
            ),
            "calibrationStatus": self.calibration_status.value,
            "abstentionDecision": self.abstention_decision,
            "abstentionReason": self.abstention_reason,
            "provenance": self.provenance.to_dict() if self.provenance else None,
        }


@dataclass(frozen=True)
class CalibrationReport:
    calibrator_type: str
    sample_count: int
    ece: Optional[float]
    mce: Optional[float]
    brier_score: Optional[float]
    status: CalibrationStatus
    details: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "calibratorType": self.calibrator_type,
            "sampleCount": self.sample_count,
            "ece": round(self.ece, 4) if self.ece is not None else None,
            "mce": round(self.mce, 4) if self.mce is not None else None,
            "brierScore": round(self.brier_score, 4) if self.brier_score is not None else None,
            "status": self.status.value,
            "details": self.details,
        }


def compute_ece_and_brier(
    confidences: Sequence[float],
    ground_truth: Sequence[int],
    num_bins: int = 10,
) -> tuple[float, float, float]:
    """Computes (ECE, MCE, Brier Score) across binned predictions."""
    if len(confidences) != len(ground_truth):
        raise ValueError("confidences and ground_truth must have identical lengths")
    if not confidences:
        return (0.0, 0.0, 0.0)

    # Validate inputs
    for c, y in zip(confidences, ground_truth):
        if not math.isfinite(c) or c < 0.0 or c > 1.0:
            raise ValueError(f"Confidence values must be finite in [0, 1], got {c}")
        if y not in (0, 1):
            raise ValueError(f"Ground truth values must be 0 or 1, got {y}")

    n = len(confidences)
    brier = sum((c - y) ** 2 for c, y in zip(confidences, ground_truth)) / n

    bin_boundaries = [i / num_bins for i in range(num_bins + 1)]
    ece = 0.0
    mce = 0.0

    for i in range(num_bins):
        bin_low = bin_boundaries[i]
        bin_high = bin_boundaries[i + 1]

        bin_items = [
            (c, y)
            for c, y in zip(confidences, ground_truth)
            if bin_low <= c < bin_high or (i == num_bins - 1 and c == bin_high)
        ]
        bin_size = len(bin_items)
        if bin_size > 0:
            avg_confidence = sum(c for c, _ in bin_items) / bin_size
            avg_accuracy = sum(y for _, y in bin_items) / bin_size
            gap = abs(avg_confidence - avg_accuracy)
            ece += (bin_size / n) * gap
            mce = max(mce, gap)

    return (round(ece, 4), round(mce, 4), round(brier, 4))


class TemperatureScalingCalibrator:
    """Calibrates raw probabilities/logits using a learned positive temperature parameter."""

    def __init__(
        self,
        temperature: float = 1.0,
        provenance: Optional[CalibratorProvenance] = None,
    ):
        if temperature <= 0.0 or not math.isfinite(temperature):
            raise ValueError(f"Temperature must be finite and positive, got {temperature}")
        self.temperature = float(temperature)
        self.provenance = provenance

    @classmethod
    def fit(
        cls,
        raw_scores: Sequence[float],
        ground_truth: Sequence[int],
        training_split_name: str = "val_calibration",
    ) -> TemperatureScalingCalibrator:
        if len(raw_scores) != len(ground_truth) or len(raw_scores) < 5:
            raise ValueError("Fitting requires at least 5 matching (score, label) pairs.")

        # Compute empirical NLL minimization over a grid search for temperature
        best_t = 1.0
        best_nll = float("inf")

        logits = []
        for s in raw_scores:
            if not math.isfinite(s) or s < 0.0 or s > 1.0:
                raise ValueError(f"Invalid raw score: {s}")
            s_clamped = max(1e-6, min(1.0 - 1e-6, s))
            logits.append(math.log(s_clamped / (1.0 - s_clamped)))

        for t_cand in [0.2, 0.5, 0.8, 1.0, 1.2, 1.5, 2.0, 2.5, 3.0]:
            nll = 0.0
            for l, y in zip(logits, ground_truth):
                p = 1.0 / (1.0 + math.exp(-l / t_cand))
                p = max(1e-6, min(1.0 - 1e-6, p))
                nll -= math.log(p) if y == 1 else math.log(1.0 - p)
            if nll < best_nll:
                best_nll = nll
                best_t = t_cand

        token = f"temperature:{best_t}:{len(raw_scores)}:{training_split_name}"
        digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
        prov = CalibratorProvenance(
            calibrator_type="TemperatureScaling",
            calibrator_version="1.0.0",
            dataset_digest=digest,
            training_split_name=training_split_name,
            fitted_at_utc="2026-09-17T00:00:00Z",
        )
        return cls(temperature=best_t, provenance=prov)

    def predict(
        self,
        raw_score: Optional[float],
        evidence_confidence: Optional[float] = None,
        abstention_threshold: float = 0.50,
    ) -> CalibratedPrediction:
        if raw_score is None or not math.isfinite(raw_score) or raw_score < 0.0 or raw_score > 1.0:
            return CalibratedPrediction(
                raw_score=raw_score if (raw_score is not None and math.isfinite(raw_score)) else None,
                calibrated_confidence=None,
                evidence_confidence=evidence_confidence,
                calibration_status=CalibrationStatus.NOT_CALIBRATED,
                abstention_decision=True,
                abstention_reason="Missing or invalid raw score",
            )

        if self.provenance is None:
            # Not fitted with valid provenance
            return CalibratedPrediction(
                raw_score=raw_score,
                calibrated_confidence=None,
                evidence_confidence=evidence_confidence,
                calibration_status=CalibrationStatus.HEURISTIC_ONLY,
                abstention_decision=raw_score < abstention_threshold,
                abstention_reason="Uncalibrated heuristic below threshold" if raw_score < abstention_threshold else None,
            )

        logit = math.log(max(1e-7, min(1.0 - 1e-7, raw_score)) / (1.0 - max(1e-7, min(1.0 - 1e-7, raw_score))))
        scaled_logit = logit / self.temperature
        calibrated_prob = 1.0 / (1.0 + math.exp(-scaled_logit))
        calibrated_prob = round(max(0.0, min(1.0, calibrated_prob)), 4)

        should_abstain = calibrated_prob < abstention_threshold
        return CalibratedPrediction(
            raw_score=raw_score,
            calibrated_confidence=calibrated_prob,
            evidence_confidence=evidence_confidence,
            calibration_status=CalibrationStatus.CALIBRATED,
            abstention_decision=should_abstain,
            abstention_reason="Calibrated confidence below selective prediction threshold" if should_abstain else None,
            provenance=self.provenance,
        )


class PlattScalingCalibrator:
    """Calibrates raw scores using Platt scaling (learned logistic sigmoid A * logit + B)."""

    def __init__(
        self,
        a: float = 1.0,
        b: float = 0.0,
        provenance: Optional[CalibratorProvenance] = None,
    ):
        if not math.isfinite(a) or not math.isfinite(b):
            raise ValueError("Parameters A and B must be finite numbers.")
        self.a = float(a)
        self.b = float(b)
        self.provenance = provenance

    @classmethod
    def fit(
        cls,
        raw_scores: Sequence[float],
        ground_truth: Sequence[int],
        training_split_name: str = "val_calibration",
    ) -> PlattScalingCalibrator:
        if len(raw_scores) != len(ground_truth) or len(raw_scores) < 5:
            raise ValueError("Fitting requires at least 5 matching (score, label) pairs.")

        logits = []
        for s in raw_scores:
            if not math.isfinite(s) or s < 0.0 or s > 1.0:
                raise ValueError(f"Invalid raw score: {s}")
            s_clamped = max(1e-6, min(1.0 - 1e-6, s))
            logits.append(math.log(s_clamped / (1.0 - s_clamped)))

        # Simple gradient descent for logistic regression on logit
        a, b = 1.0, 0.0
        lr = 0.05
        for _ in range(200):
            grad_a = 0.0
            grad_b = 0.0
            for l, y in zip(logits, ground_truth):
                p = 1.0 / (1.0 + math.exp(-(a * l + b)))
                err = p - y
                grad_a += err * l
                grad_b += err
            a -= (lr / len(logits)) * grad_a
            b -= (lr / len(logits)) * grad_b

        token = f"platt:{a}:{b}:{len(raw_scores)}:{training_split_name}"
        digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
        prov = CalibratorProvenance(
            calibrator_type="PlattScaling",
            calibrator_version="1.0.0",
            dataset_digest=digest,
            training_split_name=training_split_name,
            fitted_at_utc="2026-09-17T00:00:00Z",
        )
        return cls(a=a, b=b, provenance=prov)

    def predict(
        self,
        raw_score: Optional[float],
        evidence_confidence: Optional[float] = None,
        abstention_threshold: float = 0.50,
    ) -> CalibratedPrediction:
        if raw_score is None or not math.isfinite(raw_score) or raw_score < 0.0 or raw_score > 1.0:
            return CalibratedPrediction(
                raw_score=raw_score if (raw_score is not None and math.isfinite(raw_score)) else None,
                calibrated_confidence=None,
                evidence_confidence=evidence_confidence,
                calibration_status=CalibrationStatus.NOT_CALIBRATED,
                abstention_decision=True,
                abstention_reason="Missing or invalid raw score",
            )

        if self.provenance is None:
            return CalibratedPrediction(
                raw_score=raw_score,
                calibrated_confidence=None,
                evidence_confidence=evidence_confidence,
                calibration_status=CalibrationStatus.HEURISTIC_ONLY,
                abstention_decision=raw_score < abstention_threshold,
                abstention_reason="Uncalibrated heuristic below threshold" if raw_score < abstention_threshold else None,
            )

        logit = math.log(max(1e-7, min(1.0 - 1e-7, raw_score)) / (1.0 - max(1e-7, min(1.0 - 1e-7, raw_score))))
        scaled_logit = self.a * logit + self.b
        calibrated_prob = 1.0 / (1.0 + math.exp(-scaled_logit))
        calibrated_prob = round(max(0.0, min(1.0, calibrated_prob)), 4)

        should_abstain = calibrated_prob < abstention_threshold
        return CalibratedPrediction(
            raw_score=raw_score,
            calibrated_confidence=calibrated_prob,
            evidence_confidence=evidence_confidence,
            calibration_status=CalibrationStatus.CALIBRATED,
            abstention_decision=should_abstain,
            abstention_reason="Calibrated confidence below selective prediction threshold" if should_abstain else None,
            provenance=self.provenance,
        )
