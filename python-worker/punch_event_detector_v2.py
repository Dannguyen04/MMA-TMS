"""Heavy-bag punch event detector based on independent wrist-extension peaks.

The legacy FSM waits for a complete return-to-guard cycle. That is useful for
clean single strikes but merges fast combinations. This detector deliberately
separates event timing from technique assessment: it finds one impact candidate
per extension peak, then builds conservative PunchResult objects for the existing
rubric pipeline. It is only enabled for explicitly declared heavy-bag footage.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Sequence

from pose_math import KP, Point, calculate_angle
from punch_analyzer import PunchAnalyzer, PunchResult


@dataclass(frozen=True)
class PunchEventDetectorV2Config:
    min_keypoint_confidence: float = 0.40
    min_horizontal_extension: float = 0.15
    min_peak_prominence: float = 0.01
    peak_radius_frames: int = 3
    evidence_radius_frames: int = 6
    same_arm_refractory_frames: int = 4
    cross_arm_duplicate_frames: int = 2


@dataclass(frozen=True)
class PunchEventCandidate:
    arm: str
    start_frame: int
    impact_frame: int
    end_frame: int
    prominence: float
    horizontal_extension: float


def _points(frame: dict) -> list[Point]:
    return [Point(**item) for item in frame.get("landmarks", [])]


def detect_heavy_bag_punch_candidates(
    frames: Sequence[dict],
    config: PunchEventDetectorV2Config | None = None,
) -> list[PunchEventCandidate]:
    cfg = config or PunchEventDetectorV2Config()
    raw: list[PunchEventCandidate] = []

    for arm, shoulder_idx, wrist_idx in (
        ("left", KP.LEFT_SHOULDER, KP.LEFT_WRIST),
        ("right", KP.RIGHT_SHOULDER, KP.RIGHT_WRIST),
    ):
        extension: list[float | None] = []
        confidence: list[float] = []
        for frame in frames:
            pts = _points(frame)
            if len(pts) < 17:
                extension.append(None)
                confidence.append(0.0)
                continue
            shoulder, wrist = pts[shoulder_idx], pts[wrist_idx]
            extension.append(abs(wrist.x - shoulder.x))
            confidence.append(min(shoulder.conf, wrist.conf))

        last_peak = -10_000
        r = cfg.peak_radius_frames
        for idx in range(r, len(extension) - r):
            value = extension[idx]
            if value is None or confidence[idx] < cfg.min_keypoint_confidence:
                continue
            previous = extension[idx - 1]
            following = extension[idx + 1]
            if previous is None or following is None or value < previous or value <= following:
                continue
            left = [v for v in extension[idx - r:idx] if v is not None]
            right = [v for v in extension[idx + 1:idx + r + 1] if v is not None]
            if not left or not right:
                continue
            prominence = value - max(min(left), min(right))
            if value < cfg.min_horizontal_extension or prominence < cfg.min_peak_prominence:
                continue
            if idx - last_peak < cfg.same_arm_refractory_frames:
                if raw and prominence > raw[-1].prominence:
                    raw.pop()
                else:
                    continue
            start = max(0, idx - cfg.evidence_radius_frames)
            end = min(len(frames) - 1, idx + cfg.evidence_radius_frames)
            raw.append(PunchEventCandidate(arm, start, idx, end, prominence, value))
            last_peak = idx

    # Simultaneous left/right peaks normally represent one noisy pose event, not
    # two landed punches. Keep the candidate with stronger measured prominence.
    selected: list[PunchEventCandidate] = []
    for candidate in sorted(raw, key=lambda item: item.impact_frame):
        if selected and candidate.impact_frame - selected[-1].impact_frame <= cfg.cross_arm_duplicate_frames:
            if candidate.prominence > selected[-1].prominence:
                selected[-1] = candidate
            continue
        selected.append(candidate)
    return selected


def build_heavy_bag_punch_results(
    frames: Sequence[dict],
    fps: float,
    config: PunchEventDetectorV2Config | None = None,
) -> list[PunchResult]:
    """Convert v2 event candidates into legacy-compatible scored punch results."""
    candidates = detect_heavy_bag_punch_candidates(frames, config)
    scorer = PunchAnalyzer()
    results: list[PunchResult] = []

    for candidate in candidates:
        shoulder_idx, elbow_idx, wrist_idx = (
            (KP.LEFT_SHOULDER, KP.LEFT_ELBOW, KP.LEFT_WRIST)
            if candidate.arm == "left"
            else (KP.RIGHT_SHOULDER, KP.RIGHT_ELBOW, KP.RIGHT_WRIST)
        )
        opposite_shoulder_idx, opposite_wrist_idx = (
            (KP.RIGHT_SHOULDER, KP.RIGHT_WRIST)
            if candidate.arm == "left"
            else (KP.LEFT_SHOULDER, KP.LEFT_WRIST)
        )
        max_angle = 0.0
        peak_speed = 0.0
        guard_dropped = False
        guard_drop_frame = 0
        previous_wrist: Point | None = None
        previous_time_ms: float | None = None

        for frame_idx in range(candidate.start_frame, candidate.end_frame + 1):
            pts = _points(frames[frame_idx])
            if len(pts) < 17:
                previous_wrist = None
                previous_time_ms = None
                continue
            shoulder, elbow, wrist = pts[shoulder_idx], pts[elbow_idx], pts[wrist_idx]
            angle = calculate_angle(shoulder, elbow, wrist, min_confidence=0.25)
            if angle is not None:
                max_angle = max(max_angle, angle)
            time_ms = frame_idx * 1000.0 / fps
            if previous_wrist is not None and previous_time_ms is not None:
                dt = (time_ms - previous_time_ms) / 1000.0
                if dt > 0:
                    peak_speed = max(peak_speed, math.hypot(wrist.x - previous_wrist.x, wrist.y - previous_wrist.y) / dt)
            previous_wrist, previous_time_ms = wrist, time_ms
            opp_shoulder, opp_wrist = pts[opposite_shoulder_idx], pts[opposite_wrist_idx]
            if min(opp_shoulder.conf, opp_wrist.conf) >= 0.25 and opp_wrist.y - opp_shoulder.y > 0.10:
                if not guard_dropped:
                    guard_drop_frame = frame_idx
                guard_dropped = True

        start_ms = candidate.start_frame * 1000.0 / fps
        impact_ms = candidate.impact_frame * 1000.0 / fps
        end_ms = candidate.end_frame * 1000.0 / fps
        result = scorer._score_punch(
            arm=candidate.arm,
            max_elbow_angle=max_angle,
            peak_speed=peak_speed,
            guard_dropped=guard_dropped,
            start_frame=candidate.start_frame,
            impact_frame=candidate.impact_frame,
            end_frame=candidate.end_frame,
            start_time_ms=start_ms,
            impact_time_ms=impact_ms,
            end_time_ms=end_ms,
            guard_drop_frame=guard_drop_frame,
            guard_drop_time_ms=guard_drop_frame * 1000.0 / fps,
        )
        scorer.results.append(result)
        results.append(result)
    return results
