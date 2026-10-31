import { ApiError } from "./errors";
import type {
  ActiveReference,
  MedicalReviewRequestBody,
  MedicalReviewRequestResult,
  MovementReviewBody,
  MovementReviewResult,
  ReanalyzeBody,
  ReanalyzeResult,
  ReviewFindingBody,
  RevokeReferenceBody,
  EndAssignmentBody,
  RevokeClearanceBody,
  StatusResult,
  UpdatePlanStatusBody,
  UpdateSessionStatusBody,
} from "./one-tap.types";

/**
 * Giả lập thao tác ghi 1 chạm. Kịch bản: `globalThis.__ONE_TAP_MOCK_SCENARIO__` = "forbidden" | "offline" | "slow" | "conflict"
 * | "medical" (409 TRAINING_MEDICAL_ELIGIBILITY_REQUIRED khi bắt đầu buổi).
 * Chỉ bật bằng EXPO_PUBLIC_ONE_TAP_MOCK=true.
 */
function scenario(): string {
  return (globalThis as { __ONE_TAP_MOCK_SCENARIO__?: string }).__ONE_TAP_MOCK_SCENARIO__ ?? "normal";
}
async function wait(): Promise<void> {
  const s = scenario();
  await new Promise<void>((r) => setTimeout(r, s === "slow" ? 60_000 : 400));
  if (s === "offline") throw new ApiError(0, "NETWORK_ERROR", "Network request failed");
  if (s === "forbidden") throw new ApiError(403, "FORBIDDEN", "Forbidden");
  if (s === "conflict") throw new ApiError(409, "SESSION_STATE_CONFLICT", "Conflict");
}

const REFERENCES: ActiveReference[] = [
  { id: "ref-1", fighterId: "cf-4", technique: "jab", actionId: "a-3", videoId: "cv-4", sessionId: "cs-4", status: "active", createdAt: "2026-10-16T03:00:00.000Z" },
];

export const mockOneTapApi = {
  async reanalyzeVideo(videoId: string, body: ReanalyzeBody): Promise<ReanalyzeResult> {
    await wait();
    void body;
    return { reanalysis: true, jobId: "cj-5", analysisId: `ca-${videoId}-r`, newVideoId: videoId, status: "QUEUED" };
  },
  async reviewFinding(body: ReviewFindingBody): Promise<{ id: string }> {
    await wait();
    return { id: `fr-${body.findingId}-${Date.now()}` };
  },
  async listActiveReferences(fighterId: string): Promise<ActiveReference[]> {
    await new Promise<void>((r) => setTimeout(r, 200));
    return REFERENCES.filter((r) => r.fighterId === fighterId && r.status === "active");
  },
  async revokeReference(body: RevokeReferenceBody): Promise<{ id: string }> {
    await wait();
    const r = REFERENCES.find((x) => x.id === body.referenceId);
    if (r) r.status = "revoked";
    return { id: body.referenceId };
  },
  async reviewMovement(jobId: string, body: MovementReviewBody): Promise<MovementReviewResult> {
    await wait();
    void jobId;
    return { id: `mr-${body.requestId}`, revision: body.expectedRevision + 1, replayed: false };
  },
  async markNotificationRead(id: string): Promise<{ id: string; isRead: true }> {
    await wait();
    return { id, isRead: true };
  },
  async createMedicalReviewRequest(fighterId: string, body: MedicalReviewRequestBody): Promise<MedicalReviewRequestResult> {
    await wait();
    return { id: `rr-${Date.now()}`, fighterId, reason: body.reason, status: "OPEN", requestedAt: new Date().toISOString() };
  },
  async updateSessionStatus(id: string, body: UpdateSessionStatusBody): Promise<StatusResult> {
    if (scenario() === "medical" && body.status === "IN_PROGRESS") {
      await new Promise<void>((r) => setTimeout(r, 400));
      throw new ApiError(409, "TRAINING_MEDICAL_ELIGIBILITY_REQUIRED", "Not eligible", { reasons: ["REVIEW_REQUEST_PENDING", "CLEARANCE_EXPIRED"] });
    }
    await wait();
    return { id, status: body.status };
  },
  async updatePlanStatus(id: string, body: UpdatePlanStatusBody): Promise<StatusResult> {
    await wait();
    return { id, status: body.status };
  },
  async revokeClearance(id: string, body: RevokeClearanceBody): Promise<{ id: string; revokedReason: string }> {
    await wait();
    return { id, revokedReason: body.revokedReason };
  },
  async endCoachAssignment(fighterId: string, assignmentId: string, body: EndAssignmentBody): Promise<{ id: string; endReason: string }> {
    await wait();
    void fighterId;
    return { id: assignmentId, endReason: body.endReason };
  },
  async endDoctorAssignment(fighterId: string, assignmentId: string, body: EndAssignmentBody): Promise<{ id: string; endReason: string }> {
    await wait();
    void fighterId;
    return { id: assignmentId, endReason: body.endReason };
  },
};
