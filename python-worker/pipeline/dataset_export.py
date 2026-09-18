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
from datetime import datetime, timezone, timedelta
from enum import Enum
import hashlib
import hmac
import json
import math
import os
import threading
from typing import Any, Mapping, Optional, Sequence

_INTERNAL_CAPABILITY_SECRET = os.urandom(32).hex()

REVIEWER_AGREEMENT_POLICY_VERSIONS: dict[str, str] = {
    "dual_review_consensus": "dual_review_consensus_v1.0",
    "expert_supervision": "expert_supervision_single_expert_technique_v1.0",
    "inter_rater_agreement": "inter_rater_agreement_v1.0",
}

from pipeline.contracts import deep_freeze, to_json_safe
from pipeline.review_contract import (
    MaterializedActionView,
    ReviewAction,
    ReviewAuditRecord,
    ReviewerRole,
    ReviewStateMachine,
    TargetField,
)


class DatasetSplit(str, Enum):
    TRAIN = "train"
    VAL = "val"
    TEST = "test"


class ExportApprovalPolicy(str, Enum):
    STRICT_COACH_APPROVED = "strict_coach_approved"
    COACH_APPROVED_OR_CORRECTED = "coach_approved_or_corrected"


ALLOWED_PROVENANCE_SOURCES: frozenset[str] = frozenset({
    "ai_original",
    "coach_review",
    "expert_consensus",
    "dual_review",
})

ALLOWED_QUALITY_STATUSES: frozenset[str] = frozenset({"pass", "degraded"})
ALLOWED_ADJUSTED_EVIDENCE_LEVELS: frozenset[str] = frozenset({"observed", "derived_proxy"})
CURRENT_QUALITY_POLICY_VERSION: str = "quality_policy_v2.0"

REQUIRED_GOLD_CLASSES = {
    "jab", "cross", "hook", "uppercut", "round_kick", "front_kick", "side_kick"
}

ALLOWED_PHASE_FIELDS = {
    "startFrame", "chamberFrame", "launchFrame", "peakFrame", "impactFrame", "endFrame",
    "startTimeMs", "chamberTimeMs", "launchTimeMs", "peakTimeMs", "impactTimeMs", "endTimeMs", "impactType"
}

ALLOWED_METRIC_FIELDS = {
    "normalized_wrist_speed", "max_elbow_angle", "peak_speed", "min_chamber_angle",
    "max_extension_angle", "torso_lean_angle", "hip_rotation_proxy", "wrist_shoulder_distance",
    "vertical_lift_displacement", "lateral_displacement", "trajectory_arc_score", "trajectory_linearity",
    "speed", "extension_deg", "hip_rotation", "arc_curvature", "lateral_displacement_ratio"
}


@dataclass(frozen=True)
class AttestationVerification:
    attestation_id: str
    attestation_digest: str
    status: str  # "VERIFIED" | "REJECTED" | "UNVERIFIED"
    issuer: str = "mma_backend_authority"
    claims: Mapping[str, Any] = field(default_factory=dict)
    _internal_proof: Optional[str] = field(default=None, repr=False)

    def __post_init__(self):
        object.__setattr__(self, "claims", deep_freeze(to_json_safe(self.claims)))


class NonceStore:
    """Interface / Base class for nonce replay persistence."""

    def contains(self, nonce: str) -> bool:
        raise NotImplementedError

    def record(self, nonce: str, expires_at_utc: Optional[str] = None) -> bool:
        raise NotImplementedError

    def _reset_for_testing(self) -> None:
        raise NotImplementedError


class PersistentNonceStore(NonceStore):
    """
    Injected persistent store for attestation nonce replay prevention.
    Thread-safe and shared across verifier instances.
    """

    def __init__(self, storage_path: Optional[str] = None):
        self._storage_path = storage_path
        self._lock = threading.Lock()
        self._nonces: dict[str, Optional[str]] = {}
        if self._storage_path and os.path.exists(self._storage_path):
            self._load()

    def _load(self) -> None:
        try:
            with open(self._storage_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    self._nonces = data
        except Exception:
            pass

    def _persist(self) -> None:
        if not self._storage_path:
            return
        try:
            tmp = f"{self._storage_path}.tmp_{os.getpid()}"
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(self._nonces, f, sort_keys=True)
            os.replace(tmp, self._storage_path)
        except Exception:
            pass

    def contains(self, nonce: str) -> bool:
        with self._lock:
            return nonce in self._nonces

    def record(self, nonce: str, expires_at_utc: Optional[str] = None) -> bool:
        with self._lock:
            if nonce in self._nonces:
                return False
            self._nonces[nonce] = expires_at_utc
            self._persist()
            return True

    def _reset_for_testing(self) -> None:
        with self._lock:
            self._nonces.clear()
            if self._storage_path and os.path.exists(self._storage_path):
                try:
                    os.remove(self._storage_path)
                except Exception:
                    pass


_DEFAULT_PERSISTENT_NONCE_STORE = PersistentNonceStore()


def reset_nonce_store_for_testing(
    target: Optional[Union[NonceStore, BackendAttestationVerifier]] = None,
) -> None:
    """Test-only helper to reset persistent nonce stores between test runs."""
    if target is None:
        _DEFAULT_PERSISTENT_NONCE_STORE._reset_for_testing()
    elif isinstance(target, NonceStore):
        target._reset_for_testing()
    elif isinstance(target, BackendAttestationVerifier):
        target._nonce_store._reset_for_testing()
    else:
        raise TypeError(f"Unsupported target for reset_nonce_store_for_testing: {type(target)}")


class BackendAttestationVerifier:
    """
    Cryptographically verifies backend attestations against configured trusted keys/issuers.
    - Delete acceptance based only on public string prefixes.
    - Do not trust caller-created Mapping or AttestationVerification(status="VERIFIED").
    - _TRUSTED_ISSUERS must not be decorative.
    - Verification is performed through an injected verifier that cryptographically verifies a signed
      assertion against configured trusted keys/issuers, returning an internal verification result
      that callers cannot self-assert.
    - If no verifier/trusted key is configured, readiness stays NOT_GOLD_READY with UNVERIFIED_BACKEND_ATTESTATION.
    - Serializes only a safe attestation reference/digest generated after verification. Never serializes
      caller-controlled IDs that may contain secrets.
    """
    DEFAULT_TRUSTED_ISSUERS: frozenset[str] = frozenset({
        "mma_backend_authority",
        "production_release_pipeline",
        "gold_dataset_signer",
    })
    DEFAULT_ALLOWED_AUDIENCES: frozenset[str] = frozenset({
        "mma_gold_dataset_export",
        "mma_tms",
    })
    DEFAULT_ALLOWED_PURPOSES: frozenset[str] = frozenset({
        "gold_dataset_export",
        "dataset_export",
    })
    DEFAULT_ALLOWED_KEY_IDS: frozenset[str] = frozenset({
        "primary",
        "prod_v1",
        "test_key_01",
    })

    def __init__(
        self,
        trusted_keys: Optional[Mapping[str, str]] = None,
        trusted_issuers: Optional[Sequence[str]] = None,
        allowed_audiences: Optional[Sequence[str]] = None,
        allowed_purposes: Optional[Sequence[str]] = None,
        allowed_key_ids: Optional[Sequence[str]] = None,
        nonce_store: Optional[NonceStore] = None,
    ):
        self.trusted_keys: dict[str, str] = dict(trusted_keys or {})
        self.trusted_issuers: set[str] = (
            set(trusted_issuers) if trusted_issuers is not None else set(self.DEFAULT_TRUSTED_ISSUERS)
        )
        self.allowed_audiences: set[str] = (
            set(allowed_audiences) if allowed_audiences is not None else set(self.DEFAULT_ALLOWED_AUDIENCES)
        )
        self.allowed_purposes: set[str] = (
            set(allowed_purposes) if allowed_purposes is not None else set(self.DEFAULT_ALLOWED_PURPOSES)
        )
        self.allowed_key_ids: set[str] = (
            set(allowed_key_ids) if allowed_key_ids is not None else set(self.DEFAULT_ALLOWED_KEY_IDS)
        )
        self._nonce_store: NonceStore = (
            nonce_store if nonce_store is not None else _DEFAULT_PERSISTENT_NONCE_STORE
        )
        self._verifier_id = hashlib.sha256(
            f"ver_{id(self)}_{datetime.now(timezone.utc).isoformat()}".encode("utf-8")
        ).hexdigest()[:12]
        self._verifier_secret = hashlib.sha256(
            f"secret_{self._verifier_id}_{id(self)}".encode("utf-8")
        ).hexdigest()
        self._capability_token: Optional[str] = None

    @classmethod
    def create_configured_verifier(
        cls,
        trusted_keys: Optional[Mapping[str, str]] = None,
        trusted_issuers: Optional[Sequence[str]] = None,
        allowed_audiences: Optional[Sequence[str]] = None,
        allowed_purposes: Optional[Sequence[str]] = None,
        allowed_key_ids: Optional[Sequence[str]] = None,
        nonce_store: Optional[NonceStore] = None,
    ) -> "BackendAttestationVerifier":
        """Factory method used by application configuration to produce an authorized verifier with internal capability token."""
        verifier = cls(
            trusted_keys=trusted_keys,
            trusted_issuers=trusted_issuers,
            allowed_audiences=allowed_audiences,
            allowed_purposes=allowed_purposes,
            allowed_key_ids=allowed_key_ids,
            nonce_store=nonce_store,
        )
        token = cls._generate_capability_token(verifier._verifier_id)
        object.__setattr__(verifier, "_capability_token", token)
        return verifier

    @classmethod
    def _generate_capability_token(cls, verifier_id: str) -> str:
        return hmac.new(_INTERNAL_CAPABILITY_SECRET.encode("utf-8"), verifier_id.encode("utf-8"), hashlib.sha256).hexdigest()

    def is_factory_configured(self) -> bool:
        token = getattr(self, "_capability_token", None)
        if not token:
            return False
        expected = self._generate_capability_token(self._verifier_id)
        return hmac.compare_digest(expected, token)

    def has_trusted_keys(self) -> bool:
        return bool(self.trusted_keys)

    @classmethod
    def create_signed_assertion(
        cls,
        issuer: str,
        secret_key: str,
        claims: Optional[Mapping[str, Any]] = None,
        key_id: str = "primary",
        audience: str = "mma_gold_dataset_export",
        purpose: str = "gold_dataset_export",
        ttl_seconds: int = 3600,
        issued_at: Optional[str] = None,
        expires_at: Optional[str] = None,
        nonce: Optional[str] = None,
    ) -> dict[str, Any]:
        """Creates a signed assertion token using HMAC-SHA256 for a trusted issuer."""
        if len(secret_key) < 16:
            raise ValueError("Attestation secret key must be at least 16 characters.")
        now = datetime.now(timezone.utc)
        now_iso = issued_at or now.isoformat()
        exp_iso = expires_at or (now + timedelta(seconds=ttl_seconds)).isoformat()
        assertion_nonce = nonce or hashlib.sha256(os.urandom(32)).hexdigest()[:16]

        payload = {
            "issuer": issuer,
            "key_id": key_id,
            "audience": audience,
            "purpose": purpose,
            "issued_at_utc": now_iso,
            "expires_at_utc": exp_iso,
            "nonce": assertion_nonce,
            "claims": dict(claims or {}),
        }
        canonical_bytes = json.dumps(to_json_safe(payload), sort_keys=True, separators=(",", ":")).encode("utf-8")
        signature = hmac.new(secret_key.encode("utf-8"), canonical_bytes, hashlib.sha256).hexdigest()
        return {
            "assertion": payload,
            "signature": signature,
        }

    def _generate_proof(
        self,
        digest: str,
        issuer: str,
        attestation_id: str,
        status: str,
        claims: Mapping[str, Any],
    ) -> str:
        canonical_claims_json = json.dumps(to_json_safe(claims), sort_keys=True, separators=(",", ":"))
        claims_hash = hashlib.sha256(canonical_claims_json.encode("utf-8")).hexdigest()
        data = f"{self._verifier_id}:{issuer}:{digest}:{attestation_id}:{status}:{claims_hash}".encode("utf-8")
        return hmac.new(self._verifier_secret.encode("utf-8"), data, hashlib.sha256).hexdigest()

    def _validate_proof(self, attestation: AttestationVerification) -> bool:
        if not attestation._internal_proof:
            return False
        expected = self._generate_proof(
            digest=attestation.attestation_digest,
            issuer=attestation.issuer,
            attestation_id=attestation.attestation_id,
            status=attestation.status,
            claims=attestation.claims,
        )
        return hmac.compare_digest(expected, attestation._internal_proof)

    def verify(
        self,
        attestation: Optional[Union[str, Mapping[str, Any], AttestationVerification]],
    ) -> tuple[bool, Optional[AttestationVerification], Optional[str]]:
        if attestation is None:
            return False, None, "MISSING_BACKEND_ATTESTATION"

        # 1. Reject AttestationVerification directly as public input
        if isinstance(attestation, AttestationVerification):
            return False, None, "UNVERIFIED_BACKEND_ATTESTATION"

        # 2. If no verifier / trusted key is configured, reject immediately
        if not self.trusted_keys:
            return False, None, "UNVERIFIED_BACKEND_ATTESTATION"

        # 3. Parse input: string or mapping
        raw_assertion: Optional[Mapping[str, Any]] = None
        raw_sig: Optional[str] = None

        if isinstance(attestation, str):
            token = attestation.strip()
            try:
                parsed = json.loads(token)
                if isinstance(parsed, Mapping):
                    raw_assertion = parsed.get("assertion")
                    raw_sig = parsed.get("signature")
            except (ValueError, TypeError):
                pass

            if not raw_assertion or not raw_sig:
                return False, None, "UNVERIFIED_BACKEND_ATTESTATION"

        elif isinstance(attestation, Mapping):
            raw_assertion = attestation.get("assertion")
            raw_sig = attestation.get("signature")
            if not raw_assertion or not raw_sig:
                issuer = str(attestation.get("issuer", "unknown"))
                if issuer not in self.trusted_issuers:
                    return False, None, "UNTRUSTED_ATTESTATION_ISSUER"
                return False, None, "UNVERIFIED_BACKEND_ATTESTATION"
        else:
            return False, None, f"UNSUPPORTED_ATTESTATION_TYPE_{type(attestation).__name__}"

        if not isinstance(raw_assertion, Mapping) or not isinstance(raw_sig, str):
            return False, None, "INVALID_ATTESTATION_STRUCTURE"

        # 4. Issuer validation: _TRUSTED_ISSUERS must not be decorative
        issuer = raw_assertion.get("issuer")
        if not issuer or str(issuer) not in self.trusted_issuers:
            return False, None, "UNTRUSTED_ATTESTATION_ISSUER"

        issuer_str = str(issuer)
        # 5. Configured key for this issuer
        secret_key = self.trusted_keys.get(issuer_str)
        if not secret_key:
            return False, None, "UNCONFIGURED_TRUSTED_KEY"

        # 6. Cryptographic signature verification
        canonical_bytes = json.dumps(to_json_safe(raw_assertion), sort_keys=True, separators=(",", ":")).encode("utf-8")
        expected_sig = hmac.new(secret_key.encode("utf-8"), canonical_bytes, hashlib.sha256).hexdigest()

        if not hmac.compare_digest(expected_sig, raw_sig):
            return False, None, "TAMPERED_ATTESTATION_SIGNATURE"

        # 7. Validate key_id
        key_id = raw_assertion.get("key_id")
        if not key_id or not isinstance(key_id, str) or key_id not in self.allowed_key_ids:
            return False, None, "UNTRUSTED_KEY_ID"

        # 8. Validate audience
        audience = raw_assertion.get("audience")
        if not audience or not isinstance(audience, str) or audience not in self.allowed_audiences:
            return False, None, "INVALID_ATTESTATION_AUDIENCE"

        # 9. Validate purpose
        purpose = raw_assertion.get("purpose")
        if not purpose or not isinstance(purpose, str) or purpose not in self.allowed_purposes:
            return False, None, "INVALID_ATTESTATION_PURPOSE"

        # 10. Validate issued-at and expiry
        now_dt = datetime.now(timezone.utc)
        iat_raw = raw_assertion.get("issued_at_utc")
        exp_raw = raw_assertion.get("expires_at_utc")
        if not iat_raw or not isinstance(iat_raw, str) or not exp_raw or not isinstance(exp_raw, str):
            return False, None, "INVALID_ATTESTATION_TIMESTAMPS"
        try:
            iat_dt = datetime.fromisoformat(iat_raw.replace("Z", "+00:00"))
            exp_dt = datetime.fromisoformat(exp_raw.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            return False, None, "INVALID_ATTESTATION_TIMESTAMPS"

        if iat_dt.tzinfo is None or exp_dt.tzinfo is None:
            return False, None, "MISSING_TIMEZONE_IN_ATTESTATION_TIMESTAMP"

        if now_dt >= exp_dt:
            return False, None, "EXPIRED_ATTESTATION"

        if iat_dt > now_dt + timedelta(seconds=60):
            return False, None, "FUTURE_ISSUED_ATTESTATION"

        # 11. Replay / nonce policy via injected persistent store
        nonce = raw_assertion.get("nonce")
        if not nonce or not isinstance(nonce, str) or not nonce.strip():
            return False, None, "MISSING_ATTESTATION_NONCE"
        if not self._nonce_store.record(nonce, exp_raw):
            return False, None, "REPLAYED_ATTESTATION_NONCE"

        # 12. Verification succeeded: generate safe reference and digest
        digest = hashlib.sha256(canonical_bytes).hexdigest()[:16]
        safe_ref = f"attref_{digest[:12]}"
        proof = self._generate_proof(
            digest=digest,
            issuer=issuer_str,
            attestation_id=safe_ref,
            status="VERIFIED",
            claims=raw_assertion.get("claims", {}),
        )

        verified_rec = AttestationVerification(
            attestation_id=safe_ref,
            attestation_digest=digest,
            status="VERIFIED",
            issuer=issuer_str,
            claims=raw_assertion.get("claims", {}),
            _internal_proof=proof,
        )
        return True, verified_rec, None


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

    def __post_init__(self):
        if self.provenance_source not in ALLOWED_PROVENANCE_SOURCES:
            raise ValueError(
                f"Invalid provenance_source '{self.provenance_source}'. "
                f"Must be one of {sorted(ALLOWED_PROVENANCE_SOURCES)}"
            )

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
    backend_attestation: Optional[str] = None
    attestation_id: Optional[str] = None
    attestation_reference: Optional[str] = None
    attestation_digest: Optional[str] = None
    attestation_status: Optional[str] = None
    attestation_issuer: Optional[str] = None
    reviewer_agreement_policy: Optional[str] = None
    reviewer_agreement_policy_version: Optional[str] = None
    reviewer_agreement_status: Optional[str] = None
    consensus_evidence_digest: Optional[str] = None
    quality_policy_version: str = CURRENT_QUALITY_POLICY_VERSION
    readiness_gaps: tuple[str, ...] = ()

    def to_dict(self) -> dict[str, Any]:
        d = {
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
        if self.attestation_id is not None:
            d["attestationId"] = self.attestation_id
        if self.attestation_reference is not None:
            d["attestationReference"] = self.attestation_reference
        if self.attestation_digest is not None:
            d["attestationDigest"] = self.attestation_digest
        if self.attestation_status is not None:
            d["attestationStatus"] = self.attestation_status
        if self.attestation_issuer is not None:
            d["attestationIssuer"] = self.attestation_issuer
        if self.reviewer_agreement_policy is not None:
            d["reviewerAgreementPolicy"] = self.reviewer_agreement_policy
        if self.reviewer_agreement_policy_version is not None:
            d["reviewerAgreementPolicyVersion"] = self.reviewer_agreement_policy_version
        if self.reviewer_agreement_status is not None:
            d["reviewerAgreementStatus"] = self.reviewer_agreement_status
        if self.consensus_evidence_digest is not None:
            d["consensusEvidenceDigest"] = self.consensus_evidence_digest
        if self.quality_policy_version is not None:
            d["qualityPolicyVersion"] = self.quality_policy_version
        if self.backend_attestation is not None:
            # Store safe non-secret ID for backward compatibility, never secret credentials
            d["backendAttestation"] = self.attestation_reference or self.attestation_id or "verified"
        if self.readiness_gaps:
            d["readinessGaps"] = list(self.readiness_gaps)
        return d


@dataclass(frozen=True)
class DatasetExportResult:
    manifest: DatasetManifest
    samples: tuple[AnonymizedSample, ...]

    def __iter__(self):
        return iter((self.manifest, self.samples))

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

    _system_configured_verifier: Optional[BackendAttestationVerifier] = None

    @classmethod
    def configure_system_verifier(
        cls,
        trusted_keys: Optional[Mapping[str, str]] = None,
        trusted_issuers: Optional[Sequence[str]] = None,
        allowed_audiences: Optional[Sequence[str]] = None,
        allowed_purposes: Optional[Sequence[str]] = None,
        allowed_key_ids: Optional[Sequence[str]] = None,
        nonce_store: Optional[NonceStore] = None,
    ) -> BackendAttestationVerifier:
        verifier = BackendAttestationVerifier.create_configured_verifier(
            trusted_keys=trusted_keys,
            trusted_issuers=trusted_issuers,
            allowed_audiences=allowed_audiences,
            allowed_purposes=allowed_purposes,
            allowed_key_ids=allowed_key_ids,
            nonce_store=nonce_store,
        )
        cls._system_configured_verifier = verifier
        return verifier

    @classmethod
    def set_system_verifier(cls, verifier: Optional[BackendAttestationVerifier]) -> None:
        if verifier is not None:
            if not isinstance(verifier, BackendAttestationVerifier) or not verifier.is_factory_configured():
                raise PermissionError("CALLER_INJECTED_VERIFIER_REJECTED: Verifier lacks application bootstrap capability and cannot be created via public API.")
        cls._system_configured_verifier = verifier

    @classmethod
    def get_system_verifier(cls) -> Optional[BackendAttestationVerifier]:
        return cls._system_configured_verifier

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
        Pseudonymize athlete ID using HMAC-SHA256 under a secret salt.
        Note: This is deterministic pseudonymization under a secret salt, NOT irreversible de-identification.
        """
        if not raw_athlete_id or not isinstance(raw_athlete_id, str) or not raw_athlete_id.strip():
            raise ValueError("raw_athlete_id must be a non-empty string.")
        cls.validate_salt(salt)
        return hmac.new(salt.encode("utf-8"), raw_athlete_id.strip().encode("utf-8"), hashlib.sha256).hexdigest()[:16]

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
        Xác minh tính hợp lệ dựa trên audit trail thực tế và replay canonical state (R3.2).
        Kiểm tra:
        - action_id trên mọi record khớp view.action_id.
        - record_id duy nhất, idempotency_token duy nhất.
        - Thứ tự thời gian timestamp đơn điệu và parseable chuẩn ISO.
        - Non-empty reviewer_id, idempotency_token, reason, supported version.
        - aiOriginalValue không bị mutate (tra cứu cả nested ai_original.assessment.findings).
        - Replay ai_original + audit_trail bằng ReviewStateMachine và đối chiếu với view.effective_*.
        - Quyết định phê duyệt cấp action: không có trường nào bị REJECT mà chưa được giải quyết.
        """
        if not view.audit_trail:
            return False, "missing_audit_trail"

        seen_record_ids: set[str] = set()
        seen_tokens: set[str] = set()
        prev_dt = None
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

            # 4. Monotonic parseable ISO timestamps
            if not rec.timestamp or not isinstance(rec.timestamp, str):
                return False, "missing_or_invalid_timestamp"
            try:
                curr_dt = datetime.fromisoformat(rec.timestamp.replace("Z", "+00:00"))
            except (ValueError, TypeError, AttributeError):
                return False, f"invalid_timestamp_format_{rec.timestamp}"

            if prev_dt is not None and curr_dt < prev_dt:
                return False, f"non_monotonic_timestamps_{rec.timestamp}_before_{prev_ts}"
            prev_dt = curr_dt
            prev_ts = rec.timestamp

            # 5. Check authorized role and required non-empty fields
            if rec.reviewer_role not in (ReviewerRole.COACH, ReviewerRole.HEAD_COACH, ReviewerRole.EXPERT_REVIEWER):
                return False, f"unauthorized_reviewer_role_{rec.reviewer_role.value}"
            if not rec.reviewer_id or not isinstance(rec.reviewer_id, str) or not rec.reviewer_id.strip():
                return False, "empty_reviewer_id"
            if not rec.idempotency_token or not isinstance(rec.idempotency_token, str) or not rec.idempotency_token.strip():
                return False, "empty_idempotency_token"
            if not rec.reason or not isinstance(rec.reason, str) or not rec.reason.strip():
                return False, "empty_review_reason"
            if getattr(rec, "version", "1.0.0") not in ("1.0.0", "1.0", "2.0.0"):
                return False, f"unsupported_audit_version_{getattr(rec, 'version', None)}"

            # 6. Unmutated aiOriginalValue verification with nested finding lookup
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
                assessment = ai_orig.get("assessment", {}) if isinstance(ai_orig, Mapping) else {}
                expected_ai_val = assessment.get("findings") if isinstance(assessment, Mapping) else None
                if expected_ai_val is None:
                    expected_ai_val = ai_orig.get("findings") or ai_orig.get("finding")

            # If expected_ai_val is found in ai_orig, verify rec.ai_original_value matches
            if expected_ai_val is not None and to_json_safe(rec.ai_original_value) != to_json_safe(expected_ai_val):
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

        # 7. Canonical State Machine Replay Verification (R3.2)
        reconstructed = ReviewStateMachine.initialize_view(ai_orig)
        for rec in view.audit_trail:
            reconstructed = ReviewStateMachine.apply_review_event(
                current_view=reconstructed,
                target_field=rec.target_field,
                review_action=rec.review_action,
                corrected_value=rec.corrected_value,
                reviewer_id=rec.reviewer_id,
                reviewer_role=rec.reviewer_role,
                reason=rec.reason,
                idempotency_token=rec.idempotency_token,
                timestamp=rec.timestamp,
            )

        if reconstructed.effective_technique != view.effective_technique:
            return False, f"forged_effective_technique_mismatch_{reconstructed.effective_technique}_vs_{view.effective_technique}"
        if reconstructed.effective_attacking_side != view.effective_attacking_side:
            return False, f"forged_effective_attacking_side_mismatch_{reconstructed.effective_attacking_side}_vs_{view.effective_attacking_side}"
        if reconstructed.effective_limb_role != view.effective_limb_role:
            return False, f"forged_effective_limb_role_mismatch_{reconstructed.effective_limb_role}_vs_{view.effective_limb_role}"
        if to_json_safe(reconstructed.effective_phases) != to_json_safe(view.effective_phases):
            return False, "forged_effective_phases_mismatch"
        if to_json_safe(reconstructed.effective_findings) != to_json_safe(view.effective_findings):
            return False, "forged_effective_findings_mismatch"
        if reconstructed.review_status != view.review_status:
            return False, f"forged_review_status_mismatch_{reconstructed.review_status}_vs_{view.review_status}"

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
    def verify_sample_reviewer_consensus(
        cls,
        view: MaterializedActionView,
        policy: Optional[str],
        covered_actions_by_attestation: Optional[frozenset[str]] = None,
    ) -> tuple[bool, Optional[str], Optional[dict[str, Any]]]:
        """
        Verify per-sample reviewer consensus (R3 Final Blocker 2):
        - Do not count reviewer IDs globally across the export.
        - For every candidate sample, prove the required distinct reviewers reviewed the same action
          and reached the same final label/value under the declared policy.
        - Reviews from ineligible/excluded actions must not contribute.
        - Conflicting reviewer decisions must block that sample.
        - Dataset can be GOLD_READY only when every included sample satisfies its review policy,
          or when a signed backend consensus decision explicitly covers that sample.
        """
        if covered_actions_by_attestation and view.action_id in covered_actions_by_attestation:
            return True, None, {
                "action_id": view.action_id,
                "reviewers": ["signed_backend_consensus"],
                "agreed_value": view.effective_technique,
                "status": "SIGNED_BACKEND_CONSENSUS",
            }

        # Filter audit records from qualified reviewers on THIS action
        qualified_records = [
            rec for rec in view.audit_trail
            if rec.action_id == view.action_id
            and rec.reviewer_role in (
                ReviewerRole.COACH,
                ReviewerRole.HEAD_COACH,
                ReviewerRole.EXPERT_REVIEWER,
            )
            and rec.reviewer_id and isinstance(rec.reviewer_id, str) and rec.reviewer_id.strip()
        ]

        if not policy or policy not in ("dual_review_consensus", "expert_supervision", "inter_rater_agreement"):
            return False, "MISSING_OR_UNSUPPORTED_AGREEMENT_POLICY", None

        if policy in ("dual_review_consensus", "inter_rater_agreement"):
            reviewer_decisions: dict[str, str] = {}
            for rec in qualified_records:
                rev_id = rec.reviewer_id.strip()
                field_name = rec.target_field.value if hasattr(rec.target_field, "value") else str(rec.target_field)
                if field_name == "technique":
                    if rec.review_action == ReviewAction.ACCEPT:
                        reviewer_decisions[rev_id] = str(rec.ai_original_value)
                    elif rec.review_action == ReviewAction.CORRECT:
                        reviewer_decisions[rev_id] = str(rec.corrected_value)
                    elif rec.review_action == ReviewAction.REJECT:
                        reviewer_decisions[rev_id] = "REJECTED"

            distinct_reviewers = sorted(list(reviewer_decisions.keys()))
            if len(distinct_reviewers) < 2:
                return False, "INSUFFICIENT_REVIEWERS_ON_ACTION", {
                    "action_id": view.action_id,
                    "reviewers": distinct_reviewers,
                    "status": "INSUFFICIENT_REVIEWERS",
                }

            decided_values = set(reviewer_decisions.values())
            if len(decided_values) > 1 or "REJECTED" in decided_values:
                return False, "REVIEWER_DISAGREEMENT_ON_ACTION", {
                    "action_id": view.action_id,
                    "reviewers": distinct_reviewers,
                    "decisions": reviewer_decisions,
                    "status": "DISAGREEMENT",
                }

            agreed_val = next(iter(decided_values))
            if agreed_val != view.effective_technique:
                return False, "CONSENSUS_MISMATCH_WITH_EFFECTIVE_VALUE", {
                    "action_id": view.action_id,
                    "reviewers": distinct_reviewers,
                    "status": "EFFECTIVE_MISMATCH",
                }

            return True, None, {
                "action_id": view.action_id,
                "reviewers": distinct_reviewers,
                "agreed_value": agreed_val,
                "status": "CONSENSUS_REACHED",
            }

        elif policy == "expert_supervision":
            expert_records = [
                rec for rec in qualified_records
                if rec.reviewer_role in (ReviewerRole.EXPERT_REVIEWER, ReviewerRole.HEAD_COACH)
            ]
            if not expert_records:
                return False, "MISSING_EXPERT_SUPERVISION_REVIEWER", None

            # expert_supervision MUST require an expert/head-coach decision on TargetField.TECHNIQUE
            expert_tech_records = [
                rec for rec in expert_records
                if (
                    rec.target_field == TargetField.TECHNIQUE
                    or (hasattr(rec.target_field, "value") and rec.target_field.value == "technique")
                    or str(rec.target_field) == "technique"
                )
            ]
            if not expert_tech_records:
                # Reviews of side, phase, finding or another field must not promote the technique label
                return False, "MISSING_EXPERT_TECHNIQUE_REVIEW", {
                    "action_id": view.action_id,
                    "status": "NON_TECHNIQUE_REVIEW_ONLY",
                    "fields_reviewed": [
                        rec.target_field.value if hasattr(rec.target_field, "value") else str(rec.target_field)
                        for rec in expert_records
                    ],
                }

            # REJECT cannot count as supervision approval
            rejections = [rec for rec in expert_tech_records if rec.review_action == ReviewAction.REJECT]
            if rejections:
                return False, "EXPERT_REJECTED_TECHNIQUE", {
                    "action_id": view.action_id,
                    "status": "EXPERT_REJECTED",
                    "reviewers": [r.reviewer_id.strip() for r in rejections],
                }

            supervised_decisions: dict[str, str] = {}
            for rec in expert_tech_records:
                rev_id = rec.reviewer_id.strip()
                if rec.review_action == ReviewAction.ACCEPT:
                    # ACCEPT must explicitly confirm the original technique and match the effective technique
                    supervised_decisions[rev_id] = str(rec.ai_original_value)
                elif rec.review_action == ReviewAction.CORRECT:
                    # CORRECT must provide the final technique and match the effective technique
                    supervised_decisions[rev_id] = str(rec.corrected_value)

            if not supervised_decisions:
                return False, "NO_VALID_EXPERT_TECHNIQUE_DECISION", None

            distinct_values = set(supervised_decisions.values())
            if len(distinct_values) > 1:
                return False, "EXPERT_SUPERVISION_DISAGREEMENT", {
                    "action_id": view.action_id,
                    "status": "DISAGREEMENT",
                    "decisions": supervised_decisions,
                }

            supervised_technique = next(iter(distinct_values))
            if supervised_technique != view.effective_technique:
                return False, "SUPERVISION_MISMATCH_WITH_EFFECTIVE_VALUE", {
                    "action_id": view.action_id,
                    "status": "SUPERVISION_MISMATCH",
                    "supervised_value": supervised_technique,
                    "effective_value": view.effective_technique,
                }

            # Explicit policy: Exactly one qualified expert/head-coach decision on TECHNIQUE is sufficient
            return True, None, {
                "action_id": view.action_id,
                "reviewers": sorted(list(supervised_decisions.keys())),
                "agreed_value": supervised_technique,
                "status": "EXPERT_SUPERVISED",
                "policy": REVIEWER_AGREEMENT_POLICY_VERSIONS["expert_supervision"],
            }

        return False, f"UNSUPPORTED_AGREEMENT_POLICY_{policy}", None

    @classmethod
    def export_dataset(
        cls,
        action_views_with_athlete: Sequence[tuple[MaterializedActionView, str]],
        salt: str,
        policy: ExportApprovalPolicy = ExportApprovalPolicy.COACH_APPROVED_OR_CORRECTED,
        dataset_id: str = "mma_gold_v1",
        provenance_source: str = "coach_review",
        backend_attestation: Optional[Union[str, Mapping[str, Any], AttestationVerification]] = None,
        reviewer_agreement_policy: Optional[str] = None,
        **kwargs: Any,
    ) -> DatasetExportResult:
        """
        Export danh sách actions thành dataset có kiểm soát.
        """
        if "attestation_verifier" in kwargs:
            raise TypeError("attestation_verifier parameter has been removed from export_dataset; verifier must be managed by application bootstrap.")

        if provenance_source not in ALLOWED_PROVENANCE_SOURCES:
            raise ValueError(
                f"Invalid provenance_source '{provenance_source}'. "
                f"Must be one of {sorted(ALLOWED_PROVENANCE_SOURCES)}"
            )

        cls.validate_salt(salt)

        # Attestation verifier resolution: ONLY obtained from application bootstrap
        attestation_verifier = cls.get_system_verifier()

        if attestation_verifier is None or not attestation_verifier.is_factory_configured():
            is_att_verified = False
            att_rec = None
            att_err = "UNVERIFIED_BACKEND_ATTESTATION"
        else:
            is_att_verified, att_rec, att_err = attestation_verifier.verify(backend_attestation)

        att_id = att_rec.attestation_id if att_rec else None
        att_digest = att_rec.attestation_digest if att_rec else None
        att_status = att_rec.status if att_rec else "UNVERIFIED"
        att_issuer = att_rec.issuer if att_rec else None

        # Check for covered actions in claims if present
        covered_actions_by_attestation: Optional[frozenset[str]] = None
        if is_att_verified and att_rec and isinstance(att_rec.claims, Mapping):
            ca = att_rec.claims.get("covered_actions") or att_rec.claims.get("consensus_action_ids")
            if isinstance(ca, (list, tuple, set, frozenset)):
                covered_actions_by_attestation = frozenset(str(x) for x in ca)

        valid_samples: list[AnonymizedSample] = []
        technique_counts: dict[str, int] = {}
        split_counts: dict[str, int] = {"train": 0, "val": 0, "test": 0}
        seen_sample_ids: set[str] = set()

        sample_consensus_records: dict[str, dict[str, Any]] = {}
        disputed_samples: list[str] = []
        samples_lacking_consensus: list[str] = []

        for view, raw_athlete_id in action_views_with_athlete:
            # 1. Audit trail eligibility check (canonical state machine replay)
            is_audit_eligible, audit_reason = cls.validate_audit_eligibility(view, policy)
            if not is_audit_eligible:
                continue

            # 2. Consistency check
            is_valid, reason = cls.validate_sample_consistency(view)
            if not is_valid:
                continue

            # 3. Check per-sample consensus
            has_consensus, consensus_err, consensus_info = cls.verify_sample_reviewer_consensus(
                view,
                policy=reviewer_agreement_policy,
                covered_actions_by_attestation=covered_actions_by_attestation,
            )

            # Conflicting or rejected reviewer decisions must block that sample
            if consensus_err in (
                "REVIEWER_DISAGREEMENT_ON_ACTION",
                "EXPERT_SUPERVISION_DISAGREEMENT",
                "EXPERT_REJECTED_TECHNIQUE",
            ):
                disputed_samples.append(view.action_id)
                continue  # Conflicting reviewer decisions block this sample!

            if not has_consensus:
                samples_lacking_consensus.append(view.action_id)

            # 4. Pseudonymization using HMAC-SHA256 (R3.3 & R3.4)
            ath_hash = cls.hash_athlete_id(raw_athlete_id, salt=salt)
            action_hash = hmac.new(salt.encode("utf-8"), view.action_id.encode("utf-8"), hashlib.sha256).hexdigest()[:10]
            sample_id = f"smp_{ath_hash[:8]}_{action_hash}"

            if sample_id in seen_sample_ids:
                raise ValueError(f"Sample ID collision detected for '{sample_id}'. Ensure salt and action ID provide unique keys.")
            seen_sample_ids.add(sample_id)

            sample_consensus_records[sample_id] = consensus_info or {
                "action_id": view.action_id,
                "reviewers": [],
                "status": "NO_CONSENSUS",
            }

            split = cls.assign_split_by_athlete(ath_hash)

            # 5. Extract metrics & audit hash with allowlist filtering (R3.4)
            ai_orig = view.ai_original
            raw_metrics = ai_orig.get("metrics", {}) if isinstance(ai_orig, Mapping) else {}
            if isinstance(raw_metrics, Mapping):
                filtered_metrics = {k: v for k, v in raw_metrics.items() if k in ALLOWED_METRIC_FIELDS}
            else:
                filtered_metrics = {}

            raw_phases = view.effective_phases
            if isinstance(raw_phases, Mapping):
                filtered_phases = {k: v for k, v in raw_phases.items() if k in ALLOWED_PHASE_FIELDS}
            else:
                filtered_phases = {}

            audit_dump = json.dumps([r.to_dict() for r in view.audit_trail], sort_keys=True)
            audit_hash = hashlib.sha256(audit_dump.encode("utf-8")).hexdigest()[:12]

            sample = AnonymizedSample(
                sample_id=sample_id,
                athlete_hash=ath_hash,
                split=split,
                technique=view.effective_technique,
                attacking_side=view.effective_attacking_side,
                limb_role=view.effective_limb_role,
                phases=filtered_phases,
                metrics=filtered_metrics,
                review_status=view.review_status,
                audit_hash=audit_hash,
                provenance_source=provenance_source,
            )
            valid_samples.append(sample)

            technique_counts[sample.technique] = technique_counts.get(sample.technique, 0) + 1
            split_counts[split.value] += 1

        # Sort samples deterministically
        valid_samples.sort(key=lambda s: s.sample_id)

        # 6. Deterministic canonical content_hash covering all sample fields, schema, and policy
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
        # Strict canonical serialization: to_json_safe first, NO default=str (fail on unsupported types)
        safe_canonical = to_json_safe(canonical_payload)
        canonical_json = json.dumps(safe_canonical, sort_keys=True, separators=(",", ":"))
        content_hash = hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()[:16]

        # 7. Verify rigorous GOLD_READY criteria
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

        has_reviewer_agreement = (
            len(disputed_samples) == 0
            and len(samples_lacking_consensus) == 0
            and len(valid_samples) > 0
            and reviewer_agreement_policy is not None
        )
        reviewer_agreement_status = (
            "VERIFIED_PER_SAMPLE_CONSENSUS"
            if has_reviewer_agreement
            else "MISSING_REVIEWER_AGREEMENT_EVIDENCE"
        )

        readiness_gaps: list[str] = []
        if not has_min_samples:
            readiness_gaps.append("INSUFFICIENT_SAMPLE_COUNT")
        if not has_class_coverage:
            readiness_gaps.append("INSUFFICIENT_CLASS_COVERAGE")
        if not has_min_samples_per_class:
            readiness_gaps.append("INSUFFICIENT_SAMPLES_PER_CLASS")
        if not has_split_coverage:
            readiness_gaps.append("INSUFFICIENT_SPLIT_COVERAGE")
        if not is_att_verified:
            readiness_gaps.append("MISSING_BACKEND_ATTESTATION")
            if att_err and att_err != "MISSING_BACKEND_ATTESTATION":
                readiness_gaps.append(att_err)
        if disputed_samples:
            readiness_gaps.append(f"SAMPLE_REVIEWER_DISAGREEMENT_{len(disputed_samples)}_SAMPLES")
        if samples_lacking_consensus or not has_reviewer_agreement:
            if "MISSING_REVIEWER_AGREEMENT_EVIDENCE" not in readiness_gaps:
                readiness_gaps.append("MISSING_REVIEWER_AGREEMENT_EVIDENCE")
        if not reviewer_agreement_policy or reviewer_agreement_policy not in (
            "dual_review_consensus", "expert_supervision", "inter_rater_agreement"
        ):
            readiness_gaps.append("MISSING_REVIEWER_AGREEMENT_POLICY")

        for view, _ in action_views_with_athlete:
            orig = view.ai_original if isinstance(view.ai_original, Mapping) else {}
            q_status = orig.get("qualityStatus")
            e_level = orig.get("adjustedEvidenceLevel")

            if q_status not in ALLOWED_QUALITY_STATUSES:
                if q_status == "blocked":
                    readiness_gaps.append("BLOCKED_QUALITY_ACTIONS_PRESENT")
                elif q_status is None:
                    readiness_gaps.append("MISSING_QUALITY_STATUS")
                else:
                    readiness_gaps.append(f"INVALID_QUALITY_STATUS_{q_status}")
                break

            if e_level not in ALLOWED_ADJUSTED_EVIDENCE_LEVELS:
                if e_level == "unavailable":
                    readiness_gaps.append("UNAVAILABLE_EVIDENCE_ACTIONS_PRESENT")
                elif e_level is None:
                    readiness_gaps.append("MISSING_ADJUSTED_EVIDENCE_LEVEL")
                else:
                    readiness_gaps.append(f"INVALID_ADJUSTED_EVIDENCE_LEVEL_{e_level}")
                break

        is_gold = (len(readiness_gaps) == 0)
        status_label = "GOLD_READY" if is_gold else "NOT_GOLD_READY"

        notes = (
            "Dataset approved and ready for model fine-tuning with full coverage and backend attestation."
            if is_gold
            else f"Readiness gaps: {', '.join(readiness_gaps)}; status marked NOT_GOLD_READY."
        )

        # 8. Canonical per-sample consensus evidence digest
        consensus_list = [
            {
                "sampleId": s.sample_id,
                "reviewers": sample_consensus_records.get(s.sample_id, {}).get("reviewers", []),
                "agreedValue": sample_consensus_records.get(s.sample_id, {}).get("agreed_value", s.technique),
                "status": sample_consensus_records.get(s.sample_id, {}).get("status", "UNKNOWN"),
            }
            for s in valid_samples
        ]
        consensus_evidence_digest = hashlib.sha256(
            json.dumps(to_json_safe(consensus_list), sort_keys=True, separators=(",", ":")).encode("utf-8")
        ).hexdigest()[:16]

        agreement_policy_version = (
            REVIEWER_AGREEMENT_POLICY_VERSIONS.get(reviewer_agreement_policy, "reviewer_policy_v1.0")
            if reviewer_agreement_policy
            else None
        )

        # 9. Bind governance evidence to dataset identity (R3 Final Blocker 3)
        governance_hash_payload = {
            "datasetId": dataset_id,
            "contentHash": content_hash,
            "exportPolicy": policy.value if hasattr(policy, "value") else str(policy),
            "reviewerAgreementPolicy": reviewer_agreement_policy or "none",
            "reviewerAgreementPolicyVersion": agreement_policy_version or "none",
            "reviewerAgreementStatus": reviewer_agreement_status,
            "consensusEvidenceDigest": consensus_evidence_digest,
            "attestationIssuer": att_issuer or "none",
            "attestationReference": att_id or "none",
            "attestationDigest": att_digest or "none",
            "attestationStatus": att_status or "UNVERIFIED",
            "qualityPolicyVersion": CURRENT_QUALITY_POLICY_VERSION,
        }
        dataset_hash_input = json.dumps(to_json_safe(governance_hash_payload), sort_keys=True, separators=(",", ":"))
        dataset_hash = hashlib.sha256(dataset_hash_input.encode("utf-8")).hexdigest()[:16]

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
            backend_attestation=att_id,
            attestation_id=att_id,
            attestation_reference=att_id,
            attestation_digest=att_digest,
            attestation_status=att_status,
            attestation_issuer=att_issuer,
            reviewer_agreement_policy=reviewer_agreement_policy,
            reviewer_agreement_policy_version=agreement_policy_version,
            reviewer_agreement_status=reviewer_agreement_status,
            consensus_evidence_digest=consensus_evidence_digest,
            quality_policy_version=CURRENT_QUALITY_POLICY_VERSION,
            readiness_gaps=tuple(readiness_gaps),
        )

        return DatasetExportResult(
            manifest=manifest,
            samples=tuple(valid_samples),
        )
