"""
evaluate_punch_recall.py — Deterministic recall evaluation for punch detectors (T-022).

Implements the frozen evaluation protocol:
1. Ground truth interval [start_frame, end_frame] recognized if impactFrame in [start_frame - 3, end_frame + 3].
2. One-to-one bipartite matching (maximum cardinality, then minimum distance to interval midpoint).
3. Primary metric: recall = recognized intervals / total ground truth intervals.
4. Secondary metric: interval IoU (min_iou=0.1) via pipeline/boxing_research.py.
5. Reporting:
   - DEV-2 (vid_01..06): unmatched predictions reported as False Positives (FP).
   - BoxingVI (V4, V6, V10): unmatched predictions reported as unverified excess (not FP).
   - Duplicate detections (>= 2 predictions in interval).
   - Video, label, code and configuration hashes.
"""

from __future__ import annotations

import argparse
import csv
import datetime
import hashlib
import json
import math
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Set, Tuple

# Ensure python-worker directory is on sys.path
ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from pipeline.action_pipeline import ActionPipeline
from pipeline.contracts import FrameContext, ObservationKind, PoseObservation
from pipeline.boxing_research import evaluate_intervals, read_labels
from punch_analyzer import PunchAnalyzer, PunchDetectorConfig, PunchResult
from punch_event_detector_v2 import (
    PunchEventDetectorV2Config,
    build_heavy_bag_punch_results,
)
from pipeline.strike_events import EventDetectorConfig, detect_punch_events
from kick_event_detector_v2 import recover_kick_events, suppress_punches_during_kicks
from pose_math import Point


# ─── Dataclasses ─────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class GroundTruthInterval:
    start_frame: int
    end_frame: int
    label: str = "punch"
    id: str = ""
    video: str = ""


@dataclass(frozen=True)
class PunchPrediction:
    impact_frame: int
    start_frame: int = 0
    end_frame: int = 0
    arm: str = "unknown"
    punch_type: str = "unknown_punch"
    id: str = ""
    confidence: Optional[float] = None


@dataclass
class MatchingResult:
    tp: int
    fn: int
    recall: float
    matches: list[dict[str, Any]]
    unmatched_gt_ids: list[str]
    unmatched_predictions: list[dict[str, Any]]
    duplicate_intervals_count: int
    duplicate_gt_ids: list[str]


# ─── Matching Algorithm (Min-Cost Max-Flow Bipartite Matching) ───────────────

def _optimal_bipartite_matching(
    candidates: list[tuple[float, int, int]], pred_count: int, gt_count: int
) -> list[tuple[float, int, int]]:
    """Solve maximum-cardinality minimum-cost matching via successive shortest paths.

    Unit capacities on source->pred, pred->gt, gt->sink.
    Cost is distance to midpoint.
    """
    source = pred_count + gt_count
    sink = pred_count + gt_count + 1
    graph: list[list[list[Any]]] = [[] for _ in range(sink + 1)]

    def add_edge(u: int, v: int, cost: float):
        forward = [v, len(graph[v]), 1, cost]
        reverse = [u, len(graph[u]), 0, -cost]
        graph[u].append(forward)
        graph[v].append(reverse)
        return forward

    for pi in range(pred_count):
        add_edge(source, pi, 0.0)
    for gi in range(gt_count):
        add_edge(pred_count + gi, sink, 0.0)

    for cost, pi, gi in candidates:
        add_edge(pi, pred_count + gi, cost)

    # Successive shortest path using Bellman-Ford (unit flow)
    while True:
        dist = [float("inf")] * len(graph)
        prev_node = [-1] * len(graph)
        prev_edge = [-1] * len(graph)
        dist[source] = 0.0

        for _ in range(len(graph) - 1):
            updated = False
            for u in range(len(graph)):
                if dist[u] == float("inf"):
                    continue
                for edge_idx, edge in enumerate(graph[u]):
                    v, _, capacity, cost = edge
                    if capacity > 0 and dist[u] + cost < dist[v] - 1e-9:
                        dist[v] = dist[u] + cost
                        prev_node[v] = u
                        prev_edge[v] = edge_idx
                        updated = True
            if not updated:
                break

        if dist[sink] == float("inf"):
            break

        # Augment 1 unit along shortest path
        curr = sink
        while curr != source:
            p_node = prev_node[curr]
            p_edge_idx = prev_edge[curr]
            edge = graph[p_node][p_edge_idx]
            edge[2] -= 1  # reduce forward capacity
            rev_idx = edge[1]
            graph[curr][rev_idx][2] += 1  # increase reverse capacity
            curr = p_node

    # Recover matches: forward edges with capacity == 0
    matched_pairs: list[tuple[float, int, int]] = []
    for pi in range(pred_count):
        for edge in graph[pi]:
            v, _, capacity, cost = edge
            if v != source and capacity == 0:
                gi = v - pred_count
                matched_pairs.append((cost, pi, gi))

    return matched_pairs


def match_bipartite_predictions(
    truth: Sequence[GroundTruthInterval],
    predictions: Sequence[PunchPrediction],
    tolerance_frames: int = 3,
) -> MatchingResult:
    """Perform one-to-one matching with [start_frame - 3, end_frame + 3] tolerance."""
    gt_list = list(truth)
    pred_list = list(predictions)

    candidates: list[tuple[float, int, int]] = []
    candidates_per_gt: dict[int, list[int]] = {gi: [] for gi in range(len(gt_list))}

    for pi, p in enumerate(pred_list):
        for gi, g in enumerate(gt_list):
            if (g.start_frame - tolerance_frames) <= p.impact_frame <= (g.end_frame + tolerance_frames):
                midpoint = (g.start_frame + g.end_frame) / 2.0
                error = abs(p.impact_frame - midpoint)
                candidates.append((error, pi, gi))
                candidates_per_gt[gi].append(pi)

    matched = _optimal_bipartite_matching(candidates, len(pred_list), len(gt_list))

    matched_pred_indices: set[int] = set()
    matched_gt_indices: set[int] = set()
    matches_info: list[dict[str, Any]] = []

    for error, pi, gi in matched:
        matched_pred_indices.add(pi)
        matched_gt_indices.add(gi)
        p = pred_list[pi]
        g = gt_list[gi]
        matches_info.append({
            "gt_id": g.id or str(gi),
            "gt_idx": gi,
            "pred_id": p.id or str(pi),
            "pred_idx": pi,
            "impact_frame": p.impact_frame,
            "gt_start_frame": g.start_frame,
            "gt_end_frame": g.end_frame,
            "error_to_midpoint": round(error, 2),
            "label": g.label,
            "punch_type": p.punch_type,
        })

    # Sort matches deterministically by gt_start_frame
    matches_info.sort(key=lambda m: m["gt_start_frame"])

    tp = len(matched_gt_indices)
    fn = len(gt_list) - tp
    recall = tp / len(gt_list) if gt_list else 1.0

    unmatched_gt_ids = [
        gt_list[gi].id or str(gi)
        for gi in range(len(gt_list))
        if gi not in matched_gt_indices
    ]

    unmatched_preds = [
        {
            "pred_id": pred_list[pi].id or str(pi),
            "pred_idx": pi,
            "impact_frame": pred_list[pi].impact_frame,
            "start_frame": pred_list[pi].start_frame,
            "end_frame": pred_list[pi].end_frame,
            "punch_type": pred_list[pi].punch_type,
            "arm": pred_list[pi].arm,
        }
        for pi in range(len(pred_list))
        if pi not in matched_pred_indices
    ]

    duplicate_gt_ids = [
        gt_list[gi].id or str(gi)
        for gi, plist in candidates_per_gt.items()
        if len(plist) >= 2
    ]

    return MatchingResult(
        tp=tp,
        fn=fn,
        recall=round(recall, 4),
        matches=matches_info,
        unmatched_gt_ids=unmatched_gt_ids,
        unmatched_predictions=unmatched_preds,
        duplicate_intervals_count=len(duplicate_gt_ids),
        duplicate_gt_ids=duplicate_gt_ids,
    )


def evaluate_punch_recall(
    truth: Sequence[GroundTruthInterval],
    predictions: Sequence[PunchPrediction],
    *,
    dataset_kind: str = "boxingvi",  # "dev2_validation", "boxingvi", "adam"
    total_frames: int = 0,
    min_iou: float = 0.1,
) -> dict[str, Any]:
    """Calculate comprehensive recall and precision metrics according to T-022 protocol."""
    matching = match_bipartite_predictions(truth, predictions)

    total_gt = len(truth)
    total_pred = len(predictions)
    tp = matching.tp
    fn = matching.fn

    # FP vs Unverified Excess
    if dataset_kind == "dev2_validation":
        fp: Optional[int] = len(matching.unmatched_predictions)
        unverified_excess: int = 0
        unverified_excess_per_1000 = 0.0
        precision = tp / (tp + fp) if (tp + fp) > 0 else (1.0 if fn == 0 else 0.0)
        f1 = (2 * precision * matching.recall / (precision + matching.recall)) if (precision + matching.recall) > 0 else 0.0
    else:
        # BoxingVI and Adam (exhaustive negative annotation is unverified)
        fp = None
        precision = None
        f1 = None
        unverified_excess = len(matching.unmatched_predictions)
        unverified_excess_per_1000 = (
            (unverified_excess / total_frames * 1000.0) if total_frames > 0 else 0.0
        )

    # Secondary metric: evaluate_intervals from boxing_research with min_iou
    # IoU measures event intervals only. Use a common accepted class token so
    # generic DEV-2 PUNCH labels do not invoke classification validation.
    gt_dicts = [{"startFrame": g.start_frame, "endFrame": g.end_frame, "technique": "jab"} for g in truth]
    pred_dicts = [
        {"startFrame": p.start_frame, "endFrame": p.end_frame, "technique": "jab"}
        for p in predictions
        if p.end_frame >= p.start_frame >= 0
    ]
    secondary_iou = evaluate_intervals(gt_dicts, pred_dicts, min_iou=min_iou)

    return {
        "dataset_kind": dataset_kind,
        "total_gt": total_gt,
        "total_pred": total_pred,
        "tp": tp,
        "fn": fn,
        "fp": fp,
        "recall": matching.recall,
        "precision": round(precision, 4) if precision is not None else None,
        "f1": round(f1, 4) if f1 is not None else None,
        "unverified_excess": unverified_excess,
        "unverified_excess_per_1000_frames": round(unverified_excess_per_1000, 3),
        "duplicate_intervals_count": matching.duplicate_intervals_count,
        "duplicate_gt_ids": matching.duplicate_gt_ids,
        "matches": matching.matches,
        "unmatched_predictions": matching.unmatched_predictions,
        "secondary_interval_iou": {
            "min_iou": min_iou,
            "tp": secondary_iou.get("tp") if secondary_iou else None,
            "fp": secondary_iou.get("fp") if secondary_iou else None,
            "fn": secondary_iou.get("fn") if secondary_iou else None,
            "recall": round(secondary_iou.get("recall", 0.0), 4) if secondary_iou else None,
            "precision": round(secondary_iou.get("precision", 0.0), 4) if secondary_iou else None,
            "f1": round(secondary_iou.get("f1", 0.0), 4) if secondary_iou else None,
        } if secondary_iou else None,
    }


# ─── Ground Truth & Video File Loaders ────────────────────────────────────────

def file_sha256(path: Path) -> str:
    """Compute sha256 of file if exists, else return empty."""
    if not path.is_file():
        return ""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def load_csv_truth(csv_path: Path, window: Optional[Tuple[int, int]] = None) -> list[GroundTruthInterval]:
    """Load intervals from clean_annotation CSV, optionally filtering by [start, end) window."""
    intervals: list[GroundTruthInterval] = []
    with csv_path.open(encoding="utf-8-sig", newline="") as source:
        for index, row in enumerate(csv.DictReader(source)):
            sf, ef = int(row["start_frame"]), int(row["end_frame"])
            # Validate only the frozen evaluated window. V10 row 123 is reversed
            # at 9760..9723, entirely outside [4000, 5500); never alter that label.
            if window and (max(sf, ef) < window[0] or min(sf, ef) >= window[1]):
                continue
            if sf < 0 or ef < sf:
                raise ValueError(f"Invalid annotation interval at row {index + 2}")
            intervals.append(GroundTruthInterval(
                start_frame=sf, end_frame=ef,
                label=row["class"].strip().lower().replace(" ", "_"),
                id=str(index), video=csv_path.stem,
            ))

    return intervals


def load_dev2_in_scope_truth(gt_path: Path) -> list[GroundTruthInterval]:
    """Load in-scope punch ground-truth events from gt_*.json for DEV-2 validation videos."""
    with open(gt_path, encoding="utf-8") as f:
        data = json.load(f)
    events = data.get("events", []) if isinstance(data, dict) else data
    intervals: list[GroundTruthInterval] = []

    for e in events:
        if e.get("label") == "PUNCH" and e.get("evaluation_scope") == "IN_SCOPE":
            sf = e.get("start_frame", 0)
            ef = e.get("end_frame", sf)
            intervals.append(
                GroundTruthInterval(
                    start_frame=sf,
                    end_frame=ef,
                    label=e.get("technique", "punch"),
                    id=str(e.get("id", len(intervals))),
                    video=gt_path.stem,
                )
            )
    return intervals


# ─── Candidate Configurations (12 Candidates) ────────────────────────────────

CANDIDATE_CONFIGS: dict[str, dict[str, Any]] = {
    # Baseline
    "C00_legacy_baseline": {
        "family": "C",
        "description": "Baseline legacy FSM with default thresholds",
        "fsm_config": asdict(PunchDetectorConfig()),
    },
    # Family C: FSM modifications
    "C01_fsm_mild_relax": {
        "family": "C",
        "description": "FSM mild relaxation (elbow 125, disp ratio 0.25, cooldown 150)",
        "fsm_config": asdict(PunchDetectorConfig(
            min_elbow_angle_straight=125.0,
            min_extension_disp_ratio=0.25,
            min_retraction_ratio=0.25,
            refractory_cooldown_ms=150.0,
        )),
    },
    "C02_fsm_moderate_relax": {
        "family": "C",
        "description": "FSM moderate relaxation (elbow 120, disp 0.20, speed 0.40, cooldown 120)",
        "fsm_config": asdict(PunchDetectorConfig(
            min_elbow_angle_straight=120.0,
            min_extension_disp_ratio=0.20,
            min_retraction_ratio=0.20,
            min_extension_speed=0.40,
            refractory_cooldown_ms=120.0,
        )),
    },
    "C03_fsm_fast_combo": {
        "family": "C",
        "description": "FSM fast combination tuning (elbow 125, duration 80, cooldown 100)",
        "fsm_config": asdict(PunchDetectorConfig(
            min_elbow_angle_straight=125.0,
            min_extension_disp_ratio=0.20,
            min_retraction_ratio=0.20,
            min_punch_duration_ms=80.0,
            refractory_cooldown_ms=100.0,
        )),
    },
    "C04_fsm_angle_only": {
        "family": "C",
        "description": "FSM angle-only relaxation (straight 120, hook 75-130)",
        "fsm_config": asdict(PunchDetectorConfig(
            min_elbow_angle_straight=120.0,
            min_elbow_angle_hook=75.0,
            max_elbow_angle_hook=130.0,
        )),
    },
    "C05_fsm_deep_combo": {
        "family": "C",
        "description": "FSM deep combo tuning (elbow 120, abs disp 0.05, speed 0.35, cooldown 120)",
        "fsm_config": asdict(PunchDetectorConfig(
            min_elbow_angle_straight=120.0,
            min_extension_disp_ratio=0.22,
            min_extension_disp=0.05,
            min_retraction_ratio=0.22,
            min_extension_speed=0.35,
            refractory_cooldown_ms=120.0,
        )),
    },
    # Family A: Wrist extension peaks (PunchEventDetectorV2)
    "C06_v2_default": {
        "family": "A",
        "description": "V2 event detector with default thresholds",
        "v2_config": asdict(PunchEventDetectorV2Config()),
    },
    "C07_v2_sensitive": {
        "family": "A",
        "description": "V2 sensitive thresholds (ext 0.10, prom 0.008, conf 0.30)",
        "v2_config": asdict(PunchEventDetectorV2Config(
            min_keypoint_confidence=0.30,
            min_horizontal_extension=0.10,
            min_peak_prominence=0.008,
            peak_radius_frames=2,
            evidence_radius_frames=5,
            same_arm_refractory_frames=3,
        )),
    },
    "C08_v2_conservative": {
        "family": "A",
        "description": "V2 conservative thresholds (ext 0.18, prom 0.015, conf 0.40)",
        "v2_config": asdict(PunchEventDetectorV2Config(
            min_keypoint_confidence=0.40,
            min_horizontal_extension=0.18,
            min_peak_prominence=0.015,
            peak_radius_frames=3,
            evidence_radius_frames=6,
            same_arm_refractory_frames=5,
        )),
    },
    "C09_v2_moderate": {
        "family": "A",
        "description": "V2 moderate thresholds (ext 0.12, prom 0.012, conf 0.35)",
        "v2_config": asdict(PunchEventDetectorV2Config(
            min_keypoint_confidence=0.35,
            min_horizontal_extension=0.12,
            min_peak_prominence=0.012,
            peak_radius_frames=3,
            evidence_radius_frames=6,
            same_arm_refractory_frames=4,
        )),
    },
    # Family B: Torso peak shadow (strike_events.py)
    "C10_shadow_default": {
        "family": "B",
        "description": "Shadow event detector with default thresholds",
        "shadow_config": asdict(EventDetectorConfig()),
    },
    "C11_shadow_conservative": {
        "family": "B",
        "description": "Shadow conservative thresholds (reach 0.75, prom 0.06, speed 0.8)",
        "shadow_config": asdict(EventDetectorConfig(
            min_confidence=0.5,
            min_reach=0.75,
            min_prominence=0.06,
            min_extension_speed=0.8,
            refractory_ms=200.0,
        )),
    },
    "C12_shadow_moderate": {
        "family": "B",
        "description": "Shadow moderate thresholds (reach 0.70, prom 0.05, speed 0.6)",
        "shadow_config": asdict(EventDetectorConfig(
            min_confidence=0.45,
            min_reach=0.70,
            min_prominence=0.05,
            min_extension_speed=0.6,
            refractory_ms=180.0,
        )),
    },
}


# ─── Dataset Windows & Paths (Frozen Protocol §2) ───────────────────────────

DATASET_SPECS = {
    "DEV-1": {
        "kind": "adam",
        "video_path": ROOT / "test_results/external/boxe_ml/96f3a7d0716040682381fb63f80afac96f74cfa6/adam.mp4",
        "truth_path": ROOT / "test_results/external/boxe_ml/96f3a7d0716040682381fb63f80afac96f74cfa6/adam_gt.csv",
        "fps": 30.0,
        "window": None,
        "total_frames": 597,
    },
    "DEV-2": {
        "kind": "dev2_validation",
        "videos_dir": ROOT / "validation_videos",
        "ground_truth_dir": ROOT / "ground_truth",
        "clips": [
            "vid_01_cross_heavybag",
            "vid_02_referee_gestures",
            "vid_03_fighter_walkout",
            "vid_04_cage_striking",
            "vid_05_ground_grappling",
            "vid_06_post_fight",
        ],
        "fps": 60.0,
        "total_frames": 4203,
    },
    "DEV-3": {
        "kind": "boxingvi",
        "name": "V4",
        "video_path": ROOT / "test_results/external/boxingvi_original_20261006/rgb/IVvOmoB88FM.mp4",
        "truth_path": ROOT / "test_results/external/boxe_ml/96f3a7d0716040682381fb63f80afac96f74cfa6/clean_annotation_data/V4.csv",
        "fps": 23.976023976023978,
        "window": (19000, 20500),  # 1,500 frames, 71 labels
        "total_frames": 1500,
    },
    "TEST-1": {
        "kind": "boxingvi",
        "name": "V6",
        "video_path": ROOT / "test_results/external/boxingvi_original_20261006/rgb/cQW-h8yGbRc.mp4",
        "truth_path": ROOT / "test_results/external/boxe_ml/96f3a7d0716040682381fb63f80afac96f74cfa6/clean_annotation_data/V6.csv",
        "fps": 23.976023976023978,
        "window": (36500, 38000),  # 1,500 frames, 85 labels
        "total_frames": 1500,
    },
    "TEST-2": {
        "kind": "boxingvi",
        "name": "V10",
        "video_path": ROOT / "test_results/external/boxingvi_original_20261006/rgb/OfZFdwW322E.mp4",
        "truth_path": ROOT / "test_results/external/boxe_ml/96f3a7d0716040682381fb63f80afac96f74cfa6/clean_annotation_data/V10.csv",
        "fps": 25.0,
        "window": (4000, 5500),  # 1,500 frames, 39 labels
        "total_frames": 1500,
    },
}


# ─── Frame Processing & Pose Landmark Extraction ─────────────────────────────

def extract_video_window_data(
    video_path: Path,
    start_frame: int,
    num_frames: int,
    cache_path: Optional[Path] = None,
) -> dict[str, Any]:
    """Extract tracked frames and raw keypoints for a video window, caching to disk."""
    if cache_path and cache_path.is_file():
        try:
            with open(cache_path, encoding="utf-8") as f:
                data = json.load(f)
            if len(data.get("frames", [])) == num_frames and "raw_records" in data:
                return data
        except Exception:
            pass

    import cv2
    from ultralytics import YOLO
    from person_tracker import PersonTracker

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise ValueError(f"Cannot open video: {video_path}")

    source_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    img_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    img_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)

    model = YOLO(str(ROOT / "yolov8n-pose.pt"))
    tracker = PersonTracker(max_missing_frames=15, max_landmark_jump=0.14, fps=source_fps)
    action_pipeline = ActionPipeline()

    frames: list[dict[str, Any]] = []
    raw_records: list[dict[str, Any]] = []

    print(f"Extracting {num_frames} frames from {video_path.name} (start={start_frame})...", flush=True)

    for offset in range(num_frames):
        current_idx = start_frame + offset
        ret, frame = cap.read()
        if not ret:
            break
        results = model(frame, conf=0.5, verbose=False)
        kps, is_disc = tracker.update(results, current_idx, img_w, img_h)
        time_ms = current_idx * 1000.0 / source_fps

        obs_kind = ObservationKind.FRESH_DETECTION if kps else ObservationKind.MISSING_DETECTION
        observation = PoseObservation(
            keypoints=kps,
            observation_kind=obs_kind,
            is_discontinuous=is_disc,
        )
        context = FrameContext(
            frame_idx=current_idx,
            time_ms=time_ms,
            fps=source_fps,
            img_w=img_w,
            img_h=img_h,
        )
        res = action_pipeline.process_frame(observation, context)
        rec = res.to_legacy_dict()
        rec["observationKind"] = obs_kind.value
        rec["posture"] = res.lower_body.posture if res.lower_body else "unknown"
        frames.append(rec)

        raw_records.append({
            "frameIdx": current_idx,
            "timeMs": round(time_ms, 2),
            "isDiscontinuous": is_disc,
            "observationKind": obs_kind.value,
            "raw_keypoints": [{"x": p.x, "y": p.y, "conf": p.conf} for p in (kps or [])],
        })

        if (offset + 1) % 100 == 0 or (offset + 1) == num_frames:
            print(f"  [{video_path.name}] Frame {offset+1}/{num_frames} extracted...", flush=True)

    cap.release()

    punches, kicks = action_pipeline.get_results()
    recovered_kicks = recover_kick_events(frames, source_fps)
    punches = suppress_punches_during_kicks(punches, recovered_kicks)

    data = {
        "video": video_path.name,
        "startFrame": start_frame,
        "numFrames": len(frames),
        "fps": source_fps,
        "imgWidth": img_w,
        "imgHeight": img_h,
        "frames": frames,
        "raw_records": raw_records,
        "baseline_punches": [p.to_dict() for p in punches],
    }

    if cache_path:
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump(data, f)

    return data


def run_detector_on_cached_data(
    data: dict[str, Any],
    config_id: str,
) -> list[PunchPrediction]:
    """Execute a configured punch detector candidate on cached tracking and pose data."""
    cfg = CANDIDATE_CONFIGS[config_id]
    family = cfg["family"]
    fps = data["fps"]
    img_w = data["imgWidth"]
    img_h = data["imgHeight"]
    frames = data["frames"]
    raw_records = data["raw_records"]

    if config_id == "C00_legacy_baseline":
        # Baseline punches already generated and verified bit-exact
        return [
            PunchPrediction(
                impact_frame=p["impactFrame"],
                start_frame=p.get("startFrame", 0),
                end_frame=p.get("endFrame", 0),
                arm=p.get("arm", "unknown"),
                punch_type=p.get("punchType", "unknown_punch"),
                id=f"fsm_{p.get('arm', '')}_{p['impactFrame']}",
            )
            for p in data["baseline_punches"]
        ]

    elif family == "C":
        # Legacy FSM with modified thresholds
        fsm_kwargs = cfg["fsm_config"]
        det_config = PunchDetectorConfig(**fsm_kwargs)
        pipeline = ActionPipeline()
        pipeline.punch_analyzer = PunchAnalyzer(config=det_config)

        replayed_frames = []
        for r in raw_records:
            pts = [Point(**p) for p in r.get("raw_keypoints", [])]
            obs = PoseObservation(
                keypoints=pts if pts else None,
                observation_kind=ObservationKind(r["observationKind"]),
                is_discontinuous=r.get("isDiscontinuous", False),
            )
            ctx = FrameContext(
                frame_idx=r["frameIdx"],
                time_ms=r["timeMs"],
                fps=fps,
                img_w=img_w,
                img_h=img_h,
            )
            res = pipeline.process_frame(obs, ctx)
            rec = res.to_legacy_dict()
            rec["observationKind"] = r["observationKind"]
            rec["posture"] = res.lower_body.posture if res.lower_body else "unknown"
            replayed_frames.append(rec)

        punches, _ = pipeline.get_results()
        recovered_kicks = recover_kick_events(replayed_frames, fps)
        punches = suppress_punches_during_kicks(punches, recovered_kicks)

        return [
            PunchPrediction(
                impact_frame=p.impact_frame,
                start_frame=p.start_frame,
                end_frame=p.end_frame,
                arm=p.arm,
                punch_type=p.punch_type,
                id=f"fsm_{p.arm}_{p.impact_frame}",
            )
            for p in punches
        ]

    elif family == "A":
        # PunchEventDetectorV2
        v2_kwargs = cfg["v2_config"]
        v2_config = PunchEventDetectorV2Config(**v2_kwargs)
        results = build_heavy_bag_punch_results(frames, fps=fps, config=v2_config)
        return [
            PunchPrediction(
                impact_frame=r.impact_frame,
                start_frame=r.start_frame,
                end_frame=r.end_frame,
                arm=r.arm,
                punch_type=r.punch_type,
                id=f"v2_{r.arm}_{r.impact_frame}",
            )
            for r in results
        ]

    elif family == "B":
        # Torso peak shadow
        shadow_kwargs = cfg["shadow_config"]
        shadow_config = EventDetectorConfig(**shadow_kwargs)
        aspect = img_w / img_h if img_h > 0 else 1.0
        raw_events = detect_punch_events(
            frames,
            fps=fps,
            training_mode="diagnostic_stress",
            aspect=aspect,
            config=shadow_config,
        )
        return [
            PunchPrediction(
                impact_frame=e["impactFrame"],
                start_frame=e.get("startFrame", e["impactFrame"]),
                end_frame=e.get("endFrame", e["impactFrame"]),
                arm=e.get("side", "unknown"),
                punch_type=e.get("technique", "unknown_punch"),
                id=e.get("id", f"shadow_{e['impactFrame']}"),
            )
            for e in raw_events.get("events", [])
        ]

    else:
        raise ValueError(f"Unknown candidate family: {family}")


# ─── Evaluation Suite Runner ─────────────────────────────────────────────────

def evaluate_dataset_split(
    split_name: str,
    candidate_id: str,
    cache_dir: Path,
) -> dict[str, Any]:
    """Evaluate candidate on a specified split (DEV or TEST) and return structured report."""
    results_per_video: dict[str, Any] = {}
    code_hashes = {
        "evaluate_punch_recall.py": file_sha256(ROOT / "evaluate_punch_recall.py"),
        "punch_analyzer.py": file_sha256(ROOT / "punch_analyzer.py"),
        "punch_event_detector_v2.py": file_sha256(ROOT / "punch_event_detector_v2.py"),
        "pipeline/strike_events.py": file_sha256(ROOT / "pipeline/strike_events.py"),
        "process_video.py": file_sha256(ROOT / "process_video.py"),
        "person_tracker.py": file_sha256(ROOT / "person_tracker.py"),
    }
    pose_model_hash = file_sha256(ROOT / "yolov8n-pose.pt")

    if split_name in ("dev", "dev-all"):
        eval_keys = ["DEV-1", "DEV-2", "DEV-3"]
    elif split_name in ("test", "test-all"):
        eval_keys = ["TEST-1", "TEST-2"]
    elif split_name == "all":
        eval_keys = list(DATASET_SPECS)
    elif split_name == "dev-1":
        eval_keys = ["DEV-1"]
    elif split_name == "dev-2":
        eval_keys = ["DEV-2"]
    elif split_name == "dev-3":
        eval_keys = ["DEV-3"]
    else:
        raise ValueError(f"Unknown split: {split_name}")

    for key in eval_keys:
        spec = DATASET_SPECS[key]
        kind = spec["kind"]

        if kind == "dev2_validation":
            # 6 validation videos
            vids_dir = spec["videos_dir"]
            gt_dir = spec["ground_truth_dir"]
            dev2_video_reports = []
            aggregate_dev2_tp = 0
            aggregate_dev2_fp = 0
            aggregate_dev2_fn = 0
            aggregate_dev2_gt = 0
            aggregate_dev2_pred = 0

            for clip_name in spec["clips"]:
                v_path = vids_dir / f"{clip_name}.mp4"
                gt_path = gt_dir / f"gt_{clip_name[4:]}.json"
                truth = load_dev2_in_scope_truth(gt_path)

                # Extract frames or load cache
                cache_file = cache_dir / f"{clip_name}_tracked.json"
                import cv2
                cap_t = cv2.VideoCapture(str(v_path))
                c_frames = int(cap_t.get(cv2.CAP_PROP_FRAME_COUNT))
                cap_t.release()

                vdata = extract_video_window_data(v_path, 0, c_frames, cache_file)
                preds = run_detector_on_cached_data(vdata, candidate_id)

                rep = evaluate_punch_recall(truth, preds, dataset_kind="dev2_validation", total_frames=c_frames)
                rep["video"] = clip_name
                rep["video_sha256"] = file_sha256(v_path)
                rep["gt_sha256"] = file_sha256(gt_path)
                rep["cache_sha256"] = file_sha256(cache_file)
                rep["fps"] = vdata["fps"]
                rep["evaluated_frames"] = len(vdata["frames"])
                dev2_video_reports.append(rep)

                aggregate_dev2_tp += rep["tp"]
                aggregate_dev2_fp += (rep["fp"] or 0)
                aggregate_dev2_fn += rep["fn"]
                aggregate_dev2_gt += rep["total_gt"]
                aggregate_dev2_pred += rep["total_pred"]

            dev2_recall = aggregate_dev2_tp / aggregate_dev2_gt if aggregate_dev2_gt else 1.0
            dev2_precision = aggregate_dev2_tp / (aggregate_dev2_tp + aggregate_dev2_fp) if (aggregate_dev2_tp + aggregate_dev2_fp) else 0.0

            results_per_video["DEV-2"] = {
                "dataset_kind": "dev2_validation",
                "clips_count": len(spec["clips"]),
                "total_gt": aggregate_dev2_gt,
                "total_pred": aggregate_dev2_pred,
                "tp": aggregate_dev2_tp,
                "fp": aggregate_dev2_fp,
                "fn": aggregate_dev2_fn,
                "recall": round(dev2_recall, 4),
                "precision": round(dev2_precision, 4),
                "per_clip": dev2_video_reports,
            }

        else:
            # Adam or BoxingVI single video
            v_path = spec["video_path"]
            t_path = spec["truth_path"]
            window = spec["window"]
            truth = load_csv_truth(t_path, window=window)

            w_start = window[0] if window else 0
            w_count = (window[1] - window[0]) if window else spec["total_frames"]
            cache_file = cache_dir / f"{v_path.stem}_{w_start}_{w_count}.json"

            vdata = extract_video_window_data(v_path, w_start, w_count, cache_file)
            preds = run_detector_on_cached_data(vdata, candidate_id)

            rep = evaluate_punch_recall(
                truth, preds, dataset_kind=kind, total_frames=len(vdata["frames"])
            )
            rep["video"] = v_path.name
            rep["video_sha256"] = file_sha256(v_path)
            rep["truth_sha256"] = file_sha256(t_path)
            rep["cache_sha256"] = file_sha256(cache_file)
            rep["fps"] = vdata["fps"]
            rep["window"] = list(window) if window else None
            rep["evaluated_frames"] = len(vdata["frames"])
            results_per_video[key] = rep

    # Calculate overall aggregate metrics for this split
    total_gt_all = 0
    total_tp_all = 0
    total_fn_all = 0
    total_unverified_all = 0
    total_evaluated_frames_all = 0

    for k, v in results_per_video.items():
        if k == "DEV-2":
            total_gt_all += v["total_gt"]
            total_tp_all += v["tp"]
            total_fn_all += v["fn"]
        else:
            total_gt_all += v["total_gt"]
            total_tp_all += v["tp"]
            total_fn_all += v["fn"]
            total_unverified_all += v.get("unverified_excess", 0)
            total_evaluated_frames_all += v.get("evaluated_frames", 0)

    combined_recall = total_tp_all / total_gt_all if total_gt_all else 0.0

    return {
        "split": split_name,
        "candidate_id": candidate_id,
        "candidate_info": CANDIDATE_CONFIGS[candidate_id],
        "configuration_sha256": hashlib.sha256(json.dumps(CANDIDATE_CONFIGS[candidate_id], sort_keys=True).encode()).hexdigest(),
        "protocol_sha256": file_sha256(ROOT / "benchmark_results/punch_recall_protocol_t022.md"),
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "pose_model_sha256": pose_model_hash,
        "code_hashes": code_hashes,
        "summary": {
            "total_gt": total_gt_all,
            "tp": total_tp_all,
            "fn": total_fn_all,
            "combined_recall": round(combined_recall, 4),
            "total_unverified_excess": total_unverified_all,
            "unverified_excess_per_1000_frames": round(
                (total_unverified_all / total_evaluated_frames_all * 1000.0)
                if total_evaluated_frames_all > 0 else 0.0, 3
            ),
        },
        "details": results_per_video,
    }


# ─── Selection Runner & CLI ──────────────────────────────────────────────────

def select_best_candidate_on_dev(dev_reports: dict[str, dict[str, Any]]) -> str:
    """Select the best candidate config on DEV strictly adhering to Protocol §4."""
    baseline = dev_reports["C00_legacy_baseline"]
    baseline_dev2 = baseline["details"]["DEV-2"]
    max_allowed_fp = baseline_dev2["fp"]  # exactly 6

    # Specific clip baseline limits: vid_02 <= 3, vid_03 == 0, vid_05 <= 1, vid_06 <= 1
    clip_fp_limits = {
        "vid_02_referee_gestures": 3,
        "vid_03_fighter_walkout": 0,
        "vid_05_ground_grappling": 1,
        "vid_06_post_fight": 1,
    }

    eligible: list[dict[str, Any]] = []

    for cid, rep in dev_reports.items():
        if cid == "C00_legacy_baseline":
            continue
        dev2 = rep["details"]["DEV-2"]
        # Hard constraint 1: FN must be 0
        if dev2["fn"] != 0:
            continue
        # Hard constraint 2: Total FP <= 6 and no new FP on zero-punch clips
        if dev2["fp"] > max_allowed_fp:
            continue
        clip_violated = False
        for c in dev2["per_clip"]:
            cname = c["video"]
            if cname in clip_fp_limits and (c["fp"] or 0) > clip_fp_limits[cname]:
                clip_violated = True
                break
        if clip_violated:
            continue

        # DEV recall across DEV-1 (Adam) and DEV-3 (V4)
        adam_tp = rep["details"]["DEV-1"]["tp"]
        adam_gt = rep["details"]["DEV-1"]["total_gt"]
        v4_tp = rep["details"]["DEV-3"]["tp"]
        v4_gt = rep["details"]["DEV-3"]["total_gt"]
        dev_recall = (adam_tp + v4_tp) / (adam_gt + v4_gt)
        unverified_v4 = rep["details"]["DEV-3"]["unverified_excess"]

        eligible.append({
            "candidate_id": cid,
            "dev_recall": dev_recall,
            "unverified_v4": unverified_v4,
            "macro_f1": sum(
                (video.get("secondary_interval_iou") or {}).get("f1", 0.0)
                for video in [rep["details"]["DEV-1"], rep["details"]["DEV-3"], *dev2["per_clip"]]
            ) / (2 + len(dev2["per_clip"])),
            "family": rep["candidate_info"]["family"],
            "adam_tp": adam_tp,
            "v4_tp": v4_tp,
            "dev2_fp": dev2["fp"],
        })

    if not eligible:
        return "C00_legacy_baseline"

    # Sort by dev_recall DESC, unverified_v4 ASC, family preference C > A > B
    family_pref = {"C": 3, "A": 2, "B": 1}
    eligible.sort(
        key=lambda x: (
            x["dev_recall"],
            -x["unverified_v4"],
            x["macro_f1"],
            family_pref.get(x["family"], 0),
        ),
        reverse=True,
    )
    return eligible[0]["candidate_id"]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--split", choices=["dev", "test", "dev-1", "dev-2", "dev-3", "all"], default="dev")
    parser.add_argument("--candidate", default="C00_legacy_baseline", help="Candidate configuration ID")
    parser.add_argument("--cache-dir", type=Path, default=ROOT / "test_results/t022_inference")
    parser.add_argument("--output", type=Path, help="Output JSON path")
    parser.add_argument("--run-baseline", action="store_true", help="Run baseline on DEV and TEST and save punch_recall_t022_baseline.json")
    parser.add_argument("--run-dev-candidates", action="store_true", help="Evaluate all 12 candidate configurations on DEV and print ranking")
    parser.add_argument("--run-final", action="store_true", help="Run TEST exactly once with selected candidate and save punch_recall_t022_final.json")
    args = parser.parse_args()

    args.cache_dir.mkdir(parents=True, exist_ok=True)

    if args.run_baseline:
        # Step 2: Run baseline on DEV and TEST, write punch_recall_t022_baseline.json
        print("=== Running Baseline (C00_legacy_baseline) on DEV ===", flush=True)
        dev_baseline = evaluate_dataset_split("dev", "C00_legacy_baseline", args.cache_dir)
        print("=== Running Baseline (C00_legacy_baseline) on TEST ===", flush=True)
        test_baseline = evaluate_dataset_split("test", "C00_legacy_baseline", args.cache_dir)

        baseline_doc = {
            "title": "T-022 Punch Detector Recall Baseline",
            "protocol": "benchmark_results/punch_recall_protocol_t022.md",
            "candidate_id": "C00_legacy_baseline",
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "code_hashes": dev_baseline["code_hashes"],
            "pose_model_sha256": dev_baseline["pose_model_sha256"],
            "dev_baseline": dev_baseline,
            "test_baseline": test_baseline,
        }

        out_path = args.output or (ROOT / "benchmark_results/punch_recall_t022_baseline.json")
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(baseline_doc, f, indent=2, ensure_ascii=False)
        print(f"✅ Baseline saved to {out_path}", flush=True)
        return

    if args.run_dev_candidates:
        print("=== Evaluating All Candidate Configurations on DEV ===", flush=True)
        all_dev_reports: dict[str, Any] = {}
        for cid in CANDIDATE_CONFIGS.keys():
            print(f"--> Evaluating {cid}...", flush=True)
            rep = evaluate_dataset_split("dev", cid, args.cache_dir)
            all_dev_reports[cid] = rep
            adam_tp = rep["details"]["DEV-1"]["tp"]
            v4_tp = rep["details"]["DEV-3"]["tp"]
            dev2_fp = rep["details"]["DEV-2"]["fp"]
            dev2_fn = rep["details"]["DEV-2"]["fn"]
            comb_rec = (adam_tp + v4_tp) / (rep["details"]["DEV-1"]["total_gt"] + rep["details"]["DEV-3"]["total_gt"])
            print(f"    Adam TP={adam_tp}/18, V4 TP={v4_tp}/71, Combined Recall={comb_rec:.1%}, DEV-2 FP={dev2_fp}, FN={dev2_fn}", flush=True)

        chosen = select_best_candidate_on_dev(all_dev_reports)
        out_path = args.output or (ROOT / "benchmark_results/punch_recall_t022_dev.json")
        out_path.write_text(json.dumps({"dev_reports": all_dev_reports, "selected_candidate": chosen}, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"\nBest Candidate Selected by Protocol: {chosen}; DEV reports: {out_path}", flush=True)
        return

    if args.run_final:
        # Run TEST once with candidate specified by --candidate
        cid = args.candidate
        dev_path = ROOT / "benchmark_results/punch_recall_t022_dev.json"
        dev_doc = json.loads(dev_path.read_text(encoding="utf-8"))
        if cid != select_best_candidate_on_dev(dev_doc["dev_reports"]):
            raise ValueError("Candidate must match the frozen DEV selection")
        # Exclusive marker prevents accidentally repeating held-out candidate evaluation.
        marker = args.cache_dir / "final_test_started.json"
        with marker.open("x", encoding="utf-8") as handle:
            json.dump({"candidate_id": cid, "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()}, handle)
        print(f"=== Running Final Evaluation on TEST with chosen candidate: {cid} ===", flush=True)
        test_final = evaluate_dataset_split("test", cid, args.cache_dir)
        final_doc = {
            "title": "T-022 Punch Detector Recall Final Evaluation",
            "protocol": "benchmark_results/punch_recall_protocol_t022.md",
            "candidate_id": cid,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "code_hashes": test_final["code_hashes"],
            "pose_model_sha256": test_final["pose_model_sha256"],
            "test_final": test_final,
            "dev_reports": dev_doc["dev_reports"],
            "selection": {"candidate_id": cid, "source": "DEV only; protocol section 4", "macro_f1_definition": "Mean per-video interval-event F1 over Adam, V4 and six DEV-2 clips"},
            "configuration_sha256": test_final["configuration_sha256"],
        }
        out_path = args.output or (ROOT / "benchmark_results/punch_recall_t022_final.json")
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(final_doc, f, indent=2, ensure_ascii=False)
        print(f"✅ Final test evaluation saved to {out_path}", flush=True)
        return

    # Default single execution
    report = evaluate_dataset_split(args.split, args.candidate, args.cache_dir)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        print(f"Report written to {args.output}")
    else:
        print(json.dumps(report["summary"], indent=2))


if __name__ == "__main__":
    main()
