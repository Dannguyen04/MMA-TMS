"""
test_task19_evaluation_protocol.py — Tests for Task 19 Evaluation Protocol & Metric Governance
"""

import pytest
from pipeline.contracts import ValidationStatus
from pipeline.evaluation_protocol import (
    EvaluationManifest,
    EvaluationMetricResult,
    MetricGovernanceEngine,
    MissingDataReport,
    SliceFilter,
    calculate_wilson_interval,
    validate_split_leakage,
)


def test_split_leakage_detection():
    # Overlap between train and test
    train_ids = ["athlete_1", "athlete_2", "athlete_3"]
    val_ids = ["athlete_4"]
    test_ids = ["athlete_3", "athlete_5"]

    audit = validate_split_leakage(train_ids, val_ids, test_ids)
    assert audit.has_leakage is True
    assert "athlete_3" in audit.overlapping_ids

    # Clean split
    clean_test_ids = ["athlete_5", "athlete_6"]
    clean_audit = validate_split_leakage(train_ids, val_ids, clean_test_ids)
    assert clean_audit.has_leakage is False
    assert len(clean_audit.overlapping_ids) == 0


def test_wilson_interval_calculation():
    low, high = calculate_wilson_interval(80, 100)
    assert 0.70 < low < 0.80
    assert 0.80 < high < 0.90

    # Zero total
    z_low, z_high = calculate_wilson_interval(0, 0)
    assert z_low == 0.0 and z_high == 0.0


def test_metric_governance_minimum_support():
    manifest = EvaluationManifest(min_support_per_slice=30)
    engine = MetricGovernanceEngine(manifest)

    # Only 10 samples (below minimum support)
    y_true = [1] * 5 + [0] * 5
    y_pred = [1] * 6 + [0] * 4

    metrics = engine.evaluate_binary_predictions(y_true, y_pred, metric_prefix="jab")
    assert metrics["jab_precision"].status == ValidationStatus.NOT_EVALUABLE
    assert metrics["jab_precision"].value is None
    assert "Insufficient sample support" in metrics["jab_precision"].reason


def test_metric_governance_full_evaluation():
    manifest = EvaluationManifest(min_support_per_slice=30)
    engine = MetricGovernanceEngine(manifest)

    # 40 samples (supported)
    y_true = [1] * 20 + [0] * 20
    y_pred = [1] * 18 + [0] * 2 + [1] * 2 + [0] * 18

    metrics = engine.evaluate_binary_predictions(y_true, y_pred, metric_prefix="punch")
    assert metrics["punch_precision"].status == ValidationStatus.VALIDATED
    assert metrics["punch_precision"].value == 0.9  # 18 / 20
    assert metrics["punch_recall"].status == ValidationStatus.VALIDATED
    assert metrics["punch_recall"].value == 0.9  # 18 / 20
    assert metrics["punch_accuracy"].value == 0.9  # 36 / 40


def test_missing_data_report_serialization():
    report = MissingDataReport(
        missing_techniques=("spinning_back_fist", "flying_knee"),
        underrepresented_slices=("southpaw_hook_degraded_quality",),
        unsupported_features=("3d_joint_torque", "force_newtons"),
        audit_notes="Awaiting labeled tournament ground truth.",
    )
    d = report.to_dict()
    assert len(d["missingTechniques"]) == 2
    assert "force_newtons" in d["unsupportedFeatures"]


