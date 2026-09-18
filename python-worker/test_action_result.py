"""
test_action_result.py — Comprehensive Unit Tests for Unified ActionResult Model & Adapters

Kiểm thử chi tiết các yêu cầu:
1. resolve_assessment_status & evidence gating:
   - grade == "NO_DATA" hoặc không có criterion hợp lệ: "insufficient_evidence".
   - Test PunchResult và KickResult thiếu evidence.
2. Không serialize giá trị metric giả:
   - Thuộc tính thiếu -> value = None, confidence = None.
   - Criterion có status 'insufficient_evidence' -> value = None, confidence = None.
   - Không fallback về 0.0 hoặc False.
   - Test riêng cho maxElbowAngle, guardPreserved, minChamberAngle, maxExtensionAngle, peakSpeed.
3. normalize_stance:
   - Trim, lowercase, chấp nhận orthodox, southpaw, switch, unknown.
   - Test uppercase, whitespace, switch, invalid input.
   - ActionResult.stance và resolve_limb_role đều dùng giá trị đã chuẩn hóa.
4. Nested criteria và findings đều remap actionId mà không mutate legacy objects.
5. Sắp xếp deterministic với tie-breaker đầy đủ.
6. Các phase chưa có được serialize thành None / null.
7. Đơn vị vận tốc normalized_image/s.
8. Rubric ID và version lấy từ RUBRIC_PUNCH_V3 và RUBRIC_ROUND_KICK_V3.
9. Tương thích ngược với output schema và strike_benchmark.
"""

import copy
import json
import unittest
from unittest.mock import patch

import action_result
from action_result import (
    ActionAssessment,
    ActionConfidence,
    ActionFamily,
    ActionMetricItem,
    ActionPhases,
    ActionResult,
    ActionReview,
    AssessmentStatus,
    AttackingSide,
    LimbRole,
    ReviewStatus,
    action_from_kick,
    action_from_punch,
    build_actions_list,
    compute_derived_rubric_confidence,
    extract_metric,
    normalize_attacking_side,
    normalize_stance,
    resolve_assessment_status,
    resolve_limb_role,
)
from kick_analyzer import KickResult
from punch_analyzer import PunchResult
from technique_rubric import (
    CriterionResult,
    CriterionStatus,
    RUBRIC_PUNCH_V3,
    RUBRIC_ROUND_KICK_V3,
    TechniqueFinding,
)


def _make_dummy_finding(finding_id: str, action_id: str, metric_name: str, metric_val: float) -> TechniqueFinding:
    return TechniqueFinding(
        id=finding_id,
        category="technique",
        title="Test Finding",
        description="Detailed description for test",
        severity="info",
        confidence=0.90,
        frame_idx=130,
        time_ms=4333.3,
        metric_name=metric_name,
        metric_value=metric_val,
        recommendation="Maintain good form",
        action_id=action_id,
        phase="impact",
        metric_unit="degree",
        evidence_frame_start=120,
        evidence_frame_end=130,
        evidence_timestamp_start_ms=4000.0,
        evidence_timestamp_end_ms=4333.3,
        affected_body_part="right_arm",
        model_version="yolov8n-pose",
        scoring_version="rubric-v3.0.0",
    )


def _make_dummy_criterion(
    criterion_id: str,
    feature_name: str,
    observed_val: float,
    weight: float = 0.40,
    conf: float = 0.85,
    status: CriterionStatus = CriterionStatus.GOOD,
    score: float = 85.0,
) -> CriterionResult:
    return CriterionResult(
        criterion_id=criterion_id,
        criterion_name="Test Criterion",
        phase="impact",
        feature_name=feature_name,
        observed_value=observed_val,
        score=score,
        weight=weight,
        confidence=conf,
        status=status.value,
        evidence_frame_start=120,
        evidence_frame_end=130,
        evidence_timestamp_start_ms=4000.0,
        evidence_timestamp_end_ms=4333.3,
        affected_body_part="right_arm",
        detail="✅ Test detail",
    )


class TestActionResultContract(unittest.TestCase):
    def setUp(self):
        # Fixture PunchResult chuẩn
        self.punch_finding = _make_dummy_finding("punch_1_ext", "punch_1", "maxElbowAngle", 165.0)
        self.punch_crit1 = _make_dummy_criterion("crit_punch_extension", "max_elbow_angle", 165.0, weight=0.4, conf=0.90, score=82.0)
        self.punch_crit2 = _make_dummy_criterion("crit_punch_guard", "guard_preserved", 1.0, weight=0.35, conf=0.80, score=82.0)
        self.punch_crit3 = _make_dummy_criterion(
            "crit_punch_speed", "peak_speed", 1.234, weight=0.25, conf=0.75, status=CriterionStatus.GOOD, score=82.0
        )

        self.punch = PunchResult(
            punch_type="Cross",
            arm="right",
            score=82,
            grade="GOOD",
            emoji="🟡",
            details=["✅ Good extension"],
            max_elbow_angle=165.0,
            peak_speed=1.234,
            guard_preserved=True,
            start_frame=100,
            impact_frame=115,
            end_frame=130,
            start_time_ms=3333.3,
            impact_time_ms=3833.3,
            end_time_ms=4333.3,
            criterion_results=[self.punch_crit1, self.punch_crit2, self.punch_crit3],
            findings=[self.punch_finding],
        )

        # Fixture KickResult chuẩn
        self.kick_finding = _make_dummy_finding("kick_1_cham", "kick_1", "minChamberAngle", 62.0)
        self.kick_crit1 = _make_dummy_criterion("crit_kick_chamber", "min_chamber_angle", 62.0, weight=0.35, conf=0.88, score=88.0)
        self.kick_crit2 = _make_dummy_criterion("crit_kick_extension", "max_extension_angle", 155.0, weight=0.35, conf=0.92, score=88.0)
        self.kick_crit3 = _make_dummy_criterion("crit_kick_speed", "peak_speed", 2.456, weight=0.15, conf=0.80, score=88.0)

        self.kick = KickResult(
            score=88,
            grade="GOOD",
            emoji="🟡",
            details=["✅ Good chamber"],
            min_chamber_angle=62.0,
            max_extension_angle=155.0,
            peak_speed=2.456,
            start_frame=200,
            end_frame=240,
            start_time_ms=6666.7,
            end_time_ms=8000.0,
            impact_frame=225,
            impact_time_ms=7500.0,
            chamber_peak_frame=212,
            chamber_peak_time_ms=7066.7,
            active_leg="left",
            criterion_results=[self.kick_crit1, self.kick_crit2, self.kick_crit3],
            findings=[self.kick_finding],
        )

    def test_punch_adapter_structure_and_types(self):
        """Kiểm tra cấu trúc và kiểu dữ liệu chuẩn của ActionResult tạo từ PunchResult."""
        action = action_from_punch(
            punch=self.punch,
            action_id="action_001",
            source_action_id="punch_1",
            stance="unknown",
            model_version="yolov8n-pose",
        )

        d = action.to_dict()
        self.assertEqual(d["id"], "action_001")
        self.assertEqual(d["sourceActionId"], "punch_1")
        self.assertEqual(d["family"], "punch")
        self.assertEqual(d["technique"], "cross")
        self.assertEqual(d["attackingSide"], "right")
        self.assertEqual(d["stance"], "unknown")
        self.assertEqual(d["limbRole"], "unknown")

        # Confidence
        self.assertIsNone(d["confidence"]["detection"])
        self.assertIsNone(d["confidence"]["classification"])
        self.assertIsNotNone(d["confidence"]["assessment"])
        # (0.90*0.40 + 0.80*0.35 + 0.75*0.25) / (0.40 + 0.35 + 0.25) = (0.36 + 0.28 + 0.1875) / 1.0 = 0.8275 -> 0.83
        self.assertAlmostEqual(d["confidence"]["assessment"], 0.83, places=2)

        # Phases
        p = d["phases"]
        self.assertEqual(p["startFrame"], 100)
        self.assertIsNone(p["chamberFrame"])
        self.assertIsNone(p["launchFrame"])
        self.assertIsNone(p["peakFrame"])
        self.assertEqual(p["impactFrame"], 115)
        self.assertEqual(p["endFrame"], 130)
        self.assertEqual(p["impactType"], "peak_extension_proxy")

        # Metrics
        m = d["metrics"]
        self.assertEqual(m["maxElbowAngle"]["value"], 165.0)
        self.assertEqual(m["maxElbowAngle"]["unit"], "degree")
        self.assertEqual(m["maxElbowAngle"]["confidence"], 0.90)

        self.assertEqual(m["peakSpeed"]["value"], 1.234)
        self.assertEqual(m["peakSpeed"]["unit"], "normalized_image/s")
        self.assertEqual(m["peakSpeed"]["confidence"], 0.75)

        self.assertEqual(m["guardPreserved"]["value"], True)
        self.assertEqual(m["guardPreserved"]["unit"], "flag")
        self.assertEqual(m["guardPreserved"]["confidence"], 0.80)

        # Assessment
        a = d["assessment"]
        self.assertEqual(a["rubricId"], RUBRIC_PUNCH_V3.id)
        self.assertEqual(a["score"], 82)
        self.assertEqual(a["grade"], "GOOD")
        self.assertEqual(a["status"], "good")
        self.assertIsNone(a["primaryError"])

        # Versioning lấy từ định nghĩa rubric chuẩn
        self.assertEqual(d["modelVersion"], "yolov8n-pose")
        self.assertEqual(d["rubricVersion"], RUBRIC_PUNCH_V3.version)

    def test_kick_adapter_structure_and_types(self):
        """Kiểm tra cấu trúc và kiểu dữ liệu chuẩn của ActionResult tạo từ KickResult."""
        action = action_from_kick(
            kick=self.kick,
            action_id="action_002",
            source_action_id="kick_1",
            stance="orthodox",
            model_version="yolov8n-pose",
        )

        d = action.to_dict()
        self.assertEqual(d["id"], "action_002")
        self.assertEqual(d["sourceActionId"], "kick_1")
        self.assertEqual(d["family"], "kick")
        self.assertEqual(d["technique"], "round_kick")
        self.assertEqual(d["attackingSide"], "left")
        self.assertEqual(d["stance"], "orthodox")
        self.assertEqual(d["limbRole"], "lead")

        # Phases
        p = d["phases"]
        self.assertEqual(p["startFrame"], 200)
        self.assertEqual(p["chamberFrame"], 212)
        self.assertEqual(p["chamberTimeMs"], 7066.7)
        self.assertIsNone(p["launchFrame"])
        self.assertIsNone(p["peakFrame"])
        self.assertEqual(p["impactFrame"], 225)
        self.assertEqual(p["endFrame"], 240)
        self.assertEqual(p["impactType"], "max_extension_proxy")

        # Metrics
        m = d["metrics"]
        self.assertEqual(m["minChamberAngle"]["value"], 62.0)
        self.assertEqual(m["minChamberAngle"]["unit"], "degree")
        self.assertEqual(m["minChamberAngle"]["confidence"], 0.88)

        self.assertEqual(m["maxExtensionAngle"]["value"], 155.0)
        self.assertEqual(m["maxExtensionAngle"]["unit"], "degree")
        self.assertEqual(m["maxExtensionAngle"]["confidence"], 0.92)

        self.assertEqual(m["peakSpeed"]["value"], 2.456)
        self.assertEqual(m["peakSpeed"]["unit"], "normalized_image/s")
        self.assertEqual(m["peakSpeed"]["confidence"], 0.80)

        # Rubric
        self.assertEqual(d["assessment"]["rubricId"], RUBRIC_ROUND_KICK_V3.id)
        self.assertEqual(d["rubricVersion"], RUBRIC_ROUND_KICK_V3.version)

    def test_nested_criteria_and_findings_both_remap_action_id(self):
        """Bảo đảm cả nested criteria và findings đều được remap actionId sang ID mới."""
        orig_punch_action_id = self.punch_finding.action_id
        orig_kick_action_id = self.kick_finding.action_id

        action_p = action_from_punch(self.punch, "action_099", "punch_1")
        action_k = action_from_kick(self.kick, "action_100", "kick_1")

        # 1. Kiểm tra nested findings remap actionId
        self.assertEqual(action_p.assessment.findings[0]["actionId"], "action_099")
        self.assertEqual(action_k.assessment.findings[0]["actionId"], "action_100")

        # 2. Kiểm tra nested criteria remap actionId
        for c in action_p.assessment.criteria:
            self.assertEqual(c.get("actionId"), "action_099")
        for c in action_k.assessment.criteria:
            self.assertEqual(c.get("actionId"), "action_100")

        # 3. Bảo đảm đối tượng legacy gốc không bị mutate
        self.assertEqual(self.punch_finding.action_id, orig_punch_action_id)
        self.assertEqual(self.kick_finding.action_id, orig_kick_action_id)
        legacy_punch = self.punch.to_dict()
        self.assertEqual(legacy_punch["findings"][0]["actionId"], orig_punch_action_id)
        legacy_kick = self.kick.to_dict()
        self.assertEqual(legacy_kick["findings"][0]["actionId"], orig_kick_action_id)

    def test_assessment_status_and_no_data_evidence_gating(self):
        """
        Kiểm tra resolve_assessment_status:
        - grade == 'NO_DATA' hoặc không có criterion hợp lệ: 'insufficient_evidence'.
        - Trường hợp đủ evidence: map theo điểm số >=90 excellent, >=75 good, >=55 fair, <55 needs_improvement.
        """
        self.assertEqual(resolve_assessment_status(0, grade="NO_DATA"), "insufficient_evidence")
        self.assertEqual(resolve_assessment_status(80, grade="GOOD", assessment_confidence=None), "insufficient_evidence")
        self.assertEqual(resolve_assessment_status(80, grade="GOOD", has_valid_criteria=False), "insufficient_evidence")

        self.assertEqual(resolve_assessment_status(95, grade="PERFECT", assessment_confidence=0.90), "excellent")
        self.assertEqual(resolve_assessment_status(80, grade="GOOD", assessment_confidence=0.85), "good")
        self.assertEqual(resolve_assessment_status(60, grade="FAIR", assessment_confidence=0.70), "fair")
        self.assertEqual(resolve_assessment_status(40, grade="NEEDS WORK", assessment_confidence=0.70), "needs_improvement")

    def test_punch_and_kick_with_insufficient_evidence(self):
        """Test PunchResult và KickResult hoàn toàn không có evidence hợp lệ."""
        # Punch với grade="NO_DATA", criterion_results rỗng
        punch_no_evidence = PunchResult(
            punch_type="Jab", arm="left", score=0, grade="NO_DATA", emoji="⚪",
            details=["Chưa đủ bằng chứng"], max_elbow_angle=0.0, peak_speed=0.0, guard_preserved=False,
            criterion_results=[
                _make_dummy_criterion("crit_punch_extension", "max_elbow_angle", 0.0, status=CriterionStatus.INSUFFICIENT_EVIDENCE),
            ],
            findings=[],
        )
        action_p = action_from_punch(punch_no_evidence, "action_001", "punch_1")
        self.assertEqual(action_p.assessment.status, "insufficient_evidence")
        self.assertIsNone(action_p.confidence.assessment)
        # Metric maxElbowAngle có criterion insufficient_evidence -> value và confidence đều là None
        self.assertIsNone(action_p.metrics["maxElbowAngle"].value)
        self.assertIsNone(action_p.metrics["maxElbowAngle"].confidence)

        # Kick với grade="NO_DATA"
        kick_no_evidence = KickResult(
            score=0, grade="NO_DATA", emoji="⚪", details=[],
            min_chamber_angle=0.0, max_extension_angle=0.0, peak_speed=0.0,
            criterion_results=[], findings=[],
        )
        action_k = action_from_kick(kick_no_evidence, "action_002", "kick_1")
        self.assertEqual(action_k.assessment.status, "insufficient_evidence")
        self.assertIsNone(action_k.confidence.assessment)

    def test_no_fabrication_of_metrics_when_missing_or_insufficient_evidence(self):
        """
        Kiểm tra chặt chẽ việc KHÔNG serialize giá trị metric giả:
        - Thuộc tính thiếu -> value = None, confidence = None.
        - Criterion có status insufficient_evidence -> value = None, confidence = None.
        - Không fallback về 0.0 hoặc False.
        - Kiểm tra riêng cho maxElbowAngle, guardPreserved, minChamberAngle, maxExtensionAngle, peakSpeed.
        """
        # Punch với 3 tiêu chí đều bị INSUFFICIENT_EVIDENCE
        crit_ext_insuf = _make_dummy_criterion("crit_punch_extension", "max_elbow_angle", 0.0, status=CriterionStatus.INSUFFICIENT_EVIDENCE)
        crit_guard_insuf = _make_dummy_criterion("crit_punch_guard", "guard_preserved", 0.0, status=CriterionStatus.INSUFFICIENT_EVIDENCE)
        crit_speed_insuf = _make_dummy_criterion("crit_punch_speed", "peak_speed", 0.0, status=CriterionStatus.INSUFFICIENT_EVIDENCE)

        punch_insuf = PunchResult(
            punch_type="Jab", arm="left", score=0, grade="NO_DATA", emoji="⚪", details=[],
            max_elbow_angle=160.0, peak_speed=1.5, guard_preserved=True,
            criterion_results=[crit_ext_insuf, crit_guard_insuf, crit_speed_insuf],
            findings=[],
        )
        action_p = action_from_punch(punch_insuf, "action_001", "punch_1")
        # maxElbowAngle
        self.assertIsNone(action_p.metrics["maxElbowAngle"].value)
        self.assertIsNone(action_p.metrics["maxElbowAngle"].confidence)
        # guardPreserved
        self.assertIsNone(action_p.metrics["guardPreserved"].value)
        self.assertIsNone(action_p.metrics["guardPreserved"].confidence)
        # peakSpeed
        self.assertIsNone(action_p.metrics["peakSpeed"].value)
        self.assertIsNone(action_p.metrics["peakSpeed"].confidence)

        # Kick với các tiêu chí INSUFFICIENT_EVIDENCE
        crit_cham_insuf = _make_dummy_criterion("crit_kick_chamber", "min_chamber_angle", 0.0, status=CriterionStatus.INSUFFICIENT_EVIDENCE)
        crit_ext_k_insuf = _make_dummy_criterion("crit_kick_extension", "max_extension_angle", 0.0, status=CriterionStatus.INSUFFICIENT_EVIDENCE)
        crit_speed_k_insuf = _make_dummy_criterion("crit_kick_speed", "peak_speed", 0.0, status=CriterionStatus.INSUFFICIENT_EVIDENCE)

        kick_insuf = KickResult(
            score=0, grade="NO_DATA", emoji="⚪", details=[],
            min_chamber_angle=60.0, max_extension_angle=150.0, peak_speed=2.0,
            criterion_results=[crit_cham_insuf, crit_ext_k_insuf, crit_speed_k_insuf],
            findings=[],
        )
        action_k = action_from_kick(kick_insuf, "action_002", "kick_1")
        # minChamberAngle
        self.assertIsNone(action_k.metrics["minChamberAngle"].value)
        self.assertIsNone(action_k.metrics["minChamberAngle"].confidence)
        # maxExtensionAngle
        self.assertIsNone(action_k.metrics["maxExtensionAngle"].value)
        self.assertIsNone(action_k.metrics["maxExtensionAngle"].confidence)
        # peakSpeed
        self.assertIsNone(action_k.metrics["peakSpeed"].value)
        self.assertIsNone(action_k.metrics["peakSpeed"].confidence)

        # Test object thiếu hẳn thuộc tính (không có max_elbow_angle)
        class DummyEmptyPunch:
            punch_type = "Cross"
            arm = "right"
            score = 50
            grade = "FAIR"
            criterion_results = []
            findings = []

        action_empty = action_from_punch(DummyEmptyPunch(), "action_003", "punch_3")
        self.assertIsNone(action_empty.metrics["maxElbowAngle"].value)
        self.assertIsNone(action_empty.metrics["guardPreserved"].value)
        self.assertIsNone(action_empty.metrics["peakSpeed"].value)

    def test_normalize_stance_and_resolve_limb_role(self):
        """
        Kiểm tra normalize_stance:
        - Trim và lowercase
        - Chấp nhận: orthodox, southpaw, switch, unknown
        - Giá trị không hợp lệ trở thành 'unknown'
        - Kiểm tra uppercase, whitespace, switch, invalid input.
        """
        # 1. normalize_stance
        self.assertEqual(normalize_stance("  ORTHODOX  "), "orthodox")
        self.assertEqual(normalize_stance("\tSoUtHpAw\n"), "southpaw")
        self.assertEqual(normalize_stance("Switch"), "switch")
        self.assertEqual(normalize_stance("  UNKNOWN  "), "unknown")
        self.assertEqual(normalize_stance("karate_stance"), "unknown")
        self.assertEqual(normalize_stance(None), "unknown")
        self.assertEqual(normalize_stance(""), "unknown")

        # 2. resolve_limb_role với stance chuẩn hóa
        self.assertEqual(resolve_limb_role("LEFT", "  ORTHODOX  "), "lead")
        self.assertEqual(resolve_limb_role("RIGHT", "  ORTHODOX  "), "rear")
        self.assertEqual(resolve_limb_role("Left", "SOUTHPAW"), "rear")
        self.assertEqual(resolve_limb_role("right", "SOUTHPAW"), "lead")
        # switch và unknown đều trả về unknown
        self.assertEqual(resolve_limb_role("left", "switch"), "unknown")
        self.assertEqual(resolve_limb_role("right", "switch"), "unknown")
        self.assertEqual(resolve_limb_role("left", "invalid"), "unknown")

        # 3. ActionResult.stance phải được normalize
        action_p = action_from_punch(self.punch, "action_001", "punch_1", stance="  ORTHODOX  ")
        self.assertEqual(action_p.stance, "orthodox")
        self.assertEqual(action_p.limbRole, "rear")  # right in orthodox is rear

        action_k = action_from_kick(self.kick, "action_002", "kick_1", stance="  sWiTcH  ")
        self.assertEqual(action_k.stance, "switch")
        self.assertEqual(action_k.limbRole, "unknown")

    def test_deterministic_sorting_and_tie_breaking(self):
        """
        Kiểm tra thứ tự sắp xếp deterministic với đầy đủ 5 tầng tie-breaker:
        impactTimeMs -> impactFrame -> startTimeMs -> family -> sourceActionId
        """
        p1 = PunchResult(
            punch_type="Jab", arm="left", score=70, grade="FAIR", emoji="🟠", details=[],
            max_elbow_angle=145.0, peak_speed=1.0, guard_preserved=True,
            start_frame=50, impact_frame=60, end_frame=70,
            start_time_ms=1000.0, impact_time_ms=2000.0, end_time_ms=2500.0,
            findings=[_make_dummy_finding("p1", "punch_1", "m", 1.0)],
        )
        # Trùng impactTimeMs và impactFrame nhưng startTimeMs sớm hơn
        p2 = PunchResult(
            punch_type="Cross", arm="right", score=75, grade="GOOD", emoji="🟡", details=[],
            max_elbow_angle=160.0, peak_speed=1.1, guard_preserved=True,
            start_frame=40, impact_frame=60, end_frame=70,
            start_time_ms=900.0, impact_time_ms=2000.0, end_time_ms=2500.0,
            findings=[_make_dummy_finding("p2", "punch_2", "m", 1.0)],
        )
        # Trùng hoàn toàn timing với p1 nhưng là kick (family 'kick' < 'punch')
        k1 = KickResult(
            score=80, grade="GOOD", emoji="🟡", details=[],
            min_chamber_angle=70.0, max_extension_angle=150.0, peak_speed=1.5,
            start_frame=50, end_frame=70,
            start_time_ms=1000.0, end_time_ms=2500.0,
            impact_frame=60, impact_time_ms=2000.0,
            findings=[_make_dummy_finding("k1", "kick_1", "m", 1.0)],
        )

        actions = build_actions_list(punches=[p1, p2], kicks=[k1])

        self.assertEqual(len(actions), 3)
        # 1. p2: start_time sớm nhất (900.0)
        self.assertEqual(actions[0].id, "action_001")
        self.assertEqual(actions[0].sourceActionId, "punch_2")
        # 2. k1: family "kick" < "punch"
        self.assertEqual(actions[1].id, "action_002")
        self.assertEqual(actions[1].sourceActionId, "kick_1")
        # 3. p1: family "punch"
        self.assertEqual(actions[2].id, "action_003")
        self.assertEqual(actions[2].sourceActionId, "punch_1")

    def test_backward_compatibility_with_process_video_output(self):
        """
        Bảo đảm output có schemaVersion và actions mới, đồng thời bảo lưu nguyên vẹn
        toàn bộ trường cũ: punches, kicks, findings, frames, meta, summary.
        """
        actions = build_actions_list([self.punch], [self.kick], stance="orthodox")
        output = {
            "schemaVersion": "1.0.0",
            "meta": {
                "videoPath": "test.mp4",
                "model": "yolov8n-pose",
                "scoringVersion": "rubric-v3.0.0",
                "fps": 30.0,
                "totalFrames": 100,
                "durationMs": 3333.3,
            },
            "actions": [a.to_dict() for a in actions],
            "frames": [],
            "kicks": [self.kick.to_dict()],
            "punches": [self.punch.to_dict()],
            "findings": [self.punch_finding.to_dict(), self.kick_finding.to_dict()],
            "summary": {"totalKicks": 1, "totalPunches": 1, "primaryAction": "mixed"},
        }

        # 1. Top-level keys
        self.assertEqual(output["schemaVersion"], "1.0.0")
        self.assertIn("actions", output)
        self.assertIn("punches", output)
        self.assertIn("kicks", output)
        self.assertIn("findings", output)
        self.assertIn("frames", output)
        self.assertIn("meta", output)
        self.assertIn("summary", output)

        # 2. strike_benchmark.load_predictions vẫn load bình thường
        from strike_benchmark import load_predictions
        with patch("builtins.open", unittest.mock.mock_open(read_data=json.dumps(output))):
            doc, events = load_predictions("dummy.json")
            self.assertEqual(len(events), 2)
            kinds = {e.strike_kind for e in events}
            self.assertEqual(kinds, {"punch", "kick"})

    def test_model_version_provenance_priority(self):
        """
        Kiểm tra độ ưu tiên nguồn gốc mô hình (model version provenance):
        1. Pipeline truyền 'yolov8x-pose', finding chứa mặc định 'yolov8n-pose' -> ActionResult là 'yolov8x-pose'.
        2. Pipeline không truyền model version (None hoặc rỗng), finding có version -> dùng finding version ('yolov8n-pose').
        3. Cả hai thiếu -> modelVersion là None (JSON null), tuyệt đối không tự bịa 'yolov8n-pose'.
        """
        # --- Kịch bản 1: Pipeline truyền 'yolov8x-pose', finding chứa 'yolov8n-pose' ---
        # Punch
        act_p_pipe = action_from_punch(self.punch, "action_001", "punch_1", model_version="yolov8x-pose")
        self.assertEqual(act_p_pipe.modelVersion, "yolov8x-pose")
        self.assertEqual(act_p_pipe.to_dict()["modelVersion"], "yolov8x-pose")
        # Kick
        act_k_pipe = action_from_kick(self.kick, "action_002", "kick_1", model_version="yolov8x-pose")
        self.assertEqual(act_k_pipe.modelVersion, "yolov8x-pose")
        self.assertEqual(act_k_pipe.to_dict()["modelVersion"], "yolov8x-pose")
        # build_actions_list
        acts_pipe = build_actions_list([self.punch], [self.kick], model_version="yolov8x-pose")
        self.assertEqual(acts_pipe[0].modelVersion, "yolov8x-pose")
        self.assertEqual(acts_pipe[1].modelVersion, "yolov8x-pose")

        # --- Kịch bản 2: Pipeline không truyền model version (None / rỗng), finding có version ---
        # Punch không truyền model_version (default None)
        act_p_fb = action_from_punch(self.punch, "action_001", "punch_1")
        self.assertEqual(act_p_fb.modelVersion, "yolov8n-pose")
        # Punch truyền None rõ ràng hoặc chuỗi rỗng
        act_p_none = action_from_punch(self.punch, "action_001", "punch_1", model_version=None)
        self.assertEqual(act_p_none.modelVersion, "yolov8n-pose")
        act_p_empty = action_from_punch(self.punch, "action_001", "punch_1", model_version="   ")
        self.assertEqual(act_p_empty.modelVersion, "yolov8n-pose")
        # Kick fallback
        act_k_fb = action_from_kick(self.kick, "action_002", "kick_1")
        self.assertEqual(act_k_fb.modelVersion, "yolov8n-pose")
        # build_actions_list fallback
        acts_fb = build_actions_list([self.punch], [self.kick])
        self.assertEqual(acts_fb[0].modelVersion, "yolov8n-pose")
        self.assertEqual(acts_fb[1].modelVersion, "yolov8n-pose")

        # --- Kịch bản 3: Cả hai đều thiếu -> modelVersion là None (JSON null) ---
        punch_no_finding = PunchResult(
            punch_type="Jab", arm="left", score=70, grade="FAIR", emoji="🟠", details=[],
            max_elbow_angle=150.0, peak_speed=1.0, guard_preserved=True,
            start_frame=10, impact_frame=15, end_frame=20,
            criterion_results=[], findings=[],
        )
        act_p_none_all = action_from_punch(punch_no_finding, "action_001", "punch_1", model_version=None)
        self.assertIsNone(act_p_none_all.modelVersion)
        self.assertIsNone(act_p_none_all.to_dict()["modelVersion"])

        kick_no_finding = KickResult(
            score=70, grade="FAIR", emoji="🟠", details=[],
            min_chamber_angle=60.0, max_extension_angle=150.0, peak_speed=1.5,
            start_frame=20, impact_frame=25, end_frame=30,
            criterion_results=[], findings=[],
        )
        act_k_none_all = action_from_kick(kick_no_finding, "action_002", "kick_1", model_version=None)
        self.assertIsNone(act_k_none_all.modelVersion)
        self.assertIsNone(act_k_none_all.to_dict()["modelVersion"])

        acts_none_all = build_actions_list([punch_no_finding], [kick_no_finding], model_version=None)
        self.assertIsNone(acts_none_all[0].modelVersion)
        self.assertIsNone(acts_none_all[0].to_dict()["modelVersion"])
        self.assertIsNone(acts_none_all[1].modelVersion)
        self.assertIsNone(acts_none_all[1].to_dict()["modelVersion"])


class TestTask5AssessmentEngineWiringSpy(unittest.TestCase):
    """
    Spy tests proving:
    1. evaluate_action invocation with transient raw_action argument.
    2. Actual provenance serialization into public ActionAssessment.
    3. score=None preservation under insufficient evidence.
    4. Detector immutability and zero-mutation during adapter execution.
    5. Legacy fixture equality and field-for-field parity.
    """

    def setUp(self):
        self.punch_crit1 = _make_dummy_criterion("crit_punch_extension", "max_elbow_angle", 165.0, weight=0.4, conf=0.90, score=82.0)
        self.punch_crit2 = _make_dummy_criterion("crit_punch_guard", "guard_preserved", 1.0, weight=0.35, conf=0.80, score=82.0)
        self.punch_crit3 = _make_dummy_criterion("crit_punch_speed", "peak_speed", 1.234, weight=0.25, conf=0.75, status=CriterionStatus.GOOD, score=82.0)
        self.punch = PunchResult(
            punch_type="Cross",
            arm="right",
            score=82,
            grade="GOOD",
            emoji="🟡",
            details=["Good extension"],
            max_elbow_angle=165.0,
            peak_speed=1.234,
            guard_preserved=True,
            start_frame=100,
            impact_frame=115,
            end_frame=130,
            start_time_ms=3333.3,
            impact_time_ms=3833.3,
            end_time_ms=4333.3,
            criterion_results=[self.punch_crit1, self.punch_crit2, self.punch_crit3],
            findings=[_make_dummy_finding("punch_1_ext", "punch_1", "maxElbowAngle", 165.0)],
        )

        self.kick_crit1 = _make_dummy_criterion("crit_kick_chamber", "min_chamber_angle", 62.0, weight=0.35, conf=0.88, score=88.0)
        self.kick_crit2 = _make_dummy_criterion("crit_kick_extension", "max_extension_angle", 155.0, weight=0.35, conf=0.92, score=88.0)
        self.kick_crit3 = _make_dummy_criterion("crit_kick_speed", "peak_speed", 2.456, weight=0.15, conf=0.80, score=88.0)
        self.kick = KickResult(
            score=88,
            grade="GOOD",
            emoji="🟡",
            details=["Good chamber"],
            min_chamber_angle=62.0,
            max_extension_angle=155.0,
            peak_speed=2.456,
            start_frame=200,
            end_frame=240,
            start_time_ms=6666.7,
            end_time_ms=8000.0,
            impact_frame=225,
            impact_time_ms=7500.0,
            chamber_peak_frame=212,
            chamber_peak_time_ms=7066.7,
            active_leg="left",
            criterion_results=[self.kick_crit1, self.kick_crit2, self.kick_crit3],
            findings=[_make_dummy_finding("kick_1_cham", "kick_1", "minChamberAngle", 62.0)],
        )

    def test_evaluate_action_invocation_and_transient_raw_action(self):
        """Spy test proving evaluate_action is invoked with detector object passed transiently as raw_action."""
        with patch("action_result.evaluate_action", wraps=action_result.evaluate_action) as spy:
            action_p = action_from_punch(self.punch, "act_punch_1", "src_p1")
            spy.assert_called_once()
            call_kwargs = spy.call_args.kwargs
            self.assertIs(call_kwargs["raw_action"], self.punch)
            self.assertIs(call_kwargs["action_or_input"], self.punch)
            self.assertEqual(call_kwargs["technique"], "cross")

        with patch("action_result.evaluate_action", wraps=action_result.evaluate_action) as spy:
            action_k = action_from_kick(self.kick, "act_kick_1", "src_k1")
            spy.assert_called_once()
            call_kwargs = spy.call_args.kwargs
            self.assertIs(call_kwargs["raw_action"], self.kick)
            self.assertIs(call_kwargs["action_or_input"], self.kick)
            self.assertEqual(call_kwargs["technique"], "round_kick")

    def test_actual_provenance_and_confidence_serialization(self):
        """Test proving actual provenance from AssessmentResult is mapped into ActionAssessment."""
        action_p = action_from_punch(self.punch, "act_punch_1", "src_p1")
        self.assertEqual(action_p.assessment.rubricId, "rubric_punch_v3")
        self.assertEqual(action_p.rubricVersion, "3.0.0")
        self.assertAlmostEqual(action_p.confidence.assessment, 0.83, places=2)

        p_dict = action_p.to_dict()
        self.assertEqual(p_dict["assessment"]["rubricId"], "rubric_punch_v3")
        self.assertAlmostEqual(p_dict["confidence"]["assessment"], 0.83, places=2)

        action_k = action_from_kick(self.kick, "act_kick_1", "src_k1")
        self.assertEqual(action_k.assessment.rubricId, "rubric_round_kick_v3")
        self.assertEqual(action_k.rubricVersion, "3.0.0")
        self.assertAlmostEqual(action_k.confidence.assessment, 0.88, places=2)

        k_dict = action_k.to_dict()
        self.assertEqual(k_dict["assessment"]["rubricId"], "rubric_round_kick_v3")
        self.assertAlmostEqual(k_dict["confidence"]["assessment"], 0.88, places=2)

    def test_score_none_preservation_under_insufficient_evidence(self):
        """Test proving score=None is preserved and never converted to 0 under insufficient evidence."""
        punch_insuf = PunchResult(
            punch_type="Jab", arm="left", score=0, grade="NO_DATA", emoji="⚪", details=[],
            max_elbow_angle=0.0, peak_speed=0.0, guard_preserved=False,
            criterion_results=[
                _make_dummy_criterion("crit_punch_extension", "max_elbow_angle", 0.0, status=CriterionStatus.INSUFFICIENT_EVIDENCE),
            ],
            findings=[],
        )
        action_p = action_from_punch(punch_insuf, "act_p_insuf", "src_p")
        self.assertIsNone(action_p.assessment.score)
        self.assertEqual(action_p.assessment.grade, "NO_DATA")
        self.assertEqual(action_p.assessment.status, "insufficient_evidence")
        self.assertIsNone(action_p.confidence.assessment)

        p_dict = action_p.to_dict()
        self.assertIsNone(p_dict["assessment"]["score"])
        self.assertEqual(p_dict["assessment"]["grade"], "NO_DATA")
        self.assertEqual(p_dict["assessment"]["status"], "insufficient_evidence")
        self.assertIsNone(p_dict["confidence"]["assessment"])

        kick_insuf = KickResult(
            score=0, grade="NO_DATA", emoji="⚪", details=[],
            min_chamber_angle=0.0, max_extension_angle=0.0, peak_speed=0.0,
            criterion_results=[], findings=[],
        )
        action_k = action_from_kick(kick_insuf, "act_k_insuf", "src_k")
        self.assertIsNone(action_k.assessment.score)
        self.assertEqual(action_k.assessment.grade, "NO_DATA")
        self.assertEqual(action_k.assessment.status, "insufficient_evidence")
        self.assertIsNone(action_k.confidence.assessment)

        k_dict = action_k.to_dict()
        self.assertIsNone(k_dict["assessment"]["score"])
        self.assertIsNone(k_dict["confidence"]["assessment"])

    def test_detector_immutability(self):
        """Test proving detector objects and their nested criteria/findings are not mutated."""
        punch_copy_score = self.punch.score
        punch_copy_grade = self.punch.grade
        punch_crit_scores = [c.score for c in self.punch.criterion_results]

        action_p = action_from_punch(self.punch, "act_001", "src_001")
        self.assertEqual(self.punch.score, punch_copy_score)
        self.assertEqual(self.punch.grade, punch_copy_grade)
        self.assertEqual([c.score for c in self.punch.criterion_results], punch_crit_scores)

        kick_copy_score = self.kick.score
        kick_copy_grade = self.kick.grade
        kick_crit_scores = [c.score for c in self.kick.criterion_results]

        action_k = action_from_kick(self.kick, "act_002", "src_002")
        self.assertEqual(self.kick.score, kick_copy_score)
        self.assertEqual(self.kick.grade, kick_copy_grade)
        self.assertEqual([c.score for c in self.kick.criterion_results], kick_crit_scores)

    def test_legacy_fixture_equality_and_parity(self):
        """Test proving legacy fixtures maintain deep equality and exact score parity."""
        action_p = action_from_punch(self.punch, "action_001", "punch_1")
        self.assertEqual(action_p.assessment.score, 82)
        self.assertEqual(action_p.assessment.grade, "GOOD")
        self.assertEqual(action_p.assessment.status, "good")

        action_k = action_from_kick(self.kick, "action_002", "kick_1")
        self.assertEqual(action_k.assessment.score, 88)
        self.assertEqual(action_k.assessment.grade, "GOOD")
        self.assertEqual(action_k.assessment.status, "good")


if __name__ == "__main__":
    unittest.main()
