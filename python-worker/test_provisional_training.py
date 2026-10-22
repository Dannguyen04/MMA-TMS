import numpy as np
import pytest
import torch

import train_provisional_model as trainer


def test_weak_label_loss_and_gradient_are_downweighted():
    logits = torch.zeros((2, 6), requires_grad=True)
    targets = torch.tensor([0, 0])
    loss, mass = trainer.weighted_loss(logits, targets, torch.tensor([1., .25]), torch.ones(6))
    loss.backward()
    assert float(mass) == 1.25
    assert float(loss.detach()) == pytest.approx(np.log(6))
    torch.testing.assert_close(logits.grad[1], logits.grad[0] * .25)
    weights = trainer.class_balanced_weights(np.array([0, 0, 1, 2, 3, 4, 5]), np.array([1., .25, 1, 1, 1, 1, 1]))
    assert weights[0] * 1.25 == pytest.approx(weights[1])
    with pytest.raises(ValueError, match="Missing training classes"):
        trainer.class_balanced_weights(np.array([0]), np.array([1.]))


def test_best_epoch_restored_and_early_stop_uses_validation(tmp_path, monkeypatch):
    # A later epoch is worse: the serialized weights must come from epoch one.
    monkeypatch.setattr(trainer, "build_model", lambda _: torch.nn.Sequential(torch.nn.Flatten(), torch.nn.Linear(4, 6)))
    snapshots = []

    def predict(model, values):
        snapshots.append({k: v.detach().numpy().copy() for k, v in model.state_dict().items()})
        return np.zeros((len(values), 6))

    scores = iter([.8, .2, .1, .8])
    monkeypatch.setattr(trainer, "predict_logits", predict)
    monkeypatch.setattr(trainer, "agreement", lambda *_: {"macroF1": next(scores)})
    x = np.arange(24, dtype=np.float32).reshape(6, 2, 2) / 24
    result = trainer.train_one(x, np.arange(6), np.ones(6, dtype=np.float32), x[:2], np.array([0, 1]),
                               123, tmp_path / "run", epochs=10, patience=2)
    assert result["bestEpoch"] == 1 and result["epochsRun"] == 3
    assert any(not np.array_equal(snapshots[0][k], snapshots[2][k]) for k in snapshots[0])
    with np.load(tmp_path / "run" / "model.npz", allow_pickle=False) as archive:
        for key in archive.files:
            np.testing.assert_array_equal(archive[key], snapshots[0][key])
            np.testing.assert_array_equal(archive[key], snapshots[-1][key])
