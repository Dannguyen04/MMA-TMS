"""
test_task23_combination_engine.py — Tests for Task 23 Combination Engine
"""

import pytest
from pipeline.contracts import SequenceCandidateType, ValidationStatus
from pipeline.combination_engine import (
    ActionSequence,
    CombinationEngine,
    SequenceActionRef,
)


def test_empty_actions_returns_empty_sequences():
    engine = CombinationEngine()
    assert engine.extract_sequences([]) == []


def test_single_action_sequence():
    engine = CombinationEngine()
    actions = [
        {"id": "a1", "technique": "jab", "phases": {"start_frame": 10, "end_frame": 30}, "confidence": 0.85}
    ]
    seqs = engine.extract_sequences(actions)
    assert len(seqs) == 1
    assert seqs[0].candidate_type == SequenceCandidateType.SINGLE
    assert len(seqs[0].actions) == 1
    assert seqs[0].actions[0].technique == "jab"


def test_two_action_combination_jab_cross():
    engine = CombinationEngine(max_gap_sec=0.5, fps=30.0)  # max gap: 15 frames
    actions = [
        {"id": "a1", "technique": "jab", "phases": {"start_frame": 10, "end_frame": 30}, "confidence": 0.85},
        {"id": "a2", "technique": "cross", "phases": {"start_frame": 38, "end_frame": 58}, "confidence": 0.90},
    ]
    seqs = engine.extract_sequences(actions)
    assert len(seqs) == 1
    assert seqs[0].candidate_type == SequenceCandidateType.TWO_ACTION_COMBINATION
    assert len(seqs[0].actions) == 2
    assert seqs[0].gap_durations_sec == (pytest.approx(8 / 30.0, rel=1e-3),)


def test_repeated_strike_sequence():
    engine = CombinationEngine(max_gap_sec=0.5, fps=30.0)
    actions = [
        {"id": "a1", "technique": "jab", "phases": {"start_frame": 10, "end_frame": 25}, "confidence": 0.8},
        {"id": "a2", "technique": "jab", "phases": {"start_frame": 30, "end_frame": 45}, "confidence": 0.8},
    ]
    seqs = engine.extract_sequences(actions)
    assert len(seqs) == 1
    assert seqs[0].candidate_type == SequenceCandidateType.REPEATED_STRIKE


def test_large_gap_splits_into_separate_sequences():
    engine = CombinationEngine(max_gap_sec=0.5, fps=30.0)  # max gap: 15 frames
    actions = [
        {"id": "a1", "technique": "jab", "phases": {"start_frame": 10, "end_frame": 30}, "confidence": 0.85},
        {"id": "a2", "technique": "cross", "phases": {"start_frame": 120, "end_frame": 140}, "confidence": 0.90},  # Gap: 90 frames = 3.0s
    ]
    seqs = engine.extract_sequences(actions)
    assert len(seqs) == 2
    assert seqs[0].candidate_type == SequenceCandidateType.SINGLE
    assert seqs[1].candidate_type == SequenceCandidateType.SINGLE

