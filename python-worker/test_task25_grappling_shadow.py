"""
test_task25_grappling_shadow.py — Tests for Task 25 Takedown & Clinch Shadow Segmentation
"""

import pytest
from pipeline.contracts import ShadowGrapplingState, ValidationStatus
from pipeline.grappling_shadow import (
    GrapplingShadowSegment,
    GrapplingShadowSegmenter,
)


def test_single_person_abstains_with_unsupported_evidence():
    segmenter = GrapplingShadowSegmenter()
    segment = segmenter.segment_interaction(
        start_frame=10,
        end_frame=40,
        person_count=1,  # Single person
    )
    assert segment.validation_status == ValidationStatus.NOT_EVALUABLE
    assert segment.state == ShadowGrapplingState.UNKNOWN
    assert "UNSUPPORTED_MULTI_PERSON_EVIDENCE" in segment.reason_codes
    assert segment.multi_person_ambiguity is False


def test_two_person_clinch_segmentation():
    segmenter = GrapplingShadowSegmenter()
    segment = segmenter.segment_interaction(
        start_frame=100,
        end_frame=150,
        person_count=2,
        bounding_box_iou=0.45,  # Above min_clinch_iou 0.30
        torso_distance_norm=0.25,
    )
    assert segment.validation_status == ValidationStatus.SHADOW_NOT_VALIDATED
    assert segment.state == ShadowGrapplingState.CLINCH_LIKE
    assert segment.multi_person_ambiguity is False


def test_two_person_takedown_level_change():
    segmenter = GrapplingShadowSegmenter()
    segment = segmenter.segment_interaction(
        start_frame=200,
        end_frame=260,
        person_count=2,
        bounding_box_iou=0.35,
        hip_drop_norm=0.30,  # Above min_level_change_drop 0.20
    )
    assert segment.validation_status == ValidationStatus.SHADOW_NOT_VALIDATED
    assert segment.state == ShadowGrapplingState.TAKEDOWN_LIKE
    assert "SIGNIFICANT_LEVEL_CHANGE_WITH_PROXIMITY_CONTACT" in segment.reason_codes


def test_more_than_two_persons_ambiguity():
    segmenter = GrapplingShadowSegmenter()
    segment = segmenter.segment_interaction(
        start_frame=300,
        end_frame=360,
        person_count=3,
    )
    assert segment.validation_status == ValidationStatus.NOT_EVALUABLE
    assert segment.state == ShadowGrapplingState.UNKNOWN
    assert segment.multi_person_ambiguity is True
    assert "MULTI_PERSON_AMBIGUITY_MORE_THAN_TWO" in segment.reason_codes


