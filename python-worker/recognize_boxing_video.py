"""Local six-punch video trial with explicit abstention; no coaching scores.

This research CLI does not promote a model to the live worker. Candidate event
detection is still heuristic; missed events are not counted as correct abstentions.
"""
import argparse
from collections import Counter
import json
from pathlib import Path

import numpy as np
import torch

from pipeline.boxing_research import LABELS, digest, pose_features, softmax
from pipeline.pose_reflection import reflect
from pipeline.strike_events import detect_punch_events
from pipeline.temporal_checkpoint import load_temporal_checkpoint
from prepare_provisional_dataset import extract_video_pose
from train_boxing_research import predict_logits


def decide(features, model, card):
    values = np.concatenate((features[None], reflect(torch.from_numpy(features[None])).numpy()))
    probabilities = softmax(predict_logits(model, values), card['temperature'])
    predictions = probabilities.argmax(1)
    candidate = LABELS[int(predictions[0])]
    threshold = card['acceptancePolicy']['threshold']
    reason = ('NO_SUPPORTED_CALIBRATION_THRESHOLD' if threshold is None else
              'REFLECTION_DISAGREEMENT' if predictions[0] != predictions[1] else
              'LOW_RESEARCH_PROBABILITY' if float(probabilities.max(1).min()) < threshold else
              'RESEARCH_GATES_PASSED')
    return {'technique': candidate if reason == 'RESEARCH_GATES_PASSED' else 'unknown',
        'candidateTechnique': candidate, 'reason': reason, 'confidence': None,
        'researchProbability': float(probabilities[0].max()),
        'reflectedCandidate': LABELS[int(predictions[1])],
        'reviewRequired': reason != 'RESEARCH_GATES_PASSED'}


def classify(frames, start, end, model, card):
    def reject(reason):
        return {'technique': 'unknown', 'reason': reason, 'confidence': None, 'reviewRequired': True}
    selected = [frames.get(i) for i in range(start, end + 1)]
    if len(selected) < 3 or any(f is None or f.get('observationKind') != 'fresh_detection'
            or f.get('isDiscontinuous') for f in selected):
        return reject('MISSING_OR_DISCONTINUOUS_POSE')
    if any(len(f.get('landmarks', [])) != 17 for f in selected):
        return reject('MISSING_LANDMARKS')
    try:
        points = np.array([[[p['x'], p['y'], p['conf']] for p in f['landmarks']] for f in selected], dtype=np.float32)
    except (KeyError, TypeError, ValueError):
        return reject('INVALID_POSE')
    if not np.isfinite(points).all():
        return reject('INVALID_POSE')
    # Engineering evidence gate, not a learned confidence or accuracy guarantee.
    coverage = (points[..., 2] >= .3).mean(0)
    if coverage[[5, 6, 7, 8, 9, 10, 11, 12]].min() < .8:
        return reject('LOW_ARM_OR_TORSO_COVERAGE')
    xy = points[..., :2].copy()
    xy[points[..., 2] < .3] = 0
    try:
        feature = pose_features(xy)
    except ValueError as error:
        return reject(str(error))
    return decide(feature, model, card)


def run(video, checkpoint, output, pose_cache=None, training_mode='shadow_boxing'):
    if output.exists():
        raise ValueError('Use a new output directory')
    used_cache = pose_cache is not None
    model, card = load_temporal_checkpoint(checkpoint)
    video_hash = digest(video)
    model_hash = digest(Path('yolov8n-pose.pt'))
    if pose_cache is not None:
        document = json.loads(pose_cache.read_text(encoding='utf-8'))
        if (document.get('meta', {}).get('sourceVideoSha256') != video_hash
                or document['meta'].get('modelSha256') != model_hash):
            raise ValueError('Pose cache does not match video and pose weights')
    output.mkdir(parents=True)
    if pose_cache is None:
        pose_cache = output / 'pose.json'
        document = extract_video_pose(video, pose_cache)
    meta, frames = document['meta'], document['frames']
    if (meta['decodedFrames'] != len(frames) or not frames
            or [f['frameIdx'] for f in frames] != list(range(len(frames)))):
        raise ValueError('Expected complete sequential frame cache')
    detector = detect_punch_events(frames, meta['fps'], training_mode=training_mode,
                                   aspect=meta['width'] / meta['height'])
    mapping = {f['frameIdx']: f for f in frames}
    events = [{**event, **classify(mapping, event['startFrame'], event['endFrame'], model, card)}
              for event in detector['events']]
    report = {'status': 'LOCAL_RESEARCH_TRIAL', 'productionEligible': False,
        'video': str(video.resolve()), 'videoSha256': video_hash, 'poseSha256': digest(pose_cache),
        'poseCacheUsed': used_cache, 'poseGeneratingCodeVerified': not used_cache,
        'classifier': card, 'fps': meta['fps'], 'decodedFrames': len(frames),
        'classificationPolicy': {'poseJointConfidenceFloor': .3, 'minPerArmTorsoJointCoverage': .8,
            'reflectionAgreementRequired': True, 'probabilityPolicy': 'Both views must pass the V5 calibration threshold'},
        'events': events, 'counts': dict(Counter(e['technique'] for e in events)),
        'candidateCount': len(events), 'abstainedCandidates': sum(e['technique'] == 'unknown' for e in events),
        'detector': {k: v for k, v in detector.items() if k != 'events'},
        'sourceHashes': {p: digest(Path(p)) for p in ('recognize_boxing_video.py', 'pipeline/pose_reflection.py',
            'pipeline/strike_events.py', 'prepare_provisional_dataset.py', 'person_tracker.py')},
        'limitations': ['Candidate count is not true punch count; missed events are unmeasured.',
            'Reflection consistency and high softmax do not prove correctness or out-of-domain safety.',
            'This stricter abstention policy needs independent precision/recall and coverage evaluation.',
            'No scores, technique-quality assessment or coach approval are generated.']}
    (output / 'result.json').write_text(json.dumps(report, indent=2, allow_nan=False), encoding='utf-8')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('video', 'checkpoint', 'output'):
        parser.add_argument('--' + name, type=Path, required=True)
    parser.add_argument('--pose-cache', type=Path)
    parser.add_argument('--training-mode', choices=('shadow_boxing', 'heavy_bag'), default='shadow_boxing')
    args = parser.parse_args()
    torch.set_num_threads(2)
    result = run(args.video, args.checkpoint, args.output, args.pose_cache, args.training_mode)
    print(json.dumps({'candidateCount': result['candidateCount'], 'counts': result['counts'], 'productionEligible': False}))
