"""Run the repo's evaluate_strike_suite.evaluate_directory from the scratch copy; weights hashed in place."""
import sys, json, os
OUTP0 = os.path.abspath(sys.argv[2])
from pathlib import Path
SRC = Path(os.environ.get("DETECTOR_SRC", Path(__file__).resolve().parent / "src"))
sys.path.insert(0, str(SRC)); os.chdir(SRC)
import evaluate_strike_suite as ess
_orig = ess.digest
ess.digest = lambda p: _orig(Path(os.environ.get("WORKER_DIR", r"D:\test\ai\python-worker")) / "yolov8n-pose.pt" if Path(p).name == "yolov8n-pose.pt" else p)
OUTP = OUTP0
res = ess.evaluate_directory(Path(sys.argv[1]))
Path(OUTP).write_text(json.dumps(res, indent=2, ensure_ascii=False), encoding="utf-8")
print(json.dumps({k: res[k] for k in ["current_legacy_same_six_clips","expanded_by_kind","expanded_overall"]}))
