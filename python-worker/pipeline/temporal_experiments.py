"""Isolated training ablations; the released v1 model/feature contract stays frozen."""
import numpy as np
import torch
from torch import nn

from pipeline.temporal_models import ResidualTCN

VARIANTS = ("A0_baseline", "A1_source_sampler", "A2_pose_noise", "A3_auxiliary")


class AuxiliaryTCN(ResidualTCN):
    def __init__(self):
        super().__init__()
        self.family_head = nn.Linear(128, 3)
        self.side_head = nn.Linear(128, 2)

    def training_heads(self, x):
        hidden = self.layers(x.transpose(1, 2))
        pooled = torch.cat((hidden.mean(2), hidden.amax(2)), dim=1)
        return self.head(pooled), self.family_head(pooled), self.side_head(pooled)


def source_sampling_probabilities(targets, weights, sources, cap=3.):
    """Equal class mass; temper source concentration with a capped sqrt factor.

    Sample reliability is included here exactly once. The sampled batches use
    unweighted CE, not another class/reliability weight. Epoch length is unchanged.
    """
    targets, weights, sources = np.asarray(targets), np.asarray(weights), np.asarray(sources)
    if cap < 1 or not np.isfinite(weights).all() or (weights <= 0).any():
        raise ValueError("Invalid sampler weights/cap")
    result = np.zeros(len(targets), dtype=np.float64)
    for label in range(6):
        members = targets == label
        if not members.any():
            raise ValueError("Sampler needs all six classes")
        total = weights[members].sum()
        for source in np.unique(sources[members]):
            group = members & (sources == source)
            factor = min(cap, float(np.sqrt(total / weights[group].sum())))
            result[group] = weights[group] * factor
        result[members] /= result[members].sum() * 6
    return result / result.sum()


def augment_pose(features, generator, noise_std=.015, dropout_probability=.35):
    """Train-only perturbation in torso units, preserving missingness and labels."""
    n, t, _ = features.shape
    positions = features[..., :34].reshape(n, t, 17, 2).clone()
    mask = features[..., 68:].bool().clone()
    positions += torch.randn(positions.shape, generator=generator, dtype=positions.dtype) * noise_std
    for i in range(n):
        if torch.rand((), generator=generator).item() < dropout_probability:
            joint = (7, 8, 9, 10)[int(torch.randint(4, (), generator=generator))]
            length = min(t, int(torch.randint(2, 6, (), generator=generator)))
            start = int(torch.randint(t - length + 1, (), generator=generator))
            mask[i, start:start + length, joint] = False
    positions[~mask] = 0
    velocity = torch.zeros_like(positions)
    velocity[:, 1:] = positions[:, 1:] - positions[:, :-1]
    velocity[:, 1:][~(mask[:, 1:] & mask[:, :-1])] = 0
    return torch.cat((positions.flatten(2), velocity.flatten(2), mask.to(features.dtype)), dim=2)
