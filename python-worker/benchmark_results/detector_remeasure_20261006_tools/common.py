"""Shared helpers: scopes, prediction loading (legacy FSM + shadow), evaluation with the repo's matcher."""
import sys, os, json
from pathlib import Path
SRC = Path(os.environ.get("DETECTOR_SRC", Path(__file__).resolve().parent / "src"))
if str(SRC) not in sys.path: sys.path.insert(0, str(SRC))
os.chdir(SRC)
from strike_benchmark import (Event, _normalise_event, evaluate_events, load_ground_truth, load_predictions, _metrics, _impact_ms)
from pipeline.strike_events import detect_punch_events
GT = SRC / "ground_truth"
LEGACY = ["01_cross_heavybag", "02_referee_gestures", "03_fighter_walkout", "04_cage_striking", "05_ground_grappling", "06_post_fight"]
EXTRA = [("VIDEO_DATA_002", "gt_punch_002_visual.json"), ("VIDEO_DATA_003", "gt_punch_003_visual.json"),
         ("VIDEO_DATA_005", "gt_kick_005_mixed_heavybag.json"), ("vid_04_cage_striking", "gt_kick_04_cage_visual.json"),
         ("vid_05_ground_grappling", "gt_kick_05_ground_control.json")]

def scopes():
    out = []
    for n in LEGACY:
        doc = json.loads((GT / f"gt_{n}.json").read_text(encoding="utf-8"))
        allev = [_normalise_event(e, i, prediction=False) for i, e in enumerate(doc["events"]) if e.get("label", "PUNCH") == "PUNCH"]
        non = [e for e in doc["events"] if e.get("label", "PUNCH") != "PUNCH" or str(e.get("evaluation_scope", "IN_SCOPE")).upper() != "IN_SCOPE"]
        out.append(dict(scope=f"vid_{n}:punch", pred=f"vid_{n}", kinds=["punch"], gt=allev, raw=doc["events"], excluded=non, gtfile=f"gt_{n}.json"))
    for name, fn in EXTRA:
        doc, gt = load_ground_truth(GT / fn)
        kinds = doc.get("evaluated_kinds", ["punch", "kick"])
        out.append(dict(scope=f"{name}:{'+'.join(kinds)}", pred=name, kinds=kinds, gt=[e for e in gt if e.strike_kind in kinds], raw=doc["events"], excluded=[], gtfile=fn))
    return out

def legacy_events(pred_doc, kinds):
    _, ev = load_predictions_doc(pred_doc, kinds)
    return ev

def load_predictions_doc(doc, kinds):
    raw = [item for kind, key in (("punch", "punches"), ("kick", "kicks")) if kind in kinds for item in doc.get(key, [])]
    return doc, [_normalise_event(item, i, prediction=True) for i, item in enumerate(raw)]

def shadow_events(doc, mode="diagnostic_stress"):
    m = doc["meta"]
    res = detect_punch_events(doc["frames"], m["fps"], training_mode=mode, aspect=m["imgWidth"] / m["imgHeight"])
    ev = [Event(event_id=e["id"], strike_kind="punch", technique="unknown", side=e["side"], impact_frame=e["impactFrame"],
                impact_time_ms=e["impactTimeMs"], raw=e) for e in res["events"]]
    return res, ev

def run_eval(sc, preds, fps, tol=350.0):
    r = evaluate_events(sc["gt"], [p for p in preds if p.strike_kind in sc["kinds"]], fps=fps, tolerance_ms=tol)
    return r
