"""Diagnostic replay of exported, already smoothed poses (no model inference).

Exports have rounded coordinates; use fresh inference for headline accuracy.
This reuses the production pipeline, including observation/discontinuity gates.
"""
import argparse
import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import process_video as pipeline
import pipeline.action_pipeline as action_pipeline_module
from pose_math import Point


def replay(document, training_mode=None, camera_view=None):
    frames, meta = document["frames"], document["meta"]
    if any(f["frameIdx"] != i for i, f in enumerate(frames)):
        raise ValueError("Replay requires contiguous frame records starting at zero")

    class Capture:
        def isOpened(self):
            return True

        def get(self, prop):
            return {pipeline.cv2.CAP_PROP_FPS: meta["fps"],
                    pipeline.cv2.CAP_PROP_FRAME_COUNT: len(frames),
                    pipeline.cv2.CAP_PROP_FRAME_WIDTH: meta["imgWidth"],
                    pipeline.cv2.CAP_PROP_FRAME_HEIGHT: meta["imgHeight"]}[prop]

        def read(self):
            return True, None

        def release(self):
            pass

    class Tracker:
        target = SimpleNamespace(missing_frames=0)

        def __init__(self, **kwargs):
            pass

        def update(self, results, frame_idx, **kwargs):
            f = frames[frame_idx]
            points = [Point(**p) for p in f["landmarks"]]
            return points or None, f.get("isDiscontinuous", False)

    with patch.object(pipeline, "YOLO", return_value=lambda *a, **k: []), \
         patch.object(pipeline, "PersonTracker", Tracker), \
         patch.object(pipeline.cv2, "VideoCapture", return_value=Capture()), \
         patch.object(action_pipeline_module, "apply_ema", side_effect=lambda point, *_: point):
        # A synthetic local identifier avoids the URL download branch.
        result = pipeline.process_video(
            "pose-replay.mp4",
            verbose=False,
            training_mode=training_mode,
            camera_view=camera_view,
        )
    result["meta"].update(meta)
    result["meta"]["poseReplay"] = {
        "source": meta.get("videoPath"),
        "coordinate_precision": "x/y: 4 decimals; confidence: 3 decimals",
        "warning": "Diagnostic replay, not fresh end-to-end inference. Missing historical discontinuity flags default to false.",
    }
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--training-mode", choices=["HEAVY_BAG", "PAD_WORK", "SHADOW_BOXING", "SPARRING"])
    parser.add_argument("--camera-view", choices=["FRONT", "SIDE", "DIAGONAL"])
    args = parser.parse_args()
    result = replay(
        json.loads(args.input.read_text(encoding="utf-8")),
        training_mode=args.training_mode,
        camera_view=args.camera_view,
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(result["summary"])
