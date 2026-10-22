"""Frozen source-group CV ablations followed by one CV-selected full refit."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import platform
import time

import numpy as np
import torch

from benchmark_temporal_models import save_json, select_threshold, selective_metrics
from pipeline.boxing_research import LABELS, FEATURE_VERSION, digest, probability_metrics
from pipeline.temporal_models import build_model
from pipeline.temporal_checkpoint import load_temporal_checkpoint
from pipeline.temporal_experiments import VARIANTS, AuxiliaryTCN, augment_pose, source_sampling_probabilities
from train_boxing_research import predict_logits
from train_provisional_smoke import load_dataset
from train_provisional_model import agreement, class_balanced_weights

CODE = ("run_temporal_ablations.py", "pipeline/temporal_experiments.py", "train_provisional_model.py",
        "train_provisional_smoke.py", "prepare_provisional_dataset.py", "benchmark_temporal_models.py",
        "pipeline/temporal_models.py", "pipeline/temporal_checkpoint.py", "pipeline/boxing_research.py",
        "pipeline/evaluation_protocol.py", "train_boxing_research.py")


def validate_folds(manifest_path, manifest, targets, plan):
    if digest(manifest_path) != plan["manifestSha256"]:
        raise ValueError("Fold plan dataset hash mismatch")
    rows = manifest["samples"]
    train_sources = {r["sourceVideoId"] for r in rows if r["split"] == "train"}
    original_adam = [r for r in rows if r["sourceVideoId"] == "adam"]
    if (manifest.get("adamLabelPolicy", {}).get("status") != "SOURCE_SELECTED_BY_USER"
            or len(original_adam) != 18 or len({r["sourceRowId"] for r in original_adam}) != 18):
        raise ValueError("All original Adam annotations required")
    folds, held_out, numbers = [], set(), set()
    for fold in plan["folds"]:
        ts, vs = set(fold["trainSources"]), set(fold["validationSources"])
        if (len(ts) != len(fold["trainSources"]) or len(vs) != len(fold["validationSources"])
                or not vs or ts & vs or ts | vs != train_sources or vs & held_out
                or "adam" not in ts or fold["fold"] in numbers):
            raise ValueError("Invalid source grouping or repeated fold")
        ti = np.array([i for i, r in enumerate(rows) if r["sourceVideoId"] in ts], dtype=int)
        vi = np.array([i for i, r in enumerate(rows) if r["sourceVideoId"] in vs], dtype=int)
        if any(rows[i]["split"] != "train" for i in np.r_[ti, vi]):
            raise ValueError("Calibration/diagnostic data entered CV")
        if any(rows[i].get("reviewStatus") == "SOURCE_SELECTED_BY_USER" or rows[i]["labelProvenance"] == "AI_VISUAL_TRIAGE" for i in vi):
            raise ValueError("Supplementary video cannot enter validation")
        for indices, key in ((ti, "train"), (vi, "validation")):
            counts = dict(zip(LABELS, np.bincount(targets[indices], minlength=6).tolist()))
            if len(indices) != fold[key + "Samples"] or counts != fold[key + "ClassCounts"] or min(counts.values()) <= 0:
                raise ValueError("Fold counts or classes differ from frozen plan")
        held_out.update(vs)
        numbers.add(fold["fold"])
        folds.append((fold["fold"], ti, vi))
    expected = {r["sourceVideoId"] for r in rows if r["split"] == "train"
                and r["labelProvenance"] == "UPSTREAM_IMPORTED_UNVERIFIED" and r.get("reviewStatus") != "SOURCE_SELECTED_BY_USER"}
    if held_out != expected:
        raise ValueError("Every mirror training source must be held out exactly once")
    return folds


def fit(x, y, weights, sources, variant, seed, output, epochs, patience, vx=None, vy=None, validation_sources=None):
    """CV uses validation only; refit receives no validation array or early stop."""
    output.mkdir(parents=True, exist_ok=False)
    torch.manual_seed(seed)
    model = AuxiliaryTCN() if variant == "A3_auxiliary" else build_model("residual_tcn")
    # Keep dropout randomness comparable despite auxiliary-head initialization.
    torch.manual_seed(seed + 1000)
    order_rng = torch.Generator().manual_seed(seed + 2000)
    augmentation_rng = torch.Generator().manual_seed(seed + 3000)
    optimizer = torch.optim.AdamW(model.parameters(), lr=.001, weight_decay=.001)
    tx, ty, tw = torch.from_numpy(x).float(), torch.from_numpy(y).long(), torch.from_numpy(weights).float()
    cw = torch.tensor(class_balanced_weights(y, weights), dtype=torch.float32)
    probabilities = torch.tensor(source_sampling_probabilities(y, weights, sources)) if variant == "A1_source_sampler" else None
    best, best_epoch, state, history = -1., 0, None, []
    started = time.monotonic()
    for epoch in range(1, epochs + 1):
        model.train()
        order = (torch.multinomial(probabilities, len(tx), replacement=True, generator=order_rng)
                 if probabilities is not None else torch.randperm(len(tx), generator=order_rng))
        total_loss = total_weight = 0.
        for batch in order.split(128):
            optimizer.zero_grad()
            values = augment_pose(tx[batch], augmentation_rng) if variant == "A2_pose_noise" else tx[batch]
            if variant == "A3_auxiliary":
                logits, family, side = model.training_heads(values)
                losses = (torch.nn.functional.cross_entropy(logits, ty[batch], reduction="none")
                          + .2 * torch.nn.functional.cross_entropy(family, ty[batch] // 2, reduction="none")
                          + .2 * torch.nn.functional.cross_entropy(side, ty[batch] % 2, reduction="none"))
            else:
                losses = torch.nn.functional.cross_entropy(model(values), ty[batch], reduction="none")
            effective = torch.ones(len(batch)) if probabilities is not None else tw[batch] * cw[ty[batch]]
            loss = (losses * effective).sum() / effective.sum()
            if not torch.isfinite(loss):
                raise ValueError("Non-finite loss")
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 5, error_if_nonfinite=True)
            optimizer.step()
            total_loss += float((losses.detach() * effective).sum())
            total_weight += float(effective.sum())
        record = {"epoch": epoch, "loss": total_loss / total_weight}
        if vx is not None:
            score = agreement(predict_logits(model, vx), vy)["macroF1"]
            record["validationMacroF1"] = score
        else:
            score = float(epoch)  # Fixed-duration refit: always retain the final epoch.
        history.append(record)
        if score > best + 1e-6:
            best, best_epoch = score, epoch
            state = {k: v.detach().clone() for k, v in model.state_dict().items()}
        if epoch == 1 or epoch % 10 == 0:
            print(json.dumps({"run": output.name, **record}), flush=True)
        if vx is not None and epoch - best_epoch >= patience:
            break
    model.load_state_dict(state)
    # Auxiliary supervision is train-only. Export a normal v1 residual TCN.
    inference_state = {k: v.numpy() for k, v in state.items() if not k.startswith(("family_head.", "side_head."))}
    np.savez_compressed(output / "model.npz", **inference_state)
    if variant == "A3_auxiliary":
        np.savez_compressed(output / "training_model.npz", **{k: v.numpy() for k, v in state.items()})
    restored = build_model("residual_tcn")
    with np.load(output / "model.npz", allow_pickle=False) as archive:
        restored.load_state_dict({k: torch.from_numpy(archive[k].copy()) for k in archive.files}, strict=True)
    probe = vx[:16] if vx is not None else x[:16]
    np.testing.assert_allclose(predict_logits(restored, probe), predict_logits(model, probe), rtol=1e-6, atol=1e-6)
    result = {"variant": variant, "seed": seed, "bestEpoch": best_epoch, "epochsRun": len(history),
        "history": history, "weightsSha256": digest(output / "model.npz"), "seconds": time.monotonic() - started,
        "checkpointRoundtripPassed": True, "mode": "research_only", "productionEligible": False}
    if vx is not None:
        logits = predict_logits(restored, vx)
        result["validation"] = agreement(logits, vy)
        result["perSource"] = {str(s): agreement(logits[validation_sources == s], vy[validation_sources == s]) for s in sorted(set(validation_sources))}
        np.savez_compressed(output / "validation_predictions.npz", logits=logits, targets=vy)
    save_json(output / "training.json", result)
    print(json.dumps({"completed": output.name, "bestEpoch": best_epoch, "macroF1": result.get("validation", {}).get("macroF1"), "seconds": result["seconds"]}), flush=True)
    return result


def summarize(runs):
    summaries = []
    for variant in VARIANTS:
        selected = [r for r in runs if r["variant"] == variant]
        folds = sorted({r["fold"] for r in selected})
        source_scores = {s: float(np.mean([r["perSource"][s]["macroF1"] for r in selected if s in r["perSource"]]))
                         for s in sorted({s for r in selected for s in r["perSource"]})}
        summaries.append({"variant": variant, "runs": len(selected),
            "meanFoldMacroF1": float(np.mean([r["validation"]["macroF1"] for r in selected])),
            "worstSourceMeanMacroF1": min(source_scores.values()), "perSourceMeanMacroF1": source_scores,
            "folds": [{"fold": f, "meanMacroF1": float(np.mean([r["validation"]["macroF1"] for r in selected if r["fold"] == f])),
                       "seedStd": float(np.std([r["validation"]["macroF1"] for r in selected if r["fold"] == f]))} for f in folds],
            "perClassMeanFoldF1": {label: float(np.mean([r["validation"]["perClass"][label]["f1"] for r in selected])) for label in LABELS},
            "perClassMeanFoldRecall": {label: float(np.mean([r["validation"]["perClass"][label]["recall"] for r in selected])) for label in LABELS}})
    return summaries


def run(manifest_path, plan_path, output):
    manifest, x, y, weights = load_dataset(manifest_path)
    plan = json.loads(plan_path.read_text())
    folds = validate_folds(manifest_path, manifest, y, plan)
    rows = manifest["samples"]
    sources = np.array([r["sourceVideoId"] for r in rows])
    root = Path(__file__).resolve().parent
    hashes = {p: digest(root / p) for p in CODE}
    torch.set_num_threads(4)
    torch.use_deterministic_algorithms(True)
    contract = {"manifestSha256": digest(manifest_path), "foldPlanSha256": digest(plan_path), "sourceHashes": hashes,
        "variants": list(VARIANTS), "seeds": plan["fixedSeeds"], "epochs": plan["maxEpochs"], "patience": plan["patience"],
        "batchSize": 128, "optimizer": {"name": "AdamW", "lr": .001, "weightDecay": .001, "clipNorm": 5},
        "A1": {"policy": "class-balanced source-tempered sampling with replacement; reliability in sampling once; unweighted CE", "sourceFactor": "min(3,sqrt(class_mass/source_class_mass))", "drawsPerEpoch": "train count"},
        "A2": {"coordinateNoiseStdTorsoUnits": .015, "armJointDropProbabilityPerClip": .35, "dropFrames": [2, 5], "velocityRecomputed": True},
        "A3": {"familyLossWeight": .2, "sideLossWeight": .2, "mainLossWeight": 1., "inference": "main six-class head only"},
        "selection": plan["selection"], "finalRefitSeed": plan["fixedSeeds"][0],
        "finalRefitEpochs": "rounded median best epoch of the nine CV runs for the winner; no V8 selection",
        "runtime": {"python": platform.python_version(), "torch": torch.__version__, "numpy": np.__version__, "threads": 4},
        "mode": "research_only", "productionEligible": False,
        "limitations": plan["limitations"] + ["CV epoch selection and variant comparison use the same development folds; estimates are selection-biased.",
            "A1 uses capped partial source balancing, not equal sources; tiny video samples remain limited.",
            "Calibration policy uses one previously observed V5 video; no independent precision guarantee."]}
    if output.exists():
        existing = json.loads((output / "configuration.json").read_text())
        if {k: v for k, v in existing.items() if k != "createdAt"} != contract:
            raise ValueError("Resume contract changed; use a new output")
        if (output / "report.json").exists():
            raise ValueError("Completed experiment is immutable")
    else:
        output.mkdir(parents=True)
        save_json(output / "configuration.json", {"createdAt": datetime.now(timezone.utc).isoformat(), **contract})
    runs = []
    for variant in VARIANTS:
        for fold, ti, vi in folds:
            for seed in plan["fixedSeeds"]:
                directory = output / f"{variant}_fold{fold}_seed{seed}"
                if (directory / "training.json").exists():
                    result = json.loads((directory / "training.json").read_text())
                    if digest(directory / "model.npz") != result["weightsSha256"]:
                        raise ValueError("Resumed weights changed")
                else:
                    result = fit(x[ti], y[ti], weights[ti], sources[ti], variant, seed, directory,
                                 plan["maxEpochs"], plan["patience"], x[vi], y[vi], sources[vi])
                runs.append({"fold": fold, **result})
                save_json(output / "progress.json", {"completedRuns": len(runs), "totalRuns": len(VARIANTS) * len(folds) * len(plan["fixedSeeds"]), "lastRun": directory.name})
        print(json.dumps({"variantComplete": variant, "meanMacroF1": float(np.mean([r['validation']['macroF1'] for r in runs if r['variant'] == variant]))}), flush=True)
    summaries = summarize(runs)
    winner = max(summaries, key=lambda s: (s["meanFoldMacroF1"], s["worstSourceMeanMacroF1"]))
    epochs = int(np.rint(np.median([r["bestEpoch"] for r in runs if r["variant"] == winner["variant"]])))
    selection = {"variant": winner["variant"], "seed": plan["fixedSeeds"][0], "epochs": epochs,
                 "selectedUsing": "source_group_cv_only", "summaries": summaries}
    save_json(output / "selection.json", selection)
    print(json.dumps({"selectionFrozen": selection}), flush=True)
    ti = np.array([i for i, r in enumerate(rows) if r["split"] == "train"])
    selected = output / "selected"
    final = fit(x[ti], y[ti], weights[ti], sources[ti], winner["variant"], selection["seed"], selected, epochs, 0)
    model = build_model("residual_tcn")
    with np.load(selected / "model.npz", allow_pickle=False) as archive:
        model.load_state_dict({k: torch.from_numpy(archive[k].copy()) for k in archive.files}, strict=True)
    ci = np.array([i for i, r in enumerate(rows) if r["split"] == "calibration"])
    logits = predict_logits(model, x[ci])
    temperature = float(min(np.geomspace(.25, 8, 100), key=lambda t: probability_metrics(logits, y[ci], t)["nll"]))
    policy = select_threshold(logits, y[ci], temperature)
    metrics = {}
    for split in ("validation", "calibration", "test"):
        ids = np.array([i for i, r in enumerate(rows) if r["split"] == split])
        values = predict_logits(model, x[ids])
        metrics[split] = {**agreement(values, y[ids]), "calibrated": probability_metrics(values, y[ids], temperature),
            "selective": selective_metrics(values, y[ids], temperature, policy),
            "perSource": {str(s): agreement(values[sources[ids] == s], y[ids][sources[ids] == s]) for s in sorted(set(sources[ids]))}}
    report = {"architecture": "residual_tcn", "trainingVariant": winner["variant"], "seed": selection["seed"],
        "bestEpoch": epochs, "epochMeaning": "fixed refit duration from CV median, not a V8-selected checkpoint",
        "featureVersion": FEATURE_VERSION, "labels": list(LABELS), "temperature": temperature, "acceptancePolicy": policy,
        "weightsSha256": digest(selected / "model.npz"), "manifestSha256": digest(manifest_path),
        "metrics": metrics, "validationRole": "historical V8 diagnostic only", "testRole": "observed V9/V10 diagnostic only",
        "selection": selection, "checkpointRoundtripPassed": final["checkpointRoundtripPassed"],
        "mode": "research_only", "productionEligible": False, "goldEligible": False}
    save_json(selected / "report.json", report)
    restored, _ = load_temporal_checkpoint(selected)
    np.testing.assert_allclose(predict_logits(restored, x[ci[:16]]), predict_logits(model, x[ci[:16]]), rtol=1e-6, atol=1e-6)
    result = {**contract, "status": "CV_AND_REFIT_COMPLETED", "summaries": summaries, "runs": runs,
              "selected": report, "trainingSeconds": sum(r["seconds"] for r in runs) + final["seconds"]}
    save_json(output / "report.json", result)
    print(json.dumps({"completed": True, "winner": winner["variant"], "epochs": epochs,
                      "diagnosticMacroF1": metrics["test"]["macroF1"]}), flush=True)
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--fold-plan", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    run(args.manifest, args.fold_plan, args.output)
