"""
test_task21_active_learning_queue.py — Tests for Task 21 Active-Learning Queue & Lifecycle
"""

import pytest
from pipeline.contracts import ActiveLearningReason
from pipeline.active_learning_queue import (
    ActiveLearningCandidate,
    ActiveLearningQueueItem,
    ActiveLearningSelector,
    TrustedConsentPolicy,
    pseudonymize_identifier,
)


def test_active_learning_candidate_selection():
    selector = ActiveLearningSelector(low_confidence_threshold=0.65)
    policy = TrustedConsentPolicy(athlete_id="ath_1", consent_granted=True, is_retention_valid=True)
    cand = selector.evaluate_sample(
        video_id="vid_101",
        action_id="act_5",
        technique="jab",
        confidence=0.45,
        shadow_disagreement=True,
        consent_policy=policy,
    )
    assert cand is not None
    assert ActiveLearningReason.LOW_CONFIDENCE in cand.reasons
    assert ActiveLearningReason.MODEL_DISAGREEMENT in cand.reasons
    assert cand.priority.total_priority > 0.0
    assert cand.is_consent_granted is True
    assert cand.is_export_eligible is True


def test_active_learning_no_consent_abstention():
    selector = ActiveLearningSelector()
    policy = TrustedConsentPolicy(athlete_id="ath_2", consent_granted=False, is_retention_valid=False)
    cand = selector.evaluate_sample(
        video_id="vid_102",
        action_id="act_6",
        technique="cross",
        confidence=0.30,
        consent_policy=policy,
    )
    assert cand is not None
    assert cand.is_consent_granted is False
    assert cand.is_export_eligible is False


def test_active_learning_deduplication_and_limit():
    selector = ActiveLearningSelector(max_samples_per_video=2)
    candidates = []
    # Create 4 candidates for vid_1
    for i in range(4):
        c = selector.evaluate_sample(
            video_id="vid_1",
            action_id=f"act_{i}",
            technique="hook",
            confidence=0.20 + i * 0.05,
        )
        if c:
            candidates.append(c)

    # Create 1 candidate for vid_2
    c2 = selector.evaluate_sample(
        video_id="vid_2",
        action_id="act_10",
        technique="kick",
        confidence=0.15,
    )
    if c2:
        candidates.append(c2)

    selected = selector.deduplicate_and_rank(candidates)
    # vid_1 should only have 2 selected
    safe_vid_1 = pseudonymize_identifier("vid_1")
    vid_1_count = sum(1 for s in selected if s.video_id == safe_vid_1)
    assert vid_1_count == 2
    assert len(selected) == 3


