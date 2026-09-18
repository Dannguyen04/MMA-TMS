"""
test_shadow_classifier.py — Contract & Unit Tests for Task 8 Shadow Jab-Cross Classifier

Wave 2 Execution:
- Direct imports from production module: pipeline.shadow_classifier
- Tests all canonical data contracts and guardrails (Cases A, B, C, D)
- Verifies parity with frontend Zod shadowClassificationSchema
- Validates integration with Agent C (Task 7) kinematic feature metrics
- Preserves legacy classification regression test
"""

from __future__ import annotations

import json
from dataclasses import dataclass, FrozenInstanceError
from typing import Any, Optional, Union
import unittest

from pipeline.stance_context import (
    StanceContext,
    StanceSource,
    StanceType,
    normalize_attacking_side,
    normalize_stance,
    resolve_limb_role,
)
from pipeline.classification import (
    ClassifiedTechnique,
    classify_punch,
)
from pipeline.shadow_classifier import (
    EvidenceLevel,
    DecisionStatus,
    TechniqueCandidate,
    ClassifierProvenance,
    ShadowClassifierConfig,
    ClassificationDecision,
    ShadowClassifier,
    classify_shadow_punch,
)


# ---------------------------------------------------------------------------
# Test Fixtures & Mock Feature Helpers
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class MockPunchFeatures:
    """Mock kinematic & trajectory feature input for shadow classifier testing."""
    arm: Optional[str] = None
    elbow_extension_deg: Optional[float] = None
    trajectory_directness: Optional[float] = None
    tangential_curvature: Optional[float] = None
    reach_ratio: Optional[float] = None
    is_evidence_missing: bool = False


@dataclass(frozen=True)
class MockKinematicMetricContract:
    """Mock of Task 7 KinematicMetricContract for inter-agent compatibility."""
    name: str
    value: Optional[float]
    unit: str
    confidence: Optional[float] = None
    evidence_level: str = "derived_proxy"


@dataclass
class MockKinematicFeatureSet:
    """Mock of Task 7 KinematicFeatureSet for inter-agent compatibility."""
    action_family: str
    metrics: dict[str, MockKinematicMetricContract]
    arm: Optional[str] = None
    feature_version: str = "1.0.0"


# ---------------------------------------------------------------------------
# Contract Test Suite: Task 8 Shadow Jab-Cross Classifier
# ---------------------------------------------------------------------------

class TestShadowClassifierContract(unittest.TestCase):
    """
    Contract tests validating:
    - Canonical data contracts & immutability
    - Guardrail Case A: Missing evidence -> unavailable, candidate=None, INSUFFICIENT_EVIDENCE
    - Guardrail Case B: Unresolved stance/limb -> derived_proxy, candidate=None, UNRESOLVED_STANCE_OR_LIMB
    - Guardrail Case C: Curved punch (CURVED_TRAJECTORY_REJECTED) & Low extension (INSUFFICIENT_EXTENSION_OR_REACH)
    - Guardrail Case D: Nominal straight punch classification (lead=jab, rear=cross) with confidence=None
    - Field-for-field parity with Zod shadowClassificationSchema
    - Inter-agent integration with Task 7 (Agent C) kinematic feature sets
    """

    def setUp(self) -> None:
        self.config = ShadowClassifierConfig()
        self.classifier = ShadowClassifier(config=self.config)

        # Helper stance contexts
        self.orthodox_context = StanceContext(
            requested_stance="orthodox",
            resolved_stance="orthodox",
            source=StanceSource.COACH_DECLARED.value,
            is_authoritative=True,
        )
        self.southpaw_context = StanceContext(
            requested_stance="southpaw",
            resolved_stance="southpaw",
            source=StanceSource.COACH_DECLARED.value,
            is_authoritative=True,
        )
        self.switch_context = StanceContext(
            requested_stance="switch",
            resolved_stance="switch",
            source=StanceSource.COACH_DECLARED.value,
            is_authoritative=True,
        )
        self.unknown_context = StanceContext(
            requested_stance=None,
            resolved_stance="unknown",
            source=StanceSource.UNKNOWN.value,
            is_authoritative=False,
        )

        # Nominal features for straight punches
        self.nominal_lead_features = MockPunchFeatures(
            arm="left",
            elbow_extension_deg=165.0,
            trajectory_directness=0.94,
            tangential_curvature=0.08,
            reach_ratio=0.88,
        )
        self.nominal_rear_features = MockPunchFeatures(
            arm="right",
            elbow_extension_deg=170.0,
            trajectory_directness=0.91,
            tangential_curvature=0.10,
            reach_ratio=0.92,
        )

    # -----------------------------------------------------------------------
    # Case A: Missing or Insufficient Evidence
    # -----------------------------------------------------------------------

    def test_case_a_none_features_abstains_with_insufficient_evidence(self) -> None:
        """Features=None must yield status=abstained, evidenceLevel=unavailable, candidate=None, reasonCodes containing INSUFFICIENT_EVIDENCE."""
        decision = self.classifier.classify(None, self.orthodox_context)

        self.assertEqual(decision.status, DecisionStatus.ABSTAINED)
        self.assertIsNone(decision.candidate)
        self.assertIsNone(decision.confidence)
        self.assertEqual(decision.evidence_level, EvidenceLevel.UNAVAILABLE)
        self.assertIn("INSUFFICIENT_EVIDENCE", decision.reason_codes)

        d = decision.to_dict()
        self.assertEqual(d["status"], "abstained")
        self.assertIsNone(d["candidate"])
        self.assertIsNone(d["confidence"])
        self.assertEqual(d["evidenceLevel"], "unavailable")
        self.assertIn("INSUFFICIENT_EVIDENCE", d["reasonCodes"])

    def test_case_a_empty_features_dict_abstains_with_insufficient_evidence(self) -> None:
        """Empty features dictionary must abstain with evidenceLevel=unavailable."""
        decision = self.classifier.classify({}, self.orthodox_context)

        self.assertEqual(decision.status, DecisionStatus.ABSTAINED)
        self.assertIsNone(decision.candidate)
        self.assertEqual(decision.evidence_level, EvidenceLevel.UNAVAILABLE)
        self.assertIn("INSUFFICIENT_EVIDENCE", decision.reason_codes)
        self.assertEqual(decision.to_dict()["evidenceLevel"], "unavailable")

    def test_case_a_flagged_missing_evidence_abstains_with_unavailable(self) -> None:
        """Explicit is_evidence_missing flag must force evidenceLevel=unavailable."""
        features = MockPunchFeatures(
            arm="left",
            elbow_extension_deg=165.0,
            is_evidence_missing=True,
        )
        decision = self.classifier.classify(features, self.orthodox_context)

        self.assertEqual(decision.status, DecisionStatus.ABSTAINED)
        self.assertIsNone(decision.candidate)
        self.assertEqual(decision.evidence_level, EvidenceLevel.UNAVAILABLE)
        self.assertIn("INSUFFICIENT_EVIDENCE", decision.reason_codes)

    def test_case_a_canonical_evidence_level_identity(self) -> None:
        """Verify pipeline.shadow_classifier.EvidenceLevel is the canonical EvidenceLevel from pipeline.contracts."""
        from pipeline.contracts import EvidenceLevel as CanonicalEvidenceLevel
        self.assertIs(EvidenceLevel, CanonicalEvidenceLevel)

    def test_case_a_unsupported_primitive_feature_inputs_abstains_gracefully(self) -> None:
        """Passing unsupported primitives (int, str, list, bool) yields controlled abstention and never raises AttributeError."""
        unsupported_inputs = [
            123,
            "punch_feature_string",
            [1, 2, 3],
            {"unrelated_key": 42},
            True,
            False,
            (10, 20),
        ]
        for bad_input in unsupported_inputs:
            with self.subTest(bad_input=bad_input):
                decision = self.classifier.classify(bad_input, self.orthodox_context)
                self.assertEqual(decision.status, DecisionStatus.ABSTAINED)
                self.assertIsNone(decision.candidate)
                self.assertEqual(decision.evidence_level, EvidenceLevel.UNAVAILABLE)
                self.assertIn("INSUFFICIENT_EVIDENCE", decision.reason_codes)

    def test_case_a_unsupported_arbitrary_object_abstains_gracefully(self) -> None:
        """Passing an arbitrary class instance without feature attributes yields controlled abstention without AttributeError."""
        class ArbitraryObject:
            unrelated_attribute = "foo"
            something_else = 999

        decision = self.classifier.classify(ArbitraryObject(), self.orthodox_context)
        self.assertEqual(decision.status, DecisionStatus.ABSTAINED)
        self.assertIsNone(decision.candidate)
        self.assertEqual(decision.evidence_level, EvidenceLevel.UNAVAILABLE)
        self.assertIn("INSUFFICIENT_EVIDENCE", decision.reason_codes)

    def test_case_a_non_mapping_metrics_attribute_abstains_gracefully(self) -> None:
        """Object with a non-mapping .metrics attribute (e.g. int, object) yields controlled abstention without calling .get()."""
        class BadMetricsObject:
            metrics = 12345  # Not a Mapping!

        decision = self.classifier.classify(BadMetricsObject(), self.orthodox_context)
        self.assertEqual(decision.status, DecisionStatus.ABSTAINED)
        self.assertIsNone(decision.candidate)
        self.assertEqual(decision.evidence_level, EvidenceLevel.UNAVAILABLE)
        self.assertIn("INSUFFICIENT_EVIDENCE", decision.reason_codes)

    def test_case_a_broken_property_raises_no_unhandled_exception(self) -> None:
        """Object whose property throws an error yields controlled abstention rather than unhandled exception."""
        class BrokenPropertyObject:
            @property
            def elbow_extension_deg(self):
                raise AttributeError("Simulated broken property")

        decision = self.classifier.classify(BrokenPropertyObject(), self.orthodox_context)
        self.assertEqual(decision.status, DecisionStatus.ABSTAINED)
        self.assertIsNone(decision.candidate)
        self.assertEqual(decision.evidence_level, EvidenceLevel.UNAVAILABLE)
        self.assertIn("INSUFFICIENT_EVIDENCE", decision.reason_codes)

    # -----------------------------------------------------------------------
    # Case B: Valid Derived Features with Unresolved Stance or Limb Context
    # -----------------------------------------------------------------------

    def test_case_b_switch_stance_abstains_with_derived_proxy(self) -> None:
        """Switch stance with valid straight punch features must abstain with derived_proxy and UNRESOLVED_STANCE_OR_LIMB."""
        decision = self.classifier.classify(self.nominal_lead_features, self.switch_context)

        self.assertEqual(decision.status, DecisionStatus.ABSTAINED)
        self.assertIsNone(decision.candidate)
        self.assertIsNone(decision.confidence)
        self.assertEqual(decision.evidence_level, EvidenceLevel.DERIVED_PROXY)
        self.assertIn("UNRESOLVED_STANCE_OR_LIMB", decision.reason_codes)

        d = decision.to_dict()
        self.assertEqual(d["status"], "abstained")
        self.assertIsNone(d["candidate"])
        self.assertIsNone(d["confidence"])
        self.assertEqual(d["evidenceLevel"], "derived_proxy")
        self.assertIn("UNRESOLVED_STANCE_OR_LIMB", d["reasonCodes"])

    def test_case_b_unknown_stance_abstains_with_derived_proxy(self) -> None:
        """Unknown stance with valid straight punch features must abstain with derived_proxy."""
        decision = self.classifier.classify(self.nominal_lead_features, self.unknown_context)

        self.assertEqual(decision.status, DecisionStatus.ABSTAINED)
        self.assertIsNone(decision.candidate)
        self.assertEqual(decision.evidence_level, EvidenceLevel.DERIVED_PROXY)
        self.assertIn("UNRESOLVED_STANCE_OR_LIMB", decision.reason_codes)

    def test_case_b_none_stance_context_abstains_with_derived_proxy(self) -> None:
        """stance_context=None with valid straight punch features must abstain with derived_proxy."""
        decision = self.classifier.classify(self.nominal_lead_features, None)

        self.assertEqual(decision.status, DecisionStatus.ABSTAINED)
        self.assertIsNone(decision.candidate)
        self.assertEqual(decision.evidence_level, EvidenceLevel.DERIVED_PROXY)
        self.assertIn("UNRESOLVED_STANCE_OR_LIMB", decision.reason_codes)
        self.assertEqual(decision.to_dict()["stanceSource"], "unknown")

    def test_case_b_unknown_attacking_arm_abstains_with_derived_proxy(self) -> None:
        """Unknown arm (arm=None or 'unknown') must abstain with UNRESOLVED_STANCE_OR_LIMB."""
        features = MockPunchFeatures(
            arm="unknown",
            elbow_extension_deg=165.0,
            trajectory_directness=0.92,
            tangential_curvature=0.09,
            reach_ratio=0.85,
        )
        decision = self.classifier.classify(features, self.orthodox_context)

        self.assertEqual(decision.status, DecisionStatus.ABSTAINED)
        self.assertIsNone(decision.candidate)
        self.assertEqual(decision.evidence_level, EvidenceLevel.DERIVED_PROXY)
        self.assertIn("UNRESOLVED_STANCE_OR_LIMB", decision.reason_codes)

    # -----------------------------------------------------------------------
    # Case C: Rejection of Curved Punches and Low Extension/Reach
    # -----------------------------------------------------------------------

    def test_case_c_curved_trajectory_directness_below_threshold_rejected(self) -> None:
        """Punch with directness < 0.82 must be rejected with CURVED_TRAJECTORY_REJECTED."""
        features = MockPunchFeatures(
            arm="left",
            elbow_extension_deg=160.0,
            trajectory_directness=0.75,  # Below min 0.82
            tangential_curvature=0.10,
            reach_ratio=0.85,
        )
        decision = self.classifier.classify(features, self.orthodox_context)

        self.assertEqual(decision.status, DecisionStatus.REJECTED_CANDIDATE)
        self.assertIsNone(decision.candidate)
        self.assertEqual(decision.evidence_level, EvidenceLevel.DERIVED_PROXY)
        self.assertIn("CURVED_TRAJECTORY_REJECTED", decision.reason_codes)
        self.assertNotIn("INSUFFICIENT_EXTENSION_OR_REACH", decision.reason_codes)

        d = decision.to_dict()
        self.assertEqual(d["status"], "rejected_candidate")
        self.assertIsNone(d["candidate"])
        self.assertEqual(d["evidenceLevel"], "derived_proxy")
        self.assertIn("CURVED_TRAJECTORY_REJECTED", d["reasonCodes"])

    def test_case_c_excessive_curvature_rejected(self) -> None:
        """Punch with curvature > 0.20 must be rejected with CURVED_TRAJECTORY_REJECTED."""
        features = MockPunchFeatures(
            arm="right",
            elbow_extension_deg=165.0,
            trajectory_directness=0.88,
            tangential_curvature=0.35,  # Above max 0.20 (hook-like)
            reach_ratio=0.80,
        )
        decision = self.classifier.classify(features, self.orthodox_context)

        self.assertEqual(decision.status, DecisionStatus.REJECTED_CANDIDATE)
        self.assertIsNone(decision.candidate)
        self.assertIn("CURVED_TRAJECTORY_REJECTED", decision.reason_codes)

    def test_case_c_low_elbow_extension_rejected(self) -> None:
        """Punch with elbow extension < 140.0 deg must be rejected with INSUFFICIENT_EXTENSION_OR_REACH."""
        features = MockPunchFeatures(
            arm="left",
            elbow_extension_deg=125.0,  # Below min 140.0 deg
            trajectory_directness=0.90,
            tangential_curvature=0.08,
            reach_ratio=0.80,
        )
        decision = self.classifier.classify(features, self.orthodox_context)

        self.assertEqual(decision.status, DecisionStatus.REJECTED_CANDIDATE)
        self.assertIsNone(decision.candidate)
        self.assertIn("INSUFFICIENT_EXTENSION_OR_REACH", decision.reason_codes)
        self.assertNotIn("CURVED_TRAJECTORY_REJECTED", decision.reason_codes)

    def test_case_c_low_reach_ratio_rejected(self) -> None:
        """Punch with reach_ratio < 0.70 must be rejected with INSUFFICIENT_EXTENSION_OR_REACH."""
        features = MockPunchFeatures(
            arm="right",
            elbow_extension_deg=160.0,
            trajectory_directness=0.90,
            tangential_curvature=0.08,
            reach_ratio=0.55,  # Below min 0.70
        )
        decision = self.classifier.classify(features, self.orthodox_context)

        self.assertEqual(decision.status, DecisionStatus.REJECTED_CANDIDATE)
        self.assertIsNone(decision.candidate)
        self.assertIn("INSUFFICIENT_EXTENSION_OR_REACH", decision.reason_codes)

    def test_case_c_simultaneous_curved_and_low_extension_rejection(self) -> None:
        """Punch failing both curvature and extension must record both reason codes."""
        features = MockPunchFeatures(
            arm="left",
            elbow_extension_deg=115.0,  # Low extension
            trajectory_directness=0.65,  # Highly curved
            tangential_curvature=0.45,  # Highly curved
            reach_ratio=0.50,          # Low reach
        )
        decision = self.classifier.classify(features, self.orthodox_context)

        self.assertEqual(decision.status, DecisionStatus.REJECTED_CANDIDATE)
        self.assertIn("CURVED_TRAJECTORY_REJECTED", decision.reason_codes)
        self.assertIn("INSUFFICIENT_EXTENSION_OR_REACH", decision.reason_codes)
        self.assertEqual(len(decision.reason_codes), 2)

    # -----------------------------------------------------------------------
    # Case D: Nominal Straight Punch Classification (Orthodox & Southpaw)
    # -----------------------------------------------------------------------

    def test_case_d_orthodox_lead_punch_classified_as_jab(self) -> None:
        """Orthodox + left arm -> lead jab candidate with confidence=None."""
        features = MockPunchFeatures(
            arm="left",
            elbow_extension_deg=168.0,
            trajectory_directness=0.95,
            tangential_curvature=0.05,
            reach_ratio=0.90,
        )
        decision = self.classifier.classify(features, self.orthodox_context)

        self.assertEqual(decision.status, DecisionStatus.CLASSIFIED)
        self.assertIsNotNone(decision.candidate)
        candidate = decision.candidate
        self.assertEqual(candidate.technique, "jab")
        self.assertEqual(candidate.family, "punch")
        self.assertEqual(candidate.attacking_side, "left")
        self.assertEqual(candidate.limb_role, "lead")
        self.assertEqual(candidate.stance, "orthodox")
        self.assertIsNone(decision.confidence)
        self.assertEqual(decision.evidence_level, EvidenceLevel.DERIVED_PROXY)
        self.assertEqual(decision.reason_codes, ())

        d = decision.to_dict()
        self.assertEqual(d["status"], "classified")
        self.assertIsNone(d["confidence"])
        self.assertEqual(d["candidate"]["technique"], "jab")
        self.assertEqual(d["candidate"]["family"], "punch")
        self.assertEqual(d["candidate"]["attackingSide"], "left")
        self.assertEqual(d["candidate"]["limbRole"], "lead")
        self.assertEqual(d["candidate"]["stance"], "orthodox")
        self.assertEqual(d["evidenceLevel"], "derived_proxy")
        self.assertEqual(d["reasonCodes"], [])

    def test_case_d_orthodox_rear_punch_classified_as_cross(self) -> None:
        """Orthodox + right arm -> rear cross candidate with confidence=None."""
        features = MockPunchFeatures(
            arm="right",
            elbow_extension_deg=172.0,
            trajectory_directness=0.92,
            tangential_curvature=0.07,
            reach_ratio=0.95,
        )
        decision = self.classifier.classify(features, self.orthodox_context)

        self.assertEqual(decision.status, DecisionStatus.CLASSIFIED)
        self.assertIsNotNone(decision.candidate)
        candidate = decision.candidate
        self.assertEqual(candidate.technique, "cross")
        self.assertEqual(candidate.family, "punch")
        self.assertEqual(candidate.attacking_side, "right")
        self.assertEqual(candidate.limb_role, "rear")
        self.assertEqual(candidate.stance, "orthodox")
        self.assertIsNone(decision.confidence)
        self.assertEqual(decision.evidence_level, EvidenceLevel.DERIVED_PROXY)

        d = decision.to_dict()
        self.assertEqual(d["candidate"]["technique"], "cross")
        self.assertEqual(d["candidate"]["limbRole"], "rear")

    def test_case_d_southpaw_lead_punch_classified_as_jab(self) -> None:
        """Southpaw + right arm -> lead jab candidate with confidence=None."""
        features = MockPunchFeatures(
            arm="right",
            elbow_extension_deg=165.0,
            trajectory_directness=0.94,
            tangential_curvature=0.06,
            reach_ratio=0.89,
        )
        decision = self.classifier.classify(features, self.southpaw_context)

        self.assertEqual(decision.status, DecisionStatus.CLASSIFIED)
        self.assertIsNotNone(decision.candidate)
        candidate = decision.candidate
        self.assertEqual(candidate.technique, "jab")
        self.assertEqual(candidate.family, "punch")
        self.assertEqual(candidate.attacking_side, "right")
        self.assertEqual(candidate.limb_role, "lead")
        self.assertEqual(candidate.stance, "southpaw")
        self.assertIsNone(decision.confidence)

        d = decision.to_dict()
        self.assertEqual(d["candidate"]["technique"], "jab")
        self.assertEqual(d["candidate"]["attackingSide"], "right")
        self.assertEqual(d["candidate"]["limbRole"], "lead")
        self.assertEqual(d["candidate"]["stance"], "southpaw")

    def test_case_d_southpaw_rear_punch_classified_as_cross(self) -> None:
        """Southpaw + left arm -> rear cross candidate with confidence=None."""
        features = MockPunchFeatures(
            arm="left",
            elbow_extension_deg=175.0,
            trajectory_directness=0.93,
            tangential_curvature=0.05,
            reach_ratio=0.96,
        )
        decision = self.classifier.classify(features, self.southpaw_context)

        self.assertEqual(decision.status, DecisionStatus.CLASSIFIED)
        self.assertIsNotNone(decision.candidate)
        candidate = decision.candidate
        self.assertEqual(candidate.technique, "cross")
        self.assertEqual(candidate.family, "punch")
        self.assertEqual(candidate.attacking_side, "left")
        self.assertEqual(candidate.limb_role, "rear")
        self.assertEqual(candidate.stance, "southpaw")
        self.assertIsNone(decision.confidence)

        d = decision.to_dict()
        self.assertEqual(d["candidate"]["technique"], "cross")
        self.assertEqual(d["candidate"]["attackingSide"], "left")
        self.assertEqual(d["candidate"]["limbRole"], "rear")
        self.assertEqual(d["candidate"]["stance"], "southpaw")

    # -----------------------------------------------------------------------
    # Parity with Zod shadowClassificationSchema & JSON Serialization
    # -----------------------------------------------------------------------

    def test_zod_schema_field_parity_on_classified_decision(self) -> None:
        """Validate exact 10 top-level fields and candidate field names in to_dict() matching Zod schema."""
        decision = self.classifier.classify(self.nominal_lead_features, self.orthodox_context)
        d = decision.to_dict()

        expected_keys = {
            "status",
            "candidate",
            "confidence",
            "reasonCodes",
            "classifierId",
            "classifierVersion",
            "configVersion",
            "featureVersion",
            "stanceSource",
            "evidenceLevel",
        }
        self.assertEqual(set(d.keys()), expected_keys)

        expected_candidate_keys = {
            "technique",
            "family",
            "attackingSide",
            "limbRole",
            "stance",
        }
        self.assertIsNotNone(d["candidate"])
        self.assertEqual(set(d["candidate"].keys()), expected_candidate_keys)

        # Type checks
        self.assertIsInstance(d["status"], str)
        self.assertIn(d["status"], ["classified", "abstained", "rejected_candidate"])
        self.assertIsNone(d["confidence"])
        self.assertIsInstance(d["reasonCodes"], list)
        self.assertIsInstance(d["classifierId"], str)
        self.assertIsInstance(d["classifierVersion"], str)
        self.assertIsInstance(d["configVersion"], str)
        self.assertIsInstance(d["featureVersion"], str)
        self.assertIsInstance(d["stanceSource"], str)
        self.assertIn(d["evidenceLevel"], ["observed", "derived_proxy", "unavailable"])

        # JSON serialize & roundtrip
        serialized = json.dumps(d)
        deserialized = json.loads(serialized)
        self.assertEqual(deserialized, d)

    def test_zod_schema_field_parity_on_abstained_decision(self) -> None:
        """Validate to_dict() structure when candidate is None."""
        decision = self.classifier.classify(None, self.orthodox_context)
        d = decision.to_dict()

        expected_keys = {
            "status",
            "candidate",
            "confidence",
            "reasonCodes",
            "classifierId",
            "classifierVersion",
            "configVersion",
            "featureVersion",
            "stanceSource",
            "evidenceLevel",
        }
        self.assertEqual(set(d.keys()), expected_keys)
        self.assertIsNone(d["candidate"])
        self.assertEqual(d["status"], "abstained")
        self.assertEqual(d["evidenceLevel"], "unavailable")

        # JSON serialize & roundtrip
        serialized = json.dumps(d)
        deserialized = json.loads(serialized)
        self.assertEqual(deserialized, d)

    # -----------------------------------------------------------------------
    # Boundary / Edge Value Testing
    # -----------------------------------------------------------------------

    def test_boundary_values_exact_thresholds_pass(self) -> None:
        """Exact threshold boundary values must pass straight punch classification."""
        features = MockPunchFeatures(
            arm="left",
            elbow_extension_deg=140.0,      # Exact min
            trajectory_directness=0.82,     # Exact min
            tangential_curvature=0.20,      # Exact max
            reach_ratio=0.70,               # Exact min
        )
        decision = self.classifier.classify(features, self.orthodox_context)
        self.assertEqual(decision.status, DecisionStatus.CLASSIFIED)

    def test_boundary_values_just_below_min_fail(self) -> None:
        """Slightly below min thresholds must trigger rejection."""
        # Just below directness
        f1 = MockPunchFeatures(
            arm="left",
            elbow_extension_deg=140.0,
            trajectory_directness=0.819,
            tangential_curvature=0.20,
            reach_ratio=0.70,
        )
        self.assertEqual(self.classifier.classify(f1, self.orthodox_context).status, DecisionStatus.REJECTED_CANDIDATE)

        # Just above curvature
        f2 = MockPunchFeatures(
            arm="left",
            elbow_extension_deg=140.0,
            trajectory_directness=0.82,
            tangential_curvature=0.201,
            reach_ratio=0.70,
        )
        self.assertEqual(self.classifier.classify(f2, self.orthodox_context).status, DecisionStatus.REJECTED_CANDIDATE)

        # Just below elbow extension
        f3 = MockPunchFeatures(
            arm="left",
            elbow_extension_deg=139.9,
            trajectory_directness=0.82,
            tangential_curvature=0.20,
            reach_ratio=0.70,
        )
        self.assertEqual(self.classifier.classify(f3, self.orthodox_context).status, DecisionStatus.REJECTED_CANDIDATE)

        # Just below reach ratio
        f4 = MockPunchFeatures(
            arm="left",
            elbow_extension_deg=140.0,
            trajectory_directness=0.82,
            tangential_curvature=0.20,
            reach_ratio=0.699,
        )
        self.assertEqual(self.classifier.classify(f4, self.orthodox_context).status, DecisionStatus.REJECTED_CANDIDATE)

    # -----------------------------------------------------------------------
    # Immutability and Duck-Typing
    # -----------------------------------------------------------------------

    def test_dataclasses_are_frozen(self) -> None:
        """TechniqueCandidate, ClassifierProvenance, ShadowClassifierConfig, and ClassificationDecision must be frozen."""
        candidate = TechniqueCandidate(
            technique="jab", family="punch", attacking_side="left", limb_role="lead", stance="orthodox"
        )
        with self.assertRaises(FrozenInstanceError):
            candidate.technique = "cross"  # type: ignore

        config = ShadowClassifierConfig()
        with self.assertRaises(FrozenInstanceError):
            config.min_elbow_extension_deg = 150.0  # type: ignore

        prov = ClassifierProvenance()
        with self.assertRaises(FrozenInstanceError):
            prov.classifier_id = "other"  # type: ignore

        decision = self.classifier.classify(self.nominal_lead_features, self.orthodox_context)
        with self.assertRaises(FrozenInstanceError):
            decision.confidence = 0.99  # type: ignore

    def test_duck_typed_input_dict(self) -> None:
        """Dict inputs with various key styles should work seamlessly."""
        raw_dict = {
            "arm": "left",
            "elbow_extension_deg": 160.0,
            "trajectory_directness": 0.90,
            "tangential_curvature": 0.12,
            "reach_ratio": 0.85,
        }
        decision = self.classifier.classify(raw_dict, self.orthodox_context)
        self.assertEqual(decision.status, DecisionStatus.CLASSIFIED)
        self.assertEqual(decision.candidate.technique, "jab")

    def test_custom_provenance_and_config(self) -> None:
        """Custom configuration version propagates through provenance."""
        custom_config = ShadowClassifierConfig(
            config_version="2.0.0-beta",
            min_elbow_extension_deg=150.0,
        )
        custom_classifier = ShadowClassifier(config=custom_config)
        decision = custom_classifier.classify(self.nominal_lead_features, self.orthodox_context)

        self.assertEqual(decision.provenance.config_version, "2.0.0-beta")
        self.assertEqual(decision.to_dict()["configVersion"], "2.0.0-beta")

    # -----------------------------------------------------------------------
    # Inter-Agent Compatibility (Task 7 / Agent C Feature Integration)
    # -----------------------------------------------------------------------

    def test_agent_c_straight_punch_kinematic_features_classification(self) -> None:
        """Agent C KinematicFeatureSet for straight punch maps directly to jab/cross candidate."""
        fset = MockKinematicFeatureSet(
            action_family="punch",
            arm="right",
            metrics={
                "elbow_extension_angle": MockKinematicMetricContract("elbow_extension_angle", 168.0, "degree"),
                "trajectory_directness": MockKinematicMetricContract("trajectory_directness", 0.95, "ratio"),
                "max_tangential_curvature": MockKinematicMetricContract("max_tangential_curvature", 0.06, "normalized"),
                "reach_ratio": MockKinematicMetricContract("reach_ratio", 0.92, "ratio"),
                "peak_speed_proxy": MockKinematicMetricContract("peak_speed_proxy", 2.4, "normalized_image/s"),
            },
        )
        decision = self.classifier.classify(fset, self.orthodox_context)

        self.assertEqual(decision.status, DecisionStatus.CLASSIFIED)
        self.assertIsNotNone(decision.candidate)
        self.assertEqual(decision.candidate.technique, "cross")
        self.assertEqual(decision.candidate.limb_role, "rear")
        self.assertEqual(decision.candidate.attacking_side, "right")

    def test_agent_c_hook_kinematic_features_rejected(self) -> None:
        """Agent C KinematicFeatureSet for curved hook is rejected as non-straight candidate."""
        fset = MockKinematicFeatureSet(
            action_family="punch",
            arm="left",
            metrics={
                "elbow_extension_angle": MockKinematicMetricContract("elbow_extension_angle", 145.0, "degree"),
                "trajectory_directness": MockKinematicMetricContract("trajectory_directness", 0.72, "ratio"),
                "max_tangential_curvature": MockKinematicMetricContract("max_tangential_curvature", 0.28, "normalized"),
                "reach_ratio": MockKinematicMetricContract("reach_ratio", 0.82, "ratio"),
            },
        )
        decision = self.classifier.classify(fset, self.orthodox_context)

        self.assertEqual(decision.status, DecisionStatus.REJECTED_CANDIDATE)
        self.assertIsNone(decision.candidate)
        self.assertIn("CURVED_TRAJECTORY_REJECTED", decision.reason_codes)

    def test_agent_c_insufficient_evidence_metric_set_abstains(self) -> None:
        """Agent C KinematicFeatureSet with unavailable metrics abstains."""
        fset = MockKinematicFeatureSet(
            action_family="punch",
            arm="left",
            metrics={
                "elbow_extension_angle": MockKinematicMetricContract("elbow_extension_angle", None, "degree"),
                "trajectory_directness": MockKinematicMetricContract("trajectory_directness", None, "ratio"),
                "max_tangential_curvature": MockKinematicMetricContract("max_tangential_curvature", None, "normalized"),
                "reach_ratio": MockKinematicMetricContract("reach_ratio", None, "ratio"),
            },
        )
        decision = self.classifier.classify(fset, self.orthodox_context)

        self.assertEqual(decision.status, DecisionStatus.ABSTAINED)
        self.assertIsNone(decision.candidate)
        self.assertEqual(decision.evidence_level, EvidenceLevel.UNAVAILABLE)
        self.assertIn("INSUFFICIENT_EVIDENCE", decision.reason_codes)

    def test_e2e_integration_with_pipeline_kinematic_features(self) -> None:
        """End-to-end integration test using real pipeline.kinematic_features engine from Agent C."""
        try:
            from pipeline.kinematic_features import extract_kinematic_features
            from test_kinematic_features import generate_linear_straight_punch, generate_curved_hook_punch
        except ImportError:
            self.skipTest("pipeline.kinematic_features not yet available")

        # 1. Straight punch nominal -> classified as cross
        frames_straight = generate_linear_straight_punch(num_frames=10, fps=30.0, start_x=0.30, end_x=0.60, y=0.45)
        features_straight = extract_kinematic_features(frames_straight, arm_side="right", action_family="punch")
        decision_straight = self.classifier.classify(features_straight, self.orthodox_context)

        self.assertEqual(decision_straight.status, DecisionStatus.CLASSIFIED)
        self.assertIsNotNone(decision_straight.candidate)
        self.assertEqual(decision_straight.candidate.technique, "cross")
        self.assertEqual(decision_straight.candidate.limb_role, "rear")
        self.assertEqual(decision_straight.candidate.attacking_side, "right")
        self.assertEqual(decision_straight.candidate.stance, "orthodox")

        # 2. Curved hook punch -> rejected candidate
        frames_hook = generate_curved_hook_punch(num_frames=12, fps=30.0, radius=0.20, center_x=0.35, center_y=0.45)
        features_hook = extract_kinematic_features(frames_hook, arm_side="right", action_family="punch")
        decision_hook = self.classifier.classify(features_hook, self.orthodox_context)

        self.assertEqual(decision_hook.status, DecisionStatus.REJECTED_CANDIDATE)
        self.assertIsNone(decision_hook.candidate)
        self.assertIn("CURVED_TRAJECTORY_REJECTED", decision_hook.reason_codes)


# ---------------------------------------------------------------------------
# Legacy Classification Regression Test (Active)
# ---------------------------------------------------------------------------

class TestLegacyClassificationRegression(unittest.TestCase):
    """
    Validates that existing legacy classification module (pipeline.classification)
    remains completely active, unaffected, and preserves technical debt behaviors.
    """

    def test_legacy_classification_zero_regression(self) -> None:
        """
        Verify that Task 3 legacy classifier classify_punch continues to behave identically
        (zero regression on technical debt: Southpaw + right arm legacy cross remains 'cross').
        """
        southpaw_context = StanceContext(
            requested_stance="southpaw",
            resolved_stance="southpaw",
            source=StanceSource.COACH_DECLARED.value,
            is_authoritative=True,
        )

        class DummyLegacyPunch:
            def __init__(self, arm: str = "right", punch_type: str = "cross"):
                self.arm = arm
                self.punch_type = punch_type

        legacy_punch = DummyLegacyPunch(arm="right", punch_type="cross")
        legacy_result = classify_punch(legacy_punch, southpaw_context)

        # Legacy behavior: technique stays "cross", limb_role is "lead"
        self.assertEqual(legacy_result.technique, "cross")
        self.assertEqual(legacy_result.limb_role, "lead")
        self.assertEqual(legacy_result.stance, "southpaw")


if __name__ == "__main__":
    unittest.main()
