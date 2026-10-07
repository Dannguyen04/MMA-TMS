"""Export timestamped pose runs from worker JSON; does not create action labels."""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np

from pipeline.boxing_research import digest
from pipeline.pose_normalizer import NormalizerConfig, PoseNormalizer


def export_pose(source: Path, output: Path, config: NormalizerConfig):
    document = json.loads(source.read_text(encoding="utf-8"))
    meta = document["meta"]
    sequences, report = PoseNormalizer(config).transform(
        document["frames"], width=meta.get("imgWidth"), height=meta.get("imgHeight"),
        quality=document.get("analysisQuality") or {})
    output.mkdir(parents=True, exist_ok=False)
    artifacts = []
    for index, sequence in enumerate(sequences):
        path = output / f"segment_{index:04d}.npz"
        np.savez_compressed(path, **sequence)
        artifacts.append({"path": path.name, "sha256": digest(path),
                          "startTimeMs": float(sequence["timestamps_ms"][0]),
                          "endTimeMs": float(sequence["timestamps_ms"][-1]),
                          "frames": len(sequence["timestamps_ms"])})
    report.update(sourceSha256=digest(source), sourceModel=meta.get("model"),
                  sourceProcessedAt=meta.get("processedAt"), segmentsManifest=artifacts,
                  sourceCodeHashes={name: digest(Path(__file__).parent / name) for name in
                                    ("prepare_temporal_pose.py", "pipeline/pose_normalizer.py")},
                  limitations=["Source provenance is recorded, not independently verified.",
                               "Continuous pose runs are not action segments or coach labels.",
                               "No anti-alias filtering; sampling rate must be validated for the recording protocol.",
                               "Torso scale uses a complete run median; this is an offline transform."])
    (output / "manifest.json").write_text(json.dumps(report, indent=2, allow_nan=False), encoding="utf-8")
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--inference", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--fps", type=float, default=30)
    args = parser.parse_args()
    result = export_pose(args.inference, args.output, NormalizerConfig(target_fps=args.fps))
    print(json.dumps({k: result[k] for k in ("status", "segments", "outputFrames", "excludedFrames")}))
