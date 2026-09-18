"""
test_session_aggregation.py — Unit & Determinism Tests for Task 11 Session Aggregation
"""

import copy
import json
import unittest

from pipeline.session_aggregation import (
    PriorityFindingSummary,
    SessionAggregationEngine,
    SessionCoverageSummary,
    SessionInsights,
)


def _make_action(
    action_id: str,
    family: str = "punch",
    technique: str = "jab",
    side: str = "left",
    status: str = "good",
    findings: list = None,
) -> dict:
    return {
        "id": action_id,
        "family": family,
        "technique": technique,
        "attackingSide": side,
        "assessment": {
            "status": status,
            "findings": findings or [],
        },
    }


class TestSessionAggregation(unittest.TestCase):

    def test_empty_session_handling(self):
        insights = SessionAggregationEngine.aggregate_session([])
        self.assertEqual(insights.status, "empty_session")
        self.assertEqual(insights.total_actions, 0)
        self.assertEqual(len(insights.priority_findings), 0)
        self.assertEqual(insights.coverage_summary.total_detected_actions, 0)

    def test_insufficient_evidence_session(self):
        actions = [
            _make_action("a1", status="insufficient_evidence"),
            _make_action("a2", status="insufficient_evidence"),
        ]
        insights = SessionAggregationEngine.aggregate_session(actions)
        self.assertEqual(insights.status, "insufficient_evidence")
        self.assertEqual(insights.coverage_summary.insufficient_evidence_count, 2)
        self.assertAlmostEqual(insights.coverage_summary.insufficient_evidence_rate, 1.0)
        self.assertEqual(len(insights.priority_findings), 0)

    def test_denominator_transparency(self):
        # 10 actions: 2 unknown, 3 insufficient_evidence, 1 degraded quality
        actions = []
        for i in range(5):
            actions.append(_make_action(f"a_{i}", technique="jab", status="good"))
        for i in range(5, 7):
            actions.append(_make_action(f"a_{i}", technique="unknown", status="fair"))
        for i in range(7, 10):
            actions.append(_make_action(f"a_{i}", technique="cross", status="insufficient_evidence"))

        insights = SessionAggregationEngine.aggregate_session(actions, quality_status="pass")
        self.assertEqual(insights.total_actions, 10)
        cov = insights.coverage_summary
        self.assertEqual(cov.total_detected_actions, 10)
        self.assertEqual(cov.unknown_technique_count, 2)
        self.assertAlmostEqual(cov.unknown_technique_rate, 0.20)
        self.assertEqual(cov.insufficient_evidence_count, 3)
        self.assertAlmostEqual(cov.insufficient_evidence_rate, 0.30)
        self.assertEqual(cov.assessed_actions_count, 7)

    def test_priority_ranking_max_3_deterministic(self):
        # Create multiple findings with varying severity and frequency
        # Critical guard drop: 3 occurrences
        # Warning underextended: 4 occurrences
        # Info hyper-extended: 1 occurrence
        # Warning low speed: 2 occurrences
        actions = []
        for i in range(4):
            f_list = []
            if i < 3:
                f_list.append({
                    "code": "TECH_PUNCH_GUARD_DROPPED",
                    "title": "Hạ thấp tay thủ đối diện",
                    "severity": "critical",
                    "frameIdx": 10 + i,
                    "timeMs": 300.0 + i * 30,
                    "recommendation": "Giữ tay thủ cao",
                })
            f_list.append({
                "code": "TECH_PUNCH_ELBOW_UNDEREXTENDED",
                "title": "Biên độ duỗi tay chưa tối ưu",
                "severity": "warning",
                "frameIdx": 20 + i,
                "timeMs": 600.0 + i * 30,
                "recommendation": "Duỗi thẳng tay",
            })
            if i == 0:
                f_list.append({
                    "code": "TECH_PUNCH_ELBOW_HYPEREXTENDED",
                    "title": "Khuỷu tay duỗi tối đa",
                    "severity": "info",
                    "frameIdx": 30,
                    "timeMs": 900.0,
                    "recommendation": "Giữ độ chùng nhẹ",
                })
            if i >= 2:
                f_list.append({
                    "code": "TECH_PUNCH_LOW_SPEED",
                    "title": "Tốc độ phát lực chưa đạt mốc",
                    "severity": "warning",
                    "frameIdx": 40 + i,
                    "timeMs": 1200.0 + i * 30,
                    "recommendation": "Thả lỏng vai",
                })
            actions.append(_make_action(f"act_{i}", findings=f_list))

        insights = SessionAggregationEngine.aggregate_session(actions)
        priorities = insights.priority_findings

        # Must be strictly capped at 3!
        self.assertEqual(len(priorities), 3)
        # Rank 1 must be critical guard drop (highest severity and high frequency)
        self.assertEqual(priorities[0].rank, 1)
        self.assertEqual(priorities[0].code, "TECH_PUNCH_GUARD_DROPPED")
        self.assertEqual(priorities[0].severity, "critical")
        self.assertEqual(priorities[0].frequency, 3)

        # Ranks must be 1, 2, 3 in ascending order
        self.assertEqual([p.rank for p in priorities], [1, 2, 3])

    def test_json_safe_session_insights(self):
        act = _make_action("a_single", findings=[{
            "code": "TECH_KICK_CHAMBER_LOW",
            "title": "Rút gối chưa đủ cao",
            "severity": "warning",
            "frameIdx": 15,
            "timeMs": 500.0,
            "recommendation": "Nâng gối ngang hông",
        }])
        insights = SessionAggregationEngine.aggregate_session([act])
        d = insights.to_dict()
        serialized = json.dumps(d)
        deserialized = json.loads(serialized)
        self.assertEqual(deserialized["status"], "completed")
        self.assertEqual(len(deserialized["priorityFindings"]), 1)


if __name__ == "__main__":
    unittest.main()

