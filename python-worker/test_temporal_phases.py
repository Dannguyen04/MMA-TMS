"""
test_temporal_phases.py — Unit Tests for Canonical Contract Pack & Temporal Phase Segmentation (Task 6)

Kiểm thử toàn diện:
1. EvidenceLevel enum (observed, derived_proxy, unavailable).
2. PhaseEvidence (validation, immutability, serialization).
3. PhaseBoundary (bi-directional nullability, bounds, serialization).
4. TemporalPhaseSequence (immutability, post-init validations):
   - fps > 0 and finite.
   - frame and time non-negativity and valid ordering.
   - cross-field impact_type (punch -> peak_extension_proxy, kick -> max_extension_proxy).
   - containment in action window.
   - frame/time consistency with tolerance_ms = 0.5 * (1000.0 / fps) + 0.2 ms.
   - monotonic ordering among sequential non-null boundaries (preparation, launch, peak, retraction, recovery).
   - derived property is_complete.
5. Phase Segmentation Logic:
   - segment_punch_phases on synthetic punch trajectory.
   - segment_kick_phases on synthetic kick trajectory.
   - extract_temporal_phases unified dispatcher.
   - segment_from_action_result adapter.
   - edge cases (missing detection, dropped guard anomaly, incomplete cycles).
"""

from dataclasses import FrozenInstanceError
import math
from types import MappingProxyType
import unittest

from pose_math import Point, KP, PoseValidityConfig
from create_golden_baseline import (
    generate_punch_sequence,
    generate_kick_nodetect_sequence,
)
from pipeline.temporal_phases import (
    CANONICAL_PHASES,
    EvidenceLevel,
    PhaseEvidence,
    PhaseBoundary,
    TemporalPhaseSequence,
    PhaseValidityConfig,
    TemporalPhaseConfig,
    calculate_tolerance_ms,
    calculate_arm_reach,
    calculate_arm_elbow_angle,
    calculate_leg_knee_angle,
    segment_punch_phases,
    segment_kick_phases,
    extract_temporal_phases,
    segment_from_action_result,
)


class TestEvidenceLevelAndEvidence(unittest.TestCase):
    """Kiểm tra EvidenceLevel enum và PhaseEvidence dataclass."""

    def test_evidence_level_values(self):
        from pipeline.contracts import EvidenceLevel as CanonicalEvidenceLevel
        self.assertIs(EvidenceLevel, CanonicalEvidenceLevel)
        self.assertEqual(EvidenceLevel.OBSERVED.value, "observed")
        self.assertEqual(EvidenceLevel.DERIVED_PROXY.value, "derived_proxy")
        self.assertEqual(EvidenceLevel.UNAVAILABLE.value, "unavailable")
        self.assertIsInstance(EvidenceLevel.OBSERVED, str)
        self.assertEqual(EvidenceLevel("observed"), EvidenceLevel.OBSERVED)

    def test_phase_evidence_valid(self):
        ev = PhaseEvidence(
            level=EvidenceLevel.OBSERVED,
            confidence=0.95,
            source_signal="wrist_sensor",
        )
        self.assertEqual(ev.level, EvidenceLevel.OBSERVED)
        self.assertEqual(ev.confidence, 0.95)
        self.assertEqual(ev.source_signal, "wrist_sensor")

        # Chuẩn hóa string sang enum
        ev_str = PhaseEvidence(
            level="derived_proxy",
            confidence=0.8,
            source_signal="reach_trajectory",
        )
        self.assertEqual(ev_str.level, EvidenceLevel.DERIVED_PROXY)

        # To dict
        d = ev.to_dict()
        self.assertEqual(d["level"], "observed")
        self.assertEqual(d["confidence"], 0.95)
        self.assertEqual(d["sourceSignal"], "wrist_sensor")

    def test_phase_evidence_invalid(self):
        # Confidence out of bounds
        with self.assertRaises(ValueError):
            PhaseEvidence(level=EvidenceLevel.OBSERVED, confidence=1.5, source_signal="test")
        with self.assertRaises(ValueError):
            PhaseEvidence(level=EvidenceLevel.OBSERVED, confidence=-0.1, source_signal="test")
        with self.assertRaises(ValueError):
            PhaseEvidence(level=EvidenceLevel.OBSERVED, confidence=float("nan"), source_signal="test")

        # Invalid types
        with self.assertRaises(TypeError):
            PhaseEvidence(level=123, confidence=0.5, source_signal="test")
        with self.assertRaises(TypeError):
            PhaseEvidence(level=EvidenceLevel.OBSERVED, confidence=True, source_signal="test")
        with self.assertRaises(TypeError):
            PhaseEvidence(level=EvidenceLevel.OBSERVED, confidence=0.5, source_signal=123)


class TestPhaseBoundary(unittest.TestCase):
    """Kiểm tra PhaseBoundary và quy tắc Bi-directional Nullability."""

    def test_valid_non_null_boundary(self):
        ev = PhaseEvidence(level=EvidenceLevel.DERIVED_PROXY, confidence=0.9, source_signal="reach_peak")
        b = PhaseBoundary(frame_idx=10, time_ms=333.3, evidence=ev)
        self.assertEqual(b.frame_idx, 10)
        self.assertEqual(b.time_ms, 333.3)
        self.assertEqual(b.evidence.level, EvidenceLevel.DERIVED_PROXY)

        d = b.to_dict()
        self.assertEqual(d["frameIdx"], 10)
        self.assertEqual(d["timeMs"], 333.3)
        self.assertEqual(d["evidence"]["level"], "derived_proxy")

    def test_valid_unavailable_boundary(self):
        b = PhaseBoundary.unavailable(source_signal="missing_landmark")
        self.assertIsNone(b.frame_idx)
        self.assertIsNone(b.time_ms)
        self.assertEqual(b.evidence.level, EvidenceLevel.UNAVAILABLE)
        self.assertIsNone(b.evidence.confidence)
        self.assertEqual(b.evidence.source_signal, "missing_landmark")

        d = b.to_dict()
        self.assertIsNone(d["frameIdx"])
        self.assertIsNone(d["timeMs"])
        self.assertEqual(d["evidence"]["level"], "unavailable")

    def test_bidirectional_nullability_frame_and_time(self):
        ev_obs = PhaseEvidence(level=EvidenceLevel.OBSERVED, confidence=0.9, source_signal="sig")
        ev_unav = PhaseEvidence(level=EvidenceLevel.UNAVAILABLE, confidence=None, source_signal="sig")

        # frame_idx is None but time_ms is not None -> ValueError
        with self.assertRaises(ValueError):
            PhaseBoundary(frame_idx=None, time_ms=100.0, evidence=ev_unav)

        # frame_idx is not None but time_ms is None -> ValueError
        with self.assertRaises(ValueError):
            PhaseBoundary(frame_idx=5, time_ms=None, evidence=ev_obs)

    def test_bidirectional_nullability_frame_and_evidence_level(self):
        ev_obs = PhaseEvidence(level=EvidenceLevel.OBSERVED, confidence=0.9, source_signal="sig")
        ev_unav = PhaseEvidence(level=EvidenceLevel.UNAVAILABLE, confidence=None, source_signal="sig")

        # frame_idx is None but evidence.level is OBSERVED -> ValueError
        with self.assertRaises(ValueError):
            PhaseBoundary(frame_idx=None, time_ms=None, evidence=ev_obs)

        # frame_idx is not None but evidence.level is UNAVAILABLE -> ValueError
        with self.assertRaises(ValueError):
            PhaseBoundary(frame_idx=5, time_ms=166.7, evidence=ev_unav)

    def test_boundary_bounds_validation(self):
        ev = PhaseEvidence(level=EvidenceLevel.OBSERVED, confidence=0.9, source_signal="sig")
        # Negative frame index
        with self.assertRaises(ValueError):
            PhaseBoundary(frame_idx=-1, time_ms=100.0, evidence=ev)

        # Negative time_ms
        with self.assertRaises(ValueError):
            PhaseBoundary(frame_idx=1, time_ms=-5.0, evidence=ev)

        # Invalid types
        with self.assertRaises(TypeError):
            PhaseBoundary(frame_idx="1", time_ms=100.0, evidence=ev)
        with self.assertRaises(TypeError):
            PhaseBoundary(frame_idx=True, time_ms=100.0, evidence=ev)
        with self.assertRaises(TypeError):
            PhaseBoundary(frame_idx=1, time_ms="100.0", evidence=ev)


class TestTemporalPhaseSequence(unittest.TestCase):
    """Kiểm tra TemporalPhaseSequence và các post-init invariants."""

    def setUp(self):
        self.fps = 30.0
        self.ev_proxy = PhaseEvidence(level=EvidenceLevel.DERIVED_PROXY, confidence=0.9, source_signal="signal")
        self.boundaries_dict = {
            "preparation": PhaseBoundary(frame_idx=5, time_ms=166.7, evidence=self.ev_proxy),
            "launch": PhaseBoundary(frame_idx=7, time_ms=233.3, evidence=self.ev_proxy),
            "peak": PhaseBoundary(frame_idx=10, time_ms=333.3, evidence=self.ev_proxy),
            "retraction": PhaseBoundary(frame_idx=12, time_ms=400.0, evidence=self.ev_proxy),
            "recovery": PhaseBoundary(frame_idx=15, time_ms=500.0, evidence=self.ev_proxy),
        }

    def test_valid_punch_sequence(self):
        seq = TemporalPhaseSequence(
            action_family="punch",
            impact_type="peak_extension_proxy",
            fps=self.fps,
            window_start_frame=5,
            window_end_frame=15,
            window_start_time_ms=166.7,
            window_end_time_ms=500.0,
            boundaries=self.boundaries_dict,
            anomalies=(),
        )
        self.assertEqual(seq.action_family, "punch")
        self.assertEqual(seq.impact_type, "peak_extension_proxy")
        self.assertEqual(seq.fps, 30.0)
        self.assertIsInstance(seq.boundaries, MappingProxyType)
        self.assertIsInstance(seq.anomalies, tuple)
        self.assertTrue(seq.is_complete)

        # Immutability
        with self.assertRaises(TypeError):
            seq.boundaries["new_key"] = PhaseBoundary.unavailable()
        with self.assertRaises(FrozenInstanceError):
            seq.fps = 60.0

        d = seq.to_dict()
        self.assertEqual(d["actionFamily"], "punch")
        self.assertEqual(d["impactType"], "peak_extension_proxy")
        self.assertTrue(d["isComplete"])
        self.assertIn("peak", d["boundaries"])

    def test_valid_kick_sequence(self):
        seq = TemporalPhaseSequence(
            action_family="kick",
            impact_type="max_extension_proxy",
            fps=self.fps,
            window_start_frame=5,
            window_end_frame=15,
            window_start_time_ms=166.7,
            window_end_time_ms=500.0,
            boundaries=self.boundaries_dict,
            anomalies=(),
        )
        self.assertEqual(seq.action_family, "kick")
        self.assertEqual(seq.impact_type, "max_extension_proxy")
        self.assertTrue(seq.is_complete)

    def test_fps_validation(self):
        # fps <= 0
        with self.assertRaises(ValueError):
            TemporalPhaseSequence(
                action_family="punch", impact_type="peak_extension_proxy",
                fps=0.0, window_start_frame=0, window_end_frame=10,
                window_start_time_ms=0.0, window_end_time_ms=333.3,
            )
        with self.assertRaises(ValueError):
            TemporalPhaseSequence(
                action_family="punch", impact_type="peak_extension_proxy",
                fps=-30.0, window_start_frame=0, window_end_frame=10,
                window_start_time_ms=0.0, window_end_time_ms=333.3,
            )
        # fps non-finite
        with self.assertRaises(ValueError):
            TemporalPhaseSequence(
                action_family="punch", impact_type="peak_extension_proxy",
                fps=float("inf"), window_start_frame=0, window_end_frame=10,
                window_start_time_ms=0.0, window_end_time_ms=333.3,
            )
        # fps boolean
        with self.assertRaises(TypeError):
            TemporalPhaseSequence(
                action_family="punch", impact_type="peak_extension_proxy",
                fps=True, window_start_frame=0, window_end_frame=10,
                window_start_time_ms=0.0, window_end_time_ms=333.3,
            )

    def test_frame_and_time_ordering_and_non_negativity(self):
        # Negative start frame
        with self.assertRaises(ValueError):
            TemporalPhaseSequence(
                action_family="punch", impact_type="peak_extension_proxy",
                fps=30.0, window_start_frame=-1, window_end_frame=10,
                window_start_time_ms=0.0, window_end_time_ms=333.3,
            )
        # start frame > end frame
        with self.assertRaises(ValueError):
            TemporalPhaseSequence(
                action_family="punch", impact_type="peak_extension_proxy",
                fps=30.0, window_start_frame=10, window_end_frame=5,
                window_start_time_ms=0.0, window_end_time_ms=333.3,
            )
        # start time > end time
        with self.assertRaises(ValueError):
            TemporalPhaseSequence(
                action_family="punch", impact_type="peak_extension_proxy",
                fps=30.0, window_start_frame=0, window_end_frame=10,
                window_start_time_ms=500.0, window_end_time_ms=333.3,
            )
        # Negative start time
        with self.assertRaises(ValueError):
            TemporalPhaseSequence(
                action_family="punch", impact_type="peak_extension_proxy",
                fps=30.0, window_start_frame=0, window_end_frame=10,
                window_start_time_ms=-10.0, window_end_time_ms=333.3,
            )

    def test_cross_field_impact_type_validation(self):
        # punch requires peak_extension_proxy
        with self.assertRaises(ValueError) as ctx:
            TemporalPhaseSequence(
                action_family="punch",
                impact_type="max_extension_proxy",
                fps=30.0, window_start_frame=0, window_end_frame=10,
                window_start_time_ms=0.0, window_end_time_ms=333.3,
            )
        self.assertIn("peak_extension_proxy", str(ctx.exception))

        # kick requires max_extension_proxy
        with self.assertRaises(ValueError) as ctx:
            TemporalPhaseSequence(
                action_family="kick",
                impact_type="peak_extension_proxy",
                fps=30.0, window_start_frame=0, window_end_frame=10,
                window_start_time_ms=0.0, window_end_time_ms=333.3,
            )
        self.assertIn("max_extension_proxy", str(ctx.exception))

        # unknown action_family
        with self.assertRaises(ValueError) as ctx:
            TemporalPhaseSequence(
                action_family="elbow",
                impact_type="peak_extension_proxy",
                fps=30.0, window_start_frame=0, window_end_frame=10,
                window_start_time_ms=0.0, window_end_time_ms=333.3,
            )
        self.assertIn("Unsupported action_family", str(ctx.exception))

    def test_containment_in_action_window(self):
        # Boundary frame before window start
        bad_boundaries_1 = {
            "peak": PhaseBoundary(frame_idx=3, time_ms=100.0, evidence=self.ev_proxy),
        }
        with self.assertRaises(ValueError) as ctx:
            TemporalPhaseSequence(
                action_family="punch", impact_type="peak_extension_proxy",
                fps=30.0, window_start_frame=5, window_end_frame=15,
                window_start_time_ms=166.7, window_end_time_ms=500.0,
                boundaries=bad_boundaries_1,
            )
        self.assertIn("outside action window", str(ctx.exception))

        # Boundary frame after window end
        bad_boundaries_2 = {
            "peak": PhaseBoundary(frame_idx=20, time_ms=666.7, evidence=self.ev_proxy),
        }
        with self.assertRaises(ValueError) as ctx:
            TemporalPhaseSequence(
                action_family="punch", impact_type="peak_extension_proxy",
                fps=30.0, window_start_frame=5, window_end_frame=15,
                window_start_time_ms=166.7, window_end_time_ms=500.0,
                boundaries=bad_boundaries_2,
            )
        self.assertIn("outside action window", str(ctx.exception))

    def test_frame_time_consistency_and_tolerance(self):
        fps = 30.0
        frame_dur = 1000.0 / fps  # 33.333 ms
        tol = calculate_tolerance_ms(fps)  # 0.5 * 33.333 + 0.2 = 16.867 ms
        self.assertAlmostEqual(tol, 16.866666, places=4)

        # Boundary with time exactly expected
        # window_start_frame=10, window_start_time_ms=333.3
        # frame=12 -> expected = 333.3 + 2 * 33.3333 = 400.0
        valid_b = {
            "peak": PhaseBoundary(frame_idx=12, time_ms=400.0, evidence=self.ev_proxy)
        }
        seq = TemporalPhaseSequence(
            action_family="punch", impact_type="peak_extension_proxy",
            fps=fps, window_start_frame=10, window_end_frame=20,
            window_start_time_ms=333.3, window_end_time_ms=666.7,
            boundaries=valid_b,
        )
        self.assertIn("peak", seq.boundaries)

        # Boundary with time within tolerance (delta = 10.0 ms < 16.867 ms)
        valid_b_jitter = {
            "peak": PhaseBoundary(frame_idx=12, time_ms=410.0, evidence=self.ev_proxy)
        }
        seq2 = TemporalPhaseSequence(
            action_family="punch", impact_type="peak_extension_proxy",
            fps=fps, window_start_frame=10, window_end_frame=20,
            window_start_time_ms=333.3, window_end_time_ms=666.7,
            boundaries=valid_b_jitter,
        )
        self.assertIn("peak", seq2.boundaries)

        # Boundary with time exceeding tolerance (delta = 25.0 ms > 16.867 ms)
        invalid_b_jitter = {
            "peak": PhaseBoundary(frame_idx=12, time_ms=425.0, evidence=self.ev_proxy)
        }
        with self.assertRaises(ValueError) as ctx:
            TemporalPhaseSequence(
                action_family="punch", impact_type="peak_extension_proxy",
                fps=fps, window_start_frame=10, window_end_frame=20,
                window_start_time_ms=333.3, window_end_time_ms=666.7,
                boundaries=invalid_b_jitter,
            )
        self.assertIn("consistency violated", str(ctx.exception))

    def test_monotonic_ordering_validation(self):
        # Preparation occurs after launch
        bad_order = {
            "preparation": PhaseBoundary(frame_idx=8, time_ms=266.7, evidence=self.ev_proxy),
            "launch": PhaseBoundary(frame_idx=6, time_ms=200.0, evidence=self.ev_proxy),
            "peak": PhaseBoundary(frame_idx=10, time_ms=333.3, evidence=self.ev_proxy),
        }
        with self.assertRaises(ValueError) as ctx:
            TemporalPhaseSequence(
                action_family="punch", impact_type="peak_extension_proxy",
                fps=30.0, window_start_frame=5, window_end_frame=15,
                window_start_time_ms=166.7, window_end_time_ms=500.0,
                boundaries=bad_order,
            )
        self.assertIn("Monotonic frame ordering violated", str(ctx.exception))

        # Peak occurs after retraction
        bad_order_2 = {
            "peak": PhaseBoundary(frame_idx=12, time_ms=400.0, evidence=self.ev_proxy),
            "retraction": PhaseBoundary(frame_idx=11, time_ms=366.7, evidence=self.ev_proxy),
        }
        with self.assertRaises(ValueError) as ctx:
            TemporalPhaseSequence(
                action_family="punch", impact_type="peak_extension_proxy",
                fps=30.0, window_start_frame=5, window_end_frame=15,
                window_start_time_ms=166.7, window_end_time_ms=500.0,
                boundaries=bad_order_2,
            )
        self.assertIn("Monotonic frame ordering violated", str(ctx.exception))

        # Missing intermediate boundary (launch is None/unavailable), but remaining non-null are monotonic
        partial_order = {
            "preparation": PhaseBoundary(frame_idx=5, time_ms=166.7, evidence=self.ev_proxy),
            "launch": PhaseBoundary.unavailable(),
            "peak": PhaseBoundary(frame_idx=10, time_ms=333.3, evidence=self.ev_proxy),
            "recovery": PhaseBoundary(frame_idx=15, time_ms=500.0, evidence=self.ev_proxy),
        }
        seq = TemporalPhaseSequence(
            action_family="punch", impact_type="peak_extension_proxy",
            fps=30.0, window_start_frame=5, window_end_frame=15,
            window_start_time_ms=166.7, window_end_time_ms=500.0,
            boundaries=partial_order,
        )
        self.assertTrue(seq.is_complete)

    def test_is_complete_property(self):
        # 1. Complete: peak present, no anomalies, valid window
        seq_complete = TemporalPhaseSequence(
            action_family="punch", impact_type="peak_extension_proxy",
            fps=30.0, window_start_frame=5, window_end_frame=15,
            window_start_time_ms=166.7, window_end_time_ms=500.0,
            boundaries=self.boundaries_dict,
            anomalies=(),
        )
        self.assertTrue(seq_complete.is_complete)

        # 2. Incomplete due to anomalies
        seq_anomaly = TemporalPhaseSequence(
            action_family="punch", impact_type="peak_extension_proxy",
            fps=30.0, window_start_frame=5, window_end_frame=15,
            window_start_time_ms=166.7, window_end_time_ms=500.0,
            boundaries=self.boundaries_dict,
            anomalies=("dropped_guard_anomaly",),
        )
        self.assertFalse(seq_anomaly.is_complete)

        # 3. Incomplete due to unavailable peak
        boundaries_unav_peak = {
            "preparation": PhaseBoundary(frame_idx=5, time_ms=166.7, evidence=self.ev_proxy),
            "peak": PhaseBoundary.unavailable(),
            "recovery": PhaseBoundary(frame_idx=15, time_ms=500.0, evidence=self.ev_proxy),
        }
        seq_unav_peak = TemporalPhaseSequence(
            action_family="punch", impact_type="peak_extension_proxy",
            fps=30.0, window_start_frame=5, window_end_frame=15,
            window_start_time_ms=166.7, window_end_time_ms=500.0,
            boundaries=boundaries_unav_peak,
            anomalies=(),
        )
        self.assertFalse(seq_unav_peak.is_complete)

        # 4. Incomplete due to missing peak key
        boundaries_no_peak = {
            "preparation": PhaseBoundary(frame_idx=5, time_ms=166.7, evidence=self.ev_proxy),
            "recovery": PhaseBoundary(frame_idx=15, time_ms=500.0, evidence=self.ev_proxy),
        }
        seq_no_peak = TemporalPhaseSequence(
            action_family="punch", impact_type="peak_extension_proxy",
            fps=30.0, window_start_frame=5, window_end_frame=15,
            window_start_time_ms=166.7, window_end_time_ms=500.0,
            boundaries=boundaries_no_peak,
            anomalies=(),
        )
        self.assertFalse(seq_no_peak.is_complete)


class TestPhaseSegmentationLogic(unittest.TestCase):
    """Kiểm thử thuật toán phân đoạn pha thời gian cho Punch và Kick."""

    def test_segment_punch_phases_with_synthetic_trajectory(self):
        punch_seq = generate_punch_sequence()  # 25 frames (0-4 guard, 5-9 extending, 10-14 impact, 15-19 retracting, 20-24 guard)
        # Window cho cú đấm từ frame 5 đến 20
        res = segment_punch_phases(
            window_start_frame=5,
            window_end_frame=20,
            fps=30.0,
            keypoints_trajectory=punch_seq,
            arm="right",
        )

        self.assertEqual(res.action_family, "punch")
        self.assertEqual(res.impact_type, "peak_extension_proxy")
        self.assertTrue(res.is_complete)

        # Kiểm tra sự tồn tại của 5 canonical boundaries
        for p in CANONICAL_PHASES:
            self.assertIn(p, res.boundaries)
            b = res.boundaries[p]
            self.assertIsNotNone(b.frame_idx)
            self.assertIsNotNone(b.time_ms)
            self.assertNotEqual(b.evidence.level, EvidenceLevel.UNAVAILABLE)

        # Kiểm tra thứ tự và giá trị hợp lý theo đặc tính của synthetic punch
        prep = res.boundaries["preparation"]
        launch = res.boundaries["launch"]
        peak = res.boundaries["peak"]
        retract = res.boundaries["retraction"]
        recovery = res.boundaries["recovery"]

        self.assertEqual(prep.frame_idx, 5)
        self.assertTrue(prep.frame_idx <= launch.frame_idx <= peak.frame_idx <= retract.frame_idx <= recovery.frame_idx)
        # Impact nằm trong khoảng 10-14
        self.assertTrue(10 <= peak.frame_idx <= 14)
        self.assertEqual(recovery.frame_idx, 20)

    def test_segment_punch_with_explicit_impact_and_anomalies(self):
        res = segment_punch_phases(
            window_start_frame=5,
            window_end_frame=20,
            fps=30.0,
            impact_frame=12,
            impact_time_ms=400.0,
            anomalies=["dropped_guard_anomaly"],
        )
        self.assertEqual(res.action_family, "punch")
        self.assertEqual(res.boundaries["peak"].frame_idx, 12)
        self.assertEqual(res.boundaries["peak"].time_ms, 400.0)
        self.assertIn("dropped_guard_anomaly", res.anomalies)
        # is_complete should be False due to anomaly
        self.assertFalse(res.is_complete)

    def test_segment_kick_phases_with_synthetic_trajectory(self):
        kick_seq = generate_kick_nodetect_sequence()  # 30 frames (0-4 idle, 5-9 chambering, 10-14 extending, 15-19 impact, 20-24 recovering, 25-29 None)
        res = segment_kick_phases(
            window_start_frame=5,
            window_end_frame=24,
            fps=30.0,
            keypoints_trajectory=kick_seq,
            active_leg="right",
        )

        self.assertEqual(res.action_family, "kick")
        self.assertEqual(res.impact_type, "max_extension_proxy")
        self.assertTrue(res.is_complete)

        prep = res.boundaries["preparation"]
        launch = res.boundaries["launch"]
        peak = res.boundaries["peak"]
        retract = res.boundaries["retraction"]
        recovery = res.boundaries["recovery"]

        self.assertEqual(prep.frame_idx, 5)
        self.assertTrue(prep.frame_idx <= launch.frame_idx <= peak.frame_idx <= retract.frame_idx <= recovery.frame_idx)
        # Chamber peak trong khoảng 5-9
        self.assertTrue(5 <= launch.frame_idx <= 10)
        # Max extension peak trong khoảng 10-14 (góc gối 161.7 độ lớn nhất)
        self.assertTrue(10 <= peak.frame_idx <= 14)
        self.assertEqual(recovery.frame_idx, 24)

    def test_extract_temporal_phases_unified_dispatcher(self):
        res_punch = extract_temporal_phases(
            action_family="punch",
            window_start_frame=10,
            window_end_frame=25,
            fps=30.0,
            impact_frame=18,
        )
        self.assertEqual(res_punch.action_family, "punch")
        self.assertEqual(res_punch.impact_type, "peak_extension_proxy")

        res_kick = extract_temporal_phases(
            action_family="kick",
            window_start_frame=10,
            window_end_frame=25,
            fps=30.0,
            impact_frame=18,
        )
        self.assertEqual(res_kick.action_family, "kick")
        self.assertEqual(res_kick.impact_type, "max_extension_proxy")

        with self.assertRaises(ValueError):
            extract_temporal_phases(
                action_family="headbutt",
                window_start_frame=10,
                window_end_frame=25,
            )

    def test_segment_from_action_result_adapter(self):
        punch_dict = {
            "punchType": "Cross",
            "arm": "right",
            "score": 90,
            "startFrame": 5,
            "impactFrame": 12,
            "endFrame": 20,
            "startTimeMs": 166.7,
            "impactTimeMs": 400.0,
            "endTimeMs": 666.7,
            "guardDropped": True,
        }
        res_punch = segment_from_action_result(punch_dict, fps=30.0)
        self.assertEqual(res_punch.action_family, "punch")
        self.assertEqual(res_punch.impact_type, "peak_extension_proxy")
        self.assertEqual(res_punch.boundaries["peak"].frame_idx, 12)
        self.assertIn("dropped_guard_anomaly", res_punch.anomalies)

        kick_dict = {
            "score": 85,
            "minChamberAngle": 65.0,
            "maxExtensionAngle": 165.0,
            "startFrame": 10,
            "chamberPeakFrame": 14,
            "impactFrame": 18,
            "endFrame": 25,
            "startTimeMs": 333.3,
            "chamberPeakTimeMs": 466.7,
            "impactTimeMs": 600.0,
            "endTimeMs": 833.3,
            "activeLeg": "right",
        }
        res_kick = segment_from_action_result(kick_dict, fps=30.0)
        self.assertEqual(res_kick.action_family, "kick")
        self.assertEqual(res_kick.impact_type, "max_extension_proxy")
        self.assertEqual(res_kick.boundaries["launch"].frame_idx, 14)
        self.assertEqual(res_kick.boundaries["peak"].frame_idx, 18)
        self.assertTrue(res_kick.is_complete)

    def test_missing_peak_evidence_handling(self):
        # When neither impact_frame nor trajectory is provided, peak cannot be resolved
        res = segment_punch_phases(
            window_start_frame=5,
            window_end_frame=15,
            fps=30.0,
            impact_frame=None,
            keypoints_trajectory=None,
        )
        self.assertFalse(res.is_complete)
        self.assertIn("missing_peak_boundary", res.anomalies)
        self.assertEqual(res.boundaries["peak"].evidence.level, EvidenceLevel.UNAVAILABLE)
        self.assertIsNone(res.boundaries["peak"].frame_idx)
        self.assertIsNone(res.boundaries["peak"].time_ms)


    def test_frame_time_consistency_different_fps(self):
        # FPS = 60.0 -> frame_dur = 16.667 ms, tolerance = 8.533 ms
        fps = 60.0
        tol_60 = calculate_tolerance_ms(fps)
        self.assertAlmostEqual(tol_60, 8.533333, places=4)

        # Delta = 8.0 ms <= tolerance
        b_ok = {
            "peak": PhaseBoundary(
                frame_idx=10,
                time_ms=round(0.0 + 10 * (1000.0 / 60.0) + 8.0, 1),
                evidence=PhaseEvidence(level=EvidenceLevel.DERIVED_PROXY, confidence=0.9, source_signal="peak"),
            )
        }
        seq_60 = TemporalPhaseSequence(
            action_family="punch", impact_type="peak_extension_proxy",
            fps=fps, window_start_frame=0, window_end_frame=20,
            window_start_time_ms=0.0, window_end_time_ms=333.3,
            boundaries=b_ok,
        )
        self.assertIn("peak", seq_60.boundaries)

        # Delta = 9.0 ms > tolerance
        b_fail = {
            "peak": PhaseBoundary(
                frame_idx=10,
                time_ms=round(0.0 + 10 * (1000.0 / 60.0) + 9.0, 1),
                evidence=PhaseEvidence(level=EvidenceLevel.DERIVED_PROXY, confidence=0.9, source_signal="peak"),
            )
        }
        with self.assertRaises(ValueError) as ctx:
            TemporalPhaseSequence(
                action_family="punch", impact_type="peak_extension_proxy",
                fps=fps, window_start_frame=0, window_end_frame=20,
                window_start_time_ms=0.0, window_end_time_ms=333.3,
                boundaries=b_fail,
            )
        self.assertIn("consistency violated", str(ctx.exception))

    def test_single_frame_action_window(self):
        ev = PhaseEvidence(level=EvidenceLevel.DERIVED_PROXY, confidence=0.9, source_signal="instant")
        single_frame_b = {
            "preparation": PhaseBoundary(frame_idx=5, time_ms=166.7, evidence=ev),
            "launch": PhaseBoundary(frame_idx=5, time_ms=166.7, evidence=ev),
            "peak": PhaseBoundary(frame_idx=5, time_ms=166.7, evidence=ev),
            "retraction": PhaseBoundary(frame_idx=5, time_ms=166.7, evidence=ev),
            "recovery": PhaseBoundary(frame_idx=5, time_ms=166.7, evidence=ev),
        }
        seq = TemporalPhaseSequence(
            action_family="punch", impact_type="peak_extension_proxy",
            fps=30.0, window_start_frame=5, window_end_frame=5,
            window_start_time_ms=166.7, window_end_time_ms=166.7,
            boundaries=single_frame_b,
        )
        self.assertTrue(seq.is_complete)
        self.assertEqual(seq.window_start_frame, seq.window_end_frame)

    def test_monotonic_equality_multiple_phases_same_frame(self):
        ev = PhaseEvidence(level=EvidenceLevel.DERIVED_PROXY, confidence=0.9, source_signal="sig")
        b_equal = {
            "preparation": PhaseBoundary(frame_idx=5, time_ms=166.7, evidence=ev),
            "launch": PhaseBoundary(frame_idx=5, time_ms=166.7, evidence=ev),
            "peak": PhaseBoundary(frame_idx=6, time_ms=200.0, evidence=ev),
            "retraction": PhaseBoundary(frame_idx=6, time_ms=200.0, evidence=ev),
            "recovery": PhaseBoundary(frame_idx=6, time_ms=200.0, evidence=ev),
        }
        seq = TemporalPhaseSequence(
            action_family="punch", impact_type="peak_extension_proxy",
            fps=30.0, window_start_frame=5, window_end_frame=6,
            window_start_time_ms=166.7, window_end_time_ms=200.0,
            boundaries=b_equal,
        )
        self.assertTrue(seq.is_complete)

    def test_calculate_tolerance_ms_errors(self):
        with self.assertRaises(ValueError):
            calculate_tolerance_ms(0.0)
        with self.assertRaises(ValueError):
            calculate_tolerance_ms(-10.0)
        with self.assertRaises(ValueError):
            calculate_tolerance_ms(float("inf"))
        with self.assertRaises(TypeError):
            calculate_tolerance_ms("30.0")
        with self.assertRaises(TypeError):
            calculate_tolerance_ms(True)

    def test_trajectory_with_missing_and_none_frames(self):
        # Trajectory with None frames mixed with valid frames
        seq = generate_punch_sequence()
        noisy_seq = [None if i % 3 == 0 else pts for i, pts in enumerate(seq)]

        res = segment_punch_phases(
            window_start_frame=5,
            window_end_frame=20,
            fps=30.0,
            keypoints_trajectory=noisy_seq,
            arm="right",
        )
        self.assertEqual(res.action_family, "punch")
        self.assertTrue(res.is_complete)
        self.assertIn("peak", res.boundaries)
        self.assertIsNotNone(res.boundaries["peak"].frame_idx)


class TestTemporalPhaseRemediationGate2(unittest.TestCase):
    """
    Kiểm thử chuyên biệt cho Gate 2 Remediation:
    1. PoseValidityConfig propagation vào mọi hàm kiểm tra landmark validity.
    2. Phase boundaries có confidence=None và ZERO hardcoded fabricated floats.
    3. TemporalPhaseConfig fields, defaults, immutability, versioning.
    """

    def test_temporal_phase_config_defaults_and_immutability(self):
        cfg = TemporalPhaseConfig()
        self.assertEqual(cfg.config_version, "1.0.0")
        self.assertEqual(cfg.min_retraction_delta_deg, 10.0)
        self.assertEqual(cfg.recovery_elbow_angle_deg, 85.0)
        self.assertEqual(cfg.recovery_knee_angle_deg, 110.0)
        self.assertIsInstance(cfg.pose_config, PhaseValidityConfig)
        self.assertEqual(cfg.pose_config.min_landmark_confidence, 0.35)
        self.assertEqual(cfg.pose_config.min_segment_length, 0.02)

        # Frozen immutability
        with self.assertRaises(FrozenInstanceError):
            cfg.config_version = "2.0.0"
        with self.assertRaises(FrozenInstanceError):
            cfg.min_retraction_delta_deg = 20.0
        with self.assertRaises(FrozenInstanceError):
            cfg.pose_config = PhaseValidityConfig()
        with self.assertRaises(FrozenInstanceError):
            cfg.pose_config.min_landmark_confidence = 0.50

    def test_transitive_immutability_and_mutation_isolation(self):
        # Caller supplies a mutable PoseValidityConfig
        caller_pose = PoseValidityConfig(min_landmark_confidence=0.35, min_segment_length=0.02)
        cfg = TemporalPhaseConfig(pose_config=caller_pose)

        # Mutate caller object
        caller_pose.min_landmark_confidence = 0.99
        caller_pose.min_segment_length = 0.50

        # TemporalPhaseConfig must remain completely unaffected
        self.assertEqual(cfg.pose_config.min_landmark_confidence, 0.35)
        self.assertEqual(cfg.pose_config.min_segment_length, 0.02)
        self.assertIsInstance(cfg.pose_config, PhaseValidityConfig)

    def test_temporal_phase_config_validation_and_ranges(self):
        # 1. SemVer config_version validation
        with self.assertRaises(ValueError):
            TemporalPhaseConfig(config_version="")
        with self.assertRaises(ValueError):
            TemporalPhaseConfig(config_version="   ")
        with self.assertRaises(ValueError):
            TemporalPhaseConfig(config_version="1.0")
        with self.assertRaises(ValueError):
            TemporalPhaseConfig(config_version="v1.0.0")
        with self.assertRaises(ValueError):
            TemporalPhaseConfig(config_version="invalid-version")
        with self.assertRaises(TypeError):
            TemporalPhaseConfig(config_version=123)
        with self.assertRaises(TypeError):
            TemporalPhaseConfig(config_version=True)

        # 2. min_retraction_delta_deg > 0
        with self.assertRaises(ValueError):
            TemporalPhaseConfig(min_retraction_delta_deg=0.0)
        with self.assertRaises(ValueError):
            TemporalPhaseConfig(min_retraction_delta_deg=-5.0)
        with self.assertRaises(ValueError):
            TemporalPhaseConfig(min_retraction_delta_deg=float("nan"))
        with self.assertRaises(ValueError):
            TemporalPhaseConfig(min_retraction_delta_deg=float("inf"))
        with self.assertRaises(TypeError):
            TemporalPhaseConfig(min_retraction_delta_deg=True)

        # 3. recovery_elbow_angle_deg in (0, 180)
        with self.assertRaises(ValueError):
            TemporalPhaseConfig(recovery_elbow_angle_deg=0.0)
        with self.assertRaises(ValueError):
            TemporalPhaseConfig(recovery_elbow_angle_deg=180.0)
        with self.assertRaises(ValueError):
            TemporalPhaseConfig(recovery_elbow_angle_deg=190.0)
        with self.assertRaises(ValueError):
            TemporalPhaseConfig(recovery_elbow_angle_deg=-10.0)

        # 4. recovery_knee_angle_deg in (0, 180)
        with self.assertRaises(ValueError):
            TemporalPhaseConfig(recovery_knee_angle_deg=0.0)
        with self.assertRaises(ValueError):
            TemporalPhaseConfig(recovery_knee_angle_deg=180.0)
        with self.assertRaises(ValueError):
            TemporalPhaseConfig(recovery_knee_angle_deg=200.0)
        with self.assertRaises(ValueError):
            TemporalPhaseConfig(recovery_knee_angle_deg=-5.0)

        # 5. min_landmark_confidence in [0, 1]
        with self.assertRaises(ValueError):
            PhaseValidityConfig(min_landmark_confidence=-0.1)
        with self.assertRaises(ValueError):
            PhaseValidityConfig(min_landmark_confidence=1.1)
        with self.assertRaises(ValueError):
            PhaseValidityConfig(min_landmark_confidence=float("nan"))

    def test_custom_temporal_phase_config_injection(self):
        custom_pose_cfg = PoseValidityConfig(min_landmark_confidence=0.20, min_segment_length=0.01)
        cfg = TemporalPhaseConfig(
            config_version="1.1.0",
            min_retraction_delta_deg=15.0,
            recovery_elbow_angle_deg=90.0,
            recovery_knee_angle_deg=120.0,
            pose_config=custom_pose_cfg,
        )
        self.assertEqual(cfg.config_version, "1.1.0")
        self.assertEqual(cfg.min_retraction_delta_deg, 15.0)
        self.assertEqual(cfg.recovery_elbow_angle_deg, 90.0)
        self.assertEqual(cfg.recovery_knee_angle_deg, 120.0)
        self.assertEqual(cfg.pose_config.min_landmark_confidence, 0.20)

    def test_pose_validity_config_propagation_in_helpers(self):
        # Keypoint with conf = 0.30
        # Default PoseValidityConfig has min_landmark_confidence = 0.35 -> invalid (None)
        # Custom PoseValidityConfig with min_landmark_confidence = 0.20 -> valid (non-None)
        p_sh = Point(x=0.5, y=0.3, conf=0.30)
        p_el = Point(x=0.6, y=0.4, conf=0.30)
        p_wr = Point(x=0.7, y=0.3, conf=0.30)

        kps = [Point(x=0.0, y=0.0, conf=0.0) for _ in range(17)]
        kps[KP.RIGHT_SHOULDER] = p_sh
        kps[KP.RIGHT_ELBOW] = p_el
        kps[KP.RIGHT_WRIST] = p_wr

        # 1. Arm reach
        # Default: 0.35 -> should be None
        reach_default = calculate_arm_reach(kps, arm="right")
        self.assertIsNone(reach_default)

        # Custom 0.20 -> should be float
        reach_custom_ok = calculate_arm_reach(kps, arm="right", pose_config=PoseValidityConfig(min_landmark_confidence=0.20))
        self.assertIsNotNone(reach_custom_ok)
        self.assertAlmostEqual(reach_custom_ok, math.dist((0.7, 0.3), (0.5, 0.3)), places=4)

        # 2. Arm elbow angle
        # Default: 0.35 -> should be None
        elbow_default = calculate_arm_elbow_angle(kps, arm="right")
        self.assertIsNone(elbow_default)

        # Custom 0.20 -> should be float
        elbow_custom_ok = calculate_arm_elbow_angle(kps, arm="right", pose_config=PoseValidityConfig(min_landmark_confidence=0.20))
        self.assertIsNotNone(elbow_custom_ok)

        # 3. Leg knee angle
        p_hip = Point(x=0.5, y=0.5, conf=0.30)
        p_knee = Point(x=0.5, y=0.7, conf=0.30)
        p_ankle = Point(x=0.5, y=0.9, conf=0.30)
        kps_leg = [Point(x=0.0, y=0.0, conf=0.0) for _ in range(17)]
        kps_leg[KP.RIGHT_HIP] = p_hip
        kps_leg[KP.RIGHT_KNEE] = p_knee
        kps_leg[KP.RIGHT_ANKLE] = p_ankle

        knee_default = calculate_leg_knee_angle(kps_leg, leg="right")
        self.assertIsNone(knee_default)

        knee_custom_ok = calculate_leg_knee_angle(kps_leg, leg="right", pose_config=PoseValidityConfig(min_landmark_confidence=0.20))
        self.assertIsNotNone(knee_custom_ok)

    def test_pose_validity_config_propagation_through_segmentation(self):
        # Sequence with low-confidence landmarks (conf=0.30)
        p_sh = Point(x=0.5, y=0.3, conf=0.30)
        p_el = Point(x=0.6, y=0.4, conf=0.30)
        p_wr = Point(x=0.7, y=0.3, conf=0.30)
        kps = [Point(x=0.0, y=0.0, conf=0.0) for _ in range(17)]
        kps[KP.RIGHT_SHOULDER] = p_sh
        kps[KP.RIGHT_ELBOW] = p_el
        kps[KP.RIGHT_WRIST] = p_wr
        low_conf_seq = [kps for _ in range(10)]

        # Under default config (min_landmark_confidence=0.35), trajectory reach is completely rejected as invalid
        # so peak cannot be found from trajectory (missing_peak_boundary)
        res_default = segment_punch_phases(
            window_start_frame=0,
            window_end_frame=9,
            fps=30.0,
            keypoints_trajectory=low_conf_seq,
            arm="right",
        )
        self.assertIn("missing_peak_boundary", res_default.anomalies)

        # Under custom config (min_landmark_confidence=0.20), trajectory reach is accepted
        cfg_permissive = TemporalPhaseConfig(
            pose_config=PoseValidityConfig(min_landmark_confidence=0.20)
        )
        res_permissive = segment_punch_phases(
            window_start_frame=0,
            window_end_frame=9,
            fps=30.0,
            keypoints_trajectory=low_conf_seq,
            arm="right",
            config=cfg_permissive,
        )
        self.assertNotIn("missing_peak_boundary", res_permissive.anomalies)
        self.assertTrue(res_permissive.is_complete)

    def test_zero_fabricated_phase_confidence_constants(self):
        # Test punch segmentation
        punch_seq = generate_punch_sequence()
        res_punch = segment_punch_phases(
            window_start_frame=5,
            window_end_frame=20,
            fps=30.0,
            keypoints_trajectory=punch_seq,
            arm="right",
        )
        for phase_name, boundary in res_punch.boundaries.items():
            self.assertIsNone(
                boundary.evidence.confidence,
                f"Fabricated confidence detected in punch phase '{phase_name}': {boundary.evidence.confidence}",
            )

        # Test kick segmentation
        kick_seq = generate_kick_nodetect_sequence()
        res_kick = segment_kick_phases(
            window_start_frame=5,
            window_end_frame=24,
            fps=30.0,
            keypoints_trajectory=kick_seq,
            active_leg="right",
        )
        for phase_name, boundary in res_kick.boundaries.items():
            self.assertIsNone(
                boundary.evidence.confidence,
                f"Fabricated confidence detected in kick phase '{phase_name}': {boundary.evidence.confidence}",
            )

        # Test missing peak fallback
        res_missing = segment_punch_phases(
            window_start_frame=0,
            window_end_frame=10,
            fps=30.0,
            keypoints_trajectory=None,
        )
        for phase_name, boundary in res_missing.boundaries.items():
            self.assertIsNone(
                boundary.evidence.confidence,
                f"Fabricated confidence detected in missing peak phase '{phase_name}': {boundary.evidence.confidence}",
            )

        # Ensure no fabricated floats (0.92, 0.88, 0.85, 0.70, 0.90, 0.82) appear in to_dict output
        forbidden_floats = {0.92, 0.88, 0.85, 0.70, 0.7, 0.90, 0.9, 0.82}
        for d in [res_punch.to_dict(), res_kick.to_dict(), res_missing.to_dict()]:
            for b_dict in d["boundaries"].values():
                conf_val = b_dict["evidence"]["confidence"]
                self.assertIsNone(conf_val)
                self.assertNotIn(conf_val, forbidden_floats)


if __name__ == "__main__":
    unittest.main()


