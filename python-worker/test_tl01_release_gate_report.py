"""
test_tl01_release_gate_report.py — Comprehensive Unit & Adversarial Tests for Task TL-01.

Requirements verified:
1. Default state is NOT_RUN when artifact is absent.
2. Malformed input (arbitrary objects, wrong types) does not crash and yields NOT_EVALUABLE.
3. Root artifact provenance: empty ID, empty revision, invalid hash, unsupported schema yield NOT_EVALUABLE.
4. Strict UTC timestamps: naive datetimes and non-zero UTC offsets (+07:00) yield NOT_EVALUABLE.
5. Freshness & clock skew: future timestamps >10s and stale artifacts yield NOT_EVALUABLE.
6. Revision consistency: all child artifacts must match root source_revision.
7. Test counts type strictness: float (1.0) and bool (True) counts are rejected with NOT_EVALUABLE.
8. subtests_passed is strictly None or non-negative int and not added to total.
9. Skipped tests fail closed unless allow_skipped_tests=True.
10. Required tasks: missing task, unknown task, and duplicate tasks (in sequence) fail closed.
11. Status closed enums: unknown implementation/validation statuses (e.g. BANANA, PEACH) yield NOT_EVALUABLE.
12. Implementation vs validation status separation: NOT_IMPLEMENTED, NOT_VALIDATED, FAILED correctly propagated.
13. tasks_18_30_modules_evaluated is single-source-of-truth derived.
14. Product deployment gate cannot be opened by caller assertions alone in TL-01.
15. Immutability: input objects and mappings are not mutated.
16. Deterministic canonical JSON serialization verified across two independent evaluator runs.
17. Full valid suite yields READY for AI pipeline.
"""

from datetime import datetime, timezone, timedelta
import json
import math
import pytest
from typing import Mapping, Sequence

from pipeline.vertical_slice_integration import (
    AdvancedAIOrchestrator,
    ReleaseGateReport,
    ReleaseGateInput,
    TestSummaryArtifact,
    ModuleGateArtifact,
    TrustBoundaryArtifact,
    REQUIRED_AI_GATE_TASK_IDS,
    TASK_NAMES,
    ALLOWED_IMPLEMENTATION_STATUSES,
    ALLOWED_VALIDATION_STATUSES,
)

VALID_HASH = "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
VALID_REV = "abcdef0123456789abcdef0123456789abcdef01"
FIXED_NOW = datetime(2026, 9, 21, 12, 0, 0, tzinfo=timezone.utc)
FIXED_NOW_ISO = FIXED_NOW.isoformat()


def make_fixed_clock(dt: datetime = FIXED_NOW):
    return lambda: dt


def build_valid_test_summary(
    total: int = 604,
    passed: int = 604,
    failed: int = 0,
    skipped: int = 0,
    errors: int = 0,
    subtests: int = 105,
    timestamp: str = FIXED_NOW_ISO,
    source_rev: str = VALID_REV,
    artifact_hash: str = VALID_HASH,
) -> TestSummaryArtifact:
    return TestSummaryArtifact(
        artifact_id="test_run_001",
        artifact_type="test_execution_summary",
        schema_version="1.0.0",
        generated_at=timestamp,
        source_revision=source_rev,
        artifact_hash=artifact_hash,
        total_tests=total,
        passed=passed,
        failed=failed,
        skipped=skipped,
        errors=errors,
        subtests_passed=subtests,
    )


def build_valid_module_evaluations(
    default_impl: str = "IMPLEMENTED",
    default_val: str = "VALIDATED",
    timestamp: str = FIXED_NOW_ISO,
    source_rev: str = VALID_REV,
) -> dict[str, ModuleGateArtifact]:
    mods = {}
    for task_id in REQUIRED_AI_GATE_TASK_IDS:
        mods[task_id] = ModuleGateArtifact(
            artifact_id=f"mod_art_{task_id.lower().replace(' ', '_')}",
            artifact_type="module_gate_artifact",
            schema_version="1.0.0",
            generated_at=timestamp,
            source_revision=source_rev,
            artifact_hash=VALID_HASH,
            task_id=task_id,
            implementation_status=default_impl,
            validation_status=default_val,
        )
    return mods
 
 
def build_valid_trust_boundary(
    artifact_id: str = "trust_001",
    artifact_type: str = "trust_boundary_artifact",
    schema_version: str = "1.0.0",
    generated_at: str = FIXED_NOW_ISO,
    source_revision: str = VALID_REV,
    artifact_hash: str = VALID_HASH,
    credentials_rotated: bool = True,
    authoritative_manifest_bound: bool = True,
    production_keys_configured: bool = True,
) -> TrustBoundaryArtifact:
    return TrustBoundaryArtifact(
        artifact_id=artifact_id,
        artifact_type=artifact_type,
        schema_version=schema_version,
        generated_at=generated_at,
        source_revision=source_revision,
        artifact_hash=artifact_hash,
        credentials_rotated=credentials_rotated,
        authoritative_manifest_bound=authoritative_manifest_bound,
        production_keys_configured=production_keys_configured,
    )


def build_valid_gate_input(
    test_summary=None,
    module_evaluations=None,
    trust_boundary=None,
    max_age: float = None,
    allow_skipped: bool = False,
    source_rev: str = VALID_REV,
    timestamp: str = FIXED_NOW_ISO,
    artifact_id: str = "gate_input_001",
    artifact_hash: str = VALID_HASH,
) -> ReleaseGateInput:
    return ReleaseGateInput(
        artifact_id=artifact_id,
        schema_version="1.0.0",
        artifact_type="release_gate_input",
        generated_at=timestamp,
        source_revision=source_rev,
        artifact_hash=artifact_hash,
        test_summary=test_summary if test_summary is not None else build_valid_test_summary(source_rev=source_rev),
        module_evaluations=module_evaluations if module_evaluations is not None else build_valid_module_evaluations(source_rev=source_rev),
        trust_boundary=trust_boundary,
        max_artifact_age_seconds=max_age,
        allow_skipped_tests=allow_skipped,
    )


def eval_report(orchestrator: AdvancedAIOrchestrator, inp=None, clock=None) -> ReleaseGateReport:
    if clock is None:
        clock = make_fixed_clock()
    return orchestrator.generate_release_gate_report(inp, clock=clock)


# --- 1. Absent Input Default State ---
def test_default_absent_artifact_yields_not_run():
    orchestrator = AdvancedAIOrchestrator()
    report = eval_report(orchestrator, inp=None)

    assert isinstance(report, ReleaseGateReport)
    assert report.ai_pipeline_readiness == "NOT_RUN"
    assert report.product_deployment_readiness == "DISABLED_PENDING_TRUST_BOUNDARY"
    assert "NOT_RUN" in report.tasks_1_17_regression_check
    assert report.tasks_18_30_modules_evaluated == {}
    assert "No gate input artifact" in report.notes


# --- 2. Malformed / Arbitrary Input Fail-Closed ---
@pytest.mark.parametrize("bad_input", [
    "string_not_artifact",
    12345,
    {},
    {"schemaVersion": "invalid"},
    [],
])
def test_malformed_input_arbitrary_object_does_not_crash(bad_input):
    orchestrator = AdvancedAIOrchestrator()
    report = eval_report(orchestrator, inp=bad_input)

    assert isinstance(report, ReleaseGateReport)
    assert report.ai_pipeline_readiness == "NOT_EVALUABLE"
    assert report.product_deployment_readiness == "NOT_EVALUABLE"
    assert "NOT_EVALUABLE" in report.tasks_1_17_regression_check


# --- 3. Root Artifact Provenance & Schema Validation ---
def test_unsupported_schema_version_yields_not_evaluable():
    orchestrator = AdvancedAIOrchestrator()
    inp = ReleaseGateInput(
        artifact_id="art_1",
        schema_version="2.0.0",  # unsupported
        artifact_type="release_gate_input",
        generated_at=FIXED_NOW_ISO,
        source_revision=VALID_REV,
        artifact_hash=VALID_HASH,
        test_summary=build_valid_test_summary(),
        module_evaluations=build_valid_module_evaluations(),
    )
    report = eval_report(orchestrator, inp)
    assert report.ai_pipeline_readiness == "NOT_EVALUABLE"
    assert "Unsupported schema version" in report.notes


@pytest.mark.parametrize("bad_hash", [
    "not_a_hash",
    "md5:12345",
    "sha256:too_short",
    "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789ABCDEF",  # uppercase
    "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0", # 65 chars
])
def test_invalid_hash_format_yields_not_evaluable(bad_hash):
    orchestrator = AdvancedAIOrchestrator()
    inp = build_valid_gate_input(artifact_hash=bad_hash)
    report = eval_report(orchestrator, inp)
    assert report.ai_pipeline_readiness == "NOT_EVALUABLE"
    assert "Invalid artifact hash format" in report.notes


def test_root_empty_artifact_id_yields_not_evaluable():
    orchestrator = AdvancedAIOrchestrator()
    inp = build_valid_gate_input(artifact_id="")
    report = eval_report(orchestrator, inp)
    assert report.ai_pipeline_readiness == "NOT_EVALUABLE"
    assert "artifact_id" in report.notes.lower()


def test_root_empty_source_revision_yields_not_evaluable():
    orchestrator = AdvancedAIOrchestrator()
    inp = build_valid_gate_input(source_rev="")
    report = eval_report(orchestrator, inp)
    assert report.ai_pipeline_readiness == "NOT_EVALUABLE"
    assert "source_revision" in report.notes.lower()


def test_root_missing_timestamp_yields_not_evaluable():
    orchestrator = AdvancedAIOrchestrator()
    inp = build_valid_gate_input(timestamp="")
    report = eval_report(orchestrator, inp)
    assert report.ai_pipeline_readiness == "NOT_EVALUABLE"
    assert "timestamp" in report.notes.lower()


# --- 4. Strict UTC Timestamps & Freshness ---
def test_missing_timestamp_when_freshness_enabled_yields_not_evaluable():
    orchestrator = AdvancedAIOrchestrator()
    test_sum = build_valid_test_summary(timestamp="")
    inp = build_valid_gate_input(test_summary=test_sum, max_age=3600.0)
    report = eval_report(orchestrator, inp, clock=make_fixed_clock())
    assert report.ai_pipeline_readiness == "NOT_EVALUABLE"
    assert "timestamp" in report.notes.lower()


def test_naive_timestamp_without_timezone_yields_not_evaluable():
    orchestrator = AdvancedAIOrchestrator()
    # Naive timestamp without timezone
    test_sum = build_valid_test_summary(timestamp="2026-09-21T12:00:00")
    inp = build_valid_gate_input(test_summary=test_sum, max_age=3600.0)
    report = eval_report(orchestrator, inp, clock=make_fixed_clock())
    assert report.ai_pipeline_readiness == "NOT_EVALUABLE"
    assert "UTC" in report.notes or "timezone" in report.notes.lower()


def test_non_zero_utc_offset_timestamp_yields_not_evaluable():
    orchestrator = AdvancedAIOrchestrator()
    # +07:00 offset is non-UTC
    test_sum = build_valid_test_summary(timestamp="2026-09-21T19:00:00+07:00")
    inp = build_valid_gate_input(test_summary=test_sum, max_age=3600.0)
    report = eval_report(orchestrator, inp, clock=make_fixed_clock())
    assert report.ai_pipeline_readiness == "NOT_EVALUABLE"
    assert "UTC" in report.notes or "timezone" in report.notes.lower()


def test_future_timestamp_beyond_tolerance_yields_not_evaluable():
    orchestrator = AdvancedAIOrchestrator()
    future_time = FIXED_NOW + timedelta(seconds=15)
    test_sum = build_valid_test_summary(timestamp=future_time.isoformat())
    inp = build_valid_gate_input(test_summary=test_sum, max_age=3600.0)
    report = eval_report(orchestrator, inp, clock=make_fixed_clock(FIXED_NOW))
    assert report.ai_pipeline_readiness == "NOT_EVALUABLE"
    assert "future" in report.notes.lower()


def test_stale_artifact_yields_not_evaluable():
    orchestrator = AdvancedAIOrchestrator()
    old_time = FIXED_NOW - timedelta(seconds=7200)
    test_sum = build_valid_test_summary(timestamp=old_time.isoformat())
    inp = build_valid_gate_input(test_summary=test_sum, max_age=3600.0)
    report = eval_report(orchestrator, inp, clock=make_fixed_clock(FIXED_NOW))
    assert report.ai_pipeline_readiness == "NOT_EVALUABLE"
    assert "stale" in report.notes.lower()


@pytest.mark.parametrize("invalid_max_age", [
    "3600",
    True,
    False,
    float("nan"),
    float("inf"),
    float("-inf"),
    -1,
    -0.001,
    -(10**1000),
])
def test_max_artifact_age_seconds_invalid_types_and_ranges(invalid_max_age):
    orchestrator = AdvancedAIOrchestrator()
    inp = build_valid_gate_input(max_age=invalid_max_age)
    report = eval_report(orchestrator, inp, clock=make_fixed_clock(FIXED_NOW))
    assert report.ai_pipeline_readiness == "NOT_EVALUABLE"
    assert report.product_deployment_readiness == "NOT_EVALUABLE"
    assert "invalid max_artifact_age_seconds" in report.notes.lower()


def test_max_artifact_age_seconds_arbitrary_large_int_never_crashes():
    orchestrator = AdvancedAIOrchestrator()
    # Positive huge int 10**1000 must NOT crash with OverflowError
    inp_pos = build_valid_gate_input(max_age=10**1000)
    report_pos = eval_report(orchestrator, inp_pos, clock=make_fixed_clock(FIXED_NOW))
    assert report_pos.ai_pipeline_readiness == "READY"
    assert report_pos.product_deployment_readiness == "GOLD_READY_DISABLED_PENDING_TRUST_BOUNDARY"

    # Negative huge int -(10**1000) must NOT crash and must fail closed with NOT_EVALUABLE
    inp_neg = build_valid_gate_input(max_age=-(10**1000))
    report_neg = eval_report(orchestrator, inp_neg, clock=make_fixed_clock(FIXED_NOW))
    assert report_neg.ai_pipeline_readiness == "NOT_EVALUABLE"
    assert report_neg.product_deployment_readiness == "NOT_EVALUABLE"
    assert "invalid max_artifact_age_seconds" in report_neg.notes.lower()


# --- 5. Revision Consistency Across Bundle ---
def test_child_artifact_source_revision_mismatch_yields_not_evaluable():
    orchestrator = AdvancedAIOrchestrator()
    # test_summary has different revision from root gate_input
    test_sum = build_valid_test_summary(source_rev="different_rev_12345678901234567890")
    inp = build_valid_gate_input(test_summary=test_sum, source_rev=VALID_REV)
    report = eval_report(orchestrator, inp)
    assert report.ai_pipeline_readiness == "NOT_EVALUABLE"
    assert "mismatched source_revision" in report.notes.lower()


# --- 6. Test Totals & Strict Count Types ---
def test_test_totals_inconsistent_sum_yields_not_evaluable():
    orchestrator = AdvancedAIOrchestrator()
    test_sum = build_valid_test_summary(total=604, passed=600, failed=0)
    inp = build_valid_gate_input(test_summary=test_sum)
    report = eval_report(orchestrator, inp)
    assert report.ai_pipeline_readiness == "NOT_EVALUABLE"
    assert "total" in report.notes.lower()


def test_test_totals_passed_greater_than_total_yields_not_evaluable():
    orchestrator = AdvancedAIOrchestrator()
    test_sum = build_valid_test_summary(total=500, passed=600, failed=0)
    inp = build_valid_gate_input(test_summary=test_sum)
    report = eval_report(orchestrator, inp)
    assert report.ai_pipeline_readiness == "NOT_EVALUABLE"


def test_test_totals_float_count_yields_not_evaluable():
    orchestrator = AdvancedAIOrchestrator()
    # Float count 1.0 is rejected
    test_sum = build_valid_test_summary(total=1.0, passed=1.0, failed=0)
    inp = build_valid_gate_input(test_summary=test_sum)
    report = eval_report(orchestrator, inp)
    assert report.ai_pipeline_readiness == "NOT_EVALUABLE"
    assert "integer" in report.notes.lower()


def test_test_totals_bool_count_yields_not_evaluable():
    orchestrator = AdvancedAIOrchestrator()
    # Python bool True is rejected
    test_sum = build_valid_test_summary(total=True, passed=True, failed=0)
    inp = build_valid_gate_input(test_summary=test_sum)
    report = eval_report(orchestrator, inp)
    assert report.ai_pipeline_readiness == "NOT_EVALUABLE"
    assert "integer" in report.notes.lower()


def test_subtests_passed_invalid_type_yields_not_evaluable():
    orchestrator = AdvancedAIOrchestrator()
    # Float subtests_passed is rejected
    test_sum = build_valid_test_summary(subtests=105.5)
    inp = build_valid_gate_input(test_summary=test_sum)
    report = eval_report(orchestrator, inp)
    assert report.ai_pipeline_readiness == "NOT_EVALUABLE"
    assert "subtests_passed" in report.notes.lower()


def test_subtests_passed_not_added_to_total():
    orchestrator = AdvancedAIOrchestrator()
    test_sum = build_valid_test_summary(total=604, passed=604, subtests=105)
    inp = build_valid_gate_input(test_summary=test_sum)
    report = eval_report(orchestrator, inp)
    assert report.test_summary["subtestsPassed"] == 105
    assert report.test_summary["totalTests"] == 604


def test_test_failures_or_errors_yield_failed_status():
    orchestrator = AdvancedAIOrchestrator()
    test_sum = build_valid_test_summary(total=604, passed=603, failed=1)
    inp = build_valid_gate_input(test_summary=test_sum)
    report = eval_report(orchestrator, inp)
    assert report.ai_pipeline_readiness == "FAILED"
    assert "FAIL (603 passed, 1 failed" in report.tasks_1_17_regression_check


def test_skipped_tests_without_policy_blocks_ready():
    orchestrator = AdvancedAIOrchestrator()
    test_sum = build_valid_test_summary(total=604, passed=603, skipped=1)
    inp = build_valid_gate_input(test_summary=test_sum, allow_skipped=False)
    report = eval_report(orchestrator, inp)
    assert report.ai_pipeline_readiness != "READY"
    assert report.ai_pipeline_readiness in ("NOT_EVALUABLE", "NOT_VALIDATED")
    assert "skipped" in report.notes.lower()


@pytest.mark.parametrize("invalid_allow_skipped", [
    "false",
    "true",
    "",
    1,
    0,
    None,
    [],
    {},
])
def test_allow_skipped_tests_invalid_types(invalid_allow_skipped):
    orchestrator = AdvancedAIOrchestrator()
    inp = build_valid_gate_input(allow_skipped=invalid_allow_skipped)
    report = eval_report(orchestrator, inp)
    assert report.ai_pipeline_readiness == "NOT_EVALUABLE"
    assert report.product_deployment_readiness == "NOT_EVALUABLE"
    assert "invalid allow_skipped_tests policy" in report.notes.lower()


def test_allow_skipped_tests_string_false_with_skipped_test_fails_closed():
    orchestrator = AdvancedAIOrchestrator()
    test_sum = build_valid_test_summary(total=604, passed=603, skipped=1)
    inp = build_valid_gate_input(test_summary=test_sum, allow_skipped="false")
    report = eval_report(orchestrator, inp)
    assert report.ai_pipeline_readiness == "NOT_EVALUABLE"
    assert report.ai_pipeline_readiness != "READY"


# --- 7. Required Tasks & Sequence Duplicate Detection ---
def test_missing_required_task_yields_not_evaluable():
    orchestrator = AdvancedAIOrchestrator()
    mods = build_valid_module_evaluations()
    del mods["Task 23"]
    inp = build_valid_gate_input(module_evaluations=mods)
    report = eval_report(orchestrator, inp)
    assert report.ai_pipeline_readiness == "NOT_EVALUABLE"
    assert "missing required tasks" in report.notes.lower()


def test_unknown_task_id_yields_not_evaluable():
    orchestrator = AdvancedAIOrchestrator()
    mods = build_valid_module_evaluations()
    mods["Task 99 Unknown"] = ModuleGateArtifact(
        artifact_id="mod_art_99",
        artifact_type="module_gate_artifact",
        schema_version="1.0.0",
        generated_at=FIXED_NOW_ISO,
        source_revision=VALID_REV,
        artifact_hash=VALID_HASH,
        task_id="Task 99 Unknown",
        implementation_status="IMPLEMENTED",
        validation_status="VALIDATED",
    )
    inp = build_valid_gate_input(module_evaluations=mods)
    report = eval_report(orchestrator, inp)
    assert report.ai_pipeline_readiness == "NOT_EVALUABLE"
    assert "unknown task id" in report.notes.lower()


def test_sequence_module_evaluations_duplicate_task_id_yields_not_evaluable():
    orchestrator = AdvancedAIOrchestrator()
    mods_list = list(build_valid_module_evaluations().values())
    # Add a duplicate Task 18 artifact to the sequence
    dup_art = ModuleGateArtifact(
        artifact_id="mod_art_task_18_dup",
        artifact_type="module_gate_artifact",
        schema_version="1.0.0",
        generated_at=FIXED_NOW_ISO,
        source_revision=VALID_REV,
        artifact_hash=VALID_HASH,
        task_id="Task 18",
        implementation_status="IMPLEMENTED",
        validation_status="VALIDATED",
    )
    mods_list.append(dup_art)
    inp = build_valid_gate_input(module_evaluations=mods_list)
    report = eval_report(orchestrator, inp)
    assert report.ai_pipeline_readiness == "NOT_EVALUABLE"
    assert "duplicate task id" in report.notes.lower()


def test_sequence_module_evaluations_valid_passes():
    orchestrator = AdvancedAIOrchestrator()
    mods_list = list(build_valid_module_evaluations().values())
    inp = build_valid_gate_input(module_evaluations=mods_list)
    report = eval_report(orchestrator, inp)
    assert report.ai_pipeline_readiness == "READY"
    assert len(report.tasks_18_30_modules_evaluated) == 14


# --- 8. Status Closed Enums Validation ---
def test_unknown_implementation_status_yields_not_evaluable():
    orchestrator = AdvancedAIOrchestrator()
    mods = build_valid_module_evaluations()
    # BANANA is an invalid implementation status
    mods["Task 23"] = ModuleGateArtifact(
        artifact_id="mod_art_task_23",
        artifact_type="module_gate_artifact",
        schema_version="1.0.0",
        generated_at=FIXED_NOW_ISO,
        source_revision=VALID_REV,
        artifact_hash=VALID_HASH,
        task_id="Task 23",
        implementation_status="BANANA",
        validation_status="NOT_VALIDATED",
    )
    inp = build_valid_gate_input(module_evaluations=mods)
    report = eval_report(orchestrator, inp)
    assert report.ai_pipeline_readiness == "NOT_EVALUABLE"
    assert "unknown implementation_status" in report.notes.lower()


def test_unknown_validation_status_yields_not_evaluable():
    orchestrator = AdvancedAIOrchestrator()
    mods = build_valid_module_evaluations()
    # PEACH is an invalid validation status
    mods["Task 23"] = ModuleGateArtifact(
        artifact_id="mod_art_task_23",
        artifact_type="module_gate_artifact",
        schema_version="1.0.0",
        generated_at=FIXED_NOW_ISO,
        source_revision=VALID_REV,
        artifact_hash=VALID_HASH,
        task_id="Task 23",
        implementation_status="IMPLEMENTED",
        validation_status="PEACH",
    )
    inp = build_valid_gate_input(module_evaluations=mods)
    report = eval_report(orchestrator, inp)
    assert report.ai_pipeline_readiness == "NOT_EVALUABLE"
    assert "unknown validation_status" in report.notes.lower()


# --- 9. Module Implementation & Validation Status Separation ---
def test_module_not_implemented_yields_not_implemented():
    orchestrator = AdvancedAIOrchestrator()
    mods = build_valid_module_evaluations()
    mods["Task 23"] = ModuleGateArtifact(
        artifact_id="mod_art_task_23",
        artifact_type="module_gate_artifact",
        schema_version="1.0.0",
        generated_at=FIXED_NOW_ISO,
        source_revision=VALID_REV,
        artifact_hash=VALID_HASH,
        task_id="Task 23",
        implementation_status="NOT_IMPLEMENTED",
        validation_status="NOT_VALIDATED",
    )
    inp = build_valid_gate_input(module_evaluations=mods)
    report = eval_report(orchestrator, inp)
    assert report.ai_pipeline_readiness == "NOT_IMPLEMENTED"
    assert report.module_implementation_statuses["Task 23"] == "NOT_IMPLEMENTED"


def test_module_not_validated_blocks_ready():
    orchestrator = AdvancedAIOrchestrator()
    mods = build_valid_module_evaluations()
    mods["Task 23"] = ModuleGateArtifact(
        artifact_id="mod_art_task_23",
        artifact_type="module_gate_artifact",
        schema_version="1.0.0",
        generated_at=FIXED_NOW_ISO,
        source_revision=VALID_REV,
        artifact_hash=VALID_HASH,
        task_id="Task 23",
        implementation_status="IMPLEMENTED",
        validation_status="NOT_VALIDATED",
    )
    mods["Task 24"] = ModuleGateArtifact(
        artifact_id="mod_art_task_24",
        artifact_type="module_gate_artifact",
        schema_version="1.0.0",
        generated_at=FIXED_NOW_ISO,
        source_revision=VALID_REV,
        artifact_hash=VALID_HASH,
        task_id="Task 24",
        implementation_status="IMPLEMENTED",
        validation_status="SHADOW_NOT_VALIDATED",
    )
    inp = build_valid_gate_input(module_evaluations=mods)
    report = eval_report(orchestrator, inp)
    assert report.ai_pipeline_readiness == "NOT_VALIDATED"
    assert report.ai_pipeline_readiness != "READY"


def test_module_failed_yields_failed():
    orchestrator = AdvancedAIOrchestrator()
    mods = build_valid_module_evaluations()
    mods["Task 20"] = ModuleGateArtifact(
        artifact_id="mod_art_task_20",
        artifact_type="module_gate_artifact",
        schema_version="1.0.0",
        generated_at=FIXED_NOW_ISO,
        source_revision=VALID_REV,
        artifact_hash=VALID_HASH,
        task_id="Task 20",
        implementation_status="IMPLEMENTED",
        validation_status="FAILED",
    )
    inp = build_valid_gate_input(module_evaluations=mods)
    report = eval_report(orchestrator, inp)
    assert report.ai_pipeline_readiness == "FAILED"


# --- 10. Single Source of Truth for Statuses ---
def test_tasks_18_30_modules_evaluated_derived_deterministically():
    orchestrator = AdvancedAIOrchestrator()
    mods = build_valid_module_evaluations()
    mods["Task 23"] = ModuleGateArtifact(
        artifact_id="mod_art_task_23",
        artifact_type="module_gate_artifact",
        schema_version="1.0.0",
        generated_at=FIXED_NOW_ISO,
        source_revision=VALID_REV,
        artifact_hash=VALID_HASH,
        task_id="Task 23",
        implementation_status="IMPLEMENTED",
        validation_status="NOT_VALIDATED",
    )
    mods["Task 24"] = ModuleGateArtifact(
        artifact_id="mod_art_task_24",
        artifact_type="module_gate_artifact",
        schema_version="1.0.0",
        generated_at=FIXED_NOW_ISO,
        source_revision=VALID_REV,
        artifact_hash=VALID_HASH,
        task_id="Task 24",
        implementation_status="IMPLEMENTED",
        validation_status="SHADOW_NOT_VALIDATED",
    )
    inp = build_valid_gate_input(module_evaluations=mods)
    report = eval_report(orchestrator, inp)

    legacy_key_23 = f"Task 23 {TASK_NAMES['Task 23']}"
    legacy_key_24 = f"Task 24 {TASK_NAMES['Task 24']}"
    legacy_key_18 = f"Task 18 {TASK_NAMES['Task 18']}"

    assert report.tasks_18_30_modules_evaluated[legacy_key_23] == "NOT_VALIDATED"
    assert report.tasks_18_30_modules_evaluated[legacy_key_24] == "SHADOW_NOT_VALIDATED"
    assert report.tasks_18_30_modules_evaluated[legacy_key_18] == "IMPLEMENTED_AND_CONTRACT_TESTED"


# --- 11. Trust Boundary Artifact & Product Gate Lock ---
@pytest.mark.parametrize("bad_tb", [
    "string_not_artifact",
    12345,
    {"artifact_id": "fake"},
])
def test_trust_boundary_invalid_type_yields_not_evaluable(bad_tb):
    orchestrator = AdvancedAIOrchestrator()
    inp = build_valid_gate_input(trust_boundary=bad_tb)
    report = eval_report(orchestrator, inp)
    assert report.ai_pipeline_readiness == "NOT_EVALUABLE"
    assert report.product_deployment_readiness == "DISABLED_PENDING_TRUST_BOUNDARY"
    assert "invalid trust_boundary type" in report.notes.lower()


@pytest.mark.parametrize("tb_maker, expected_snippet", [
    (lambda: build_valid_trust_boundary(artifact_type="wrong_type"), "invalid artifact_type"),
    (lambda: build_valid_trust_boundary(artifact_hash="md5:12345"), "invalid artifact hash"),
    (lambda: build_valid_trust_boundary(schema_version="2.0.0"), "unsupported schema version"),
    (lambda: build_valid_trust_boundary(source_revision=""), "missing or empty source_revision"),
    (lambda: build_valid_trust_boundary(source_revision="mismatched_child_rev"), "mismatched source_revision"),
    (lambda: build_valid_trust_boundary(generated_at="2026-09-21T12:00:00"), "missing or non-utc"),
    (lambda: build_valid_trust_boundary(generated_at="2026-09-21T19:00:00+07:00"), "missing or non-utc"),
    (lambda: build_valid_trust_boundary(generated_at=(FIXED_NOW + timedelta(seconds=20)).isoformat()), "future timestamp"),
])
def test_trust_boundary_provenance_and_revision_errors(tb_maker, expected_snippet):
    orchestrator = AdvancedAIOrchestrator()
    inp = build_valid_gate_input(trust_boundary=tb_maker())
    report = eval_report(orchestrator, inp, clock=make_fixed_clock(FIXED_NOW))
    assert report.ai_pipeline_readiness == "NOT_EVALUABLE"
    assert report.product_deployment_readiness == "DISABLED_PENDING_TRUST_BOUNDARY"
    assert expected_snippet in report.notes.lower()


@pytest.mark.parametrize("bad_field_kwargs", [
    {"credentials_rotated": "true"},
    {"authoritative_manifest_bound": 1},
    {"production_keys_configured": None},
    {"credentials_rotated": 0},
])
def test_trust_boundary_boolean_field_types(bad_field_kwargs):
    orchestrator = AdvancedAIOrchestrator()
    tb = build_valid_trust_boundary(**bad_field_kwargs)
    inp = build_valid_gate_input(trust_boundary=tb)
    report = eval_report(orchestrator, inp)
    assert report.ai_pipeline_readiness == "NOT_EVALUABLE"
    assert report.product_deployment_readiness == "DISABLED_PENDING_TRUST_BOUNDARY"
    assert "strict booleans" in report.notes.lower()


def test_product_deployment_gate_never_opened_by_caller_booleans():
    orchestrator = AdvancedAIOrchestrator()
    trust = build_valid_trust_boundary(
        credentials_rotated=True,
        authoritative_manifest_bound=True,
        production_keys_configured=True,
    )
    inp = build_valid_gate_input(trust_boundary=trust)
    report = eval_report(orchestrator, inp)

    # With all booleans True and AI READY, product gate MUST still remain disabled
    assert report.ai_pipeline_readiness == "READY"
    assert report.product_deployment_readiness == "GOLD_READY_DISABLED_PENDING_TRUST_BOUNDARY"
    assert report.product_deployment_readiness != "READY"
    assert report.product_deployment_readiness != "PRODUCTION_READY"

    # With unvalidated module, product gate is DISABLED_PENDING_TRUST_BOUNDARY
    mods = build_valid_module_evaluations()
    mods["Task 23"] = ModuleGateArtifact(
        artifact_id="mod_art_task_23",
        artifact_type="module_gate_artifact",
        schema_version="1.0.0",
        generated_at=FIXED_NOW_ISO,
        source_revision=VALID_REV,
        artifact_hash=VALID_HASH,
        task_id="Task 23",
        implementation_status="IMPLEMENTED",
        validation_status="NOT_VALIDATED",
    )
    inp_unval = build_valid_gate_input(module_evaluations=mods, trust_boundary=trust)
    report_unval = eval_report(orchestrator, inp_unval)
    assert report_unval.ai_pipeline_readiness == "NOT_VALIDATED"
    assert report_unval.product_deployment_readiness == "DISABLED_PENDING_TRUST_BOUNDARY"


@pytest.mark.parametrize("malformed_policy", [
    {"max_age": "3600"},
    {"max_age": True},
    {"max_age": False},
    {"max_age": float("nan")},
    {"max_age": float("inf")},
    {"max_age": -100},
    {"max_age": -(10**1000)},
    {"allow_skipped": "false"},
    {"allow_skipped": "true"},
    {"allow_skipped": 1},
    {"allow_skipped": 0},
    {"allow_skipped": None},
    {"allow_skipped": [1, 2]},
    {"allow_skipped": {"a": 1}},
])
def test_public_evaluator_never_crashes_with_any_malformed_policy_field(malformed_policy):
    orchestrator = AdvancedAIOrchestrator()
    # Must never crash with TypeError or any exception
    inp = build_valid_gate_input(**malformed_policy)
    report = eval_report(orchestrator, inp)
    assert isinstance(report, ReleaseGateReport)
    assert report.ai_pipeline_readiness == "NOT_EVALUABLE"
    assert report.product_deployment_readiness == "NOT_EVALUABLE"


# --- 12. Immutability & Zero Input Mutation ---
def test_input_immutability_and_zero_mutation():
    orchestrator = AdvancedAIOrchestrator()
    inp = build_valid_gate_input()
    orig_dict = inp.module_evaluations.copy()

    report = eval_report(orchestrator, inp)

    assert inp.module_evaluations == orig_dict

    with pytest.raises(Exception):
        report.ai_pipeline_readiness = "MUTATED"


# --- 13. Deterministic Serialization Across Two Evaluations ---
def test_deterministic_serialization_across_two_evaluations():
    orchestrator = AdvancedAIOrchestrator()
    inp = build_valid_gate_input()

    # Run evaluator twice with the same fixed clock and input
    report1 = eval_report(orchestrator, inp, clock=make_fixed_clock(FIXED_NOW))
    report2 = eval_report(orchestrator, inp, clock=make_fixed_clock(FIXED_NOW))

    json1 = json.dumps(report1.to_dict(), sort_keys=True)
    json2 = json.dumps(report2.to_dict(), sort_keys=True)

    # Must be byte-for-byte identical
    assert json1 == json2

    d1 = report1.to_dict()
    assert "gateVersion" in d1
    assert "aiPipelineReadiness" in d1
    assert "productDeploymentReadiness" in d1
    assert "tasks1To17RegressionCheck" in d1
    assert "tasks18To30ModulesEvaluated" in d1
    assert "notes" in d1
    assert "moduleImplementationStatuses" in d1
    assert "moduleValidationStatuses" in d1
    assert "testSummary" in d1
    assert "evaluatedAt" in d1


# --- 14. All Validated Modules + Passing Tests Yields READY ---
def test_all_validated_modules_and_passing_tests_yields_ready():
    orchestrator = AdvancedAIOrchestrator()
    inp = build_valid_gate_input()
    report = eval_report(orchestrator, inp)

    assert report.ai_pipeline_readiness == "READY"
    assert report.product_deployment_readiness == "GOLD_READY_DISABLED_PENDING_TRUST_BOUNDARY"
    assert "PASS (604 passed, 0 failed)" in report.tasks_1_17_regression_check
    # Verify typography: exactly one period, no double period 'provenance..'
    assert "provenance. Task 14" in report.notes
    assert "provenance.." not in report.notes
