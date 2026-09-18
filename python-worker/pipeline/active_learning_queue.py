"""
active_learning_queue.py — Dataset Lifecycle & Active-Learning Queue (Task 21)

Provides:
- Active-Learning Candidate Selection based on multi-criteria heuristic scoring:
  * LOW_CONFIDENCE
  * MODEL_DISAGREEMENT
  * NOVELTY_OUTLIER
  * UNDERREPRESENTED_SLICE
  * BOUNDARY_UNCERTAINTY
- Deterministic Priority Scoring and Deduplication.
- Strict Fail-Closed Privacy & Consent Gating (consent defaults to False).
- Pseudonymous identifier binding (no raw local filesystem paths).
- Separation of review utility vs dataset export eligibility.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Mapping, Optional, Sequence

from pipeline.contracts import (
    ActiveLearningReason,
    ValidationStatus,
    deep_freeze,
    to_json_safe,
)


@dataclass(frozen=True)
class TrustedConsentPolicy:
    athlete_id: str
    consent_granted: bool = False
    is_retention_valid: bool = False
    policy_version: str = "1.0.0"
    verified_at_utc: Optional[str] = None

    def is_export_allowed(self) -> bool:
        return self.consent_granted and self.is_retention_valid


@dataclass(frozen=True)
class PriorityComponents:
    uncertainty_score: float
    diversity_score: float
    disagreement_score: float
    total_priority: float

    def to_dict(self) -> dict[str, float]:
        return {
            "uncertaintyScore": round(self.uncertainty_score, 4),
            "diversityScore": round(self.diversity_score, 4),
            "disagreementScore": round(self.disagreement_score, 4),
            "totalPriority": round(self.total_priority, 4),
        }


@dataclass(frozen=True)
class ActiveLearningCandidate:
    candidate_id: str
    video_id: str
    action_id: str
    technique: str
    reasons: tuple[ActiveLearningReason, ...]
    priority: PriorityComponents
    is_consent_granted: bool
    is_export_eligible: bool
    payload_digest: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "candidateId": self.candidate_id,
            "videoId": self.video_id,
            "actionId": self.action_id,
            "technique": self.technique,
            "reasons": [r.value for r in self.reasons],
            "priority": self.priority.to_dict(),
            "isConsentGranted": self.is_consent_granted,
            "isExportEligible": self.is_export_eligible,
            "payloadDigest": self.payload_digest,
        }


@dataclass(frozen=True)
class ActiveLearningQueueItem:
    queue_item_id: str
    candidate: ActiveLearningCandidate
    created_at_utc: str
    assigned_reviewer_role: str = "COACH_OR_ANNOTATOR"
    status: str = "PENDING_REVIEW"

    def to_dict(self) -> dict[str, Any]:
        return {
            "queueItemId": self.queue_item_id,
            "candidate": self.candidate.to_dict(),
            "createdAtUtc": self.created_at_utc,
            "assignedReviewerRole": self.assigned_reviewer_role,
            "status": self.status,
        }


def pseudonymize_identifier(raw_identifier: str, salt: str = "mma_tms_privacy_v1") -> str:
    """Creates a deterministic privacy-safe pseudonymous identifier from raw video/file references."""
    token = f"{salt}:{raw_identifier}"
    return f"anon_{hashlib.sha256(token.encode('utf-8')).hexdigest()[:16]}"


class ActiveLearningSelector:
    """Evaluates actions and constructs active learning queue items with strict privacy gating."""

    def __init__(
        self,
        low_confidence_threshold: float = 0.65,
        max_samples_per_video: int = 5,
    ):
        self.low_confidence_threshold = low_confidence_threshold
        self.max_samples_per_video = max_samples_per_video

    def evaluate_sample(
        self,
        video_id: str,
        action_id: str,
        technique: str,
        confidence: Optional[Any],
        shadow_disagreement: bool = False,
        is_novel: bool = False,
        is_underrepresented: bool = False,
        consent_policy: Optional[TrustedConsentPolicy] = None,
    ) -> Optional[ActiveLearningCandidate]:
        # Pseudonymize video_id to prevent local filepath leakage
        safe_video_id = pseudonymize_identifier(video_id)
        safe_action_id = str(action_id)

        # Consent fails closed: default is False
        is_consent = consent_policy.consent_granted if consent_policy else False
        is_export = consent_policy.is_export_allowed() if consent_policy else False

        reasons: list[ActiveLearningReason] = []
        uncertainty = 0.0
        disagreement = 0.0
        diversity = 0.0

        conf_float: Optional[float] = None
        if isinstance(confidence, dict):
            val = confidence.get("assessment")
            if val is None:
                val = confidence.get("detection")
            if val is None:
                val = confidence.get("classification")
            if isinstance(val, (int, float)):
                conf_float = float(val)
        elif isinstance(confidence, (int, float)):
            conf_float = float(confidence)

        if conf_float is None or conf_float < self.low_confidence_threshold:
            reasons.append(ActiveLearningReason.LOW_CONFIDENCE)
            uncertainty = 1.0 - (conf_float if conf_float is not None else 0.0)

        if shadow_disagreement:
            reasons.append(ActiveLearningReason.MODEL_DISAGREEMENT)
            disagreement = 0.8

        if is_novel:
            reasons.append(ActiveLearningReason.NOVELTY_OUTLIER)
            diversity += 0.5

        if is_underrepresented:
            reasons.append(ActiveLearningReason.UNDERREPRESENTED_SLICE)
            diversity += 0.5

        if not reasons:
            return None

        total_priority = 0.5 * uncertainty + 0.3 * disagreement + 0.2 * min(1.0, diversity)

        raw_token = f"{safe_video_id}:{safe_action_id}:{technique}:{sorted([r.value for r in reasons])}"
        payload_digest = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
        candidate_id = f"al_cand_{payload_digest[:16]}"

        return ActiveLearningCandidate(
            candidate_id=candidate_id,
            video_id=safe_video_id,
            action_id=safe_action_id,
            technique=technique,
            reasons=tuple(reasons),
            priority=PriorityComponents(
                uncertainty_score=uncertainty,
                diversity_score=diversity,
                disagreement_score=disagreement,
                total_priority=total_priority,
            ),
            is_consent_granted=is_consent,
            is_export_eligible=is_export,
            payload_digest=payload_digest,
        )

    def deduplicate_and_rank(
        self, candidates: Sequence[ActiveLearningCandidate]
    ) -> list[ActiveLearningCandidate]:
        video_counts: dict[str, int] = {}
        seen_digests: set[str] = set()
        ranked = sorted(candidates, key=lambda c: c.priority.total_priority, reverse=True)
        selected: list[ActiveLearningCandidate] = []

        for cand in ranked:
            if cand.payload_digest in seen_digests:
                continue
            count = video_counts.get(cand.video_id, 0)
            if count >= self.max_samples_per_video:
                continue

            seen_digests.add(cand.payload_digest)
            video_counts[cand.video_id] = count + 1
            selected.append(cand)

        return selected
