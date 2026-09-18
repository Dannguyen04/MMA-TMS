"""
test_assessment_engine.py — Comprehensive Unit Tests for Assessment Engine (Task 5)

Kiểm tra toàn diện 8 nhóm yêu cầu bắt buộc:
1. Evaluator resolution theo context (generic, boxing, kickboxing, version request).
2. Unsupported / unknown discipline (unknown reject, muay_thai/karate reject, cross-discipline reject).
3. Invalid version / type không làm crash bằng lỗi nội bộ khó hiểu.
4. Governance / Deprecated rubric policy rõ ràng (DRAFT with allow_draft, DEPRECATED with allow_deprecated_for_replay).
5. Provenance đúng và không bị gắn giả (deterministic, no timestamp in hash/eq, is_discipline_specific flag).
6. Insufficient evidence handling (score=None, grade='NO_DATA', status=INSUFFICIENT_EVIDENCE, confidence=None).
7. Immutability & Zero Input Mutation (MappingProxyType, tuple, FrozenInstanceError, input untouched).
8. Legacy-equivalence fixtures (punch và kick thực tế, to_legacy_dict tương thích 100%).
"""

from __future__ import annotations

from dataclasses import FrozenInstanceError
import math
from types import MappingProxyType
import unittest

from rubric_primitives import (
    MartialArt,
    SemVer,
)
from pipeline.analysis_context import AnalysisContext
from pipeline.rubric_registry import (
    RubricRegistry,
    RubricSelectionResult,
    RubricSelectionStatus,
)
from technique_rubric import (
    CriterionResult,
    CriterionStatus,
    TechniqueCriterion,
    TechniqueFinding,
    TechniqueRubric,
    RUBRIC_PUNCH_V3,
    RUBRIC_ROUND_KICK_V3,
)
from action_result import ActionMetricItem
from pipeline.assessment_engine import (
    AssessmentEngine,
    AssessmentError,
    AssessmentInput,
    AssessmentMetricItem,
    AssessmentProvenance,
    AssessmentResult,
    AssessmentStatus,
    DefaultKickEvaluator,
    DefaultPunchEvaluator,
    EvaluatorRegistry,
    EvaluatorResolutionError,
    MetricItemLike,
    RubricResolutionError,
    compute_derived_rubric_confidence,
    calculate_score_and_grade,
    create_assessment_rubric_registry,
    create_default_evaluator_registry,
    deep_freeze,
    deep_unfreeze,
    evaluate_action,
    get_assessment_rubric_registry,
    get_default_assessment_engine,
    resolve_evaluator,
    to_assessment_metric,
)


class MockPunchResult:
    """Mock object tương thích với PunchResult từ punch_analyzer.py."""
    def __init__(
        self,
        punch_type: str = "Cross",
        arm: str = "right",
        score: int = 88,
        grade: str = "GOOD",
        max_elbow_angle: float = 152.4,
        peak_speed: float = 1.35,
        guard_preserved: bool = True,
        criterion_results: list | None = None,
        findings: list | None = None,
    ) -> None:
        self.punch_type = punch_type
        self.arm = arm
        self.score = score
        self.grade = grade
        self.max_elbow_angle = max_elbow_angle
        self.peak_speed = peak_speed
        self.guard_preserved = guard_preserved
        self.criterion_results = criterion_results or []
        self.findings = findings or []


class MockKickResult:
    """Mock object tương thích với KickResult từ kick_analyzer.py."""
    def __init__(
        self,
        kick_type: str = "round_kick",
        leg: str = "right",
        score: int = 82,
        grade: str = "GOOD",
        min_chamber_angle: float = 48.5,
        max_extension_angle: float = 162.0,
        peak_speed: float = 1.42,
        hip_angle: float = 145.2,
        criterion_results: list | None = None,
        findings: list | None = None,
    ) -> None:
        self.kick_type = kick_type
        self.leg = leg
        self.score = score
        self.grade = grade
        self.min_chamber_angle = min_chamber_angle
        self.max_extension_angle = max_extension_angle
        self.peak_speed = peak_speed
        self.hip_angle = hip_angle
        self.criterion_results = criterion_results or []
        self.findings = findings or []


def create_sample_punch_criteria(sufficient: bool = True) -> list[CriterionResult]:
    if not sufficient:
        return [
            CriterionResult(
                criterion_id="crit_punch_extension",
                criterion_name="Arm Extension",
                phase="impact",
                feature_name="max_elbow_angle",
                observed_value=0.0,
                score=0.0,
                weight=0.40,
                confidence=0.0,
                status=CriterionStatus.INSUFFICIENT_EVIDENCE.value,
                evidence_frame_start=0,
                evidence_frame_end=0,
                evidence_timestamp_start_ms=0.0,
                evidence_timestamp_end_ms=0.0,
                affected_body_part="right_elbow",
                detail="Thiếu dữ liệu",
            ),
            CriterionResult(
                criterion_id="crit_punch_guard",
                criterion_name="Guard Protection",
                phase="impact",
                feature_name="guard_preserved",
                observed_value=0.0,
                score=0.0,
                weight=0.35,
                confidence=0.0,
                status=CriterionStatus.INSUFFICIENT_EVIDENCE.value,
                evidence_frame_start=0,
                evidence_frame_end=0,
                evidence_timestamp_start_ms=0.0,
                evidence_timestamp_end_ms=0.0,
                affected_body_part="left_wrist",
                detail="Thiếu dữ liệu",
            ),
            CriterionResult(
                criterion_id="crit_punch_speed",
                criterion_name="Striking Velocity",
                phase="impact",
                feature_name="peak_speed",
                observed_value=0.0,
                score=0.0,
                weight=0.25,
                confidence=0.0,
                status=CriterionStatus.INSUFFICIENT_EVIDENCE.value,
                evidence_frame_start=0,
                evidence_frame_end=0,
                evidence_timestamp_start_ms=0.0,
                evidence_timestamp_end_ms=0.0,
                affected_body_part="right_wrist",
                detail="Thiếu dữ liệu",
            ),
        ]

    return [
        CriterionResult(
            criterion_id="crit_punch_extension",
            criterion_name="Arm Extension",
            phase="impact",
            feature_name="max_elbow_angle",
            observed_value=152.4,
            score=95.0,
            weight=0.40,
            confidence=0.88,
            status=CriterionStatus.EXCELLENT.value,
            evidence_frame_start=10,
            evidence_frame_end=15,
            evidence_timestamp_start_ms=333.3,
            evidence_timestamp_end_ms=500.0,
            affected_body_part="right_elbow",
            detail="Duỗi tay chuẩn xác",
        ),
        CriterionResult(
            criterion_id="crit_punch_guard",
            criterion_name="Guard Protection",
            phase="impact",
            feature_name="guard_preserved",
            observed_value=1.0,
            score=90.0,
            weight=0.35,
            confidence=0.82,
            status=CriterionStatus.GOOD.value,
            evidence_frame_start=10,
            evidence_frame_end=15,
            evidence_timestamp_start_ms=333.3,
            evidence_timestamp_end_ms=500.0,
            affected_body_part="left_wrist",
            detail="Tay thủ che chắn tốt",
        ),
        CriterionResult(
            criterion_id="crit_punch_speed",
            criterion_name="Striking Velocity",
            phase="impact",
            feature_name="peak_speed",
            observed_value=1.35,
            score=85.0,
            weight=0.25,
            confidence=0.75,
            status=CriterionStatus.GOOD.value,
            evidence_frame_start=10,
            evidence_frame_end=15,
            evidence_timestamp_start_ms=333.3,
            evidence_timestamp_end_ms=500.0,
            affected_body_part="right_wrist",
            detail="Tốc độ ra đòn tốt",
        ),
    ]


# ─────────────────────────────────────────────────────────────────────────────
# Test Suites
# ─────────────────────────────────────────────────────────────────────────────

class TestAssessmentEngineContracts(unittest.TestCase):
    """Kiểm tra tính toàn vẹn và bất biến của các data contracts canonical."""

    def test_assessment_metric_item_immutability(self) -> None:
        item = AssessmentMetricItem(value=145.2, unit="degree", confidence=0.85)
        self.assertEqual(item.value, 145.2)
        self.assertEqual(item.unit, "degree")
        self.assertEqual(item.confidence, 0.85)

        with self.assertRaises(FrozenInstanceError):
            item.value = 160.0  # type: ignore

        with self.assertRaises(FrozenInstanceError):
            item.unit = "m/s"  # type: ignore

    def test_assessment_metric_item_validation(self) -> None:
        # Unit không thể rỗng hoặc sai kiểu
        with self.assertRaises(ValueError):
            AssessmentMetricItem(value=10.0, unit="")
        with self.assertRaises(TypeError):
            AssessmentMetricItem(value=10.0, unit=123)  # type: ignore

        # Confidence phải trong [0.0, 1.0]
        with self.assertRaises(ValueError):
            AssessmentMetricItem(value=10.0, unit="degree", confidence=1.5)
        with self.assertRaises(ValueError):
            AssessmentMetricItem(value=10.0, unit="degree", confidence=-0.1)
        with self.assertRaises(TypeError):
            AssessmentMetricItem(value=10.0, unit="degree", confidence="high")  # type: ignore

        # Value hợp lệ: None, int, float, str, bool
        item_none = AssessmentMetricItem(value=None, unit="degree")
        self.assertIsNone(item_none.value)
        item_int = AssessmentMetricItem(value=100, unit="ms")
        self.assertEqual(item_int.value, 100)
        item_float = AssessmentMetricItem(value=145.2, unit="degree")
        self.assertEqual(item_float.value, 145.2)
        item_str = AssessmentMetricItem(value="lead_jab", unit="flag")
        self.assertEqual(item_str.value, "lead_jab")
        item_bool = AssessmentMetricItem(value=True, unit="flag")
        self.assertEqual(item_bool.value, True)

        # Value không được là NaN hoặc Infinity
        with self.assertRaises(ValueError):
            AssessmentMetricItem(value=float("nan"), unit="degree")
        with self.assertRaises(ValueError):
            AssessmentMetricItem(value=float("inf"), unit="degree")
        with self.assertRaises(ValueError):
            AssessmentMetricItem(value=float("-inf"), unit="degree")

        # Value phải là scalar: từ chối list, dict, set, tuple, custom object
        with self.assertRaises(TypeError):
            AssessmentMetricItem(value=[1, 2, 3], unit="degree")  # type: ignore
        with self.assertRaises(TypeError):
            AssessmentMetricItem(value={"a": 1}, unit="degree")  # type: ignore
        with self.assertRaises(TypeError):
            AssessmentMetricItem(value=(1, 2), unit="degree")  # type: ignore
        with self.assertRaises(TypeError):
            AssessmentMetricItem(value={1, 2}, unit="degree")  # type: ignore
        with self.assertRaises(TypeError):
            AssessmentMetricItem(value=object(), unit="degree")  # type: ignore

    def test_to_assessment_metric_adapter(self) -> None:
        # Case 1: AssessmentMetricItem truyền vào
        item1 = AssessmentMetricItem(value=90.0, unit="degree", confidence=0.8)
        self.assertIs(to_assessment_metric(item1), item1)

        # Case 2: None -> value=None, confidence=None
        item_none = to_assessment_metric(None, default_unit="degree")
        self.assertIsNone(item_none.value)
        self.assertEqual(item_none.unit, "degree")
        self.assertIsNone(item_none.confidence)

        # Case 3: Primitive values (float, int, bool, str)
        item_float = to_assessment_metric(140.5, default_unit="degree", confidence=0.9)
        self.assertEqual(item_float.value, 140.5)
        self.assertEqual(item_float.confidence, 0.9)

        item_bool = to_assessment_metric(True, default_unit="flag", confidence=0.95)
        self.assertTrue(item_bool.value)
        self.assertEqual(item_bool.unit, "flag")

        # Case 4: Mapping / dict
        item_dict = to_assessment_metric({"value": 1.25, "unit": "normalized_image/s", "confidence": 0.7})
        self.assertEqual(item_dict.value, 1.25)
        self.assertEqual(item_dict.unit, "normalized_image/s")
        self.assertEqual(item_dict.confidence, 0.7)

        # Case 5: ActionMetricItem từ action_result (tương thích qua MetricItemLike)
        act_metric = ActionMetricItem(value=55.0, unit="degree", confidence=0.65)
        self.assertIsInstance(act_metric, MetricItemLike)
        item_act = to_assessment_metric(act_metric)
        self.assertEqual(item_act.value, 55.0)
        self.assertEqual(item_act.unit, "degree")
        self.assertEqual(item_act.confidence, 0.65)

        # Case 6: MetricItemLike Protocol tương thích duck-typing an toàn qua isinstance
        class MockActionMetric:
            def __init__(self, value, unit, confidence):
                self.value = value
                self.unit = unit
                self.confidence = confidence

        duck = MockActionMetric(55.0, "degree", 0.65)
        self.assertIsInstance(duck, MetricItemLike)
        item_duck = to_assessment_metric(duck)
        self.assertEqual(item_duck.value, 55.0)
        self.assertEqual(item_duck.unit, "degree")
        self.assertEqual(item_duck.confidence, 0.65)

        # Case 6b: Đối tượng không thoả mãn MetricItemLike bị từ chối bằng TypeError
        class NonMetric:
            def __init__(self, val):
                self.val = val

        with self.assertRaises(TypeError):
            to_assessment_metric(NonMetric(55.0))

        # Case 7: Invalid types (list, int collection)
        with self.assertRaises(TypeError):
            to_assessment_metric([1, 2, 3])

    def test_assessment_provenance_determinism_and_immutability(self) -> None:
        prov1 = AssessmentProvenance(
            evaluator_id="default_punch_evaluator",
            evaluator_version="1.0.0",
            rubric_id="rubric_punch_v3",
            rubric_version="3.0.0",
            rubric_status="VALIDATED",
            evidence_keys_used=["crit_punch_extension", "crit_punch_guard"],
            is_discipline_specific=False,
        )
        prov2 = AssessmentProvenance(
            evaluator_id="default_punch_evaluator",
            evaluator_version="1.0.0",
            rubric_id="rubric_punch_v3",
            rubric_version="3.0.0",
            rubric_status="VALIDATED",
            evidence_keys_used=("crit_punch_extension", "crit_punch_guard"),
            is_discipline_specific=False,
        )

        # Equality và Hash phải bằng nhau (deterministic)
        self.assertEqual(prov1, prov2)
        self.assertEqual(hash(prov1), hash(prov2))

        # Frozen instance
        with self.assertRaises(FrozenInstanceError):
            prov1.evaluator_id = "other_evaluator"  # type: ignore

        # evidence_keys_used luôn là tuple bất biến
        self.assertIsInstance(prov1.evidence_keys_used, tuple)

    def test_assessment_result_deep_freeze(self) -> None:
        prov = AssessmentProvenance(
            evaluator_id="default_punch_evaluator",
            evaluator_version="1.0.0",
            rubric_id="rubric_punch_v3",
            rubric_version="3.0.0",
            rubric_status="VALIDATED",
        )
        nested_crit_details = {"angle": 150.0, "sub": {"note": "ok", "frames": [10, 11, 12]}}
        crit_input = [{
            "criterionId": "crit_1",
            "score": 90,
            "details": nested_crit_details,
            "tags": ["extension", "impact"],
        }]
        nested_finding_meta = {"severity": "HIGH", "flags": ["guard_drop"]}
        finding_input = [{
            "id": "finding_1",
            "title": "Good extension",
            "meta": nested_finding_meta,
        }]

        res = AssessmentResult(
            score=88,
            grade="GOOD",
            status=AssessmentStatus.GOOD,
            assessment_confidence=0.82,
            provenance=prov,
            criteria=crit_input,
            findings=finding_input,
            metrics={"maxElbowAngle": 150.0},
        )

        # Top-level frozen
        with self.assertRaises(FrozenInstanceError):
            res.score = 95  # type: ignore

        # Criteria frozen recursively with MappingProxyType and tuple
        self.assertIsInstance(res.criteria, tuple)
        self.assertIsInstance(res.criteria[0], MappingProxyType)
        with self.assertRaises(TypeError):
            res.criteria[0]["score"] = 99  # type: ignore

        # Nested mapping in criteria frozen
        self.assertIsInstance(res.criteria[0]["details"], MappingProxyType)
        with self.assertRaises(TypeError):
            res.criteria[0]["details"]["angle"] = 99.0  # type: ignore

        self.assertIsInstance(res.criteria[0]["details"]["sub"], MappingProxyType)
        with self.assertRaises(TypeError):
            res.criteria[0]["details"]["sub"]["note"] = "mutated"  # type: ignore

        # Nested sequence in criteria converted to tuple
        self.assertIsInstance(res.criteria[0]["details"]["sub"]["frames"], tuple)
        self.assertEqual(res.criteria[0]["details"]["sub"]["frames"], (10, 11, 12))
        self.assertIsInstance(res.criteria[0]["tags"], tuple)
        self.assertEqual(res.criteria[0]["tags"], ("extension", "impact"))

        # Findings frozen recursively
        self.assertIsInstance(res.findings, tuple)
        self.assertIsInstance(res.findings[0], MappingProxyType)
        with self.assertRaises(TypeError):
            res.findings[0]["title"] = "Modified"  # type: ignore

        self.assertIsInstance(res.findings[0]["meta"], MappingProxyType)
        with self.assertRaises(TypeError):
            res.findings[0]["meta"]["severity"] = "LOW"  # type: ignore
        self.assertIsInstance(res.findings[0]["meta"]["flags"], tuple)

        # Metrics frozen with MappingProxyType
        self.assertIsInstance(res.metrics, MappingProxyType)
        with self.assertRaises(TypeError):
            res.metrics["new_metric"] = AssessmentMetricItem(1.0, "degree")  # type: ignore

        # Zero Input Mutation: thay đổi nguồn ban đầu không ảnh hưởng tới res
        nested_crit_details["angle"] = 999.0
        nested_crit_details["sub"]["note"] = "external_mutation"
        nested_finding_meta["severity"] = "TAMPERED"
        self.assertEqual(res.criteria[0]["details"]["angle"], 150.0)
        self.assertEqual(res.criteria[0]["details"]["sub"]["note"], "ok")
        self.assertEqual(res.findings[0]["meta"]["severity"], "HIGH")

        # to_dict() và to_legacy_dict() deep unfreeze thành mutable dict/list
        d = res.to_dict()
        self.assertIsInstance(d["criteria"], list)
        self.assertIsInstance(d["criteria"][0], dict)
        self.assertIsInstance(d["criteria"][0]["details"], dict)
        self.assertIsInstance(d["criteria"][0]["details"]["sub"]["frames"], list)
        self.assertIsInstance(d["findings"], list)
        self.assertIsInstance(d["findings"][0], dict)
        self.assertIsInstance(d["findings"][0]["meta"], dict)
        self.assertIsInstance(d["findings"][0]["meta"]["flags"], list)

        leg = res.to_legacy_dict()
        self.assertIsInstance(leg["criteria"], list)
        self.assertIsInstance(leg["criteria"][0], dict)
        self.assertIsInstance(leg["criteria"][0]["details"], dict)


class TestEvaluatorResolution(unittest.TestCase):
    """Kiểm tra cơ chế phân giải evaluator và rubric theo ngữ cảnh AnalysisContext."""

    def setUp(self) -> None:
        self.engine = get_default_assessment_engine()

    def test_resolution_generic_punch(self) -> None:
        # Context is None (legacy call style)
        evaluator, rubric = self.engine.resolve("punch", context=None)
        self.assertIsInstance(evaluator, DefaultPunchEvaluator)
        self.assertEqual(rubric.id, "rubric_punch_v3")
        self.assertEqual(rubric.version, "3.0.0")

        # Explicit generic context
        ctx = AnalysisContext(martial_art="generic")
        evaluator2, rubric2 = self.engine.resolve("punch", context=ctx)
        self.assertIsInstance(evaluator2, DefaultPunchEvaluator)
        self.assertEqual(rubric2.id, "rubric_punch_v3")

    def test_resolution_generic_kick(self) -> None:
        evaluator, rubric = self.engine.resolve("round_kick", context=None)
        self.assertIsInstance(evaluator, DefaultKickEvaluator)
        self.assertEqual(rubric.id, "rubric_round_kick_v3")

    def test_discipline_specific_rejection_boxing_kickboxing_muay_thai(self) -> None:
        """
        Xác minh gọi evaluate_action hoặc resolve với martial_art='boxing',
        'kickboxing' hoặc 'muay_thai' đều phải ném EvaluatorResolutionError hoặc RubricResolutionError
        vì chưa có evaluator / rubric đặc thù được phê duyệt.
        """
        for ma in ("boxing", "kickboxing", "muay_thai"):
            ctx = AnalysisContext(martial_art=ma)
            with self.assertRaises((EvaluatorResolutionError, RubricResolutionError)) as cm:
                self.engine.resolve("punch", context=ctx)
            
            mock_punch = MockPunchResult(criterion_results=create_sample_punch_criteria(sufficient=True))
            with self.assertRaises((EvaluatorResolutionError, RubricResolutionError)):
                self.engine.evaluate(mock_punch, context=ctx)

    def test_unknown_martial_art_rejection(self) -> None:
        ctx = AnalysisContext(martial_art="unknown")
        with self.assertRaises(RubricResolutionError) as cm:
            self.engine.resolve("punch", context=ctx)
        self.assertEqual(cm.exception.selection_result.status, RubricSelectionStatus.UNSUPPORTED_MARTIAL_ART)
        self.assertIn("unknown", str(cm.exception))

    def test_unsupported_martial_art_rejection(self) -> None:
        for ma in ("muay_thai", "karate", "taekwondo"):
            ctx = AnalysisContext(martial_art=ma)
            with self.assertRaises(RubricResolutionError) as cm:
                self.engine.resolve("punch", context=ctx)
            self.assertEqual(cm.exception.selection_result.status, RubricSelectionStatus.UNSUPPORTED_MARTIAL_ART)

    def test_unsupported_technique_for_discipline(self) -> None:
        # Technique not in generic namespace (e.g. spinning_back_fist)
        ctx = AnalysisContext(martial_art="generic")
        with self.assertRaises(RubricResolutionError) as cm:
            self.engine.resolve("spinning_back_fist", context=ctx)
        self.assertEqual(cm.exception.selection_result.status, RubricSelectionStatus.UNSUPPORTED_TECHNIQUE)


class TestInvalidTypeAndVersionHandling(unittest.TestCase):
    """Kiểm tra xử lý các đầu vào sai kiểu dữ liệu và sai phiên bản."""

    def setUp(self) -> None:
        self.engine = get_default_assessment_engine()

    def test_invalid_technique_type(self) -> None:
        with self.assertRaises(TypeError):
            self.engine.resolve(technique=123)  # type: ignore
        with self.assertRaises(TypeError):
            self.engine.resolve(technique="")  # type: ignore
        with self.assertRaises(TypeError):
            self.engine.resolve(technique=True)  # type: ignore

    def test_invalid_context_type(self) -> None:
        with self.assertRaises(TypeError):
            self.engine.resolve("punch", context="not_a_context")  # type: ignore

    def test_nonexistent_rubric_version(self) -> None:
        with self.assertRaises(RubricResolutionError) as cm:
            self.engine.resolve("punch", requested_version="99.9.9")
        self.assertEqual(cm.exception.selection_result.status, RubricSelectionStatus.VERSION_NOT_FOUND)

    def test_invalid_version_format(self) -> None:
        with self.assertRaises(RubricResolutionError) as cm:
            self.engine.resolve("punch", requested_version="banana")
        self.assertEqual(cm.exception.selection_result.status, RubricSelectionStatus.VERSION_NOT_FOUND)


class TestGovernanceAndDeprecatedRubricPolicy(unittest.TestCase):
    """Kiểm tra policy quản trị rubric DRAFT và DEPRECATED."""

    def test_draft_rubric_requires_allow_draft(self) -> None:
        custom_reg = create_assessment_rubric_registry()
        draft_rubric = TechniqueRubric(
            id="rubric_punch_draft",
            martial_art="generic",
            technique="punch",
            version="4.0.0-draft",
            status="DRAFT",
            criteria=RUBRIC_PUNCH_V3.criteria,
        )
        custom_reg.register(draft_rubric)
        engine = AssessmentEngine(rubric_registry=custom_reg)

        # Mặc định (allow_draft=False) -> Từ chối
        with self.assertRaises(RubricResolutionError) as cm:
            engine.resolve("punch", requested_version="4.0.0-draft", allow_draft=False)
        self.assertEqual(cm.exception.selection_result.status, RubricSelectionStatus.RUBRIC_NOT_SELECTABLE)
        self.assertIn("DRAFT", cm.exception.selection_result.reason)

        # Khi bật allow_draft=True -> Thành công
        ev, rub = engine.resolve("punch", requested_version="4.0.0-draft", allow_draft=True)
        self.assertEqual(rub.id, "rubric_punch_draft")

    def test_deprecated_rubric_requires_allow_deprecated_for_replay(self) -> None:
        custom_reg = create_assessment_rubric_registry()
        dep_rubric = TechniqueRubric(
            id="rubric_punch_dep",
            martial_art="generic",
            technique="punch",
            version="2.0.0",
            status="DEPRECATED",
            criteria=RUBRIC_PUNCH_V3.criteria,
        )
        custom_reg.register(dep_rubric)
        engine = AssessmentEngine(rubric_registry=custom_reg)

        # Mặc định (allow_deprecated_for_replay=False) -> Từ chối
        with self.assertRaises(RubricResolutionError) as cm:
            engine.resolve("punch", requested_version="2.0.0", allow_deprecated_for_replay=False)
        self.assertEqual(cm.exception.selection_result.status, RubricSelectionStatus.RUBRIC_NOT_SELECTABLE)
        self.assertIn("DEPRECATED", cm.exception.selection_result.reason)

        # Khi bật allow_deprecated_for_replay=True -> Thành công
        ev, rub = engine.resolve("punch", requested_version="2.0.0", allow_deprecated_for_replay=True)
        self.assertEqual(rub.id, "rubric_punch_dep")


class TestInsufficientEvidenceHandling(unittest.TestCase):
    """Kiểm tra xử lý nghiêm ngặt khi thiếu bằng chứng quan sát (Evidence Gating)."""

    def setUp(self) -> None:
        self.engine = get_default_assessment_engine()

    def test_punch_insufficient_evidence(self) -> None:
        mock_punch = MockPunchResult(
            criterion_results=create_sample_punch_criteria(sufficient=False),
            max_elbow_angle=0.0,
            peak_speed=0.0,
            guard_preserved=False,
        )

        res = self.engine.evaluate(mock_punch)

        # Bắt buộc: score=None, grade='NO_DATA', status=INSUFFICIENT_EVIDENCE, confidence=None
        self.assertIsNone(res.score)
        self.assertEqual(res.grade, "NO_DATA")
        self.assertEqual(res.status, AssessmentStatus.INSUFFICIENT_EVIDENCE)
        self.assertIsNone(res.assessment_confidence)

        # Serialization phải bảo toàn score=None (tuyệt đối KHÔNG fallback về 0)
        self.assertIsNone(res.to_dict()["score"])
        self.assertIsNone(res.to_legacy_dict()["score"])

        # Metrics cho tiêu chí thiếu bằng chứng phải có value=None, confidence=None
        self.assertIsNone(res.metrics["maxElbowAngle"].value)
        self.assertIsNone(res.metrics["maxElbowAngle"].confidence)
        self.assertIsNone(res.metrics["peakSpeed"].value)
        self.assertIsNone(res.metrics["guardPreserved"].value)

    def test_empty_criteria_handling(self) -> None:
        mock_punch = MockPunchResult(criterion_results=[])
        res = self.engine.evaluate(mock_punch)

        self.assertIsNone(res.score)
        self.assertEqual(res.grade, "NO_DATA")
        self.assertEqual(res.status, AssessmentStatus.INSUFFICIENT_EVIDENCE)
        self.assertIsNone(res.assessment_confidence)
        self.assertIsNone(res.to_dict()["score"])
        self.assertIsNone(res.to_legacy_dict()["score"])

    def test_insufficient_criteria_do_not_inflate_confidence(self) -> None:
        # 1 criterion tốt (score=90, weight=0.4, conf=0.8), 2 criterion insufficient_evidence
        mixed_criteria = [
            CriterionResult(
                criterion_id="crit_punch_extension",
                criterion_name="Arm Extension",
                phase="impact",
                feature_name="max_elbow_angle",
                observed_value=150.0,
                score=90.0,
                weight=0.40,
                confidence=0.80,
                status=CriterionStatus.EXCELLENT.value,
                evidence_frame_start=1,
                evidence_frame_end=5,
                evidence_timestamp_start_ms=33.0,
                evidence_timestamp_end_ms=166.0,
                affected_body_part="right_elbow",
                detail="Tốt",
            ),
            CriterionResult(
                criterion_id="crit_punch_guard",
                criterion_name="Guard",
                phase="impact",
                feature_name="guard_preserved",
                observed_value=0.0,
                score=0.0,
                weight=0.35,
                confidence=0.99,  # Confidence cao giả tạo nhưng status là insufficient_evidence
                status=CriterionStatus.INSUFFICIENT_EVIDENCE.value,
                evidence_frame_start=0,
                evidence_frame_end=0,
                evidence_timestamp_start_ms=0.0,
                evidence_timestamp_end_ms=0.0,
                affected_body_part="left_wrist",
                detail="Thiếu",
            ),
        ]

        conf = compute_derived_rubric_confidence(mixed_criteria)
        # Chỉ lấy tiêu chí 1 (conf=0.80), tiêu chí 2 bị loại bỏ hoàn toàn
        self.assertEqual(conf, 0.80)


class TestZeroInputMutationAndLegacyEquivalence(unittest.TestCase):
    """Kiểm tra nguyên tắc Zero Input Mutation và tương thích kết quả với chuẩn legacy."""

    def setUp(self) -> None:
        self.engine = get_default_assessment_engine()

    def test_zero_input_mutation(self) -> None:
        criteria = create_sample_punch_criteria(sufficient=True)
        orig_crit_scores = [c.score for c in criteria]
        orig_crit_confidences = [c.confidence for c in criteria]

        mock_punch = MockPunchResult(
            punch_type="Cross",
            arm="right",
            score=91,
            grade="PERFECT",
            max_elbow_angle=152.4,
            peak_speed=1.35,
            guard_preserved=True,
            criterion_results=criteria,
        )

        res = self.engine.evaluate(mock_punch)

        # Đối tượng đầu vào tuyệt đối không bị thay đổi bất kỳ thuộc tính nào
        self.assertEqual(mock_punch.score, 91)
        self.assertEqual(mock_punch.grade, "PERFECT")
        self.assertEqual([c.score for c in mock_punch.criterion_results], orig_crit_scores)
        self.assertEqual([c.confidence for c in mock_punch.criterion_results], orig_crit_confidences)

    def test_legacy_equivalence_punch(self) -> None:
        criteria = create_sample_punch_criteria(sufficient=True)
        mock_punch = MockPunchResult(
            punch_type="Cross",
            arm="right",
            score=91,
            grade="PERFECT",
            max_elbow_angle=152.4,
            peak_speed=1.35,
            guard_preserved=True,
            criterion_results=criteria,
        )

        res = self.engine.evaluate(mock_punch)

        # Điểm có trọng số: 95*0.4 + 90*0.35 + 85*0.25 = 38.0 + 31.5 + 21.25 = 90.75 -> round = 91
        self.assertEqual(res.score, 91)
        self.assertEqual(res.grade, "PERFECT")
        self.assertEqual(res.status, AssessmentStatus.EXCELLENT)
        # Derived confidence: 0.88*0.4 + 0.82*0.35 + 0.75*0.25 = 0.352 + 0.287 + 0.1875 = 0.8265 -> 0.83
        self.assertEqual(res.assessment_confidence, 0.83)

        # Metrics trích xuất đúng
        self.assertEqual(res.metrics["maxElbowAngle"].value, 152.4)
        self.assertEqual(res.metrics["maxElbowAngle"].unit, "degree")
        self.assertEqual(res.metrics["peakSpeed"].value, 1.35)
        self.assertEqual(res.metrics["guardPreserved"].value, True)

        # Tương thích to_legacy_dict
        leg = res.to_legacy_dict()
        self.assertEqual(leg["rubricId"], "rubric_punch_v3")
        self.assertEqual(leg["score"], 91)
        self.assertEqual(leg["grade"], "PERFECT")
        self.assertEqual(leg["status"], "excellent")
        self.assertEqual(len(leg["criteria"]), 3)

    def test_no_generic_criteria_stamped_as_discipline_specific(self) -> None:
        """
        Xác minh mọi đánh giá generic đều có provenance.is_discipline_specific == False.
        Tuyệt đối không gắn nhãn môn võ cụ thể giả mạo cho tiêu chí generic.
        """
        criteria = create_sample_punch_criteria(sufficient=True)
        mock_punch = MockPunchResult(punch_type="punch", criterion_results=criteria)

        # Context None -> is_discipline_specific = False
        res_none = self.engine.evaluate(mock_punch, context=None)
        self.assertFalse(res_none.provenance.is_discipline_specific)

        # Context generic -> is_discipline_specific = False
        ctx_generic = AnalysisContext(martial_art="generic")
        res_generic = self.engine.evaluate(mock_punch, context=ctx_generic)
        self.assertFalse(res_generic.provenance.is_discipline_specific)

        # Gọi với discipline cụ thể không có evaluator phải bị từ chối
        ctx_boxing = AnalysisContext(martial_art="boxing")
        with self.assertRaises((EvaluatorResolutionError, RubricResolutionError)):
            self.engine.evaluate(mock_punch, context=ctx_boxing)

    def test_no_unverified_expert_sources(self) -> None:
        """
        Xác minh không có rubric nào trong registry của Assessment Engine
        tự xưng các hội đồng chuyên gia chưa được thẩm định (unverified expert panels).
        Chỉ chấp nhận các rubric canonical RUBRIC_PUNCH_V3 và RUBRIC_ROUND_KICK_V3.
        """
        registry = get_assessment_rubric_registry()
        registered_rubrics = registry.list_registered_rubrics()
        self.assertEqual(len(registered_rubrics), 2)
        rubric_ids = {r.id for r in registered_rubrics}
        self.assertEqual(rubric_ids, {"rubric_punch_v3", "rubric_round_kick_v3"})

        for r in registered_rubrics:
            self.assertEqual(r.expert_reference, "MMA-TMS Expert Biomechanics Panel 2026")
            self.assertNotIn("Boxing Expert Panel", r.expert_reference)
            self.assertNotIn("Kickboxing Expert Panel", r.expert_reference)

    def test_legacy_equivalence_kick(self) -> None:
        criteria = [
            CriterionResult(
                criterion_id="crit_kick_chamber",
                criterion_name="Knee Chamber Depth",
                phase="chamber",
                feature_name="min_chamber_angle",
                observed_value=48.5,
                score=90.0,
                weight=0.35,
                confidence=0.85,
                status=CriterionStatus.EXCELLENT.value,
                evidence_frame_start=10,
                evidence_frame_end=15,
                evidence_timestamp_start_ms=333.3,
                evidence_timestamp_end_ms=500.0,
                affected_body_part="right_knee",
                detail="Gập gối tốt",
            ),
            CriterionResult(
                criterion_id="crit_kick_extension",
                criterion_name="Full Leg Extension",
                phase="impact",
                feature_name="max_extension_angle",
                observed_value=162.0,
                score=85.0,
                weight=0.35,
                confidence=0.80,
                status=CriterionStatus.GOOD.value,
                evidence_frame_start=15,
                evidence_frame_end=20,
                evidence_timestamp_start_ms=500.0,
                evidence_timestamp_end_ms=666.6,
                affected_body_part="right_knee",
                detail="Duỗi chân tốt",
            ),
            CriterionResult(
                criterion_id="crit_kick_speed",
                criterion_name="Striking Velocity",
                phase="impact",
                feature_name="peak_speed",
                observed_value=1.42,
                score=80.0,
                weight=0.15,
                confidence=0.75,
                status=CriterionStatus.GOOD.value,
                evidence_frame_start=15,
                evidence_frame_end=20,
                evidence_timestamp_start_ms=500.0,
                evidence_timestamp_end_ms=666.6,
                affected_body_part="right_ankle",
                detail="Tốc độ tốt",
            ),
            CriterionResult(
                criterion_id="crit_kick_posture",
                criterion_name="Torso & Hip Alignment",
                phase="impact",
                feature_name="hip_angle",
                observed_value=145.2,
                score=80.0,
                weight=0.15,
                confidence=0.70,
                status=CriterionStatus.GOOD.value,
                evidence_frame_start=15,
                evidence_frame_end=20,
                evidence_timestamp_start_ms=500.0,
                evidence_timestamp_end_ms=666.6,
                affected_body_part="hip",
                detail="Thân bằng tốt",
            ),
        ]
        mock_kick = MockKickResult(
            kick_type="round_kick",
            leg="right",
            score=85,
            grade="GOOD",
            min_chamber_angle=48.5,
            max_extension_angle=162.0,
            peak_speed=1.42,
            hip_angle=145.2,
            criterion_results=criteria,
        )

        res = self.engine.evaluate(mock_kick)

        # Weighted score: 90*0.35 + 85*0.35 + 80*0.15 + 80*0.15 = 31.5 + 29.75 + 12.0 + 12.0 = 85.25 -> round = 85
        self.assertEqual(res.score, 85)
        self.assertEqual(res.grade, "GOOD")
        self.assertEqual(res.status, AssessmentStatus.GOOD)
        # Weighted conf: 0.85*0.35 + 0.80*0.35 + 0.75*0.15 + 0.70*0.15 = 0.2975 + 0.28 + 0.1125 + 0.105 = 0.795 -> round(0.795, 2) == 0.79
        self.assertEqual(res.assessment_confidence, 0.79)

        # Metrics trích xuất đúng
        self.assertEqual(res.metrics["minChamberAngle"].value, 48.5)
        self.assertEqual(res.metrics["maxExtensionAngle"].value, 162.0)
        self.assertEqual(res.metrics["peakSpeed"].value, 1.42)
        self.assertEqual(res.metrics["hipAngle"].value, 145.2)

        # Legacy dict tương thích
        leg = res.to_legacy_dict()
        self.assertEqual(leg["rubricId"], "rubric_round_kick_v3")
        self.assertEqual(leg["score"], 85)
        self.assertEqual(leg["grade"], "GOOD")
        self.assertEqual(len(leg["criteria"]), 4)

    def test_kick_insufficient_evidence(self) -> None:
        insufficient_criteria = [
            CriterionResult(
                criterion_id="crit_kick_chamber",
                criterion_name="Chamber",
                phase="chamber",
                feature_name="min_chamber_angle",
                observed_value=0.0,
                score=0.0,
                weight=0.35,
                confidence=0.0,
                status=CriterionStatus.INSUFFICIENT_EVIDENCE.value,
                evidence_frame_start=0,
                evidence_frame_end=0,
                evidence_timestamp_start_ms=0.0,
                evidence_timestamp_end_ms=0.0,
                affected_body_part="knee",
                detail="Thiếu",
            ),
        ]
        mock_kick = MockKickResult(criterion_results=insufficient_criteria)
        res = self.engine.evaluate(mock_kick)

        self.assertIsNone(res.score)
        self.assertEqual(res.grade, "NO_DATA")
        self.assertEqual(res.status, AssessmentStatus.INSUFFICIENT_EVIDENCE)
        self.assertIsNone(res.assessment_confidence)
        self.assertIsNone(res.to_dict()["score"])
        self.assertIsNone(res.to_legacy_dict()["score"])
        self.assertIsNone(res.metrics["minChamberAngle"].value)


class TestEvaluatorRegistryAndCustomEvaluator(unittest.TestCase):
    """Kiểm tra EvaluatorRegistry và khả năng mở rộng evaluator tùy chỉnh."""

    def test_register_custom_evaluator(self) -> None:
        class CustomUppercutEvaluator:
            evaluator_id = "custom_uppercut_evaluator"
            evaluator_version = "1.0.0"

            def can_evaluate(self, technique: str, context: AnalysisContext | None = None) -> bool:
                return technique == "uppercut"

            def evaluate(self, action_or_input: Any, context: AnalysisContext | None = None, rubric: TechniqueRubric | None = None) -> AssessmentResult:
                prov = AssessmentProvenance(
                    evaluator_id=self.evaluator_id,
                    evaluator_version=self.evaluator_version,
                    rubric_id="rubric_uppercut_v1",
                    rubric_version="1.0.0",
                    rubric_status="VALIDATED",
                )
                return AssessmentResult(
                    score=92,
                    grade="PERFECT",
                    status=AssessmentStatus.EXCELLENT,
                    assessment_confidence=0.90,
                    provenance=prov,
                )

        registry = create_default_evaluator_registry()
        custom_eval = CustomUppercutEvaluator()
        registry.register(custom_eval)

        found = registry.find_evaluator("uppercut")
        self.assertIs(found, custom_eval)

        # Trùng ID bị từ chối
        with self.assertRaises(ValueError):
            registry.register(custom_eval)

        # Non-evaluator bị từ chối
        with self.assertRaises(TypeError):
            registry.register("not_an_evaluator")  # type: ignore

    def test_assessment_input_immutability(self) -> None:
        inp = AssessmentInput(action_id="act_1", technique="punch")
        with self.assertRaises(FrozenInstanceError):
            inp.action_id = "act_2"  # type: ignore

    def test_assessment_input_decoupling_and_transient_detector(self) -> None:
        """
        Xác minh AssessmentInput hoàn toàn tách rời khỏi detector object:
        - Tuyệt đối không có trường raw_action trong state nội bộ.
        - from_punch và from_kick không lưu detector object.
        - Detector object chỉ được truyền transient tại thời điểm evaluate.
        """
        inp_empty = AssessmentInput(action_id="act_1", technique="punch")
        self.assertFalse(hasattr(inp_empty, "raw_action"))

        mock_punch = MockPunchResult(
            max_elbow_angle=158.0,
            peak_speed=1.52,
            guard_preserved=True,
            criterion_results=create_sample_punch_criteria(sufficient=True),
        )
        inp_punch = AssessmentInput.from_punch(mock_punch)
        self.assertFalse(hasattr(inp_punch, "raw_action"))

        mock_kick = MockKickResult(
            min_chamber_angle=52.0,
            max_extension_angle=165.0,
            peak_speed=1.60,
            hip_angle=140.0,
        )
        inp_kick = AssessmentInput.from_kick(mock_kick)
        self.assertFalse(hasattr(inp_kick, "raw_action"))

        # Đánh giá với AssessmentInput và transient raw_action
        engine = get_default_assessment_engine()
        res = engine.evaluate(inp_punch, raw_action=mock_punch)
        self.assertEqual(res.metrics["maxElbowAngle"].value, 158.0)
        self.assertEqual(res.metrics["peakSpeed"].value, 1.52)
        self.assertEqual(res.metrics["guardPreserved"].value, True)

    def test_metric_item_like_compatibility_with_agent_c_contract(self) -> None:
        """
        Xác minh tính tương thích chuẩn giữa MetricItemLike và Kinematic Feature Contract của Agent C.
        """
        class MockKinematicMetricContract:
            def __init__(
                self,
                name: str,
                value: float | None,
                unit: str,
                confidence: float | None,
                evidence_level: str = "observed",
                evidence_quality: str = "GOOD",
                frames_used: tuple[int, ...] | None = (1, 2, 3),
                time_window_ms: tuple[float, float] | None = (33.3, 100.0),
                method_version: str = "1.0.0",
                limitation: str = "2D monocular image-space proxy; not physical 3D force or SI units",
            ) -> None:
                self.name = name
                self.value = value
                self.unit = unit
                self.confidence = confidence
                self.evidence_level = evidence_level
                self.evidence_quality = evidence_quality
                self.frames_used = frames_used
                self.time_window_ms = time_window_ms
                self.method_version = method_version
                self.limitation = limitation

        # Metric quan sát được đầy đủ
        metric_c = MockKinematicMetricContract(
            name="elbow_extension_angle",
            value=156.5,
            unit="degree",
            confidence=0.89,
        )
        self.assertIsInstance(metric_c, MetricItemLike)
        adapted = to_assessment_metric(metric_c)
        self.assertIsInstance(adapted, AssessmentMetricItem)
        self.assertEqual(adapted.value, 156.5)
        self.assertEqual(adapted.unit, "degree")
        self.assertEqual(adapted.confidence, 0.89)

        # Metric thiếu bằng chứng từ Agent C
        metric_missing = MockKinematicMetricContract(
            name="peak_speed_proxy",
            value=None,
            unit="normalized_image/s",
            confidence=None,
            evidence_level="unavailable",
            evidence_quality="INSUFFICIENT",
            frames_used=None,
            time_window_ms=None,
        )
        self.assertIsInstance(metric_missing, MetricItemLike)
        adapted_missing = to_assessment_metric(metric_missing)
        self.assertIsInstance(adapted_missing, AssessmentMetricItem)
        self.assertIsNone(adapted_missing.value)
        self.assertEqual(adapted_missing.unit, "normalized_image/s")
        self.assertIsNone(adapted_missing.confidence)

    def test_module_level_helpers(self) -> None:
        ev, rub = resolve_evaluator("punch")
        self.assertIsInstance(ev, DefaultPunchEvaluator)
        self.assertEqual(rub.id, "rubric_punch_v3")

        mock_punch = MockPunchResult(criterion_results=create_sample_punch_criteria(sufficient=True))
        res = evaluate_action(mock_punch)
        self.assertIsInstance(res, AssessmentResult)
        self.assertEqual(res.score, 91)

    def test_assessment_provenance_validation(self) -> None:
        # Evaluator version phải là strict SemVer
        with self.assertRaises(ValueError):
            AssessmentProvenance(
                evaluator_id="eval_1",
                evaluator_version="invalid-version",
                rubric_id="rub_1",
                rubric_version="1.0.0",
                rubric_status="VALIDATED",
            )
        # Rubric version phải là strict SemVer
        with self.assertRaises(ValueError):
            AssessmentProvenance(
                evaluator_id="eval_1",
                evaluator_version="1.0.0",
                rubric_id="rub_1",
                rubric_version="invalid-rubric-ver",
                rubric_status="VALIDATED",
            )

    def test_assessment_result_validation_and_coercion(self) -> None:
        prov = AssessmentProvenance(
            evaluator_id="eval_1",
            evaluator_version="1.0.0",
            rubric_id="rub_1",
            rubric_version="1.0.0",
            rubric_status="VALIDATED",
        )
        # Score âm hoặc vượt 100 bị từ chối
        with self.assertRaises(ValueError):
            AssessmentResult(score=-5, grade="NEEDS WORK", status=AssessmentStatus.NEEDS_IMPROVEMENT, assessment_confidence=0.5, provenance=prov)
        with self.assertRaises(ValueError):
            AssessmentResult(score=105, grade="PERFECT", status=AssessmentStatus.EXCELLENT, assessment_confidence=0.9, provenance=prov)
        with self.assertRaises(TypeError):
            AssessmentResult(score=True, grade="PERFECT", status=AssessmentStatus.EXCELLENT, assessment_confidence=0.9, provenance=prov)  # type: ignore

        # Coercion: Khi grade="NO_DATA" hoặc status=INSUFFICIENT_EVIDENCE, score & conf bị ép về None
        res = AssessmentResult(
            score=70,  # cố tình truyền score khi status là INSUFFICIENT_EVIDENCE
            grade="NO_DATA",
            status=AssessmentStatus.INSUFFICIENT_EVIDENCE,
            assessment_confidence=0.8,
            provenance=prov,
        )
        self.assertIsNone(res.score)
        self.assertIsNone(res.assessment_confidence)
        self.assertEqual(res.status, AssessmentStatus.INSUFFICIENT_EVIDENCE)
        self.assertEqual(res.grade, "NO_DATA")

        # to_dict tạo dict JSON-serializable hoàn chỉnh
        d = res.to_dict()
        self.assertIsNone(d["score"])
        self.assertEqual(d["grade"], "NO_DATA")
        self.assertEqual(d["status"], "insufficient_evidence")
        self.assertIsInstance(d["criteria"], list)
        self.assertIsInstance(d["findings"], list)
        self.assertIsInstance(d["metrics"], dict)


if __name__ == "__main__":
    unittest.main()

