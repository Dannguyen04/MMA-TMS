"""Continuous-video metrics: extra accepted events count as false positives."""
from pipeline.boxing_research import LABELS, interval_matches


def recognition_metrics(truth, predictions, min_iou=.5):
    if any(t['technique'] not in LABELS for t in truth):
        raise ValueError('Unknown reference class')
    if any(p['technique'] not in (*LABELS, 'unknown') for p in predictions):
        raise ValueError('Unknown prediction class')
    # Also validates unknown-only intervals before class filtering.
    if any(e['startFrame'] < 0 or e['endFrame'] < e['startFrame'] for e in truth + predictions):
        raise ValueError('Invalid event interval')
    detection = interval_matches(truth, predictions, min_iou)
    per_class = {}
    for label in LABELS:
        targets = [t for t in truth if t['technique'] == label]
        candidates = [p for p in predictions if p['technique'] == label]
        tp = len(interval_matches(targets, candidates, min_iou))
        fp, fn = len(candidates) - tp, len(targets) - tp
        precision = tp / (tp + fp) if tp + fp else 0.
        recall = tp / (tp + fn) if tp + fn else 0.
        per_class[label] = {'tp': tp, 'fp': fp, 'fn': fn, 'support': len(targets),
            'precision': precision, 'recall': recall,
            'f1': 2 * tp / (2 * tp + fp + fn) if 2 * tp + fp + fn else 0.}
    accepted = sum(p['technique'] != 'unknown' for p in predictions)
    correct = sum(m['tp'] for m in per_class.values())
    dtp = len(detection)
    return {'minIntervalIoU': min_iou, 'annotationCount': len(truth), 'candidateCount': len(predictions),
        'detection': {'tp': dtp, 'fp': len(predictions) - dtp, 'fn': len(truth) - dtp,
            'precision': dtp / len(predictions) if predictions else 0.,
            'recall': dtp / len(truth) if truth else 0.,
            'f1': 2 * dtp / (len(predictions) + len(truth)) if predictions or truth else 0.},
        'acceptedCount': accepted, 'abstainedCandidates': len(predictions) - accepted,
        'acceptedCandidateCoverage': accepted / len(predictions) if predictions else None,
        'acceptedPrecision': correct / accepted if accepted else None,
        'recognitionRecall': correct / len(truth) if truth else None,
        'macroF1IncludingMissesAbstentionsAndExtraPredictions': sum(m['f1'] for m in per_class.values()) / len(LABELS),
        'perClass': per_class,
        'note': 'Class-aware one-to-one interval matching. Unlabelled gaps require exhaustive annotation to interpret FP.'}
