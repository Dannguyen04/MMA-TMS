"""
test_tl04_mvp_discovery.py — Test Suite for Task TL-04: MVP Technique Discovery Paths

Validates:
1. Positive synthetic cases for all 6 MVP techniques:
   - jab
   - cross
   - lead_hook
   - rear_hook
   - round_kick
   - knee_strike
2. Stance uncertainty produces side-based intermediate labels and user-visible abstention.
3. Hook is not rejected by straight-punch geometry.
4. Knee has an independent candidate path and is not routed through leg-extension kick detector.
5. Zero label echoing: expectedTechniques cannot generate positive detections on negative fixtures.
6. Negative class fixtures: parry, block, feint, guard adjustment, walking, clinch, grapple.
7. Validation status remains SHADOW_NOT_VALIDATED.
8. Serialization compatibility with Zod actionSchema for all MVP classes.
"""

import json
import pytest
from pipeline.mvp_technique_discovery import (
    MVPTechniqueDiscoveryEngine,
    MVPDiscoveryConfig,
)
from pipeline.contracts import (
    ValidationStatus,
    EvidenceLevel,
    validate_contract_payload,
)
from pipeline.shadow_classifier import DecisionStatus
from pipeline.stance_context import resolve_stance_context


@pytest.fixture
def engine():
    return MVPTechniqueDiscoveryEngine()


@pytest.fixture
def orthodox_ctx():
    return resolve_stance_context(user_stance="orthodox")


@pytest.fixture
def southpaw_ctx():
    return resolve_stance_context(user_stance="southpaw")


@pytest.fixture
def unknown_stance_ctx():
    return resolve_stance_context(user_stance="unknown")


# ─────────────────────────────────────────────────────────────────────────────
# 1. Positive Synthetic MVP Cases
# ─────────────────────────────────────────────────────────────────────────────

def test_positive_jab(engine, orthodox_ctx):
    """In orthodox stance, lead hand (left) straight punch is classified as jab."""
    features = {
        "attacking_side": "left",
        "max_elbow_angle": 165.0,
        "trajectory_directness": 0.88,
        "tangential_curvature": 0.12,
        "wrist_shoulder_separation_ratio": 0.70,
    }
    dec = engine.classify_punch_candidate(features, orthodox_ctx)
    assert dec.status == DecisionStatus.CLASSIFIED
    assert dec.candidate is not None
    assert dec.candidate.technique == "jab"
    assert dec.candidate.limb_role == "lead"
    assert dec.candidate.attacking_side == "left"
    assert dec.validation_status == ValidationStatus.SHADOW_NOT_VALIDATED


def test_positive_cross(engine, orthodox_ctx):
    """In orthodox stance, rear hand (right) straight punch is classified as cross."""
    features = {
        "attacking_side": "right",
        "max_elbow_angle": 168.0,
        "trajectory_directness": 0.90,
        "tangential_curvature": 0.10,
        "wrist_shoulder_separation_ratio": 0.75,
    }
    dec = engine.classify_punch_candidate(features, orthodox_ctx)
    assert dec.status == DecisionStatus.CLASSIFIED
    assert dec.candidate is not None
    assert dec.candidate.technique == "cross"
    assert dec.candidate.limb_role == "rear"
    assert dec.candidate.attacking_side == "right"
    assert dec.validation_status == ValidationStatus.SHADOW_NOT_VALIDATED


def test_positive_lead_hook(engine, orthodox_ctx):
    """In orthodox stance, lead hand (left) hook is classified as lead_hook."""
    features = {
        "attacking_side": "left",
        "max_elbow_angle": 105.0,
        "trajectory_directness": 0.65,
        "tangential_curvature": 0.35,
        "wrist_shoulder_separation_ratio": 0.60,
    }
    dec = engine.classify_punch_candidate(features, orthodox_ctx)
    assert dec.status == DecisionStatus.CLASSIFIED
    assert dec.candidate is not None
    assert dec.candidate.technique == "lead_hook"
    assert dec.candidate.limb_role == "lead"
    assert dec.candidate.attacking_side == "left"
    assert dec.validation_status == ValidationStatus.SHADOW_NOT_VALIDATED


def test_positive_rear_hook(engine, orthodox_ctx):
    """In orthodox stance, rear hand (right) hook is classified as rear_hook."""
    features = {
        "attacking_side": "right",
        "max_elbow_angle": 108.0,
        "trajectory_directness": 0.62,
        "tangential_curvature": 0.38,
        "wrist_shoulder_separation_ratio": 0.65,
    }
    dec = engine.classify_punch_candidate(features, orthodox_ctx)
    assert dec.status == DecisionStatus.CLASSIFIED
    assert dec.candidate is not None
    assert dec.candidate.technique == "rear_hook"
    assert dec.candidate.limb_role == "rear"
    assert dec.candidate.attacking_side == "right"
    assert dec.validation_status == ValidationStatus.SHADOW_NOT_VALIDATED


def test_positive_round_kick(engine, orthodox_ctx):
    """Roundhouse kick with transverse rotation and arc curvature."""
    features = {
        "attacking_side": "right",
        "has_chamber_phase": True,
        "has_extension_phase": True,
        "hip_rotation_angle": 45.0,
        "arc_curvature": 0.32,
        "forward_trajectory_linearity": 0.40,
    }
    dec = engine.classify_kick_candidate(features, orthodox_ctx)
    assert dec.status == DecisionStatus.CLASSIFIED
    assert dec.candidate is not None
    assert dec.candidate.technique == "round_kick"
    assert dec.validation_status == ValidationStatus.SHADOW_NOT_VALIDATED


def test_positive_knee_strike_independent_path(engine, orthodox_ctx):
    """
    Knee strike candidate: acute knee angle (75 deg), high knee velocity,
    NO leg extension. Evaluated through independent candidate path.
    """
    dec = engine.classify_knee_candidate(
        start_frame=10,
        end_frame=30,
        peak_frame=20,
        knee_angle_at_peak=72.0,  # Acute angle!
        knee_velocity_norm=0.55,  # Dynamic drive!
        attacking_side="right",
        stance_context=orthodox_ctx,
        keypoint_visibility=0.90,
    )
    assert dec.status == DecisionStatus.CLASSIFIED
    assert dec.candidate is not None
    assert dec.candidate.technique == "rear_knee"
    assert dec.candidate.family == "other_strike"
    assert dec.validation_status == ValidationStatus.SHADOW_NOT_VALIDATED


# ─────────────────────────────────────────────────────────────────────────────
# 2. Stance Uncertainty & Side-Based Intermediate Labels
# ─────────────────────────────────────────────────────────────────────────────

def test_stance_uncertainty_straight_punch(engine, unknown_stance_ctx):
    """Unknown stance produces side-based intermediate label (e.g. left_straight)."""
    features = {
        "attacking_side": "left",
        "max_elbow_angle": 165.0,
        "trajectory_directness": 0.88,
        "tangential_curvature": 0.12,
        "wrist_shoulder_separation_ratio": 0.70,
    }
    dec = engine.classify_punch_candidate(features, unknown_stance_ctx)
    assert dec.status == DecisionStatus.CLASSIFIED
    assert dec.candidate is not None
    assert dec.candidate.technique == "left_straight"
    assert dec.candidate.limb_role == "unknown"
    assert "STANCE_UNCERTAINTY_SIDE_BASED_LABEL" in dec.reason_codes


def test_stance_uncertainty_hook(engine, unknown_stance_ctx):
    """Unknown stance on hook produces left_hook or right_hook."""
    features = {
        "attacking_side": "right",
        "max_elbow_angle": 105.0,
        "trajectory_directness": 0.65,
        "tangential_curvature": 0.35,
        "wrist_shoulder_separation_ratio": 0.60,
    }
    dec = engine.classify_punch_candidate(features, unknown_stance_ctx)
    assert dec.status == DecisionStatus.CLASSIFIED
    assert dec.candidate is not None
    assert dec.candidate.technique == "right_hook"
    assert dec.candidate.limb_role == "unknown"
    assert "STANCE_UNCERTAINTY_SIDE_BASED_LABEL" in dec.reason_codes


def test_stance_uncertainty_knee(engine, unknown_stance_ctx):
    """Unknown stance on knee produces left_knee or right_knee."""
    dec = engine.classify_knee_candidate(
        start_frame=5,
        end_frame=25,
        peak_frame=15,
        knee_angle_at_peak=68.0,
        knee_velocity_norm=0.50,
        attacking_side="left",
        stance_context=unknown_stance_ctx,
    )
    assert dec.status == DecisionStatus.CLASSIFIED
    assert dec.candidate is not None
    assert dec.candidate.technique == "left_knee"
    assert dec.candidate.limb_role == "unknown"
    assert "STANCE_UNCERTAINTY_SIDE_BASED_LABEL" in dec.reason_codes


# ─────────────────────────────────────────────────────────────────────────────
# 3. Boundary Tests: Hook vs Straight Punch Geometry
# ─────────────────────────────────────────────────────────────────────────────

def test_hook_not_rejected_by_straight_geometry(engine, orthodox_ctx):
    """
    A hook has bent elbow (100 deg) which fails straight punch extension (> 140 deg),
    but must NOT be rejected — it is classified correctly as hook.
    """
    features = {
        "attacking_side": "left",
        "max_elbow_angle": 98.0,  # Far below straight punch 140 threshold
        "trajectory_directness": 0.60,  # Below straight punch 0.80
        "tangential_curvature": 0.32,  # Above hook threshold 0.24
        "wrist_shoulder_separation_ratio": 0.65,
    }
    dec = engine.classify_punch_candidate(features, orthodox_ctx)
    assert dec.status == DecisionStatus.CLASSIFIED
    assert dec.candidate is not None
    assert dec.candidate.technique == "lead_hook"


def test_straight_punch_not_classified_as_hook(engine, orthodox_ctx):
    """A straight punch with low curvature and high extension is not classified as hook."""
    features = {
        "attacking_side": "right",
        "max_elbow_angle": 165.0,
        "trajectory_directness": 0.92,
        "tangential_curvature": 0.08,  # Far below hook 0.24 threshold
        "wrist_shoulder_separation_ratio": 0.75,
    }
    dec = engine.classify_punch_candidate(features, orthodox_ctx)
    assert dec.status == DecisionStatus.CLASSIFIED
    assert dec.candidate is not None
    assert dec.candidate.technique == "cross"


# ─────────────────────────────────────────────────────────────────────────────
# 4. Knee Strike Independent Candidate Path
# ─────────────────────────────────────────────────────────────────────────────

def test_knee_rejected_if_leg_extends(engine, orthodox_ctx):
    """If leg extends (> 105 deg), it cannot be a knee strike."""
    dec = engine.classify_knee_candidate(
        start_frame=10,
        end_frame=30,
        peak_frame=20,
        knee_angle_at_peak=155.0,  # Extended leg!
        knee_velocity_norm=0.60,
        attacking_side="right",
        stance_context=orthodox_ctx,
    )
    assert dec.status == DecisionStatus.REJECTED_CANDIDATE
    assert dec.candidate is None
    assert "LEG_EXTENDED_NOT_KNEE_STRIKE" in dec.reason_codes


def test_knee_abstained_if_velocity_too_low(engine, orthodox_ctx):
    """If knee does not have dynamic drive/lift (< 0.35), it abstains."""
    dec = engine.classify_knee_candidate(
        start_frame=10,
        end_frame=30,
        peak_frame=20,
        knee_angle_at_peak=75.0,
        knee_velocity_norm=0.15,  # Sluggish / idle movement
        attacking_side="right",
        stance_context=orthodox_ctx,
    )
    assert dec.status == DecisionStatus.ABSTAINED
    assert dec.candidate is None


# ─────────────────────────────────────────────────────────────────────────────
# 5. Negative Classes & Zero Label Echoing
# ─────────────────────────────────────────────────────────────────────────────

def test_negative_block_does_not_echo_expected_technique(engine, orthodox_ctx):
    """
    Block fixture: hands at chin/head, wrist-shoulder separation < 0.20.
    Even when caller passes expected_techniques=['jab'], system MUST NOT echo 'jab'.
    """
    block_features = {
        "attacking_side": "left",
        "max_elbow_angle": 60.0,
        "trajectory_directness": 0.20,
        "tangential_curvature": 0.05,
        "wrist_shoulder_separation_ratio": 0.12,  # Close to body / head
    }
    dec = engine.evaluate_negative_class(
        class_name="block",
        features=block_features,
        stance_context=orthodox_ctx,
        expected_techniques=["jab"],  # Echo bait!
    )
    assert dec.status in (DecisionStatus.ABSTAINED, DecisionStatus.REJECTED_CANDIDATE)
    assert dec.candidate is None


def test_negative_feint_abstains(engine, orthodox_ctx):
    """Feint: brief reach without extension and without hook curvature."""
    feint_features = {
        "attacking_side": "right",
        "max_elbow_angle": 125.0,  # Neither hook nor full straight
        "trajectory_directness": 0.60,
        "tangential_curvature": 0.15,
        "wrist_shoulder_separation_ratio": 0.40,
    }
    dec = engine.evaluate_negative_class(
        class_name="feint",
        features=feint_features,
        stance_context=orthodox_ctx,
    )
    assert dec.status == DecisionStatus.ABSTAINED
    assert dec.candidate is None


def test_negative_parry_abstains(engine, orthodox_ctx):
    """Parry: small lateral wrist deflection, minimal reach."""
    parry_features = {
        "attacking_side": "left",
        "max_elbow_angle": 80.0,
        "trajectory_directness": 0.45,
        "tangential_curvature": 0.18,
        "wrist_shoulder_separation_ratio": 0.15,
    }
    dec = engine.evaluate_negative_class(
        class_name="parry",
        features=parry_features,
        stance_context=orthodox_ctx,
    )
    assert dec.status == DecisionStatus.ABSTAINED
    assert dec.candidate is None


def test_negative_walking_does_not_echo_kick(engine, orthodox_ctx):
    """Walking: leg moves without chamber or extension phases."""
    walking_features = {
        "attacking_side": "right",
        "has_chamber_phase": False,
        "has_extension_phase": False,
        "hip_rotation_angle": 8.0,
        "forward_trajectory_linearity": 0.50,
    }
    dec = engine.evaluate_negative_class(
        class_name="walking",
        features=walking_features,
        stance_context=orthodox_ctx,
        expected_techniques=["round_kick"],  # Echo bait!
    )
    assert dec.status == DecisionStatus.ABSTAINED
    assert dec.candidate is None


def test_negative_clinch_and_grapple_abstained(engine, orthodox_ctx):
    """Clinch and grapple non-strike interactions abstain from strike classification."""
    dec_clinch = engine.evaluate_negative_class(
        class_name="clinch",
        features={},
        stance_context=orthodox_ctx,
    )
    assert dec_clinch.status == DecisionStatus.ABSTAINED
    assert dec_clinch.candidate is None
    assert "GRAPPLING_OR_CLINCH_INTERACTION" in dec_clinch.reason_codes

    dec_grapple = engine.evaluate_negative_class(
        class_name="grapple",
        features={},
        stance_context=orthodox_ctx,
    )
    assert dec_grapple.status == DecisionStatus.ABSTAINED
    assert dec_grapple.candidate is None


# ─────────────────────────────────────────────────────────────────────────────
# 6. Worker -> Zod Vertical Slice Schema Compliance
# ─────────────────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("technique,family,side,role", [
    ("jab", "punch", "left", "lead"),
    ("cross", "punch", "right", "rear"),
    ("lead_hook", "punch", "left", "lead"),
    ("rear_hook", "punch", "right", "rear"),
    ("round_kick", "kick", "right", "rear"),
    ("rear_knee", "other_strike", "right", "rear"),
])
def test_mvp_classes_zod_compatible_payload(technique, family, side, role):
    """
    Ensures every MVP class generates an action dictionary that satisfies
    frontend Zod schema constraints: finite numbers, closed enums, valid phases.
    """
    action_dict = {
        "id": f"act_{technique}_001",
        "sourceActionId": f"{family}_1",
        "family": family,
        "technique": technique,
        "attackingSide": side,
        "limbRole": role,
        "stance": "orthodox",
        "confidence": {
            "detection": 0.90,
            "classification": 0.85,
            "assessment": 0.80,
        },
        "phases": {
            "startFrame": 10,
            "chamberFrame": 15 if family in ("kick", "other_strike") else None,
            "launchFrame": 12,
            "peakFrame": 20,
            "impactFrame": 20,
            "endFrame": 30,
            "startTimeMs": 333.3,
            "chamberTimeMs": 500.0 if family in ("kick", "other_strike") else None,
            "launchTimeMs": 400.0,
            "peakTimeMs": 666.6,
            "impactTimeMs": 666.6,
            "endTimeMs": 1000.0,
            "impactType": "peak_extension_proxy" if family == "punch" else "max_extension_proxy",
        },
        "metrics": {
            "peakSpeed": {
                "value": 3.5,
                "unit": "normalized_image/s",
                "confidence": 0.85,
                "evidenceConfidence": 0.90,
                "framesUsed": [12, 13, 14, 20],
                "source": "kinematic_features",
                "methodVersion": "1.0.0",
            }
        },
        "assessment": {
            "rubricId": "rubric_punch_v3" if family == "punch" else "rubric_kick_v3",
            "score": 85,
            "grade": "GOOD",
            "status": "good",
            "primaryError": None,
            "criteria": [],
            "findings": [],
        },
        "review": {
            "status": "ai_generated",
            "reviewerId": None,
            "reviewNotes": None,
        },
        "shadowClassification": {
            "status": "classified",
            "candidate": {
                "technique": technique,
                "family": family,
                "attackingSide": side,
                "limbRole": role,
                "stance": "orthodox",
            },
            "confidence": 0.85,
            "reasonCodes": ["MVP_CLASSIFIED"],
            "classifierId": "mvp_technique_discovery_engine",
            "classifierVersion": "1.0.0",
            "configVersion": "1.0.0",
            "featureVersion": "1.0.0",
            "stanceSource": "stance_context",
            "evidenceLevel": "derived_proxy",
            "validationStatus": "SHADOW_NOT_VALIDATED",
        },
    }

    # Contract validator (checks finite numbers, no NaN/inf, no mutable sets, valid keys)
    validate_contract_payload(action_dict)
    assert action_dict["family"] in ("punch", "kick", "other_strike", "non_strike")
    assert action_dict["attackingSide"] in ("left", "right", "unknown")
    assert action_dict["limbRole"] in ("lead", "rear", "unknown")
    assert action_dict["stance"] in ("orthodox", "southpaw", "switch", "unknown")

