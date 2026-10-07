"""Kiểm tra nhãn toàn timeline do công cụ review_tools/club_timeline.html xuất ra.

Đây là bản Python của review_tools/timeline_core.js (test_club_timeline_core.py đối
chiếu hai bản). Khoảng là nửa mở [start, end). Chồng lấn luôn là lỗi; khoảng hở là
"chưa biết", không bao giờ được tự điền thành background. Module này không có đường
nào đặt coachConfirmed/goldEligible = true.
"""
from __future__ import annotations

import json
import math
from pathlib import Path
import re

EPS = 0.0015  # bằng độ phân giải 3 chữ số thập phân của mốc ms
DURATION_SLACK_MS = 0.01
STRIKES = ("jab", "cross", "lead_hook", "rear_hook", "lead_uppercut", "rear_uppercut")
TECHNIQUES = STRIKES + ("background", "unclear")
LEAD_REAR = ("lead", "rear", "not_applicable")
STANCES = ("orthodox", "southpaw")
BACKGROUND_TYPES = ("standing_still", "footwork", "guard_change", "glove_adjust", "block",
                    "parry", "feint", "slip_bob", "stance_switch", "other")
QUALITY_FLAGS = ("occluded", "out_of_frame", "multiple_people", "motion_blur",
                 "low_light", "camera_shift", "track_lost", "poor_pose")
UNCLEAR_REASONS = QUALITY_FLAGS + ("other",)
CERTAINTY = ("certain", "uncertain")
EXPECTED_SIDE = {"jab": "lead", "cross": "rear", "lead_hook": "lead", "rear_hook": "rear",
                 "lead_uppercut": "lead", "rear_uppercut": "rear"}
ID_PATTERN = r"[A-Za-z0-9][A-Za-z0-9._-]{0,63}"
ANNOTATION_SCHEMA = "club_timeline_annotation_v1"
PACK_SCHEMA = "club_timeline_pack_v1"


def is_id(value):
    """ID ẩn danh: chữ/số/./_/- , không khoảng trắng, không dấu, không '@'."""
    return isinstance(value, str) and re.fullmatch(ID_PATTERN, value) is not None


def _num(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def _blank(value):
    return value is None or value == ""


def validate_interval(iv, duration_ms):
    issues = []

    def add(code, severity="error"):
        issues.append({"code": code, "severity": severity, "intervalIds": [iv.get("intervalId")]})

    technique = iv.get("technique")
    if technique not in TECHNIQUES:
        add("UNKNOWN_TECHNIQUE")
        return issues
    start, end = iv.get("startTimeMs"), iv.get("endTimeMs")
    if not _num(start) or not _num(end):
        add("TIME_NOT_FINITE")
    else:
        if start < 0:
            add("OUT_OF_VIDEO_RANGE")
        if end <= start:
            add("START_NOT_BEFORE_END")
        if _num(duration_ms) and end > duration_ms + DURATION_SLACK_MS:
            add("OUT_OF_VIDEO_RANGE")
    strike = technique in STRIKES
    peak, lead_rear, stance = iv.get("peakTimeMs"), iv.get("leadRear"), iv.get("stance")
    if strike:
        if stance not in STANCES:
            add("STRIKE_STANCE_REQUIRED")
        if lead_rear not in ("lead", "rear"):
            add("STRIKE_LEAD_REAR_REQUIRED")
        elif EXPECTED_SIDE[technique] != lead_rear:
            add("LEAD_REAR_CLASS_MISMATCH", "warning")
        if not _blank(iv.get("backgroundType")) or not _blank(iv.get("unclearReason")):
            add("FIELD_NOT_APPLICABLE")
        if not _blank(peak):
            if (not _num(peak) or (_num(start) and peak < start - EPS) or (_num(end) and peak > end + EPS)):
                add("PEAK_OUTSIDE_INTERVAL")
    else:
        if not _blank(peak):
            add("PEAK_ONLY_FOR_STRIKE")
        if not _blank(lead_rear) and lead_rear != "not_applicable":
            add("FIELD_NOT_APPLICABLE")
        if not _blank(stance) and stance not in STANCES:
            add("INVALID_STANCE")
        if technique == "background":
            if not _blank(iv.get("unclearReason")):
                add("FIELD_NOT_APPLICABLE")
            if _blank(iv.get("backgroundType")):
                add("BACKGROUND_TYPE_MISSING", "warning")
            elif iv.get("backgroundType") not in BACKGROUND_TYPES:
                add("UNKNOWN_BACKGROUND_TYPE")
        else:
            if not _blank(iv.get("backgroundType")):
                add("FIELD_NOT_APPLICABLE")
            reason = iv.get("unclearReason")
            if _blank(reason) or reason not in UNCLEAR_REASONS:
                add("UNCLEAR_REASON_REQUIRED")
            elif reason == "other" and not (isinstance(iv.get("note"), str) and iv["note"].strip()):
                add("UNCLEAR_REASON_NOTE_REQUIRED")
    flags = iv.get("qualityFlags")
    if not isinstance(flags, list) or any(f not in QUALITY_FLAGS for f in flags):
        add("UNKNOWN_QUALITY_FLAG")
    if iv.get("certainty") not in CERTAINTY:
        add("INVALID_CERTAINTY")
    return issues


def _timed(iv):
    return _num(iv.get("startTimeMs")) and _num(iv.get("endTimeMs")) and iv["endTimeMs"] > iv["startTimeMs"]


def coverage_of(intervals, duration_ms):
    spans = sorted((iv["startTimeMs"], iv["endTimeMs"]) for iv in intervals if _timed(iv))
    limit = duration_ms if _num(duration_ms) else None
    gaps, cursor, covered = [], 0.0, 0.0
    for start, end in spans:
        if start > cursor + EPS:
            gaps.append({"startTimeMs": round(cursor, 3), "endTimeMs": round(start, 3)})
        lo, hi = max(start, cursor), end if limit is None else min(end, limit)
        if hi > lo:
            covered += hi - lo
        cursor = max(cursor, end)
    if limit is not None and limit > cursor + EPS:
        gaps.append({"startTimeMs": round(cursor, 3), "endTimeMs": round(limit, 3)})
    counts = {}
    for iv in intervals:
        counts[iv.get("technique")] = counts.get(iv.get("technique"), 0) + 1
    unclear = sum(iv["endTimeMs"] - iv["startTimeMs"] for iv in intervals
                  if iv.get("technique") == "unclear" and _timed(iv))
    return {"durationMs": limit, "coveredMs": round(covered, 3),
            "gapMs": None if limit is None else round(limit - covered, 3),
            "gaps": gaps, "gapCount": len(gaps), "intervalCount": len(intervals),
            "countsByTechnique": counts, "unclearMs": round(unclear, 3),
            "fullyCovered": limit is not None and not gaps and bool(spans)}


def validate_timeline(intervals, duration_ms=None, declared_complete=False):
    """Trả {errors, warnings, coverage}. Mỗi issue có `code`, `severity`, `intervalIds`."""
    duration_ms = duration_ms if _num(duration_ms) else None
    issues, seen = [], set()
    for iv in intervals:
        interval_id = iv.get("intervalId")
        if not isinstance(interval_id, str) or not interval_id or interval_id in seen:
            issues.append({"code": "DUPLICATE_INTERVAL_ID", "severity": "error", "intervalIds": [interval_id]})
        seen.add(interval_id)
        issues += validate_interval(iv, duration_ms)
    timed = sorted((iv for iv in intervals if _timed(iv)),
                   key=lambda iv: (iv["startTimeMs"], iv["endTimeMs"]))
    for i, first in enumerate(timed):
        for second in timed[i + 1:]:
            if second["startTimeMs"] >= first["endTimeMs"] - EPS:
                break
            overlap = min(first["endTimeMs"], second["endTimeMs"]) - second["startTimeMs"]
            if overlap > EPS:
                issues.append({"code": "OVERLAPPING_INTERVALS", "severity": "error",
                               "intervalIds": [first["intervalId"], second["intervalId"]],
                               "overlapMs": round(overlap, 3)})
    coverage = coverage_of(intervals, duration_ms)
    if declared_complete is True:
        had_error = any(i["severity"] == "error" for i in issues)
        if coverage["gapCount"] or coverage["durationMs"] is None or not coverage["intervalCount"]:
            issues.append({"code": "DECLARED_COMPLETE_WITH_GAPS", "severity": "error", "intervalIds": []})
        if had_error:
            issues.append({"code": "DECLARED_COMPLETE_WITH_ERRORS", "severity": "error", "intervalIds": []})
    return {"errors": [i for i in issues if i["severity"] == "error"],
            "warnings": [i for i in issues if i["severity"] == "warning"], "coverage": coverage}


def check_annotation_document(doc):
    """Từ chối file xuất không đúng schema hoặc tự nhận đã xác thực. Trả validation."""
    problems = []
    if not isinstance(doc, dict) or doc.get("schemaVersion") != ANNOTATION_SCHEMA:
        raise ValueError(f"Không phải file nhãn {ANNOTATION_SCHEMA}")
    for field in ("packId", "sourceVideoId", "videoSha256"):
        if not isinstance(doc.get(field), str) or not doc[field]:
            problems.append(f"thiếu {field}")
    if not is_id(doc.get("annotatorId")):
        problems.append("annotatorId thiếu hoặc không đúng mẫu ID ẩn danh")
    for field in ("durationMs", "fps"):
        if not _num(doc.get(field)) or doc[field] <= 0:
            problems.append(f"{field} không hợp lệ")
    # File xuất công cụ luôn chưa xác thực; file tự nhận đã xác thực là bị sửa tay.
    for field in ("coachConfirmed", "goldEligible", "reviewerAuthenticated", "annotatorIdentityVerified"):
        if doc.get(field) is not False:
            problems.append(f"{field} phải là false (file xuất chưa xác thực)")
    if doc.get("status") != "LOCAL_REVIEW_UNVERIFIED":
        problems.append("status phải là LOCAL_REVIEW_UNVERIFIED")
    if not isinstance(doc.get("intervals"), list):
        problems.append("intervals phải là danh sách")
    if problems:
        raise ValueError("File nhãn không hợp lệ: " + "; ".join(problems))
    validation = validate_timeline(doc["intervals"], doc["durationMs"],
                                   doc.get("annotatorDeclaredTimelineComplete") is True)
    return validation


def load_annotation(path):
    """Đọc file nhãn, kiểm tra lại từ đầu (không tin trường `validation` trong file)."""
    document = json.loads(Path(path).read_text(encoding="utf-8"))
    validation = check_annotation_document(document)
    if validation["errors"]:
        codes = sorted({e["code"] for e in validation["errors"]})
        raise ValueError(f"{Path(path).name}: còn lỗi timeline {codes}; sửa trong công cụ rồi xuất lại")
    return document
