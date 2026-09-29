"""
gold_evaluation_runner.py — Leakage-Safe Gold Evaluation Runner for MVP Classes (Task TL-05)

Implements:
- Strict split leakage detection partitioned by both athlete ID and source video ID.
- Event detection metrics (Precision, Recall, F1 with Wilson score confidence intervals).
- Temporal error calculation (Start, Peak, End frame MAE and RMSE).
- Per-class classification metrics (TP, FP, FN, TN, Precision, Recall, F1) and Macro-F1 across MVP classes.
- Confusion matrix across MVP techniques, negative classes, and abstentions.
- Disaggregated slice evaluation:
  * By stance (orthodox, southpaw)
  * By camera view (front, side_left, side_right, angle_45)
  * By target type (heavy_bag, pads, air, opponent)
  * By pose quality (acceptable, degraded, blocked)
  * By unseen athletes (held-out athletes not present in train/baseline sets)
- Abstention metrics:
  * Abstention rate
  * Error rate after abstention
  * Raw error rate
- AI–coach agreement on technique assessment criteria (Percent Agreement & Cohen's Kappa).
- Strict fail-closed governance:
  * Zero invented thresholds: Requires an authoritative ApprovedThresholdRecord.
  * Returns NOT_EVALUABLE if data is unapproved, sample support is insufficient, or split leakage occurs.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Mapping, Optional, Sequence

from pipeline.contracts import ValidationStatus, deep_freeze, to_json_safe
from pipeline.evaluation_protocol import calculate_wilson_interval, EvaluationMetricResult
from pipeline.mvp_technique_discovery import MVP_TECHNIQUES, NEGATIVE_CLASSES


@dataclass(frozen=True)
class SplitLeakageAuditComprehensive:
    """Audit result verifying athlete and video isolation across train, val, and test splits."""
    has_leakage: bool
    overlapping_athlete_ids: tuple[str, ...]
    overlapping_video_ids: tuple[str, ...]
    train_athlete_count: int
    val_athlete_count: int
    test_athlete_count: int
    train_video_count: int
    val_video_count: int
    test_video_count: int
    details: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "hasLeakage": self.has_leakage,
            "overlappingAthleteIds": list(self.overlapping_athlete_ids),
            "overlappingVideoIds": list(self.overlapping_video_ids),
            "trainAthleteCount": self.train_athlete_count,
            "valAthleteCount": self.val_athlete_count,
            "testAthleteCount": self.test_athlete_count,
            "trainVideoCount": self.train_video_count,
            "valVideoCount": self.val_video_count,
            "testVideoCount": self.test_video_count,
            "details": self.details,
        }


@dataclass(frozen=True)
class GoldActionSample:
    """Authoritative ground-truth sample for evaluation."""
    sample_id: str
    athlete_id: str
    source_video_id: str
    technique: str
    stance: str
    camera_view: str
    target_type: str
    pose_quality: str
    start_frame: int
    peak_frame: int
    end_frame: int
    assessment_criteria: Mapping[str, Any] = field(default_factory=dict)
    is_coach_approved: bool = True
    split: str = "test"  # "train", "val", "test"
    is_unseen_athlete: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "sampleId": self.sample_id,
            "athleteId": self.athlete_id,
            "sourceVideoId": self.source_video_id,
            "technique": self.technique,
            "stance": self.stance,
            "cameraView": self.camera_view,
            "targetType": self.target_type,
            "poseQuality": self.pose_quality,
            "startFrame": self.start_frame,
            "peakFrame": self.peak_frame,
            "endFrame": self.end_frame,
            "assessmentCriteria": dict(self.assessment_criteria),
            "isCoachApproved": self.is_coach_approved,
            "split": self.split,
            "isUnseenAthlete": self.is_unseen_athlete,
        }


@dataclass(frozen=True)
class PredictedActionSample:
    """Prediction output from pipeline or classifier corresponding to a gold sample."""
    sample_id: str
    is_detected: bool = True
    predicted_technique: Optional[str] = None
    is_abstained: bool = False
    start_frame: Optional[int] = None
    peak_frame: Optional[int] = None
    end_frame: Optional[int] = None
    confidence: float = 1.0
    predicted_criteria: Mapping[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "sampleId": self.sample_id,
            "isDetected": self.is_detected,
            "predictedTechnique": self.predicted_technique,
            "isAbstained": self.is_abstained,
            "startFrame": self.start_frame,
            "peakFrame": self.peak_frame,
            "endFrame": self.end_frame,
            "confidence": round(self.confidence, 4),
            "predictedCriteria": dict(self.predicted_criteria),
        }


@dataclass(frozen=True)
class ApprovedThresholdRecord:
    """Authoritative non-functional requirement thresholds signed off by coach or product."""
    record_id: str
    source_document: str
    approved_by: str
    approval_date: str
    min_precision: float
    min_recall: float
    min_macro_f1: Optional[float] = None
    min_support_per_class: int = 30
    min_agreement_kappa: Optional[float] = None
    max_temporal_error_frames: Optional[float] = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "recordId": self.record_id,
            "sourceDocument": self.source_document,
            "approvedBy": self.approved_by,
            "approvalDate": self.approval_date,
            "minPrecision": self.min_precision,
            "minRecall": self.min_recall,
            "minMacroF1": self.min_macro_f1,
            "minSupportPerClass": self.min_support_per_class,
            "minAgreementKappa": self.min_agreement_kappa,
            "maxTemporalErrorFrames": self.max_temporal_error_frames,
        }


@dataclass(frozen=True)
class TemporalErrorReport:
    """Temporal boundary error metrics (MAE and RMSE in frames)."""
    start_mae: Optional[float]
    start_rmse: Optional[float]
    peak_mae: Optional[float]
    peak_rmse: Optional[float]
    end_mae: Optional[float]
    end_rmse: Optional[float]
    support_count: int

    def to_dict(self) -> dict[str, Any]:
        return {
            "startMae": round(self.start_mae, 2) if self.start_mae is not None else None,
            "startRmse": round(self.start_rmse, 2) if self.start_rmse is not None else None,
            "peakMae": round(self.peak_mae, 2) if self.peak_mae is not None else None,
            "peakRmse": round(self.peak_rmse, 2) if self.peak_rmse is not None else None,
            "endMae": round(self.end_mae, 2) if self.end_mae is not None else None,
            "endRmse": round(self.end_rmse, 2) if self.end_rmse is not None else None,
            "supportCount": self.support_count,
        }


@dataclass(frozen=True)
class ClassMetricReport:
    """Per-class binary classification performance."""
    technique: str
    true_positives: int
    false_positives: int
    false_negatives: int
    true_negatives: int
    support_count: int
    precision: Optional[float]
    recall: Optional[float]
    f1_score: Optional[float]
    ci_precision: Optional[tuple[float, float]] = None
    ci_recall: Optional[tuple[float, float]] = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "technique": self.technique,
            "truePositives": self.true_positives,
            "falsePositives": self.false_positives,
            "falseNegatives": self.false_negatives,
            "trueNegatives": self.true_negatives,
            "supportCount": self.support_count,
            "precision": round(self.precision, 4) if self.precision is not None else None,
            "recall": round(self.recall, 4) if self.recall is not None else None,
            "f1Score": round(self.f1_score, 4) if self.f1_score is not None else None,
            "ciPrecision": self.ci_precision,
            "ciRecall": self.ci_recall,
        }


@dataclass(frozen=True)
class ConfusionMatrixReport:
    """Multi-class confusion matrix including abstentions."""
    classes: tuple[str, ...]
    matrix: tuple[tuple[int, ...], ...]
    abstained_by_class: Mapping[str, int]

    def to_dict(self) -> dict[str, Any]:
        return {
            "classes": list(self.classes),
            "matrix": [list(row) for row in self.matrix],
            "abstainedByClass": dict(self.abstained_by_class),
        }


@dataclass(frozen=True)
class AbstentionReport:
    """Abstention rate and post-abstention error characteristics."""
    total_samples: int
    abstained_count: int
    abstention_rate: float
    error_rate_after_abstention: float
    raw_error_rate: float

    def to_dict(self) -> dict[str, Any]:
        return {
            "totalSamples": self.total_samples,
            "abstainedCount": self.abstained_count,
            "abstentionRate": round(self.abstention_rate, 4),
            "errorRateAfterAbstention": round(self.error_rate_after_abstention, 4),
            "rawErrorRate": round(self.raw_error_rate, 4),
        }


@dataclass(frozen=True)
class CriteriaAgreementReport:
    """Agreement between AI rubric scoring and ground-truth coach assessment."""
    criterion_name: str
    support_count: int
    percent_agreement: float
    cohen_kappa: Optional[float]

    def to_dict(self) -> dict[str, Any]:
        return {
            "criterionName": self.criterion_name,
            "supportCount": self.support_count,
            "percentAgreement": round(self.percent_agreement, 4),
            "cohenKappa": round(self.cohen_kappa, 4) if self.cohen_kappa is not None else None,
        }


@dataclass(frozen=True)
class SliceEvaluationReport:
    """Performance metrics evaluated on a specific slice of the test data."""
    slice_dimension: str
    slice_value: str
    sample_count: int
    precision: Optional[float]
    recall: Optional[float]
    f1_score: Optional[float]
    is_sufficiently_supported: bool

    def to_dict(self) -> dict[str, Any]:
        return {
            "sliceDimension": self.slice_dimension,
            "sliceValue": self.slice_value,
            "sampleCount": self.sample_count,
            "precision": round(self.precision, 4) if self.precision is not None else None,
            "recall": round(self.recall, 4) if self.recall is not None else None,
            "f1Score": round(self.f1_score, 4) if self.f1_score is not None else None,
            "isSufficientlySupported": self.is_sufficiently_supported,
        }


@dataclass(frozen=True)
class GoldEvaluationReport:
    """Comprehensive evaluation report for MVP AI models under release governance."""
    report_id: str
    protocol_version: str
    status: ValidationStatus
    status_reason: str
    leakage_audit: SplitLeakageAuditComprehensive
    detection_metrics: Mapping[str, EvaluationMetricResult]
    temporal_error: TemporalErrorReport
    per_class_metrics: Mapping[str, ClassMetricReport]
    macro_f1: Optional[float]
    confusion_matrix: ConfusionMatrixReport
    slices: Mapping[str, Mapping[str, SliceEvaluationReport]]
    abstention_metrics: AbstentionReport
    criteria_agreement: Mapping[str, CriteriaAgreementReport]
    threshold_record: Optional[ApprovedThresholdRecord] = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "reportId": self.report_id,
            "protocolVersion": self.protocol_version,
            "status": self.status.value,
            "statusReason": self.status_reason,
            "leakageAudit": self.leakage_audit.to_dict(),
            "detectionMetrics": {k: v.to_dict() for k, v in self.detection_metrics.items()},
            "temporalError": self.temporal_error.to_dict(),
            "perClassMetrics": {k: v.to_dict() for k, v in self.per_class_metrics.items()},
            "macroF1": round(self.macro_f1, 4) if self.macro_f1 is not None else None,
            "confusionMatrix": self.confusion_matrix.to_dict(),
            "slices": {dim: {val: rep.to_dict() for val, rep in val_map.items()} for dim, val_map in self.slices.items()},
            "abstentionMetrics": self.abstention_metrics.to_dict(),
            "criteriaAgreement": {k: v.to_dict() for k, v in self.criteria_agreement.items()},
            "thresholdRecord": self.threshold_record.to_dict() if self.threshold_record is not None else None,
        }


def validate_dataset_split_leakage(samples: Sequence[GoldActionSample]) -> SplitLeakageAuditComprehensive:
    """Validates that train, val, and test splits have zero athlete or video overlap."""
    train_athletes: set[str] = set()
    val_athletes: set[str] = set()
    test_athletes: set[str] = set()

    train_videos: set[str] = set()
    val_videos: set[str] = set()
    test_videos: set[str] = set()

    for s in samples:
        split = (s.split or "test").lower()
        if split == "train":
            train_athletes.add(s.athlete_id)
            train_videos.add(s.source_video_id)
        elif split == "val":
            val_athletes.add(s.athlete_id)
            val_videos.add(s.source_video_id)
        else:
            test_athletes.add(s.athlete_id)
            test_videos.add(s.source_video_id)

    athlete_overlap = sorted(list(
        (train_athletes & test_athletes)
        | (val_athletes & test_athletes)
        | (train_athletes & val_athletes)
    ))
    video_overlap = sorted(list(
        (train_videos & test_videos)
        | (val_videos & test_videos)
        | (train_videos & val_videos)
    ))

    has_leakage = len(athlete_overlap) > 0 or len(video_overlap) > 0

    if has_leakage:
        reasons = []
        if athlete_overlap:
            reasons.append(f"athlete overlap: {athlete_overlap}")
        if video_overlap:
            reasons.append(f"source video overlap: {video_overlap}")
        details = f"Leakage detected: {'; '.join(reasons)}"
    else:
        details = "Zero athlete or source video leakage detected across splits."

    return SplitLeakageAuditComprehensive(
        has_leakage=has_leakage,
        overlapping_athlete_ids=tuple(athlete_overlap),
        overlapping_video_ids=tuple(video_overlap),
        train_athlete_count=len(train_athletes),
        val_athlete_count=len(val_athletes),
        test_athlete_count=len(test_athletes),
        train_video_count=len(train_videos),
        val_video_count=len(val_videos),
        test_video_count=len(test_videos),
        details=details,
    )


def compute_cohen_kappa(y_true: Sequence[Any], y_pred: Sequence[Any]) -> tuple[float, Optional[float]]:
    """Calculates percent agreement and Cohen's Kappa between two raters."""
    if len(y_true) != len(y_pred):
        raise ValueError("Inputs must have identical length")
    n = len(y_true)
    if n == 0:
        return 0.0, None

    agreed = sum(1 for yt, yp in zip(y_true, y_pred) if yt == yp)
    po = agreed / n

    # Unique categories
    categories = sorted(list(set(y_true) | set(y_pred)))
    if len(categories) <= 1:
        return po, 1.0 if po == 1.0 else 0.0

    # Expected chance agreement
    pe = sum(
        (sum(1 for yt in y_true if yt == c) / n) * (sum(1 for yp in y_pred if yp == c) / n)
        for c in categories
    )

    if math.isclose(pe, 1.0, rel_tol=1e-5):
        kappa = 1.0 if math.isclose(po, 1.0, rel_tol=1e-5) else 0.0
    else:
        kappa = (po - pe) / (1.0 - pe)

    return po, kappa


class GoldEvaluationRunner:
    """Leakage-safe evaluation runner executing gold benchmarking for MVP classes."""

    PROTOCOL_VERSION = "2.0.0"

    def __init__(self, min_support_per_slice: int = 30):
        self.min_support_per_slice = min_support_per_slice

    def evaluate(
        self,
        gold_samples: Sequence[GoldActionSample],
        predictions: Sequence[PredictedActionSample],
        threshold_record: Optional[ApprovedThresholdRecord] = None,
        report_id: str = "eval_gold_mvp_run",
    ) -> GoldEvaluationReport:
        """Executes full evaluation on matched gold samples and predictions."""
        # Validate matching
        pred_map = {p.sample_id: p for p in predictions}
        unmatched_gold = [g.sample_id for g in gold_samples if g.sample_id not in pred_map]
        if unmatched_gold:
            raise ValueError(f"Found {len(unmatched_gold)} gold samples without matching predictions")

        # 1. Leakage Audit
        leakage_audit = validate_dataset_split_leakage(gold_samples)

        # Filter test split for evaluation
        test_pairs = [
            (g, pred_map[g.sample_id])
            for g in gold_samples
            if (g.split or "test").lower() == "test"
        ]

        # Check coach approval
        unapproved_count = sum(1 for g, _ in test_pairs if not g.is_coach_approved)

        # Fail-closed preconditions check
        if leakage_audit.has_leakage:
            status = ValidationStatus.NOT_EVALUABLE
            reason = f"Split leakage detected: {leakage_audit.details}"
        elif unapproved_count > 0:
            status = ValidationStatus.NOT_EVALUABLE
            reason = f"Test dataset contains {unapproved_count} unapproved samples. Coach approval required."
        elif threshold_record is None:
            status = ValidationStatus.NOT_EVALUABLE
            reason = "No authoritative ApprovedThresholdRecord provided. Zero invented thresholds allowed."
        elif len(test_pairs) == 0:
            status = ValidationStatus.NOT_EVALUABLE
            reason = "Test split contains zero samples."
        else:
            status = None
            reason = ""

        # 2. Event Detection Metrics (Strike vs Negative / Background)
        # Gold is positive if technique is in MVP_TECHNIQUES
        detection_y_true = [1 if g.technique in MVP_TECHNIQUES else 0 for g, _ in test_pairs]
        detection_y_pred = [1 if (p.is_detected and not p.is_abstained and p.predicted_technique in MVP_TECHNIQUES) else 0 for _, p in test_pairs]
        abstained_count = sum(1 for _, p in test_pairs if p.is_abstained)

        tp_det = sum(1 for yt, yp in zip(detection_y_true, detection_y_pred) if yt == 1 and yp == 1)
        fp_det = sum(1 for yt, yp in zip(detection_y_true, detection_y_pred) if yt == 0 and yp == 1)
        fn_det = sum(1 for yt, yp in zip(detection_y_true, detection_y_pred) if yt == 1 and yp == 0)

        pred_pos_det = tp_det + fp_det
        actual_pos_det = tp_det + fn_det

        det_prec = (tp_det / pred_pos_det) if pred_pos_det > 0 else None
        det_rec = (tp_det / actual_pos_det) if actual_pos_det > 0 else None
        det_f1 = (2.0 * det_prec * det_rec / (det_prec + det_rec)) if (det_prec and det_rec and (det_prec + det_rec) > 0) else None

        ci_prec = calculate_wilson_interval(tp_det, pred_pos_det) if pred_pos_det > 0 else (None, None)
        ci_rec = calculate_wilson_interval(tp_det, actual_pos_det) if actual_pos_det > 0 else (None, None)

        detection_metrics = {
            "detection_precision": EvaluationMetricResult(
                metric_name="detection_precision",
                value=det_prec,
                support_count=pred_pos_det,
                ci_low=ci_prec[0],
                ci_high=ci_prec[1],
                status=ValidationStatus.VALIDATED if det_prec is not None else ValidationStatus.NOT_EVALUABLE,
            ),
            "detection_recall": EvaluationMetricResult(
                metric_name="detection_recall",
                value=det_rec,
                support_count=actual_pos_det,
                ci_low=ci_rec[0],
                ci_high=ci_rec[1],
                status=ValidationStatus.VALIDATED if det_rec is not None else ValidationStatus.NOT_EVALUABLE,
            ),
            "detection_f1": EvaluationMetricResult(
                metric_name="detection_f1",
                value=det_f1,
                support_count=actual_pos_det,
                status=ValidationStatus.VALIDATED if det_f1 is not None else ValidationStatus.NOT_EVALUABLE,
            ),
        }

        # 3. Temporal Error (Start, Peak, End frame MAE & RMSE)
        # Evaluated on true positive detection events where predicted frames are present
        start_errs: list[float] = []
        peak_errs: list[float] = []
        end_errs: list[float] = []

        for g, p in test_pairs:
            if g.technique in MVP_TECHNIQUES and p.is_detected and not p.is_abstained:
                if p.start_frame is not None:
                    start_errs.append(abs(p.start_frame - g.start_frame))
                if p.peak_frame is not None:
                    peak_errs.append(abs(p.peak_frame - g.peak_frame))
                if p.end_frame is not None:
                    end_errs.append(abs(p.end_frame - g.end_frame))

        temporal_error = TemporalErrorReport(
            start_mae=(sum(start_errs) / len(start_errs)) if start_errs else None,
            start_rmse=math.sqrt(sum(e * e for e in start_errs) / len(start_errs)) if start_errs else None,
            peak_mae=(sum(peak_errs) / len(peak_errs)) if peak_errs else None,
            peak_rmse=math.sqrt(sum(e * e for e in peak_errs) / len(peak_errs)) if peak_errs else None,
            end_mae=(sum(end_errs) / len(end_errs)) if end_errs else None,
            end_rmse=math.sqrt(sum(e * e for e in end_errs) / len(end_errs)) if end_errs else None,
            support_count=len(start_errs),
        )

        # 4. Per-Class Metrics and Macro-F1 across MVP Techniques
        per_class_metrics: dict[str, ClassMetricReport] = {}
        all_eval_classes = list(MVP_TECHNIQUES) + ["negative"]

        for cls_name in all_eval_classes:
            is_neg = cls_name == "negative"
            tp = 0
            fp = 0
            fn = 0
            tn = 0
            support = 0

            for g, p in test_pairs:
                gold_match = (g.technique not in MVP_TECHNIQUES) if is_neg else (g.technique == cls_name)
                pred_match = (
                    (not p.is_detected or p.predicted_technique not in MVP_TECHNIQUES)
                    if is_neg
                    else (p.is_detected and not p.is_abstained and p.predicted_technique == cls_name)
                )

                if gold_match:
                    support += 1
                    if pred_match:
                        tp += 1
                    else:
                        fn += 1
                else:
                    if pred_match:
                        fp += 1
                    else:
                        tn += 1

            p_pos = tp + fp
            a_pos = tp + fn
            prec = (tp / p_pos) if p_pos > 0 else None
            rec = (tp / a_pos) if a_pos > 0 else None
            f1 = (2.0 * prec * rec / (prec + rec)) if (prec and rec and (prec + rec) > 0) else None
            ci_p = calculate_wilson_interval(tp, p_pos) if p_pos > 0 else None
            ci_r = calculate_wilson_interval(tp, a_pos) if a_pos > 0 else None

            per_class_metrics[cls_name] = ClassMetricReport(
                technique=cls_name,
                true_positives=tp,
                false_positives=fp,
                false_negatives=fn,
                true_negatives=tn,
                support_count=support,
                precision=prec,
                recall=rec,
                f1_score=f1,
                ci_precision=ci_p,
                ci_recall=ci_r,
            )

        # Macro-F1 strictly across the 6 MVP techniques that have non-zero support
        mvp_f1s = [
            per_class_metrics[tech].f1_score
            for tech in MVP_TECHNIQUES
            if per_class_metrics[tech].f1_score is not None
        ]
        macro_f1 = (sum(mvp_f1s) / len(mvp_f1s)) if mvp_f1s else None

        # 5. Confusion Matrix (MVP classes + negative + abstained)
        matrix_classes = list(MVP_TECHNIQUES) + ["negative"]
        col_classes = list(MVP_TECHNIQUES) + ["negative", "abstained"]
        class_to_idx = {c: i for i, c in enumerate(col_classes)}

        mat = [[0 for _ in col_classes] for _ in matrix_classes]
        abstained_by_class: dict[str, int] = {c: 0 for c in matrix_classes}

        for g, p in test_pairs:
            row_label = g.technique if g.technique in MVP_TECHNIQUES else "negative"
            row_idx = matrix_classes.index(row_label)

            if p.is_abstained:
                col_idx = class_to_idx["abstained"]
                abstained_by_class[row_label] += 1
            elif not p.is_detected or p.predicted_technique not in MVP_TECHNIQUES:
                col_idx = class_to_idx["negative"]
            else:
                col_idx = class_to_idx.get(p.predicted_technique, class_to_idx["negative"])

            mat[row_idx][col_idx] += 1

        confusion_matrix = ConfusionMatrixReport(
            classes=tuple(col_classes),
            matrix=tuple(tuple(row) for row in mat),
            abstained_by_class=abstained_by_class,
        )

        # 6. Abstention Metrics
        total_eval_samples = len(test_pairs)
        abstention_rate = (abstained_count / total_eval_samples) if total_eval_samples > 0 else 0.0
        non_abstained_pairs = [(g, p) for g, p in test_pairs if not p.is_abstained]

        non_abstained_errors = sum(
            1 for g, p in non_abstained_pairs
            if (
                (g.technique in MVP_TECHNIQUES and p.predicted_technique != g.technique)
                or (g.technique not in MVP_TECHNIQUES and p.predicted_technique in MVP_TECHNIQUES)
            )
        )
        err_rate_after_abstention = (
            (non_abstained_errors / len(non_abstained_pairs)) if non_abstained_pairs else 0.0
        )
        raw_error_rate = (
            ((non_abstained_errors + abstained_count) / total_eval_samples) if total_eval_samples > 0 else 0.0
        )

        abstention_metrics = AbstentionReport(
            total_samples=total_eval_samples,
            abstained_count=abstained_count,
            abstention_rate=abstention_rate,
            error_rate_after_abstention=err_rate_after_abstention,
            raw_error_rate=raw_error_rate,
        )

        # 7. Slices: Stance, Camera View, Target Type, Pose Quality, Unseen Athlete
        slices: dict[str, dict[str, SliceEvaluationReport]] = {
            "by_stance": {},
            "by_camera_view": {},
            "by_target_type": {},
            "by_pose_quality": {},
            "by_unseen_athlete": {},
        }

        slice_dimensions = [
            ("by_stance", lambda g: g.stance),
            ("by_camera_view", lambda g: g.camera_view),
            ("by_target_type", lambda g: g.target_type),
            ("by_pose_quality", lambda g: g.pose_quality),
            ("by_unseen_athlete", lambda g: "unseen" if g.is_unseen_athlete else "seen"),
        ]

        for dim_name, extractor in slice_dimensions:
            # Group pairs by slice value
            groups: dict[str, list[tuple[GoldActionSample, PredictedActionSample]]] = {}
            for g, p in test_pairs:
                val = str(extractor(g))
                groups.setdefault(val, []).append((g, p))

            for val, grp_pairs in groups.items():
                s_tp = sum(1 for g, p in grp_pairs if g.technique in MVP_TECHNIQUES and p.predicted_technique == g.technique and not p.is_abstained)
                s_fp = sum(1 for g, p in grp_pairs if (g.technique not in MVP_TECHNIQUES or p.predicted_technique != g.technique) and p.predicted_technique in MVP_TECHNIQUES and not p.is_abstained)
                s_fn = sum(1 for g, p in grp_pairs if g.technique in MVP_TECHNIQUES and (p.predicted_technique != g.technique or p.is_abstained))
                s_prec = (s_tp / (s_tp + s_fp)) if (s_tp + s_fp) > 0 else None
                s_rec = (s_tp / (s_tp + s_fn)) if (s_tp + s_fn) > 0 else None
                s_f1 = (2.0 * s_prec * s_rec / (s_prec + s_rec)) if (s_prec and s_rec and (s_prec + s_rec) > 0) else None

                is_supported = len(grp_pairs) >= self.min_support_per_slice
                slices[dim_name][val] = SliceEvaluationReport(
                    slice_dimension=dim_name,
                    slice_value=val,
                    sample_count=len(grp_pairs),
                    precision=s_prec,
                    recall=s_rec,
                    f1_score=s_f1,
                    is_sufficiently_supported=is_supported,
                )

        # 8. AI–Coach Agreement on Assessment Criteria
        criteria_agreement: dict[str, CriteriaAgreementReport] = {}
        # Collect all criteria across test pairs
        all_criteria_keys: set[str] = set()
        for g, _ in test_pairs:
            all_criteria_keys.update(g.assessment_criteria.keys())

        for crit in sorted(list(all_criteria_keys)):
            matched_pairs = [
                (g.assessment_criteria[crit], p.predicted_criteria[crit])
                for g, p in test_pairs
                if crit in g.assessment_criteria and crit in p.predicted_criteria
            ]
            if matched_pairs:
                y_t = [pair[0] for pair in matched_pairs]
                y_p = [pair[1] for pair in matched_pairs]
                pa, kappa = compute_cohen_kappa(y_t, y_p)
                criteria_agreement[crit] = CriteriaAgreementReport(
                    criterion_name=crit,
                    support_count=len(matched_pairs),
                    percent_agreement=pa,
                    cohen_kappa=kappa,
                )

        # 9. Status Determination under Governance
        if status is None:
            # We had clean data, coach approval, and a threshold record
            min_support_needed = threshold_record.min_support_per_class
            insufficient_classes = [
                tech for tech in MVP_TECHNIQUES
                if per_class_metrics[tech].support_count < min_support_needed
            ]

            if insufficient_classes:
                status = ValidationStatus.NOT_EVALUABLE
                reason = f"Insufficient sample support for classes: {insufficient_classes} (minimum {min_support_needed} required)."
            else:
                # Check threshold compliance
                passes_precision = det_prec is not None and det_prec >= threshold_record.min_precision
                passes_recall = det_rec is not None and det_rec >= threshold_record.min_recall
                passes_f1 = (
                    threshold_record.min_macro_f1 is None
                    or (macro_f1 is not None and macro_f1 >= threshold_record.min_macro_f1)
                )

                if passes_precision and passes_recall and passes_f1:
                    status = ValidationStatus.VALIDATED
                    reason = (
                        f"Met approved threshold targets (Precision: {round(det_prec, 3)} >= {threshold_record.min_precision}, "
                        f"Recall: {round(det_rec, 3)} >= {threshold_record.min_recall}) per {threshold_record.source_document}."
                    )
                else:
                    status = ValidationStatus.REJECTED
                    failed = []
                    if not passes_precision:
                        failed.append(f"Precision {round(det_prec or 0.0, 3)} < {threshold_record.min_precision}")
                    if not passes_recall:
                        failed.append(f"Recall {round(det_rec or 0.0, 3)} < {threshold_record.min_recall}")
                    if not passes_f1:
                        failed.append(f"Macro-F1 {round(macro_f1 or 0.0, 3)} < {threshold_record.min_macro_f1}")
                    reason = f"Failed threshold requirements: {'; '.join(failed)}."

        return GoldEvaluationReport(
            report_id=report_id,
            protocol_version=self.PROTOCOL_VERSION,
            status=status,
            status_reason=reason,
            leakage_audit=leakage_audit,
            detection_metrics=detection_metrics,
            temporal_error=temporal_error,
            per_class_metrics=per_class_metrics,
            macro_f1=macro_f1,
            confusion_matrix=confusion_matrix,
            slices=slices,
            abstention_metrics=abstention_metrics,
            criteria_agreement=criteria_agreement,
            threshold_record=threshold_record,
        )
