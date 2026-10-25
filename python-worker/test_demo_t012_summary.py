import json

import pytest

from demo_t012_summary import (
    LIMITATION, format_time, load_truth, render_summary, validate_contract,
)
from evaluate_punch_recall import GroundTruthInterval


def result_with(*frames):
    return {
        "schemaVersion": "1.0.0",
        "meta": {"fps": 30, "totalFrames": 120, "durationMs": 4000},
        "frames": [], "kicks": [],
        "punches": [{"impactFrame": f, "arm": "left"} for f in frames],
    }


@pytest.mark.parametrize("frame,fps,expected", [
    (0, 30, "00:00.0"), (45, 30, "00:01.5"),
    (1799, 30, "01:00.0"), (18000, 30, "10:00.0"),
])
def test_time(frame, fps, expected):
    assert format_time(frame, fps) == expected


@pytest.mark.parametrize("fps", [0, -1, float("nan"), float("inf")])
def test_invalid_fps(fps):
    with pytest.raises(ValueError):
        format_time(10, fps)


def test_matching_tolerance_duplicates_and_unmatched():
    truth = [GroundTruthInterval(10, 10, id="a"), GroundTruthInterval(20, 20, id="b")]
    text = render_summary(result_with(7, 10, 23, 24), truth)
    assert "Số nhãn bắt được: 2/2 (100.0%)" in text
    assert "Không khớp một-một: 2; nằm ngoài mọi nhãn (±3 khung): 1" in text
    assert len([line for line in text.splitlines() if line.startswith("| ")]) == 6
    assert "| 2 | 00:00.3 | 10 | left | a (10–10) |" in text
    assert "| 3 | 00:00.8 | 23 | left | b (20–20) |" in text
    assert text.endswith(LIMITATION + "\n")


def test_matching_requires_global_assignment():
    truth = [GroundTruthInterval(10, 10, id="a"), GroundTruthInterval(14, 14, id="b")]
    text = render_summary(result_with(11, 7), truth)
    assert "| 1 | 00:00.4 | 11 | left | b (14–14) |" in text
    assert "| 2 | 00:00.2 | 7 | left | a (10–10) |" in text


def test_existing_label_readers(tmp_path):
    csv = tmp_path / "labels.csv"
    csv.write_text("start_frame,end_frame,class\n10,12,Punch\n", encoding="utf-8")
    assert load_truth(csv)[0].start_frame == 10
    path = tmp_path / "labels.json"
    path.write_text(json.dumps({"events": [
        {"label": "PUNCH", "evaluation_scope": "IN_SCOPE", "start_frame": 10, "end_frame": 12},
        {"label": "PUNCH", "evaluation_scope": "OUT_OF_SCOPE", "start_frame": 15},
    ]}), encoding="utf-8")
    assert len(load_truth(path)) == 1


@pytest.mark.parametrize("key,value", [
    ("fps", -1), ("durationMs", float("inf")), ("fps", True), ("totalFrames", 1.5),
])
def test_contract_rejects_invalid_numbers(key, value):
    result = result_with()
    result["meta"][key] = value
    with pytest.raises(ValueError):
        validate_contract(result)


def test_empty_result_is_not_a_failed_run():
    text = render_summary(result_with(), [])
    assert "Tổng phát hiện: 0" in text
    with pytest.raises((KeyError, ValueError)):
        render_summary({"error": "failed before output"}, [])
