"""Fresh YOLO inference on the 6 validation clips using the SCRATCH COPY of the worker source.
Same call as run_strike_suite.py: process_video(path, model_name=abs yolov8n-pose.pt, output_path=...)."""
import sys, json, time, hashlib
from pathlib import Path
SRC = Path(os.environ.get("DETECTOR_SRC", Path(__file__).resolve().parent / "src"))
sys.path.insert(0, str(SRC))
import os; os.chdir(SRC)
from process_video import process_video
REPO = Path(os.environ.get("WORKER_DIR", r"D:\test\ai\python-worker"))
OUT = Path(os.environ.get("DETECTOR_OUT", Path(__file__).resolve().parent / "out")) / "fresh"
names = sys.argv[1:] or sorted(p.stem for p in (REPO / "validation_videos").glob("*.mp4"))
for n in names:
    out = OUT / f"{n}.json"
    if out.exists():
        print("skip", n, flush=True); continue
    t = time.time()
    data = process_video(str(REPO / "validation_videos" / f"{n}.mp4"), model_name=str(REPO / "yolov8n-pose.pt"),
                         output_path=str(out), verbose=False)
    print(n, data["meta"]["totalFrames"], len(data["punches"]), len(data["kicks"]), f"{time.time()-t:.0f}s", flush=True)
