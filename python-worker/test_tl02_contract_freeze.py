"""
test_tl02_contract_freeze.py — Contract Freeze & Cross-Stack Parity Tests (TL-02)

Verifies:
1. ActionMetricItem supports provenance fields: evidenceConfidence, framesUsed, source, methodVersion.
2. NaN and Infinity are strictly rejected from contract payloads.
3. Closed enum validation for action properties and assessment statuses.
4. Parity and consistency between legacy punches/kicks and actions arrays.
"""

import math
import pytest
from action_result import (
    ActionMetricItem,
    ActionResult,
    ActionConfidence,
    ActionPhases,
    ActionAssessment,
    ActionReview,
    extract_metric,
)
from pipeline.contracts import validate_contract_payload


def test_action_metric_item_provenance_serialization():
    """Verify ActionMetricItem serializes provenance fields cleanly."""
    metric = ActionMetricItem(
        value=85.5,
        unit="degree",
        confidence=0.92,
        evidenceConfidence=0.88,
        framesUsed=[12, 13, 14],
        source="kinematic_features",
        methodVersion="1.0.0",
    )
    d = metric.to_dict()
    assert d["value"] == 85.5
    assert d["unit"] == "degree"
    assert d["confidence"] == 0.92
    assert d["evidenceConfidence"] == 0.88
    assert d["framesUsed"] == [12, 13, 14]
    assert d["source"] == "kinematic_features"
    assert d["methodVersion"] == "1.0.0"


def test_action_metric_item_handles_nan_and_inf():
    """ActionMetricItem converts non-finite floats to None in to_dict."""
    nan_metric = ActionMetricItem(value=float("nan"), unit="degree", confidence=0.5)
    assert nan_metric.to_dict()["value"] is None

    inf_metric = ActionMetricItem(value=float("inf"), unit="degree", confidence=float("inf"))
    assert inf_metric.to_dict()["value"] is None
    assert inf_metric.to_dict()["confidence"] is None


def test_extract_metric_rejects_nan():
    """extract_metric safely rejects NaN without crashing."""
    class Dummy:
        bad_val = float("nan")

    item = extract_metric(Dummy(), "bad_val", unit="degree")
    assert item.value is None
    assert item.confidence is None


def test_validate_contract_payload_rejects_nan():
    """validate_contract_payload strictly rejects payloads with NaN."""
    payload = {
        "meta": {"fps": 30.0, "totalFrames": 100, "durationMs": 3333.3},
        "actions": [
            {
                "id": "action_001",
                "sourceActionId": "punch_1",
                "family": "punch",
                "technique": "jab",
                "attackingSide": "left",
                "limbRole": "lead",
                "stance": "orthodox",
                "phases": {"startFrame": 0, "endFrame": 10, "startTimeMs": 0.0, "endTimeMs": 333.3, "impactType": "peak_extension_proxy"},
                "confidence": {"detection": None, "classification": 0.9, "assessment": 0.8},
                "metrics": {
                    "maxElbowAngle": {"value": float("nan"), "unit": "degree"}
                },
                "assessment": {"score": 80, "grade": "GOOD", "status": "good"},
            }
        ]
    }
    with pytest.raises(ValueError, match="Non-finite float"):
        validate_contract_payload(payload)


def test_validate_contract_payload_rejects_invalid_enums():
    """validate_contract_payload rejects invalid enum values."""
    payload = {
        "actions": [
            {
                "id": "action_001",
                "sourceActionId": "punch_1",
                "family": "laser_beam",  # Invalid family
                "technique": "jab",
                "attackingSide": "left",
                "limbRole": "lead",
                "stance": "orthodox",
                "phases": {},
                "assessment": {"status": "good"},
            }
        ]
    }
    with pytest.raises(ValueError, match="laser_beam"):
        validate_contract_payload(payload)


def test_validate_contract_payload_enforces_legacy_parity():
    """validate_contract_payload enforces exact score and count match between punches/kicks and actions."""
    valid_payload = {
        "meta": {"fps": 30.0, "totalFrames": 60, "durationMs": 2000.0},
        "actions": [
            {
                "id": "action_001",
                "sourceActionId": "punch_1",
                "family": "punch",
                "technique": "jab",
                "attackingSide": "left",
                "limbRole": "lead",
                "stance": "orthodox",
                "phases": {"startFrame": 5, "endFrame": 15, "startTimeMs": 166.7, "endTimeMs": 500.0, "impactType": "peak_extension_proxy"},
                "assessment": {"score": 85, "grade": "GOOD", "status": "good"},
            }
        ],
        "punches": [
            {"score": 85, "grade": "GOOD", "punchType": "jab", "startTimeMs": 166.7, "endTimeMs": 500.0}
        ],
        "kicks": []
    }
    # Valid payload should pass
    validated = validate_contract_payload(valid_payload)
    assert validated["meta"]["fps"] == 30.0

    # Mismatch score should fail
    invalid_payload = {
        "meta": {"fps": 30.0, "totalFrames": 60, "durationMs": 2000.0},
        "actions": [
            {
                "id": "action_001",
                "sourceActionId": "punch_1",
                "family": "punch",
                "technique": "jab",
                "attackingSide": "left",
                "limbRole": "lead",
                "stance": "orthodox",
                "phases": {},
                "assessment": {"score": 85, "grade": "GOOD", "status": "good"},
            }
        ],
        "punches": [
            {"score": 70, "grade": "FAIR"}  # Mismatched score 70 != 85
        ]
    }
    with pytest.raises(ValueError, match="Punch score mismatch"):
        validate_contract_payload(invalid_payload)

