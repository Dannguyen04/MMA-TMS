"""Exercise temporary weak-label data with a short, isolated research training run."""
import argparse
import json
from pathlib import Path

import numpy as np
import torch

from pipeline.boxing_research import FEATURE_VERSION, LABELS, digest, classification_metrics, read_labels
from pipeline.temporal_models import build_model
from prepare_provisional_dataset import save, ADAM_CSV, ADAM_CSV_SHA256
from train_boxing_research import predict_logits


def load_dataset(path):
    manifest = json.loads(path.read_text(encoding="utf-8"))
    if manifest.get("schemaVersion") != "provisional_research_dataset_v1" or manifest.get("featureVersion") != FEATURE_VERSION:
        raise ValueError("Unsupported temporary dataset")
    if manifest.get("productionEligible") is not False or manifest.get("goldEligible") is not False:
        raise ValueError("Temporary dataset cannot assert promotion")
    asset = path.parent / manifest["featurePath"]
    if digest(asset) != manifest["featureSha256"]:
        raise ValueError("Feature checksum mismatch")
    with np.load(asset, allow_pickle=False) as archive:
        x, y, weights = archive["features"].copy(), archive["targets"].copy(), archive["loss_weights"].copy()
    rows = manifest["samples"]
    adam_policy = manifest.get("adamLabelPolicy")
    if adam_policy:
        if adam_policy.get("sourceSha256") != ADAM_CSV_SHA256 or digest(ADAM_CSV) != ADAM_CSV_SHA256 or adam_policy.get("aiOverridesAllowed") is not False:
            raise ValueError("Invalid original Adam label policy")
        original = {r["id"]: r for r in read_labels(ADAM_CSV)}
        for row in rows:
            if row["sourceVideoId"] != "adam":
                continue
            source = original.get(row.get("sourceRowId"))
            if (source is None or row.get("trainingLabel") != source["technique"]
                    or row.get("startFrame") != source["startFrame"] or row.get("endFrameExclusive") != source["endFrame"] + 1
                    or row.get("labelProvenance") != "UPSTREAM_IMPORTED_UNVERIFIED"
                    or row.get("sourceAnnotationSha256") != ADAM_CSV_SHA256
                    or row.get("reviewStatus") != "SOURCE_SELECTED_BY_USER" or row["split"] != "train"):
                raise ValueError("Adam sample differs from selected original CSV")
    if x.shape != (len(rows), 25, 85) or y.shape != (len(rows),) or weights.shape != (len(rows),):
        raise ValueError("Feature/manifest shape mismatch")
    if not np.isfinite(x).all() or not np.isfinite(weights).all() or (weights <= 0).any() or (weights > 1).any():
        raise ValueError("Invalid values or weights")
    if not np.issubdtype(y.dtype, np.integer) or (y < 0).any() or (y >= len(LABELS)).any():
        raise ValueError("Invalid target values")
    owners, identifiers = {}, set()
    for i, row in enumerate(rows):
        if row["arrayIndex"] != i or row["trainingLabel"] != LABELS[int(y[i])] or not np.isclose(weights[i], row["lossWeight"]):
            raise ValueError("Array/metadata mapping mismatch")
        if row["sampleId"] in identifiers:
            raise ValueError("Duplicate sample")
        identifiers.add(row["sampleId"])
        split = row["split"]
        if split not in {"train", "validation", "calibration", "test"}:
            raise ValueError("Invalid split")
        if row.get("coachConfirmed") is not False or row.get("goldEligible") is not False:
            raise ValueError("Unexpected approval")
        if row["labelProvenance"] == "AI_VISUAL_TRIAGE":
            if split != "train" or row.get("reviewStatus") != "AI_REVIEW_PROVISIONAL" or weights[i] >= 1:
                raise ValueError("Weak AI data must remain downweighted training data")
        elif row["labelProvenance"] != "UPSTREAM_IMPORTED_UNVERIFIED":
            raise ValueError("Unsupported label provenance")
        for group in (row["sourceVideoId"], row.get("sourceVideoSha256")):
            if group:
                if group in owners and owners[group] != split:
                    raise ValueError("Cross-split source leakage")
                owners[group] = split
    return manifest, x, y, weights


def train(manifest_path, output, epochs=3, seed=20261006):
    if not 1 <= epochs <= 10:
        raise ValueError("Smoke run must use 1..10 epochs")
    manifest, x, y, weights = load_dataset(manifest_path)
    rows = manifest["samples"]
    train_ids = np.array([i for i, r in enumerate(rows) if r["split"] == "train"])
    val_ids = np.array([i for i, r in enumerate(rows) if r["split"] == "validation"])
    if not len(train_ids) or not len(val_ids) or len(np.unique(y[train_ids])) != len(LABELS):
        raise ValueError("Missing training classes or validation samples")
    output.mkdir(parents=True, exist_ok=False)
    torch.set_num_threads(4)
    torch.use_deterministic_algorithms(True)
    torch.manual_seed(seed)
    np.random.seed(seed)
    model = build_model("residual_tcn")
    optimizer = torch.optim.AdamW(model.parameters(), lr=.001, weight_decay=.001)
    tx = torch.from_numpy(x[train_ids]).float()
    ty = torch.from_numpy(y[train_ids]).long()
    tw = torch.from_numpy(weights[train_ids]).float()
    history = []
    for epoch in range(1, epochs + 1):
        model.train()
        total_loss = total_weight = 0.0
        for batch in torch.randperm(len(tx)).split(128):
            optimizer.zero_grad()
            losses = torch.nn.functional.cross_entropy(model(tx[batch]), ty[batch], reduction="none")
            loss = (losses * tw[batch]).sum() / tw[batch].sum()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 5)
            optimizer.step()
            total_loss += float((losses.detach() * tw[batch]).sum())
            total_weight += float(tw[batch].sum())
        predicted = predict_logits(model, x[val_ids]).argmax(1)
        metrics = classification_metrics([LABELS[i] for i in y[val_ids]], [LABELS[i] for i in predicted])
        history.append({"epoch": epoch, "weightedTrainingLoss": total_loss / total_weight,
                        "validationUpstreamLabelAgreement": metrics})
        print(json.dumps({"epoch": epoch, "loss": total_loss / total_weight,
                          "validationLabelAgreementMacroF1": metrics["macroF1"]}), flush=True)
    checkpoint = output / "smoke_model.npz"
    np.savez_compressed(checkpoint, **{k: v.detach().numpy() for k, v in model.state_dict().items()})
    # Verify the checkpoint on train samples; no test predictions are generated.
    restored = build_model("residual_tcn")
    with np.load(checkpoint, allow_pickle=False) as archive:
        restored.load_state_dict({k: torch.from_numpy(archive[k].copy()) for k in archive.files})
    if not np.allclose(predict_logits(model, x[train_ids[:8]]), predict_logits(restored, x[train_ids[:8]])):
        raise ValueError("Checkpoint prediction mismatch")
    report = {"status": "PROVISIONAL_TRAINING_SMOKE_COMPLETED", "architecture": "residual_tcn",
        "seed": seed, "epochs": epochs, "featureVersion": FEATURE_VERSION,
        "manifestSha256": digest(manifest_path), "checkpointSha256": digest(checkpoint),
        "trainSamples": len(train_ids), "validationSamples": len(val_ids),
        "aiTrainSamples": sum(r["labelProvenance"] == "AI_VISUAL_TRIAGE" for r in rows),
        "adamSourceTrainSamples": sum(r.get("reviewStatus") == "SOURCE_SELECTED_BY_USER" for r in rows),
        "aiLossWeight": manifest["aiLossWeight"], "goldEligible": False, "productionEligible": False,
        "testEvaluated": False, "calibrationFitted": False, "checkpointRoundtripPassed": True,
        "history": history, "runtime": {"torch": torch.__version__, "numpy": np.__version__, "threads": 4},
        "sourceHashes": {name: digest(Path(__file__).parent / name) for name in
            ("train_provisional_smoke.py", "prepare_provisional_dataset.py", "pipeline/temporal_models.py")},
        "limitations": manifest["limitations"] + ["Three-epoch smoke training is not an ablation or accuracy claim.",
            "No calibrated inference policy; checkpoint is not an active worker model.",
            "Validation statistics measure agreement with unverified upstream labels."]}
    save(output / "report.json", report)
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--epochs", type=int, default=3)
    args = parser.parse_args()
    train(args.manifest, args.output, args.epochs)
