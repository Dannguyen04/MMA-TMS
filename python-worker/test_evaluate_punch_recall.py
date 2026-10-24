"""
test_evaluate_punch_recall.py — Unit tests for punch detector recall evaluation.

Tests one-to-one bipartite matching (maximum cardinality + min distance to midpoint),
tolerance boundaries [start_frame - 3, end_frame + 3], duplicate detection reporting,
and metric calculation across development and test splits.
"""

import pytest
from evaluate_punch_recall import (
    GroundTruthInterval,
    PunchPrediction,
    match_bipartite_predictions,
    evaluate_punch_recall,
)


def test_one_to_one_matching_maximum_cardinality():
    """Ensure maximum cardinality bipartite matching prevents greedy undercounting.

    Interval 0: [10, 20] (midpoint 15)
    Interval 1: [18, 30] (midpoint 24)
    P0 at 19 falls in both [7, 23] and [15, 33].
    P1 at 25 falls only in [15, 33].
    If P0 greedily took Interval 1 (error 5 vs error 4 to Interval 0),
    both can still match because P0 to 0 (error 4) and P1 to 1 (error 1) gives 2 matches.
    """
    truth = [
        GroundTruthInterval(start_frame=10, end_frame=20, label="jab", id="0"),
        GroundTruthInterval(start_frame=18, end_frame=30, label="cross", id="1"),
    ]
    preds = [
        PunchPrediction(impact_frame=19, start_frame=15, end_frame=22),
        PunchPrediction(impact_frame=25, start_frame=21, end_frame=28),
    ]

    result = match_bipartite_predictions(truth, preds)
    assert result.tp == 2
    assert result.fn == 0
    assert result.recall == 1.0
    assert len(result.matches) == 2

    # Verify that Interval 0 matched P0 (impact 19) and Interval 1 matched P1 (impact 25)
    match_map = {m["gt_id"]: m["impact_frame"] for m in result.matches}
    assert match_map["0"] == 19
    assert match_map["1"] == 25


def test_boundary_tolerance_exact_and_plus_minus_three():
    """Verify tolerance is exactly [start_frame - 3, end_frame + 3] inclusive."""
    gt = [GroundTruthInterval(start_frame=50, end_frame=60, label="jab", id="0")]

    # Just outside left: 46 (50 - 4) -> No match
    res_46 = match_bipartite_predictions(gt, [PunchPrediction(impact_frame=46)])
    assert res_46.tp == 0
    assert res_46.fn == 1

    # Exact left boundary: 47 (50 - 3) -> Match
    res_47 = match_bipartite_predictions(gt, [PunchPrediction(impact_frame=47)])
    assert res_47.tp == 1
    assert res_47.fn == 0

    # Inside interval: 55 -> Match
    res_55 = match_bipartite_predictions(gt, [PunchPrediction(impact_frame=55)])
    assert res_55.tp == 1
    assert res_55.fn == 0

    # Exact right boundary: 63 (60 + 3) -> Match
    res_63 = match_bipartite_predictions(gt, [PunchPrediction(impact_frame=63)])
    assert res_63.tp == 1
    assert res_63.fn == 0

    # Just outside right: 64 (60 + 4) -> No match
    res_64 = match_bipartite_predictions(gt, [PunchPrediction(impact_frame=64)])
    assert res_64.tp == 0
    assert res_64.fn == 1


def test_duplicate_detection_counting():
    """Verify multiple predictions landing in the same GT interval are counted as duplicates."""
    gt = [GroundTruthInterval(start_frame=100, end_frame=110, label="cross", id="0")]
    preds = [
        PunchPrediction(impact_frame=102, id="p0"),
        PunchPrediction(impact_frame=105, id="p1"),
        PunchPrediction(impact_frame=108, id="p2"),
    ]

    result = match_bipartite_predictions(gt, preds)
    assert result.tp == 1
    assert result.fn == 0
    # Exactly one matched (the one closest to midpoint 105, which is p1)
    assert result.matches[0]["impact_frame"] == 105
    # The other 2 are unmatched
    assert len(result.unmatched_predictions) == 2
    # The ground truth interval has 3 candidate detections -> duplicate
    assert result.duplicate_intervals_count == 1
    assert "0" in result.duplicate_gt_ids


def test_unverified_excess_vs_false_positives():
    """Ensure unmatched predictions on BoxingVI are reported as unverified excess, not FP."""
    truth = [GroundTruthInterval(start_frame=10, end_frame=20, label="jab", id="0")]
    preds = [
        PunchPrediction(impact_frame=15, id="p0"),
        PunchPrediction(impact_frame=100, id="p1"),  # Unmatched
        PunchPrediction(impact_frame=200, id="p2"),  # Unmatched
    ]

    # Mode validation / DEV-2
    eval_val = evaluate_punch_recall(truth, preds, dataset_kind="dev2_validation", total_frames=1000)
    assert eval_val["tp"] == 1
    assert eval_val["fp"] == 2
    assert eval_val["fn"] == 0
    assert eval_val["unverified_excess"] == 0

    # Mode BoxingVI / test
    eval_bvi = evaluate_punch_recall(truth, preds, dataset_kind="boxingvi", total_frames=1000)
    assert eval_bvi["tp"] == 1
    assert eval_bvi["fp"] is None
    assert eval_bvi["fn"] == 0
    assert eval_bvi["unverified_excess"] == 2
    assert eval_bvi["unverified_excess_per_1000_frames"] == 2.0


def test_recall_calculation_and_empty_edge_cases():
    """Verify aggregate recall and edge cases with empty predictions or annotations."""
    truth = [
        GroundTruthInterval(start_frame=i * 20, end_frame=i * 20 + 10, id=str(i))
        for i in range(10)
    ]
    # Predict only 4 of them
    preds = [PunchPrediction(impact_frame=i * 20 + 5) for i in range(4)]

    res = match_bipartite_predictions(truth, preds)
    assert res.tp == 4
    assert res.fn == 6
    assert pytest.approx(res.recall, 0.001) == 0.40

    # Empty predictions
    empty_preds = match_bipartite_predictions(truth, [])
    assert empty_preds.tp == 0
    assert empty_preds.fn == 10
    assert empty_preds.recall == 0.0

    # Empty truth
    empty_truth = match_bipartite_predictions([], preds)
    assert empty_truth.tp == 0
    assert empty_truth.fn == 0
    assert empty_truth.recall == 1.0
