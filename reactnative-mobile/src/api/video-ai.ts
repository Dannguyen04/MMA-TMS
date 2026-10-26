import { apiFetch } from "./client";
import { getJobResult } from "./evidence";
import { resolveVideoStream, type VideoStream } from "./media";
import { withQuery } from "./query";
import { mockVideoAiApi } from "./video-ai.mock";
import {
  toAiCoachingState,
  toAiHealthAlerts,
  toAiJob,
  toAiJobs,
  toAiMovementReviews,
  toAiSessionExercises,
  toAiVideo,
  toAiVideoPage,
  type AiJob,
  type AiVideo,
} from "./video-ai.types";

/**
 * Lớp ĐỌC Video & AI (design/video-ai-v1.md). Chỉ GET (và HEAD cho /videos/:id/content để lấy URL phát);
 * không có POST/PATCH/DELETE — thao tác ghi làm trên web.
 *
 * | Hàm                  | Endpoint                                         | Vai trò được đọc (nestjs-api)                         |
 * |----------------------|--------------------------------------------------|-------------------------------------------------------|
 * | listVideos           | GET /videos                                      | FIGHTER, COACH, DOCTOR, ADMIN (lọc theo phạm vi)       |
 * | getVideo             | GET /videos/:id                                  | FIGHTER, COACH, DOCTOR, ADMIN                          |
 * | getVideoStream       | GET /videos/:id/content (307 → URL ký 300 giây)  | FIGHTER, COACH, DOCTOR, ADMIN                          |
 * | listJobs             | GET /jobs (tối đa 100, mới nhất trước)           | FIGHTER, COACH, DOCTOR, ADMIN                          |
 * | listImpairmentJobs   | GET /jobs/impairments (tối đa 50)                | FIGHTER, COACH, DOCTOR, ADMIN                          |
 * | getJob               | GET /jobs/:id                                    | FIGHTER, COACH, DOCTOR, ADMIN                          |
 * | getJobResult         | GET /jobs/:id/result (409 JOB_NOT_COMPLETE)      | FIGHTER, COACH, DOCTOR, ADMIN                          |
 * | getHealthAlerts      | GET /jobs/:id/health-alerts                      | FIGHTER, COACH, DOCTOR, ADMIN                          |
 * | getCoachingState     | GET /coaching/jobs/:jobId/state                  | FIGHTER, COACH, ADMIN (không có DOCTOR)                |
 * | getMovementReviews   | GET /movement-evidence/jobs/:jobId/reviews       | quyền movement.evidence:read (FIGHTER, COACH, DOCTOR, ADMIN) |
 * | listSessionExercises | GET /movement-evidence/sessions/:id/exercises    | quyền movement.evidence:read                           |
 *
 * `EXPO_PUBLIC_VIDEO_AI_MOCK=true` (hoặc một trong các cờ mock theo vai trò) chuyển sang dữ liệu giả lập.
 */
/** Chỉ bật khi EXPO_PUBLIC_VIDEO_AI_MOCK === "true" (không kế thừa cờ mock Coach/Doctor/Admin). Mặc định gọi API thật. */
export const USE_MOCK_VIDEO_AI = process.env.EXPO_PUBLIC_VIDEO_AI_MOCK === "true";

const id = (v: string) => encodeURIComponent(v);
const GET = { method: "GET" } as const;

export const realVideoAiApi: typeof mockVideoAiApi = {
  async listVideos(q = {}) {
    const limit = q.limit == null ? undefined : Math.min(100, Math.max(1, Math.floor(q.limit)));
    return toAiVideoPage(await apiFetch<unknown>(withQuery("/videos", { ...q, limit }), GET));
  },
  async getVideo(videoId) {
    const v = toAiVideo(await apiFetch<unknown>(`/videos/${id(videoId)}`, GET));
    if (!v) throw new Error("VIDEO_SHAPE");
    return v;
  },
  getVideoStream: (videoId, token): Promise<VideoStream> => resolveVideoStream(`/videos/${id(videoId)}/content`, token),
  async listJobs() {
    return toAiJobs(await apiFetch<unknown>("/jobs", GET));
  },
  async listImpairmentJobs() {
    return toAiJobs(await apiFetch<unknown>("/jobs/impairments", GET));
  },
  async getJob(jobId) {
    const j = toAiJob(await apiFetch<unknown>(`/jobs/${id(jobId)}`, GET));
    if (!j) throw new Error("JOB_SHAPE");
    return j;
  },
  getJobResult: (jobId, options) => getJobResult(jobId, options),
  async getHealthAlerts(jobId) {
    return toAiHealthAlerts(await apiFetch<unknown>(`/jobs/${id(jobId)}/health-alerts`, GET), jobId);
  },
  async getCoachingState(jobId) {
    return toAiCoachingState(await apiFetch<unknown>(`/coaching/jobs/${id(jobId)}/state`, GET), jobId);
  },
  async getMovementReviews(jobId) {
    return toAiMovementReviews(await apiFetch<unknown>(`/movement-evidence/jobs/${id(jobId)}/reviews`, GET), jobId);
  },
  async listSessionExercises(sessionId) {
    return toAiSessionExercises(await apiFetch<unknown>(`/movement-evidence/sessions/${id(sessionId)}/exercises`, GET));
  },
};

export const videoAiApi: typeof mockVideoAiApi = USE_MOCK_VIDEO_AI ? mockVideoAiApi : realVideoAiApi;

export type { AiJob, AiVideo };
