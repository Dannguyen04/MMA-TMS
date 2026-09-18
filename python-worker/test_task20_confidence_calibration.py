"""
test_task20_confidence_calibration.py — Tests for Task 20 Confidence Calibration & Selective Prediction
"""

import pytest
from pipeline.contracts import CalibrationStatus
from pipeline.confidence_calibration import (
    CalibratedPrediction,
    CalibrationReport,
    TemperatureScalingCalibrator,
    compute_ece_and_brier,
)


def test_ece_and_brier_calculation():
    confidences = [0.9, 0.8, 0.7, 0.4, 0.2]
    ground_truth = [1, 1, 1, 0, 0]
    ece, mce, brier = compute_ece_and_brier(confidences, ground_truth, num_bins=5)
    assert 0.0 <= ece <= 1.0
    assert 0.0 <= mce <= 1.0
    assert 0.0 <= brier <= 1.0


def test_unfitted_calibrator_falls_back_to_heuristic():
    calibrator = TemperatureScalingCalibrator(temperature=1.0, provenance=None)
    pred = calibrator.predict(raw_score=0.82, evidence_confidence=0.75)
    assert pred.calibration_status == CalibrationStatus.HEURISTIC_ONLY
    assert pred.calibrated_confidence is None
    assert pred.raw_score == 0.82
    assert pred.evidence_confidence == 0.75
    assert pred.abstention_decision is False


def test_fitted_temperature_calibrator():
    # Fit calibrator on synthetic data
    scores = [0.95, 0.85, 0.75, 0.40, 0.20, 0.10]
    labels = [1, 1, 1, 0, 0, 0]
    calibrator = TemperatureScalingCalibrator.fit(scores, labels, training_split_name="test_split")
    pred = calibrator.predict(raw_score=0.90, evidence_confidence=0.85, abstention_threshold=0.60)
    assert pred.calibration_status == CalibrationStatus.CALIBRATED
    assert pred.calibrated_confidence is not None
    assert 0.0 <= pred.calibrated_confidence <= 1.0
    assert pred.abstention_decision is False


def test_missing_raw_score_abstention():
    calibrator = TemperatureScalingCalibrator()
    pred = calibrator.predict(raw_score=None)
    assert pred.calibration_status == CalibrationStatus.NOT_CALIBRATED
    assert pred.abstention_decision is True
    assert "Missing or invalid raw score" in pred.abstention_reason


