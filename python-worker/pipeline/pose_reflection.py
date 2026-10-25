"""Physical horizontal reflection with anatomical joint relabelling for COCO17.

This simulates the opposite stance: lead/rear punch identity stays unchanged.
It does NOT supervise which anatomical hand is the lead hand.
"""
import torch

SWAP = (0, 2, 1, 4, 3, 6, 5, 8, 7, 10, 9, 12, 11, 14, 13, 16, 15)


def reflect(features):
    if features.ndim != 3 or features.shape[-1] != 85:
        raise ValueError('Expected [batch,time,85] v1 features')
    result = features.clone()
    for start in (0, 34):
        xy = features[..., start:start + 34].reshape(*features.shape[:2], 17, 2)[..., SWAP, :].clone()
        xy[..., 0] *= -1
        result[..., start:start + 34] = xy.flatten(-2)
    result[..., 68:] = features[..., 68:][..., SWAP]
    return result


def random_reflection(features, generator):
    selected = torch.rand(len(features), generator=generator) < .5
    result = features.clone()
    result[selected] = reflect(features[selected])
    return result
