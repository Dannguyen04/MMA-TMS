"""Contact sheet: for each (label, frame) a row of 5 frames (-8,-4,0,+4,+8 frames) cropped around the TRACKED person (pose from the benchmark output)."""
import sys, json, cv2, numpy as np
import os
from pathlib import Path
REPO = Path(os.environ.get("WORKER_DIR", r"D:\test\ai\python-worker")); S = Path(__file__).resolve().parent
OUTD = Path(os.environ.get("DETECTOR_OUT", S / "out"))
name = sys.argv[1]; (OUTD / "sheets").mkdir(parents=True, exist_ok=True); out = OUTD / "sheets" / sys.argv[2]
items = [a.split("=") for a in sys.argv[3:]]   # label=frame
doc = json.load(open(OUTD / "bench" / f"{name}.json", encoding="utf-8"))
frames = doc["frames"]; W, H = doc["meta"]["imgWidth"], doc["meta"]["imgHeight"]
cap = cv2.VideoCapture(str(REPO / "validation_videos" / f"{name}.mp4"))
EDGES = [(5,7),(7,9),(6,8),(8,10),(5,6),(5,11),(6,12),(11,12),(11,13),(13,15),(12,14),(14,16)]
def grab(i):
    cap.set(cv2.CAP_PROP_POS_FRAMES, i); ok, im = cap.read(); return im if ok else np.zeros((H, W, 3), np.uint8)
rows = []
for label, fr in items:
    fr = int(fr); tiles = []
    # crop box from tracked pose around the event frame
    pts = [(p["x"] * W, p["y"] * H) for p in frames[min(fr, len(frames)-1)]["landmarks"] if p["conf"] > 0.3]
    if pts:
        xs, ys = zip(*pts); cx, cy = (min(xs)+max(xs))/2, (min(ys)+max(ys))/2; side = max(max(xs)-min(xs), max(ys)-min(ys)) * 1.9 + 80
    else:
        cx, cy, side = W/2, H/2, min(W, H)
    side = max(side, 300)
    x0, y0 = int(max(0, min(W-side, cx-side/2))), int(max(0, min(H-side, cy-side/2))); s = int(min(side, W, H))
    for d in (-8, -4, 0, 4, 8):
        i = max(0, min(len(frames)-1, fr + d)); im = grab(i)
        for a, b in EDGES:
            L = frames[i]["landmarks"]
            if len(L) < 17: continue
            pa, pb = L[a], L[b]
            if pa["conf"] > 0.25 and pb["conf"] > 0.25:
                cv2.line(im, (int(pa["x"]*W), int(pa["y"]*H)), (int(pb["x"]*W), int(pb["y"]*H)), (0, 255, 255) if (a in (5,7,9) or b in (7,9)) else (0, 200, 0) if (a in (6,8,10) or b in (8,10)) else (255, 120, 0), 3)
        crop = cv2.resize(im[y0:y0+s, x0:x0+s], (300, 300))
        cv2.putText(crop, f"f{i} {frames[i]['timeMs']/1000:.2f}s", (6, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
        tiles.append(crop)
    row = np.hstack(tiles); cv2.putText(row, label, (6, 290), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2); rows.append(row)
cv2.imwrite(str(out), np.vstack(rows))
print("wrote", out, np.vstack(rows).shape)
