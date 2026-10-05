from types import SimpleNamespace

from kick_event_detector_v2 import merge_kick_events, recover_kick_events, suppress_punches_during_kicks


def _frame(active_leg="none", angle=None, ankle_x=0.52):
    points = [{"x": 0.5, "y": 0.5, "conf": 0.95} for _ in range(17)]
    points[12].update(x=0.52, y=0.62)
    points[16].update(x=ankle_x, y=0.72)
    return {"activeLeg": active_leg, "kneeAngle": angle, "landmarks": points}


def test_recovers_contiguous_kick_without_fabricating_score_or_findings():
    frames = [_frame() for _ in range(20)]
    for idx, angle in zip(range(5, 11), [105, 130, 155, 120, 80, 65]):
        frames[idx] = _frame("right", angle, 0.52 + (idx - 5) * 0.03)
    kicks = recover_kick_events(frames, 25.0)
    assert len(kicks) == 1
    assert kicks[0].score is None
    assert kicks[0].findings == []
    assert kicks[0].impact_time_ms == 280.0


def test_rejects_short_or_geometrically_implausible_leg_noise():
    frames = [_frame() for _ in range(15)]
    for idx in range(4, 7):
        frames[idx] = _frame("right", 5.0)
    assert recover_kick_events(frames, 25.0) == []


def test_continuous_side_view_motion_tolerates_brief_active_leg_swap():
    frames = [_frame() for _ in range(20)]
    samples = [("left", 158), ("right", 145), ("right", 139), ("left", 101), ("left", 95), ("left", 92)]
    for idx, (leg, angle) in enumerate(samples, 5):
        frames[idx] = _frame(leg, angle, 0.52 + (idx - 5) * 0.02)
    kicks = recover_kick_events(frames, 25.0)
    assert len(kicks) == 1
    assert kicks[0].active_leg == "left"


def test_merges_recovered_event_with_nearby_legacy_event():
    legacy = [SimpleNamespace(impact_time_ms=1000.0)]
    recovered = [SimpleNamespace(impact_time_ms=1120.0)]
    assert merge_kick_events(legacy, recovered) == legacy


def test_suppresses_punch_in_kick_lead_window_and_collapses_duplicate_labels():
    punches = [
        SimpleNamespace(impact_time_ms=760.0, max_elbow_angle=150.0),
        SimpleNamespace(impact_time_ms=4000.0, max_elbow_angle=149.0),
        SimpleNamespace(impact_time_ms=5360.0, max_elbow_angle=116.0),
        SimpleNamespace(impact_time_ms=5400.0, max_elbow_angle=156.0),
    ]
    kicks = [SimpleNamespace(start_time_ms=1040.0, end_time_ms=1440.0)]
    kept = suppress_punches_during_kicks(punches, kicks)
    assert [item.impact_time_ms for item in kept] == [4000.0, 5400.0]
