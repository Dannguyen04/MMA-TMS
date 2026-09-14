/** Plain-language explanation of pipeline failures, with what the user can do about them. */

import { isAIJobErrorCode, JOB_ERROR_RETRY_HELPS, type AIJobErrorCode } from "@/lib/video/job-errors";

export interface JobFailureCopy {
    title: string;
    explanation: string;
    guidance: string;
    /** Whether re-running the same file is likely to work. */
    retryHelps: boolean;
}

type FailureText = Omit<JobFailureCopy, "retryHelps">;

const FAILURES: Record<AIJobErrorCode, FailureText> = {
    NO_FIGHTER_DETECTED: {
        title: "The fighter couldn't be found in the video",
        explanation: "The AI only saw a person in a small part of the clip, so it couldn't follow the movement.",
        guidance: "Keep the full body in frame — prop the phone 3–4 m away at chest height and record again.",
    },
    UNSUPPORTED_CODEC: {
        title: "This video format can't be decoded",
        explanation: "The file uses a video encoding the analysis server doesn't support (for example 10-bit HEVC).",
        guidance: "Export the clip as H.264 (8-bit) MP4 — most phones call this “Most compatible” — and upload it again.",
    },
    CORRUPT_CONTAINER: {
        title: "The file appears to be incomplete",
        explanation: "The upload may have been cut off, so the video can't be read to the end.",
        guidance: "Upload the original file again on a stable connection.",
    },
    WORKER_TIMEOUT: {
        title: "Processing took too long",
        explanation: "The analysis server stopped before finishing this clip.",
        guidance: "Retrying usually works. If it fails again, trim the clip to under 5 minutes.",
    },
    GPU_WORKER_LOST: {
        title: "The analysis server was interrupted",
        explanation: "The machine processing this clip went offline part-way through.",
        guidance: "Nothing is wrong with your video — retry the analysis.",
    },
    OUT_OF_MEMORY: {
        title: "The video was too heavy to process",
        explanation: "Very high resolution or frame rate footage used more memory than the server had.",
        guidance: "Retry, or record at 1080p / 30–60 fps for faster, more reliable analysis.",
    },
    CANCELLED: {
        title: "Processing was cancelled",
        explanation: "An administrator stopped the analysis before it finished.",
        guidance: "Retry the analysis when you're ready.",
    },
    VIDEO_NOT_FOUND: {
        title: "The video was removed during processing",
        explanation: "The footage was deleted before the analysis could be saved.",
        guidance: "Upload the clip again if you still want it analysed.",
    },
    WORKER_FAILED: {
        title: "The analysis server couldn't process this video",
        explanation: "The server reported an error while analysing the clip.",
        guidance: "Retry the analysis. If it fails again, upload the video again or contact your administrator.",
    },
    RESULT_MISSING: {
        title: "The analysis finished without results",
        explanation: "Processing completed, but the results weren't saved.",
        guidance: "Retry the analysis — nothing is wrong with your video.",
    },
    RESULT_UNAVAILABLE: {
        title: "The results couldn't be downloaded",
        explanation: "The analysis finished, but its results couldn't be fetched from storage.",
        guidance: "Retry the analysis in a few minutes.",
    },
    RESULT_UNREADABLE: {
        title: "The results couldn't be read",
        explanation: "The analysis finished, but its results weren't in a format this app understands.",
        guidance: "Contact your administrator — retrying the same file is unlikely to help.",
    },
    JOB_NOT_FOUND: {
        title: "The analysis was lost",
        explanation: "The analysis service no longer has a record of this job.",
        guidance: "Retry the analysis to start it again.",
    },
};

const DEFAULT_FAILURE: JobFailureCopy = {
    title: "AI analysis didn't finish",
    explanation: "Something went wrong while the footage was being analysed.",
    guidance: "Retry the analysis. If it keeps failing, upload the video again or contact your administrator.",
    retryHelps: true,
};

export function describeJobFailure(errorCode: string | null): JobFailureCopy {
    if (!isAIJobErrorCode(errorCode)) return DEFAULT_FAILURE;
    return { ...FAILURES[errorCode], retryHelps: JOB_ERROR_RETRY_HELPS[errorCode] };
}
