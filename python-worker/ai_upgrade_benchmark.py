"""Freeze and replay local diagnostic evidence; never claim held-out accuracy.

python ai_upgrade_benchmark.py freeze --output benchmark_results/ai_upgrade_manifest.json
python ai_upgrade_benchmark.py evaluate --manifest benchmark_results/ai_upgrade_manifest.json --output benchmark_results/ai_upgrade_report.json

Frozen inputs are hashes, not copies. Evaluation fails if annotations or cached
predictions change. Runtime hashes are recorded separately for each candidate.
"""
from __future__ import annotations

import argparse
from dataclasses import asdict
import hashlib
import json
import math
from pathlib import Path
import statistics

from evaluate_strike_suite import LEGACY, evaluate_directory
from strike_benchmark import _metrics, _normalise_event, evaluate_events

ROOT = Path(__file__).resolve().parent


def digest(path: Path) -> str:
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def runtime_hashes() -> dict[str, str]:
    files = list(ROOT.glob("*.py")) + list((ROOT / "pipeline").glob("*.py"))
    return {p.relative_to(ROOT).as_posix(): digest(p) for p in sorted(files)
            if not p.name.startswith(("test_", "scratch_", "benchmark_"))}


def freeze(directory: Path) -> dict:
    baseline = evaluate_directory(directory)
    inputs = []
    for name in baseline["evidence_sha256"]:
        path = ROOT / "ground_truth" / name if name.startswith("gt_") else directory / name
        inputs.append({"path": path.resolve().relative_to(ROOT).as_posix(), "sha256": digest(path)})
    return {
        "schemaVersion": "1.0.0",
        "purpose": "development_diagnostic_only",
        "annotationReview": "provisional_single_reviewer",
        "split": "development",
        "independentHeldOut": False,
        "predictionDirectory": directory.resolve().relative_to(ROOT).as_posix(),
        "inputs": sorted(inputs, key=lambda item: item["path"]),
        "runtimeAtFreeze": runtime_hashes(),
        "modelSha256": digest(ROOT / "yolov8n-pose.pt"),
        "cachedPredictionRuntimeVerified": False,
        "baseline": baseline,
        "limitations": [
            "Cached outputs are historical evidence; runtimeAtFreeze does not establish their generating runtime.",
            "No independent held-out/calibration corpus or validated classifier checkpoint is present.",
            "Replayed poses are rounded and already smoothed. Fresh video inference is required before release.",
        ],
    }


def verify(manifest: dict) -> None:
    if manifest.get("schemaVersion") != "1.0.0" or not manifest.get("inputs"):
        raise ValueError("Unsupported or empty evidence manifest")
    for item in manifest["inputs"]:
        path = (ROOT / item["path"]).resolve()
        if not path.is_relative_to(ROOT) or digest(path) != item["sha256"]:
            raise ValueError(f"Frozen input changed: {item['path']}")
    if digest(ROOT / "yolov8n-pose.pt") != manifest["modelSha256"]:
        raise ValueError("Frozen pose model changed")


def timing(matches: list[dict]) -> dict:
    errors = sorted(item["impact_error_ms"] for item in matches)
    return {"matchedEvents": len(errors),
            "medianMs": statistics.median(errors) if errors else None,
            "p95Ms": errors[max(0, math.ceil(len(errors) * .95) - 1)] if errors else None}


def evaluate(manifest: dict) -> dict:
    verify(manifest)
    from pipeline.strike_events import EventDetectorConfig, detect_punch_events
    directory = ROOT / manifest["predictionDirectory"]
    rows = []
    scopes = [(f"vid_{name}", f"gt_{name}.json") for name in LEGACY]
    scopes += [(f"VIDEO_DATA_{n}", f"gt_punch_{n}_visual.json") for n in ("002", "003")]
    for name, annotation in scopes:
        doc = json.loads((directory / f"{name}.json").read_text(encoding="utf-8"))
        gt = json.loads((ROOT / "ground_truth" / annotation).read_text(encoding="utf-8"))
        truth = [_normalise_event(e, i, prediction=False) for i, e in enumerate(gt["events"])
                 if e.get("label", "PUNCH").upper() == "PUNCH"]
        # Context is explicitly recorded: non-solo clips are stress tests, not
        # silently dropped from the false-positive report.
        mode = "heavy_bag" if name in ("vid_01_cross_heavybag", "VIDEO_DATA_002", "VIDEO_DATA_003") else "diagnostic_stress"
        shadow = detect_punch_events(doc["frames"], doc["meta"]["fps"], training_mode=mode,
            aspect=doc["meta"].get("imgWidth", 1) / doc["meta"].get("imgHeight", 1))
        predictions = [_normalise_event(e, i, prediction=True) for i, e in enumerate(shadow["events"])]
        result = evaluate_events(truth, predictions, fps=doc["meta"]["fps"])
        rows.append({"videoId": name, "context": mode, **result,
                     "timing": timing(result["matches"]), "detectorEvidence": shadow})
    metrics = _metrics(*(sum(r[k] for r in rows) for k in ("tp", "fp", "fn")))
    clip = next(r for r in rows if r["videoId"] == "VIDEO_DATA_002")
    regression = clip["tp"] >= 14 and clip["fp"] <= 1 and clip["timing"]["p95Ms"] is not None and clip["timing"]["p95Ms"] <= 200
    baseline_by_id = {r["video_id"]: r for r in manifest["baseline"]["per_scope"] if r["evaluated_kinds"] == ["punch"]}
    negative_ok = all(r["fp"] <= baseline_by_id[r["videoId"]]["fp"] for r in rows if r["tp"] + r["fn"] == 0)
    return {
        "schemaVersion": "1.0.0", "purpose": "development_diagnostic_only",
        "runtimeSha256": runtime_hashes(), "candidateConfig": asdict(EventDetectorConfig()),
        "historicalBaseline": manifest["baseline"]["expanded_overall"],
        "historicalPunchBaseline": manifest["baseline"]["expanded_by_kind"]["punch"],
        "shadowPunchMetrics": metrics, "perScope": rows,
        "developmentGates": {"video002": regression, "negativeNoRegression": negative_ok},
        "release": {"status": "BLOCKED", "promotable": False, "reasons": [
            "INDEPENDENT_HELD_OUT_DATA_MISSING", "CALIBRATION_EVIDENCE_MISSING",
            "TECHNIQUE_CLASSIFIER_VALIDATION_MISSING", "COACH_AGREEMENT_MISSING",
            "FRESH_INFERENCE_REQUIRED",
        ]},
        "limitations": manifest["limitations"],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("freeze", "evaluate"))
    parser.add_argument("--predictions", type=Path, default=ROOT / "test_results/strike_suite")
    parser.add_argument("--manifest", type=Path, default=ROOT / "benchmark_results/ai_upgrade_manifest.json")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--require-release", action="store_true")
    args = parser.parse_args()
    if args.command == "freeze" and args.output.exists():
        parser.error("A frozen manifest cannot be overwritten; use a new versioned path")
    if args.command == "evaluate" and args.output.resolve() == args.manifest.resolve():
        parser.error("Report output must not overwrite the frozen manifest")
    report = freeze(args.predictions) if args.command == "freeze" else evaluate(json.loads(args.manifest.read_text(encoding="utf-8")))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("x" if args.command == "freeze" else "w", encoding="utf-8") as stream:
        json.dump(report, stream, indent=2, ensure_ascii=False, allow_nan=False)
        stream.write("\n")
    print(json.dumps({"output": str(args.output), "metrics": report.get("shadowPunchMetrics"), "release": report.get("release")}, indent=2))
    return 2 if args.require_release and not report.get("release", {}).get("promotable", False) else 0


if __name__ == "__main__":
    raise SystemExit(main())
