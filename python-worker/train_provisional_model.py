"""Train a validation-selected research TCN on the frozen original-Adam dataset."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import platform
import shutil
import time

import numpy as np
import torch

from benchmark_temporal_models import select_threshold, selective_metrics, save_json
from pipeline.boxing_research import LABELS, FEATURE_VERSION, digest, classification_metrics, probability_metrics
from pipeline.temporal_models import build_model
from pipeline.temporal_checkpoint import load_temporal_checkpoint
from train_boxing_research import predict_logits
from train_provisional_smoke import load_dataset


def class_balanced_weights(targets, sample_weights):
    counts = np.bincount(targets, weights=sample_weights, minlength=len(LABELS))
    if (counts <= 0).any():
        raise ValueError("Missing training classes")
    return sample_weights.sum() / (len(LABELS) * counts)


def weighted_loss(logits, targets, sample_weights, class_weights):
    losses = torch.nn.functional.cross_entropy(logits, targets, reduction="none")
    effective = sample_weights * class_weights[targets]
    return (losses * effective).sum() / effective.sum(), effective.sum()


def agreement(logits, targets):
    return classification_metrics([LABELS[int(i)] for i in targets],
                                  [LABELS[int(i)] for i in logits.argmax(1)])


def train_one(x, y, weights, vx, vy, seed, output, epochs, patience):
    """Only training and validation arrays enter model/epoch selection."""
    output.mkdir(parents=True, exist_ok=False)
    torch.manual_seed(seed)
    np.random.seed(seed)
    model = build_model("residual_tcn")
    optimizer = torch.optim.AdamW(model.parameters(), lr=.001, weight_decay=.001)
    tx, ty, tw = torch.from_numpy(x).float(), torch.from_numpy(y).long(), torch.from_numpy(weights).float()
    cw = torch.tensor(class_balanced_weights(y, weights), dtype=torch.float32)
    best, best_epoch, state, history = -1., 0, None, []
    started = time.monotonic()
    for epoch in range(1, epochs + 1):
        model.train()
        total_loss = total_weight = 0.
        for batch in torch.randperm(len(tx)).split(128):
            optimizer.zero_grad()
            loss, weight = weighted_loss(model(tx[batch]), ty[batch], tw[batch], cw)
            if not torch.isfinite(loss):
                raise ValueError("Non-finite training loss")
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 5, error_if_nonfinite=True)
            optimizer.step()
            total_loss += float(loss.detach()) * float(weight)
            total_weight += float(weight)
        metrics = agreement(predict_logits(model, vx), vy)
        score = metrics["macroF1"]
        history.append({"epoch": epoch, "weightedTrainingLoss": total_loss / total_weight,
                        "validationMacroF1": score})
        if score > best + 1e-6:
            best, best_epoch = score, epoch
            state = {k: v.detach().clone() for k, v in model.state_dict().items()}
        if epoch == 1 or epoch % 5 == 0:
            print(json.dumps({"seed": seed, **history[-1]}), flush=True)
        if epoch - best_epoch >= patience:
            break
    model.load_state_dict(state)
    np.savez_compressed(output / "model.npz", **{k: v.numpy() for k, v in state.items()})
    result = {"seed": seed, "bestEpoch": best_epoch, "epochsRun": len(history),
              "validation": agreement(predict_logits(model, vx), vy), "history": history,
              "classWeights": cw.tolist(), "seconds": time.monotonic() - started,
              "weightsSha256": digest(output / "model.npz"), "productionEligible": False}
    save_json(output / "training.json", result)
    print(json.dumps({"completedSeed": seed, "bestEpoch": best_epoch, "validationMacroF1": best}), flush=True)
    return result


def train(manifest_path, output, seeds=(20261006, 20261007, 20261008), epochs=40, patience=10,
          include_observed_test=False):
    if epochs < 1 or patience < 1 or not seeds or len(set(seeds)) != len(seeds):
        raise ValueError("Positive epochs/patience and unique nonempty seeds required")
    manifest, x, y, weights = load_dataset(manifest_path)
    rows = manifest["samples"]
    adam = [r for r in rows if r["sourceVideoId"] == "adam"]
    if (manifest.get("adamLabelPolicy", {}).get("status") != "SOURCE_SELECTED_BY_USER"
            or len(adam) != 18 or len({r["sourceRowId"] for r in adam}) != 18):
        raise ValueError("This run requires all 18 original Adam annotations")
    ids = {split: np.array([i for i, r in enumerate(rows) if r["split"] == split], dtype=int)
           for split in ("train", "validation", "calibration", "test")}
    if any(not len(v) for v in ids.values()):
        raise ValueError("Every frozen split must be nonempty")
    output.mkdir(parents=True, exist_ok=False)
    torch.set_num_threads(4)
    torch.use_deterministic_algorithms(True)
    root = Path(__file__).resolve().parent
    code = ("train_provisional_model.py", "train_provisional_smoke.py", "prepare_provisional_dataset.py",
            "benchmark_temporal_models.py", "train_boxing_research.py", "pipeline/boxing_research.py",
            "pipeline/temporal_models.py", "pipeline/temporal_checkpoint.py", "pipeline/evaluation_protocol.py")
    configuration = {"createdAt": datetime.now(timezone.utc).isoformat(), "architecture": "residual_tcn",
        "seeds": list(seeds), "maxEpochs": epochs, "patience": patience, "batchSize": 128,
        "optimizer": {"name": "AdamW", "learningRate": .001, "weightDecay": .001, "gradientNormClip": 5},
        "loss": "Cross entropy weighted by sample weight times inverse effective training class frequency; normalized by their sum per batch",
        "selection": "Best epoch per seed then best seed by validation macro-F1 over all six classes; earliest wins ties",
        "manifestPath": str(manifest_path.resolve()), "manifestSha256": digest(manifest_path),
        "featureSha256": manifest["featureSha256"], "adamLabelPolicy": manifest["adamLabelPolicy"],
        "splitCounts": {k: len(v) for k, v in ids.items()},
        "splitClassCounts": {k: dict(zip(LABELS, np.bincount(y[v], minlength=len(LABELS)).tolist())) for k, v in ids.items()},
        "adamSourceTrainSamples": 18, "aiTrainSamples": sum(r["labelProvenance"] == "AI_VISUAL_TRIAGE" for r in rows),
        "observedTestDiagnosticEnabled": include_observed_test,
        "runtime": {"python": platform.python_version(), "torch": torch.__version__, "numpy": np.__version__,
                    "device": "cpu", "threads": 4, "deterministicAlgorithms": True},
        "sourceHashes": {name: digest(root / name) for name in code},
        "mode": "research_only", "productionEligible": False, "goldEligible": False,
        "limitations": manifest["limitations"] + [
            "Validation chooses both epoch and seed; its agreement is selection-biased and V8 has no rear_hook.",
            "Calibration fits temperature and threshold on the same V5 video; these estimates are optimistic.",
            "V9/V10 are already-observed diagnostics, not an independent release test.",
            "Adam and heavybag are training sources, never held-out evaluation.",
            "No background class or technique-quality supervision; not an active worker model."]}
    save_json(output / "configuration.json", configuration)
    ti, vi = ids["train"], ids["validation"]
    runs = [train_one(x[ti], y[ti], weights[ti], x[vi], y[vi], seed,
                      output / f"seed_{seed}", epochs, patience) for seed in seeds]
    winner = max(runs, key=lambda r: r["validation"]["macroF1"])
    selected = output / "selected"
    selected.mkdir()
    shutil.copyfile(output / f"seed_{winner['seed']}" / "model.npz", selected / "model.npz")
    # Freeze selection on disk before accessing calibration or diagnostic predictions.
    save_json(output / "selection.json", {"seed": winner["seed"], "bestEpoch": winner["bestEpoch"],
              "weightsSha256": winner["weightsSha256"], "selectedUsing": "validation_only"})
    model = build_model("residual_tcn")
    with np.load(selected / "model.npz", allow_pickle=False) as archive:
        model.load_state_dict({k: torch.from_numpy(archive[k].copy()) for k in archive.files}, strict=True)
    ci = ids["calibration"]
    calibration_logits = predict_logits(model, x[ci])
    temperature = float(min(np.geomspace(.25, 8, 100),
                            key=lambda t: probability_metrics(calibration_logits, y[ci], t)["nll"]))
    policy = select_threshold(calibration_logits, y[ci], temperature)
    metrics = {}
    for split in ("validation", "calibration", "test") if include_observed_test else ("validation", "calibration"):
        ix = ids[split]
        logits = calibration_logits if split == "calibration" else predict_logits(model, x[ix])
        metrics["observedTestDiagnostic" if split == "test" else split] = {
            **agreement(logits, y[ix]), "uncalibrated": probability_metrics(logits, y[ix]),
            "calibrated": probability_metrics(logits, y[ix], temperature),
            "selective": selective_metrics(logits, y[ix], temperature, policy)}
    report = {"status": "PROVISIONAL_TRAINING_COMPLETED", "mode": "research_only",
        "productionEligible": False, "goldEligible": False, "architecture": "residual_tcn",
        "featureVersion": FEATURE_VERSION, "labels": list(LABELS), "seed": winner["seed"],
        "bestEpoch": winner["bestEpoch"], "epochsRun": winner["epochsRun"],
        "parameterCount": sum(p.numel() for p in model.parameters()),
        "weightsSha256": digest(selected / "model.npz"), "temperature": temperature,
        "acceptancePolicy": policy, "metrics": metrics, "manifestSha256": digest(manifest_path),
        "calibrationFitted": True, "testEvaluated": include_observed_test,
        "selection": configuration["selection"], "limitations": configuration["limitations"]}
    save_json(selected / "report.json", report)
    restored, _ = load_temporal_checkpoint(selected)
    np.testing.assert_allclose(predict_logits(restored, x[vi[:16]]), predict_logits(model, x[vi[:16]]), rtol=1e-6, atol=1e-6)
    report["checkpointRoundtripPassed"] = True
    save_json(selected / "report.json", report)
    scores = np.array([r["validation"]["macroF1"] for r in runs])
    summary = {**configuration, "status": report["status"], "runs": runs, "selected": report,
               "selectedCheckpoint": str(selected.resolve()), "validationMacroF1Mean": float(scores.mean()),
               "validationMacroF1Std": float(scores.std()), "trainingSeconds": sum(r["seconds"] for r in runs)}
    save_json(output / "report.json", summary)
    print(json.dumps({"completed": True, "selectedSeed": winner["seed"], "bestEpoch": winner["bestEpoch"],
                      "validationMacroF1": winner["validation"]["macroF1"], "acceptancePolicy": policy}), flush=True)
    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--seeds", type=int, nargs="+", default=[20261006, 20261007, 20261008])
    parser.add_argument("--epochs", type=int, default=40)
    parser.add_argument("--patience", type=int, default=10)
    parser.add_argument("--include-observed-test", action="store_true")
    args = parser.parse_args()
    train(args.manifest, args.output, args.seeds, args.epochs, args.patience, args.include_observed_test)
