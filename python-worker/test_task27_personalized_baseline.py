"""
test_task27_personalized_baseline.py — Tests for Task 27 Personalized Baseline Engine
"""

import pytest
from pipeline.contracts import BaselineEligibilityStatus, QualityStatus
from pipeline.personalized_baseline import (
    BaselineEngine,
    BaselineMetricSummary,
    PersonalizedBaseline,
)


def test_cold_start_insufficient_sessions():
    engine = BaselineEngine(min_sessions=3)
    # Only 1 historical session
    sessions = [
        {
            "session_id": "s1",
            "technique": "jab",
            "stance": "orthodox",
            "quality_status": QualityStatus.GOOD,
            "metrics": {"peak_velocity": 0.8},
        }
    ]
    baseline = engine.compute_baseline("ath_1", "jab", "orthodox", sessions)
    assert baseline.eligibility_status == BaselineEligibilityStatus.INSUFFICIENT_SESSIONS
    assert baseline.is_active is False
    assert len(baseline.metric_summaries) == 0


def test_eligible_personalized_baseline():
    engine = BaselineEngine(min_sessions=3)
    # 3 eligible sessions
    sessions = [
        {
            "session_id": "s1",
            "technique": "jab",
            "stance": "orthodox",
            "quality_status": QualityStatus.GOOD,
            "metrics": {"peak_velocity": 0.80, "extension_deg": 160.0},
        },
        {
            "session_id": "s2",
            "technique": "jab",
            "stance": "orthodox",
            "quality_status": QualityStatus.EXCELLENT,
            "metrics": {"peak_velocity": 0.90, "extension_deg": 165.0},
        },
        {
            "session_id": "s3",
            "technique": "jab",
            "stance": "orthodox",
            "quality_status": QualityStatus.GOOD,
            "metrics": {"peak_velocity": 0.85, "extension_deg": 162.0},
        },
    ]
    baseline = engine.compute_baseline("ath_1", "jab", "orthodox", sessions)
    assert baseline.eligibility_status == BaselineEligibilityStatus.ELIGIBLE
    assert baseline.is_active is True
    assert baseline.session_count == 3
    assert "peak_velocity" in baseline.metric_summaries
    assert baseline.metric_summaries["peak_velocity"].median == 0.85


def test_blocked_sessions_ignored_during_aggregation():
    engine = BaselineEngine(min_sessions=3)
    sessions = [
        {"session_id": "s1", "technique": "jab", "stance": "orthodox", "quality_status": QualityStatus.GOOD, "metrics": {"v": 1.0}},
        {"session_id": "s2", "technique": "jab", "stance": "orthodox", "quality_status": QualityStatus.BLOCKED, "metrics": {"v": 99.0}},  # Must be ignored!
        {"session_id": "s3", "technique": "jab", "stance": "orthodox", "quality_status": QualityStatus.GOOD, "metrics": {"v": 1.1}},
    ]
    baseline = engine.compute_baseline("ath_1", "jab", "orthodox", sessions)
    # Only 2 eligible sessions -> INSUFFICIENT_SESSIONS
    assert baseline.eligibility_status == BaselineEligibilityStatus.INSUFFICIENT_SESSIONS

