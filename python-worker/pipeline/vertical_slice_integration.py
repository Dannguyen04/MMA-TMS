"""
vertical_slice_integration.py — Advanced AI Vertical Slice & Release Gate Integration (Task 31)

Provides:
- Immutable AdvancedAnalysisInput contract receiving only measured upstream video evidence.
- Zero Hard-Coded Constants: All proxies, events, and alignments are derived strictly from
  measured frame landmarks, action phases, person tracks, and caller-supplied reference data.
- End-to-end orchestration:
  * Combination & Action-Sequence Grouping (Task 23)
  * Elbow & Knee Shadow Events from measured kinematics (Task 24)
  * Grappling & Clinch Shadow Segmentation from measured person counts (Task 25)
  * Footwork, Guard & Observable Movement Evidence from measured keypoints & time-series (Task 26)
  * Personalized Baseline Generation (Task 27)
  * Session-to-Session Comparison (Task 28)
  * Reference Normalization & Ghost DTW Alignment (Tasks 29 & 30)
  * Active-Learning Candidate Selection with fail-closed privacy (Task 21)
  * Dynamic Release Gate Evaluation Report.
- CamelCase public serialization matching TypeScript worker-result.ts.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
from datetime import datetime, timezone, timedelta
from dataclasses import dataclass, field
from typing import Any, Callable, Mapping, Optional, Sequence, Union

from pipeline.contracts import (
    AlignmentStatus,
    BaselineEligibilityStatus,
    CalibrationStatus,
    ComparisonStatus,
    EvidenceLevel,
    QualityStatus,
    SequenceCandidateType,
    ShadowEventFamily,
    ShadowGrapplingState,
    ValidationStatus,
    deep_freeze,
    to_json_safe,
)
from pipeline.combination_engine import ActionSequence, CombinationEngine
from pipeline.elbow_knee_shadow import ElbowKneeShadowClassifier, ElbowKneeShadowEvent
from pipeline.grappling_shadow import GrapplingShadowSegment, GrapplingShadowSegmenter
from pipeline.observable_movement import MovementEvidenceEngine, ObservableMovementEvidence
from pipeline.personalized_baseline import BaselineEngine, PersonalizedBaseline
from pipeline.session_comparison import SessionComparator, SessionComparisonDelta
from pipeline.reference_normalization import ReferenceNormalizer, ReferenceMotionManifest
from pipeline.ghost_alignment import GhostAlignmentEngine, GhostDifferenceExplanation
from pipeline.active_learning_queue import ActiveLearningCandidate, ActiveLearningSelector, TrustedConsentPolicy
from pipeline.mvp_technique_discovery import MVPTechniqueDiscoveryEngine
from pipeline.stance_context import resolve_stance_context


@dataclass(frozen=True)
class AdvancedAnalysisInput:
    """Immutable input bundle containing ONLY measured upstream evidence and explicit caller parameters."""
    session_id: str
    actions: Sequence[Mapping[str, Any]] = field(default_factory=list)
    frame_records: Sequence[Mapping[str, Any]] = field(default_factory=list)
    quality_status: QualityStatus = QualityStatus.GOOD
    person_count: int = 1
    fps: float = 30.0
    consent_policy: Optional[TrustedConsentPolicy] = None
    reference_frames: Optional[Sequence[Sequence[tuple[float, float]]]] = None
    reference_technique: Optional[str] = None
    reference_stance: Optional[str] = None
    athlete_stance: Optional[str] = None
    camera_view: Optional[str] = None
    comparison_session: Optional[Mapping[str, Any]] = None


@dataclass(frozen=True)
class AdvancedVerticalSliceResult:
    session_id: str
    sequences: tuple[ActionSequence, ...]
    shadow_elbow_knee: tuple[ElbowKneeShadowEvent, ...]
    shadow_grappling: tuple[GrapplingShadowSegment, ...]
    observable_movement: Optional[ObservableMovementEvidence]
    active_learning_candidates: tuple[ActiveLearningCandidate, ...]
    session_comparison: Optional[SessionComparisonDelta]
    ghost_difference: Optional[GhostDifferenceExplanation]
    pipeline_version: str = "2.0.0"

    def to_dict(self) -> dict[str, Any]:
        return {
            "sessionId": self.session_id,
            "sequences": [s.to_dict() for s in self.sequences],
            "shadowElbowKnee": [e.to_dict() for e in self.shadow_elbow_knee],
            "shadowGrappling": [g.to_dict() for g in self.shadow_grappling],
            "observableMovement": (
                self.observable_movement.to_dict() if self.observable_movement else None
            ),
            "activeLearningCandidates": [
                c.to_dict() for c in self.active_learning_candidates
            ],
            "sessionComparison": (
                self.session_comparison.to_dict() if self.session_comparison else None
            ),
            "ghostDifference": (
                self.ghost_difference.to_dict() if self.ghost_difference else None
            ),
            "pipelineVersion": self.pipeline_version,
        }


SUPPORTED_GATE_SCHEMA_VERSIONS = frozenset({"1.0.0"})

REQUIRED_AI_GATE_TASK_IDS = tuple(f"Task {i}" for i in range(18, 32))

TASK_NAMES: Mapping[str, str] = {
    "Task 18": "Baseline & Contract Freeze 1.1",
    "Task 19": "Evaluation Protocol & Governance",
    "Task 20": "Confidence Calibration",
    "Task 21": "Active Learning Queue",
    "Task 22": "Model Registry & Drift Signals",
    "Task 23": "Combination Engine",
    "Task 24": "Elbow & Knee Shadow Classifier",
    "Task 25": "Grappling & Clinch Shadow Segmenter",
    "Task 26": "Footwork & Guard Evidence Engine",
    "Task 27": "Personalized Baseline Engine",
    "Task 28": "Session-to-Session Comparison",
    "Task 29": "Reference Motion Normalization",
    "Task 30": "Temporal Alignment & Ghost Engine",
    "Task 31": "Advanced AI Vertical Slice Integration",
}

ALLOWED_IMPLEMENTATION_STATUSES = frozenset({"IMPLEMENTED", "NOT_IMPLEMENTED", "IN_PROGRESS"})
ALLOWED_VALIDATION_STATUSES = frozenset({
    "VALIDATED",
    "NOT_VALIDATED",
    "SHADOW_NOT_VALIDATED",
    "NOT_EVALUABLE",
    "FAILED",
})

HASH_REGEX = re.compile(r"^sha256:[a-f0-9]{64}$")


def is_valid_hash(h: Any) -> bool:
    if not isinstance(h, str):
        return False
    return bool(HASH_REGEX.match(h))


def is_strict_int(val: Any) -> bool:
    return type(val) is int and not isinstance(val, bool)


def is_valid_non_negative_finite_number(val: Any) -> bool:
    if type(val) is bool:
        return False
    if isinstance(val, int):
        return val >= 0
    if isinstance(val, float):
        return math.isfinite(val) and val >= 0
    return False


def parse_strict_utc_timestamp(ts: Any) -> Optional[datetime]:
    if not isinstance(ts, str) or not ts.strip():
        return None
    raw = ts.strip()
    if not (
        raw.endswith("Z")
        or raw.endswith("+00:00")
        or raw.endswith("+0000")
        or raw.endswith("-00:00")
    ):
        return None
    try:
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        if dt.tzinfo is None or dt.utcoffset() != timedelta(0):
            return None
        return dt
    except Exception:
        return None


@dataclass(frozen=True)
class TestSummaryArtifact:
    __test__ = False
    artifact_id: str
    artifact_type: str
    schema_version: str
    generated_at: str
    source_revision: str
    artifact_hash: str
    total_tests: int
    passed: int
    failed: int
    skipped: int = 0
    errors: int = 0
    subtests_passed: Optional[int] = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "artifactId": self.artifact_id,
            "artifactType": self.artifact_type,
            "schemaVersion": self.schema_version,
            "generatedAt": self.generated_at,
            "sourceRevision": self.source_revision,
            "artifactHash": self.artifact_hash,
            "totalTests": self.total_tests,
            "passed": self.passed,
            "failed": self.failed,
            "skipped": self.skipped,
            "errors": self.errors,
            "subtestsPassed": self.subtests_passed,
        }


@dataclass(frozen=True)
class ModuleGateArtifact:
    artifact_id: str
    artifact_type: str
    schema_version: str
    generated_at: str
    source_revision: str
    artifact_hash: str
    task_id: str
    implementation_status: str
    validation_status: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "artifactId": self.artifact_id,
            "artifactType": self.artifact_type,
            "schemaVersion": self.schema_version,
            "generatedAt": self.generated_at,
            "sourceRevision": self.source_revision,
            "artifactHash": self.artifact_hash,
            "taskId": self.task_id,
            "implementationStatus": self.implementation_status,
            "validationStatus": self.validation_status,
        }


@dataclass(frozen=True)
class TrustBoundaryArtifact:
    artifact_id: str
    artifact_type: str
    schema_version: str
    generated_at: str
    source_revision: str
    artifact_hash: str
    credentials_rotated: bool = False
    authoritative_manifest_bound: bool = False
    production_keys_configured: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "artifactId": self.artifact_id,
            "artifactType": self.artifact_type,
            "schemaVersion": self.schema_version,
            "generatedAt": self.generated_at,
            "sourceRevision": self.source_revision,
            "artifactHash": self.artifact_hash,
            "credentialsRotated": self.credentials_rotated,
            "authoritativeManifestBound": self.authoritative_manifest_bound,
            "productionKeysConfigured": self.production_keys_configured,
        }


@dataclass(frozen=True)
class ReleaseGateInput:
    artifact_id: str
    schema_version: str = "1.0.0"
    artifact_type: str = "release_gate_input"
    generated_at: Optional[str] = None
    source_revision: Optional[str] = None
    artifact_hash: Optional[str] = None
    test_summary: Optional[TestSummaryArtifact] = None
    module_evaluations: Optional[Union[Mapping[str, ModuleGateArtifact], Sequence[ModuleGateArtifact]]] = None
    trust_boundary: Optional[TrustBoundaryArtifact] = None
    max_artifact_age_seconds: Optional[float] = None
    allow_skipped_tests: bool = False


@dataclass(frozen=True)
class ReleaseGateReport:
    gate_version: str
    ai_pipeline_readiness: str
    product_deployment_readiness: str
    tasks_1_17_regression_check: str
    tasks_18_30_modules_evaluated: Mapping[str, str]
    notes: str
    module_implementation_statuses: Mapping[str, str] = field(default_factory=dict)
    module_validation_statuses: Mapping[str, str] = field(default_factory=dict)
    test_summary: Optional[Mapping[str, Any]] = None
    evaluated_at: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "gateVersion": self.gate_version,
            "aiPipelineReadiness": self.ai_pipeline_readiness,
            "productDeploymentReadiness": self.product_deployment_readiness,
            "tasks1To17RegressionCheck": self.tasks_1_17_regression_check,
            "tasks18To30ModulesEvaluated": dict(self.tasks_18_30_modules_evaluated),
            "notes": self.notes,
            "moduleImplementationStatuses": dict(self.module_implementation_statuses),
            "moduleValidationStatuses": dict(self.module_validation_statuses),
            "testSummary": dict(self.test_summary) if self.test_summary else None,
            "evaluatedAt": self.evaluated_at,
        }


class AdvancedAIOrchestrator:
    """Orchestrates all advanced AI modules across a video analysis session with zero fabricated inputs."""

    def __init__(self):
        self.combination_engine = CombinationEngine()
        self.elbow_knee_classifier = ElbowKneeShadowClassifier()
        self.grappling_segmenter = GrapplingShadowSegmenter()
        self.movement_engine = MovementEvidenceEngine()
        self.baseline_engine = BaselineEngine()
        self.session_comparator = SessionComparator()
        self.reference_normalizer = ReferenceNormalizer()
        self.ghost_alignment_engine = GhostAlignmentEngine()
        self.active_learning_selector = ActiveLearningSelector()
        self.technique_discovery_engine = MVPTechniqueDiscoveryEngine()

    def process_session_extensions(
        self,
        session_id: str,
        actions: Sequence[Mapping[str, Any]] = (),
        frame_records: Sequence[Mapping[str, Any]] = (),
        quality_status: QualityStatus = QualityStatus.GOOD,
        person_count: int = 1,
        fps: float = 30.0,
        consent_policy: Optional[TrustedConsentPolicy] = None,
        reference_frames: Optional[Sequence[Sequence[tuple[float, float]]]] = None,
        reference_technique: Optional[str] = None,
        reference_stance: Optional[str] = None,
        athlete_stance: Optional[str] = None,
        camera_view: Optional[str] = None,
        comparison_session: Optional[Mapping[str, Any]] = None,
    ) -> AdvancedVerticalSliceResult:
        inp = AdvancedAnalysisInput(
            session_id=session_id,
            actions=actions,
            frame_records=frame_records,
            quality_status=quality_status,
            person_count=person_count,
            fps=fps,
            consent_policy=consent_policy,
            reference_frames=reference_frames,
            reference_technique=reference_technique,
            reference_stance=reference_stance,
            athlete_stance=athlete_stance,
            camera_view=camera_view,
            comparison_session=comparison_session,
        )
        return self.process_analysis_input(inp)

    def process_analysis_input(self, inp: AdvancedAnalysisInput) -> AdvancedVerticalSliceResult:
        effective_quality = inp.quality_status
        is_blocked = (
            effective_quality == QualityStatus.BLOCKED
            or str(getattr(effective_quality, "value", effective_quality)).upper() == "BLOCKED"
        )

        # 1. Combinations (Abstains under blocked quality)
        sequences = () if is_blocked else tuple(self.combination_engine.extract_sequences(inp.actions))

        # 2. Close-range shadow events (Elbow/Knee) from measured action kinematics
        shadow_ek: list[ElbowKneeShadowEvent] = []
        if not is_blocked:
            for act in inp.actions:
                metrics = act.get("metrics", {})
                phases = act.get("phases", {})
                s_f = int(phases.get("startFrame") or act.get("startFrame", 0))
                e_f = int(phases.get("endFrame") or act.get("endFrame", 0))
                p_f = int(phases.get("peakFrame") or phases.get("impactFrame") or (s_f + e_f) // 2)
                attacking_side = str(act.get("attackingSide") or "unknown")

                # Check elbow kinematics across any action
                elbow_angle_item = metrics.get("maxElbowAngle") or metrics.get("elbowAngleAtPeak")
                elbow_angle_val = (
                    elbow_angle_item.get("value")
                    if isinstance(elbow_angle_item, dict)
                    else elbow_angle_item
                )
                elbow_speed_item = (
                    metrics.get("peakSpeed")
                    or metrics.get("peakVelocity")
                    or metrics.get("elbowVelocity")
                )
                elbow_speed_val = (
                    elbow_speed_item.get("value")
                    if isinstance(elbow_speed_item, dict)
                    else elbow_speed_item
                )
                if isinstance(elbow_angle_val, (int, float)) and isinstance(elbow_speed_val, (int, float)):
                    e = self.elbow_knee_classifier.classify_elbow_candidate(
                        start_frame=s_f,
                        end_frame=e_f,
                        peak_frame=p_f,
                        elbow_angle_at_peak=float(elbow_angle_val),
                        elbow_velocity_norm=float(elbow_speed_val),
                        attacking_side=attacking_side,
                    )
                    if e:
                        shadow_ek.append(e)

                # Check knee kinematics across any action
                knee_angle_item = metrics.get("maxKneeAngle") or metrics.get("kneeAngleAtPeak")
                knee_angle_val = (
                    knee_angle_item.get("value")
                    if isinstance(knee_angle_item, dict)
                    else knee_angle_item
                )
                knee_speed_item = (
                    metrics.get("kneeVelocity")
                    or metrics.get("peakSpeed")
                    or metrics.get("peakVelocity")
                )
                knee_speed_val = (
                    knee_speed_item.get("value")
                    if isinstance(knee_speed_item, dict)
                    else knee_speed_item
                )
                if isinstance(knee_angle_val, (int, float)) and isinstance(knee_speed_val, (int, float)):
                    k = self.elbow_knee_classifier.classify_knee_candidate(
                        start_frame=s_f,
                        end_frame=e_f,
                        peak_frame=p_f,
                        knee_angle_at_peak=float(knee_angle_val),
                        knee_velocity_norm=float(knee_speed_val),
                        attacking_side=attacking_side,
                    )
                    if k:
                        shadow_ek.append(k)

        # 3. Grappling shadow events from measured person count
        shadow_grp: list[GrapplingShadowSegment] = []
        grp_seg = self.grappling_segmenter.segment_interaction(
            start_frame=0,
            end_frame=len(inp.frame_records),
            person_count=inp.person_count,
        )
        shadow_grp.append(grp_seg)

        # 4. Movement Evidence from measured frame landmarks
        movement_ev = None
        if inp.frame_records and not is_blocked:
            # Extract landmarks from a representative guard/stance frame
            rep_frame = inp.frame_records[0]
            landmarks = rep_frame.get("landmarks", [])
            if len(landmarks) >= 17:
                def _get_pt(idx: int) -> Optional[tuple[float, float]]:
                    lm = landmarks[idx]
                    x, y, conf = lm.get("x"), lm.get("y"), lm.get("conf", 1.0)
                    if isinstance(x, (int, float)) and isinstance(y, (int, float)) and conf > 0.3:
                        return (float(x), float(y))
                    return None

                # Extract hip sway trajectory across frames
                sway_traj = []
                for fr in inp.frame_records:
                    f_lms = fr.get("landmarks", [])
                    if len(f_lms) >= 13:
                        lh, rh = f_lms[11], f_lms[12]
                        if lh.get("conf", 0) > 0.3 and rh.get("conf", 0) > 0.3:
                            sway_traj.append(((lh["x"] + rh["x"]) / 2.0, (lh["y"] + rh["y"]) / 2.0))

                movement_ev = self.movement_engine.compute_evidence(
                    left_ankle=_get_pt(15),
                    right_ankle=_get_pt(16),
                    left_shoulder=_get_pt(5),
                    right_shoulder=_get_pt(6),
                    left_wrist=_get_pt(9),
                    right_wrist=_get_pt(10),
                    nose_or_chin=_get_pt(0),
                    left_hip=_get_pt(11),
                    right_hip=_get_pt(12),
                    sway_trajectory=sway_traj if len(sway_traj) >= 2 else None,
                    fps=inp.fps,
                    quality_status=effective_quality,
                )
        elif is_blocked:
            movement_ev = self.movement_engine.compute_evidence(
                left_ankle=None,
                right_ankle=None,
                left_shoulder=None,
                right_shoulder=None,
                left_wrist=None,
                right_wrist=None,
                nose_or_chin=None,
                quality_status=QualityStatus.BLOCKED,
            )

        # 5. Active Learning Candidates with privacy consent gating
        al_candidates: list[ActiveLearningCandidate] = []
        for act in inp.actions:
            c = self.active_learning_selector.evaluate_sample(
                video_id=inp.session_id,
                action_id=str(act.get("id") or act.get("actionId") or "act_0"),
                technique=str(act.get("technique") or "unknown"),
                confidence=act.get("confidence"),
                consent_policy=inp.consent_policy,
            )
            if c:
                al_candidates.append(c)

        # 6. Session Comparison (Only when caller explicitly provides comparison session)
        comp_result = None
        if inp.comparison_session and not is_blocked:
            current_session_data = {
                "sessionId": inp.session_id,
                "stance": inp.athlete_stance or "unknown",
                "cameraView": inp.camera_view or "unknown",
                "qualityStatus": effective_quality,
                "metrics": {"totalActions": float(len(inp.actions))},
            }
            comp_result = self.session_comparator.compare_sessions(
                current_session_data, inp.comparison_session
            )

        # 7. Ghost Mode Alignment (Only when caller explicitly provides reference motion)
        ghost_expl = None
        if inp.reference_frames and inp.frame_records and not is_blocked:
            raw_athlete_frames = []
            for fr in inp.frame_records:
                lms = fr.get("landmarks", [])
                if len(lms) >= 17:
                    raw_athlete_frames.append([(float(lm["x"]), float(lm["y"])) for lm in lms])

            if raw_athlete_frames:
                ath_manifest = self.reference_normalizer.normalize_trajectory(
                    reference_id=f"ath_{inp.session_id}",
                    technique=inp.reference_technique or "unknown",
                    source_stance=inp.athlete_stance or "orthodox",
                    target_stance=inp.athlete_stance or "orthodox",
                    raw_frames=raw_athlete_frames,
                    fps=inp.fps,
                )
                ath_norm_kps = [
                    f.normalized_keypoints for f in ath_manifest.normalized_frames if f.is_valid
                ]

                ref_manifest = self.reference_normalizer.normalize_trajectory(
                    reference_id="ref_provided",
                    technique=inp.reference_technique or "unknown",
                    source_stance=inp.reference_stance or (inp.athlete_stance or "orthodox"),
                    target_stance=inp.athlete_stance or (inp.reference_stance or "orthodox"),
                    raw_frames=inp.reference_frames,
                    fps=inp.fps,
                )

                camera_compatible = (
                    inp.camera_view is not None
                    and inp.camera_view != "unknown"
                    and inp.camera_view != ""
                )

                if ath_norm_kps:
                    ghost_expl = self.ghost_alignment_engine.align_and_explain(
                        athlete_normalized_frames=ath_norm_kps,
                        reference_manifest=ref_manifest,
                        athlete_fps=inp.fps,
                        quality_status=effective_quality,
                        camera_compatible=camera_compatible,
                    )

        return AdvancedVerticalSliceResult(
            session_id=inp.session_id,
            sequences=sequences,
            shadow_elbow_knee=tuple(shadow_ek),
            shadow_grappling=tuple(shadow_grp),
            observable_movement=movement_ev,
            active_learning_candidates=tuple(al_candidates),
            session_comparison=comp_result,
            ghost_difference=ghost_expl,
            pipeline_version="2.0.0",
        )

    def analyze_session(
        self,
        session_id: str,
        athlete_id: str,
        technique: str,
        stance: str,
        actions: Sequence[Mapping[str, Any]] = (),
        frame_records: Sequence[Mapping[str, Any]] = (),
        historical_references: Optional[Sequence[Mapping[str, Any]]] = None,
        camera_view: Optional[str] = None,
        martial_art: Optional[str] = None,
        rubric_version: Optional[str] = None,
        quality_status: QualityStatus = QualityStatus.GOOD,
        person_count: int = 1,
        fps: float = 30.0,
        expected_techniques: Optional[Sequence[str]] = None,
        consent_policy: Optional[TrustedConsentPolicy] = None,
        comparison_session: Optional[Mapping[str, Any]] = None,
        reference_frames: Optional[Sequence[Sequence[tuple[float, float]]]] = None,
        reference_technique: Optional[str] = None,
        reference_stance: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        Orchestrates vertical slice integration, MVP technique discovery, and personalized baseline.
        """
        vertical_slice = self.process_session_extensions(
            session_id=session_id,
            actions=actions,
            frame_records=frame_records,
            quality_status=quality_status,
            person_count=person_count,
            fps=fps,
            consent_policy=consent_policy,
            reference_frames=reference_frames,
            reference_technique=reference_technique,
            reference_stance=reference_stance,
            athlete_stance=stance,
            camera_view=camera_view,
            comparison_session=comparison_session,
        )

        discovered_techniques: list[dict[str, Any]] = []
        is_blocked = (
            quality_status == QualityStatus.BLOCKED
            or str(getattr(quality_status, "value", quality_status)).upper() == "BLOCKED"
        )
        if not is_blocked and actions:
            stance_ctx = resolve_stance_context(user_stance=stance)
            for act in actions:
                fam = str(act.get("family") or "").lower()
                metrics = act.get("metrics", {})
                unwrapped: dict[str, Any] = {}
                for k, v in metrics.items():
                    if isinstance(v, dict) and "value" in v:
                        unwrapped[k] = v["value"]
                    else:
                        unwrapped[k] = v
                if "attacking_side" not in unwrapped:
                    unwrapped["attacking_side"] = act.get("attackingSide")
                if fam == "punch":
                    dec = self.technique_discovery_engine.classify_punch_candidate(
                        features=unwrapped,
                        stance_context=stance_ctx,
                        expected_techniques=expected_techniques,
                    )
                    discovered_techniques.append({
                        "actionId": act.get("id") or act.get("actionId"),
                        "decision": dec.to_dict(),
                    })
                elif fam == "kick":
                    dec = self.technique_discovery_engine.classify_kick_candidate(
                        features=unwrapped,
                        stance_context=stance_ctx,
                        expected_techniques=expected_techniques,
                    )
                    discovered_techniques.append({
                        "actionId": act.get("id") or act.get("actionId"),
                        "decision": dec.to_dict(),
                    })

        baseline = self.baseline_engine.compute_baseline(
            athlete_id=athlete_id,
            technique=technique,
            stance=stance,
            historical_references=historical_references,
            camera_view=camera_view,
            martial_art=martial_art,
            rubric_version=rubric_version,
        )

        return {
            "sessionId": session_id,
            "athleteId": athlete_id,
            "technique": technique,
            "stance": stance,
            "verticalSlice": vertical_slice.to_dict(),
            "baseline": baseline.to_dict(),
            "discoveredTechniques": discovered_techniques,
        }

    def generate_release_gate_report(
        self,
        gate_input: Any = None,
        clock: Optional[Callable[[], datetime]] = None,
    ) -> ReleaseGateReport:
        now = clock() if clock is not None else datetime.now(timezone.utc)
        evaluated_at = now.isoformat()

        if gate_input is None:
            return ReleaseGateReport(
                gate_version="1.1.0",
                ai_pipeline_readiness="NOT_RUN",
                product_deployment_readiness="DISABLED_PENDING_TRUST_BOUNDARY",
                tasks_1_17_regression_check="NOT_RUN (No test results supplied)",
                tasks_18_30_modules_evaluated={},
                notes="No gate input artifact supplied. Evaluation not run.",
                module_implementation_statuses={},
                module_validation_statuses={},
                test_summary=None,
                evaluated_at=evaluated_at,
            )

        if not isinstance(gate_input, ReleaseGateInput):
            return ReleaseGateReport(
                gate_version="1.1.0",
                ai_pipeline_readiness="NOT_EVALUABLE",
                product_deployment_readiness="NOT_EVALUABLE",
                tasks_1_17_regression_check="NOT_EVALUABLE (Invalid input type)",
                tasks_18_30_modules_evaluated={},
                notes=f"Expected ReleaseGateInput, received {type(gate_input).__name__}",
                module_implementation_statuses={},
                module_validation_statuses={},
                test_summary=None,
                evaluated_at=evaluated_at,
            )

        # Validate policy fields early: max_artifact_age_seconds and allow_skipped_tests
        raw_max_age = getattr(gate_input, "max_artifact_age_seconds", None)
        if raw_max_age is not None:
            if not is_valid_non_negative_finite_number(raw_max_age):
                return ReleaseGateReport(
                    gate_version="1.1.0",
                    ai_pipeline_readiness="NOT_EVALUABLE",
                    product_deployment_readiness="NOT_EVALUABLE",
                    tasks_1_17_regression_check="NOT_EVALUABLE (Invalid max_artifact_age_seconds)",
                    tasks_18_30_modules_evaluated={},
                    notes=f"Invalid max_artifact_age_seconds: {str(raw_max_age)[:60]}. Must be a finite non-negative number.",
                    module_implementation_statuses={},
                    module_validation_statuses={},
                    test_summary=None,
                    evaluated_at=evaluated_at,
                )

        raw_allow_skipped = getattr(gate_input, "allow_skipped_tests", False)
        if type(raw_allow_skipped) is not bool:
            return ReleaseGateReport(
                gate_version="1.1.0",
                ai_pipeline_readiness="NOT_EVALUABLE",
                product_deployment_readiness="NOT_EVALUABLE",
                tasks_1_17_regression_check="NOT_EVALUABLE (Invalid allow_skipped_tests policy)",
                tasks_18_30_modules_evaluated={},
                notes=f"Invalid allow_skipped_tests policy: {raw_allow_skipped!r}. Must be a boolean.",
                module_implementation_statuses={},
                module_validation_statuses={},
                test_summary=None,
                evaluated_at=evaluated_at,
            )

        def _validate_artifact_provenance_and_freshness(
            art: Any,
            expected_type: str,
            expected_revision: Optional[str],
            max_age: Optional[float],
            now_dt: datetime,
        ) -> Optional[str]:
            art_id = getattr(art, "artifact_id", None)
            if not art_id or not isinstance(art_id, str) or not art_id.strip():
                return "Missing or empty artifact_id"

            art_type = getattr(art, "artifact_type", None)
            if art_type != expected_type:
                return f"Invalid artifact_type in {art_id}: expected '{expected_type}', got '{art_type}'"

            h = getattr(art, "artifact_hash", None)
            if not is_valid_hash(h):
                return f"Invalid artifact hash format in {art_id}: {h}"

            s_ver = getattr(art, "schema_version", None)
            if s_ver not in SUPPORTED_GATE_SCHEMA_VERSIONS:
                return f"Unsupported schema version in {art_id}: {s_ver}"

            s_rev = getattr(art, "source_revision", None)
            if not s_rev or not isinstance(s_rev, str) or not s_rev.strip():
                return f"Missing or empty source_revision in {art_id}"

            if expected_revision is not None and s_rev != expected_revision:
                return f"Mismatched source_revision in {art_id}: expected '{expected_revision}', got '{s_rev}'"

            gen_at = getattr(art, "generated_at", None)
            dt = parse_strict_utc_timestamp(gen_at)
            if dt is None:
                return f"Missing or non-UTC timezone-aware timestamp in {art_id}: {gen_at}"

            if dt > now_dt + timedelta(seconds=10):
                return f"Future timestamp beyond 10s tolerance in {art_id}: {gen_at}"

            if max_age is not None:
                if not is_valid_non_negative_finite_number(max_age):
                    return f"Invalid max_age in {art_id}: {str(max_age)[:60]}"
                age_sec = (now_dt - dt).total_seconds()
                if age_sec > max_age:
                    return f"Stale artifact {art_id}: age {age_sec:.1f}s exceeds max {max_age}s"

            return None

        # Validate Root Artifact Provenance & Freshness first
        root_err = _validate_artifact_provenance_and_freshness(
            gate_input,
            expected_type="release_gate_input",
            expected_revision=None,
            max_age=gate_input.max_artifact_age_seconds,
            now_dt=now,
        )
        if root_err:
            return ReleaseGateReport(
                gate_version="1.1.0",
                ai_pipeline_readiness="NOT_EVALUABLE",
                product_deployment_readiness="NOT_EVALUABLE",
                tasks_1_17_regression_check="NOT_EVALUABLE (Root artifact provenance error)",
                tasks_18_30_modules_evaluated={},
                notes=f"Root artifact provenance error: {root_err}",
                module_implementation_statuses={},
                module_validation_statuses={},
                test_summary=None,
                evaluated_at=evaluated_at,
            )

        root_revision = gate_input.source_revision

        test_sum = gate_input.test_summary
        if test_sum is None:
            return ReleaseGateReport(
                gate_version="1.1.0",
                ai_pipeline_readiness="NOT_EVALUABLE",
                product_deployment_readiness="DISABLED_PENDING_TRUST_BOUNDARY",
                tasks_1_17_regression_check="NOT_RUN (Missing test execution summary)",
                tasks_18_30_modules_evaluated={},
                notes="Missing test_summary artifact.",
                module_implementation_statuses={},
                module_validation_statuses={},
                test_summary=None,
                evaluated_at=evaluated_at,
            )

        if not isinstance(test_sum, TestSummaryArtifact):
            return ReleaseGateReport(
                gate_version="1.1.0",
                ai_pipeline_readiness="NOT_EVALUABLE",
                product_deployment_readiness="DISABLED_PENDING_TRUST_BOUNDARY",
                tasks_1_17_regression_check="NOT_EVALUABLE (Invalid test summary artifact type)",
                tasks_18_30_modules_evaluated={},
                notes=f"Invalid test summary type: {type(test_sum).__name__}",
                module_implementation_statuses={},
                module_validation_statuses={},
                test_summary=None,
                evaluated_at=evaluated_at,
            )

        err = _validate_artifact_provenance_and_freshness(
            test_sum,
            expected_type="test_execution_summary",
            expected_revision=root_revision,
            max_age=gate_input.max_artifact_age_seconds,
            now_dt=now,
        )
        if err:
            return ReleaseGateReport(
                gate_version="1.1.0",
                ai_pipeline_readiness="NOT_EVALUABLE",
                product_deployment_readiness="DISABLED_PENDING_TRUST_BOUNDARY",
                tasks_1_17_regression_check="NOT_EVALUABLE",
                tasks_18_30_modules_evaluated={},
                notes=err,
                module_implementation_statuses={},
                module_validation_statuses={},
                test_summary=None,
                evaluated_at=evaluated_at,
            )

        # Enforce strict integer types for test totals (prohibit float, bool, str)
        if not (
            is_strict_int(test_sum.total_tests)
            and is_strict_int(test_sum.passed)
            and is_strict_int(test_sum.failed)
            and is_strict_int(test_sum.skipped)
            and is_strict_int(test_sum.errors)
        ):
            return ReleaseGateReport(
                gate_version="1.1.0",
                ai_pipeline_readiness="NOT_EVALUABLE",
                product_deployment_readiness="DISABLED_PENDING_TRUST_BOUNDARY",
                tasks_1_17_regression_check="NOT_EVALUABLE (Invalid test count type)",
                tasks_18_30_modules_evaluated={},
                notes="Test counts must be strict integers (floats, booleans, and strings are rejected).",
                module_implementation_statuses={},
                module_validation_statuses={},
                test_summary=None,
                evaluated_at=evaluated_at,
            )

        if (
            test_sum.total_tests < 0
            or test_sum.passed < 0
            or test_sum.failed < 0
            or test_sum.skipped < 0
            or test_sum.errors < 0
        ):
            return ReleaseGateReport(
                gate_version="1.1.0",
                ai_pipeline_readiness="NOT_EVALUABLE",
                product_deployment_readiness="DISABLED_PENDING_TRUST_BOUNDARY",
                tasks_1_17_regression_check="NOT_EVALUABLE (Negative test count)",
                tasks_18_30_modules_evaluated={},
                notes="Negative test totals encountered.",
                module_implementation_statuses={},
                module_validation_statuses={},
                test_summary=test_sum.to_dict(),
                evaluated_at=evaluated_at,
            )

        if test_sum.subtests_passed is not None:
            if not is_strict_int(test_sum.subtests_passed) or test_sum.subtests_passed < 0:
                return ReleaseGateReport(
                    gate_version="1.1.0",
                    ai_pipeline_readiness="NOT_EVALUABLE",
                    product_deployment_readiness="DISABLED_PENDING_TRUST_BOUNDARY",
                    tasks_1_17_regression_check="NOT_EVALUABLE (Invalid subtests_passed count)",
                    tasks_18_30_modules_evaluated={},
                    notes="subtests_passed must be None or a strict non-negative integer.",
                    module_implementation_statuses={},
                    module_validation_statuses={},
                    test_summary=test_sum.to_dict(),
                    evaluated_at=evaluated_at,
                )

        sum_components = test_sum.passed + test_sum.failed + test_sum.skipped + test_sum.errors
        if test_sum.total_tests != sum_components or test_sum.passed > test_sum.total_tests:
            return ReleaseGateReport(
                gate_version="1.1.0",
                ai_pipeline_readiness="NOT_EVALUABLE",
                product_deployment_readiness="DISABLED_PENDING_TRUST_BOUNDARY",
                tasks_1_17_regression_check="NOT_EVALUABLE (Inconsistent test totals)",
                tasks_18_30_modules_evaluated={},
                notes=f"Inconsistent test totals: total={test_sum.total_tests}, sum={sum_components}, passed={test_sum.passed}",
                module_implementation_statuses={},
                module_validation_statuses={},
                test_summary=test_sum.to_dict(),
                evaluated_at=evaluated_at,
            )

        test_failed = (test_sum.failed > 0 or test_sum.errors > 0)
        if test_failed:
            test_check_str = f"FAIL ({test_sum.passed} passed, {test_sum.failed} failed, {test_sum.errors} errors)"
        else:
            test_check_str = f"PASS ({test_sum.passed} passed, 0 failed)"

        # Validate trust_boundary artifact if supplied
        raw_tb = getattr(gate_input, "trust_boundary", None)
        if raw_tb is not None:
            if not isinstance(raw_tb, TrustBoundaryArtifact):
                return ReleaseGateReport(
                    gate_version="1.1.0",
                    ai_pipeline_readiness="NOT_EVALUABLE",
                    product_deployment_readiness="DISABLED_PENDING_TRUST_BOUNDARY",
                    tasks_1_17_regression_check=test_check_str,
                    tasks_18_30_modules_evaluated={},
                    notes=f"Invalid trust_boundary type: expected TrustBoundaryArtifact, got {type(raw_tb).__name__}",
                    module_implementation_statuses={},
                    module_validation_statuses={},
                    test_summary=test_sum.to_dict(),
                    evaluated_at=evaluated_at,
                )

            tb_err = _validate_artifact_provenance_and_freshness(
                raw_tb,
                expected_type="trust_boundary_artifact",
                expected_revision=root_revision,
                max_age=gate_input.max_artifact_age_seconds,
                now_dt=now,
            )
            if tb_err:
                return ReleaseGateReport(
                    gate_version="1.1.0",
                    ai_pipeline_readiness="NOT_EVALUABLE",
                    product_deployment_readiness="DISABLED_PENDING_TRUST_BOUNDARY",
                    tasks_1_17_regression_check=test_check_str,
                    tasks_18_30_modules_evaluated={},
                    notes=f"Trust boundary artifact provenance error: {tb_err}",
                    module_implementation_statuses={},
                    module_validation_statuses={},
                    test_summary=test_sum.to_dict(),
                    evaluated_at=evaluated_at,
                )

            if (
                type(raw_tb.credentials_rotated) is not bool
                or type(raw_tb.authoritative_manifest_bound) is not bool
                or type(raw_tb.production_keys_configured) is not bool
            ):
                return ReleaseGateReport(
                    gate_version="1.1.0",
                    ai_pipeline_readiness="NOT_EVALUABLE",
                    product_deployment_readiness="DISABLED_PENDING_TRUST_BOUNDARY",
                    tasks_1_17_regression_check=test_check_str,
                    tasks_18_30_modules_evaluated={},
                    notes="Trust boundary artifact boolean fields must be strict booleans.",
                    module_implementation_statuses={},
                    module_validation_statuses={},
                    test_summary=test_sum.to_dict(),
                    evaluated_at=evaluated_at,
                )

        raw_mods = gate_input.module_evaluations
        if raw_mods is None:
            return ReleaseGateReport(
                gate_version="1.1.0",
                ai_pipeline_readiness="NOT_EVALUABLE",
                product_deployment_readiness="DISABLED_PENDING_TRUST_BOUNDARY",
                tasks_1_17_regression_check=test_check_str,
                tasks_18_30_modules_evaluated={},
                notes="Missing module_evaluations.",
                module_implementation_statuses={},
                module_validation_statuses={},
                test_summary=test_sum.to_dict(),
                evaluated_at=evaluated_at,
            )

        mods: dict[str, ModuleGateArtifact] = {}
        if isinstance(raw_mods, Mapping):
            for k, mod_art in raw_mods.items():
                if not isinstance(k, str) or not isinstance(mod_art, ModuleGateArtifact):
                    return ReleaseGateReport(
                        gate_version="1.1.0",
                        ai_pipeline_readiness="NOT_EVALUABLE",
                        product_deployment_readiness="DISABLED_PENDING_TRUST_BOUNDARY",
                        tasks_1_17_regression_check=test_check_str,
                        tasks_18_30_modules_evaluated={},
                        notes=f"Invalid mapping entry: key={k}, value={type(mod_art).__name__}",
                        module_implementation_statuses={},
                        module_validation_statuses={},
                        test_summary=test_sum.to_dict(),
                        evaluated_at=evaluated_at,
                    )
                if k != mod_art.task_id:
                    return ReleaseGateReport(
                        gate_version="1.1.0",
                        ai_pipeline_readiness="NOT_EVALUABLE",
                        product_deployment_readiness="DISABLED_PENDING_TRUST_BOUNDARY",
                        tasks_1_17_regression_check=test_check_str,
                        tasks_18_30_modules_evaluated={},
                        notes=f"Mismatched task_id: key is '{k}' but artifact has '{mod_art.task_id}'",
                        module_implementation_statuses={},
                        module_validation_statuses={},
                        test_summary=test_sum.to_dict(),
                        evaluated_at=evaluated_at,
                    )
                mods[k] = mod_art
        elif isinstance(raw_mods, Sequence) and not isinstance(raw_mods, (str, bytes)):
            seen_tasks = set()
            for mod_art in raw_mods:
                if not isinstance(mod_art, ModuleGateArtifact):
                    return ReleaseGateReport(
                        gate_version="1.1.0",
                        ai_pipeline_readiness="NOT_EVALUABLE",
                        product_deployment_readiness="DISABLED_PENDING_TRUST_BOUNDARY",
                        tasks_1_17_regression_check=test_check_str,
                        tasks_18_30_modules_evaluated={},
                        notes=f"Invalid sequence entry: {type(mod_art).__name__}",
                        module_implementation_statuses={},
                        module_validation_statuses={},
                        test_summary=test_sum.to_dict(),
                        evaluated_at=evaluated_at,
                    )
                if mod_art.task_id in seen_tasks:
                    return ReleaseGateReport(
                        gate_version="1.1.0",
                        ai_pipeline_readiness="NOT_EVALUABLE",
                        product_deployment_readiness="DISABLED_PENDING_TRUST_BOUNDARY",
                        tasks_1_17_regression_check=test_check_str,
                        tasks_18_30_modules_evaluated={},
                        notes=f"Duplicate task ID in module evaluations: {mod_art.task_id}",
                        module_implementation_statuses={},
                        module_validation_statuses={},
                        test_summary=test_sum.to_dict(),
                        evaluated_at=evaluated_at,
                    )
                seen_tasks.add(mod_art.task_id)
                mods[mod_art.task_id] = mod_art
        else:
            return ReleaseGateReport(
                gate_version="1.1.0",
                ai_pipeline_readiness="NOT_EVALUABLE",
                product_deployment_readiness="DISABLED_PENDING_TRUST_BOUNDARY",
                tasks_1_17_regression_check=test_check_str,
                tasks_18_30_modules_evaluated={},
                notes=f"Invalid module_evaluations type: {type(raw_mods).__name__}",
                module_implementation_statuses={},
                module_validation_statuses={},
                test_summary=test_sum.to_dict(),
                evaluated_at=evaluated_at,
            )

        for k in mods.keys():
            if k not in REQUIRED_AI_GATE_TASK_IDS:
                return ReleaseGateReport(
                    gate_version="1.1.0",
                    ai_pipeline_readiness="NOT_EVALUABLE",
                    product_deployment_readiness="DISABLED_PENDING_TRUST_BOUNDARY",
                    tasks_1_17_regression_check=test_check_str,
                    tasks_18_30_modules_evaluated={},
                    notes=f"Unknown task ID in module evaluations: {k}",
                    module_implementation_statuses={},
                    module_validation_statuses={},
                    test_summary=test_sum.to_dict(),
                    evaluated_at=evaluated_at,
                )

        missing_tasks = [t for t in REQUIRED_AI_GATE_TASK_IDS if t not in mods]
        if missing_tasks:
            return ReleaseGateReport(
                gate_version="1.1.0",
                ai_pipeline_readiness="NOT_EVALUABLE",
                product_deployment_readiness="DISABLED_PENDING_TRUST_BOUNDARY",
                tasks_1_17_regression_check=test_check_str,
                tasks_18_30_modules_evaluated={},
                notes=f"Missing required tasks in module evaluations: {missing_tasks}",
                module_implementation_statuses={},
                module_validation_statuses={},
                test_summary=test_sum.to_dict(),
                evaluated_at=evaluated_at,
            )

        impl_statuses: dict[str, str] = {}
        val_statuses: dict[str, str] = {}
        combined_evaluated: dict[str, str] = {}

        any_module_failed = False
        any_not_implemented = False
        any_not_validated = False

        for task_id in REQUIRED_AI_GATE_TASK_IDS:
            mod_art = mods[task_id]

            err = _validate_artifact_provenance_and_freshness(
                mod_art,
                expected_type="module_gate_artifact",
                expected_revision=root_revision,
                max_age=gate_input.max_artifact_age_seconds,
                now_dt=now,
            )
            if err:
                return ReleaseGateReport(
                    gate_version="1.1.0",
                    ai_pipeline_readiness="NOT_EVALUABLE",
                    product_deployment_readiness="DISABLED_PENDING_TRUST_BOUNDARY",
                    tasks_1_17_regression_check=test_check_str,
                    tasks_18_30_modules_evaluated={},
                    notes=err,
                    module_implementation_statuses={},
                    module_validation_statuses={},
                    test_summary=test_sum.to_dict(),
                    evaluated_at=evaluated_at,
                )

            impl_status = mod_art.implementation_status
            val_status = mod_art.validation_status

            if impl_status not in ALLOWED_IMPLEMENTATION_STATUSES:
                return ReleaseGateReport(
                    gate_version="1.1.0",
                    ai_pipeline_readiness="NOT_EVALUABLE",
                    product_deployment_readiness="DISABLED_PENDING_TRUST_BOUNDARY",
                    tasks_1_17_regression_check=test_check_str,
                    tasks_18_30_modules_evaluated={},
                    notes=f"Unknown implementation_status for {task_id}: {impl_status}",
                    module_implementation_statuses={},
                    module_validation_statuses={},
                    test_summary=test_sum.to_dict(),
                    evaluated_at=evaluated_at,
                )

            if val_status not in ALLOWED_VALIDATION_STATUSES:
                return ReleaseGateReport(
                    gate_version="1.1.0",
                    ai_pipeline_readiness="NOT_EVALUABLE",
                    product_deployment_readiness="DISABLED_PENDING_TRUST_BOUNDARY",
                    tasks_1_17_regression_check=test_check_str,
                    tasks_18_30_modules_evaluated={},
                    notes=f"Unknown validation_status for {task_id}: {val_status}",
                    module_implementation_statuses={},
                    module_validation_statuses={},
                    test_summary=test_sum.to_dict(),
                    evaluated_at=evaluated_at,
                )

            impl_statuses[task_id] = impl_status
            val_statuses[task_id] = val_status

            if impl_status != "IMPLEMENTED":
                any_not_implemented = True
            if val_status == "FAILED":
                any_module_failed = True
            elif val_status in ("NOT_VALIDATED", "SHADOW_NOT_VALIDATED", "NOT_EVALUABLE"):
                any_not_validated = True
            elif val_status != "VALIDATED":
                any_not_validated = True

            task_desc = f"{task_id} {TASK_NAMES.get(task_id, '')}"
            if impl_status != "IMPLEMENTED":
                derived_status = impl_status
            elif val_status == "VALIDATED":
                derived_status = "IMPLEMENTED_AND_CONTRACT_TESTED"
            else:
                derived_status = val_status
            combined_evaluated[task_desc] = derived_status

        has_disallowed_skipped = (test_sum.skipped > 0 and not gate_input.allow_skipped_tests)

        if test_failed or any_module_failed:
            ai_readiness = "FAILED"
            reasons = []
            if test_failed:
                reasons.append(f"Test suite failed ({test_sum.failed} failed, {test_sum.errors} errors)")
            if any_module_failed:
                reasons.append("One or more modules failed validation")
            ai_notes = "; ".join(reasons)
        elif has_disallowed_skipped:
            ai_readiness = "NOT_EVALUABLE"
            ai_notes = f"Skipped tests present ({test_sum.skipped}) without allow_skipped_tests policy"
        elif any_not_implemented:
            ai_readiness = "NOT_IMPLEMENTED"
            ai_notes = "One or more required modules are not fully implemented"
        elif any_not_validated:
            ai_readiness = "NOT_VALIDATED"
            ai_notes = "One or more required modules are not validated against gold benchmarks"
        else:
            ai_readiness = "READY"
            ai_notes = "All required AI pipeline modules pass deterministic verification with validated provenance"

        if ai_readiness == "READY":
            product_readiness = "GOLD_READY_DISABLED_PENDING_TRUST_BOUNDARY"
        else:
            product_readiness = "DISABLED_PENDING_TRUST_BOUNDARY"

        notes_prefix = ai_notes.rstrip(".")
        notes = (
            f"{notes_prefix}. "
            "Task 14 product backend trust boundary status: PENDING_CREDENTIAL_ROTATION_AND_AUTHORITATIVE_MANIFEST."
        )

        return ReleaseGateReport(
            gate_version="1.1.0",
            ai_pipeline_readiness=ai_readiness,
            product_deployment_readiness=product_readiness,
            tasks_1_17_regression_check=test_check_str,
            tasks_18_30_modules_evaluated=combined_evaluated,
            notes=notes,
            module_implementation_statuses=impl_statuses,
            module_validation_statuses=val_statuses,
            test_summary=test_sum.to_dict(),
            evaluated_at=evaluated_at,
        )
