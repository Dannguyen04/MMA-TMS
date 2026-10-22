"""Extract labelled frame sheets for AI triage, without importing source labels."""
import argparse
import hashlib
import json
from pathlib import Path

import cv2
import numpy as np


def prepare(pack, output):
    output.mkdir(parents=True, exist_ok=False)
    index = json.loads((pack / "review_index.json").read_text(encoding="utf-8"))
    evidence = []
    for video in index["videos"]:
        path = pack / video["path"]
        if hashlib.sha256(path.read_bytes()).hexdigest() != video["sha256"]:
            raise ValueError("Video checksum mismatch")
        tasks = [t for t in index["tasks"] if t["videoId"] == video["videoId"]]
        selected = {t["sampleId"]: np.unique(np.linspace(t["startFrame"], t["endFrameExclusive"] - 1, 6).round().astype(int)).tolist() for t in tasks}
        wanted = {n for frames in selected.values() for n in frames}
        capture = cv2.VideoCapture(str(path))
        images, timestamps, n = {}, {}, 0
        while True:
            ok, frame = capture.read()
            if not ok:
                break
            if n in wanted:
                images[n] = frame
                timestamps[n] = capture.get(cv2.CAP_PROP_POS_MSEC)
            n += 1
        capture.release()
        if wanted - images.keys():
            raise ValueError("Evidence frames could not be decoded")
        for page, offset in enumerate(range(0, len(tasks), 4)):
            batch = tasks[offset:offset + 4]
            sheet = np.full((len(batch) * 270, 1200, 3), 248, np.uint8)
            sheet_name = f"{video['videoId']}_{page:02d}.jpg"
            for row, task in enumerate(batch):
                frames = selected[task["sampleId"]]
                cv2.putText(sheet, task["sampleId"], (8, row * 270 + 20), cv2.FONT_HERSHEY_SIMPLEX, .55, (10, 10, 10), 1)
                for col, number in enumerate(frames):
                    frame = images[number]
                    h, w = frame.shape[:2]
                    scale = min(196 / w, 220 / h)
                    thumbnail = cv2.resize(frame, (round(w * scale), round(h * scale)))
                    top, left = row * 270 + 26, col * 200 + (200 - thumbnail.shape[1]) // 2
                    sheet[top:top + thumbnail.shape[0], left:left + thumbnail.shape[1]] = thumbnail
                    cv2.putText(sheet, f"f{number} {timestamps[number]/1000:.3f}s", (col * 200 + 5, row * 270 + 262), cv2.FONT_HERSHEY_SIMPLEX, .4, (10, 10, 10), 1)
                evidence.append({"sampleId": task["sampleId"], "videoSha256": video["sha256"],
                                 "sheet": sheet_name, "frameIndices": frames,
                                 "decoderTimesMs": [timestamps[f] for f in frames]})
            if not cv2.imwrite(str(output / sheet_name), sheet):
                raise ValueError("Failed to save evidence sheet")
    result = {"packId": index["packId"], "method": "six_evenly_spaced_decoded_frames_per_task",
              "continuousPlaybackReviewed": False, "sourceLabelsVisibleOnSheets": False,
              "evidence": evidence, "sheetHashes": {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in output.glob("*.jpg")}}
    (output / "evidence.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps({"tasks": len(evidence), "sheets": len(result["sheetHashes"])}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pack", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    prepare(args.pack, args.output)
