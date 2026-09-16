"""
test_adversarial_contract.py — Independent QA & Adversarial Test Suite for Wave 1 & Wave 2

Role: Agent E (Independent QA & Adversarial Tester).
Scope:
- Directly imports canonical production modules:
  - Task 5: from pipeline.assessment_engine import AssessmentMetricItem, AssessmentProvenance, AssessmentResult, AssessmentStatus, EvaluatorResolutionError, RubricResolutionError, to_assessment_metric, get_default_assessment_engine
  - Task 6: from pipeline.temporal_phases import EvidenceLevel, PhaseEvidence, PhaseBoundary, TemporalPhaseSequence, TemporalPhaseConfig, extract_temporal_phases
  - Tasks 7 & 8: forward-compatible imports guarded by WAVE2_KINEMATICS / WAVE2_CLASSIFIER and @unittest.skipUnless
- Continuous Adversarial QA & Re-Audit (Wave 2 Mandate):
  1. Task 5 false provenance prevention: generic evaluators never report is_discipline_specific=True;
     unsupported disciplines (boxing, kickboxing, muay_thai, unknown) raise structured EvaluatorResolutionError or RubricResolutionError;
     no fabricated expert panels exist;
     score=None is strictly preserved under insufficient evidence;
     removal of top-level ActionMetricItem runtime import.
  2. Task 6 confidence rigor & transitive immutability:
     PhaseBoundary evidences never contain hardcoded confidence floats (0.92, 0.88, 0.85, 0.70);
     confidence is None or deterministically measured;
     PoseValidityConfig is actively propagated into landmark analysis;
     TemporalPhaseConfig enforces transitive immutability and mutation-isolation from PoseValidityConfig;
     Strict bi-directional nullability, frame/time consistency with tolerance_ms = 0.5 * (1000.0 / fps) + 0.2,
     and monotonic ordering.
  3. Task 7 Kinematic Feature Engine adversarial stress tests:
     NaN/Inf inputs, zero duration, single frame, degenerate collinear trajectories.
  4. Task 8 Shadow Classifier adversarial stress tests:
     Switch stance abstention, unknown arm abstention, boundary thresholds (0.820 vs 0.819, 140.0 vs 139.9),
     curved hook rejection, complete classifier provenance, and Zod field parity.
  5. Deep immutability and zero input mutation across all DTO models.
"""

from __future__ import annotations

import copy
from dataclasses import dataclass, FrozenInstanceError
import json
import math
from types import MappingProxyType
from typing import Any, Dict, List, Mapping, Optional, Sequence, Tuple
import unittest

from pose_math import Point, KP, PoseValidityConfig
from create_golden_baseline import generate_punch_sequence

from pipeline.stance_context import (
    StanceContext,
    StanceSource,
    StanceType,
    normalize_stance,
    normalize_attacking_side,
    resolve_limb_role,
    resolve_stance_context,
)
from pipeline.analysis_context import AnalysisContext, MartialArt
from pipeline.rubric_registry import RubricSelectionResult, RubricSelectionStatus

# =============================================================================
# Canonical Production Module Imports (Wave 1 Active)
# =============================================================================

# Task 5 Production Module
from pipeline.assessment_engine import (
    AssessmentMetricItem,
    AssessmentProvenance,
    AssessmentResult,
    AssessmentStatus,
    AssessmentEngine,
    EvaluatorResolutionError,
    RubricResolutionError,
    to_assessment_metric,
    get_default_assessment_engine,
    DefaultPunchEvaluator,
    DefaultKickEvaluator,
    compute_derived_rubric_confidence,
    calculate_score_and_grade,
)

# Task 6 Production Module
from pipeline.temporal_phases import (
    CANONICAL_PHASES,
    EvidenceLevel,
    PhaseEvidence,
    PhaseBoundary,
    TemporalPhaseSequence,
    TemporalPhaseConfig,
    calculate_tolerance_ms,
    extract_temporal_phases,
    segment_punch_phases,
    segment_kick_phases,
)

# =============================================================================
# Forward-Compatible Gates for Wave 2 Implementations
# =============================================================================

WAVE2_KINEMATICS_ERROR: Optional[str] = None
try:
    from pipeline.kinematic_features import (  # type: ignore
        KinematicMetricContract,
        KinematicFeatureSet,
        extract_kinematic_features,
        EvidenceQuality,
    )
    WAVE2_KINEMATICS = True
except (ImportError, Exception) as err:
    WAVE2_KINEMATICS = False
    WAVE2_KINEMATICS_ERROR = f"{type(err).__name__}: {err}"
    KinematicMetricContract = None  # type: ignore
    KinematicFeatureSet = None  # type: ignore
    extract_kinematic_features = None  # type: ignore
    EvidenceQuality = None  # type: ignore

WAVE2_CLASSIFIER_ERROR: Optional[str] = None
try:
    from pipeline.shadow_classifier import (  # type: ignore
        DecisionStatus,
        TechniqueCandidate,
        ClassifierProvenance,
        ShadowClassifierConfig,
        ClassificationDecision,
        ShadowClassifier,
        classify_shadow_punch,
    )
    WAVE2_CLASSIFIER = True
except (ImportError, Exception) as err:
    WAVE2_CLASSIFIER = False
    WAVE2_CLASSIFIER_ERROR = f"{type(err).__name__}: {err}"
    DecisionStatus = None  # type: ignore
    TechniqueCandidate = None  # type: ignore
    ClassifierProvenance = None  # type: ignore
    ShadowClassifierConfig = None  # type: ignore
    ClassificationDecision = None  # type: ignore
    ShadowClassifier = None  # type: ignore
    classify_shadow_punch = None  # type: ignore

try:
    from pipeline.contracts import deep_freeze, to_json_safe  # type: ignore
    CANONICAL_FREEZE_AVAILABLE = True
except (ImportError, Exception):
    try:
        from pipeline.serialization import deep_freeze, to_json_safe  # type: ignore
        CANONICAL_FREEZE_AVAILABLE = True
    except (ImportError, Exception):
        CANONICAL_FREEZE_AVAILABLE = False
        deep_freeze = None  # type: ignore
        to_json_safe = None  # type: ignore


# =============================================================================
# Test Fixtures (Synthetic Poses and Mock Features)
# =============================================================================

@dataclass
class SyntheticPoseFrame:
    """Synthetic pose frame test fixture for kinematic trajectory analysis."""
    frame_idx: int
    time_ms: float
    landmarks: dict[int, Optional[Point]]


@dataclass(frozen=True)
class MockPunchFeatures:
    """Mock kinematic & trajectory feature input for shadow classifier testing."""
    arm: Optional[str] = None
    elbow_extension_deg: Optional[float] = None
    trajectory_directness: Optional[float] = None
    tangential_curvature: Optional[float] = None
    reach_ratio: Optional[float] = None
    is_evidence_missing: bool = False


# =============================================================================
# Task 5: Assessment Engine & Rubric Provenance Adversarial Suite
# =============================================================================

class TestTask5AssessmentEngineAdversarial(unittest.TestCase):
    """
    Adversarial verification of Task 5 Assessment Engine and Provenance.
    Audits:
    - Generic evaluators never claim discipline-specific expertise (is_discipline_specific is False).
    - Unsupported disciplines (boxing, kickboxing, muay_thai, unknown) raise structured domain errors.
    - No fabricated expert panels exist.
    - Strict evidence gating and score=None preservation under insufficient evidence.
    - Absence of top-level ActionMetricItem runtime import (layering decoupling).
    - Deep immutability and zero input mutation.
    """

    def setUp(self) -> None:
        self.engine = get_default_assessment_engine()

    def test_generic_evaluators_never_report_discipline_specific(self) -> None:
        """Audit: Generic evaluators (punch and kick) MUST set is_discipline_specific=False."""
        # 1. Direct DefaultPunchEvaluator
        punch_eval = DefaultPunchEvaluator()
        res_punch = punch_eval.evaluate({})
        self.assertFalse(
            res_punch.provenance.is_discipline_specific,
            "Generic DefaultPunchEvaluator must never report is_discipline_specific=True"
        )

        # 2. Direct DefaultKickEvaluator
        kick_eval = DefaultKickEvaluator()
        res_kick = kick_eval.evaluate({})
        self.assertFalse(
            res_kick.provenance.is_discipline_specific,
            "Generic DefaultKickEvaluator must never report is_discipline_specific=True"
        )

        # 3. Via AssessmentEngine dispatch without context
        res_engine_punch = self.engine.evaluate({}, technique="punch")
        self.assertFalse(
            res_engine_punch.provenance.is_discipline_specific,
            "AssessmentEngine generic punch evaluation must have is_discipline_specific=False"
        )

        res_engine_kick = self.engine.evaluate({}, technique="round_kick")
        self.assertFalse(
            res_engine_kick.provenance.is_discipline_specific,
            "AssessmentEngine generic kick evaluation must have is_discipline_specific=False"
        )

        # 4. Via AssessmentEngine dispatch with generic context
        generic_ctx = AnalysisContext(martial_art=MartialArt.GENERIC.value)
        res_generic_ctx = self.engine.evaluate({}, technique="punch", context=generic_ctx)
        self.assertFalse(
            res_generic_ctx.provenance.is_discipline_specific,
            "AssessmentEngine generic context must have is_discipline_specific=False"
        )

        # 5. AssessmentProvenance constructor requires strict boolean type
        with self.assertRaises(TypeError):
            AssessmentProvenance(
                evaluator_id="eval_test",
                evaluator_version="1.0.0",
                rubric_id="rub_test",
                rubric_version="1.0.0",
                rubric_status="VALIDATED",
                is_discipline_specific="True",  # String instead of strict bool
            )

    def test_unsupported_disciplines_raise_structured_errors(self) -> None:
        """
        Audit: Unsupported disciplines (boxing, kickboxing, muay_thai, unknown) must raise
        structured EvaluatorResolutionError or RubricResolutionError with selection_result metadata.
        """
        unsupported_disciplines = ["boxing", "kickboxing", "muay_thai", "karate", "taekwondo", "unknown"]

        for discipline in unsupported_disciplines:
            with self.subTest(discipline=discipline):
                ctx = AnalysisContext(martial_art=discipline)

                # Test resolve failure
                with self.assertRaises((RubricResolutionError, EvaluatorResolutionError)) as err_ctx:
                    self.engine.resolve("punch", context=ctx)

                exc = err_ctx.exception
                self.assertTrue(
                    hasattr(exc, "selection_result"),
                    f"Exception {type(exc).__name__} must contain selection_result metadata"
                )
                sel_res = exc.selection_result
                self.assertIsNotNone(sel_res, f"selection_result must not be None for {discipline}")
                self.assertNotEqual(
                    sel_res.status,
                    RubricSelectionStatus.SELECTED,
                    f"Selection status must not be SELECTED for unsupported discipline {discipline}"
                )

                # Test evaluate failure
                with self.assertRaises((RubricResolutionError, EvaluatorResolutionError)):
                    self.engine.evaluate({}, technique="punch", context=ctx)

        # Non-whitelisted disciplines must fail fast at AnalysisContext validation
        for invalid_ma in ["judo", "kungfu", "capoeira"]:
            with self.subTest(invalid_ma=invalid_ma):
                with self.assertRaises(ValueError):
                    AnalysisContext(martial_art=invalid_ma)

    def test_no_fabricated_expert_panels(self) -> None:
        """
        Audit: No fabricated expert panels exist in the evaluator registry or rubric IDs.
        Only approved canonical evaluators and rubrics exist.
        """
        evaluators = self.engine.evaluator_registry.list_evaluators()
        evaluator_ids = {ev.evaluator_id for ev in evaluators}

        canonical_evaluators = {"default_punch_evaluator", "default_kick_evaluator"}
        self.assertEqual(
            evaluator_ids,
            canonical_evaluators,
            f"Evaluator registry contains unexpected evaluators: {evaluator_ids - canonical_evaluators}"
        )

        for ev in evaluators:
            self.assertNotIn("expert_panel", ev.evaluator_id.lower())
            self.assertNotIn("olympic", ev.evaluator_id.lower())
            self.assertNotIn("wbc", ev.evaluator_id.lower())
            self.assertNotIn("one_championship", ev.evaluator_id.lower())

        with self.assertRaises(ValueError):
            AssessmentProvenance(
                evaluator_id="",
                evaluator_version="1.0.0",
                rubric_id="rub_1",
                rubric_version="1.0.0",
                rubric_status="VALIDATED",
            )

        with self.assertRaises(ValueError):
            AssessmentProvenance(
                evaluator_id="eval_1",
                evaluator_version="not-a-semver",
                rubric_id="rub_1",
                rubric_version="1.0.0",
                rubric_status="VALIDATED",
            )

    def test_insufficient_evidence_gating_adversarial(self) -> None:
        """Audit: Insufficient evidence guarantees score=None, grade='NO_DATA', status=INSUFFICIENT_EVIDENCE, confidence=None."""
        prov = AssessmentProvenance(
            evaluator_id="default_punch_evaluator",
            evaluator_version="1.0.0",
            rubric_id="rubric_punch_v3",
            rubric_version="3.0.0",
            rubric_status="VALIDATED",
            is_discipline_specific=False,
        )

        # Adversarial attempt to provide a high score with INSUFFICIENT_EVIDENCE
        res_spoofed = AssessmentResult(
            score=95,
            grade="PERFECT",
            status=AssessmentStatus.INSUFFICIENT_EVIDENCE,
            assessment_confidence=0.99,
            provenance=prov,
        )
        self.assertIsNone(res_spoofed.score, "Score must be None under INSUFFICIENT_EVIDENCE")
        self.assertEqual(res_spoofed.grade, "NO_DATA", "Grade must be 'NO_DATA' under INSUFFICIENT_EVIDENCE")
        self.assertIsNone(res_spoofed.assessment_confidence, "Confidence must be None under INSUFFICIENT_EVIDENCE")

        # Adversarial attempt to provide a score with NO_DATA grade
        res_nodata = AssessmentResult(
            score=80,
            grade="NO_DATA",
            status=AssessmentStatus.GOOD,
            assessment_confidence=0.85,
            provenance=prov,
        )
        self.assertIsNone(res_nodata.score)
        self.assertEqual(res_nodata.status, AssessmentStatus.INSUFFICIENT_EVIDENCE)
        self.assertIsNone(res_nodata.assessment_confidence)

    def test_score_none_preservation_under_insufficient_evidence(self) -> None:
        """Audit: AssessmentResult strictly preserves score=None and legacy conversion score=0."""
        prov = AssessmentProvenance(
            evaluator_id="default_punch_evaluator",
            evaluator_version="1.0.0",
            rubric_id="rubric_punch_v3",
            rubric_version="3.0.0",
            rubric_status="VALIDATED",
            is_discipline_specific=False,
        )
        res = AssessmentResult(
            score=None,
            grade="NO_DATA",
            status=AssessmentStatus.INSUFFICIENT_EVIDENCE,
            assessment_confidence=None,
            provenance=prov,
        )
        self.assertIsNone(res.score)
        self.assertEqual(res.grade, "NO_DATA")
        self.assertEqual(res.status, AssessmentStatus.INSUFFICIENT_EVIDENCE)
        self.assertIsNone(res.assessment_confidence)

        # Legacy dict export also preserves score=None and grade="NO_DATA"
        leg = res.to_legacy_dict()
        self.assertIsNone(leg["score"])
        self.assertEqual(leg["grade"], "NO_DATA")
        self.assertEqual(leg["status"], AssessmentStatus.INSUFFICIENT_EVIDENCE.value)

    def test_no_runtime_import_of_action_metric_item(self) -> None:
        """Audit: pipeline.assessment_engine must not import ActionMetricItem at top-level."""
        import pipeline.assessment_engine as ae
        self.assertNotIn(
            "ActionMetricItem", ae.__dict__,
            "P1 Finding: pipeline.assessment_engine contains top-level import of legacy ActionMetricItem. Use duck-typing."
        )

    def test_assessment_provenance_deterministic_equality(self) -> None:
        """Audit: AssessmentProvenance has deterministic equality and does NOT include timestamps."""
        p1 = AssessmentProvenance(
            evaluator_id="default_punch_evaluator",
            evaluator_version="1.0.0",
            rubric_id="rubric_punch_v3",
            rubric_version="3.0.0",
            rubric_status="VALIDATED",
            evidence_keys_used=("crit_punch_extension", "crit_punch_speed"),
            is_discipline_specific=False,
        )
        p2 = AssessmentProvenance(
            evaluator_id="default_punch_evaluator",
            evaluator_version="1.0.0",
            rubric_id="rubric_punch_v3",
            rubric_version="3.0.0",
            rubric_status="VALIDATED",
            evidence_keys_used=("crit_punch_extension", "crit_punch_speed"),
            is_discipline_specific=False,
        )
        self.assertEqual(p1, p2)
        self.assertEqual(hash(p1), hash(p2))

        # Check that no timestamp field exists
        self.assertNotIn("timestamp", p1.__dataclass_fields__)
        self.assertNotIn("evaluation_timestamp", p1.__dataclass_fields__)
        self.assertNotIn("timestamp", p1.to_dict())

    def test_task5_immutability_and_zero_input_mutation(self) -> None:
        """Audit: All Task 5 DTOs enforce strict immutability and zero input mutation."""
        prov = AssessmentProvenance(
            evaluator_id="default_punch_evaluator",
            evaluator_version="1.0.0",
            rubric_id="rubric_punch_v3",
            rubric_version="3.0.0",
            rubric_status="VALIDATED",
            is_discipline_specific=False,
        )

        with self.assertRaises(FrozenInstanceError):
            prov.evaluator_id = "modified_id"  # type: ignore

        input_criteria = [{"criterionId": "crit_punch_extension", "score": 85, "status": "passed"}]
        input_findings = [{"id": "finding_1", "title": "Good extension"}]
        input_metrics = {"maxElbowAngle": 155.0}

        criteria_copy = copy.deepcopy(input_criteria)
        findings_copy = copy.deepcopy(input_findings)
        metrics_copy = copy.deepcopy(input_metrics)

        res = AssessmentResult(
            score=85,
            grade="GOOD",
            status=AssessmentStatus.GOOD,
            assessment_confidence=0.85,
            provenance=prov,
            criteria=input_criteria,
            findings=input_findings,
            metrics=input_metrics,
        )

        self.assertEqual(input_criteria, criteria_copy, "Input criteria list must not be mutated")
        self.assertEqual(input_findings, findings_copy, "Input findings list must not be mutated")
        self.assertEqual(input_metrics, metrics_copy, "Input metrics dict must not be mutated")

        self.assertIsInstance(res.criteria, tuple)
        self.assertIsInstance(res.criteria[0], MappingProxyType)
        self.assertIsInstance(res.findings, tuple)
        self.assertIsInstance(res.findings[0], MappingProxyType)
        self.assertIsInstance(res.metrics, MappingProxyType)
        self.assertIsInstance(res.metrics["maxElbowAngle"], AssessmentMetricItem)

        with self.assertRaises(TypeError):
            res.metrics["maxElbowAngle"] = AssessmentMetricItem(value=160.0, unit="degree")  # type: ignore

        with self.assertRaises(TypeError):
            res.criteria[0]["score"] = 90  # type: ignore

        with self.assertRaises(FrozenInstanceError):
            res.score = 90  # type: ignore

    def test_assessment_metric_item_invariants(self) -> None:
        """Audit: AssessmentMetricItem rejects invalid confidence, NaN/Inf, and empty unit."""
        with self.assertRaises(ValueError):
            AssessmentMetricItem(value=float("nan"), unit="degree")
        with self.assertRaises(ValueError):
            AssessmentMetricItem(value=float("inf"), unit="degree")

        with self.assertRaises(ValueError):
            AssessmentMetricItem(value=10.0, unit="degree", confidence=1.5)
        with self.assertRaises(ValueError):
            AssessmentMetricItem(value=10.0, unit="degree", confidence=-0.1)

        with self.assertRaises(ValueError):
            AssessmentMetricItem(value=10.0, unit="")
        with self.assertRaises(ValueError):
            AssessmentMetricItem(value=10.0, unit="   ")

        with self.assertRaises(TypeError):
            AssessmentMetricItem(value=10.0, unit=123)  # type: ignore

    def test_task5_json_serialization_safe(self) -> None:
        """Audit: AssessmentResult.to_dict() produces valid, JSON-safe primitives without NaN/Inf."""
        prov = AssessmentProvenance(
            evaluator_id="default_punch_evaluator",
            evaluator_version="1.0.0",
            rubric_id="rubric_punch_v3",
            rubric_version="3.0.0",
            rubric_status="VALIDATED",
            is_discipline_specific=False,
        )
        res = AssessmentResult(
            score=88,
            grade="GOOD",
            status=AssessmentStatus.GOOD,
            assessment_confidence=0.82,
            provenance=prov,
            criteria=[{"criterionId": "crit_1", "score": 88}],
            findings=[{"id": "find_1", "title": "Solid punch"}],
            metrics={"maxElbowAngle": AssessmentMetricItem(value=150.5, unit="degree", confidence=0.88)},
        )
        d = res.to_dict()
        self.assertIsInstance(d, dict)
        serialized = json.dumps(d)
        self.assertTrue(len(serialized) > 0)
        parsed = json.loads(serialized)
        self.assertEqual(parsed["score"], 88)
        self.assertEqual(parsed["provenance"]["isDisciplineSpecific"], False)


# =============================================================================
# Task 6: Temporal Phase Segmentation & Contract Pack Adversarial Suite
# =============================================================================

class TestTask6TemporalPhasesAdversarial(unittest.TestCase):
    """
    Adversarial verification of Task 6 Temporal Phase Segmentation and Contracts.
    Audits:
    - Zero hardcoded confidence constants (0.92, 0.88, 0.85, 0.70) in boundary evidence.
    - Active propagation of PoseValidityConfig via TemporalPhaseConfig into landmark analysis.
    - Transitive immutability of TemporalPhaseConfig and mutation-isolation from PoseValidityConfig.
    - Strict bi-directional nullability coupling on PhaseBoundary.
    - Exact tolerance_ms formula = 0.5 * (1000.0 / fps) + 0.2 ms and frame/time consistency.
    - Cross-field impact_type invariants (punch -> peak_extension_proxy, kick -> max_extension_proxy).
    - Monotonic boundary ordering.
    - Deep immutability and zero input mutation.
    """

    def test_zero_hardcoded_confidence_floats(self) -> None:
        """
        Audit: Verify PhaseBoundary evidences do NOT contain hardcoded floats (0.92, 0.88, 0.85, 0.70).
        Confidence must be None or deterministically calculated from tracking data.
        """
        forbidden_hardcoded_floats = {0.92, 0.88, 0.85, 0.70}

        # 1. Nominal punch sequence
        punch_seq_data = generate_punch_sequence()
        punch_res = segment_punch_phases(
            window_start_frame=5,
            window_end_frame=20,
            fps=30.0,
            keypoints_trajectory=punch_seq_data,
            arm="right",
        )
        for name, b in punch_res.boundaries.items():
            self.assertNotIn(
                b.evidence.confidence,
                forbidden_hardcoded_floats,
                f"Punch boundary '{name}' contains forbidden hardcoded float {b.evidence.confidence}"
            )
            self.assertTrue(
                b.evidence.confidence is None or isinstance(b.evidence.confidence, float),
                f"Confidence must be None or float, got {type(b.evidence.confidence)}"
            )

        # 2. Nominal kick sequence
        kick_res = segment_kick_phases(
            window_start_frame=10,
            window_end_frame=30,
            fps=30.0,
        )
        for name, b in kick_res.boundaries.items():
            self.assertNotIn(
                b.evidence.confidence,
                forbidden_hardcoded_floats,
                f"Kick boundary '{name}' contains forbidden hardcoded float {b.evidence.confidence}"
            )
            self.assertTrue(
                b.evidence.confidence is None or isinstance(b.evidence.confidence, float),
                f"Confidence must be None or float, got {type(b.evidence.confidence)}"
            )

        # 3. Unified dispatcher extract_temporal_phases
        extracted_punch = extract_temporal_phases(
            action_family="punch",
            window_start_frame=5,
            window_end_frame=20,
            fps=30.0,
            keypoints_trajectory=punch_seq_data,
            arm="right",
        )
        for name, b in extracted_punch.boundaries.items():
            self.assertNotIn(
                b.evidence.confidence,
                forbidden_hardcoded_floats,
                f"Extracted punch boundary '{name}' contains forbidden hardcoded float {b.evidence.confidence}"
            )

        extracted_kick = extract_temporal_phases(
            action_family="kick",
            window_start_frame=5,
            window_end_frame=25,
            fps=30.0,
        )
        for name, b in extracted_kick.boundaries.items():
            self.assertNotIn(
                b.evidence.confidence,
                forbidden_hardcoded_floats,
                f"Extracted kick boundary '{name}' contains forbidden hardcoded float {b.evidence.confidence}"
            )

    def test_pose_validity_config_propagation(self) -> None:
        """
        Audit: Verify PoseValidityConfig is actively propagated via TemporalPhaseConfig into landmark analysis.
        Strict threshold must invalidate marginal landmarks and alter phase detection outcomes.
        """
        base_frames = generate_punch_sequence()

        marginal_conf_frames = []
        for frame in base_frames:
            marginal_conf_frames.append([Point(p.x, p.y, 0.30) for p in frame])

        cfg_lenient = TemporalPhaseConfig(
            pose_config=PoseValidityConfig(min_landmark_confidence=0.20)
        )
        res_lenient = segment_punch_phases(
            window_start_frame=5,
            window_end_frame=20,
            fps=30.0,
            keypoints_trajectory=marginal_conf_frames,
            arm="right",
            config=cfg_lenient,
        )
        self.assertTrue(
            res_lenient.is_complete,
            "Lenient config should accept 0.30 confidence landmarks and complete phase extraction"
        )
        self.assertEqual(len(res_lenient.anomalies), 0)

        cfg_strict = TemporalPhaseConfig(
            pose_config=PoseValidityConfig(min_landmark_confidence=0.50)
        )
        res_strict = segment_punch_phases(
            window_start_frame=5,
            window_end_frame=20,
            fps=30.0,
            keypoints_trajectory=marginal_conf_frames,
            arm="right",
            config=cfg_strict,
        )
        self.assertFalse(
            res_strict.is_complete,
            "Strict config should reject 0.30 confidence landmarks and fail complete phase extraction"
        )
        self.assertIn(
            "missing_peak_boundary",
            res_strict.anomalies,
            "Rejection of keypoints under strict PoseValidityConfig must produce missing_peak_boundary anomaly"
        )

    def test_temporal_phase_config_transitive_immutability(self) -> None:
        """Audit: TemporalPhaseConfig must enforce mutation isolation from PoseValidityConfig."""
        orig_pose_cfg = PoseValidityConfig(min_landmark_confidence=0.35, min_segment_length=0.02)
        phase_cfg = TemporalPhaseConfig(pose_config=orig_pose_cfg)

        # Mutate the original pose config externally
        orig_pose_cfg.min_landmark_confidence = 0.99
        orig_pose_cfg.min_segment_length = 0.50

        self.assertEqual(
            phase_cfg.pose_config.min_landmark_confidence, 0.35,
            "P1 Finding: TemporalPhaseConfig.pose_config mutated in-place; lacks defensive copy in __post_init__"
        )
        self.assertEqual(
            phase_cfg.pose_config.min_segment_length, 0.02,
            "P1 Finding: TemporalPhaseConfig.pose_config mutated in-place; lacks defensive copy in __post_init__"
        )

    def test_bi_directional_nullability_adversarial(self) -> None:
        """
        Audit: PhaseBoundary enforces strict bi-directional nullability coupling:
        - frame_idx is None iff time_ms is None
        - frame_idx is None iff evidence.level == EvidenceLevel.UNAVAILABLE
        """
        with self.assertRaises(ValueError) as ctx:
            PhaseBoundary(
                frame_idx=None,
                time_ms=100.0,
                evidence=PhaseEvidence(level=EvidenceLevel.UNAVAILABLE)
            )
        self.assertIn("Bi-directional nullability", str(ctx.exception))

        with self.assertRaises(ValueError) as ctx:
            PhaseBoundary(
                frame_idx=10,
                time_ms=None,
                evidence=PhaseEvidence(level=EvidenceLevel.DERIVED_PROXY)
            )
        self.assertIn("Bi-directional nullability", str(ctx.exception))

        with self.assertRaises(ValueError) as ctx:
            PhaseBoundary(
                frame_idx=None,
                time_ms=None,
                evidence=PhaseEvidence(level=EvidenceLevel.DERIVED_PROXY)
            )
        self.assertIn("Bi-directional nullability", str(ctx.exception))

        with self.assertRaises(ValueError) as ctx:
            PhaseBoundary(
                frame_idx=10,
                time_ms=333.3,
                evidence=PhaseEvidence(level=EvidenceLevel.UNAVAILABLE)
            )
        self.assertIn("Bi-directional nullability", str(ctx.exception))

        unavail = PhaseBoundary.unavailable(source_signal="unresolved_peak")
        self.assertIsNone(unavail.frame_idx)
        self.assertIsNone(unavail.time_ms)
        self.assertEqual(unavail.evidence.level, EvidenceLevel.UNAVAILABLE)
        self.assertEqual(unavail.evidence.source_signal, "unresolved_peak")

    def test_tolerance_ms_formula_and_strict_enforcement(self) -> None:
        """
        Audit: calculate_tolerance_ms(fps) = 0.5 * (1000.0 / fps) + 0.2 ms.
        TemporalPhaseSequence enforces abs(b.time_ms - expected_time_ms) <= tolerance_ms.
        Any deviation exceeding tolerance raises ValueError.
        """
        for fps in (24.0, 30.0, 60.0, 120.0):
            expected = 0.5 * (1000.0 / fps) + 0.2
            self.assertAlmostEqual(calculate_tolerance_ms(fps), expected, places=6)

        fps = 30.0
        frame_dur = 1000.0 / fps
        tol = calculate_tolerance_ms(fps)
        w_start_f = 10
        w_start_t = 333.3
        target_f = 20
        expected_t = w_start_t + (target_f - w_start_f) * frame_dur

        b_valid_pos = PhaseBoundary(
            frame_idx=target_f,
            time_ms=round(expected_t + tol - 0.05, 2),
            evidence=PhaseEvidence(level=EvidenceLevel.DERIVED_PROXY),
        )
        seq_valid = TemporalPhaseSequence(
            action_family="punch",
            impact_type="peak_extension_proxy",
            fps=fps,
            window_start_frame=w_start_f,
            window_end_frame=30,
            window_start_time_ms=w_start_t,
            window_end_time_ms=1000.0,
            boundaries=MappingProxyType({"peak": b_valid_pos}),
        )
        self.assertTrue(seq_valid.is_complete)

        b_invalid_pos = PhaseBoundary(
            frame_idx=target_f,
            time_ms=round(expected_t + tol + 0.10, 2),
            evidence=PhaseEvidence(level=EvidenceLevel.DERIVED_PROXY),
        )
        with self.assertRaises(ValueError) as ctx:
            TemporalPhaseSequence(
                action_family="punch",
                impact_type="peak_extension_proxy",
                fps=fps,
                window_start_frame=w_start_f,
                window_end_frame=30,
                window_start_time_ms=w_start_t,
                window_end_time_ms=1000.0,
                boundaries=MappingProxyType({"peak": b_invalid_pos}),
            )
        self.assertIn("Frame/time consistency violated", str(ctx.exception))

        b_invalid_neg = PhaseBoundary(
            frame_idx=target_f,
            time_ms=round(expected_t - tol - 0.10, 2),
            evidence=PhaseEvidence(level=EvidenceLevel.DERIVED_PROXY),
        )
        with self.assertRaises(ValueError) as ctx:
            TemporalPhaseSequence(
                action_family="punch",
                impact_type="peak_extension_proxy",
                fps=fps,
                window_start_frame=w_start_f,
                window_end_frame=30,
                window_start_time_ms=w_start_t,
                window_end_time_ms=1000.0,
                boundaries=MappingProxyType({"peak": b_invalid_neg}),
            )
        self.assertIn("Frame/time consistency violated", str(ctx.exception))

    def test_action_family_impact_type_cross_field_invariants(self) -> None:
        """Audit: Punch requires 'peak_extension_proxy'; Kick requires 'max_extension_proxy'."""
        fps = 30.0
        with self.assertRaises(ValueError) as ctx:
            TemporalPhaseSequence(
                action_family="punch",
                impact_type="max_extension_proxy",
                fps=fps,
                window_start_frame=0,
                window_end_frame=10,
                window_start_time_ms=0.0,
                window_end_time_ms=333.3,
            )
        self.assertIn("action_family 'punch' requires impact_type 'peak_extension_proxy'", str(ctx.exception))

        with self.assertRaises(ValueError) as ctx:
            TemporalPhaseSequence(
                action_family="kick",
                impact_type="peak_extension_proxy",
                fps=fps,
                window_start_frame=0,
                window_end_frame=10,
                window_start_time_ms=0.0,
                window_end_time_ms=333.3,
            )
        self.assertIn("action_family 'kick' requires impact_type 'max_extension_proxy'", str(ctx.exception))

        with self.assertRaises(ValueError) as ctx:
            TemporalPhaseSequence(
                action_family="elbow_strike",
                impact_type="peak_extension_proxy",
                fps=fps,
                window_start_frame=0,
                window_end_frame=10,
                window_start_time_ms=0.0,
                window_end_time_ms=333.3,
            )
        self.assertIn("Unsupported action_family", str(ctx.exception))

    def test_monotonic_boundary_ordering_adversarial(self) -> None:
        """Audit: Monotonic ordering among sequential canonical boundaries is strictly enforced."""
        fps = 30.0
        frame_dur = 1000.0 / fps

        b_launch = PhaseBoundary(
            frame_idx=15,
            time_ms=15 * frame_dur,
            evidence=PhaseEvidence(level=EvidenceLevel.DERIVED_PROXY)
        )
        b_peak_inverted = PhaseBoundary(
            frame_idx=12,
            time_ms=12 * frame_dur,
            evidence=PhaseEvidence(level=EvidenceLevel.DERIVED_PROXY)
        )

        with self.assertRaises(ValueError) as ctx:
            TemporalPhaseSequence(
                action_family="punch",
                impact_type="peak_extension_proxy",
                fps=fps,
                window_start_frame=10,
                window_end_frame=30,
                window_start_time_ms=10 * frame_dur,
                window_end_time_ms=30 * frame_dur,
                boundaries=MappingProxyType({
                    "launch": b_launch,
                    "peak": b_peak_inverted,
                })
            )
        self.assertIn("Monotonic frame ordering violated", str(ctx.exception))

    def test_task6_immutability_and_zero_mutation(self) -> None:
        """Audit: Task 6 models enforce frozen immutability and zero input mutation."""
        ev = PhaseEvidence(level=EvidenceLevel.DERIVED_PROXY, confidence=None)
        b = PhaseBoundary(frame_idx=10, time_ms=333.3, evidence=ev)

        with self.assertRaises(FrozenInstanceError):
            b.frame_idx = 11  # type: ignore

        with self.assertRaises(FrozenInstanceError):
            ev.confidence = 0.95  # type: ignore

        raw_boundaries = {"peak": b}
        raw_boundaries_copy = dict(raw_boundaries)

        seq = TemporalPhaseSequence(
            action_family="punch",
            impact_type="peak_extension_proxy",
            fps=30.0,
            window_start_frame=0,
            window_end_frame=20,
            window_start_time_ms=0.0,
            window_end_time_ms=666.7,
            boundaries=raw_boundaries,
            anomalies=["test_anomaly"],
        )

        self.assertEqual(raw_boundaries, raw_boundaries_copy)
        self.assertIsInstance(raw_boundaries, dict)

        self.assertIsInstance(seq.boundaries, MappingProxyType)
        self.assertIsInstance(seq.anomalies, tuple)

        with self.assertRaises(TypeError):
            seq.boundaries["peak"] = PhaseBoundary.unavailable()  # type: ignore

        with self.assertRaises(FrozenInstanceError):
            seq.fps = 60.0  # type: ignore

    def test_task6_json_serialization_safe(self) -> None:
        """Audit: TemporalPhaseSequence.to_dict() produces valid JSON without NaN or Inf."""
        seq = segment_punch_phases(
            window_start_frame=5,
            window_end_frame=20,
            fps=30.0,
            keypoints_trajectory=generate_punch_sequence(),
            arm="right",
        )
        d = seq.to_dict()
        self.assertIsInstance(d, dict)
        self.assertEqual(d["actionFamily"], "punch")
        self.assertEqual(d["impactType"], "peak_extension_proxy")
        self.assertIn("boundaries", d)
        self.assertIn("preparation", d["boundaries"])
        self.assertIn("peak", d["boundaries"])

        serialized = json.dumps(d)
        self.assertTrue(len(serialized) > 0)
        parsed = json.loads(serialized)
        self.assertEqual(parsed["isComplete"], True)


# =============================================================================
# Wave 2 Guarded Suites: Kinematics, Shadow Classifier, Deep Freeze
# =============================================================================

class TestCanonicalDeepFreezeAndSerializationAdversarial(unittest.TestCase):
    """
    Adversarial verification of canonical deep_freeze and to_json_safe utilities.
    Guarded by CANONICAL_FREEZE_AVAILABLE pending Wave 2 serialization module export.
    """

    @classmethod
    def setUpClass(cls) -> None:
        if not CANONICAL_FREEZE_AVAILABLE:
            raise unittest.SkipTest("Canonical deep_freeze/to_json_safe not yet exported in pipeline")

    def test_mapping_non_string_keys_rejected(self) -> None:
        """Non-string keys in mappings must raise TypeError."""
        for bad_key in (1, 2.5, True, False, None, (1, 2), object()):
            with self.subTest(bad_key=bad_key):
                with self.assertRaises(TypeError) as ctx:
                    deep_freeze({bad_key: "value"})
                self.assertIn("Mapping keys must be strings", str(ctx.exception))

    def test_set_and_frozenset_rejected_from_analysis_payloads(self) -> None:
        """set and frozenset must be rejected with explicit guidance to use tuple."""
        with self.assertRaises(TypeError) as ctx:
            deep_freeze({1, 2, 3})
        self.assertIn("are rejected from analysis payloads; use tuple", str(ctx.exception))

        with self.assertRaises(TypeError) as ctx:
            deep_freeze(frozenset([1, 2]))
        self.assertIn("are rejected from analysis payloads; use tuple", str(ctx.exception))

    def test_scalar_and_bytes_handling_in_deep_freeze(self) -> None:
        """Finite floats preserved; NaN/Inf raise ValueError; bytes raise TypeError."""
        self.assertEqual(deep_freeze(3.14), 3.14)
        with self.assertRaises(ValueError):
            deep_freeze(float("nan"))
        with self.assertRaises(ValueError):
            deep_freeze(float("inf"))
        with self.assertRaises(TypeError):
            deep_freeze(b"bytes_payload")

    def test_to_json_safe_primitives_and_collections(self) -> None:
        """to_json_safe converts MappingProxy to dict, tuple to list, Enums to scalar, NaN/Inf to None."""
        proxy = MappingProxyType({"a": 1, "b": (2, 3)})
        safe = to_json_safe(proxy)
        self.assertIsInstance(safe, dict)
        self.assertIsInstance(safe["b"], list)
        self.assertIsNone(to_json_safe(float("nan")))
        self.assertIsNone(to_json_safe(float("inf")))
        with self.assertRaises(TypeError):
            to_json_safe(b"raw_bytes")


class TestKinematicMetricContractAdversarial(unittest.TestCase):
    """
    Adversarial verification of Task 7 KinematicMetricContract invariants.
    Guarded by WAVE2_KINEMATICS pending Wave 2 authorization.
    """

    @classmethod
    def setUpClass(cls) -> None:
        if not WAVE2_KINEMATICS:
            reason = f"Wave 2 pending: pipeline.kinematic_features ({WAVE2_KINEMATICS_ERROR})" if WAVE2_KINEMATICS_ERROR else "Wave 2 pending: pipeline.kinematic_features"
            raise unittest.SkipTest(reason)

    def test_unmeasurable_metric_null_invariants(self) -> None:
        """When value is None, confidence, frames_used, time_window_ms must be None, and evidence_quality='INSUFFICIENT'."""
        metric = KinematicMetricContract(
            name="pelvis_rotation_deg",
            value=None,
            unit="degree",
        )
        self.assertIsNone(metric.value)
        self.assertIsNone(metric.confidence)
        self.assertEqual(metric.evidence_level, EvidenceLevel.UNAVAILABLE)
        self.assertEqual(metric.evidence_quality, "INSUFFICIENT")
        self.assertIsNone(metric.frames_used)
        self.assertIsNone(metric.time_window_ms)

        with self.assertRaises(ValueError):
            KinematicMetricContract(name="m", value=None, unit="deg", confidence=0.8)

    def test_measurable_metric_invariants(self) -> None:
        """When value is not None, value must be finite, frames_used non-empty, time_window_ms defined."""
        with self.assertRaises(ValueError):
            KinematicMetricContract(
                name="m", value=float("nan"), unit="deg",
                evidence_level=EvidenceLevel.DERIVED_PROXY, evidence_quality="GOOD",
                frames_used=(1,), time_window_ms=(0.0, 33.3)
            )

        with self.assertRaises(ValueError):
            KinematicMetricContract(
                name="m", value=10.0, unit="deg",
                evidence_level=EvidenceLevel.DERIVED_PROXY, evidence_quality="GOOD",
                frames_used=(), time_window_ms=(0.0, 33.3)
            )

    def test_kinematic_features_nan_inf_inputs(self) -> None:
        """Adversarial: Kinematic feature extraction rejects NaN/Inf inputs or returns unavailable evidence."""
        if extract_kinematic_features is not None:
            nan_frames = [
                SyntheticPoseFrame(frame_idx=0, time_ms=0.0, landmarks={KP.RIGHT_WRIST: Point(float("nan"), 0.5, 0.9)}),
                SyntheticPoseFrame(frame_idx=1, time_ms=33.3, landmarks={KP.RIGHT_WRIST: Point(0.6, float("inf"), 0.9)}),
            ]
            features = extract_kinematic_features(nan_frames, action_family="punch")
            for name, metric in features.metrics.items():
                if metric.value is not None:
                    self.assertTrue(math.isfinite(metric.value), f"Metric {name} must be finite or None")
                else:
                    self.assertEqual(metric.evidence_level, EvidenceLevel.UNAVAILABLE)

    def test_kinematic_features_zero_duration_and_single_frame(self) -> None:
        """Adversarial: Zero duration and single-frame inputs do not raise ZeroDivisionError."""
        if extract_kinematic_features is not None:
            single_frame = [
                SyntheticPoseFrame(frame_idx=0, time_ms=0.0, landmarks={
                    KP.RIGHT_SHOULDER: Point(0.2, 0.5, 0.9),
                    KP.RIGHT_ELBOW: Point(0.4, 0.5, 0.9),
                    KP.RIGHT_WRIST: Point(0.6, 0.5, 0.9),
                })
            ]
            features = extract_kinematic_features(single_frame, action_family="punch")
            self.assertIsNotNone(features)
            for name, metric in features.metrics.items():
                if metric.value is not None:
                    self.assertTrue(math.isfinite(metric.value))

    def test_kinematic_features_degenerate_trajectories(self) -> None:
        """Adversarial: Degenerate collinear / stationary trajectories are handled safely."""
        if extract_kinematic_features is not None:
            stationary_frames = [
                SyntheticPoseFrame(frame_idx=i, time_ms=i * 33.3, landmarks={
                    KP.RIGHT_SHOULDER: Point(0.2, 0.5, 0.9),
                    KP.RIGHT_ELBOW: Point(0.4, 0.5, 0.9),
                    KP.RIGHT_WRIST: Point(0.6, 0.5, 0.9),
                })
                for i in range(5)
            ]
            features = extract_kinematic_features(stationary_frames, action_family="punch")
            self.assertIsNotNone(features)


class TestShadowClassifierContractAdversarial(unittest.TestCase):
    """
    Adversarial verification of Task 8 Shadow Classifier serialization, boundary thresholds, and evidenceLevel.
    Guarded by WAVE2_CLASSIFIER pending Wave 2 authorization.
    """

    @classmethod
    def setUpClass(cls) -> None:
        if not WAVE2_CLASSIFIER:
            raise unittest.SkipTest("Wave 2 pending: pipeline.shadow_classifier")

    def test_complete_provenance_serialized(self) -> None:
        """Decision must serialize classifierId, classifierVersion, configVersion, featureVersion, stanceSource."""
        prov = ClassifierProvenance(
            classifier_id="shadow_jab_cross_mvp",
            classifier_version="1.0.0",
            config_version="1.0.0",
            feature_version="1.0.0",
            stance_source="stance_context",
        )
        cand = TechniqueCandidate(
            technique="jab", family="punch", attacking_side="left", limb_role="lead", stance="orthodox"
        )
        dec = ClassificationDecision(
            status=DecisionStatus.CLASSIFIED,
            candidate=cand,
            reason_codes=("LEAD_STRAIGHT_PUNCH",),
            provenance=prov,
            confidence=None,
            evidence_level=EvidenceLevel.DERIVED_PROXY,
        )
        d = dec.to_dict()
        for k in ["classifierId", "classifierVersion", "configVersion", "featureVersion", "stanceSource"]:
            self.assertIn(k, d)
        self.assertEqual(d["evidenceLevel"], "derived_proxy")

    def test_case_a_missing_evidence_serializes_unavailable(self) -> None:
        """Case A: Decision abstaining due to missing evidence serializes evidenceLevel='unavailable' and candidate=None."""
        dec = ClassificationDecision(
            status=DecisionStatus.ABSTAINED,
            candidate=None,
            reason_codes=("INSUFFICIENT_EVIDENCE",),
            provenance=ClassifierProvenance(),
            confidence=None,
            evidence_level=EvidenceLevel.UNAVAILABLE,
        )
        d = dec.to_dict()
        self.assertEqual(d["status"], "abstained")
        self.assertIsNone(d["candidate"])
        self.assertEqual(d["evidenceLevel"], "unavailable")

    def test_case_c_classified_candidate_never_observed(self) -> None:
        """Case C: Classified punch candidate serializes evidenceLevel='derived_proxy' and NEVER 'observed'."""
        cand = TechniqueCandidate(
            technique="cross", family="punch", attacking_side="right", limb_role="rear", stance="orthodox"
        )
        dec = ClassificationDecision(
            status=DecisionStatus.CLASSIFIED,
            candidate=cand,
            reason_codes=("REAR_STRAIGHT_PUNCH",),
            provenance=ClassifierProvenance(),
            confidence=None,
            evidence_level=EvidenceLevel.DERIVED_PROXY,
        )
        d = dec.to_dict()
        self.assertEqual(d["evidenceLevel"], "derived_proxy")
        self.assertNotEqual(d["evidenceLevel"], "observed", "Kinematic proxy strikes must never be marked OBSERVED")

    def test_switch_stance_abstains_with_unresolved_stance(self) -> None:
        """Adversarial: Switch stance must abstain with UNRESOLVED_STANCE_OR_LIMB, candidate=None, derived_proxy."""
        if ShadowClassifier is not None:
            classifier = ShadowClassifier()
            switch_ctx = StanceContext(
                requested_stance="switch",
                resolved_stance="switch",
                source=StanceSource.COACH_DECLARED.value,
                is_authoritative=True,
            )
            features = MockPunchFeatures(
                arm="left",
                elbow_extension_deg=165.0,
                trajectory_directness=0.92,
                tangential_curvature=0.08,
                reach_ratio=0.85,
            )
            dec = classifier.classify(features, switch_ctx)
            self.assertEqual(dec.status, DecisionStatus.ABSTAINED)
            self.assertIsNone(dec.candidate)
            self.assertEqual(dec.evidence_level, EvidenceLevel.DERIVED_PROXY)
            self.assertIn("UNRESOLVED_STANCE_OR_LIMB", dec.reason_codes)

    def test_unknown_arm_abstains_with_unresolved_limb(self) -> None:
        """Adversarial: Missing or unknown arm must abstain with UNRESOLVED_STANCE_OR_LIMB."""
        if ShadowClassifier is not None:
            classifier = ShadowClassifier()
            orth_ctx = StanceContext(
                requested_stance="orthodox",
                resolved_stance="orthodox",
                source=StanceSource.COACH_DECLARED.value,
                is_authoritative=True,
            )
            for bad_arm in [None, "unknown", "none"]:
                features = MockPunchFeatures(
                    arm=bad_arm,
                    elbow_extension_deg=165.0,
                    trajectory_directness=0.92,
                    tangential_curvature=0.08,
                    reach_ratio=0.85,
                )
                dec = classifier.classify(features, orth_ctx)
                self.assertEqual(dec.status, DecisionStatus.ABSTAINED)
                self.assertIsNone(dec.candidate)
                self.assertEqual(dec.evidence_level, EvidenceLevel.DERIVED_PROXY)
                self.assertIn("UNRESOLVED_STANCE_OR_LIMB", dec.reason_codes)

    def test_boundary_thresholds_exactness(self) -> None:
        """Adversarial: Boundary thresholds are strictly evaluated (0.820 vs 0.819 directness, 140.0 vs 139.9 extension)."""
        if ShadowClassifier is not None:
            classifier = ShadowClassifier()
            orth_ctx = StanceContext(
                requested_stance="orthodox",
                resolved_stance="orthodox",
                source=StanceSource.COACH_DECLARED.value,
                is_authoritative=True,
            )

            # Directness boundary: 0.820 passes (classified), 0.819 fails (rejected candidate)
            f_pass_dir = MockPunchFeatures(
                arm="left", elbow_extension_deg=150.0, trajectory_directness=0.820,
                tangential_curvature=0.15, reach_ratio=0.75,
            )
            dec_pass = classifier.classify(f_pass_dir, orth_ctx)
            self.assertEqual(dec_pass.status, DecisionStatus.CLASSIFIED)

            f_fail_dir = MockPunchFeatures(
                arm="left", elbow_extension_deg=150.0, trajectory_directness=0.819,
                tangential_curvature=0.15, reach_ratio=0.75,
            )
            dec_fail = classifier.classify(f_fail_dir, orth_ctx)
            self.assertEqual(dec_fail.status, DecisionStatus.REJECTED_CANDIDATE)

            # Elbow extension boundary: 140.0 deg passes, 139.9 deg fails
            f_pass_ext = MockPunchFeatures(
                arm="left", elbow_extension_deg=140.0, trajectory_directness=0.90,
                tangential_curvature=0.10, reach_ratio=0.75,
            )
            self.assertEqual(classifier.classify(f_pass_ext, orth_ctx).status, DecisionStatus.CLASSIFIED)

            f_fail_ext = MockPunchFeatures(
                arm="left", elbow_extension_deg=139.9, trajectory_directness=0.90,
                tangential_curvature=0.10, reach_ratio=0.75,
            )
            self.assertEqual(classifier.classify(f_fail_ext, orth_ctx).status, DecisionStatus.REJECTED_CANDIDATE)

    def test_curved_hook_rejection(self) -> None:
        """Adversarial: Curved trajectory / high curvature is rejected and never classified as jab or cross."""
        if ShadowClassifier is not None:
            classifier = ShadowClassifier()
            orth_ctx = StanceContext(
                requested_stance="orthodox",
                resolved_stance="orthodox",
                source=StanceSource.COACH_DECLARED.value,
                is_authoritative=True,
            )
            # High tangential curvature (0.35 > 0.20 max)
            features = MockPunchFeatures(
                arm="left",
                elbow_extension_deg=160.0,
                trajectory_directness=0.85,
                tangential_curvature=0.35,
                reach_ratio=0.80,
            )
            dec = classifier.classify(features, orth_ctx)
            self.assertEqual(dec.status, DecisionStatus.REJECTED_CANDIDATE)
            self.assertIsNone(dec.candidate)
            self.assertEqual(dec.evidence_level, EvidenceLevel.DERIVED_PROXY)
            self.assertTrue(
                any("CURVATURE" in rc or "CURVED" in rc for rc in dec.reason_codes),
                f"Expected curvature rejection reason code, got: {dec.reason_codes}"
            )

    def test_zod_schema_field_parity(self) -> None:
        """Adversarial: Exact field-for-field parity with TypeScript Zod shadowClassificationSchema."""
        cand = TechniqueCandidate(
            technique="jab", family="punch", attacking_side="left", limb_role="lead", stance="orthodox"
        )
        prov = ClassifierProvenance(
            classifier_id="shadow_jab_cross_mvp",
            classifier_version="1.0.0",
            config_version="1.0.0",
            feature_version="1.0.0",
            stance_source="stance_context",
        )
        dec = ClassificationDecision(
            status=DecisionStatus.CLASSIFIED,
            candidate=cand,
            reason_codes=("LEAD_JAB",),
            provenance=prov,
            confidence=None,
            evidence_level=EvidenceLevel.DERIVED_PROXY,
        )
        d = dec.to_dict()
        expected_keys = {
            "status", "candidate", "confidence", "reasonCodes",
            "classifierId", "classifierVersion", "configVersion",
            "featureVersion", "stanceSource", "evidenceLevel",
        }
        self.assertEqual(set(d.keys()), expected_keys)
        expected_cand_keys = {"technique", "family", "attackingSide", "limbRole", "stance"}
        self.assertEqual(set(d["candidate"].keys()), expected_cand_keys)

    def test_shadow_classifier_arbitrary_unsupported_input_abstention(self) -> None:
        """Adversarial: Unsupported arbitrary objects passed to ShadowClassifier abstain safely without raising AttributeError."""
        sc = ShadowClassifier()
        arbitrary_inputs = [
            object(),
            "unsupported_string",
            12345,
            3.14159,
            [],
            [1, 2, 3],
            {"unexpected_key": "unexpected_value"},
            type("DummyPayload", (), {"arbitrary_attr": 42})(),
        ]
        for inp in arbitrary_inputs:
            with self.subTest(inp_type=type(inp).__name__):
                decision = sc.classify(inp, None)
                self.assertIsInstance(decision, ClassificationDecision)
                self.assertEqual(decision.status, DecisionStatus.ABSTAINED)
                self.assertIsNone(decision.candidate)
                self.assertIn("INSUFFICIENT_EVIDENCE", decision.reason_codes)
                self.assertEqual(decision.evidence_level.value, "unavailable")
                self.assertIsNone(decision.confidence)


class TestWave3IntegrationContractAdversarial(unittest.TestCase):
    """
    Wave 3 Central Integration Adversarial Test Suite:
    - Verifies enum identity for EvidenceLevel across pipeline packages.
    - Verifies ActionResult top-level shadowClassification contract and score=None preservation.
    """

    def test_canonical_evidence_level_identities(self) -> None:
        """Contract: Verify all pipeline modules share exact CanonicalEvidenceLevel identity."""
        from pipeline.temporal_phases import EvidenceLevel as PhaseEvidenceLevel
        from pipeline.kinematic_features import EvidenceLevel as KinematicEvidenceLevel
        from pipeline.shadow_classifier import EvidenceLevel as ClassifierEvidenceLevel
        from pipeline.contracts import EvidenceLevel as CanonicalEvidenceLevel

        self.assertIs(
            PhaseEvidenceLevel, CanonicalEvidenceLevel,
            "temporal_phases.EvidenceLevel must be identical object to contracts.EvidenceLevel"
        )
        self.assertIs(
            KinematicEvidenceLevel, CanonicalEvidenceLevel,
            "kinematic_features.EvidenceLevel must be identical object to contracts.EvidenceLevel"
        )
        self.assertIs(
            ClassifierEvidenceLevel, CanonicalEvidenceLevel,
            "shadow_classifier.EvidenceLevel must be identical object to contracts.EvidenceLevel"
        )

    def test_integrated_action_result_shadow_classification_and_score_none(self) -> None:
        """Adversarial / Wave 3: Verify ActionResult.to_dict() has top-level shadowClassification (when executed) and preserves score=None."""
        import dataclasses
        from action_result import (
            ActionResult,
            ActionConfidence,
            ActionPhases,
            ActionAssessment,
            ActionReview,
            ReviewStatus,
        )

        conf = ActionConfidence(detection=None, classification=None, assessment=None)
        phases = ActionPhases(startFrame=0, impactFrame=5, endFrame=10)
        assessment = ActionAssessment(
            rubricId="rubric_punch_v3",
            score=None,
            grade="NO_DATA",
            status="insufficient_evidence",
        )
        review = ActionReview(status=ReviewStatus.AI_GENERATED.value)

        # 1. Verify field existence in ActionResult dataclass
        field_names = {f.name for f in dataclasses.fields(ActionResult)}
        self.assertIn(
            "shadowClassification",
            field_names,
            "P1 Blocker: ActionResult dataclass missing optional top-level 'shadowClassification' field (Wave 3 contract parity)."
        )

        dummy_shadow = {
            "status": "classified",
            "candidate": {
                "technique": "jab",
                "family": "punch",
                "attackingSide": "left",
                "limbRole": "lead",
                "stance": "orthodox",
            },
            "confidence": None,
            "reasonCodes": ["LEAD_JAB"],
            "classifierId": "shadow_jab_cross_classifier",
            "classifierVersion": "1.0.0",
            "configVersion": "1.0.0",
            "featureVersion": "1.0.0",
            "stanceSource": "stance_context",
            "evidenceLevel": "derived_proxy",
        }

        # 2. Verify construction and to_dict() serialization when executed
        action_with_shadow = ActionResult(
            id="act_001",
            sourceActionId="punch_1",
            family="punch",
            technique="jab",
            attackingSide="left",
            limbRole="lead",
            stance="orthodox",
            confidence=conf,
            phases=phases,
            metrics={},
            assessment=assessment,
            review=review,
            shadowClassification=dummy_shadow,
        )
        d_shadow = action_with_shadow.to_dict()
        self.assertIn("shadowClassification", d_shadow)
        self.assertEqual(d_shadow["shadowClassification"], dummy_shadow)

        # 3. Verify score=None preservation under insufficient evidence
        self.assertIsNone(d_shadow["assessment"]["score"])
        self.assertEqual(d_shadow["assessment"]["grade"], "NO_DATA")
        self.assertEqual(d_shadow["assessment"]["status"], "insufficient_evidence")

        # 4. Verify backward compatibility when shadowClassification is None or omitted
        action_without_shadow = ActionResult(
            id="act_002",
            sourceActionId="kick_1",
            family="kick",
            technique="round_kick",
            attackingSide="right",
            limbRole="rear",
            stance="orthodox",
            confidence=conf,
            phases=phases,
            metrics={},
            assessment=assessment,
            review=review,
            shadowClassification=None,
        )
        d_no_shadow = action_without_shadow.to_dict()
        self.assertIsNone(d_no_shadow.get("shadowClassification"))
        self.assertIsNone(d_no_shadow["assessment"]["score"])


if __name__ == "__main__":
    unittest.main()

