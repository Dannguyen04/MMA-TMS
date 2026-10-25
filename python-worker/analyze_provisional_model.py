"""Read-only diagnostics for a frozen provisional checkpoint; never select/tune it."""
import argparse
from collections import Counter, defaultdict
import hashlib
import json
from pathlib import Path

import numpy as np
import torch

from pipeline.boxing_research import LABELS, digest, classification_metrics, softmax
from pipeline.temporal_checkpoint import load_temporal_checkpoint
from train_boxing_research import predict_logits
from train_provisional_smoke import load_dataset


def analyze(manifest_path, checkpoint, output):
    manifest, x, y, weights = load_dataset(manifest_path)
    model, card = load_temporal_checkpoint(checkpoint)
    original_report = json.loads((checkpoint / "report.json").read_text())
    if original_report["manifestSha256"] != digest(manifest_path):
        raise ValueError("Checkpoint belongs to another dataset")
    torch.set_num_threads(4)
    probabilities = softmax(predict_logits(model, x), card["temperature"])
    predictions, confidence = probabilities.argmax(1), probabilities.max(1)
    rows = manifest["samples"]
    family = np.array([0, 0, 1, 1, 2, 2])
    side = np.array([0, 1, 0, 1, 0, 1])
    threshold = card["acceptancePolicy"]["threshold"]

    def describe(indices):
        ix = np.array(indices, dtype=int)
        correct = predictions[ix] == y[ix]
        accepted = np.zeros(len(ix), dtype=bool) if threshold is None else confidence[ix] >= threshold
        families_correct = family[predictions[ix]] == family[y[ix]]
        arm_correct = side[predictions[ix]] == side[y[ix]]
        confusion = Counter((LABELS[int(a)], LABELS[int(b)]) for a, b in zip(y[ix], predictions[ix]) if a != b)
        return {**classification_metrics([LABELS[int(i)] for i in y[ix]], [LABELS[int(i)] for i in predictions[ix]]),
            "accepted": int(accepted.sum()), "acceptedCorrect": int((accepted & correct).sum()),
            "familyAccuracy": float(families_correct.mean()), "leadRearAccuracy": float(arm_correct.mean()),
            "wrongFamily": int((~families_correct).sum()), "sameFamilyWrongSide": int((families_correct & ~arm_correct).sum()),
            "meanStoredMask": float(x[ix, :, 68:].mean()),
            "meanStoredLeftWristMask": float(x[ix, :, 68 + 9].mean()),
            "meanStoredRightWristMask": float(x[ix, :, 68 + 10].mean()),
            "confusions": [{"truth": a, "prediction": b, "count": n} for (a, b), n in confusion.most_common()]}

    split_ids = {s: [i for i, r in enumerate(rows) if r["split"] == s] for s in ("train", "validation", "calibration", "test")}
    source_ids = {s: [i for i, r in enumerate(rows) if r["sourceVideoId"] == s] for s in sorted({r["sourceVideoId"] for r in rows})}
    train_ids = np.array(split_ids["train"])
    class_mass = np.bincount(y[train_ids], weights=weights[train_ids], minlength=len(LABELS))
    class_weight = weights[train_ids].sum() / (len(LABELS) * class_mass)
    effective_mass = weights * class_weight[y]
    total_mass = effective_mass[train_ids].sum()
    by_source = {}
    for source, ids in source_ids.items():
        split = rows[ids[0]]["split"]
        by_source[source] = {"split": split, "classCounts": dict(Counter(rows[i]["trainingLabel"] for i in ids)),
            "sampleWeightSum": float(weights[ids].sum()),
            "globalEffectiveTrainingWeightShare": float(effective_mass[ids].sum() / total_mass) if split == "train" else None,
            **describe(ids)}
    fingerprints = defaultdict(list)
    for i, values in enumerate(x):
        fingerprints[hashlib.sha256(values.tobytes()).hexdigest()].append(i)
    duplicates = [ids for ids in fingerprints.values() if len(ids) > 1]
    conflicting = [ids for ids in duplicates if len(set(y[ids])) > 1]
    cross_split = [ids for ids in duplicates if len({rows[i]["split"] for i in ids}) > 1]
    result = {"mode": "frozen_checkpoint_diagnostics", "productionEligible": False,
        "manifestSha256": digest(manifest_path), "weightsSha256": card["weightsSha256"],
        "analysisSourceSha256": digest(Path(__file__)), "bySource": by_source,
        "bySplit": {s: describe(ids) for s, ids in split_ids.items()},
        "exactDuplicateFeatureGroups": len(duplicates), "exactDuplicateFeatureSamples": sum(map(len, duplicates)),
        "conflictingLabelDuplicateGroups": len(conflicting), "crossSplitDuplicateGroups": len(cross_split),
        "duplicateGroupSampleIds": [[rows[i]["sampleId"] for i in ids] for ids in duplicates],
        "limitations": ["Training-source agreement measures fit, not generalization.",
            "All truth labels are source/provisional labels, not independently coach-confirmed.",
            "Stored masks in mirror and YOLO have different provenance; mask=1 does not prove keypoint correctness.",
            "Weight shares normalize the global objective; random per-batch normalization and model gradients can differ.",
            "Exact feature duplicate check does not rule out near duplicates or shared fighters.",
            "Family/side analysis maps existing labels, it does not verify stance or train a hierarchical classifier."]}
    # Independently confirm the aggregate reproduces the frozen report.
    for split, key in (("validation", "validation"), ("calibration", "calibration"), ("test", "observedTestDiagnostic")):
        if key in original_report["metrics"]:
            for metric in ("accuracy", "macroF1"):
                np.testing.assert_allclose(result["bySplit"][split][metric], original_report["metrics"][key][metric], atol=1e-12)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("x", encoding="utf-8") as stream:
        json.dump(result, stream, indent=2, allow_nan=False)
    print(json.dumps({"bySource": {s: {k: r[k] for k in ("count", "accuracy", "macroF1", "globalEffectiveTrainingWeightShare", "meanStoredLeftWristMask", "meanStoredRightWristMask")} for s, r in by_source.items()},
                      "diagnostic": {k: result["bySplit"]["test"][k] for k in ("familyAccuracy", "leadRearAccuracy", "wrongFamily", "sameFamilyWrongSide", "confusions")},
                      "duplicateGroups": len(duplicates), "crossSplitDuplicateGroups": len(cross_split)}, indent=2))
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--checkpoint", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    analyze(args.manifest, args.checkpoint, args.output)
