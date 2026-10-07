"""Paired AlphaPose/YOLO source-label diagnostics, keeping both frame offsets."""
import argparse
import json
from pathlib import Path

import numpy as np
import torch

from pipeline.boxing_research import LABELS, digest, classification_metrics
from pipeline.temporal_checkpoint import load_temporal_checkpoint
from train_boxing_research import predict_logits
from train_provisional_smoke import load_dataset
from recognize_boxing_video import decide


def run(bridge, manifest_path, checkpoint, output):
    report = json.loads((bridge / 'report.json').read_text())
    if digest(bridge / 'features.npz') != report['featureSha256']:
        raise ValueError('Bridge features changed')
    manifest, x, y, _ = load_dataset(manifest_path)
    rows = manifest['samples']
    # Original research rows use IDs ending in source row index; inspect through
    # the original research-sample ledger rather than guessing that ID format.
    mirror = Path('test_results/external/boxe_ml/96f3a7d0716040682381fb63f80afac96f74cfa6')
    from pipeline.boxing_research import read_labels, pose_features
    with np.load(bridge / 'features.npz', allow_pickle=False) as archive:
        fx = archive['features'].copy()
    model, card = load_temporal_checkpoint(checkpoint)
    predictions, original_arrays, annotations = [], {}, {}
    for sample in report['samples']:
        source, row = sample['source'], sample['rowId']
        if source not in original_arrays:
            path = mirror / 'skeleton_data' / (source + '.npy')
            label_path = mirror / 'clean_annotation_data' / (source + '.csv')
            if (digest(path) != report['videos'][source]['skeletonSha256'] or
                    digest(label_path) != report['videos'][source]['annotationSha256']):
                raise ValueError('Source bridge contract changed')
            original_arrays[source] = np.load(path, allow_pickle=False)
            annotations[source] = read_labels(label_path, allow_invalid_intervals=True)
        array = original_arrays[source]
        annotation = annotations[source][row]
        if annotation['technique'] != sample['label']:
            raise ValueError('Source row label changed')
        if source == 'V6':
            lo, hi = np.searchsorted(array[:, 0, 0, 0], (annotation['startFrame'], annotation['endFrame'] + 1))
            upstream = pose_features(array[lo:hi, 0, :, 1:])
        else:
            upstream = pose_features(array[row])
        original = decide(upstream, model, card)
        result = (decide(fx[sample['featureIndex']], model, card) if 'featureIndex' in sample else
                  {'technique': 'unknown', 'reason': sample['rejectionReason']})
        predictions.append({**sample, 'upstream': original, 'yolo': result})
    summaries = []
    for source in report['videos']:
        for offset in report['decodedFrameOffsets']:
            selected = [r for r in predictions if r['source'] == source and r['decodedFrameOffset'] == offset]
            item = {'source': source, 'offset': offset, 'count': len(selected),
                    'medianJointError': float(np.median([r['medianJointErrorImageCoordinates'] for r in selected
                                                       if r['medianJointErrorImageCoordinates'] is not None]))}
            for kind in ('upstream', 'yolo'):
                metrics = classification_metrics([r['label'] for r in selected],
                    [r[kind].get('candidateTechnique', 'unknown') for r in selected])
                accepted = [r for r in selected if r[kind]['technique'] != 'unknown']
                item[kind] = {'raw': metrics, 'accepted': len(accepted),
                    'acceptedCorrect': sum(r[kind]['technique'] == r['label'] for r in accepted),
                    'coverage': len(accepted) / len(selected),
                    'withAbstention': classification_metrics([r['label'] for r in selected], [r[kind]['technique'] for r in selected])}
            summaries.append(item)
    result = {'status': 'PAIRED_POSE_DIAGNOSTIC', 'model': card, 'summaries': summaries,
        'bridgeReportSha256': digest(bridge / 'report.json'), 'codeSha256': digest(Path(__file__)),
        'manifestSha256': digest(manifest_path), 'samples': predictions, 'productionEligible': False,
        'limitations': report['limitations'] + ['Selected rows are a small diagnostic sample, not an accuracy estimate.',
            'The two offsets reuse each source row; do not count them as independent samples.',
            'Abstention here tests probability/reflection gates; full video has additional per-joint quality gates.']}
    with output.open('x', encoding='utf-8') as stream:
        json.dump(result, stream, indent=2, allow_nan=False)
    print(json.dumps([{k: v for k, v in s.items() if k not in ('upstream', 'yolo')} |
        {name: {'accuracy': s[name]['raw']['accuracy'], 'accepted': s[name]['accepted'], 'correct': s[name]['acceptedCorrect']}
         for name in ('upstream', 'yolo')} for s in summaries], indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('bridge', 'manifest', 'checkpoint', 'output'):
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    torch.set_num_threads(2)
    run(args.bridge, args.manifest, args.checkpoint, args.output)
