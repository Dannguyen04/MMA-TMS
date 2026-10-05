"""Run an MMA-TMS public-dataset manifest through the existing video worker."""

from __future__ import annotations

import argparse
from collections import Counter
import json
from pathlib import Path
from typing import Any, Mapping, Sequence


POSITIVE_DETECTION_LABELS = frozenset({"boxing", "punch", "jab", "cross", "hook", "round_kick"})


def predicted_labels(result: Mapping[str, Any]) -> list[str]:
    labels: list[str] = []
    for action in result.get("actions", []):
        label = str(action.get("technique") or action.get("type") or "").strip().lower()
        if label:
            labels.append(label)
    if not labels:
        for punch in result.get("punches", []):
            label = str(punch.get("punchType") or punch.get("type") or "punch").strip().lower()
            labels.append(label or "punch")
        for _kick in result.get("kicks", []):
            labels.append("round_kick")
    return labels


def summarize_records(records: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    tp = fp = tn = fn = 0
    technique_correct = 0
    technique_total = 0
    abstained = 0
    errors = 0
    predictions: Counter[str] = Counter()
    for record in records:
        if record.get("status") == "error":
            errors += 1
            continue
        expected = str(record["canonicalLabel"])
        predicted = [str(label) for label in record.get("predictedLabels", [])]
        predictions.update(predicted or ["abstained"])
        if not predicted:
            abstained += 1
        expected_positive = expected in POSITIVE_DETECTION_LABELS
        predicted_positive = bool(predicted)
        if expected_positive and predicted_positive:
            tp += 1
        elif expected_positive:
            fn += 1
        elif predicted_positive:
            fp += 1
        else:
            tn += 1
        if record.get("eligibleForTechniqueTraining"):
            technique_total += 1
            technique_correct += int(expected in predicted)

    precision = tp / (tp + fp) if tp + fp else None
    recall = tp / (tp + fn) if tp + fn else None
    f1 = 2 * precision * recall / (precision + recall) if precision is not None and recall is not None and precision + recall else None
    evaluated = tp + fp + tn + fn
    return {
        "evaluatedCount": evaluated,
        "errorCount": errors,
        "abstainedCount": abstained,
        "detection": {
            "truePositive": tp,
            "falsePositive": fp,
            "trueNegative": tn,
            "falseNegative": fn,
            "precision": precision,
            "recall": recall,
            "f1": f1,
        },
        "technique": {
            "correct": technique_correct,
            "support": technique_total,
            "accuracy": technique_correct / technique_total if technique_total else None,
            "status": "measured" if technique_total else "not_evaluable_no_fine_grained_labels",
        },
        "predictionCounts": dict(sorted(predictions.items())),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Evaluate MMA-TMS on a prepared public dataset manifest")
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--split", choices=["train", "val", "test"], default="test")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--max-frames", type=int, default=None)
    parser.add_argument("--model", default="yolov8n-pose")
    args = parser.parse_args()

    with Path(args.manifest).open("r", encoding="utf-8") as handle:
        manifest = json.load(handle)
    samples = [sample for sample in manifest["samples"] if sample["split"] == args.split]
    if args.limit is not None:
        samples = samples[: max(0, args.limit)]

    # Import lazily so report-only helpers and tests do not load YOLO/OpenCV.
    from process_video import process_video

    output_path = Path(args.output)
    result_dir = output_path.parent / f"{output_path.stem}_clips"
    result_dir.mkdir(parents=True, exist_ok=True)
    records: list[dict[str, Any]] = []
    for index, sample in enumerate(samples, start=1):
        print(f"[{index}/{len(samples)}] {sample['videoPath']}")
        clip_output = result_dir / f"{sample['sampleId']}.json"
        try:
            result = process_video(
                input_path=sample["videoPath"],
                output_path=str(clip_output),
                model_name=args.model,
                max_frames=args.max_frames,
                verbose=False,
            )
            records.append({**sample, "status": "ok", "predictedLabels": predicted_labels(result), "resultPath": str(clip_output)})
        except Exception as exc:
            records.append({**sample, "status": "error", "predictedLabels": [], "error": f"{type(exc).__name__}: {exc}"})

    report = {
        "schemaVersion": "1.0.0",
        "datasetId": manifest["datasetId"],
        "manifestSha256": manifest["manifestSha256"],
        "split": args.split,
        "model": args.model,
        "summary": summarize_records(records),
        "records": records,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as handle:
        json.dump(report, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    print(json.dumps(report["summary"], ensure_ascii=False, indent=2))
    return 0 if report["summary"]["errorCount"] == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
