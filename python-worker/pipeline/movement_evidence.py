"""Non-diagnostic video evidence, independent of strike classification.

The thresholds below select footage for human review; they are engineering
defaults, NOT validated clinical or technique thresholds. No scores, ROM,
repetition counts, treatment, baseline activation or clearance are produced.
"""
from __future__ import annotations

from collections import Counter
from collections.abc import Mapping, Sequence
import math
from typing import Any

VERSION = "movement_evidence_v1"
PROTOCOLS = {
    "whole_body_v1": tuple(range(5, 17)),
    "upper_body_v1": tuple(range(5, 11)),
    "lower_body_v1": tuple(range(11, 17)),
}
PURPOSES = {"training", "longitudinal_monitoring", "rehabilitation"}
GUIDANCE = {
    "QUALITY_BLOCKED": "Video quality is insufficient. Review the recording checks and record again.",
    "QUALITY_UNKNOWN": "Quality metadata is missing or unsupported. Reprocess the video before relying on this report.",
    "TRACKING_UNVERIFIED": "Target tracking is not verified. Record one person clearly in view and reprocess.",
    "MULTIPLE_PEOPLE": "Record one athlete at a time; this protocol cannot verify the target in multi-person footage.",
    "INVALID_TIMING": "Frame timing is missing or inconsistent. Re-export the source video and reprocess.",
    "INVALID_DIMENSIONS": "Video dimensions are unavailable. Re-export the original recording.",
    "LOW_FPS": "Use a recording of at least 20 frames per second for this review protocol.",
    "NO_REVIEW_WINDOWS": "No continuous review window was found. Keep the required joints visible for longer.",
    "MISSING_POSE": "Keep the athlete and required joints inside the frame.",
    "LOW_VISIBILITY": "Improve lighting and avoid clothing, equipment or objects obscuring the required joints.",
    "NON_FRESH_POSE": "Cached or unverified poses are excluded from evidence. Reprocess the original video.",
    "TRACKING_BREAK": "Tracking changed or was interrupted. Keep the camera fixed and the athlete visible.",
    "EXERCISE_NOT_DECLARED": "Select the assigned exercise before interpreting exercise-specific progress.",
    "CAMERA_NOT_DECLARED": "Record the camera view so future recordings can be checked for compatibility.",
    "LIMITED_COVERAGE": "Some footage is excluded. Review only the listed windows or record again.",
}


def normalize_exercise_context(value: Mapping[str, Any] | None) -> dict:
    """Declared metadata only: never a verified exercise or an authority grant."""
    if value is None:
        value = {}
    if not isinstance(value, Mapping):
        raise ValueError("exercise_context must be an object")
    if set(value) - {"exerciseId", "protocolId", "purpose"}:
        raise ValueError("Unsupported exercise_context field")
    protocol = value.get("protocolId", "whole_body_v1")
    purpose = value.get("purpose", "training")
    exercise = value.get("exerciseId")
    if not isinstance(protocol, str) or protocol not in PROTOCOLS:
        raise ValueError("Unsupported movement evidence protocol")
    if not isinstance(purpose, str) or purpose not in PURPOSES:
        raise ValueError("Unsupported movement evidence purpose")
    if exercise is not None:
        if not isinstance(exercise, str) or not exercise.strip() or len(exercise) > 120:
            raise ValueError("exerciseId must be a non-empty string of at most 120 characters")
        exercise = exercise.strip()
    return {"exerciseId": exercise, "protocolId": protocol, "purpose": purpose,
            "source": "declared" if exercise else "unspecified", "exerciseVerified": False}


def _finite(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def build_movement_evidence(
    frames: Sequence[Mapping[str, Any]], *, fps: float, width: int, height: int,
    quality: Mapping[str, Any], exercise_context: Mapping[str, Any] | None = None,
    training_mode: str | None = None, camera_view: str | None = None,
    model_version: str | None = None,
) -> dict:
    context = normalize_exercise_context(exercise_context)
    context.update(trainingMode=(training_mode or "").strip().lower() or None,
                   cameraView=(camera_view or "").strip().lower() or None)
    required = PROTOCOLS[context["protocolId"]]
    reasons: list[str] = []
    hard_block = False

    def block(reason: str) -> None:
        nonlocal hard_block
        reasons.append(reason)
        hard_block = True

    if quality.get("status") == "blocked":
        block("QUALITY_BLOCKED")
    elif quality.get("status") not in {"pass", "degraded"}:
        block("QUALITY_UNKNOWN")
    metrics = quality.get("metrics") or {}
    persons = metrics.get("maxSimultaneousPersons")
    if metrics.get("trackingEvidenceAvailable") is not True or not _finite(persons) or persons < 1:
        block("TRACKING_UNVERIFIED")
    elif persons > 1:
        block("MULTIPLE_PEOPLE")
    if not _finite(width) or not _finite(height) or width <= 0 or height <= 0:
        block("INVALID_DIMENSIONS")
    if not _finite(fps) or fps <= 0:
        block("INVALID_TIMING")
    elif fps < 20:
        block("LOW_FPS")
    if not context["exerciseId"]:
        reasons.append("EXERCISE_NOT_DECLARED")
    if context["cameraView"] not in {"front", "side", "diagonal"}:
        reasons.append("CAMERA_NOT_DECLARED")

    # Never sort broken chronology into an apparently valid timeline.
    previous = None
    for frame in frames:
        idx, timestamp = frame.get("frameIdx"), frame.get("timeMs")
        if (not _finite(idx) or int(idx) != idx or idx < 0 or
                not _finite(timestamp) or timestamp < 0 or
                (previous and (idx <= previous[0] or timestamp <= previous[1]))):
            block("INVALID_TIMING")
            break
        if _finite(fps) and fps > 0 and abs(timestamp - idx * 1000 / fps) > max(2, 1000 / fps * .1):
            block("INVALID_TIMING")
            break
        previous = idx, timestamp

    excluded: Counter[str] = Counter()
    runs: list[list[Mapping[str, Any]]] = []
    run: list[Mapping[str, Any]] = []
    usable = 0
    fresh = 0
    for frame in frames:
        is_fresh = frame.get("observationKind") == "fresh_detection"
        fresh += int(is_fresh)
        reason = None
        if not is_fresh:
            reason = "NON_FRESH_POSE"
        elif frame.get("isDiscontinuous") or frame.get("diagnosticOnly"):
            reason = "TRACKING_BREAK"
        else:
            landmarks = frame.get("landmarks")
            if not isinstance(landmarks, (list, tuple)) or len(landmarks) != 17:
                reason = "MISSING_POSE"
            else:
                for idx in required:
                    kp = landmarks[idx]
                    if (not isinstance(kp, Mapping) or
                            any(not _finite(kp.get(k)) for k in ("x", "y", "conf")) or
                            not 0 < kp["x"] < 1 or not 0 < kp["y"] < 1 or
                            not .5 <= kp["conf"] <= 1):
                        reason = "LOW_VISIBILITY"
                        break
        if reason:
            excluded[reason] += 1
            if run:
                runs.append(run)
                run = []
        elif not hard_block:
            usable += 1
            if run and (frame["frameIdx"] != run[-1]["frameIdx"] + 1):
                runs.append(run)
                run = []
            run.append(frame)
    if run:
        runs.append(run)

    # These are footage windows, NOT repetitions, strikes or medically meaningful events.
    windows = []
    for run in runs:
        # Bound window length for review, without merging across missing evidence.
        chunk_size = max(6, int(fps * 5))
        for offset in range(0, len(run), chunk_size):
            chunk = run[offset:offset + chunk_size]
            if len(chunk) < 6 or chunk[-1]["timeMs"] - chunk[0]["timeMs"] < 250:
                continue
            windows.append({"id": f"movement-window-{len(windows) + 1:04d}",
                "startFrame": chunk[0]["frameIdx"], "endFrame": chunk[-1]["frameIdx"],
                "startMs": round(chunk[0]["timeMs"], 3), "endMs": round(chunk[-1]["timeMs"], 3),
                "sampleCount": len(chunk), "confidence": None, "reviewStatus": "requires_review"})
    if not windows:
        reasons.append("NO_REVIEW_WINDOWS")
    reasons.extend(sorted(excluded))
    coverage = usable / len(frames) if frames else 0.0
    if coverage < .9 and windows:
        reasons.append("LIMITED_COVERAGE")
    reasons = list(dict.fromkeys(reasons))
    state = "recapture" if hard_block or not windows else (
        "limited" if quality.get("status") == "degraded" or coverage < .9 else "review_ready")
    return {
        "schemaVersion": "1.0.0", "reportVersion": VERSION, "status": state,
        "context": context,
        "coverage": {"totalFrames": len(frames), "freshPoseFrames": fresh,
                     "usableFrames": usable, "usableRatio": round(coverage, 4),
                     "excludedByReason": dict(sorted(excluded.items()))},
        "reasonCodes": reasons,
        "recordingGuidance": [{"code": r, "message": GUIDANCE[r]} for r in reasons],
        "windows": windows,
        "measurementPolicy": {"validationStatus": "NOT_VALIDATED", "assessmentEnabled": False,
            "clinicalUseEnabled": False, "automaticComparisonEnabled": False,
            "repetitionCount": None},
        "provenance": {"poseModel": model_version, "qualityVersion": quality.get("qualityVersion"),
            "requiredKeypoints": list(required), "minKeypointConfidence": .5,
            "minimumWindowMs": 250, "minimumWindowFrames": 6, "maxWindowSeconds": 5,
            "thresholdStatus": "ENGINEERING_DEFAULTS_NOT_CLINICALLY_VALIDATED"},
        "limitations": ["Review windows are not detected repetitions or verified exercise execution.",
            "Pose visibility is not movement accuracy, technique correctness or clinical validity.",
            "No diagnosis, injury prediction, recovery determination or medical clearance is produced.",
            "Exercise and camera context are declarations, not verified observations."],
    }
