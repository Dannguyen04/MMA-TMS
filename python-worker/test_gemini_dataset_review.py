import copy
import json

import pytest
import requests

from gemini_dataset_review import make_prompt, validate_reply, request_json, compare_review


def fixture():
    tasks = [{"sampleId": "vid_01_cross_heavybag-review-0001", "startTimeMs": 2000, "endTimeMs": 4000,
              "suggestedTechnique": "SECRET_PRIOR_LABEL"}]
    prompt, windows = make_prompt(tasks, 10000)
    response = {"reviews": [{"requestId": "window-000", "decision": "single_action", "observedStance": "unknown",
        "observation": "Visible straight arm motion", "events": [{"technique": "unknown", "startTimeMs": 2100,
        "endTimeMs": 3800, "evidence": "Arm extends then retracts"}]}]}
    return prompt, windows, response


def test_prompt_does_not_leak_prior_label_or_filename():
    prompt, windows, _ = fixture()
    assert "SECRET_PRIOR_LABEL" not in prompt and "heavybag" not in prompt
    assert windows[0]["contextStartTimeMs"] == 1250


def test_valid_reply_preserved_without_approval():
    _, windows, response = fixture()
    original = copy.deepcopy(response)
    assert len(validate_reply(response, windows)) == 1
    assert response == original


def test_multi_action_agreement_is_separate_from_technique_agreement():
    assert compare_review({"candidateTechnique": None, "decision": "multiple_actions"},
                          {"decision": "multiple_actions", "events": []}) == "AGREE_MULTIPLE_ACTIONS_ONLY"
    prior = {"candidateTechnique": "lead_uppercut", "decision": "candidate"}
    assert compare_review(prior, {"decision": "single_action", "events": [{"technique": "rear_uppercut"}]}) == "DISAGREE_ON_LABEL"
    assert compare_review(prior, {"decision": "single_action", "events": [{"technique": "unknown"}]}) == "UNRESOLVED"


@pytest.mark.parametrize("mutation", ["outside", "nan", "approval", "duplicate", "no_action", "missing", "unsupported"])
def test_invalid_gemini_outputs_rejected(mutation):
    _, windows, response = fixture()
    row = response["reviews"][0]
    if mutation == "outside": row["events"][0]["endTimeMs"] = 9000
    if mutation == "nan": row["events"][0]["startTimeMs"] = float("nan")
    if mutation == "approval": row["coachConfirmed"] = True
    if mutation == "duplicate": response["reviews"].append(copy.deepcopy(row))
    if mutation == "no_action": row["decision"] = "no_action"
    if mutation == "missing": response["reviews"] = []
    if mutation == "unsupported": row["events"][0]["technique"] = "perfect_punch"
    with pytest.raises(ValueError): validate_reply(response, windows)


def test_http_failure_does_not_expose_key_or_response_body():
    class Session:
        def request(self, *args, **kwargs):
            assert kwargs["headers"]["x-goog-api-key"] == "secret-test-key"
            assert kwargs["allow_redirects"] is False
            return type("Response", (), {"status_code": 401, "text": "secret-test-key"})()
    with pytest.raises(RuntimeError) as error:
        request_json(Session(), "POST", "https://generativelanguage.googleapis.com/test", "secret-test-key", {})
    assert "401" in str(error.value) and "secret-test-key" not in str(error.value)


def test_network_error_is_sanitized_without_retry():
    class Session:
        calls = 0
        def request(self, *args, **kwargs):
            self.calls += 1
            raise requests.ConnectionError("secret-test-key")
    session = Session()
    with pytest.raises(RuntimeError) as error:
        request_json(session, "GET", "https://generativelanguage.googleapis.com/test", "secret-test-key")
    assert session.calls == 1 and "secret-test-key" not in str(error.value)
