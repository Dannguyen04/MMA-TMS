"""
process_video.py — YOLO-Pose video processing pipeline

Luồng xử lý:
  1. Nhận đường dẫn video (local hoặc URL)
  2. Dùng YOLOv8-Pose trích xuất landmarks từng frame
  3. Áp dụng EMA filter
  4. Chạy KickAnalyzer qua từng frame
  5. Xuất JSON { frames: [...], kicks: [...], summary: {...} }

Chạy thử:
  python process_video.py --input sample.mp4 --output result.json
  python process_video.py --input sample.mp4 --model yolov8n-pose  # nhanh, CPU
  python process_video.py --input sample.mp4 --model yolov8x-pose  # chính xác, cần GPU
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Optional

import cv2
import numpy as np

try:
    from ultralytics import YOLO
except ImportError:
    print("❌ Chưa cài ultralytics. Chạy: pip install ultralytics", file=sys.stderr)
    sys.exit(1)

try:
    from tqdm import tqdm
    HAS_TQDM = True
except ImportError:
    HAS_TQDM = False

from person_tracker import PersonTracker
from pose_math import Point
from action_result import build_actions_list, RubricSelectionError
from pipeline import (
    ActionPipeline,
    PoseObservation,
    ObservationKind,
    FrameContext,
    StanceContext,
    AnalysisContext,
    MartialArt,
    normalize_stance,
    normalize_martial_art,
    resolve_stance_context,
)
from joint_health_tracker import SessionHealthMonitor, estimate_torso_length


# ─── Cấu hình EMA ───
EMA_ALPHA = 0.35
# Số frame tối thiểu giữa 2 lần detect để tránh spam YOLO (tiết kiệm CPU)
DETECT_EVERY_N_FRAMES = 1  # 1 = mỗi frame; 2 = cách 1 frame


def download_video_if_url(path_or_url: str) -> str:
    """Nếu input là URL, tải về tmp và trả về local path."""
    if path_or_url.startswith(("http://", "https://")):
        import urllib.request
        import tempfile
        import uuid
        tmp_dir = Path(tempfile.gettempdir()) / "martial-arts-worker"
        tmp_dir.mkdir(parents=True, exist_ok=True)
        tmp_path = str(tmp_dir / f"input_{uuid.uuid4().hex[:8]}.mp4")
        print(f"⬇️  Đang tải video từ URL: {path_or_url} -> {tmp_path}")
        urllib.request.urlretrieve(path_or_url, tmp_path)
        return tmp_path
    return path_or_url


def process_video(
    input_path: str,
    model_name: str = "yolov8n-pose",
    output_path: Optional[str] = None,
    conf_threshold: float = 0.5,
    max_frames: Optional[int] = None,
    verbose: bool = True,
    stance: Optional[str] = "unknown",
    coach_stance: Optional[str] = None,
    stance_context: Optional[StanceContext] = None,
    analysis_context: Optional[AnalysisContext] = None,
    martial_art: Optional[str] = None,
) -> dict:
    """
    Pipeline chính: xử lý video và trả về dict kết quả JSON.

    Parameters
    ----------
    input_path    : Đường dẫn video MP4 (local) hoặc URL
    model_name    : Tên model YOLO ('yolov8n-pose', 'yolov8s-pose', 'yolov8x-pose')
    output_path   : Nếu chỉ định, ghi JSON ra file này
    conf_threshold: Ngưỡng confidence tối thiểu để chấp nhận detection
    max_frames    : Giới hạn số frame (dùng để test nhanh)
    verbose       : In tiến trình

    Returns
    -------
    dict với cấu trúc:
    {
      "meta": { videoPath, model, fps, totalFrames, durationMs },
      "frames": [ { frameIdx, timeMs, activeLeg, kneeAngle, hipAngle, speed,
                    kickState, landmarks: [{x,y,conf}, ...] } ],
      "kicks": [ KickResult.to_dict(), ... ],
      "summary": { totalKicks, avgScore, bestScore, bestKickIdx }
    }
    """
    # ── 0. Fail-fast Context & Discipline Verification (Assessment Boundary) ──
    # a. Kiểm tra kiểu dữ liệu analysis_context trước khi truy cập thuộc tính
    if analysis_context is not None and not isinstance(analysis_context, AnalysisContext):
        raise TypeError(
            f"analysis_context must be an AnalysisContext instance or None, got {type(analysis_context).__name__}."
        )

    # b. Kiểm tra kiểu dữ liệu martial_art argument
    if martial_art is not None:
        if isinstance(martial_art, bool) or not isinstance(martial_art, str):
            raise TypeError(
                f"martial_art must be a string or None, got {type(martial_art).__name__}."
            )

    norm_cli_art = normalize_martial_art(martial_art) if martial_art is not None else None

    # c. Xử lý kết hợp analysis_context và martial_art:
    # - Nếu analysis_context.martial_art is None và CLI martial_art được truyền: điền omitted field thay vì báo xung đột
    # - Chỉ báo xung đột ValueError khi cả hai đều non-None và khác nhau
    if analysis_context is not None:
        ctx_art = analysis_context.martial_art
        if ctx_art is not None and norm_cli_art is not None and ctx_art != norm_cli_art:
            raise ValueError(
                f"Conflicting martial_art specification: analysis_context has '{ctx_art}' "
                f"but martial_art argument specifies '{norm_cli_art}'."
            )
        if ctx_art is None and norm_cli_art is not None:
            resolved_analysis_ctx = AnalysisContext(
                martial_art=norm_cli_art,
                training_mode=analysis_context.training_mode,
                camera_view=analysis_context.camera_view,
                target_type=analysis_context.target_type,
                skill_level=analysis_context.skill_level,
                expected_techniques=analysis_context.expected_techniques,
                requested_rubric_version=analysis_context.requested_rubric_version,
            )
        else:
            resolved_analysis_ctx = analysis_context
    elif norm_cli_art is not None:
        resolved_analysis_ctx = AnalysisContext(martial_art=norm_cli_art)
    else:
        resolved_analysis_ctx = None

    # d. Fail-fast trước inference/video loading nếu discipline là unknown hoặc discipline_aware trong Task 4:
    if resolved_analysis_ctx is not None:
        if resolved_analysis_ctx.martial_art == MartialArt.UNKNOWN.value:
            raise RubricSelectionError(
                "Martial art is 'unknown'; cannot select or assess technique without a known martial art discipline."
            )
        if resolved_analysis_ctx.is_discipline_aware():
            raise RubricSelectionError(
                f"Unsupported martial art discipline '{resolved_analysis_ctx.martial_art}' requested. "
                "No discipline-specific evaluator is integrated in Task 4 (only generic legacy evaluators available)."
            )

    # ── 1. Tải model ──
    if verbose:
        print(f"🤖 Đang tải model {model_name}...")
    model = YOLO(model_name)

    # ── 2. Mở video ──
    local_path = download_video_if_url(input_path)
    cap = cv2.VideoCapture(local_path)

    if not cap.isOpened():
        raise ValueError(f"Không thể mở video: {local_path}")

    fps         = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    img_w       = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    img_h       = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    if max_frames:
        total_frames = min(total_frames, max_frames)

    if verbose:
        print(f"📹 Video: {img_w}x{img_h} @ {fps:.1f}fps — {total_frames} frames")

    # ── 3. Khởi tạo state ──
    ema_states: dict[int, EMAState] = {i: EMAState() for i in range(17)}
    kick_analyzer = KickAnalyzer()
    punch_analyzer = PunchAnalyzer()
    kick_posture_gate = PostureGate()
    person_tracker = PersonTracker(max_missing_frames=15, max_landmark_jump=0.14)

    frame_records  = []
    last_keypoints: Optional[list[Point]] = None  # cache frame trước

    iterator = range(total_frames)
    if HAS_TQDM and verbose:
        iterator = tqdm(iterator, desc="Xử lý frame", unit="frame")

    # ── 4. Vòng lặp frame ──
    for frame_idx in iterator:
        ret, frame = cap.read()
        if not ret:
            break

        time_ms = (frame_idx / fps) * 1000.0

        # Chạy YOLO mỗi N frame (hoặc mỗi frame)
        run_detect = (frame_idx % DETECT_EVERY_N_FRAMES == 0)
        keypoints: Optional[list[Point]] = None
        is_discontinuous = False

        if run_detect:
            results = model(frame, conf=conf_threshold, verbose=False)

            # Khóa danh tính đối tượng (Identity Lock) và bảo vệ nhảy toạ độ (Discontinuity Protection)
            keypoints, is_discontinuous = person_tracker.update(
                results, frame_idx=frame_idx, img_w=img_w, img_h=img_h
            )
            if keypoints is not None:
                last_keypoints = keypoints
            else:
                last_keypoints = None
            # Tracker's cached pose is display history, not a new observation.
            if person_tracker.target is not None and person_tracker.target.missing_frames:
                keypoints = None

            observation_kind = (
                ObservationKind.FRESH_DETECTION
                if keypoints is not None
                else ObservationKind.MISSING_DETECTION
            )
        else:
            keypoints = last_keypoints

        # Nếu có bước nhảy toạ độ/đổi người, reinitialize EMA filter để không bị kéo lê toạ độ
        if is_discontinuous:
            for s in ema_states.values():
                s.initialized = False
            kick_analyzer.reset_motion()
            kick_posture_gate.reset()

        # ── 5. EMA Filter ──
        filtered_kps: list[Point] = []
        if keypoints:
            for i, kp in enumerate(keypoints):
                filtered = apply_ema(kp, ema_states[i], EMA_ALPHA)
                filtered_kps.append(filtered)
        else:
            # Không có detection: ghi frame rỗng
            punch_analyzer.reset_temporal_derivatives()
            for s in ema_states.values():
                s.initialized = False
            kick_analyzer.update(active_leg="none", frame_idx=frame_idx,
                                 time_ms=time_ms, landmarks_valid=False,
                                 geometry_valid=False, rejection_reason="NO_DETECTION")
            frame_records.append({
                "frameIdx":             frame_idx,
                "timeMs":               round(time_ms, 1),
                "activeLeg":            "none",
                "kneeAngle":            None,
                "hipAngle":             None,
                "elbowAngleLeft":       None,
                "elbowAngleRight":      None,
                "activeArm":            "none",
                "punchState":           punch_analyzer.state.value,
                "punchStateLabel":      PUNCH_STATE_LABELS[punch_analyzer.state],
                "speed":                0,
                "kickState":            kick_analyzer.state.value,
                "kickStateLabel":       KICK_STATE_LABELS[kick_analyzer.state],
                "kickPreviousState":    kick_analyzer.state.value,
                "kickTransitionReason": "NONE",
                "kickRejectionReason":  "NO_DETECTION",
                "landmarksValid":       False,
                "geometryValid":        False,
                "leftHipConf":          0.0,
                "leftKneeConf":         0.0,
                "leftAnkleConf":        0.0,
                "rightHipConf":         0.0,
                "rightKneeConf":        0.0,
                "rightAnkleConf":       0.0,
                "angleColorLabel":      "none",
                "landmarks":            [],
            })
            continue

        # ── 6. Tính metrics chân & máy trạng thái đá (Phase 2A Validity Gate) ──
        posture, _ = kick_posture_gate.update(filtered_kps)
        if posture == PostureState.GROUND:
            kick_analyzer.reset_motion()
        active_leg = "none" if posture == PostureState.GROUND else detect_active_leg(
            filtered_kps,
            preferred_leg=kick_analyzer.active_leg if kick_analyzer.state != KickState.IDLE else "none",
        )
        prev_kick_state = kick_analyzer.state

        l_hip_conf = round(filtered_kps[KP.LEFT_HIP].conf, 3)
        l_knee_conf = round(filtered_kps[KP.LEFT_KNEE].conf, 3)
        l_ankle_conf = round(filtered_kps[KP.LEFT_ANKLE].conf, 3)
        r_hip_conf = round(filtered_kps[KP.RIGHT_HIP].conf, 3)
        r_knee_conf = round(filtered_kps[KP.RIGHT_KNEE].conf, 3)
        r_ankle_conf = round(filtered_kps[KP.RIGHT_ANKLE].conf, 3)

        pose_config = PoseValidityConfig()
        landmarks_valid = False
        geometry_valid = False
        rejection_reason = "NONE"
        knee_angle: Optional[float] = None
        hip_angle: Optional[float] = None
        active_ankle: Optional[Point] = None

        if active_leg == "left":
            hip_idx, knee_idx, ankle_idx, shoulder_idx = (
                KP.LEFT_HIP, KP.LEFT_KNEE, KP.LEFT_ANKLE, KP.LEFT_SHOULDER
            )
            hip = filtered_kps[hip_idx]
            knee = filtered_kps[knee_idx]
            ankle = filtered_kps[ankle_idx]
            shoulder = filtered_kps[shoulder_idx]
            active_ankle = ankle

            if not are_landmarks_valid([hip, knee, ankle], min_confidence=pose_config.min_landmark_confidence):
                landmarks_valid = False
                geometry_valid = False
                rejection_reason = "INSUFFICIENT_LOWER_BODY_CONFIDENCE"
            else:
                landmarks_valid = True
                knee_angle = calculate_angle(hip, knee, ankle, config=pose_config)
                if knee_angle is None:
                    geometry_valid = False
                    rejection_reason = "DEGENERATE_VECTOR_LENGTH"
                else:
                    geometry_valid = True
                    rejection_reason = "NONE"

                if is_landmark_valid(shoulder, min_confidence=pose_config.min_landmark_confidence):
                    hip_angle = calculate_angle(shoulder, hip, knee, config=pose_config)

        elif active_leg == "right":
            hip_idx, knee_idx, ankle_idx, shoulder_idx = (
                KP.RIGHT_HIP, KP.RIGHT_KNEE, KP.RIGHT_ANKLE, KP.RIGHT_SHOULDER
            )
            hip = filtered_kps[hip_idx]
            knee = filtered_kps[knee_idx]
            ankle = filtered_kps[ankle_idx]
            shoulder = filtered_kps[shoulder_idx]
            active_ankle = ankle

            if not are_landmarks_valid([hip, knee, ankle], min_confidence=pose_config.min_landmark_confidence):
                landmarks_valid = False
                geometry_valid = False
                rejection_reason = "INSUFFICIENT_LOWER_BODY_CONFIDENCE"
            else:
                landmarks_valid = True
                knee_angle = calculate_angle(hip, knee, ankle, config=pose_config)
                if knee_angle is None:
                    geometry_valid = False
                    rejection_reason = "DEGENERATE_VECTOR_LENGTH"
                else:
                    geometry_valid = True
                    rejection_reason = "NONE"

                if is_landmark_valid(shoulder, min_confidence=pose_config.min_landmark_confidence):
                    hip_angle = calculate_angle(shoulder, hip, knee, config=pose_config)

        else:
            # active_leg == "none": tuyệt đối không rơi vào chân phải (Root Cause 1)
            landmarks_valid = False
            geometry_valid = False
            max_leg_conf = max(l_ankle_conf, r_ankle_conf, l_knee_conf, r_knee_conf)
            if max_leg_conf < pose_config.min_landmark_confidence:
                rejection_reason = "INSUFFICIENT_LOWER_BODY_CONFIDENCE"
            else:
                rejection_reason = "ACTIVE_LEG_NONE"

        kick_result = kick_analyzer.update(
            knee_angle=knee_angle,
            hip_angle=hip_angle,
            ankle=active_ankle,
            frame_idx=frame_idx,
            time_ms=time_ms,
            active_leg=active_leg,
            landmarks_valid=landmarks_valid,
            geometry_valid=geometry_valid,
            rejection_reason=rejection_reason,
        )

        # ── 7. Tính metrics tay & máy trạng thái đấm ──
        l_sh = filtered_kps[KP.LEFT_SHOULDER]
        r_sh = filtered_kps[KP.RIGHT_SHOULDER]
        l_el = filtered_kps[KP.LEFT_ELBOW]
        r_el = filtered_kps[KP.RIGHT_ELBOW]
        l_wr = filtered_kps[KP.LEFT_WRIST]
        r_wr = filtered_kps[KP.RIGHT_WRIST]

        l_elbow_angle = calculate_angle(l_sh, l_el, l_wr, min_confidence=0.25) if min(l_sh.conf, l_el.conf, l_wr.conf) > 0.25 else 75.0
        r_elbow_angle = calculate_angle(r_sh, r_el, r_wr, min_confidence=0.25) if min(r_sh.conf, r_el.conf, r_wr.conf) > 0.25 else 75.0
        if l_elbow_angle is None:
            l_elbow_angle = 75.0
        if r_elbow_angle is None:
            r_elbow_angle = 75.0

        punch_result = punch_analyzer.update(
            keypoints=filtered_kps,
            frame_idx=frame_idx,
            time_ms=time_ms,
            is_discontinuous=is_discontinuous,
        )

        # ── 8. Ghi record frame ──
        frame_records.append({
            "frameIdx":             frame_idx,
            "timeMs":               round(time_ms, 1),
            "isDiscontinuous":      is_discontinuous,
            "activeLeg":            active_leg,
            "kneeAngle":            round(knee_angle, 1) if knee_angle is not None else None,
            "hipAngle":             round(hip_angle, 1) if hip_angle is not None else None,
            "elbowAngleLeft":       round(l_elbow_angle, 1) if l_elbow_angle is not None else None,
            "elbowAngleRight":      round(r_elbow_angle, 1) if r_elbow_angle is not None else None,
            "activeArm":            punch_analyzer.active_arm,
            "punchState":           punch_analyzer.state.value,
            "punchStateLabel":      PUNCH_STATE_LABELS[punch_analyzer.state],
            "kickState":            kick_analyzer.state.value,
            "kickStateLabel":       KICK_STATE_LABELS[kick_analyzer.state],
            "kickPreviousState":    prev_kick_state.value,
            "kickTransitionReason": kick_analyzer.last_transition_reason,
            "kickRejectionReason":  kick_analyzer.last_rejection_reason if not (landmarks_valid and geometry_valid) else "NONE",
            "landmarksValid":       landmarks_valid,
            "geometryValid":        geometry_valid,
            "leftHipConf":          l_hip_conf,
            "leftKneeConf":         l_knee_conf,
            "leftAnkleConf":        l_ankle_conf,
            "rightHipConf":         r_hip_conf,
            "rightKneeConf":        r_knee_conf,
            "rightAnkleConf":       r_ankle_conf,
            "angleColorLabel":      get_angle_color_label(knee_angle),
            "landmarks": [
                {"x": round(p.x, 4), "y": round(p.y, 4), "conf": round(p.conf, 3)}
                for p in filtered_kps
            ],
        })

        last_time_ms = time_ms

    cap.release()

    # Dọn dẹp video tạm tải từ URL để giải phóng ổ đĩa
    if local_path != input_path and os.path.exists(local_path):
        try:
            os.remove(local_path)
            if verbose:
                print(f"🧹 Đã xóa file video tạm: {local_path}")
        except Exception:
            pass

    # ── 9. Tổng hợp kết quả (Actions, Kicks, Punches, Findings) ──
    punches, kicks = action_pipeline.get_results()
    kicks_dicts   = [r.to_dict() for r in kicks]
    punches_dicts = [p.to_dict() for p in punches]

    # Phân giải StanceContext:
    # 1. Nếu có stance_context trực tiếp: ưu tiên sử dụng.
    # 2. Ngược lại, phân giải từ coach_stance và stance (user-declared):
    #    Chỉ coi stance là user-declared khi giá trị hợp lệ và khác "unknown".
    if stance_context is not None:
        resolved_stance_ctx = stance_context
    else:
        user_declared_arg = (
            stance if (stance is not None and normalize_stance(stance) != "unknown") else None
        )
        resolved_stance_ctx = resolve_stance_context(
            coach_stance=coach_stance,
            user_stance=user_declared_arg,
        )

    # resolved_analysis_ctx đã được xác minh fail-fast tại step 0 (assessment boundary)

    actions = build_actions_list(
        punches=punches,
        kicks=kicks,
        stance=resolved_stance_ctx.resolved_stance,
        model_version=model_name,
        rubric_version=None,
        stance_context=resolved_stance_ctx,
        analysis_context=resolved_analysis_ctx,
        keypoints_trajectory=frame_records,
        fps=fps,
    )
    actions_dicts = [a.to_dict() for a in actions]

    all_findings = []
    for p in punches:
        for f in p.findings:
            all_findings.append(f.to_dict())
    for k in kicks:
        for f in k.findings:
            all_findings.append(f.to_dict())

    # Sắp xếp findings theo thứ tự thời gian xuất hiện trong video
    all_findings.sort(key=lambda x: (x.get("timeMs", 0.0), x.get("frameIdx", 0)))

    all_scores = [r.score for r in kicks] + [p.score for p in punches]
    total_punches = len(punches)
    total_kicks   = len(kicks)

    if total_punches > total_kicks:
        primary_action = "punch"
    elif total_kicks > total_punches:
        primary_action = "kick"
    else:
        primary_action = "mixed" if (total_punches > 0) else "idle"

    # ── Anomaly Detection: thu thập tất cả alerts đã xác nhận ──
    confirmed_alerts = [a.to_dict() for a in health_monitor.get_confirmed_alerts()]
    joint_states     = health_monitor.get_joint_states()

    summary = {
        "totalKicks":    total_kicks,
        "totalPunches":  total_punches,
        "primaryAction": primary_action,
        "avgScore":      round(sum(all_scores) / len(all_scores), 1) if all_scores else 0,
        "bestScore":     max(all_scores) if all_scores else 0,
        "bestKickIdx":   [r.score for r in kick_analyzer.results].index(max([r.score for r in kick_analyzer.results])) if kick_analyzer.results else -1,
        "bestPunchIdx":  [p.score for p in punch_analyzer.results].index(max([p.score for p in punch_analyzer.results])) if punch_analyzer.results else -1,
    }

    output = {
        "schemaVersion":  "1.0.0",
        "meta": {
            "videoPath":      input_path,
            "model":          model_name,
            "scoringVersion": "rubric-v3.0.0",
            "fps":            round(fps, 2),
            "totalFrames":    len(frame_records),
            "durationMs":     round((len(frame_records) / fps) * 1000, 1),
            "imgWidth":       img_w,
            "imgHeight":      img_h,
            "processedAt":    time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        },
        "frames":   frame_records,
        "kicks":    kicks_dicts,
        "punches":  punches_dicts,
        "findings": all_findings,
        "summary":  summary,
    }

    # ── 10. Xuất file JSON ──
    if output_path:
        out_file = Path(output_path)
        out_file.parent.mkdir(parents=True, exist_ok=True)
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False, indent=2)
        if verbose:
            print(f"\n✅ Đã lưu kết quả: {out_file}")

    if verbose:
        print(f"\n📊 Tổng kết:")
        print(f"   • Frames: {len(frame_records)}")
        print(f"   • Hành động chính: {summary['primaryAction'].upper()}")
        print(f"   • Cú đấm phát hiện: {summary['totalPunches']}")
        print(f"   • Cú đá phát hiện: {summary['totalKicks']}")
        print(f"   • AI Technique Findings: {len(all_findings)}")
        if all_scores:
            print(f"   • Điểm trung bình: {summary['avgScore']}")
            print(f"   • Điểm cao nhất: {summary['bestScore']}")
        if confirmed_alerts:
            print(f"   ⚠️  Health Alerts (CONFIRMED_IMPAIRMENT): {len(confirmed_alerts)}")
            for a in confirmed_alerts:
                print(f"      – {a['joint']}: avg_ROM={a['avgRomRatio']:.0%}, severity={a['severity']}")
        else:
            print(f"   ✅ Không phát hiện dấu hiệu chấn thương cơ học")

    return output


def _select_main_person(yolo_results) -> Optional[np.ndarray]:
    """
    Từ output của YOLO, chọn người có bounding box diện tích lớn nhất.
    Trả về mảng keypoints [[x,y,conf], ...] của người đó.
    """
    best_area = 0
    best_kps  = None

    for result in yolo_results:
        if result.keypoints is None:
            continue
        boxes    = result.boxes
        keypoints = result.keypoints

        for i in range(len(boxes)):
            box = boxes[i].xyxy[0].tolist()  # [x1, y1, x2, y2]
            area = (box[2] - box[0]) * (box[3] - box[1])
            if area > best_area:
                best_area = area
                # keypoints.data shape: [N_persons, 17, 3]
                best_kps = keypoints.data[i].cpu().numpy()  # [17, 3]

    return best_kps


# ─── CLI entry point ───
if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Phân tích kỹ thuật võ thuật từ video dùng YOLO-Pose"
    )
    parser.add_argument("--input",  "-i", required=True,
                        help="Đường dẫn video MP4 hoặc URL")
    parser.add_argument("--output", "-o", default="result.json",
                        help="File JSON output (mặc định: result.json)")
    parser.add_argument("--model",  "-m", default="yolov8n-pose",
                        choices=["yolov8n-pose", "yolov8s-pose", "yolov8m-pose",
                                 "yolov8l-pose", "yolov8x-pose"],
                        help="Model YOLO-Pose (n=nhanh/CPU, x=chính xác/GPU)")
    parser.add_argument("--conf",   "-c", type=float, default=0.5,
                        help="Ngưỡng confidence (0–1, mặc định: 0.5)")
    parser.add_argument("--max-frames", type=int, default=None,
                        help="Giới hạn số frame (dùng để test nhanh)")
    parser.add_argument("--stance", default=None,
                        choices=["orthodox", "southpaw", "switch", "unknown"],
                        help="Thế thủ võ sĩ do user khai báo (mặc định: None -> unknown)")
    parser.add_argument("--coach-stance", default=None,
                        choices=["orthodox", "southpaw", "switch", "unknown"],
                        help="Thế thủ võ sĩ do HLV xác nhận (ưu tiên cao hơn --stance)")
    parser.add_argument("--martial-art", default=None,
                        choices=["boxing", "muay_thai", "kickboxing", "karate", "taekwondo", "mma", "generic", "unknown"],
                        help="Môn võ phân tích (mặc định: None -> generic)")

    args = parser.parse_args()

    try:
        process_video(
            input_path=args.input,
            model_name=args.model,
            output_path=args.output,
            conf_threshold=args.conf,
            max_frames=args.max_frames,
            stance=args.stance,
            coach_stance=args.coach_stance,
            martial_art=args.martial_art,
        )
    except KeyboardInterrupt:
        print("\n⛔ Đã dừng.")
    except Exception as e:
        print(f"❌ Lỗi: {e}", file=sys.stderr)
        raise
