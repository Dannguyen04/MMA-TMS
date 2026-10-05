"""Conservative post-hoc kick event recovery from pose-frame evidence.

The legacy kick FSM requires an ideal chamber -> extension -> recovery sequence.
Real heavy-bag footage often starts tracking after the leg is already extended,
especially when a bag occludes the ankle.  This module recovers the event for
the timeline while deliberately withholding technique scoring and findings.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Sequence

from kick_analyzer import KickResult
from pose_math import KP, Point


@dataclass(frozen=True)
class KickEventDetectorV2Config:
    max_gap_frames: int = 2
    min_active_frames: int = 5
    min_angle_samples: int = 3
    min_angle_span_deg: float = 20.0
    min_extension_angle_deg: float = 90.0
    merge_with_legacy_ms: float = 320.0


def _points(frame: dict) -> list[Point]:
    return [Point(**item) for item in frame.get("landmarks", [])]


def _active_runs(frames: Sequence[dict], max_gap: int) -> list[tuple[str, int, int]]:
    clusters: list[tuple[int, int, list[str]]] = []
    start = end = -1
    legs: list[str] = []
    for idx, frame in enumerate(frames):
        leg = frame.get("activeLeg")
        if leg not in ("left", "right"):
            continue
        if legs and idx - end <= max_gap + 1:
            end = idx
        else:
            if legs:
                clusters.append((start, end, legs))
            start = end = idx
            legs = []
        legs.append(leg)
    if legs:
        clusters.append((start, end, legs))
    # Pose can briefly swap the active leg while both knees overlap in a side
    # view. Treat the continuous motion as one event and use the dominant leg.
    return [
        (max(set(cluster_legs), key=cluster_legs.count), cluster_start, cluster_end)
        for cluster_start, cluster_end, cluster_legs in clusters
    ]


def recover_kick_events(
    frames: Sequence[dict],
    fps: float,
    config: KickEventDetectorV2Config | None = None,
) -> list[KickResult]:
    cfg = config or KickEventDetectorV2Config()
    recovered: list[KickResult] = []
    for leg, start, end in _active_runs(frames, cfg.max_gap_frames):
        active_frames = [idx for idx in range(start, end + 1) if frames[idx].get("activeLeg") in ("left", "right")]
        angles = [(idx, float(frames[idx]["kneeAngle"])) for idx in active_frames if frames[idx].get("kneeAngle") is not None]
        if len(active_frames) < cfg.min_active_frames or len(angles) < cfg.min_angle_samples:
            continue
        min_idx, min_angle = min(angles, key=lambda item: item[1])
        max_idx, max_angle = max(angles, key=lambda item: item[1])
        if max_angle < cfg.min_extension_angle_deg or max_angle - min_angle < cfg.min_angle_span_deg:
            continue

        hip_idx, ankle_idx = (
            (KP.LEFT_HIP, KP.LEFT_ANKLE) if leg == "left" else (KP.RIGHT_HIP, KP.RIGHT_ANKLE)
        )
        impact_idx = max_idx
        peak_speed = 0.0
        previous: tuple[int, Point] | None = None
        for idx in active_frames:
            points = _points(frames[idx])
            if len(points) < 17:
                previous = None
                continue
            hip, ankle = points[hip_idx], points[ankle_idx]
            if min(hip.conf, ankle.conf) < 0.25:
                previous = None
                continue
            if previous is not None:
                previous_idx, previous_ankle = previous
                dt = (idx - previous_idx) / fps
                if dt > 0:
                    peak_speed = max(peak_speed, math.hypot(ankle.x - previous_ankle.x, ankle.y - previous_ankle.y) / dt)
            previous = (idx, ankle)

        recovered.append(
            KickResult(
                score=None,  # Event evidence only; do not fabricate a technique score.
                grade="INSUFFICIENT_EVIDENCE",
                emoji="⚪",
                details=["Kick event recovered from leg activity; phase evidence requires coach review."],
                min_chamber_angle=min_angle,
                max_extension_angle=max_angle,
                peak_speed=peak_speed,
                start_frame=start,
                end_frame=end,
                start_time_ms=start * 1000.0 / fps,
                end_time_ms=end * 1000.0 / fps,
                impact_frame=impact_idx,
                impact_time_ms=impact_idx * 1000.0 / fps,
                chamber_peak_frame=min_idx,
                chamber_peak_time_ms=min_idx * 1000.0 / fps,
                active_leg=leg,
                criterion_results=[],
                findings=[],
            )
        )
    return recovered


def merge_kick_events(legacy: Sequence[KickResult], recovered: Sequence[KickResult], threshold_ms: float = 320.0) -> list[KickResult]:
    merged = list(legacy)
    for candidate in recovered:
        if any(abs(existing.impact_time_ms - candidate.impact_time_ms) <= threshold_ms for existing in merged):
            continue
        merged.append(candidate)
    return sorted(merged, key=lambda item: item.impact_time_ms)


def suppress_punches_during_kicks(punches, kicks: Sequence[KickResult], lead_ms: float = 300.0):
    """Remove leg-motion peaks misread as punches, then collapse same-frame labels."""
    outside_kicks = [
        punch
        for punch in punches
        if not any(kick.start_time_ms - lead_ms <= punch.impact_time_ms <= kick.end_time_ms for kick in kicks)
    ]
    selected = []
    for punch in sorted(outside_kicks, key=lambda item: item.impact_time_ms):
        if selected and punch.impact_time_ms - selected[-1].impact_time_ms <= 80.0:
            if punch.max_elbow_angle > selected[-1].max_elbow_angle:
                selected[-1] = punch
            continue
        selected.append(punch)
    return selected
