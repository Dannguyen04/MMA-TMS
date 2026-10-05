from copy import deepcopy

from coaching_delivery import build_coaching_delivery
from pipeline.release_safety import withhold_unvalidated_assessment


def test_quality_pass_does_not_prove_technique_correctness():
    result = {"analysisQuality": {"status": "pass"}, "actions": [{"id": "action_1", "family": "punch",
        "technique": "cross", "confidence": {"assessment": .99}, "phases": {"startFrame": 10, "endFrame": 20},
        "assessment": {"score": 99, "grade": "PERFECT", "status": "excellent", "findings": [{"id": "claim"}]}}],
        "punches": [{"punchType": "Cross", "score": 99, "details": ["perfect"], "findings": [{"id": "claim"}]}],
        "findings": [{"id": "claim"}], "sessionInsights": {"priorityFindings": [{"title": "perfect"}]},
        "coachingPlan": {"recommendations": [{"drill": "unverified"}]},
        "advancedAI": {"sequences": [{"confidence": .99}]}, "baseline": {"isActive": True}}
    original = deepcopy(result)
    guarded = withhold_unvalidated_assessment(result)
    assert result == original
    assert guarded["productionReadiness"]["assessmentEnabled"] is False
    action = guarded["actions"][0]
    assert action["id"] == "action_1" and action["phases"] == original["actions"][0]["phases"]
    assert action["technique"] == "unknown_punch"
    assert action["experimentalTechnique"]["candidate"] == "cross"
    assert action["assessment"]["score"] is None and not action["assessment"]["findings"]
    assert not guarded["findings"] and not guarded["sessionInsights"]["priorityFindings"]
    assert guarded["sessionInsights"]["coverageSummary"]["assessedActionsCount"] == 0
    assert not guarded["coachingPlan"]["recommendations"] and not guarded["advancedAI"]["sequences"]
    assert guarded["baseline"]["isActive"] is False
    assert guarded["punches"][0]["score"] is None and not guarded["punches"][0]["details"]
    assert withhold_unvalidated_assessment(guarded) == guarded


def test_callback_cannot_restore_score_even_for_unguarded_quality_pass_result():
    raw = {"analysisQuality": {"status": "pass"}, "actions": [{"id": "action_1", "assessment": {"score": 99, "grade": "PERFECT"}}]}
    action = build_coaching_delivery("job", raw)["actions"][0]
    assert action["overallScore"] is None and action["grade"] is None
    assert action["assessmentStatus"] == "INSUFFICIENT_EVIDENCE"
    assert action["technique"] == "unknown_strike" and action["findings"] == []


def test_empty_video_does_not_claim_full_coverage_or_scores():
    guarded = withhold_unvalidated_assessment({"actions": [], "sessionInsights": {}})
    assert guarded["summary"]["bestScore"] is None
    assert guarded["sessionInsights"]["coverageSummary"]["insufficientEvidenceRate"] == 0
