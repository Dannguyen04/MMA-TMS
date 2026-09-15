"""
extract_motion_features.py — Extract 27-dimensional motion cycle features for all punch and non-punch candidates.
"""

import json
import math
import numpy as np
from pathlib import Path
from typing import List, Dict, Any

from pose_math import (
    KP, Point, calculate_angle, calculate_arm_length,
    calculate_directional_reach_speed, calculate_speed
)

def get_point(lm_dict: dict) -> Point:
    return Point(x=lm_dict.get('x', 0.0), y=lm_dict.get('y', 0.0), conf=lm_dict.get('conf', 1.0))

def extract_cycle_features(
    frames: List[dict],
    start_frame: int,
    impact_frame: int,
    end_frame: int,
    arm: str,
    label: str,
    subtype: str,
    video_name: str,
    cycle_id: str,
    opponent_dist: float = -1.0,
) -> Dict[str, Any]:
    """Extract 27 biomechanical and kinematic features for a single motion cycle."""
    # Find slice of frames
    cycle_frames = [f for f in frames if start_frame <= f['frameIdx'] <= end_frame]
    if not cycle_frames:
        return {}

    sh_idx = KP.LEFT_SHOULDER if arm == "left" else KP.RIGHT_SHOULDER
    el_idx = KP.LEFT_ELBOW if arm == "left" else KP.RIGHT_ELBOW
    wr_idx = KP.LEFT_WRIST if arm == "left" else KP.RIGHT_WRIST
    opp_sh_idx = KP.RIGHT_SHOULDER if arm == "left" else KP.LEFT_SHOULDER
    opp_wr_idx = KP.RIGHT_WRIST if arm == "left" else KP.LEFT_WRIST
    hip_idx = KP.LEFT_HIP if arm == "left" else KP.RIGHT_HIP
    opp_hip_idx = KP.RIGHT_HIP if arm == "left" else KP.LEFT_HIP

    # Timestamps
    t_start = cycle_frames[0]['timeMs']
    t_end = cycle_frames[-1]['timeMs']
    t_impact = t_start
    for f in cycle_frames:
        if f['frameIdx'] == impact_frame:
            t_impact = f['timeMs']
            break

    cycle_dur_ms = max(t_end - t_start, 1.0)
    ext_dur_ms = max(t_impact - t_start, 1.0)
    ret_dur_ms = max(t_end - t_impact, 1.0)

    # Frame-by-frame kinematics
    reaches = []
    dir_speeds = []
    wrist_speeds = []
    elbow_angles = []
    torso_angles = []
    sh_coords = []
    hip_coords = []
    sh_widths = []
    hip_widths = []
    wr_coords = []

    prev_wrist = None
    prev_reach = None
    prev_time = 0.0

    for f in cycle_frames:
        lms = [get_point(p) for p in f['landmarks']]
        if len(lms) < 17:
            continue
        sh = lms[sh_idx]
        el = lms[el_idx]
        wr = lms[wr_idx]
        opp_sh = lms[opp_sh_idx]
        hip = lms[hip_idx]
        opp_hip = lms[opp_hip_idx]

        r = math.dist((wr.x, wr.y), (sh.x, sh.y))
        reaches.append(r)
        wr_coords.append((wr.x, wr.y))
        sh_coords.append((sh.x, sh.y))
        hip_coords.append((hip.x, hip.y))
        sh_widths.append(abs(sh.x - opp_sh.x))
        hip_widths.append(abs(hip.x - opp_hip.x))

        # Elbow angle
        ang = calculate_angle(sh, el, wr)
        elbow_angles.append(ang)

        # Torso inclination angle
        sh_mid_x = (sh.x + opp_sh.x) / 2.0
        sh_mid_y = (sh.y + opp_sh.y) / 2.0
        hip_mid_x = (hip.x + opp_hip.x) / 2.0
        hip_mid_y = (hip.y + opp_hip.y) / 2.0
        dx_torso = abs(sh_mid_x - hip_mid_x)
        dy_torso = hip_mid_y - sh_mid_y
        if dy_torso > 1e-4:
            torso_ang = math.degrees(math.atan2(dx_torso, dy_torso))
        else:
            torso_ang = 90.0 + math.degrees(math.atan2(abs(dy_torso), max(dx_torso, 1e-4)))
        torso_angles.append(torso_ang)

        # Velocities
        cur_t = f['timeMs']
        dt = cur_t - prev_time if prev_time > 0 else 16.67
        if dt <= 0: dt = 16.67
        if prev_reach is not None:
            ds = calculate_directional_reach_speed(prev_reach, r, dt)
            dir_speeds.append(ds)
            ws = calculate_speed(prev_wrist, wr, dt)
            wrist_speeds.append(ws)
        prev_wrist = wr
        prev_reach = r
        prev_time = cur_t

    if not reaches:
        return {}

    start_reach = reaches[0]
    peak_reach = max(reaches)
    delta_reach = max(peak_reach - start_reach, 0.0)

    # Arm length
    lms0 = [get_point(p) for p in cycle_frames[0]['landmarks']]
    arm_len = calculate_arm_length(lms0[sh_idx], lms0[el_idx], lms0[wr_idx])
    if arm_len < 0.10: arm_len = 0.25
    ext_ratio = delta_reach / arm_len

    # Extension velocity and retraction velocity
    peak_dir_v = max(dir_speeds) if dir_speeds else 0.0
    mean_ext_v = (delta_reach / (ext_dur_ms / 1000.0)) if ext_dur_ms > 0 else 0.0

    # Retraction velocity: mean directional speed after peak reach
    peak_idx = reaches.index(peak_reach)
    ret_dir_speeds = dir_speeds[peak_idx:] if peak_idx < len(dir_speeds) else []
    ret_v = float(np.mean(ret_dir_speeds)) if ret_dir_speeds else 0.0

    # Accelerations and Jerk
    accels = []
    if len(wrist_speeds) >= 2:
        for i in range(1, len(wrist_speeds)):
            accels.append(abs(wrist_speeds[i] - wrist_speeds[i-1]) / 0.01667)
    peak_accel = max(accels) if accels else 0.0

    jerks = []
    if len(accels) >= 2:
        for i in range(1, len(accels)):
            jerks.append(abs(accels[i] - accels[i-1]) / 0.01667)
    peak_jerk = max(jerks) if jerks else 0.0

    # Impact dwell: frames where reach >= 95% of peak_reach
    dwell_frames = sum(1 for r in reaches if r >= 0.95 * peak_reach)
    impact_dwell_ms = dwell_frames * 16.67

    # Elbow angles
    elbow_start = elbow_angles[0] if elbow_angles else 0.0
    elbow_peak = max(elbow_angles) if elbow_angles else 0.0
    elbow_delta = elbow_peak - elbow_start

    # Wrist trajectory dx, dy, angle
    wr_start = wr_coords[0]
    wr_peak = wr_coords[peak_idx]
    traj_dx = wr_peak[0] - wr_start[0]
    traj_dy = wr_peak[1] - wr_start[1]
    traj_angle = math.degrees(math.atan2(traj_dy, traj_dx))

    # Shoulder and Hip displacement
    sh_start = sh_coords[0]
    sh_peak = sh_coords[peak_idx]
    sh_disp = math.dist(sh_start, sh_peak)

    hip_start = hip_coords[0]
    hip_peak = hip_coords[peak_idx]
    hip_disp = math.dist(hip_start, hip_peak)

    # Torso angle during extension
    mean_torso_ang = float(np.mean(torso_angles[:peak_idx+1])) if torso_angles[:peak_idx+1] else (torso_angles[0] if torso_angles else 0.0)

    # Shoulder & Hip rotation proxy (delta in horizontal width)
    sh_rot_proxy = abs(sh_widths[peak_idx] - sh_widths[0]) if len(sh_widths) > peak_idx else 0.0
    hip_rot_proxy = abs(hip_widths[peak_idx] - hip_widths[0]) if len(hip_widths) > peak_idx else 0.0

    # Wrist height relative to shoulder at impact (in screen coords, smaller y is higher)
    # wr_height_rel_sh = (sh_y - wr_y): positive means wrist is ABOVE shoulder
    wr_height_rel_sh = sh_coords[peak_idx][1] - wr_coords[peak_idx][1]

    return {
        "cycle_id": cycle_id,
        "video": video_name,
        "label": label,          # "PUNCH" or "NON_PUNCH"
        "subtype": subtype,      # "CROSS", "JAB", "PARRY", "CLINCH", "GESTURE", "WARMUP", "PROBE", "ARM_RAISE"
        "arm": arm,
        "start_frame": start_frame,
        "impact_frame": impact_frame,
        "end_frame": end_frame,
        # 1. Temporal
        "cycle_duration_ms": round(cycle_dur_ms, 1),
        "extension_duration_ms": round(ext_dur_ms, 1),
        "impact_dwell_ms": round(impact_dwell_ms, 1),
        "retraction_duration_ms": round(ret_dur_ms, 1),
        # 2. Kinematic & Reach
        "start_reach": round(start_reach, 4),
        "peak_reach": round(peak_reach, 4),
        "delta_reach": round(delta_reach, 4),
        "extension_ratio": round(ext_ratio, 3),
        # 3. Velocities & Derivatives
        "peak_directional_velocity": round(peak_dir_v, 3),
        "mean_extension_velocity": round(mean_ext_v, 3),
        "retraction_velocity": round(ret_v, 3),
        "peak_acceleration": round(peak_accel, 1),
        "peak_jerk": round(peak_jerk, 1),
        # 4. Elbow geometry
        "elbow_angle_start": round(elbow_start, 1),
        "elbow_angle_peak": round(elbow_peak, 1),
        "elbow_angle_change": round(elbow_delta, 1),
        # 5. Wrist Trajectory
        "wrist_trajectory_dx": round(traj_dx, 4),
        "wrist_trajectory_dy": round(traj_dy, 4),
        "trajectory_angle": round(traj_angle, 1),
        # 6. Torso & Body Mechanics
        "shoulder_displacement": round(sh_disp, 4),
        "hip_displacement": round(hip_disp, 4),
        "torso_angle": round(mean_torso_ang, 1),
        "shoulder_rotation_proxy": round(sh_rot_proxy, 4),
        "hip_rotation_proxy": round(hip_rot_proxy, 4),
        "wrist_height_rel_shoulder": round(wr_height_rel_sh, 4),
        # 7. Context
        "distance_to_opponent": round(opponent_dist, 3),
    }

def main():
    pred_dir = Path("test_results/validation")
    all_cycles = []

    # 1. Heavy bag (vid_01): 5 True Punches, 1 Probe FP
    with open(pred_dir / "pred_01_cross_heavybag.json", encoding="utf-8") as f:
        d1 = json.load(f)
    frames1 = d1["frames"]
    punches1 = d1["punches"]
    # 5 TP punches
    for i, idx in enumerate([0, 1, 2, 3, 5]):
        p = punches1[idx]
        feat = extract_cycle_features(
            frames1, p["startFrame"], p["impactFrame"], p["endFrame"],
            p["arm"], "PUNCH", "CROSS", "vid_01_cross_heavybag.mp4", f"01_tp_cross_{i+1}", opponent_dist=0.35
        )
        all_cycles.append(feat)
    # Probe at 7.05s (punch index 4)
    p_probe = punches1[4]
    all_cycles.append(extract_cycle_features(
        frames1, p_probe["startFrame"], p_probe["impactFrame"], p_probe["endFrame"],
        p_probe["arm"], "NON_PUNCH", "PROBE", "vid_01_cross_heavybag.mp4", "01_fp_probe_1", opponent_dist=0.45
    ))

    # 2. Referee (vid_02): 1 FP gesture
    with open(pred_dir / "pred_02_referee_gestures.json", encoding="utf-8") as f:
        d2 = json.load(f)
    frames2 = d2["frames"]
    p2 = d2["punches"][0]
    all_cycles.append(extract_cycle_features(
        frames2, p2["startFrame"], p2["impactFrame"], p2["endFrame"],
        p2["arm"], "NON_PUNCH", "GESTURE", "vid_02_referee_gestures.mp4", "02_fp_referee_1", opponent_dist=-1.0
    ))

    # 3. Fighter walkout (vid_03): 1 FP warmup
    with open(pred_dir / "pred_03_fighter_walkout.json", encoding="utf-8") as f:
        d3 = json.load(f)
    frames3 = d3["frames"]
    p3 = d3["punches"][0]
    all_cycles.append(extract_cycle_features(
        frames3, p3["startFrame"], p3["impactFrame"], p3["endFrame"],
        p3["arm"], "NON_PUNCH", "WARMUP", "vid_03_fighter_walkout.mp4", "03_fp_warmup_1", opponent_dist=-1.0
    ))

    # 4. Live cage striking (vid_04):
    with open(pred_dir / "pred_04_cage_striking.json", encoding="utf-8") as f:
        d4 = json.load(f)
    frames4 = d4["frames"]
    punches4 = d4["punches"]
    # Cardy Wilson True Punch at frames 48-70 (Ground truth strike)
    all_cycles.append(extract_cycle_features(
        frames4, 48, 59, 70, "left", "PUNCH", "JAB", "vid_04_cage_striking.mp4", "04_gt_cardy_jab", opponent_dist=0.18
    ))
    # Cardy Wilson Delayed Emission (punch 0)
    all_cycles.append(extract_cycle_features(
        frames4, punches4[0]["startFrame"], punches4[0]["impactFrame"], punches4[0]["endFrame"],
        punches4[0]["arm"], "NON_PUNCH", "PARRY", "vid_04_cage_striking.mp4", "04_fp_cardy_delayed", opponent_dist=0.18
    ))
    # vid_04 remaining 7 FPs: clinch / parry
    v4_subtypes = ["CLINCH", "PARRY", "CLINCH", "CLINCH", "PARRY", "CLINCH", "CLINCH"]
    for i, p in enumerate(punches4[1:]):
        st = v4_subtypes[i]
        all_cycles.append(extract_cycle_features(
            frames4, p["startFrame"], p["impactFrame"], p["endFrame"],
            p["arm"], "NON_PUNCH", st, "vid_04_cage_striking.mp4", f"04_fp_{st.lower()}_{i+1}", opponent_dist=0.12
        ))

    # 5. Ground grappling (vid_05): 3 FPs
    with open(pred_dir / "pred_05_ground_grappling.json", encoding="utf-8") as f:
        d5 = json.load(f)
    frames5 = d5["frames"]
    punches5 = d5["punches"]
    v5_subtypes = ["CLINCH", "COLLAR_TIE", "SCRAMBLE"]
    for i, p in enumerate(punches5):
        st = v5_subtypes[i]
        all_cycles.append(extract_cycle_features(
            frames5, p["startFrame"], p["impactFrame"], p["endFrame"],
            p["arm"], "NON_PUNCH", st, "vid_05_ground_grappling.mp4", f"05_fp_{st.lower()}_{i+1}", opponent_dist=0.10
        ))

    # 6. Post-fight celebration (vid_06): 1 FP arm-raising
    with open(pred_dir / "pred_06_post_fight.json", encoding="utf-8") as f:
        d6 = json.load(f)
    frames6 = d6["frames"]
    p6 = d6["punches"][0]
    all_cycles.append(extract_cycle_features(
        frames6, p6["startFrame"], p6["impactFrame"], p6["endFrame"],
        p6["arm"], "NON_PUNCH", "ARM_RAISE", "vid_06_post_fight.mp4", "06_fp_arm_raise_1", opponent_dist=0.25
    ))

    # Save to JSON
    out_file = Path("test_results/motion_cycles_dataset.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(all_cycles, f, indent=2)
    print(f"Extracted {len(all_cycles)} motion cycles -> {out_file}")

    # Print summary table
    print("\n" + "=" * 115)
    print(f"{'cycle_id':<20} | {'label':<9} | {'subtype':<10} | {'dur_ms':<7} | {'ext_r':<6} | {'peak_v':<7} | {'mean_v':<7} | {'el_pk':<6} | {'tr_dx':<7} | {'tr_dy':<7} | {'sh_rot':<7}")
    print("=" * 115)
    for c in all_cycles:
        print(f"{c['cycle_id']:<20} | {c['label']:<9} | {c['subtype']:<10} | {c['cycle_duration_ms']:<7.0f} | {c['extension_ratio']:<6.2f} | {c['peak_directional_velocity']:<7.2f} | {c['mean_extension_velocity']:<7.2f} | {c['elbow_angle_peak']:<6.1f} | {c['wrist_trajectory_dx']:<7.3f} | {c['wrist_trajectory_dy']:<7.3f} | {c['shoulder_rotation_proxy']:<7.3f}")

if __name__ == "__main__":
    main()

