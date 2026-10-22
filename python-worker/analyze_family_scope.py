"""Read-only analysis: would a 3-family product scope help? NO training happens here.

Collapses frozen 6-class checkpoints (B0 primary, B1 exploratory) into
straight / hook / uppercut by summing softmax probabilities inside each family.
Abstention thresholds are chosen on V5 calibration only. V9/V10 are an already
observed diagnostic, not an independent test set.

Run: .venv/Scripts/python.exe analyze_family_scope.py
"""
import argparse
import csv
import json
from pathlib import Path

import numpy as np
import torch

from pipeline.boxing_research import LABELS, classification_metrics, digest, softmax
from pipeline.evaluation_protocol import calculate_wilson_interval as wilson
from pipeline.temporal_checkpoint import load_temporal_checkpoint
from train_boxing_research import predict_logits
from train_provisional_smoke import load_dataset

FAMILIES = ('straight', 'hook', 'uppercut')
FAMILY_OF = np.array([0, 0, 1, 1, 2, 2])      # jab,cross | lead_hook,rear_hook | lead_up,rear_up
SIDE_OF = np.array([0, 1, 0, 1, 0, 1])        # 0 = lead, 1 = rear
ROOT = Path(__file__).resolve().parent
MANIFEST = ROOT / 'test_results/provisional_dataset/20261006_v6_recovered_v2/manifest.json'
ABL = ROOT / 'test_results/temporal_ablations'
CHECKPOINTS = {
    'B0': (ABL / '20261006_v6_reflection_v1/selected',
           '3fa9cf2195615220a1ca4149cb018d5cd56bed10cb53912ebb8cdf5181aaccd9'),
    'B1': (ABL / '20261006_v6_robustness_v1/selected',
           '45f2f8fd345ddf0504850d46855ad4ca07c0a9aab0fa562aaa14b6751218ffa4'),
}
CV_DIR = ABL / '20261006_v6_reflection_v1'
CV_VARIANT = {'B0': 'B0_v6_auxiliary', 'B1': 'B1_v6_reflection'}
CV_FOLDS = {1: ('V1',), 2: ('V2', 'V3'), 3: ('V4', 'V7'), 4: ('V6',)}
SEEDS = (20261006, 20261007, 20261008)
FAMILY_GATE = 0.85
PRECISION_TARGET = .90
MIN_SUPPORT = 30


def family_probs(p6):
    return np.stack([p6[:, FAMILY_OF == f].sum(1) for f in range(3)], 1)


def metrics3(truth, pred):
    return classification_metrics([FAMILIES[i] for i in truth], [FAMILIES[i] for i in pred], FAMILIES)


def supported_macro(m):
    return float(np.mean([v['f1'] for v in m['perClass'].values() if v['support']]))


def metrics6(truth, pred):
    return classification_metrics([LABELS[i] for i in truth], [LABELS[i] for i in pred])


def side_report(truth6, pred6):
    fam_ok = FAMILY_OF[truth6] == FAMILY_OF[pred6]
    side_ok = SIDE_OF[truth6] == SIDE_OF[pred6]
    n = int(fam_ok.sum())
    out = {'familyCorrect': n, 'total': int(len(truth6)),
           'sideCorrectGivenFamilyCorrect': int((fam_ok & side_ok).sum()),
           'sideAccuracyGivenFamilyCorrect': float((fam_ok & side_ok).sum() / n) if n else None,
           'wilson95': list(wilson(int((fam_ok & side_ok).sum()), n)) if n else None,
           'wrongFamily': int((~fam_ok).sum()), 'rightFamilyWrongSide': int((fam_ok & ~side_ok).sum()),
           'perFamily': {}}
    for f, name in enumerate(FAMILIES):
        sel = fam_ok & (FAMILY_OF[truth6] == f)
        k = int(sel.sum())
        out['perFamily'][name] = {'familyCorrect': k, 'sideCorrect': int((sel & side_ok).sum()),
                                  'sideAccuracy': float((sel & side_ok).sum() / k) if k else None}
    # Chance for a binary side decision is 0.5; leadRear ignores class imbalance.
    return out


def bootstrap_macro(truth, pred, n=2000, seed=0):
    rng = np.random.default_rng(seed)
    vals = []
    for _ in range(n):
        ix = rng.integers(0, len(truth), len(truth))
        vals.append(supported_macro(metrics3(truth[ix], pred[ix])))
    return [float(np.percentile(vals, 2.5)), float(np.percentile(vals, 97.5))]


def describe_split(name, ix, y6, p6, temp_free=False):
    yf = FAMILY_OF[y6[ix]]
    pf = family_probs(p6[ix]).argmax(1)
    pred6 = p6[ix].argmax(1)
    fam = metrics3(yf, pf)
    six = metrics6(y6[ix], pred6)
    counts = np.bincount(yf, minlength=3)
    return {'count': int(len(ix)),
            'sixClass': {'accuracy': six['accuracy'], 'macroF1': six['macroF1']},
            'family': {'accuracy': fam['accuracy'], 'macroF1': fam['macroF1'], 'perClass': fam['perClass'],
                       'confusionRows(truth)': list(FAMILIES), 'confusionColumns(pred)': list(FAMILIES),
                       'confusionMatrix': np.array(fam['confusionMatrix'])[:, :3].tolist(),
                       'macroF1Bootstrap95_clipIID_optimistic': bootstrap_macro(yf, pf)},
            'familySupport': dict(zip(FAMILIES, counts.tolist())),
            'majorityFamilyBaselineAccuracy': float(counts.max() / counts.sum()),
            'familyCollapsedFromSixClassArgmax': {
                'macroF1': metrics3(yf, FAMILY_OF[pred6])['macroF1'],
                'accuracy': metrics3(yf, FAMILY_OF[pred6])['accuracy']},
            'side': side_report(y6[ix], pred6),
            'sixClassConfusion': {'rows': list(LABELS), 'columns': list(LABELS),
                                  'matrix': np.array(six['confusionMatrix'])[:, :6].tolist()}}


def select_family_threshold(conf, correct, rule):
    """Calibration-only. rule 'point': precision>=.90 ; 'wilson': Wilson lower bound>=.90.
    Max coverage among thresholds with >= MIN_SUPPORT accepted."""
    best = None
    for t in np.unique(conf):
        acc = conf >= t
        k, h = int(acc.sum()), int(correct[acc].sum())
        if k < MIN_SUPPORT:
            continue
        ok = (h / k >= PRECISION_TARGET) if rule == 'point' else (wilson(h, k)[0] >= PRECISION_TARGET)
        if ok and (best is None or k > best[0]):
            best = (k, float(t), h)
    if best is None:
        return {'threshold': None, 'reason': 'NO_SUPPORTED_THRESHOLD'}
    return {'threshold': best[1], 'calibrationAccepted': best[0], 'calibrationCorrect': best[2],
            'calibrationPrecision': best[2] / best[0], 'calibrationCoverage': None, 'reason': f'V5_ONLY_{rule}'}


def apply_policy(ix, yf, pf, conf, policy):
    if policy['threshold'] is None:
        return {'accepted': 0, 'coverage': 0.0, 'precision': None}
    acc = conf[ix] >= policy['threshold']
    k = int(acc.sum())
    h = int((pf[ix][acc] == yf[ix][acc]).sum())
    pred = [FAMILIES[p] if a else 'unknown' for p, a in zip(pf[ix], acc)]
    m = classification_metrics([FAMILIES[i] for i in yf[ix]], pred, FAMILIES)
    return {'accepted': k, 'coverage': float(acc.mean()), 'correct': h,
            'precision': h / k if k else None, 'precisionWilson95': list(wilson(h, k)) if k else None,
            'macroF1IncludingAbstentionAsMiss': m['macroF1'], 'perClassRecallIncludingAbstention':
            {n: v['recall'] for n, v in m['perClass'].items()},
            'acceptedPerFamily': {FAMILIES[f]: int((acc & (yf[ix] == f)).sum()) for f in range(3)},
            'supportPerFamily': {FAMILIES[f]: int((yf[ix] == f).sum()) for f in range(3)}}


def cv_analysis(variant):
    runs = []
    for fold, held in CV_FOLDS.items():
        for seed in SEEDS:
            d = CV_DIR / f'{CV_VARIANT[variant]}_fold{fold}_seed{seed}'
            with np.load(d / 'validation_predictions.npz', allow_pickle=False) as a:
                logits, targets, sources = a['logits'], a['targets'], a['sources']
            p6 = softmax(logits, 1.0)
            pf = family_probs(p6).argmax(1)
            yf = FAMILY_OF[targets]
            fam, six = metrics3(yf, pf), metrics6(targets, p6.argmax(1))
            per_source = {}
            for s in sorted(set(sources)):
                m = sources == s
                per_source[str(s)] = {'count': int(m.sum()),
                                      'familySupportedMacroF1': supported_macro(metrics3(yf[m], pf[m])),
                                      'sixClassSupportedMacroF1': supported_macro(metrics6(targets[m], p6[m].argmax(1))),
                                      'familyAccuracy': float((pf[m] == yf[m]).mean())}
            runs.append({'fold': fold, 'seed': seed, 'n': int(len(targets)),
                         'sixClassSupportedMacroF1': supported_macro(six),
                         'familySupportedMacroF1': supported_macro(fam), 'familyAccuracy': fam['accuracy'],
                         'familySupport': np.bincount(yf, minlength=3).tolist(),
                         'familyConfusion': np.array(fam['confusionMatrix'])[:, :3].tolist(),
                         'familyPerClass': fam['perClass'], 'perSource': per_source})
    folds = {}
    for fold in CV_FOLDS:
        r = [x for x in runs if x['fold'] == fold]
        folds[str(fold)] = {'sources': list(CV_FOLDS[fold]), 'clips': r[0]['n'],
                            'familySupport': dict(zip(FAMILIES, r[0]['familySupport'])),
                            'sixClassMean': float(np.mean([x['sixClassSupportedMacroF1'] for x in r])),
                            'familyMean': float(np.mean([x['familySupportedMacroF1'] for x in r])),
                            'familyStd': float(np.std([x['familySupportedMacroF1'] for x in r])),
                            'familyAccuracyMean': float(np.mean([x['familyAccuracy'] for x in r]))}
    sources = {}
    for s in sorted({s for r in runs for s in r['perSource']}):
        rs = [r['perSource'][s] for r in runs if s in r['perSource']]
        sources[s] = {'clips': rs[0]['count'],
                      'sixClassMean': float(np.mean([x['sixClassSupportedMacroF1'] for x in rs])),
                      'familyMean': float(np.mean([x['familySupportedMacroF1'] for x in rs])),
                      'familyAccuracyMean': float(np.mean([x['familyAccuracy'] for x in rs]))}
    return {'variantRuns': CV_VARIANT[variant], 'runs': runs, 'folds': folds, 'perSource': sources,
            'meanFoldSixClass': float(np.mean([f['sixClassMean'] for f in folds.values()])),
            'meanFoldFamily': float(np.mean([f['familyMean'] for f in folds.values()])),
            'worstFoldFamily': float(min(f['familyMean'] for f in folds.values())),
            'note': ('Out-of-fold logits of the 24 saved CV runs (temperature 1.0, not calibrated). Folds differ '
                     'from the refit checkpoint (trained without the held-out source). V6 has only 4 classes; '
                     'family F1 averages families with support. Same models were used to select B0/B1, so scores '
                     'are selection-biased.')}


def main(out_json, out_dir):
    for p in (out_json, out_dir / 'sample_predictions.csv'):
        if p.exists():
            raise SystemExit(f'Refusing to overwrite {p}')
    out_dir.mkdir(parents=True, exist_ok=True)
    torch.set_num_threads(4)
    manifest_sha = digest(MANIFEST)
    manifest, x, y, _ = load_dataset(MANIFEST)
    rows = manifest['samples']
    splits = np.array([r['split'] for r in rows])
    sources = np.array([r['sourceVideoId'] for r in rows])
    index = {'validation_V8': np.flatnonzero(sources == 'V8'),
             'calibration_V5': np.flatnonzero(sources == 'V5'),
             'diagnostic_V9': np.flatnonzero(sources == 'V9'),
             'diagnostic_V10': np.flatnonzero(sources == 'V10')}
    index['diagnostic_V9_V10'] = np.concatenate([index['diagnostic_V9'], index['diagnostic_V10']])
    assert set(splits[index['diagnostic_V9_V10']]) == {'test'} and set(splits[index['validation_V8']]) == {'validation'}
    assert set(splits[index['calibration_V5']]) == {'calibration'}
    result = {'manifestSha256': manifest_sha, 'manifest': str(MANIFEST.relative_to(ROOT)),
              'role': 'research_only; no training; V9/V10 already observed diagnostic, not independent test',
              'familyDefinition': {'straight': ['jab', 'cross'], 'hook': ['lead_hook', 'rear_hook'],
                                   'uppercut': ['lead_uppercut', 'rear_uppercut']},
              'releaseGateMacroF1': FAMILY_GATE, 'models': {}}
    per_sample = {}
    for name, (directory, expected_sha) in CHECKPOINTS.items():
        if digest(directory / 'model.npz') != expected_sha:
            raise SystemExit(f'Hash mismatch for {name}')
        model, card = load_temporal_checkpoint(directory)   # also verifies hash/source contract
        report = json.loads((directory / 'report.json').read_text())
        if card['weightsSha256'] != expected_sha or report['manifestSha256'] != manifest_sha:
            raise SystemExit(f'{name}: checkpoint/manifest mismatch')
        temp = card['temperature']
        p6 = softmax(predict_logits(model, x), temp)
        per_sample[name] = p6
        pf_all = family_probs(p6)
        pf, conf = pf_all.argmax(1), pf_all.max(1)
        yf = FAMILY_OF[y]
        splits_out = {k: describe_split(k, ix, y, p6) for k, ix in index.items()}
        # Check that reproduced six-class diagnostic equals the stored report (guards the pipeline).
        stored = report['metrics']['test']['macroF1']
        repro = splits_out['diagnostic_V9_V10']['sixClass']['macroF1']
        if abs(stored - repro) > 1e-9:
            raise SystemExit(f'{name}: six-class diagnostic not reproduced ({stored} vs {repro})')
        v5 = index['calibration_V5']
        policies = {}
        for rule in ('point', 'wilson'):
            pol = select_family_threshold(conf[v5], (pf[v5] == yf[v5]), rule)
            if pol['threshold'] is not None:
                pol['calibrationCoverage'] = pol['calibrationAccepted'] / len(v5)
            applied = {k: apply_policy(ix, yf, pf, conf, pol) for k, ix in index.items()}
            policies[rule] = {'selection': pol, 'applied': applied}
        # Six-class abstention from the stored checkpoint policy, for comparison.
        six_sel = report['metrics']['test']['selective']
        result['models'][name] = {
            'weightsSha256': expected_sha, 'temperature': temp, 'primary': name == 'B0',
            'splits': splits_out, 'abstention': {
                'rules': {'point': f'V5 precision >= {PRECISION_TARGET}, max coverage, min {MIN_SUPPORT} accepted',
                          'wilson': f'V5 Wilson95 lower bound >= {PRECISION_TARGET}, max coverage (repo rule)'},
                'confidence': 'max over summed family probabilities (T = checkpoint temperature)',
                'policies': policies,
                'v5NoAbstentionFamilyAccuracy': float((pf[v5] == yf[v5]).mean()),
                'sixClassStoredPolicyOnV9V10': {'threshold': report['acceptancePolicy']['threshold'],
                                                'accepted': six_sel['accepted'], 'coverage': six_sel['coverage'],
                                                'accuracyWhenAccepted': six_sel['accuracyWhenAccepted']}},
            'sourceCV': cv_analysis(name)}
    result['limitations'] = [
        'V9/V10 were observed before this analysis; family scope is a post-hoc re-reading of the same data.',
        'Source IDs are not verified independent athletes; clip bootstrap CIs assume i.i.d. clips and are optimistic.',
        'Clips are pre-trimmed positives: no continuous-video detection, no no-punch/other class, so family scope '
        'does not measure false events.',
        'The 3-class model was NOT trained; family probabilities are sums of 6-class softmax outputs.',
        'Calibration V5 is a single source; abstention thresholds picked there may not transfer.']
    out_json.write_text(json.dumps(result, indent=2, allow_nan=False), encoding='utf-8')
    with (out_dir / 'sample_predictions.csv').open('x', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(['sampleId', 'split', 'source', 'truth6', 'truthFamily'] +
                   [f'{m}_p_{l}' for m in per_sample for l in LABELS])
        for i, r in enumerate(rows):
            w.writerow([r['sampleId'], r['split'], r['sourceVideoId'], LABELS[int(y[i])], FAMILIES[FAMILY_OF[y[i]]]] +
                       [f'{per_sample[m][i, j]:.6f}' for m in per_sample for j in range(6)])
    print('written', out_json)


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--output-json', type=Path, default=ROOT / 'benchmark_results/family_scope_analysis_20261006.json')
    ap.add_argument('--output-dir', type=Path, default=ROOT / 'test_results/family_scope_20261006')
    a = ap.parse_args()
    main(a.output_json, a.output_dir)
