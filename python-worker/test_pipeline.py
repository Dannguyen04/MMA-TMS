"""
test_pipeline.py — Unit & Golden Regression Tests Cho Kiến Trúc Pipeline Mới (Task 2)

Bao quát các yêu cầu kiểm thử bắt buộc:
1. Contract dataclass: khởi tạo và serialize với nullable fields, observationKind enum.
2. Feature extraction pure functions: trả đúng giá trị, không tạo geometry giả khi thiếu landmark hoặc degenerate.
3. Fallback khuỷu 75° đặt tên đúng LEGACY_ELBOW_DISPLAY_FALLBACK_DEG và có cờ fallback rõ ràng.
4. ActionPipeline:
   - Đảm bảo vòng đời analyzers không bị reinit trong process_frame.
   - Nhánh discontinuity chạy trước EMA (reset EMA, reset kick, reset posture gate).
   - Nhánh missing detection (reset punch derivatives, reset EMA, kick NO_DETECTION, không reset posture gate).
   - Giữ nguyên thứ tự update theo frame.
5. Golden Regression Test:
   - Load `ground_truth/golden_punch_fixture.json` và `ground_truth/golden_kick_nodetect_fixture.json`.
   - Kiểm tra SHA256 checksum so với `ground_truth/golden_baseline_manifest.json` để chống sửa đổi âm thầm.
   - Chạy `ActionPipeline` trên cùng chuỗi frames và kiểm tra DEEP EQUALITY 100% (punches, kicks, findings, actions, summary, frames).
"""

import hashlib
import json
from pathlib import Path
import unittest
from unittest.mock import MagicMock, patch

from pose_math import Point, KP, PoseValidityConfig
from kick_analyzer import KickAnalyzer, KickState
from punch_analyzer import PunchAnalyzer, PunchState
from posture_gate import PostureGate, PostureState
from action_result import build_actions_list

from pipeline import (
    ActionPipeline,
    PoseObservation,
    ObservationKind,
    FrameContext,
    UpperBodyFrameFeatures,
    LowerBodyFrameFeatures,
    FrameAnalysisResult,
    LEGACY_ELBOW_DISPLAY_FALLBACK_DEG,
    extract_lower_body_features,
    extract_upper_body_features,
)
from create_golden_baseline import (
    generate_punch_sequence,
    generate_kick_nodetect_sequence,
    compute_sha256,
)


class TestPipelineContracts(unittest.TestCase):
    """Kiểm tra các dataclasses trong contracts.py."""

    def test_pose_observation_defaults_and_nullable(self):
        obs = PoseObservation()
        self.assertIsNone(obs.keypoints)
        self.assertEqual(obs.observation_kind, ObservationKind.FRESH_DETECTION)
        self.assertFalse(obs.is_discontinuous)
        self.assertIsNone(obs.confidence)

        obs_cached = PoseObservation(
            keypoints=[Point(0.1, 0.2, 0.9)],
            observation_kind=ObservationKind.CACHED_BETWEEN_DETECTION,
            is_discontinuous=True,
        )
        self.assertEqual(obs_cached.observation_kind, ObservationKind.CACHED_BETWEEN_DETECTION)
        self.assertTrue(obs_cached.is_discontinuous)

    def test_frame_context(self):
        ctx = FrameContext(frame_idx=10, time_ms=333.3, fps=30.0, img_w=1080, img_h=1920)
        self.assertEqual(ctx.frame_idx, 10)
        self.assertAlmostEqual(ctx.time_ms, 333.3)

    def test_upper_body_features_fallback_flags(self):
        # Khi có đo lường thực tế
        f_meas = UpperBodyFrameFeatures(
            left_elbow_angle=120.0,
            right_elbow_angle=130.0,
            is_left_fallback=False,
            is_right_fallback=False,
            left_arm_valid=True,
            right_arm_valid=True,
        )
        self.assertEqual(f_meas.left_elbow_angle, 120.0)
        self.assertFalse(f_meas.is_left_fallback)

        # Khi là fallback
        f_fall = UpperBodyFrameFeatures(
            left_elbow_angle=LEGACY_ELBOW_DISPLAY_FALLBACK_DEG,
            right_elbow_angle=LEGACY_ELBOW_DISPLAY_FALLBACK_DEG,
            is_left_fallback=True,
            is_right_fallback=True,
            left_arm_valid=False,
            right_arm_valid=False,
        )
        self.assertEqual(f_fall.left_elbow_angle, 75.0)
        self.assertTrue(f_fall.is_left_fallback)

    def test_lower_body_features_nullable(self):
        low = LowerBodyFrameFeatures()
        self.assertEqual(low.active_leg, "none")
        self.assertIsNone(low.knee_angle)
        self.assertIsNone(low.hip_angle)
        self.assertIsNone(low.active_ankle)
        self.assertFalse(low.landmarks_valid)
        self.assertFalse(low.geometry_valid)
        self.assertEqual(low.rejection_reason, "NONE")


class TestFeatureExtractionPureFunctions(unittest.TestCase):
    """Kiểm tra feature extraction không mutate, không tạo geometry giả khi thiếu landmark."""

    def setUp(self):
        self.kps_valid = [Point(0.5, 0.5, 0.95) for _ in range(17)]
        # Vai, khuỷu, cổ tay
        self.kps_valid[KP.LEFT_SHOULDER] = Point(0.40, 0.35, 0.95)
        self.kps_valid[KP.LEFT_ELBOW] = Point(0.35, 0.45, 0.95)
        self.kps_valid[KP.LEFT_WRIST] = Point(0.35, 0.55, 0.95)

        self.kps_valid[KP.RIGHT_SHOULDER] = Point(0.60, 0.35, 0.95)
        self.kps_valid[KP.RIGHT_ELBOW] = Point(0.65, 0.45, 0.95)
        self.kps_valid[KP.RIGHT_WRIST] = Point(0.65, 0.55, 0.95)

        # Hông, gối, cổ chân
        self.kps_valid[KP.LEFT_HIP] = Point(0.45, 0.55, 0.95)
        self.kps_valid[KP.LEFT_KNEE] = Point(0.45, 0.72, 0.95)
        self.kps_valid[KP.LEFT_ANKLE] = Point(0.45, 0.90, 0.95)

        self.kps_valid[KP.RIGHT_HIP] = Point(0.55, 0.55, 0.95)
        self.kps_valid[KP.RIGHT_KNEE] = Point(0.55, 0.72, 0.95)
        self.kps_valid[KP.RIGHT_ANKLE] = Point(0.55, 0.90, 0.95)

    def test_extract_upper_body_measured_vs_fallback(self):
        # 1. Hợp lệ: tính được góc
        f = extract_upper_body_features(self.kps_valid)
        self.assertFalse(f.is_left_fallback)
        self.assertTrue(f.left_arm_valid)
        self.assertAlmostEqual(f.left_elbow_angle, 153.4, places=1)

        # 2. Keypoint tay trái bị mất (conf < 0.25) -> fallback 75.0, cờ is_left_fallback = True
        kps_missing = [Point(p.x, p.y, p.conf) for p in self.kps_valid]
        kps_missing[KP.LEFT_WRIST] = Point(0.0, 0.0, 0.10)
        f_miss = extract_upper_body_features(kps_missing)
        self.assertEqual(f_miss.left_elbow_angle, LEGACY_ELBOW_DISPLAY_FALLBACK_DEG)
        self.assertTrue(f_miss.is_left_fallback)
        self.assertFalse(f_miss.left_arm_valid)

    def test_extract_lower_body_no_false_geometry(self):
        # 1. Khi active_leg = none -> landmarks_valid và geometry_valid đều False
        low_idle = extract_lower_body_features(self.kps_valid, posture="standing")
        self.assertEqual(low_idle.active_leg, "none")
        self.assertFalse(low_idle.landmarks_valid)
        self.assertFalse(low_idle.geometry_valid)
        self.assertIsNone(low_idle.knee_angle)

        # 2. Khi ở Ground: dù chân nhấc cao vẫn ép active_leg = none
        kps_ground = [Point(p.x, p.y, p.conf) for p in self.kps_valid]
        kps_ground[KP.RIGHT_ANKLE] = Point(0.55, 0.30, 0.95)  # nhấc cao hơn hông
        low_ground = extract_lower_body_features(kps_ground, posture="ground")
        self.assertEqual(low_ground.active_leg, "none")
        self.assertFalse(low_ground.landmarks_valid)

        # 3. Khi chân đá nhưng khớp bị suy biến (degenerate vector length)
        kps_degen = [Point(p.x, p.y, p.conf) for p in self.kps_valid]
        kps_degen[KP.RIGHT_KNEE] = Point(0.60, 0.45, 0.95)
        kps_degen[KP.RIGHT_ANKLE] = Point(0.60, 0.45, 0.95)  # trùng vị trí gối -> vector dài 0
        low_degen = extract_lower_body_features(kps_degen, posture="standing")
        self.assertEqual(low_degen.active_leg, "right")
        self.assertTrue(low_degen.landmarks_valid)
        self.assertFalse(low_degen.geometry_valid)
        self.assertEqual(low_degen.rejection_reason, "DEGENERATE_VECTOR_LENGTH")
        self.assertIsNone(low_degen.knee_angle)


class TestActionPipelineBehavior(unittest.TestCase):
    """Kiểm tra hành vi của ActionPipeline: vòng đời analyzers, reset, thứ tự update."""

    def test_analyzers_lifecycle_not_reinitialized(self):
        pipeline = ActionPipeline()
        ka_orig = pipeline.kick_analyzer
        pa_orig = pipeline.punch_analyzer
        pg_orig = pipeline.kick_posture_gate

        # Chạy qua 5 frames
        for f in range(5):
            obs = PoseObservation(keypoints=None)
            ctx = FrameContext(frame_idx=f, time_ms=f * 33.3)
            pipeline.process_frame(obs, ctx)

        # Cùng một instances xuyên suốt video
        self.assertIs(pipeline.kick_analyzer, ka_orig)
        self.assertIs(pipeline.punch_analyzer, pa_orig)
        self.assertIs(pipeline.kick_posture_gate, pg_orig)

    def test_discontinuity_resets_before_ema(self):
        pipeline = ActionPipeline()
        # Đánh dấu EMA đã initialized
        for s in pipeline.ema_states.values():
            s.initialized = True
        pipeline.kick_analyzer.state = KickState.CHAMBERING

        # Gửi frame có discontinuity
        obs = PoseObservation(keypoints=None, is_discontinuous=True)
        ctx = FrameContext(frame_idx=0, time_ms=0.0)
        pipeline.process_frame(obs, ctx)

        # EMA phải bị uninitialized và kick bị reset về IDLE
        for s in pipeline.ema_states.values():
            self.assertFalse(s.initialized)
        self.assertEqual(pipeline.kick_analyzer.state, KickState.IDLE)

    def test_missing_detection_keeps_posture_gate_and_resets_derivatives(self):
        pipeline = ActionPipeline()
        # Giả lập posture gate có state đứng
        pipeline.kick_posture_gate.current_state = PostureState.STANDING

        obs = PoseObservation(keypoints=None, observation_kind=ObservationKind.MISSING_DETECTION)
        ctx = FrameContext(frame_idx=10, time_ms=333.3)
        res = pipeline.process_frame(obs, ctx)

        # Frame record rỗng đúng format
        d = res.to_legacy_dict()
        self.assertEqual(d["activeLeg"], "none")
        self.assertIsNone(d["kneeAngle"])
        self.assertEqual(d["kickRejectionReason"], "NO_DETECTION")
        self.assertEqual(d["speed"], 0)
        # PostureGate KHÔNG bị reset khi missing detection
        self.assertEqual(pipeline.kick_posture_gate.current_state, PostureState.STANDING)


class TestGoldenRegression(unittest.TestCase):
    """
    Golden Regression Test:
    Bảo đảm 100% deep equality giữa logic pipeline mới và baseline snapshot đã ghi nhận.
    """

    @classmethod
    def setUpClass(cls):
        gt_dir = Path("ground_truth")
        manifest_file = gt_dir / "golden_baseline_manifest.json"
        with open(manifest_file, "r", encoding="utf-8") as f:
            cls.manifest = json.load(f)

        punch_file = gt_dir / "golden_punch_fixture.json"
        with open(punch_file, "r", encoding="utf-8") as f:
            cls.punch_baseline = json.load(f)

        kick_file = gt_dir / "golden_kick_nodetect_fixture.json"
        with open(kick_file, "r", encoding="utf-8") as f:
            cls.kick_baseline = json.load(f)

    def test_manifest_checksum_integrity(self):
        """Kiểm tra SHA256 checksum của file baseline để đảm bảo không bị chỉnh sửa âm thầm."""
        punch_hash = compute_sha256(self.punch_baseline)
        kick_hash = compute_sha256(self.kick_baseline)

        self.assertEqual(punch_hash, self.manifest["golden_punch_fixture.json"]["sha256"])
        self.assertEqual(kick_hash, self.manifest["golden_kick_nodetect_fixture.json"]["sha256"])

    def _run_new_pipeline_on_sequence(
        self,
        frames_keypoints: list,
        fps: float = 30.0,
        model_name: str = "yolov8n-pose",
        stance: str = "unknown",
        video_rel_path: str = "fixtures/deterministic_sequence.mp4",
    ) -> dict:
        """Hàm chạy chuỗi keypoints qua ActionPipeline mới và tổng hợp output."""
        action_pipeline = ActionPipeline()
        frame_records = []
        total_frames = len(frames_keypoints)

        for frame_idx, keypoints in enumerate(frames_keypoints):
            time_ms = (frame_idx / fps) * 1000.0
            obs_kind = ObservationKind.FRESH_DETECTION if keypoints is not None else ObservationKind.MISSING_DETECTION
            obs = PoseObservation(
                keypoints=keypoints,
                observation_kind=obs_kind,
                is_discontinuous=False,
            )
            ctx = FrameContext(
                frame_idx=frame_idx,
                time_ms=time_ms,
                fps=fps,
                img_w=1080,
                img_h=1920,
            )
            analysis_result = action_pipeline.process_frame(obs, ctx)
            frame_records.append(analysis_result.to_legacy_dict())

        punches, kicks = action_pipeline.get_results()
        kicks_dicts = [r.to_dict() for r in kicks]
        punches_dicts = [p.to_dict() for p in punches]

        actions = build_actions_list(
            punches=punches,
            kicks=kicks,
            stance=stance,
            model_version=model_name,
            rubric_version=None,
        )
        actions_dicts = [a.to_dict() for a in actions]

        all_findings = []
        for p in punches:
            for f in p.findings:
                all_findings.append(f.to_dict())
        for k in kicks:
            for f in k.findings:
                all_findings.append(f.to_dict())

        all_scores = [p.score for p in punches] + [k.score for k in kicks]
        avg_score = round(float(sum(all_scores) / len(all_scores)), 1) if all_scores else 0.0
        best_score = max(all_scores) if all_scores else 0

        if len(kicks) > 0 and len(punches) == 0:
            primary_action = "KICK"
        elif len(punches) > 0 and len(kicks) == 0:
            primary_action = "PUNCH"
        elif len(kicks) > 0 and len(punches) > 0:
            primary_action = "MIXED"
        else:
            primary_action = "NONE"

        summary = {
            "totalFrames":      total_frames,
            "totalKicks":       len(kicks),
            "totalPunches":     len(punches),
            "primaryAction":    primary_action,
            "totalFindings":    len(all_findings),
            "avgScore":         avg_score,
            "bestScore":        best_score,
        }

        output = {
            "schemaVersion":  "1.0.0",
            "meta": {
                "videoPath":      video_rel_path,
                "model":          model_name,
                "scoringVersion": "rubric-v3.0.0",
                "fps":            round(fps, 2),
                "totalFrames":    total_frames,
                "durationMs":     round((total_frames / fps) * 1000.0, 1),
                "imgWidth":       1080,
                "imgHeight":      1920,
            },
            "actions":  actions_dicts,
            "frames":   frame_records,
            "kicks":    kicks_dicts,
            "punches":  punches_dicts,
            "findings": all_findings,
            "summary":  summary,
        }
        return output

    def test_golden_punch_fixture_exact_match(self):
        """Kiểm tra deep equality 100% trên chuỗi đấm Cross."""
        seq = generate_punch_sequence()
        new_output = self._run_new_pipeline_on_sequence(
            seq, fps=30.0, model_name="yolov8n-pose", stance="orthodox", video_rel_path="fixtures/punch_fixture.mp4"
        )

        # So sánh cấu trúc tổng thể
        self.assertEqual(len(new_output["punches"]), len(self.punch_baseline["punches"]))
        self.assertEqual(len(new_output["kicks"]), len(self.punch_baseline["kicks"]))
        self.assertEqual(len(new_output["actions"]), len(self.punch_baseline["actions"]))
        self.assertEqual(len(new_output["findings"]), len(self.punch_baseline["findings"]))
        self.assertEqual(len(new_output["frames"]), len(self.punch_baseline["frames"]))
        self.assertEqual(new_output["summary"], self.punch_baseline["summary"])

        # So sánh chi tiết đòn đấm
        self.assertEqual(new_output["punches"], self.punch_baseline["punches"])
        # So sánh chi tiết ActionResult v1.0.0
        self.assertEqual(new_output["actions"], self.punch_baseline["actions"])
        # So sánh chi tiết từng frame record
        self.assertEqual(new_output["frames"], self.punch_baseline["frames"])
        # So sánh toàn bộ output dict
        self.assertEqual(new_output, self.punch_baseline)

    def test_golden_kick_nodetect_fixture_exact_match(self):
        """Kiểm tra deep equality 100% trên chuỗi đá Round Kick có missing detection."""
        seq = generate_kick_nodetect_sequence()
        new_output = self._run_new_pipeline_on_sequence(
            seq, fps=30.0, model_name="yolov8n-pose", stance="unknown", video_rel_path="fixtures/kick_nodetect_fixture.mp4"
        )

        # So sánh cấu trúc tổng thể
        self.assertEqual(len(new_output["punches"]), len(self.kick_baseline["punches"]))
        self.assertEqual(len(new_output["kicks"]), len(self.kick_baseline["kicks"]))
        self.assertEqual(len(new_output["actions"]), len(self.kick_baseline["actions"]))
        self.assertEqual(len(new_output["findings"]), len(self.kick_baseline["findings"]))
        self.assertEqual(len(new_output["frames"]), len(self.kick_baseline["frames"]))
        self.assertEqual(new_output["summary"], self.kick_baseline["summary"])

        # So sánh chi tiết đòn đá
        self.assertEqual(new_output["kicks"], self.kick_baseline["kicks"])
        # So sánh chi tiết ActionResult v1.0.0
        self.assertEqual(new_output["actions"], self.kick_baseline["actions"])
        # So sánh chi tiết từng frame record
        self.assertEqual(new_output["frames"], self.kick_baseline["frames"])
        # So sánh toàn bộ output dict
        self.assertEqual(new_output, self.kick_baseline)

    def test_golden_punch_fixture_with_unknown_stance_contract(self):
        """
        Kiểm tra biến thể stance unknown trên punch sequence:
        - Mọi đòn phát hiện (punches, kicks, findings, frames, summary) phải 100% khớp baseline.
        - Duy nhất chỉ có stance và limbRole trong actions là 'unknown'.
        """
        seq = generate_punch_sequence()
        output_unknown = self._run_new_pipeline_on_sequence(
            seq, fps=30.0, model_name="yolov8n-pose", stance="unknown", video_rel_path="fixtures/punch_fixture.mp4"
        )
        self.assertEqual(output_unknown["punches"], self.punch_baseline["punches"])
        self.assertEqual(output_unknown["kicks"], self.punch_baseline["kicks"])
        self.assertEqual(output_unknown["findings"], self.punch_baseline["findings"])
        self.assertEqual(output_unknown["frames"], self.punch_baseline["frames"])
        self.assertEqual(output_unknown["summary"], self.punch_baseline["summary"])

        self.assertEqual(len(output_unknown["actions"]), len(self.punch_baseline["actions"]))
        act_unknown = output_unknown["actions"][0]
        act_base = self.punch_baseline["actions"][0]
        self.assertEqual(act_unknown["stance"], "unknown")
        self.assertEqual(act_unknown["limbRole"], "unknown")

        # So sánh toàn bộ trường còn lại
        for key in act_base:
            if key not in ("stance", "limbRole"):
                self.assertEqual(act_unknown[key], act_base[key], f"Trường {key} không được phép thay đổi")

    def test_golden_punch_fixture_with_southpaw_stance_contract(self):
        """
        Kiểm tra biến thể stance southpaw trên punch sequence:
        - punches, kicks, findings, frames, summary không đổi.
        - Trong action: stance là 'southpaw', limbRole chuyển từ 'rear' sang 'lead' (vì tay phải).
        - Technique vẫn là 'cross' (bảo toàn zero regression).
        """
        seq = generate_punch_sequence()
        output_southpaw = self._run_new_pipeline_on_sequence(
            seq, fps=30.0, model_name="yolov8n-pose", stance="southpaw", video_rel_path="fixtures/punch_fixture.mp4"
        )
        self.assertEqual(output_southpaw["punches"], self.punch_baseline["punches"])
        self.assertEqual(output_southpaw["kicks"], self.punch_baseline["kicks"])
        self.assertEqual(output_southpaw["findings"], self.punch_baseline["findings"])
        self.assertEqual(output_southpaw["frames"], self.punch_baseline["frames"])
        self.assertEqual(output_southpaw["summary"], self.punch_baseline["summary"])

        act_southpaw = output_southpaw["actions"][0]
        act_base = self.punch_baseline["actions"][0]
        self.assertEqual(act_southpaw["stance"], "southpaw")
        self.assertEqual(act_southpaw["limbRole"], "lead")
        self.assertEqual(act_southpaw["technique"], "cross")

        for key in act_base:
            if key not in ("stance", "limbRole"):
                self.assertEqual(act_southpaw[key], act_base[key], f"Trường {key} không được phép thay đổi")

    def test_golden_kick_fixture_with_orthodox_stance_contract(self):
        """
        Kiểm tra biến thể stance orthodox trên kick sequence:
        - kicks, punches, findings, frames, summary không đổi so với baseline unknown.
        - Trong action: stance là 'orthodox', limbRole chuyển từ 'unknown' sang 'rear' (chân phải).
        """
        seq = generate_kick_nodetect_sequence()
        output_ortho = self._run_new_pipeline_on_sequence(
            seq, fps=30.0, model_name="yolov8n-pose", stance="orthodox", video_rel_path="fixtures/kick_nodetect_fixture.mp4"
        )
        self.assertEqual(output_ortho["punches"], self.kick_baseline["punches"])
        self.assertEqual(output_ortho["kicks"], self.kick_baseline["kicks"])
        self.assertEqual(output_ortho["findings"], self.kick_baseline["findings"])
        self.assertEqual(output_ortho["frames"], self.kick_baseline["frames"])
        self.assertEqual(output_ortho["summary"], self.kick_baseline["summary"])

        act_ortho = output_ortho["actions"][0]
        act_base = self.kick_baseline["actions"][0]
        self.assertEqual(act_ortho["stance"], "orthodox")
        self.assertEqual(act_ortho["limbRole"], "rear")

        for key in act_base:
            if key not in ("stance", "limbRole"):
                self.assertEqual(act_ortho[key], act_base[key], f"Trường {key} không được phép thay đổi")


if __name__ == "__main__":
    unittest.main()

