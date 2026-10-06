import type { AnalysisJob, VideoCameraAngle, VideoRecord, VideoTrainingType } from "@/api/media";
import { media } from "@/i18n/media";
import { uploadIssue, type UploadDraft, type UploadIssue } from "@/screens/media/upload-rules";

/** Demo/test order only. The screens load `GET /videos` and never render this list. */
export const VIDEO_LIST_FIXTURE = [
  {
    id: "fixture-heavy-bag-plain",
    title: "Heavy bag",
    createdAt: "2026-09-29T02:00:00.000Z",
    trainingType: "HEAVY_BAG",
    cameraAngle: "SIDE",
    analysisStatus: "DONE",
    score: null,
  },
  {
    id: "fixture-shadow-plain",
    title: "Shadow boxing",
    createdAt: "2026-09-29T02:00:00.000Z",
    trainingType: "SHADOW_BOXING",
    cameraAngle: "SIDE",
    analysisStatus: "DONE",
    score: null,
  },
  {
    id: "fixture-shadow-failed",
    title: "Shadow boxing",
    createdAt: "2026-09-29T02:00:00.000Z",
    trainingType: "SHADOW_BOXING",
    cameraAngle: "SIDE",
    analysisStatus: "FAILED",
    score: null,
  },
  {
    id: "fixture-heavy-bag-scored",
    title: "Heavy bag",
    createdAt: "2026-09-29T02:00:00.000Z",
    trainingType: "HEAVY_BAG",
    cameraAngle: "SIDE",
    analysisStatus: "DONE",
    score: 70,
  },
] as const;

/**
 * Detail reference from the design. Same title as fixture rows 1 and 4,
 * different id, processing PROCESSED, analysis done, zero warnings, no score.
 */
export const REFERENCED_VIDEO_DETAIL = {
  id: "referenced-heavy-bag",
  title: "Heavy bag",
  createdAt: "2026-09-29T02:00:00.000Z",
  trainingType: "HEAVY_BAG",
  cameraAngle: "SIDE",
  processingStatus: "PROCESSED",
  analysisStatus: "DONE",
  alertCount: 0,
  score: null,
} as const;

export type LibraryPhase = "loading" | "error" | "empty" | "data";

export function libraryPhase(input: {
  loading: boolean;
  error: string;
  items: unknown[] | null;
}): LibraryPhase {
  if (input.error && input.items == null) return "error";
  if (input.loading && input.items == null) return "loading";
  if (input.items && input.items.length === 0) return "empty";
  if (input.items && input.items.length > 0) return "data";
  return "loading";
}

export function formatVideoDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).formatToParts(date);
  const day = parts.find((part) => part.type === "day")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const year = parts.find((part) => part.type === "year")?.value;
  if (!day || !month || !year) return "";
  return `${Number(day)} tháng ${Number(month)}, ${year}`;
}

export function trainingLabel(value: string): string {
  return media.training[value as keyof typeof media.training] ?? value;
}

export function angleLabel(value: string): string {
  return media.angle[value as keyof typeof media.angle] ?? value;
}

export function anglePhrase(value: string): string {
  return media.anglePhrase[value as keyof typeof media.anglePhrase] ?? value;
}

export function videoCountLabel(count: number): string {
  return `${count} video`;
}

export type StatusTone = "success" | "danger" | "neutral";

export type StatusBadge = {
  label: string;
  tone: StatusTone;
};

const JOB_TONE: Record<string, StatusTone> = {
  DONE: "success",
  FAILED: "danger",
  PENDING: "neutral",
  PROCESSING: "neutral",
};

export function analysisBadge(status: string): StatusBadge {
  const known = media.job[status as keyof typeof media.job];
  return {
    label: known ?? status,
    tone: JOB_TONE[status] ?? "neutral",
  };
}

export function videoProcessingBadge(status: string): StatusBadge {
  const known = media.videoStatus[status as keyof typeof media.videoStatus];
  const tone: StatusTone = status === "FAILED" || status === "REJECTED" ? "danger" : "neutral";
  return { label: known ?? status, tone };
}

/** Analysis job wins when one exists. A processed file without a job is not "Xong". */
export function listBadge(
  videoStatus: string,
  job: Pick<AnalysisJob, "status"> | null,
): StatusBadge {
  if (job) return analysisBadge(job.status);
  return videoProcessingBadge(videoStatus);
}

export function visibleScore(score: number | null | undefined): number | null {
  return typeof score === "number" && Number.isFinite(score) ? score : null;
}

export function jobForVideo(jobs: AnalysisJob[], videoId: string): AnalysisJob | null {
  const matches = jobs.filter((job) => job.videoId === videoId);
  if (matches.length === 0) return null;
  return [...matches].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
}

export function recordById<T extends { id: string }>(rows: readonly T[], id: string): T | null {
  return rows.find((row) => row.id === id) ?? null;
}

export function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  const minutes = Math.floor(whole / 60);
  const remain = whole % 60;
  return `${minutes}:${String(remain).padStart(2, "0")}`;
}

export function formatFileSize(bytes: number | null): string | null {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type MediaPhase = "loading" | "ready" | "error" | "unavailable";

export type AnalysisPanel = {
  status: StatusBadge | null;
  /** Null means the server omitted the count. Zero is shown as zero. */
  alertCount: number | null;
  score: number | null;
  missing: boolean;
};

export function analysisPanel(job: Pick<AnalysisJob, "status" | "alertCount" | "score"> | null): AnalysisPanel {
  if (!job) {
    return { status: null, alertCount: null, score: null, missing: true };
  }
  return {
    status: analysisBadge(job.status),
    alertCount: job.alertCount,
    score: visibleScore(job.score),
    missing: false,
  };
}

export function warningText(count: number | null): string {
  return count == null ? media.warningsMissing : String(count);
}

export type PickedVideo = {
  uri: string;
  filename: string;
  mimeType: string | null;
  durationMs: number | null;
  fileSizeBytes: number | null;
};

export type UploadPhase = "editing" | "sending" | "failed" | "sent";

export type UploadFormState = {
  title: string;
  description: string;
  trainingType: VideoTrainingType | null;
  cameraAngle: VideoCameraAngle | null;
  asset: PickedVideo | null;
  error: string;
  phase: UploadPhase;
  /** Upload confirmation never means the analysis job finished. */
  analysisComplete: false;
};

export const initialUploadForm = (): UploadFormState => ({
  title: "",
  description: "",
  trainingType: null,
  cameraAngle: null,
  asset: null,
  error: "",
  phase: "editing",
  analysisComplete: false,
});

export type UploadFormAction =
  | { type: "title"; value: string }
  | { type: "description"; value: string }
  | { type: "trainingType"; value: VideoTrainingType }
  | { type: "cameraAngle"; value: VideoCameraAngle }
  | { type: "pickCanceled" }
  | { type: "permissionDenied" }
  | { type: "pickerMissing" }
  | { type: "fileSelected"; asset: PickedVideo }
  | { type: "invalid"; error: string }
  | { type: "submitStart" }
  | { type: "submitFailure"; error: string }
  | { type: "submitSuccess" }
  | { type: "appearanceChanged" };

export function uploadDraft(state: UploadFormState): UploadDraft {
  return {
    title: state.title,
    trainingType: state.trainingType,
    cameraAngle: state.cameraAngle,
    durationMs: state.asset?.durationMs ?? null,
    fileSizeBytes: state.asset?.fileSizeBytes ?? null,
    mimeType: state.asset?.mimeType ?? null,
    filename: state.asset?.filename ?? null,
  };
}

export function uploadBlocker(state: UploadFormState): UploadIssue | null {
  return uploadIssue(uploadDraft(state));
}

export function uploadFormReducer(state: UploadFormState, action: UploadFormAction): UploadFormState {
  switch (action.type) {
    case "title":
      return { ...state, title: action.value };
    case "description":
      return { ...state, description: action.value };
    case "trainingType":
      return { ...state, trainingType: action.value };
    case "cameraAngle":
      return { ...state, cameraAngle: action.value };
    case "pickCanceled":
      return state;
    case "permissionDenied":
      return { ...state, error: media.permissionDenied };
    case "pickerMissing":
      return { ...state, error: media.pickerMissing };
    case "fileSelected":
      return { ...state, asset: action.asset, error: "" };
    case "invalid":
      return { ...state, error: action.error };
    case "submitStart":
      if (state.phase === "sending") return state;
      return { ...state, phase: "sending", error: "" };
    case "submitFailure":
      return { ...state, phase: "failed", error: action.error };
    case "submitSuccess":
      return { ...state, phase: "sent", error: "", analysisComplete: false };
    case "appearanceChanged":
      return state;
    default:
      return state;
  }
}

export function listMeta(video: Pick<VideoRecord, "trainingType" | "cameraAngle">): string {
  return `${trainingLabel(video.trainingType)} · ${anglePhrase(video.cameraAngle)}`;
}
