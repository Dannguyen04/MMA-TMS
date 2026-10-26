from pipeline.recognition_metrics import recognition_metrics


def event(label, start=0, end=10):
    return {'technique': label, 'startFrame': start, 'endFrame': end}


def test_duplicate_predictions_count_as_fp():
    r = recognition_metrics([event('jab')], [event('jab'), event('jab')])
    assert r['perClass']['jab'] == {'tp': 1, 'fp': 1, 'fn': 0, 'support': 1,
                                  'precision': .5, 'recall': 1., 'f1': 2 / 3}
    assert r['acceptedPrecision'] == .5


def test_wrong_class_costs_fp_and_fn_unknown_costs_fn():
    r = recognition_metrics([event('jab'), event('cross', 30, 40)],
                            [event('cross'), event('unknown', 30, 40)])
    assert r['detection']['f1'] == 1.
    assert r['perClass']['jab']['fn'] == 1
    assert r['perClass']['cross']['fp'] == 1
    assert r['perClass']['cross']['fn'] == 1
    assert r['recognitionRecall'] == 0.


def test_reject_all_does_not_look_perfect():
    r = recognition_metrics([event('jab')], [event('unknown')])
    assert r['acceptedPrecision'] is None
    assert r['recognitionRecall'] == 0.
    assert r['macroF1IncludingMissesAbstentionsAndExtraPredictions'] == 0.


def test_misses_and_temporal_matching():
    r = recognition_metrics([event('jab')], [event('jab', 30, 40)])
    assert r['perClass']['jab']['fp'] == 1 and r['perClass']['jab']['fn'] == 1
    assert recognition_metrics([event('jab')], [])['detection']['recall'] == 0.
