"""Failure analysis of every FN/FP for legacy FSM and shadow detect_punch_events.

Inputs  : BENCH dir (vid_* fresh inference outputs + VIDEO_DATA_* pose-replay outputs) and TRACE dir (*.trace.json).
Outputs : analysis.json (scratch). Categories are rule-based, assigned in the documented priority order; every error also
          carries the raw evidence numbers so that the category can be audited. Nothing here changes a detector or a threshold.
"""
import sys, json, math, statistics
import os
from collections import Counter, defaultdict
from common import *
from common import _impact_ms, _normalise_event
from pipeline.strike_events import _feature, EventDetectorConfig
from pose_math import Point, calculate_angle, calculate_arm_length

BENCH, TRACE = Path(sys.argv[1]), Path(sys.argv[2])
OUTFILE = Path(sys.argv[3])
TOL = 350.0
CFG = EventDetectorConfig()
SCENARIO = {  # what the clip is, from the ground-truth files / benchmark report
    "vid_01_cross_heavybag": "training_heavy_bag", "vid_02_referee_gestures": "negative_control_gestures",
    "vid_03_fighter_walkout": "negative_control_walkout", "vid_04_cage_striking": "live_cage_exchange",
    "vid_05_ground_grappling": "negative_control_grappling", "vid_06_post_fight": "negative_control_celebration",
    "VIDEO_DATA_002": "training_shadow_or_bag_4k", "VIDEO_DATA_003": "training_shadow_or_bag_1080p",
    "VIDEO_DATA_005": "mixed_heavybag_kicks"}
TRAINING_SCOPES = {"vid_01_cross_heavybag:punch", "VIDEO_DATA_002:punch", "VIDEO_DATA_003:punch"}
FSM_LOST = {"identity_discontinuity", "joint_confidence_below_0.25", "landmark_loss_over_400ms", "missing_detection",
            "just_stood_up", "elbow_angle_invalid", "ground_posture"}
FSM_DISP = {"retracted_before_min_displacement", "extending_timeout", "cycle_over_max_duration_1200ms"}


IDENT = json.loads((Path(os.environ.get("DETECTOR_OUT", Path(__file__).resolve().parent / "out")) / "vid04_ident.json").read_text(encoding="utf-8"))


def vid04_identity(t_ms, fps=59.94, half=0.1):
    """Heuristic validated by eye on frames 0/52/58/64 (dark-torso fighter = target Wilson) and 177/284/312/385/413 (pale-torso fighter = opponent Courtoise).
    Mean grey level of the tracked torso: >=150 -> opponent, <=130 -> target, otherwise unclear. Only meaningful for vid_04."""
    i0, i1 = int((t_ms / 1000 - half) * fps), int((t_ms / 1000 + half) * fps)
    v = [x for x in IDENT["lum"][max(0, i0):i1 + 1] if x is not None]
    if not v:
        return "unknown", None
    m = statistics.median(v)
    return ("opponent_pale_torso" if m >= 150 else "target_dark_torso" if m <= 130 else "unclear"), round(m)


def pt(frame, i):
    p = frame["landmarks"][i]
    return Point(x=p["x"], y=p["y"], conf=p["conf"])


def win(times, a, b):
    return [i for i, t in enumerate(times) if a <= t <= b]


def arm_series(frames, times, idx, arm, min_conf=0.25):
    """Per-frame legacy-FSM launch ingredients for one arm (same formulas as SingleArmTracker, replayed from exported landmarks)."""
    s, e, w = (5, 7, 9) if arm == "left" else (6, 8, 10)
    out = []
    prev_reach = None
    for i in idx:
        f = frames[i]
        if len(f.get("landmarks", [])) != 17 or f.get("observationKind") != "fresh_detection":
            out.append(None); prev_reach = None; continue
        sh, el, wr = pt(f, s), pt(f, e), pt(f, w)
        ok = min(sh.conf, el.conf, wr.conf) >= min_conf
        if not ok:
            out.append({"conf_ok": False}); prev_reach = None; continue
        reach = math.dist((wr.x, wr.y), (sh.x, sh.y))
        ang = calculate_angle(sh, el, wr, min_confidence=min_conf)
        dt = (times[i] - times[i - 1]) if i > 0 else 40.0
        rs = None if prev_reach is None else (reach - prev_reach) / dt * 1000.0
        out.append({"conf_ok": True, "reach": reach, "elbow": ang, "reach_speed": rs, "valid_height": wr.y < sh.y + 0.20,
                    "arm_len": calculate_arm_length(sh, el, wr)})
        prev_reach = reach
    return out


def window_features(doc, t_ms, lo=350.0, hi=350.0):
    frames, times = doc["frames"], [f["timeMs"] for f in doc["frames"]]
    idx = win(times, t_ms - lo, t_ms + hi)
    if not idx:
        return {"n_frames": 0}
    kinds = Counter(frames[i].get("observationKind", "?") for i in idx)
    feats = {"n_frames": len(idx), "fresh_frac": round(kinds.get("fresh_detection", 0) / len(idx), 2),
             "discontinuity_frames": sum(1 for i in idx if frames[i].get("isDiscontinuous")),
             "ground_frames": sum(1 for i in idx if frames[i].get("posture") == "ground")}
    aspect = doc["meta"]["imgWidth"] / doc["meta"]["imgHeight"]
    for arm in ("left", "right"):
        ser = arm_series(frames, times, idx, arm)
        valid = [x for x in ser if x and x.get("conf_ok")]
        speeds = [x["reach_speed"] for x in valid if x["reach_speed"] is not None]
        sh_reasons = Counter()
        reaches = []
        for i in idx:
            v, r = _feature(frames[i], arm, CFG, aspect)
            if r: sh_reasons[r] += 1
            else: reaches.append(v["reach"])
        feats[arm] = {"conf_ok_frac": round(len(valid) / len(idx), 2),
                      "max_reach_speed": round(max(speeds), 3) if speeds else None,
                      "max_elbow_deg": round(max((x["elbow"] for x in valid if x["elbow"] is not None), default=0), 1) if valid else None,
                      "reach_range_norm": round(max(x["reach"] for x in valid) - min(x["reach"] for x in valid), 4) if valid else None,
                      "arm_len_norm": round(statistics.median(x["arm_len"] for x in valid), 4) if valid else None,
                      "wrist_high_frac": round(sum(1 for x in valid if x["valid_height"]) / len(valid), 2) if valid else None,
                      "shadow_valid_frac": round(len(reaches) / len(idx), 2),
                      "shadow_peak_reach_torso": round(max(reaches), 2) if reaches else None,
                      "shadow_reach_range_torso": round(max(reaches) - min(reaches), 2) if reaches else None,
                      "shadow_invalid_reasons": dict(sh_reasons)}
    # lower body visibility (kick scopes)
    def conf(f, key):
        return f.get(key) if f.get(key) is not None else 0.0
    feats["leg_conf"] = {side: {"knee_conf_mean": round(statistics.mean(conf(frames[i], f"{side}KneeConf") for i in idx), 2),
                                "ankle_conf_mean": round(statistics.mean(conf(frames[i], f"{side}AnkleConf") for i in idx), 2)}
                         for side in ("left", "right")}
    feats["kick_states_seen"] = sorted({frames[i].get("kickState", "?") for i in idx})
    feats["active_legs_seen"] = sorted({frames[i].get("activeLeg", "?") for i in idx} - {"none"})
    return feats


def busy_intervals(trace):
    """Per-arm [launch_ms, end_ms, how_ended] cycles reconstructed from the FSM trace."""
    open_ = {}
    out = []
    for t in trace:
        arm = t["arm"]
        if t["ev"] == "launch":
            open_[arm] = t
        elif t["ev"] in ("abort", "complete") and arm in open_:
            la = open_.pop(arm)
            out.append({"arm": arm, "launch_ms": la["timeMs"], "launch_frame": la["frame"], "end_ms": t["timeMs"], "end_frame": t["frame"],
                        "how": t["reason"] if t["ev"] == "abort" else "complete", "from_state": t.get("fromState"), "impact_ms": t.get("impactTimeMs"), "maxElbowDeg": t.get("maxElbowDeg"), "extDisp": t.get("extDisp")})
    return out


def other_gt_gap(g, gts, fps=None):
    gaps = [abs(_impact_ms(o, fps) - _impact_ms(g, fps)) for o in gts if o.event_id != g.event_id]
    return min(gaps) if gaps else None


def gt_ms(e, fps):
    return _impact_ms(e, fps)


def compat(p, g, fps):
    return p.strike_kind == g.strike_kind and not (p.side != "unknown" and g.side != "unknown" and p.side != g.side)


def classify_fn(det, sc, doc, trace_cycles, g, preds, res, fps):
    tg = gt_ms(g, fps)
    kind = g.strike_kind
    feats = window_features(doc, tg)
    matched_p = {m["prediction_id"]: m["ground_truth_id"] for m in res["matches"]}
    pr = [(p, abs(gt_ms(p, fps) - tg)) for p in preds if compat(p, g, fps) and p.strike_kind in sc["kinds"]]
    flags = []
    evidence = {"window": feats}
    # nearest compatible prediction
    near = sorted(pr, key=lambda x: x[1])[:1]
    if near:
        evidence["nearest_pred_ms"] = round(near[0][1], 1)
        evidence["nearest_pred_id"] = near[0][0].event_id
        evidence["nearest_pred_matched_to"] = matched_p.get(near[0][0].event_id)
    gap = other_gt_gap(g, [e for e in sc["gt"] if e.scope == "in_scope"], fps)
    if gap is not None:
        evidence["nearest_other_gt_ms"] = round(gap, 1)
    consumed = [p for p, d in pr if d <= TOL and p.event_id in matched_p]
    late = [(p, d) for p, d in pr if TOL < d <= 1000 and p.event_id not in matched_p]
    if feats["n_frames"] == 0 or feats["fresh_frac"] < 0.5:
        flags.append("POSE_MISSING")
    if consumed:
        flags.append("CONSUMED_BY_NEIGHBOUR")
    if late:
        flags.append("TIMING_OUTSIDE_TOLERANCE")
    if gap is not None and gap <= 240:
        flags.append("GT_DENSE_<=240ms")
    primary = None
    detail = {}
    if "POSE_MISSING" in flags:
        primary = "POSE_MISSING_OR_CACHED"
    elif consumed:
        primary = "CONSUMED_BY_NEIGHBOUR_ONE_TO_ONE"
        detail["neighbour_gt"] = [matched_p[p.event_id] for p in consumed]
    elif late:
        primary = "TIMING_OUTSIDE_TOLERANCE"
        detail["late_by_ms"] = round(min(d for _, d in late), 1)
    elif det == "legacy_fsm" and kind == "punch":
        primary, detail = fsm_punch_fn(feats, trace_cycles, g, tg)
    elif det == "legacy_fsm" and kind == "kick":
        lc = feats.get("leg_conf", {})
        best = max((v["ankle_conf_mean"] for v in lc.values()), default=0)
        detail = {"best_ankle_conf_mean": best, "kick_states_seen": feats.get("kick_states_seen"), "active_legs_seen": feats.get("active_legs_seen")}
        primary = ("LEG_LOW_VISIBILITY" if best < 0.35 else "KICK_NOT_TRIGGERED_VISIBLE_LEG")
    elif det == "shadow":
        primary, detail = shadow_fn(feats, doc, tg)
    if sc["pred"] == "vid_04_cage_striking":
        who, lum = vid04_identity(tg)
        evidence["tracked_identity"] = {"who": who, "torso_grey": lum}
        if who == "opponent_pale_torso":
            flags.append("WRONG_PERSON_TRACKED")
            detail["original_category_before_identity_check"] = primary
            primary = "WRONG_PERSON_TRACKED"
    return primary or "OTHER", flags, detail, evidence


def fsm_punch_fn(feats, cycles, g, tg):
    arms = [g.side] if g.side in ("left", "right") else ["left", "right"]
    detail = {}
    # FSM cycles (per arm) whose [launch, end] interval intersects tg +- 250 ms
    ov = [c for c in cycles if c["arm"] in arms and c["launch_ms"] <= tg + 250 and c["end_ms"] >= tg - 250]
    own = [c for c in ov if c["launch_ms"] >= tg - 500]      # a cycle that started shortly before this strike
    stale = [c for c in ov if c["launch_ms"] < tg - 500]     # arm FSM was occupied by an older cycle
    detail["fsm_cycles_covering_strike"] = [{k: c[k] for k in ("arm", "launch_frame", "end_frame", "how", "from_state", "maxElbowDeg", "extDisp")} for c in ov]
    done = [c for c in own if c["how"] == "complete" and abs((c.get("impact_ms") or 1e9) - tg) <= TOL]
    if done:
        detail["note"] = "FSM completed a cycle with impact inside tolerance but it is absent from the output (suppressed/merged)"
        return "FSM_COMPLETED_BUT_NOT_REPORTED", detail
    lost = [c for c in own if c["how"] in FSM_LOST]
    disp = [c for c in own if c["how"] in FSM_DISP]
    no_return = [c for c in disp if c["from_state"] in ("impact", "retracting")]
    if no_return and not [c for c in disp if c["from_state"] == "extending" and c["how"] != "cycle_over_max_duration_1200ms"]:
        detail["cycles"] = [{k: c[k] for k in ("arm", "launch_frame", "end_frame", "from_state", "maxElbowDeg", "extDisp")} for c in no_return]
        return "FSM_NO_RETURN_TO_GUARD_WITHIN_1200ms", detail
    if disp:
        detail["abort_reasons"] = sorted({c["how"] for c in disp})
        best = max(disp, key=lambda c: (c["extDisp"] or 0))
        detail["best_cycle"] = {k: best[k] for k in ("arm", "launch_frame", "end_frame", "from_state", "maxElbowDeg", "extDisp")}
        detail["best_maxElbowDeg"] = max(c["maxElbowDeg"] or 0 for c in disp)
        detail["best_extDisp"] = max(c["extDisp"] or 0 for c in disp)
        al = (feats.get(best["arm"]) or {}).get("arm_len_norm") or 0.25
        ratio = detail["best_extDisp"] / al
        unmet = []
        if detail["best_maxElbowDeg"] < 135.0: unmet.append("max_elbow_below_135")
        if detail["best_extDisp"] < 0.07: unmet.append("ext_disp_below_0.07")
        if ratio < 0.30: unmet.append("ext_disp_ratio_below_0.30")
        detail["ext_disp_over_arm_length"] = round(ratio, 2)
        detail["unmet_straight_impact_criteria"] = unmet
        detail["sub_category"] = ("elbow_only" if unmet == ["max_elbow_below_135"] else
                                  "displacement_only" if unmet and "max_elbow_below_135" not in unmet else
                                  "elbow_and_displacement" if len(unmet) > 1 else "none_unmet_by_this_metric")
        detail["thresholds"] = {"min_elbow_angle_straight": 135.0, "min_extension_disp": 0.07, "min_extension_disp_ratio": 0.30}
        return "FSM_EXTENSION_CRITERIA_NOT_MET", detail
    if lost:
        detail["abort_reasons"] = sorted({c["how"] for c in lost})
        return "FSM_CYCLE_RESET_BY_TRACKING_OR_CONFIDENCE", detail
    if any(c["how"] == "retraction_timeout_under_25pct" for c in own):
        return "FSM_NO_RETRACTION", detail
    if any(c["how"] == "complete" for c in own):
        detail["note"] = "one FSM cycle (guard->impact->retract) covers this label; its single detection is matched to a neighbouring label"
        return "FSM_ONE_CYCLE_COVERS_SEVERAL_STRIKES", detail
    if stale:
        detail["stale_cycles"] = [{k: c[k] for k in ("arm", "launch_frame", "end_frame", "how")} for c in stale]
        return "FSM_ARM_BUSY_IN_OLDER_CYCLE", detail
    recent = [c for c in cycles if c["arm"] in arms and c["how"] == "complete" and 0 <= tg - c["end_ms"] <= 450]
    if recent:
        detail["recent_complete"] = [{k: c[k] for k in ("arm", "end_frame")} for c in recent]
        return "FSM_REFRACTORY_AFTER_PREVIOUS_PUNCH", detail
    for arm in arms:
        a = feats.get(arm) or {}
        detail[arm] = {k: a.get(k) for k in ("conf_ok_frac", "max_reach_speed", "max_elbow_deg", "wrist_high_frac", "reach_range_norm", "arm_len_norm")}
    best = [feats.get(a) or {} for a in arms]
    if all((b.get("conf_ok_frac") or 0) < 0.5 for b in best):
        return "ARM_JOINTS_LOW_CONFIDENCE", detail
    if all((b.get("max_reach_speed") or 0) < 0.5 for b in best):
        return "NO_LAUNCH_EXTENSION_SPEED_BELOW_0.5", detail
    return "NO_LAUNCH_OTHER_CONDITION", detail


def shadow_fn(feats, doc, tg):
    rej = [r for r in doc["_shadow"]["rejected"] if abs(r["impactTimeMs"] - tg) <= TOL]
    detail = {"rejected_in_window": [{k: r[k] for k in ("arm", "impactFrame", "reasonCode")} for r in rej]}
    if rej:
        # rank by severity: the most informative single reason is the one of the rejected candidate nearest in time
        near = min(rej, key=lambda r: abs(r["impactTimeMs"] - tg))
        detail["nearest_rejected"] = near["reasonCode"]
        return "SHADOW_REJECTED_" + near["reasonCode"], detail
    inv = Counter()
    for arm in ("left", "right"):
        inv.update((feats.get(arm) or {}).get("shadow_invalid_reasons", {}))
    detail["invalid_frame_reasons_window"] = dict(inv)
    vf = max(((feats.get(a) or {}).get("shadow_valid_frac") or 0) for a in ("left", "right"))
    detail["best_arm_valid_frac"] = vf
    if vf < 0.6:
        top = inv.most_common(1)[0][0] if inv else "UNKNOWN"
        return "SHADOW_FEATURE_INVALID_" + top, detail
    return "SHADOW_NO_REACH_PEAK_IN_WINDOW", detail


def classify_fp(det, sc, doc, p, preds, res, fps, cycles):
    tp = gt_ms(p, fps)
    kind = p.strike_kind
    scenario = SCENARIO.get(sc["pred"], "?")
    matched_g = {m["ground_truth_id"]: m["prediction_id"] for m in res["matches"]}
    gts = [e for e in sc["gt"] if e.scope == "in_scope"]
    near = sorted(((g, abs(gt_ms(g, fps) - tp)) for g in gts if g.strike_kind == kind and compat(p, g, fps)), key=lambda x: x[1])
    evidence = {"scenario": scenario}
    if near:
        evidence["nearest_gt_id"], evidence["nearest_gt_ms"] = near[0][0].event_id, round(near[0][1], 1)
        evidence["nearest_gt_matched_to"] = matched_g.get(near[0][0].event_id)
    # excluded labels (PROBE / out-of-scope actor / other kind)
    excl = []
    for e in sc.get("excluded", []):
        t = (e.get("peak_time") or e.get("timestamp") or 0.0) * 1000.0
        if abs(t - tp) <= TOL:
            excl.append({"id": e.get("id"), "label": e.get("label"), "scope": e.get("evaluation_scope"), "desc": e.get("description"), "dt_ms": round(abs(t - tp), 1)})
    if excl:
        evidence["excluded_gt_within_tolerance"] = excl
    feats = window_features(doc, tp)
    evidence["window"] = {k: feats.get(k) for k in ("fresh_frac", "discontinuity_frames", "ground_frames", "left", "right") if k in feats}
    # other-kind ground truth (kick<->punch confusion) from companion scopes of the same clip
    primary, detail = None, {}
    if excl:
        primary = "EXCLUDED_LABEL_" + "/".join(sorted({str(x["label"]) + ":" + str(x["scope"]) for x in excl}))
    elif near and near[0][1] <= TOL and near[0][0].event_id in matched_g:
        primary = "DUPLICATE_OF_MATCHED_STRIKE"
        detail["strike"] = near[0][0].event_id
    elif near and TOL < near[0][1] <= 1000 and near[0][0].event_id not in matched_g:
        primary = "TIMING_OUTSIDE_TOLERANCE"
    elif scenario.startswith("negative_control"):
        primary = "NON_STRIKE_MOTION_IN_NEGATIVE_CONTROL"
        if scenario == "negative_control_grappling" and feats.get("ground_frames", 0) == 0:
            detail["note"] = "no ground posture frame in window"
    elif not gts or not near:
        primary = "NO_LABEL_NEARBY_IN_LABELLED_CLIP"
    else:
        primary = "NO_LABEL_NEARBY_IN_LABELLED_CLIP"
        detail["nearest_gt_ms"] = round(near[0][1], 1)
    if sc["pred"] == "vid_04_cage_striking":
        who, lum = vid04_identity(tp)
        evidence["tracked_identity"] = {"who": who, "torso_grey": lum}
        if who == "opponent_pale_torso":
            detail["original_category_before_identity_check"] = primary
            primary = "WRONG_PERSON_TRACKED"
    return primary, detail, evidence


def brief(p, fps):
    r = p.raw or {}
    out = {"id": p.event_id, "side": p.side, "kind": p.strike_kind, "impactTimeMs": round(gt_ms(p, fps), 1),
           "impactFrame": p.impact_frame if p.impact_frame is not None else round(gt_ms(p, fps) * fps / 1000)}
    for k in ("startFrame", "endFrame", "maxElbowAngle", "peakSpeed", "punchType", "kickType"):
        if k in r: out[k] = r[k]
    if "features" in r: out["features"] = {k: round(v, 3) if isinstance(v, float) else v for k, v in r["features"].items()}
    return out


def evaluate_all():
    out = {"scopes": [], "errors": []}
    meta_rows = {}
    for sc in scopes():
        name = sc["pred"]
        doc = json.loads((BENCH / f"{name}.json").read_text(encoding="utf-8"))
        shadow_res, shadow_ev = shadow_events(doc)
        doc["_shadow"] = shadow_res
        fps = doc["meta"]["fps"]
        trace = json.loads((TRACE / f"{name}.trace.json").read_text(encoding="utf-8")) if (TRACE / f"{name}.trace.json").exists() else []
        cycles = busy_intervals(trace)
        _, lp = load_predictions_doc(doc, sc["kinds"])
        gts_in = [e for e in sc["gt"] if e.scope == "in_scope"]
        row = {"scope": sc["scope"], "video": name, "kinds": sc["kinds"], "gt_count": len(gts_in), "fps": fps, "scenario": SCENARIO.get(name),
               "gt_file": sc["gtfile"], "frames": len(doc["frames"])}
        dets = {"legacy_fsm": lp}
        if "punch" in sc["kinds"]:
            dets["shadow"] = shadow_ev
        for det, preds in dets.items():
            res = run_eval(sc, preds, fps)
            row[det] = {k: res[k] for k in ("tp", "fp", "fn", "precision", "recall", "f1")}
            row[det]["pred_count"] = len([p for p in preds if p.strike_kind in sc["kinds"]])
            row[det]["matches"] = res["matches"]
            gmap = {e.event_id: e for e in gts_in}
            pmap = {p.event_id: p for p in preds}
            for gid in res["false_negatives"]:
                g = gmap[gid]
                cat, flags, detail, ev = classify_fn(det, sc, doc, cycles, g, preds, res, fps)
                out["errors"].append({"detector": det, "scope": sc["scope"], "video": name, "type": "FN", "id": gid, "kind": g.strike_kind,
                                      "side": g.side, "timeMs": round(gt_ms(g, fps), 1), "frame": g.impact_frame, "category": cat,
                                      "flags": flags, "detail": detail, "evidence": ev})
            for pid in res["false_positives"]:
                p = pmap[pid]
                cat, detail, ev = classify_fp(det, sc, doc, p, preds, res, fps, cycles)
                out["errors"].append({"detector": det, "scope": sc["scope"], "video": name, "type": "FP", "id": pid, "kind": p.strike_kind,
                                      "side": p.side, "timeMs": round(gt_ms(p, fps), 1), "frame": brief(p, fps)["impactFrame"], "category": cat,
                                      "detail": detail, "prediction": brief(p, fps), "evidence": ev})
        out["scopes"].append(row)
        # body-size context (for threshold scale arguments)
        ms = []
        for f in doc["frames"]:
            if f.get("observationKind") == "fresh_detection" and len(f.get("landmarks", [])) == 17 and f.get("posture") != "ground":
                L = f["landmarks"]
                if min(L[i]["conf"] for i in (5, 6, 11, 12)) >= 0.5:
                    ms.append(math.hypot(((L[5]["x"] + L[6]["x"]) / 2 - (L[11]["x"] + L[12]["x"]) / 2) * doc["meta"]["imgWidth"],
                                         ((L[5]["y"] + L[6]["y"]) / 2 - (L[11]["y"] + L[12]["y"]) / 2) * doc["meta"]["imgHeight"]))
        fk = Counter(f.get("observationKind") for f in doc["frames"])
        meta_rows[name] = {"fps": fps, "frames": len(doc["frames"]), "w": doc["meta"]["imgWidth"], "h": doc["meta"]["imgHeight"],
                           "median_torso_px": round(statistics.median(ms), 1) if ms else None,
                           "median_torso_frac_of_height": round(statistics.median(ms) / doc["meta"]["imgHeight"], 3) if ms else None,
                           "fresh_detection_frac": round(fk.get("fresh_detection", 0) / len(doc["frames"]), 3),
                           "discontinuity_frames": sum(1 for f in doc["frames"] if f.get("isDiscontinuous")),
                           "ground_frames": sum(1 for f in doc["frames"] if f.get("posture") == "ground"),
                           "trace_cycles": len(cycles), "trace_abort_reasons": dict(Counter(c["how"] for c in cycles)),
                           "shadow_invalid_frame_reasons": shadow_res.get("invalidFrameReasons"),
                           "shadow_rejected_reasons": dict(Counter(r["reasonCode"] for r in shadow_res["rejected"]))}
    out["clip_context"] = meta_rows
    return out


if __name__ == "__main__":
    res = evaluate_all()
    OUTFILE.write_text(json.dumps(res, indent=1, ensure_ascii=False), encoding="utf-8")
    c = Counter((e["detector"], e["type"], e["category"]) for e in res["errors"])
    for k, v in sorted(c.items()):
        print(v, *k)
