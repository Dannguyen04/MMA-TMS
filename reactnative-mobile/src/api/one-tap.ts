import { apiFetch } from "./client";
import { mockOneTapApi } from "./one-tap.mock";
import type { ActiveReference } from "./one-tap.types";

/**
 * Lớp GHI 1 chạm (tách khỏi lớp đọc video-ai). Chỉ các endpoint có trong swagger:
 *
 * | Hàm                         | Endpoint                                              | Vai trò (nestjs-api)                                      |
 * |-----------------------------|-------------------------------------------------------|-----------------------------------------------------------|
 * | reanalyzeVideo              | POST /coaching/videos/:videoId/reanalyze {fighterId}  | FIGHTER (video của mình), COACH (võ sĩ phụ trách), ADMIN  |
 * | reviewFinding               | POST /coaching/findings/review                        | COACH (ADMIN bị 403)                                      |
 * | listActiveReferences (GET)  | GET /coaching/loop-state/:fighterId → activeReferences| FIGHTER (mình), COACH (phụ trách), ADMIN                  |
 * | revokeReference             | POST /coaching/references/revoke                      | COACH (coachId = chính mình), ADMIN                       |
 * | reviewMovement              | POST /movement-evidence/jobs/:jobId/reviews           | COACH, DOCTOR (phụ trách)                                 |
 * | markNotificationRead        | PATCH /notifications/:id/read                         | mọi người dùng đã đăng nhập                               |
 * | createMedicalReviewRequest  | POST /fighters/:id/medical-review-requests {reason}   | quyền fighter.medical_review_request:create (FIGHTER mình)|
 * | updateSessionStatus         | PATCH /training-sessions/:id/status                   | training.session:transition (COACH phụ trách, ADMIN); DOCTOR luôn 403 |
 * | updatePlanStatus            | PATCH /training-plans/:id/status                      | training.plan:transition (COACH phụ trách, ADMIN); DOCTOR luôn 403 |
 * | revokeClearance             | POST /medical-clearances/:id/revoke {revokedReason}   | fighter.medical_clearance:revoke (DOCTOR đang phụ trách)  |
 * | endCoachAssignment          | POST /fighters/:id/coaches/:aid/end {endReason}       | fighter.coach:end (ADMIN)                                 |
 * | endDoctorAssignment         | POST /fighters/:id/doctors/:aid/end {endReason}       | fighter.doctor:end (ADMIN mọi phân công; DOCTOR chỉ của mình) |
 *
 * Mock chỉ bật bằng `EXPO_PUBLIC_ONE_TAP_MOCK === "true"`.
 */
export const USE_MOCK_ONE_TAP = process.env.EXPO_PUBLIC_ONE_TAP_MOCK === "true";

const id = (v: string) => encodeURIComponent(v);
const post = (body: unknown) => ({ method: "POST", body: JSON.stringify(body) }) as const;

export const realOneTapApi: typeof mockOneTapApi = {
  reanalyzeVideo: (videoId, body) => apiFetch(`/coaching/videos/${id(videoId)}/reanalyze`, post(body)),
  reviewFinding: (body) => apiFetch("/coaching/findings/review", post(body)),
  async listActiveReferences(fighterId) {
    const res = await apiFetch<{ activeReferences?: ActiveReference[] }>(`/coaching/loop-state/${id(fighterId)}`, { method: "GET" });
    return (res?.activeReferences ?? []).filter((r) => r && typeof r.id === "string" && r.status === "active");
  },
  revokeReference: (body) => apiFetch("/coaching/references/revoke", post(body)),
  reviewMovement: (jobId, body) => apiFetch(`/movement-evidence/jobs/${id(jobId)}/reviews`, post(body)),
  markNotificationRead: (nid) => apiFetch(`/notifications/${id(nid)}/read`, { method: "PATCH" }),
  createMedicalReviewRequest: (fighterId, body) => apiFetch(`/fighters/${id(fighterId)}/medical-review-requests`, post(body)),
  updateSessionStatus: (sid, body) => apiFetch(`/training-sessions/${id(sid)}/status`, { method: "PATCH", body: JSON.stringify(body) }),
  updatePlanStatus: (pid, body) => apiFetch(`/training-plans/${id(pid)}/status`, { method: "PATCH", body: JSON.stringify(body) }),
  revokeClearance: (cid, body) => apiFetch(`/medical-clearances/${id(cid)}/revoke`, post(body)),
  endCoachAssignment: (fid, aid, body) => apiFetch(`/fighters/${id(fid)}/coaches/${id(aid)}/end`, post(body)),
  endDoctorAssignment: (fid, aid, body) => apiFetch(`/fighters/${id(fid)}/doctors/${id(aid)}/end`, post(body)),
};

export const oneTapApi: typeof mockOneTapApi = USE_MOCK_ONE_TAP ? mockOneTapApi : realOneTapApi;
