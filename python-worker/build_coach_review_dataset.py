"""Build a local review corpus. Never impersonates a coach or emits gold labels.

Pinned upstream labels remain suggestions. Local review submissions are unverified
until checked through the project's human review/attestation workflow.
"""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import shutil

import cv2
import numpy as np

from pipeline.boxing_research import LABELS, FEATURE_VERSION, digest, read_labels
from train_boxing_research import DATA_DEFAULT, prepare

ROOT = Path(__file__).resolve().parent
PACK_VERSION = "coach_review_pack_v1"


def write_json(path, value):
    with path.open("x", encoding="utf-8") as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2, allow_nan=False)


def review_windows(rows, frame_count, fps, context_seconds=2.0):
    """Keep inclusive source bounds; expose overlap, and leave gaps unlabelled."""
    if frame_count < 1 or not np.isfinite(fps) or fps <= 0 or context_seconds <= 0:
        raise ValueError("Invalid video timing")
    samples, rejected, ranges = [], [], []
    for row in rows:
        start, end = row["startFrame"], row["endFrame"]
        if start < 0 or end < start or end >= frame_count:
            rejected.append({"sourceRowId": row["id"], "reason": "SOURCE_INTERVAL_OUTSIDE_DECODED_VIDEO"})
            continue
        ranges.append((start, end + 1))
        samples.append({"sourceRowId": row["id"], "startFrame": start, "endFrameExclusive": end + 1,
                        "startTimeMs": start * 1000 / fps, "endTimeMs": (end + 1) * 1000 / fps,
                        "suggestedTechnique": row["technique"], "taskKind": "upstream_label_review",
                        "reviewReasons": []})
    for i, sample in enumerate(samples):
        if any(i != j and max(sample["startFrame"], other["startFrame"]) <
               min(sample["endFrameExclusive"], other["endFrameExclusive"])
               for j, other in enumerate(samples)):
            sample["reviewReasons"].append("SOURCE_LABEL_BOUNDARY_OVERLAP")
    # Union coverage only determines which intervals still need annotation.
    cursor, gaps = 0, []
    for start, end in sorted(ranges):
        if start > cursor:
            gaps.append((cursor, start))
        cursor = max(cursor, end)
    if cursor < frame_count:
        gaps.append((cursor, frame_count))
    window = max(1, round(context_seconds * fps))
    for start, end in gaps:
        for left in range(start, end, window):
            right = min(left + window, end)
            samples.append({"sourceRowId": None, "startFrame": left, "endFrameExclusive": right,
                            "startTimeMs": left * 1000 / fps, "endTimeMs": right * 1000 / fps,
                            "suggestedTechnique": None, "taskKind": "unlabelled_context",
                            "reviewReasons": ["NOT_CONFIRMED_BACKGROUND"]})
    return sorted(samples, key=lambda item: (item["startFrame"], item["endFrameExclusive"])), rejected


def probe_video(path):
    capture = cv2.VideoCapture(str(path))
    if not capture.isOpened():
        raise ValueError(f"Cannot decode {path.name}")
    fps = capture.get(cv2.CAP_PROP_FPS)
    declared = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
    width, height = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH)), int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
    count = 0
    while True:
        ok, _ = capture.read()
        if not ok:
            break
        count += 1
    capture.release()
    if not np.isfinite(fps) or fps <= 0 or count == 0:
        raise ValueError(f"Invalid timing/empty video: {path.name}")
    return {"fps": fps, "decodedFrames": count, "declaredFrames": declared,
            "width": width, "height": height, "durationMs": count * 1000 / fps,
            "timingBasis": "decoded_frame_index_over_reported_fps",
            "variableFrameRateVerified": False}


def build_pack(data, output, *, validation_directory, expected_audit):
    if output.exists():
        raise ValueError("Use a new output directory; review packs are immutable")
    groups, audit = prepare(data)
    expected = json.loads(expected_audit.read_text(encoding="utf-8"))
    if audit["inputHashes"] != expected["inputHashes"]:
        raise ValueError("Pinned input hashes differ from the recorded research audit")
    output.mkdir(parents=True)
    media = output / "media"
    media.mkdir()
    samples, arrays, targets, source_groups = [], [], [], []
    for source_group, (features, y, source_rows) in groups.items():
        annotations = read_labels(data / f"clean_annotation_data/{source_group}.csv", allow_invalid_intervals=True)
        for i, row_index in enumerate(source_rows):
            row = annotations[row_index]
            samples.append({"sampleId": f"boxingvi-mirror-{source_group}-row-{row_index}",
                "arrayIndex": len(samples), "sourceVideoGroup": source_group, "sourceRowIndex": row_index,
                "sourceStartFrameInclusive": row["startFrame"], "sourceEndFrameInclusive": row["endFrame"],
                "suggestedTechnique": LABELS[int(y[i])], "labelProvenance": "UPSTREAM_IMPORTED_UNVERIFIED",
                "reviewStatus": "PENDING_COACH_REVIEW", "coachConfirmed": False, "annotatorIds": [],
                "fighterId": None, "sessionId": None, "assignedSplit": None,
                "rgbAvailableInPack": False, "usableForHumanVideoReview": False,
                "featureVersion": FEATURE_VERSION, "eligibleForGoldTraining": False})
        arrays.append(features)
        targets.append(y)
        source_groups += [source_group] * len(features)
    np.savez_compressed(output / "research_features.npz", features=np.concatenate(arrays),
                        upstream_target=np.concatenate(targets), source_group=np.asarray(source_groups))
    write_json(output / "research_samples.json", {"schemaVersion": PACK_VERSION, "samples": samples})
    write_json(output / "source_audit.json", audit)

    videos, tasks, rejected_rows = [], [], []
    sources = [("adam", data / "adam.mp4", "solo_boxing", read_labels(data / "adam_gt.csv"),
                "upstream_csv", digest(data / "adam_gt.csv"))]
    sources += [(p.stem, p, "context_requires_scope_review", [], "unlabelled_local_video", None)
                for p in sorted(validation_directory.glob("*.mp4"))]
    for video_id, source, scope, rows, provenance, label_hash in sources:
        metadata = probe_video(source)
        target = media / f"{video_id}.mp4"
        shutil.copyfile(source, target)
        checksum = digest(source)
        if digest(target) != checksum:
            raise ValueError("Copied video checksum mismatch")
        video = {"videoId": video_id, "path": f"media/{video_id}.mp4", "sha256": checksum,
                 **metadata, "scope": scope, "fighterId": None, "sessionId": None,
                 "identityVerified": False, "previouslyObserved": True,
                 "dataUseApproved": False, "annotationSha256": label_hash}
        videos.append(video)
        proposed, rejected = review_windows(rows, metadata["decodedFrames"], metadata["fps"])
        rejected_rows += [{"videoId": video_id, **r} for r in rejected]
        for i, sample in enumerate(proposed):
            sample.update(sampleId=f"{video_id}-review-{i:04d}", videoId=video_id,
                          labelProvenance=provenance if sample["suggestedTechnique"] else "NO_LABEL",
                          technique=None, reviewStatus="PENDING_COACH_REVIEW", coachConfirmed=False,
                          annotatorIds=[], assignedSplit=None, eligibleForGoldTraining=False)
            tasks.append(sample)
    index = {"schemaVersion": PACK_VERSION, "status": "PENDING_COACH_REVIEW", "coachConfirmedCount": 0,
             "productionEligible": False, "dataUseApproved": False, "annotationCoverage": "unverified",
             "researchSampleCount": len(samples), "videos": videos, "tasks": tasks,
             "researchSamplesSha256": digest(output / "research_samples.json"),
             "sourceAuditSha256": digest(output / "source_audit.json"),
             "labels": [*LABELS, "background", "unknown", "out_of_scope"],
             "rejectedSourceRows": rejected_rows,
             "scopeNote": "Local context videos include multi-person/non-boxing footage; review scope before labelling.",
             "reviewPolicy": "Local review files are declarations, not authenticated coach attestations."}
    content = json.dumps(index, sort_keys=True, ensure_ascii=False, allow_nan=False).encode("utf-8")
    index["packId"] = hashlib.sha256(content).hexdigest()
    write_json(output / "review_index.json", index)
    # Safe inside an application/json script element, including malicious source labels.
    embedded = json.dumps(index, ensure_ascii=False, allow_nan=False).replace("<", "\\u003c")
    template = (ROOT / "review_tools/coach_review.html").read_text(encoding="utf-8")
    (output / "review.html").write_text(template.replace("__REVIEW_DATA_JSON__", embedded), encoding="utf-8")
    summary = {"schemaVersion": PACK_VERSION, "packId": index["packId"], "status": index["status"],
        "researchSamples": len(samples), "researchClassCounts": dict(Counter(s["suggestedTechnique"] for s in samples)),
        "reviewVideos": len(videos), "videoReviewTasks": len(tasks),
        "upstreamSuggestedTasks": sum(t["suggestedTechnique"] is not None for t in tasks),
        "unlabelledContextTasks": sum(t["suggestedTechnique"] is None for t in tasks),
        "overlapFlaggedTasks": sum("SOURCE_LABEL_BOUNDARY_OVERLAP" in t["reviewReasons"] for t in tasks),
        "coachConfirmed": 0, "goldEligible": 0, "productionEligible": False,
        "quarantinedSourceRows": sum(len(v["rejected"]) for v in audit["videos"]),
        "excludedSources": audit["excluded"],
        "artifactHashes": {name: digest(output / name) for name in
            ("research_features.npz", "research_samples.json", "source_audit.json", "review_index.json", "review.html")},
        "sourceCodeHashes": {name: digest(ROOT / name) for name in
            ("build_coach_review_dataset.py", "review_tools/coach_review.html", "train_boxing_research.py", "pipeline/boxing_research.py")},
        "limitations": ["Upstream labels and local drafts are not coach-confirmed labels.",
            "Missing RGB for the mirror skeleton corpus prevents full human video review of those samples.",
            "No athlete identities, rights, approval records or new independent test set were fabricated.",
            "Unlabelled intervals are review tasks, not confirmed negative training examples.",
            "Original overlapping inclusive label boundaries are preserved and flagged."]}
    write_json(output / "dataset_summary.json", summary)
    (output / "README.md").write_text(
        "# Bộ dữ liệu chờ HLV duyệt\n\n"
        "Mở review.html trong trình duyệt để xem video và ghi bản duyệt cục bộ.\n"
        "Nhãn nguồn được ẩn mặc định để giảm ảnh hưởng tới người duyệt.\n"
        "Bấm Xuất bản duyệt JSON để lưu bản sao; localStorage không thay thế bản bàn giao.\n"
        "Bản xuất có trạng thái LOCAL_REVIEW_UNVERIFIED, không tự trở thành COACH_APPROVED.\n"
        "Cần xác minh người duyệt và tiếp nhận qua luồng review/attestation của dự án.\n\n"
        "research_features.npz chỉ phục vụ nghiên cứu với nhãn upstream; không dùng làm gold set.\n"
        "review_index.json chứa các khoảng video cần duyệt, bao gồm vùng chưa có nhãn.\n"
        "Mọi dữ liệu hiện tại đã được quan sát; không tạo test mù bằng đổi tên hoặc chia clip.\n",
        encoding="utf-8")
    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, default=DATA_DEFAULT)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--validation-videos", type=Path, default=ROOT / "validation_videos")
    parser.add_argument("--expected-audit", type=Path, default=ROOT / "benchmark_results/boxing_data_audit.json")
    args = parser.parse_args()
    summary = build_pack(args.data, args.output, validation_directory=args.validation_videos, expected_audit=args.expected_audit)
    print(json.dumps(summary, ensure_ascii=True))
