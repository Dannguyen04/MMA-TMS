"""Regression checks for model reuse and rounded frame timestamps."""
from unittest.mock import Mock

import pytest

from pipeline.temporal_phases import segment_punch_phases, segment_kick_phases


@pytest.mark.parametrize("segment", [segment_punch_phases, segment_kick_phases])
def test_peak_and_retraction_on_same_frame_share_timestamp(segment):
    # Independently rounded window start and impact used to differ by 0.1ms.
    sequence = segment(window_start_frame=397, window_end_frame=401, fps=30,
                       window_start_time_ms=13233.3, window_end_time_ms=13366.7,
                       impact_frame=401, impact_time_ms=13366.7)
    assert sequence.boundaries["peak"].time_ms == 13366.7
    assert sequence.boundaries["retraction"].time_ms == 13366.7


@pytest.mark.parametrize("segment", [segment_punch_phases, segment_kick_phases])
def test_actual_time_reversal_is_still_rejected(segment):
    with pytest.raises(ValueError, match="Monotonic time ordering"):
        segment(window_start_frame=397, window_end_frame=401, fps=30,
                window_start_time_ms=13233.3, window_end_time_ms=13367.0,
                impact_frame=401, impact_time_ms=13367.0)


def test_worker_reuses_model_until_configuration_changes(monkeypatch):
    import worker
    factory = Mock(side_effect=[object(), object()])
    monkeypatch.setattr(worker, "YOLO", factory)
    monkeypatch.setattr(worker, "_pose_model", None)
    monkeypatch.setattr(worker, "_pose_model_name", None)
    monkeypatch.setattr(worker, "YOLO_MODEL", "nano.pt")
    first = worker.get_pose_model()
    assert worker.get_pose_model() is first
    factory.assert_called_once_with("nano.pt")
    monkeypatch.setattr(worker, "YOLO_MODEL", "other.pt")
    assert worker.get_pose_model() is not first
    assert factory.call_count == 2
