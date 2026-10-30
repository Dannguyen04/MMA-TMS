/** Operator-facing explanation of AI pipeline error codes: what happened and how to fix it. */

import type { Locale } from "@/lib/i18n/config";
import { createTranslator, type MessageKey } from "@/lib/i18n/translate";
import { isAIJobErrorCode, JOB_ERROR_RETRY_HELPS } from "@/lib/video/job-errors";

export interface JobGuidance {
    title: string;
    explanation: string;
    suggestedFix: string;
    /** Whether re-queuing the same file is likely to succeed. */
    retryHelps: boolean;
}

/**
 * The guidance for an error code in the viewer's language (`screens.admin.jobError.<CODE>.*`), or the general
 * guidance for a code the pipeline doesn't document.
 */
export function jobGuidance(errorCode: string | null, locale: Locale = "en"): JobGuidance {
    const t = createTranslator(locale);
    const known = isAIJobErrorCode(errorCode);
    const prefix = `screens.admin.jobError.${known ? errorCode : "fallback"}`;
    return {
        title: t(`${prefix}.title` as MessageKey),
        explanation: t(`${prefix}.explanation` as MessageKey),
        suggestedFix: t(`${prefix}.fix` as MessageKey),
        retryHelps: known ? JOB_ERROR_RETRY_HELPS[errorCode] : true,
    };
}
