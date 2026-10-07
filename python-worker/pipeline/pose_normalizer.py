"""Offline, timestamp-preserving COCO-17 features for temporal research.

Image coordinates are converted to pixels before isotropic torso scaling. Outputs
are projected torso units, never centimetres or 3-D biomechanics. No smoothing,
stance inference, quality score, or identity repair is performed here.
"""
from __future__ import annotations

from collections import Counter
from dataclasses import asdict, dataclass
from typing import Any

import numpy as np

VERSION = "coco17_timestamp_torso_v1"
TORSO = [5, 6, 11, 12]


@dataclass(frozen=True)
class NormalizerConfig:
    target_fps: float = 30.0
    min_confidence: float = 0.5
    max_gap_ms: float = 100.0
    min_source_frames: int = 3

    def __post_init__(self):
        if not np.isfinite(self.target_fps) or not 1 <= self.target_fps <= 240:
            raise ValueError("target_fps must be in [1,240]")
        if not np.isfinite(self.min_confidence) or not 0 < self.min_confidence <= 1:
            raise ValueError("min_confidence must be in (0,1]")
        if not np.isfinite(self.max_gap_ms) or not 0 < self.max_gap_ms <= 1000:
            raise ValueError("max_gap_ms must be in (0,1000]")
        if (isinstance(self.min_source_frames, bool) or
                not isinstance(self.min_source_frames, int) or self.min_source_frames < 2):
            raise ValueError("min_source_frames must be an integer >= 2")


def _number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and np.isfinite(value)


class PoseNormalizer:
    def __init__(self, config: NormalizerConfig | None = None):
        self.config = config or NormalizerConfig()

    def transform(self, frames: list[dict], *, width: int, height: int,
                  quality: dict) -> tuple[list[dict[str, np.ndarray]], dict[str, Any]]:
        """Return separate continuous runs; never interpolate across rejected frames.

        Inputs follow worker JSON: x/y in image fractions, timeMs, frameIdx,
        observationKind, isDiscontinuous, diagnosticOnly, and optional trackId.
        Quality must establish single-person tracking. Its metadata is evidence
        from the caller, not a new independent identity verification.
        """
        if any(not _number(v) or v <= 0 for v in (width, height)):
            raise ValueError("Positive image width and height are required")
        metrics = quality.get("metrics") or {}
        report = {"version": VERSION, "config": asdict(self.config),
                  "sourceFrames": len(frames), "outputFrames": 0, "segments": 0,
                  "excludedFrames": {}, "breaks": {}, "status": "unavailable",
                  "coordinateUnit": "projected_torso_length",
                  "velocityUnit": "projected_torso_length_per_second",
                  "mode": "offline_research", "productionEligible": False,
                  "stanceCanonicalized": False}
        persons = metrics.get("maxSimultaneousPersons")
        if (quality.get("status") not in {"pass", "degraded"} or
                metrics.get("trackingEvidenceAvailable") is not True or
                not _number(persons) or persons != 1):
            report["blockedReason"] = "QUALITY_OR_SINGLE_PERSON_TRACKING_UNVERIFIED"
            return [], report
        previous = None
        for frame in frames:
            index, timestamp = frame.get("frameIdx"), frame.get("timeMs")
            if (not _number(index) or index < 0 or int(index) != index or
                    not _number(timestamp) or timestamp < 0 or
                    (previous is not None and (index <= previous[0] or timestamp <= previous[1]))):
                raise ValueError("Frame indices and timestamps must increase strictly; input is not sorted automatically")
            previous = index, timestamp

        excluded, breaks = Counter(), Counter()
        runs, run = [], []
        for frame in frames:
            reason = None
            if frame.get("observationKind") != "fresh_detection":
                reason = "NON_FRESH_POSE"
            elif frame.get("isDiscontinuous") or frame.get("diagnosticOnly"):
                reason = "TRACKING_BREAK"
            points = frame.get("landmarks")
            if reason is None and (not isinstance(points, list) or len(points) != 17):
                reason = "MISSING_POSE"
            xy, confidence = np.zeros((17, 2)), np.zeros(17)
            if reason is None:
                for j, point in enumerate(points):
                    if (isinstance(point, dict) and all(_number(point.get(k)) for k in ("x", "y", "conf"))
                            and 0 <= point["x"] <= 1 and 0 <= point["y"] <= 1
                            and self.config.min_confidence <= point["conf"] <= 1):
                        xy[j] = point["x"] * width, point["y"] * height
                        confidence[j] = point["conf"]
                if not (confidence[TORSO] > 0).all():
                    reason = "MISSING_TORSO"
                elif np.linalg.norm(xy[[5, 6]].mean(0) - xy[[11, 12]].mean(0)) < 1e-3:
                    reason = "DEGENERATE_SCALE"
            if reason:
                excluded[reason] += 1
                if run:
                    runs.append(run)
                    run = []
                continue
            if run:
                last = run[-1][0]
                boundary = None
                if frame.get("trackId") != last.get("trackId"):
                    boundary = "IDENTITY_CHANGE"
                elif frame["frameIdx"] != last["frameIdx"] + 1:
                    boundary = "FRAME_GAP"
                elif frame["timeMs"] - last["timeMs"] > self.config.max_gap_ms:
                    boundary = "TIME_GAP"
                if boundary:
                    breaks[boundary] += 1
                    runs.append(run)
                    run = []
            run.append((frame, xy, confidence))
        if run:
            runs.append(run)
        output = []
        for run in runs:
            if len(run) < self.config.min_source_frames:
                excluded["SHORT_RUN"] += len(run)
                continue
            sequence = self._resample(run)
            if len(sequence["timestamps_ms"]) < 2:
                excluded["SHORT_RUN"] += len(run)
                continue
            output.append(sequence)
        report.update(outputFrames=sum(len(s["timestamps_ms"]) for s in output),
                      segments=len(output), excludedFrames=dict(excluded), breaks=dict(breaks),
                      status="ready_for_research" if output else "unavailable")
        report["jointCoverage"] = (np.concatenate([s["mask"] for s in output]).mean(0).tolist()
                                   if output else [0.0] * 17)
        report["velocityCoverage"] = (np.concatenate([s["velocity_mask"] for s in output]).mean(0).tolist()
                                      if output else [0.0] * 17)
        return output, report

    def _resample(self, run):
        times = np.array([f["timeMs"] for f, _, _ in run], dtype=np.float64)
        indices = np.array([f["frameIdx"] for f, _, _ in run], dtype=np.int64)
        xy = np.stack([p for _, p, _ in run])
        confidence = np.stack([c for _, _, c in run])
        root = xy[:, [11, 12]].mean(1)
        scale = float(np.median(np.linalg.norm(xy[:, [5, 6]].mean(1) - root, axis=1)))
        positions = (xy - root[:, None]) / scale
        root = (root - root[0]) / scale
        count = int(np.floor((times[-1] - times[0]) * self.config.target_fps / 1000 + 1e-8)) + 1
        target = times[0] + np.arange(count) * 1000 / self.config.target_fps
        target = target[target <= times[-1] + 1e-7]
        right = np.searchsorted(times, target).clip(0, len(times) - 1)
        left = np.maximum(right - 1, 0)
        exact = np.isclose(target, times[right], atol=1e-7, rtol=0)
        left[exact] = right[exact]
        alpha = np.divide(target - times[left], times[right] - times[left],
                          out=np.zeros(len(target)), where=right != left)
        mask = (confidence[left] > 0) & (confidence[right] > 0)
        position = positions[left] * (1 - alpha[:, None, None]) + positions[right] * alpha[:, None, None]
        position[~mask] = 0
        conf = np.minimum(confidence[left], confidence[right])
        conf[~mask] = 0
        root_position = root[left] * (1 - alpha[:, None]) + root[right] * alpha[:, None]
        velocity, velocity_mask = np.zeros_like(position), np.zeros_like(mask)
        dt = np.diff(target) / 1000
        # A joint missing between two downsampled outputs still breaks velocity.
        for i in range(1, len(target)):
            uninterrupted = (confidence[left[i - 1]:right[i] + 1] > 0).all(0)
            velocity_mask[i] = mask[i - 1] & mask[i] & uninterrupted
            velocity[i] = (position[i] - position[i - 1]) / dt[i - 1]
        velocity[~velocity_mask] = 0
        root_velocity = np.zeros_like(root_position)
        root_velocity[1:] = np.diff(root_position, axis=0) / dt[:, None]
        return {"positions": position.astype(np.float32), "confidence": conf.astype(np.float32),
                "mask": mask, "velocity": velocity.astype(np.float32), "velocity_mask": velocity_mask,
                "root_positions": root_position.astype(np.float32),
                "root_velocity": root_velocity.astype(np.float32), "timestamps_ms": target,
                "source_frame_pairs": np.stack((indices[left], indices[right]), axis=1),
                "torso_scale_pixels": np.array(scale),
                "features": np.concatenate((position.reshape(-1, 34), velocity.reshape(-1, 34), mask), axis=1).astype(np.float32)}
