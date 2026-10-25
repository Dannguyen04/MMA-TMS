import copy
import json

import numpy as np
import pytest
import torch

from pipeline.boxing_research import LABELS, digest
from pipeline.temporal_experiments import AuxiliaryTCN, augment_pose, source_sampling_probabilities
from pipeline.temporal_models import build_model
from run_temporal_ablations import validate_folds, fit, summarize
from pipeline.temporal_experiments import VARIANTS


def test_sampler_balances_classes_tempers_sources_and_keeps_reliability_once():
    y = np.repeat(np.arange(6), 23)
    sources = np.tile(["large"] * 20 + ["small"] * 2 + ["weak"], 6)
    weights = np.ones(len(y))
    weights[0] = .25
    weights[sources == "weak"] = .25
    p = source_sampling_probabilities(y, weights, sources)
    np.testing.assert_allclose(np.bincount(y, weights=p), np.ones(6) / 6)
    assert p[0] / p[1] == pytest.approx(.25)
    c = y == 1
    old_small_share = weights[c & (sources == "small")].sum() / weights[c].sum()
    assert p[c & (sources == "small")].sum() / p[c].sum() > old_small_share
    assert p[c & (sources == "weak")].sum() / p[c].sum() < .1
    with pytest.raises(ValueError, match="six classes"):
        source_sampling_probabilities(np.array([0]), np.ones(1), np.array(["a"]))


def test_augmentation_preserves_missingness_and_masks_velocity_without_mutation():
    x = torch.ones(8, 25, 85)
    x[:, 8:12, 68 + 9] = 0
    x[:, 8:12, 18:20] = 0
    before = x.clone()
    a = augment_pose(x, torch.Generator().manual_seed(91), dropout_probability=1)
    b = augment_pose(x, torch.Generator().manual_seed(91), dropout_probability=1)
    torch.testing.assert_close(a, b)
    torch.testing.assert_close(x, before)
    mask = a[..., 68:].bool()
    positions, velocity = a[..., :34].reshape(8, 25, 17, 2), a[..., 34:68].reshape(8, 25, 17, 2)
    assert not mask[:, 8:12, 9].any()
    assert mask[..., [5, 6, 11, 12]].all()
    assert torch.isfinite(a).all() and (positions[~mask] == 0).all()
    assert (velocity[:, 0] == 0).all()
    valid = mask[:, 1:] & mask[:, :-1]
    assert (velocity[:, 1:][~valid] == 0).all()
    torch.testing.assert_close(velocity[:, 1:][valid], (positions[:, 1:] - positions[:, :-1])[valid])


def fold_fixture(tmp_path):
    rows = [{"sourceVideoId": s, "split": "train", "labelProvenance": "UPSTREAM_IMPORTED_UNVERIFIED"}
            for s in ("V1", "V2") for _ in LABELS]
    rows += [{"sourceVideoId": "adam", "split": "train", "labelProvenance": "UPSTREAM_IMPORTED_UNVERIFIED",
              "reviewStatus": "SOURCE_SELECTED_BY_USER", "sourceRowId": str(i)} for i in range(18)]
    manifest = {"samples": rows, "adamLabelPolicy": {"status": "SOURCE_SELECTED_BY_USER"}}
    path = tmp_path / "manifest.json"
    path.write_text(json.dumps(manifest))
    plan = {"manifestSha256": digest(path), "folds": [
        {"fold": i, "trainSources": [train, "adam"], "validationSources": [val],
         "trainSamples": 24, "validationSamples": 6,
         "trainClassCounts": dict.fromkeys(LABELS, 4), "validationClassCounts": dict.fromkeys(LABELS, 1)}
        for i, train, val in ((1, "V2", "V1"), (2, "V1", "V2"))]}
    return path, manifest, np.tile(np.arange(6), 5), plan


def test_fold_audit_rejects_leakage_changed_counts_and_missing_sources(tmp_path):
    path, manifest, targets, plan = fold_fixture(tmp_path)
    assert len(validate_folds(path, manifest, targets, plan)) == 2
    for mutation in ("leak", "counts", "missing", "duplicate", "calibration"):
        changed = copy.deepcopy(plan)
        if mutation == "leak":
            changed["folds"][0]["validationSources"].append("adam")
        elif mutation == "counts":
            changed["folds"][0]["trainSamples"] += 1
        elif mutation == "missing":
            changed["folds"].pop()
        elif mutation == "duplicate":
            changed["folds"].append(changed["folds"][0])
        else:
            changed["folds"][0]["validationSources"] = ["V5"]
        with pytest.raises(ValueError):
            validate_folds(path, manifest, targets, changed)


def test_auxiliary_heads_receive_gradients_and_export_matches_main_head(tmp_path):
    torch.set_num_threads(2)
    torch.manual_seed(123)
    model = AuxiliaryTCN()
    x = torch.randn(6, 25, 85)
    outputs = model.training_heads(x)
    sum(torch.nn.functional.cross_entropy(logits, torch.arange(6) % logits.shape[1]) for logits in outputs).backward()
    assert model.family_head.weight.grad.abs().sum() > 0
    assert model.side_head.weight.grad.abs().sum() > 0
    exported = build_model("residual_tcn")
    exported.load_state_dict({k: v for k, v in model.state_dict().items() if not k.startswith(("family_head.", "side_head."))})
    model.eval()
    exported.eval()
    torch.testing.assert_close(model(x), exported(x))
    data = x.detach().numpy()
    result = fit(data, np.arange(6), np.ones(6, dtype=np.float32), np.array(["s"] * 6),
                 "A3_auxiliary", 123, tmp_path / "fit", epochs=2, patience=0)
    assert result["checkpointRoundtripPassed"] and result["bestEpoch"] == 2
    assert "validation" not in result


def test_summary_weights_folds_equally_and_preserves_source_and_class_failures():
    runs = []
    for variant in VARIANTS:
        for fold, score, count in ((1, .9, 1000), (2, .3, 20), (3, .6, 200)):
            for seed in (1, 2, 3):
                runs.append({"variant": variant, "fold": fold, "seed": seed,
                    "validation": {"macroF1": score, "count": count,
                        "perClass": {label: {"f1": 0. if label == "rear_hook" else score,
                                              "recall": 0. if label == "rear_hook" else score} for label in LABELS}},
                    "perSource": {f"V{fold}": {"macroF1": score}}})
    result = summarize(runs)
    assert len(result) == 4
    for row in result:
        assert row["meanFoldMacroF1"] == pytest.approx(.6)
        assert row["worstSourceMeanMacroF1"] == pytest.approx(.3)
        assert row["perClassMeanFoldRecall"]["rear_hook"] == 0
        assert row["runs"] == 9


def test_cv_restores_best_epoch_instead_of_last_and_stops_early(tmp_path, monkeypatch):
    import run_temporal_ablations as runner
    monkeypatch.setattr(runner, "build_model", lambda _: torch.nn.Sequential(torch.nn.Flatten(), torch.nn.Linear(4, 6)))
    snapshots = []

    def predict(model, values):
        snapshots.append({k: v.detach().numpy().copy() for k, v in model.state_dict().items()})
        return np.zeros((len(values), 6))

    scores = iter([.9, .2, .1, .9, .9])
    monkeypatch.setattr(runner, "predict_logits", predict)
    monkeypatch.setattr(runner, "agreement", lambda *_: {"macroF1": next(scores)})
    x = np.arange(24, dtype=np.float32).reshape(6, 2, 2) / 24
    result = runner.fit(x, np.arange(6), np.ones(6, dtype=np.float32), np.array(["train"] * 6),
                        "A0_baseline", 19, tmp_path / "cv", epochs=10, patience=2,
                        vx=x[:2], vy=np.array([0, 1]), validation_sources=np.array(["heldout"] * 2))
    assert result["bestEpoch"] == 1 and result["epochsRun"] == 3
    assert any(not np.array_equal(snapshots[0][k], snapshots[2][k]) for k in snapshots[0])
    with np.load(tmp_path / "cv" / "model.npz", allow_pickle=False) as archive:
        for key in archive.files:
            np.testing.assert_array_equal(archive[key], snapshots[0][key])
