"""Frozen source-held-out comparison with recovered V6 and stance reflection.

All old source labels, including Adam, stay unchanged. No runtime promotion.
V6 has four classes: selection averages macro F1 over supported classes per fold.
"""
import argparse
import json
from pathlib import Path
import time

import numpy as np
import torch

from benchmark_temporal_models import select_threshold, selective_metrics
from pipeline.boxing_research import LABELS, FEATURE_VERSION, digest, probability_metrics
from pipeline.pose_reflection import random_reflection
from pipeline.temporal_experiments import AuxiliaryTCN
from pipeline.temporal_models import build_model
from pipeline.temporal_checkpoint import load_temporal_checkpoint
from train_boxing_research import predict_logits
from train_provisional_model import class_balanced_weights, agreement
from train_provisional_smoke import load_dataset

VARIANTS = ('B0_v6_auxiliary', 'B1_v6_reflection')
FOLDS = (('V1',), ('V2', 'V3'), ('V4', 'V7'), ('V6',))
CODE = ('run_v6_reflection.py', 'recover_boxingvi_v6.py', 'pipeline/pose_reflection.py',
        'pipeline/temporal_experiments.py', 'pipeline/temporal_models.py',
        'pipeline/boxing_research.py', 'train_boxing_research.py',
        'train_provisional_model.py', 'train_provisional_smoke.py',
        'benchmark_temporal_models.py', 'pipeline/temporal_checkpoint.py')


def save(path, value):
    with path.open('x', encoding='utf-8') as stream:
        json.dump(value, stream, indent=2, allow_nan=False)


def supported_f1(metrics):
    return float(np.mean([v['f1'] for v in metrics['perClass'].values() if v['support']]))


def fit(x, y, weights, variant, seed, out, epochs, validation=None):
    out.mkdir(parents=True, exist_ok=False)
    torch.manual_seed(seed)
    model = AuxiliaryTCN()
    torch.manual_seed(seed + 1000)
    order_rng = torch.Generator().manual_seed(seed + 2000)
    reflect_rng = torch.Generator().manual_seed(seed + 4000)
    optimizer = torch.optim.AdamW(model.parameters(), lr=.001, weight_decay=.001)
    tx, ty, tw = torch.from_numpy(x), torch.from_numpy(y).long(), torch.from_numpy(weights).float()
    cw = torch.tensor(class_balanced_weights(y, weights), dtype=torch.float32)
    best, best_epoch, state, history = -1., 0, None, []
    start = time.monotonic()
    for epoch in range(1, epochs + 1):
        model.train()
        total, mass = 0., 0.
        for batch in torch.randperm(len(x), generator=order_rng).split(128):
            optimizer.zero_grad()
            values = tx[batch]
            if variant == 'B1_v6_reflection':
                values = random_reflection(values, reflect_rng)
            main, family, side = model.training_heads(values)
            losses = (torch.nn.functional.cross_entropy(main, ty[batch], reduction='none')
                      + .2 * torch.nn.functional.cross_entropy(family, ty[batch] // 2, reduction='none')
                      + .2 * torch.nn.functional.cross_entropy(side, ty[batch] % 2, reduction='none'))
            effective = tw[batch] * cw[ty[batch]]
            loss = (losses * effective).sum() / effective.sum()
            if not torch.isfinite(loss):
                raise ValueError('Nonfinite loss')
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 5, error_if_nonfinite=True)
            optimizer.step()
            total += float((losses.detach() * effective).sum())
            mass += float(effective.sum())
        record = {'epoch': epoch, 'loss': total / mass}
        if validation is not None:
            vx, vy, _ = validation
            score = supported_f1(agreement(predict_logits(model, vx), vy))
            record['validationSupportedMacroF1'] = score
        else:
            score = float(epoch)
        history.append(record)
        if score > best + 1e-6:
            best, best_epoch = score, epoch
            state = {k: v.detach().clone() for k, v in model.state_dict().items()}
        if epoch == 1 or epoch % 10 == 0:
            print(json.dumps({'run': out.name, **record}), flush=True)
        if validation is not None and epoch - best_epoch >= 10:
            break
    model.load_state_dict(state)
    np.savez_compressed(out / 'model.npz', **{k: v.numpy() for k, v in state.items()
        if not k.startswith(('family_head.', 'side_head.'))})
    restored = build_model('residual_tcn')
    with np.load(out / 'model.npz', allow_pickle=False) as archive:
        restored.load_state_dict({k: torch.from_numpy(archive[k].copy()) for k in archive.files})
    np.testing.assert_allclose(predict_logits(restored, x[:16]), predict_logits(model, x[:16]), atol=1e-6, rtol=1e-6)
    report = {'variant': variant, 'seed': seed, 'bestEpoch': best_epoch, 'history': history,
        'checkpointRoundtripPassed': True, 'weightsSha256': digest(out / 'model.npz'),
        'seconds': time.monotonic() - start}
    if validation is not None:
        vx, vy, vs = validation
        logits = predict_logits(restored, vx)
        report['validation'] = agreement(logits, vy)
        report['supportedMacroF1'] = supported_f1(report['validation'])
        report['perSource'] = {str(s): agreement(logits[vs == s], vy[vs == s]) for s in sorted(set(vs))}
        np.savez_compressed(out / 'validation_predictions.npz', logits=logits, targets=vy, sources=vs)
    save(out / 'training.json', report)
    print(json.dumps({'completed': out.name, 'epoch': best_epoch,
        'supportedMacroF1': report.get('supportedMacroF1')}), flush=True)
    return restored, report


def run(manifest_path, out):
    manifest, x, y, w = load_dataset(manifest_path)
    if not manifest.get('v6Recovery') or manifest['sampleCount'] != len(x):
        raise ValueError('Expected audited V6 extension')
    rows = manifest['samples']
    sources = np.array([r['sourceVideoId'] for r in rows])
    splits = np.array([r['split'] for r in rows])
    train = splits == 'train'
    folds = []
    for held in FOLDS:
        vi = np.flatnonzero(train & np.isin(sources, held))
        ti = np.flatnonzero(train & ~np.isin(sources, held))
        if not len(vi) or len(np.unique(y[ti])) != 6 or set(sources[ti]) & set(sources[vi]):
            raise ValueError('Invalid source fold')
        folds.append((ti, vi))
    contract = {'manifestSha256': digest(manifest_path), 'variants': VARIANTS,
        'seeds': [20261006, 20261007, 20261008], 'maxEpochs': 40, 'patience': 10,
        'folds': [list(s) for s in FOLDS], 'batchSize': 128,
        'sourceHashes': {p: digest(Path(p)) for p in CODE},
        'selection': 'Mean per-fold supported-class macro F1; tie-break worst source mean supported F1.',
        'refit': 'First fixed seed; rounded median best epoch across 12 winning CV runs.',
        'reflection': 'B1 only: probability .5 per clip, x negation, COCO left/right joint swap, identical labels.',
        'calibration': 'V5 only; old V8/V9/V10 are diagnostic and never choose model.',
        'V6': 'Held out in fold 4; included in other training folds; only four supported classes.',
        'mode': 'research_only', 'productionEligible': False,
        'limitations': ['Source groups are not verified independent athlete identities.',
            'CV model/epoch selection shares development folds; scores are selection-biased.',
            'These positive clips have given boundaries; continuous-video detection is not measured.',
            'Source labels are not new coach-confirmed ground truth.',
            'V6 and four-fold selection differ from the previous three-fold A3 experiment.']}
    # JSON-normalize tuples before comparing resume contracts.
    contract = json.loads(json.dumps(contract))
    if out.exists():
        if json.loads((out / 'configuration.json').read_text()) != contract or (out / 'report.json').exists():
            raise ValueError('Changed or completed run: use a new output')
    else:
        out.mkdir(parents=True)
        save(out / 'configuration.json', contract)
    torch.set_num_threads(4)
    torch.use_deterministic_algorithms(True)
    runs = []
    for variant in VARIANTS:
        for fold, (ti, vi) in enumerate(folds, 1):
            for seed in contract['seeds']:
                directory = out / f'{variant}_fold{fold}_seed{seed}'
                if (directory / 'training.json').exists():
                    report = json.loads((directory / 'training.json').read_text())
                    if digest(directory / 'model.npz') != report['weightsSha256']:
                        raise ValueError('Resumed checkpoint changed')
                else:
                    _, report = fit(x[ti], y[ti], w[ti], variant, seed, directory, contract['maxEpochs'],
                                    (x[vi], y[vi], sources[vi]))
                runs.append({'fold': fold, **report})
    summaries = []
    for variant in VARIANTS:
        selected = [r for r in runs if r['variant'] == variant]
        per_source = {s: float(np.mean([supported_f1(r['perSource'][s]) for r in selected if s in r['perSource']]))
                      for s in sorted({s for r in selected for s in r['perSource']})}
        summaries.append({'variant': variant, 'meanFoldSupportedMacroF1': float(np.mean([r['supportedMacroF1'] for r in selected])),
            'worstSourceSupportedMacroF1': min(per_source.values()), 'perSourceSupportedMacroF1': per_source,
            'folds': [{'fold': f, 'mean': float(np.mean([r['supportedMacroF1'] for r in selected if r['fold'] == f])),
                'std': float(np.std([r['supportedMacroF1'] for r in selected if r['fold'] == f]))} for f in range(1, 5)]})
    winner = max(summaries, key=lambda s: (s['meanFoldSupportedMacroF1'], s['worstSourceSupportedMacroF1']))
    epochs = int(np.rint(np.median([r['bestEpoch'] for r in runs if r['variant'] == winner['variant']])))
    selection = {'variant': winner['variant'], 'epochs': epochs, 'seed': contract['seeds'][0], 'summaries': summaries}
    save(out / 'selection.json', selection)
    print(json.dumps({'selectionFrozen': selection}), flush=True)
    model, final = fit(x[train], y[train], w[train], winner['variant'], selection['seed'], out / 'selected', epochs)
    ci = splits == 'calibration'
    logits = predict_logits(model, x[ci])
    temperature = float(min(np.geomspace(.25, 8, 100), key=lambda t: probability_metrics(logits, y[ci], t)['nll']))
    policy = select_threshold(logits, y[ci], temperature)
    metrics = {}
    for split in ('validation', 'calibration', 'test'):
        indices = splits == split
        values = predict_logits(model, x[indices])
        metrics[split] = {**agreement(values, y[indices]), 'calibrated': probability_metrics(values, y[indices], temperature),
            'selective': selective_metrics(values, y[indices], temperature, policy),
            'perSource': {str(s): agreement(values[sources[indices] == s], y[indices][sources[indices] == s])
                          for s in sorted(set(sources[indices]))}}
    report = {'architecture': 'residual_tcn', 'seed': selection['seed'], 'bestEpoch': epochs,
        'trainingVariant': winner['variant'], 'featureVersion': FEATURE_VERSION, 'labels': list(LABELS),
        'temperature': temperature, 'acceptancePolicy': policy, 'weightsSha256': final['weightsSha256'],
        'manifestSha256': digest(manifest_path), 'mode': 'research_only', 'productionEligible': False,
        'metrics': metrics, 'testRole': 'Previously observed V9/V10 diagnostic, not independent acceptance',
        'selection': selection, 'checkpointRoundtripPassed': True}
    save(out / 'selected/report.json', report)
    loaded, _ = load_temporal_checkpoint(out / 'selected')
    np.testing.assert_allclose(predict_logits(loaded, x[:16]), predict_logits(model, x[:16]), atol=1e-6, rtol=1e-6)
    result = {**contract, 'status': 'COMPLETED', 'runs': runs, 'selected': report,
              'summaries': summaries, 'trainingSeconds': sum(r['seconds'] for r in runs) + final['seconds']}
    save(out / 'report.json', result)
    print(json.dumps({'completed': True, 'diagnosticF1': metrics['test']['macroF1'],
                     'accepted': metrics['test']['selective']}), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    run(args.manifest, args.output)
