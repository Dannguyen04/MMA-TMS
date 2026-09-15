"""Evaluate all annotated scopes, fail on missing predictions, retain evidence hashes.

The expanded set is diagnostic/development data, not a held-out accuracy claim.
"""
import argparse
import hashlib
import json
from pathlib import Path

from strike_benchmark import (
    _metrics, _normalise_event, evaluate_events, evaluate_files, load_predictions,
)
from evaluate_punch_detector import run_evaluation_suite

ROOT = Path(__file__).resolve().parent
LEGACY = ["01_cross_heavybag", "02_referee_gestures", "03_fighter_walkout",
          "04_cage_striking", "05_ground_grappling", "06_post_fight"]
EXTRA = [
    ("VIDEO_DATA_002", "gt_punch_002_visual.json"),
    ("VIDEO_DATA_003", "gt_punch_003_visual.json"),
    ("VIDEO_DATA_005", "gt_kick_005_mixed_heavybag.json"),
    ("vid_04_cage_striking", "gt_kick_04_cage_visual.json"),
    ("vid_05_ground_grappling", "gt_kick_05_ground_control.json"),
]


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def evaluate_directory(directory):
    rows = []
    evidence = {}
    for name in LEGACY:
        gt_path = ROOT / "ground_truth" / f"gt_{name}.json"
        pred_path = directory / f"vid_{name}.json"
        doc = json.loads(gt_path.read_text(encoding="utf-8"))
        gt = [_normalise_event(e, i, prediction=False) for i, e in enumerate(doc["events"])
              if e.get("label", "PUNCH") == "PUNCH"]
        pred_doc, pred = load_predictions(pred_path, kinds={"punch"})
        result = evaluate_events(gt, [e for e in pred if e.strike_kind == "punch"],
                                 fps=pred_doc["meta"]["fps"], tolerance_ms=350)
        rows.append({"video_id": f"vid_{name}", "evaluated_kinds": ["punch"], **result})
        evidence[gt_path.name] = digest(gt_path)
        evidence[pred_path.name] = digest(pred_path)
    for name, annotation in EXTRA:
        gt_path, pred_path = ROOT / "ground_truth" / annotation, directory / f"{name}.json"
        rows.append(evaluate_files(gt_path, pred_path))
        evidence[gt_path.name] = digest(gt_path)
        evidence[pred_path.name] = digest(pred_path)

    def aggregate(subset):
        return _metrics(*(sum(row[key] for row in subset) for key in ("tp", "fp", "fn")))

    baseline_pairs = [(str(ROOT / "test_results/validation" / f"pred_{n}.json"),
                       str(ROOT / "ground_truth" / f"gt_{n}.json")) for n in LEGACY]
    baseline = run_evaluation_suite(baseline_pairs)["overall"] if all(Path(p).exists() for p, _ in baseline_pairs) else None
    return {
        "status": "complete_for_declared_annotation_scopes",
        "tolerance_ms": 350,
        "matching": "maximum one-to-one cardinality, then minimum total timing error; known sides must match",
        "limitations": [
            "Expanded annotations are provisional, same-reviewer development data, not an independent held-out test.",
            "Unknown-side annotations test event timing/kind only; technique classification is not evaluated.",
            "No corpus-wide P/R/F1 for all video-data-test: 001, 004, 006 lack exhaustive original-video labels.",
            "Unannotated strike kinds are excluded, not assumed negative. Validation clips overlap original video 001.",
        ],
        "baseline_legacy_cached": baseline,
        "current_legacy_same_six_clips": aggregate(rows[:6]),
        "expanded_by_kind": {kind: aggregate([r for r in rows if kind in r["evaluated_kinds"]])
                             for kind in ("punch", "kick")},
        "expanded_overall": aggregate(rows),
        "per_scope": rows,
        "evidence_sha256": evidence,
        "model_sha256": digest(ROOT / "yolov8n-pose.pt"),
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("predictions", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    result = evaluate_directory(args.predictions)
    text = json.dumps(result, indent=2, ensure_ascii=False)
    if args.output:
        args.output.write_text(text + "\n", encoding="utf-8")
    print(json.dumps({k: result[k] for k in ["current_legacy_same_six_clips", "expanded_by_kind", "expanded_overall"]}, indent=2))
