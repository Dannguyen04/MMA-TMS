"""Shadow-only punch events, independent of technique labels and rubric scores.

Distances use torso lengths in image coordinates, time uses milliseconds.
No probability or physical-impact claim is derived from these heuristics.
"""
from __future__ import annotations

from collections import Counter
from dataclasses import asdict, dataclass
import math
from typing import Sequence


@dataclass(frozen=True)
class EventDetectorConfig:
    min_confidence: float = 0.4
    min_reach: float = 0.65
    min_prominence: float = 0.04
    min_extension_speed: float = 0.5
    peak_radius_ms: float = 120.0
    evidence_radius_ms: float = 240.0
    refractory_ms: float = 160.0
    max_torso_tilt_ratio: float = 1.5


def _feature(frame: dict, arm: str, cfg: EventDetectorConfig, aspect: float):
    if frame.get("isDiscontinuous"):
        return None, "IDENTITY_DISCONTINUITY"
    kind = frame.get("observationKind", frame.get("observation_kind", "fresh_detection"))
    if kind != "fresh_detection":
        return None, "NO_FRESH_POSE"
    points = frame.get("landmarks", [])
    if len(points) != 17:
        return None, "MISSING_POSE"
    shoulder, elbow, wrist = (5, 7, 9) if arm == "left" else (6, 8, 10)
    required = [5, 6, 11, 12, shoulder, elbow, wrist]
    if any(not isinstance(points[i].get(k), (int, float)) or isinstance(points[i].get(k), bool)
           or not math.isfinite(points[i][k]) for i in required for k in ("x", "y", "conf")):
        return None, "INVALID_POSE"
    if min(points[i]["conf"] for i in required) < cfg.min_confidence:
        return None, "LOW_POSE_CONFIDENCE"
    def xy(i):
        return points[i]["x"] * aspect, points[i]["y"]
    sh, el, wr = xy(shoulder), xy(elbow), xy(wrist)
    center_sh = tuple((xy(5)[i] + xy(6)[i]) / 2 for i in (0, 1))
    center_hip = tuple((xy(11)[i] + xy(12)[i]) / 2 for i in (0, 1))
    dx, dy = center_hip[0] - center_sh[0], center_hip[1] - center_sh[1]
    torso = math.hypot(dx, dy)
    if torso < 0.02:
        return None, "INVALID_BODY_SCALE"
    if dy <= 0 or abs(dx) > cfg.max_torso_tilt_ratio * dy or frame.get("posture") == "ground":
        return None, "NON_STANDING_POSTURE"
    # Arms reaching down while walking/adjusting equipment are not candidates.
    if wr[1] > center_hip[1]:
        return None, "WRIST_BELOW_HIP"
    a, b = (sh[0] - el[0], sh[1] - el[1]), (wr[0] - el[0], wr[1] - el[1])
    denom = math.hypot(*a) * math.hypot(*b)
    angle = math.degrees(math.acos(max(-1, min(1, (a[0]*b[0] + a[1]*b[1]) / denom)))) if denom > 1e-9 else None
    return {"reach": math.dist(wr, sh) / torso, "elbowAngleDeg": angle}, None


def detect_punch_events(frames: Sequence[dict], fps: float, *, training_mode: str | None,
                        aspect: float = 1.0, config: EventDetectorConfig | None = None) -> dict:
    if isinstance(fps, bool) or not math.isfinite(fps) or fps <= 0:
        raise ValueError("fps must be finite and positive")
    if not math.isfinite(aspect) or aspect <= 0:
        raise ValueError("aspect must be finite and positive")
    cfg = config or EventDetectorConfig()
    if any(not math.isfinite(v) or v <= 0 for v in asdict(cfg).values()) or cfg.min_confidence > 1:
        raise ValueError("Detector configuration must contain finite positive thresholds")
    output = {"detectorVersion": "torso_peak_shadow_v2.0.0", "mode": "shadow",
              "validationStatus": "SHADOW_NOT_VALIDATED", "confidence": None,
              "config": asdict(cfg), "events": [], "rejected": [], "invalidFrameReasons": {}}
    mode = str(training_mode or "").lower()
    if mode not in ("heavy_bag", "shadow_boxing", "shadowboxing", "diagnostic_stress"):
        output["reasonCodes"] = ["UNSUPPORTED_OR_UNDECLARED_TRAINING_MODE"]
        return output
    times = [float(f.get("timeMs", i * 1000 / fps)) for i, f in enumerate(frames)]
    if any(not math.isfinite(t) or t < 0 for t in times) or any(b <= a for a, b in zip(times, times[1:])):
        raise ValueError("Frame times must be finite, nonnegative and strictly increasing")
    radius = max(1, round(cfg.peak_radius_ms * fps / 1000))
    evidence_radius = max(radius, round(cfg.evidence_radius_ms * fps / 1000))
    invalid = Counter()
    accepted = []
    for arm in ("left", "right"):
        features = []
        for frame in frames:
            value, reason = _feature(frame, arm, cfg, aspect)
            features.append(value)
            if reason:
                invalid[reason] += 1
        candidates = []
        for i in range(radius, len(frames) - radius):
            current = features[i]
            if current is None or features[i-1] is None or features[i+1] is None:
                continue
            peak = current["reach"]
            if peak < features[i-1]["reach"] or peak <= features[i+1]["reach"]:
                continue
            interval = {"arm": arm, "impactFrame": frames[i].get("frameIdx", i), "impactTimeMs": times[i]}
            window = features[i-radius:i+radius+1]
            if any(f is None for f in window) or any(times[j+1]-times[j] > 2000/fps for j in range(i-radius, i+radius)):
                output["rejected"].append({**interval, "reasonCode": "EVIDENCE_GAP"})
                continue
            start = min(range(i-radius, i), key=lambda j: features[j]["reach"])
            end = min(range(i+1, i+radius+1), key=lambda j: features[j]["reach"])
            prominence = peak - max(features[start]["reach"], features[end]["reach"])
            speed = (peak-features[start]["reach"]) * 1000 / (times[i]-times[start])
            reason = ("LOW_REACH" if peak < cfg.min_reach else
                      "LOW_PROMINENCE" if prominence < cfg.min_prominence else
                      "SLOW_EXTENSION" if speed < cfg.min_extension_speed else None)
            if reason:
                output["rejected"].append({**interval, "reasonCode": reason})
                continue
            # Extend to the local trough, stopping at missing/invalid evidence.
            while start > max(0, i-evidence_radius) and features[start-1] is not None and times[start]-times[start-1] <= 2000/fps and features[start-1]["reach"] < features[start]["reach"]:
                start -= 1
            while end < min(len(frames)-1, i+evidence_radius) and features[end+1] is not None and times[end+1]-times[end] <= 2000/fps and features[end+1]["reach"] < features[end]["reach"]:
                end += 1
            candidates.append({**interval, "strike_kind": "punch", "technique": "unknown_punch",
                "side": arm, "startFrame": frames[start].get("frameIdx", start), "endFrame": frames[end].get("frameIdx", end),
                "startTimeMs": times[start], "endTimeMs": times[end], "confidence": None,
                "impactType": "kinematic_proxy", "reasonCodes": ["EXTENSION_PEAK", "RETRACTION_OBSERVED"],
                "features": {"reachTorsoLengths": peak, "prominenceTorsoLengths": prominence,
                             "extensionSpeedTorsoLengthsPerSecond": speed, "elbowAngleDeg": current["elbowAngleDeg"]}})
        # True temporal NMS: strongest first, independently per arm. Opposite
        # arms may legitimately overlap; timing alone cannot reject either.
        selected = []
        for candidate in sorted(candidates, key=lambda c: (-c["features"]["prominenceTorsoLengths"], c["impactTimeMs"])):
            if any(abs(candidate["impactTimeMs"]-s["impactTimeMs"]) < cfg.refractory_ms for s in selected):
                output["rejected"].append({"arm": arm, "impactFrame": candidate["impactFrame"],
                    "impactTimeMs": candidate["impactTimeMs"], "reasonCode": "TEMPORAL_NMS"})
            else:
                selected.append(candidate)
        accepted.extend(selected)
    output["events"] = [{"id": f"shadow-punch-{e['side']}-{e['impactFrame']}", **e}
                        for e in sorted(accepted, key=lambda c: (c["impactTimeMs"], c["side"]))]
    output["invalidFrameReasons"] = dict(sorted(invalid.items()))
    output["rejected"].sort(key=lambda r: (r["impactTimeMs"], r["arm"]))
    return output
