"""Numeric, checksum-verified loading of local research benchmark checkpoints."""
import json
from pathlib import Path

import numpy as np
import torch

from pipeline.boxing_research import FEATURE_VERSION, LABELS, digest
from pipeline.temporal_models import ARCHITECTURES, build_model


def load_temporal_checkpoint(directory: Path):
    report_path = directory / "report.json"
    report = json.loads(report_path.read_text(encoding="utf-8"))
    if (report.get("mode") != "research_only" or report.get("productionEligible") is not False
            or report.get("featureVersion") != FEATURE_VERSION or report.get("labels") != list(LABELS)
            or report.get("architecture") not in ARCHITECTURES):
        raise ValueError("Unsupported research checkpoint contract")
    temperature = report.get("temperature")
    if (isinstance(temperature, bool) or not isinstance(temperature, (int, float))
            or not np.isfinite(temperature) or temperature <= 0):
        raise ValueError("Invalid checkpoint temperature")
    policy = report.get("acceptancePolicy")
    if not isinstance(policy, dict) or "threshold" not in policy:
        raise ValueError("Missing research acceptance policy")
    threshold = policy["threshold"]
    if threshold is not None and (isinstance(threshold, bool) or not isinstance(threshold, (int, float))
                                  or not np.isfinite(threshold) or not 0 <= threshold <= 1):
        raise ValueError("Invalid research acceptance threshold")
    # State shapes alone cannot detect a changed forward pass or preprocessing.
    # Accept the parent benchmark configuration, or a copy beside an exported run.
    configuration_path = directory.parent / "configuration.json"
    if not configuration_path.is_file():
        configuration_path = directory / "configuration.json"
    if not configuration_path.is_file():
        raise ValueError("Missing benchmark configuration and source hashes")
    configuration = json.loads(configuration_path.read_text(encoding="utf-8"))
    source_root = Path(__file__).resolve().parents[1]
    for name in ("pipeline/temporal_models.py", "pipeline/boxing_research.py", "train_boxing_research.py"):
        if configuration.get("sourceHashes", {}).get(name) != digest(source_root / name):
            raise ValueError(f"Checkpoint source contract changed: {name}")
    weights = directory / "model.npz"
    if digest(weights) != report.get("weightsSha256"):
        raise ValueError("Model checksum mismatch")
    model = build_model(report["architecture"])
    with np.load(weights, allow_pickle=False) as archive:
        state = {}
        for key in archive.files:
            value = archive[key]
            if not np.issubdtype(value.dtype, np.number) or not np.isfinite(value).all():
                raise ValueError("Checkpoint contains non-finite or non-numeric weights")
            state[key] = torch.from_numpy(value)
        model.load_state_dict(state, strict=True)
    model.eval()
    card = {key: report[key] for key in ("architecture", "seed", "bestEpoch", "mode", "productionEligible",
                                        "featureVersion", "labels", "temperature", "weightsSha256", "acceptancePolicy")}
    card["reportSha256"] = digest(report_path)
    card["configurationSha256"] = digest(configuration_path)
    card["modelAndFeatureSourceVerified"] = True
    return model, card
