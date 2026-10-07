"""Recover source-labelled V6 clips using explicit frame IDs, never row offsets."""
import argparse
import json
from pathlib import Path

import numpy as np

from pipeline.boxing_research import LABELS, digest, pose_features, read_labels
from train_provisional_smoke import load_dataset


def recover(array, rows):
    if (array.ndim != 4 or array.shape[1:] != (1, 17, 3)
            or not np.issubdtype(array.dtype, np.number) or not np.isfinite(array).all()):
        raise ValueError("Expected finite frame-ID,x,y array [N,1,17,3]")
    ids = array[:, 0, :, 0]
    frame_ids = ids[:, 0]
    if (not np.equal(ids, frame_ids[:, None]).all()
            or not np.equal(frame_ids, np.floor(frame_ids)).all()
            or (frame_ids < 0).any() or (np.diff(frame_ids) <= 0).any()):
        raise ValueError("Frame IDs must be integer, consistent across joints and strictly increasing")
    features, accepted, rejected = [], [], []
    for row in rows:
        start, end = row['startFrame'], row['endFrame']
        if not row['validInterval']:
            rejected.append({'sourceRowId': row['id'], 'reason': 'INVALID_SOURCE_INTERVAL'})
            continue
        lo, hi = np.searchsorted(frame_ids, (start, end + 1))
        if not np.array_equal(frame_ids[lo:hi], np.arange(start, end + 1)):
            rejected.append({'sourceRowId': row['id'], 'reason': 'MISSING_SOURCE_FRAME_IDS'})
            continue
        try:
            feature = pose_features(array[lo:hi, 0, :, 1:])
        except ValueError as error:
            rejected.append({'sourceRowId': row['id'], 'reason': str(error)})
            continue
        features.append(feature)
        accepted.append({**row, 'sourceFrameCount': int(hi - lo)})
    if not features:
        raise ValueError('No complete annotated V6 intervals')
    return np.stack(features), accepted, rejected


def build(manifest_path, original, mirror, output):
    manifest, x, y, weights = load_dataset(manifest_path)
    if output.exists():
        raise ValueError('Use a new output directory')
    path = original / 'V6.npy'
    mirror_array = mirror / 'skeleton_data/V6.npy'
    annotations = mirror / 'clean_annotation_data/V6.csv'
    if digest(path) != digest(mirror_array):
        raise ValueError('Original/mirror V6 mismatch')
    source = np.load(path, allow_pickle=False)
    added, rows, rejected = recover(source, read_labels(annotations, allow_invalid_intervals=True))
    # This is an extension: retain every existing tensor, label and split exactly.
    samples = list(manifest['samples'])
    if any(s['sourceVideoId'] == 'V6' for s in samples):
        raise ValueError('V6 already present')
    seen = {__import__('hashlib').sha256(a.tobytes()).hexdigest() for a in x}
    for row, feature in zip(rows, added):
        if __import__('hashlib').sha256(feature.tobytes()).hexdigest() in seen:
            raise ValueError('V6 exact feature duplicate of existing data')
        samples.append({'sampleId': 'boxingvi_V6_' + row['id'], 'arrayIndex': len(samples),
            'sourceVideoId': 'V6', 'split': 'train', 'trainingLabel': row['technique'],
            'sourceRowId': row['id'], 'startFrame': row['startFrame'],
            'endFrameExclusive': row['endFrame'] + 1, 'sourceFrameCount': row['sourceFrameCount'],
            'sourceAnnotationSha256': digest(annotations), 'sourceSkeletonSha256': digest(path),
            'labelProvenance': 'UPSTREAM_IMPORTED_UNVERIFIED', 'lossWeight': 1.,
            'coachConfirmed': False, 'goldEligible': False})
    output.mkdir(parents=True)
    np.savez_compressed(output / 'features.npz', features=np.concatenate((x, added)),
        targets=np.r_[y, [LABELS.index(r['technique']) for r in rows]],
        loss_weights=np.r_[weights, np.ones(len(rows), dtype=weights.dtype)])
    audit = {'status': 'EXPLICIT_FRAME_ID_RECOVERY', 'sourceShape': list(source.shape),
        'originalSha256': digest(path), 'mirrorSha256': digest(mirror_array),
        'annotationSha256': digest(annotations), 'columnMeaning': ['source_frame_id', 'x', 'y'],
        'frameIdRange': [int(source[0, 0, 0, 0]), int(source[-1, 0, 0, 0])],
        'accepted': len(rows), 'rejected': rejected,
        'classes': {label: sum(r['technique'] == label for r in rows) for label in LABELS},
        'longerThan25Frames': sum(r['sourceFrameCount'] > 25 for r in rows),
        'resampling': 'Use complete source interval; v1 uniformly resamples to 25 steps, no truncation.',
        'frameConvention': 'Match source IDs verbatim; no conversion to decoded RGB indices asserted.',
        'coachConfirmed': False, 'productionEligible': False}
    result = {**manifest, 'samples': samples, 'featurePath': 'features.npz',
        'featureSha256': digest(output / 'features.npz'), 'parentManifestSha256': digest(manifest_path),
        'v6Recovery': audit, 'limitations': manifest['limitations'] + [
            'V6 has only four curved punch classes; it cannot independently validate all six.',
            'Source frame IDs are not confidence scores; pose confidence is unavailable.',
            'V6 labels are incomplete for continuous video: unlabelled gaps are not background.']}
    # Avoid stale historical summary counts copied from the parent manifest.
    for key in ('counts', 'splitCounts', 'summary'):
        result.pop(key, None)
    result['sampleCount'] = len(samples)
    result['upstreamSamples'] = manifest['upstreamSamples'] + len(rows)
    result['splitCounts'] = {s: sum(r['split'] == s for r in samples)
                              for s in ('train', 'validation', 'calibration', 'test')}
    result['extensionCodeSha256'] = digest(Path(__file__))
    (output / 'manifest.json').write_text(json.dumps(result, indent=2, allow_nan=False), encoding='utf-8')
    loaded, xx, yy, ww = load_dataset(output / 'manifest.json')
    np.testing.assert_array_equal(xx[:len(x)], x)
    np.testing.assert_array_equal(yy[:len(y)], y)
    np.testing.assert_array_equal(ww[:len(weights)], weights)
    return audit


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('manifest', 'original', 'mirror', 'output'):
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(build(args.manifest, args.original, args.mirror, args.output), indent=2))
