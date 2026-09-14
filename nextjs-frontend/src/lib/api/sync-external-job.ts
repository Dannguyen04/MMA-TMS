import "server-only";

import type { AIJob, Video } from "@/lib/domain/types";
import { registerExternalAnalysis, type ExternalJobOutcome } from "@/lib/services/videos";
import { WORK_STAGES } from "@/lib/video/job-progress";
import { clamp } from "@/lib/utils";
import { getJob, JobsApiError } from "./jobs-client";
import { parseWorkerResult } from "./worker-result";

/**
 * Brings a real-pipeline job up to date: asks the NestJS job API for its status and, once the
 * worker is done, downloads the result JSON so it can be mapped and stored as an analysis.
 * Transient API errors leave the job untouched so the next poll can try again.
 */
export async function syncExternalJob(job: AIJob, video: Video): Promise<void> {
    let outcome: ExternalJobOutcome;
    try {
        const external = await getJob(job.id);
        if (external.status === "PENDING") outcome = { status: "queued" };
        else if (external.status === "PROCESSING") outcome = estimateProgress(job, video);
        else if (external.status === "FAILED") {
            outcome = { status: "failed", errorCode: "WORKER_FAILED", errorMessage: "The analysis worker couldn't process this video." };
        } else if (!external.resultUrl) {
            outcome = { status: "failed", errorCode: "RESULT_MISSING", errorMessage: "The worker finished without saving a result." };
        } else {
            const downloaded = await downloadResult(external.resultUrl);
            if (!downloaded) return;
            outcome = downloaded;
        }
    } catch (error) {
        if (error instanceof JobsApiError && error.kind === "not_found") {
            outcome = { status: "failed", errorCode: "JOB_NOT_FOUND", errorMessage: "The analysis service no longer has this job." };
        } else {
            return;
        }
    }
    await registerExternalAnalysis(job.id, outcome);
}

/** The job API reports no stage, so progress is estimated from elapsed time against the clip length. */
function estimateProgress(job: AIJob, video: Video): ExternalJobOutcome {
    const started = Date.parse(job.startedAt ?? new Date().toISOString());
    const expectedMs = Math.max(20_000, video.durationSec * 1500);
    const pct = clamp(((Date.now() - started) / expectedMs) * 100, 5, 95);
    const stage = WORK_STAGES[Math.min(WORK_STAGES.length - 1, Math.floor((pct / 100) * WORK_STAGES.length))];
    return { status: "processing", stage, progressPct: pct };
}

/** Null when the download should simply be retried on the next poll (network hiccup). */
async function downloadResult(resultUrl: string): Promise<ExternalJobOutcome | null> {
    let response: Response;
    try {
        response = await fetch(resultUrl, { cache: "no-store" });
    } catch {
        return null;
    }
    if (!response.ok) {
        return { status: "failed", errorCode: "RESULT_UNAVAILABLE", errorMessage: `The result file couldn't be downloaded (HTTP ${response.status}).` };
    }
    const result = parseWorkerResult(await response.json().catch(() => null));
    if (!result) return { status: "failed", errorCode: "RESULT_UNREADABLE", errorMessage: "The result file isn't in the expected format." };
    return { status: "completed", result, resultUrl };
}
