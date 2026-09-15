"""
scratch_cardy_forensics.py — In-depth frame-by-frame forensics of Cardy Wilson's Left Jab at t=0.97s (frames 40-100).
"""

import json
import math
import cv2
from ultralytics import YOLO
from person_tracker import PersonTracker
from posture_gate import PostureGate
from pose_math import (
    KP, Point, EMAState, apply_ema, calculate_angle,
    calculate_arm_length, calculate_directional_reach_speed, calculate_speed
)
from punch_analyzer import SingleArmTracker, PunchDetectorConfig, PunchState

def run_forensics():
    video_path = "validation_videos/vid_04_cage_striking.mp4"
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 59.94

    model = YOLO("yolov8n-pose.pt")
    tracker = PersonTracker(max_missing_frames=15, max_landmark_jump=0.14)
    posture_gate = PostureGate()
    
    cfg = PunchDetectorConfig()
    left_arm_tracker = SingleArmTracker(arm="left", config=cfg)
    
    ema_states = {i: EMAState() for i in range(17)}
    EMA_ALPHA = 0.35

    print("=" * 120)
    print(f"{'frame':<5} | {'t(s)':<6} | {'reach':<7} | {'Δreach':<7} | {'dir_v':<7} | {'w_spd':<7} | {'elbow':<6} | {'state':<10} | {'posture':<10} | {'trk_conf':<8} | {'bbox':<25}")
    print("=" * 120)

    frame_idx = 0
    records = []

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        time_ms = (frame_idx / fps) * 1000.0
        t_s = frame_idx / fps
        h, w = frame.shape[:2]

        results = model(frame, conf=0.5, verbose=False)
        keypoints, is_discontinuous = tracker.update(results, frame_idx=frame_idx, img_w=w, img_h=h)

        if is_discontinuous:
            for s in ema_states.values():
                s.initialized = False
            left_arm_tracker.reset_temporal_derivatives()

        filtered_kps = []
        if keypoints:
            for i, kp in enumerate(keypoints):
                filtered = apply_ema(kp, ema_states[i], EMA_ALPHA)
                filtered_kps.append(filtered)
        else:
            filtered_kps = []

        # Get tracking info
        trk = tracker.target
        trk_conf = round(trk.confidence, 3) if trk else 0.0
        bbox_str = f"[{trk.norm_bbox[0]:.2f},{trk.norm_bbox[1]:.2f},{trk.norm_bbox[2]:.2f},{trk.norm_bbox[3]:.2f}]" if trk else "None"

        # Posture gate
        posture_state, _ = posture_gate.update(filtered_kps) if filtered_kps else ("UNKNOWN", False)
        is_ground = (str(posture_state) == "PostureState.GROUND" or posture_state == "GROUND")

        # Arm tracking
        reach = 0.0
        delta_reach = 0.0
        dir_v = 0.0
        w_spd = 0.0
        elbow_angle = 0.0

        if len(filtered_kps) >= 17:
            sh = filtered_kps[KP.LEFT_SHOULDER]
            el = filtered_kps[KP.LEFT_ELBOW]
            wr = filtered_kps[KP.LEFT_WRIST]
            opp_sh = filtered_kps[KP.RIGHT_SHOULDER]
            opp_wr = filtered_kps[KP.RIGHT_WRIST]

            reach = math.dist((wr.x, wr.y), (sh.x, sh.y))
            elbow_angle = calculate_angle(sh, el, wr)
            arm_len = calculate_arm_length(sh, el, wr)

            dt = time_ms - left_arm_tracker.last_time_ms if left_arm_tracker.last_time_ms > 0 else 16.67
            if dt <= 0: dt = 16.67
            prev_r = left_arm_tracker.prev_reach if left_arm_tracker.prev_reach is not None else reach
            dir_v = calculate_directional_reach_speed(prev_r, reach, dt)
            w_spd = calculate_speed(left_arm_tracker.prev_wrist, wr, dt)

            # Update tracker
            res = left_arm_tracker.update(
                sh, el, wr, opp_sh, opp_wr, frame_idx, time_ms,
                is_discontinuous=is_discontinuous, is_ground=is_ground
            )
            if left_arm_tracker.state == PunchState.EXTENDING:
                delta_reach = reach - left_arm_tracker.start_reach
            elif left_arm_tracker.state in (PunchState.IMPACT, PunchState.RETRACTING):
                delta_reach = left_arm_tracker.max_reach - left_arm_tracker.start_reach

            if res is not None:
                print(f"*** PUNCH DETECTED at frame {frame_idx} (t={t_s:.3f}s): {res} ***")

        if 45 <= frame_idx <= 95:
            row = {
                "frame": frame_idx,
                "timestamp": round(t_s, 3),
                "reach": round(reach, 4),
                "delta_reach": round(delta_reach, 4),
                "directional_velocity": round(dir_v, 3),
                "wrist_speed": round(w_spd, 3),
                "elbow_angle": round(elbow_angle, 1),
                "state": left_arm_tracker.state.name,
                "posture": posture_state.name if hasattr(posture_state, 'name') else str(posture_state),
                "tracking_confidence": trk_conf,
                "bbox": bbox_str
            }
            records.append(row)
            print(f"{frame_idx:<5} | {t_s:<6.3f} | {reach:<7.4f} | {delta_reach:<7.4f} | {dir_v:<7.3f} | {w_spd:<7.3f} | {elbow_angle:<6.1f} | {row['state']:<10} | {row['posture']:<10} | {trk_conf:<8.3f} | {bbox_str:<25}")

        if frame_idx > 100:
            break
        frame_idx += 1

    cap.release()

    with open("test_results/cardy_forensics_frames.json", "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2)
    print(f"\nSaved {len(records)} frames to test_results/cardy_forensics_frames.json")

if __name__ == "__main__":
    run_forensics()
