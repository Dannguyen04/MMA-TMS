"use client";

import { Lightbulb, RotateCcw } from "lucide-react";
import { useActionState, useEffect } from "react";

import { FormMessage } from "@/components/ui/form";
import { ErrorState } from "@/components/ui/states";
import { SubmitButton } from "@/components/ui/submit-button";
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
    const [state, formAction] = useActionState<ActionState<{ jobId: string }>, FormData>(retryAnalysis, { status: "idle" });
    const copy = describeJobFailure(errorCode);

    useEffect(() => {
        if (state.status === "success") toast({ title: "Analysis queued again", description: "Processing restarts in a few seconds." });
    }, [state, toast]);

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
                            Technical detail{errorCode ? ` (${errorCode})` : ""}: {errorMessage} · Attempt {attempts}
                        </span>
                    )}
                </>
            }
            action={
                canRetry && (
                    <form action={formAction} className="flex flex-col items-center gap-2">
                        <input type="hidden" name="videoId" value={videoId} />
                        <SubmitButton pendingLabel="Queuing…" variant={copy.retryHelps ? "primary" : "secondary"}>
                            <RotateCcw aria-hidden />
                            Retry analysis
                        </SubmitButton>
                        <FormMessage status={state.status === "error" ? "error" : "idle"} message={state.message} />
                    </form>
                )
            }
        />
    );
}
