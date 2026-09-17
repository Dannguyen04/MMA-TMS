"""
dataset_export.py — Annotation & Gold Dataset Export (Task 14)

Biến review đã duyệt thành dữ liệu huấn luyện có kiểm soát:
- Chỉ export các record đáp ứng policy approval (verifiable audit trail với reviewer hợp lệ).
- Không tin tưởng mù quáng vào caller-provided reviewStatus nếu thiếu audit record xác thực.
- De-identification & Privacy: Bắt buộc inject secret salt, không dùng hardcoded default salt.
  Anonymize sample_id hoàn toàn bằng SHA-256 (không lộ actionId).
- Group-based split theo athlete_hash để triệt để chống data leakage giữa train/val/test splits.
- Deterministic content_hash độc lập với export_timestamp để đảm bảo tính tái lập (reproducibility).
- Chính sách GOLD_READY nghiêm ngặt: yêu cầu tối thiểu 500 mẫu, đủ độ phủ class, đủ độ phủ split
  và audit trail hợp lệ. Nếu thiếu bất kỳ điều kiện nào, bắt buộc gắn is_gold_ready = False và status = "NOT_GOLD_READY".
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
import hashlib
import json
import math
from typing import Any, Mapping, Optional, Sequence

from pipeline.contracts import deep_freeze, to_json_safe
from pipeline.review_contract import (
    MaterializedActionView,
    ReviewAction,
    ReviewerRole,
)


class DatasetSplit(str, Enum):
    TRAIN = "train"
    VAL = "val"
    TEST = "test"


class ExportApprovalPolicy(str, Enum):
    STRICT_COACH_APPROVED = "strict_coach_approved"
    COACH_APPROVED_OR_CORRECTED = "coach_approved_or_corrected"


REQUIRED_GOLD_CLASSES = {
    "jab", "cross", "hook", "uppercut", "round_kick", "front_kick", "side_kick"
}


@dataclass(frozen=True)
class AnonymizedSample:
    sample_id: str
    athlete_hash: str
    split: DatasetSplit
    technique: str
    attacking_side: str
    limb_role: str
    phases: Mapping[str, Any]
    metrics: Mapping[str, Any]
    review_status: str
    audit_hash: str
    provenance_source: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "sampleId": self.sample_id,
            "athleteHash": self.athlete_hash,
            "split": self.split.value,
            "technique": self.technique,
            "attackingSide": self.attacking_side,
            "limbRole": self.limb_role,
            "phases": to_json_safe(self.phases),
            "metrics": to_json_safe(self.metrics),
            "reviewStatus": self.review_status,
            "auditHash": self.audit_hash,
            "provenanceSource": self.provenance_source,
        }


@dataclass(frozen=True)
class DatasetManifest:
    dataset_id: str
    schema_version: str
    export_timestamp: str
    policy: str
    total_samples: int
    split_distribution: Mapping[str, int]
    technique_distribution: Mapping[str, int]
    is_gold_ready: bool
    status: str
    content_hash: str
    dataset_hash: str
    notes: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "datasetId": self.dataset_id,
            "schemaVersion": self.schema_version,
            "exportTimestamp": self.export_timestamp,
            "policy": self.policy,
            "totalSamples": self.total_samples,
            "splitDistribution": dict(self.split_distribution),
            "techniqueDistribution": dict(self.technique_distribution),
            "isGoldReady": self.is_gold_ready,
            "status": self.status,
            "contentHash": self.content_hash,
            "datasetHash": self.dataset_hash,
            "notes": self.notes,
        }


@dataclass(frozen=True)
class DatasetExportResult:
    manifest: DatasetManifest
    samples: tuple[AnonymizedSample, ...]

    def to_dict(self) -> dict[str, Any]:
        return {
            "manifest": self.manifest.to_dict(),
            "samples": [s.to_dict() for s in self.samples],
        }


class DatasetExportEngine:
    """
    Engine xử lý kiểm tra tính hợp lệ, de-identification và group splitting.
    """

    MIN_SAMPLES_FOR_GOLD = 500
    MIN_SAMPLES_PER_SPLIT_FOR_GOLD = 10
    MIN_SAMPLES_PER_CLASS_FOR_GOLD = 20

    WEAK_SALT_PATTERNS = {
        "salt", "secret", "default", "password", "test", "demo", "placeholder",
        "1234567890123456", "abcdefghijklmnop", "0000000000000000"
    }

    @classmethod
    def validate_salt(cls, salt: str) -> None:
        """Validate secret salt length and entropy for pseudonymization."""
        if not salt or not isinstance(salt, str):
            raise ValueError("salt must be a non-empty string for privacy protection.")
        if len(salt) < 16:
            raise ValueError(f"salt must be at least 16 characters for secure pseudonymization (got {len(salt)}).")
        if salt.lower() in cls.WEAK_SALT_PATTERNS or len(set(salt)) < 4:
            raise ValueError("Weak or placeholder salt detected. Provide a high-entropy secret salt.")

    @classmethod
    def hash_athlete_id(cls, raw_athlete_id: str, salt: str) -> str:
        """
        Pseudonymize athlete ID using salted SHA-256 HMAC-style hash.
        Note: This is deterministic pseudonymization under a secret salt, NOT irreversible de-identification.
        """
        if not raw_athlete_id or not isinstance(raw_athlete_id, str) or not raw_athlete_id.strip():
            raise ValueError("raw_athlete_id must be a non-empty string.")
        cls.validate_salt(salt)
        combined = f"{raw_athlete_id.strip()}:{salt}".encode("utf-8")
        return hashlib.sha256(combined).hexdigest()[:16]

    @classmethod
    def assign_split_by_athlete(
        cls,
        athlete_hash: str,
        val_ratio: float = 0.15,
        test_ratio: float = 0.15,
    ) -> DatasetSplit:
        """
        Group split theo athlete_hash để chống data leakage giữa các set.
        Tất cả dữ liệu của cùng 1 athlete sẽ rơi vào DUY NHẤT một split.
        """
        h_val = int(hashlib.md5(athlete_hash.encode("utf-8")).hexdigest(), 16) % 10000 / 10000.0
        if h_val < test_ratio:
            return DatasetSplit.TEST
        elif h_val < (test_ratio + val_ratio):
            return DatasetSplit.VAL
        else:
            return DatasetSplit.TRAIN

    @classmethod
    def validate_audit_eligibility(
        cls,
        view: MaterializedActionView,
        policy: ExportApprovalPolicy,
    ) -> tuple[bool, Optional[str]]:
        """
        Xác minh tính hợp lệ dựa trên audit trail thực tế (R2.3 & Remediation R2).
        Kiểm tra:
        - action_id trên mọi record khớp view.action_id.
        - record_id duy nhất.
        - idempotency_token duy nhất.
        - Thứ tự thời gian timestamp đơn điệu (monotonic non-decreasing).
        - aiOriginalValue không bị mutate (khớp view.ai_original).
        - Quyết định phê duyệt cấp action: không có trường nào bị REJECT mà chưa được giải quyết.
        """
        if not view.audit_trail:
            return False, "missing_audit_trail"

        seen_record_ids: set[str] = set()
        seen_tokens: set[str] = set()
        prev_ts = None

        # Track latest review action per target field
        field_latest_action: dict[str, ReviewAction] = {}

        ai_orig = view.ai_original if isinstance(view.ai_original, Mapping) else {}

        for rec in view.audit_trail:
            # 1. Matching action_id
            if rec.action_id != view.action_id:
                return False, f"mismatched_action_id_{rec.action_id}_vs_{view.action_id}"

            # 2. Unique record IDs
            if rec.record_id in seen_record_ids:
                return False, f"duplicate_record_id_{rec.record_id}"
            seen_record_ids.add(rec.record_id)

            # 3. Unique idempotency tokens
            if rec.idempotency_token in seen_tokens:
                return False, f"duplicate_idempotency_token_{rec.idempotency_token}"
            seen_tokens.add(rec.idempotency_token)

            # 4. Monotonic timestamp ordering
            curr_ts = rec.timestamp
            if prev_ts is not None and curr_ts < prev_ts:
                return False, f"non_monotonic_timestamps_{curr_ts}_before_{prev_ts}"
            prev_ts = curr_ts

            # 5. Check authorized role
            if rec.reviewer_role not in (ReviewerRole.COACH, ReviewerRole.HEAD_COACH, ReviewerRole.EXPERT_REVIEWER):
                return False, f"unauthorized_reviewer_role_{rec.reviewer_role.value}"

            # 6. Unmutated aiOriginalValue verification
            field_name = rec.target_field.value if hasattr(rec.target_field, "value") else str(rec.target_field)
            expected_ai_val = None
            if field_name == "technique":
                expected_ai_val = ai_orig.get("technique")
            elif field_name == "attacking_side":
                expected_ai_val = ai_orig.get("attacking_side") or ai_orig.get("attackingSide")
            elif field_name == "limb_role":
                expected_ai_val = ai_orig.get("limb_role") or ai_orig.get("limbRole")
            elif field_name == "phase":
                expected_ai_val = ai_orig.get("phases") or ai_orig.get("phase")
            elif field_name == "finding":
                expected_ai_val = ai_orig.get("findings") or ai_orig.get("finding")

            # If expected_ai_val is found in ai_orig, verify rec.ai_original_value matches
            if expected_ai_val is not None and rec.ai_original_value != expected_ai_val:
                return False, f"mutated_ai_original_value_for_{field_name}"

            # Track latest action for this field
            field_latest_action[field_name] = rec.review_action

        # Final action-level approval validation
        # If any field has an unresolved REJECT, the entire action is blocked from export
        for f_name, last_act in field_latest_action.items():
            if last_act == ReviewAction.REJECT:
                return False, f"unresolved_rejection_on_field_{f_name}"

        if policy == ExportApprovalPolicy.STRICT_COACH_APPROVED:
            for f_name, last_act in field_latest_action.items():
                if last_act != ReviewAction.ACCEPT:
                    return False, f"field_{f_name}_has_action_{last_act.value}_not_strictly_approved"
        elif policy == ExportApprovalPolicy.COACH_APPROVED_OR_CORRECTED:
            for f_name, last_act in field_latest_action.items():
                if last_act not in (ReviewAction.ACCEPT, ReviewAction.CORRECT):
                    return False, f"field_{f_name}_has_action_{last_act.value}_not_eligible"

        return True, None

    @classmethod
    def validate_sample_consistency(cls, view: MaterializedActionView) -> tuple[bool, Optional[str]]:
        """
        Kiểm tra tính nhất quán logic trước khi đưa vào dataset huấn luyện:
        - Technique phải được xác định (không được là unknown hay rỗng).
        - Side phải hợp lệ (left | right).
        - Start frame < end frame.
        """
        if view.effective_technique in ("unknown", "", None):
            return False, "effective_technique is unknown"
        if view.effective_attacking_side not in ("left", "right"):
            return False, f"invalid attacking_side '{view.effective_attacking_side}'"

        phases = view.effective_phases
        start_frame = phases.get("startFrame") if isinstance(phases, Mapping) else getattr(phases, "startFrame", None)
        end_frame = phases.get("endFrame") if isinstance(phases, Mapping) else getattr(phases, "endFrame", None)

        if start_frame is not None and end_frame is not None:
            if start_frame >= end_frame:
                return False, f"startFrame ({start_frame}) >= endFrame ({end_frame})"

        return True, None

    @classmethod
    def export_dataset(
        cls,
        action_views_with_athlete: Sequence[tuple[MaterializedActionView, str]],
        salt: str,
        policy: ExportApprovalPolicy = ExportApprovalPolicy.COACH_APPROVED_OR_CORRECTED,
        dataset_id: str = "mma_gold_v1",
        provenance_source: str = "production_coach_review",
    ) -> DatasetExportResult:
        """
        Export danh sách actions thành dataset có kiểm soát.
        """
        cls.validate_salt(salt)

        valid_samples: list[AnonymizedSample] = []
        technique_counts: dict[str, int] = {}
        split_counts: dict[str, int] = {"train": 0, "val": 0, "test": 0}
        seen_sample_ids: set[str] = set()

        for view, raw_athlete_id in action_views_with_athlete:
            # 1. Audit trail eligibility check (R2.3: do not trust view.review_status alone)
            is_audit_eligible, audit_reason = cls.validate_audit_eligibility(view, policy)
            if not is_audit_eligible:
                continue

            # 2. Consistency check
            is_valid, reason = cls.validate_sample_consistency(view)
            if not is_valid:
                continue

            # 3. De-identification (R2.4: do not expose raw action_id)
            ath_hash = cls.hash_athlete_id(raw_athlete_id, salt=salt)
            action_hash = hashlib.sha256(f"{view.action_id}:{salt}".encode("utf-8")).hexdigest()[:10]
            sample_id = f"smp_{ath_hash[:8]}_{action_hash}"

            if sample_id in seen_sample_ids:
                raise ValueError(f"Sample ID collision detected for '{sample_id}'. Ensure salt and action ID provide unique keys.")
            seen_sample_ids.add(sample_id)

            split = cls.assign_split_by_athlete(ath_hash)

            # 4. Extract metrics & audit hash
            ai_orig = view.ai_original
            metrics = ai_orig.get("metrics", {}) if isinstance(ai_orig, Mapping) else {}

            audit_dump = json.dumps([r.to_dict() for r in view.audit_trail], sort_keys=True)
            audit_hash = hashlib.sha256(audit_dump.encode("utf-8")).hexdigest()[:12]

            sample = AnonymizedSample(
                sample_id=sample_id,
                athlete_hash=ath_hash,
                split=split,
                technique=view.effective_technique,
                attacking_side=view.effective_attacking_side,
                limb_role=view.effective_limb_role,
                phases=view.effective_phases,
                metrics=metrics,
                review_status=view.review_status,
                audit_hash=audit_hash,
                provenance_source=provenance_source,
            )
            valid_samples.append(sample)

            technique_counts[sample.technique] = technique_counts.get(sample.technique, 0) + 1
            split_counts[split.value] += 1

        # Sort samples deterministically
        valid_samples.sort(key=lambda s: s.sample_id)

        # 5. Deterministic canonical content_hash covering all sample fields, schema, and policy
        canonical_payload = {
            "schemaVersion": "1.0.0",
            "policy": policy.value if hasattr(policy, "value") else str(policy),
            "samples": [
                {
                    "sampleId": s.sample_id,
                    "athleteHash": s.athlete_hash,
                    "split": s.split.value if hasattr(s.split, "value") else str(s.split),
                    "technique": s.technique,
                    "attackingSide": s.attacking_side,
                    "limbRole": s.limb_role,
                    "phases": s.phases,
                    "metrics": s.metrics,
                    "reviewStatus": s.review_status,
                    "auditHash": s.audit_hash,
                    "provenanceSource": s.provenance_source,
                }
                for s in valid_samples
            ],
        }
        canonical_json = json.dumps(canonical_payload, sort_keys=True, separators=(",", ":"), default=str)
        content_hash = hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()[:16]

        # 6. Verify rigorous GOLD_READY criteria (R2.3 & Remediation R2)
        total_count = len(valid_samples)
        has_min_samples = total_count >= cls.MIN_SAMPLES_FOR_GOLD
        has_class_coverage = REQUIRED_GOLD_CLASSES.issubset(set(technique_counts.keys()))
        has_min_samples_per_class = all(
            technique_counts.get(cls_name, 0) >= cls.MIN_SAMPLES_PER_CLASS_FOR_GOLD
            for cls_name in REQUIRED_GOLD_CLASSES
        )
        has_split_coverage = (
            split_counts["train"] >= cls.MIN_SAMPLES_PER_SPLIT_FOR_GOLD
            and split_counts["val"] >= cls.MIN_SAMPLES_PER_SPLIT_FOR_GOLD
            and split_counts["test"] >= cls.MIN_SAMPLES_PER_SPLIT_FOR_GOLD
        )

        is_gold = has_min_samples and has_class_coverage and has_min_samples_per_class and has_split_coverage
        status_label = "GOLD_READY" if is_gold else "NOT_GOLD_READY"

        notes = (
            "Dataset approved and ready for model fine-tuning with full coverage."
            if is_gold
            else f"Criteria not satisfied (total: {total_count}/{cls.MIN_SAMPLES_FOR_GOLD}, "
                 f"class_coverage: {has_class_coverage}, min_per_class: {has_min_samples_per_class}, "
                 f"split_coverage: {has_split_coverage}); status marked NOT_GOLD_READY."
        )

        dataset_hash = hashlib.sha256(f"{dataset_id}:{content_hash}:{policy.value}".encode("utf-8")).hexdigest()[:16]

        manifest = DatasetManifest(
            dataset_id=dataset_id,
            schema_version="1.0.0",
            export_timestamp=datetime.now(timezone.utc).isoformat(),
            policy=policy.value,
            total_samples=total_count,
            split_distribution=split_counts,
            technique_distribution=technique_counts,
            is_gold_ready=is_gold,
            status=status_label,
            content_hash=content_hash,
            dataset_hash=dataset_hash,
            notes=notes,
        )

        return DatasetExportResult(
            manifest=manifest,
            samples=tuple(valid_samples),
        )
