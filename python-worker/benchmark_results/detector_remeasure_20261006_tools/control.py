"""Chance control for the matcher: TP obtained by content-free predictors on the same GT, at several tolerances.
(a) circularly time-shifted copies of each detector's own predictions (20 shifts of 0.8-6 s), (b) uniform random event times (same N, 500 draws, seed 0).
Tolerance 350 ms is the benchmark's official value; the others are sensitivity only, not a tuning target."""
import sys, json, random, statistics
import os
from common import *
from common import _impact_ms
BENCH = Path(sys.argv[1]); OUT = Path(sys.argv[2])
TOLS = [100.0, 150.0, 200.0, 250.0, 350.0]
rows = []
for sc in scopes():
    if "punch" not in sc["kinds"] or not [e for e in sc["gt"] if e.scope == "in_scope"]: continue
    name = sc["pred"]
    doc = json.loads((BENCH / f"{name}.json").read_text(encoding="utf-8"))
    fps = doc["meta"]["fps"]; dur = doc["meta"]["durationMs"]
    _, lp = load_predictions_doc(doc, ["punch"]); _, sp = shadow_events(doc)
    for det, preds in (("legacy_fsm", lp), ("shadow", sp)):
        if not preds: continue
        for tol in TOLS:
            real = run_eval(sc, preds, fps, tol)
            shifts = []
            for d in [x * 1000 for x in (-6, -5, -4, -3, -2.5, -2, -1.5, -1.2, -1.0, -0.8, 0.8, 1.0, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6)]:
                moved = [Event(event_id=p.event_id, strike_kind="punch", technique="unknown", side="unknown", impact_frame=None,
                               impact_time_ms=(_impact_ms(p, fps) + d) % dur) for p in preds]
                shifts.append(run_eval(sc, moved, fps, tol)["tp"])
            rnd = random.Random(0); tps = []
            for _ in range(500):
                ev = [Event(event_id=f"r{i}", strike_kind="punch", technique="unknown", side="unknown", impact_frame=None,
                            impact_time_ms=rnd.uniform(0, dur)) for i in range(len(preds))]
                tps.append(run_eval(sc, ev, fps, tol)["tp"])
            tps.sort()
            rows.append({"scope": sc["scope"], "detector": det, "tolerance_ms": tol, "n_pred": len(preds),
                         "n_gt": len([e for e in sc["gt"] if e.scope == "in_scope"]), "tp_real": real["tp"], "fp_real": real["fp"], "fn_real": real["fn"],
                         "tp_time_shifted_mean": round(statistics.mean(shifts), 2), "tp_time_shifted_max": max(shifts),
                         "tp_random_mean": round(statistics.mean(tps), 2), "tp_random_p95": tps[int(0.95 * len(tps))], "tp_random_max": tps[-1]})
            print({k: rows[-1][k] for k in ("scope", "detector", "tolerance_ms", "tp_real", "tp_time_shifted_mean", "tp_random_mean", "tp_random_p95")}, flush=True)
OUT.write_text(json.dumps(rows, indent=1), encoding="utf-8")
