"""Close label pairs (<=240 ms apart): does the pose show one arm-extension or two? Uses shadow accepted+rejected reach peaks (any arm)."""
import sys, json
import os
from common import *
from common import _impact_ms
BENCH = Path(sys.argv[1]); OUT = Path(sys.argv[2]); rows = []
for sc in scopes():
    if sc["pred"] not in ("VIDEO_DATA_002", "VIDEO_DATA_003"): continue
    doc = json.loads((BENCH / f"{sc['pred']}.json").read_text(encoding="utf-8")); fps = doc["meta"]["fps"]
    res, ev = shadow_events(doc)
    g = sorted(sc["gt"], key=lambda e: e.impact_frame)
    for a, b in zip(g, g[1:]):
        gap = _impact_ms(b, fps) - _impact_ms(a, fps)
        if gap > 240: continue
        lo, hi = _impact_ms(a, fps) - 175, _impact_ms(b, fps) + 175
        acc = [(e.side, e.impact_frame) for e in ev if lo <= e.impact_time_ms <= hi]
        rej = [(r["arm"], r["impactFrame"], r["reasonCode"]) for r in res["rejected"] if lo <= r["impactTimeMs"] <= hi]
        rows.append({"scope": sc["scope"], "labels": [a.event_id, b.event_id], "frames": [a.impact_frame, b.impact_frame], "gap_ms": round(gap),
                     "shadow_accepted_in_window": acc, "shadow_rejected_in_window": rej,
                     "arms_with_accepted_peak": sorted({x[0] for x in acc}), "n_accepted": len(acc)})
        print(rows[-1])
OUT.write_text(json.dumps(rows, indent=1), encoding="utf-8")
print("pairs", len(rows), "with <=1 accepted peak:", sum(1 for r in rows if r["n_accepted"] <= 1), "with 0:", sum(1 for r in rows if r["n_accepted"] == 0))
