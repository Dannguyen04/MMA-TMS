from punch_event_detector_v2 import (
    build_heavy_bag_punch_results,
    detect_heavy_bag_punch_candidates,
)


def _frame(left_extension=0.08, right_extension=0.08):
    points = [{"x": 0.5, "y": 0.5, "conf": 0.95} for _ in range(17)]
    # Stable shoulders and usable elbow geometry.
    points[5].update(x=0.46, y=0.38)
    points[6].update(x=0.54, y=0.38)
    points[7].update(x=0.40, y=0.40)
    points[8].update(x=0.60, y=0.40)
    points[9].update(x=0.46 - left_extension, y=0.39)
    points[10].update(x=0.54 + right_extension, y=0.39)
    points[11].update(x=0.47, y=0.62)
    points[12].update(x=0.53, y=0.62)
    points[13].update(x=0.47, y=0.78)
    points[14].update(x=0.53, y=0.78)
    points[15].update(x=0.47, y=0.93)
    points[16].update(x=0.53, y=0.93)
    return {"landmarks": points}


def test_detects_fast_alternating_heavy_bag_combo_without_full_guard_reset():
    frames = [_frame() for _ in range(32)]
    for peak, arm in ((8, "left"), (13, "right"), (18, "left")):
        for offset, extension in ((-2, 0.12), (-1, 0.17), (0, 0.23), (1, 0.17), (2, 0.12)):
            if arm == "left":
                frames[peak + offset] = _frame(left_extension=extension)
            else:
                frames[peak + offset] = _frame(right_extension=extension)

    candidates = detect_heavy_bag_punch_candidates(frames)

    assert [(item.arm, item.impact_frame) for item in candidates] == [
        ("left", 8),
        ("right", 13),
        ("left", 18),
    ]
    results = build_heavy_bag_punch_results(frames, fps=25.0)
    assert [item.impact_frame for item in results] == [8, 13, 18]


def test_rejects_small_horizontal_pose_jitter():
    frames = [_frame(left_extension=0.08 + (index % 3) * 0.005) for index in range(30)]
    assert detect_heavy_bag_punch_candidates(frames) == []


def test_collapses_simultaneous_cross_arm_pose_peak():
    frames = [_frame() for _ in range(20)]
    for offset, extension in ((-1, 0.17), (0, 0.23), (1, 0.17)):
        frames[10 + offset] = _frame(left_extension=extension, right_extension=extension - 0.01)
    candidates = detect_heavy_bag_punch_candidates(frames)
    assert len(candidates) == 1
    assert candidates[0].arm == "left"
