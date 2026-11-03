import { ApiError } from "./errors";

/**
 * Mô hình dữ liệu cho lớp đọc Video & AI (video-ai-v1). Mọi phản hồi đi qua các hàm chuẩn hoá bên dưới:
 * bỏ trường lạ, không giữ URL lưu trữ có chữ ký (`videoUrl`, `resultUrl`, `sourceUrl` của job), số không hợp lệ → null.
 */

export const JOB_STATUSES = ["PENDING", "PROCESSING", "DONE", "FAILED"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOINT_HEALTH_STATES = ["HEALTHY", "SUSPECTED", "SUSPECTED_AVOIDANCE", "CONFIRMED_IMPAIRMENT"] as const;
export type JointHealthState = (typeof JOINT_HEALTH_STATES)[number];

export type FindingDecision = "approved" | "rejected" | "corrected";

/* ---- Hình dạng thô từ backend (trước khi chuẩn hoá); fixture mock phải khớp các kiểu này. ---- */
export const TRAINING_TYPES = ["SHADOW_BOXING", "PAD_WORK", "HEAVY_BAG", "SPARRING"] as const;
export const CAMERA_ANGLES = ["FRONT", "SIDE", "DIAGONAL"] as const;
/** UpdateJobStatusDto.healthAlerts[].severity (schema backend: medium | high | critical). */
export const ALERT_SEVERITIES = ["medium", "high", "critical"] as const;
/** MovementReviewDto.decision. */
export const MOVEMENT_DECISIONS = ["confirmed", "corrected", "rejected"] as const;

export type RawVideoDto = {
  id: string;
  fighterId: string;
  sessionId: string | null;
  title: string;
  description?: string | null;
  trainingType: (typeof TRAINING_TYPES)[number];
  cameraAngle: (typeof CAMERA_ANGLES)[number];
  status: string;
  durationMs: number | null;
  createdAt: string;
};
export type RawJobDto = {
  id: string;
  status: JobStatus;
  /** UpdateJobStatusDto.score: number 0..100. */
  score: number | null;
  fighterId: string | null;
  sessionId: string | null;
  videoId: string | null;
  alertCount: number;
  hasImpairment: boolean;
  evidenceContext?: { exerciseName?: string } | null;
  createdAt: string;
  updatedAt: string;
};
/** Khớp đúng ví dụ UpdateJobStatusDto.healthAlerts trong swagger. */
export type RawHealthAlertDto = {
  joint: string;
  state: JointHealthState;
  severity: (typeof ALERT_SEVERITIES)[number];
  triggerTimeMs: number;
  windowStartMs: number;
  consecutiveLowRom: number;
  avgRomRatio: number;
  motionClass: string;
  recommendation: string;
};
export type RawHealthAlertsDto = { jobId: string; status: JobStatus; alertCount: number; hasImpairment: boolean; healthAlerts: RawHealthAlertDto[]; jointStates: Record<string, JointHealthState> };
export type RawCoachingStateDto = {
  jobId: string;
  videoId: string | null;
  fighterId: string;
  analysisId: string | null;
  reviews: { id: string; actionId: string; findingId: string; coachId: string; status: FindingDecision; notes: string | null; correctedLabel: string | null; createdAt: string }[];
  corrections: { id: string; coachId: string; reviewText: string; techniqueRating: number | null; revision: number | null; createdAt: string }[];
};
/** reviews[] mang các trường của MovementReviewDto (windowId, decision, notes, startMs, endMs) + metadata máy chủ. */
export type RawMovementReviewsDto = {
  jobId: string;
  canReview: boolean;
  context: { exerciseName?: string } | null;
  reviews: { id: string; windowId: string; reviewerId: string; reviewerRole: string; revision: number; decision: (typeof MOVEMENT_DECISIONS)[number]; notes: string; startMs?: number; endMs?: number; createdAt: string }[];
};
export type MovementDecision = "confirmed" | "corrected" | "rejected" | string;

/** GET /videos, GET /videos/:id */
export type AiVideo = {
  id: string;
  fighterId: string;
  sessionId: string | null;
  title: string;
  description: string | null;
  trainingType: string;
  cameraAngle: string;
  status: string;
  durationMs: number | null;
  createdAt: string;
};

export type AiVideoPage = { items: AiVideo[]; hasNextPage: boolean; endCursor: string | null; total: number };

export type ListVideosQuery = { fighterId?: string; trainingType?: string; search?: string; cursor?: string; limit?: number };

/** GET /jobs, /jobs/impairments, /jobs/:id */
export type AiJob = {
  id: string;
  status: JobStatus | string;
  /** Điểm của worker (số nguyên); thang điểm chưa được backend xác nhận. */
  score: number | null;
  fighterId: string | null;
  sessionId: string | null;
  videoId: string | null;
  /** null khi phản hồi không có số; 0 là số thật. */
  alertCount: number | null;
  hasImpairment: boolean;
  /** Tên bài tập (evidenceContext.exerciseName) nếu có. */
  exerciseName: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Một cảnh báo khớp (mirror AlertPayload của worker). */
export type AiHealthAlert = {
  joint: string;
  state: string;
  severity: string;
  triggerTimeMs: number;
  windowStartMs: number | null;
  consecutiveLowRom: number | null;
  avgRomRatio: number | null;
  motionClass: string | null;
  recommendation: string;
};

/** GET /jobs/:id/health-alerts */
export type AiHealthAlerts = {
  jobId: string;
  status: string;
  alertCount: number;
  hasImpairment: boolean;
  alerts: AiHealthAlert[];
  jointStates: Record<string, string>;
};

/** GET /coaching/jobs/:jobId/state */
export type AiCoachingState = {
  jobId: string;
  videoId: string | null;
  fighterId: string;
  analysisId: string | null;
  findingReviews: {
    id: string;
    actionId: string;
    findingId: string;
    coachId: string;
    status: FindingDecision | string;
    notes: string | null;
    correctedLabel: string | null;
    createdAt: string;
  }[];
  corrections: {
    id: string;
    coachId: string;
    reviewText: string;
    techniqueRating: number | null;
    revision: number | null;
    createdAt: string;
  }[];
};

/** GET /movement-evidence/jobs/:jobId/reviews */
export type AiMovementReviews = {
  jobId: string;
  /** Máy chủ trả quyền ghi; mobile chỉ đọc nên chỉ dùng để hiện "Duyệt trên web". */
  canReview: boolean;
  exerciseName: string | null;
  reviews: {
    id: string;
    windowId: string;
    reviewerId: string;
    reviewerRole: string;
    revision: number;
    decision: MovementDecision;
    notes: string;
    startMs: number | null;
    endMs: number | null;
    createdAt: string;
  }[];
};

/** GET /movement-evidence/sessions/:sessionId/exercises */
export type AiSessionExercise = { id: string; exerciseId: string | null; name: string };

// ---------- chuẩn hoá ----------

type Row = Record<string, unknown>;
const obj = (v: unknown): Row | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Row) : null);
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const keep = <T,>(rows: (T | null)[]): T[] => rows.filter((r): r is T => r != null);

export function toAiVideo(raw: unknown): AiVideo | null {
  const r = obj(raw);
  const id = str(r?.id);
  const fighterId = str(r?.fighterId);
  if (!r || !id || !fighterId) return null;
  return {
    id,
    fighterId,
    sessionId: str(r.sessionId),
    title: str(r.title) ?? "",
    description: str(r.description),
    trainingType: str(r.trainingType) ?? "",
    cameraAngle: str(r.cameraAngle) ?? "",
    status: str(r.status) ?? "",
    durationMs: num(r.durationMs),
    createdAt: str(r.createdAt) ?? "",
  };
}

export function toAiVideoPage(raw: unknown): AiVideoPage {
  const r = obj(raw);
  const info = obj(r?.pageInfo);
  const items = keep(list(r?.items).map(toAiVideo));
  return { items, hasNextPage: info?.hasNextPage === true, endCursor: str(info?.endCursor), total: num(r?.total) ?? items.length };
}

export function toAiJob(raw: unknown): AiJob | null {
  const r = obj(raw);
  const id = str(r?.id);
  const status = str(r?.status);
  if (!r || !id || !status) return null;
  return {
    id,
    status,
    score: num(r.score),
    fighterId: str(r.fighterId),
    sessionId: str(r.sessionId),
    videoId: str(r.videoId),
    alertCount: num(r.alertCount),
    hasImpairment: r.hasImpairment === true,
    exerciseName: str(obj(r.evidenceContext)?.exerciseName),
    createdAt: str(r.createdAt) ?? "",
    updatedAt: str(r.updatedAt) ?? "",
  };
}

export function toAiJobs(raw: unknown): AiJob[] {
  return keep(list(raw).map(toAiJob));
}

export function toAiHealthAlert(raw: unknown): AiHealthAlert | null {
  const r = obj(raw);
  const joint = str(r?.joint);
  const t = num(r?.triggerTimeMs);
  if (!r || !joint || t == null) return null;
  return {
    joint,
    state: str(r.state) ?? "",
    severity: str(r.severity) ?? "",
    triggerTimeMs: t,
    windowStartMs: num(r.windowStartMs),
    consecutiveLowRom: num(r.consecutiveLowRom),
    avgRomRatio: num(r.avgRomRatio),
    motionClass: str(r.motionClass),
    recommendation: str(r.recommendation) ?? "",
  };
}

export function toAiHealthAlerts(raw: unknown, jobId: string): AiHealthAlerts {
  const r = obj(raw);
  const alerts = keep(list(r?.healthAlerts).map(toAiHealthAlert)).sort((a, b) => a.triggerTimeMs - b.triggerTimeMs);
  const states: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj(r?.jointStates) ?? {})) if (typeof v === "string") states[k] = v;
  return {
    jobId: str(r?.jobId) ?? jobId,
    status: str(r?.status) ?? "",
    alertCount: num(r?.alertCount) ?? alerts.length,
    hasImpairment: r?.hasImpairment === true,
    alerts,
    jointStates: states,
  };
}

export function toAiCoachingState(raw: unknown, jobId: string): AiCoachingState {
  const r = obj(raw);
  return {
    jobId: str(r?.jobId) ?? jobId,
    videoId: str(r?.videoId),
    fighterId: str(r?.fighterId) ?? "",
    analysisId: str(r?.analysisId),
    findingReviews: keep(
      list(r?.reviews).map((x) => {
        const v = obj(x);
        const id = str(v?.id);
        if (!v || !id) return null;
        return {
          id,
          actionId: str(v.actionId) ?? "",
          findingId: str(v.findingId) ?? "",
          coachId: str(v.coachId) ?? "",
          status: str(v.status) ?? "",
          notes: str(v.notes),
          correctedLabel: str(v.correctedLabel),
          createdAt: str(v.createdAt) ?? "",
        };
      }),
    ),
    corrections: keep(
      list(r?.corrections).map((x) => {
        const v = obj(x);
        const id = str(v?.id);
        if (!v || !id) return null;
        return {
          id,
          coachId: str(v.coachId) ?? "",
          reviewText: str(v.reviewText) ?? "",
          techniqueRating: num(v.techniqueRating),
          revision: num(v.revision),
          createdAt: str(v.createdAt) ?? "",
        };
      }),
    ),
  };
}

export function toAiMovementReviews(raw: unknown, jobId: string): AiMovementReviews {
  const r = obj(raw);
  return {
    jobId: str(r?.jobId) ?? jobId,
    canReview: r?.canReview === true,
    exerciseName: str(obj(r?.context)?.exerciseName),
    reviews: keep(
      list(r?.reviews).map((x) => {
        const v = obj(x);
        const id = str(v?.id);
        if (!v || !id) return null;
        return {
          id,
          windowId: str(v.windowId) ?? "",
          reviewerId: str(v.reviewerId) ?? "",
          reviewerRole: str(v.reviewerRole) ?? "",
          revision: num(v.revision) ?? 1,
          decision: str(v.decision) ?? "",
          notes: str(v.notes) ?? "",
          startMs: num(v.startMs),
          endMs: num(v.endMs),
          createdAt: str(v.createdAt) ?? "",
        };
      }),
    ),
  };
}

export function toAiSessionExercises(raw: unknown): AiSessionExercise[] {
  return keep(
    list(raw).map((x) => {
      const v = obj(x);
      const id = str(v?.id);
      if (!v || !id) return null;
      return { id, exerciseId: str(v.exerciseId), name: str(v.name) ?? "" };
    }),
  );
}

// ---------- quy tắc đọc dùng chung ----------

/** 409 JOB_NOT_COMPLETE từ /jobs/:id/result: đang phân tích, không phải lỗi. */
export function isJobNotComplete(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409 && error.code === "JOB_NOT_COMPLETE";
}

export function isJobRunning(status: string): boolean {
  return status === "PENDING" || status === "PROCESSING";
}

/** Job đã phân tích xong mà HLV chưa có đánh giá nào (chip "Chờ HLV duyệt"). */
export function needsCoachReview(job: Pick<AiJob, "status">, state: Pick<AiCoachingState, "findingReviews" | "corrections"> | null): boolean {
  if (job.status !== "DONE" || !state) return false;
  return state.findingReviews.length === 0 && state.corrections.length === 0;
}

/** /jobs không có tham số lọc trong swagger → lọc trạng thái phía máy, mới nhất trước. */
export function filterJobs(jobs: readonly AiJob[], q: { status?: string; fighterId?: string } = {}): AiJob[] {
  return jobs
    .filter((j) => (!q.status || j.status === q.status) && (!q.fighterId || j.fighterId === q.fighterId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
