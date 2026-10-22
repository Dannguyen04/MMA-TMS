import numpy as np
import torch

from recognize_boxing_video import decide, classify


class Dummy(torch.nn.Module):
    def __init__(self, disagreement=False):
        super().__init__()
        self.disagreement = disagreement

    def forward(self, x):
        result = torch.zeros(len(x), 6)
        result[:, 0] = 5.
        if self.disagreement: result[1, 1] = 10.
        return result


def card(threshold):
    return {'temperature': 1., 'acceptancePolicy': {'threshold': threshold}}


def test_abstain_when_policy_has_no_supported_threshold():
    result = decide(np.zeros((25, 85), dtype=np.float32), Dummy(), card(None))
    assert result['technique'] == 'unknown'
    assert result['reason'] == 'NO_SUPPORTED_CALIBRATION_THRESHOLD'


def test_abstain_on_reflection_disagreement_even_with_high_probability():
    result = decide(np.zeros((25, 85), dtype=np.float32), Dummy(True), card(.5))
    assert result['researchProbability'] > .95
    assert result['technique'] == 'unknown'
    assert result['reason'] == 'REFLECTION_DISAGREEMENT'


def test_no_unearned_confidence_and_probability_threshold_enforced():
    x = np.zeros((25, 85), dtype=np.float32)
    assert decide(x, Dummy(), card(.999))['technique'] == 'unknown'
    result = decide(x, Dummy(), card(.9))
    assert result['technique'] == 'jab'
    assert result['confidence'] is None


def test_missing_pose_and_wrist_cannot_get_label():
    assert classify({}, 0, 3, Dummy(), card(.5))['technique'] == 'unknown'
    frames = {i: {'observationKind': 'fresh_detection', 'isDiscontinuous': False,
                  'landmarks': [{'x': .5, 'y': .5, 'conf': 1.} for _ in range(17)]} for i in range(4)}
    for f in frames.values(): f['landmarks'][9]['conf'] = .1
    assert classify(frames, 0, 3, Dummy(), card(.5))['reason'] == 'LOW_ARM_OR_TORSO_COVERAGE'
