"""Small offline research baselines; not reproductions of published benchmarks.

All models consume the same [batch,time,85] position/velocity/mask tensor. The
graph variant uses COCO-17 self and undirected-neighbour partitions, not the
original ST-GCN spatial-configuration partition or published weights.
"""
from __future__ import annotations

import torch
from torch import nn

COCO_EDGES = ((0, 1), (0, 2), (1, 3), (2, 4), (0, 5), (0, 6),
              (5, 6), (5, 7), (7, 9), (6, 8), (8, 10), (5, 11),
              (6, 12), (11, 12), (11, 13), (13, 15), (12, 14), (14, 16))


def coco_adjacency():
    neighbours = torch.zeros(17, 17)
    for a, b in COCO_EDGES:
        neighbours[a, b] = neighbours[b, a] = 1
    neighbours = neighbours / neighbours.sum(dim=1, keepdim=True).clamp_min(1)
    return torch.stack((torch.eye(17), neighbours))


class TemporalResidual(nn.Module):
    def __init__(self, channels, dilation):
        super().__init__()
        self.layers = nn.Sequential(
            nn.Conv1d(channels, channels, 3, padding=dilation, dilation=dilation),
            nn.GroupNorm(8, channels), nn.ReLU(), nn.Dropout(.2),
            nn.Conv1d(channels, channels, 3, padding=dilation, dilation=dilation),
            nn.GroupNorm(8, channels), nn.ReLU(), nn.Dropout(.2))

    def forward(self, x):
        return torch.relu(x + self.layers(x))


class ResidualTCN(nn.Module):
    def __init__(self, classes=6):
        super().__init__()
        self.layers = nn.Sequential(nn.Conv1d(85, 64, 1),
                                    *(TemporalResidual(64, d) for d in (1, 2, 4)))
        self.head = nn.Linear(128, classes)

    def forward(self, x):
        x = self.layers(x.transpose(1, 2))
        return self.head(torch.cat((x.mean(2), x.amax(2)), dim=1))


class GraphTemporalBlock(nn.Module):
    def __init__(self, incoming, outgoing, dilation):
        super().__init__()
        self.register_buffer("adjacency", coco_adjacency())
        self.spatial = nn.ModuleList([nn.Conv2d(incoming, outgoing, 1) for _ in range(2)])
        self.temporal = nn.Sequential(nn.GroupNorm(8, outgoing), nn.ReLU(),
            nn.Conv2d(outgoing, outgoing, (3, 1), padding=(dilation, 0), dilation=(dilation, 1)),
            nn.GroupNorm(8, outgoing), nn.Dropout(.2))
        self.skip = nn.Conv2d(incoming, outgoing, 1) if incoming != outgoing else nn.Identity()

    def forward(self, x):
        spatial = sum(conv(torch.matmul(x, adj.T)) for conv, adj in zip(self.spatial, self.adjacency))
        return torch.relu(self.temporal(spatial) + self.skip(x))


class SmallSTGCN(nn.Module):
    def __init__(self, classes=6):
        super().__init__()
        self.layers = nn.Sequential(GraphTemporalBlock(5, 32, 1),
                                    GraphTemporalBlock(32, 32, 2), GraphTemporalBlock(32, 64, 4))
        # Preserve joint identity (global joint pooling loses lead/rear cues).
        self.head = nn.Sequential(nn.Linear(64 * 17, 128), nn.ReLU(), nn.Dropout(.3), nn.Linear(128, classes))

    def forward(self, x):
        n, t, _ = x.shape
        nodes = torch.cat((x[..., :34].reshape(n, t, 17, 2),
                           x[..., 34:68].reshape(n, t, 17, 2), x[..., 68:, None]), dim=-1)
        hidden = self.layers(nodes.permute(0, 3, 1, 2))
        return self.head(hidden.mean(2).flatten(1))


def build_model(name):
    if name == "legacy_tcn":
        from train_boxing_research import PoseTCN
        return PoseTCN()
    if name == "residual_tcn":
        return ResidualTCN()
    if name == "small_stgcn":
        return SmallSTGCN()
    raise ValueError(f"Unsupported architecture: {name}")


ARCHITECTURES = ("legacy_tcn", "residual_tcn", "small_stgcn")
