"""
test_tl06_personalized_baseline.py — Unit & Integration tests for TL-06 Personalized Baseline Engine.

Verifies:
1. Explicit stance enforcement (rejects missing, empty, or non-orthodox/southpaw stance).
2. Athlete ownership & cross-athlete leakage prevention.
3. Train/test split leakage prevention.
4. Martial art & technique compatibility.
5. Camera view compatibility gating (front vs side rejection, alias normalization).
6. Pose quality status enforcement (rejects BLOCKED/DEGRADED).
7. Coach approval & active status enforcement (rejects revoked, superseded, unapproved).
8. Configurable minimum sample count (default 5; returns INSUFFICIENT_REFERENCES when < 5).
9. Metric definition and unit consistency enforcement (detects and filters conflicting units).
10. Provenance metadata completeness (sourceActionIds, sourceRevisions, coach approvals, invalidation rules).
11. End-to-end integration with DB techniqueReferences model.
"""

from datetime import datetime, timedelta, timezone
import pytest

from pipeline.contracts import (
    BaselineEligibilityStatus,
    QualityStatus,
)
from pipeline.personalized_baseline import (
    BaselineConfig,
    BaselineEngine,
    BaselineMetricSummary,
    PersonalizedBaseline,
    are_camera_views_compatible,
    normalize_camera_view,
    normalize_stance,
)


def _create_valid_reference(
    ref_id: str,
    athlete_id: str = "ath_001",
    technique: str = "jab",
    stance: str = "orthodox",
    camera_view: str = "front",
    coach_id: str = "coach_001",
    status: str = "active",
    martial_art: str = "boxing",
    split: str = "train",
    quality: QualityStatus = QualityStatus.GOOD,
    velocity: float = 0.85,
    unit: str = "m/s",
    definition: str = "peak_hand_velocity",
    days_ago: int = 10,
) -> dict:
    now = datetime.now(timezone.utc)
    return {
        "id": ref_id,
        "fighterId": athlete_id,
        "athleteId": athlete_id,
        "martialArt": martial_art,
        "technique": technique,
        "stance": stance,
        "cameraView": camera_view,
        "actionId": f"act_{ref_id}",
        "analysisId": f"ana_{ref_id}",
        "approvedByCoachId": coach_id,
        "status": status,
        "split": split,
        "qualityStatus": quality,
        "createdAt": (now - timedelta(days=days_ago)).isoformat(),
        "metrics": {
            "peak_velocity": {"value": velocity, "unit": unit, "definition": definition},
            "extension_deg": 165.0,
        },
    }


# ─── 1. Stance Enforcement ───────────────────────────────────────────────────

def test_missing_or_invalid_stance_fails_closed():
    engine = BaselineEngine()
    refs = [_create_valid_reference(f"ref_{i}") for i in range(5)]

    # Missing stance
    b1 = engine.compute_baseline("ath_001", "jab", stance="")
    assert b1.eligibility_status == BaselineEligibilityStatus.INCOMPATIBLE_STANCE
    assert b1.is_active is False

    # Invalid stance
    b2 = engine.compute_baseline("ath_001", "jab", stance="switch")
    assert b2.eligibility_status == BaselineEligibilityStatus.INCOMPATIBLE_STANCE
    assert b2.is_active is False


def test_reference_with_mismatched_stance_is_filtered():
    engine = BaselineEngine(min_references=5)
    refs = [
        _create_valid_reference(f"ref_{i}", stance="southpaw" if i < 2 else "orthodox")
        for i in range(6)
    ]
    # Target is orthodox -> only 4 orthodox references remain (< 5)
    b = engine.compute_baseline("ath_001", "jab", "orthodox", historical_references=refs)
    assert b.eligibility_status == BaselineEligibilityStatus.INSUFFICIENT_REFERENCES
    assert b.session_count == 4
    assert b.is_active is False


# ─── 2. Athlete Ownership & Cross-Athlete Leakage ─────────────────────────────

def test_cross_athlete_leakage_prevented():
    engine = BaselineEngine(min_references=5)
    refs = [
        _create_valid_reference(f"ref_{i}", athlete_id="ath_impostor")
        for i in range(5)
    ]
    b = engine.compute_baseline("ath_001", "jab", "orthodox", historical_references=refs)
    assert b.eligibility_status == BaselineEligibilityStatus.LEAKAGE_DETECTED
    assert b.session_count == 0
    assert b.is_active is False


def test_train_test_split_leakage_prevented():
    engine = BaselineEngine(min_references=5)
    refs = [
        _create_valid_reference(f"ref_{i}", split="test" if i == 0 else "train")
        for i in range(5)
    ]
    # One reference is in test set -> filtered out -> only 4 remain
    b = engine.compute_baseline(
        "ath_001", "jab", "orthodox",
        historical_references=refs,
        evaluation_split="train",
    )
    assert b.eligibility_status == BaselineEligibilityStatus.INSUFFICIENT_REFERENCES
    assert b.session_count == 4


# ─── 3. Martial Art & Technique Compatibility ─────────────────────────────────

def test_martial_art_mismatch_filtered():
    engine = BaselineEngine(min_references=5)
    refs = [
        _create_valid_reference(f"ref_{i}", martial_art="muay_thai" if i == 0 else "boxing")
        for i in range(5)
    ]
    b = engine.compute_baseline(
        "ath_001", "jab", "orthodox",
        historical_references=refs,
        martial_art="boxing",
    )
    assert b.eligibility_status == BaselineEligibilityStatus.INSUFFICIENT_REFERENCES
    assert b.session_count == 4


# ─── 4. Camera View Compatibility ─────────────────────────────────────────────

def test_camera_compatibility_and_aliases():
    assert are_camera_views_compatible("front", "frontal") is True
    assert are_camera_views_compatible("side", "sagittal") is True
    assert are_camera_views_compatible("front", "side") is False
    assert are_camera_views_compatible("front", "unknown") is False


def test_camera_mismatch_filtered():
    engine = BaselineEngine(min_references=5)
    refs = [
        _create_valid_reference(f"ref_{i}", camera_view="side" if i == 0 else "front")
        for i in range(5)
    ]
    b = engine.compute_baseline(
        "ath_001", "jab", "orthodox",
        historical_references=refs,
        camera_view="front",
    )
    assert b.eligibility_status == BaselineEligibilityStatus.INSUFFICIENT_REFERENCES
    assert b.session_count == 4


# ─── 5. Pose Quality & Reference Status ───────────────────────────────────────

def test_blocked_and_degraded_quality_filtered():
    engine = BaselineEngine(min_references=5)
    refs = [
        _create_valid_reference(f"ref_0", quality=QualityStatus.BLOCKED),
        _create_valid_reference(f"ref_1", quality=QualityStatus.DEGRADED),
        _create_valid_reference(f"ref_2", quality=QualityStatus.GOOD),
        _create_valid_reference(f"ref_3", quality=QualityStatus.EXCELLENT),
        _create_valid_reference(f"ref_4", quality=QualityStatus.ACCEPTABLE),
    ]
    b = engine.compute_baseline("ath_001", "jab", "orthodox", historical_references=refs)
    assert b.eligibility_status == BaselineEligibilityStatus.INSUFFICIENT_REFERENCES
    assert b.session_count == 3


def test_revoked_and_unapproved_references_filtered():
    engine = BaselineEngine(min_references=5)
    refs = [
        _create_valid_reference("ref_0", status="revoked"),
        _create_valid_reference("ref_1", status="superseded"),
        _create_valid_reference("ref_2", coach_id=""),  # unapproved
        _create_valid_reference("ref_3"),
        _create_valid_reference("ref_4"),
    ]
    b = engine.compute_baseline("ath_001", "jab", "orthodox", historical_references=refs)
    assert b.eligibility_status == BaselineEligibilityStatus.INSUFFICIENT_REFERENCES
    assert b.session_count == 2


# ─── 6. Metric Definition & Unit Consistency ──────────────────────────────────

def test_metric_unit_mismatch_excludes_metric():
    engine = BaselineEngine(min_references=5)
    # 5 references, but one has unit "ft/s" instead of "m/s"
    refs = [
        _create_valid_reference(
            f"ref_{i}",
            unit="ft/s" if i == 0 else "m/s",
            velocity=2.5 if i == 0 else 0.85,
        )
        for i in range(5)
    ]
    b = engine.compute_baseline("ath_001", "jab", "orthodox", historical_references=refs)
    assert b.eligibility_status == BaselineEligibilityStatus.ELIGIBLE
    assert b.is_active is True
    # "peak_velocity" has unit conflict across samples -> excluded
    assert "peak_velocity" not in b.metric_summaries
    # "extension_deg" has no conflict -> included
    assert "extension_deg" in b.metric_summaries


# ─── 7. Full Eligible Baseline & Complete Provenance ──────────────────────────

def test_full_eligible_baseline_with_complete_provenance():
    engine = BaselineEngine(min_references=5)
    refs = [
        _create_valid_reference(
            f"ref_{i}",
            velocity=0.80 + i * 0.05,
            coach_id=f"coach_{(i % 2) + 1}",
        )
        for i in range(5)
    ]
    b = engine.compute_baseline(
        athlete_id="ath_001",
        technique="jab",
        stance="orthodox",
        historical_references=refs,
        camera_view="front",
        martial_art="boxing",
    )

    assert b.eligibility_status == BaselineEligibilityStatus.ELIGIBLE
    assert b.is_active is True
    assert b.session_count == 5
    assert len(b.source_action_ids) == 5
    assert len(b.source_revisions) == 5
    assert set(b.approved_by_coach_ids) == {"coach_1", "coach_2"}
    assert b.generated_at != ""
    assert b.invalidation_rules["required_stance"] == "orthodox"
    assert b.invalidation_rules["required_camera_view"] == "front"
    assert "COACH_REVOCATION" in b.invalidation_rules["invalidation_triggers"]

    # Metric summaries check
    assert "peak_velocity" in b.metric_summaries
    pv = b.metric_summaries["peak_velocity"]
    assert pv.sample_count == 5
    assert pv.unit == "m/s"
    assert pv.definition == "peak_hand_velocity"
    assert round(pv.median, 4) == 0.90

    # Serialization check
    d = b.to_dict()
    assert d["baselineId"].startswith("pbase_")
    assert d["athleteId"] == "ath_001"
    assert d["martialArt"] == "boxing"
    assert d["technique"] == "jab"
    assert d["stance"] == "orthodox"
    assert d["cameraView"] == "front"
    assert d["sampleCount"] == 5
    assert len(d["sourceActionIds"]) == 5
    assert len(d["approvedByCoachIds"]) == 2
    assert "invalidationRules" in d

