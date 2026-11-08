/** Operator-facing explanation of AI pipeline error codes, looked up through the locale dictionaries. */

import type { MessageKey, Translator } from "@/lib/i18n/translate";
import { isAIJobErrorCode, JOB_ERROR_RETRY_HELPS, type AIJobErrorCode } from "@/lib/video/job-errors";

export interface JobGuidance {
    title: string;
    explanation: string;
    suggestedFix: string;
    /** Whether re-queuing the same file is likely to succeed. */
    retryHelps: boolean;
}

const GUIDE_KEYS: Record<AIJobErrorCode | "FALLBACK", { title: MessageKey; text: MessageKey; fix: MessageKey }> = {
    NO_FIGHTER_DETECTED: { title: "adminBody.guide.NO_FIGHTER_DETECTED.title", text: "adminBody.guide.NO_FIGHTER_DETECTED.text", fix: "adminBody.guide.NO_FIGHTER_DETECTED.fix" },
    UNSUPPORTED_CODEC: { title: "adminBody.guide.UNSUPPORTED_CODEC.title", text: "adminBody.guide.UNSUPPORTED_CODEC.text", fix: "adminBody.guide.UNSUPPORTED_CODEC.fix" },
    CORRUPT_CONTAINER: { title: "adminBody.guide.CORRUPT_CONTAINER.title", text: "adminBody.guide.CORRUPT_CONTAINER.text", fix: "adminBody.guide.CORRUPT_CONTAINER.fix" },
    WORKER_TIMEOUT: { title: "adminBody.guide.WORKER_TIMEOUT.title", text: "adminBody.guide.WORKER_TIMEOUT.text", fix: "adminBody.guide.WORKER_TIMEOUT.fix" },
    GPU_WORKER_LOST: { title: "adminBody.guide.GPU_WORKER_LOST.title", text: "adminBody.guide.GPU_WORKER_LOST.text", fix: "adminBody.guide.GPU_WORKER_LOST.fix" },
    OUT_OF_MEMORY: { title: "adminBody.guide.OUT_OF_MEMORY.title", text: "adminBody.guide.OUT_OF_MEMORY.text", fix: "adminBody.guide.OUT_OF_MEMORY.fix" },
    CANCELLED: { title: "adminBody.guide.CANCELLED.title", text: "adminBody.guide.CANCELLED.text", fix: "adminBody.guide.CANCELLED.fix" },
    VIDEO_NOT_FOUND: { title: "adminBody.guide.VIDEO_NOT_FOUND.title", text: "adminBody.guide.VIDEO_NOT_FOUND.text", fix: "adminBody.guide.VIDEO_NOT_FOUND.fix" },
    WORKER_FAILED: { title: "adminBody.guide.WORKER_FAILED.title", text: "adminBody.guide.WORKER_FAILED.text", fix: "adminBody.guide.WORKER_FAILED.fix" },
    RESULT_MISSING: { title: "adminBody.guide.RESULT_MISSING.title", text: "adminBody.guide.RESULT_MISSING.text", fix: "adminBody.guide.RESULT_MISSING.fix" },
    RESULT_UNAVAILABLE: { title: "adminBody.guide.RESULT_UNAVAILABLE.title", text: "adminBody.guide.RESULT_UNAVAILABLE.text", fix: "adminBody.guide.RESULT_UNAVAILABLE.fix" },
    RESULT_UNREADABLE: { title: "adminBody.guide.RESULT_UNREADABLE.title", text: "adminBody.guide.RESULT_UNREADABLE.text", fix: "adminBody.guide.RESULT_UNREADABLE.fix" },
    JOB_NOT_FOUND: { title: "adminBody.guide.JOB_NOT_FOUND.title", text: "adminBody.guide.JOB_NOT_FOUND.text", fix: "adminBody.guide.JOB_NOT_FOUND.fix" },
    FALLBACK: { title: "adminBody.guide.FALLBACK.title", text: "adminBody.guide.FALLBACK.text", fix: "adminBody.guide.FALLBACK.fix" },
};

export function jobGuidance(errorCode: string | null, t: Translator): JobGuidance {
    const code = isAIJobErrorCode(errorCode) ? errorCode : "FALLBACK";
    const keys = GUIDE_KEYS[code];
    return {
        title: t(keys.title),
        explanation: t(keys.text),
        suggestedFix: t(keys.fix),
        retryHelps: code === "FALLBACK" ? true : JOB_ERROR_RETRY_HELPS[code],
    };
}
