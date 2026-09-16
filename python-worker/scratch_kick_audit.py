import json
from pose_math import KP, calculate_angle, Point

with open('test_results/video_002_output.json', encoding='utf-8') as f:
    data = json.load(f)

frames = data['frames']
kicks = data['kicks']

print(f"Total kicks detected: {len(kicks)}")

print("\n=== 8 KICKS TRACE AUDIT ===")
for i, k in enumerate(kicks):
    sf = k['startFrame']
    ef = k['endFrame']
    cf = k.get('chamberPeakFrame', sf)
    imf = k.get('impactFrame', ef)
    
    state_seq = []
    ext_frame = None
    rec_frame = None
    for f_idx in range(sf, ef + 1):
        st = frames[f_idx]['kickState']
        if not state_seq or state_seq[-1][0] != st:
            state_seq.append((st, f_idx))
        if st == 'extending' and ext_frame is None:
            ext_frame = f_idx
        if st == 'recovering' and rec_frame is None:
            rec_frame = f_idx
            
    seq_str = " -> ".join([f"{st} (f={f})" for st, f in state_seq])
    print(f"\nKick kick_{i+1}:")
    print(f"  startFrame:      {sf}")
    print(f"  chamberFrame:    {cf}")
    print(f"  extensionFrame:  {ext_frame}")
    print(f"  impactFrame:     {imf}")
    print(f"  recoveryFrame:   {rec_frame}")
    print(f"  endFrame:        {ef}")
    print(f"  activeLeg:       {k.get('activeLeg')}")
    print(f"  peakVelocity:    {k.get('peakSpeed')}")
    print(f"  minKneeAngle:    {k.get('minChamberAngle')}°")
    print(f"  maxKneeAngle:    {k.get('maxExtensionAngle')}°")
    print(f"  transition seq:  {seq_str}")
    
    for f_idx in range(max(0, sf - 1), min(len(frames), ef + 2)):
        fr = frames[f_idx]
        lm = fr['landmarks']
        r_hip = lm[KP.RIGHT_HIP]
        r_knee = lm[KP.RIGHT_KNEE]
        r_ankle = lm[KP.RIGHT_ANKLE]
        
        speed = 0.0
        if f_idx > 0:
            prev_lm = frames[f_idx - 1]['landmarks']
            prev_a = prev_lm[KP.RIGHT_ANKLE]
            dx = r_ankle['x'] - prev_a['x']
            dy = r_ankle['y'] - prev_a['y']
            dt_s = (fr['timeMs'] - frames[f_idx - 1]['timeMs']) / 1000.0
            if dt_s > 0:
                speed = ((dx*dx + dy*dy)**0.5) / dt_s

        print(
            f"f={fr['frameIdx']:03d} t={fr['timeMs']:6.1f}ms "
            f"st={fr['kickState']:10s} "
            f"kneeAng={fr['kneeAngle']:5.1f}° "
            f"spd={speed:5.2f}u/s "
            f"leg={fr['activeLeg']:4s} | "
            f"R_conf: H={r_hip['conf']:.2f}, K={r_knee['conf']:.2f}, A={r_ankle['conf']:.2f}"
        )
