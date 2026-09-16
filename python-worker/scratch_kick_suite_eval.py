import json
import glob
from pathlib import Path
from pose_math import (
    KP, Point, PoseValidityConfig, calculate_angle,
    detect_active_leg, is_landmark_valid, are_landmarks_valid,
)
from kick_analyzer import KickAnalyzer

pose_config = PoseValidityConfig()

validation_files = sorted(glob.glob('test_results/validation/pred_*.json'))
print('=== VALIDATION SUITE KICK COMPARISON (BEFORE vs AFTER PHASE 2A) ===')
header = f"{'Video':<30} | {'GT':>3} | {'Before':>6} | {'After':>6} | {'Delta':>6} | {'Notes'}"
print(header)
print('-' * 85)

total_before = 0
total_after = 0

for v_path in validation_files:
    v_name = Path(v_path).stem.replace('pred_', '') + '.mp4'
    with open(v_path, encoding='utf-8') as f:
        d = json.load(f)
    
    before_kicks = len(d.get('kicks', []))
    total_before += before_kicks

    frames = d.get('frames', [])
    analyzer = KickAnalyzer(max_consecutive_invalid_frames=2)

    for fr in frames:
        f_idx = fr['frameIdx']
        t_ms = fr['timeMs']
        raw_lms = fr.get('landmarks', [])
        if not raw_lms:
            analyzer.update(
                knee_angle=None, hip_angle=None, ankle=None,
                frame_idx=f_idx, time_ms=t_ms, active_leg='none',
                landmarks_valid=False, geometry_valid=False,
                rejection_reason='NO_DETECTION'
            )
            continue

        kps = [Point(p['x'], p['y'], p['conf']) for p in raw_lms]
        active_leg = detect_active_leg(kps)
        
        l_hip_conf = kps[KP.LEFT_HIP].conf
        l_knee_conf = kps[KP.LEFT_KNEE].conf
        l_ankle_conf = kps[KP.LEFT_ANKLE].conf
        r_hip_conf = kps[KP.RIGHT_HIP].conf
        r_knee_conf = kps[KP.RIGHT_KNEE].conf
        r_ankle_conf = kps[KP.RIGHT_ANKLE].conf

        landmarks_valid = False
        geometry_valid = False
        rejection_reason = 'NONE'
        knee_angle = None
        hip_angle = None
        active_ankle = None

        if active_leg == 'left':
            hip, knee, ankle, shoulder = kps[KP.LEFT_HIP], kps[KP.LEFT_KNEE], kps[KP.LEFT_ANKLE], kps[KP.LEFT_SHOULDER]
            active_ankle = ankle
            if not are_landmarks_valid([hip, knee, ankle], min_confidence=pose_config.min_landmark_confidence):
                rejection_reason = 'INSUFFICIENT_LOWER_BODY_CONFIDENCE'
            else:
                landmarks_valid = True
                knee_angle = calculate_angle(hip, knee, ankle, config=pose_config)
                if knee_angle is None:
                    rejection_reason = 'DEGENERATE_VECTOR_LENGTH'
                else:
                    geometry_valid = True
                if is_landmark_valid(shoulder, min_confidence=pose_config.min_landmark_confidence):
                    hip_angle = calculate_angle(shoulder, hip, knee, config=pose_config)
        elif active_leg == 'right':
            hip, knee, ankle, shoulder = kps[KP.RIGHT_HIP], kps[KP.RIGHT_KNEE], kps[KP.RIGHT_ANKLE], kps[KP.RIGHT_SHOULDER]
            active_ankle = ankle
            if not are_landmarks_valid([hip, knee, ankle], min_confidence=pose_config.min_landmark_confidence):
                rejection_reason = 'INSUFFICIENT_LOWER_BODY_CONFIDENCE'
            else:
                landmarks_valid = True
                knee_angle = calculate_angle(hip, knee, ankle, config=pose_config)
                if knee_angle is None:
                    rejection_reason = 'DEGENERATE_VECTOR_LENGTH'
                else:
                    geometry_valid = True
                if is_landmark_valid(shoulder, min_confidence=pose_config.min_landmark_confidence):
                    hip_angle = calculate_angle(shoulder, hip, knee, config=pose_config)
        else:
            max_leg = max(l_ankle_conf, r_ankle_conf, l_knee_conf, r_knee_conf)
            if max_leg < pose_config.min_landmark_confidence:
                rejection_reason = 'INSUFFICIENT_LOWER_BODY_CONFIDENCE'
            else:
                rejection_reason = 'ACTIVE_LEG_NONE'

        analyzer.update(
            knee_angle=knee_angle,
            hip_angle=hip_angle,
            ankle=active_ankle,
            frame_idx=f_idx,
            time_ms=t_ms,
            active_leg=active_leg,
            landmarks_valid=landmarks_valid,
            geometry_valid=geometry_valid,
            rejection_reason=rejection_reason,
        )

    after_kicks = len(analyzer.results)
    total_after += after_kicks
    delta = after_kicks - before_kicks
    print(f"{v_name:<30} | {0:>3} | {before_kicks:>6} | {after_kicks:>6} | {delta:>+6} | FP suppressed: {before_kicks - after_kicks}")

print('-' * 85)
print(f"{'TOTAL':<30} | {0:>3} | {total_before:>6} | {total_after:>6} | {total_after - total_before:>+6} | Total FP suppressed: {total_before - total_after}")

