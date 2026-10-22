"""Kiểm tra validator timeline (Python), bản JS của giao diện và độ khớp giữa hai bản."""
import json
import os
from pathlib import Path
import shutil
import subprocess

import pytest

import review_timeline as rt

CORE_JS = Path(__file__).resolve().parent / "review_tools/timeline_core.js"
NODE = shutil.which("node")
needs_node = pytest.mark.skipif(NODE is None, reason="Node.js không có trên máy này")


def iv(interval_id, technique, start, end, **extra):
    base = {"intervalId": interval_id, "technique": technique, "startTimeMs": start, "endTimeMs": end,
            "peakTimeMs": None, "leadRear": None, "stance": None, "backgroundType": None,
            "unclearReason": None, "qualityFlags": [], "certainty": "certain", "note": ""}
    if technique in rt.STRIKES:
        base.update(leadRear=rt.EXPECTED_SIDE[technique], stance="orthodox")
    if technique == "background":
        base.update(backgroundType="footwork")
    if technique == "unclear":
        base.update(unclearReason="occluded")
    base.update(extra)
    return base


def codes(result, kind="errors"):
    return sorted(e["code"] for e in result[kind])


def test_adjacent_half_open_intervals_are_not_overlap_and_full_cover_is_detected():
    timeline = [iv("I1", "background", 0, 1000), iv("I2", "jab", 1000, 1400), iv("I3", "background", 1400, 2000)]
    result = rt.validate_timeline(timeline, 2000)
    assert result["errors"] == [] and result["coverage"]["fullyCovered"]
    assert result["coverage"]["coveredMs"] == 2000 and result["coverage"]["gapCount"] == 0


def test_three_decimal_rounding_noise_is_not_an_overlap_but_real_overlap_is():
    assert codes(rt.validate_timeline([iv("I1", "background", 0, 1000.001), iv("I2", "background", 1000, 2000)], 2000)) == []
    result = rt.validate_timeline([iv("I1", "background", 0, 1000), iv("I2", "jab", 950, 1400)], 2000)
    assert codes(result) == ["OVERLAPPING_INTERVALS"]
    assert result["errors"][0]["overlapMs"] == 50 and result["errors"][0]["intervalIds"] == ["I1", "I2"]


def test_nested_overlap_reports_every_pair():
    timeline = [iv("I1", "background", 0, 1000), iv("I2", "jab", 100, 200), iv("I3", "cross", 300, 400)]
    pairs = {tuple(e["intervalIds"]) for e in rt.validate_timeline(timeline, 1000)["errors"]}
    assert pairs == {("I1", "I2"), ("I1", "I3")}


def test_gaps_stay_gaps_and_are_never_filled_as_background():
    timeline = [iv("I1", "jab", 500, 900), iv("I2", "background", 1200, 1500)]
    coverage = rt.validate_timeline(timeline, 2000)["coverage"]
    assert coverage["gaps"] == [{"startTimeMs": 0, "endTimeMs": 500}, {"startTimeMs": 900, "endTimeMs": 1200},
                                {"startTimeMs": 1500, "endTimeMs": 2000}]
    assert coverage["coveredMs"] == 700 and not coverage["fullyCovered"]
    assert coverage["countsByTechnique"] == {"jab": 1, "background": 1}


@pytest.mark.parametrize("change,expected", [
    (dict(technique="jab", stance=None), "STRIKE_STANCE_REQUIRED"),
    (dict(technique="jab", stance="switching"), "STRIKE_STANCE_REQUIRED"),
    (dict(technique="jab", leadRear=None), "STRIKE_LEAD_REAR_REQUIRED"),
    (dict(technique="jab", leadRear="not_applicable"), "STRIKE_LEAD_REAR_REQUIRED"),
    (dict(technique="jab", peakTimeMs=5000), "PEAK_OUTSIDE_INTERVAL"),
    (dict(technique="jab", backgroundType="footwork"), "FIELD_NOT_APPLICABLE"),
    (dict(technique="background", peakTimeMs=1100), "PEAK_ONLY_FOR_STRIKE"),
    (dict(technique="background", leadRear="lead"), "FIELD_NOT_APPLICABLE"),
    (dict(technique="background", stance="unknown"), "INVALID_STANCE"),
    (dict(technique="background", backgroundType="dance"), "UNKNOWN_BACKGROUND_TYPE"),
    (dict(technique="unclear", unclearReason=None), "UNCLEAR_REASON_REQUIRED"),
    (dict(technique="unclear", unclearReason="boring"), "UNCLEAR_REASON_REQUIRED"),
    (dict(technique="unclear", unclearReason="other", note=" "), "UNCLEAR_REASON_NOTE_REQUIRED"),
    (dict(technique="hook"), "UNKNOWN_TECHNIQUE"),
    (dict(startTimeMs=1400, endTimeMs=1000), "START_NOT_BEFORE_END"),
    (dict(endTimeMs=99999), "OUT_OF_VIDEO_RANGE"),
    (dict(startTimeMs=-1), "OUT_OF_VIDEO_RANGE"),
    (dict(startTimeMs="1000"), "TIME_NOT_FINITE"),
    (dict(certainty="maybe"), "INVALID_CERTAINTY"),
    (dict(qualityFlags=["sweaty"]), "UNKNOWN_QUALITY_FLAG"),
])
def test_interval_field_errors(change, expected):
    technique = change.get("technique", "jab")
    base = iv("I1", technique if technique in rt.TECHNIQUES else "jab", 1000, 1400)
    base.update(change)
    assert expected in codes(rt.validate_timeline([base], 2000))


def test_valid_unclear_with_reason_and_stance_optional_for_background():
    timeline = [iv("I1", "unclear", 0, 500, qualityFlags=["occluded"]), iv("I2", "background", 500, 900)]
    result = rt.validate_timeline(timeline, 900)
    assert result["errors"] == [] and result["coverage"]["unclearMs"] == 500
    assert timeline[1]["stance"] is None  # không có thế thủ mặc định cho background


def test_lead_rear_class_mismatch_is_warning_and_missing_background_type_is_warning():
    result = rt.validate_timeline([iv("I1", "jab", 0, 100, leadRear="rear"), iv("I2", "background", 100, 200, backgroundType=None)], 200)
    assert result["errors"] == []
    assert codes(result, "warnings") == ["BACKGROUND_TYPE_MISSING", "LEAD_REAR_CLASS_MISMATCH"]


def test_duplicate_ids_and_declared_complete_with_gaps_or_errors_rejected():
    assert "DUPLICATE_INTERVAL_ID" in codes(rt.validate_timeline([iv("I1", "jab", 0, 10), iv("I1", "jab", 20, 30)], 100))
    gap = rt.validate_timeline([iv("I1", "jab", 0, 10)], 100, declared_complete=True)
    assert "DECLARED_COMPLETE_WITH_GAPS" in codes(gap)
    bad = rt.validate_timeline([iv("I1", "jab", 0, 60), iv("I2", "cross", 50, 100)], 100, declared_complete=True)
    assert "DECLARED_COMPLETE_WITH_ERRORS" in codes(bad)
    ok = rt.validate_timeline([iv("I1", "background", 0, 100)], 100, declared_complete=True)
    assert ok["errors"] == []


def export_document(**override):
    document = {"schemaVersion": rt.ANNOTATION_SCHEMA, "packId": "p", "sourceVideoId": "F001_S1", "videoSha256": "ab" * 32,
                "fps": 30, "durationMs": 2000, "annotatorId": "ANN-A", "annotatorIdentityVerified": False,
                "status": "LOCAL_REVIEW_UNVERIFIED", "reviewerAuthenticated": False, "coachConfirmed": False,
                "goldEligible": False, "intervals": [iv("I1", "jab", 100, 400)]}
    document.update(override)
    return document


@pytest.mark.parametrize("override", [
    {"coachConfirmed": True}, {"goldEligible": True}, {"reviewerAuthenticated": True},
    {"annotatorIdentityVerified": True}, {"status": "COACH_APPROVED"}, {"annotatorId": "Nguyễn Văn A"},
    {"annotatorId": "a@b.com"}, {"annotatorId": None}, {"schemaVersion": "other"}, {"intervals": "x"}, {"durationMs": 0},
])
def test_tampered_or_malformed_export_is_rejected(override):
    with pytest.raises(ValueError):
        rt.check_annotation_document(export_document(**override))


def test_load_annotation_revalidates_and_ignores_embedded_validation(tmp_path):
    overlapping = export_document(intervals=[iv("I1", "jab", 0, 300), iv("I2", "cross", 200, 400)],
                                  validation={"errors": [], "warnings": [], "coverage": {}})
    path = tmp_path / "a.json"
    path.write_text(json.dumps(overlapping))
    with pytest.raises(ValueError, match="OVERLAPPING_INTERVALS"):
        rt.load_annotation(path)
    path.write_text(json.dumps(export_document()))
    assert rt.load_annotation(path)["annotatorId"] == "ANN-A"


@pytest.mark.parametrize("value,ok", [("F007", True), ("S1", True), ("ANN-A.1_x", True), ("", False), ("a b", False),
                                      ("Nguyễn", False), ("a@b.vn", False), ("-lead", False), ("x" * 65, False), (7, False)])
def test_anonymous_id_pattern(value, ok):
    assert rt.is_id(value) is ok


# --- bản JS ---------------------------------------------------------------

def run_node(script, payload=None):
    completed = subprocess.run([NODE, "-e", script], input=json.dumps(payload) if payload is not None else None,
                               capture_output=True, text=True, encoding="utf-8", timeout=60,
                               env={**os.environ, "CORE": str(CORE_JS)})
    assert completed.returncode == 0, completed.stderr
    return json.loads(completed.stdout)


PARITY_CASES = [
    ([iv("I1", "background", 0, 1000), iv("I2", "jab", 1000, 1400), iv("I3", "background", 1400, 2000)], 2000, False),
    ([iv("I1", "background", 0, 1000), iv("I2", "jab", 950, 1400)], 2000, False),
    ([iv("I1", "background", 0, 1000), iv("I2", "jab", 100, 200), iv("I3", "cross", 300, 400)], 1000, False),
    ([iv("I1", "jab", 500, 900), iv("I2", "background", 1200, 1500)], 2000, False),
    ([iv("I1", "jab", 0, 100, stance=None, leadRear="rear", peakTimeMs=500)], 2000, False),
    ([iv("I1", "unclear", 0, 500, unclearReason="other", note=""), iv("I2", "background", 500, 900, backgroundType=None)], 900, True),
    ([iv("I1", "background", 0, 1000.001), iv("I2", "background", 1000, 2000)], 2000, True),
    ([iv("I1", "jab", 0, 10), iv("I1", "jab", 20, 30), iv("I3", "wat", 0, 5)], 100, False),
    ([iv("I1", "background", 5, 5, peakTimeMs=1, leadRear="lead", stance="switching")], None, False),
]


@needs_node
def test_js_validator_matches_python_validator():
    script = """const TC=require(process.env.CORE);const cases=JSON.parse(require('fs').readFileSync(0,'utf8'));
    console.log(JSON.stringify(cases.map(c=>{const r=TC.validateTimeline(c.intervals,{durationMs:c.duration,declaredComplete:c.declared});
    return {errors:r.errors.map(e=>e.code).sort(),warnings:r.warnings.map(e=>e.code).sort(),coverage:r.coverage};})));"""
    payload = [{"intervals": a, "duration": b, "declared": c} for a, b, c in PARITY_CASES]
    js = run_node(script, payload)
    for (intervals, duration, declared), result in zip(PARITY_CASES, js):
        py = rt.validate_timeline(intervals, duration, declared)
        assert result["errors"] == codes(py), intervals
        assert result["warnings"] == codes(py, "warnings"), intervals
        assert result["coverage"] == json.loads(json.dumps(py["coverage"])), intervals


@needs_node
def test_js_and_python_share_the_same_vocabulary():
    js = run_node("const TC=require(process.env.CORE);console.log(JSON.stringify(TC));")
    assert tuple(js["STRIKES"]) == rt.STRIKES and tuple(js["TECHNIQUES"]) == rt.TECHNIQUES
    assert tuple(js["BACKGROUND_TYPES"]) == rt.BACKGROUND_TYPES and tuple(js["QUALITY_FLAGS"]) == rt.QUALITY_FLAGS
    assert tuple(js["UNCLEAR_REASONS"]) == rt.UNCLEAR_REASONS and tuple(js["STANCES"]) == rt.STANCES
    assert tuple(js["CERTAINTY"]) == rt.CERTAINTY and js["EXPECTED_SIDE"] == rt.EXPECTED_SIDE
    assert js["ID_PATTERN_SOURCE"] == f"^{rt.ID_PATTERN}$" and js["ANNOTATION_SCHEMA"] == rt.ANNOTATION_SCHEMA
    assert js["EPS"] == rt.EPS


@needs_node
def test_js_editing_helpers_keep_half_open_chains_and_split_peak():
    script = """const TC=require(process.env.CORE);
    let list=[];
    list=TC.addInterval(list,{technique:'jab',startTimeMs:1000,endTimeMs:1400,leadRear:'lead',stance:'orthodox',peakTimeMs:1300,backgroundType:'footwork'}).list;
    list=TC.addInterval(list,{technique:'background',startTimeMs:0,endTimeMs:1000,backgroundType:'standing_still',peakTimeMs:5,leadRear:'lead'}).list;
    const split=TC.splitInterval(list,'I0001',1200);
    let tooEarly=null;try{TC.splitInterval(list,'I0001',1000);}catch(e){tooEarly=e.message;}
    console.log(JSON.stringify({list:list,split:split.list,ids:split.ids,tooEarly:tooEarly,after:TC.removeInterval(split.list,'I0003').length}));"""
    out = run_node(script)
    assert [i["intervalId"] for i in out["list"]] == ["I0002", "I0001"]  # sắp theo thời gian, ID tăng dần theo lúc thêm
    jab, background = out["list"][1], out["list"][0]
    assert jab["backgroundType"] is None and background["peakTimeMs"] is None and background["leadRear"] is None
    assert out["ids"] == ["I0001", "I0003"] and out["tooEarly"]
    first, second = [i for i in out["split"] if i["technique"] == "jab"]
    assert (first["startTimeMs"], first["endTimeMs"], second["startTimeMs"], second["endTimeMs"]) == (1000, 1200, 1200, 1400)
    assert first["peakTimeMs"] is None and second["peakTimeMs"] == 1300
    assert out["after"] == 2
    assert rt.validate_timeline(out["split"], 1400)["errors"] == []  # tách xong vẫn không chồng


@needs_node
def test_js_export_is_unverified_valid_and_round_trips_through_python(tmp_path):
    script = """const TC=require(process.env.CORE);
    const pack={packId:'pk',video:{sourceVideoId:'F001_S1',sha256:'ab'.repeat(32),fighterId:'F001',sessionId:'S1',fps:30,decodedFrames:60,durationMs:2000}};
    const intervals=[{intervalId:'I0001',technique:'jab',startTimeMs:0,endTimeMs:1000,peakTimeMs:500,leadRear:'lead',stance:'orthodox',backgroundType:null,unclearReason:null,qualityFlags:[],certainty:'certain',note:''},
      {intervalId:'I0002',technique:'background',startTimeMs:1000,endTimeMs:2000,peakTimeMs:null,leadRear:null,stance:null,backgroundType:'footwork',unclearReason:null,qualityFlags:[],certainty:'certain',note:''}];
    const doc=TC.buildExport({pack:pack,annotatorId:'ANN-A',guideVersion:' v1 ',intervals:intervals,declaredComplete:true,revision:3,exportedAt:'2026-10-06T00:00:00Z'});
    let bad=[];for(const id of ['Nguyen Van A','a@b.com','','x'.repeat(65)]){try{TC.buildExport({pack:pack,annotatorId:id,intervals:[],revision:0});bad.push('accepted '+id);}catch(e){}}
    console.log(JSON.stringify({doc:doc,bad:bad}));"""
    out = run_node(script)
    doc = out["doc"]
    assert out["bad"] == []
    assert doc["schemaVersion"] == rt.ANNOTATION_SCHEMA and doc["guideVersion"] == "v1"
    assert (doc["status"], doc["coachConfirmed"], doc["goldEligible"], doc["reviewerAuthenticated"],
            doc["annotatorIdentityVerified"], doc["annotationCoverage"]) == ("LOCAL_REVIEW_UNVERIFIED", False, False, False, False, "unverified")
    assert doc["annotatorDeclaredTimelineComplete"] is True and doc["validation"]["errors"] == []
    path = tmp_path / "ann.json"
    path.write_text(json.dumps(doc))
    assert rt.load_annotation(path)["intervals"][1]["backgroundType"] == "footwork"


@needs_node
def test_js_export_of_overlap_carries_the_error_instead_of_hiding_it():
    script = """const TC=require(process.env.CORE);
    const pack={packId:'pk',video:{sourceVideoId:'V',sha256:'ab',fighterId:'F001',sessionId:'S1',fps:30,decodedFrames:60,durationMs:2000}};
    const mk=(id,s,e)=>({intervalId:id,technique:'background',startTimeMs:s,endTimeMs:e,peakTimeMs:null,leadRear:null,stance:null,backgroundType:'footwork',unclearReason:null,qualityFlags:[],certainty:'certain',note:''});
    const doc=TC.buildExport({pack:pack,annotatorId:'A',intervals:[mk('I1',0,1500),mk('I2',1000,2000)],declaredComplete:true,revision:1,exportedAt:'x'});
    console.log(JSON.stringify(doc.validation.errors.map(e=>e.code)));"""
    assert set(run_node(script)) == {"OVERLAPPING_INTERVALS", "DECLARED_COMPLETE_WITH_ERRORS"}


@needs_node
def test_js_keyboard_map_ignores_typing_and_modifiers():
    script = """const TC=require(process.env.CORE);const k=(key,extra)=>TC.keyAction(Object.assign({key:key},extra||{}));
    console.log(JSON.stringify({one:k('1'),zero:k('0'),u:k('u'),f:k('f'),o:k('o'),s:k('s'),enter:k('Enter'),space:k(' '),
      back10:k(',',{shiftKey:true}),fwd:k('.'),del:k('Delete'),typing:k('1',{typing:true}),ctrlS:k('s',{ctrlKey:true}),
      undo:k('z',{ctrlKey:true}),undoTyping:k('z',{ctrlKey:true,typing:true}),unknown:k('q')}));"""
    out = run_node(script)
    assert out["one"] == {"type": "technique", "value": "jab"} and out["zero"]["value"] == "background" and out["u"]["value"] == "unclear"
    assert out["f"] == {"type": "lead_rear", "value": "lead"} and out["s"] == {"type": "stance", "value": "southpaw"}
    assert out["enter"]["type"] == "commit" and out["space"]["type"] == "toggle_play" and out["del"]["type"] == "delete"
    assert out["back10"] == {"type": "step", "value": -10} and out["fwd"] == {"type": "step", "value": 1}
    assert out["typing"] is None and out["ctrlS"] is None and out["undo"]["type"] == "undo"
    assert out["undoTyping"] is None and out["unknown"] is None
