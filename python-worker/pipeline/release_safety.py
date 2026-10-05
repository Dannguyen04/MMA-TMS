"""Fail-closed public output boundary while no production model is validated.

No environment-variable bypass: lifting this policy requires a separately
reviewed release implementation backed by real acceptance evidence.
"""
from __future__ import annotations

from copy import deepcopy

REASONS = ["TECHNIQUE_CLASSIFIER_NOT_VALIDATED", "DETECTION_COVERAGE_UNKNOWN",
           "COACH_AGREEMENT_NOT_ESTABLISHED", "CONFIDENCE_NOT_CALIBRATED"]


def withhold_unvalidated_assessment(result: dict) -> dict:
    """Keep evidence/timeline and identifiers, not unvalidated quality claims."""
    output = deepcopy(result)
    quality_blocked = output.get("analysisQuality", {}).get("status") == "blocked"
    output["productionReadiness"] = {"status": "BLOCKED", "assessmentEnabled": False,
        "mode": "coach_review_only", "policyVersion": "release_safety_v1", "reasonCodes": REASONS.copy()}
    for action in output.get("actions", []):
        if "experimentalTechnique" not in action:
            action["experimentalTechnique"] = {"candidate": action.get("technique"), "validationStatus": "NOT_VALIDATED"}
        action["technique"] = "unknown" if quality_blocked else "unknown_" + action.get("family", "strike")
        action.setdefault("confidence", {}).update(detection=None, classification=None, assessment=None)
        action.setdefault("assessment", {}).update(score=None, grade="insufficient_evidence", status="insufficient_evidence",
            primaryError=None, criteria=[], findings=[])
        action["reasonCodes"] = sorted(set(action.get("reasonCodes", []) + REASONS))
    for key, label_key, unknown in (("punches", "punchType", "Unknown punch"), ("kicks", "kickType", "Unknown kick")):
        for event in output.get(key, []):
            if "experimentalTechnique" not in event:
                event["experimentalTechnique"] = {"candidate": event.get(label_key), "validationStatus": "NOT_VALIDATED"}
            event.update(score=None, grade="INSUFFICIENT_EVIDENCE", emoji="", details=[], criterionResults=[], findings=[])
            event[label_key] = unknown
    output["findings"] = []
    output.setdefault("summary", {}).update(avgScore=None, bestScore=None, bestKickIdx=-1, bestPunchIdx=-1,
                                            scoringStatus="WITHHELD_UNVALIDATED_MODEL")
    insights = output.get("sessionInsights")
    if isinstance(insights, dict):
        count = len(output.get("actions", []))
        insights.update(status="blocked" if quality_blocked else "requires_coach_review", priorityFindings=[], techniqueDistribution={"unknown": count},
                        statusDistribution={"insufficient_evidence": count})
        insights.setdefault("coverageSummary", {}).update(assessedActionsCount=0, insufficientEvidenceCount=count,
            insufficientEvidenceRate=1.0 if count else 0.0, unknownTechniqueCount=count, unknownTechniqueRate=1.0 if count else 0.0)
    if isinstance(output.get("coachingPlan"), dict):
        output["coachingPlan"].update(sessionStatus="requires_coach_review", recommendations=[], reasonCodes=REASONS.copy())
    # Legacy combinations reused rubric confidence as if it were a calibrated
    # event probability. Do not publish these derived conclusions either.
    if isinstance(output.get("advancedAI"), dict):
        output["advancedAI"].update(sequences=[], sessionComparison=None, ghostDifference=None)
    if isinstance(output.get("baseline"), dict):
        output["baseline"].update(isActive=False)
    return output
