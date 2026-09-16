"""Reproducible full-video inference and explicitly scoped benchmark report.

Run from any directory. Unannotated videos have counts, never invented P/R/F1.
"""
import argparse
import hashlib
import json
from pathlib import Path

from process_video import process_video
from evaluate_punch_detector import run_evaluation_suite
from strike_benchmark import evaluate_files

ROOT = Path(__file__).resolve().parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "test_results/strike_suite")
    parser.add_argument("--validation-only", action="store_true")
    parser.add_argument("--annotated-only", action="store_true",
                        help="Run validation clips and the three annotated original videos")
    parser.add_argument("--resume", action="store_true", help="Reuse complete outputs with matching source and detector hashes")
    parser.add_argument("--progress", action="store_true")
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    sources = sorted((ROOT / "validation_videos").glob("*.mp4"))
    if not args.validation_only:
        # Short inputs first, so reports become available while long files run.
        sources += [ROOT.parent / "video-data-test" / f"VIDEO_DATA_{n:03d}.mp4"
                    for n in ((2, 3, 5) if args.annotated_only else (2, 3, 5, 4, 6, 1))]
    code_hashes = {p.name: hashlib.sha256(p.read_bytes()).hexdigest()
                   for p in ROOT.glob("*.py") if not p.name.startswith(("test_", "scratch_"))}
    previous_path = args.output / "report.json"
    previous = json.loads(previous_path.read_text(encoding="utf-8")) if args.resume and previous_path.exists() else {}
    runtime_files = ["process_video.py", "pose_math.py", "person_tracker.py", "posture_gate.py",
                     "kick_analyzer.py", "punch_analyzer.py", "technique_rubric.py"]
    model_hash = hashlib.sha256((ROOT / "yolov8n-pose.pt").read_bytes()).hexdigest()
    same_runtime = (previous.get("model_sha256") == model_hash and
                    all(previous.get("code_sha256", {}).get(name) == code_hashes[name] for name in runtime_files))
    completed = {v["video"]: v for v in previous.get("videos", [])}
    counts = []
    pairs = []
    report = {"code_sha256": code_hashes, "model_sha256": model_hash, "videos": counts,
              "coverage_note": "Original videos do not have exhaustive punch/kick ground truth. Counts are not accuracy metrics."}
    for source in sources:
        output = args.output / (source.stem + ".json")
        print(f"Processing {source.name}", flush=True)
        source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
        cached = completed.get(source.name, {})
        data = None
        if same_runtime and cached.get("source_sha256") == source_hash and output.exists():
            candidate = json.loads(output.read_text(encoding="utf-8"))
            if len(candidate["frames"]) == cached["frames"] == candidate["meta"]["totalFrames"]:
                data = candidate
                print("Reusing completed inference (source and detector hashes match)", flush=True)
        if data is None:
            data = process_video(str(source), model_name=str(ROOT / "yolov8n-pose.pt"),
                                 output_path=str(output), verbose=args.progress)
        counts.append({"video": source.name, "frames": data["meta"]["totalFrames"],
                       "punches": len(data["punches"]), "kicks": len(data["kicks"]),
                       "source_sha256": source_hash})
        if source.stem.startswith("vid_"):
            pairs.append((str(output), str(ROOT / "ground_truth" / ("gt_" + source.stem[4:] + ".json"))))
            report["punch_validation"] = run_evaluation_suite(pairs)
        if source.stem == "VIDEO_DATA_005":
            report["kick_005"] = evaluate_files(ROOT / "ground_truth/gt_kick_005_mixed_heavybag.json", output)
        if source.stem in ("VIDEO_DATA_002", "VIDEO_DATA_003"):
            report.setdefault("provisional_punch_annotations", []).append(evaluate_files(
                ROOT / "ground_truth" / f"gt_punch_{source.stem[-3:]}_visual.json", output))
        (args.output / "report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
        print(counts[-1], flush=True)


if __name__ == "__main__":
    main()
