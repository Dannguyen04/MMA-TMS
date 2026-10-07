"""Package manually inspected AI notes as provisional triage, never coach approval."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build(pack, evidence_dir, notes_path, output):
    index_path = pack / "review_index.json"
    index = json.loads(index_path.read_text(encoding="utf-8"))
    evidence_path = evidence_dir / "evidence.json"
    evidence = json.loads(evidence_path.read_text(encoding="utf-8"))
    notes = json.loads(notes_path.read_text(encoding="utf-8"))
    if evidence["packId"] != index["packId"]:
        raise ValueError("Evidence belongs to another pack")
    by_id = {e["sampleId"]: e for e in evidence["evidence"]}
    if len(by_id) != len(evidence["evidence"]) or set(by_id) != {t["sampleId"] for t in index["tasks"]}:
        raise ValueError("Evidence coverage mismatch")
    for name, expected in evidence["sheetHashes"].items():
        if Path(name).name != name or digest(evidence_dir / name) != expected:
            raise ValueError("Evidence sheet changed")
    for video in index["videos"]:
        if digest(pack / video["path"]) != video["sha256"]:
            raise ValueError("Video changed")
    if set(notes) != {v["videoId"] for v in index["videos"]}:
        raise ValueError("Notes video coverage mismatch")
    reviews = []
    for video_id, video_notes in notes.items():
        tasks = [t for t in index["tasks"] if t["videoId"] == video_id]
        if len(tasks) != len(video_notes):
            raise ValueError("Notes task coverage mismatch")
        for task, (candidate, decision, note) in zip(tasks, video_notes):
            if decision not in {"candidate", "fragment", "uncertain", "multiple_actions", "out_of_scope"}:
                raise ValueError("Unsupported triage decision")
            if (candidate is not None and candidate not in index["labels"][:6]) or ((decision == "candidate") != (candidate is not None)):
                raise ValueError("Invalid candidate label")
            if not isinstance(note, str) or not note.strip():
                raise ValueError("Missing observation")
            item = by_id[task["sampleId"]]
            if not item["frameIndices"] or any(f < task["startFrame"] or f >= task["endFrameExclusive"] for f in item["frameIndices"]):
                raise ValueError("Evidence lies outside task")
            if item["videoSha256"] != next(v["sha256"] for v in index["videos"] if v["videoId"] == video_id):
                raise ValueError("Evidence video hash mismatch")
            reviews.append({"sampleId": task["sampleId"], "videoId": video_id,
                "status": "AI_REVIEW_PROVISIONAL", "actorType": "AI",
                "reviewerId": "codex-ai-visual-review", "coachConfirmed": False,
                "humanReviewed": False, "goldEligible": False, "productionEligible": False,
                "labelProvenance": "AI_VISUAL_TRIAGE", "technique": None,
                "candidateTechnique": candidate, "confidence": None, "decision": decision,
                "observation": note, "sourceSuggestedTechnique": task["suggestedTechnique"],
                "candidateDisagreesWithSource": bool(candidate and task["suggestedTechnique"] and candidate != task["suggestedTechnique"]),
                "startTimeMs": task["startTimeMs"], "endTimeMs": task["endTimeMs"],
                "boundariesConfirmed": False, "evidence": item})
    report = {"schemaVersion": "ai_visual_triage_v1", "reviewedOnLocal": "2026-10-06",
        "timezone": "Asia/Saigon", "packId": index["packId"], "actorType": "AI",
        "status": "AI_REVIEW_PROVISIONAL", "coachConfirmed": False, "goldEligible": False,
        "productionEligible": False, "annotationCoverage": "sampled_frames_only",
        "method": evidence["method"], "continuousPlaybackReviewed": False,
        "sourceLabelsPreviouslyKnown": True, "blindReview": False,
        "sourceLabelsVisibleOnSheets": False, "techniqueQualityScored": False,
        "intendedUse": "triage_only_not_supervised_training",
        "inputHashes": {"review_index.json": digest(index_path), "evidence.json": digest(evidence_path),
                        "review_notes.json": digest(notes_path)},
        "sheetHashes": evidence["sheetHashes"], "reviewCount": len(reviews),
        "decisionCounts": dict(Counter(r["decision"] for r in reviews)),
        "candidateSourceDisagreements": sum(r["candidateDisagreesWithSource"] for r in reviews),
        "researchSkeletons": {"count": index["researchSampleCount"], "status": "NOT_VISUALLY_REVIEWABLE_MISSING_RGB",
                              "humanReviewed": False, "coachConfirmed": False, "goldEligible": False},
        "limitations": ["At most six sampled frames per task; fast actions can be missed.",
            "Candidate labels and scope judgements are AI suggestions, not expert validation.",
            "Frame/FPS timing is provisional; no action boundaries were approved.",
            "Previous source labels were known; this is not a blinded review.",
            "Out of scope means outside solo-boxing training, not absence of strikes.",
            "No confidence calibration, technique quality score or athlete identity was inferred."],
        "reviews": reviews}
    with output.open("x", encoding="utf-8") as stream:
        json.dump(report, stream, ensure_ascii=False, indent=2, allow_nan=False)
    print(json.dumps({k: report[k] for k in ("reviewCount", "decisionCounts", "candidateSourceDisagreements")}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pack", type=Path)
    parser.add_argument("evidence", type=Path)
    parser.add_argument("notes", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    build(args.pack, args.evidence, args.notes, args.output)
