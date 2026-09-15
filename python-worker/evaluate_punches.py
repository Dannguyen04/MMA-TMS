import json
import sys
from pathlib import Path

def evaluate_detections(pred_json_path: str, gt_json_path: str, temporal_tolerance_s: float = 0.35):
    with open(pred_json_path, encoding="utf-8") as f:
        pred_data = json.load(f)
    with open(gt_json_path, encoding="utf-8") as f:
        gt_data = json.load(f)

    meta = pred_data.get("meta", {})
    fps = meta.get("fps", 60.0)
    total_frames = meta.get("totalFrames", 0)
    duration_ms = meta.get("durationMs", 0.0)

    pred_punches = pred_data.get("punches", [])
    gt_punches = gt_data

    # Match predictions to GT
    matched_gt = set()
    matched_pred = set()

    matches = []

    for p_idx, pred in enumerate(pred_punches):
        pred_impact_s = pred.get("impactTimeMs", 0.0) / 1000.0
        pred_arm = pred.get("arm", "").lower()
        pred_type = pred.get("punchType", "").lower()

        best_gt_idx = None
        best_diff = float("inf")

        for g_idx, gt in enumerate(gt_punches):
            if g_idx in matched_gt:
                continue
            gt_peak_s = gt.get("peak_time", 0.0)
            gt_arm = gt.get("hand", "").lower()

            diff = abs(pred_impact_s - gt_peak_s)
            if diff <= temporal_tolerance_s:
                # Check arm match if specified
                if gt_arm and pred_arm and gt_arm != pred_arm:
                    continue
                if diff < best_diff:
                    best_diff = diff
                    best_gt_idx = g_idx

        if best_gt_idx is not None:
            matched_gt.add(best_gt_idx)
            matched_pred.add(p_idx)
            matches.append((p_idx, best_gt_idx, best_diff))

    tp = len(matched_pred)
    fp = len(pred_punches) - tp
    fn = len(gt_punches) - len(matched_gt)

    precision = tp / len(pred_punches) if pred_punches else 0.0
    recall = tp / len(gt_punches) if gt_punches else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0

    print("==================================================")
    print("           PUNCH DETECTION EVALUATION             ")
    print("==================================================")
    print(f"Video file:       {meta.get('videoPath')}")
    print(f"Video duration:   {duration_ms / 1000.0:.2f}s ({duration_ms:.0f} ms)")
    print(f"FPS:              {fps}")
    print(f"Frames processed: {total_frames}")
    print(f"Temporal window:  \u00b1{temporal_tolerance_s:.2f}s")
    print("--------------------------------------------------")
    print(f"Ground-truth punches: {len(gt_punches)}")
    print(f"Detected punches:     {len(pred_punches)}")
    print("--------------------------------------------------")
    print(f"True Positives  (TP): {tp}")
    print(f"False Positives (FP): {fp}")
    print(f"False Negatives (FN): {fn}")
    print("--------------------------------------------------")
    print(f"Precision: {precision * 100:.1f}% ({precision:.3f})")
    print(f"Recall:    {recall * 100:.1f}% ({recall:.3f})")
    print(f"F1 Score:  {f1 * 100:.1f}% ({f1:.3f})")
    print("==================================================")
    print("\nDetailed Predictions:")
    for p_idx, pred in enumerate(pred_punches):
        is_tp = p_idx in matched_pred
        tag = "TP" if is_tp else "FP"
        p_t = pred.get("impactTimeMs", 0.0) / 1000.0
        dur = pred.get("endTimeMs", 0.0) - pred.get("startTimeMs", 0.0)
        print(f"  [{tag}] Punch #{p_idx+1:2d}: arm={pred.get('arm'):5s} type={pred.get('punchType'):5s} "
              f"impact={p_t:.2f}s (frames {pred.get('startFrame')}->{pred.get('impactFrame')}->{pred.get('endFrame')}, {dur:.0f}ms)")

    if fn > 0:
        print("\nMissed Ground-Truth Events (FN):")
        for g_idx, gt in enumerate(gt_punches):
            if g_idx not in matched_gt:
                print(f"  [FN] GT #{g_idx+1}: {gt.get('hand')} {gt.get('technique')} at peak={gt.get('peak_time')}s")

    return {
        "tp": tp, "fp": fp, "fn": fn,
        "precision": precision, "recall": recall, "f1": f1,
        "pred_count": len(pred_punches), "gt_count": len(gt_punches),
    }

if __name__ == "__main__":
    pred = sys.argv[1] if len(sys.argv) > 1 else "test_results/test_cross_output.json"
    gt = sys.argv[2] if len(sys.argv) > 2 else "test_results/ground_truth_cross.json"
    evaluate_detections(pred, gt)

