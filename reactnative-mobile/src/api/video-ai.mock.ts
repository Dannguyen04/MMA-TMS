import type { WorkerResult } from "@/components/video/pose-model";
import { parseWorkerResult } from "@/components/video/pose-model";

import { ApiError } from "./errors";
import type { VideoStream } from "./media";
import {
  toAiCoachingState,
  toAiHealthAlerts,
  toAiJob,
  toAiMovementReviews,
  toAiVideo,
  type AiCoachingState,
  type AiHealthAlerts,
  type AiJob,
  type AiMovementReviews,
  type AiSessionExercise,
  type AiVideo,
  type AiVideoPage,
  type ListVideosQuery,
  type RawCoachingStateDto,
  type RawHealthAlertsDto,
  type RawJobDto,
  type RawMovementReviewsDto,
  type RawVideoDto,
} from "./video-ai.types";

/**
 * Dữ liệu giả lập cho lớp đọc Video & AI. Kịch bản: `globalThis.__VIDEO_AI_MOCK_SCENARIO__`
 * (hoặc `__COACH_MOCK_SCENARIO__`) = "empty" | "offline" | "slow" | "forbidden".
 * Đủ 4 trạng thái job: cj-1 DONE có cảnh báo (cf-4), cj-2 DONE không cảnh báo, cj-3 PROCESSING, cj-4 FAILED, cj-5 PENDING.
 */
function scenario(): string {
  const g = globalThis as { __VIDEO_AI_MOCK_SCENARIO__?: string; __COACH_MOCK_SCENARIO__?: string };
  return g.__VIDEO_AI_MOCK_SCENARIO__ ?? g.__COACH_MOCK_SCENARIO__ ?? "normal";
}

async function wait(): Promise<void> {
  const s = scenario();
  await new Promise<void>((resolve) => setTimeout(resolve, s === "slow" ? 2500 : 300));
  if (s === "offline") throw new ApiError(0, "NETWORK_ERROR", "Network request failed");
  if (s === "forbidden") throw new ApiError(403, "FORBIDDEN", "Forbidden");
}

const ago = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

const RAW_VIDEOS: RawVideoDto[] = [
  { id: "cv-1", fighterId: "cf-1", sessionId: "cs-1", title: "Đấm đích hiệp 3", trainingType: "PAD_WORK", cameraAngle: "FRONT", status: "READY", durationMs: 102_000, createdAt: ago(3) },
  { id: "cv-2", fighterId: "cf-2", sessionId: null, title: "Đối kháng nhẹ với Bảo", trainingType: "SPARRING", cameraAngle: "SIDE", status: "READY", durationMs: 180_000, createdAt: ago(28) },
  { id: "cv-3", fighterId: "cf-1", sessionId: null, title: "Bao cát 5 hiệp", trainingType: "HEAVY_BAG", cameraAngle: "DIAGONAL", status: "READY", durationMs: 300_000, createdAt: ago(50) },
  { id: "cv-4", fighterId: "cf-4", sessionId: "cs-4", title: "Đấm bóng ma khởi động", trainingType: "SHADOW_BOXING", cameraAngle: "FRONT", status: "READY", durationMs: 95_000, createdAt: ago(98) },
];
const VIDEOS: AiVideo[] = RAW_VIDEOS.map((v) => toAiVideo(v)!);

const RAW_JOBS: RawJobDto[] = [
  { id: "cj-1", status: "DONE", score: 71, fighterId: "cf-4", sessionId: "cs-4", videoId: "cv-4", alertCount: 2, hasImpairment: true, evidenceContext: { exerciseName: "Đấm thẳng" }, createdAt: ago(97), updatedAt: ago(96) },
  { id: "cj-2", status: "DONE", score: 86, fighterId: "cf-1", sessionId: null, videoId: "cv-3", alertCount: 0, hasImpairment: false, createdAt: ago(49), updatedAt: ago(48) },
  { id: "cj-3", status: "PROCESSING", score: null, fighterId: "cf-2", sessionId: null, videoId: "cv-2", alertCount: 0, hasImpairment: false, createdAt: ago(1), updatedAt: ago(0.5) },
  { id: "cj-5", status: "PENDING", score: null, fighterId: "cf-6", sessionId: null, videoId: null, alertCount: 0, hasImpairment: false, createdAt: ago(0.1), updatedAt: ago(0.1) },
  { id: "cj-4", status: "FAILED", score: null, fighterId: "cf-1", sessionId: "cs-1", videoId: "cv-1", alertCount: 0, hasImpairment: false, createdAt: ago(2.5), updatedAt: ago(2) },
];
const JOBS: AiJob[] = RAW_JOBS.map((j) => toAiJob(j)!);

const ALERTS: Record<string, RawHealthAlertsDto> = {
  "cj-1": {
    jobId: "cj-1",
    status: "DONE",
    alertCount: 2,
    hasImpairment: true,
    healthAlerts: [
      { joint: "RIGHT_KNEE", state: "CONFIRMED_IMPAIRMENT", severity: "high", triggerTimeMs: 41_500, windowStartMs: 30_000, consecutiveLowRom: 5, avgRomRatio: 0.58, motionClass: "POWER_STRIKE", recommendation: "Giảm cường độ đá chân phải, theo dõi đau gối sau buổi." },
      { joint: "LEFT_SHOULDER", state: "CONFIRMED_IMPAIRMENT", severity: "medium", triggerTimeMs: 12_200, windowStartMs: 5_000, consecutiveLowRom: 3, avgRomRatio: 0.74, motionClass: "PARTIAL_STRIKE", recommendation: "Khởi động vai kỹ hơn trước khi ra đòn." },
    ],
    jointStates: { RIGHT_KNEE: "CONFIRMED_IMPAIRMENT", LEFT_SHOULDER: "CONFIRMED_IMPAIRMENT", LEFT_KNEE: "HEALTHY" },
  },
};

const STATES: Record<string, RawCoachingStateDto> = {
  "cj-1": {
    jobId: "cj-1",
    videoId: "cv-4",
    fighterId: "cf-4",
    analysisId: "ca-1",
    reviews: [{ id: "fr-1", actionId: "a-3", findingId: "f-1", coachId: "demo-coach", status: "approved", notes: "Đúng, gối phải khuỵu khi đá.", correctedLabel: null, createdAt: ago(90) }],
    corrections: [],
  },
};

const MOVES: RawMovementReviewsDto = {
  jobId: "cj-1",
  canReview: false,
  context: { exerciseName: "Đấm thẳng" },
  reviews: [{ id: "mr-1", windowId: "w-2", reviewerId: "cu-coach", reviewerRole: "COACH", revision: 1, decision: "confirmed", notes: "Tư thế trụ yếu ở hiệp 2.", startMs: 38_000, endMs: 44_000, createdAt: ago(80) }],
};

/** Dữ liệu thô của mock (trước khi chuẩn hoá) để test đối chiếu với swagger. */
/** Phần kết quả worker cho cj-1: phát hiện (cần actionId để HLV duyệt) + đoạn chuyển động. */
/** Khung xương demo (17 điểm COCO, toạ độ chuẩn hoá) cho cj-1: thế thủ, tay trước đưa ra/thu về theo nhịp. */
const DEMO_POSE = [
  [0.5, 0.2], [0.51, 0.19], [0.49, 0.19], [0.53, 0.2], [0.47, 0.2],
  [0.58, 0.28], [0.42, 0.28], [0.62, 0.37], [0.38, 0.36], [0.56, 0.3], [0.44, 0.3],
  [0.56, 0.5], [0.45, 0.5], [0.6, 0.65], [0.42, 0.65], [0.63, 0.8], [0.39, 0.8],
];
const demoFrames = Array.from({ length: 101 }, (_, i) => {
  const reach = Math.abs(Math.sin(i / 6)) * 0.12;
  return {
    timeMs: i * 100,
    observationKind: "fresh_detection",
    landmarks: DEMO_POSE.map(([x, y], k) => ({ x: k === 9 ? x! + reach : k === 7 ? x! + reach / 2 : x!, y: y!, conf: 0.95 })),
  };
});

const RESULTS: Record<string, Record<string, unknown>> = {
  "cj-1": {
    meta: { fps: 30, durationMs: 95_000, imgWidth: 720, imgHeight: 1280 },
    frames: demoFrames,
    findings: [
      { id: "f-1", actionId: "a-3", title: "Tay trước hạ thấp sau cú đấm", description: "Tay trước về thủ chậm ở hiệp 2.", severity: "warning", confidence: 0.82, timeMs: 21_000, recommendation: "Thu tay về cằm ngay sau khi đấm." },
      { id: "f-2", actionId: "a-4", title: "Xoay hông tốt khi đấm thẳng", description: "Lực truyền từ chân lên vai ổn định.", severity: "positive", confidence: 0.9, timeMs: 52_000, recommendation: "" },
    ],
    movementEvidence: {
      status: "review_ready",
      usableFrames: 2700,
      totalFrames: 2850,
      guidance: [],
      windows: [
        { id: "w-1", startMs: 12_000, endMs: 18_000, sampleCount: 180 },
        { id: "w-2", startMs: 38_000, endMs: 44_000, sampleCount: 180 },
      ],
    },
  },
};

export const __fixtures = { RAW_VIDEOS, RAW_JOBS, ALERTS, STATES, MOVES };

function find<T extends { id: string }>(rows: readonly T[], key: string, code: string): T {
  const row = rows.find((r) => r.id === key);
  if (!row) throw new ApiError(404, code, "Not found");
  return row;
}

export const mockVideoAiApi = {
  async listVideos(q: ListVideosQuery = {}): Promise<AiVideoPage> {
    await wait();
    const s = q.search?.trim().toLowerCase();
    const rows =
      scenario() === "empty"
        ? []
        : VIDEOS.filter((v) => (!q.fighterId || v.fighterId === q.fighterId) && (!q.trainingType || v.trainingType === q.trainingType) && (!s || v.title.toLowerCase().includes(s)));
    const start = q.cursor ? Number(q.cursor) || 0 : 0;
    const limit = Math.min(100, Math.max(1, q.limit ?? 50));
    const items = rows.slice(start, start + limit);
    const hasNextPage = start + limit < rows.length;
    return { items, hasNextPage, endCursor: hasNextPage ? String(start + limit) : null, total: rows.length };
  },
  async getVideo(videoId: string): Promise<AiVideo> {
    await wait();
    return find(VIDEOS, videoId, "VIDEO_NOT_FOUND");
  },
  async getVideoStream(videoId: string, _token: string): Promise<VideoStream> {
    await wait();
    find(VIDEOS, videoId, "VIDEO_NOT_FOUND");
    // Bản demo không có luồng phát; ảnh chụp/QA có thể gắn file mẫu theo id video.
    const demo = (globalThis as { __VIDEO_AI_MOCK_STREAMS__?: Record<string, string> }).__VIDEO_AI_MOCK_STREAMS__;
    return { uri: demo?.[videoId] ?? "" };
  },
  async listJobs(): Promise<AiJob[]> {
    await wait();
    return scenario() === "empty" ? [] : [...JOBS];
  },
  async listImpairmentJobs(): Promise<AiJob[]> {
    await wait();
    return scenario() === "empty" ? [] : JOBS.filter((j) => j.hasImpairment);
  },
  async getJob(jobId: string): Promise<AiJob> {
    await wait();
    return find(JOBS, jobId, "JOB_NOT_FOUND");
  },
  async getJobResult(jobId: string, _options: { fresh?: boolean } = {}): Promise<WorkerResult> {
    await wait();
    const job = find(JOBS, jobId, "JOB_NOT_FOUND");
    if (job.status !== "DONE") throw new ApiError(409, "JOB_NOT_COMPLETE", "The analysis result is not ready");
    return parseWorkerResult({ meta: { fps: 30, durationMs: 95_000 }, frames: [], summary: { avgScore: job.score }, ...(RESULTS[jobId] ?? {}) })!;
  },
  async getHealthAlerts(jobId: string): Promise<AiHealthAlerts> {
    await wait();
    const job = find(JOBS, jobId, "JOB_NOT_FOUND");
    return toAiHealthAlerts(ALERTS[jobId] ?? { jobId, status: job.status, alertCount: 0, hasImpairment: false, healthAlerts: [], jointStates: {} }, jobId);
  },
  async getCoachingState(jobId: string): Promise<AiCoachingState> {
    await wait();
    const job = find(JOBS, jobId, "JOB_NOT_FOUND");
    return toAiCoachingState(STATES[jobId] ?? { jobId, videoId: job.videoId, fighterId: job.fighterId, analysisId: null, reviews: [], corrections: [] }, jobId);
  },
  async getMovementReviews(jobId: string): Promise<AiMovementReviews> {
    await wait();
    find(JOBS, jobId, "JOB_NOT_FOUND");
    return toAiMovementReviews(
      jobId === "cj-1"
        ? { jobId, canReview: false, context: { exerciseName: "Đấm thẳng" }, reviews: [{ id: "mr-1", windowId: "w-2", reviewerId: "cu-coach", reviewerRole: "COACH", revision: 1, decision: "confirmed", notes: "Tư thế trụ yếu ở hiệp 2.", startMs: 38_000, endMs: 44_000, createdAt: ago(80) }] }
        : { jobId, canReview: false, context: null, reviews: [] },
      jobId,
    );
  },
  async listSessionExercises(sessionId: string): Promise<AiSessionExercise[]> {
    await wait();
    if (scenario() === "empty") return [];
    return sessionId === "cs-4" ? [{ id: "se-1", exerciseId: "ex-1", name: "Đấm thẳng" }, { id: "se-2", exerciseId: "ex-2", name: "Đá vòng cầu" }] : [];
  },
};
