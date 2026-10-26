"""vid_04: mean grey level of the tracked torso per frame (dark-torso fighter = target Wilson, pale-torso = opponent Courtoise).
Validated by eye on frames 0/52/58/64 (dark) and 177/284/312/385/413 (pale). Heuristic for this one clip only."""
import os, sys, json
from pathlib import Path
import cv2
HERE = Path(__file__).resolve().parent
OUT = Path(os.environ.get("DETECTOR_OUT", HERE / "out"))
WORKER = Path(os.environ.get("WORKER_DIR", r"D:\test\ai\python-worker"))
doc = json.loads((OUT / "bench" / "vid_04_cage_striking.json").read_text(encoding="utf-8")); fr = doc["frames"]; W, H = doc["meta"]["imgWidth"], doc["meta"]["imgHeight"]
cap = cv2.VideoCapture(str(WORKER / "validation_videos" / "vid_04_cage_striking.mp4"))
lum, cx = [], []
for i in range(len(fr)):
    ok, im = cap.read(); L = fr[i]["landmarks"]
    if not ok or len(L) < 17 or min(L[k]["conf"] for k in (5, 6, 11, 12)) < 0.3:
        lum.append(None); cx.append(None); continue
    xs = [L[k]["x"] * W for k in (5, 6, 11, 12)]; ys = [L[k]["y"] * H for k in (5, 6, 11, 12)]
    x0, x1, y0, y1 = int(min(xs)), int(max(xs)), int(min(ys)), int(max(ys)); mx, my = int((x1 - x0) * .2), int((y1 - y0) * .15)
    roi = im[y0 + my:y1 - my, x0 + mx:x1 - mx]
    lum.append(float(cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY).mean()) if roi.size else None); cx.append(sum(xs) / 4 / W)
(OUT / "vid04_ident.json").write_text(json.dumps({"lum": lum, "cx": cx, "disc": [i for i, f in enumerate(fr) if f.get("isDiscontinuous")]}), encoding="utf-8")
print("wrote", OUT / "vid04_ident.json")
