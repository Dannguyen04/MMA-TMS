"""Per-label 2D arm-extension statistics (torso-normalised, aspect-corrected) in +-250 ms around each in-scope punch label.
Descriptive only: shows how large the arm extension is at labelled strikes in each clip."""
import sys, json, statistics, math
import os
from common import *
from pipeline.strike_events import _feature, EventDetectorConfig
from common import _impact_ms
BENCH = Path(sys.argv[1]); OUT = Path(sys.argv[2]); CFG = EventDetectorConfig()
rows = {}
for sc in scopes():
    if "punch" not in sc["kinds"]: continue
    gts = [e for e in sc["gt"] if e.scope == "in_scope"]
    if not gts: continue
    doc = json.loads((BENCH / f"{sc['pred']}.json").read_text(encoding="utf-8")); fr = doc["frames"]; fps = doc["meta"]["fps"]
    asp = doc["meta"]["imgWidth"] / doc["meta"]["imgHeight"]; times = [f["timeMs"] for f in fr]
    per = []
    for g in gts:
        t = _impact_ms(g, fps); idx = [i for i, x in enumerate(times) if abs(x - t) <= 250]
        best = None
        for arm in ("left", "right"):
            if g.side in ("left", "right") and g.side != arm: continue
            vals = []
            for i in idx:
                v, r = _feature(fr[i], arm, CFG, asp)
                if v: vals.append(v["reach"])
            if len(vals) >= 3:
                rng = max(vals) - min(vals)
                if best is None or rng > best["range"]: best = {"arm": arm, "peak": max(vals), "range": rng, "valid_frames": len(vals), "of": len(idx)}
        per.append({"id": g.event_id, "frame": g.impact_frame, **(best or {"arm": None, "peak": None, "range": None})})
    rr = sorted(p["range"] for p in per if p["range"] is not None); pk = sorted(p["peak"] for p in per if p["peak"] is not None)
    q = lambda a, f: round(a[min(len(a) - 1, int(f * len(a)))], 2) if a else None
    rows[sc["scope"]] = {"n_labels": len(gts), "extension_range_torso_q25_med_q75": [q(rr, .25), q(rr, .5), q(rr, .75)],
                         "peak_reach_torso_q25_med_q75": [q(pk, .25), q(pk, .5), q(pk, .75)],
                         "labels_with_range_below_0.18_torso": sum(1 for x in rr if x < 0.18), "labels_with_peak_below_0.65": sum(1 for x in pk if x < 0.65), "per_label": per}
    print(sc["scope"], {k: v for k, v in rows[sc["scope"]].items() if k != "per_label"})
OUT.write_text(json.dumps(rows, indent=1), encoding="utf-8")
