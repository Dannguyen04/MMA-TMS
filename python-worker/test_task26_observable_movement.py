"""
test_task26_observable_movement.py — Tests for Task 26 Footwork, Guard & Balance Evidence
"""

import pytest
from pipeline.contracts import EvidenceLevel, QualityStatus
from pipeline.observable_movement import (
    MovementEvidenceEngine,
    ObservableMovementEvidence,
)


def test_clean_movement_evidence_calculation():
    engine = MovementEvidenceEngine()
    # Clean posture coordinates
    ev = engine.compute_evidence(
        left_ankle=(0.4, 0.9),
        right_ankle=(0.6, 0.9),  # Ankle distance: 0.2
        left_shoulder=(0.45, 0.3),
        right_shoulder=(0.55, 0.3),  # Shoulder distance: 0.10
        left_wrist=(0.48, 0.22),
        right_wrist=(0.52, 0.22),
        nose_or_chin=(0.50, 0.20),
        quality_status=QualityStatus.GOOD,
    )
    assert ev.stance_width_ratio is not None
    assert pytest.approx(ev.stance_width_ratio, rel=1e-2) == 2.0  # 0.2 / 0.1
    assert ev.guard_distance_ratio is not None
    assert ev.evidence_level == EvidenceLevel.DERIVED_PROXY
    assert ev.evidence_confidence > 0.5


def test_blocked_quality_returns_all_null():
    engine = MovementEvidenceEngine()
    ev = engine.compute_evidence(
        left_ankle=(0.4, 0.9),
        right_ankle=(0.6, 0.9),
        left_shoulder=(0.45, 0.3),
        right_shoulder=(0.55, 0.3),
        left_wrist=(0.48, 0.22),
        right_wrist=(0.52, 0.22),
        nose_or_chin=(0.50, 0.20),
        quality_status=QualityStatus.BLOCKED,  # Blocked!
    )
    assert ev.stance_width_ratio is None
    assert ev.base_of_support_ratio is None
    assert ev.guard_distance_ratio is None
    assert ev.evidence_confidence == 0.0
    assert ev.evidence_level == EvidenceLevel.UNAVAILABLE


def test_missing_ankles_abstains_stance():
    engine = MovementEvidenceEngine()
    ev = engine.compute_evidence(
        left_ankle=None,
        right_ankle=None,
        left_shoulder=(0.45, 0.3),
        right_shoulder=(0.55, 0.3),
        left_wrist=(0.48, 0.22),
        right_wrist=(0.52, 0.22),
        nose_or_chin=(0.50, 0.20),
    )
    assert ev.stance_width_ratio is None
    assert ev.guard_distance_ratio is not None

