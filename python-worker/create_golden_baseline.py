"""
create_golden_baseline.py — Tạo Golden Baseline Snapshots Trước Khi Di Chuyển Logic Task 2

Sinh 2 file snapshot chuẩn hóa:
1. python-worker/ground_truth/golden_punch_fixture.json (chuỗi đấm Cross chuẩn)
2. python-worker/ground_truth/golden_kick_nodetect_fixture.json (chuỗi đá Round Kick + missing detection frames)

Lưu ý:
- Bỏ processedAt, absolute video path và các trường phụ thuộc môi trường.
- Ghi kèm checksum SHA256 để bảo đảm baseline không bị cập nhật âm thầm.
- Không được regenerate golden fixture tự động trong test.
"""

import hashlib
import json
import os
from pathlib import Path
from typing import Optional

from pose_math import (
    KP, Point, EMAState, apply_ema, calculate_angle,
    detect_active_leg, is_landmark_valid, are_landmarks_valid,
    get_angle_color_label, PoseValidityConfig,
)
from kick_analyzer import KickAnalyzer, KickState, KICK_STATE_LABELS
from punch_analyzer import PunchAnalyzer, PunchState, PUNCH_STATE_LABELS
from posture_gate import PostureGate, PostureState
from action_result import build_actions_list


EMA_ALPHA = 0.35


def run_legacy_frame_loop(
    frames_keypoints: list[Optional[list[Point]]],
    fps: float = 30.0,
    model_name: str = "yolov8n-pose",
    stance: str = "unknown",
    video_rel_path: str = "fixtures/deterministic_sequence.mp4",
) -> dict:
    """Chạy chính xác logic của process_video.py hiện tại trên một chuỗi keypoints."""
    ema_states: dict[int, EMAState] = {i: EMAState() for i in range(17)}
    kick_analyzer = KickAnalyzer()
    punch_analyzer = PunchAnalyzer()
    kick_posture_gate = PostureGate()

    frame_records = []
    total_frames = len(frames_keypoints)

    for frame_idx, keypoints in enumerate(frames_keypoints):
        time_ms = (frame_idx / fps) * 1000.0
        is_discontinuous = False

        # 1. Nếu có bước nhảy tọa độ
        if is_discontinuous:
            for s in ema_states.values():
                s.initialized = False
            kick_analyzer.reset_motion()
            kick_posture_gate.reset()

        # 2. EMA Filter
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
            kick_analyzer.update(
                active_leg="none", frame_idx=frame_idx,
                time_ms=time_ms, landmarks_valid=False,
                geometry_valid=False, rejection_reason="NO_DETECTION"
            )
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

        # 3. Tính metrics chân & máy trạng thái đá
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
            hip = filtered_kps[KP.LEFT_HIP]
            knee = filtered_kps[KP.LEFT_KNEE]
            ankle = filtered_kps[KP.LEFT_ANKLE]
            shoulder = filtered_kps[KP.LEFT_SHOULDER]
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
            hip = filtered_kps[KP.RIGHT_HIP]
            knee = filtered_kps[KP.RIGHT_KNEE]
            ankle = filtered_kps[KP.RIGHT_ANKLE]
            shoulder = filtered_kps[KP.RIGHT_SHOULDER]
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

        # 4. Tính metrics tay & máy trạng thái đấm
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

        # 5. Ghi record frame
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

    # 6. Tổng hợp kết quả
    kicks_dicts = [r.to_dict() for r in kick_analyzer.results]
    punches_dicts = [p.to_dict() for p in punch_analyzer.results]

    actions = build_actions_list(
        punches=punch_analyzer.results,
        kicks=kick_analyzer.results,
        stance=stance,
        model_version=model_name,
        rubric_version=None,
    )
    actions_dicts = [a.to_dict() for a in actions]

    all_findings = []
    for p in punch_analyzer.results:
        for f in p.findings:
            all_findings.append(f.to_dict())
    for k in kick_analyzer.results:
        for f in k.findings:
            all_findings.append(f.to_dict())

    all_scores = [p.score for p in punch_analyzer.results] + [k.score for k in kick_analyzer.results]
    avg_score = round(float(sum(all_scores) / len(all_scores)), 1) if all_scores else 0.0
    best_score = max(all_scores) if all_scores else 0

    if len(kick_analyzer.results) > 0 and len(punch_analyzer.results) == 0:
        primary_action = "KICK"
    elif len(punch_analyzer.results) > 0 and len(kick_analyzer.results) == 0:
        primary_action = "PUNCH"
    elif len(kick_analyzer.results) > 0 and len(punch_analyzer.results) > 0:
        primary_action = "MIXED"
    else:
        primary_action = "NONE"

    summary = {
        "totalFrames":      total_frames,
        "totalKicks":       len(kick_analyzer.results),
        "totalPunches":     len(punch_analyzer.results),
        "primaryAction":    primary_action,
        "totalFindings":    len(all_findings),
        "avgScore":         avg_score,
        "bestScore":        best_score,
    }

    # Bỏ processedAt, giữ videoPath dạng relative chuẩn hóa
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


def _make_standing_pose(
    r_elbow=(0.55, 0.45), r_wrist=(0.52, 0.35),
    l_elbow=(0.45, 0.45), l_wrist=(0.48, 0.35),
    r_shoulder=(0.60, 0.35), l_shoulder=(0.40, 0.35),
    r_hip=(0.55, 0.55), l_hip=(0.45, 0.55),
    r_knee=(0.55, 0.72), l_knee=(0.45, 0.72),
    r_ankle=(0.55, 0.90), l_ankle=(0.45, 0.90),
    conf=0.95,
) -> list[Point]:
    kps = [Point(x=0.5, y=0.5, conf=conf) for _ in range(17)]
    kps[KP.NOSE] = Point(x=0.5, y=0.25, conf=conf)
    kps[KP.LEFT_SHOULDER] = Point(x=l_shoulder[0], y=l_shoulder[1], conf=conf)
    kps[KP.RIGHT_SHOULDER] = Point(x=r_shoulder[0], y=r_shoulder[1], conf=conf)
    kps[KP.LEFT_ELBOW] = Point(x=l_elbow[0], y=l_elbow[1], conf=conf)
    kps[KP.LEFT_WRIST] = Point(x=l_wrist[0], y=l_wrist[1], conf=conf)
    kps[KP.RIGHT_ELBOW] = Point(x=r_elbow[0], y=r_elbow[1], conf=conf)
    kps[KP.RIGHT_WRIST] = Point(x=r_wrist[0], y=r_wrist[1], conf=conf)
    kps[KP.LEFT_HIP] = Point(x=l_hip[0], y=l_hip[1], conf=conf)
    kps[KP.RIGHT_HIP] = Point(x=r_hip[0], y=r_hip[1], conf=conf)
    kps[KP.LEFT_KNEE] = Point(x=l_knee[0], y=l_knee[1], conf=conf)
    kps[KP.RIGHT_KNEE] = Point(x=r_knee[0], y=r_knee[1], conf=conf)
    kps[KP.LEFT_ANKLE] = Point(x=l_ankle[0], y=l_ankle[1], conf=conf)
    kps[KP.RIGHT_ANKLE] = Point(x=r_ankle[0], y=r_ankle[1], conf=conf)
    return kps


def generate_punch_sequence() -> list[list[Point]]:
    """Tạo chuỗi 25 frames mô tả một cú Cross tay phải hoàn chỉnh."""
    seq = []
    # Frame 0-4: Guard
    for _ in range(5):
        seq.append(_make_standing_pose(
            r_elbow=(0.62, 0.45), r_wrist=(0.60, 0.35),
            l_elbow=(0.38, 0.45), l_wrist=(0.40, 0.35),
        ))
    # Frame 5-9: Extending
    for _ in range(5):
        seq.append(_make_standing_pose(
            r_elbow=(0.68, 0.42), r_wrist=(0.78, 0.38),
            l_elbow=(0.38, 0.45), l_wrist=(0.40, 0.35),
        ))
    # Frame 10-14: Impact (duỗi thẳng)
    for _ in range(5):
        seq.append(_make_standing_pose(
            r_elbow=(0.75, 0.35), r_wrist=(0.95, 0.35),
            l_elbow=(0.38, 0.45), l_wrist=(0.40, 0.35),
        ))
    # Frame 15-19: Retracting
    for _ in range(5):
        seq.append(_make_standing_pose(
            r_elbow=(0.70, 0.42), r_wrist=(0.78, 0.38),
            l_elbow=(0.38, 0.45), l_wrist=(0.40, 0.35),
        ))
    # Frame 20-24: Trở về Guard
    for _ in range(5):
        seq.append(_make_standing_pose(
            r_elbow=(0.62, 0.45), r_wrist=(0.60, 0.35),
            l_elbow=(0.38, 0.45), l_wrist=(0.40, 0.35),
        ))
    return seq


def generate_kick_nodetect_sequence() -> list[Optional[list[Point]]]:
    """Tạo chuỗi 30 frames mô tả cú đá chân phải hoàn chỉnh + các frame missing detection."""
    seq: list[Optional[list[Point]]] = []
    # Frame 0-4: Đứng thẳng IDLE (knee_angle ~180)
    for _ in range(5):
        seq.append(_make_standing_pose(
            r_knee=(0.55, 0.72), r_ankle=(0.55, 0.90),
        ))
    # Frame 5-9: Rút gối CHAMBERING (gập gối góc nhọn: đùi nâng lên, cẳng chân gập, active_leg=right)
    for _ in range(5):
        seq.append(_make_standing_pose(
            r_knee=(0.60, 0.45), r_ankle=(0.55, 0.46),
        ))
    # Frame 10-14: Bung chân EXTENDING (gối mở dần, ankle vung tới trước, speed > 0.4)
    for _ in range(5):
        seq.append(_make_standing_pose(
            r_knee=(0.65, 0.48), r_ankle=(0.75, 0.45),
        ))
    # Frame 15-19: IMPACT (chân duỗi thẳng)
    for _ in range(5):
        seq.append(_make_standing_pose(
            r_knee=(0.70, 0.45), r_ankle=(0.90, 0.45),
        ))
    # Frame 20-24: RECOVERING (thu chân về < max - 15)
    for _ in range(5):
        seq.append(_make_standing_pose(
            r_knee=(0.60, 0.50), r_ankle=(0.58, 0.55),
        ))
    # Frame 25-29: Missing detection (camera bị che hoặc võ sĩ khuất)
    for _ in range(5):
        seq.append(None)

    return seq


def compute_sha256(data_dict: dict) -> str:
    """Tính SHA256 deterministic của dictionary JSON."""
    raw = json.dumps(data_dict, sort_keys=True, indent=2, ensure_ascii=False)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def main():
    gt_dir = Path("ground_truth")
    gt_dir.mkdir(parents=True, exist_ok=True)

    # 1. Sinh Punch Baseline
    punch_seq = generate_punch_sequence()
    punch_res = run_legacy_frame_loop(punch_seq, fps=30.0, model_name="yolov8n-pose", stance="orthodox", video_rel_path="fixtures/punch_fixture.mp4")
    punch_file = gt_dir / "golden_punch_fixture.json"
    with open(punch_file, "w", encoding="utf-8") as f:
        json.dump(punch_res, f, indent=2, ensure_ascii=False)
    punch_hash = compute_sha256(punch_res)
    print(f"[OK] Created {punch_file}")
    print(f"   * Punches: {len(punch_res['punches'])}, Kicks: {len(punch_res['kicks'])}, Actions: {len(punch_res['actions'])}")
    print(f"   * SHA256: {punch_hash}")

    # 2. Sinh Kick + No-Detect Baseline
    kick_seq = generate_kick_nodetect_sequence()
    kick_res = run_legacy_frame_loop(kick_seq, fps=30.0, model_name="yolov8n-pose", stance="unknown", video_rel_path="fixtures/kick_nodetect_fixture.mp4")
    kick_file = gt_dir / "golden_kick_nodetect_fixture.json"
    with open(kick_file, "w", encoding="utf-8") as f:
        json.dump(kick_res, f, indent=2, ensure_ascii=False)
    kick_hash = compute_sha256(kick_res)
    print(f"[OK] Created {kick_file}")
    print(f"   * Punches: {len(kick_res['punches'])}, Kicks: {len(kick_res['kicks'])}, Actions: {len(kick_res['actions'])}")
    print(f"   * SHA256: {kick_hash}")

    # 3. Ghi file manifest checksum để test verify không bị sửa âm thầm
    manifest = {
        "golden_punch_fixture.json": {
            "sha256": punch_hash,
            "punches": len(punch_res["punches"]),
            "kicks": len(punch_res["kicks"]),
            "actions": len(punch_res["actions"]),
            "frames": len(punch_res["frames"]),
        },
        "golden_kick_nodetect_fixture.json": {
            "sha256": kick_hash,
            "punches": len(kick_res["punches"]),
            "kicks": len(kick_res["kicks"]),
            "actions": len(kick_res["actions"]),
            "frames": len(kick_res["frames"]),
        },
    }
    manifest_file = gt_dir / "golden_baseline_manifest.json"
    with open(manifest_file, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    print(f"[OK] Saved manifest: {manifest_file}")


if __name__ == "__main__":
    main()
