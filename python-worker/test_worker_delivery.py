"""Delivery ordering tests: no network, storage, Redis, or model inference."""
import json
from unittest.mock import Mock

import httpx
import pytest


@pytest.mark.parametrize("persist_fails", [False, True])
def test_structured_evidence_precedes_done(monkeypatch, tmp_path, persist_fails):
    monkeypatch.setenv("TMP_DIR", str(tmp_path))
    import worker
    monkeypatch.setattr(worker, "TMP_DIR", tmp_path)
    monkeypatch.setattr(worker.time, "sleep", lambda _: None)
    events = []
    result = {"summary": {}, "actions": [], "analysisQuality": {"status": "pass"}}
    received = {}
    def analyze(**kwargs):
        received.update(kwargs)
        return result
    monkeypatch.setattr(worker, "process_video", analyze)
    monkeypatch.setattr(worker, "get_pose_model", lambda: object())
    monkeypatch.setattr(worker, "upload_to_supabase", lambda *_: "https://example.test/result.json")
    monkeypatch.setattr(worker, "notify_nestjs", lambda job, status, **kwargs: events.append((status, kwargs)))

    def persist(url, **kwargs):
        events.append(("persist", kwargs["json"]))
        assert url.endswith("/coaching/results")
        if persist_fails:
            raise httpx.ConnectError("Test storage unavailable")
        return httpx.Response(201, request=httpx.Request("POST", url))

    monkeypatch.setattr(worker.httpx, "post", persist)
    redis = Mock()
    declared_context = {"exerciseId": "assigned-exercise", "protocolId": "upper_body_v1", "purpose": "longitudinal_monitoring"}
    redis.hget.return_value = json.dumps({"jobId": "job", "videoUrl": "local.mp4", "exerciseContext": declared_context})
    worker.process_job(redis, "queue-id")
    assert received["exercise_context"] == declared_context
    statuses = [event[0] for event in events]
    if persist_fails:
        assert statuses == ["PROCESSING", "persist", "persist", "persist", "FAILED"]
        redis.rpush.assert_called_once_with(worker.FAILED_KEY, "queue-id")
    else:
        assert statuses == ["PROCESSING", "persist", "DONE"]
        assert events[-1][1]["score"] is None
        redis.rpush.assert_called_once_with(worker.COMPLETED_KEY, "queue-id")
