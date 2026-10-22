"""Pose-replay through the scratch copy of the production code with a read-only trace of legacy punch FSM transitions.
No detector logic is changed: methods are wrapped, results are asserted identical to an untraced replay in parity_check."""
import sys, json, os
from pathlib import Path
from common import SRC
import punch_analyzer as pa
import pipeline.action_pipeline as ap
from replay_strikes import replay

TRACE = []
CUR = {"frame": None, "time": None}
G = pa.PunchState.GUARD
LINEMAP = {  # (function, line) in punch_analyzer.py / action_pipeline.py of the scratch copy -> semantic abort reason
    ("update", 218, "punch_analyzer.py"): "ground_posture",
    ("update", 237, "punch_analyzer.py"): "landmark_loss_over_400ms",
    ("update", 282, "punch_analyzer.py"): "cycle_over_max_duration_1200ms",
    ("update", 363, "punch_analyzer.py"): "extending_timeout",
    ("update", 365, "punch_analyzer.py"): "retracted_before_min_displacement",
    ("update", 448, "punch_analyzer.py"): "retraction_timeout_under_25pct",
    ("update", 213, "punch_analyzer.py"): "identity_discontinuity",
    ("update", 423, "punch_analyzer.py"): "_completed",
    ("update", 445, "punch_analyzer.py"): "_completed",
    ("update", 233, "punch_analyzer.py"): "joint_confidence_below_0.25",
    ("update", 251, "punch_analyzer.py"): "elbow_angle_invalid",
    ("update", 510, "punch_analyzer.py"): "identity_discontinuity",
    ("update", 538, "punch_analyzer.py"): "ground_posture",
    ("update", 530, "punch_analyzer.py"): "ground_posture",
    ("update", 518, "punch_analyzer.py"): "just_stood_up",
    ("process_frame", 87, "action_pipeline.py"): "missing_detection",
}
def _stack():
    f = sys._getframe(2); out = []
    while f and len(out) < 6:
        out.append((f.f_code.co_name, f.f_lineno, Path(f.f_code.co_filename).name)); f = f.f_back
    return out
def _reason(stack):
    for s in stack:
        if s in LINEMAP: return LINEMAP[s]
    return "unmapped:" + repr(stack[:3])

orig_update, orig_reset = pa.SingleArmTracker.update, pa.SingleArmTracker._reset_to_guard
def _reset(self):
    reason = _reason(_stack()) if self.state != G else None
    if self.state != G and reason != "_completed":
        TRACE.append({"ev": "abort", "arm": self.arm, "frame": CUR["frame"], "timeMs": CUR["time"], "fromState": self.state.value,
                      "reason": reason, "startFrame": self.start_frame,
                      "maxElbowDeg": round(self.max_elbow_angle, 1), "extDisp": round(self.max_reach - self.start_reach, 4),
                      "maxReach": round(self.max_reach, 4)})
    return orig_reset(self)
def _update(self, sh, el, wr, opp_sh, opp_wr, frame_idx, time_ms, is_discontinuous=False, is_ground=False):
    before = self.state
    out = orig_update(self, sh, el, wr, opp_sh, opp_wr, frame_idx, time_ms, is_discontinuous, is_ground)
    if before == G and self.state != G:
        TRACE.append({"ev": "launch", "arm": self.arm, "frame": frame_idx, "timeMs": time_ms, "startReach": round(self.start_reach, 4)})
    if before == pa.PunchState.EXTENDING and self.state == pa.PunchState.IMPACT:
        TRACE.append({"ev": "impact_state", "arm": self.arm, "frame": frame_idx, "timeMs": time_ms,
                      "maxElbowDeg": round(self.max_elbow_angle, 1), "extDisp": round(self.max_reach - self.start_reach, 4)})
    if out:
        TRACE.append({"ev": "complete", "arm": self.arm, "frame": frame_idx, "timeMs": time_ms, "impactFrame": out["impact_frame"],
                      "impactTimeMs": out["impact_time_ms"], "startFrame": out["start_frame"], "maxElbowDeg": round(out["max_elbow_angle"], 1)})
    return out
orig_pf = ap.ActionPipeline.process_frame
def _pf(self, observation, context):
    CUR["frame"], CUR["time"] = context.frame_idx, context.time_ms
    return orig_pf(self, observation, context)

def traced_replay(doc):
    TRACE.clear()
    pa.SingleArmTracker.update, pa.SingleArmTracker._reset_to_guard = _update, _reset
    ap.ActionPipeline.process_frame = _pf
    try:
        res = replay(doc)
    finally:
        pa.SingleArmTracker.update, pa.SingleArmTracker._reset_to_guard = orig_update, orig_reset
        ap.ActionPipeline.process_frame = orig_pf
    return res, list(TRACE)

if __name__ == "__main__":
    indir, outdir = Path(sys.argv[1]), Path(sys.argv[2]); outdir.mkdir(parents=True, exist_ok=True)
    names = sys.argv[3:]
    for n in names:
        doc = json.loads((indir / f"{n}.json").read_text(encoding="utf-8"))
        res, tr = traced_replay(doc)
        plain = replay(doc)
        key = lambda r: [(p["arm"], p["impactFrame"], p["startFrame"], p["endFrame"]) for p in r["punches"]] + [(k.get("activeLeg"), k.get("impactFrame")) for k in r["kicks"]]
        same = key(res) == key(plain)
        (outdir / f"{n}.trace.json").write_text(json.dumps(tr), encoding="utf-8")
        (outdir / f"{n}.json").write_text(json.dumps(res, ensure_ascii=False), encoding="utf-8")
        print(n, "trace events", len(tr), "parity_traced_vs_plain", same, "punches", len(res["punches"]), "kicks", len(res["kicks"]), flush=True)
