"""
evaluate_punch_detector.py — MMA-TMS Comprehensive Validation & Evaluation Engine
Performs automated benchmarking of the Punch Detection system against ground-truth annotations
across the entire validation dataset.

Calculates:
  - Overall metrics (TP, FP, FN, Precision, Recall, F1)
  - Per-video metrics breakdown
  - Per-punch-type metrics (Jab, Cross, Hook, Uppercut)
  - Per-scenario metrics (Heavy Bag, MMA Cage Striking, Non-Punch Gestures, Ground Grappling)
"""

import json
import os
import sys
from pathlib import Path
from typing import Dict, List, Any, Optional

def evaluate_single_video(
    pred_path: str,
    gt_path: str,
    temporal_tolerance_s: float = 0.35,
    match_arm: bool = True,
) -> Dict[str, Any]:
    """Evaluate predictions against ground-truth for a single video."""
    with open(pred_path, encoding="utf-8") as f:
        pred_data = json.load(f)
    with open(gt_path, encoding="utf-8") as f:
        gt_data = json.load(f)

    meta = pred_data.get("meta", {})
    fps = meta.get("fps", 60.0)
    total_frames = meta.get("totalFrames", 0)
    duration_ms = meta.get("durationMs", 0.0)

    pred_punches = pred_data.get("punches", [])
    
    # Filter only actual punch events in ground-truth (exclude GESTURE, PROBE, FEINT)
    gt_punch_events = [g for g in gt_data if g.get("label", "PUNCH") == "PUNCH"]
    gt_ambiguous_events = [g for g in gt_data if g.get("label") in ("PROBE", "FEINT", "GESTURE")]

    matched_gt = set()
    matched_pred = set()
    matches = []
    fp_details = []

    for p_idx, pred in enumerate(pred_punches):
        pred_impact_s = pred.get("impactTimeMs", 0.0) / 1000.0
        pred_arm = pred.get("arm", "").lower()
        pred_type = pred.get("punchType", "").lower()

        best_gt_idx = None
        best_diff = float("inf")

        for g_idx, gt in enumerate(gt_punch_events):
            if g_idx in matched_gt:
                continue
            gt_peak_s = gt.get("peak_time", 0.0)
            gt_arm = (gt.get("arm") or gt.get("hand") or "").lower()

            diff = abs(pred_impact_s - gt_peak_s)
            if diff <= temporal_tolerance_s:
                if match_arm and gt_arm and pred_arm and gt_arm != pred_arm:
                    continue
                if diff < best_diff:
                    best_diff = diff
                    best_gt_idx = g_idx

        if best_gt_idx is not None:
            matched_gt.add(best_gt_idx)
            matched_pred.add(p_idx)
            matches.append({
                "pred_idx": p_idx,
                "gt_idx": best_gt_idx,
                "time_diff_s": round(best_diff, 3),
                "pred_arm": pred_arm,
                "gt_arm": (gt_punch_events[best_gt_idx].get("arm") or gt_punch_events[best_gt_idx].get("hand", "")).lower(),
                "pred_type": pred.get("punchType"),
                "gt_type": gt_punch_events[best_gt_idx].get("type") or gt_punch_events[best_gt_idx].get("technique"),
            })
        else:
            # Check if this FP matches an ambiguous gesture / probe
            matched_ambig = None
            for amb in gt_ambiguous_events:
                amb_peak_s = amb.get("peak_time", 0.0)
                if abs(pred_impact_s - amb_peak_s) <= temporal_tolerance_s:
                    matched_ambig = amb
                    break
            fp_details.append({
                "pred_idx": p_idx,
                "impact_s": round(pred_impact_s, 2),
                "start_frame": pred.get("startFrame"),
                "impact_frame": pred.get("impactFrame"),
                "end_frame": pred.get("endFrame"),
                "arm": pred.get("arm"),
                "type": pred.get("punchType"),
                "peak_speed": pred.get("peakSpeed"),
                "max_elbow_angle": pred.get("maxElbowAngle"),
                "ambiguous_match": matched_ambig.get("label") if matched_ambig else None,
            })

    tp = len(matched_pred)
    fp = len(pred_punches) - tp
    fn = len(gt_punch_events) - len(matched_gt)

    precision = tp / len(pred_punches) if pred_punches else (1.0 if len(gt_punch_events) == 0 else 0.0)
    recall = tp / len(gt_punch_events) if gt_punch_events else (1.0 if len(pred_punches) == 0 else 0.0)
    f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) > 0 else 0.0

    return {
        "video": Path(pred_path).stem.replace("pred_", "") + ".mp4",
        "duration_s": round(duration_ms / 1000.0, 2),
        "total_frames": total_frames,
        "gt_count": len(gt_punch_events),
        "pred_count": len(pred_punches),
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        "matches": matches,
        "fp_details": fp_details,
        "fn_details": [
            gt_punch_events[i] for i in range(len(gt_punch_events)) if i not in matched_gt
        ],
    }

def run_evaluation_suite(
    validation_pairs: List[tuple],
    scenario_map: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """Runs evaluation across all validation pairs and aggregates multi-level metrics."""
    video_reports = []
    total_tp = 0
    total_fp = 0
    total_fn = 0
    total_gt = 0
    total_pred = 0

    per_type = {
        "Jab": {"tp": 0, "fp": 0, "fn": 0},
        "Cross": {"tp": 0, "fp": 0, "fn": 0},
        "Hook": {"tp": 0, "fp": 0, "fn": 0},
        "Uppercut": {"tp": 0, "fp": 0, "fn": 0},
    }

    per_scenario = {}

    for pred_file, gt_file in validation_pairs:
        rep = evaluate_single_video(pred_file, gt_file)
        video_reports.append(rep)
        v_name = rep["video"]

        total_tp += rep["tp"]
        total_fp += rep["fp"]
        total_fn += rep["fn"]
        total_gt += rep["gt_count"]
        total_pred += rep["pred_count"]

        # Track scenario
        scenario = scenario_map.get(v_name, "General") if scenario_map else "General"
        if scenario not in per_scenario:
            per_scenario[scenario] = {"tp": 0, "fp": 0, "fn": 0, "gt": 0, "pred": 0}
        per_scenario[scenario]["tp"] += rep["tp"]
        per_scenario[scenario]["fp"] += rep["fp"]
        per_scenario[scenario]["fn"] += rep["fn"]
        per_scenario[scenario]["gt"] += rep["gt_count"]
        per_scenario[scenario]["pred"] += rep["pred_count"]

        # Track per-punch-type
        for m in rep["matches"]:
            gt_t = str(m.get("gt_type", "")).capitalize()
            if gt_t in per_type:
                per_type[gt_t]["tp"] += 1

        for fp in rep["fp_details"]:
            pred_t = str(fp.get("type", "")).capitalize()
            if pred_t in per_type:
                per_type[pred_t]["fp"] += 1

        for fn in rep["fn_details"]:
            gt_t = str(fn.get("type") or fn.get("technique") or "").capitalize()
            if gt_t in per_type:
                per_type[gt_t]["fn"] += 1

    overall_prec = total_tp / total_pred if total_pred > 0 else (1.0 if total_gt == 0 else 0.0)
    overall_rec = total_tp / total_gt if total_gt > 0 else (1.0 if total_pred == 0 else 0.0)
    overall_f1 = (2 * overall_prec * overall_rec / (overall_prec + overall_rec)) if (overall_prec + overall_rec) > 0 else 0.0

    return {
        "overall": {
            "total_videos": len(validation_pairs),
            "total_gt": total_gt,
            "total_pred": total_pred,
            "tp": total_tp,
            "fp": total_fp,
            "fn": total_fn,
            "precision": round(overall_prec, 4),
            "recall": round(overall_rec, 4),
            "f1": round(overall_f1, 4),
        },
        "per_video": video_reports,
        "per_type": per_type,
        "per_scenario": per_scenario,
    }

if __name__ == "__main__":
    import glob

    pred_dir = Path("test_results/validation")
    gt_dir = Path("ground_truth")

    pairs = [
        ("test_results/validation/pred_01_cross_heavybag.json", "ground_truth/gt_01_cross_heavybag.json"),
        ("test_results/validation/pred_02_referee_gestures.json", "ground_truth/gt_02_referee_gestures.json"),
        ("test_results/validation/pred_03_fighter_walkout.json", "ground_truth/gt_03_fighter_walkout.json"),
        ("test_results/validation/pred_04_cage_striking.json", "ground_truth/gt_04_cage_striking.json"),
        ("test_results/validation/pred_05_ground_grappling.json", "ground_truth/gt_05_ground_grappling.json"),
        ("test_results/validation/pred_06_post_fight.json", "ground_truth/gt_06_post_fight.json"),
    ]

    scenario_map = {
        "01_cross_heavybag.mp4": "Heavy Bag (Solo Drill)",
        "02_referee_gestures.mp4": "Non-Punch Movement (Referee)",
        "03_fighter_walkout.mp4": "Non-Punch Movement (Fighter Warmup)",
        "04_cage_striking.mp4": "Live MMA Cage Striking",
        "05_ground_grappling.mp4": "Ground Grappling & Takedown",
        "06_post_fight.mp4": "Non-Punch Movement (Celebration)",
    }

    # Filter to pairs where pred exists
    active_pairs = [(p, g) for p, g in pairs if os.path.exists(p) and os.path.exists(g)]
    results = run_evaluation_suite(active_pairs, scenario_map)

    print("=" * 70)
    print("      MMA-TMS PUNCH DETECTOR COMPREHENSIVE VALIDATION REPORT      ")
    print("=" * 70)
    ov = results["overall"]
    print(f"Total Videos:  {ov['total_videos']}")
    print(f"Ground Truth:  {ov['total_gt']} punches")
    print(f"Predictions:   {ov['total_pred']} detections")
    print(f"True Pos (TP): {ov['tp']}")
    print(f"False Pos(FP): {ov['fp']}")
    print(f"False Neg(FN): {ov['fn']}")
    print(f"PRECISION:     {ov['precision'] * 100:.1f}%")
    print(f"RECALL:        {ov['recall'] * 100:.1f}%")
    print(f"F1 SCORE:      {ov['f1'] * 100:.1f}%")
    print("-" * 70)

    print("\nPER-VIDEO BREAKDOWN:")
    print(f"{'Video':<32} | {'GT':>3} | {'Pred':>4} | {'TP':>3} | {'FP':>3} | {'FN':>3} | {'Prec':>6} | {'Rec':>6} | {'F1':>6}")
    print("-" * 78)
    for v in results["per_video"]:
        print(f"{v['video']:<32} | {v['gt_count']:>3} | {v['pred_count']:>4} | {v['tp']:>3} | {v['fp']:>3} | {v['fn']:>3} | {v['precision']*100:>5.1f}% | {v['recall']*100:>5.1f}% | {v['f1']*100:>5.1f}%")

    print("\nPER-SCENARIO BREAKDOWN:")
    for sc, data in results["per_scenario"].items():
        p = data["tp"] / data["pred"] if data["pred"] > 0 else (1.0 if data["gt"] == 0 else 0.0)
        r = data["tp"] / data["gt"] if data["gt"] > 0 else (1.0 if data["pred"] == 0 else 0.0)
        f1 = (2 * p * r / (p + r)) if (p + r) > 0 else 0.0
        print(f"  * {sc:<35}: GT={data['gt']} Pred={data['pred']} TP={data['tp']} FP={data['fp']} FN={data['fn']} | Prec={p*100:.1f}% Rec={r*100:.1f}% F1={f1*100:.1f}%")

    print("\nPER-PUNCH-TYPE BREAKDOWN:")
    for pt, data in results["per_type"].items():
        tp, fp, fn = data["tp"], data["fp"], data["fn"]
        p = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        r = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = (2 * p * r / (p + r)) if (p + r) > 0 else 0.0
        print(f"  * {pt:<10}: TP={tp} FP={fp} FN={fn} | Prec={p*100:.1f}% Rec={r*100:.1f}% F1={f1*100:.1f}%")

