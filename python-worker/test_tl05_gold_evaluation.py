"""
test_tl05_gold_evaluation.py — Comprehensive Test Suite for Task TL-05 Gold Evaluation Runner
"""

import pytest
from pipeline.contracts import ValidationStatus
from pipeline.gold_evaluation_runner import (
    AbstentionReport,
    ApprovedThresholdRecord,
    ClassMetricReport,
    ConfusionMatrixReport,
    CriteriaAgreementReport,
    GoldActionSample,
    GoldEvaluationReport,
    GoldEvaluationRunner,
    PredictedActionSample,
    SliceEvaluationReport,
    SplitLeakageAuditComprehensive,
    TemporalErrorReport,
    compute_cohen_kappa,
    validate_dataset_split_leakage,
)
from pipeline.mvp_technique_discovery import MVP_TECHNIQUES


def test_split_leakage_athlete_and_video():
    # 1. Athlete overlap
    samples_athlete_leak = [
        GoldActionSample(
            sample_id="s1", athlete_id="ath_1", source_video_id="vid_1",
            technique="jab", stance="orthodox", camera_view="front",
            target_type="heavy_bag", pose_quality="acceptable",
            start_frame=10, peak_frame=20, end_frame=30, split="train",
        ),
        GoldActionSample(
            sample_id="s2", athlete_id="ath_1", source_video_id="vid_2",
            technique="jab", stance="orthodox", camera_view="front",
            target_type="heavy_bag", pose_quality="acceptable",
            start_frame=10, peak_frame=20, end_frame=30, split="test",
        ),
    ]
    audit_ath = validate_dataset_split_leakage(samples_athlete_leak)
    assert audit_ath.has_leakage is True
    assert "ath_1" in audit_ath.overlapping_athlete_ids

    # 2. Video overlap
    samples_vid_leak = [
        GoldActionSample(
            sample_id="s1", athlete_id="ath_1", source_video_id="vid_common",
            technique="cross", stance="orthodox", camera_view="front",
            target_type="heavy_bag", pose_quality="acceptable",
            start_frame=10, peak_frame=20, end_frame=30, split="train",
        ),
        GoldActionSample(
            sample_id="s2", athlete_id="ath_2", source_video_id="vid_common",
            technique="cross", stance="orthodox", camera_view="front",
            target_type="heavy_bag", pose_quality="acceptable",
            start_frame=40, peak_frame=50, end_frame=60, split="test",
        ),
    ]
    audit_vid = validate_dataset_split_leakage(samples_vid_leak)
    assert audit_vid.has_leakage is True
    assert "vid_common" in audit_vid.overlapping_video_ids

    # 3. Clean split
    samples_clean = [
        GoldActionSample(
            sample_id="s1", athlete_id="ath_1", source_video_id="vid_1",
            technique="jab", stance="orthodox", camera_view="front",
            target_type="heavy_bag", pose_quality="acceptable",
            start_frame=10, peak_frame=20, end_frame=30, split="train",
        ),
        GoldActionSample(
            sample_id="s2", athlete_id="ath_2", source_video_id="vid_2",
            technique="cross", stance="southpaw", camera_view="side_left",
            target_type="pads", pose_quality="acceptable",
            start_frame=10, peak_frame=20, end_frame=30, split="test",
        ),
    ]
    audit_clean = validate_dataset_split_leakage(samples_clean)
    assert audit_clean.has_leakage is False
    assert len(audit_clean.overlapping_athlete_ids) == 0
    assert len(audit_clean.overlapping_video_ids) == 0


def test_cohen_kappa_computation():
    # Perfect agreement
    y_t = [True, False, True, True, False]
    y_p = [True, False, True, True, False]
    pa, kappa = compute_cohen_kappa(y_t, y_p)
    assert pa == 1.0
    assert kappa == 1.0

    # Partial agreement
    y_t2 = [True, True, True, False, False]
    y_p2 = [True, True, False, True, False]
    pa2, kappa2 = compute_cohen_kappa(y_t2, y_p2)
    assert pa2 == 0.6
    assert kappa2 is not None

    # Length mismatch raises
    with pytest.raises(ValueError, match="Inputs must have identical length"):
        compute_cohen_kappa([1, 2], [1])


def test_zero_invented_thresholds_enforced():
    runner = GoldEvaluationRunner(min_support_per_slice=5)
    gold = [
        GoldActionSample(
            sample_id="s1", athlete_id="ath_1", source_video_id="vid_1",
            technique="jab", stance="orthodox", camera_view="front",
            target_type="heavy_bag", pose_quality="acceptable",
            start_frame=10, peak_frame=20, end_frame=30, split="test",
            is_coach_approved=True,
        )
    ]
    pred = [
        PredictedActionSample(
            sample_id="s1", is_detected=True, predicted_technique="jab",
            start_frame=10, peak_frame=20, end_frame=30,
        )
    ]
    # Missing threshold_record -> MUST return NOT_EVALUABLE
    report = runner.evaluate(gold, pred, threshold_record=None)
    assert report.status == ValidationStatus.NOT_EVALUABLE
    assert "No authoritative ApprovedThresholdRecord provided" in report.status_reason


def test_unapproved_gold_labels_fail_closed():
    runner = GoldEvaluationRunner(min_support_per_slice=5)
    gold = [
        GoldActionSample(
            sample_id="s1", athlete_id="ath_1", source_video_id="vid_1",
            technique="jab", stance="orthodox", camera_view="front",
            target_type="heavy_bag", pose_quality="acceptable",
            start_frame=10, peak_frame=20, end_frame=30, split="test",
            is_coach_approved=False,  # Unapproved!
        )
    ]
    pred = [
        PredictedActionSample(
            sample_id="s1", is_detected=True, predicted_technique="jab",
        )
    ]
    thresh = ApprovedThresholdRecord(
        record_id="rec_nfr_006",
        source_document="docs/MMA-TMS-MASTER-SPECIFICATION-v3.md#NFR-AI-006",
        approved_by="Head Coach",
        approval_date="2026-03-01",
        min_precision=0.75,
        min_recall=0.70,
        min_support_per_class=1,
    )
    report = runner.evaluate(gold, pred, threshold_record=thresh)
    assert report.status == ValidationStatus.NOT_EVALUABLE
    assert "unapproved samples" in report.status_reason


def test_split_leakage_blocks_evaluation():
    runner = GoldEvaluationRunner(min_support_per_slice=5)
    gold = [
        GoldActionSample(
            sample_id="s1", athlete_id="ath_1", source_video_id="vid_1",
            technique="jab", stance="orthodox", camera_view="front",
            target_type="heavy_bag", pose_quality="acceptable",
            start_frame=10, peak_frame=20, end_frame=30, split="train",
            is_coach_approved=True,
        ),
        GoldActionSample(
            sample_id="s2", athlete_id="ath_1", source_video_id="vid_2",
            technique="jab", stance="orthodox", camera_view="front",
            target_type="heavy_bag", pose_quality="acceptable",
            start_frame=10, peak_frame=20, end_frame=30, split="test",
            is_coach_approved=True,
        ),
    ]
    pred = [
        PredictedActionSample(sample_id="s1"),
        PredictedActionSample(sample_id="s2", is_detected=True, predicted_technique="jab"),
    ]
    thresh = ApprovedThresholdRecord(
        record_id="rec_nfr_006",
        source_document="docs/MMA-TMS-MASTER-SPECIFICATION-v3.md#NFR-AI-006",
        approved_by="Head Coach",
        approval_date="2026-03-01",
        min_precision=0.75,
        min_recall=0.70,
        min_support_per_class=1,
    )
    report = runner.evaluate(gold, pred, threshold_record=thresh)
    assert report.status == ValidationStatus.NOT_EVALUABLE
    assert "Split leakage detected" in report.status_reason


def test_comprehensive_evaluation_all_mvp_classes():
    runner = GoldEvaluationRunner(min_support_per_slice=5)
    techniques = list(MVP_TECHNIQUES)  # 6 MVP classes
    gold_samples = []
    pred_samples = []

    # Create 10 samples for each MVP technique + 10 negative class samples
    # Total = 60 MVP + 10 negative = 70 samples in test split
    # Distribute across stances, camera views, target types, qualities, and athletes
    stances = ["orthodox", "southpaw"]
    views = ["front", "side_left", "side_right", "angle_45"]
    targets = ["heavy_bag", "pads", "air", "opponent"]
    qualities = ["acceptable", "degraded"]

    sid = 0
    for tech in techniques:
        for i in range(10):
            sid += 1
            sample_id = f"samp_{sid}"
            ath_id = f"athlete_{i % 5 + 10}"  # distinct from train
            vid_id = f"video_{i % 5 + 10}"
            gold_samples.append(
                GoldActionSample(
                    sample_id=sample_id,
                    athlete_id=ath_id,
                    source_video_id=vid_id,
                    technique=tech,
                    stance=stances[i % 2],
                    camera_view=views[i % 4],
                    target_type=targets[i % 4],
                    pose_quality=qualities[i % 2],
                    start_frame=100 + i * 5,
                    peak_frame=115 + i * 5,
                    end_frame=130 + i * 5,
                    assessment_criteria={"guard_maintained": (i % 2 == 0), "chin_tucked": True},
                    is_coach_approved=True,
                    split="test",
                    is_unseen_athlete=(i >= 8),
                )
            )
            # High quality prediction: 9 out of 10 correct, 1 misclassified
            if i == 0:
                # 1 abstained
                pred_samples.append(
                    PredictedActionSample(
                        sample_id=sample_id,
                        is_detected=True,
                        is_abstained=True,
                        predicted_technique=None,
                        predicted_criteria={},
                    )
                )
            else:
                pred_samples.append(
                    PredictedActionSample(
                        sample_id=sample_id,
                        is_detected=True,
                        is_abstained=False,
                        predicted_technique=tech,
                        start_frame=102 + i * 5,  # 2 frames error
                        peak_frame=116 + i * 5,   # 1 frame error
                        end_frame=131 + i * 5,    # 1 frame error
                        confidence=0.92,
                        predicted_criteria={"guard_maintained": (i % 2 == 0), "chin_tucked": True},
                    )
                )

    # Add 10 negative samples (e.g. parry, block, feint)
    for i in range(10):
        sid += 1
        sample_id = f"samp_{sid}"
        ath_id = f"athlete_{i % 5 + 10}"
        vid_id = f"video_{i % 5 + 10}"
        gold_samples.append(
            GoldActionSample(
                sample_id=sample_id,
                athlete_id=ath_id,
                source_video_id=vid_id,
                technique="block",
                stance="orthodox",
                camera_view="front",
                target_type="air",
                pose_quality="acceptable",
                start_frame=50,
                peak_frame=60,
                end_frame=70,
                assessment_criteria={},
                is_coach_approved=True,
                split="test",
            )
        )
        # Correctly rejected as negative
        pred_samples.append(
            PredictedActionSample(
                sample_id=sample_id,
                is_detected=False,
                predicted_technique=None,
            )
        )

    thresh = ApprovedThresholdRecord(
        record_id="rec_nfr_006",
        source_document="docs/MMA-TMS-MASTER-SPECIFICATION-v3.md#NFR-AI-006",
        approved_by="Head Coach & Lead Biomechanist",
        approval_date="2026-03-01",
        min_precision=0.75,
        min_recall=0.70,
        min_support_per_class=10,
    )

    report = runner.evaluate(gold_samples, pred_samples, threshold_record=thresh)

    # 1. Status verification
    assert report.status == ValidationStatus.VALIDATED
    assert "Met approved threshold targets" in report.status_reason

    # 2. Event detection metrics
    det_prec = report.detection_metrics["detection_precision"].value
    det_rec = report.detection_metrics["detection_recall"].value
    assert det_prec == 1.0  # Zero false positives on negative classes
    assert det_rec == 54 / 60  # 6 abstained
    assert report.detection_metrics["detection_f1"].value > 0.90

    # 3. Temporal error
    assert report.temporal_error.start_mae == 2.0
    assert report.temporal_error.peak_mae == 1.0
    assert report.temporal_error.end_mae == 1.0
    assert report.temporal_error.support_count == 54

    # 4. Per-class metrics & Macro-F1
    for tech in MVP_TECHNIQUES:
        m = report.per_class_metrics[tech]
        assert m.support_count == 10
        assert m.true_positives == 9
        assert m.false_negatives == 1  # the abstained one
        assert m.false_positives == 0
        assert m.precision == 1.0
        assert m.recall == 0.9
        assert m.f1_score is not None and m.f1_score > 0.90

    assert report.macro_f1 is not None
    assert round(report.macro_f1, 2) == 0.95

    # 5. Confusion matrix
    cm = report.confusion_matrix
    assert "jab" in cm.classes
    assert "abstained" in cm.classes
    assert cm.abstained_by_class["jab"] == 1
    assert cm.abstained_by_class["cross"] == 1

    # 6. Abstention metrics
    assert report.abstention_metrics.total_samples == 70
    assert report.abstention_metrics.abstained_count == 6
    assert round(report.abstention_metrics.abstention_rate, 2) == round(6 / 70, 2)
    assert report.abstention_metrics.error_rate_after_abstention == 0.0  # all non-abstained were correct

    # 7. Slices
    assert "by_stance" in report.slices
    assert "orthodox" in report.slices["by_stance"]
    assert "southpaw" in report.slices["by_stance"]
    assert "by_camera_view" in report.slices
    assert "front" in report.slices["by_camera_view"]
    assert "by_unseen_athlete" in report.slices
    assert "unseen" in report.slices["by_unseen_athlete"]

    # 8. AI-Coach agreement
    guard_rep = report.criteria_agreement["guard_maintained"]
    assert guard_rep.percent_agreement == 1.0
    assert guard_rep.cohen_kappa == 1.0

    # 9. Serialization check
    d = report.to_dict()
    assert d["status"] == "VALIDATED"
    assert d["macroF1"] is not None
    assert d["abstentionMetrics"]["abstainedCount"] == 6
    assert d["thresholdRecord"]["recordId"] == "rec_nfr_006"


def test_failing_thresholds_mark_needs_review():
    runner = GoldEvaluationRunner(min_support_per_slice=1)
    gold = []
    pred = []
    for i, tech in enumerate(MVP_TECHNIQUES):
        sid = f"s_{tech}"
        gold.append(
            GoldActionSample(
                sample_id=sid, athlete_id=f"ath_{i+1}", source_video_id=f"vid_{i+1}",
                technique=tech, stance="orthodox", camera_view="front",
                target_type="heavy_bag", pose_quality="acceptable",
                start_frame=10, peak_frame=20, end_frame=30, split="test",
                is_coach_approved=True,
            )
        )
        # All detected as negative -> 0% recall
        pred.append(PredictedActionSample(sample_id=sid, is_detected=False))

    thresh = ApprovedThresholdRecord(
        record_id="rec_nfr_006",
        source_document="docs/MMA-TMS-MASTER-SPECIFICATION-v3.md#NFR-AI-006",
        approved_by="Head Coach",
        approval_date="2026-03-01",
        min_precision=0.75,
        min_recall=0.70,
        min_support_per_class=1,
    )
    report = runner.evaluate(gold, pred, threshold_record=thresh)
    assert report.status == ValidationStatus.REJECTED
    assert "Failed threshold requirements" in report.status_reason
