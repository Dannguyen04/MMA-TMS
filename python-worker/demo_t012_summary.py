"""Offline event summary; reuses the frozen T-022 readers and matching policy."""
import argparse
import json
import math
from pathlib import Path

from evaluate_punch_recall import (
    PunchPrediction,
    load_csv_truth,
    load_dev2_in_scope_truth,
    match_bipartite_predictions,
)

LIMITATION = "Kết quả chỉ đếm sự kiện đấm, không chấm kỹ thuật hay phân loại đòn"


def format_time(frame: int, fps: float) -> str:
    if not math.isfinite(fps) or fps <= 0:
        raise ValueError("fps must be finite and positive for timestamps")
    if frame < 0:
        raise ValueError("impact frame must be nonnegative")
    tenths = round(frame / fps * 10)
    minutes, remainder = divmod(tenths, 600)
    return f"{minutes:02d}:{remainder / 10:04.1f}"


def validate_contract(result: dict) -> None:
    if result.get("schemaVersion") != "1.0.0":
        raise ValueError("schemaVersion must be 1.0.0")
    meta = result["meta"]
    for key in ("fps", "totalFrames", "durationMs"):
        value = meta[key]
        if type(value) not in (int, float) or not math.isfinite(value) or value < 0:
            raise ValueError(f"meta.{key} must be finite and nonnegative")
    if int(meta["totalFrames"]) != meta["totalFrames"]:
        raise ValueError("meta.totalFrames must be an integer")
    for key in ("frames", "kicks", "punches"):
        if not isinstance(result.get(key), list):
            raise ValueError(f"{key} must be an array")


def load_truth(path: Path):
    if path.suffix.lower() == ".csv":
        return load_csv_truth(path)
    if path.suffix.lower() == ".json":
        return load_dev2_in_scope_truth(path)
    raise ValueError("Labels must be CSV or JSON")


def render_summary(result: dict, truth) -> str:
    validate_contract(result)
    fps = result["meta"]["fps"]
    predictions = [
        PunchPrediction(impact_frame=p["impactFrame"], arm=p["arm"], id=str(i))
        for i, p in enumerate(result["punches"])
    ]
    matched = match_bipartite_predictions(truth, predictions, tolerance_frames=3)
    by_prediction = {m["pred_idx"]: m for m in matched.matches}
    lines = [
        "# T-012 — Tóm tắt sự kiện đấm", "",
        f"Video: {result['meta'].get('videoPath', 'unknown')}",
        f"Detector: {result['meta'].get('detectorVersion', 'unknown')}",
        "Ghép một-một với nhãn, dung sai ±3 khung; tên nhãn là tham chiếu thủ công.", "",
        "| # | Thời điểm | Impact frame | Tay | Nhãn khớp (ID, khoảng khung) |",
        "| --- | --- | --- | --- | --- |",
    ]
    for i, prediction in enumerate(predictions):
        match = by_prediction.get(i)
        label = (f"{match['gt_id']} ({match['gt_start_frame']}–{match['gt_end_frame']})"
                 if match else "Không khớp")
        lines.append(
            f"| {i + 1} | {format_time(prediction.impact_frame, fps)} | "
            f"{prediction.impact_frame} | {prediction.arm} | {label} |"
        )
    outside = sum(not any(g.start_frame - 3 <= p.impact_frame <= g.end_frame + 3
                          for g in truth) for p in predictions)
    lines.extend([
        "", f"Tổng phát hiện: {len(predictions)}.",
        f"Số nhãn bắt được: {matched.tp}/{len(truth)} ({matched.recall:.1%}).",
        f"Không khớp một-một: {len(matched.unmatched_predictions)}; "
        f"nằm ngoài mọi nhãn (±3 khung): {outside}.", "", LIMITATION, "",
    ])
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--result", type=Path, required=True, help="Worker result JSON")
    parser.add_argument("--labels", type=Path, required=True, help="T-022 CSV/DEV-2 JSON labels")
    parser.add_argument("--output", type=Path,
                        default=Path(__file__).parent / "benchmark_results/t012_demo/summary.md")
    args = parser.parse_args()
    result = json.loads(args.result.read_text(encoding="utf-8"))
    summary = render_summary(result, load_truth(args.labels))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(summary, encoding="utf-8")
    print(summary, end="")


if __name__ == "__main__":
    main()
