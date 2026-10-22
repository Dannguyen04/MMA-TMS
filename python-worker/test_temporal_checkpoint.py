import json
from pathlib import Path

import numpy as np
import pytest
import torch

from pipeline.boxing_research import FEATURE_VERSION, LABELS, digest
from pipeline.temporal_checkpoint import load_temporal_checkpoint
from pipeline.temporal_models import build_model


def checkpoint(tmp_path):
    model = build_model("residual_tcn")
    np.savez_compressed(tmp_path / "model.npz", **{k: v.detach().numpy() for k, v in model.state_dict().items()})
    report = {"architecture": "residual_tcn", "mode": "research_only", "productionEligible": False,
              "featureVersion": FEATURE_VERSION, "labels": list(LABELS), "temperature": 1.2,
              "seed": 42, "bestEpoch": 1, "acceptancePolicy": {"threshold": None},
              "weightsSha256": digest(tmp_path / "model.npz")}
    (tmp_path / "report.json").write_text(json.dumps(report), encoding="utf-8")
    source = Path(__file__).resolve().parent
    configuration = {"sourceHashes": {name: digest(source / name) for name in
        ("pipeline/temporal_models.py", "pipeline/boxing_research.py", "train_boxing_research.py")}}
    (tmp_path / "configuration.json").write_text(json.dumps(configuration), encoding="utf-8")
    return model, report


def test_research_loader_preserves_predictions_and_policy(tmp_path):
    torch.set_num_threads(2)
    model, _ = checkpoint(tmp_path)
    model.eval()
    loaded, card = load_temporal_checkpoint(tmp_path)
    x = torch.randn(2, 25, 85)
    torch.testing.assert_close(model(x), loaded(x))
    assert card["productionEligible"] is False and card["acceptancePolicy"]["threshold"] is None
    assert card["modelAndFeatureSourceVerified"]


@pytest.mark.parametrize("field,value", [("productionEligible", True), ("featureVersion", "other"),
    ("weightsSha256", "0" * 64), ("temperature", 0), ("acceptancePolicy", {"threshold": 1.5})])
def test_loader_rejects_incompatible_or_modified_contract(tmp_path, field, value):
    _, report = checkpoint(tmp_path)
    report[field] = value
    (tmp_path / "report.json").write_text(json.dumps(report), encoding="utf-8")
    with pytest.raises(ValueError): load_temporal_checkpoint(tmp_path)


def test_external_classifier_uses_calibration_policy_and_keeps_public_confidence_null(monkeypatch):
    import evaluate_external_boxing as evaluator
    # These synthetic frames test contract behaviour, not model accuracy.
    points = [{"x": .5, "y": .5, "conf": .9} for _ in range(17)]
    for j in (5, 6): points[j] = {"x": .5, "y": .2, "conf": .9}
    frames = {i: {"observationKind": "fresh_detection", "landmarks": points} for i in range(5)}
    monkeypatch.setattr(evaluator, "predict_logits", lambda model, inputs: np.array([[10., 0, 0, 0, 0, 0]]))
    card = {"temperature": 1, "acceptancePolicy": {"threshold": None}}
    result = evaluator.classify_interval(frames, 0, 4, None, card)
    assert result["candidate"] == "jab" and result["technique"] == "unknown" and result["confidence"] is None
    card["acceptancePolicy"]["threshold"] = .9
    result = evaluator.classify_interval(frames, 0, 4, None, card)
    assert result["technique"] == "jab" and result["confidence"] is None


def test_loader_rejects_changed_forward_or_feature_code(tmp_path):
    checkpoint(tmp_path)
    path = tmp_path / "configuration.json"
    configuration = json.loads(path.read_text(encoding="utf-8"))
    configuration["sourceHashes"]["pipeline/temporal_models.py"] = "0" * 64
    path.write_text(json.dumps(configuration), encoding="utf-8")
    with pytest.raises(ValueError, match="source contract changed"):
        load_temporal_checkpoint(tmp_path)
