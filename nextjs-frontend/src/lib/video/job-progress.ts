import { PIPELINE_STAGES } from "@/lib/domain/labels";
import type { AIJob, PipelineStage } from "@/lib/domain/types";
import { routes } from "@/lib/routes";

/** Contract of GET /api/ai-jobs/[jobId], polled while footage is processed. */
export interface AIJobPollResponse {
    job: AIJob;
    videoId: string;
    analysisId: string | null;
}

export const JOB_POLL_INTERVAL_MS = 1500;

export function isJobActive(job: Pick<AIJob, "status">): boolean {
    return job.status === "queued" || job.status === "processing";
}

/** Work stages between the queue and completion, in pipeline order. */
export const WORK_STAGES: PipelineStage[] = PIPELINE_STAGES.filter((stage) => stage !== "queued" && stage !== "done");

export type StageState = "done" | "current" | "pending";

export function stageState(job: Pick<AIJob, "status" | "stage">, stage: PipelineStage): StageState {
    if (job.status === "completed") return "done";
    const current = PIPELINE_STAGES.indexOf(job.stage);
    const index = PIPELINE_STAGES.indexOf(stage);
    if (index < current) return "done";
    if (index === current) return job.status === "failed" ? "pending" : "current";
    return "pending";
}

/**
 * State of one pipeline stage with failures made explicit: the stage a job failed or was cancelled
 * at, and the stages that never ran because of it.
 */
export type DetailedStageState = "done" | "current" | "waiting" | "failed" | "stopped" | "upcoming" | "skipped";

export function detailedStageState(job: Pick<AIJob, "status" | "stage" | "errorCode">, stage: PipelineStage): DetailedStageState {
    if (job.status === "completed") return "done";
    const current = PIPELINE_STAGES.indexOf(job.stage);
    const index = PIPELINE_STAGES.indexOf(stage);
    if (index < current) return "done";
    if (index > current) return job.status === "failed" ? "skipped" : "upcoming";
    if (job.status === "failed") return job.errorCode === "CANCELLED" ? "stopped" : "failed";
    return job.status === "queued" ? "waiting" : "current";
}

/** Where a role opens a video. */
export function videoHrefFor(role: "fighter" | "coach", videoId: string): string {
    return role === "fighter" ? routes.fighter.video(videoId) : routes.coach.video(videoId);
}
