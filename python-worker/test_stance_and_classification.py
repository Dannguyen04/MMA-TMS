"""
test_stance_and_classification.py — MMA-TMS Task 3 Unit & Integration Tests

Bộ kiểm thử toàn diện cho Task 3:
1. Normalization & Resolution: normalize_stance, resolve_limb_role.
2. StanceContext & 5-tier Precedence:
   - coach_declared -> user_declared -> athlete_profile -> visual_estimate -> unknown.
   - Non-blocking fallbacks (unknown, rỗng, invalid không chặn fallback).
   - is_authoritative flags (True cho coach/user hợp lệ; False cho profile, visual, unknown).
   - Switch stance không tạo lead/rear.
3. Classification Boundary & ClassifiedTechnique:
   - classify_punch và classify_kick tạo ClassifiedTechnique.
   - label_source nội bộ ("legacy_detector_label"), không lọt ra ActionResult v1.0.0.
4. Mandatory Technical Debt Test (Requirement 9):
   - Southpaw + right hand legacy Cross -> technique "cross", limbRole "lead", confidence None.
5. Build actions list conflict resolution:
   - stance_context ưu tiên tuyệt đối so với tham số stance cũ.
   - Fallback đúng khi thiếu hoặc unknown.
6. Adapter single source of truth (Requirement 10).
7. Circular import prevention.
"""

import unittest
from typing import Any

from pipeline.stance_context import (
    StanceType,
    StanceSource,
    StanceContext,
    VALID_STANCES,
    normalize_stance,
    normalize_attacking_side,
    resolve_limb_role,
    resolve_stance_context,
)
from pipeline.classification import (
    ClassifiedTechnique,
    classify_punch,
    classify_kick,
)
from action_result import (
    ActionResult,
    action_from_punch,
    action_from_kick,
    build_actions_list,
)


class DummyFinding:
    def __init__(self, action_id: str = "punch_1", model_version: str = "yolov8n-pose"):
        self.action_id = action_id
        self.model_version = model_version

    def to_dict(self) -> dict[str, Any]:
        return {
            "actionId": self.action_id,
            "modelVersion": self.model_version,
            "ruleId": "rule_test",
            "evidenceFrame": 10,
            "evidenceTimeMs": 333.3,
            "confidence": 0.9,
            "severity": "info",
            "message": "test finding",
        }


class DummyPunch:
    def __init__(self, arm: str = "right", punch_type: str = "cross"):
        self.arm = arm
        self.punch_type = punch_type
        self.start_frame = 5
        self.impact_frame = 10
        self.end_frame = 15
        self.start_time_ms = 166.7
        self.impact_time_ms = 333.3
        self.end_time_ms = 500.0
        self.score = 85
        self.grade = "GOOD"
        self.max_elbow_angle = 155.0
        self.peak_speed = 1.25
        self.guard_preserved = True
        self.criterion_results = []
        self.findings = [DummyFinding("punch_1")]


class DummyKick:
    def __init__(self, active_leg: str = "right", kick_type: str = "round_kick"):
        self.active_leg = active_leg
        self.kick_type = kick_type
        self.start_frame = 10
        self.chamber_peak_frame = 15
        self.impact_frame = 20
        self.end_frame = 25
        self.start_time_ms = 333.3
        self.chamber_peak_time_ms = 500.0
        self.impact_time_ms = 666.7
        self.end_time_ms = 833.3
        self.score = 90
        self.grade = "EXCELLENT"
        self.min_chamber_angle = 65.0
        self.max_extension_angle = 165.0
        self.peak_speed = 2.1
        self.criterion_results = []
        self.findings = [DummyFinding("kick_1")]


class TestStanceNormalizationAndLimbRole(unittest.TestCase):
    """Kiểm tra normalize_stance và resolve_limb_role."""

    def test_normalize_stance(self):
        self.assertEqual(normalize_stance("  ORTHODOX  "), "orthodox")
        self.assertEqual(normalize_stance("\tSoUtHpAw\n"), "southpaw")
        self.assertEqual(normalize_stance("Switch"), "switch")
        self.assertEqual(normalize_stance("  UNKNOWN  "), "unknown")
        self.assertEqual(normalize_stance("karate_stance"), "unknown")
        self.assertEqual(normalize_stance(None), "unknown")
        self.assertEqual(normalize_stance(""), "unknown")

    def test_normalize_attacking_side(self):
        self.assertEqual(normalize_attacking_side("  LEFT  "), "left")
        self.assertEqual(normalize_attacking_side("right\n"), "right")
        self.assertEqual(normalize_attacking_side("front"), "unknown")
        self.assertEqual(normalize_attacking_side(None), "unknown")

    def test_resolve_limb_role(self):
        # Orthodox
        self.assertEqual(resolve_limb_role("left", "orthodox"), "lead")
        self.assertEqual(resolve_limb_role("right", "orthodox"), "rear")

        # Southpaw
        self.assertEqual(resolve_limb_role("right", "southpaw"), "lead")
        self.assertEqual(resolve_limb_role("left", "southpaw"), "rear")

        # Switch stance không tạo lead/rear
        self.assertEqual(resolve_limb_role("left", "switch"), "unknown")
        self.assertEqual(resolve_limb_role("right", "switch"), "unknown")

        # Unknown / Invalid stance
        self.assertEqual(resolve_limb_role("left", "unknown"), "unknown")
        self.assertEqual(resolve_limb_role("right", "karate"), "unknown")
        self.assertEqual(resolve_limb_role("unknown", "orthodox"), "unknown")


class TestStanceContextPrecedence(unittest.TestCase):
    """Kiểm tra thứ tự ưu tiên 5 tầng trong resolve_stance_context."""

    def test_coach_declared_takes_highest_priority(self):
        ctx = resolve_stance_context(
            coach_stance="orthodox",
            user_stance="southpaw",
            athlete_profile_stance="switch",
            visual_estimate_stance="orthodox",
            visual_estimate_confidence=0.9,
        )
        self.assertEqual(ctx.resolved_stance, "orthodox")
        self.assertEqual(ctx.source, StanceSource.COACH_DECLARED.value)
        self.assertIsNone(ctx.confidence)
        self.assertTrue(ctx.is_authoritative)

    def test_coach_invalid_or_unknown_falls_back_to_user(self):
        # Giá trị "unknown", rỗng hoặc không hợp lệ không chặn fallback xuống user
        for invalid_coach in ["unknown", "  ", "", "invalid_val", None]:
            ctx = resolve_stance_context(
                coach_stance=invalid_coach,
                user_stance="southpaw",
            )
            self.assertEqual(ctx.resolved_stance, "southpaw")
            self.assertEqual(ctx.source, StanceSource.USER_DECLARED.value)
            self.assertIsNone(ctx.confidence)
            self.assertTrue(ctx.is_authoritative)

    def test_user_invalid_or_unknown_falls_back_to_athlete_profile(self):
        ctx = resolve_stance_context(
            coach_stance=None,
            user_stance="unknown",
            athlete_profile_stance="switch",
        )
        self.assertEqual(ctx.resolved_stance, "switch")
        self.assertEqual(ctx.source, StanceSource.ATHLETE_PROFILE.value)
        self.assertIsNone(ctx.confidence)
        self.assertFalse(ctx.is_authoritative)  # Athlete profile is False in Task 3

    def test_athlete_profile_falls_back_to_visual_estimate(self):
        ctx = resolve_stance_context(
            coach_stance=None,
            user_stance="",
            athlete_profile_stance=None,
            visual_estimate_stance="orthodox",
            visual_estimate_confidence=0.85,
        )
        self.assertEqual(ctx.resolved_stance, "orthodox")
        self.assertEqual(ctx.source, StanceSource.VISUAL_ESTIMATE.value)
        self.assertEqual(ctx.confidence, 0.85)
        self.assertFalse(ctx.is_authoritative)

    def test_visual_estimate_confidence_bounds(self):
        # Confidence None -> fallback unknown
        ctx_none = resolve_stance_context(
            visual_estimate_stance="orthodox",
            visual_estimate_confidence=None,
        )
        self.assertEqual(ctx_none.resolved_stance, "unknown")
        self.assertEqual(ctx_none.source, StanceSource.UNKNOWN.value)

        # Confidence < 0.0 -> fallback unknown
        ctx_neg = resolve_stance_context(
            visual_estimate_stance="orthodox",
            visual_estimate_confidence=-0.1,
        )
        self.assertEqual(ctx_neg.resolved_stance, "unknown")

        # Confidence > 1.0 -> fallback unknown
        ctx_high = resolve_stance_context(
            visual_estimate_stance="orthodox",
            visual_estimate_confidence=1.05,
        )
        self.assertEqual(ctx_high.resolved_stance, "unknown")

        # Confidence = 0.0 và 1.0 -> hợp lệ
        ctx_0 = resolve_stance_context(
            visual_estimate_stance="southpaw",
            visual_estimate_confidence=0.0,
        )
        self.assertEqual(ctx_0.resolved_stance, "southpaw")
        self.assertEqual(ctx_0.confidence, 0.0)

        ctx_1 = resolve_stance_context(
            visual_estimate_stance="southpaw",
            visual_estimate_confidence=1.0,
        )
        self.assertEqual(ctx_1.resolved_stance, "southpaw")
        self.assertEqual(ctx_1.confidence, 1.0)

    def test_requested_stance_across_all_sources(self):
        """Kiểm tra requested_stance ghi nhận đúng giá trị yêu cầu ban đầu cho từng nguồn."""
        # 1. Coach declared
        ctx_c = resolve_stance_context(coach_stance="orthodox")
        self.assertEqual(ctx_c.requested_stance, "orthodox")
        self.assertEqual(ctx_c.resolved_stance, "orthodox")
        self.assertEqual(ctx_c.source, StanceSource.COACH_DECLARED.value)

        # 2. User declared
        ctx_u = resolve_stance_context(user_stance="southpaw")
        self.assertEqual(ctx_u.requested_stance, "southpaw")
        self.assertEqual(ctx_u.resolved_stance, "southpaw")
        self.assertEqual(ctx_u.source, StanceSource.USER_DECLARED.value)

        # 3. Athlete profile
        ctx_p = resolve_stance_context(athlete_profile_stance="switch")
        self.assertEqual(ctx_p.requested_stance, "switch")
        self.assertEqual(ctx_p.resolved_stance, "switch")
        self.assertEqual(ctx_p.source, StanceSource.ATHLETE_PROFILE.value)

        # 4. Visual estimate
        ctx_v = resolve_stance_context(
            visual_estimate_stance="orthodox", visual_estimate_confidence=0.88
        )
        self.assertEqual(ctx_v.requested_stance, "orthodox")
        self.assertEqual(ctx_v.resolved_stance, "orthodox")
        self.assertEqual(ctx_v.source, StanceSource.VISUAL_ESTIMATE.value)

        # 5. Unknown fallback
        ctx_unk = resolve_stance_context()
        self.assertIsNone(ctx_unk.requested_stance)
        self.assertEqual(ctx_unk.resolved_stance, "unknown")
        self.assertEqual(ctx_unk.source, StanceSource.UNKNOWN.value)

    def test_stance_context_invariants_fail_fast(self):
        """Bảo vệ invariant của StanceContext tại construction boundary."""
        import math

        # 1. Từ chối resolved_stance không hợp lệ
        with self.assertRaises(ValueError):
            StanceContext(resolved_stance="karate", source="user_declared", is_authoritative=True)
        with self.assertRaises(ValueError):
            StanceContext(resolved_stance="", source="user_declared", is_authoritative=True)

        # 2. Từ chối source không hợp lệ
        with self.assertRaises(ValueError):
            StanceContext(resolved_stance="orthodox", source="invalid_src", is_authoritative=True)

        # 3. Từ chối confidence là bool (True / False)
        with self.assertRaises(ValueError):
            StanceContext(
                resolved_stance="orthodox", source="visual_estimate", requested_stance="orthodox", confidence=True, is_authoritative=False
            )
        with self.assertRaises(ValueError):
            StanceContext(
                resolved_stance="orthodox", source="visual_estimate", requested_stance="orthodox", confidence=False, is_authoritative=False
            )

        # 4. Từ chối confidence là NaN hoặc Infinity
        with self.assertRaises(ValueError):
            StanceContext(
                resolved_stance="orthodox", source="visual_estimate", requested_stance="orthodox", confidence=float("nan"), is_authoritative=False
            )
        with self.assertRaises(ValueError):
            StanceContext(
                resolved_stance="orthodox", source="visual_estimate", requested_stance="orthodox", confidence=float("inf"), is_authoritative=False
            )
        with self.assertRaises(ValueError):
            StanceContext(
                resolved_stance="orthodox", source="visual_estimate", requested_stance="orthodox", confidence=float("-inf"), is_authoritative=False
            )

        # 5. Từ chối confidence ngoài [0.0, 1.0]
        with self.assertRaises(ValueError):
            StanceContext(
                resolved_stance="orthodox", source="visual_estimate", requested_stance="orthodox", confidence=-0.05, is_authoritative=False
            )
        with self.assertRaises(ValueError):
            StanceContext(
                resolved_stance="orthodox", source="visual_estimate", requested_stance="orthodox", confidence=1.05, is_authoritative=False
            )

        # 6. Chỉ visual_estimate được có confidence (các nguồn khác cấm có confidence)
        with self.assertRaises(ValueError):
            StanceContext(
                resolved_stance="orthodox", source="coach_declared", requested_stance="orthodox", confidence=0.9, is_authoritative=True
            )
        with self.assertRaises(ValueError):
            StanceContext(
                resolved_stance="orthodox", source="user_declared", requested_stance="orthodox", confidence=0.9, is_authoritative=True
            )
        with self.assertRaises(ValueError):
            StanceContext(
                resolved_stance="orthodox", source="athlete_profile", requested_stance="orthodox", confidence=0.9, is_authoritative=False
            )
        with self.assertRaises(ValueError):
            StanceContext(
                resolved_stance="unknown", source="unknown", requested_stance=None, confidence=0.9, is_authoritative=False
            )

        # 7. is_authoritative phải nhất quán
        with self.assertRaises(ValueError):
            StanceContext(resolved_stance="orthodox", source="coach_declared", requested_stance="orthodox", is_authoritative=False)
        with self.assertRaises(ValueError):
            StanceContext(resolved_stance="southpaw", source="user_declared", requested_stance="southpaw", is_authoritative=False)
        with self.assertRaises(ValueError):
            StanceContext(resolved_stance="orthodox", source="athlete_profile", requested_stance="orthodox", is_authoritative=True)
        with self.assertRaises(ValueError):
            StanceContext(
                resolved_stance="orthodox", source="visual_estimate", requested_stance="orthodox", confidence=0.8, is_authoritative=True
            )
        with self.assertRaises(ValueError):
            StanceContext(resolved_stance="unknown", source="unknown", requested_stance=None, is_authoritative=True)


class TestStanceContextCrossFieldInvariants(unittest.TestCase):
    """
    Parameterized regression tests cho cross-field validation trong StanceContext.__post_init__:
    1. source == "unknown":
       - resolved_stance phải là "unknown".
       - requested_stance phải là None.
       - confidence phải là None.
       - is_authoritative phải là False.
    2. source in {"coach_declared", "user_declared"}:
       - resolved_stance phải thuộc orthodox/southpaw/switch.
       - requested_stance phải tồn tại và sau normalize phải bằng resolved_stance.
       - confidence phải là None.
       - is_authoritative phải là True.
    3. source == "athlete_profile":
       - resolved_stance phải thuộc orthodox/southpaw/switch.
       - requested_stance phải tồn tại và normalize bằng resolved_stance.
       - confidence phải là None.
       - is_authoritative phải là False.
    4. source == "visual_estimate":
       - resolved_stance phải thuộc orthodox/southpaw/switch.
       - requested_stance phải tồn tại và normalize bằng resolved_stance.
       - confidence là bắt buộc, phải hữu hạn và trong [0,1].
       - is_authoritative phải là False.
    """

    def test_unknown_source_invalid_combinations(self):
        """source == 'unknown' phải từ chối mọi vi phạm invariant."""
        baseline = {
            "resolved_stance": "unknown",
            "source": "unknown",
            "requested_stance": None,
            "confidence": None,
            "is_authoritative": False,
        }

        invalid_cases = [
            ("resolved_stance_orthodox", {"resolved_stance": "orthodox"}),
            ("resolved_stance_southpaw", {"resolved_stance": "southpaw"}),
            ("resolved_stance_switch", {"resolved_stance": "switch"}),
            ("resolved_stance_karate", {"resolved_stance": "karate"}),
            ("requested_stance_unknown", {"requested_stance": "unknown"}),
            ("requested_stance_orthodox", {"requested_stance": "orthodox"}),
            ("requested_stance_empty", {"requested_stance": ""}),
            ("confidence_float", {"confidence": 0.5}),
            ("confidence_zero", {"confidence": 0.0}),
            ("confidence_one", {"confidence": 1.0}),
            ("is_authoritative_true", {"is_authoritative": True}),
        ]

        for name, overrides in invalid_cases:
            with self.subTest(case=name):
                kwargs = dict(baseline, **overrides)
                with self.assertRaises(ValueError, msg=f"Case '{name}' should raise ValueError"):
                    StanceContext(**kwargs)

    def test_coach_and_user_declared_invalid_combinations(self):
        """source in {'coach_declared', 'user_declared'} phải từ chối mọi vi phạm invariant."""
        for src in ("coach_declared", "user_declared"):
            baseline = {
                "resolved_stance": "orthodox",
                "source": src,
                "requested_stance": "orthodox",
                "confidence": None,
                "is_authoritative": True,
            }

            invalid_cases = [
                ("resolved_stance_unknown", {"resolved_stance": "unknown", "requested_stance": "unknown"}),
                ("resolved_stance_invalid", {"resolved_stance": "karate", "requested_stance": "karate"}),
                ("requested_stance_none", {"requested_stance": None}),
                ("requested_mismatch_southpaw", {"requested_stance": "southpaw"}),
                ("requested_mismatch_unknown", {"requested_stance": "unknown"}),
                ("requested_mismatch_invalid", {"requested_stance": "karate"}),
                ("requested_mismatch_empty", {"requested_stance": ""}),
                ("confidence_not_none_float", {"confidence": 0.5}),
                ("confidence_zero", {"confidence": 0.0}),
                ("is_authoritative_false", {"is_authoritative": False}),
            ]

            for name, overrides in invalid_cases:
                with self.subTest(source=src, case=name):
                    kwargs = dict(baseline, **overrides)
                    with self.assertRaises(ValueError, msg=f"Source '{src}' case '{name}' should raise ValueError"):
                        StanceContext(**kwargs)

    def test_athlete_profile_invalid_combinations(self):
        """source == 'athlete_profile' phải từ chối mọi vi phạm invariant."""
        baseline = {
            "resolved_stance": "southpaw",
            "source": "athlete_profile",
            "requested_stance": "southpaw",
            "confidence": None,
            "is_authoritative": False,
        }

        invalid_cases = [
            ("resolved_stance_unknown", {"resolved_stance": "unknown", "requested_stance": "unknown"}),
            ("resolved_stance_invalid", {"resolved_stance": "karate", "requested_stance": "karate"}),
            ("requested_stance_none", {"requested_stance": None}),
            ("requested_mismatch_orthodox", {"requested_stance": "orthodox"}),
            ("requested_mismatch_unknown", {"requested_stance": "unknown"}),
            ("requested_mismatch_invalid", {"requested_stance": "boxing"}),
            ("requested_mismatch_empty", {"requested_stance": ""}),
            ("confidence_not_none_float", {"confidence": 0.8}),
            ("confidence_zero", {"confidence": 0.0}),
            ("is_authoritative_true", {"is_authoritative": True}),
        ]

        for name, overrides in invalid_cases:
            with self.subTest(case=name):
                kwargs = dict(baseline, **overrides)
                with self.assertRaises(ValueError, msg=f"Case '{name}' should raise ValueError"):
                    StanceContext(**kwargs)

    def test_visual_estimate_invalid_combinations(self):
        """source == 'visual_estimate' phải từ chối mọi vi phạm invariant."""
        baseline = {
            "resolved_stance": "switch",
            "source": "visual_estimate",
            "requested_stance": "switch",
            "confidence": 0.85,
            "is_authoritative": False,
        }

        invalid_cases = [
            ("resolved_stance_unknown", {"resolved_stance": "unknown", "requested_stance": "unknown"}),
            ("resolved_stance_invalid", {"resolved_stance": "karate", "requested_stance": "karate"}),
            ("requested_stance_none", {"requested_stance": None}),
            ("requested_mismatch_orthodox", {"requested_stance": "orthodox"}),
            ("requested_mismatch_unknown", {"requested_stance": "unknown"}),
            ("requested_mismatch_invalid", {"requested_stance": "judo"}),
            ("requested_mismatch_empty", {"requested_stance": ""}),
            ("confidence_none", {"confidence": None}),
            ("confidence_bool_true", {"confidence": True}),
            ("confidence_bool_false", {"confidence": False}),
            ("confidence_string", {"confidence": "0.85"}),
            ("confidence_nan", {"confidence": float("nan")}),
            ("confidence_inf", {"confidence": float("inf")}),
            ("confidence_neg_inf", {"confidence": float("-inf")}),
            ("confidence_neg", {"confidence": -0.01}),
            ("confidence_above_one", {"confidence": 1.01}),
            ("is_authoritative_true", {"is_authoritative": True}),
        ]

        for name, overrides in invalid_cases:
            with self.subTest(case=name):
                kwargs = dict(baseline, **overrides)
                with self.assertRaises(ValueError, msg=f"Case '{name}' should raise ValueError"):
                    StanceContext(**kwargs)

    def test_valid_combinations_pass(self):
        """Các tổ hợp đúng chuẩn (kể cả requested_stance chưa chuẩn hóa) phải khởi tạo thành công."""
        valid_cases = [
            # 1. unknown
            {
                "resolved_stance": "unknown",
                "source": "unknown",
                "requested_stance": None,
                "confidence": None,
                "is_authoritative": False,
            },
            # 2. coach_declared
            {
                "resolved_stance": "orthodox",
                "source": "coach_declared",
                "requested_stance": "orthodox",
                "confidence": None,
                "is_authoritative": True,
            },
            {
                "resolved_stance": "southpaw",
                "source": "coach_declared",
                "requested_stance": "  SOUTHPAW \n",
                "confidence": None,
                "is_authoritative": True,
            },
            # 3. user_declared
            {
                "resolved_stance": "switch",
                "source": "user_declared",
                "requested_stance": "Switch",
                "confidence": None,
                "is_authoritative": True,
            },
            # 4. athlete_profile
            {
                "resolved_stance": "orthodox",
                "source": "athlete_profile",
                "requested_stance": "  orthoDOX  ",
                "confidence": None,
                "is_authoritative": False,
            },
            # 5. visual_estimate
            {
                "resolved_stance": "southpaw",
                "source": "visual_estimate",
                "requested_stance": "southpaw",
                "confidence": 0.0,
                "is_authoritative": False,
            },
            {
                "resolved_stance": "switch",
                "source": "visual_estimate",
                "requested_stance": "switch",
                "confidence": 1.0,
                "is_authoritative": False,
            },
            {
                "resolved_stance": "orthodox",
                "source": "visual_estimate",
                "requested_stance": "  ORTHODOX  ",
                "confidence": 0.88,
                "is_authoritative": False,
            },
        ]

        for i, case in enumerate(valid_cases):
            with self.subTest(index=i, source=case["source"]):
                ctx = StanceContext(**case)
                self.assertEqual(ctx.resolved_stance, case["resolved_stance"])
                self.assertEqual(ctx.source, case["source"])
                self.assertEqual(ctx.requested_stance, case["requested_stance"])
                self.assertEqual(ctx.confidence, case["confidence"])
                self.assertEqual(ctx.is_authoritative, case["is_authoritative"])


class TestClassificationBoundary(unittest.TestCase):
    """Kiểm tra ranh giới phân loại kỹ thuật và ClassifiedTechnique."""

    def test_classify_punch_and_kick(self):
        ctx_ortho = resolve_stance_context(user_stance="orthodox")
        p = DummyPunch(arm="right", punch_type="cross")
        ct_p = classify_punch(p, ctx_ortho)

        self.assertEqual(ct_p.family, "punch")
        self.assertEqual(ct_p.technique, "cross")
        self.assertEqual(ct_p.attacking_side, "right")
        self.assertEqual(ct_p.limb_role, "rear")
        self.assertEqual(ct_p.stance, "orthodox")
        self.assertIsNone(ct_p.confidence)
        self.assertEqual(ct_p.label_source, "legacy_detector_label")

        k = DummyKick(active_leg="left", kick_type="round_kick")
        ct_k = classify_kick(k, ctx_ortho)

        self.assertEqual(ct_k.family, "kick")
        self.assertEqual(ct_k.technique, "round_kick")
        self.assertEqual(ct_k.attacking_side, "left")
        self.assertEqual(ct_k.limb_role, "lead")
        self.assertEqual(ct_k.stance, "orthodox")
        self.assertIsNone(ct_k.confidence)
        self.assertEqual(ct_k.label_source, "legacy_detector_label")

    def test_mandatory_technical_debt_southpaw_right_cross(self):
        """
        [MANDATORY TEST - Requirement 9]
        Southpaw + right-hand legacy Cross -> technique vẫn 'cross', limbRole 'lead', confidence None.

        LƯU Ý KỸ THUẬT QUAN TRỌNG (TECHNICAL DEBT):
        Về mặt chuyên môn võ thuật: Với võ sĩ Southpaw (thủ nghịch), tay phải là tay trước (lead hand).
        Cú đấm thẳng tay trước thực chất là đòn JAB, không phải CROSS.
        Tuy nhiên, để bảo đảm ZERO REGRESSION cho detector output trong Task 3 và không tự ý thay đổi
        nhãn phân loại của PunchAnalyzer hiện tại, nhãn kỹ thuật 'cross' được bảo lưu nguyên trạng.
        Ranh giới phân loại thực thụ dựa trên vai trò chi (lead straight = jab, rear straight = cross)
        sẽ được hoàn thiện trong Coaching MVP tiếp theo.
        """
        ctx_southpaw = resolve_stance_context(user_stance="southpaw")
        punch = DummyPunch(arm="right", punch_type="cross")

        ct = classify_punch(punch, ctx_southpaw)
        self.assertEqual(ct.family, "punch")
        self.assertEqual(ct.technique, "cross", "Technique phải giữ nguyên 'cross' từ detector legacy")
        self.assertEqual(ct.attacking_side, "right")
        self.assertEqual(ct.limb_role, "lead", "Trong Southpaw, tay phải là tay trước (lead)")
        self.assertIsNone(ct.confidence, "Classification confidence chưa calibrate -> phải là None")

        action = action_from_punch(
            punch=punch,
            action_id="action_001",
            source_action_id="punch_1",
            classified_technique=ct,
        )
        self.assertEqual(action.technique, "cross")
        self.assertEqual(action.attackingSide, "right")
        self.assertEqual(action.limbRole, "lead")
        self.assertEqual(action.stance, "southpaw")
        self.assertIsNone(action.confidence.classification)

    def test_classify_kick_ignores_kick_type_and_preserves_round_kick(self):
        """
        Object có kick_type='side_kick' vẫn trả về technique='round_kick'.
        Trong Task 3, classify_kick() không đọc hoặc tin tưởng kick.kick_type.
        """
        ctx_ortho = resolve_stance_context(user_stance="orthodox")
        k_side = DummyKick(active_leg="right", kick_type="side_kick")
        ct = classify_kick(k_side, ctx_ortho)
        self.assertEqual(ct.technique, "round_kick")

        action = action_from_kick(
            kick=k_side,
            action_id="action_001",
            source_action_id="kick_1",
            classified_technique=ct,
        )
        self.assertEqual(action.technique, "round_kick")

    def test_internal_label_source_not_leaked_to_action_result(self):
        """label_source là trường nội bộ của ClassifiedTechnique, không xuất ra public ActionResult."""
        ctx = resolve_stance_context(user_stance="orthodox")
        p = DummyPunch(arm="left", punch_type="jab")
        ct = classify_punch(p, ctx)
        action = action_from_punch(
            punch=p,
            action_id="action_001",
            source_action_id="punch_1",
            classified_technique=ct,
        )
        d = action.to_dict()
        self.assertNotIn("label_source", d)
        self.assertNotIn("labelSource", d)
        self.assertNotIn("stanceSource", d)
        self.assertNotIn("stanceProvenance", d)
        self.assertEqual(d["stance"], "orthodox")
        self.assertEqual(d["limbRole"], "lead")

    def test_public_action_result_no_internal_provenance(self):
        """
        Bảo đảm ActionResult.to_dict() không xuất provenance nội bộ
        (requested_stance, requestedStance, source, stanceSource, label_source, labelSource, isAuthoritative, v.v.).
        """
        ctx = resolve_stance_context(coach_stance="orthodox")
        p = DummyPunch(arm="left", punch_type="jab")
        ct = classify_punch(p, ctx)
        action = action_from_punch(
            punch=p,
            action_id="action_001",
            source_action_id="punch_1",
            classified_technique=ct,
        )
        d = action.to_dict()
        forbidden_keys = [
            "requested_stance", "requestedStance",
            "source", "stanceSource", "stanceProvenance",
            "label_source", "labelSource",
            "is_authoritative", "isAuthoritative",
        ]
        for k in forbidden_keys:
            self.assertNotIn(k, d, f"Trường nội bộ {k} không được xuất hiện trong ActionResult")

        # Kiểm tra đầy đủ schema fields của ActionResult
        expected_keys = {
            "id", "sourceActionId", "family", "technique", "attackingSide",
            "limbRole", "stance", "confidence", "phases", "metrics",
            "assessment", "review", "modelVersion", "rubricVersion",
        }
        self.assertEqual(set(d.keys()), expected_keys)


class TestBuildActionsListAndConflict(unittest.TestCase):
    """Kiểm tra build_actions_list và xử lý xung đột stance."""

    def test_stance_context_overrides_legacy_stance_parameter(self):
        """Khi cả stance cũ và stance_context được truyền, stance_context có độ ưu tiên cao nhất."""
        ctx_southpaw = resolve_stance_context(coach_stance="southpaw")
        punches = [DummyPunch(arm="right", punch_type="cross")]
        kicks = []

        # Truyền stance="orthodox" nhưng stance_context là southpaw
        actions = build_actions_list(
            punches=punches,
            kicks=kicks,
            stance="orthodox",
            stance_context=ctx_southpaw,
        )
        self.assertEqual(len(actions), 1)
        # Context southpaw phải thắng: tay phải trở thành lead
        self.assertEqual(actions[0].stance, "southpaw")
        self.assertEqual(actions[0].limbRole, "lead")

    def test_legacy_stance_wrapped_as_user_declared_when_context_omitted(self):
        punches = [DummyPunch(arm="left", punch_type="jab")]
        kicks = []

        actions = build_actions_list(
            punches=punches,
            kicks=kicks,
            stance="orthodox",
            stance_context=None,
        )
        self.assertEqual(len(actions), 1)
        self.assertEqual(actions[0].stance, "orthodox")
        self.assertEqual(actions[0].limbRole, "lead")

    def test_default_omitted_stance_and_context_produces_unknown(self):
        punches = [DummyPunch(arm="left", punch_type="jab")]
        kicks = []

        actions = build_actions_list(
            punches=punches,
            kicks=kicks,
        )
        self.assertEqual(len(actions), 1)
        self.assertEqual(actions[0].stance, "unknown")
        self.assertEqual(actions[0].limbRole, "unknown")


class TestAdapterSingleSourceOfTruth(unittest.TestCase):
    """Kiểm tra Adapter nhận ClassifiedTechnique làm đơn nguồn chân lý."""

    def test_adapter_uses_classified_technique_without_renormalizing(self):
        # Giả lập ClassifiedTechnique có giá trị tùy biến hợp lệ
        custom_ct = ClassifiedTechnique(
            family="punch",
            technique="overhand",
            attacking_side="right",
            limb_role="rear",
            stance="orthodox",
            confidence=None,
            label_source="legacy_detector_label",
        )
        p = DummyPunch(arm="left", punch_type="jab")  # khác với custom_ct

        action = action_from_punch(
            punch=p,
            action_id="action_001",
            source_action_id="punch_1",
            classified_technique=custom_ct,
        )
        # Adapter phải hoàn toàn tuân thủ ClassifiedTechnique
        self.assertEqual(action.family, "punch")
        self.assertEqual(action.technique, "overhand")
        self.assertEqual(action.attackingSide, "right")
        self.assertEqual(action.limbRole, "rear")
        self.assertEqual(action.stance, "orthodox")


class TestNoCircularImports(unittest.TestCase):
    """Xác nhận cấu trúc module hoàn toàn acyclic, không có circular import."""

    def test_clean_import_sequence(self):
        import importlib
        mod_sc = importlib.import_module("pipeline.stance_context")
        mod_cl = importlib.import_module("pipeline.classification")
        mod_pl = importlib.import_module("pipeline")
        mod_ar = importlib.import_module("action_result")
        mod_pv = importlib.import_module("process_video")

        self.assertTrue(hasattr(mod_sc, "resolve_stance_context"))
        self.assertTrue(hasattr(mod_cl, "ClassifiedTechnique"))
        self.assertTrue(hasattr(mod_pl, "ActionPipeline"))
        self.assertTrue(hasattr(mod_ar, "ActionResult"))
        self.assertTrue(hasattr(mod_pv, "process_video"))


if __name__ == "__main__":
    unittest.main()
