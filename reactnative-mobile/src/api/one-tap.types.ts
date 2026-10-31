/**
 * Kiểu body/kết quả của các thao tác ghi 1 chạm (one-tap-actions-v3 + video-ai-v1).
 * Tên trường/enum đúng DTO backend (nestjs-api, đọc chỉ để đối chiếu).
 */

/** POST /coaching/videos/{videoId}/reanalyze — body chỉ có fighterId (@Body('fighterId')). */
export type ReanalyzeBody = { fighterId: string };
/** Kết quả reanalyzeVideo(): tạo video + job mới, giữ bản cũ. */
export type ReanalyzeResult = { reanalysis: true; jobId: string; analysisId: string; newVideoId: string; status: "QUEUED" };

/** ReviewFindingDto (coachId do máy chủ gán cho HLV). Đúng = approved, Sai = rejected. */
export const FINDING_REVIEW_STATUSES = ["approved", "rejected", "corrected"] as const;
export type FindingReviewStatus = (typeof FINDING_REVIEW_STATUSES)[number];
export type ReviewFindingBody = {
  analysisId: string;
  actionId: string;
  findingId: string;
  status: FindingReviewStatus;
  notes?: string;
  /** ≤120 ký tự. */
  correctedLabel?: string;
};

/** RevokeReferenceDto: coachId bắt buộc (UUID) và phải trùng HLV đang đăng nhập; reason là chuỗi. */
export type RevokeReferenceBody = { coachId: string; referenceId: string; reason: string };

/** Một dòng technique_references trong GET /coaching/loop-state/{fighterId} → activeReferences. */
export type ActiveReference = {
  id: string;
  fighterId: string;
  technique: string;
  actionId: string;
  videoId: string;
  sessionId: string | null;
  status: "active" | "revoked";
  createdAt: string;
};

/** MovementReviewDto (strict): corrected cần startMs/endMs → làm trên web; mobile chỉ confirmed / rejected. */
export const MOVEMENT_DECISIONS_MOBILE = ["confirmed", "rejected"] as const;
export type MovementDecisionMobile = (typeof MOVEMENT_DECISIONS_MOBILE)[number];
export type MovementReviewBody = {
  requestId: string;
  windowId: string;
  expectedRevision: number;
  decision: MovementDecisionMobile;
  /** 1–2000 ký tự (bắt buộc) — gửi đúng nhãn chip. */
  notes: string;
};
export type MovementReviewResult = { id: string; revision: number; replayed: boolean };

/** CreateReviewRequestDto: reason 1–2000 ký tự. */
export type MedicalReviewRequestBody = { reason: string };
export type MedicalReviewRequestResult = { id: string; fighterId: string; reason: string; status: "OPEN" | "RESOLVED" | "CANCELLED" | string; requestedAt: string };

/* ── batch42: trạng thái buổi/giáo án, thu hồi giấy phép, kết thúc phân công ── */

/** UpdateSessionStatusDto: cancellationReason (≤500) bắt buộc khi CANCELLED, bị từ chối (422) với trạng thái khác. */
export const SESSION_STATUSES = ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "SKIPPED", "CANCELLED", "ABANDONED"] as const;
export type SessionStatusValue = (typeof SESSION_STATUSES)[number];
export type UpdateSessionStatusBody = { status: SessionStatusValue; cancellationReason?: string };
/** ALLOWED_SESSION_TRANSITIONS (training.constants.ts). */
export const NEXT_SESSION: Partial<Record<SessionStatusValue, readonly SessionStatusValue[]>> = {
  SCHEDULED: ["IN_PROGRESS", "SKIPPED", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "ABANDONED", "CANCELLED"],
};

/** UpdatePlanStatusDto. Máy chủ chỉ cấm COMPLETED/CANCELLED → DRAFT. */
export const PLAN_STATUSES = ["DRAFT", "ACTIVE", "COMPLETED", "CANCELLED"] as const;
export type PlanStatusValue = (typeof PLAN_STATUSES)[number];
export type UpdatePlanStatusBody = { status: PlanStatusValue };
/** Chuyển tiếp hiển thị theo v3 (con của tập máy chủ cho phép). */
export const NEXT_PLAN: Record<PlanStatusValue, readonly PlanStatusValue[]> = {
  DRAFT: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["COMPLETED", "DRAFT", "CANCELLED"],
  COMPLETED: ["ACTIVE"],
  CANCELLED: ["ACTIVE"],
};

/** RevokeClearanceDto: revokedReason bắt buộc, ≤2000. */
export type RevokeClearanceBody = { revokedReason: string };
/** EndCoachAssignmentDto / EndDoctorAssignmentDto: endReason bắt buộc, ≤500. */
export type EndAssignmentBody = { endReason: string };

export type StatusResult = { id: string; status: string };
