"""Exploratory B1 refit prompted by better worst-source CV, not primary winner.

The frozen mean-CV B0 selection and report stay unchanged. This post-primary
diagnostic cannot be presented as an independent confirmatory experiment.
"""
import argparse
import json
from pathlib import Path

import numpy as np
import torch

from benchmark_temporal_models import select_threshold, selective_metrics
from pipeline.boxing_research import LABELS, FEATURE_VERSION, digest, probability_metrics
from pipeline.temporal_checkpoint import load_temporal_checkpoint
from run_v6_reflection import fit, save
from train_boxing_research import predict_logits
from train_provisional_model import agreement
from train_provisional_smoke import load_dataset


def run(experiment, manifest_path, out):
    parent = json.loads((experiment / 'report.json').read_text())
    if parent['status'] != 'COMPLETED' or digest(manifest_path) != parent['manifestSha256']:
        raise ValueError('Expected completed experiment with matching dataset')
    for name, expected in parent['sourceHashes'].items():
        if digest(Path(name)) != expected:
            raise ValueError('Original experiment code changed: ' + name)
    variant = 'B1_v6_reflection'
    runs = [r for r in parent['runs'] if r['variant'] == variant]
    if len(runs) != 12:
        raise ValueError('Expected all B1 development folds/seeds')
    epochs = int(np.rint(np.median([r['bestEpoch'] for r in runs])))
    contract = {'mode': 'research_only', 'productionEligible': False,
        'selectionStatus': 'EXPLORATORY_SECONDARY_REFIT', 'variant': variant,
        'reason': 'Higher worst-source CV; not winner of frozen mean-CV rule. Both candidates fail release gates.',
        'primaryReportSha256': digest(experiment / 'report.json'), 'manifestSha256': digest(manifest_path),
        'epochs': epochs, 'seed': parent['seeds'][0], 'sourceHashes': parent['sourceHashes'] |
            {'refit_v6_robustness_candidate.py': digest(Path(__file__))}}
    out.mkdir(parents=True, exist_ok=False)
    save(out / 'configuration.json', contract)
    manifest, x, y, weights = load_dataset(manifest_path)
    sources = np.array([r['sourceVideoId'] for r in manifest['samples']])
    splits = np.array([r['split'] for r in manifest['samples']])
    torch.set_num_threads(4)
    torch.use_deterministic_algorithms(True)
    ti = splits == 'train'
    model, training = fit(x[ti], y[ti], weights[ti], variant, contract['seed'], out / 'selected', epochs)
    ci = splits == 'calibration'
    logits = predict_logits(model, x[ci])
    temperature = float(min(np.geomspace(.25, 8, 100), key=lambda t: probability_metrics(logits, y[ci], t)['nll']))
    policy = select_threshold(logits, y[ci], temperature)
    metrics = {}
    for split in ('validation', 'calibration', 'test'):
        ids = splits == split
        values = predict_logits(model, x[ids])
        metrics[split] = {**agreement(values, y[ids]), 'calibrated': probability_metrics(values, y[ids], temperature),
            'selective': selective_metrics(values, y[ids], temperature, policy),
            'perSource': {str(s): agreement(values[sources[ids] == s], y[ids][sources[ids] == s]) for s in sorted(set(sources[ids]))}}
    report = {**contract, 'architecture': 'residual_tcn', 'trainingVariant': variant, 'bestEpoch': epochs,
        'featureVersion': FEATURE_VERSION, 'labels': list(LABELS), 'temperature': temperature,
        'acceptancePolicy': policy, 'weightsSha256': training['weightsSha256'],
        'metrics': metrics, 'checkpointRoundtripPassed': training['checkpointRoundtripPassed'],
        'testRole': 'Previously observed V9/V10 diagnostic only', 'trainingSeconds': training['seconds']}
    save(out / 'selected/report.json', report)
    restored, _ = load_temporal_checkpoint(out / 'selected')
    np.testing.assert_allclose(predict_logits(restored, x[:16]), predict_logits(model, x[:16]), atol=1e-6, rtol=1e-6)
    save(out / 'report.json', report)
    print(json.dumps({'completed': True, 'epochs': epochs, 'diagnosticF1': metrics['test']['macroF1'],
        'accuracy': metrics['test']['accuracy'], 'selective': metrics['test']['selective']}), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('experiment', 'manifest', 'output'):
        parser.add_argument('--' + name, type=Path, required=True)
    args = parser.parse_args()
    run(args.experiment, args.manifest, args.output)
