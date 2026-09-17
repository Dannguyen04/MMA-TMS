"""
review_contract.py — Coach Review, Correction & Audit Contract (Task 13)

Thiết kế và triển khai phần AI-side cho review & feedback loop:
- Cho phép HLV thực hiện accept | correct | reject đối với label, side, phase hoặc finding.
- AI Original luôn được lưu nguyên vẹn (immutable preservation).
- Mọi chỉnh sửa tạo record mới trong audit trail (append-only audit log).
- Đầy đủ actor, timestamp, reason, version, và idempotency_token.
- Sinh deterministic materialized view của trạng thái review mới nhất.
- Cung cấp Backend Integration Contract cho Product Backend.

Backend Integration Contract:
-----------------------------
Event Name: ai.action.reviewed
Idempotency: Client cung cấp idempotency_token.
  - Cùng token + cùng payload: trả về view hiện tại (idempotent 200).
  - Cùng token + khác payload: raise IdempotencyConflictError (được Product Backend map sang HTTP 409 Conflict).
Error Semantics:
  - 400 Bad Request: Dữ liệu sửa đổi vi phạm schema / target_field không hợp lệ.
  - 404 Not Found: action_id không tồn tại trong phiên phân tích.
  - 409 Conflict: idempotency_token trùng lặp nhưng payload khác nhau (IdempotencyConflictError).
"""

from __future__ import annotations

import copy
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
import hashlib
import json
from typing import Any, Mapping, Optional, Sequence

from pipeline.contracts import deep_freeze, to_json_safe


class IdempotencyConflictError(Exception):
    """
    Ngoại lệ khi client tái sử dụng idempotency_token nhưng với payload khác.
    Product Backend bắt ngoại lệ này để trả về HTTP 409 Conflict.
    """
    pass


class ReviewAction(str, Enum):
    ACCEPT = "accept"
    CORRECT = "correct"
    REJECT = "reject"


class TargetField(str, Enum):
    TECHNIQUE = "technique"
    ATTACKING_SIDE = "attacking_side"
    LIMB_ROLE = "limb_role"
    PHASE = "phase"
    FINDING = "finding"


class ReviewerRole(str, Enum):
    COACH = "coach"
    HEAD_COACH = "head_coach"
    EXPERT_REVIEWER = "expert_reviewer"


@dataclass(frozen=True)
class ReviewAuditRecord:
    """Bản ghi kiểm toán bất biến cho mỗi thao tác review của huấn luyện viên."""
    record_id: str
    action_id: str
    target_field: TargetField
    review_action: ReviewAction
    ai_original_value: Any
    corrected_value: Any
    reviewer_id: str
    reviewer_role: ReviewerRole
    reason: str
    timestamp: str
    idempotency_token: str
    version: str = "1.0.0"

    def to_dict(self) -> dict[str, Any]:
        return {
            "recordId": self.record_id,
            "actionId": self.action_id,
            "targetField": self.target_field.value,
            "reviewAction": self.review_action.value,
            "aiOriginalValue": to_json_safe(self.ai_original_value),
            "correctedValue": to_json_safe(self.corrected_value),
            "reviewerId": self.reviewer_id,
            "reviewerRole": self.reviewer_role.value,
            "reason": self.reason,
            "timestamp": self.timestamp,
            "idempotencyToken": self.idempotency_token,
            "version": self.version,
        }


@dataclass(frozen=True)
class MaterializedActionView:
    """
    Trạng thái phản ánh (materialized view) được tính toán deterministically
    từ AI Original kết hợp toàn bộ chuỗi ReviewAuditRecord.
    """
    action_id: str
    ai_original: Mapping[str, Any]
    effective_technique: str
    effective_attacking_side: str
    effective_limb_role: str
    effective_phases: Mapping[str, Any]
    effective_findings: tuple[Mapping[str, Any], ...]
    review_status: str  # "ai_generated" | "coach_approved" | "coach_corrected" | "coach_rejected"
    audit_trail: tuple[ReviewAuditRecord, ...]
    updated_at: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "actionId": self.action_id,
            "aiOriginal": to_json_safe(self.ai_original),
            "effectiveTechnique": self.effective_technique,
            "effectiveAttackingSide": self.effective_attacking_side,
            "effectiveLimbRole": self.effective_limb_role,
            "effectivePhases": to_json_safe(self.effective_phases),
            "effectiveFindings": [to_json_safe(f) for f in self.effective_findings],
            "reviewStatus": self.review_status,
            "auditTrail": [r.to_dict() for r in self.audit_trail],
            "updatedAt": self.updated_at,
        }


class ReviewStateMachine:
    """
    State machine deterministic xử lý các sự kiện review và duy trì tính toàn vẹn của dữ liệu gốc.
    """

    @staticmethod
    def initialize_view(ai_action_dict: Mapping[str, Any]) -> MaterializedActionView:
        """Khởi tạo view ban đầu từ action AI gốc."""
        action_id = str(ai_action_dict.get("id", ""))
        technique = str(ai_action_dict.get("technique", "unknown"))
        side = str(ai_action_dict.get("attackingSide", "unknown"))
        limb_role = str(ai_action_dict.get("limbRole", "unknown"))
        phases = ai_action_dict.get("phases", {})
        
        # Extract findings from assessment or root
        assessment = ai_action_dict.get("assessment", {})
        findings = assessment.get("findings", [])

        frozen_orig = deep_freeze(copy.deepcopy(dict(ai_action_dict)))

        return MaterializedActionView(
            action_id=action_id,
            ai_original=frozen_orig,
            effective_technique=technique,
            effective_attacking_side=side,
            effective_limb_role=limb_role,
            effective_phases=deep_freeze(phases),
            effective_findings=tuple(deep_freeze(f) for f in findings),
            review_status="ai_generated",
            audit_trail=(),
            updated_at=datetime.now(timezone.utc).isoformat(),
        )

    @classmethod
    def apply_review_event(
        cls,
        current_view: MaterializedActionView,
        target_field: TargetField,
        review_action: ReviewAction,
        corrected_value: Any,
        reviewer_id: str,
        reviewer_role: ReviewerRole,
        reason: str,
        idempotency_token: str,
        timestamp: Optional[str] = None,
    ) -> MaterializedActionView:
        """
        Áp dụng một thao tác review mới lên materialized view hiện tại.
        - Idempotency: Kiểm tra canonical payload đối với cùng token.
          + Khớp payload -> trả về current_view mà không tạo thêm audit record.
          + Khác payload -> raise IdempotencyConflictError (map sang HTTP 409).
        - Immutability: Deep freeze / copy an toàn giá trị corrected_value.
        - aiOriginalValue: Bắt buộc trỏ về AI Original ban đầu, KHÔNG lấy giá trị đã sửa đổi.
        """
        # Defensive deep copy and freeze corrected value
        frozen_corrected = deep_freeze(copy.deepcopy(corrected_value))

        # 1. Idempotency Check with Canonical Payload Verification
        for rec in current_view.audit_trail:
            if rec.idempotency_token == idempotency_token:
                # Compare canonical fields
                is_same_payload = (
                    rec.target_field == target_field
                    and rec.review_action == review_action
                    and to_json_safe(rec.corrected_value) == to_json_safe(frozen_corrected)
                    and rec.reviewer_id == reviewer_id
                    and rec.reviewer_role == reviewer_role
                    and rec.reason == reason
                )
                if is_same_payload:
                    return current_view
                else:
                    raise IdempotencyConflictError(
                        f"Idempotency conflict for token '{idempotency_token}': "
                        f"incoming payload differs from existing audit record {rec.record_id}."
                    )

        event_time = timestamp or datetime.now(timezone.utc).isoformat()
        record_id = f"rev_{current_view.action_id}_{len(current_view.audit_trail) + 1}_{hashlib.sha256(idempotency_token.encode('utf-8')).hexdigest()[:8]}"

        # 2. Extract TRUE original value of target field from ai_original (R2.2)
        ai_orig = current_view.ai_original
        if target_field == TargetField.TECHNIQUE:
            orig_val = ai_orig.get("technique")
        elif target_field == TargetField.ATTACKING_SIDE:
            orig_val = ai_orig.get("attackingSide")
        elif target_field == TargetField.LIMB_ROLE:
            orig_val = ai_orig.get("limbRole")
        elif target_field == TargetField.PHASE:
            orig_val = ai_orig.get("phases")
        elif target_field == TargetField.FINDING:
            assessment = ai_orig.get("assessment", {})
            orig_val = assessment.get("findings") if isinstance(assessment, Mapping) else None
        else:
            orig_val = None

        new_record = ReviewAuditRecord(
            record_id=record_id,
            action_id=current_view.action_id,
            target_field=target_field,
            review_action=review_action,
            ai_original_value=orig_val,
            corrected_value=frozen_corrected,
            reviewer_id=reviewer_id,
            reviewer_role=reviewer_role,
            reason=reason,
            timestamp=event_time,
            idempotency_token=idempotency_token,
        )

        new_audit = current_view.audit_trail + (new_record,)

        # 3. Derive new effective state
        eff_tech = current_view.effective_technique
        eff_side = current_view.effective_attacking_side
        eff_role = current_view.effective_limb_role
        eff_phases = current_view.effective_phases
        eff_findings = list(current_view.effective_findings)

        if review_action == ReviewAction.REJECT:
            status = "coach_rejected"
        elif review_action == ReviewAction.ACCEPT:
            status = "coach_approved"
        elif review_action == ReviewAction.CORRECT:
            status = "coach_corrected"
            if target_field == TargetField.TECHNIQUE and isinstance(frozen_corrected, str):
                eff_tech = frozen_corrected
            elif target_field == TargetField.ATTACKING_SIDE and isinstance(frozen_corrected, str):
                eff_side = frozen_corrected
            elif target_field == TargetField.LIMB_ROLE and isinstance(frozen_corrected, str):
                eff_role = frozen_corrected
            elif target_field == TargetField.PHASE and isinstance(frozen_corrected, Mapping):
                eff_phases = deep_freeze(dict(frozen_corrected))
            elif target_field == TargetField.FINDING:
                if isinstance(frozen_corrected, (list, tuple)):
                    eff_findings = [deep_freeze(f) for f in frozen_corrected]
        else:
            status = current_view.review_status

        return MaterializedActionView(
            action_id=current_view.action_id,
            ai_original=current_view.ai_original,  # ALWAYS UNTOUCHED
            effective_technique=eff_tech,
            effective_attacking_side=eff_side,
            effective_limb_role=eff_role,
            effective_phases=eff_phases,
            effective_findings=tuple(eff_findings),
            review_status=status,
            audit_trail=new_audit,
            updated_at=event_time,
        )
