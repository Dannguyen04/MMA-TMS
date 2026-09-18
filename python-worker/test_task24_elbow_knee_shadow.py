"""
test_task24_elbow_knee_shadow.py — Tests for Task 24 Elbow & Knee Shadow Classification
"""

import pytest
from pipeline.contracts import ShadowEventFamily, ValidationStatus
from pipeline.elbow_knee_shadow import (
    ElbowKneeShadowClassifier,
    ElbowKneeShadowEvent,
    KinematicEvidence,
)


def test_elbow_shadow_detection_valid():
    classifier = ElbowKneeShadowClassifier()
    event = classifier.classify_elbow_candidate(
        start_frame=10,
        end_frame=25,
        peak_frame=18,
        elbow_angle_at_peak=95.0,  # Acute angle (< 115 deg)
        elbow_velocity_norm=0.55,
        attacking_side="right",
    )
    assert event is not None
    assert event.family == ShadowEventFamily.ELBOW
    assert event.candidate_technique == "right_elbow"
    assert event.validation_status == ValidationStatus.SHADOW_NOT_VALIDATED
    assert event.kinematic_evidence.joint_flexion_angle_deg == 95.0


def test_negative_punch_not_classified_as_elbow():
    """Negative test: Extended arm (e.g. Jab with 160 deg elbow) must be rejected by elbow classifier."""
    classifier = ElbowKneeShadowClassifier()
    event = classifier.classify_elbow_candidate(
        start_frame=10,
        end_frame=25,
        peak_frame=18,
        elbow_angle_at_peak=160.0,  # Straight punch
        elbow_velocity_norm=0.85,
    )
    assert event is None


def test_knee_shadow_detection_valid():
    classifier = ElbowKneeShadowClassifier()
    event = classifier.classify_knee_candidate(
        start_frame=30,
        end_frame=50,
        peak_frame=42,
        knee_angle_at_peak=85.0,  # Acute angle (< 105 deg)
        knee_velocity_norm=0.60,
        attacking_side="left",
    )
    assert event is not None
    assert event.family == ShadowEventFamily.KNEE
    assert event.candidate_technique == "left_knee"
    assert event.validation_status == ValidationStatus.SHADOW_NOT_VALIDATED


def test_negative_kick_not_classified_as_knee():
    """Negative test: Extended leg (e.g. Roundhouse kick with 150 deg knee extension) must be rejected by knee classifier."""
    classifier = ElbowKneeShadowClassifier()
    event = classifier.classify_knee_candidate(
        start_frame=30,
        end_frame=50,
        peak_frame=42,
        knee_angle_at_peak=150.0,  # Full extension kick
        knee_velocity_norm=0.90,
    )
    assert event is None


def test_missing_kinematics_abstains():
    classifier = ElbowKneeShadowClassifier()
    assert classifier.classify_elbow_candidate(10, 20, 15, None, 0.5) is None
    assert classifier.classify_knee_candidate(10, 20, 15, 80.0, None) is None

