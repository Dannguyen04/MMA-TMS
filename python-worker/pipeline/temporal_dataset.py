"""Structural audit for locally annotated, timestamped temporal datasets.

Human identity and annotation declarations are checked for consistency, not
independently certified. No split is guessed, assigned, or repaired automatically.
"""
from __future__ import annotations

from collections import Counter, defaultdict
import json
from pathlib import Path

import numpy as np

from pipeline.boxing_research import LABELS, digest
from pipeline.pose_normalizer import VERSION

SPLITS = ("train", "validation", "calibration", "test")
TECHNIQUES = (*LABELS, "background")
GROUP_FIELDS = ("fighterId", "sessionId", "sourceVideoId", "sourceVideoSha256", "sourceInferenceSha256", "poseSha256")


def audit_manifest(path: Path, *, minimum_class_support=30):
    if minimum_class_support < 1:
        raise ValueError("minimum_class_support must be positive")
    document = json.loads(path.read_text(encoding="utf-8"))
    errors, warnings = [], []
    supports = {s: Counter() for s in SPLITS}
    strata = {s: Counter() for s in SPLITS}
    groups = {field: defaultdict(set) for field in GROUP_FIELDS}
    seen_ids, intervals, checked = set(), defaultdict(list), {}
    samples = document.get("samples")
    if document.get("schemaVersion") != "1.0.0" or document.get("featureVersion") != VERSION:
        errors.append({"code": "UNSUPPORTED_MANIFEST_VERSION"})
    if not isinstance(samples, list) or not samples:
        errors.append({"code": "EMPTY_DATASET"})
        samples = []
    test_observed = False
    for index, sample in enumerate(samples):
        prefix = {"row": index}

        def error(code, **details):
            errors.append({**prefix, "code": code, **details})

        if not isinstance(sample, dict):
            error("INVALID_SAMPLE")
            continue
        sample_id, split, label = sample.get("sampleId"), sample.get("split"), sample.get("technique")
        if not isinstance(sample_id, str) or not sample_id.strip() or sample_id in seen_ids:
            error("MISSING_OR_DUPLICATE_SAMPLE_ID")
        else:
            seen_ids.add(sample_id)
        if split not in SPLITS:
            error("INVALID_SPLIT")
            continue
        if label not in TECHNIQUES:
            error("UNSUPPORTED_TECHNIQUE")
        else:
            supports[split][label] += 1
        for field in GROUP_FIELDS:
            value = sample.get(field)
            if not isinstance(value, str) or not value.strip():
                error("MISSING_GROUP_ID", field=field)
            elif field.endswith("Sha256") and (len(value) != 64 or any(c not in "0123456789abcdef" for c in value)):
                error("INVALID_HASH", field=field)
            else:
                groups[field][value].add(split)
        stance, view = sample.get("stance"), sample.get("cameraView")
        if stance not in {"orthodox", "southpaw"} or view not in {"front", "side", "diagonal"}:
            error("MISSING_STANCE_OR_CAMERA")
        else:
            strata[split][f"{stance}/{view}/{label}"] += 1
        reviewers = sample.get("annotatorIds")
        if (not isinstance(reviewers, list) or not reviewers or
                any(not isinstance(r, str) or not r.strip() for r in reviewers) or
                len(reviewers) != len(set(reviewers))):
            error("INVALID_ANNOTATOR_IDS")
        elif (sample.get("reviewStatus") != "COACH_APPROVED" and not
              (sample.get("reviewStatus") == "DUAL_AGREEMENT" and len(reviewers) >= 2)):
            error("UNAPPROVED_LABEL")
        if split == "test" and sample.get("testObserved") is not False:
            test_observed = True
        start, end = sample.get("startTimeMs"), sample.get("endTimeMs")
        if (any(isinstance(v, bool) or not isinstance(v, (int, float)) or not np.isfinite(v) for v in (start, end))
                or start < 0 or end <= start):
            error("INVALID_ACTION_INTERVAL")
            continue
        # Half-open labelled intervals. Overlap within a video requires an explicit
        # annotation decision before this single-label dataset can be consumed.
        video_id = sample.get("sourceVideoId")
        if isinstance(video_id, str):
            intervals[video_id].append((start, end, sample_id))
        relative = sample.get("posePath")
        if not isinstance(relative, str) or not relative:
            error("MISSING_POSE_PATH")
            continue
        asset = (path.parent / relative).resolve()
        if asset.suffix != ".npz" or not asset.is_file():
            error("MISSING_NUMERIC_POSE_ASSET")
            continue
        try:
            if asset not in checked:
                with np.load(asset, allow_pickle=False) as data:
                    times, features = data["timestamps_ms"], data["features"]
                    if (times.ndim != 1 or len(times) < 2 or features.shape != (len(times), 85)
                            or not np.isfinite(times).all() or not np.isfinite(features).all()
                            or not (np.diff(times) > 0).all()):
                        raise ValueError("Invalid time/feature schema")
                    checked[asset] = (digest(asset), times.copy())
            checksum, times = checked[asset]
            if checksum != sample.get("poseSha256"):
                error("POSE_CHECKSUM_MISMATCH")
            if start < times[0] or end > times[-1] or ((times >= start) & (times < end)).sum() < 2:
                error("INTERVAL_NOT_COVERED_BY_CONTINUOUS_POSE")
        except (ValueError, TypeError, KeyError, OSError) as exc:
            error("INVALID_POSE_ASSET", detail=str(exc))
    for field, values in groups.items():
        for value, splits in values.items():
            if len(splits) > 1:
                errors.append({"code": "CROSS_SPLIT_LEAKAGE", "field": field, "value": value, "splits": sorted(splits)})
    for video_id, entries in intervals.items():
        last_end = -1
        for start, end, sample_id in sorted(entries, key=lambda item: (item[0], item[1])):
            if start < last_end:
                errors.append({"code": "OVERLAPPING_SINGLE_LABEL_INTERVALS", "sourceVideoId": video_id, "sampleId": sample_id})
            last_end = max(last_end, end)
    missing_support = []
    for split in SPLITS:
        for label in TECHNIQUES:
            if supports[split][label] < minimum_class_support:
                missing_support.append({"split": split, "technique": label, "count": supports[split][label],
                                        "requiredForThisAudit": minimum_class_support})
    if missing_support:
        warnings.append({"code": "INSUFFICIENT_CLASS_SUPPORT", "details": missing_support})
    if test_observed:
        warnings.append({"code": "TEST_ALREADY_OBSERVED_OR_UNDECLARED"})
    if document.get("dataUseApproved") is not True:
        warnings.append({"code": "DATA_USE_APPROVAL_NOT_DECLARED"})
    if document.get("annotationCoverage") != "exhaustive":
        warnings.append({"code": "EXHAUSTIVE_ANNOTATION_NOT_DECLARED"})
    return {"schemaVersion": "1.0.0", "manifestSha256": digest(path), "sampleCount": len(samples),
            "passesStructuralAudit": not errors,
            "readyForTrainingByDeclaredMetadata": bool(samples) and not errors and not missing_support
                and document.get("dataUseApproved") is True and document.get("annotationCoverage") == "exhaustive",
            "hasUnobservedTestByDeclaration": bool(supports["test"]) and not test_observed,
            "productionEligible": False, "errors": errors, "warnings": warnings,
            "classSupport": {s: {label: supports[s][label] for label in TECHNIQUES} for s in SPLITS},
            "stratumSupport": {s: dict(counts) for s, counts in strata.items()},
            "limitations": ["Identity, source hashes, review and data-use declarations require human verification.",
                            "Only local pose asset hashes are verified against bytes by this audit.",
                            "Class counts alone do not prove subgroup coverage, sample independence or model accuracy.",
                            "This single-label contract rejects overlapping actions; it is not a sparring annotation format."]}
