"""
test_task22_model_registry.py — Tests for Task 22 Model Registry & Drift Signals
"""

import pytest
from pipeline.model_registry import (
    DriftMonitor,
    ModelArtifactManifest,
    RunManifest,
    summarize_distribution,
)


def test_model_artifact_manifest_serialization():
    manifest = ModelArtifactManifest(
        model_id="yolov8n_pose_v1",
        model_name="YOLOv8n-Pose",
        model_version="1.0.0",
        weights_sha256="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        framework="PyTorch",
        feature_version="2.0.0",
        input_contract_version="1.0.0",
        created_at_utc="2026-09-17T00:00:00Z",
    )
    d = manifest.to_dict()
    assert d["modelId"] == "yolov8n_pose_v1"
    assert d["framework"] == "PyTorch"



def test_distribution_summary():
    data = [10.0, 20.0, 30.0, 40.0, 50.0]
    summary = summarize_distribution(data)
    assert summary is not None
    assert summary.mean == 30.0
    assert summary.p50 == 30.0
    assert summary.count == 5


def test_drift_monitor_single_signal_does_not_trigger_overall_alert():
    monitor = DriftMonitor()
    # Only feature distribution shifted, quality and abstention unchanged
    report = monitor.evaluate_drift(
        baseline_quality_dist={"GOOD": 0.8, "DEGRADED": 0.2},
        current_quality_dist={"GOOD": 0.8, "DEGRADED": 0.2},
        baseline_metric_vals=[100.0, 105.0, 95.0, 100.0],
        current_metric_vals=[150.0, 155.0, 145.0, 150.0],  # Major shift
        baseline_abstain_rate=0.05,
        current_abstain_rate=0.06,
    )
    assert report.feature_drift_detected is True
    assert report.quality_drift_detected is False
    assert report.prediction_drift_detected is False
    # Multi-signal guard: overall drift alert remains False!
    assert report.overall_drift_alert is False


def test_drift_monitor_multi_signal_triggers_alert():
    monitor = DriftMonitor()
    # Both quality and prediction rate shifted
    report = monitor.evaluate_drift(
        baseline_quality_dist={"GOOD": 0.9, "BLOCKED": 0.1},
        current_quality_dist={"GOOD": 0.4, "BLOCKED": 0.6},  # Quality shift
        baseline_metric_vals=[100.0, 100.0],
        current_metric_vals=[100.0, 100.0],
        baseline_abstain_rate=0.05,
        current_abstain_rate=0.45,  # Prediction shift
    )
    assert report.quality_drift_detected is True
    assert report.prediction_drift_detected is True
    assert report.overall_drift_alert is True

