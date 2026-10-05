"""Adapt immutable worker evidence for the authoritative coaching callback."""
from __future__ import annotations

from copy import deepcopy

from pipeline.release_safety import withhold_unvalidated_assessment


def build_coaching_delivery(job_id: str, result: dict) -> dict:
    actions = []
    quality = result.get("analysisQuality", {}).get("status", "unknown")
    guarded = withhold_unvalidated_assessment({"actions": result.get("actions", []),
        "analysisQuality": result.get("analysisQuality", {}), "sessionInsights": result.get("sessionInsights", {})})
    for action in guarded["actions"]:
        assessment = action.get("assessment", {})
        # An evidence confidence from a rubric is never a detector probability.
        confidence = action.get("confidence", {}).get("detection")
        # No validated production assessor exists yet. Quality-pass only means
        # the video is observable, not that a technique/score is correct.
        actions.append({
            "actionId": action["id"], "technique": action.get("technique", "unknown"),
            "limbSide": action.get("attackingSide", "unknown"),
            "assessmentStatus": "INSUFFICIENT_EVIDENCE",
            "overallScore": None,
            "grade": None, "confidence": confidence,
            "rubricId": assessment.get("rubricId"), "phases": action.get("phases", {}),
            "kinematicFeatures": action.get("metrics", {}),
            "criteriaScores": {"criteria": []},
            "findings": assessment.get("findings", []),
            "evidence": {"qualityStatus": quality, "confidence": action.get("confidence", {})},
            "provenance": {"modelVersion": action.get("modelVersion"),
                           "rubricVersion": action.get("rubricVersion"),
                           "shadowClassification": action.get("shadowClassification")},
        })
    return {"jobId": job_id, "actions": actions, "provenance": {
        "schemaVersion": result.get("schemaVersion"),
        # Exclude temporary URLs/timestamps from the semantic receipt digest.
        "model": result.get("meta", {}).get("model"),
        "detectorVersion": result.get("meta", {}).get("detectorVersion"),
        "scoringVersion": result.get("meta", {}).get("scoringVersion"),
        "analysisQuality": result.get("analysisQuality", {}),
        "sessionInsights": guarded["sessionInsights"],
        "productionReadiness": guarded["productionReadiness"],
        "movementEvidence": deepcopy(result.get("movementEvidence")),
    }}
