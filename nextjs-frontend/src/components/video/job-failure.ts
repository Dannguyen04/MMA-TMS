/** Plain-language explanation of pipeline failures, with what the user can do about them. */

import type { Locale } from "@/lib/i18n/config";
import { createTranslator, type MessageKey } from "@/lib/i18n/translate";
import { isAIJobErrorCode, JOB_ERROR_RETRY_HELPS, type AIJobErrorCode } from "@/lib/video/job-errors";

/** Every code needs its three messages: a new code is a type error until `screens-video.*.ts` defines them. */
type FailureKey = `screens.video.failure.${AIJobErrorCode | "default"}.${"title" | "explanation" | "guidance"}`;
const EVERY_CODE_HAS_COPY: FailureKey extends MessageKey ? true : never = true;
void EVERY_CODE_HAS_COPY;

export interface JobFailureCopy {
    title: string;
    explanation: string;
    guidance: string;
    /** Whether re-running the same file is likely to work. */
    retryHelps: boolean;
}

/** The failure copy for an error code, in the viewer's language (English when omitted). Unknown codes get a generic message. */
export function describeJobFailure(errorCode: string | null, locale: Locale = "en"): JobFailureCopy {
    const t = createTranslator(locale);
    const known = isAIJobErrorCode(errorCode);
    const code = known ? errorCode : "default";
    const message = (part: "title" | "explanation" | "guidance") => t(`screens.video.failure.${code}.${part}` satisfies FailureKey as MessageKey);
    return {
        title: message("title"),
        explanation: message("explanation"),
        guidance: message("guidance"),
        retryHelps: known ? JOB_ERROR_RETRY_HELPS[errorCode] : true,
    };
}
