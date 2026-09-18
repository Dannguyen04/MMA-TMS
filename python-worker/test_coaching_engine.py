"""
test_coaching_engine.py — Unit Tests for Task 12 Coaching Engine
"""

import json
import unittest

from pipeline.coaching_engine import (
    APPROVED_DRILL_CATALOG,
    CoachingEngine,
    SessionCoachingPlan,
)
from pipeline.finding_engine import FindingErrorCode
from pipeline.session_aggregation import (
    PriorityFindingSummary,
    SessionCoverageSummary,
    SessionInsights,
)


def _make_dummy_insights(codes: list[str]) -> SessionInsights:
    priorities = []
    for i, c in enumerate(codes):
        priorities.append(
            PriorityFindingSummary(
                rank=i + 1,
                code=c,
                title=f"Title for {c}",
                description=f"Desc for {c}",
                severity="warning",
                frequency=3,
                priority_score=10.0 - i,
                affected_action_ids=("a1", "a2"),
                representative_frame=15,
                representative_time_ms=500.0,
                primary_recommendation="Luyện tập bài bản.",
            )
        )
    cov = SessionCoverageSummary(
        total_detected_actions=len(codes),
        assessed_actions_count=len(codes),
        insufficient_evidence_count=0,
        insufficient_evidence_rate=0.0,
        unknown_technique_count=0,
        unknown_technique_rate=0.0,
        degraded_quality_count=0,
        degraded_quality_rate=0.0,
    )
    return SessionInsights(
        status="completed",
        total_actions=len(codes),
        family_distribution={"punch": len(codes)},
        technique_distribution={"jab": len(codes)},
        side_distribution={"left": len(codes)},
        status_distribution={"good": len(codes)},
        coverage_summary=cov,
        priority_findings=tuple(priorities),
    )


class TestCoachingEngine(unittest.TestCase):

    def test_catalog_structure_and_completeness(self):
        for code, drill in APPROVED_DRILL_CATALOG.items():
            self.assertTrue(len(drill.drill_id) > 0)
            self.assertTrue(len(drill.title) > 0)
            self.assertTrue(len(drill.objective) > 0)
            self.assertGreater(len(drill.instructions), 0)
            self.assertTrue(len(drill.safety_note) > 0)
            self.assertTrue(len(drill.applicability) > 0)
            self.assertTrue(len(drill.contraindications) > 0)
            self.assertEqual(drill.catalog_version, "1.0.0")

    def test_dual_mode_generation(self):
        insights = _make_dummy_insights([FindingErrorCode.PUNCH_GUARD_DROPPED.value])
        plan = CoachingEngine.generate_coaching_plan(insights)

        self.assertEqual(len(plan.recommendations), 1)
        rec = plan.recommendations[0]

        # Athlete Mode: contains concise cue and drill title
        self.assertIn("[Ưu tiên 1]", rec.athlete_cue)
        self.assertIn("Phone-to-Ear & Tennis Ball Guard Drill", rec.athlete_cue)

        # Coach Mode: contains telemetry, frame, time, severity
        c_notes = rec.coach_notes
        self.assertEqual(c_notes["errorCode"], FindingErrorCode.PUNCH_GUARD_DROPPED.value)
        self.assertEqual(c_notes["representativeFrame"], 15)
        self.assertEqual(c_notes["severity"], "warning")
        self.assertIn("drillObjective", c_notes)

    def test_max_3_recommendations_enforced(self):
        # Even if input has 5 findings, plan must only contain at most 3
        insights = _make_dummy_insights([
            FindingErrorCode.PUNCH_GUARD_DROPPED.value,
            FindingErrorCode.PUNCH_ELBOW_UNDEREXTENDED.value,
            FindingErrorCode.KICK_CHAMBER_LOW.value,
            FindingErrorCode.PUNCH_LOW_SPEED.value,
        ])
        plan = CoachingEngine.generate_coaching_plan(insights)
        self.assertEqual(len(plan.recommendations), 3)
        ranks = [r.priority_rank for r in plan.recommendations]
        self.assertEqual(ranks, [1, 2, 3])

    def test_safe_fallback_for_unknown_code(self):
        insights = _make_dummy_insights(["TECH_UNEXPECTED_CUSTOM_ERROR"])
        plan = CoachingEngine.generate_coaching_plan(insights)
        self.assertEqual(len(plan.recommendations), 1)
        rec = plan.recommendations[0]
        self.assertIsNone(rec.drill)
        self.assertEqual(rec.coach_notes.get("status"), "NO_APPROVED_DRILL")

    def test_empty_session_coaching_plan(self):
        insights = _make_dummy_insights([])
        plan = CoachingEngine.generate_coaching_plan(insights)
        self.assertEqual(len(plan.recommendations), 0)

    def test_json_safe_serialization(self):
        insights = _make_dummy_insights([FindingErrorCode.KICK_HIP_LEAN_EXCESSIVE.value])
        plan = CoachingEngine.generate_coaching_plan(insights)
        d = plan.to_dict()
        serialized = json.dumps(d)
        deserialized = json.loads(serialized)
        self.assertEqual(len(deserialized["recommendations"]), 1)
        self.assertEqual(deserialized["catalogVersion"], "1.0.0")


if __name__ == "__main__":
    unittest.main()

