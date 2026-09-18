"""
test_task28_session_comparison.py — Tests for Task 28 Session Comparison
"""

import pytest
from pipeline.contracts import ComparisonStatus, QualityStatus
from pipeline.session_comparison import (
    MetricDelta,
    SessionComparator,
    SessionComparisonDelta,
)


def test_compatible_session_comparison():
    comparator = SessionComparator()
    s_a = {
        "session_id": "sesh_1",
        "stance": "orthodox",
        "camera_view": "sagittal",
        "quality_status": QualityStatus.GOOD,
        "metrics": {"max_velocity": 1.00, "extension_deg": 150.0},
    }
    s_b = {
        "session_id": "sesh_2",
        "stance": "orthodox",
        "camera_view": "sagittal",
        "quality_status": QualityStatus.EXCELLENT,
        "metrics": {"max_velocity": 1.20, "extension_deg": 165.0},
    }
    comp = comparator.compare_sessions(s_a, s_b)
    assert comp.status == ComparisonStatus.COMPATIBLE
    assert comp.metric_deltas["max_velocity"].delta_value == pytest.approx(0.20, rel=1e-3)
    assert comp.metric_deltas["max_velocity"].delta_percent == pytest.approx(20.0, rel=1e-2)
    assert len(comp.observed_differences) == 2


def test_incompatible_stance_rejection():
    comparator = SessionComparator()
    s_a = {"session_id": "s1", "stance": "orthodox", "camera_view": "sagittal", "metrics": {}}
    s_b = {"session_id": "s2", "stance": "southpaw", "camera_view": "sagittal", "metrics": {}}
    comp = comparator.compare_sessions(s_a, s_b)
    assert comp.status == ComparisonStatus.INCOMPATIBLE_STANCE
    assert len(comp.metric_deltas) == 0


def test_blocked_quality_rejection():
    comparator = SessionComparator()
    s_a = {"session_id": "s1", "quality_status": QualityStatus.BLOCKED, "metrics": {"v": 10.0}}
    s_b = {"session_id": "s2", "quality_status": QualityStatus.GOOD, "metrics": {"v": 12.0}}
    comp = comparator.compare_sessions(s_a, s_b)
    assert comp.status == ComparisonStatus.INSUFFICIENT_QUALITY


def test_missing_metric_in_one_session_does_not_evaluate_to_zero():
    comparator = SessionComparator()
    s_a = {"session_id": "s1", "stance": "orthodox", "camera_view": "sagittal", "metrics": {"metric_x": 5.0}}
    s_b = {"session_id": "s2", "stance": "orthodox", "camera_view": "sagittal", "metrics": {}}  # metric_x missing!
    comp = comparator.compare_sessions(s_a, s_b)
    assert comp.status == ComparisonStatus.COMPATIBLE
    delta_x = comp.metric_deltas["metric_x"]
    assert delta_x.session_b_value is None
    assert delta_x.delta_value is None
    assert delta_x.delta_percent is None


