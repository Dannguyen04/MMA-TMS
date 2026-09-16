"""Deterministic evaluation for manually annotated punch/kick benchmarks.

Ground truth is the source of truth. Detector output is never used to create or
repair annotations. Matching maximizes one-to-one matches, then minimizes time error.
"""

from __future__ import annotations

import argparse
import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable


STRIKES = {"punch", "kick"}
SIDES = {"left", "right", "unknown"}
SCOPES = {"in_scope", "out_of_scope", "ambiguous"}


class AnnotationError(ValueError):
    """Raised when an annotation cannot be evaluated reproducibly."""


@dataclass(frozen=True)
class Event:
    event_id: str
    strike_kind: str
    technique: str
    side: str
    impact_frame: int | None
    impact_time_ms: float | None
    scope: str = "in_scope"
    raw: dict[str, Any] | None = None


def _first(data: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        if data.get(key) is not None:
            return data[key]
    return None


def _normalise_event(data: dict[str, Any], index: int, *, prediction: bool) -> Event:
    kind = str(_first(data, "strike_kind", "kind", "label") or "").lower()
    if kind == "punch" or (prediction and "punchType" in data):
        kind = "punch"
    elif kind == "kick" or (prediction and ("activeLeg" in data or "kickType" in data)):
        kind = "kick"
    if kind not in STRIKES:
        raise AnnotationError(f"event[{index}].strike_kind must be punch or kick")

    side = str(_first(data, "side", "active_leg", "arm", "hand", "activeLeg") or "unknown").lower()
    if side not in SIDES:
        raise AnnotationError(f"event[{index}].side must be left, right, or unknown")

    scope = str(data.get("evaluation_scope", data.get("scope", "in_scope"))).lower()
    if scope not in SCOPES:
        raise AnnotationError(f"event[{index}].evaluation_scope is invalid")

    impact_frame = _first(data, "impact_frame", "impactFrame")
    impact_time_ms = _first(data, "impact_time_ms", "impactTimeMs")
    if impact_time_ms is None:
        seconds = _first(data, "peak_time", "timestamp")
        impact_time_ms = None if seconds is None else float(seconds) * 1000.0
    if impact_frame is None and impact_time_ms is None:
        raise AnnotationError(f"event[{index}] needs impact_frame or impact_time_ms")

    if impact_frame is not None and (not isinstance(impact_frame, (int, float)) or
            isinstance(impact_frame, bool) or not math.isfinite(impact_frame) or
            impact_frame < 0 or int(impact_frame) != impact_frame):
        raise AnnotationError(f"event[{index}].impact_frame must be a nonnegative integer")
    if impact_time_ms is not None and (not math.isfinite(float(impact_time_ms)) or float(impact_time_ms) < 0):
        raise AnnotationError(f"event[{index}].impact_time_ms must be finite and nonnegative")
    technique = str(_first(data, "technique", "kick_type", "punch_type", "kickType", "punchType") or "unknown").lower()
    return Event(
        event_id=str(_first(data, "event_id", "id") or f"{'pred' if prediction else 'gt'}_{index + 1}"),
        strike_kind=kind,
        technique=technique,
        side=side,
        impact_frame=None if impact_frame is None else int(impact_frame),
        impact_time_ms=None if impact_time_ms is None else float(impact_time_ms),
        scope=scope,
        raw=data,
    )


def parse_ground_truth(document: dict[str, Any]) -> tuple[dict[str, Any], list[Event]]:
    if not isinstance(document, dict) or not isinstance(document.get("events"), list):
        raise AnnotationError("ground truth must be an object with an events array")
    meta = document.get("video", {})
    if not isinstance(meta, dict) or not meta.get("video_id"):
        raise AnnotationError("ground truth video.video_id is required")
    events = [_normalise_event(item, i, prediction=False) for i, item in enumerate(document["events"])]
    ids = [event.event_id for event in events]
    if len(ids) != len(set(ids)):
        raise AnnotationError("event_id values must be unique per video")
    return document, events


def load_ground_truth(path: str | Path) -> tuple[dict[str, Any], list[Event]]:
    with open(path, encoding="utf-8") as handle:
        document = json.load(handle)
    return parse_ground_truth(document)


def load_predictions(path: str | Path, kinds: Iterable[str] | None = None) -> tuple[dict[str, Any], list[Event]]:
    with open(path, encoding="utf-8") as handle:
        document = json.load(handle)
    selected = STRIKES if kinds is None else set(kinds)
    raw = [item for kind, key in (("punch", "punches"), ("kick", "kicks"))
           if kind in selected for item in document.get(key, [])]
    return document, [_normalise_event(item, i, prediction=True) for i, item in enumerate(raw)]


def _impact_ms(event: Event, fps: float) -> float:
    if event.impact_time_ms is not None:
        return event.impact_time_ms
    if not math.isfinite(fps) or fps <= 0:
        raise AnnotationError("fps must be positive when matching frame-only annotations")
    assert event.impact_frame is not None
    return event.impact_frame * 1000.0 / fps


def _metrics(tp: int, fp: int, fn: int) -> dict[str, float | int]:
    precision = tp / (tp + fp) if tp + fp else (1.0 if fn == 0 else 0.0)
    recall = tp / (tp + fn) if tp + fn else (1.0 if fp == 0 else 0.0)
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return {"tp": tp, "fp": fp, "fn": fn, "precision": round(precision, 4), "recall": round(recall, 4), "f1": round(f1, 4)}


def evaluate_events(
    ground_truth: Iterable[Event],
    predictions: Iterable[Event],
    *,
    fps: float,
    tolerance_ms: float = 350.0,
    match_side: bool = True,
    match_technique: bool = False,
) -> dict[str, Any]:
    if not math.isfinite(tolerance_ms) or tolerance_ms < 0:
        raise AnnotationError("tolerance_ms must be finite and nonnegative")
    gt = [event for event in ground_truth if event.scope == "in_scope"]
    pred = list(predictions)
    candidates: list[tuple[float, int, int]] = []
    for pi, p in enumerate(pred):
        for gi, g in enumerate(gt):
            if p.strike_kind != g.strike_kind:
                continue
            if match_side and p.side != "unknown" and g.side != "unknown" and p.side != g.side:
                continue
            if match_technique and p.technique != "unknown" and g.technique != "unknown" and p.technique != g.technique:
                continue
            error = abs(_impact_ms(p, fps) - _impact_ms(g, fps))
            if error <= tolerance_ms:
                candidates.append((error, pi, gi))

    matched_pred: set[int] = set()
    matched_gt: set[int] = set()
    matches = []
    for error, pi, gi in _optimal_matches(candidates, len(pred), len(gt)):
        matched_pred.add(pi)
        matched_gt.add(gi)
        matches.append({"prediction_id": pred[pi].event_id, "ground_truth_id": gt[gi].event_id, "impact_error_ms": round(error, 1)})

    false_positives = [pred[i].event_id for i in range(len(pred)) if i not in matched_pred]
    false_negatives = [gt[i].event_id for i in range(len(gt)) if i not in matched_gt]
    result = _metrics(len(matches), len(false_positives), len(false_negatives))
    result.update({"matches": matches, "false_positives": false_positives, "false_negatives": false_negatives})
    return result


def _optimal_matches(candidates, pred_count, gt_count):
    """Maximum cardinality, then minimum total error (unit min-cost flow).

    Greedy closest-first can consume the only partner of another prediction
    and undercount true positives. Residual edges permit reassignment.
    """
    source, sink = pred_count + gt_count, pred_count + gt_count + 1
    graph = [[] for _ in range(sink + 1)]

    def add(a, b, cost):
        forward = [b, len(graph[b]), 1, cost]
        reverse = [a, len(graph[a]), 0, -cost]
        graph[a].append(forward)
        graph[b].append(reverse)
        return forward

    for pi in range(pred_count):
        add(source, pi, 0)
    for gi in range(gt_count):
        add(pred_count + gi, sink, 0)
    links = [(error, pi, gi, add(pi, pred_count + gi, error))
             for error, pi, gi in candidates]
    while True:
        distance = [float("inf")] * len(graph)
        previous = [None] * len(graph)
        distance[source] = 0
        for _ in range(len(graph) - 1):
            changed = False
            for a, edges in enumerate(graph):
                for ei, (b, _, capacity, cost) in enumerate(edges):
                    if capacity and distance[a] + cost < distance[b] - 1e-9:
                        distance[b] = distance[a] + cost
                        previous[b] = (a, ei)
                        changed = True
            if not changed:
                break
        if previous[sink] is None:
            break
        b = sink
        while b != source:
            a, ei = previous[b]
            edge = graph[a][ei]
            edge[2] -= 1
            graph[b][edge[1]][2] += 1
            b = a
    return [(error, pi, gi) for error, pi, gi, edge in links if edge[2] == 0]


def evaluate_files(gt_path: str | Path, pred_path: str | Path, tolerance_ms: float = 350.0) -> dict[str, Any]:
    gt_doc, gt = load_ground_truth(gt_path)
    kinds = gt_doc.get("evaluated_kinds", ["punch", "kick"])
    if not kinds or not set(kinds) <= STRIKES:
        raise AnnotationError("evaluated_kinds must contain punch and/or kick")
    pred_doc, pred = load_predictions(pred_path, kinds=kinds)
    gt_video = gt_doc["video"].get("file")
    pred_video = pred_doc.get("meta", {}).get("videoPath")
    if gt_video and pred_video and Path(str(gt_video).replace("\\", "/")).name != Path(str(pred_video).replace("\\", "/")).name:
        raise AnnotationError("ground truth and predictions refer to different videos")
    fps = float(gt_doc["video"].get("fps") or pred_doc.get("meta", {}).get("fps") or 0)
    gt = [e for e in gt if e.strike_kind in kinds]
    pred = [e for e in pred if e.strike_kind in kinds]
    result = evaluate_events(gt, pred, fps=fps, tolerance_ms=tolerance_ms)
    return {"video_id": gt_doc["video"]["video_id"], "fps": fps,
            "evaluated_kinds": kinds, "tolerance_ms": tolerance_ms, **result}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("ground_truth")
    parser.add_argument("predictions")
    parser.add_argument("--tolerance-ms", type=float, default=350.0)
    args = parser.parse_args()
    print(json.dumps(evaluate_files(args.ground_truth, args.predictions, args.tolerance_ms), indent=2))


if __name__ == "__main__":
    main()
