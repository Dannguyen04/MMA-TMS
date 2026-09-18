"""
test_quality_gate.py — Comprehensive Unit & Determinism Tests for Task 9 Quality Gate
"""

import copy
import json
import unittest

from pipeline.contracts import EvidenceLevel
from pipeline.quality_gate import (
    AnalysisQuality,
    QualityGateConfig,
    QualityGateEvaluator,
    QualityReasonCode,
    QualityStatus,
    evaluate_video_quality,
)


def _generate_synthetic_frames(
    count: int,
    conf: float = 0.9,
    missing_ratio: float = 0.0,
) -> list[dict]:
    frames = []
    for i in range(count):
        is_missing = (i / count) < missing_ratio
        if is_missing:
            frames.append({"frameIdx": i, "landmarks": []})
        else:
            landmarks = [
                {"x": 0.5, "y": 0.5, "conf": conf}
                for _ in range(17)
            ]
            frames.append({"frameIdx": i, "landmarks": landmarks})
    return frames


class TestQualityGate(unittest.TestCase):

    def setUp(self):
        self.evaluator = QualityGateEvaluator()

    def test_happy_path_pass(self):
        frames = _generate_synthetic_frames(30, conf=0.85)
        quality = self.evaluator.evaluate(
            frames=frames,
            fps=30.0,
            img_width=1280,
            img_height=720,
        )
        self.assertEqual(quality.status, QualityStatus.PASS)
        self.assertEqual(quality.adjusted_evidence_level, EvidenceLevel.OBSERVED)
        self.assertEqual(len(quality.reason_codes), 0)
        self.assertEqual(quality.recommendation, "proceed_full_analysis")
        self.assertGreaterEqual(quality.metrics.upper_body_coverage, 0.7)

    def test_low_fps_degraded_and_blocked(self):
        # FPS 15 -> degraded (between 12 and 20)
        frames = _generate_synthetic_frames(30, conf=0.85)
        quality_degraded = self.evaluator.evaluate(frames=frames, fps=15.0)
        self.assertEqual(quality_degraded.status, QualityStatus.DEGRADED)
        self.assertIn(QualityReasonCode.CAMERA_LOW_FPS.value, quality_degraded.reason_codes)
        self.assertEqual(quality_degraded.adjusted_evidence_level, EvidenceLevel.DERIVED_PROXY)

        # FPS 8 -> blocked (below 12)
        quality_blocked = self.evaluator.evaluate(frames=frames, fps=8.0)
        self.assertEqual(quality_blocked.status, QualityStatus.BLOCKED)
        self.assertIn(QualityReasonCode.CAMERA_LOW_FPS.value, quality_blocked.reason_codes)
        self.assertEqual(quality_blocked.adjusted_evidence_level, EvidenceLevel.UNAVAILABLE)
        self.assertEqual(quality_blocked.recommendation, "abstain_technical_conclusions")

    def test_short_duration_blocked(self):
        # 4 frames at 30 fps = 133ms -> below 300ms blocked
        frames = _generate_synthetic_frames(4, conf=0.85)
        quality = self.evaluator.evaluate(frames=frames, fps=30.0)
        self.assertEqual(quality.status, QualityStatus.BLOCKED)
        self.assertIn(QualityReasonCode.CAMERA_SHORT_DURATION.value, quality.reason_codes)
        self.assertEqual(quality.adjusted_evidence_level, EvidenceLevel.UNAVAILABLE)

    def test_high_missing_frame_ratio_blocked(self):
        # 60% missing frames
        frames = _generate_synthetic_frames(50, conf=0.85, missing_ratio=0.60)
        quality = self.evaluator.evaluate(frames=frames, fps=30.0)
        self.assertEqual(quality.status, QualityStatus.BLOCKED)
        self.assertIn(QualityReasonCode.MISSING_FRAME_RATIO_HIGH.value, quality.reason_codes)

    def test_low_keypoint_confidence_degraded(self):
        # mean conf 0.35 -> between 0.25 and 0.45 (degraded)
        frames = _generate_synthetic_frames(30, conf=0.35)
        quality = self.evaluator.evaluate(frames=frames, fps=30.0)
        self.assertEqual(quality.status, QualityStatus.DEGRADED)
        self.assertIn(QualityReasonCode.KEYPOINT_CONFIDENCE_LOW.value, quality.reason_codes)

    def test_multi_person_ambiguity(self):
        frames = _generate_synthetic_frames(30, conf=0.85)
        # 3 persons detected simultaneously and target ratio only 40% -> blocked
        quality = self.evaluator.evaluate(
            frames=frames,
            fps=30.0,
            multi_person_counts=[3] * 30,
            target_track_counts=12,
        )
        self.assertEqual(quality.status, QualityStatus.BLOCKED)
        self.assertIn(QualityReasonCode.MULTI_PERSON_AMBIGUITY.value, quality.reason_codes)
        self.assertIn(QualityReasonCode.TARGET_ATHLETE_AMBIGUITY.value, quality.reason_codes)

    def test_zero_input_mutation(self):
        frames = _generate_synthetic_frames(25, conf=0.8)
        frames_copy = copy.deepcopy(frames)
        self.evaluator.evaluate(frames=frames, fps=30.0)
        self.assertEqual(frames, frames_copy)

    def test_determinism(self):
        frames = _generate_synthetic_frames(30, conf=0.32, missing_ratio=0.2)
        q1 = self.evaluator.evaluate(frames=frames, fps=18.0)
        q2 = self.evaluator.evaluate(frames=frames, fps=18.0)
        self.assertEqual(q1.status, q2.status)
        self.assertEqual(q1.reason_codes, q2.reason_codes)
        self.assertEqual(q1.metrics.to_dict(), q2.metrics.to_dict())
        self.assertEqual(q1.adjusted_evidence_level, q2.adjusted_evidence_level)

    def test_json_serialization_safe(self):
        frames = _generate_synthetic_frames(20, conf=0.7)
        quality = self.evaluator.evaluate(frames=frames, fps=25.0)
        d = quality.to_dict()
        # Verify strict JSON serializability
        serialized = json.dumps(d)
        deserialized = json.loads(serialized)
        self.assertEqual(deserialized["status"], quality.status.value)
        self.assertEqual(deserialized["qualityVersion"], "1.0.0")
        self.assertEqual(deserialized["evaluatorVersion"], "1.0.0")
        self.assertIn("fps", deserialized["metrics"])


if __name__ == "__main__":
    unittest.main()

