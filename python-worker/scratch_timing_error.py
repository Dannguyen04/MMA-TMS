"""
scratch_timing_error.py — Measure systematic timing error across correctly detected punches.
"""

import json
import numpy as np

with open('ground_truth/gt_01_cross_heavybag.json', encoding='utf-8') as f:
    gt = json.load(f)
with open('test_results/validation/pred_01_cross_heavybag.json', encoding='utf-8') as f:
    pred = json.load(f)

gt_punches = [e for e in gt['events'] if e.get('label') == 'PUNCH' and e.get('evaluation_scope') == 'IN_SCOPE']
pred_punches = pred['punches']

matches = []
for p in pred_punches:
    p_impact = p['impactTimeMs'] / 1000.0
    p_end = p['endTimeMs'] / 1000.0
    p_arm = p['arm']
    for g in gt_punches:
        g_peak = g['peak_time']
        g_arm = g['arm']
        if p_arm == g_arm and abs(p_impact - g_peak) <= 0.35:
            err = p_impact - g_peak
            emission_delay = p_end - g_peak
            matches.append({
                'gt_id': g['id'],
                'desc': g['description'],
                'gt_impact': g_peak,
                'det_impact': p_impact,
                'det_emission': p_end,
                'impact_err': err,
                'emission_delay': emission_delay,
                'gt_frame': g['impact_frame'],
                'det_frame': p['impactFrame'],
                'det_end_frame': p['endFrame'],
            })
            break

print('=' * 95)
print(f"| {'ID':<3} | {'GT Peak (s)':<12} | {'Det Impact (s)':<15} | {'Error (s)':<10} | {'Det Emission(s)':<16} | {'Emission Delay':<15} |")
print('=' * 95)
errors = []
delays = []
for m in matches:
    print(f"| {m['gt_id']:02d}  | {m['gt_impact']:>12.3f} | {m['det_impact']:>15.3f} | {m['impact_err']:>+10.3f} | {m['det_emission']:>16.3f} | {m['emission_delay']:>+15.3f} |")
    errors.append(m['impact_err'])
    delays.append(m['emission_delay'])

errors = np.array(errors)
delays = np.array(delays)

print('=' * 95)
print('SYSTEMATIC TIMING ERROR METRICS (det_impact - gt_impact):')
print(f'  * Mean Error:      {np.mean(errors):+.4f} s ({np.mean(errors)*1000:+.1f} ms)')
print(f'  * Median Error:    {np.median(errors):+.4f} s ({np.median(errors)*1000:+.1f} ms)')
print(f'  * Min Error:       {np.min(errors):+.4f} s ({np.min(errors)*1000:+.1f} ms)')
print(f'  * Max Error:       {np.max(errors):+.4f} s ({np.max(errors)*1000:+.1f} ms)')
print(f'  * Std Deviation:   {np.std(errors):.4f} s ({np.std(errors)*1000:.1f} ms)')

print('\nEVENT EMISSION LATENCY METRICS (det_emission - gt_impact):')
print(f'  * Mean Delay:      {np.mean(delays):+.4f} s ({np.mean(delays)*1000:+.1f} ms)')
print(f'  * Median Delay:    {np.median(delays):+.4f} s ({np.median(delays)*1000:+.1f} ms)')
print(f'  * Min Delay:       {np.min(delays):+.4f} s ({np.min(delays)*1000:+.1f} ms)')
print(f'  * Max Delay:       {np.max(delays):+.4f} s ({np.max(delays)*1000:+.1f} ms)')
print(f'  * Std Deviation:   {np.std(delays):.4f} s ({np.std(delays)*1000:.1f} ms)')

