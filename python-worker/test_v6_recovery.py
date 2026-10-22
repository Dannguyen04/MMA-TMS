import numpy as np
import pytest
import torch

from recover_boxingvi_v6 import recover
from pipeline.pose_reflection import reflect, random_reflection, SWAP


def source(ids):
    result = np.ones((len(ids), 1, 17, 3), dtype=float) * .4
    result[:, 0, :, 0] = np.array(ids)[:, None]
    result[:, 0, [5, 6], 2] = .2
    result[:, 0, [11, 12], 2] = .6
    return result


def row(start, end):
    return dict(id='0', startFrame=start, endFrame=end, validInterval=True, technique='lead_hook')


def test_ids_not_offsets_and_missing_interval_rejected():
    a = source([157, 158, 159, 161, 162, 163])
    x, accepted, rejected = recover(a, [row(157, 159), {**row(159, 163), 'id': '1'}])
    assert x.shape == (1, 25, 85)
    assert accepted[0]['startFrame'] == 157
    assert rejected == [{'sourceRowId': '1', 'reason': 'MISSING_SOURCE_FRAME_IDS'}]


@pytest.mark.parametrize('damage', ['duplicate', 'fractional', 'joint_mismatch', 'nan'])
def test_reject_bad_frame_id_schema(damage):
    a = source([157, 158, 159])
    if damage == 'duplicate': a[1, 0, :, 0] = 157
    if damage == 'fractional': a[1, 0, :, 0] = 158.5
    if damage == 'joint_mismatch': a[1, 0, 4, 0] = 159
    if damage == 'nan': a[1, 0, 4, 1] = np.nan
    with pytest.raises(ValueError): recover(a, [row(157, 159)])


def test_reflection_involution_velocities_masks_and_no_mutation():
    x = torch.arange(2 * 25 * 85).reshape(2, 25, 85).float()
    original = x.clone()
    y = reflect(x)
    torch.testing.assert_close(reflect(y), x)
    torch.testing.assert_close(x, original)
    assert y[0, 0, 18] == -x[0, 0, 20]  # left wrist <- reflected right
    assert y[0, 0, 19] == x[0, 0, 21]
    assert y[0, 0, 52] == -x[0, 0, 54]  # same velocity transform
    torch.testing.assert_close(y[..., 68:], x[..., 68:][..., SWAP])
    a = random_reflection(x, torch.Generator().manual_seed(5))
    b = random_reflection(x, torch.Generator().manual_seed(5))
    torch.testing.assert_close(a, b)
