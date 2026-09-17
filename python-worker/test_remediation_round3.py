"""
test_remediation_round3.py — Comprehensive Test Suite for Remediation Round 3 Blockers

Covers all 13 mandatory adversarial and regression tests required for Final Acceptance:
 1. test_blocked_quality_full_payload_abstention
 2. test_blocked_quality_symmetrical_punch_and_kick_sanitization
 3. test_audit_replay_rejects_forged_effective_technique
 4. test_audit_replay_rejects_forged_effective_attacking_side_and_limb_role
 5. test_audit_replay_rejects_forged_effective_phases
 6. test_finding_verification_inspects_nested_findings_and_rejects_mutated_values
 7. test_audit_validation_enforces_non_empty_fields_supported_versions_and_monotonicity
 8. test_truthful_gold_ready_rejects_missing_or_invalid_backend_attestation
 9. test_truthful_gold_ready_rejects_missing_reviewer_agreement_policy
10. test_canonical_serialization_fails_on_unserializable_and_hmac_is_real
11. test_export_allowlist_filters_non_allowlisted_phases_and_metrics
12. test_positive_action_from_kick_candidates (front, round, and side kicks)
13. test_process_video_integration_with_real_quality_gate
"""

import copy
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import json
import math
import unittest
from typing import Any, Mapping, Optional, Sequence
from unittest.mock import MagicMock, patch

import numpy as np
import torch

from action_result import action_from_kick, action_from_punch
from kick_analyzer import KickResult
from pipeline.classification import ClassifiedTechnique
from pipeline.contracts import EvidenceLevel, to_json_safe
from pipeline.dataset_export import (
    ALLOWED_METRIC_FIELDS,
    ALLOWED_PHASE_FIELDS,
    ALLOWED_PROVENANCE_SOURCES,
    AnonymizedSample,
    AttestationVerification,
    BackendAttestationVerifier,
    DatasetExportEngine,
    DatasetSplit,
    ExportApprovalPolicy,
    NonceStore,
    PersistentNonceStore,
    REQUIRED_GOLD_CLASSES,
    REVIEWER_AGREEMENT_POLICY_VERSIONS,
    reset_nonce_store_for_testing,
)
from pipeline.kinematic_features import KinematicFeatureSet, KinematicMetricContract
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
from pipeline.shadow_classifier import (
    ClassifierProvenance,
    DecisionStatus,
    TechniqueCandidate,
)
from pipeline.shadow_punch_classifier import (
    ExtendedClassificationDecision,
    ValidationStatus,
)
from pipeline.shadow_kick_classifier import (
    ShadowKickClassifier,
    VALIDATION_STATUS_NOT_VALIDATED,
)
from pipeline.stance_context import resolve_stance_context
from process_video import process_video
from punch_analyzer import PunchResult


def _make_dummy_frame(wrist_x=0.5, wrist_y=0.4, conf=0.9, frame_idx=0, time_ms=0.0):
    landmarks = []
    for idx in range(17):
        if idx in (9, 10):
            landmarks.append({"x": wrist_x, "y": wrist_y, "conf": conf})
        elif idx in (7, 8):
            landmarks.append({"x": 0.45, "y": 0.45, "conf": conf})
        elif idx in (5, 6):
            landmarks.append({"x": 0.40, "y": 0.40, "conf": conf})
        elif idx in (11, 12):
            landmarks.append({"x": 0.45, "y": 0.65, "conf": conf})
        elif idx in (13, 14):
            landmarks.append({"x": 0.45, "y": 0.80, "conf": conf})
        elif idx in (15, 16):
            landmarks.append({"x": wrist_x, "y": wrist_y, "conf": conf})
        else:
            landmarks.append({"x": 0.5, "y": 0.5, "conf": conf})
    return {"landmarks": landmarks, "frameIdx": frame_idx, "timeMs": time_ms}


def _make_metric(name: str, value: float, unit: str = "degrees") -> KinematicMetricContract:
    return KinematicMetricContract(
        name=name,
        value=value,
        unit=unit,
        confidence=0.9,
        evidence_level=EvidenceLevel.OBSERVED,
        evidence_quality="GOOD",
        frames_used=(5, 10),
        time_window_ms=(166.7, 333.3),
    )


class TestRemediationRound3(unittest.TestCase):

    def setUp(self):
        self.salt = "production_bench_salt_secret_2026_xyz"
        self.orthodox_ctx = resolve_stance_context(user_stance="orthodox")
        DatasetExportEngine.set_system_verifier(None)
        reset_nonce_store_for_testing()

    def tearDown(self):
        DatasetExportEngine.set_system_verifier(None)
        reset_nonce_store_for_testing()

    # ─────────────────────────────────────────────────────────────────────────
    # 1 & 2: Blocked Quality Abstention & Symmetric Sanitization
    # ─────────────────────────────────────────────────────────────────────────

    def test_blocked_quality_full_payload_abstention(self):
        """Verify that a blocked video completely suppresses technical conclusions in actions and summary."""
        mock_punch = PunchResult(
            punch_type="punch",
            arm="right",
            score=88,
            grade="A",
            emoji="🥊",
            details=["Good velocity"],
            max_elbow_angle=92.0,
            peak_speed=6.0,
            guard_preserved=True,
            start_frame=5,
            impact_frame=15,
            end_frame=25,
            start_time_ms=166.7,
            impact_time_ms=500.0,
            end_time_ms=833.3,
            findings=[{"id": "f_p1", "title": "Great punch", "severity": "positive"}],
        )
        mock_kick = KickResult(
            score=82,
            grade="B",
            emoji="🥋",
            details=["Good pivot"],
            min_chamber_angle=45.0,
            max_extension_angle=160.0,
            peak_speed=2.5,
            start_frame=6,
            chamber_peak_frame=14,
            impact_frame=20,
            end_frame=32,
            start_time_ms=200.0,
            chamber_peak_time_ms=466.7,
            impact_time_ms=666.7,
            end_time_ms=1066.7,
            active_leg="right",
            findings=[{"id": "f_k1", "title": "Good chamber", "severity": "positive"}],
        )

        dummy_frame = np.zeros((720, 1280, 3), dtype=np.uint8)

        with patch("process_video.cv2.VideoCapture") as mock_cap, \
             patch("process_video.YOLO") as mock_yolo, \
             patch("process_video.ActionPipeline.get_results") as mock_get_results, \
             patch("process_video.evaluate_video_quality") as mock_eval:

            mock_get_results.return_value = ([mock_punch], [mock_kick])
            mock_eval.return_value = AnalysisQuality(
                status=QualityStatus.BLOCKED,
                reason_codes=("BLOCKED_LOW_RESOLUTION", "CAMERA_VIEW_UNSUITABLE"),
                metrics={"fps": 30.0, "duration_ms": 1000.0, "total_frames": 30},
                quality_version="1.0.0",
                evaluator_version="1.0.0",
                evaluated_at="2026-09-17T00:00:00Z",
                adjusted_evidence_level=EvidenceLevel.UNAVAILABLE,
                recommendation="abstain_technical_analysis",
            )
            cap_inst = MagicMock()
            cap_inst.isOpened.return_value = True
            cap_inst.get.side_effect = lambda prop: 30.0 if prop == 5 else 30 if prop == 7 else 1280 if prop == 3 else 720
            cap_inst.read.side_effect = [(True, dummy_frame)] * 30 + [(False, None)]
            mock_cap.return_value = cap_inst

            res = process_video("test_blocked.mp4", verbose=False)

        # Top-level checks
        self.assertEqual(res["analysisQuality"]["status"], "blocked")
        self.assertIn("QUALITY_BLOCKED", res.get("reasonCodes", []))

        # Summary checks
        summary = res["summary"]
        self.assertEqual(summary["qualityStatus"], "blocked")
        self.assertEqual(summary["primaryAction"], "unknown")
        self.assertIn("QUALITY_BLOCKED", summary.get("reasonCodes", []))

        # Action payload checks
        actions = res["actions"]
        self.assertEqual(len(actions), 2)
        for act in actions:
            self.assertEqual(act["technique"], "unknown")
            self.assertEqual(act["attackingSide"], "unknown")
            self.assertEqual(act["limbRole"], "unknown")
            self.assertEqual(act["metrics"], {})
            self.assertIsNone(act["confidence"]["classification"])
            self.assertIsNone(act["phases"]["impactFrame"])
            self.assertIsNone(act["phases"]["impactTimeMs"])
            self.assertEqual(act["phases"]["impactType"], "unavailable")
            self.assertIsNotNone(act["phases"]["startFrame"])
            self.assertIsNotNone(act["phases"]["endFrame"])
            self.assertEqual(act["assessment"]["findings"], [])
            self.assertEqual(act["assessment"]["criteria"], [])
            self.assertIsNone(act["assessment"]["score"])
            self.assertEqual(act["assessment"]["grade"].lower(), "insufficient_evidence")
            self.assertIn("QUALITY_BLOCKED", act.get("reasonCodes", []))

    def test_blocked_quality_symmetrical_punch_and_kick_sanitization(self):
        """Verify legacy punch and kick payloads are sanitized symmetrically under blocked quality."""
        mock_punch = PunchResult(
            punch_type="punch",
            arm="right",
            score=88,
            grade="A",
            emoji="🥊",
            details=["Fast jab"],
            max_elbow_angle=92.0,
            peak_speed=6.0,
            guard_preserved=True,
            start_frame=5,
            impact_frame=15,
            end_frame=25,
            start_time_ms=166.7,
            impact_time_ms=500.0,
            end_time_ms=833.3,
            findings=[{"title": "Punch error", "severity": "warning"}],
        )
        mock_kick = KickResult(
            score=82,
            grade="B",
            emoji="🥋",
            details=["Chamber sharp"],
            min_chamber_angle=45.0,
            max_extension_angle=160.0,
            peak_speed=2.5,
            start_frame=6,
            chamber_peak_frame=14,
            impact_frame=20,
            end_frame=32,
            start_time_ms=200.0,
            chamber_peak_time_ms=466.7,
            impact_time_ms=666.7,
            end_time_ms=1066.7,
            active_leg="right",
            findings=[{"title": "Kick error", "severity": "warning"}],
        )

        dummy_frame = np.zeros((720, 1280, 3), dtype=np.uint8)

        with patch("process_video.cv2.VideoCapture") as mock_cap, \
             patch("process_video.YOLO") as mock_yolo, \
             patch("process_video.ActionPipeline.get_results") as mock_get_results, \
             patch("process_video.evaluate_video_quality") as mock_eval:

            mock_get_results.return_value = ([mock_punch], [mock_kick])
            mock_eval.return_value = AnalysisQuality(
                status=QualityStatus.BLOCKED,
                reason_codes=("BLOCKED_LOW_RESOLUTION",),
                metrics={"fps": 30.0, "duration_ms": 1000.0, "total_frames": 30},
                quality_version="1.0.0",
                evaluator_version="1.0.0",
                evaluated_at="2026-09-17T00:00:00Z",
                adjusted_evidence_level=EvidenceLevel.UNAVAILABLE,
                recommendation="abstain_technical_analysis",
            )
            cap_inst = MagicMock()
            cap_inst.isOpened.return_value = True
            cap_inst.get.side_effect = lambda prop: 30.0 if prop == 5 else 30 if prop == 7 else 1280 if prop == 3 else 720
            cap_inst.read.side_effect = [(True, dummy_frame)] * 30 + [(False, None)]
            mock_cap.return_value = cap_inst

            res = process_video("test_blocked_symmetry.mp4", verbose=False)

        # Legacy punches sanitization
        self.assertEqual(len(res["punches"]), 1)
        p = res["punches"][0]
        self.assertIsNone(p["score"])
        self.assertEqual(p["grade"], "INSUFFICIENT_EVIDENCE")
        self.assertEqual(p["details"], [])
        self.assertEqual(p["findings"], [])
        self.assertEqual(p["criterionResults"], [])
        self.assertEqual(p["arm"], "unknown")
        self.assertIsNone(p["maxElbowAngle"])
        self.assertIsNone(p["peakSpeed"])
        self.assertIsNone(p["guardPreserved"])

        # Legacy kicks sanitization
        self.assertEqual(len(res["kicks"]), 1)
        k = res["kicks"][0]
        self.assertIsNone(k["score"])
        self.assertEqual(k["grade"], "INSUFFICIENT_EVIDENCE")
        self.assertEqual(k["details"], [])
        self.assertEqual(k["findings"], [])
        self.assertEqual(k["criterionResults"], [])
        self.assertEqual(k["activeLeg"], "unknown")
        self.assertIsNone(k["minChamberAngle"])
        self.assertIsNone(k["maxExtensionAngle"])
        self.assertIsNone(k["peakSpeed"])
        self.assertIsNone(k["chamberPeakFrame"])
        self.assertIsNone(k["chamberPeakTimeMs"])

    # ─────────────────────────────────────────────────────────────────────────
    # 3, 4, 5, 6, 7: Audit Trail Replay & Validation
    # ─────────────────────────────────────────────────────────────────────────

    def test_audit_replay_rejects_forged_effective_technique(self):
        """Verify that caller-supplied effective_technique mismatching canonical replay is rejected."""
        aid = "act_test_forge_tech"
        rec = ReviewAuditRecord(
            record_id="rec_001",
            action_id=aid,
            target_field=TargetField.TECHNIQUE,
            review_action=ReviewAction.ACCEPT,
            ai_original_value="cross",
            corrected_value=None,
            reviewer_id="coach_alice",
            reviewer_role=ReviewerRole.COACH,
            reason="Confirmed cross",
            timestamp="2026-09-17T10:00:00Z",
            idempotency_token="tok_001",
            version="1.0.0",
        )
        # Caller supplies forged effective_technique = "hook"
        view = MaterializedActionView(
            action_id=aid,
            ai_original={
                "technique": "cross",
                "family": "punch",
                "attacking_side": "right",
                "limb_role": "rear",
                "metrics": {"speed": 8.5},
                "phases": {"startFrame": 0, "endFrame": 20},
            },
            effective_technique="hook",  # FORGERY: Should be "cross"
            effective_attacking_side="right",
            effective_limb_role="rear",
            effective_phases={"startFrame": 0, "endFrame": 20},
            effective_findings=(),
            review_status="coach_approved",
            audit_trail=(rec,),
            updated_at="2026-09-17T10:00:00Z",
        )
        eligible, reason = DatasetExportEngine.validate_audit_eligibility(view, ExportApprovalPolicy.STRICT_COACH_APPROVED)
        self.assertFalse(eligible)
        self.assertIn("forged_effective_technique_mismatch", reason)

    def test_audit_replay_rejects_forged_effective_attacking_side_and_limb_role(self):
        """Verify that caller-supplied effective_attacking_side or limb_role mismatch is rejected."""
        aid = "act_test_forge_side"
        rec = ReviewAuditRecord(
            record_id="rec_002",
            action_id=aid,
            target_field=TargetField.TECHNIQUE,
            review_action=ReviewAction.ACCEPT,
            ai_original_value="cross",
            corrected_value=None,
            reviewer_id="coach_alice",
            reviewer_role=ReviewerRole.COACH,
            reason="Confirmed",
            timestamp="2026-09-17T10:00:00Z",
            idempotency_token="tok_002",
            version="1.0.0",
        )
        # Caller supplies forged attacking_side = "left" when ai_original was "right"
        view = MaterializedActionView(
            action_id=aid,
            ai_original={
                "technique": "cross",
                "family": "punch",
                "attacking_side": "right",
                "limb_role": "rear",
                "metrics": {},
                "phases": {},
            },
            effective_technique="cross",
            effective_attacking_side="left",  # FORGERY: ai_original has "right" and no side audit record exists
            effective_limb_role="rear",
            effective_phases={},
            effective_findings=(),
            review_status="coach_approved",
            audit_trail=(rec,),
            updated_at="2026-09-17T10:00:00Z",
        )
        eligible, reason = DatasetExportEngine.validate_audit_eligibility(view, ExportApprovalPolicy.STRICT_COACH_APPROVED)
        self.assertFalse(eligible)
        self.assertIn("forged_effective_attacking_side_mismatch", reason)

    def test_audit_replay_rejects_forged_effective_phases(self):
        """Verify that caller-supplied effective_phases mismatch is rejected."""
        aid = "act_test_forge_phases"
        rec = ReviewAuditRecord(
            record_id="rec_003",
            action_id=aid,
            target_field=TargetField.TECHNIQUE,
            review_action=ReviewAction.ACCEPT,
            ai_original_value="cross",
            corrected_value=None,
            reviewer_id="coach_alice",
            reviewer_role=ReviewerRole.COACH,
            reason="Confirmed",
            timestamp="2026-09-17T10:00:00Z",
            idempotency_token="tok_003",
            version="1.0.0",
        )
        view = MaterializedActionView(
            action_id=aid,
            ai_original={
                "technique": "cross",
                "family": "punch",
                "attacking_side": "right",
                "limb_role": "rear",
                "metrics": {},
                "phases": {"startFrame": 0, "endFrame": 20},
            },
            effective_technique="cross",
            effective_attacking_side="right",
            effective_limb_role="rear",
            effective_phases={"startFrame": 999, "endFrame": 1020},  # FORGERY
            effective_findings=(),
            review_status="coach_approved",
            audit_trail=(rec,),
            updated_at="2026-09-17T10:00:00Z",
        )
        eligible, reason = DatasetExportEngine.validate_audit_eligibility(view, ExportApprovalPolicy.STRICT_COACH_APPROVED)
        self.assertFalse(eligible)
        self.assertIn("forged_effective_phases_mismatch", reason)

    def test_finding_verification_inspects_nested_findings_and_rejects_mutated_values(self):
        """Verify that audit trail correctly locates findings in ai_original.assessment.findings and catches mutation."""
        aid = "act_test_nested_findings"
        # Audit record referencing finding f_guard
        rec = ReviewAuditRecord(
            record_id="rec_004",
            action_id=aid,
            target_field=TargetField.FINDING,
            review_action=ReviewAction.ACCEPT,
            ai_original_value={"id": "f_guard", "title": "TAMPERED_TITLE"},  # Mutated title
            corrected_value=None,
            reviewer_id="coach_alice",
            reviewer_role=ReviewerRole.COACH,
            reason="Confirmed finding",
            timestamp="2026-09-17T10:00:00Z",
            idempotency_token="tok_004",
            version="1.0.0",
        )
        view = MaterializedActionView(
            action_id=aid,
            ai_original={
                "technique": "jab",
                "family": "punch",
                "attacking_side": "left",
                "limb_role": "lead",
                "assessment": {
                    "findings": [
                        {"id": "f_guard", "title": "Dropped guard", "severity": "warning"}
                    ]
                },
                "metrics": {},
                "phases": {},
            },
            effective_technique="jab",
            effective_attacking_side="left",
            effective_limb_role="lead",
            effective_phases={},
            effective_findings=(),
            review_status="coach_approved",
            audit_trail=(rec,),
            updated_at="2026-09-17T10:00:00Z",
        )
        eligible, reason = DatasetExportEngine.validate_audit_eligibility(view, ExportApprovalPolicy.STRICT_COACH_APPROVED)
        self.assertFalse(eligible)
        self.assertIn("mutated_ai_original_value_for_finding", reason)

    def test_audit_validation_enforces_non_empty_fields_supported_versions_and_monotonicity(self):
        """Verify strict validation of reviewer_id, token, reason, version, and monotonic timestamps."""
        aid = "act_test_validation_rules"

        # 1. Empty reviewer_id
        rec_empty_rev = ReviewAuditRecord(
            record_id="rec_v1",
            action_id=aid,
            target_field=TargetField.TECHNIQUE,
            review_action=ReviewAction.ACCEPT,
            ai_original_value="jab",
            corrected_value=None,
            reviewer_id="",  # INVALID
            reviewer_role=ReviewerRole.COACH,
            reason="Good",
            timestamp="2026-09-17T10:00:00Z",
            idempotency_token="tok_v1",
            version="1.0.0",
        )
        view1 = MaterializedActionView(
            action_id=aid,
            ai_original={"technique": "jab", "family": "punch", "attacking_side": "left", "limb_role": "lead"},
            effective_technique="jab",
            effective_attacking_side="left",
            effective_limb_role="lead",
            effective_phases={},
            effective_findings=(),
            review_status="coach_approved",
            audit_trail=(rec_empty_rev,),
            updated_at="2026-09-17T10:00:00Z",
        )
        eligible1, reason1 = DatasetExportEngine.validate_audit_eligibility(view1, ExportApprovalPolicy.STRICT_COACH_APPROVED)
        self.assertFalse(eligible1)
        self.assertIn("empty_reviewer_id", reason1)

        # 2. Unsupported version
        rec_bad_ver = ReviewAuditRecord(
            record_id="rec_v2",
            action_id=aid,
            target_field=TargetField.TECHNIQUE,
            review_action=ReviewAction.ACCEPT,
            ai_original_value="jab",
            corrected_value=None,
            reviewer_id="coach_alice",
            reviewer_role=ReviewerRole.COACH,
            reason="Good",
            timestamp="2026-09-17T10:00:00Z",
            idempotency_token="tok_v2",
            version="99.0.0",  # INVALID
        )
        view2 = MaterializedActionView(
            action_id=aid,
            ai_original={"technique": "jab", "family": "punch", "attacking_side": "left", "limb_role": "lead"},
            effective_technique="jab",
            effective_attacking_side="left",
            effective_limb_role="lead",
            effective_phases={},
            effective_findings=(),
            review_status="coach_approved",
            audit_trail=(rec_bad_ver,),
            updated_at="2026-09-17T10:00:00Z",
        )
        eligible2, reason2 = DatasetExportEngine.validate_audit_eligibility(view2, ExportApprovalPolicy.STRICT_COACH_APPROVED)
        self.assertFalse(eligible2)
        self.assertIn("unsupported_audit_version_99.0.0", reason2)

        # 3. Non-monotonic timestamps
        rec_time1 = ReviewAuditRecord(
            record_id="rec_v3_a",
            action_id=aid,
            target_field=TargetField.TECHNIQUE,
            review_action=ReviewAction.CORRECT,
            ai_original_value="jab",
            corrected_value="cross",
            reviewer_id="coach_alice",
            reviewer_role=ReviewerRole.COACH,
            reason="Corrected",
            timestamp="2026-09-17T10:05:00Z",
            idempotency_token="tok_v3_a",
            version="1.0.0",
        )
        rec_time2 = ReviewAuditRecord(
            record_id="rec_v3_b",
            action_id=aid,
            target_field=TargetField.TECHNIQUE,
            review_action=ReviewAction.ACCEPT,
            ai_original_value="cross",
            corrected_value=None,
            reviewer_id="coach_alice",
            reviewer_role=ReviewerRole.COACH,
            reason="Accepted correction",
            timestamp="2026-09-17T10:03:00Z",  # EARLIER THAN rec_time1! NON-MONOTONIC
            idempotency_token="tok_v3_b",
            version="1.0.0",
        )
        view3 = MaterializedActionView(
            action_id=aid,
            ai_original={"technique": "jab", "family": "punch", "attacking_side": "left", "limb_role": "lead"},
            effective_technique="cross",
            effective_attacking_side="left",
            effective_limb_role="lead",
            effective_phases={},
            effective_findings=(),
            review_status="coach_approved",
            audit_trail=(rec_time1, rec_time2),
            updated_at="2026-09-17T10:05:00Z",
        )
        eligible3, reason3 = DatasetExportEngine.validate_audit_eligibility(view3, ExportApprovalPolicy.STRICT_COACH_APPROVED)
        self.assertFalse(eligible3)
        self.assertIn("non_monotonic_timestamps", reason3)

    # ─────────────────────────────────────────────────────────────────────────
    # 8 & 9: Truthful GOLD_READY Criteria & Attestation
    # ─────────────────────────────────────────────────────────────────────────

    def _build_140_sample_views(self):
        views = []
        for tech in REQUIRED_GOLD_CLASSES:
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
                    reason="Verified technique",
                    timestamp=f"2026-09-17T10:{s % 60:02d}:00Z",
                    idempotency_token=f"tok_{tech}_{s:03d}",
                    version="1.0.0",
                )
                v = MaterializedActionView(
                    action_id=aid,
                    ai_original={
                        "technique": tech,
                        "family": fam,
                        "attacking_side": "right",
                        "limb_role": "rear",
                        "qualityStatus": "pass",
                        "adjustedEvidenceLevel": "observed",
                        "metrics": {"speed": 8.5, "peak_speed": 8.5},
                        "phases": {"startFrame": 0, "endFrame": 20},
                    },
                    effective_technique=tech,
                    effective_attacking_side="right",
                    effective_limb_role="rear",
                    effective_phases={"startFrame": 0, "endFrame": 20},
                    effective_findings=(),
                    review_status="coach_approved",
                    audit_trail=(rec,),
                    updated_at="2026-09-17T10:00:00Z",
                )
                views.append((v, f"athlete_{tech}_{s:02d}"))
        return views

    def test_truthful_gold_ready_rejects_missing_or_invalid_backend_attestation(self):
        """Verify that export without valid backend_attestation results in NOT_GOLD_READY."""
        action_views = self._build_140_sample_views()

        # Missing attestation
        manifest, _ = DatasetExportEngine.export_dataset(
            action_views_with_athlete=action_views,
            salt=self.salt,
            policy=ExportApprovalPolicy.STRICT_COACH_APPROVED,
            dataset_id="test_ds_no_attestation",
            backend_attestation=None,
            reviewer_agreement_policy="dual_review_consensus",
        )
        self.assertEqual(manifest.status, "NOT_GOLD_READY")
        self.assertIn("MISSING_BACKEND_ATTESTATION", manifest.readiness_gaps)
        self.assertIn("NOT_GOLD_READY", manifest.notes)

        # Short / invalid attestation
        manifest2, _ = DatasetExportEngine.export_dataset(
            action_views_with_athlete=action_views,
            salt=self.salt,
            policy=ExportApprovalPolicy.STRICT_COACH_APPROVED,
            dataset_id="test_ds_short_attestation",
            backend_attestation="too_short",  # < 16 chars
            reviewer_agreement_policy="dual_review_consensus",
        )
        self.assertEqual(manifest2.status, "NOT_GOLD_READY")
        self.assertIn("MISSING_BACKEND_ATTESTATION", manifest2.readiness_gaps)

    def test_truthful_gold_ready_rejects_missing_reviewer_agreement_policy(self):
        """Verify that synthetic single-review fixtures without agreement policy result in NOT_GOLD_READY."""
        action_views = self._build_140_sample_views()

        manifest, _ = DatasetExportEngine.export_dataset(
            action_views_with_athlete=action_views,
            salt=self.salt,
            policy=ExportApprovalPolicy.STRICT_COACH_APPROVED,
            dataset_id="test_ds_no_agreement",
            backend_attestation="attestation_production_secret_token_12345",
            reviewer_agreement_policy=None,  # Missing agreement policy!
        )
        self.assertEqual(manifest.status, "NOT_GOLD_READY")
        self.assertIn("MISSING_REVIEWER_AGREEMENT_POLICY", manifest.readiness_gaps)

    # ─────────────────────────────────────────────────────────────────────────
    # 10 & 11: Canonical Serialization, Real HMAC & Export Allowlist
    # ─────────────────────────────────────────────────────────────────────────

    def test_canonical_serialization_fails_on_unserializable_and_hmac_is_real(self):
        """Verify strict canonical serialization (no default=str bypass) and actual HMAC SHA-256."""
        # Unserializable type must raise TypeError in to_json_safe
        class CustomObject:
            pass

        unserializable_payload = {"key": CustomObject()}
        safe_canonical = to_json_safe(unserializable_payload)
        with self.assertRaises(TypeError):
            json.dumps(safe_canonical, sort_keys=True, separators=(",", ":"))

        # Real HMAC verification
        action_views = self._build_140_sample_views()[:1]
        manifest, samples = DatasetExportEngine.export_dataset(
            action_views_with_athlete=action_views,
            salt=self.salt,
            policy=ExportApprovalPolicy.STRICT_COACH_APPROVED,
            dataset_id="test_ds_hmac",
            backend_attestation="attestation_production_secret_token_12345",
            reviewer_agreement_policy="dual_review_consensus",
        )
        sample = samples[0]
        athlete_id = action_views[0][1]
        expected_hmac = hmac.new(
            self.salt.encode("utf-8"),
            athlete_id.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()[:16]

        self.assertEqual(sample.athlete_hash, expected_hmac)

    def test_export_allowlist_filters_non_allowlisted_phases_and_metrics(self):
        """Verify that non-allowlisted phases and metrics are strictly filtered out during export."""
        aid = "act_test_allowlist"
        rec = ReviewAuditRecord(
            record_id="rec_al_001",
            action_id=aid,
            target_field=TargetField.TECHNIQUE,
            review_action=ReviewAction.ACCEPT,
            ai_original_value="cross",
            corrected_value=None,
            reviewer_id="coach_alice",
            reviewer_role=ReviewerRole.COACH,
            reason="Confirmed",
            timestamp="2026-09-17T10:00:00Z",
            idempotency_token="tok_al_001",
            version="1.0.0",
        )
        raw_phases = {
            "startFrame": 0,
            "endFrame": 20,
            "launchFrame": 5,
            "peakFrame": 10,
            "debugBufferFrame": 999,  # DISALLOWED
            "unfilteredFps": 60.0,    # DISALLOWED
        }
        raw_metrics = {
            "speed": 8.5,
            "peak_speed": 8.5,
            "max_elbow_angle": 160.0,
            "internal_debug_metric": 42.0,  # DISALLOWED
            "scratch_counter": 100,         # DISALLOWED
        }
        view = MaterializedActionView(
            action_id=aid,
            ai_original={
                "technique": "cross",
                "family": "punch",
                "attacking_side": "right",
                "limb_role": "rear",
                "qualityStatus": "pass",
                "adjustedEvidenceLevel": "observed",
                "metrics": raw_metrics,
                "phases": raw_phases,
            },
            effective_technique="cross",
            effective_attacking_side="right",
            effective_limb_role="rear",
            effective_phases=raw_phases,
            effective_findings=(),
            review_status="coach_approved",
            audit_trail=(rec,),
            updated_at="2026-09-17T10:00:00Z",
        )

        manifest, samples = DatasetExportEngine.export_dataset(
            action_views_with_athlete=[(view, "athlete_dan")],
            salt=self.salt,
            policy=ExportApprovalPolicy.STRICT_COACH_APPROVED,
            dataset_id="test_ds_allowlist",
            backend_attestation="attestation_production_secret_token_12345",
            reviewer_agreement_policy="dual_review_consensus",
        )
        s = samples[0]

        # Verify phases contain only allowed fields
        for field in s.phases:
            self.assertIn(field, ALLOWED_PHASE_FIELDS)
        self.assertNotIn("debugBufferFrame", s.phases)
        self.assertNotIn("unfilteredFps", s.phases)

        # Verify metrics contain only allowed fields
        for metric in s.metrics:
            self.assertIn(metric, ALLOWED_METRIC_FIELDS)
        self.assertNotIn("internal_debug_metric", s.metrics)
        self.assertNotIn("scratch_counter", s.metrics)

    # ─────────────────────────────────────────────────────────────────────────
    # 12: Positive action_from_kick Candidates with REAL Kinematics
    # ─────────────────────────────────────────────────────────────────────────

    def test_positive_action_from_kick_candidates(self):
        """Verify front_kick, round_kick, and side_kick candidates are reached via action_from_kick with REAL kinematic extractor (NO mocks/patches)."""
        # 1. Front kick: Ankle moves straight sagittal forward, hips level
        front_frames = []
        for i in range(20):
            lm = [{"x": 0.5, "y": 0.5, "conf": 0.95} for _ in range(17)]
            lm[5] = {"x": 0.45, "y": 0.35, "conf": 0.95}
            lm[6] = {"x": 0.55, "y": 0.35, "conf": 0.95}
            lm[11] = {"x": 0.45, "y": 0.65, "conf": 0.95}
            lm[12] = {"x": 0.55, "y": 0.65, "conf": 0.95}
            lm[14] = {"x": 0.55, "y": 0.60, "conf": 0.95}
            ay = 0.85 - (i * 0.023)
            lm[16] = {"x": 0.55, "y": ay, "conf": 0.95}
            front_frames.append({"frameIdx": i, "timeMs": round(i * 33.3333, 2), "landmarks": lm})

        kick_f = KickResult(
            score=80, grade="A", emoji="🥋", details=["Good"],
            min_chamber_angle=45.0, max_extension_angle=160.0, peak_speed=2.5,
            start_frame=0, end_frame=19, start_time_ms=0.0, end_time_ms=round(19 * 33.3333, 2),
            impact_frame=14, impact_time_ms=round(14 * 33.3333, 2), chamber_peak_frame=8, chamber_peak_time_ms=round(8 * 33.3333, 2),
            active_leg="right",
        )
        act_front = action_from_kick(
            kick=kick_f,
            action_id="act_front_pos",
            source_action_id="kick_1",
            keypoints_trajectory=front_frames,
            stance_context=self.orthodox_ctx,
        )
        shadow_f = act_front.shadowClassification
        self.assertIsNotNone(shadow_f)
        self.assertEqual(shadow_f["status"], "classified")
        self.assertEqual(shadow_f["candidate"]["technique"], "front_kick")
        self.assertIn("FRONT_KICK_SAGITTAL_MATCHED", shadow_f["reasonCodes"])

        # 2. Roundhouse kick: Hips rotate 50 deg in transverse plane, ankle moves along circular arc
        round_frames = []
        for i in range(20):
            t = i / 19.0
            theta = t * math.radians(50.0)
            lm = [{"x": 0.5, "y": 0.5, "conf": 0.95} for _ in range(17)]
            lm[5] = {"x": 0.45, "y": 0.35, "conf": 0.95}
            lm[6] = {"x": 0.55, "y": 0.35, "conf": 0.95}
            hip_r = 0.08
            lm[11] = {"x": 0.50 - hip_r * math.cos(theta), "y": 0.65 - hip_r * math.sin(theta), "conf": 0.95}
            lm[12] = {"x": 0.50 + hip_r * math.cos(theta), "y": 0.65 + hip_r * math.sin(theta), "conf": 0.95}
            arc_angle = t * math.pi * 0.7
            ax = 0.50 + 0.30 * math.cos(arc_angle)
            ay = 0.80 - 0.35 * math.sin(arc_angle)
            lm[14] = {"x": 0.52, "y": 0.60, "conf": 0.95}
            lm[16] = {"x": ax, "y": ay, "conf": 0.95}
            round_frames.append({"frameIdx": i, "timeMs": round(i * 33.3333, 2), "landmarks": lm})

        kick_r = KickResult(
            score=80, grade="A", emoji="🥋", details=["Good"],
            min_chamber_angle=45.0, max_extension_angle=160.0, peak_speed=2.5,
            start_frame=0, end_frame=19, start_time_ms=0.0, end_time_ms=round(19 * 33.3333, 2),
            impact_frame=14, impact_time_ms=round(14 * 33.3333, 2), chamber_peak_frame=8, chamber_peak_time_ms=round(8 * 33.3333, 2),
            active_leg="right",
        )
        act_round = action_from_kick(
            kick=kick_r,
            action_id="act_round_pos",
            source_action_id="kick_2",
            keypoints_trajectory=round_frames,
            stance_context=self.orthodox_ctx,
        )
        shadow_r = act_round.shadowClassification
        self.assertIsNotNone(shadow_r)
        self.assertEqual(shadow_r["status"], "classified")
        self.assertEqual(shadow_r["candidate"]["technique"], "round_kick")
        self.assertIn("ROUNDHOUSE_TRANSVERSE_MATCHED", shadow_r["reasonCodes"])

        # 3. Side kick: Torso lean (33.7 deg) + lateral displacement (ratio >= 0.65)
        side_frames = []
        for i in range(20):
            t = i / 19.0
            lm = [{"x": 0.5, "y": 0.5, "conf": 0.95} for _ in range(17)]
            lm[5] = {"x": 0.25, "y": 0.35, "conf": 0.95}
            lm[6] = {"x": 0.35, "y": 0.35, "conf": 0.95}
            lm[11] = {"x": 0.45, "y": 0.65, "conf": 0.95}
            lm[12] = {"x": 0.55, "y": 0.65, "conf": 0.95}
            if t < 0.4:
                ax = 0.50 - (t / 0.4) * 0.05
                ay = 0.75 - (t / 0.4) * 0.15
            else:
                alpha = (t - 0.4) / 0.6
                ax = 0.45 + alpha * 0.40
                ay = 0.60 + alpha * 0.05
            lm[14] = {"x": 0.50, "y": 0.60, "conf": 0.95}
            lm[16] = {"x": ax, "y": ay, "conf": 0.95}
            side_frames.append({"frameIdx": i, "timeMs": round(i * 33.3333, 2), "landmarks": lm})

        kick_s = KickResult(
            score=80, grade="A", emoji="🥋", details=["Good"],
            min_chamber_angle=45.0, max_extension_angle=160.0, peak_speed=2.5,
            start_frame=0, end_frame=19, start_time_ms=0.0, end_time_ms=round(19 * 33.3333, 2),
            impact_frame=14, impact_time_ms=round(14 * 33.3333, 2), chamber_peak_frame=8, chamber_peak_time_ms=round(8 * 33.3333, 2),
            active_leg="right",
        )
        act_side = action_from_kick(
            kick=kick_s,
            action_id="act_side_pos",
            source_action_id="kick_3",
            keypoints_trajectory=side_frames,
            stance_context=self.orthodox_ctx,
        )
        shadow_s = act_side.shadowClassification
        self.assertIsNotNone(shadow_s)
        self.assertEqual(shadow_s["status"], "classified")
        self.assertEqual(shadow_s["candidate"]["technique"], "side_kick")
        self.assertIn("SIDE_KICK_LATERAL_MATCHED", shadow_s["reasonCodes"])

    # ─────────────────────────────────────────────────────────────────────────
    # 13: Fixture-Injected Integration with real Quality Gate
    # ─────────────────────────────────────────────────────────────────────────

    def test_fixture_injected_integration_with_real_quality_gate(self):
        """Fixture-injected integration test verifying exact quality gate metrics without mocks on evaluate_video_quality."""
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

        dummy_frame = np.zeros((720, 1280, 3), dtype=np.uint8)

        kps_arr = np.zeros((1, 17, 3), dtype=np.float32)
        for idx in range(17):
            kps_arr[0, idx] = [0.5 * 1280, (0.2 + idx * 0.03) * 720, 0.95]
        kps_tensor = torch.from_numpy(kps_arr)

        class MockBox:
            xyxy = torch.tensor([[100.0, 100.0, 600.0, 700.0]])
            conf = torch.tensor([0.95])

        class MockYoloResult:
            boxes = [MockBox()]
            keypoints = MagicMock()

        MockYoloResult.keypoints.data = kps_tensor

        with patch("process_video.cv2.VideoCapture") as mock_cap, \
             patch("process_video.YOLO") as mock_yolo, \
             patch("process_video.ActionPipeline.get_results") as mock_get_results:

            mock_get_results.return_value = ([mock_punch], [])
            yolo_inst = MagicMock()
            yolo_inst.return_value = [MockYoloResult()]
            mock_yolo.return_value = yolo_inst

            cap_inst = MagicMock()
            cap_inst.isOpened.return_value = True
            cap_inst.get.side_effect = lambda prop: 30.0 if prop == 5 else 30 if prop == 7 else 1280 if prop == 3 else 720
            cap_inst.read.side_effect = [(True, dummy_frame)] * 30 + [(False, None)]
            mock_cap.return_value = cap_inst

            # Run process_video WITHOUT mocking evaluate_video_quality
            res = process_video("test_real_quality.mp4", verbose=False)

        self.assertIn("analysisQuality", res)
        aq = res["analysisQuality"]
        self.assertEqual(aq["status"], "pass")
        self.assertEqual(aq["metrics"]["totalFrames"], 30)
        self.assertEqual(aq["metrics"]["fps"], 30.0)
        self.assertEqual(aq["reasonCodes"], [])
        self.assertEqual(len(res["actions"]), 1)

    # ─────────────────────────────────────────────────────────────────────────
    # 14: Blocked Output, Sanitized Frames & verbose=True Safety
    # ─────────────────────────────────────────────────────────────────────────

    def test_blocked_quality_sanitizes_frames_and_verbose_logging(self):
        """Verify blocked quality sanitizes frames, omits fabricated provenance, and runs verbose=True without error."""
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
        dummy_frame = np.zeros((720, 1280, 3), dtype=np.uint8)

        with patch("process_video.cv2.VideoCapture") as mock_cap, \
             patch("process_video.YOLO") as mock_yolo, \
             patch("process_video.ActionPipeline.get_results") as mock_get_results, \
             patch("process_video.evaluate_video_quality") as mock_eval:

            mock_get_results.return_value = ([mock_punch], [])
            mock_eval.return_value = AnalysisQuality(
                status=QualityStatus.BLOCKED,
                reason_codes=("missing_frame_ratio_high",),
                metrics={"fps": 30.0, "duration_ms": 1000.0, "total_frames": 30},
                quality_version="1.0.0",
                evaluator_version="1.0.0",
                evaluated_at="2026-09-17T00:00:00Z",
                adjusted_evidence_level=EvidenceLevel.UNAVAILABLE,
                recommendation="reject_unusable",
            )
            cap_inst = MagicMock()
            cap_inst.isOpened.return_value = True
            cap_inst.get.side_effect = lambda prop: 30.0 if prop == 5 else 30 if prop == 7 else 1280 if prop == 3 else 720
            cap_inst.read.side_effect = [(True, dummy_frame)] * 30 + [(False, None)]
            mock_cap.return_value = cap_inst

            # Must run with verbose=True without any UnboundLocalError or exception
            res = process_video("test_blocked_verbose.mp4", verbose=True)

        self.assertEqual(res["analysisQuality"]["status"], "blocked")
        self.assertIn("QUALITY_BLOCKED", res["reasonCodes"])

        # Frames payload must be sanitized under diagnostic contract
        self.assertTrue(len(res["frames"]) > 0)
        for f in res["frames"]:
            self.assertTrue(f.get("diagnosticOnly"))
            self.assertIsNone(f["kneeAngle"])
            self.assertIsNone(f["hipAngle"])
            self.assertIsNone(f["elbowAngleLeft"])
            self.assertIsNone(f["elbowAngleRight"])
            self.assertEqual(f["activeLeg"], "unknown")
            self.assertEqual(f["activeArm"], "unknown")
            self.assertEqual(f["punchState"], "BLOCKED")
            self.assertEqual(f["kickState"], "BLOCKED")
            self.assertIn("QUALITY_BLOCKED", f["reasonCodes"])
            # Raw landmarks must remain available for diagnostics
            self.assertIn("landmarks", f)

        # Action shadow classification must have canonical classifier identity, not fabricated 'shadow_classifier'
        for act in res["actions"]:
            sc = act.get("shadowClassification")
            self.assertIsNotNone(sc)
            self.assertEqual(sc["status"], "abstained")
            if act["family"] == "kick":
                self.assertEqual(sc["classifierId"], "shadow_kick_technique_classifier")
                self.assertEqual(sc["classifierVersion"], "1.0.0")
                self.assertEqual(sc["configVersion"], "1.0.0")
                self.assertEqual(sc["featureVersion"], "1.0.0")
            else:
                self.assertEqual(sc["classifierId"], "shadow_multi_punch_classifier")
                self.assertEqual(sc["classifierVersion"], "2.0.0")
                self.assertEqual(sc["configVersion"], "2.0.0")
                self.assertEqual(sc["featureVersion"], "2.0.0")
            self.assertNotEqual(sc["stanceSource"], "quality_blocked")
            self.assertIn("QUALITY_BLOCKED", act["reasonCodes"])

    # ─────────────────────────────────────────────────────────────────────────
    # 15: Evidence-Based GOLD Readiness Tests
    # ─────────────────────────────────────────────────────────────────────────

    def test_gold_ready_rejects_single_reviewer_synthetic_dataset(self):
        """Single-reviewer synthetic datasets must stay NOT_GOLD_READY with MISSING_REVIEWER_AGREEMENT_EVIDENCE."""
        all_classes = list(REQUIRED_GOLD_CLASSES)
        views = []
        for i in range(560):
            tech = all_classes[i % len(all_classes)]
            aid = f"act_single_{i:04d}"
            # Only ONE reviewer (coach_dan) across all 560 samples
            rec = ReviewAuditRecord(
                record_id=f"rec_s_{i:04d}",
                action_id=aid,
                target_field=TargetField.TECHNIQUE,
                review_action=ReviewAction.ACCEPT,
                ai_original_value=tech,
                corrected_value=None,
                reviewer_id="coach_dan",
                reviewer_role=ReviewerRole.COACH,
                reason="Confirmed",
                timestamp=f"2026-09-17T10:{i % 60:02d}:00Z",
                idempotency_token=f"tok_s_{i:04d}",
                version="1.0.0",
            )
            v = MaterializedActionView(
                action_id=aid,
                ai_original={
                    "technique": tech,
                    "family": "kick" if "kick" in tech else "punch",
                    "attacking_side": "left",
                    "limb_role": "lead",
                    "phases": {"startFrame": 0, "endFrame": 30},
                    "metrics": {"speed": 8.0},
                    "qualityStatus": "pass",
                    "adjustedEvidenceLevel": "observed",
                },
                effective_technique=tech,
                effective_attacking_side="left",
                effective_limb_role="lead",
                effective_phases={"startFrame": 0, "endFrame": 30},
                effective_findings=(),
                review_status="coach_approved",
                audit_trail=(rec,),
                updated_at="2026-09-17T10:00:00Z",
            )
            ath_id = f"athlete_{(i % 20) + 1:03d}"
            views.append((v, ath_id))

        res = DatasetExportEngine.export_dataset(
            views,
            salt=self.salt,
            backend_attestation="att_prod_release_2026",
            reviewer_agreement_policy="dual_review_consensus",  # Caller string cannot bypass evidence check!
        )
        self.assertFalse(res.manifest.is_gold_ready)
        self.assertEqual(res.manifest.status, "NOT_GOLD_READY")
        self.assertIn("MISSING_REVIEWER_AGREEMENT_EVIDENCE", res.manifest.readiness_gaps)

    def test_gold_ready_fails_on_missing_or_unallowed_quality_status_and_evidence_level(self):
        """Missing or unknown qualityStatus and adjustedEvidenceLevel must fail GOLD readiness."""
        action_views = self._build_140_sample_views()

        # 1. Missing qualityStatus
        bad_views_quality = copy.deepcopy(action_views)
        bad_views_quality[0][0].ai_original.pop("qualityStatus", None)
        res_q = DatasetExportEngine.export_dataset(
            bad_views_quality,
            salt=self.salt,
            backend_attestation="att_prod_release_2026",
            reviewer_agreement_policy="dual_review_consensus",
        )
        self.assertFalse(res_q.manifest.is_gold_ready)
        self.assertIn("MISSING_QUALITY_STATUS", res_q.manifest.readiness_gaps)

        # 2. Missing adjustedEvidenceLevel
        bad_views_evidence = copy.deepcopy(action_views)
        bad_views_evidence[0][0].ai_original.pop("adjustedEvidenceLevel", None)
        res_e = DatasetExportEngine.export_dataset(
            bad_views_evidence,
            salt=self.salt,
            backend_attestation="att_prod_release_2026",
            reviewer_agreement_policy="dual_review_consensus",
        )
        self.assertFalse(res_e.manifest.is_gold_ready)
        self.assertIn("MISSING_ADJUSTED_EVIDENCE_LEVEL", res_e.manifest.readiness_gaps)

    def test_gold_ready_structured_attestation_never_serializes_tokens(self):
        """AttestationVerification and BackendAttestationVerifier verify token; secrets are NEVER serialized."""
        raw_secret_token = "att_prod_release_token_secret_xyz123456"
        secret_key = "trusted_production_secret_key_123456"
        signed = BackendAttestationVerifier.create_signed_assertion(
            issuer="mma_backend_authority",
            secret_key=secret_key,
            claims={"secret_token_ref": raw_secret_token},
        )
        verifier = BackendAttestationVerifier.create_configured_verifier(trusted_keys={"mma_backend_authority": secret_key})
        DatasetExportEngine.set_system_verifier(verifier)
        action_views = self._build_140_sample_views()

        res = DatasetExportEngine.export_dataset(
            action_views,
            salt=self.salt,
            backend_attestation=signed,
            reviewer_agreement_policy="dual_review_consensus",
        )
        m_dict = res.manifest.to_dict()

        # Structured fields present
        self.assertIn("attestationId", m_dict)
        self.assertIn("attestationReference", m_dict)
        self.assertIn("attestationDigest", m_dict)
        self.assertIn("attestationStatus", m_dict)
        self.assertEqual(m_dict["attestationStatus"], "VERIFIED")
        self.assertEqual(m_dict["attestationIssuer"], "mma_backend_authority")

        # RAW credentials / secret token NEVER present in serialized manifest dictionary
        self.assertNotIn(raw_secret_token, json.dumps(m_dict))
        self.assertNotIn(secret_key, json.dumps(m_dict))
        self.assertNotEqual(m_dict.get("backendAttestation"), raw_secret_token)
        self.assertTrue(m_dict["attestationReference"].startswith("attref_"))

        # datasetHash must bind attestation digest
        self.assertEqual(len(res.manifest.dataset_hash), 16)

    def test_dataset_export_rejects_arbitrary_provenance_source(self):
        """Allowlist provenance_source (ai_original, coach_review, expert_consensus, dual_review); reject arbitrary strings."""
        action_views = self._build_140_sample_views()[:2]

        with self.assertRaises(ValueError):
            DatasetExportEngine.export_dataset(
                action_views,
                salt=self.salt,
                provenance_source="arbitrary_fabricated_source",
            )

        with self.assertRaises(ValueError):
            AnonymizedSample(
                sample_id="smp_001",
                athlete_hash="ath_001",
                split=DatasetSplit.TRAIN,
                technique="jab",
                attacking_side="left",
                limb_role="lead",
                phases={},
                metrics={},
                review_status="coach_approved",
                audit_hash="hash_001",
                provenance_source="unsupported_provenance",
            )

    # ─────────────────────────────────────────────────────────────────────────
    # 16: Closed Python ValidationStatus Enum & Validation
    # ─────────────────────────────────────────────────────────────────────────

    def test_validation_status_closed_enum_and_validation(self):
        """Enforce validation_status as closed enum ValidationStatus in ExtendedClassificationDecision."""
        prov = ClassifierProvenance(
            classifier_id="test_clf",
            classifier_version="1.0.0",
            config_version="1.0.0",
            feature_version="1.0.0",
            stance_source="coach_declared",
        )

        # Valid enum instances and strings
        d1 = ExtendedClassificationDecision(
            status=DecisionStatus.CLASSIFIED,
            candidate=None,
            reason_codes=(),
            provenance=prov,
            validation_status=ValidationStatus.SHADOW_NOT_VALIDATED,
        )
        self.assertEqual(d1.validation_status, ValidationStatus.SHADOW_NOT_VALIDATED)
        self.assertEqual(d1.to_dict()["validationStatus"], "SHADOW_NOT_VALIDATED")

        d2 = ExtendedClassificationDecision(
            status=DecisionStatus.CLASSIFIED,
            candidate=None,
            reason_codes=(),
            provenance=prov,
            validation_status="VALIDATED",
        )
        self.assertEqual(d2.validation_status, ValidationStatus.VALIDATED)
        self.assertEqual(d2.to_dict()["validationStatus"], "VALIDATED")

        # Invalid string raises ValueError
        with self.assertRaises(ValueError):
            ExtendedClassificationDecision(
                status=DecisionStatus.CLASSIFIED,
                candidate=None,
                reason_codes=(),
                provenance=prov,
                validation_status="UNVALIDATED_CUSTOM_STATUS",
            )

        # Invalid type raises TypeError
        with self.assertRaises(TypeError):
            ExtendedClassificationDecision(
                status=DecisionStatus.CLASSIFIED,
                candidate=None,
                reason_codes=(),
                provenance=prov,
                validation_status=123,  # type: ignore
            )

    # ─────────────────────────────────────────────────────────────────────────
    # Helper: Valid View & Dual Review View Construction
    # ─────────────────────────────────────────────────────────────────────────

    def _make_valid_view(self, action_id: str = "act_100", tech: str = "jab", reviewer_id: str = "coach_dan") -> MaterializedActionView:
        rec = ReviewAuditRecord(
            record_id=f"rec_{action_id}",
            action_id=action_id,
            target_field=TargetField.TECHNIQUE,
            review_action=ReviewAction.ACCEPT,
            ai_original_value=tech,
            corrected_value=None,
            reviewer_id=reviewer_id,
            reviewer_role=ReviewerRole.COACH,
            reason="Confirmed correct technique",
            timestamp="2026-09-17T10:00:00Z",
            idempotency_token=f"tok_{action_id}",
            version="1.0.0",
        )
        return MaterializedActionView(
            action_id=action_id,
            ai_original={
                "technique": tech,
                "family": "kick" if "kick" in tech else "punch",
                "attacking_side": "left",
                "limb_role": "lead",
                "phases": {"startFrame": 0, "endFrame": 30},
                "metrics": {"speed": 8.0},
                "qualityStatus": "pass",
                "adjustedEvidenceLevel": "observed",
            },
            effective_technique=tech,
            effective_attacking_side="left",
            effective_limb_role="lead",
            effective_phases={"startFrame": 0, "endFrame": 30},
            effective_findings=(),
            review_status="coach_approved",
            audit_trail=(rec,),
            updated_at="2026-09-17T10:00:00Z",
        )

    def _make_dual_review_view(
        self,
        action_id: str,
        tech: str = "jab",
        rev1_id: str = "coach_alice",
        rev2_id: str = "expert_bob",
        rev1_action: ReviewAction = ReviewAction.ACCEPT,
        rev2_action: ReviewAction = ReviewAction.ACCEPT,
        rev1_val: Optional[str] = None,
        rev2_val: Optional[str] = None,
    ) -> MaterializedActionView:
        rec1 = ReviewAuditRecord(
            record_id=f"rec_1_{action_id}",
            action_id=action_id,
            target_field=TargetField.TECHNIQUE,
            review_action=rev1_action,
            ai_original_value=tech,
            corrected_value=rev1_val if rev1_action == ReviewAction.CORRECT else None,
            reviewer_id=rev1_id,
            reviewer_role=ReviewerRole.COACH,
            reason="Confirmed technique",
            timestamp="2026-09-17T10:00:00Z",
            idempotency_token=f"tok_1_{action_id}",
            version="1.0.0",
        )
        rec2 = ReviewAuditRecord(
            record_id=f"rec_2_{action_id}",
            action_id=action_id,
            target_field=TargetField.TECHNIQUE,
            review_action=rev2_action,
            ai_original_value=tech,
            corrected_value=rev2_val if rev2_action == ReviewAction.CORRECT else None,
            reviewer_id=rev2_id,
            reviewer_role=ReviewerRole.EXPERT_REVIEWER,
            reason="Verified agreement",
            timestamp="2026-09-17T10:01:00Z",
            idempotency_token=f"tok_2_{action_id}",
            version="1.0.0",
        )
        eff_tech = tech
        if rev2_action == ReviewAction.CORRECT and rev2_val:
            eff_tech = rev2_val
        elif rev1_action == ReviewAction.CORRECT and rev1_val:
            eff_tech = rev1_val

        status = "coach_approved"
        if rev2_action == ReviewAction.CORRECT:
            status = "coach_corrected"
        elif rev2_action == ReviewAction.REJECT:
            status = "coach_rejected"
        else:
            status = "coach_approved"

        return MaterializedActionView(
            action_id=action_id,
            ai_original={
                "technique": tech,
                "family": "kick" if "kick" in tech else "punch",
                "attacking_side": "left",
                "limb_role": "lead",
                "phases": {"startFrame": 0, "endFrame": 30},
                "metrics": {"speed": 8.0},
                "qualityStatus": "pass",
                "adjustedEvidenceLevel": "observed",
            },
            effective_technique=eff_tech,
            effective_attacking_side="left",
            effective_limb_role="lead",
            effective_phases={"startFrame": 0, "endFrame": 30},
            effective_findings=(),
            review_status=status,
            audit_trail=(rec1, rec2),
            updated_at="2026-09-17T10:01:00Z",
        )

    # ─────────────────────────────────────────────────────────────────────────
    # 17: Attestation Cryptographic Bypass & Security Tests (Area 1)
    # ─────────────────────────────────────────────────────────────────────────

    def test_attestation_rejects_arbitrary_att_prod_string(self):
        """Arbitrary att_prod_* string without cryptographic signature is rejected; stays NOT_GOLD_READY."""
        verifier = BackendAttestationVerifier.create_configured_verifier(trusted_keys={"mma_backend_authority": "secret_key_1234567890"})
        is_ok, att_rec, err = verifier.verify("att_prod_arbitrary_unverified_token_string")
        self.assertFalse(is_ok)
        self.assertIsNone(att_rec)
        self.assertEqual(err, "UNVERIFIED_BACKEND_ATTESTATION")

        action_views = self._build_140_sample_views()
        DatasetExportEngine.set_system_verifier(verifier)
        res = DatasetExportEngine.export_dataset(
            action_views,
            salt=self.salt,
            backend_attestation="att_prod_unverified_string",
            reviewer_agreement_policy="dual_review_consensus",
        )
        self.assertFalse(res.manifest.is_gold_ready)
        self.assertEqual(res.manifest.status, "NOT_GOLD_READY")
        self.assertIn("UNVERIFIED_BACKEND_ATTESTATION", res.manifest.readiness_gaps)

    def test_attestation_rejects_arbitrary_mapping_with_status_verified_and_issuer_evil(self):
        """Arbitrary mapping with status=VERIFIED and issuer evil is rejected with UNTRUSTED_ATTESTATION_ISSUER."""
        verifier = BackendAttestationVerifier(trusted_keys={"mma_backend_authority": "secret_key_1234567890"})
        is_ok, att_rec, err = verifier.verify({"status": "VERIFIED", "issuer": "evil"})
        self.assertFalse(is_ok)
        self.assertIsNone(att_rec)
        self.assertEqual(err, "UNTRUSTED_ATTESTATION_ISSUER")

    def test_attestation_rejects_directly_constructed_verification_dto(self):
        """Directly constructed verification DTO cannot bypass verifier execution."""
        verifier = BackendAttestationVerifier(trusted_keys={"mma_backend_authority": "secret_key_1234567890"})
        fake_dto = AttestationVerification(
            attestation_id="att_fake_id_12345",
            attestation_digest="fake_digest_12345",
            status="VERIFIED",
            issuer="mma_backend_authority",
        )
        is_ok, att_rec, err = verifier.verify(fake_dto)
        self.assertFalse(is_ok)
        self.assertIsNone(att_rec)
        self.assertEqual(err, "UNVERIFIED_BACKEND_ATTESTATION")

    def test_attestation_missing_verifier_configuration_keeps_not_gold_ready(self):
        """Missing verifier configuration (no trusted keys) keeps NOT_GOLD_READY with UNVERIFIED_BACKEND_ATTESTATION."""
        unconfigured_verifier = BackendAttestationVerifier.create_configured_verifier(trusted_keys={})  # No trusted keys!
        DatasetExportEngine.set_system_verifier(unconfigured_verifier)
        action_views = self._build_140_sample_views()
        res = DatasetExportEngine.export_dataset(
            action_views,
            salt=self.salt,
            backend_attestation="att_prod_some_token",
            reviewer_agreement_policy="dual_review_consensus",
        )
        self.assertFalse(res.manifest.is_gold_ready)
        self.assertEqual(res.manifest.status, "NOT_GOLD_READY")
        self.assertIn("UNVERIFIED_BACKEND_ATTESTATION", res.manifest.readiness_gaps)

    def test_attestation_rejects_tampered_signature_or_digest(self):
        """Tampered signature/digest is rejected with TAMPERED_ATTESTATION_SIGNATURE."""
        secret_key = "test_attestation_secret_key_2026_xyz"
        signed = BackendAttestationVerifier.create_signed_assertion(
            issuer="mma_backend_authority",
            secret_key=secret_key,
            claims={"dataset_id": "test_ds"},
        )
        # Tamper signature by changing last character
        tampered_sig = signed["signature"][:-1] + ("0" if signed["signature"][-1] != "0" else "1")
        tampered = {"assertion": signed["assertion"], "signature": tampered_sig}

        verifier = BackendAttestationVerifier.create_configured_verifier(trusted_keys={"mma_backend_authority": secret_key})
        is_ok, att_rec, err = verifier.verify(tampered)
        self.assertFalse(is_ok)
        self.assertIsNone(att_rec)
        self.assertEqual(err, "TAMPERED_ATTESTATION_SIGNATURE")

    def test_attestation_valid_signed_fixture_from_trusted_test_key_passes_verification(self):
        """Valid signed fixture from a trusted test key passes verification, never serializing secrets."""
        secret_key = "trusted_production_secret_key_123456"
        signed = BackendAttestationVerifier.create_signed_assertion(
            issuer="mma_backend_authority",
            secret_key=secret_key,
            claims={"policy": "gold_strict"},
        )
        verifier = BackendAttestationVerifier.create_configured_verifier(trusted_keys={"mma_backend_authority": secret_key})
        is_ok, att_rec, err = verifier.verify(signed)
        self.assertTrue(is_ok)
        self.assertIsNotNone(att_rec)
        self.assertEqual(att_rec.status, "VERIFIED")
        self.assertEqual(att_rec.issuer, "mma_backend_authority")
        self.assertTrue(att_rec.attestation_id.startswith("attref_"))
        self.assertNotIn(secret_key, att_rec.attestation_id)
        self.assertNotIn(secret_key, att_rec.attestation_digest)

    # ─────────────────────────────────────────────────────────────────────────
    # 18: Per-Sample Consensus Tests (Area 2)
    # ─────────────────────────────────────────────────────────────────────────

    def test_sample_consensus_rejects_unrelated_reviewers_on_different_actions(self):
        """Reviewers on different actions cannot satisfy dual review consensus for either action."""
        v1 = self._make_valid_view(action_id="act_1", tech="jab", reviewer_id="coach_alice")
        v2 = self._make_valid_view(action_id="act_2", tech="cross", reviewer_id="expert_bob")

        secret_key = "trusted_production_secret_key_123456"
        signed = BackendAttestationVerifier.create_signed_assertion(
            issuer="mma_backend_authority",
            secret_key=secret_key,
        )
        verifier = BackendAttestationVerifier.create_configured_verifier(trusted_keys={"mma_backend_authority": secret_key})
        DatasetExportEngine.set_system_verifier(verifier)

        res = DatasetExportEngine.export_dataset(
            [(v1, "ath_1"), (v2, "ath_2")],
            salt=self.salt,
            backend_attestation=signed,
            reviewer_agreement_policy="dual_review_consensus",
        )
        self.assertFalse(res.manifest.is_gold_ready)
        self.assertEqual(res.manifest.status, "NOT_GOLD_READY")
        self.assertEqual(res.manifest.reviewer_agreement_status, "MISSING_REVIEWER_AGREEMENT_EVIDENCE")
        self.assertIn("MISSING_REVIEWER_AGREEMENT_EVIDENCE", res.manifest.readiness_gaps)

    def test_sample_consensus_reviews_from_ineligible_or_excluded_actions_do_not_contribute(self):
        """Reviews from excluded/ineligible actions must not contribute reviewers to eligible actions."""
        # Action 1 is eligible, reviewed only by coach_alice (1 reviewer)
        v_eligible = self._make_valid_view(action_id="act_elig", tech="jab", reviewer_id="coach_alice")
        # Action 2 is excluded (startFrame >= endFrame), reviewed by expert_bob
        v_excluded = copy.deepcopy(v_eligible)
        object.__setattr__(v_excluded, "action_id", "act_excl")
        object.__setattr__(v_excluded, "effective_phases", {"startFrame": 30, "endFrame": 10})  # Invalid!
        rec_excl = ReviewAuditRecord(
            record_id="rec_excl_1",
            action_id="act_excl",
            target_field=TargetField.TECHNIQUE,
            review_action=ReviewAction.ACCEPT,
            ai_original_value="jab",
            corrected_value=None,
            reviewer_id="expert_bob",
            reviewer_role=ReviewerRole.EXPERT_REVIEWER,
            reason="Excluded action review",
            timestamp="2026-09-17T10:00:00Z",
            idempotency_token="tok_excl_1",
            version="1.0.0",
        )
        object.__setattr__(v_excluded, "audit_trail", (rec_excl,))

        secret_key = "trusted_production_secret_key_123456"
        signed = BackendAttestationVerifier.create_signed_assertion(
            issuer="mma_backend_authority",
            secret_key=secret_key,
        )
        verifier = BackendAttestationVerifier.create_configured_verifier(trusted_keys={"mma_backend_authority": secret_key})
        DatasetExportEngine.set_system_verifier(verifier)

        res = DatasetExportEngine.export_dataset(
            [(v_eligible, "ath_1"), (v_excluded, "ath_2")],
            salt=self.salt,
            backend_attestation=signed,
            reviewer_agreement_policy="dual_review_consensus",
        )
        # Action 2 is excluded; Action 1 only has 1 reviewer (coach_alice), so dual review fails!
        self.assertFalse(res.manifest.is_gold_ready)
        self.assertIn("MISSING_REVIEWER_AGREEMENT_EVIDENCE", res.manifest.readiness_gaps)

    def test_sample_consensus_disagreement_on_same_action_blocks_sample(self):
        """Conflicting reviewer decisions on the same action must block that sample and fail readiness."""
        v_dispute = self._make_dual_review_view(
            action_id="act_dispute",
            tech="jab",
            rev1_id="coach_alice",
            rev2_id="expert_bob",
            rev1_action=ReviewAction.ACCEPT,  # agrees with jab
            rev2_action=ReviewAction.CORRECT,  # corrects to cross -> disagreement!
            rev2_val="cross",
        )

        secret_key = "trusted_production_secret_key_123456"
        signed = BackendAttestationVerifier.create_signed_assertion(
            issuer="mma_backend_authority",
            secret_key=secret_key,
        )
        verifier = BackendAttestationVerifier.create_configured_verifier(trusted_keys={"mma_backend_authority": secret_key})
        DatasetExportEngine.set_system_verifier(verifier)

        res = DatasetExportEngine.export_dataset(
            [(v_dispute, "ath_1")],
            salt=self.salt,
            backend_attestation=signed,
            reviewer_agreement_policy="dual_review_consensus",
        )
        # Disputed sample is blocked from export
        self.assertEqual(len(res.samples), 0)
        self.assertFalse(res.manifest.is_gold_ready)
        self.assertIn("SAMPLE_REVIEWER_DISAGREEMENT_1_SAMPLES", res.manifest.readiness_gaps)

    def test_sample_consensus_valid_same_action_consensus_passes(self):
        """Valid same-action consensus with 2 distinct reviewers reaching the same final label passes."""
        v_agree = self._make_dual_review_view(
            action_id="act_agree",
            tech="jab",
            rev1_id="coach_alice",
            rev2_id="expert_bob",
            rev1_action=ReviewAction.ACCEPT,
            rev2_action=ReviewAction.ACCEPT,
        )

        has_consensus, err, info = DatasetExportEngine.verify_sample_reviewer_consensus(
            v_agree,
            policy="dual_review_consensus",
        )
        self.assertTrue(has_consensus)
        self.assertIsNone(err)
        self.assertEqual(info["status"], "CONSENSUS_REACHED")
        self.assertEqual(info["agreed_value"], "jab")
        self.assertEqual(info["reviewers"], ["coach_alice", "expert_bob"])

    # ─────────────────────────────────────────────────────────────────────────
    # 19: Governance Evidence Bound to Dataset Identity (Area 3)
    # ─────────────────────────────────────────────────────────────────────────

    def test_governance_evidence_bound_to_dataset_identity(self):
        """Canonical governance evidence is bound to manifest and changing any value changes datasetHash."""
        v_agree = self._make_dual_review_view(action_id="act_gov", tech="jab")
        secret_key = "trusted_production_secret_key_123456"
        signed = BackendAttestationVerifier.create_signed_assertion(
            issuer="mma_backend_authority",
            secret_key=secret_key,
        )
        verifier = BackendAttestationVerifier.create_configured_verifier(trusted_keys={"mma_backend_authority": secret_key})
        DatasetExportEngine.set_system_verifier(verifier)

        base_res = DatasetExportEngine.export_dataset(
            [(v_agree, "ath_1")],
            salt=self.salt,
            backend_attestation=signed,
            reviewer_agreement_policy="dual_review_consensus",
        )
        base_hash = base_res.manifest.dataset_hash
        self.assertIsNotNone(base_hash)

        # 1. Changing reviewer agreement policy changes datasetHash
        res_policy = DatasetExportEngine.export_dataset(
            [(v_agree, "ath_1")],
            salt=self.salt,
            backend_attestation=signed,
            reviewer_agreement_policy="inter_rater_agreement",
        )
        self.assertNotEqual(base_hash, res_policy.manifest.dataset_hash)

        # 2. Changing reviewers (consensus evidence digest) changes datasetHash
        v_diff_rev = self._make_dual_review_view(action_id="act_gov", tech="jab", rev2_id="expert_charlie")
        res_rev = DatasetExportEngine.export_dataset(
            [(v_diff_rev, "ath_1")],
            salt=self.salt,
            backend_attestation=signed,
            reviewer_agreement_policy="dual_review_consensus",
        )
        self.assertNotEqual(base_hash, res_rev.manifest.dataset_hash)

        # 3. Changing attestation issuer changes datasetHash
        signed_pipeline = BackendAttestationVerifier.create_signed_assertion(
            issuer="production_release_pipeline",
            secret_key=secret_key,
        )
        verifier_pipeline = BackendAttestationVerifier.create_configured_verifier(trusted_keys={"production_release_pipeline": secret_key})
        DatasetExportEngine.set_system_verifier(verifier_pipeline)
        res_issuer = DatasetExportEngine.export_dataset(
            [(v_agree, "ath_1")],
            salt=self.salt,
            backend_attestation=signed_pipeline,
            reviewer_agreement_policy="dual_review_consensus",
        )
        self.assertNotEqual(base_hash, res_issuer.manifest.dataset_hash)

    # ─────────────────────────────────────────────────────────────────────────
    # 20: Task 14 Security Hotfix — Attestation Proof & Immutability Tests
    # ─────────────────────────────────────────────────────────────────────────

    def test_attestation_claims_immutable_and_deeply_frozen_at_construction(self):
        """Attestation claims must be deeply frozen/canonicalized at construction and resist mutation."""
        claims_input = {
            "environment": "production",
            "metadata": {"cluster": "us-central1", "tags": ["verified", "gold"]},
            "count": 42,
        }
        verification = AttestationVerification(
            attestation_id="attref_test123456",
            attestation_digest="digest_test123456",
            status="VERIFIED",
            issuer="mma_backend_authority",
            claims=claims_input,
        )

        # 1. Top-level mutation fails
        with self.assertRaises((TypeError, AttributeError)):
            verification.claims["new_key"] = "forbidden"

        with self.assertRaises((TypeError, AttributeError)):
            verification.claims["environment"] = "staging"

        # 2. Nested dictionary mutation fails
        with self.assertRaises((TypeError, AttributeError)):
            verification.claims["metadata"]["cluster"] = "rogue_cluster"

        with self.assertRaises((TypeError, AttributeError)):
            verification.claims["metadata"]["new_sub_key"] = True

        # 3. Nested sequence mutation fails (converted to tuple or immutable)
        with self.assertRaises((TypeError, AttributeError)):
            verification.claims["metadata"]["tags"].append("unauthorized")

        # 4. Verified attestation from signed assertion is also deeply frozen
        secret_key = "trusted_production_secret_key_123456"
        signed = BackendAttestationVerifier.create_signed_assertion(
            issuer="mma_backend_authority",
            secret_key=secret_key,
            claims={"nested": {"deep": "immutable_val"}},
        )
        verifier = BackendAttestationVerifier.create_configured_verifier(
            trusted_keys={"mma_backend_authority": secret_key}
        )
        is_ok, att_rec, err = verifier.verify(signed)
        self.assertTrue(is_ok)
        self.assertIsNotNone(att_rec)
        with self.assertRaises((TypeError, AttributeError)):
            att_rec.claims["nested"]["deep"] = "mutated"

    def test_attestation_proof_binds_complete_record_and_rejects_copied_proof(self):
        """Internal verification proof binds complete canonical verified record: digest, issuer, attestation_id, status, claims."""
        secret_key = "trusted_production_secret_key_123456"
        signed = BackendAttestationVerifier.create_signed_assertion(
            issuer="mma_backend_authority",
            secret_key=secret_key,
            claims={"dataset_tier": "gold", "sub": {"authorized": True}},
        )
        verifier = BackendAttestationVerifier.create_configured_verifier(
            trusted_keys={"mma_backend_authority": secret_key}
        )
        is_ok, att_rec, err = verifier.verify(signed)
        self.assertTrue(is_ok)
        self.assertIsNotNone(att_rec)
        self.assertTrue(verifier._validate_proof(att_rec))

        valid_proof = att_rec._internal_proof
        self.assertIsNotNone(valid_proof)

        # Tamper 1: Copy proof to new DTO with altered attestation_id
        dto_bad_id = AttestationVerification(
            attestation_id="attref_forged_id",
            attestation_digest=att_rec.attestation_digest,
            status=att_rec.status,
            issuer=att_rec.issuer,
            claims=att_rec.claims,
            _internal_proof=valid_proof,
        )
        self.assertFalse(verifier._validate_proof(dto_bad_id))

        # Tamper 2: Copy proof to new DTO with altered status
        dto_bad_status = AttestationVerification(
            attestation_id=att_rec.attestation_id,
            attestation_digest=att_rec.attestation_digest,
            status="REJECTED",
            issuer=att_rec.issuer,
            claims=att_rec.claims,
            _internal_proof=valid_proof,
        )
        self.assertFalse(verifier._validate_proof(dto_bad_status))

        # Tamper 3: Copy proof to new DTO with altered issuer
        dto_bad_issuer = AttestationVerification(
            attestation_id=att_rec.attestation_id,
            attestation_digest=att_rec.attestation_digest,
            status=att_rec.status,
            issuer="evil_issuer",
            claims=att_rec.claims,
            _internal_proof=valid_proof,
        )
        self.assertFalse(verifier._validate_proof(dto_bad_issuer))

        # Tamper 4: Copy proof to new DTO with altered digest
        dto_bad_digest = AttestationVerification(
            attestation_id=att_rec.attestation_id,
            attestation_digest="bad_digest_12345",
            status=att_rec.status,
            issuer=att_rec.issuer,
            claims=att_rec.claims,
            _internal_proof=valid_proof,
        )
        self.assertFalse(verifier._validate_proof(dto_bad_digest))

        # Tamper 5: Copy proof to new DTO with altered claims
        dto_bad_claims = AttestationVerification(
            attestation_id=att_rec.attestation_id,
            attestation_digest=att_rec.attestation_digest,
            status=att_rec.status,
            issuer=att_rec.issuer,
            claims={"injected_claim": "unauthorized"},
            _internal_proof=valid_proof,
        )
        self.assertFalse(verifier._validate_proof(dto_bad_claims))

    def test_export_rejects_caller_created_verifier_under_trusted_issuer(self):
        """Callers cannot inject a verifier configured with their own key under a trusted issuer without factory capability."""
        attacker_key = "attacker_secret_key_12345678"
        # Directly instantiated verifier without factory method lacks _capability_token
        caller_injected_verifier = BackendAttestationVerifier(
            trusted_keys={"mma_backend_authority": attacker_key}
        )
        self.assertFalse(caller_injected_verifier.is_factory_configured())

        # Attempting to register unprivileged verifier into application bootstrap raises PermissionError
        with self.assertRaises(PermissionError):
            DatasetExportEngine.set_system_verifier(caller_injected_verifier)

        # Attempting to inject attestation_verifier parameter into export_dataset raises TypeError
        action_views = self._build_140_sample_views()
        with self.assertRaises(TypeError):
            DatasetExportEngine.export_dataset(
                action_views,
                salt=self.salt,
                attestation_verifier=caller_injected_verifier,
            )

        # Create assertion signed with attacker key
        attacker_signed = BackendAttestationVerifier.create_signed_assertion(
            issuer="mma_backend_authority",
            secret_key=attacker_key,
        )

        # Export without a verified system verifier stays NOT_GOLD_READY
        res = DatasetExportEngine.export_dataset(
            action_views,
            salt=self.salt,
            backend_attestation=attacker_signed,
            reviewer_agreement_policy="dual_review_consensus",
        )
        self.assertFalse(res.manifest.is_gold_ready)
        self.assertEqual(res.manifest.status, "NOT_GOLD_READY")
        self.assertIn("UNVERIFIED_BACKEND_ATTESTATION", res.manifest.readiness_gaps)
        self.assertEqual(res.manifest.attestation_status, "UNVERIFIED")

    def test_attestation_rejects_expired_assertion_and_replay(self):
        """Expired assertions fail verification; nonces cannot be replayed."""
        secret_key = "trusted_production_secret_key_123456"
        verifier = BackendAttestationVerifier.create_configured_verifier(
            trusted_keys={"mma_backend_authority": secret_key}
        )

        # 1. Expired assertion fails
        now = datetime.now(timezone.utc)
        past_iso = (now - timedelta(seconds=120)).isoformat()
        way_past_iso = (now - timedelta(seconds=600)).isoformat()
        expired_signed = BackendAttestationVerifier.create_signed_assertion(
            issuer="mma_backend_authority",
            secret_key=secret_key,
            issued_at=way_past_iso,
            expires_at=past_iso,
        )
        is_ok, att_rec, err = verifier.verify(expired_signed)
        self.assertFalse(is_ok)
        self.assertIsNone(att_rec)
        self.assertEqual(err, "EXPIRED_ATTESTATION")

        # 2. Replay policy: verifying the same assertion twice with identical nonce fails
        valid_signed = BackendAttestationVerifier.create_signed_assertion(
            issuer="mma_backend_authority",
            secret_key=secret_key,
            nonce="unique_nonce_123456",
        )
        # First verification succeeds
        is_ok1, att_rec1, err1 = verifier.verify(valid_signed)
        self.assertTrue(is_ok1)
        self.assertIsNotNone(att_rec1)

        # Second verification with same nonce fails replay check
        is_ok2, att_rec2, err2 = verifier.verify(valid_signed)
        self.assertFalse(is_ok2)
        self.assertIsNone(att_rec2)
        self.assertEqual(err2, "REPLAYED_ATTESTATION_NONCE")

    def test_attestation_rejects_wrong_audience_purpose_or_key_id(self):
        """Assertions signed for another audience, purpose, or with an untrusted key_id fail verification."""
        secret_key = "trusted_production_secret_key_123456"
        verifier = BackendAttestationVerifier.create_configured_verifier(
            trusted_keys={"mma_backend_authority": secret_key}
        )

        # 1. Wrong audience
        bad_aud_signed = BackendAttestationVerifier.create_signed_assertion(
            issuer="mma_backend_authority",
            secret_key=secret_key,
            audience="unauthorized_third_party_service",
        )
        is_ok, att_rec, err = verifier.verify(bad_aud_signed)
        self.assertFalse(is_ok)
        self.assertEqual(err, "INVALID_ATTESTATION_AUDIENCE")

        # 2. Wrong purpose
        bad_purp_signed = BackendAttestationVerifier.create_signed_assertion(
            issuer="mma_backend_authority",
            secret_key=secret_key,
            purpose="internal_debugging_only",
        )
        is_ok, att_rec, err = verifier.verify(bad_purp_signed)
        self.assertFalse(is_ok)
        self.assertEqual(err, "INVALID_ATTESTATION_PURPOSE")

        # 3. Untrusted key_id
        bad_key_id_signed = BackendAttestationVerifier.create_signed_assertion(
            issuer="mma_backend_authority",
            secret_key=secret_key,
            key_id="rogue_key_id_999",
        )
        is_ok, att_rec, err = verifier.verify(bad_key_id_signed)
        self.assertFalse(is_ok)
        self.assertEqual(err, "UNTRUSTED_KEY_ID")

    def test_attestation_valid_configured_verifier_path_succeeds(self):
        """Valid configured verifier path verifies assertions, validates proof, and populates gold manifest."""
        secret_key = "trusted_production_secret_key_123456"
        verifier = BackendAttestationVerifier.create_configured_verifier(
            trusted_keys={"mma_backend_authority": secret_key}
        )
        self.assertTrue(verifier.is_factory_configured())

        signed = BackendAttestationVerifier.create_signed_assertion(
            issuer="mma_backend_authority",
            secret_key=secret_key,
            claims={"authorized_by": "sec_lead", "scope": "release"},
        )
        is_ok, att_rec, err = verifier.verify(signed)
        self.assertTrue(is_ok)
        self.assertIsNotNone(att_rec)
        self.assertEqual(att_rec.status, "VERIFIED")
        self.assertEqual(att_rec.issuer, "mma_backend_authority")
        self.assertTrue(att_rec.attestation_id.startswith("attref_"))
        self.assertTrue(verifier._validate_proof(att_rec))

        # Build 560 dual-reviewed views across 20 athletes to satisfy GOLD criteria (>=500 samples)
        all_classes = list(REQUIRED_GOLD_CLASSES)
        action_views = []
        for i in range(560):
            tech = all_classes[i % len(all_classes)]
            aid = f"act_dual_gold_{i:04d}"
            v = self._make_dual_review_view(
                action_id=aid,
                tech=tech,
                rev1_id="coach_alice",
                rev2_id="expert_bob",
            )
            ath_id = f"athlete_{(i % 20) + 1:03d}"
            action_views.append((v, ath_id))

        signed_export = BackendAttestationVerifier.create_signed_assertion(
            issuer="mma_backend_authority",
            secret_key=secret_key,
            claims={"authorized_by": "sec_lead", "scope": "release"},
        )
        DatasetExportEngine.set_system_verifier(verifier)
        res = DatasetExportEngine.export_dataset(
            action_views,
            salt=self.salt,
            backend_attestation=signed_export,
            reviewer_agreement_policy="dual_review_consensus",
        )
        self.assertTrue(res.manifest.is_gold_ready)
        self.assertEqual(res.manifest.status, "GOLD_READY")
        self.assertEqual(res.manifest.attestation_status, "VERIFIED")
        self.assertEqual(res.manifest.attestation_issuer, "mma_backend_authority")
        self.assertNotIn("UNVERIFIED_BACKEND_ATTESTATION", res.manifest.readiness_gaps)
        self.assertNotIn("CALLER_INJECTED_VERIFIER_REJECTED", res.manifest.readiness_gaps)

    # ─────────────────────────────────────────────────────────────────────────
    # 21: Task 14 Expert Supervision Semantics Tests
    # ─────────────────────────────────────────────────────────────────────────

    def test_expert_supervision_rejects_non_technique_reviews_only(self):
        """Expert reviewing attacking_side, phase, finding or other non-technique field must NOT satisfy expert supervision."""
        base_view = self._make_valid_view(action_id="act_side_only", tech="jab")
        # Replace audit trail with expert reviewing only TargetField.ATTACKING_SIDE
        rec_side = ReviewAuditRecord(
            record_id="rec_side_1",
            action_id="act_side_only",
            target_field=TargetField.ATTACKING_SIDE,
            review_action=ReviewAction.ACCEPT,
            ai_original_value="left",
            corrected_value=None,
            reviewer_id="head_coach_dan",
            reviewer_role=ReviewerRole.HEAD_COACH,
            reason="Confirmed side only",
            timestamp="2026-09-17T10:00:00Z",
            idempotency_token="tok_side_1",
            version="1.0.0",
        )
        object.__setattr__(base_view, "audit_trail", (rec_side,))

        has_sup, err, info = DatasetExportEngine.verify_sample_reviewer_consensus(
            base_view,
            policy="expert_supervision",
        )
        self.assertFalse(has_sup)
        self.assertEqual(err, "MISSING_EXPERT_TECHNIQUE_REVIEW")
        self.assertEqual(info["status"], "NON_TECHNIQUE_REVIEW_ONLY")
        self.assertIn("attacking_side", info["fields_reviewed"])

    def test_expert_supervision_rejects_expert_technique_rejection(self):
        """REJECT on technique cannot count as supervision approval; must fail and quarantine sample."""
        base_view = self._make_valid_view(action_id="act_rej", tech="jab")
        rec_reject = ReviewAuditRecord(
            record_id="rec_rej_1",
            action_id="act_rej",
            target_field=TargetField.TECHNIQUE,
            review_action=ReviewAction.REJECT,
            ai_original_value="jab",
            corrected_value=None,
            reviewer_id="expert_bob",
            reviewer_role=ReviewerRole.EXPERT_REVIEWER,
            reason="Not a valid punch execution",
            timestamp="2026-09-17T10:00:00Z",
            idempotency_token="tok_rej_1",
            version="1.0.0",
        )
        object.__setattr__(base_view, "audit_trail", (rec_reject,))
        object.__setattr__(base_view, "review_status", "coach_rejected")

        has_sup, err, info = DatasetExportEngine.verify_sample_reviewer_consensus(
            base_view,
            policy="expert_supervision",
        )
        self.assertFalse(has_sup)
        self.assertEqual(err, "EXPERT_REJECTED_TECHNIQUE")
        self.assertEqual(info["status"], "EXPERT_REJECTED")

        # Quarantined in export
        secret_key = "trusted_production_secret_key_123456"
        signed = BackendAttestationVerifier.create_signed_assertion(
            issuer="mma_backend_authority",
            secret_key=secret_key,
        )
        verifier = BackendAttestationVerifier.create_configured_verifier(
            trusted_keys={"mma_backend_authority": secret_key}
        )
        DatasetExportEngine.set_system_verifier(verifier)
        res = DatasetExportEngine.export_dataset(
            [(base_view, "ath_1")],
            salt=self.salt,
            backend_attestation=signed,
            reviewer_agreement_policy="expert_supervision",
        )
        # Blocked from export
        self.assertEqual(len(res.samples), 0)
        self.assertFalse(res.manifest.is_gold_ready)

    def test_expert_supervision_rejects_technique_correction_mismatch(self):
        """Supervised technique value must match effective_technique; mismatch fails consensus."""
        base_view = self._make_valid_view(action_id="act_mismatch", tech="jab")
        # Expert corrected to 'cross', but effective_technique was kept as 'jab'
        rec_mismatch = ReviewAuditRecord(
            record_id="rec_mis_1",
            action_id="act_mismatch",
            target_field=TargetField.TECHNIQUE,
            review_action=ReviewAction.CORRECT,
            ai_original_value="jab",
            corrected_value="cross",
            reviewer_id="expert_bob",
            reviewer_role=ReviewerRole.EXPERT_REVIEWER,
            reason="It is a cross",
            timestamp="2026-09-17T10:00:00Z",
            idempotency_token="tok_mis_1",
            version="1.0.0",
        )
        object.__setattr__(base_view, "audit_trail", (rec_mismatch,))
        object.__setattr__(base_view, "effective_technique", "jab")  # Mismatch!

        has_sup, err, info = DatasetExportEngine.verify_sample_reviewer_consensus(
            base_view,
            policy="expert_supervision",
        )
        self.assertFalse(has_sup)
        self.assertEqual(err, "SUPERVISION_MISMATCH_WITH_EFFECTIVE_VALUE")
        self.assertEqual(info["status"], "SUPERVISION_MISMATCH")
        self.assertEqual(info["supervised_value"], "cross")
        self.assertEqual(info["effective_value"], "jab")

    def test_expert_supervision_accepts_valid_technique_accept(self):
        """Qualified expert/head coach ACCEPT confirms original technique and satisfies expert supervision."""
        base_view = self._make_valid_view(action_id="act_accept_ok", tech="jab")
        rec_accept = ReviewAuditRecord(
            record_id="rec_acc_1",
            action_id="act_accept_ok",
            target_field=TargetField.TECHNIQUE,
            review_action=ReviewAction.ACCEPT,
            ai_original_value="jab",
            corrected_value=None,
            reviewer_id="expert_alice",
            reviewer_role=ReviewerRole.EXPERT_REVIEWER,
            reason="Confirmed correct jab mechanics",
            timestamp="2026-09-17T10:00:00Z",
            idempotency_token="tok_acc_1",
            version="1.0.0",
        )
        object.__setattr__(base_view, "audit_trail", (rec_accept,))

        has_sup, err, info = DatasetExportEngine.verify_sample_reviewer_consensus(
            base_view,
            policy="expert_supervision",
        )
        self.assertTrue(has_sup)
        self.assertIsNone(err)
        self.assertEqual(info["status"], "EXPERT_SUPERVISED")
        self.assertEqual(info["agreed_value"], "jab")
        self.assertEqual(info["policy"], REVIEWER_AGREEMENT_POLICY_VERSIONS["expert_supervision"])

    def test_expert_supervision_accepts_valid_technique_correction(self):
        """Qualified expert/head coach CORRECT provides final technique and binds policy version into manifest."""
        base_view = self._make_valid_view(action_id="act_corr_ok", tech="jab")
        rec_correct = ReviewAuditRecord(
            record_id="rec_corr_1",
            action_id="act_corr_ok",
            target_field=TargetField.TECHNIQUE,
            review_action=ReviewAction.CORRECT,
            ai_original_value="jab",
            corrected_value="hook",
            reviewer_id="head_coach_dan",
            reviewer_role=ReviewerRole.HEAD_COACH,
            reason="Trajectory is arched, correct to hook",
            timestamp="2026-09-17T10:00:00Z",
            idempotency_token="tok_corr_1",
            version="1.0.0",
        )
        object.__setattr__(base_view, "audit_trail", (rec_correct,))
        object.__setattr__(base_view, "effective_technique", "hook")
        object.__setattr__(base_view, "review_status", "coach_corrected")

        has_sup, err, info = DatasetExportEngine.verify_sample_reviewer_consensus(
            base_view,
            policy="expert_supervision",
        )
        self.assertTrue(has_sup)
        self.assertIsNone(err)
        self.assertEqual(info["status"], "EXPERT_SUPERVISED")
        self.assertEqual(info["agreed_value"], "hook")

        # Export and verify policy version and dataset hash binding
        secret_key = "trusted_production_secret_key_123456"
        signed = BackendAttestationVerifier.create_signed_assertion(
            issuer="mma_backend_authority",
            secret_key=secret_key,
        )
        verifier = BackendAttestationVerifier.create_configured_verifier(
            trusted_keys={"mma_backend_authority": secret_key}
        )
        DatasetExportEngine.set_system_verifier(verifier)
        res = DatasetExportEngine.export_dataset(
            [(base_view, "ath_1")],
            salt=self.salt,
            backend_attestation=signed,
            reviewer_agreement_policy="expert_supervision",
        )
        self.assertEqual(len(res.samples), 1)
        self.assertEqual(res.samples[0].technique, "hook")
        self.assertEqual(
            res.manifest.reviewer_agreement_policy_version,
            "expert_supervision_single_expert_technique_v1.0"
        )
        self.assertEqual(res.manifest.reviewer_agreement_status, "VERIFIED_PER_SAMPLE_CONSENSUS")
        self.assertIsNotNone(res.manifest.dataset_hash)

    # ─────────────────────────────────────────────────────────────────────────
    # 22: Exactly Three Adversarial Tests for Task 14 Remediated Bypasses
    # ─────────────────────────────────────────────────────────────────────────

    def test_adversarial_verifier_injection_bypasses_rejected(self):
        """
        Adversarial Test 1 (Verifier Injection Bypass):
        - Callers cannot inject custom verifier through export_dataset(**kwargs); raises TypeError.
        - Callers cannot register an unprivileged public verifier into application bootstrap
          via set_system_verifier(); raises PermissionError.
        - Export without configured system verifier fails closed (NOT_GOLD_READY with UNVERIFIED_BACKEND_ATTESTATION).
        """
        attacker_key = "attacker_secret_key_reproduce_bypass_1"
        caller_verifier = BackendAttestationVerifier(trusted_keys={"mma_backend_authority": attacker_key})
        signed = BackendAttestationVerifier.create_signed_assertion(
            issuer="mma_backend_authority",
            secret_key=attacker_key,
        )
        action_views = self._build_140_sample_views()

        # 1. Direct parameter injection into export_dataset raises TypeError
        with self.assertRaises(TypeError) as ctx1:
            DatasetExportEngine.export_dataset(
                action_views,
                salt=self.salt,
                backend_attestation=signed,
                attestation_verifier=caller_verifier,
            )
        self.assertIn("attestation_verifier parameter has been removed", str(ctx1.exception))

        # 2. Registration via set_system_verifier with unprivileged public verifier raises PermissionError
        with self.assertRaises(PermissionError) as ctx2:
            DatasetExportEngine.set_system_verifier(caller_verifier)
        self.assertIn("CALLER_INJECTED_VERIFIER_REJECTED", str(ctx2.exception))

        # 3. Unconfigured system verifier fails closed
        DatasetExportEngine.set_system_verifier(None)
        res = DatasetExportEngine.export_dataset(
            action_views,
            salt=self.salt,
            backend_attestation=signed,
            reviewer_agreement_policy="dual_review_consensus",
        )
        self.assertFalse(res.manifest.is_gold_ready)
        self.assertEqual(res.manifest.status, "NOT_GOLD_READY")
        self.assertIn("UNVERIFIED_BACKEND_ATTESTATION", res.manifest.readiness_gaps)
        self.assertEqual(res.manifest.attestation_status, "UNVERIFIED")

    def test_adversarial_nonce_replay_across_verifiers_and_reset_restricted(self):
        """
        Adversarial Test 2 (Nonce Replay & Reset Bypass):
        - Nonce replay across distinct verifier instances fails via persistent store.
        - Public API verifier.reset_nonces() does NOT exist (raises AttributeError).
        - Test helper reset_nonce_store_for_testing() is the only valid reset mechanism.
        - Injected custom PersistentNonceStore is respected.
        """
        secret_key = "trusted_production_secret_key_123456"
        custom_store = PersistentNonceStore()

        # Create two distinct verifiers sharing custom_store
        v1 = BackendAttestationVerifier.create_configured_verifier(
            trusted_keys={"mma_backend_authority": secret_key},
            nonce_store=custom_store,
        )
        v2 = BackendAttestationVerifier.create_configured_verifier(
            trusted_keys={"mma_backend_authority": secret_key},
            nonce_store=custom_store,
        )

        signed_token = BackendAttestationVerifier.create_signed_assertion(
            issuer="mma_backend_authority",
            secret_key=secret_key,
            nonce="adversarial_replayed_nonce_12345",
        )

        # 1. First verification on v1 succeeds
        ok1, rec1, err1 = v1.verify(signed_token)
        self.assertTrue(ok1)
        self.assertIsNone(err1)

        # 2. Replay attack across verifiers: presenting identical token to v2 fails
        ok2, rec2, err2 = v2.verify(signed_token)
        self.assertFalse(ok2)
        self.assertIsNone(rec2)
        self.assertEqual(err2, "REPLAYED_ATTESTATION_NONCE")

        # 3. Caller cannot reset nonces via public API on verifier
        self.assertFalse(hasattr(v1, "reset_nonces"))
        with self.assertRaises(AttributeError):
            v1.reset_nonces()

        # 4. Only test-only helper can reset nonces
        reset_nonce_store_for_testing(custom_store)
        ok3, rec3, err3 = v2.verify(signed_token)
        self.assertTrue(ok3)
        self.assertIsNone(err3)

    def test_adversarial_naive_timestamp_rejected_with_structured_error(self):
        """
        Adversarial Test 3 (Naive Timestamp / Timezone Bypass):
        - Naive timestamps without timezone offset return MISSING_TIMEZONE_IN_ATTESTATION_TIMESTAMP
          instead of crashing with unhandled TypeError.
        - Both issued_at and expires_at missing timezone are caught.
        - Export with naive timestamp assertion gracefully stays NOT_GOLD_READY.
        """
        secret_key = "trusted_production_secret_key_123456"
        verifier = BackendAttestationVerifier.create_configured_verifier(
            trusted_keys={"mma_backend_authority": secret_key}
        )

        # 1. issued_at missing timezone offset
        naive_iat_signed = BackendAttestationVerifier.create_signed_assertion(
            issuer="mma_backend_authority",
            secret_key=secret_key,
            issued_at="2026-09-17T10:00:00",  # No timezone offset
            expires_at="2026-09-17T11:00:00+00:00",
        )
        ok1, rec1, err1 = verifier.verify(naive_iat_signed)
        self.assertFalse(ok1)
        self.assertIsNone(rec1)
        self.assertEqual(err1, "MISSING_TIMEZONE_IN_ATTESTATION_TIMESTAMP")

        # 2. expires_at missing timezone offset
        naive_exp_signed = BackendAttestationVerifier.create_signed_assertion(
            issuer="mma_backend_authority",
            secret_key=secret_key,
            issued_at="2026-09-17T10:00:00+00:00",
            expires_at="2026-09-17T11:00:00",  # No timezone offset
        )
        ok2, rec2, err2 = verifier.verify(naive_exp_signed)
        self.assertFalse(ok2)
        self.assertIsNone(rec2)
        self.assertEqual(err2, "MISSING_TIMEZONE_IN_ATTESTATION_TIMESTAMP")

        # 3. Export gracefully stays NOT_GOLD_READY without uncaught exception
        DatasetExportEngine.set_system_verifier(verifier)
        action_views = self._build_140_sample_views()
        res = DatasetExportEngine.export_dataset(
            action_views,
            salt=self.salt,
            backend_attestation=naive_iat_signed,
            reviewer_agreement_policy="dual_review_consensus",
        )
        self.assertFalse(res.manifest.is_gold_ready)
        self.assertEqual(res.manifest.status, "NOT_GOLD_READY")
        self.assertIn("MISSING_TIMEZONE_IN_ATTESTATION_TIMESTAMP", res.manifest.readiness_gaps)
        self.assertIn("MISSING_BACKEND_ATTESTATION", res.manifest.readiness_gaps)


if __name__ == "__main__":
    unittest.main()
