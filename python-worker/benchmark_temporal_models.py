"""Controlled CPU comparison on the already-observed BoxingVI mirror.

No production promotion. Historical test predictions are opt-in diagnostics;
model/epoch selection uses validation only. All architectures share the frozen
v1 representation: this comparison cannot validate the new timestamp normalizer.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import platform
import time

import numpy as np
import torch
from torch import nn

from pipeline.boxing_research import LABELS, SPLITS, FEATURE_VERSION, digest, classification_metrics, softmax, probability_metrics
from pipeline.evaluation_protocol import calculate_wilson_interval as wilson_interval
from pipeline.temporal_models import ARCHITECTURES, build_model
from train_boxing_research import DATA_DEFAULT, prepare, predict_logits, report_split


def select_threshold(logits, targets, temperature, *, precision_floor=.9, min_support=30):
    """Calibration-only selection using a Wilson lower bound; never assume .8 works."""
    probabilities = softmax(logits, temperature)
    confidence, correct = probabilities.max(1), probabilities.argmax(1) == targets
    candidates = []
    for threshold in np.unique(confidence):
        accepted = confidence >= threshold
        count, hits = int(accepted.sum()), int(correct[accepted].sum())
        lower, _ = wilson_interval(hits, count)
        if count >= min_support and lower >= precision_floor:
            candidates.append((count, float(threshold), hits, lower))
    if not candidates:
        return {"threshold": None, "calibrationAccepted": 0, "reason": "NO_SUPPORTED_THRESHOLD",
                "precisionLowerBoundTarget": precision_floor, "minimumSupport": min_support}
    count, threshold, hits, lower = max(candidates)
    return {"threshold": threshold, "calibrationAccepted": count, "calibrationCorrect": hits,
            "calibrationWilsonLower": lower, "precisionLowerBoundTarget": precision_floor,
            "minimumSupport": min_support, "reason": "CALIBRATION_SELECTED_RESEARCH_ONLY"}


def selective_metrics(logits, targets, temperature, policy):
    probabilities = softmax(logits, temperature)
    accepted = np.zeros(len(targets), dtype=bool) if policy["threshold"] is None else probabilities.max(1) >= policy["threshold"]
    hits = int((probabilities.argmax(1)[accepted] == targets[accepted]).sum())
    count = int(accepted.sum())
    prediction = [LABELS[p] if ok else "unknown" for p, ok in zip(probabilities.argmax(1), accepted)]
    return {"accepted": count, "coverage": float(accepted.mean()),
            "accuracyWhenAccepted": hits / count if count else None,
            "accuracyWilson95": list(wilson_interval(hits, count)) if count else None,
            "classificationIncludingAbstentions": classification_metrics([LABELS[y] for y in targets], prediction)}


def save_json(path, value):
    path.write_text(json.dumps(value, indent=2, allow_nan=False), encoding="utf-8")


def train_one(groups, architecture, seed, output, epochs, patience, include_observed_test):
    output.mkdir(parents=True, exist_ok=False)
    torch.manual_seed(seed)
    np.random.seed(seed)
    model = build_model(architecture)

    def concat(split):
        return (np.concatenate([groups[v][0] for v in SPLITS[split]]),
                np.concatenate([groups[v][1] for v in SPLITS[split]]))

    x, y = concat("train")
    vx, vy = concat("validation")
    counts = np.bincount(y, minlength=len(LABELS))
    if (counts == 0).any():
        raise ValueError("A target class has no training examples")
    loss_fn = nn.CrossEntropyLoss(weight=torch.tensor(len(y) / (len(LABELS) * counts), dtype=torch.float32))
    optimizer = torch.optim.AdamW(model.parameters(), lr=.001, weight_decay=.001)
    tx, ty = torch.from_numpy(x), torch.from_numpy(y).long()
    best, best_epoch, state, history = -1, 0, None, []
    started = time.monotonic()
    for epoch in range(1, epochs + 1):
        model.train()
        losses = []
        for batch in torch.randperm(len(tx)).split(128):
            optimizer.zero_grad()
            loss = loss_fn(model(tx[batch]), ty[batch])
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 5)
            optimizer.step()
            losses.append(float(loss.detach()))
        prediction = predict_logits(model, vx).argmax(1)
        metric = classification_metrics([LABELS[i] for i in vy], [LABELS[i] for i in prediction])["macroF1"]
        history.append({"epoch": epoch, "loss": float(np.mean(losses)), "validationMacroF1": metric})
        if metric > best + 1e-6:
            best, best_epoch = metric, epoch
            state = {k: v.detach().clone() for k, v in model.state_dict().items()}
        if epoch == 1 or epoch % 5 == 0:
            print(json.dumps({"architecture": architecture, "seed": seed, **history[-1]}), flush=True)
        if epoch - best_epoch >= patience:
            break
    model.load_state_dict(state)
    cx, cy = concat("calibration")
    logits = predict_logits(model, cx)
    temperature = float(min(np.geomspace(.25, 8, 100), key=lambda t: probability_metrics(logits, cy, t)["nll"]))
    policy = select_threshold(logits, cy, temperature)
    np.savez_compressed(output / "model.npz", **{k: v.numpy() for k, v in state.items()})
    # Verify the numeric checkpoint roundtrip before publishing the run report.
    restored = build_model(architecture)
    with np.load(output / "model.npz", allow_pickle=False) as archive:
        restored.load_state_dict({k: torch.from_numpy(archive[k]) for k in archive.files}, strict=True)
    np.testing.assert_allclose(predict_logits(restored, vx[:8]), predict_logits(model, vx[:8]), rtol=1e-6, atol=1e-6)
    model.eval()
    sample = torch.from_numpy(vx[:1])
    with torch.inference_mode():
        for _ in range(10): model(sample)
        durations = []
        for _ in range(50):
            start = time.perf_counter()
            model(sample)
            durations.append((time.perf_counter() - start) * 1000)
    metrics = {}
    splits = ("validation", "calibration", "test") if include_observed_test else ("validation", "calibration")
    for split in splits:
        sx, sy = concat(split)
        values = predict_logits(model, sx)
        report = report_split(model, groups, SPLITS[split], temperature)
        report.pop("fixedThreshold080", None)
        report["selective"] = selective_metrics(values, sy, temperature, policy)
        probabilities = softmax(values, temperature)
        report["multiclassBrier"] = float(np.square(probabilities - np.eye(len(LABELS))[sy]).sum(1).mean())
        metrics["observedTestDiagnostic" if split == "test" else split] = report
    result = {"architecture": architecture, "seed": seed, "bestEpoch": best_epoch,
              "selection": "validation_macro_f1_including_zero_support_classes",
              "featureVersion": FEATURE_VERSION, "labels": LABELS,
              "parameterCount": sum(p.numel() for p in model.parameters()),
              "weightsBytes": (output / "model.npz").stat().st_size,
              "weightsSha256": digest(output / "model.npz"), "temperature": temperature,
              "acceptancePolicy": policy, "metrics": metrics, "history": history,
              "seconds": time.monotonic() - started,
              "modelOnlyCpuLatencyMs": {"batch": 1, "frames": x.shape[1], "threads": torch.get_num_threads(),
                                        "median": float(np.median(durations)), "p95": float(np.percentile(durations, 95))},
              "mode": "research_only", "productionEligible": False}
    save_json(output / "report.json", result)
    print(json.dumps({"completed": architecture, "seed": seed, "bestValidationMacroF1": best,
                      "seconds": result["seconds"]}), flush=True)
    return result


def benchmark(data, output, architectures, seeds, epochs=40, patience=10, include_observed_test=False):
    if epochs < 1 or patience < 1 or not seeds or len(set(seeds)) != len(seeds):
        raise ValueError("Positive epochs/patience and unique nonempty seeds are required")
    if not architectures or len(set(architectures)) != len(architectures) or set(architectures) - set(ARCHITECTURES):
        raise ValueError("Choose unique supported architectures")
    output.mkdir(parents=True, exist_ok=False)
    torch.set_num_threads(4)
    torch.use_deterministic_algorithms(True)
    groups, audit = prepare(data)
    save_json(output / "data_audit.json", audit)
    code = ("benchmark_temporal_models.py", "train_boxing_research.py", "pipeline/boxing_research.py",
            "pipeline/temporal_models.py", "pipeline/evaluation_protocol.py")
    configuration = {"schemaVersion": "1.0.0", "createdAt": datetime.now(timezone.utc).isoformat(),
        "architectures": list(architectures), "seeds": list(seeds), "epochs": epochs, "patience": patience,
        "observedTestDiagnosticEnabled": include_observed_test,
        "runtime": {"python": platform.python_version(), "torch": torch.__version__, "numpy": np.__version__,
                    "platform": platform.platform(), "cpu": platform.processor(), "torchThreads": 4},
        "dataAuditSha256": digest(output / "data_audit.json"),
        "sourceHashes": {p: digest(Path(__file__).parent / p) for p in code},
        "productionEligible": False,
        "limitations": ["Research clips have oracle boundaries and no background class.",
            "V9/V10 have already been observed; they are diagnostics, never an independent release test.",
            "Fighter independence, recording metadata and source media rights are unverified.",
            "V8 has no rear_hook. Full-taxonomy macro F1 includes that unsupported class as zero.",
            "All models share v1 image-fraction features; timestamp/aspect normalization cannot be validated on this mirror.",
            "Calibration temperature and acceptance threshold share one calibration video; calibration-set estimates are optimistic.",
            "Small ST-GCN is a custom two-partition baseline, not a published architecture reproduction.",
            "Latency excludes pose extraction, decoding and preprocessing. No technique-quality labels exist."]}
    save_json(output / "configuration.json", configuration)
    runs = [train_one(groups, name, seed, output / f"{name}_{seed}", epochs, patience, include_observed_test)
            for name in architectures for seed in seeds]
    summaries = []
    for name in architectures:
        selected = [r for r in runs if r["architecture"] == name]
        values = np.array([r["metrics"]["validation"]["macroF1"] for r in selected])
        summaries.append({"architecture": name, "seeds": len(selected), "validationMacroF1Mean": float(values.mean()),
                          "validationMacroF1Std": float(values.std()),
                          "parameterCount": selected[0]["parameterCount"]})
    result = {**configuration, "summaries": summaries,
              "selectedByValidation": max(summaries, key=lambda s: s["validationMacroF1Mean"])["architecture"],
              "runs": runs}
    save_json(output / "report.json", result)
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, default=DATA_DEFAULT)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--architectures", nargs="+", choices=ARCHITECTURES, default=list(ARCHITECTURES))
    parser.add_argument("--seeds", nargs="+", type=int, default=[20261005, 20261006, 20261007])
    parser.add_argument("--epochs", type=int, default=40)
    parser.add_argument("--patience", type=int, default=10)
    parser.add_argument("--include-observed-test", action="store_true")
    args = parser.parse_args()
    result = benchmark(args.data, args.output, args.architectures, args.seeds, args.epochs, args.patience, args.include_observed_test)
    print(json.dumps(result["summaries"]))
