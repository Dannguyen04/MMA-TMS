import numpy as np
import pytest
import torch

from benchmark_temporal_models import select_threshold, selective_metrics
from pipeline.temporal_models import ARCHITECTURES, build_model, coco_adjacency


@pytest.mark.parametrize("architecture", ARCHITECTURES)
def test_models_have_finite_gradients_and_numeric_checkpoint_parity(architecture, tmp_path):
    torch.set_num_threads(2)
    torch.manual_seed(42)
    model = build_model(architecture)
    inputs = torch.randn(3, 25, 85)
    logits = model(inputs)
    assert logits.shape == (3, 6)
    torch.nn.functional.cross_entropy(logits, torch.tensor([0, 2, 4])).backward()
    assert all(p.grad is not None and torch.isfinite(p.grad).all() for p in model.parameters())
    path = tmp_path / "model.npz"
    np.savez_compressed(path, **{k: v.detach().numpy() for k, v in model.state_dict().items()})
    restored = build_model(architecture)
    with np.load(path, allow_pickle=False) as archive:
        restored.load_state_dict({k: torch.from_numpy(archive[k]) for k in archive.files})
    model.eval()
    restored.eval()
    torch.testing.assert_close(model(inputs), restored(inputs))


def test_graph_is_connected_and_neighbours_preserve_constants():
    adjacency = coco_adjacency()
    torch.testing.assert_close(adjacency.sum(-1), torch.ones(2, 17))
    reach = torch.eye(17)
    for _ in range(17): reach = reach + reach @ adjacency[1]
    assert (reach > 0).all()


def test_calibration_threshold_abstains_when_high_confidence_is_wrong():
    logits = np.tile([8., 0, 0, 0, 0, 0], (100, 1))
    targets = np.ones(100, dtype=int)
    policy = select_threshold(logits, targets, 1)
    assert policy["threshold"] is None
    result = selective_metrics(logits, targets, 1, policy)
    assert result["accepted"] == 0 and result["accuracyWhenAccepted"] is None
    assert result["classificationIncludingAbstentions"]["perClass"]["cross"]["recall"] == 0


def test_threshold_cannot_be_supported_by_a_few_easy_samples():
    logits = np.tile([8., 0, 0, 0, 0, 0], (10, 1))
    assert select_threshold(logits, np.zeros(10, dtype=int), 1)["threshold"] is None


def test_threshold_selected_on_calibration_is_not_refitted_on_evaluation():
    logits = np.tile([8., 0, 0, 0, 0, 0], (100, 1))
    policy = select_threshold(logits, np.zeros(100, dtype=int), 1)
    assert policy["threshold"] is not None
    evaluated = selective_metrics(logits, np.ones(100, dtype=int), 1, policy)
    assert evaluated["accepted"] == 100 and evaluated["accuracyWhenAccepted"] == 0
