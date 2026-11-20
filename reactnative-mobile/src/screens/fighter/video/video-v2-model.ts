import type { Href } from "expo-router";

import type { AnalysisJob, VideoRecord } from "@/api/video/media";
import { fighterVideo as t } from "@/i18n/fighter-video";
import { dmLocal, hmLocal } from "@/screens/fighter/health/health-model";
import { formatClock, formatFileSize, trainingLabel, visibleScore, type PickedVideo } from "@/screens/media/video-model";

export const VIDEOS = "/video" as Href;
export const UPLOAD = "/video/tai-len" as Href;
export const videoHref = (id: string) => `/video/${id}` as Href;

export type JobKind = "done" | "wait" | "fail" | "none";
/** The job's state as one of four kinds; an unknown code reads as waiting, never as done. */
export function jobKind(job: Pick<AnalysisJob, "status"> | null): JobKind {
  if (!job) return "none";
  if (job.status === "DONE") return "done";
  if (job.status === "FAILED") return "fail";
  return "wait";
}
export function statusWord(job: Pick<AnalysisJob, "status"> | null): string {
  const kind = jobKind(job);
  if (kind === "done") return t.status.DONE;
  if (kind === "fail") return t.status.FAILED;
  if (kind === "none") return t.status.NONE;
  return job?.status === "PENDING" ? t.status.PENDING : t.status.PROCESSING;
}

/** One list row: the lead is the score when done, a clock while waiting, "!" when failed, "–" without a job. */
export function rowView(video: Pick<VideoRecord, "trainingType" | "createdAt">, job: Pick<AnalysisJob, "status" | "score"> | null) {
  const kind = jobKind(job);
  const score = kind === "done" ? visibleScore(job?.score) : null;
  const word = statusWord(job);
  const rest = [trainingLabel(video.trainingType), dmLocal(video.createdAt)].join(" · ");
  const line = [word, rest].join(" · ");
  return {
    kind,
    score,
    lead: kind === "done" ? (score == null ? "✓" : String(score)) : kind === "fail" ? "!" : kind === "none" ? "–" : undefined,
    leadTone: kind === "done" ? ("ok" as const) : kind === "fail" ? ("warn" as const) : kind === "none" ? ("dim" as const) : undefined,
    line,
    /** Only the status word is coloured (step 25 sweep); `rest` stays ink. */
    word,
    rest,
    lineTone: kind === "done" ? ("ok" as const) : kind === "fail" ? ("warn" as const) : undefined,
  };
}

/** "Bao cát · Góc trước · 10/11 18:30" under the title on the video page. */
export const detailLine = (video: Pick<VideoRecord, "trainingType" | "cameraAngle" | "createdAt">) =>
  [trainingLabel(video.trainingType), t.angle[video.cameraAngle] ?? null, `${dmLocal(video.createdAt)} ${hmLocal(video.createdAt)}`].filter(Boolean).join(" · ");

/** "1:42 · 38 MB" under the picked file name. */
export const pickedLine = (asset: PickedVideo) =>
  [asset.durationMs == null ? null : formatClock(asset.durationMs / 1000), formatFileSize(asset.fileSizeBytes)].filter(Boolean).join(" · ");
