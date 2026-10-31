import { apiFetch } from "./client";
import { withQuery } from "./query";

/** Matches `UploadVideoQueryDto` / `ListVideosQueryDto` on `VideosController`. */
export const VIDEO_TRAINING_TYPES = [
  "SHADOW_BOXING",
  "PAD_WORK",
  "HEAVY_BAG",
  "SPARRING",
] as const;

export const VIDEO_CAMERA_ANGLES = ["FRONT", "SIDE", "DIAGONAL"] as const;

export const ANALYSIS_JOB_STATUSES = ["PENDING", "PROCESSING", "DONE", "FAILED"] as const;

export type VideoTrainingType = (typeof VIDEO_TRAINING_TYPES)[number];
export type VideoCameraAngle = (typeof VIDEO_CAMERA_ANGLES)[number];
export type AnalysisJobStatus = (typeof ANALYSIS_JOB_STATUSES)[number];

export type VideoRecord = {
  id: string;
  fighterId: string;
  uploadedById: string;
  sessionId: string | null;
  title: string;
  description: string | null;
  trainingType: string;
  cameraAngle: string;
  status: string;
  originalFilename: string;
  fileSizeBytes: number;
  mimeType: string;
  durationMs: number;
  sourceUrl: string;
  createdAt: string;
  updatedAt: string;
};

export type VideoPage = {
  items: VideoRecord[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  total: number;
};

/** Signed storage URLs are omitted so the UI cannot render a token. */
export type AnalysisJob = {
  id: string;
  status: string;
  score: number | null;
  fighterId: string | null;
  sessionId: string | null;
  videoId: string | null;
  /** Null when the payload omitted the count. Zero is a real count, not a fallback. */
  alertCount: number | null;
  hasImpairment: boolean;
  createdAt: string;
  updatedAt: string;
};

export type HealthAlert = {
  joint: string;
  state: string;
  severity: string;
  triggerTimeMs: number;
  windowStartMs: number;
  consecutiveLowRom: number;
  avgRomRatio: number;
  motionClass: string;
  recommendation: string;
};

export type JobHealthAlerts = {
  jobId: string;
  status: string;
  alertCount: number;
  hasImpairment: boolean;
  healthAlerts: HealthAlert[];
  jointStates: Record<string, unknown>;
};

export type UploadVideoInput = {
  fighterId: string;
  title: string;
  description?: string;
  trainingType: VideoTrainingType;
  cameraAngle: VideoCameraAngle;
  sessionId?: string;
  durationMs: number;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  body: Blob;
};

const ALLOWED_VIDEO_MIME = new Set(["video/mp4", "video/quicktime", "video/webm"]);

export function videoListPath(query?: {
  fighterId?: string;
  trainingType?: VideoTrainingType;
  search?: string;
  cursor?: string;
  limit?: number;
}): string {
  return withQuery("/videos", query);
}

export function listVideos(query?: {
  fighterId?: string;
  trainingType?: VideoTrainingType;
  search?: string;
  cursor?: string;
  limit?: number;
}) {
  return apiFetch<VideoPage>(videoListPath(query));
}

export function getVideo(videoId: string) {
  return apiFetch<VideoRecord>(`/videos/${videoId}`);
}

export function uploadVideo(input: UploadVideoInput, signal?: AbortSignal) {
  return apiFetch<VideoRecord>(
    withQuery("/videos/upload", {
      fighterId: input.fighterId,
      title: input.title,
      description: input.description,
      trainingType: input.trainingType,
      cameraAngle: input.cameraAngle,
      sessionId: input.sessionId,
      durationMs: input.durationMs,
      originalFilename: input.originalFilename,
    }),
    {
      method: "POST",
      signal,
      headers: {
        "Content-Type": input.mimeType,
        "Content-Length": String(input.fileSizeBytes),
      },
      body: input.body,
    },
  );
}

export function isSupportedVideoMime(mimeType: string): boolean {
  return ALLOWED_VIDEO_MIME.has(mimeType.toLowerCase());
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Drops `videoUrl` and `resultUrl`, which can carry signed storage credentials. */
export function toAnalysisJob(raw: unknown): AnalysisJob | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = asString(row.id);
  const status = asString(row.status);
  if (!id || !status) return null;
  return {
    id,
    status,
    score: asNumber(row.score),
    fighterId: asString(row.fighterId),
    sessionId: asString(row.sessionId),
    videoId: asString(row.videoId),
    alertCount: asNumber(row.alertCount),
    hasImpairment: row.hasImpairment === true,
    createdAt: asString(row.createdAt) ?? "",
    updatedAt: asString(row.updatedAt) ?? "",
  };
}

export async function listAnalysisJobs(): Promise<AnalysisJob[]> {
  const rows = await apiFetch<unknown[]>("/jobs");
  return rows.map(toAnalysisJob).filter((job): job is AnalysisJob => job != null);
}

export async function listImpairmentJobs(): Promise<AnalysisJob[]> {
  const rows = await apiFetch<unknown[]>("/jobs/impairments");
  return rows.map(toAnalysisJob).filter((job): job is AnalysisJob => job != null);
}

export async function getAnalysisJob(jobId: string): Promise<AnalysisJob> {
  const row = await apiFetch<unknown>(`/jobs/${jobId}`);
  const job = toAnalysisJob(row);
  if (!job) {
    throw new Error("JOB_SHAPE");
  }
  return job;
}

export function createAnalysisJob(videoId: string) {
  return apiFetch<{ jobId: string; status: string }>("/jobs", {
    method: "POST",
    body: JSON.stringify({ videoId }),
  });
}

export function getJobHealthAlerts(jobId: string) {
  return apiFetch<JobHealthAlerts>(`/jobs/${jobId}/health-alerts`);
}
