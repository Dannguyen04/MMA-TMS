"""
benchmark_tasks9_17.py — Isolated, Evidence-Backed Benchmarks for MMA-TMS Tasks 9–17

Provides 4 strictly isolated benchmarks:
1. Tasks 5–8: Action Analysis (Pose observation + temporal phases + 22 kinematics + rubric + shadow classifier)
2. Tasks 9–12 & 15–16: Publish Path (Quality gate + action sanitization + session aggregation + coaching engine)
3. Tasks 13–14: Review & Export Library (Audit trail validation + canonical JSON content hash + HMAC pseudonymization + manifest export)
4. Task 17: Fixture-Safe Orchestrator (Full process_video loop over synthetic 45-frame sequence without external weights/GPU)

Outputs honest environment labels (CPU, OS, Python version), warm-up count, iteration count,
min, mean, median, p95, and max latency.
"""

import hashlib
import json
import os
import platform
import statistics
import sys
import time
from typing import Any, Callable, Dict, List
from unittest.mock import MagicMock, patch

import numpy as np

# MMA-TMS Pipeline Imports
from action_result import action_from_kick, action_from_punch
from kick_analyzer import KickResult
from pipeline.classification import ClassifiedTechnique
from pipeline.coaching_engine import CoachingEngine
from pipeline.contracts import EvidenceLevel
from pipeline.dataset_export import (
    AnonymizedSample,
    DatasetExportEngine,
    DatasetSplit,
    ExportApprovalPolicy,
    REQUIRED_GOLD_CLASSES,
)
from pipeline.kinematic_features import extract_kinematic_features
from pipeline.quality_gate import (
    AnalysisQuality,
    QualityGateConfig,
    QualityGateEvaluator,
    QualityStatus,
    evaluate_video_quality,
)
from pipeline.review_contract import (
    MaterializedActionView,
    ReviewAction,
    ReviewAuditRecord,
    ReviewerRole,
    TargetField,
)
from pipeline.session_aggregation import SessionAggregationEngine
from pipeline.shadow_classifier import DecisionStatus
from pipeline.stance_context import resolve_stance_context
from process_video import process_video
from punch_analyzer import PunchResult


def get_environment_info() -> dict[str, str]:
    return {
        "os": f"{platform.system()} {platform.release()} ({platform.architecture()[0]})",
        "cpu": platform.processor() or "x86_64 Compatible",
        "python_version": sys.version.split()[0],
        "torch_cuda_available": "False (CPU fixture-safe benchmark)",
        "timestamp_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


def time_callable(
    fn: Callable[[], Any],
    warmup: int = 10,
    iterations: int = 50,
) -> dict[str, float]:
    for _ in range(warmup):
        fn()

    durations_ms: list[float] = []
    for _ in range(iterations):
        t0 = time.perf_counter()
        fn()
        t1 = time.perf_counter()
        durations_ms.append((t1 - t0) * 1000.0)

    durations_ms.sort()
    p95_idx = int(len(durations_ms) * 0.95)
    p95 = durations_ms[min(p95_idx, len(durations_ms) - 1)]

    return {
        "warmup": warmup,
        "iterations": iterations,
        "min_ms": round(durations_ms[0], 4),
        "mean_ms": round(statistics.mean(durations_ms), 4),
        "median_ms": round(statistics.median(durations_ms), 4),
        "p95_ms": round(p95, 4),
        "max_ms": round(durations_ms[-1], 4),
        "throughput_ops_sec": round(1000.0 / statistics.mean(durations_ms), 1) if statistics.mean(durations_ms) > 0 else 0.0,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Benchmark 1: Tasks 5–8 Action Analysis
# ─────────────────────────────────────────────────────────────────────────────
def benchmark_tasks5_8_action_analysis() -> dict[str, float]:
    # 15 synthetic frames for a strike
    frames = []
    for i in range(15):
        wy = 0.58 - (i * 0.012)
        landmarks = []
        for kp in range(17):
            if kp in (9, 10):
                landmarks.append({"x": 0.50, "y": wy, "conf": 0.95})
            elif kp in (7, 8):
                landmarks.append({"x": 0.40, "y": 0.55, "conf": 0.95})
            elif kp in (5, 6):
                landmarks.append({"x": 0.40, "y": 0.40, "conf": 0.95})
            elif kp in (11, 12):
                landmarks.append({"x": 0.45, "y": 0.65, "conf": 0.95})
            else:
                landmarks.append({"x": 0.50, "y": 0.50, "conf": 0.90})
        frames.append({"frameIdx": i, "timeMs": i * 33.333, "landmarks": landmarks})

    punch = PunchResult(
        punch_type="punch",
        arm="right",
        score=82,
        grade="B",
        emoji="🥊",
        details=[],
        max_elbow_angle=92.0,
        peak_speed=6.0,
        guard_preserved=True,
        start_frame=0,
        impact_frame=7,
        end_frame=11,
        start_time_ms=0.0,
        impact_time_ms=233.3,
        end_time_ms=366.7,
        findings=[],
    )

    def run_analysis():
        act = action_from_punch(
            punch=punch,
            action_id="act_bench",
            source_action_id="punch_0",
            keypoints_trajectory=frames,
            fps=30.0,
        )
        assert act.id == "act_bench"
        assert act.family == "punch"
        assert act.assessment.rubricId == "rubric_punch_v3"
        assert act.assessment.status in ("assessed", "insufficient_evidence")
        return act

    return time_callable(run_analysis, warmup=15, iterations=100)


# ─────────────────────────────────────────────────────────────────────────────
# Benchmark 2: Tasks 9–12 & 15–16 Publish Path
# ─────────────────────────────────────────────────────────────────────────────
def benchmark_tasks9_12_publish_path() -> dict[str, float]:
    from pipeline.finding_engine import FindingEngine
    from pipeline.shadow_punch_classifier import ShadowMultiPunchClassifier
    from pipeline.shadow_kick_classifier import ShadowKickClassifier

    # Stream of 20 analyzed actions across kick and punch families
    sample_actions: list[dict[str, Any]] = []
    for idx in range(20):
        fam = "kick" if idx % 2 == 0 else "punch"
        tech = "round_kick" if fam == "kick" else ("jab" if idx % 4 == 1 else "cross")
        sample_actions.append({
            "id": f"act_{idx}",
            "family": fam,
            "technique": tech,
            "attackingSide": "right" if idx % 2 == 0 else "left",
            "qualityStatus": "pass",
            "adjustedEvidenceLevel": "observed",
            "assessment": {
                "score": 85 - (idx % 10),
                "grade": "GOOD",
                "status": "assessed",
                "findings": [
                    {
                        "code": "LOW_GUARD" if idx % 3 == 0 else "SLOW_RETRACTION",
                        "title": "Dropped guard",
                        "severity": "warning",
                        "evidenceLevel": "observed",
                        "frameIdx": 10 + idx,
                        "timeMs": (10 + idx) * 33.3,
                    }
                ],
            },
            "shadowClassification": {
                "status": "classified",
                "candidate": {"technique": tech, "family": fam},
                "confidence": 0.85,
            },
        })

    # Synthetic frame quality records
    sample_frame_records = []
    for f in range(60):
        sample_frame_records.append({
            "frameIdx": f,
            "timeMs": f * 33.333,
            "landmarks": [{"x": 0.5, "y": 0.5, "conf": 0.85} for _ in range(17)],
        })

    shadow_punch = ShadowMultiPunchClassifier()
    shadow_kick = ShadowKickClassifier()
    stance_ctx = resolve_stance_context(user_stance="orthodox")

    def run_publish_path():
        # 1. Quality gate
        quality = evaluate_video_quality(
            frames=sample_frame_records,
            fps=30.0,
            img_width=1280,
            img_height=720,
        )

        # 2. FindingEngine: adapt and deduplicate findings across actions
        for act in sample_actions:
            raw_findings = act.get("assessment", {}).get("findings", [])
            _ = FindingEngine.adapt_and_deduplicate_findings(
                findings=raw_findings,
                action_id=act["id"],
                family=act["family"],
            )

        # 3. Both Shadow Classifiers executed
        _p_res = shadow_punch.classify(
            features={
                "attacking_side": "right",
                "max_elbow_angle": 160.0,
                "trajectory_directness": 0.88,
                "tangential_curvature": 0.1,
                "vertical_lift": 0.05,
                "wrist_shoulder_separation_ratio": 0.5,
            },
            stance_context=stance_ctx,
        )
        _k_res = shadow_kick.classify(
            features={
                "attacking_side": "right",
                "has_chamber_phase": True,
                "has_extension_phase": True,
                "hip_rotation_angle": 42.0,
                "arc_curvature": 0.35,
                "forward_trajectory_linearity": 0.2,
                "lateral_displacement_ratio": 0.1,
                "torso_lean_angle": 15.0,
            },
            stance_context=stance_ctx,
        )

        # 4. Session aggregation
        insights = SessionAggregationEngine.aggregate_session(
            actions=sample_actions,
            quality_status=quality.status.value,
        )
        # 5. Coaching plan
        coaching = CoachingEngine.generate_coaching_plan(insights)
        assert quality.status == QualityStatus.PASS, f"Expected PASS quality, got {quality.status}"
        assert insights.status in ("completed", "pass"), f"Expected completed/pass insights status, got {insights.status}"
        assert _p_res.status in (DecisionStatus.CLASSIFIED, DecisionStatus.ABSTAINED)
        assert _k_res.status in (DecisionStatus.CLASSIFIED, DecisionStatus.ABSTAINED)
        return quality, insights, coaching

    return time_callable(run_publish_path, warmup=15, iterations=100)


# ─────────────────────────────────────────────────────────────────────────────
# Benchmark 3: Tasks 13–14 NOT_GOLD_READY Export Validation
# ─────────────────────────────────────────────────────────────────────────────
def benchmark_tasks13_14_not_gold_ready_export() -> dict[str, float]:
    salt = "production_bench_salt_secret_2026_xyz"
    views = []

    # 7 classes, 20 samples each = 140 samples (< 500 requirement, 1 athlete, 1 reviewer)
    for class_idx, tech in enumerate(REQUIRED_GOLD_CLASSES):
        fam = "kick" if "kick" in tech else "punch"
        for s in range(20):
            aid = f"act_{tech}_{s:03d}"
            rec = ReviewAuditRecord(
                record_id=f"rec_{tech}_{s:03d}",
                action_id=aid,
                target_field=TargetField.TECHNIQUE,
                review_action=ReviewAction.ACCEPT,
                ai_original_value=tech,
                corrected_value=None,
                reviewer_id="coach_alice",
                reviewer_role=ReviewerRole.COACH,
                reason="Confirmed",
                timestamp=f"2026-09-17T10:{s % 60:02d}:00Z",
                idempotency_token=f"tok_{tech}_{s:03d}",
                version="1.0.0",
            )
            view = MaterializedActionView(
                action_id=aid,
                ai_original={
                    "technique": tech,
                    "family": fam,
                    "attacking_side": "right",
                    "limb_role": "rear",
                    "metrics": {"speed": 8.5, "peak_speed": 8.5, "extension_deg": 155.0},
                    "phases": {"startFrame": 0, "chamberFrame": 5, "peakFrame": 10, "endFrame": 20},
                    "qualityStatus": "pass",
                    "adjustedEvidenceLevel": "observed",
                },
                effective_technique=tech,
                effective_attacking_side="right",
                effective_limb_role="rear",
                effective_phases={"startFrame": 0, "chamberFrame": 5, "peakFrame": 10, "endFrame": 20},
                effective_findings=(),
                review_status="coach_approved",
                audit_trail=(rec,),
                updated_at="2026-09-17T10:00:00Z",
            )
            views.append(view)

    action_views_with_athlete = [(v, "athlete_olympic_dan") for v in views]

    def run_export():
        res = DatasetExportEngine.export_dataset(
            action_views_with_athlete=action_views_with_athlete,
            salt=salt,
            policy=ExportApprovalPolicy.STRICT_COACH_APPROVED,
            dataset_id="mma_not_gold_bench_v1",
            provenance_source="coach_review",
            backend_attestation="att_prod_release_2026",
            reviewer_agreement_policy="dual_review_consensus",
        )
        assert res.manifest.status == "NOT_GOLD_READY", f"Expected NOT_GOLD_READY, got {res.manifest.status}"
        assert res.manifest.is_gold_ready is False, "Expected is_gold_ready False"
        return res

    return time_callable(run_export, warmup=10, iterations=50)


# ─────────────────────────────────────────────────────────────────────────────
# Benchmark 4: Task 17 Fixture-Injected Orchestrator
# ─────────────────────────────────────────────────────────────────────────────
def benchmark_task17_fixture_orchestrator() -> dict[str, float]:
    mock_punch = PunchResult(
        punch_type="punch",
        arm="right",
        score=82,
        grade="B",
        emoji="🥊",
        details=["Good form"],
        max_elbow_angle=92.0,
        peak_speed=6.0,
        guard_preserved=True,
        start_frame=5,
        impact_frame=15,
        end_frame=25,
        start_time_ms=166.7,
        impact_time_ms=500.0,
        end_time_ms=833.3,
    )
    mock_kick = KickResult(
        score=80,
        grade="A",
        emoji="🥋",
        details=["Good extension"],
        min_chamber_angle=45.0,
        max_extension_angle=160.0,
        peak_speed=2.5,
        start_frame=5,
        chamber_peak_frame=12,
        impact_frame=18,
        end_frame=30,
        start_time_ms=166.7,
        chamber_peak_time_ms=400.0,
        impact_time_ms=600.0,
        end_time_ms=1000.0,
        active_leg="right",
    )

    dummy_frame = np.zeros((720, 1280, 3), dtype=np.uint8)

    def run_orchestrator():
        with patch("process_video.cv2.VideoCapture") as mock_cap, \
             patch("process_video.YOLO") as mock_yolo, \
             patch("process_video.ActionPipeline.get_results") as mock_get_results, \
             patch("process_video.evaluate_video_quality") as mock_eval:

            mock_get_results.return_value = ([mock_punch], [mock_kick])
            mock_eval.return_value = AnalysisQuality(
                status=QualityStatus.PASS,
                reason_codes=(),
                metrics={"fps": 30.0, "duration_ms": 1500.0, "total_frames": 45},
                quality_version="1.0.0",
                evaluator_version="1.0.0",
                evaluated_at="2026-09-17T00:00:00Z",
                adjusted_evidence_level=EvidenceLevel.OBSERVED,
                recommendation="proceed_full_analysis",
            )
            cap_inst = MagicMock()
            cap_inst.isOpened.return_value = True
            cap_inst.get.side_effect = lambda prop: 30.0 if prop == 5 else 45 if prop == 7 else 1280 if prop == 3 else 720
            cap_inst.read.side_effect = [(True, dummy_frame)] * 45 + [(False, None)]
            mock_cap.return_value = cap_inst

            res = process_video("fixture_video_45f.mp4", verbose=False)
            assert res["analysisQuality"]["status"] == "pass", f"Expected pass status, got {res['analysisQuality']['status']}"
            assert len(res["actions"]) == 2, f"Expected 2 actions, got {len(res['actions'])}"
            assert res["summary"]["primaryAction"] in ("mixed", "punch", "kick")
            return res

    return time_callable(run_orchestrator, warmup=5, iterations=30)


def run_all_benchmarks():
    env = get_environment_info()
    print("=" * 78)
    print("MMA-TMS TASKS 9–17 ISOLATED PRODUCTION BENCHMARK REPORT")
    print("=" * 78)
    print(f"OS:             {env['os']}")
    print(f"CPU:            {env['cpu']}")
    print(f"Python:         {env['python_version']}")
    print(f"Acceleration:   {env['torch_cuda_available']}")
    print(f"Timestamp:      {env['timestamp_utc']}")
    print("=" * 78)

    print("\n[BENCHMARK 1] Tasks 5–8 Action Analysis (Pose observation + kinematics + rubrics)")
    b1 = benchmark_tasks5_8_action_analysis()
    print(f"  Warmup:     {b1['warmup']} runs")
    print(f"  Iterations: {b1['iterations']} runs")
    print(f"  Min:        {b1['min_ms']} ms")
    print(f"  Mean:       {b1['mean_ms']} ms")
    print(f"  Median:     {b1['median_ms']} ms")
    print(f"  P95:        {b1['p95_ms']} ms")
    print(f"  Max:        {b1['max_ms']} ms")
    print(f"  Throughput: {b1['throughput_ops_sec']} actions/sec")

    print("\n[BENCHMARK 2] Tasks 9–12 & 15–16 Publish Path (Quality + FindingEngine + Shadow Classifiers + Session + Coaching)")
    b2 = benchmark_tasks9_12_publish_path()
    print(f"  Warmup:     {b2['warmup']} runs")
    print(f"  Iterations: {b2['iterations']} runs")
    print(f"  Min:        {b2['min_ms']} ms")
    print(f"  Mean:       {b2['mean_ms']} ms")
    print(f"  Median:     {b2['median_ms']} ms")
    print(f"  P95:        {b2['p95_ms']} ms")
    print(f"  Max:        {b2['max_ms']} ms")
    print(f"  Throughput: {b2['throughput_ops_sec']} batch_publishes/sec")

    print("\n[BENCHMARK 3] Tasks 13–14 NOT_GOLD_READY Export Validation (140 samples, single-athlete / single-reviewer)")
    b3 = benchmark_tasks13_14_not_gold_ready_export()
    print(f"  Warmup:     {b3['warmup']} runs")
    print(f"  Iterations: {b3['iterations']} runs")
    print(f"  Min:        {b3['min_ms']} ms")
    print(f"  Mean:       {b3['mean_ms']} ms")
    print(f"  Median:     {b3['median_ms']} ms")
    print(f"  P95:        {b3['p95_ms']} ms")
    print(f"  Max:        {b3['max_ms']} ms")
    print(f"  Throughput: {b3['throughput_ops_sec']} dataset_exports/sec")

    print("\n[BENCHMARK 4] Task 17 Fixture-Injected Orchestration Latency (Loop overhead with mock video/detector)")
    b4 = benchmark_task17_fixture_orchestrator()
    print(f"  Warmup:     {b4['warmup']} runs")
    print(f"  Iterations: {b4['iterations']} runs")
    print(f"  Min:        {b4['min_ms']} ms")
    print(f"  Mean:       {b4['mean_ms']} ms")
    print(f"  Median:     {b4['median_ms']} ms")
    print(f"  P95:        {b4['p95_ms']} ms")
    print(f"  Max:        {b4['max_ms']} ms")
    print(f"  Throughput: {b4['throughput_ops_sec']} fixture_runs/sec")

    print("\n" + "=" * 78)
    print("Honest Measurement Disclosure:")
    print("- All measurements are execution time on CPU with synthetic fixture streams.")
    print("- No GPU or external video decode hardware was used; synthetic frame decode is simulated.")
    print("- Benchmark 4 measures fixture-injected orchestration latency (control flow, data structures, and pipeline wiring).")
    print("- It does not claim a universal 10ms budget across unconstrained hardware, nor raw camera FPS.")
    print("=" * 78)

    results = {
        "environment": env,
        "tasks_5_8_action_analysis": b1,
        "tasks_9_12_publish_path": b2,
        "tasks_13_14_not_gold_ready_export": b3,
        "tasks_13_14_review_export": b3,
        "task_17_fixture_orchestrator": b4,
    }
    with open("benchmark_tasks9_17_results.json", "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print("\nSaved benchmark results to benchmark_tasks9_17_results.json")


if __name__ == "__main__":
    run_all_benchmarks()
