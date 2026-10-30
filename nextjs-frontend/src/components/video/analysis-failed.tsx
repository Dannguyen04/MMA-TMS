"use client";

import { Lightbulb, RotateCcw } from "lucide-react";
import { useActionState, useEffect } from "react";

import { FormMessage } from "@/components/ui/form";
import { ErrorState } from "@/components/ui/states";
import { SubmitButton } from "@/components/ui/submit-button";
import { useLocale, useT } from "@/components/i18n/locale-provider";
import { useToast } from "@/components/ui/toast";
import type { ActionState } from "@/lib/actions/state";
import { retryAnalysis } from "@/lib/actions/video";
import { describeJobFailure } from "./job-failure";

export interface AnalysisFailedProps {
    videoId: string;
    errorCode: string | null;
    errorMessage: string | null;
    attempts: number;
    canRetry: boolean;
    className?: string;
}

/** Failed analysis: what went wrong in plain language, what to do, and a retry for the uploader or coach. */
export function AnalysisFailed({ videoId, errorCode, errorMessage, attempts, canRetry, className }: AnalysisFailedProps) {
    const toast = useToast();
    const t = useT();
    const locale = useLocale();
    const [state, formAction] = useActionState<ActionState<{ jobId: string }>, FormData>(retryAnalysis, { status: "idle" });
    const copy = describeJobFailure(errorCode, locale);

    useEffect(() => {
        if (state.status === "success") toast({ title: t("screens.video.failed.queuedAgain"), description: t("screens.video.failed.restarts") });
    }, [state, toast, t]);

    return (
        <ErrorState
            className={className}
            title={copy.title}
            description={
                <>
                    <span className="block">{copy.explanation}</span>
                    <span className="mt-3 flex items-start justify-center gap-2 text-left text-fg">
                        <Lightbulb aria-hidden className="mt-0.5 size-4 shrink-0 text-warning-fg" />
                        <span>{copy.guidance}</span>
                    </span>
                    {errorMessage && (
                        <span className="mt-3 block text-xs text-fg-subtle">
                            {t("screens.video.failed.technical", { code: errorCode ? ` (${errorCode})` : "", message: errorMessage, attempts })}
                        </span>
                    )}
                </>
            }
            action={
                canRetry && (
                    <form action={formAction} className="flex flex-col items-center gap-2">
                        <input type="hidden" name="videoId" value={videoId} />
                        <SubmitButton pendingLabel={t("screens.video.queuing")} variant={copy.retryHelps ? "primary" : "secondary"}>
                            <RotateCcw aria-hidden />
                            {t("screens.video.retryAnalysis")}
                        </SubmitButton>
                        <FormMessage status={state.status === "error" ? "error" : "idle"} message={state.message} />
                    </form>
                )
            }
        />
    );
}
