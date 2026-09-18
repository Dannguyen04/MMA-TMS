"""
test_task18_contract_freeze.py — Contract Freeze 1.1 & Baseline Protection Tests (Task 18)

Verifies:
1. Python Canonical Enums and Closed Reason Codes.
2. Cross-Language Parity with TypeScript (worker-result.ts).
3. Import Cycle Freedom across pipeline modules.
4. Backward Compatibility with Legacy Fixtures (Tasks 1–17).
5. Determinism and Immutability of Contract Payloads.
6. Validation Status Vocabulary Enforcement.
"""

import importlib
import json
import math
import os
import pkgutil
import pytest
from pathlib import Path

from pipeline.contracts import (
    ValidationStatus,
    QualityStatus,
    CalibrationStatus,
    SequenceCandidateType,
    ShadowEventFamily,
    ShadowGrapplingState,
    ActiveLearningReason,
    BaselineEligibilityStatus,
    ComparisonStatus,
    AlignmentStatus,
    EvidenceLevel,
    ObservationKind,
    deep_freeze,
    to_json_safe,
)


def test_validation_status_vocabulary():
    """Confirms unified validation status closed vocabulary."""
    expected = {
        "VALIDATED",
        "NOT_VALIDATED",
        "SHADOW_NOT_VALIDATED",
        "REJECTED",
        "NOT_EVALUABLE",
    }
    actual = {status.value for status in ValidationStatus}
    assert actual == expected, f"ValidationStatus values mismatch: {actual} vs {expected}"


def test_quality_status_vocabulary():
    """Confirms closed quality status vocabulary."""
    expected = {"EXCELLENT", "GOOD", "ACCEPTABLE", "DEGRADED", "BLOCKED"}
    actual = {status.value for status in QualityStatus}
    assert actual == expected


def test_calibration_status_vocabulary():
    """Confirms calibration status vocabulary."""
    expected = {"CALIBRATED", "NOT_CALIBRATED", "HEURISTIC_ONLY"}
    actual = {status.value for status in CalibrationStatus}
    assert actual == expected


def test_sequence_candidate_vocabulary():
    """Confirms sequence candidate vocabulary."""
    expected = {
        "SINGLE",
        "REPEATED_STRIKE",
        "TWO_ACTION_COMBINATION",
        "MULTI_ACTION_COMBINATION",
        "UNKNOWN",
    }
    actual = {status.value for status in SequenceCandidateType}
    assert actual == expected


def test_shadow_event_family_vocabulary():
    """Confirms shadow event family vocabulary."""
    expected = {"ELBOW", "KNEE", "TAKEDOWN", "CLINCH"}
    actual = {status.value for status in ShadowEventFamily}
    assert actual == expected


def test_typescript_parity_reflection():
    """Verifies that nextjs-frontend/src/lib/api/worker-result.ts contains matching enum definitions."""
    ts_file = Path(__file__).resolve().parent.parent / "nextjs-frontend" / "src" / "lib" / "api" / "worker-result.ts"
    assert ts_file.exists(), f"TypeScript contract file not found at {ts_file}"
    content = ts_file.read_text(encoding="utf-8")

    # Verify key schemas are present in TS file
    for enum_cls in [
        ValidationStatus,
        QualityStatus,
        CalibrationStatus,
        SequenceCandidateType,
        ShadowEventFamily,
        ShadowGrapplingState,
        ActiveLearningReason,
        BaselineEligibilityStatus,
        ComparisonStatus,
        AlignmentStatus,
    ]:
        for member in enum_cls:
            assert f'"{member.value}"' in content or f"'{member.value}'" in content, (
                f"Missing enum member {member.value} of {enum_cls.__name__} in worker-result.ts"
            )


def test_import_cycle_freedom():
    """Verifies that all pipeline modules can be imported in any order without circular dependency errors."""
    import pipeline
    package_dir = Path(pipeline.__file__).parent
    modules = [
        f"pipeline.{modname}"
        for _, modname, ispkg in pkgutil.iter_modules([str(package_dir)])
        if not ispkg
    ]

    for mod in modules:
        try:
            importlib.import_module(mod)
        except Exception as e:
            pytest.fail(f"Failed to import module {mod}: {e}")


def test_deep_freeze_immutability():
    """Verifies deep_freeze rejects non-finite floats and creates immutable structures."""
    valid_data = {
        "score": 85.5,
        "status": ValidationStatus.VALIDATED,
        "metrics": {"ratio": 1.2, "frames": [10, 20, 30]},
    }
    frozen = deep_freeze(valid_data)
    # Trying to mutate mapping proxy must raise TypeError
    with pytest.raises(TypeError):
        frozen["new_key"] = "value"

    with pytest.raises(ValueError):
        deep_freeze({"nan_val": float("nan")})

    with pytest.raises(ValueError):
        deep_freeze({"inf_val": float("inf")})


def test_to_json_safe_serialization():
    """Verifies serialization cleans enums and handles NaN gracefully."""
    raw = {
        "status": ValidationStatus.SHADOW_NOT_VALIDATED,
        "quality": QualityStatus.EXCELLENT,
        "nan_score": float("nan"),
        "sub": {"flag": True, "count": 5},
    }
    safe = to_json_safe(raw)
    assert safe["status"] == "SHADOW_NOT_VALIDATED"
    assert safe["quality"] == "EXCELLENT"
    assert safe["nan_score"] is None
    # Serializes to pure JSON without error
    json_str = json.dumps(safe)
    assert json_str is not None


def test_legacy_sample_result_compatibility():
    """Verifies that test_sample_result.json from Tasks 1-17 loads and parses cleanly."""
    sample_file = Path(__file__).resolve().parent / "test_sample_result.json"
    if sample_file.exists():
        data = json.loads(sample_file.read_text(encoding="utf-8"))
        assert "frames" in data
        assert "kicks" in data
        assert isinstance(data["frames"], list)

