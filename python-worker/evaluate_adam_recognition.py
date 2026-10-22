"""Training-video regression, never independent acceptance: original Adam CSV."""
import argparse
import json
from pathlib import Path

from pipeline.boxing_research import digest, read_labels
from pipeline.recognition_metrics import recognition_metrics
from prepare_provisional_dataset import ADAM_CSV, ADAM_CSV_SHA256


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--result', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    result = json.loads(args.result.read_text())
    if digest(ADAM_CSV) != ADAM_CSV_SHA256 or result['videoSha256'] != digest(ADAM_CSV.parent / 'adam.mp4'):
        raise ValueError('Original Adam CSV/video mismatch')
    report = {'status': 'ADAM_TRAINING_VIDEO_REGRESSION', 'independentAcceptance': False,
        'annotationSha256': ADAM_CSV_SHA256, 'resultSha256': digest(args.result),
        'metrics': {str(iou): recognition_metrics(read_labels(ADAM_CSV), result['events'], iou) for iou in (.1, .3, .5)},
        'limitations': ['Adam is already in training; these are regression metrics only.',
            'Original CSV overlaps are preserved; annotation exhaustiveness is unverified.',
            'Correct abstention is not measurable without independent ambiguity/background labels.']}
    with args.output.open('x', encoding='utf-8') as stream:
        json.dump(report, stream, indent=2, allow_nan=False)
    print(json.dumps(report['metrics']['0.5'], indent=2))
