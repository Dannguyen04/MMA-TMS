"""EXPLORATORY COUNTERFACTUAL (not a detector change, not a tuned result).
Single factor: feed the unchanged legacy FSM image-isotropic x (x * width/height) instead of normalised x in [0,1].
No threshold is touched. Pose is replayed from exported (already EMA-smoothed) landmarks. Run on the same dev labels, so it can only
indicate WHERE the problem is; it is not evidence of an improvement (needs an untouched held-out set)."""
import sys, json, copy
import os
from common import *
from replay_strikes import replay
BENCH = Path(sys.argv[1]); OUT = Path(sys.argv[2])
rows = []; cache = {}
for sc in scopes():
    if "punch" not in sc["kinds"]: continue
    name = sc["pred"]
    if name not in cache:
        doc = json.loads((BENCH / f"{name}.json").read_text(encoding="utf-8"))
        asp = doc["meta"]["imgWidth"] / doc["meta"]["imgHeight"]
        d2 = {"meta": dict(doc["meta"]), "frames": copy.deepcopy(doc["frames"])}
        for f in d2["frames"]:
            for p in f.get("landmarks", []): p["x"] = p["x"] * asp
        cache[name] = (doc, replay(d2), asp)
    doc, res, asp = cache[name]
    fps = doc["meta"]["fps"]
    base = run_eval(sc, load_predictions_doc(doc, ["punch"])[1], fps)
    cf = run_eval(sc, load_predictions_doc(res, ["punch"])[1], fps)
    rows.append({"scope": sc["scope"], "aspect": round(asp, 3), "gt": len([e for e in sc["gt"] if e.scope == "in_scope"]),
                 "baseline": {k: base[k] for k in ("tp", "fp", "fn")}, "isotropic_x": {k: cf[k] for k in ("tp", "fp", "fn")}})
    print(rows[-1])
tot = lambda key: {k: sum(r[key][k] for r in rows) for k in ("tp", "fp", "fn")}
summary = {"baseline_punch": tot("baseline"), "isotropic_x_punch": tot("isotropic_x")}
print(summary)
OUT.write_text(json.dumps({"rows": rows, "summary": summary}, indent=1), encoding="utf-8")
