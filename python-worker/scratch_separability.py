"""
scratch_separability.py — Distribution comparison and feature separability analysis
between PUNCH (N=6) and NON_PUNCH (N=15).
"""

import json
import numpy as np

with open("test_results/motion_cycles_dataset.json", encoding="utf-8") as f:
    dataset = json.load(f)

punches = [c for c in dataset if c["label"] == "PUNCH"]
non_punches = [c for c in dataset if c["label"] == "NON_PUNCH"]

print(f"Total cycles: {len(dataset)} | Punches: {len(punches)} | Non-Punches: {len(non_punches)}")

features_to_analyze = [
    ("cycle_duration_ms", "Cycle Duration (ms)"),
    ("extension_duration_ms", "Extension Duration (ms)"),
    ("impact_dwell_ms", "Impact Dwell (ms)"),
    ("retraction_duration_ms", "Retraction Duration (ms)"),
    ("start_reach", "Start Reach (u)"),
    ("peak_reach", "Peak Reach (u)"),
    ("delta_reach", "Delta Reach (u)"),
    ("extension_ratio", "Extension Ratio"),
    ("peak_directional_velocity", "Peak Dir Velocity (u/s)"),
    ("mean_extension_velocity", "Mean Ext Velocity (u/s)"),
    ("retraction_velocity", "Retraction Velocity (u/s)"),
    ("peak_acceleration", "Peak Acceleration (u/s^2)"),
    ("peak_jerk", "Peak Jerk (u/s^3)"),
    ("elbow_angle_start", "Elbow Angle Start (deg)"),
    ("elbow_angle_peak", "Elbow Angle Peak (deg)"),
    ("elbow_angle_change", "Elbow Angle Change (deg)"),
    ("wrist_trajectory_dx", "Wrist Trajectory DX (u)"),
    ("wrist_trajectory_dy", "Wrist Trajectory DY (u)"),
    ("trajectory_angle", "Trajectory Angle (deg)"),
    ("shoulder_displacement", "Shoulder Disp (u)"),
    ("hip_displacement", "Hip Disp (u)"),
    ("torso_angle", "Torso Angle (deg)"),
    ("shoulder_rotation_proxy", "Shoulder Rotation Proxy (u)"),
    ("hip_rotation_proxy", "Hip Rotation Proxy (u)"),
    ("wrist_height_rel_shoulder", "Wrist Height rel Shoulder (u)"),
    ("distance_to_opponent", "Opponent Distance (u)"),
]

results = []

for feat, label in features_to_analyze:
    p_vals = np.array([c[feat] for c in punches if feat in c])
    np_vals = np.array([c[feat] for c in non_punches if feat in c and c[feat] != -1.0])

    p_mean, p_std = np.mean(p_vals), np.std(p_vals)
    p_min, p_max = np.min(p_vals), np.max(p_vals)
    p_med = np.median(p_vals)

    np_mean, np_std = np.mean(np_vals), np.std(np_vals) if len(np_vals) > 0 else 0.0
    np_min, np_max = np.min(np_vals) if len(np_vals) > 0 else 0.0, np.max(np_vals) if len(np_vals) > 0 else 0.0
    np_med = np.median(np_vals) if len(np_vals) > 0 else 0.0

    # Cohen's d
    pooled_std = np.sqrt(((len(p_vals)-1)*p_std**2 + (len(np_vals)-1)*np_std**2) / max(len(p_vals)+len(np_vals)-2, 1))
    cohen_d = abs(p_mean - np_mean) / pooled_std if pooled_std > 1e-6 else 0.0

    # Overlap check: does [p_min, p_max] overlap with [np_min, np_max]?
    overlap = max(0, min(p_max, np_max) - max(p_min, np_min))
    total_range = max(p_max, np_max) - min(p_min, np_min)
    overlap_ratio = overlap / total_range if total_range > 0 else 1.0

    results.append({
        "feat": feat,
        "name": label,
        "p_mean": p_mean, "p_med": p_med, "p_min": p_min, "p_max": p_max, "p_std": p_std,
        "np_mean": np_mean, "np_med": np_med, "np_min": np_min, "np_max": np_max, "np_std": np_std,
        "cohen_d": cohen_d,
        "overlap_ratio": overlap_ratio,
    })

# Sort by Cohen's d descending
results.sort(key=lambda x: x["cohen_d"], reverse=True)

print("=" * 135)
print(f"{'Feature':<28} | {'Punch Mean (Min..Max)':<25} | {'Non-Punch Mean (Min..Max)':<28} | {'Cohen d':<8} | {'Overlap':<8} | {'Category'}")
print("=" * 135)

for r in results:
    p_str = f"{r['p_mean']:.2f} ({r['p_min']:.2f}..{r['p_max']:.2f})"
    np_str = f"{r['np_mean']:.2f} ({r['np_min']:.2f}..{r['np_max']:.2f})"
    
    # Categorization
    if r['cohen_d'] >= 1.2 and r['overlap_ratio'] < 0.4:
        cat = "HIGHLY DISCRIMINATIVE"
    elif r['cohen_d'] >= 0.8:
        cat = "MODERATE / COMBINABLE"
    elif r['overlap_ratio'] > 0.7:
        cat = "OVERLAPPING"
    else:
        cat = "WEAK / NOISE"

    print(f"{r['name']:<28} | {p_str:<25} | {np_str:<28} | {r['cohen_d']:<8.2f} | {r['overlap_ratio']:<8.2f} | {cat}")

print("\n--- CLINCH & PARRY CANDIDATES ANALYSIS (vid_04 & vid_05) ---")
clinch_parry = [c for c in dataset if c["subtype"] in ("CLINCH", "PARRY", "COLLAR_TIE", "SCRAMBLE")]
print(f"Total Clinch/Parry/Scramble cycles: {len(clinch_parry)}")
for cp in clinch_parry:
    print(f"  * {cp['cycle_id']:<20} ({cp['subtype']:<10}): dx={cp['wrist_trajectory_dx']:+.3f}, dy={cp['wrist_trajectory_dy']:+.3f}, traj_ang={cp['trajectory_angle']:>+6.1f}°, el_pk={cp['elbow_angle_peak']:>5.1f}°, opp_dist={cp['distance_to_opponent']:.2f}")

print("\n--- PROBE AT 7.05s vs TRUE CROSSES (vid_01) ---")
probe = [c for c in dataset if c["subtype"] == "PROBE"][0]
crosses = [c for c in dataset if c["subtype"] == "CROSS"]
print(f"Probe:   dur={probe['cycle_duration_ms']:.0f}ms, ext_dur={probe['extension_duration_ms']:.0f}ms, peak_v={probe['peak_directional_velocity']:.2f}, mean_v={probe['mean_extension_velocity']:.2f}, el_pk={probe['elbow_angle_peak']:.1f}°, sh_rot={probe['shoulder_rotation_proxy']:.3f}, jerk={probe['peak_jerk']:.0f}")
print(f"Crosses: dur_mean={np.mean([c['cycle_duration_ms'] for c in crosses]):.0f}ms, peak_v_mean={np.mean([c['peak_directional_velocity'] for c in crosses]):.2f}, el_pk_mean={np.mean([c['elbow_angle_peak'] for c in crosses]):.1f}°, sh_rot_mean={np.mean([c['shoulder_rotation_proxy'] for c in crosses]):.3f}")

