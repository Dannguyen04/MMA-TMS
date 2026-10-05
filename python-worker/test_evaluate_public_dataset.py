from evaluate_public_dataset import predicted_labels, summarize_records


def test_predicted_labels_prefers_canonical_actions():
    result = {"actions": [{"technique": "jab"}, {"technique": "cross"}], "punches": [{"punchType": "hook"}]}
    assert predicted_labels(result) == ["jab", "cross"]


def test_detection_metrics_and_coarse_label_guard():
    records = [
        {"status": "ok", "canonicalLabel": "boxing", "predictedLabels": ["cross"], "eligibleForTechniqueTraining": False},
        {"status": "ok", "canonicalLabel": "punch", "predictedLabels": [], "eligibleForTechniqueTraining": False},
        {"status": "ok", "canonicalLabel": "block", "predictedLabels": ["jab"], "eligibleForTechniqueTraining": False},
        {"status": "ok", "canonicalLabel": "negative", "predictedLabels": [], "eligibleForTechniqueTraining": False},
    ]
    summary = summarize_records(records)
    assert summary["detection"]["truePositive"] == 1
    assert summary["detection"]["falseNegative"] == 1
    assert summary["detection"]["falsePositive"] == 1
    assert summary["detection"]["trueNegative"] == 1
    assert summary["technique"]["status"] == "not_evaluable_no_fine_grained_labels"


def test_technique_accuracy_only_uses_eligible_samples():
    records = [
        {"status": "ok", "canonicalLabel": "jab", "predictedLabels": ["jab"], "eligibleForTechniqueTraining": True},
        {"status": "ok", "canonicalLabel": "cross", "predictedLabels": ["jab"], "eligibleForTechniqueTraining": True},
        {"status": "ok", "canonicalLabel": "boxing", "predictedLabels": ["hook"], "eligibleForTechniqueTraining": False},
    ]
    summary = summarize_records(records)
    assert summary["technique"]["support"] == 2
    assert summary["technique"]["accuracy"] == 0.5
