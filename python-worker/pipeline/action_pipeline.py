"""
action_pipeline.py — Orchestrator Tách Tầng Cho Xử Lý Action Theo Frame (Task 2)

Quản lý vòng đời xuyên suốt video của:
- EMAState (17 states cho 17 landmarks)
- PostureGate (nhận diện ground grappling vs standing/crouched)
- KickAnalyzer (Candidate FSM + Rubric Kick)
- PunchAnalyzer (Candidate FSM + Rubric Punch)

Nguyên tắc bắt buộc:
- Tuyệt đối không khởi tạo lại các stateful analyzers trong process_frame().
- Giữ đúng thứ tự update, reset và gating theo các nguyên tắc đã được phê duyệt:
  1. Discontinuity reset (chạy trước EMA)
  2. Missing detection handling
  3. EMA smoothing
  4. PostureGate update & ground handling
  5. Capture previous kick state
  6. Lower-body feature extraction
  7. KickAnalyzer update
  8. Upper-body display angle extraction
  9. PunchAnalyzer update
  10. Return FrameAnalysisResult
"""

from typing import Optional

from pose_math import (
    Point, EMAState, apply_ema, PoseValidityConfig,
)
from kick_analyzer import (
    KickAnalyzer, KickState, KICK_STATE_LABELS, KickResult,
)
from punch_analyzer import (
    PunchAnalyzer, PunchState, PUNCH_STATE_LABELS, PunchResult,
)
from posture_gate import (
    PostureGate, PostureState,
)
from pipeline.contracts import (
    PoseObservation, FrameContext, FrameAnalysisResult,
)
from pipeline.feature_extraction import (
    extract_lower_body_features, extract_upper_body_features,
)


EMA_ALPHA: float = 0.35


class ActionPipeline:
    """
    Orchestrator điều phối việc trích xuất feature và cập nhật candidate detectors theo frame.
    Sở hữu vòng đời của các analyzers xuyên suốt một video.
    """

    def __init__(
        self,
        ema_alpha: float = EMA_ALPHA,
        pose_config: Optional[PoseValidityConfig] = None,
    ):
        self.ema_alpha = ema_alpha
        self.pose_config = pose_config or PoseValidityConfig()

        # Khởi tạo các stateful objects xuyên suốt video
        self.ema_states: dict[int, EMAState] = {i: EMAState() for i in range(17)}
        self.kick_analyzer = KickAnalyzer()
        self.punch_analyzer = PunchAnalyzer()
        self.kick_posture_gate = PostureGate()

    def process_frame(
        self,
        observation: PoseObservation,
        context: FrameContext,
    ) -> FrameAnalysisResult:
        """
        Xử lý quan sát tại một frame và trả về FrameAnalysisResult.
        """
        # ── 1. Nhánh Discontinuity: phải chạy TRƯỚC EMA ──
        if observation.is_discontinuous:
            for s in self.ema_states.values():
                s.initialized = False
            self.kick_analyzer.reset_motion()
            self.kick_posture_gate.reset()

        # ── 2. Nhánh Missing Detection: khi không có keypoints ──
        if not observation.keypoints:
            self.punch_analyzer.reset_temporal_derivatives()
            for s in self.ema_states.values():
                s.initialized = False
            self.kick_analyzer.update(
                active_leg="none",
                frame_idx=context.frame_idx,
                time_ms=context.time_ms,
                landmarks_valid=False,
                geometry_valid=False,
                rejection_reason="NO_DETECTION",
            )
            return FrameAnalysisResult(
                frame_idx=context.frame_idx,
                time_ms=context.time_ms,
                observation_kind=observation.observation_kind,
                is_discontinuous=observation.is_discontinuous,
                filtered_keypoints=[],
                upper_body=None,
                lower_body=None,
                punch_state=self.punch_analyzer.state.value,
                punch_state_label=PUNCH_STATE_LABELS[self.punch_analyzer.state],
                active_arm="none",
                kick_state=self.kick_analyzer.state.value,
                kick_state_label=KICK_STATE_LABELS[self.kick_analyzer.state],
                kick_previous_state=self.kick_analyzer.state.value,
                kick_transition_reason="NONE",
                kick_rejection_reason="NO_DETECTION",
                speed=0.0,
            )

        # ── 3. EMA Filter ──
        filtered_kps: list[Point] = [
            apply_ema(kp, self.ema_states[i], self.ema_alpha)
            for i, kp in enumerate(observation.keypoints)
        ]

        # ── 4. PostureGate update & ground handling ──
        posture_state, _ = self.kick_posture_gate.update(filtered_kps)
        if posture_state == PostureState.GROUND:
            self.kick_analyzer.reset_motion()

        # ── 5. Capture previous kick state & active-leg ──
        prev_kick_state = self.kick_analyzer.state
        preferred_leg = (
            self.kick_analyzer.active_leg
            if self.kick_analyzer.state != KickState.IDLE
            else "none"
        )

        # ── 6. Lower-body feature extraction (pure function) ──
        lower_features = extract_lower_body_features(
            filtered_kps=filtered_kps,
            posture=posture_state.value,
            preferred_leg=preferred_leg,
            pose_config=self.pose_config,
        )

        # ── 7. KickAnalyzer update ──
        _kick_res = self.kick_analyzer.update(
            knee_angle=lower_features.knee_angle,
            hip_angle=lower_features.hip_angle,
            ankle=lower_features.active_ankle,
            frame_idx=context.frame_idx,
            time_ms=context.time_ms,
            active_leg=lower_features.active_leg,
            landmarks_valid=lower_features.landmarks_valid,
            geometry_valid=lower_features.geometry_valid,
            rejection_reason=lower_features.rejection_reason,
        )

        # ── 8. Upper-body display angle extraction (pure function) ──
        upper_features = extract_upper_body_features(filtered_kps)

        # ── 9. PunchAnalyzer update ──
        _punch_res = self.punch_analyzer.update(
            keypoints=filtered_kps,
            frame_idx=context.frame_idx,
            time_ms=context.time_ms,
            is_discontinuous=observation.is_discontinuous,
        )

        # Xác định rejection reason hiển thị theo legacy logic
        if lower_features.landmarks_valid and lower_features.geometry_valid:
            kick_rej_reason = "NONE"
        else:
            kick_rej_reason = self.kick_analyzer.last_rejection_reason

        # ── 10. Tạo FrameAnalysisResult ──
        return FrameAnalysisResult(
            frame_idx=context.frame_idx,
            time_ms=context.time_ms,
            observation_kind=observation.observation_kind,
            is_discontinuous=observation.is_discontinuous,
            filtered_keypoints=filtered_kps,
            upper_body=upper_features,
            lower_body=lower_features,
            punch_state=self.punch_analyzer.state.value,
            punch_state_label=PUNCH_STATE_LABELS[self.punch_analyzer.state],
            active_arm=self.punch_analyzer.active_arm,
            kick_state=self.kick_analyzer.state.value,
            kick_state_label=KICK_STATE_LABELS[self.kick_analyzer.state],
            kick_previous_state=prev_kick_state.value,
            kick_transition_reason=self.kick_analyzer.last_transition_reason,
            kick_rejection_reason=kick_rej_reason,
            speed=0.0,
        )

    def get_results(self) -> tuple[list[PunchResult], list[KickResult]]:
        """
        Trả về kết quả đòn đánh tích lũy từ các analyzers: (punches, kicks).
        """
        return self.punch_analyzer.results, self.kick_analyzer.results

