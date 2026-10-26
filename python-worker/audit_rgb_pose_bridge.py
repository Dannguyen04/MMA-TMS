"""Compare deterministic source-row samples with fresh local YOLO pose.

Both frame-index hypotheses (-1 and 0) are retained. This is an alignment/domain
diagnostic, not a corrected dataset and not independent model acceptance.
"""
import argparse
import json
from pathlib import Path

import cv2
import numpy as np
import torch
from ultralytics import YOLO

from pipeline.boxing_research import LABELS, digest, pose_features, read_labels

VIDEOS = {'V4': 'IVvOmoB88FM', 'V6': 'cQW-h8yGbRc', 'V10': 'OfZFdwW322E'}


def run(original, mirror, output, per_class=3):
    if output.exists():
        raise ValueError('Use a new output')
    output.mkdir(parents=True)
    torch.set_num_threads(2)
    weights = Path('yolov8n-pose.pt')
    model = YOLO(str(weights))
    records, features, metadata = [], [], {}
    for source, video_id in VIDEOS.items():
        video = original / 'rgb' / (video_id + '.mp4')
        capture = cv2.VideoCapture(str(video))
        if not capture.isOpened():
            raise ValueError('Could not decode ' + str(video))
        fps = float(capture.get(cv2.CAP_PROP_FPS))
        width, height = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH)), int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
        source_path = original / (source + '.npy')
        annotations = mirror / 'clean_annotation_data' / (source + '.csv')
        skeleton = np.load(source_path, allow_pickle=False)
        rows = read_labels(annotations, allow_invalid_intervals=True)
        chosen = []
        for label in LABELS:
            candidates = [i for i, r in enumerate(rows) if r['validInterval'] and r['technique'] == label]
            chosen.extend(candidates[i] for i in np.unique(np.linspace(0, len(candidates) - 1,
                min(per_class, len(candidates))).astype(int)))
        metadata[source] = {'videoId': video_id, 'videoSha256': digest(video), 'fps': fps,
            'width': width, 'height': height, 'frames': int(capture.get(cv2.CAP_PROP_FRAME_COUNT)),
            'skeletonSha256': digest(source_path), 'annotationSha256': digest(annotations),
            'selectedRowIds': sorted(chosen)}
        for row_id in sorted(chosen):
            row = rows[row_id]
            if source == 'V6':
                ids = skeleton[:, 0, 0, 0]
                lo, hi = np.searchsorted(ids, (row['startFrame'], row['endFrame'] + 1))
                upstream = skeleton[lo:hi, 0, :, 1:]
            else:
                upstream = skeleton[row_id]
                upstream = upstream[np.any(upstream != 0, axis=(1, 2))]
            for offset in (-1, 0):
                start = row['startFrame'] + offset
                if start < 0:
                    continue
                capture.set(cv2.CAP_PROP_POS_FRAMES, start)
                images = []
                for _ in range(row['endFrame'] - row['startFrame'] + 1):
                    ok, bgr = capture.read()
                    if not ok:
                        raise ValueError('Incomplete decode')
                    images.append(bgr)
                results = model.predict(images, batch=16, conf=.5, imgsz=640, verbose=False, device='cpu')
                xy = np.zeros((len(images), 17, 2), dtype=np.float32)
                conf = np.zeros((len(images), 17), dtype=np.float32)
                counts = []
                for i, result in enumerate(results):
                    counts.append(len(result.boxes))
                    if len(result.boxes) == 1:
                        xy[i] = result.keypoints.xyn[0].cpu().numpy()
                        conf[i] = result.keypoints.conf[0].cpu().numpy()
                xy[conf < .3] = 0
                pairs = min(len(xy), len(upstream))
                visible = (conf[:pairs] >= .3) & np.any(upstream[:pairs] != 0, axis=2)
                errors = np.linalg.norm(xy[:pairs] - upstream[:pairs], axis=2)[visible]
                record = {'source': source, 'rowId': row_id, 'label': row['technique'],
                    'sourceStartFrame': row['startFrame'], 'sourceEndFrame': row['endFrame'],
                    'decodedFrameOffset': offset, 'singlePersonFraction': float(np.mean(np.array(counts) == 1)),
                    'wristCoverage': float((conf[:, [9, 10]] >= .3).mean()),
                    'medianJointErrorImageCoordinates': float(np.median(errors)) if len(errors) else None}
                try:
                    if any(n != 1 for n in counts):
                        raise ValueError('NON_SINGLE_PERSON_CLIP')
                    feature = pose_features(xy)
                    record['featureIndex'] = len(features)
                    features.append(feature)
                except ValueError as error:
                    record['rejectionReason'] = str(error)
                records.append(record)
            print(json.dumps({'source': source, 'completedRow': row_id}), flush=True)
        capture.release()
    np.savez_compressed(output / 'features.npz', features=np.stack(features))
    report = {'status': 'RGB_POSE_BRIDGE_DIAGNOSTIC', 'selection': f'{per_class} uniformly spaced rows per class/source',
        'decodedFrameOffsets': [-1, 0], 'alignmentVerified': False,
        'poseModelSha256': digest(weights), 'codeSha256': digest(Path(__file__)),
        'featureSha256': digest(output / 'features.npz'), 'videos': metadata, 'samples': records,
        'productionEligible': False, 'coachConfirmed': False,
        'limitations': ['Two frame-index hypotheses retained; no label or timing correction made.',
            'Raw YOLO single-person output; not the stateful runtime tracker.',
            'Sampled positive intervals only, not continuous event detection.',
            'Differences include estimator, resolution, codec and possible frame alignment.']}
    (output / 'report.json').write_text(json.dumps(report, indent=2, allow_nan=False), encoding='utf-8')
    print(json.dumps({'completed': True, 'samples': len(records), 'features': len(features)}), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('original', 'mirror', 'output'):
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    run(args.original, args.mirror, args.output)
