"""Prepare a diverse review queue from out-of-fold errors; never rewrite labels."""
import argparse
import json
from pathlib import Path

import numpy as np

from pipeline.boxing_research import LABELS, digest, softmax, read_labels
from train_provisional_smoke import load_dataset
from train_boxing_research import DATA_DEFAULT
from run_temporal_ablations import validate_folds


def build(manifest_path, plan_path, experiment, output, per_source=6):
    manifest, _, targets, _ = load_dataset(manifest_path)
    plan = json.loads(plan_path.read_text())
    configuration = json.loads((experiment / "configuration.json").read_text())
    selection = json.loads((experiment / "selection.json").read_text())
    if digest(manifest_path) != configuration["manifestSha256"] or digest(plan_path) != configuration["foldPlanSha256"]:
        raise ValueError("Experiment data/plan hash mismatch")
    rows, candidates = manifest["samples"], []
    inputs, annotations, annotation_hashes = {}, {}, {}
    for fold, _, vi in validate_folds(manifest_path, manifest, targets, plan):
        probabilities = []
        for seed in plan["fixedSeeds"]:
            path = experiment / f"{selection['variant']}_fold{fold}_seed{seed}" / "validation_predictions.npz"
            with np.load(path, allow_pickle=False) as archive:
                np.testing.assert_array_equal(archive["targets"], targets[vi])
                if archive["logits"].shape != (len(vi), 6) or not np.isfinite(archive["logits"]).all():
                    raise ValueError("Invalid CV predictions")
                probabilities.append(softmax(archive["logits"]))
            inputs[str(path.relative_to(experiment))] = digest(path)
        average = np.mean(probabilities, axis=0)
        for index, probs in zip(vi, average):
            predicted = int(probs.argmax())
            if predicted == int(targets[index]):
                continue
            row = rows[index]
            source = row["sourceVideoId"]
            annotation_path = DATA_DEFAULT / "clean_annotation_data" / f"{source}.csv"
            if source not in annotations:
                annotations[source] = {r["id"]: r for r in read_labels(annotation_path, allow_invalid_intervals=True)}
                annotation_hashes[source] = digest(annotation_path)
            source_row = row["sampleId"].rsplit("-row-", 1)[-1]
            annotation = annotations[source][source_row]
            if annotation["technique"] != row["trainingLabel"] or not annotation["validInterval"]:
                raise ValueError("Review sample differs from original annotation row")
            candidates.append({"sampleId": row["sampleId"], "sourceVideoId": row["sourceVideoId"],
                "arrayIndex": int(index), "fold": fold, "sourceLabel": row["trainingLabel"],
                "sourceAnnotationPath": str(annotation_path), "sourceRowId": source_row,
                "startFrame": annotation["startFrame"], "endFrameExclusive": annotation["endFrame"] + 1,
                "modelSuggestion": LABELS[predicted], "uncalibratedEnsembleScore": float(probs[predicted]),
                "reason": "OUT_OF_FOLD_DISAGREEMENT_WITH_SOURCE_LABEL", "reviewStatus": "PENDING_REVIEW",
                "coachConfirmed": False, "labelChanged": False})
    selected = []
    for source in sorted({r["sourceVideoId"] for r in candidates}):
        pending = sorted((r for r in candidates if r["sourceVideoId"] == source), key=lambda r: -r["uncalibratedEnsembleScore"])
        # First cover distinct source-label/prediction pairs, then fill the quota.
        rear = next((r for r in pending if r["sourceLabel"] == "rear_hook"), None)
        chosen = [rear] if rear is not None and per_source > 0 else []
        pairs = {(r["sourceLabel"], r["modelSuggestion"]) for r in chosen}
        for row in pending:
            pair = row["sourceLabel"], row["modelSuggestion"]
            if pair not in pairs and len(chosen) < per_source:
                chosen.append(row)
                pairs.add(pair)
        used = {r["sampleId"] for r in chosen}
        chosen += [r for r in pending if r["sampleId"] not in used][:max(0, per_source - len(chosen))]
        selected.extend(chosen)
    result = {"status": "REVIEW_QUEUE_ONLY", "variant": selection["variant"],
        "ranking": "At most six per source; include one rear-hook disagreement if available, then diverse confusion pairs ranked by uncalibrated score",
        "manifestSha256": digest(manifest_path), "selectionSha256": digest(experiment / "selection.json"),
        "predictionHashes": inputs, "annotationHashes": annotation_hashes,
        "scriptSha256": digest(Path(__file__)), "samples": selected,
        "disagreementsAcrossMirrorTrainingSources": len(candidates), "productionEligible": False,
        "limitations": ["Source labels remain authoritative; disagreements do not establish source errors.",
            "Scores are uncalibrated averages across three CV seeds, not verified confidence.",
            "Review the original RGB and source annotation mapping before adjudication; skeleton alone may be insufficient.",
            "Adam is excluded from CV review and its original labels remain unchanged."]}
    with output.open("x", encoding="utf-8") as stream:
        json.dump(result, stream, indent=2, allow_nan=False)
    print(json.dumps({"queued": len(selected), "candidateDisagreements": len(candidates)}))
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--fold-plan", type=Path, required=True)
    parser.add_argument("--experiment", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    build(args.manifest, args.fold_plan, args.experiment, args.output)
