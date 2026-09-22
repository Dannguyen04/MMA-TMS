"""
test_rubric_registry.py — MMA-TMS Task 4 Unit & Integration Tests

Bộ kiểm thử toàn diện cho Task 4:
1. AnalysisContext:
   - Giá trị hợp lệ và chuẩn hóa (trim, lowercase, alias).
   - Phân biệt rõ ràng giữa omitted (None), unknown ("unknown") và invalid (lỗi).
   - Invalid martial_art / training_mode / v.v. bị từ chối bằng ValueError/TypeError,
     không âm thầm biến thành môn võ khác hay unknown.
   - Immutability (frozen=True).
   - Cross-field invariants (vd: single_technique không cho phép nhiều expected_techniques).
2. Rubric Definition:
   - Canonical identity (id, martial_art, technique, version, status, source_type, criteria).
   - Tương thích ngược technique_type alias (cùng 1 nguồn chân lý).
   - Mâu thuẫn giữa technique và technique_type gây lỗi.
   - Duplicate criterion ID trong 1 rubric bị từ chối.
   - Weight <= 0, bool, NaN, Infinity bị từ chối.
   - Required confidence ngoài [0,1], bool, NaN, Infinity bị từ chối.
   - Invalid status / scoring_method bị từ chối.
   - Tổng trọng số WEIGHTED_SUM phải bằng 1.0.
   - Immutability và defensive copy.
3. RubricRegistry:
   - Tra cứu chính xác (exact-match).
   - Từ chối duplicate key (martial_art, technique, version).
   - Từ chối duplicate rubric ID có definition khác.
   - Xử lý môn võ chưa hỗ trợ (UNSUPPORTED_MARTIAL_ART).
   - Xử lý kỹ thuật chưa hỗ trợ (UNSUPPORTED_TECHNIQUE).
   - Xử lý phiên bản không tồn tại (VERSION_NOT_FOUND).
   - Chọn version mặc định/latest theo semver (10.0.0 > 2.0.0).
   - Tuyệt đối không cross-discipline fallback khi có explicit martial art.
   - Bất biến: rubric và registry không bị mutate từ bên ngoài.
4. Compatibility & Boundary:
   - Existing rubric constants/imports vẫn hoạt động bình thường.
   - Legacy path (omitted context) giữ nguyên rubricId và rubricVersion.
   - Explicit discipline chưa có evaluator bị từ chối an toàn, không tạo assessment giả.
   - Không xuất hiện trường mới ngoài schema v1.0.0.
   - Không có circular import.
"""

from dataclasses import FrozenInstanceError
import math
from pathlib import Path
import subprocess
import sys
from types import MappingProxyType
import unittest
from typing import Any

from pipeline.analysis_context import (
    MartialArt,
    TrainingMode,
    CameraView,
    TargetType,
    SkillLevel,
    AnalysisContext,
    normalize_martial_art,
    normalize_training_mode,
    normalize_camera_view,
    normalize_target_type,
    normalize_skill_level,
    normalize_expected_techniques,
    normalize_requested_rubric_version,
)
from technique_rubric import (
    TechniqueCriterion,
    TechniqueRubric,
    RUBRIC_PUNCH_V3,
    RUBRIC_ROUND_KICK_V3,
)
from pipeline.rubric_registry import (
    RubricSelectionStatus,
    RubricSelectionResult,
    RubricRegistry,
    SemVer,
    parse_semver,
    create_default_rubric_registry,
    get_default_rubric_registry,
)
from action_result import (
    ActionResult,
    RubricSelectionError,
    action_from_punch,
    action_from_kick,
    build_actions_list,
    resolve_action_rubric,
)
from process_video import process_video
from pipeline.classification import (
    ClassifiedTechnique,
)
from pipeline.stance_context import (
    resolve_stance_context,
)


class DummyPunch:
    def __init__(self, punch_type: str = "cross", arm: str = "right"):
        self.punch_type = punch_type
        self.arm = arm
        self.score = 80
        self.grade = "GOOD"
        self.max_elbow_angle = 155.0
        self.peak_speed = 1.2
        self.guard_preserved = True
        self.start_frame = 10
        self.impact_frame = 20
        self.end_frame = 30
        self.start_time_ms = 333.3
        self.impact_time_ms = 666.6
        self.end_time_ms = 1000.0
        self.criterion_results = []
        self.findings = []


class DummyKick:
    def __init__(self, kick_type: str = "round_kick", leg: str = "right"):
        self.kick_type = kick_type
        self.active_leg = leg
        self.score = 85
        self.grade = "GOOD"
        self.min_chamber_angle = 60.0
        self.max_extension_angle = 165.0
        self.peak_speed = 1.8
        self.start_frame = 15
        self.chamber_peak_frame = 22
        self.impact_frame = 30
        self.end_frame = 45
        self.start_time_ms = 500.0
        self.chamber_peak_time_ms = 733.3
        self.impact_time_ms = 1000.0
        self.end_time_ms = 1500.0
        self.criterion_results = []
        self.findings = []


# ─────────────────────────────────────────────────────────────────────────────
# 1. Tests for AnalysisContext
# ─────────────────────────────────────────────────────────────────────────────

class TestAnalysisContext(unittest.TestCase):

    def test_valid_values_and_normalization(self):
        """Kiểm tra giá trị hợp lệ và cơ chế chuẩn hóa (trim, lowercase, alias mapping)."""
        ctx = AnalysisContext(
            martial_art="  Muay Thai  ",
            training_mode=" Single-Technique ",
            expected_techniques=[" Round_Kick "],
            camera_view=" 45 ",
            target_type=" Heavy_Bag ",
            skill_level=" Elite ",
            requested_rubric_version=" 1.2.0 ",
        )
        self.assertEqual(ctx.martial_art, "muay_thai")
        self.assertEqual(ctx.training_mode, "single_technique")
        self.assertEqual(ctx.expected_techniques, ("round_kick",))
        self.assertEqual(ctx.camera_view, "front_45")
        self.assertEqual(ctx.target_type, "heavy_bag")
        self.assertEqual(ctx.skill_level, "competitor")
        self.assertEqual(ctx.requested_rubric_version, "1.2.0")
        self.assertTrue(ctx.is_discipline_aware())

    def test_omitted_values_remain_none(self):
        """Các trường không truyền (omitted) phải mặc định là None (expected_techniques là tuple rỗng)."""
        ctx = AnalysisContext()
        self.assertIsNone(ctx.martial_art)
        self.assertIsNone(ctx.training_mode)
        self.assertEqual(ctx.expected_techniques, ())
        self.assertIsNone(ctx.camera_view)
        self.assertIsNone(ctx.target_type)
        self.assertIsNone(ctx.skill_level)
        self.assertIsNone(ctx.requested_rubric_version)
        self.assertFalse(ctx.is_discipline_aware())

    def test_explicit_unknown(self):
        """Phân biệt rõ ràng: explicit 'unknown' là chuỗi 'unknown', không phải None."""
        ctx = AnalysisContext(martial_art="unknown", skill_level="unknown")
        self.assertEqual(ctx.martial_art, "unknown")
        self.assertEqual(ctx.skill_level, "unknown")
        self.assertFalse(ctx.is_discipline_aware())

    def test_invalid_martial_art_raises(self):
        """Môn võ không thuộc taxonomy phải bị từ chối bằng ValueError, không được âm thầm biến đổi."""
        invalid_arts = ["swimming", "football", "kungfu_panda", "123", "random_string"]
        for art in invalid_arts:
            with self.assertRaises(ValueError):
                AnalysisContext(martial_art=art)

    def test_invalid_types_raise(self):
        """Các trường kiểu chuỗi nếu nhận bool, int, float... phải báo lỗi Type/ValueError."""
        with self.assertRaises(TypeError):
            AnalysisContext(martial_art=True)
        with self.assertRaises(TypeError):
            AnalysisContext(training_mode=123)
        with self.assertRaises(TypeError):
            AnalysisContext(camera_view=45.5)
        with self.assertRaises(TypeError):
            AnalysisContext(target_type=False)
        with self.assertRaises(TypeError):
            AnalysisContext(skill_level=[])
        with self.assertRaises(TypeError):
            AnalysisContext(requested_rubric_version=100)

    def test_empty_or_whitespace_raises(self):
        """Chuỗi rỗng hoặc chỉ whitespace không được chấp nhận làm giá trị hợp lệ."""
        with self.assertRaises(ValueError):
            AnalysisContext(martial_art="")
        with self.assertRaises(ValueError):
            AnalysisContext(martial_art="   ")
        with self.assertRaises(ValueError):
            AnalysisContext(training_mode="")
        with self.assertRaises(ValueError):
            AnalysisContext(camera_view="   ")
        with self.assertRaises(ValueError):
            AnalysisContext(requested_rubric_version="")

    def test_immutability(self):
        """AnalysisContext phải hoàn toàn bất biến (frozen=True)."""
        ctx = AnalysisContext(martial_art="boxing")
        with self.assertRaises(FrozenInstanceError):
            ctx.martial_art = "muay_thai"
        with self.assertRaises(FrozenInstanceError):
            ctx.skill_level = "beginner"

    def test_expected_techniques_validation(self):
        """expected_techniques phải là iterable chứa các chuỗi không rỗng, trả về tuple."""
        # Chuỗi đơn lẻ không được chấp nhận (phải là list/tuple)
        with self.assertRaises(TypeError):
            AnalysisContext(expected_techniques="round_kick")
        # Chứa phần tử rỗng
        with self.assertRaises(ValueError):
            AnalysisContext(expected_techniques=["round_kick", "   "])
        # Chứa phần tử không phải chuỗi
        with self.assertRaises(TypeError):
            AnalysisContext(expected_techniques=["round_kick", 123])
        # Chứa phần tử bool
        with self.assertRaises(TypeError):
            AnalysisContext(expected_techniques=["round_kick", True])

    def test_cross_field_invariant_single_technique(self):
        """Chế độ single_technique không được phép khai báo nhiều hơn 1 expected technique."""
        # 1 technique -> hợp lệ
        ctx = AnalysisContext(training_mode="single_technique", expected_techniques=["round_kick"])
        self.assertEqual(len(ctx.expected_techniques), 1)

        # > 1 technique -> ValueError
        with self.assertRaises(ValueError) as cm:
            AnalysisContext(
                training_mode="single_technique",
                expected_techniques=["round_kick", "jab"],
            )
        self.assertIn("single_technique", str(cm.exception))


# ─────────────────────────────────────────────────────────────────────────────
# 2. Tests for Rubric Definition (TechniqueCriterion & TechniqueRubric)
# ─────────────────────────────────────────────────────────────────────────────

class TestRubricDefinition(unittest.TestCase):

    def _create_valid_criteria(self) -> tuple[TechniqueCriterion, ...]:
        return (
            TechniqueCriterion(
                id="crit_1",
                name="Extension",
                description="Arm extension",
                feature_name="max_elbow_angle",
                phase="impact",
                weight=0.6,
                required_confidence=0.3,
            ),
            TechniqueCriterion(
                id="crit_2",
                name="Speed",
                description="Peak striking speed",
                feature_name="peak_speed",
                phase="impact",
                weight=0.4,
                required_confidence=0.25,
            ),
        )

    def test_canonical_identity(self):
        """Kiểm tra các thuộc tính định danh canonical của TechniqueRubric."""
        criteria = self._create_valid_criteria()
        rubric = TechniqueRubric(
            id="test_boxing_jab_v1",
            martial_art="boxing",
            technique="jab",
            version="1.0.0",
            status="VALIDATED",
            source_type="EXPERT_DEFINED",
            criteria=criteria,
        )
        self.assertEqual(rubric.id, "test_boxing_jab_v1")
        self.assertEqual(rubric.martial_art, "boxing")
        self.assertEqual(rubric.technique, "jab")
        self.assertEqual(rubric.version, "1.0.0")
        self.assertEqual(rubric.status, "VALIDATED")
        self.assertEqual(rubric.source_type, "EXPERT_DEFINED")
        self.assertEqual(len(rubric.criteria), 2)

    def test_technique_type_alias_backward_compatibility(self):
        """Kiểm tra alias technique_type và canonical technique dùng chung 1 nguồn chân lý."""
        criteria = self._create_valid_criteria()

        # Khởi tạo bằng technique_type (legacy call)
        r1 = TechniqueRubric(id="r1", technique_type="round_kick", criteria=criteria)
        self.assertEqual(r1.technique, "round_kick")
        self.assertEqual(r1.technique_type, "round_kick")

        # Khởi tạo bằng technique (canonical call)
        r2 = TechniqueRubric(id="r2", technique="round_kick", criteria=criteria)
        self.assertEqual(r2.technique, "round_kick")
        self.assertEqual(r2.technique_type, "round_kick")

        # Khởi tạo bằng cả hai khi giá trị giống nhau -> Hợp lệ
        r3 = TechniqueRubric(
            id="r3", technique="round_kick", technique_type="round_kick", criteria=criteria
        )
        self.assertEqual(r3.technique, "round_kick")
        self.assertEqual(r3.technique_type, "round_kick")

    def test_conflicting_technique_and_type_raises(self):
        """Khởi tạo có technique và technique_type mâu thuẫn phải raise ValueError."""
        criteria = self._create_valid_criteria()
        with self.assertRaises(ValueError) as cm:
            TechniqueRubric(
                id="r_conflict",
                technique="jab",
                technique_type="cross",
                criteria=criteria,
            )
        self.assertIn("Conflicting technique", str(cm.exception))

    def test_empty_required_fields_raise(self):
        """Các trường ID, technique, martial_art, version không được rỗng."""
        criteria = self._create_valid_criteria()
        with self.assertRaises(ValueError):
            TechniqueRubric(id="", technique="jab", criteria=criteria)
        with self.assertRaises(ValueError):
            TechniqueRubric(id="r", technique="", criteria=criteria)
        with self.assertRaises(ValueError):
            TechniqueRubric(id="r", technique="jab", martial_art="", criteria=criteria)
        with self.assertRaises(ValueError):
            TechniqueRubric(id="r", technique="jab", version="", criteria=criteria)

    def test_duplicate_criterion_ids_raise(self):
        """Một rubric có duplicate criterion ID phải bị từ chối ngay lập tức."""
        c1 = TechniqueCriterion(
            id="duplicate_id", name="C1", description="D", feature_name="f", phase="p", weight=0.5
        )
        c2 = TechniqueCriterion(
            id="duplicate_id", name="C2", description="D", feature_name="f", phase="p", weight=0.5
        )
        with self.assertRaises(ValueError) as cm:
            TechniqueRubric(id="r_dup", technique="jab", criteria=[c1, c2])
        self.assertIn("Duplicate criterion ID", str(cm.exception))

    def test_criterion_weight_validation(self):
        """Validation trọng số tiêu chí: phải là số hữu hạn > 0, không nhận bool, NaN, Infinity."""
        # Weight <= 0
        with self.assertRaises(ValueError):
            TechniqueCriterion(id="c", name="n", description="d", feature_name="f", phase="p", weight=0.0)
        with self.assertRaises(ValueError):
            TechniqueCriterion(id="c", name="n", description="d", feature_name="f", phase="p", weight=-0.5)

        # Weight is bool
        with self.assertRaises(ValueError):
            TechniqueCriterion(id="c", name="n", description="d", feature_name="f", phase="p", weight=True)

        # Weight is NaN / Inf
        with self.assertRaises(ValueError):
            TechniqueCriterion(id="c", name="n", description="d", feature_name="f", phase="p", weight=float("nan"))
        with self.assertRaises(ValueError):
            TechniqueCriterion(id="c", name="n", description="d", feature_name="f", phase="p", weight=float("inf"))

    def test_criterion_required_confidence_validation(self):
        """Validation required_confidence: [0.0, 1.0], không nhận bool, NaN, Infinity."""
        with self.assertRaises(ValueError):
            TechniqueCriterion(id="c", name="n", description="d", feature_name="f", phase="p", weight=0.5, required_confidence=-0.1)
        with self.assertRaises(ValueError):
            TechniqueCriterion(id="c", name="n", description="d", feature_name="f", phase="p", weight=0.5, required_confidence=1.1)
        with self.assertRaises(ValueError):
            TechniqueCriterion(id="c", name="n", description="d", feature_name="f", phase="p", weight=0.5, required_confidence=True)
        with self.assertRaises(ValueError):
            TechniqueCriterion(id="c", name="n", description="d", feature_name="f", phase="p", weight=0.5, required_confidence=float("nan"))

    def test_invalid_status_and_scoring_method_raises(self):
        """Status và scoring_method ngoài tập cho phép phải bị từ chối."""
        criteria = self._create_valid_criteria()
        with self.assertRaises(ValueError):
            TechniqueRubric(id="r", technique="jab", criteria=criteria, status="UNKNOWN_STATUS")
        with self.assertRaises(ValueError):
            TechniqueRubric(id="r", technique="jab", criteria=criteria, scoring_method="RANDOM_SCORE")

    def test_weighted_sum_total_weight_invariant(self):
        """Đối với WEIGHTED_SUM, tổng weight các tiêu chí phải xấp xỉ 1.0."""
        c1 = TechniqueCriterion(id="c1", name="n", description="d", feature_name="f", phase="p", weight=0.5)
        c2 = TechniqueCriterion(id="c2", name="n", description="d", feature_name="f", phase="p", weight=0.2)  # Tổng = 0.7 != 1.0
        with self.assertRaises(ValueError) as cm:
            TechniqueRubric(id="r_bad_w", technique="jab", criteria=[c1, c2])
        self.assertIn("must sum to 1.0", str(cm.exception))

    def test_immutability_and_defensive_copy(self):
        """Bảo đảm rubric là bất biến và biến criteria bên ngoài không thể làm thay đổi rubric."""
        c_list = list(self._create_valid_criteria())
        rubric = TechniqueRubric(id="r_frozen", technique="jab", criteria=c_list)

        # Mutate list ban đầu
        extra_crit = TechniqueCriterion(id="c3", name="n3", description="d", feature_name="f", phase="p", weight=0.1)
        c_list.append(extra_crit)

        # Rubric bên trong không bị ảnh hưởng
        self.assertEqual(len(rubric.criteria), 2)
        self.assertIsInstance(rubric.criteria, tuple)

        # Cố gắng gán thuộc tính rubric
        with self.assertRaises(FrozenInstanceError):
            rubric.version = "9.9.9"
        with self.assertRaises(FrozenInstanceError):
            rubric.martial_art = "karate"


# ─────────────────────────────────────────────────────────────────────────────
# 3. Tests for RubricRegistry
# ─────────────────────────────────────────────────────────────────────────────

class TestRubricRegistry(unittest.TestCase):

    def setUp(self):
        self.registry = RubricRegistry()
        self.criteria = (
            TechniqueCriterion(id="c1", name="n1", description="d", feature_name="f", phase="p", weight=0.7),
            TechniqueCriterion(id="c2", name="n2", description="d", feature_name="f", phase="p", weight=0.3),
        )

    def test_exact_lookup(self):
        """Đăng ký và tra cứu chính xác theo (martial_art, technique, version)."""
        r = TechniqueRubric(
            id="boxing_jab_v1", martial_art="boxing", technique="jab", version="1.0.0", criteria=self.criteria
        )
        self.registry.register(r)

        found = self.registry.get("boxing", "jab", "1.0.0")
        self.assertIsNotNone(found)
        self.assertEqual(found.id, "boxing_jab_v1")

        # Tra cứu theo ID
        found_id = self.registry.get_by_id("boxing_jab_v1")
        self.assertEqual(found_id, r)

    def test_duplicate_key_rejection(self):
        """Từ chối đăng ký rubric trùng canonical key (martial_art, technique, version)."""
        r1 = TechniqueRubric(id="r1", martial_art="boxing", technique="jab", version="1.0.0", criteria=self.criteria)
        r2 = TechniqueRubric(id="r2", martial_art="boxing", technique="jab", version="1.0.0", criteria=self.criteria)
        self.registry.register(r1)

        with self.assertRaises(ValueError) as cm:
            self.registry.register(r2)
        self.assertIn("Duplicate rubric key", str(cm.exception))

    def test_duplicate_id_conflict_rejection(self):
        """Từ chối đăng ký rubric có cùng ID nhưng khác definition."""
        r1 = TechniqueRubric(id="same_id", martial_art="boxing", technique="jab", version="1.0.0", criteria=self.criteria)
        r2 = TechniqueRubric(id="same_id", martial_art="boxing", technique="jab", version="2.0.0", criteria=self.criteria)
        self.registry.register(r1)

        with self.assertRaises(ValueError) as cm:
            self.registry.register(r2)
        self.assertIn("Rubric ID 'same_id' is already registered with a different definition", str(cm.exception))

    def test_unsupported_martial_art(self):
        """Tra cứu môn võ chưa đăng ký trả về status UNSUPPORTED_MARTIAL_ART rõ ràng."""
        ctx = AnalysisContext(martial_art="taekwondo")
        res = self.registry.select_rubric(context=ctx, technique="round_kick")

        self.assertEqual(res.status, RubricSelectionStatus.UNSUPPORTED_MARTIAL_ART)
        self.assertIsNone(res.rubric)
        self.assertEqual(res.requested_martial_art, "taekwondo")
        self.assertIn("No rubrics registered for martial art 'taekwondo'", res.reason)

    def test_unsupported_technique(self):
        """Môn võ có đăng ký nhưng không có kỹ thuật đó trả về UNSUPPORTED_TECHNIQUE."""
        r = TechniqueRubric(id="boxing_jab_v1", martial_art="boxing", technique="jab", version="1.0.0", criteria=self.criteria)
        self.registry.register(r)

        ctx = AnalysisContext(martial_art="boxing")
        res = self.registry.select_rubric(context=ctx, technique="round_kick")

        self.assertEqual(res.status, RubricSelectionStatus.UNSUPPORTED_TECHNIQUE)
        self.assertIsNone(res.rubric)
        self.assertEqual(res.requested_technique, "round_kick")
        self.assertIn("Technique 'round_kick' is not supported for martial art 'boxing'", res.reason)

    def test_version_not_found(self):
        """Phiên bản chỉ định không tồn tại trả về VERSION_NOT_FOUND và danh sách available_versions."""
        r = TechniqueRubric(id="boxing_jab_v1", martial_art="boxing", technique="jab", version="1.0.0", criteria=self.criteria)
        self.registry.register(r)

        ctx = AnalysisContext(martial_art="boxing", requested_rubric_version="9.9.9")
        res = self.registry.select_rubric(context=ctx, technique="jab")

        self.assertEqual(res.status, RubricSelectionStatus.VERSION_NOT_FOUND)
        self.assertIsNone(res.rubric)
        self.assertEqual(res.requested_version, "9.9.9")
        self.assertEqual(res.available_versions, ("1.0.0",))
        self.assertIn("Version '9.9.9' not found", res.reason)

    def test_semantic_version_ordering_and_latest_selection(self):
        """
        Bảo đảm semantic version ordering hoạt động chính xác:
        10.0.0 > 2.0.0 (thay vì sắp xếp chuỗi từ vựng '10.0.0' < '2.0.0').
        Khi omitted version, registry phải tự động chọn 10.0.0.
        """
        r_v1 = TechniqueRubric(id="boxing_jab_v1", martial_art="boxing", technique="jab", version="1.0.0", criteria=self.criteria)
        r_v2 = TechniqueRubric(id="boxing_jab_v2", martial_art="boxing", technique="jab", version="2.0.0", criteria=self.criteria)
        r_v10 = TechniqueRubric(id="boxing_jab_v10", martial_art="boxing", technique="jab", version="10.0.0", criteria=self.criteria)

        self.registry.register(r_v1)
        self.registry.register(r_v2)
        self.registry.register(r_v10)

        # Kiểm tra danh sách versions được sắp xếp theo semver giảm dần
        versions = self.registry.list_available_versions("boxing", "jab")
        self.assertEqual(versions, ("10.0.0", "2.0.0", "1.0.0"))

        # Omitted version -> Phải chọn 10.0.0
        ctx = AnalysisContext(martial_art="boxing")
        res = self.registry.select_rubric(context=ctx, technique="jab")
        self.assertEqual(res.status, RubricSelectionStatus.SELECTED)
        self.assertIsNotNone(res.rubric)
        self.assertEqual(res.rubric.version, "10.0.0")
        self.assertEqual(res.rubric.id, "boxing_jab_v10")

    def test_no_cross_discipline_fallback(self):
        """
        Tuyệt đối KHÔNG fallback sang môn võ khác khi caller đã chỉ định môn võ rõ ràng:
        Ví dụ: yêu cầu 'muay_thai' thì không được âm thầm trả về 'generic' hay 'boxing'.
        """
        r_gen = TechniqueRubric(id="gen_kick", martial_art="generic", technique="round_kick", version="3.0.0", criteria=self.criteria)
        r_box = TechniqueRubric(id="box_jab", martial_art="boxing", technique="jab", version="1.0.0", criteria=self.criteria)
        self.registry.register(r_gen)
        self.registry.register(r_box)

        # Yêu cầu Muay Thai
        ctx = AnalysisContext(martial_art="muay_thai")
        res = self.registry.select_rubric(context=ctx, technique="round_kick")

        self.assertEqual(res.status, RubricSelectionStatus.UNSUPPORTED_MARTIAL_ART)
        self.assertIsNone(res.rubric)
        self.assertNotEqual(res.status, RubricSelectionStatus.SELECTED)

    def test_legacy_path_omitted_context_selects_generic(self):
        """Khi context=None (legacy call), registry tìm trong namespace generic."""
        reg = get_default_rubric_registry()

        res_kick = reg.select_rubric(context=None, technique="round_kick")
        self.assertEqual(res_kick.status, RubricSelectionStatus.SELECTED)
        self.assertEqual(res_kick.rubric.id, "rubric_round_kick_v3")

        res_punch = reg.select_rubric(context=None, technique="punch")
        self.assertEqual(res_punch.status, RubricSelectionStatus.SELECTED)
        self.assertEqual(res_punch.rubric.id, "rubric_punch_v3")

    def test_invalid_context_type_returns_structured_failure(self):
        """Truyền context không phải AnalysisContext trả về INVALID_CONTEXT có cấu trúc."""
        res = self.registry.select_rubric(context="not_a_context", technique="jab")
        self.assertEqual(res.status, RubricSelectionStatus.INVALID_CONTEXT)
        self.assertIsNone(res.rubric)
        self.assertIn("must be an instance of AnalysisContext", res.reason)

    def test_invalid_technique_returns_structured_failure(self):
        """Truyền technique rỗng hoặc sai kiểu trả về INVALID_CONTEXT."""
        res = self.registry.select_rubric(context=None, technique="")
        self.assertEqual(res.status, RubricSelectionStatus.INVALID_CONTEXT)
        self.assertIsNone(res.rubric)


# ─────────────────────────────────────────────────────────────────────────────
# 4. Tests for Compatibility & Assessment Boundary
# ─────────────────────────────────────────────────────────────────────────────

class TestRubricCompatibilityAndBoundary(unittest.TestCase):

    def test_existing_constants_and_imports(self):
        """Các hằng số rubric cũ vẫn hoạt động, có status VALIDATED và namespace generic."""
        self.assertEqual(RUBRIC_ROUND_KICK_V3.id, "rubric_round_kick_v3")
        self.assertEqual(RUBRIC_ROUND_KICK_V3.martial_art, "generic")
        self.assertEqual(RUBRIC_ROUND_KICK_V3.technique, "round_kick")
        self.assertEqual(RUBRIC_ROUND_KICK_V3.version, "3.0.0")
        self.assertEqual(RUBRIC_ROUND_KICK_V3.status, "VALIDATED")

        self.assertEqual(RUBRIC_PUNCH_V3.id, "rubric_punch_v3")
        self.assertEqual(RUBRIC_PUNCH_V3.martial_art, "generic")
        self.assertEqual(RUBRIC_PUNCH_V3.technique, "punch")
        self.assertEqual(RUBRIC_PUNCH_V3.version, "3.0.0")
        self.assertEqual(RUBRIC_PUNCH_V3.status, "VALIDATED")

    def test_action_result_legacy_path_unchanged(self):
        """
        Khi analysis_context=None (legacy path):
        Rubric ID và Version trên ActionResult không thay đổi, bảo đảm zero regression.
        """
        punch = DummyPunch(punch_type="cross", arm="right")
        kick = DummyKick(kick_type="round_kick", leg="right")

        act_punch = action_from_punch(
            punch=punch,
            action_id="action_001",
            source_action_id="punch_1",
            analysis_context=None,
        )
        self.assertEqual(act_punch.assessment.rubricId, "rubric_punch_v3")
        self.assertEqual(act_punch.rubricVersion, "3.0.0")

        act_kick = action_from_kick(
            kick=kick,
            action_id="action_002",
            source_action_id="kick_1",
            analysis_context=None,
        )
        self.assertEqual(act_kick.assessment.rubricId, "rubric_round_kick_v3")
        self.assertEqual(act_kick.rubricVersion, "3.0.0")

    def test_build_actions_list_legacy_path(self):
        """build_actions_list khi không truyền analysis_context chạy tương thích 100%."""
        punches = [DummyPunch()]
        kicks = [DummyKick()]

        actions = build_actions_list(punches=punches, kicks=kicks)
        self.assertEqual(len(actions), 2)
        punch_action = [a for a in actions if a.family == "punch"][0]
        kick_action = [a for a in actions if a.family == "kick"][0]

        self.assertEqual(punch_action.assessment.rubricId, "rubric_punch_v3")
        self.assertEqual(punch_action.rubricVersion, "3.0.0")
        self.assertEqual(kick_action.assessment.rubricId, "rubric_round_kick_v3")
        self.assertEqual(kick_action.rubricVersion, "3.0.0")

    def test_action_result_generic_context(self):
        """Khi truyền AnalysisContext(martial_art='generic'), rubric generic được chọn hợp lệ."""
        ctx = AnalysisContext(martial_art="generic")
        punches = [DummyPunch()]
        kicks = [DummyKick()]

        actions = build_actions_list(punches=punches, kicks=kicks, analysis_context=ctx)
        self.assertEqual(len(actions), 2)
        for a in actions:
            self.assertIn(a.assessment.rubricId, ("rubric_punch_v3", "rubric_round_kick_v3"))

    def test_explicit_unsupported_discipline_raises_boundary_error(self):
        """
        Nếu caller truyền explicit martial art (vd: muay_thai) nhưng hệ thống
        chưa có rubric/evaluator tương ứng, hệ thống phải raise RubricSelectionError,
        tuyệt đối không âm thầm gán generic rubric rồi giả lập assessment của muay_thai.
        """
        ctx = AnalysisContext(martial_art="muay_thai")
        punches = [DummyPunch()]
        kicks = [DummyKick()]

        with self.assertRaises(RubricSelectionError) as cm:
            build_actions_list(punches=punches, kicks=kicks, analysis_context=ctx)
        self.assertIn("no discipline-specific evaluator is integrated in Task 4", str(cm.exception))
        self.assertIsNotNone(cm.exception.selection_result)
        self.assertEqual(cm.exception.selection_result.status, RubricSelectionStatus.UNSUPPORTED_MARTIAL_ART)

    def test_public_action_result_dict_conforms_to_schema_v1(self):
        """
        ActionResult.to_dict() trên output không chứa bất kỳ trường lạ nào
        ngoài schema v1.0.0 (không xuất hiện AnalysisContext hay label_source nội bộ).
        """
        punch = DummyPunch()
        act = action_from_punch(punch=punch, action_id="action_001", source_action_id="punch_1")
        d = act.to_dict()

        expected_keys = {
            "id", "sourceActionId", "family", "technique", "attackingSide",
            "limbRole", "stance", "confidence", "phases", "metrics",
            "assessment", "review", "modelVersion", "rubricVersion",
        }
        self.assertEqual(set(d.keys()), expected_keys)
        self.assertNotIn("analysisContext", d)
        self.assertNotIn("label_source", d)
        self.assertNotIn("labelSource", d)

    def test_no_circular_imports(self):
        """Kiểm tra không bị lỗi circular import khi import chéo giữa các modules trong tiến trình độc lập."""
        import subprocess
        import sys

        code = (
            "import pipeline.analysis_context; "
            "import pipeline.rubric_registry; "
            "import technique_rubric; "
            "import action_result; "
            "import pipeline; "
            "print('OK')"
        )
        proc = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True)
        self.assertEqual(proc.returncode, 0, f"Import failed with stderr: {proc.stderr}")
        self.assertIn("OK", proc.stdout)


# ─────────────────────────────────────────────────────────────────────────────
# 5. Tests for SemVer 2.0.0 Specification
# ─────────────────────────────────────────────────────────────────────────────

class TestSemVerSpecification(unittest.TestCase):
    def test_semver_numeric_ordering(self):
        """10.0.0 > 2.0.0: So sánh số học chính xác, không dùng thứ tự từ điển."""
        v10 = SemVer("10.0.0")
        v2 = SemVer("2.0.0")
        self.assertGreater(v10, v2)
        self.assertLess(v2, v10)
        self.assertTrue(v10 > "2.0.0")

    def test_semver_prerelease_lower_than_release(self):
        """Bản release chính thức có thứ tự ưu tiên cao hơn prerelease: 1.0.0 > 1.0.0-rc.1."""
        rel = SemVer("1.0.0")
        rc = SemVer("1.0.0-rc.1")
        self.assertGreater(rel, rc)
        self.assertLess(rc, rel)

    def test_semver_prerelease_identifiers_precedence(self):
        """Tuân thủ thứ tự ưu tiên các prerelease identifiers theo SemVer 2.0.0 §11."""
        order = [
            "1.0.0-alpha",
            "1.0.0-alpha.1",
            "1.0.0-alpha.beta",
            "1.0.0-beta",
            "1.0.0-beta.2",
            "1.0.0-beta.11",
            "1.0.0-rc.1",
            "1.0.0",
        ]
        parsed = [SemVer(v) for v in order]
        for i in range(len(parsed) - 1):
            self.assertLess(parsed[i], parsed[i + 1], f"Expected {order[i]} < {order[i+1]}")

    def test_semver_build_metadata_neutrality(self):
        """Build metadata không ảnh hưởng đến thứ tự ưu tiên (1.0.0+b1 == 1.0.0+b2 == 1.0.0)."""
        b1 = SemVer("1.0.0+b1")
        b2 = SemVer("1.0.0+b2")
        core = SemVer("1.0.0")
        self.assertEqual(b1, b2)
        self.assertEqual(b1, core)
        self.assertFalse(b1 < b2)
        self.assertFalse(b2 < b1)

    def test_semver_invalid_strings_rejected(self):
        """Từ chối chuỗi version không hợp lệ (banana, 1.0, v1.0.0, 01.0.0, v.v.)."""
        invalid_versions = [
            "banana",
            "1.0",
            "1",
            "1.0.0.0",
            "v1.0.0",
            "01.0.0",
            "1.01.0",
            "1.0.01",
            "1.0.0-01",
            "",
            "   ",
        ]
        for inv in invalid_versions:
            with self.assertRaises(ValueError, msg=f"Should reject: '{inv}'"):
                SemVer(inv)

        with self.assertRaises(TypeError):
            SemVer(123)
        with self.assertRaises(TypeError):
            SemVer(True)


# ─────────────────────────────────────────────────────────────────────────────
# 6. Tests for Rubric Registry Sealing and Governance
# ─────────────────────────────────────────────────────────────────────────────

class TestRubricRegistrySealingAndGovernance(unittest.TestCase):
    def setUp(self):
        self.criteria = (
            TechniqueCriterion(id="c1", name="n1", description="d", feature_name="f", phase="p", weight=1.0),
        )

    def test_default_registry_is_frozen(self):
        """Default registry toàn cục phải bị đóng băng (is_frozen=True) và chống mutation/poisoning."""
        reg = get_default_rubric_registry()
        self.assertTrue(reg.is_frozen)

        new_rubric = TechniqueRubric(
            id="poison_rubric", martial_art="boxing", technique="jab", version="1.0.0", criteria=self.criteria
        )
        with self.assertRaises(RuntimeError) as cm:
            reg.register(new_rubric)
        self.assertIn("sealed/frozen", str(cm.exception))

    def test_clone_allows_mutation_and_isolation(self):
        """Caller có thể clone registry để mở khóa và đăng ký rubric riêng mà không ảnh hưởng default."""
        default_reg = get_default_rubric_registry()
        cloned = default_reg.clone()
        self.assertFalse(cloned.is_frozen)

        custom = TechniqueRubric(
            id="custom_boxing_jab", martial_art="boxing", technique="jab", version="1.0.0", criteria=self.criteria
        )
        cloned.register(custom)

        self.assertIsNotNone(cloned.get("boxing", "jab", "1.0.0"))
        # Registry mặc định hoàn toàn không bị ảnh hưởng
        self.assertIsNone(default_reg.get("boxing", "jab", "1.0.0"))

    def test_register_semantic_duplicate_rejected(self):
        """Từ chối đăng ký hai phiên bản tương đương ngữ nghĩa (semantic duplicate) cho cùng (martial_art, technique)."""
        reg = RubricRegistry()
        r1 = TechniqueRubric(
            id="r_b1", martial_art="boxing", technique="jab", version="1.0.0+build1", criteria=self.criteria
        )
        r2 = TechniqueRubric(
            id="r_b2", martial_art="boxing", technique="jab", version="1.0.0+build2", criteria=self.criteria
        )
        reg.register(r1)
        with self.assertRaises(ValueError) as cm:
            reg.register(r2)
        self.assertIn("Semantic duplicate version", str(cm.exception))

    def test_latest_selection_picks_only_validated(self):
        """Latest selection chỉ chọn VALIDATED rubric. DRAFT và DEPRECATED không được chọn."""
        reg = RubricRegistry()
        r_val = TechniqueRubric(
            id="r_val", martial_art="boxing", technique="jab", version="1.0.0", status="VALIDATED", criteria=self.criteria
        )
        r_draft = TechniqueRubric(
            id="r_draft", martial_art="boxing", technique="jab", version="2.0.0", status="DRAFT", criteria=self.criteria
        )
        r_dep = TechniqueRubric(
            id="r_dep", martial_art="boxing", technique="jab", version="3.0.0", status="DEPRECATED", criteria=self.criteria
        )
        reg.register(r_val)
        reg.register(r_draft)
        reg.register(r_dep)

        ctx = AnalysisContext(martial_art="boxing")
        res = reg.select_rubric(context=ctx, technique="jab")
        self.assertEqual(res.status, RubricSelectionStatus.SELECTED)
        self.assertEqual(res.rubric.id, "r_val")
        self.assertEqual(res.rubric.version, "1.0.0")

    def test_latest_selection_returns_not_selectable_when_no_validated(self):
        """Khi chỉ có DRAFT và DEPRECATED, latest selection trả về RUBRIC_NOT_SELECTABLE có cấu trúc."""
        reg = RubricRegistry()
        r_draft = TechniqueRubric(
            id="r_draft", martial_art="boxing", technique="jab", version="1.0.0", status="DRAFT", criteria=self.criteria
        )
        r_dep = TechniqueRubric(
            id="r_dep", martial_art="boxing", technique="jab", version="2.0.0", status="DEPRECATED", criteria=self.criteria
        )
        reg.register(r_draft)
        reg.register(r_dep)

        ctx = AnalysisContext(martial_art="boxing")
        res = reg.select_rubric(context=ctx, technique="jab")
        self.assertEqual(res.status, RubricSelectionStatus.RUBRIC_NOT_SELECTABLE)
        self.assertIsNone(res.rubric)
        self.assertIn("No VALIDATED rubrics available", res.reason)

    def test_exact_selection_draft_protection(self):
        """Exact query cho DRAFT rubric: bị từ chối trừ khi allow_draft=True."""
        reg = RubricRegistry()
        r_draft = TechniqueRubric(
            id="r_draft", martial_art="boxing", technique="jab", version="1.0.0", status="DRAFT", criteria=self.criteria
        )
        reg.register(r_draft)

        ctx = AnalysisContext(martial_art="boxing", requested_rubric_version="1.0.0")
        res_blocked = reg.select_rubric(context=ctx, technique="jab", allow_draft=False)
        self.assertEqual(res_blocked.status, RubricSelectionStatus.RUBRIC_NOT_SELECTABLE)
        self.assertIsNone(res_blocked.rubric)

        res_allowed = reg.select_rubric(context=ctx, technique="jab", allow_draft=True)
        self.assertEqual(res_allowed.status, RubricSelectionStatus.SELECTED)
        self.assertIsNotNone(res_allowed.rubric)


# ─────────────────────────────────────────────────────────────────────────────
# 7. Tests for TechniqueRubric Invariants & Provenance Protection
# ─────────────────────────────────────────────────────────────────────────────

class TestTechniqueRubricValidationAndProvenance(unittest.TestCase):
    def setUp(self):
        self.criteria = (
            TechniqueCriterion(id="c1", name="n1", description="d", feature_name="f", phase="p", weight=1.0),
        )

    def test_martial_art_taxonomy_validation(self):
        """TechniqueRubric từ chối martial_art không thuộc taxonomy."""
        with self.assertRaises(ValueError) as cm:
            TechniqueRubric(id="r1", martial_art="shaolin_kung_fu", technique="palm", criteria=self.criteria)
        self.assertIn("not recognized in martial art taxonomy", str(cm.exception))

    def test_version_semver_validation(self):
        """TechniqueRubric từ chối version không tuân thủ strict SemVer 2.0.0."""
        with self.assertRaises(ValueError) as cm:
            TechniqueRubric(id="r1", technique="jab", version="banana", criteria=self.criteria)
        self.assertIn("not a valid SemVer 2.0.0 string", str(cm.exception))

        with self.assertRaises(ValueError) as cm:
            TechniqueRubric(id="r2", technique="jab", version="1.0", criteria=self.criteria)
        self.assertIn("not a valid SemVer 2.0.0 string", str(cm.exception))

    def test_technique_identifier_regex(self):
        """TechniqueRubric chỉ chấp nhận technique identifier khớp ^[a-z][a-z0-9_]*$."""
        with self.assertRaises(ValueError) as cm:
            TechniqueRubric(id="r1", technique="Round-Kick", criteria=self.criteria)
        self.assertIn("is invalid", str(cm.exception))

        with self.assertRaises(ValueError) as cm:
            TechniqueRubric(id="r2", technique="1kick", criteria=self.criteria)
        self.assertIn("is invalid", str(cm.exception))

    def test_technique_type_alias_type_safety(self):
        """TechniqueRubric từ chối non-string technique ngay cả khi technique_type được cung cấp."""
        with self.assertRaises(TypeError):
            TechniqueRubric(id="r1", technique=12345, technique_type="jab", criteria=self.criteria)

    def test_source_type_validation(self):
        """TechniqueRubric từ chối source_type không hợp lệ."""
        with self.assertRaises(ValueError):
            TechniqueRubric(id="r1", technique="jab", source_type="INVALID_SOURCE", criteria=self.criteria)

    def test_expert_reference_validation(self):
        """TechniqueRubric từ chối expert_reference rỗng."""
        with self.assertRaises(ValueError):
            TechniqueRubric(id="r1", technique="jab", expert_reference="", criteria=self.criteria)

    def test_action_from_punch_blocks_false_provenance(self):
        """action_from_punch từ chối gán metadata của discipline khác khi chưa có evaluator."""
        punch = DummyPunch()
        ctx = AnalysisContext(martial_art="boxing")
        with self.assertRaises(RubricSelectionError) as cm:
            action_from_punch(punch=punch, action_id="action_001", source_action_id="punch_1", analysis_context=ctx)
        self.assertIn("no discipline-specific evaluator is integrated in Task 4", str(cm.exception))

    def test_action_from_kick_blocks_false_provenance(self):
        """action_from_kick từ chối gán metadata của discipline khác khi chưa có evaluator."""
        kick = DummyKick()
        ctx = AnalysisContext(martial_art="muay_thai")
        with self.assertRaises(RubricSelectionError) as cm:
            action_from_kick(kick=kick, action_id="action_001", source_action_id="kick_1", analysis_context=ctx)
        self.assertIn("no discipline-specific evaluator is integrated in Task 4", str(cm.exception))

    def test_rubric_version_override_mismatch_rejected(self):
        """action_from_punch và action_from_kick từ chối rubric_version override sai lệch so với rubric thực sự."""
        punch = DummyPunch()
        with self.assertRaises(ValueError) as cm:
            action_from_punch(punch=punch, action_id="action_001", source_action_id="punch_1", rubric_version="9.9.9")
        self.assertIn("conflicts with actual evaluated rubric version", str(cm.exception))

        kick = DummyKick()
        with self.assertRaises(ValueError) as cm:
            action_from_kick(kick=kick, action_id="action_001", source_action_id="kick_1", rubric_version="1.0.0")
        self.assertIn("conflicts with actual evaluated rubric version", str(cm.exception))


# ─────────────────────────────────────────────────────────────────────────────
# 8. Tests for Process Boundary Fail-Fast
# ─────────────────────────────────────────────────────────────────────────────

class TestProcessBoundaryFailFast(unittest.TestCase):
    def test_conflicting_context_and_cli_martial_art(self):
        """process_video fail-fast ngay lập tức nếu analysis_context và martial_art xung đột."""
        ctx = AnalysisContext(martial_art="boxing")
        with self.assertRaises(ValueError) as cm:
            process_video(input_path="dummy.mp4", analysis_context=ctx, martial_art="muay_thai")
        self.assertIn("Conflicting martial_art specification", str(cm.exception))

    def test_unsupported_discipline_fail_fast_before_inference(self):
        """process_video fail-fast trước khi load model/video nếu discipline chưa có evaluator."""
        with self.assertRaises(RubricSelectionError) as cm:
            process_video(input_path="dummy.mp4", martial_art="boxing")
        self.assertIn("No discipline-specific evaluator is integrated in Task 4", str(cm.exception))


# ─────────────────────────────────────────────────────────────────────────────
# 9. Tests for Task 4 Acceptance Patch Probes
# ─────────────────────────────────────────────────────────────────────────────

class TestTask4AcceptancePatch(unittest.TestCase):
    """
    Suite kiểm thử chuyên sâu cho Acceptance Patch Task 4:
    1. Đồng nhất behavior cho unknown/generic/omitted giữa Registry và Adapter.
    2. Deep-freeze default registry (MappingProxyType, tuple collections, immutability, clone).
    3. DEPRECATED và DRAFT governance (strict bool flags, selection barriers).
    4. Pre-strip type validation (không bao giờ leak AttributeError).
    5. Process boundary fail-fast probes.
    6. Zero circular imports qua subprocess multi-order loading.
    """

    def setUp(self):
        self.default_reg = get_default_rubric_registry()
        self.dummy_punch = DummyPunch()
        self.dummy_kick = DummyKick()

    # ── 1. Đồng nhất behavior cho unknown/generic/omitted ──
    def test_uniform_policy_parity_between_registry_and_adapter(self):
        """
        Kiểm tra tính nhất quán 100% giữa RubricRegistry và Action Adapters:
        - context is None -> Generic path (RUBRIC_PUNCH_V3 / RUBRIC_ROUND_KICK_V3)
        - martial_art is None -> Generic path
        - martial_art == 'generic' -> Generic path
        - martial_art == 'unknown' -> UNSUPPORTED_MARTIAL_ART trong registry và RubricSelectionError trong adapter
        - martial_art == 'boxing' -> RubricSelectionError trong adapter
        """
        # A. context is None
        reg_res = self.default_reg.select_rubric(context=None, technique="punch")
        self.assertEqual(reg_res.status, RubricSelectionStatus.SELECTED)
        self.assertEqual(reg_res.rubric.id, RUBRIC_PUNCH_V3.id)

        act_p = action_from_punch(self.dummy_punch, "action_001", "punch_1", analysis_context=None)
        self.assertEqual(act_p.assessment.rubricId, RUBRIC_PUNCH_V3.id)
        self.assertEqual(act_p.rubricVersion, RUBRIC_PUNCH_V3.version)

        act_k = action_from_kick(self.dummy_kick, "action_002", "kick_1", analysis_context=None)
        self.assertEqual(act_k.assessment.rubricId, RUBRIC_ROUND_KICK_V3.id)
        self.assertEqual(act_k.rubricVersion, RUBRIC_ROUND_KICK_V3.version)

        # B. context.martial_art is None
        ctx_omitted = AnalysisContext(camera_view="front")
        self.assertIsNone(ctx_omitted.martial_art)
        reg_res_omitted = self.default_reg.select_rubric(context=ctx_omitted, technique="punch")
        self.assertEqual(reg_res_omitted.status, RubricSelectionStatus.SELECTED)
        self.assertEqual(reg_res_omitted.rubric.id, RUBRIC_PUNCH_V3.id)

        act_p_omitted = action_from_punch(self.dummy_punch, "action_001", "punch_1", analysis_context=ctx_omitted)
        self.assertEqual(act_p_omitted.assessment.rubricId, RUBRIC_PUNCH_V3.id)

        # C. context.martial_art == 'generic'
        ctx_generic = AnalysisContext(martial_art="generic")
        reg_res_generic = self.default_reg.select_rubric(context=ctx_generic, technique="punch")
        self.assertEqual(reg_res_generic.status, RubricSelectionStatus.SELECTED)
        self.assertEqual(reg_res_generic.rubric.id, RUBRIC_PUNCH_V3.id)

        act_p_gen = action_from_punch(self.dummy_punch, "action_001", "punch_1", analysis_context=ctx_generic)
        self.assertEqual(act_p_gen.assessment.rubricId, RUBRIC_PUNCH_V3.id)

        # D. context.martial_art == 'unknown'
        ctx_unknown = AnalysisContext(martial_art="unknown")
        reg_res_unknown = self.default_reg.select_rubric(context=ctx_unknown, technique="punch")
        self.assertEqual(reg_res_unknown.status, RubricSelectionStatus.UNSUPPORTED_MARTIAL_ART)
        self.assertIn("unknown", reg_res_unknown.reason)

        with self.assertRaises(RubricSelectionError) as cm_p:
            action_from_punch(self.dummy_punch, "action_001", "punch_1", analysis_context=ctx_unknown)
        self.assertIn("unknown", str(cm_p.exception))
        self.assertIsNotNone(cm_p.exception.selection_result)
        self.assertEqual(cm_p.exception.selection_result.status, RubricSelectionStatus.UNSUPPORTED_MARTIAL_ART)

        with self.assertRaises(RubricSelectionError) as cm_k:
            action_from_kick(self.dummy_kick, "action_002", "kick_1", analysis_context=ctx_unknown)
        self.assertIn("unknown", str(cm_k.exception))
        self.assertIsNotNone(cm_k.exception.selection_result)
        self.assertEqual(cm_k.exception.selection_result.status, RubricSelectionStatus.UNSUPPORTED_MARTIAL_ART)

        # E. context.martial_art == 'boxing' (discipline-aware without evaluator)
        ctx_boxing = AnalysisContext(martial_art="boxing")
        with self.assertRaises(RubricSelectionError) as cm_box:
            action_from_punch(self.dummy_punch, "action_001", "punch_1", analysis_context=ctx_boxing)
        self.assertIn("no discipline-specific evaluator is integrated in Task 4", str(cm_box.exception))

    # ── 2. Deep-freeze default registry ──
    def test_deep_freeze_adversarial_tampering(self):
        """
        Deep-freeze ngăn chặn triệt để mọi hành vi sửa đổi dữ liệu của default registry:
        - MappingProxyType cấm gán item, pop, clear
        - Version collections là immutable tuples
        - Thao tác gán _frozen = False không bypass được MappingProxyType
        - clone() tạo bản sao hoàn toàn độc lập và mutable
        """
        reg = self.default_reg
        self.assertTrue(reg.is_frozen)
        self.assertIsInstance(reg._rubrics_by_key, MappingProxyType)
        self.assertIsInstance(reg._rubrics_by_id, MappingProxyType)
        self.assertIsInstance(reg._versions_by_art_tech, MappingProxyType)

        # Thử mutate mapping trực tiếp
        with self.assertRaises(TypeError):
            reg._rubrics_by_key[("generic", "punch", "9.9.9")] = RUBRIC_PUNCH_V3

        with self.assertRaises(TypeError):
            reg._rubrics_by_id["fake_id"] = RUBRIC_PUNCH_V3

        with self.assertRaises(TypeError):
            reg._versions_by_art_tech[("generic", "punch")] = ("9.9.9",)

        with self.assertRaises(AttributeError):
            reg._rubrics_by_key.clear()

        # Thử mutate version tuple
        versions = reg._versions_by_art_tech[("generic", "punch")]
        self.assertIsInstance(versions, tuple)
        with self.assertRaises(AttributeError):
            versions.append("9.9.9")

        # Thử bypass bằng cách đổi _frozen = False
        original_frozen = reg._frozen
        try:
            reg._frozen = False
            # Dù _frozen = False, register() vẫn chặn vì internal structures là MappingProxyType
            fake_rubric = TechniqueRubric(
                id="fake_punch",
                technique="punch",
                version="9.9.9",
                criteria=[TechniqueCriterion(id="c1", name="C1", description="d", feature_name="f", phase="p", weight=1.0, required_confidence=0.5)],
            )
            with self.assertRaises((RuntimeError, TypeError)):
                reg.register(fake_rubric)
        finally:
            reg._frozen = original_frozen

        # Kiểm tra snapshots trả về là tuple bất biến
        self.assertIsInstance(reg.list_registered_rubrics(), tuple)
        self.assertIsInstance(reg.list_versions("generic", "punch"), tuple)
        self.assertIsInstance(reg.list_techniques("generic"), tuple)
        self.assertIsInstance(reg.list_martial_arts(), tuple)

        # Kiểm tra clone()
        clone_reg = reg.clone()
        self.assertFalse(clone_reg.is_frozen)
        new_rubric = TechniqueRubric(
            id="custom_round_kick_v4",
            technique="round_kick",
            version="4.0.0",
            criteria=[TechniqueCriterion(id="c1", name="C1", description="d", feature_name="f", phase="p", weight=1.0, required_confidence=0.5)],
        )
        clone_reg.register(new_rubric)
        self.assertIn("4.0.0", clone_reg.list_versions("generic", "round_kick"))
        self.assertNotIn("4.0.0", reg.list_versions("generic", "round_kick"))

    # ── 3. DEPRECATED và DRAFT governance ──
    def test_draft_and_deprecated_governance(self):
        """
        Kiểm tra quản trị trạng thái lifecycle của rubric:
        - DRAFT cần allow_draft=True
        - DEPRECATED cần allow_deprecated_for_replay=True
        - Latest query chỉ chọn VALIDATED, không để DRAFT/DEPRECATED thắng
        - Cờ boolean phải là strict bool (reject non-bools với TypeError)
        """
        reg = RubricRegistry()
        crit = [TechniqueCriterion(id="c1", name="C1", description="d", feature_name="f", phase="p", weight=1.0, required_confidence=0.5)]

        r_dep = TechniqueRubric(id="r_dep", martial_art="generic", technique="punch", version="1.0.0", status="DEPRECATED", criteria=crit)
        r_val = TechniqueRubric(id="r_val", martial_art="generic", technique="punch", version="2.0.0", status="VALIDATED", criteria=crit)
        r_drf = TechniqueRubric(id="r_drf", martial_art="generic", technique="punch", version="3.0.0-draft", status="DRAFT", criteria=crit)

        reg.register(r_dep)
        reg.register(r_val)
        reg.register(r_drf)

        # 1. Latest query (version=None) -> chỉ chọn version VALIDATED cao nhất (2.0.0)
        res_latest = reg.select_rubric(context=None, technique="punch")
        self.assertEqual(res_latest.status, RubricSelectionStatus.SELECTED)
        self.assertEqual(res_latest.rubric.version, "2.0.0")

        # 2. Query exact DRAFT không có allow_draft=True -> RUBRIC_NOT_SELECTABLE
        res_drf_blocked = reg.select_rubric(context=None, technique="punch", version="3.0.0-draft", allow_draft=False)
        self.assertEqual(res_drf_blocked.status, RubricSelectionStatus.RUBRIC_NOT_SELECTABLE)
        self.assertIn("DRAFT", res_drf_blocked.reason)

        res_drf_allowed = reg.select_rubric(context=None, technique="punch", version="3.0.0-draft", allow_draft=True)
        self.assertEqual(res_drf_allowed.status, RubricSelectionStatus.SELECTED)
        self.assertEqual(res_drf_allowed.rubric.version, "3.0.0-draft")

        # 3. Query exact DEPRECATED không có allow_deprecated_for_replay=True -> RUBRIC_NOT_SELECTABLE
        res_dep_blocked = reg.select_rubric(context=None, technique="punch", version="1.0.0", allow_deprecated_for_replay=False)
        self.assertEqual(res_dep_blocked.status, RubricSelectionStatus.RUBRIC_NOT_SELECTABLE)
        self.assertIn("DEPRECATED", res_dep_blocked.reason)

        res_dep_allowed = reg.select_rubric(context=None, technique="punch", version="1.0.0", allow_deprecated_for_replay=True)
        self.assertEqual(res_dep_allowed.status, RubricSelectionStatus.SELECTED)
        self.assertEqual(res_dep_allowed.rubric.version, "1.0.0")

        # 4. Strict bool validation: reject non-bool flags with TypeError
        with self.assertRaises(TypeError):
            reg.select_rubric(context=None, technique="punch", allow_draft=1)

        with self.assertRaises(TypeError):
            reg.select_rubric(context=None, technique="punch", allow_draft="True")

        with self.assertRaises(TypeError):
            reg.select_rubric(context=None, technique="punch", allow_deprecated_for_replay=1)

        with self.assertRaises(TypeError):
            reg.select_rubric(context=None, technique="punch", allow_deprecated_for_replay="yes")

    # ── 4. Pre-strip type validation ──
    def test_pre_strip_type_validation_zero_attribute_error(self):
        """
        Validate kiểu dữ liệu trước khi gọi .strip():
        - Registry trả về INVALID_CONTEXT (không leak AttributeError)
        - Adapter trả về TypeError / ValueError (không leak AttributeError)
        """
        reg = self.default_reg

        # A. Registry.select_rubric với các giá trị non-string
        for invalid_val in [123, True, False, 3.14, [], {}]:
            res_tech = reg.select_rubric(context=None, technique=invalid_val)
            self.assertEqual(res_tech.status, RubricSelectionStatus.INVALID_CONTEXT)

            res_ver = reg.select_rubric(context=None, technique="punch", version=invalid_val)
            self.assertEqual(res_ver.status, RubricSelectionStatus.INVALID_CONTEXT)

        # Empty / whitespace strings
        self.assertEqual(reg.select_rubric(context=None, technique="").status, RubricSelectionStatus.INVALID_CONTEXT)
        self.assertEqual(reg.select_rubric(context=None, technique="   ").status, RubricSelectionStatus.INVALID_CONTEXT)
        self.assertEqual(reg.select_rubric(context=None, technique="punch", version="").status, RubricSelectionStatus.INVALID_CONTEXT)
        self.assertEqual(reg.select_rubric(context=None, technique="punch", version="   ").status, RubricSelectionStatus.INVALID_CONTEXT)

        # Invalid context
        self.assertEqual(reg.select_rubric(context="not_a_context", technique="punch").status, RubricSelectionStatus.INVALID_CONTEXT)

        # B. Adapter type checking (action_from_punch / action_from_kick / build_actions_list)
        for invalid_ver in [123, True, False, []]:
            with self.assertRaises(TypeError):
                action_from_punch(self.dummy_punch, "action_001", "punch_1", rubric_version=invalid_ver)
            with self.assertRaises(TypeError):
                action_from_kick(self.dummy_kick, "action_002", "kick_1", rubric_version=invalid_ver)
            with self.assertRaises(TypeError):
                build_actions_list(punches=[self.dummy_punch], kicks=[], rubric_version=invalid_ver)

        # Whitespace / empty rubric_version
        with self.assertRaises(ValueError):
            action_from_punch(self.dummy_punch, "action_001", "punch_1", rubric_version="")
        with self.assertRaises(ValueError):
            action_from_punch(self.dummy_punch, "action_001", "punch_1", rubric_version="   ")

        # Invalid analysis_context type to adapter
        for invalid_ctx in ["invalid_context_str", 123, True]:
            with self.assertRaises(TypeError):
                action_from_punch(self.dummy_punch, "action_001", "punch_1", analysis_context=invalid_ctx)
            with self.assertRaises(TypeError):
                action_from_kick(self.dummy_kick, "action_002", "kick_1", analysis_context=invalid_ctx)
            with self.assertRaises(TypeError):
                build_actions_list(punches=[self.dummy_punch], kicks=[], analysis_context=invalid_ctx)

    # ── 5. Process boundary fail-fast probes ──
    def test_process_video_boundary_probes(self):
        """
        Kiểm tra ranh giới fail-fast của process_video:
        - Type checking cho analysis_context và martial_art
        - Điền omitted martial_art khi context.martial_art is None
        - Báo xung đột ValueError khi cả 2 non-None và khác nhau
        - Fail-fast với RubricSelectionError khi martial_art là unknown hoặc discipline-aware
        """
        # Invalid analysis_context type
        with self.assertRaises(TypeError) as cm:
            process_video(input_path="dummy.mp4", analysis_context="not_a_context")
        self.assertIn("analysis_context must be an AnalysisContext instance or None", str(cm.exception))

        # Invalid martial_art argument type
        with self.assertRaises(TypeError):
            process_video(input_path="dummy.mp4", martial_art=123)
        with self.assertRaises(TypeError):
            process_video(input_path="dummy.mp4", martial_art=True)

        # context.martial_art is None + CLI martial_art="boxing" -> fills omitted field -> fail-fast discipline-aware
        ctx_omitted = AnalysisContext(camera_view="front")
        with self.assertRaises(RubricSelectionError) as cm_box:
            process_video(input_path="dummy.mp4", analysis_context=ctx_omitted, martial_art="boxing")
        self.assertIn("No discipline-specific evaluator is integrated in Task 4", str(cm_box.exception))

        # context.martial_art is None + CLI martial_art="unknown" -> fills omitted -> fail-fast unknown
        with self.assertRaises(RubricSelectionError) as cm_unk:
            process_video(input_path="dummy.mp4", analysis_context=ctx_omitted, martial_art="unknown")
        self.assertIn("Martial art is 'unknown'", str(cm_unk.exception))

        # Explicit martial_art="unknown" in context
        ctx_unknown = AnalysisContext(martial_art="unknown")
        with self.assertRaises(RubricSelectionError) as cm_unk2:
            process_video(input_path="dummy.mp4", analysis_context=ctx_unknown)
        self.assertIn("Martial art is 'unknown'", str(cm_unk2.exception))

        # Explicit martial_art="unknown" in CLI
        with self.assertRaises(RubricSelectionError) as cm_unk3:
            process_video(input_path="dummy.mp4", martial_art="unknown")
        self.assertIn("Martial art is 'unknown'", str(cm_unk3.exception))

        # Conflicting context and CLI
        ctx_gen = AnalysisContext(martial_art="generic")
        with self.assertRaises(ValueError) as cm_conf:
            process_video(input_path="dummy.mp4", analysis_context=ctx_gen, martial_art="boxing")
        self.assertIn("Conflicting martial_art specification", str(cm_conf.exception))

    # ── 6. Zero circular imports qua subprocess ──
    def test_zero_circular_imports(self):
        """
        Đảm bảo không có circular imports giữa các module ở bất kỳ thứ tự import nào.
        Chạy qua subprocess để đảm bảo module cache không che giấu lỗi import.
        """
        import_scenarios = [
            "import rubric_primitives, technique_rubric, action_result, pipeline, process_video",
            "import process_video, action_result, technique_rubric, pipeline",
            "import technique_rubric, rubric_primitives, pipeline, action_result",
            "from pipeline import *; from action_result import *; from technique_rubric import *",
            "from action_result import *; from pipeline import *; import rubric_primitives",
        ]

        for code in import_scenarios:
            result = subprocess.run(
                [sys.executable, "-c", code],
                capture_output=True,
                text=True,
                cwd=Path(__file__).resolve().parent,
            )
            self.assertEqual(
                result.returncode,
                0,
                f"Import scenario failed with returncode {result.returncode}:\nCommand: {code}\nStderr:\n{result.stderr}",
            )
            self.assertEqual(result.stderr.strip(), "")


if __name__ == "__main__":
    unittest.main()

