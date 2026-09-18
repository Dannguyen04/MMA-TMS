"""
test_finding_engine.py — Comprehensive Unit & Determinism Tests for Task 10 Finding Engine
"""

import copy
import json
import unittest

from pipeline.contracts import EvidenceLevel
from pipeline.finding_engine import (
    EvidenceReference,
    FindingEngine,
    FindingErrorCode,
    FindingScope,
    FindingSeverity,
    RubricProvenance,
    StandardFinding,
)


class TestFindingEngine(unittest.TestCase):

    def test_punch_elbow_underextended(self):
        finding = FindingEngine.from_criterion_result(
            criterion_id="maxElbowAngle",
            status="needs_improvement",
            score=50,
            measured_value=128.5,
            action_id="punch_1",
            family="punch",
            rubric_id="boxing_jab_v3",
            impact_frame=15,
            impact_time_ms=500.0,
            confidence=0.88,
        )
        self.assertIsNotNone(finding)
        self.assertEqual(finding.code, FindingErrorCode.PUNCH_ELBOW_UNDEREXTENDED)
        self.assertEqual(finding.severity, FindingSeverity.WARNING)
        self.assertEqual(len(finding.evidence_refs), 1)
        self.assertEqual(finding.evidence_refs[0].frame_idx, 15)
        self.assertAlmostEqual(finding.evidence_refs[0].metric_value, 128.5)
        self.assertEqual(finding.provenance.rubric_id, "boxing_jab_v3")

    def test_punch_guard_dropped_critical(self):
        finding = FindingEngine.from_criterion_result(
            criterion_id="guardPreserved",
            status="needs_improvement",
            score=0,
            measured_value=0.0,
            action_id="punch_2",
            family="punch",
            rubric_id="boxing_cross_v3",
            impact_frame=25,
            impact_time_ms=833.3,
        )
        self.assertIsNotNone(finding)
        self.assertEqual(finding.code, FindingErrorCode.PUNCH_GUARD_DROPPED)
        self.assertEqual(finding.severity, FindingSeverity.CRITICAL)
        self.assertEqual(finding.category, "guard")

    def test_kick_chamber_low(self):
        finding = FindingEngine.from_criterion_result(
            criterion_id="minChamberAngle",
            status="needs_improvement",
            score=40,
            measured_value=85.0,
            action_id="kick_1",
            family="kick",
            rubric_id="muay_thai_roundhouse_v3",
            impact_frame=30,
            impact_time_ms=1000.0,
        )
        self.assertIsNotNone(finding)
        self.assertEqual(finding.code, FindingErrorCode.KICK_CHAMBER_LOW)
        self.assertEqual(finding.severity, FindingSeverity.WARNING)

    def test_insufficient_evidence_never_creates_finding(self):
        finding = FindingEngine.from_criterion_result(
            criterion_id="maxElbowAngle",
            status="insufficient_evidence",
            score=None,
            measured_value=None,
            action_id="punch_3",
            family="punch",
            rubric_id="boxing_jab_v3",
        )
        self.assertIsNone(finding)

    def test_measured_value_none_never_creates_finding(self):
        finding = FindingEngine.from_criterion_result(
            criterion_id="guardPreserved",
            status="fair",
            score=60,
            measured_value=None,
            action_id="punch_4",
            family="punch",
            rubric_id="boxing_jab_v3",
        )
        self.assertIsNone(finding)

    def test_non_medical_wording_neutrality(self):
        # Trying to construct a finding with forbidden medical terms must raise ValueError
        ref = EvidenceReference(
            frame_idx=10,
            time_ms=333.3,
            metric_name="test",
            metric_value=1.0,
        )
        prov = RubricProvenance(rubric_id="r", criterion_id="c")
        with self.assertRaises(ValueError):
            StandardFinding(
                id="f_invalid",
                code=FindingErrorCode.PUNCH_ELBOW_UNDEREXTENDED,
                title="Nguy cơ chấn thương khớp",
                description="Có dấu hiệu viêm hoặc rách cơ do sai tư thế",
                scope=FindingScope.ACTION,
                severity=FindingSeverity.WARNING,
                confidence=0.8,
                evidence_level=EvidenceLevel.OBSERVED,
                evidence_refs=(ref,),
                provenance=prov,
                recommendation="Khám bác sĩ điều trị",
            )

    def test_deterministic_deduplication(self):
        f1 = FindingEngine.from_criterion_result(
            criterion_id="guardPreserved",
            status="needs_improvement",
            score=0,
            measured_value=0.0,
            action_id="punch_1",
            family="punch",
            rubric_id="boxing_jab_v3",
            impact_frame=15,
            impact_time_ms=500.0,
        )
        # Duplicate with different frame
        f2 = FindingEngine.from_criterion_result(
            criterion_id="guardPreserved",
            status="needs_improvement",
            score=0,
            measured_value=0.0,
            action_id="punch_1",
            family="punch",
            rubric_id="boxing_jab_v3",
            impact_frame=18,
            impact_time_ms=600.0,
        )
        deduped = FindingEngine.deduplicate_findings([f1, f2])
        self.assertEqual(len(deduped), 1)
        self.assertEqual(deduped[0].code, FindingErrorCode.PUNCH_GUARD_DROPPED)
        # Combined evidence references
        self.assertEqual(len(deduped[0].evidence_refs), 2)

    def test_legacy_format_compatibility(self):
        finding = FindingEngine.from_criterion_result(
            criterion_id="maxElbowAngle",
            status="needs_improvement",
            score=50,
            measured_value=130.0,
            action_id="punch_1",
            family="punch",
            rubric_id="boxing_jab_v3",
            impact_frame=10,
            impact_time_ms=333.3,
            confidence=0.85,
        )
        legacy_dict = finding.to_legacy_dict()
        required_keys = [
            "id", "category", "title", "description", "severity",
            "confidence", "frame_idx", "time_ms", "metric_name",
            "metric_value", "recommendation", "action_id", "model_version",
            "scoring_version",
        ]
        for key in required_keys:
            self.assertIn(key, legacy_dict)
        self.assertEqual(legacy_dict["frame_idx"], 10)
        self.assertEqual(legacy_dict["metric_value"], 130.0)

    def test_json_safe_serialization(self):
        finding = FindingEngine.from_criterion_result(
            criterion_id="minChamberAngle",
            status="needs_improvement",
            score=45,
            measured_value=82.0,
            action_id="kick_1",
            family="kick",
            rubric_id="muay_thai_roundhouse_v3",
            impact_frame=20,
            impact_time_ms=666.7,
        )
        d = finding.to_dict()
        serialized = json.dumps(d)
        deserialized = json.loads(serialized)
        self.assertEqual(deserialized["code"], FindingErrorCode.KICK_CHAMBER_LOW.value)
        self.assertEqual(deserialized["evidenceRefs"][0]["metricValue"], 82.0)


if __name__ == "__main__":
    unittest.main()

