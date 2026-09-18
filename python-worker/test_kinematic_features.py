"""
test_kinematic_features.py — Contract Tests for Kinematic Feature Engine (Task 7)

Wave 1 Delivery: Contract Tests Only.
Strict Constraint: pipeline/kinematic_features.py is NOT written during Wave 1.
All tests targeting pipeline.kinematic_features are gated via WAVE2_AVAILABLE
and decorated with @unittest.skipUnless(WAVE2_AVAILABLE, "Wave 2 implementation pending: pipeline.kinematic_features").
Synthetic trajectory generators are retained as test fixtures.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from types import MappingProxyType
from typing import Any, Optional
import unittest

from pose_math import Point, KP


# ─────────────────────────────────────────────────────────────────────────────
# Canonical Module Import Gate (Pending Wave 2 Authorization)
# ─────────────────────────────────────────────────────────────────────────────

try:
    from pipeline.kinematic_features import (
        KinematicMetricContract,
        KinematicFeatureSet,
        extract_kinematic_features,
        EvidenceLevel,
        EvidenceQuality,
    )
    WAVE2_AVAILABLE = True
except ImportError:
    WAVE2_AVAILABLE = False
    KinematicMetricContract = None  # type: ignore
    KinematicFeatureSet = None  # type: ignore
    extract_kinematic_features = None  # type: ignore
    EvidenceLevel = None  # type: ignore
    EvidenceQuality = None  # type: ignore


# ─────────────────────────────────────────────────────────────────────────────
# Synthetic Trajectory Test Fixtures
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class SyntheticPoseFrame:
    """Khung xương pose phục vụ kiểm thử quỹ đạo động học tổng hợp."""
    frame_idx: int
    time_ms: float
    landmarks: dict[int, Optional[Point]]


def generate_linear_straight_punch(
    num_frames: int = 10,
    fps: float = 30.0,
    start_x: float = 0.30,
    end_x: float = 0.60,
    y: float = 0.45,
    arm_side: str = "right",
    conf: float = 0.95,
) -> list[SyntheticPoseFrame]:
    """Tạo quỹ đạo đấm thẳng lý tưởng (straight punch / jab / cross)."""
    frames: list[SyntheticPoseFrame] = []
    shoulder_x, shoulder_y = 0.20, 0.45

    for i in range(num_frames):
        alpha = i / (num_frames - 1) if num_frames > 1 else 0.0
        time_ms = (i / fps) * 1000.0

        wrist_x = start_x + alpha * (end_x - start_x)
        wrist_y = y
        elbow_x = shoulder_x + 0.5 * (wrist_x - shoulder_x)
        elbow_y = y + (1.0 - alpha) * 0.08

        sh_idx = KP.LEFT_SHOULDER if arm_side == "left" else KP.RIGHT_SHOULDER
        el_idx = KP.LEFT_ELBOW if arm_side == "left" else KP.RIGHT_ELBOW
        wr_idx = KP.LEFT_WRIST if arm_side == "left" else KP.RIGHT_WRIST

        landmarks = {
            sh_idx: Point(x=shoulder_x, y=shoulder_y, conf=conf),
            el_idx: Point(x=elbow_x, y=elbow_y, conf=conf),
            wr_idx: Point(x=wrist_x, y=wrist_y, conf=conf),
        }
        frames.append(SyntheticPoseFrame(frame_idx=i, time_ms=time_ms, landmarks=landmarks))

    return frames


def generate_curved_hook_punch(
    num_frames: int = 10,
    fps: float = 30.0,
    radius: float = 0.20,
    center_x: float = 0.35,
    center_y: float = 0.45,
    arm_side: str = "right",
    conf: float = 0.90,
) -> list[SyntheticPoseFrame]:
    """Tạo quỹ đạo đấm vòng cung (hook punch), đường cong rõ rệt."""
    frames: list[SyntheticPoseFrame] = []
    shoulder_x, shoulder_y = 0.20, 0.45

    for i in range(num_frames):
        alpha = i / (num_frames - 1) if num_frames > 1 else 0.0
        time_ms = (i / fps) * 1000.0

        theta = -math.pi / 2 + alpha * (3 * math.pi / 4)
        wrist_x = center_x + radius * math.cos(theta)
        wrist_y = center_y + radius * math.sin(theta)

        elbow_x = shoulder_x + 0.5 * (wrist_x - shoulder_x) - 0.05
        elbow_y = shoulder_y + 0.5 * (wrist_y - shoulder_y) + 0.05

        sh_idx = KP.LEFT_SHOULDER if arm_side == "left" else KP.RIGHT_SHOULDER
        el_idx = KP.LEFT_ELBOW if arm_side == "left" else KP.RIGHT_ELBOW
        wr_idx = KP.LEFT_WRIST if arm_side == "left" else KP.RIGHT_WRIST

        landmarks = {
            sh_idx: Point(x=shoulder_x, y=shoulder_y, conf=conf),
            el_idx: Point(x=elbow_x, y=elbow_y, conf=conf),
            wr_idx: Point(x=wrist_x, y=wrist_y, conf=conf),
        }
        frames.append(SyntheticPoseFrame(frame_idx=i, time_ms=time_ms, landmarks=landmarks))

    return frames


def generate_linear_front_kick(
    num_frames: int = 10,
    fps: float = 30.0,
    leg_side: str = "right",
    conf: float = 0.95,
) -> list[SyntheticPoseFrame]:
    """Tạo quỹ đạo đá trước (front kick) chuẩn hóa: chamber -> extension."""
    frames: list[SyntheticPoseFrame] = []
    hip_x, hip_y = 0.5, 0.6
    hip_idx = KP.LEFT_HIP if leg_side == "left" else KP.RIGHT_HIP
    knee_idx = KP.LEFT_KNEE if leg_side == "left" else KP.RIGHT_KNEE
    ank_idx = KP.LEFT_ANKLE if leg_side == "left" else KP.RIGHT_ANKLE

    for i in range(num_frames):
        alpha = i / (num_frames - 1) if num_frames > 1 else 0.0
        time_ms = (i / fps) * 1000.0

        knee_x = hip_x + 0.15 * alpha
        knee_y = 0.75 - 0.20 * alpha

        ank_x = knee_x + 0.25 * alpha
        ank_y = knee_y + 0.15 * (1.0 - alpha)

        landmarks = {
            hip_idx: Point(x=hip_x, y=hip_y, conf=conf),
            knee_idx: Point(x=knee_x, y=knee_y, conf=conf),
            ank_idx: Point(x=ank_x, y=ank_y, conf=conf),
        }
        frames.append(SyntheticPoseFrame(frame_idx=i, time_ms=time_ms, landmarks=landmarks))

    return frames


# ─────────────────────────────────────────────────────────────────────────────
# Test Suite: Test Fixture Integrity (Runs in Wave 1)
# ─────────────────────────────────────────────────────────────────────────────

class TestSyntheticTrajectoryFixtures(unittest.TestCase):
    """Kiểm tra tính toàn vẹn của synthetic trajectory fixtures."""

    def test_linear_straight_punch_fixture(self):
        """Fixture đấm thẳng sinh chuỗi frame với thời gian đơn điệu và tọa độ hợp lệ."""
        frames = generate_linear_straight_punch(num_frames=10, fps=30.0)
        self.assertEqual(len(frames), 10)
        for idx, f in enumerate(frames):
            self.assertEqual(f.frame_idx, idx)
            self.assertAlmostEqual(f.time_ms, (idx / 30.0) * 1000.0, places=2)
            self.assertIn(KP.RIGHT_WRIST, f.landmarks)
            wr = f.landmarks[KP.RIGHT_WRIST]
            self.assertIsNotNone(wr)
            self.assertTrue(0.0 <= wr.x <= 1.0)
            self.assertTrue(0.0 <= wr.y <= 1.0)

    def test_curved_hook_punch_fixture(self):
        """Fixture đấm vòng sinh chuỗi frame với quỹ đạo vòng cung rõ rệt."""
        frames = generate_curved_hook_punch(num_frames=8, fps=30.0)
        self.assertEqual(len(frames), 8)
        # Wrist x di chuyển từ center_x + radius*cos(-pi/2) = center_x
        # Wrist y di chuyển từ center_y - radius
        wr_first = frames[0].landmarks[KP.RIGHT_WRIST]
        wr_last = frames[-1].landmarks[KP.RIGHT_WRIST]
        self.assertIsNotNone(wr_first)
        self.assertIsNotNone(wr_last)
        self.assertNotEqual(wr_first.x, wr_last.x)
        self.assertNotEqual(wr_first.y, wr_last.y)

    def test_linear_front_kick_fixture(self):
        """Fixture đá trước sinh chuỗi frame hợp lệ với hông, gối, cổ chân."""
        frames = generate_linear_front_kick(num_frames=8, fps=30.0)
        self.assertEqual(len(frames), 8)
        for f in frames:
            self.assertIn(KP.RIGHT_HIP, f.landmarks)
            self.assertIn(KP.RIGHT_KNEE, f.landmarks)
            self.assertIn(KP.RIGHT_ANKLE, f.landmarks)


# ─────────────────────────────────────────────────────────────────────────────
# Test Suite: Contract Invariants (Gated for Wave 2)
# ─────────────────────────────────────────────────────────────────────────────

@unittest.skipUnless(WAVE2_AVAILABLE, "Wave 2 implementation pending: pipeline.kinematic_features")
class TestKinematicMetricContractInvariants(unittest.TestCase):
    """Kiểm tra 100% các điều kiện bất biến (invariants) của KinematicMetricContract."""

    def test_valid_unavailable_metric(self):
        """Metric rỗng (value=None) hợp lệ khi tuân thủ toàn bộ điều kiện None."""
        m = KinematicMetricContract(
            name="test_unavailable",
            value=None,
            unit="degree",
            confidence=None,
            evidence_level=EvidenceLevel.UNAVAILABLE,
            evidence_quality="INSUFFICIENT",
            frames_used=None,
            time_window_ms=None,
        )
        self.assertIsNone(m.value)
        self.assertIsNone(m.confidence)
        self.assertEqual(m.evidence_level, EvidenceLevel.UNAVAILABLE)
        self.assertEqual(m.evidence_quality, "INSUFFICIENT")
        self.assertIsNone(m.frames_used)
        self.assertIsNone(m.time_window_ms)

    def test_none_value_rejects_non_none_confidence(self):
        """Khi value=None, confidence không được khác None."""
        with self.assertRaises(ValueError):
            KinematicMetricContract(
                name="invalid_conf",
                value=None,
                unit="degree",
                confidence=0.85,
                evidence_level=EvidenceLevel.UNAVAILABLE,
                evidence_quality="INSUFFICIENT",
            )

    def test_none_value_rejects_non_unavailable_evidence_level(self):
        """Khi value=None, evidence_level bắt buộc phải là UNAVAILABLE."""
        with self.assertRaises(ValueError):
            KinematicMetricContract(
                name="invalid_level",
                value=None,
                unit="degree",
                evidence_level=EvidenceLevel.OBSERVED,
                evidence_quality="INSUFFICIENT",
            )

    def test_none_value_rejects_non_insufficient_quality(self):
        """Khi value=None, evidence_quality bắt buộc phải là 'INSUFFICIENT'."""
        with self.assertRaises(ValueError):
            KinematicMetricContract(
                name="invalid_quality",
                value=None,
                unit="degree",
                evidence_quality="GOOD",
            )

    def test_none_value_rejects_frames_used(self):
        """Khi value=None, frames_used không được có dữ liệu."""
        with self.assertRaises(ValueError):
            KinematicMetricContract(
                name="invalid_frames",
                value=None,
                unit="degree",
                frames_used=(10, 11),
            )

    def test_none_value_rejects_time_window(self):
        """Khi value=None, time_window_ms không được có dữ liệu."""
        with self.assertRaises(ValueError):
            KinematicMetricContract(
                name="invalid_time",
                value=None,
                unit="degree",
                time_window_ms=(100.0, 200.0),
            )

    def test_valid_computed_metric(self):
        """Metric tính toán (value not None) hợp lệ."""
        m = KinematicMetricContract(
            name="peak_extension",
            value=168.5,
            unit="degree",
            confidence=0.92,
            evidence_level=EvidenceLevel.OBSERVED,
            evidence_quality="GOOD",
            frames_used=(12, 13, 14),
            time_window_ms=(400.0, 466.7),
        )
        self.assertEqual(m.value, 168.5)
        self.assertEqual(m.confidence, 0.92)
        self.assertEqual(m.evidence_level, EvidenceLevel.OBSERVED)
        self.assertEqual(m.evidence_quality, "GOOD")
        self.assertEqual(m.frames_used, (12, 13, 14))
        self.assertEqual(m.time_window_ms, (400.0, 466.7))

    def test_computed_rejects_nan_value(self):
        """Giá trị value không được là NaN."""
        with self.assertRaises(ValueError):
            KinematicMetricContract(
                name="nan_metric",
                value=float("nan"),
                unit="degree",
                confidence=0.8,
                evidence_level=EvidenceLevel.OBSERVED,
                evidence_quality="GOOD",
                frames_used=(1,),
                time_window_ms=(0.0, 33.3),
            )

    def test_computed_rejects_inf_values(self):
        """Giá trị value không được là +Infinity hoặc -Infinity."""
        for inf_val in [float("inf"), float("-inf")]:
            with self.subTest(inf_val=inf_val):
                with self.assertRaises(ValueError):
                    KinematicMetricContract(
                        name="inf_metric",
                        value=inf_val,
                        unit="normalized_image/s",
                        confidence=0.8,
                        evidence_level=EvidenceLevel.DERIVED_PROXY,
                        evidence_quality="GOOD",
                        frames_used=(1,),
                        time_window_ms=(0.0, 33.3),
                    )

    def test_computed_rejects_confidence_out_of_bounds(self):
        """Confidence phải nằm trong đoạn [0.0, 1.0]."""
        for bad_conf in [-0.01, 1.01, 2.0, -10.0]:
            with self.subTest(bad_conf=bad_conf):
                with self.assertRaises(ValueError):
                    KinematicMetricContract(
                        name="bad_conf_metric",
                        value=120.0,
                        unit="degree",
                        confidence=bad_conf,
                        evidence_level=EvidenceLevel.OBSERVED,
                        evidence_quality="GOOD",
                        frames_used=(1, 2),
                        time_window_ms=(0.0, 66.6),
                    )

    def test_computed_allows_none_confidence(self):
        """Khi value hợp lệ, confidence được phép là None (heuristic chưa calibrate)."""
        m = KinematicMetricContract(
            name="uncalibrated_metric",
            value=45.0,
            unit="degree",
            confidence=None,
            evidence_level=EvidenceLevel.DERIVED_PROXY,
            evidence_quality="DEGRADED",
            frames_used=(1, 2),
            time_window_ms=(0.0, 66.6),
        )
        self.assertEqual(m.value, 45.0)
        self.assertIsNone(m.confidence)

    def test_computed_rejects_unavailable_evidence_level(self):
        """Metric có value không được mang evidence_level UNAVAILABLE."""
        with self.assertRaises(ValueError):
            KinematicMetricContract(
                name="bad_level",
                value=120.0,
                unit="degree",
                confidence=0.8,
                evidence_level=EvidenceLevel.UNAVAILABLE,
                evidence_quality="GOOD",
                frames_used=(1,),
                time_window_ms=(0.0, 33.3),
            )

    def test_computed_rejects_empty_or_none_frames_used(self):
        """Metric có value yêu cầu frames_used là tuple không rỗng."""
        for bad_frames in [None, ()]:
            with self.subTest(bad_frames=bad_frames):
                with self.assertRaises(ValueError):
                    KinematicMetricContract(
                        name="bad_frames",
                        value=10.0,
                        unit="normalized_image",
                        evidence_level=EvidenceLevel.DERIVED_PROXY,
                        evidence_quality="GOOD",
                        frames_used=bad_frames,
                        time_window_ms=(0.0, 33.3),
                    )

    def test_computed_rejects_none_time_window(self):
        """Metric có value yêu cầu time_window_ms xác định."""
        with self.assertRaises(ValueError):
            KinematicMetricContract(
                name="bad_window",
                value=10.0,
                unit="normalized_image",
                evidence_level=EvidenceLevel.DERIVED_PROXY,
                evidence_quality="GOOD",
                frames_used=(1, 2),
                time_window_ms=None,
            )

    def test_invalid_evidence_quality_raises(self):
        """Evidence quality không thuộc enum quy định phải bị từ chối."""
        with self.assertRaises(ValueError):
            KinematicMetricContract(
                name="bad_quality",
                value=None,
                unit="degree",
                evidence_quality="EXCELLENT",  # type: ignore
            )

    def test_contract_immutability(self):
        """Kiểm tra tính bất biến (frozen dataclass)."""
        m = KinematicMetricContract(
            name="frozen_metric",
            value=100.0,
            unit="degree",
            confidence=0.9,
            evidence_level=EvidenceLevel.OBSERVED,
            evidence_quality="GOOD",
            frames_used=(1,),
            time_window_ms=(0.0, 33.3),
        )
        with self.assertRaises(Exception):
            m.value = 110.0  # type: ignore


# ─────────────────────────────────────────────────────────────────────────────
# Test Suite: KinematicFeatureSet Contract (Gated for Wave 2)
# ─────────────────────────────────────────────────────────────────────────────

@unittest.skipUnless(WAVE2_AVAILABLE, "Wave 2 implementation pending: pipeline.kinematic_features")
class TestKinematicFeatureSetContract(unittest.TestCase):
    """Kiểm tra cấu trúc và tính bất biến của KinematicFeatureSet."""

    def test_feature_set_creation_and_mapping_proxy(self):
        """FeatureSet tự động bọc dict thành MappingProxyType để chống mutation."""
        m1 = KinematicMetricContract(
            name="m1",
            value=10.0,
            unit="degree",
            confidence=0.9,
            evidence_level=EvidenceLevel.OBSERVED,
            evidence_quality="GOOD",
            frames_used=(1,),
            time_window_ms=(0.0, 33.3),
        )
        raw_metrics = {"m1": m1}
        raw_quality = {"conf": 0.9}

        fset = KinematicFeatureSet(
            action_family="punch",
            metrics=raw_metrics,  # type: ignore
            feature_version="1.0.0",
            quality_summary=raw_quality,  # type: ignore
        )

        self.assertIsInstance(fset.metrics, MappingProxyType)
        self.assertIsInstance(fset.quality_summary, MappingProxyType)
        self.assertEqual(fset.metrics["m1"].value, 10.0)

        raw_metrics["m2"] = m1
        self.assertNotIn("m2", fset.metrics)

        with self.assertRaises(TypeError):
            fset.metrics["m1"] = None  # type: ignore

    def test_feature_set_rejects_non_metric_values(self):
        """FeatureSet chỉ chấp nhận KinematicMetricContract trong metrics."""
        with self.assertRaises(TypeError):
            KinematicFeatureSet(
                action_family="punch",
                metrics={"m1": "not_a_metric"},  # type: ignore
            )

    def test_feature_set_rejects_non_finite_quality_summary(self):
        """Quality summary phải chứa các float hữu hạn."""
        with self.assertRaises(ValueError):
            KinematicFeatureSet(
                action_family="punch",
                metrics={},  # type: ignore
                quality_summary={"bad_score": float("nan")},  # type: ignore
            )


# ─────────────────────────────────────────────────────────────────────────────
# Test Suite: Synthetic Trajectory Execution (Gated for Wave 2)
# ─────────────────────────────────────────────────────────────────────────────

@unittest.skipUnless(WAVE2_AVAILABLE, "Wave 2 implementation pending: pipeline.kinematic_features")
class TestSyntheticTrajectories(unittest.TestCase):
    """Kiểm tra tính toán động học trên các quỹ đạo chuyển động nhân tạo."""

    def test_straight_punch_trajectory_properties(self):
        """Quỹ đạo đấm thẳng: displacement ~= path_length, directness ~= 1.0."""
        frames = generate_linear_straight_punch(
            num_frames=10, fps=30.0, start_x=0.30, end_x=0.60, y=0.45
        )
        fset = extract_kinematic_features(frames, arm_side="right", action_family="punch")

        disp_m = fset.metrics["wrist_displacement"]
        path_m = fset.metrics["wrist_path_length"]
        direct_m = fset.metrics["trajectory_directness"]

        self.assertIsNotNone(disp_m.value)
        self.assertIsNotNone(path_m.value)
        self.assertAlmostEqual(disp_m.value, 0.30, places=4)
        self.assertAlmostEqual(path_m.value, 0.30, places=4)
        self.assertAlmostEqual(direct_m.value, 1.0, places=4)

    def test_curved_hook_punch_trajectory_properties(self):
        """Quỹ đạo đấm vòng: path_length > displacement, directness < 0.90."""
        frames = generate_curved_hook_punch(
            num_frames=12, fps=30.0, radius=0.20, center_x=0.35, center_y=0.45
        )
        fset = extract_kinematic_features(frames, arm_side="right", action_family="punch")

        disp_m = fset.metrics["wrist_displacement"]
        path_m = fset.metrics["wrist_path_length"]
        direct_m = fset.metrics["trajectory_directness"]

        self.assertIsNotNone(disp_m.value)
        self.assertIsNotNone(path_m.value)
        self.assertGreater(path_m.value, disp_m.value)
        self.assertLess(direct_m.value, 0.90)

    def test_punch_canonical_metrics(self):
        """Kiểm tra đầy đủ 5 metric cốt lõi cho Punch theo yêu cầu của Contract Gate 2."""
        frames = generate_linear_straight_punch(num_frames=10, fps=30.0)
        fset = extract_kinematic_features(frames, arm_side="right", action_family="punch")

        # 1. elbow_extension_angle
        self.assertIn("elbow_extension_angle", fset.metrics)
        self.assertGreaterEqual(fset.metrics["elbow_extension_angle"].value, 140.0)
        self.assertEqual(fset.metrics["elbow_extension_angle"].unit, "degree")

        # 2. trajectory_directness
        self.assertIn("trajectory_directness", fset.metrics)
        self.assertAlmostEqual(fset.metrics["trajectory_directness"].value, 1.0, places=3)
        self.assertEqual(fset.metrics["trajectory_directness"].unit, "ratio")

        # 3. max_tangential_curvature
        self.assertIn("max_tangential_curvature", fset.metrics)
        self.assertLessEqual(fset.metrics["max_tangential_curvature"].value, 0.20)
        self.assertEqual(fset.metrics["max_tangential_curvature"].unit, "normalized_curvature")

        # 4. reach_ratio
        self.assertIn("reach_ratio", fset.metrics)
        self.assertGreaterEqual(fset.metrics["reach_ratio"].value, 0.70)
        self.assertEqual(fset.metrics["reach_ratio"].unit, "ratio")

        # 5. peak_speed_proxy
        self.assertIn("peak_speed_proxy", fset.metrics)
        self.assertGreater(fset.metrics["peak_speed_proxy"].value, 0.0)
        self.assertEqual(fset.metrics["peak_speed_proxy"].unit, "normalized_image/s")

        # Kiểm tra helper method get_metric_value và arm/arm_side properties
        self.assertEqual(fset.arm, "right")
        self.assertEqual(fset.arm_side, "right")
        self.assertAlmostEqual(fset.get_metric_value("trajectory_directness"), 1.0, places=3)

    def test_front_kick_trajectory_properties(self):
        """Kiểm tra các đặc trưng động học của đòn đá (Kick)."""
        frames = generate_linear_front_kick(num_frames=10, fps=30.0)
        fset = extract_kinematic_features(frames, arm_side="right", action_family="kick")

        self.assertEqual(fset.action_family, "kick")
        self.assertIn("knee_extension_angle", fset.metrics)
        self.assertIn("knee_chamber_angle", fset.metrics)
        self.assertIn("ankle_displacement", fset.metrics)
        self.assertIn("ankle_path_length", fset.metrics)
        self.assertIn("peak_speed_proxy", fset.metrics)

        knee_ext = fset.metrics["knee_extension_angle"]
        self.assertIsNotNone(knee_ext.value)
        self.assertGreater(knee_ext.value, 60.0)

    def test_temporal_phase_integration(self):
        """Tích hợp thông tin TemporalPhaseSequence từ Task 6 để đo phase durations."""
        frames = generate_linear_straight_punch(num_frames=10, fps=30.0)

        # Mock TemporalPhaseSequence
        from types import SimpleNamespace
        b_launch = SimpleNamespace(frame_idx=2, time_ms=66.7)
        b_peak = SimpleNamespace(frame_idx=6, time_ms=200.0)
        b_rec = SimpleNamespace(frame_idx=9, time_ms=300.0)
        mock_phases = SimpleNamespace(
            boundaries={
                "launch": b_launch,
                "peak": b_peak,
                "recovery": b_rec,
            }
        )

        fset = extract_kinematic_features(
            frames, arm_side="right", action_family="punch", temporal_phases=mock_phases
        )
        self.assertIn("extension_duration_ms", fset.metrics)
        self.assertIn("retraction_duration_ms", fset.metrics)

        ext_dur = fset.metrics["extension_duration_ms"]
        self.assertIsNotNone(ext_dur.value)
        self.assertAlmostEqual(ext_dur.value, 133.3, delta=1.0)
        self.assertEqual(ext_dur.unit, "ms")

        ret_dur = fset.metrics["retraction_duration_ms"]
        self.assertIsNotNone(ret_dur.value)
        self.assertAlmostEqual(ret_dur.value, 100.0, delta=1.0)
        self.assertEqual(ret_dur.unit, "ms")


# ─────────────────────────────────────────────────────────────────────────────
# Test Suite: Geometric Invariance (Gated for Wave 2)
# ─────────────────────────────────────────────────────────────────────────────

@unittest.skipUnless(WAVE2_AVAILABLE, "Wave 2 implementation pending: pipeline.kinematic_features")
class TestGeometricInvariance(unittest.TestCase):
    """Kiểm tra tính bất biến hình học (Translation & Scaling)."""

    def test_translation_invariance(self):
        """Tịnh tiến không làm thay đổi góc, directness, path length."""
        orig_frames = generate_linear_straight_punch(num_frames=10, fps=30.0)
        shift_x, shift_y = 0.15, -0.20

        shifted_frames: list[SyntheticPoseFrame] = []
        for f in orig_frames:
            new_lms: dict[int, Optional[Point]] = {}
            for k, p in f.landmarks.items():
                if p is not None:
                    new_lms[k] = Point(x=p.x + shift_x, y=p.y + shift_y, conf=p.conf)
            shifted_frames.append(
                SyntheticPoseFrame(frame_idx=f.frame_idx, time_ms=f.time_ms, landmarks=new_lms)
            )

        fset_orig = extract_kinematic_features(orig_frames, arm_side="right", action_family="punch")
        fset_shifted = extract_kinematic_features(shifted_frames, arm_side="right", action_family="punch")

        self.assertAlmostEqual(
            fset_orig.metrics["wrist_path_length"].value,
            fset_shifted.metrics["wrist_path_length"].value,
            places=4,
        )
        self.assertAlmostEqual(
            fset_orig.metrics["trajectory_directness"].value,
            fset_shifted.metrics["trajectory_directness"].value,
            places=4,
        )

    def test_scaling_invariance(self):
        """Scaling bảo toàn tỷ số không thứ nguyên directness ratio."""
        orig_frames = generate_curved_hook_punch(num_frames=10, fps=30.0)
        scale_factor = 1.4
        cx, cy = 0.35, 0.45

        scaled_frames: list[SyntheticPoseFrame] = []
        for f in orig_frames:
            new_lms: dict[int, Optional[Point]] = {}
            for k, p in f.landmarks.items():
                if p is not None:
                    sx = cx + (p.x - cx) * scale_factor
                    sy = cy + (p.y - cy) * scale_factor
                    new_lms[k] = Point(x=sx, y=sy, conf=p.conf)
            scaled_frames.append(
                SyntheticPoseFrame(frame_idx=f.frame_idx, time_ms=f.time_ms, landmarks=new_lms)
            )

        fset_orig = extract_kinematic_features(orig_frames, arm_side="right", action_family="punch")
        fset_scaled = extract_kinematic_features(scaled_frames, arm_side="right", action_family="punch")

        self.assertAlmostEqual(
            fset_orig.metrics["trajectory_directness"].value,
            fset_scaled.metrics["trajectory_directness"].value,
            places=4,
        )


# ─────────────────────────────────────────────────────────────────────────────
# Test Suite: Bilateral Symmetry (Gated for Wave 2)
# ─────────────────────────────────────────────────────────────────────────────

@unittest.skipUnless(WAVE2_AVAILABLE, "Wave 2 implementation pending: pipeline.kinematic_features")
class TestBilateralSymmetry(unittest.TestCase):
    """Kiểm tra tính đối xứng hai bên trái/phải."""

    def test_left_right_mirror_symmetry(self):
        """Lật qua trục x=0.5 có kinematics tương đương giữa hai tay."""
        orig_right = generate_linear_straight_punch(num_frames=8, fps=30.0, arm_side="right")

        mirrored_left: list[SyntheticPoseFrame] = []
        for f in orig_right:
            new_lms: dict[int, Optional[Point]] = {}
            for k, p in f.landmarks.items():
                if p is not None:
                    mx = 1.0 - p.x
                    my = p.y
                    if k == KP.RIGHT_SHOULDER:
                        new_lms[KP.LEFT_SHOULDER] = Point(x=mx, y=my, conf=p.conf)
                    elif k == KP.RIGHT_ELBOW:
                        new_lms[KP.LEFT_ELBOW] = Point(x=mx, y=my, conf=p.conf)
                    elif k == KP.RIGHT_WRIST:
                        new_lms[KP.LEFT_WRIST] = Point(x=mx, y=my, conf=p.conf)
            mirrored_left.append(
                SyntheticPoseFrame(frame_idx=f.frame_idx, time_ms=f.time_ms, landmarks=new_lms)
            )

        fset_r = extract_kinematic_features(orig_right, arm_side="right", action_family="punch")
        fset_l = extract_kinematic_features(mirrored_left, arm_side="left", action_family="punch")

        self.assertAlmostEqual(
            fset_r.metrics["wrist_path_length"].value,
            fset_l.metrics["wrist_path_length"].value,
            places=4,
        )


# ─────────────────────────────────────────────────────────────────────────────
# Test Suite: Failure Modes & Edge Cases (Gated for Wave 2)
# ─────────────────────────────────────────────────────────────────────────────

@unittest.skipUnless(WAVE2_AVAILABLE, "Wave 2 implementation pending: pipeline.kinematic_features")
class TestFailureModesAndEdgeCases(unittest.TestCase):
    """Kiểm tra xử lý biên: thiếu dữ liệu, landmark rác, chia cho 0."""

    def test_missing_keypoints_produces_unavailable_metrics(self):
        """Khi thiếu keypoint, engine trả về unavailable metric."""
        frames = [
            SyntheticPoseFrame(frame_idx=0, time_ms=0.0, landmarks={}),
            SyntheticPoseFrame(frame_idx=1, time_ms=33.3, landmarks={}),
        ]
        fset = extract_kinematic_features(frames, arm_side="right", action_family="punch")
        disp_m = fset.metrics["wrist_displacement"]
        self.assertIsNone(disp_m.value)
        self.assertEqual(disp_m.evidence_level, EvidenceLevel.UNAVAILABLE)
        self.assertEqual(disp_m.evidence_quality, "INSUFFICIENT")

    def test_low_confidence_keypoints_downgrades_quality(self):
        """Keypoint độ tin cậy thấp (< 0.35) bị loại bỏ."""
        frames = generate_linear_straight_punch(num_frames=6, conf=0.20)
        fset = extract_kinematic_features(frames, arm_side="right", action_family="punch")
        disp_m = fset.metrics["wrist_displacement"]
        self.assertIsNone(disp_m.value)
        self.assertEqual(disp_m.evidence_quality, "INSUFFICIENT")

    def test_single_frame_window_fails_gracefully(self):
        """Cửa sổ 1 frame trả về unavailable an toàn."""
        single_frame = generate_linear_straight_punch(num_frames=1)
        fset = extract_kinematic_features(single_frame, arm_side="right", action_family="punch")
        self.assertIsNone(fset.metrics["wrist_displacement"].value)

    def test_zero_duration_duplicate_timestamps(self):
        """dt = 0 không raise ZeroDivisionError."""
        frames = [
            SyntheticPoseFrame(frame_idx=0, time_ms=100.0, landmarks={
                KP.RIGHT_SHOULDER: Point(0.2, 0.4, 0.9),
                KP.RIGHT_ELBOW: Point(0.3, 0.4, 0.9),
                KP.RIGHT_WRIST: Point(0.4, 0.4, 0.9),
            }),
            SyntheticPoseFrame(frame_idx=1, time_ms=100.0, landmarks={
                KP.RIGHT_SHOULDER: Point(0.2, 0.4, 0.9),
                KP.RIGHT_ELBOW: Point(0.35, 0.4, 0.9),
                KP.RIGHT_WRIST: Point(0.5, 0.4, 0.9),
            }),
        ]
        fset = extract_kinematic_features(frames, arm_side="right", action_family="punch")
        self.assertIsNone(fset.metrics["wrist_displacement"].value)


# ─────────────────────────────────────────────────────────────────────────────
# Test Suite: JSON Serialization Compliance (Gated for Wave 2)
# ─────────────────────────────────────────────────────────────────────────────

@unittest.skipUnless(WAVE2_AVAILABLE, "Wave 2 implementation pending: pipeline.kinematic_features")
class TestJsonSerializationCompliance(unittest.TestCase):
    """Kiểm tra serialization ra JSON không có NaN hay Infinity."""

    def test_json_safe_no_nan_or_inf(self):
        """json.dumps thành công và không chứa chuỗi NaN/Infinity."""
        frames = generate_linear_straight_punch(num_frames=10, fps=30.0)
        fset = extract_kinematic_features(frames, arm_side="right", action_family="punch")

        serialized_dict = fset.to_dict()
        json_str = json.dumps(serialized_dict)

        self.assertNotIn("NaN", json_str)
        self.assertNotIn("Infinity", json_str)
        self.assertNotIn("-Infinity", json_str)


if __name__ == "__main__":
    unittest.main()
