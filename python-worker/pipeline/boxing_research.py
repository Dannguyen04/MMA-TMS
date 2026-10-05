"""Research-only pose classifier utilities. Not a production technique assessor.

Upstream clips have normalized-image coordinates but no camera aspect metadata.
Features below are non-metric and must not be interpreted as biomechanics.
"""
from __future__ import annotations

import csv
import hashlib
from pathlib import Path

import numpy as np

LABELS = ("jab", "cross", "lead_hook", "rear_hook", "lead_uppercut", "rear_uppercut")
SPLITS = {
    "train": ("V1", "V2", "V3", "V4", "V7"),
    "validation": ("V8",),
    "calibration": ("V5",),
    "test": ("V9", "V10"),
}
FEATURE_VERSION = "body_relative_image_pose_v1"


def digest(path: Path) -> str:
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def normalize_label(value: str) -> str:
    label = "_".join(value.strip().lower().split())
    if label not in LABELS:
        raise ValueError(f"Unsupported technique label: {value!r}")
    return label


def read_labels(path: Path, *, allow_invalid_intervals=False) -> list[dict]:
    with path.open(encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        if reader.fieldnames != ["start_frame", "end_frame", "class"]:
            raise ValueError("Expected start_frame,end_frame,class columns")
        rows = []
        for index, row in enumerate(reader):
            start, end = int(row["start_frame"]), int(row["end_frame"])
            valid = start >= 0 and end >= start
            if not valid and not allow_invalid_intervals:
                raise ValueError(f"Invalid annotation interval at row {index + 2}")
            rows.append({"id": str(index), "startFrame": start, "endFrame": end,
                         "technique": normalize_label(row["class"]), "validInterval": valid})
    if not rows:
        raise ValueError("Empty annotation file")
    return rows


def pose_features(clip: np.ndarray, length: int = 25) -> np.ndarray:
    """Trim only exterior zero padding; reject interior missing body evidence.

    Resampling fixes input length, not physical time. No impact/speed claims.
    Missing joints get a separate mask; they are never treated as real origins.
    """
    xy = np.asarray(clip, dtype=np.float32)
    if xy.ndim != 3 or xy.shape[1:] != (17, 2) or not np.isfinite(xy).all():
        raise ValueError("Expected finite numeric [time,17,2] pose")
    present = np.any(xy != 0, axis=(1, 2))
    indices = np.flatnonzero(present)
    if len(indices) < 3:
        raise ValueError("Insufficient pose frames")
    xy = xy[indices[0]:indices[-1] + 1].copy()
    mask = np.any(xy != 0, axis=2)
    if not mask[:, [5, 6, 11, 12]].all():
        raise ValueError("Missing torso evidence inside clip")
    hip = xy[:, [11, 12]].mean(axis=1)
    shoulder = xy[:, [5, 6]].mean(axis=1)
    scale = float(np.median(np.linalg.norm(shoulder - hip, axis=1)))
    if scale < 1e-5:
        raise ValueError("Degenerate torso scale")
    xy = np.clip((xy - hip[:, None]) / scale, -8, 8)
    xy[~mask] = 0
    source_times = np.linspace(0, 1, len(xy))
    target_times = np.linspace(0, 1, length)
    flat = xy.reshape(len(xy), 34)
    positions = np.stack([np.interp(target_times, source_times, flat[:, j]) for j in range(34)], axis=1)
    masks = mask[np.rint(target_times * (len(mask) - 1)).astype(int)]
    positions = positions.reshape(length, 17, 2)
    positions[~masks] = 0
    velocity = np.diff(positions, axis=0, prepend=positions[:1])
    velocity[1:][~(masks[1:] & masks[:-1])] = 0
    return np.concatenate((positions.reshape(length, 34), velocity.reshape(length, 34), masks), axis=1).astype(np.float32)


def classification_metrics(truth, prediction, labels=LABELS) -> dict:
    truth, prediction = list(truth), list(prediction)
    if len(truth) != len(prediction):
        raise ValueError("Truth/prediction lengths differ")
    columns = list(labels) + ["unknown"]
    matrix = np.zeros((len(labels), len(columns)), dtype=int)
    for actual, predicted in zip(truth, prediction):
        if actual not in labels or predicted not in columns:
            raise ValueError("Unexpected metric label")
        matrix[labels.index(actual), columns.index(predicted)] += 1
    per_class = {}
    for i, label in enumerate(labels):
        tp, support, predicted = int(matrix[i, i]), int(matrix[i].sum()), int(matrix[:, i].sum())
        precision, recall = tp / predicted if predicted else 0.0, tp / support if support else 0.0
        per_class[label] = {"support": support, "precision": precision, "recall": recall,
                            "f1": 2 * precision * recall / (precision + recall) if precision + recall else 0.0}
    return {"count": len(truth), "accuracy": float(np.trace(matrix)) / len(truth) if truth else None,
            "macroF1": float(np.mean([v["f1"] for v in per_class.values()])),
            "perClass": per_class, "confusionRows": list(labels), "confusionColumns": columns,
            "confusionMatrix": matrix.tolist(), "abstained": int(matrix[:, -1].sum())}


def probability_metrics(logits, targets, temperature=1.0) -> dict:
    probabilities = softmax(logits, temperature)
    confidence = probabilities.max(axis=1)
    correct = probabilities.argmax(axis=1) == targets
    ece = 0.0
    for low in np.arange(0, 1, .1):
        selected = (confidence >= low) & (confidence < low + .1 if low < .89 else confidence <= 1)
        if selected.any():
            ece += selected.mean() * abs(confidence[selected].mean() - correct[selected].mean())
    return {"ece10Bins": float(ece), "nll": float(-np.log(np.maximum(probabilities[np.arange(len(targets)), targets], 1e-12)).mean()),
            "temperature": float(temperature), "scope": "trimmed_positive_clips_only"}


def softmax(logits, temperature=1.0):
    if not np.isfinite(temperature) or temperature <= 0:
        raise ValueError("Invalid temperature")
    values = np.asarray(logits, dtype=np.float64) / temperature
    values -= values.max(axis=1, keepdims=True)
    exp = np.exp(values)
    return exp / exp.sum(axis=1, keepdims=True)


def interval_matches(truth: list[dict], predictions: list[dict], min_iou: float) -> list[dict]:
    """Maximum-cardinality one-to-one matching, class-agnostic, inclusive frames.

    IoU tie ordering is deterministic; this does not invent impact timestamps.
    """
    if not 0 < min_iou <= 1:
        raise ValueError("IoU threshold must be in (0,1]")
    candidates = []
    for t in truth:
        adjacent = []
        for j, p in enumerate(predictions):
            for event in (t, p):
                if event["startFrame"] < 0 or event["endFrame"] < event["startFrame"]:
                    raise ValueError("Invalid interval")
            intersection = max(0, min(t["endFrame"], p["endFrame"]) - max(t["startFrame"], p["startFrame"]) + 1)
            union = max(t["endFrame"], p["endFrame"]) - min(t["startFrame"], p["startFrame"]) + 1
            iou = intersection / union
            if iou >= min_iou:
                adjacent.append((j, iou))
        candidates.append(sorted(adjacent, key=lambda pair: (-pair[1], pair[0])))
    owners = {}
    def augment(i, seen):
        for j, iou in candidates[i]:
            if j in seen:
                continue
            seen.add(j)
            if j not in owners or augment(owners[j][0], seen):
                owners[j] = (i, iou)
                return True
        return False
    for i in range(len(truth)):
        augment(i, set())
    return sorted([{"truthIndex": i, "predictionIndex": j, "iou": iou} for j, (i, iou) in owners.items()], key=lambda m: m["truthIndex"])


def evaluate_intervals(truth, predictions, min_iou=.1):
    matches = interval_matches(truth, predictions, min_iou)
    tp, fp, fn = len(matches), len(predictions) - len(matches), len(truth) - len(matches)
    precision, recall = tp / (tp + fp) if tp + fp else 0.0, tp / (tp + fn) if tp + fn else 0.0
    truth_labels, predicted_labels = [], []
    mapping = {m["truthIndex"]: m["predictionIndex"] for m in matches}
    for i, t in enumerate(truth):
        truth_labels.append(t["technique"])
        value = predictions[mapping[i]].get("technique", "unknown") if i in mapping else "unknown"
        predicted_labels.append(value if value in LABELS else "unknown")
    classification = classification_metrics(truth_labels, predicted_labels)
    return {"minIntervalIoU": min_iou, "tp": tp, "fp": fp, "fn": fn, "precision": precision,
            "recall": recall, "f1": 2 * precision * recall / (precision + recall) if precision + recall else 0.0,
            "matches": matches, "classificationAcrossAllAnnotatedEvents": classification,
            "impactTimingErrorMs": None, "impactTimingReason": "GROUND_TRUTH_HAS_NO_IMPACT_LABELS"}
