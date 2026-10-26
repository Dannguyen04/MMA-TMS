"""Build a temporary, weakly labelled research dataset from the reviewed pack.

Adam uses the user's selected original CSV; other videos use explicit AI candidates.
No coach approval, ground-truth
boundaries, commercial rights or independent evaluation are asserted.
"""
import argparse
from collections import Counter
import json
from pathlib import Path
import shutil

import numpy as np

from pipeline.boxing_research import LABELS, SPLITS, FEATURE_VERSION, digest, pose_features, read_labels

ROOT = Path(__file__).resolve().parent
ADAM_CSV = ROOT / "test_results/external/boxe_ml/96f3a7d0716040682381fb63f80afac96f74cfa6/adam_gt.csv"
ADAM_CSV_SHA256 = "e7df3f784466f311a84b7d7d6aa6449e7eea5f9c3f91a1d512281b41769fdefb"


def save(path, value):
    with path.open("x", encoding="utf-8") as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2, allow_nan=False)


def candidates(index, review):
    if review.get("packId") != index["packId"] or review.get("status") != "AI_REVIEW_PROVISIONAL":
        raise ValueError("Review pack/status mismatch")
    tasks = {t["sampleId"]: t for t in index["tasks"]}
    rows = review["reviews"]
    if len(rows) != len(tasks) or {r["sampleId"] for r in rows} != set(tasks):
        raise ValueError("Review coverage/duplicates mismatch")
    accepted, excluded = [], []
    for row in rows:
        task = tasks[row["sampleId"]]
        if (row.get("actorType") != "AI" or row.get("status") != "AI_REVIEW_PROVISIONAL"
                or row.get("coachConfirmed") is not False or row.get("goldEligible") is not False):
            raise ValueError("Expected explicit provisional AI provenance")
        if row["videoId"] != task["videoId"]:
            raise ValueError("Review video mismatch")
        if row["startTimeMs"] != task["startTimeMs"] or row["endTimeMs"] != task["endTimeMs"]:
            raise ValueError("Review boundaries differ from frame-indexed pack")
        if row["decision"] != "candidate":
            excluded.append({"sampleId": row["sampleId"], "reason": row["decision"]})
            continue
        if row["candidateTechnique"] not in LABELS:
            raise ValueError("Invalid candidate technique")
        accepted.append((task, row))
    return accepted, excluded


def extract_features(frames, start, end):
    selected = [frames.get(i) for i in range(start, end)]
    if any(f is None or f.get("observationKind") != "fresh_detection" or f.get("isDiscontinuous") for f in selected):
        raise ValueError("MISSING_OR_DISCONTINUOUS_POSE")
    clip = np.zeros((len(selected), 17, 2), dtype=np.float32)
    for i, frame in enumerate(selected):
        points = frame.get("landmarks", [])
        if len(points) != 17:
            raise ValueError("MISSING_LANDMARKS")
        for j, point in enumerate(points):
            if point.get("conf", 0) >= .3:
                clip[i, j] = point["x"], point["y"]
    return pose_features(clip)


def select_training_labels(index, review, adam_csv):
    accepted, excluded = candidates(index, review)
    if digest(adam_csv) != ADAM_CSV_SHA256:
        raise ValueError("Original Adam CSV checksum changed")
    source = {r["id"]: r for r in read_labels(adam_csv)}
    tasks = [t for t in index["tasks"] if t["videoId"] == "adam"]
    task_ids = {t["sampleId"] for t in tasks}
    accepted = [(t, r) for t, r in accepted if t["videoId"] != "adam"]
    excluded = [r for r in excluded if r["sampleId"] not in task_ids]
    prior = {r["sampleId"]: r for r in review["reviews"]}
    seen = set()
    for task in tasks:
        if task["sourceRowId"] is None:
            excluded.append({"sampleId": task["sampleId"], "reason": "NO_ORIGINAL_ADAM_LABEL"})
            continue
        row = source.get(task["sourceRowId"])
        if row is None or row["id"] in seen or (task["startFrame"], task["endFrameExclusive"], task["suggestedTechnique"]) != (row["startFrame"], row["endFrame"] + 1, row["technique"]):
            raise ValueError("Adam CSV/pack row mapping mismatch")
        seen.add(row["id"])
        accepted.append((task, {**prior[task["sampleId"]], "trainingLabel": row["technique"],
            "labelProvenance": "UPSTREAM_IMPORTED_UNVERIFIED", "reviewStatus": "SOURCE_SELECTED_BY_USER",
            "sourceAnnotationSha256": ADAM_CSV_SHA256, "sourceRowId": row["id"]}))
    if seen != set(source):
        raise ValueError("Missing original Adam rows")
    return accepted, excluded


def extract_video_pose(path, destination):
    """Pose-only path: do not invoke scoring or temporal phase postprocessing."""
    import cv2
    from ultralytics import YOLO
    from person_tracker import PersonTracker
    weights = Path(__file__).parent / "yolov8n-pose.pt"
    if not weights.is_file():
        raise ValueError("Expected existing local YOLO pose weights")
    model = YOLO(str(weights))
    tracker = PersonTracker(max_missing_frames=15, max_landmark_jump=.14)
    capture = cv2.VideoCapture(str(path))
    fps = capture.get(cv2.CAP_PROP_FPS)
    width, height = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH)), int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
    frames = []
    try:
        if not capture.isOpened() or not np.isfinite(fps) or fps <= 0:
            raise ValueError("Invalid video")
        while True:
            ok, image = capture.read()
            if not ok:
                break
            number = len(frames)
            predictions = model(image, conf=.5, verbose=False)
            points, discontinuous = tracker.update(predictions, frame_idx=number, img_w=width, img_h=height)
            if tracker.target is not None and tracker.target.missing_frames:
                points = None
            person_count = len(predictions[0].boxes) if predictions else 0
            frames.append({"frameIdx": number, "timeMs": number * 1000 / fps,
                "observationKind": "fresh_detection" if points is not None else "missing_detection",
                "isDiscontinuous": bool(discontinuous or person_count != 1),
                "landmarks": [{"x": float(p.x), "y": float(p.y), "conf": float(p.conf)} for p in points] if points else []})
    finally:
        capture.release()
    if not frames:
        raise ValueError("No decoded frames")
    document = {"meta": {"sourceVideoSha256": digest(path), "modelSha256": digest(weights),
        "fps": fps, "width": width, "height": height, "decodedFrames": len(frames),
        "mode": "research_pose_only", "timestampBasis": "decoded_frame_index_over_fps"}, "frames": frames}
    save(destination, document)
    return document


def build(pack, review_path, output, ai_weight=.25, *, adam_csv=ADAM_CSV, pose_cache=None):
    if not 0 < ai_weight < 1:
        raise ValueError("AI loss weight must be between zero and one")
    if output.exists():
        raise ValueError("Output must be new")
    index = json.loads((pack / "review_index.json").read_text(encoding="utf-8"))
    summary = json.loads((pack / "dataset_summary.json").read_text(encoding="utf-8"))
    for name, expected in summary["artifactHashes"].items():
        if digest(pack / name) != expected:
            raise ValueError("Pack artifact changed")
    review = json.loads(review_path.read_text(encoding="utf-8"))
    if review["inputHashes"]["review_index.json"] != digest(pack / "review_index.json"):
        raise ValueError("Reviewed index changed")
    pending, exclusions = select_training_labels(index, review, adam_csv)
    videos = {v["videoId"]: v for v in index["videos"]}
    for task, row in pending:
        video = videos[task["videoId"]]
        if row["evidence"]["videoSha256"] != video["sha256"] or digest(pack / video["path"]) != video["sha256"]:
            raise ValueError("Candidate video changed")
    research = json.loads((pack / "research_samples.json").read_text(encoding="utf-8"))["samples"]
    with np.load(pack / "research_features.npz", allow_pickle=False) as archive:
        x, y = archive["features"].copy(), archive["upstream_target"].copy()
        source_groups = archive["source_group"].copy()
    if x.shape != (len(research), 25, 85) or len(y) != len(research) or not np.isfinite(x).all():
        raise ValueError("Invalid research features")
    split_by_group = {v: split for split, groups in SPLITS.items() for v in groups}
    samples = []
    for i, source in enumerate(research):
        if source["arrayIndex"] != i or source["sourceVideoGroup"] != source_groups[i] or LABELS[int(y[i])] != source["suggestedTechnique"]:
            raise ValueError("Research array/label mapping mismatch")
        split = split_by_group[source["sourceVideoGroup"]]
        samples.append({"sampleId": source["sampleId"], "arrayIndex": i,
            "sourceVideoId": source["sourceVideoGroup"], "split": split,
            "trainingLabel": source["suggestedTechnique"], "labelProvenance": "UPSTREAM_IMPORTED_UNVERIFIED",
            "lossWeight": 1.0, "coachConfirmed": False, "goldEligible": False})
    output.mkdir(parents=True)
    (output / "inference").mkdir()
    cache_manifest = json.loads((pose_cache / "manifest.json").read_text(encoding="utf-8")) if pose_cache else None
    generated, inference_hashes = {}, {}
    for video_id in sorted({task["videoId"] for task, _ in pending}):
        video = videos[video_id]
        destination = output / "inference" / f"{video_id}.json"
        if cache_manifest:
            cached = pose_cache / "inference" / f"{video_id}.json"
            provenance = cache_manifest["inferenceSources"][video_id]
            if provenance["videoSha256"] != video["sha256"] or digest(cached) != provenance["poseOutputSha256"]:
                raise ValueError("Cached pose provenance changed")
            document = json.loads(cached.read_text(encoding="utf-8"))
            if document["meta"]["sourceVideoSha256"] != video["sha256"]:
                raise ValueError("Cached pose belongs to another video")
            shutil.copyfile(cached, destination)
        else:
            print(f"Extracting fresh pose: {video_id}", flush=True)
            document = extract_video_pose(pack / video["path"], destination)
        if digest(pack / video["path"]) != video["sha256"]:
            raise ValueError("Source video changed during extraction")
        mapping = {f["frameIdx"]: f for f in document["frames"]}
        if len(mapping) != len(document["frames"]):
            raise ValueError("Duplicate pose frame indices")
        generated[video_id] = mapping
        inference_hashes[video_id] = {"videoSha256": video["sha256"], "poseOutputSha256": digest(destination)}
    weak_x, weak_y = [], []
    for task, row in pending:
        try:
            features = extract_features(generated[task["videoId"]], task["startFrame"], task["endFrameExclusive"])
        except ValueError as error:
            exclusions.append({"sampleId": task["sampleId"], "reason": str(error)})
            continue
        weak_x.append(features)
        label = row.get("trainingLabel", row["candidateTechnique"])
        weak_y.append(LABELS.index(label))
        samples.append({"sampleId": task["sampleId"], "arrayIndex": len(samples),
            "sourceVideoId": task["videoId"], "sourceVideoSha256": videos[task["videoId"]]["sha256"],
            "split": "train", "trainingLabel": label,
            "labelProvenance": row.get("labelProvenance", "AI_VISUAL_TRIAGE"),
            "reviewStatus": row.get("reviewStatus", "AI_REVIEW_PROVISIONAL"),
            "sourceAnnotationSha256": row.get("sourceAnnotationSha256"), "sourceRowId": row.get("sourceRowId"),
            "lossWeight": ai_weight, "coachConfirmed": False, "goldEligible": False,
            "startFrame": task["startFrame"], "endFrameExclusive": task["endFrameExclusive"],
            "boundariesConfirmed": False})
    if weak_x:
        x, y = np.concatenate([x, np.stack(weak_x)]), np.concatenate([y, np.asarray(weak_y)])
    np.savez_compressed(output / "features.npz", features=x, targets=y.astype(np.int64),
                        loss_weights=np.asarray([s["lossWeight"] for s in samples], dtype=np.float32))
    manifest = {"schemaVersion": "provisional_research_dataset_v1", "featureVersion": FEATURE_VERSION,
        "status": "TEMPORARY_RESEARCH_USE", "authorizedUse": "User requested temporary use on 2026-10-06",
        "coachConfirmed": False, "goldEligible": False, "productionEligible": False,
        "featurePath": "features.npz", "featureSha256": digest(output / "features.npz"),
        "packId": index["packId"], "reviewSha256": digest(review_path), "inferenceSources": inference_hashes,
        "upstreamSamples": len(research),
        "aiCandidateCount": sum(t["videoId"] != "adam" for t, _ in pending),
        "aiSamplesAccepted": sum(s["labelProvenance"] == "AI_VISUAL_TRIAGE" for s in samples),
        "adamSourceSamplesAccepted": sum(s["sourceVideoId"] == "adam" for s in samples),
        "adamLabelPolicy": {"status": "SOURCE_SELECTED_BY_USER", "source": "adam_gt.csv",
            "sourceSha256": ADAM_CSV_SHA256, "sourceRows": 18, "aiOverridesAllowed": False,
            "intervalPolicy": "preserve_original_inclusive_frame_bounds", "coachConfirmed": False},
        "sampleCount": len(samples), "splitCounts": dict(Counter(s["split"] for s in samples)),
        "aiLossWeight": ai_weight, "samples": samples, "exclusions": exclusions,
        "sourceHashes": {name: digest(Path(__file__).parent / name) for name in
            ("prepare_provisional_dataset.py", "pipeline/boxing_research.py", "person_tracker.py")},
        "limitations": ["Loss weights are heuristic, not calibrated confidence.",
            "Adam original labels were selected by the user; original boundaries and overlaps are retained.",
            "Other video AI labels and boundaries remain weak suggestions from sparse frames.",
            "No background examples, coach-approved quality labels or independent acceptance test.",
            "Source-video splits are preserved; fighter independence and cross-source identity are unknown.",
            "Adam and heavybag are training sources and cannot be used as held-out evaluations of this model.",
            "Historical V9/V10 remain observed diagnostics; no test inference is needed for a smoke run.",
            "Legacy 25x85 image-relative features are not the new timestamp/aspect-corrected representation.",
            "User permission for temporary experimentation does not verify commercial media rights."]}
    save(output / "manifest.json", manifest)
    print(json.dumps({k: manifest[k] for k in ("sampleCount", "aiSamplesAccepted", "splitCounts")}), flush=True)
    return manifest


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pack", type=Path, default=Path("test_results/coach_review_dataset/20261005_v2"))
    parser.add_argument("--review", type=Path, default=Path("benchmark_results/ai_visual_review_20261006.json"))
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--ai-weight", type=float, default=.25)
    parser.add_argument("--adam-csv", type=Path, default=ADAM_CSV)
    parser.add_argument("--pose-cache", type=Path, help="Reuse inference only after checking its recorded video and pose hashes")
    args = parser.parse_args()
    build(args.pack, args.review, args.output, args.ai_weight, adam_csv=args.adam_csv, pose_cache=args.pose_cache)
