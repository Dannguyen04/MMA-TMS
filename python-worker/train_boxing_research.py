"""Reproducible CPU-only experiment on pinned BoxingVI mirror; never promotes.

Data acquisition and training run only from this explicit CLI, never worker.py.
No upstream code/checkpoints are executed. Numeric NPZ checkpoints avoid pickle.
"""
from __future__ import annotations

import argparse
from collections import Counter
import json
from pathlib import Path
import time
import urllib.request

import numpy as np
import torch
from torch import nn

from pipeline.boxing_research import (LABELS, SPLITS, FEATURE_VERSION, digest, read_labels,
    pose_features, classification_metrics, softmax, probability_metrics)

COMMIT = "96f3a7d0716040682381fb63f80afac96f74cfa6"
REPO = "https://github.com/leonardosm14/boxe.ml"
DATA_DEFAULT = Path("test_results/external/boxe_ml") / COMMIT


class PoseTCN(nn.Module):
    def __init__(self):
        super().__init__()
        self.temporal = nn.Sequential(nn.Conv1d(85, 64, 3, padding=1), nn.ReLU(), nn.Dropout(.2),
                                      nn.Conv1d(64, 64, 3, padding=1), nn.ReLU())
        self.head = nn.Sequential(nn.Linear(128, 64), nn.ReLU(), nn.Dropout(.3), nn.Linear(64, 6))

    def forward(self, x):
        x = self.temporal(x.transpose(1, 2))
        return self.head(torch.cat((x.mean(dim=2), x.amax(dim=2)), dim=1))


def fetch(data: Path):
    files = ["videos/adam.mp4", "evaluation/adam_gt.csv", "LICENSE", "README.md", "dataset/NOTICES.md"]
    files += [f"dataset/{folder}/V{i}.{suffix}" for i in range(1, 11)
              for folder, suffix in (("skeleton_data", "npy"), ("clean_annotation_data", "csv"))]
    for name in files:
        relative = name.removeprefix("dataset/") if name.startswith("dataset/") else Path(name).name
        target = data / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists():
            url = f"https://raw.githubusercontent.com/leonardosm14/boxe.ml/{COMMIT}/{name}"
            with urllib.request.urlopen(url, timeout=60) as response:
                target.write_bytes(response.read())
        print(f"{relative}: {digest(target)}", flush=True)


def prepare(data: Path):
    groups, audit, hashes = {}, [], {}
    clip_owners = {}
    for split, videos in SPLITS.items():
        for video in videos:
            annotations, skeleton = data / f"clean_annotation_data/{video}.csv", data / f"skeleton_data/{video}.npy"
            rows = read_labels(annotations, allow_invalid_intervals=True)
            array = np.load(skeleton, allow_pickle=False)
            if array.shape != (len(rows), 25, 17, 2) or not np.issubdtype(array.dtype, np.number):
                raise ValueError(f"Unaligned pose/label schema for {video}: {array.shape}, {len(rows)} rows")
            features, labels, accepted_rows, rejected = [], [], [], []
            for index, (clip, row) in enumerate(zip(array, rows)):
                if not row["validInterval"]:
                    rejected.append({"row": index, "reason": "INVALID_SOURCE_INTERVAL"})
                    continue
                # Duplicate exact skeletons cannot cross sources/splits silently.
                clip_hash = __import__("hashlib").sha256(np.asarray(clip, dtype=np.float32).tobytes()).hexdigest()
                previous = clip_owners.get(clip_hash)
                if previous and previous[0] != split:
                    raise ValueError(f"Exact duplicate pose crosses splits: {previous} and {split}/{video}/{index}")
                clip_owners[clip_hash] = (split, video, index)
                try:
                    features.append(pose_features(clip))
                except ValueError as error:
                    rejected.append({"row": index, "reason": str(error)})
                    continue
                labels.append(LABELS.index(row["technique"]))
                accepted_rows.append(index)
            if not features:
                raise ValueError(f"No valid samples for {video}")
            groups[video] = (np.stack(features), np.asarray(labels), accepted_rows)
            audit.append({"video": video, "split": split, "sourceRows": len(rows), "accepted": len(labels),
                          "classes": dict(Counter(LABELS[y] for y in labels)), "rejected": rejected})
            for path in (annotations, skeleton):
                hashes[path.relative_to(data).as_posix()] = digest(path)
    # V6 is frame-level [46497,1,17,3], not row-aligned [clips,25,17,2].
    # Never guess a correspondence or silently assign its 685 labels by row.
    for name in ("skeleton_data/V6.npy", "clean_annotation_data/V6.csv", "adam.mp4", "adam_gt.csv", "LICENSE", "NOTICES.md"):
        if (data / name).exists():
            hashes[name] = digest(data / name)
    return groups, {"sourceRepository": REPO, "sourceCommit": COMMIT,
                    "upstream": "https://github.com/Bikudebug/BoxingVI", "inputHashes": hashes,
                    "splitPolicy": SPLITS, "officialBenchmarkSplit": False,
                    "fighterIndependenceVerified": False, "commercialDataRightsVerified": False,
                    "excluded": [{"video": "V6", "reason": "INCOMPATIBLE_FRAME_LEVEL_SCHEMA"}],
                    "videos": audit}


def predict_logits(model, features):
    model.eval()
    with torch.no_grad():
        return np.concatenate([model(torch.from_numpy(features[i:i + 256])).numpy() for i in range(0, len(features), 256)])


def report_split(model, groups, videos, temperature):
    logits, targets, per_video = [], [], {}
    for video in videos:
        x, y, rows = groups[video]
        values = predict_logits(model, x)
        metrics = classification_metrics([LABELS[i] for i in y], [LABELS[i] for i in values.argmax(1)])
        per_video[video] = metrics
        logits.append(values)
        targets.append(y)
    values, y = np.concatenate(logits), np.concatenate(targets)
    result = classification_metrics([LABELS[i] for i in y], [LABELS[i] for i in values.argmax(1)])
    result.update(perVideo=per_video, uncalibrated=probability_metrics(values, y),
                  calibrated=probability_metrics(values, y, temperature))
    accepted = softmax(values, temperature).max(1) >= .8
    result["fixedThreshold080"] = {"accepted": int(accepted.sum()), "coverage": float(accepted.mean()),
        "accuracyWhenAccepted": float((values.argmax(1)[accepted] == y[accepted]).mean()) if accepted.any() else None,
        "note": "Descriptive only; not a validated production acceptance policy."}
    # Coarse family performance is explicitly separate from six-class technique.
    family = np.asarray([0, 0, 1, 1, 2, 2])
    probs = softmax(values, temperature)
    coarse = np.stack([probs[:, family == i].sum(1) for i in range(3)], axis=1).argmax(1)
    names = ("straight", "hook", "uppercut")
    result["coarseFamily"] = classification_metrics([names[i] for i in family[y]], [names[i] for i in coarse], names)
    return result


def train(data: Path, output: Path, epochs=60, seed=20261003):
    if epochs <= 0:
        raise ValueError("epochs must be positive")
    output.mkdir(parents=True, exist_ok=True)
    # Never overwrite an experiment after test labels have been inspected.
    if (output / "report.json").exists() or (output / "model.npz").exists():
        raise ValueError("Use a new output directory; existing experiments are immutable")
    torch.set_num_threads(4)
    torch.use_deterministic_algorithms(True)
    torch.manual_seed(seed)
    np.random.seed(seed)
    groups, audit = prepare(data)
    (output / "data_audit.json").write_text(json.dumps(audit, indent=2), encoding="utf-8")
    def concat(split):
        return (np.concatenate([groups[v][0] for v in SPLITS[split]]),
                np.concatenate([groups[v][1] for v in SPLITS[split]]))
    x, y = concat("train")
    vx, vy = concat("validation")
    model = PoseTCN()
    optimizer = torch.optim.AdamW(model.parameters(), lr=.001, weight_decay=.001)
    counts = np.bincount(y, minlength=6)
    weights = torch.tensor(len(y) / (6 * np.maximum(counts, 1)), dtype=torch.float32)
    loss_fn = nn.CrossEntropyLoss(weight=weights)
    tx, ty = torch.from_numpy(x), torch.from_numpy(y).long()
    best_f1, best_epoch, best_state, history = -1, 0, None, []
    started = time.monotonic()
    for epoch in range(1, epochs + 1):
        model.train()
        order = torch.randperm(len(tx))
        losses = []
        for indices in order.split(128):
            optimizer.zero_grad()
            loss = loss_fn(model(tx[indices]), ty[indices])
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 5)
            optimizer.step()
            losses.append(float(loss.detach()))
        predicted = predict_logits(model, vx).argmax(1)
        val = classification_metrics([LABELS[i] for i in vy], [LABELS[i] for i in predicted])
        history.append({"epoch": epoch, "loss": float(np.mean(losses)), "validationMacroF1": val["macroF1"]})
        if val["macroF1"] > best_f1 + 1e-6:
            best_f1, best_epoch = val["macroF1"], epoch
            best_state = {k: value.detach().clone() for k, value in model.state_dict().items()}
        if epoch % 5 == 0:
            print(json.dumps(history[-1]), flush=True)
        if epoch - best_epoch >= 12:
            break
    model.load_state_dict(best_state)
    cx, cy = concat("calibration")
    cal_logits = predict_logits(model, cx)
    temperatures = np.geomspace(.25, 8, 100)
    temperature = float(min(temperatures, key=lambda t: probability_metrics(cal_logits, cy, t)["nll"]))
    np.savez_compressed(output / "model.npz", **{k: v.numpy() for k, v in best_state.items()})
    card = {"schemaVersion": "1.0.0", "modelId": "boxing-pose-tcn-research-v1", "mode": "research_only",
            "featureVersion": FEATURE_VERSION, "labels": LABELS, "seed": seed, "temperature": temperature,
            "weightsSha256": digest(output / "model.npz"), "dataAuditSha256": digest(output / "data_audit.json"),
            "productionEligible": False, "blockedReasons": ["COMMERCIAL_DATA_RIGHTS_UNVERIFIED",
                "FIGHTER_INDEPENDENCE_UNVERIFIED", "NO_BACKGROUND_TRAINING", "NO_COACH_QUALITY_LABELS",
                "NO_INDEPENDENT_PRODUCTION_ACCEPTANCE", "POSE_SOURCE_DOMAIN_SHIFT"],
            "sourceHashes": {p: digest(Path(p)) for p in ("train_boxing_research.py", "pipeline/boxing_research.py")}}
    report = {"modelCard": card, "bestEpoch": best_epoch, "seconds": time.monotonic() - started,
              "history": history, "splitMetrics": {split: report_split(model, groups, videos, temperature) for split, videos in SPLITS.items()},
              "limitations": ["Research mirror split, not the official BoxingVI benchmark.",
                "Annotated positive clips have oracle boundaries; these scores are not continuous-video detection accuracy.",
                "Same athlete could appear across source videos; identity metadata is unavailable.",
                "V8 has no rear_hook; validation macro F1 includes its zero-support class as zero.",
                "Calibration on one video does not establish population-wide calibration.",
                "Technique identity is not technique correctness. No scoring/coaching validation labels exist."]}
    (output / "model_card.json").write_text(json.dumps(card, indent=2), encoding="utf-8")
    (output / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({"bestEpoch": best_epoch, "test": report["splitMetrics"]["test"], "productionEligible": False}), flush=True)


def load_research_model(directory: Path):
    card = json.loads((directory / "model_card.json").read_text(encoding="utf-8"))
    if card.get("mode") != "research_only" or card.get("featureVersion") != FEATURE_VERSION or card.get("labels") != list(LABELS):
        raise ValueError("Unsupported research model contract")
    if digest(directory / "model.npz") != card["weightsSha256"]:
        raise ValueError("Model checksum mismatch")
    model = PoseTCN()
    with np.load(directory / "model.npz", allow_pickle=False) as archive:
        state = {k: torch.from_numpy(archive[k]) for k in archive.files}
    model.load_state_dict(state, strict=True)
    model.eval()
    return model, card


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("fetch", "train"))
    parser.add_argument("--data", type=Path, default=DATA_DEFAULT)
    parser.add_argument("--output", type=Path, default=Path("test_results/boxing_research/run01"))
    parser.add_argument("--epochs", type=int, default=60)
    args = parser.parse_args()
    fetch(args.data) if args.command == "fetch" else train(args.data, args.output, args.epochs)
