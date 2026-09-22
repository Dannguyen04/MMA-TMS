/**
 * Every error code an AI job can finish with. Produced by the mock pipeline (seeded failures and
 * runtime completion) and admin cancellation.
 * User and operator copy for each code is keyed by this list, so a new code is a type error until
 * both explanations exist.
 */
export const AI_JOB_ERROR_CODES = [
    "NO_FIGHTER_DETECTED",
    "UNSUPPORTED_CODEC",
    "CORRUPT_CONTAINER",
    "WORKER_TIMEOUT",
    "GPU_WORKER_LOST",
    "OUT_OF_MEMORY",
    "CANCELLED",
    "VIDEO_NOT_FOUND",
    "WORKER_FAILED",
    "RESULT_MISSING",
    "RESULT_UNAVAILABLE",
    "RESULT_UNREADABLE",
    "JOB_NOT_FOUND",
] as const;

export type AIJobErrorCode = (typeof AI_JOB_ERROR_CODES)[number];

export function isAIJobErrorCode(value: unknown): value is AIJobErrorCode {
    return typeof value === "string" && (AI_JOB_ERROR_CODES as readonly string[]).includes(value);
}

/** Whether re-queuing the same file is likely to succeed. Unknown codes are treated as retryable. */
export const JOB_ERROR_RETRY_HELPS: Record<AIJobErrorCode, boolean> = {
    NO_FIGHTER_DETECTED: false,
    UNSUPPORTED_CODEC: false,
    CORRUPT_CONTAINER: false,
    WORKER_TIMEOUT: true,
    GPU_WORKER_LOST: true,
    OUT_OF_MEMORY: true,
    CANCELLED: true,
    VIDEO_NOT_FOUND: false,
    WORKER_FAILED: true,
    RESULT_MISSING: true,
    RESULT_UNAVAILABLE: true,
    RESULT_UNREADABLE: false,
    JOB_NOT_FOUND: true,
};
