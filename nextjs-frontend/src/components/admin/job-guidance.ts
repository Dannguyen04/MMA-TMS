/** Operator-facing explanation of AI pipeline error codes: what happened and how to fix it. */

import { isAIJobErrorCode, JOB_ERROR_RETRY_HELPS, type AIJobErrorCode } from "@/lib/video/job-errors";

export interface JobGuidance {
    title: string;
    explanation: string;
    suggestedFix: string;
    /** Whether re-queuing the same file is likely to succeed. */
    retryHelps: boolean;
}

type GuidanceText = Omit<JobGuidance, "retryHelps">;

const GUIDANCE: Record<AIJobErrorCode, GuidanceText> = {
    NO_FIGHTER_DETECTED: {
        title: "The fighter wasn't visible for most of the clip",
        explanation: "Fighter detection found a person in too few sampled frames to track movement reliably.",
        suggestedFix: "Ask the uploader to re-record with the full body in frame (camera 3–4 m away at chest height). A retry on the same file will fail the same way.",
    },
    UNSUPPORTED_CODEC: {
        title: "The video encoding isn't supported",
        explanation: "The decoder can't read this codec or bit depth (for example 10-bit HEVC from newer phones).",
        suggestedFix: "Ask the uploader to export as H.264 (8-bit) MP4 and upload again. Consider documenting the recommended camera setting.",
    },
    CORRUPT_CONTAINER: {
        title: "The file is incomplete or damaged",
        explanation: "The container metadata is missing, which usually means the upload was cut off.",
        suggestedFix: "Ask the uploader to upload the original file again on a stable connection.",
    },
    WORKER_TIMEOUT: {
        title: "The worker ran past its time limit",
        explanation: "Processing exceeded the per-job time limit, often on long or high-frame-rate clips or when workers are busy.",
        suggestedFix: "Retry — it usually succeeds when the queue is quieter. If it fails again, ask for a clip under 5 minutes.",
    },
    GPU_WORKER_LOST: {
        title: "The GPU worker went offline",
        explanation: "The worker stopped sending heartbeats mid-job (for example the node was pre-empted or restarted).",
        suggestedFix: "Retry the job. If several jobs fail this way, check the worker pool health.",
    },
    OUT_OF_MEMORY: {
        title: "The worker ran out of GPU memory",
        explanation: "Very high resolution or frame-rate footage needed more memory than the worker had for a pose batch.",
        suggestedFix: "Retry once. If it fails again, ask for 1080p at 30–60 fps, or route 4K footage to a larger worker.",
    },
    CANCELLED: {
        title: "Processing was cancelled",
        explanation: "An administrator stopped this job before it finished. The uploader was notified.",
        suggestedFix: "Retry when you're ready to process the footage.",
    },
    VIDEO_NOT_FOUND: {
        title: "The video was removed during processing",
        explanation: "The footage was deleted before the analysis could be saved.",
        suggestedFix: "No action needed unless the video should be restored — the uploader can upload it again.",
    },
    WORKER_FAILED: {
        title: "The worker reported a failure",
        explanation: "The job API marked the job as failed without a more specific error.",
        suggestedFix: "Retry the job. If it fails again, check the worker logs for this job id.",
    },
    RESULT_MISSING: {
        title: "The worker finished without a result file",
        explanation: "The job completed, but no result URL was stored for it.",
        suggestedFix: "Retry the job. If it repeats, check that the worker can write to result storage.",
    },
    RESULT_UNAVAILABLE: {
        title: "The result file couldn't be downloaded",
        explanation: "The result URL returned an error status when the app fetched it.",
        suggestedFix: "Check the storage bucket and signed-URL expiry, then retry the job.",
    },
    RESULT_UNREADABLE: {
        title: "The result file didn't match the expected schema",
        explanation: "The downloaded JSON failed validation, which usually means the worker and app versions disagree.",
        suggestedFix: "Compare the worker's result schema version with the app before retrying — a retry on the same worker will fail the same way.",
    },
    JOB_NOT_FOUND: {
        title: "The job API no longer has this job",
        explanation: "The analysis service returned not found for this job id, for example after a queue reset.",
        suggestedFix: "Retry to create a new job for the same footage.",
    },
};

const FALLBACK: JobGuidance = {
    title: "The analysis didn't finish",
    explanation: "The pipeline reported an error it doesn't have specific guidance for.",
    suggestedFix: "Retry the job. If it keeps failing, check the worker logs for this job id.",
    retryHelps: true,
};

export function jobGuidance(errorCode: string | null): JobGuidance {
    if (!isAIJobErrorCode(errorCode)) return FALLBACK;
    return { ...GUIDANCE[errorCode], retryHelps: JOB_ERROR_RETRY_HELPS[errorCode] };
}
