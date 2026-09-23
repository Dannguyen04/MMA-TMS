"""
pipeline/kinematic_features.py — Action-Window Kinematic Feature Engine (Task 7)

Cung cấp động cơ trích xuất đặc trưng động học 2D độc lập cho đòn đánh (đấm và đá):
- Tuân thủ 100% Canonical Contract Pack (Gate 1 & Gate 2).
- Bảo đảm tính bất biến (invariants), bảo toàn nguồn chứng cứ (provenance).
- Ràng buộc đo lường 2D proxy (tuyệt đối không bịa đặt đơn vị vật lý m/s hay lực Newton khi chưa calibrate).
- Xử lý biên an toàn: thiếu dữ liệu, landmark rác, dt = 0, không tạo ra NaN hay Infinity.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from enum import Enum
from types import MappingProxyType
from typing import Any, Dict, List, Literal, Mapping, Optional, Sequence, Tuple, Union

from pose_math import (
    KP,
    Point,
    PoseValidityConfig,
    calculate_angle,
    is_landmark_valid,
    are_landmarks_valid,
)


# ─────────────────────────────────────────────────────────────────────────────
# Approved Canonical Contract Pack (Gate 1 & Gate 2)
# ─────────────────────────────────────────────────────────────────────────────

from pipeline.contracts import EvidenceLevel

EvidenceQuality = Literal["GOOD", "DEGRADED", "LOW", "INSUFFICIENT"]
VALID_EVIDENCE_QUALITIES: tuple[str, ...] = ("GOOD", "DEGRADED", "LOW", "INSUFFICIENT")


@dataclass(frozen=True)
class KinematicMetricContract:
    """
    Chuẩn hóa định lượng một đặc trưng động học (kinematic metric) theo Contract Gate 1.
    Đảm bảo tính bất biến (invariant), bảo toàn nguồn chứng cứ (provenance) và giới hạn 2D proxy.
    """
    name: str
    value: Optional[float]
    unit: str
    confidence: Optional[float] = None
    evidence_level: EvidenceLevel = EvidenceLevel.UNAVAILABLE
    evidence_quality: EvidenceQuality = "INSUFFICIENT"
    frames_used: Optional[tuple[int, ...]] = None
    time_window_ms: Optional[tuple[float, float]] = None
    method_version: str = "1.0.0"
    limitation: str = "2D monocular image-space proxy; not physical 3D force or SI units"

    def __post_init__(self) -> None:
        if self.evidence_quality not in VALID_EVIDENCE_QUALITIES:
            raise ValueError(f"Invalid evidence_quality '{self.evidence_quality}'")

        if self.value is None:
            if self.confidence is not None:
                raise ValueError("confidence must be None when value is None")
            if self.evidence_level != EvidenceLevel.UNAVAILABLE:
                raise ValueError("evidence_level must be UNAVAILABLE when value is None")
            if self.evidence_quality != "INSUFFICIENT":
                raise ValueError("evidence_quality must be 'INSUFFICIENT' when value is None")
            if self.frames_used is not None:
                raise ValueError("frames_used must be None when value is None")
            if self.time_window_ms is not None:
                raise ValueError("time_window_ms must be None when value is None")
        else:
            if not math.isfinite(self.value):
                raise ValueError(f"Metric {self.name} value must be finite")
            if self.confidence is not None and not (0.0 <= self.confidence <= 1.0):
                raise ValueError("confidence must be in [0.0, 1.0]")
            if self.evidence_level == EvidenceLevel.UNAVAILABLE:
                raise ValueError("Computed metric cannot have evidence_level UNAVAILABLE")
            if self.frames_used is None or len(self.frames_used) == 0:
                raise ValueError("Computed metric requires non-empty frames_used")
            if self.time_window_ms is None:
                raise ValueError("Computed metric requires defined time_window_ms")

    def to_dict(self) -> dict[str, Any]:
        """Serialize contract to JSON-safe dictionary."""
        val = self.value
        if val is not None and math.isfinite(val):
            val = round(val, 4)
        conf = self.confidence
        if conf is not None and math.isfinite(conf):
            conf = round(conf, 4)
        time_win = (
            [round(self.time_window_ms[0], 2), round(self.time_window_ms[1], 2)]
            if self.time_window_ms is not None
            else None
        )
        return {
            "name": self.name,
            "value": val,
            "unit": self.unit,
            "confidence": conf,
            "evidence_level": self.evidence_level.value,
            "evidence_quality": self.evidence_quality,
            "frames_used": list(self.frames_used) if self.frames_used is not None else None,
            "time_window_ms": time_win,
            "method_version": self.method_version,
            "limitation": self.limitation,
        }


@dataclass(frozen=True)
class KinematicFeatureSet:
    """
    Tập hợp bất biến (immutable) các metric động học của một action window.
    """
    action_family: str
    metrics: MappingProxyType[str, KinematicMetricContract]
    feature_version: str = "1.0.0"
    quality_summary: MappingProxyType[str, float] = field(
        default_factory=lambda: MappingProxyType({})
    )
    arm_side: Optional[str] = None

    @property
    def arm(self) -> Optional[str]:
        return self.arm_side

    def __post_init__(self) -> None:
        if not isinstance(self.metrics, MappingProxyType):
            object.__setattr__(self, "metrics", MappingProxyType(dict(self.metrics)))
        if not isinstance(self.quality_summary, MappingProxyType):
            object.__setattr__(
                self, "quality_summary", MappingProxyType(dict(self.quality_summary))
            )

        for k, v in self.metrics.items():
            if not isinstance(v, KinematicMetricContract):
                raise TypeError(
                    f"Metric '{k}' must be an instance of KinematicMetricContract, got {type(v)}"
                )

        for qk, qv in self.quality_summary.items():
            if not isinstance(qv, (int, float)) or not math.isfinite(qv):
                raise ValueError(f"Quality summary '{qk}' must be a finite float, got {qv}")

    def get_metric_value(self, name: str, default: Optional[float] = None) -> Optional[float]:
        """Truy xuất nhanh giá trị metric dạng float hoặc None."""
        m = self.metrics.get(name)
        if m is not None and m.value is not None:
            return m.value
        return default

    def to_dict(self) -> dict[str, Any]:
        """Chuyển đổi toàn bộ FeatureSet sang dictionary an toàn với JSON."""
        return {
            "action_family": self.action_family,
            "feature_version": self.feature_version,
            "metrics": {k: m.to_dict() for k, m in self.metrics.items()},
            "quality_summary": {
                k: round(float(v), 4) for k, v in self.quality_summary.items()
            },
        }


# ─────────────────────────────────────────────────────────────────────────────
# Factory Helpers
# ─────────────────────────────────────────────────────────────────────────────

def make_unavailable_metric(
    name: str,
    unit: str,
    method_version: str = "1.0.0",
    limitation: str = "2D monocular image-space proxy; not physical 3D force or SI units",
) -> KinematicMetricContract:
    """Tạo metric unavailable hợp lệ theo đúng invariant của contract."""
    return KinematicMetricContract(
        name=name,
        value=None,
        unit=unit,
        confidence=None,
        evidence_level=EvidenceLevel.UNAVAILABLE,
        evidence_quality="INSUFFICIENT",
        frames_used=None,
        time_window_ms=None,
        method_version=method_version,
        limitation=limitation,
    )


def make_computed_metric(
    name: str,
    value: float,
    unit: str,
    confidence: Optional[float],
    evidence_level: EvidenceLevel,
    evidence_quality: EvidenceQuality,
    frames_used: Sequence[int],
    time_window_ms: tuple[float, float],
    method_version: str = "1.0.0",
    limitation: str = "2D monocular image-space proxy; not physical 3D force or SI units",
) -> KinematicMetricContract:
    """Tạo metric computed hợp lệ với đầy đủ ràng buộc."""
    return KinematicMetricContract(
        name=name,
        value=float(value),
        unit=unit,
        confidence=confidence,
        evidence_level=evidence_level,
        evidence_quality=evidence_quality,
        frames_used=tuple(frames_used),
        time_window_ms=time_window_ms,
        method_version=method_version,
        limitation=limitation,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Keypoint & Frame Extraction Utilities
# ─────────────────────────────────────────────────────────────────────────────

def _extract_point(frame: Any, kp_idx: int) -> Optional[Point]:
    """Trích xuất Point từ frame bất kỳ (SyntheticPoseFrame, FrameAnalysisResult, dict)."""
    if hasattr(frame, "landmarks"):
        lms = getattr(frame, "landmarks")
        if isinstance(lms, dict):
            return lms.get(kp_idx)
        if isinstance(lms, (list, tuple)) and len(lms) > kp_idx:
            item = lms[kp_idx]
            if isinstance(item, Point):
                return item
            if isinstance(item, dict):
                return Point(
                    x=float(item.get("x", 0.0)),
                    y=float(item.get("y", 0.0)),
                    conf=float(item.get("conf", 1.0)),
                )
    if hasattr(frame, "filtered_keypoints"):
        kps = getattr(frame, "filtered_keypoints")
        if isinstance(kps, (list, tuple)) and len(kps) > kp_idx:
            return kps[kp_idx]
    if hasattr(frame, "keypoints"):
        kps = getattr(frame, "keypoints")
        if isinstance(kps, (list, tuple)) and len(kps) > kp_idx:
            return kps[kp_idx]
    if isinstance(frame, dict):
        if "landmarks" in frame:
            lms = frame["landmarks"]
            if isinstance(lms, dict):
                return lms.get(kp_idx)
            if isinstance(lms, (list, tuple)) and len(lms) > kp_idx:
                item = lms[kp_idx]
                if isinstance(item, Point):
                    return item
                if isinstance(item, dict):
                    return Point(
                        x=float(item.get("x", 0.0)),
                        y=float(item.get("y", 0.0)),
                        conf=float(item.get("conf", 1.0)),
                    )
    return None


def _extract_frame_meta(frame: Any, default_idx: int) -> tuple[int, float]:
    """Trích xuất frame_idx và time_ms từ frame bất kỳ."""
    idx = getattr(frame, "frame_idx", getattr(frame, "frameIdx", None))
    if idx is None and isinstance(frame, dict):
        idx = frame.get("frame_idx", frame.get("frameIdx"))
    if idx is None:
        idx = default_idx

    t = getattr(frame, "time_ms", getattr(frame, "timeMs", None))
    if t is None and isinstance(frame, dict):
        t = frame.get("time_ms", frame.get("timeMs"))
    if t is None:
        t = (idx / 30.0) * 1000.0
    return int(idx), float(t)


def _calculate_menger_curvature(p1: Point, p2: Point, p3: Point) -> float:
    """
    Tính độ cong Menger rời rạc từ 3 điểm liên tiếp:
    kappa = 4 * Area / (d12 * d23 * d13)
    Trả về 0.0 nếu thẳng hàng hoặc trùng điểm.
    """
    d12 = math.hypot(p2.x - p1.x, p2.y - p1.y)
    d23 = math.hypot(p3.x - p2.x, p3.y - p2.y)
    d13 = math.hypot(p3.x - p1.x, p3.y - p1.y)

    denom = d12 * d23 * d13
    if denom < 1e-9:
        return 0.0

    # 2 * Diện tích tam giác
    cross = abs((p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x))
    curvature = (2.0 * cross) / denom
    if not math.isfinite(curvature):
        return 0.0
    return curvature


# ─────────────────────────────────────────────────────────────────────────────
# Primary Feature Extraction Logic
# ─────────────────────────────────────────────────────────────────────────────

def extract_kinematic_features(
    frames: Sequence[Any],
    action_family: str = "punch",
    arm_side: Optional[str] = None,
    active_limb: Optional[str] = None,
    stance: Optional[str] = None,
    temporal_phases: Optional[Any] = None,
    pose_config: Optional[PoseValidityConfig] = None,
    method_version: str = "1.0.0",
) -> KinematicFeatureSet:
    """
    Trích xuất các đặc trưng động học chuẩn hóa từ chuỗi frame quan sát được.

    :param frames: Chuỗi frame (SyntheticPoseFrame, FrameAnalysisResult, hoặc dict).
    :param action_family: "punch" hoặc "kick".
    :param arm_side: "left" hoặc "right" (hoặc truyền qua active_limb).
    :param active_limb: "left" hoặc "right" hoặc "lead"/"rear".
    :param stance: "orthodox", "southpaw", "switch", "unknown".
    :param temporal_phases: Đối tượng TemporalPhaseSequence từ Task 6 (nếu có).
    :param pose_config: Cấu hình ngưỡng kiểm tra landmark.
    :param method_version: Phiên bản thuật toán trích xuất.
    :return: KinematicFeatureSet bất biến.
    """
    if pose_config is None:
        pose_config = PoseValidityConfig()

    side = arm_side or active_limb or "right"
    if side not in ("left", "right"):
        side = "right"

    # Trường hợp danh sách frame rỗng
    if not frames:
        return _build_empty_feature_set(action_family, method_version)

    # Thu thập metadata và keypoints
    frame_metas: list[tuple[int, float]] = [
        _extract_frame_meta(f, idx) for idx, f in enumerate(frames)
    ]
    time_window_ms = (frame_metas[0][1], frame_metas[-1][1])
    duration_s = max(0.0, (time_window_ms[1] - time_window_ms[0]) / 1000.0)

    if action_family == "kick":
        return _extract_kick_kinematics(
            frames, frame_metas, side, time_window_ms, duration_s, pose_config, method_version, temporal_phases
        )
    else:
        return _extract_punch_kinematics(
            frames, frame_metas, side, time_window_ms, duration_s, pose_config, method_version, temporal_phases
        )


def _build_empty_feature_set(action_family: str, method_version: str) -> KinematicFeatureSet:
    """Sinh FeatureSet rỗng khi không có frame đầu vào."""
    metric_names = [
        ("elbow_extension_angle", "degree"),
        ("max_elbow_angle", "degree"),
        ("elbow_angle_range", "degree"),
        ("trajectory_directness", "ratio"),
        ("max_tangential_curvature", "normalized_curvature"),
        ("reach_ratio", "ratio"),
        ("peak_speed_proxy", "normalized_image/s"),
        ("peak_wrist_velocity", "normalized_image/s"),
        ("wrist_displacement", "normalized_image"),
        ("wrist_path_length", "normalized_image"),
        ("vertical_lift", "normalized_image"),
        ("wrist_shoulder_separation_ratio", "ratio"),
        ("ankle_displacement", "normalized_image"),
        ("ankle_path_length", "normalized_image"),
        ("knee_extension_angle", "degree"),
        ("knee_chamber_angle", "degree"),
        ("knee_angle_range", "degree"),
        ("hip_rotation_angle", "degree"),
        ("forward_trajectory_linearity", "ratio"),
        ("arc_curvature", "normalized_curvature"),
        ("lateral_displacement_ratio", "ratio"),
        ("torso_lean_angle", "degree"),
    ]
    metrics = {
        name: make_unavailable_metric(name, unit, method_version)
        for name, unit in metric_names
    }
    return KinematicFeatureSet(
        action_family=action_family,
        metrics=MappingProxyType(metrics),
        feature_version=method_version,
        quality_summary=MappingProxyType({"mean_landmark_confidence": 0.0, "valid_frames_ratio": 0.0}),
    )


def _extract_punch_kinematics(
    frames: Sequence[Any],
    frame_metas: list[tuple[int, float]],
    side: str,
    time_window_ms: tuple[float, float],
    duration_s: float,
    pose_config: PoseValidityConfig,
    method_version: str,
    temporal_phases: Optional[Any] = None,
) -> KinematicFeatureSet:
    """Trích xuất kinematic features cho đòn đấm (Punch)."""
    sh_idx = KP.LEFT_SHOULDER if side == "left" else KP.RIGHT_SHOULDER
    el_idx = KP.LEFT_ELBOW if side == "left" else KP.RIGHT_ELBOW
    wr_idx = KP.LEFT_WRIST if side == "left" else KP.RIGHT_WRIST

    wrist_pts: list[tuple[int, float, Point]] = []
    elbow_angles: list[tuple[int, float]] = []
    reach_ratios: list[tuple[int, float]] = []
    wrist_curvatures: list[float] = []
    confs: list[float] = []

    for idx, f in enumerate(frames):
        f_idx, t_ms = frame_metas[idx]
        sh = _extract_point(f, sh_idx)
        el = _extract_point(f, el_idx)
        wr = _extract_point(f, wr_idx)

        if wr is not None and math.isfinite(wr.x) and math.isfinite(wr.y) and math.isfinite(wr.conf):
            confs.append(wr.conf)
            if wr.conf >= pose_config.min_landmark_confidence:
                wrist_pts.append((f_idx, t_ms, wr))

        if sh is not None and el is not None and wr is not None:
            if (
                sh.conf >= pose_config.min_landmark_confidence
                and el.conf >= pose_config.min_landmark_confidence
                and wr.conf >= pose_config.min_landmark_confidence
            ):
                ang = calculate_angle(sh, el, wr, config=pose_config)
                if ang is not None and math.isfinite(ang):
                    elbow_angles.append((f_idx, ang))

                # Reach ratio: distance(shoulder, wrist) / (length(upper_arm) + length(forearm))
                l_upper = math.hypot(el.x - sh.x, el.y - sh.y)
                l_fore = math.hypot(wr.x - el.x, wr.y - el.y)
                total_arm_len = l_upper + l_fore
                if total_arm_len > 1e-6:
                    actual_reach = math.hypot(wr.x - sh.x, wr.y - sh.y)
                    ratio = min(1.0, max(0.0, actual_reach / total_arm_len))
                    reach_ratios.append((f_idx, ratio))

    mean_conf = sum(confs) / len(confs) if confs else 0.0
    quality_literal: EvidenceQuality = (
        "GOOD" if mean_conf >= 0.75
        else "DEGRADED" if mean_conf >= 0.50
        else "LOW" if mean_conf >= 0.35
        else "INSUFFICIENT"
    )

    metrics_dict: dict[str, KinematicMetricContract] = {}

    # 1. Quỹ đạo cổ tay (Wrist Trajectory: path length, displacement, directness, peak speed)
    if len(wrist_pts) >= 2 and duration_s > 1e-6:
        used_wrist_frames = tuple(pt[0] for pt in wrist_pts)
        dx = wrist_pts[-1][2].x - wrist_pts[0][2].x
        dy = wrist_pts[-1][2].y - wrist_pts[0][2].y
        disp = math.hypot(dx, dy)

        path_len = 0.0
        peak_vel = 0.0
        for i in range(len(wrist_pts) - 1):
            f_curr, t_curr, p_curr = wrist_pts[i]
            f_next, t_next, p_next = wrist_pts[i + 1]
            seg_dist = math.hypot(p_next.x - p_curr.x, p_next.y - p_curr.y)
            path_len += seg_dist
            dt_s = (t_next - t_curr) / 1000.0
            if dt_s > 1e-6:
                vel = seg_dist / dt_s
                if vel > peak_vel:
                    peak_vel = vel

            # Tính độ cong Menger rời rạc từ 3 điểm cổ tay
            if i + 2 < len(wrist_pts):
                p_after = wrist_pts[i + 2][2]
                curv = _calculate_menger_curvature(p_curr, p_next, p_after)
                wrist_curvatures.append(curv)

        directness = disp / path_len if path_len > 1e-6 else 0.0
        directness = min(1.0, max(0.0, directness))

        metrics_dict["wrist_displacement"] = make_computed_metric(
            name="wrist_displacement",
            value=disp,
            unit="normalized_image",
            confidence=round(mean_conf, 3),
            evidence_level=EvidenceLevel.DERIVED_PROXY,
            evidence_quality=quality_literal,
            frames_used=used_wrist_frames,
            time_window_ms=time_window_ms,
            method_version=method_version,
        )
        metrics_dict["wrist_path_length"] = make_computed_metric(
            name="wrist_path_length",
            value=path_len,
            unit="normalized_image",
            confidence=round(mean_conf, 3),
            evidence_level=EvidenceLevel.DERIVED_PROXY,
            evidence_quality=quality_literal,
            frames_used=used_wrist_frames,
            time_window_ms=time_window_ms,
            method_version=method_version,
        )
        metrics_dict["trajectory_directness"] = make_computed_metric(
            name="trajectory_directness",
            value=directness,
            unit="ratio",
            confidence=round(mean_conf, 3),
            evidence_level=EvidenceLevel.DERIVED_PROXY,
            evidence_quality=quality_literal,
            frames_used=used_wrist_frames,
            time_window_ms=time_window_ms,
            method_version=method_version,
        )
        metrics_dict["peak_wrist_velocity"] = make_computed_metric(
            name="peak_wrist_velocity",
            value=peak_vel,
            unit="normalized_image/s",
            confidence=round(mean_conf, 3),
            evidence_level=EvidenceLevel.DERIVED_PROXY,
            evidence_quality=quality_literal,
            frames_used=used_wrist_frames,
            time_window_ms=time_window_ms,
            method_version=method_version,
        )
        metrics_dict["peak_speed_proxy"] = make_computed_metric(
            name="peak_speed_proxy",
            value=peak_vel,
            unit="normalized_image/s",
            confidence=round(mean_conf, 3),
            evidence_level=EvidenceLevel.DERIVED_PROXY,
            evidence_quality=quality_literal,
            frames_used=used_wrist_frames,
            time_window_ms=time_window_ms,
            method_version=method_version,
        )
        start_y = wrist_pts[0][2].y
        min_y = min(pt[2].y for pt in wrist_pts)
        vert_lift = max(0.0, start_y - min_y)
        metrics_dict["vertical_lift"] = make_computed_metric(
            name="vertical_lift",
            value=vert_lift,
            unit="normalized_image",
            confidence=round(mean_conf, 3),
            evidence_level=EvidenceLevel.DERIVED_PROXY,
            evidence_quality=quality_literal,
            frames_used=used_wrist_frames,
            time_window_ms=time_window_ms,
            method_version=method_version,
        )
    else:
        for m_name, m_unit in [
            ("wrist_displacement", "normalized_image"),
            ("wrist_path_length", "normalized_image"),
            ("trajectory_directness", "ratio"),
            ("peak_wrist_velocity", "normalized_image/s"),
            ("peak_speed_proxy", "normalized_image/s"),
            ("vertical_lift", "normalized_image"),
        ]:
            metrics_dict[m_name] = make_unavailable_metric(m_name, m_unit, method_version)

    # 2. Độ cong tiếp tuyến cực đại (Max Tangential Curvature)
    if wrist_curvatures:
        max_curv = max(wrist_curvatures)
        metrics_dict["max_tangential_curvature"] = make_computed_metric(
            name="max_tangential_curvature",
            value=max_curv,
            unit="normalized_curvature",
            confidence=round(mean_conf, 3),
            evidence_level=EvidenceLevel.DERIVED_PROXY,
            evidence_quality=quality_literal,
            frames_used=tuple(pt[0] for pt in wrist_pts),
            time_window_ms=time_window_ms,
            method_version=method_version,
        )
    else:
        metrics_dict["max_tangential_curvature"] = make_unavailable_metric(
            "max_tangential_curvature", "normalized_curvature", method_version
        )

    # 3. Góc duỗi khuỷu tay (Elbow Extension Angle)
    if elbow_angles:
        used_elbow_frames = tuple(ea[0] for ea in elbow_angles)
        max_ang = max(ea[1] for ea in elbow_angles)
        min_ang = min(ea[1] for ea in elbow_angles)
        ang_range = max_ang - min_ang

        metrics_dict["elbow_extension_angle"] = make_computed_metric(
            name="elbow_extension_angle",
            value=max_ang,
            unit="degree",
            confidence=round(mean_conf, 3),
            evidence_level=EvidenceLevel.OBSERVED,
            evidence_quality=quality_literal,
            frames_used=used_elbow_frames,
            time_window_ms=time_window_ms,
            method_version=method_version,
        )
        metrics_dict["max_elbow_angle"] = make_computed_metric(
            name="max_elbow_angle",
            value=max_ang,
            unit="degree",
            confidence=round(mean_conf, 3),
            evidence_level=EvidenceLevel.OBSERVED,
            evidence_quality=quality_literal,
            frames_used=used_elbow_frames,
            time_window_ms=time_window_ms,
            method_version=method_version,
        )
        metrics_dict["elbow_angle_range"] = make_computed_metric(
            name="elbow_angle_range",
            value=ang_range,
            unit="degree",
            confidence=round(mean_conf, 3),
            evidence_level=EvidenceLevel.DERIVED_PROXY,
            evidence_quality=quality_literal,
            frames_used=used_elbow_frames,
            time_window_ms=time_window_ms,
            method_version=method_version,
        )
    else:
        metrics_dict["elbow_extension_angle"] = make_unavailable_metric("elbow_extension_angle", "degree", method_version)
        metrics_dict["max_elbow_angle"] = make_unavailable_metric("max_elbow_angle", "degree", method_version)
        metrics_dict["elbow_angle_range"] = make_unavailable_metric("elbow_angle_range", "degree", method_version)

    # 4. Tỷ lệ tầm với (Reach Ratio) & Phân tách cổ tay - vai
    if reach_ratios:
        used_reach_frames = tuple(rr[0] for rr in reach_ratios)
        max_reach = max(rr[1] for rr in reach_ratios)
        metrics_dict["reach_ratio"] = make_computed_metric(
            name="reach_ratio",
            value=max_reach,
            unit="ratio",
            confidence=round(mean_conf, 3),
            evidence_level=EvidenceLevel.DERIVED_PROXY,
            evidence_quality=quality_literal,
            frames_used=used_reach_frames,
            time_window_ms=time_window_ms,
            method_version=method_version,
        )
        metrics_dict["wrist_shoulder_separation_ratio"] = make_computed_metric(
            name="wrist_shoulder_separation_ratio",
            value=max_reach,
            unit="ratio",
            confidence=round(mean_conf, 3),
            evidence_level=EvidenceLevel.DERIVED_PROXY,
            evidence_quality=quality_literal,
            frames_used=used_reach_frames,
            time_window_ms=time_window_ms,
            method_version=method_version,
        )
    else:
        metrics_dict["reach_ratio"] = make_unavailable_metric("reach_ratio", "ratio", method_version)
        metrics_dict["wrist_shoulder_separation_ratio"] = make_unavailable_metric(
            "wrist_shoulder_separation_ratio", "ratio", method_version
        )

    # 5. Phân tích pha thời gian từ Task 6 (nếu có temporal_phases)
    if temporal_phases is not None and hasattr(temporal_phases, "boundaries"):
        b_prep = temporal_phases.boundaries.get("preparation")
        b_launch = temporal_phases.boundaries.get("launch")
        b_peak = temporal_phases.boundaries.get("peak")
        b_ret = temporal_phases.boundaries.get("retraction")
        b_rec = temporal_phases.boundaries.get("recovery")

        # Extension duration (launch/preparation -> peak)
        start_ms = None
        start_frame = None
        if b_launch and b_launch.time_ms is not None:
            start_ms = b_launch.time_ms
            start_frame = b_launch.frame_idx
        elif b_prep and b_prep.time_ms is not None:
            start_ms = b_prep.time_ms
            start_frame = b_prep.frame_idx

        peak_ms = b_peak.time_ms if b_peak else None
        peak_frame = b_peak.frame_idx if b_peak else None
        if start_ms is not None and peak_ms is not None and peak_ms >= start_ms and start_frame is not None and peak_frame is not None:
            ext_dur = peak_ms - start_ms
            metrics_dict["extension_duration_ms"] = make_computed_metric(
                name="extension_duration_ms",
                value=ext_dur,
                unit="ms",
                confidence=round(mean_conf, 3),
                evidence_level=EvidenceLevel.DERIVED_PROXY,
                evidence_quality=quality_literal,
                frames_used=(start_frame, peak_frame),
                time_window_ms=(start_ms, peak_ms),
                method_version=method_version,
            )
        else:
            metrics_dict["extension_duration_ms"] = make_unavailable_metric("extension_duration_ms", "ms", method_version)

        # Retraction duration (peak -> retraction/recovery)
        end_ms = None
        end_frame = None
        if b_ret and b_ret.time_ms is not None:
            end_ms = b_ret.time_ms
            end_frame = b_ret.frame_idx
        elif b_rec and b_rec.time_ms is not None:
            end_ms = b_rec.time_ms
            end_frame = b_rec.frame_idx

        if peak_ms is not None and end_ms is not None and end_ms >= peak_ms and peak_frame is not None and end_frame is not None:
            ret_dur = end_ms - peak_ms
            metrics_dict["retraction_duration_ms"] = make_computed_metric(
                name="retraction_duration_ms",
                value=ret_dur,
                unit="ms",
                confidence=round(mean_conf, 3),
                evidence_level=EvidenceLevel.DERIVED_PROXY,
                evidence_quality=quality_literal,
                frames_used=(peak_frame, end_frame),
                time_window_ms=(peak_ms, end_ms),
                method_version=method_version,
            )
        else:
            metrics_dict["retraction_duration_ms"] = make_unavailable_metric("retraction_duration_ms", "ms", method_version)

        # Recovery duration (peak -> recovery) — unavailable unless measured recovery window exists
        rec_ev_level = getattr(getattr(b_rec, "evidence", None), "level", None)
        if (
            b_rec is not None
            and b_rec.time_ms is not None
            and b_rec.frame_idx is not None
            and rec_ev_level != EvidenceLevel.UNAVAILABLE
            and peak_ms is not None
            and peak_frame is not None
            and b_rec.time_ms > peak_ms
        ):
            rec_dur = b_rec.time_ms - peak_ms
            metrics_dict["recovery_duration_ms"] = make_computed_metric(
                name="recovery_duration_ms",
                value=rec_dur,
                unit="ms",
                confidence=round(mean_conf, 3),
                evidence_level=EvidenceLevel.DERIVED_PROXY,
                evidence_quality=quality_literal,
                frames_used=(peak_frame, b_rec.frame_idx),
                time_window_ms=(peak_ms, b_rec.time_ms),
                method_version=method_version,
            )
        else:
            metrics_dict["recovery_duration_ms"] = make_unavailable_metric("recovery_duration_ms", "ms", method_version)

    # Phase-aware Guard Evidence (Opposite hand protection during preparation -> peak window)
    opp_sh_idx = KP.RIGHT_SHOULDER if side == "left" else KP.LEFT_SHOULDER
    opp_wr_idx = KP.RIGHT_WRIST if side == "left" else KP.LEFT_WRIST
    guard_drop_diffs: list[float] = []
    guard_used_frames: list[int] = []
    guard_confs: list[float] = []

    g_start_frame = start_frame if "start_frame" in locals() and start_frame is not None else (frame_metas[0][0] if frame_metas else 0)
    g_peak_frame = peak_frame if "peak_frame" in locals() and peak_frame is not None else (frame_metas[-1][0] if frame_metas else 0)

    for idx, f in enumerate(frames):
        f_idx, t_ms = frame_metas[idx]
        if g_start_frame <= f_idx <= g_peak_frame:
            osh = _extract_point(f, opp_sh_idx)
            owr = _extract_point(f, opp_wr_idx)
            if (
                osh is not None and owr is not None
                and math.isfinite(osh.x) and math.isfinite(osh.y)
                and math.isfinite(owr.x) and math.isfinite(owr.y)
                and osh.conf >= pose_config.min_landmark_confidence
                and owr.conf >= pose_config.min_landmark_confidence
            ):
                drop_d = owr.y - osh.y
                guard_drop_diffs.append(drop_d)
                guard_used_frames.append(f_idx)
                guard_confs.append(float(min(osh.conf, owr.conf)))

    if guard_used_frames and len(guard_drop_diffs) > 0:
        max_guard_drop = max(guard_drop_diffs)
        is_guard_ok = 1.0 if max_guard_drop <= 0.10 else 0.0
        mean_g_conf = sum(guard_confs) / len(guard_confs)
        g_quality: EvidenceQuality = (
            "GOOD" if mean_g_conf >= 0.75
            else "DEGRADED" if mean_g_conf >= 0.50
            else "LOW" if mean_g_conf >= 0.35
            else "INSUFFICIENT"
        )
        g_time_start = start_ms if "start_ms" in locals() and start_ms is not None else (frame_metas[0][1] if frame_metas else 0.0)
        g_time_end = peak_ms if "peak_ms" in locals() and peak_ms is not None else (frame_metas[-1][1] if frame_metas else 0.0)
        metrics_dict["guard_preserved"] = make_computed_metric(
            name="guard_preserved",
            value=is_guard_ok,
            unit="flag",
            confidence=round(mean_g_conf, 3),
            evidence_level=EvidenceLevel.OBSERVED,
            evidence_quality=g_quality,
            frames_used=tuple(guard_used_frames),
            time_window_ms=(g_time_start, g_time_end),
            method_version=method_version,
        )
        metrics_dict["guard_drop_distance"] = make_computed_metric(
            name="guard_drop_distance",
            value=max(0.0, max_guard_drop),
            unit="normalized_image",
            confidence=round(mean_g_conf, 3),
            evidence_level=EvidenceLevel.DERIVED_PROXY,
            evidence_quality=g_quality,
            frames_used=tuple(guard_used_frames),
            time_window_ms=(g_time_start, g_time_end),
            method_version=method_version,
        )
    else:
        metrics_dict["guard_preserved"] = make_unavailable_metric("guard_preserved", "flag", method_version)
        metrics_dict["guard_drop_distance"] = make_unavailable_metric("guard_drop_distance", "normalized_image", method_version)

    quality_summary = {
        "mean_landmark_confidence": mean_conf,
        "valid_frames_ratio": len(wrist_pts) / len(frames) if frames else 0.0,
    }

    return KinematicFeatureSet(
        action_family="punch",
        metrics=MappingProxyType(metrics_dict),
        feature_version=method_version,
        quality_summary=MappingProxyType(quality_summary),
        arm_side=side,
    )


def _extract_kick_kinematics(
    frames: Sequence[Any],
    frame_metas: list[tuple[int, float]],
    side: str,
    time_window_ms: tuple[float, float],
    duration_s: float,
    pose_config: PoseValidityConfig,
    method_version: str,
    temporal_phases: Optional[Any] = None,
) -> KinematicFeatureSet:
    """Trích xuất kinematic features cho đòn đá (Kick)."""
    hip_idx = KP.LEFT_HIP if side == "left" else KP.RIGHT_HIP
    knee_idx = KP.LEFT_KNEE if side == "left" else KP.RIGHT_KNEE
    ank_idx = KP.LEFT_ANKLE if side == "left" else KP.RIGHT_ANKLE

    ankle_pts: list[tuple[int, float, Point]] = []
    knee_angles: list[tuple[int, float]] = []
    hip_orientations: list[tuple[int, float]] = []
    torso_lean_angles: list[tuple[int, float]] = []
    ankle_curvatures: list[float] = []
    confs: list[float] = []

    for idx, f in enumerate(frames):
        f_idx, t_ms = frame_metas[idx]
        hip = _extract_point(f, hip_idx)
        knee = _extract_point(f, knee_idx)
        ank = _extract_point(f, ank_idx)
        l_hip = _extract_point(f, KP.LEFT_HIP)
        r_hip = _extract_point(f, KP.RIGHT_HIP)
        l_sh = _extract_point(f, KP.LEFT_SHOULDER)
        r_sh = _extract_point(f, KP.RIGHT_SHOULDER)

        if ank is not None and math.isfinite(ank.x) and math.isfinite(ank.y) and math.isfinite(ank.conf):
            confs.append(ank.conf)
            if ank.conf >= pose_config.min_landmark_confidence:
                ankle_pts.append((f_idx, t_ms, ank))

        if hip is not None and knee is not None and ank is not None:
            if (
                hip.conf >= pose_config.min_landmark_confidence
                and knee.conf >= pose_config.min_landmark_confidence
                and ank.conf >= pose_config.min_landmark_confidence
            ):
                ang = calculate_angle(hip, knee, ank, config=pose_config)
                if ang is not None and math.isfinite(ang):
                    knee_angles.append((f_idx, ang))

        if l_hip is not None and r_hip is not None:
            if l_hip.conf >= pose_config.min_landmark_confidence and r_hip.conf >= pose_config.min_landmark_confidence:
                theta = math.atan2(r_hip.y - l_hip.y, r_hip.x - l_hip.x)
                hip_orientations.append((f_idx, theta))

        if l_sh is not None and r_sh is not None and l_hip is not None and r_hip is not None:
            if (
                l_sh.conf >= pose_config.min_landmark_confidence
                and r_sh.conf >= pose_config.min_landmark_confidence
                and l_hip.conf >= pose_config.min_landmark_confidence
                and r_hip.conf >= pose_config.min_landmark_confidence
            ):
                mid_sh_x = (l_sh.x + r_sh.x) / 2.0
                mid_sh_y = (l_sh.y + r_sh.y) / 2.0
                mid_hip_x = (l_hip.x + r_hip.x) / 2.0
                mid_hip_y = (l_hip.y + r_hip.y) / 2.0
                dx_t = mid_sh_x - mid_hip_x
                dy_t = mid_sh_y - mid_hip_y
                lean_deg = abs(math.atan2(dx_t, -dy_t)) * 180.0 / math.pi
                torso_lean_angles.append((f_idx, lean_deg))

    mean_conf = sum(confs) / len(confs) if confs else 0.0
    quality_literal: EvidenceQuality = (
        "GOOD" if mean_conf >= 0.75
        else "DEGRADED" if mean_conf >= 0.50
        else "LOW" if mean_conf >= 0.35
        else "INSUFFICIENT"
    )

    metrics_dict: dict[str, KinematicMetricContract] = {}

    # Quỹ đạo cổ chân (Ankle Trajectory)
    if len(ankle_pts) >= 2 and duration_s > 1e-6:
        used_ankle_frames = tuple(pt[0] for pt in ankle_pts)
        dx = ankle_pts[-1][2].x - ankle_pts[0][2].x
        dy = ankle_pts[-1][2].y - ankle_pts[0][2].y
        disp = math.hypot(dx, dy)

        path_len = 0.0
        peak_vel = 0.0
        for i in range(len(ankle_pts) - 1):
            f_curr, t_curr, p_curr = ankle_pts[i]
            f_next, t_next, p_next = ankle_pts[i + 1]
            seg_dist = math.hypot(p_next.x - p_curr.x, p_next.y - p_curr.y)
            path_len += seg_dist
            dt_s = (t_next - t_curr) / 1000.0
            if dt_s > 1e-6:
                vel = seg_dist / dt_s
                if vel > peak_vel:
                    peak_vel = vel

            if i + 2 < len(ankle_pts):
                p_after = ankle_pts[i + 2][2]
                curv = _calculate_menger_curvature(p_curr, p_next, p_after)
                ankle_curvatures.append(curv)

        directness = disp / path_len if path_len > 1e-6 else 0.0
        directness = min(1.0, max(0.0, directness))

        metrics_dict["ankle_displacement"] = make_computed_metric(
            name="ankle_displacement",
            value=disp,
            unit="normalized_image",
            confidence=round(mean_conf, 3),
            evidence_level=EvidenceLevel.DERIVED_PROXY,
            evidence_quality=quality_literal,
            frames_used=used_ankle_frames,
            time_window_ms=time_window_ms,
            method_version=method_version,
        )
        metrics_dict["ankle_path_length"] = make_computed_metric(
            name="ankle_path_length",
            value=path_len,
            unit="normalized_image",
            confidence=round(mean_conf, 3),
            evidence_level=EvidenceLevel.DERIVED_PROXY,
            evidence_quality=quality_literal,
            frames_used=used_ankle_frames,
            time_window_ms=time_window_ms,
            method_version=method_version,
        )
        metrics_dict["trajectory_directness"] = make_computed_metric(
            name="trajectory_directness",
            value=directness,
            unit="ratio",
            confidence=round(mean_conf, 3),
            evidence_level=EvidenceLevel.DERIVED_PROXY,
            evidence_quality=quality_literal,
            frames_used=used_ankle_frames,
            time_window_ms=time_window_ms,
            method_version=method_version,
        )
        metrics_dict["forward_trajectory_linearity"] = make_computed_metric(
            name="forward_trajectory_linearity",
            value=directness,
            unit="ratio",
            confidence=round(mean_conf, 3),
            evidence_level=EvidenceLevel.DERIVED_PROXY,
            evidence_quality=quality_literal,
            frames_used=used_ankle_frames,
            time_window_ms=time_window_ms,
            method_version=method_version,
        )
        metrics_dict["peak_speed_proxy"] = make_computed_metric(
            name="peak_speed_proxy",
            value=peak_vel,
            unit="normalized_image/s",
            confidence=round(mean_conf, 3),
            evidence_level=EvidenceLevel.DERIVED_PROXY,
            evidence_quality=quality_literal,
            frames_used=used_ankle_frames,
            time_window_ms=time_window_ms,
            method_version=method_version,
        )
        lat_disp = abs(ankle_pts[-1][2].x - ankle_pts[0][2].x)
        lat_ratio = lat_disp / disp if disp > 1e-6 else 0.0
        lat_ratio = min(1.0, max(0.0, lat_ratio))
        metrics_dict["lateral_displacement_ratio"] = make_computed_metric(
            name="lateral_displacement_ratio",
            value=lat_ratio,
            unit="ratio",
            confidence=round(mean_conf, 3),
            evidence_level=EvidenceLevel.DERIVED_PROXY,
            evidence_quality=quality_literal,
            frames_used=used_ankle_frames,
            time_window_ms=time_window_ms,
            method_version=method_version,
        )
    else:
        for m_name, m_unit in [
            ("ankle_displacement", "normalized_image"),
            ("ankle_path_length", "normalized_image"),
            ("trajectory_directness", "ratio"),
            ("forward_trajectory_linearity", "ratio"),
            ("peak_speed_proxy", "normalized_image/s"),
            ("lateral_displacement_ratio", "ratio"),
        ]:
            metrics_dict[m_name] = make_unavailable_metric(m_name, m_unit, method_version)

    # Arc curvature
    if ankle_curvatures:
        max_curv = max(ankle_curvatures)
        metrics_dict["arc_curvature"] = make_computed_metric(
            name="arc_curvature",
            value=max_curv,
            unit="normalized_curvature",
            confidence=round(mean_conf, 3),
            evidence_level=EvidenceLevel.DERIVED_PROXY,
            evidence_quality=quality_literal,
            frames_used=tuple(pt[0] for pt in ankle_pts),
            time_window_ms=time_window_ms,
            method_version=method_version,
        )
    else:
        metrics_dict["arc_curvature"] = make_unavailable_metric("arc_curvature", "normalized_curvature", method_version)

    # Hip rotation angle
    if len(hip_orientations) >= 2:
        theta_0 = hip_orientations[0][1]
        max_rot = 0.0
        for _, th in hip_orientations:
            diff = (th - theta_0 + math.pi) % (2 * math.pi) - math.pi
            deg = abs(diff) * 180.0 / math.pi
            if deg > max_rot:
                max_rot = deg
        metrics_dict["hip_rotation_angle"] = make_computed_metric(
            name="hip_rotation_angle",
            value=max_rot,
            unit="degree",
            confidence=round(mean_conf, 3),
            evidence_level=EvidenceLevel.DERIVED_PROXY,
            evidence_quality=quality_literal,
            frames_used=tuple(ho[0] for ho in hip_orientations),
            time_window_ms=time_window_ms,
            method_version=method_version,
        )
    else:
        metrics_dict["hip_rotation_angle"] = make_unavailable_metric("hip_rotation_angle", "degree", method_version)

    # Torso lean angle
    if torso_lean_angles:
        max_lean = max(tla[1] for tla in torso_lean_angles)
        metrics_dict["torso_lean_angle"] = make_computed_metric(
            name="torso_lean_angle",
            value=max_lean,
            unit="degree",
            confidence=round(mean_conf, 3),
            evidence_level=EvidenceLevel.DERIVED_PROXY,
            evidence_quality=quality_literal,
            frames_used=tuple(tla[0] for tla in torso_lean_angles),
            time_window_ms=time_window_ms,
            method_version=method_version,
        )
    else:
        metrics_dict["torso_lean_angle"] = make_unavailable_metric("torso_lean_angle", "degree", method_version)

    # Góc gối (Knee Extension & Chamber Angles)
    if knee_angles:
        used_knee_frames = tuple(ka[0] for ka in knee_angles)
        max_ang = max(ka[1] for ka in knee_angles)
        min_ang = min(ka[1] for ka in knee_angles)
        ang_range = max_ang - min_ang

        metrics_dict["knee_extension_angle"] = make_computed_metric(
            name="knee_extension_angle",
            value=max_ang,
            unit="degree",
            confidence=round(mean_conf, 3),
            evidence_level=EvidenceLevel.OBSERVED,
            evidence_quality=quality_literal,
            frames_used=used_knee_frames,
            time_window_ms=time_window_ms,
            method_version=method_version,
        )
        metrics_dict["knee_chamber_angle"] = make_computed_metric(
            name="knee_chamber_angle",
            value=min_ang,
            unit="degree",
            confidence=round(mean_conf, 3),
            evidence_level=EvidenceLevel.OBSERVED,
            evidence_quality=quality_literal,
            frames_used=used_knee_frames,
            time_window_ms=time_window_ms,
            method_version=method_version,
        )
        metrics_dict["knee_angle_range"] = make_computed_metric(
            name="knee_angle_range",
            value=ang_range,
            unit="degree",
            confidence=round(mean_conf, 3),
            evidence_level=EvidenceLevel.DERIVED_PROXY,
            evidence_quality=quality_literal,
            frames_used=used_knee_frames,
            time_window_ms=time_window_ms,
            method_version=method_version,
        )
    else:
        metrics_dict["knee_extension_angle"] = make_unavailable_metric("knee_extension_angle", "degree", method_version)
        metrics_dict["knee_chamber_angle"] = make_unavailable_metric("knee_chamber_angle", "degree", method_version)
        metrics_dict["knee_angle_range"] = make_unavailable_metric("knee_angle_range", "degree", method_version)

    # Phân tích pha thời gian cho kick (recovery duration)
    if temporal_phases is not None and hasattr(temporal_phases, "boundaries"):
        b_peak = temporal_phases.boundaries.get("peak")
        b_rec = temporal_phases.boundaries.get("recovery")
        peak_ms = b_peak.time_ms if b_peak else None
        peak_frame = b_peak.frame_idx if b_peak else None

        rec_ev_level = getattr(getattr(b_rec, "evidence", None), "level", None)
        if (
            b_rec is not None
            and b_rec.time_ms is not None
            and b_rec.frame_idx is not None
            and rec_ev_level != EvidenceLevel.UNAVAILABLE
            and peak_ms is not None
            and peak_frame is not None
            and b_rec.time_ms > peak_ms
        ):
            rec_dur = b_rec.time_ms - peak_ms
            metrics_dict["recovery_duration_ms"] = make_computed_metric(
                name="recovery_duration_ms",
                value=rec_dur,
                unit="ms",
                confidence=round(mean_conf, 3),
                evidence_level=EvidenceLevel.DERIVED_PROXY,
                evidence_quality=quality_literal,
                frames_used=(peak_frame, b_rec.frame_idx),
                time_window_ms=(peak_ms, b_rec.time_ms),
                method_version=method_version,
            )
        else:
            metrics_dict["recovery_duration_ms"] = make_unavailable_metric("recovery_duration_ms", "ms", method_version)

    quality_summary = {
        "mean_landmark_confidence": mean_conf,
        "valid_frames_ratio": len(ankle_pts) / len(frames) if frames else 0.0,
    }

    return KinematicFeatureSet(
        action_family="kick",
        metrics=MappingProxyType(metrics_dict),
        feature_version=method_version,
        quality_summary=MappingProxyType(quality_summary),
        arm_side=side,
    )
