"use client";

import { Ban, Circle, CircleCheck, CircleDashed, CircleX, Clock, WifiOff, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ProgressBar } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { PIPELINE_STAGE_LABELS, PIPELINE_STAGES } from "@/lib/domain/labels";
import type { AIJob } from "@/lib/domain/types";
import { formatClock } from "@/lib/format";
import { cn } from "@/lib/utils";
import { detailedStageState, WORK_STAGES, type AIJobPollResponse, type DetailedStageState } from "@/lib/video/job-progress";
import { useJobProgress } from "./use-job-progress";

/** Screen-reader state per stage. A failed or cancelled stage reads as stopped, never as waiting. */
const STAGE_TEXT: Record<DetailedStageState, string> = {
    done: "done",
    current: "in progress",
    waiting: "waiting",
    failed: "stopped",
    stopped: "stopped",
    upcoming: "not started",
    skipped: "not run",
};

const STAGE_ICONS: Record<Exclude<DetailedStageState, "current">, { icon: LucideIcon; className: string }> = {
    done: { icon: CircleCheck, className: "text-success-fg" },
    waiting: { icon: Clock, className: "text-fg-muted" },
    failed: { icon: CircleX, className: "text-danger-fg" },
    stopped: { icon: Ban, className: "text-warning-fg" },
    upcoming: { icon: Circle, className: "text-border-strong" },
    skipped: { icon: CircleDashed, className: "text-border-strong" },
};

function StageIcon({ state }: { state: DetailedStageState }) {
    if (state === "current") return <Spinner className="size-4 shrink-0 text-primary" />;
    const { icon: Icon, className } = STAGE_ICONS[state];
    return <Icon aria-hidden className={cn("size-4 shrink-0", className)} />;
}

export interface PipelineProgressProps {
    jobId: string;
    initialJob: AIJob | null;
    /** Server time (ISO) for the initial elapsed time. */
    now: string;
    onSettled?: (response: AIJobPollResponse) => void;
    /** Refresh the page's server data when the job settles (detail pages). */
    refreshOnSettle?: boolean;
    restartKey?: number;
    className?: string;
}

/** Live checklist of pipeline stages with progress and elapsed time. */
export function PipelineProgress({ jobId, initialJob, now, onSettled, refreshOnSettle = false, restartKey, className }: PipelineProgressProps) {
    const router = useRouter();
    const { job, error, reconnecting } = useJobProgress({
        jobId,
        initialJob,
        restartKey,
        onSettled: (response) => {
            onSettled?.(response);
            if (refreshOnSettle) router.refresh();
        },
    });
    const status = job?.status ?? "queued";
    const elapsed = useElapsed(job?.queuedAt ?? null, now, status === "queued" || status === "processing");
    const stageIndex = job ? WORK_STAGES.indexOf(job.stage) : -1;
    const currentLabel = job ? PIPELINE_STAGE_LABELS[job.stage] : PIPELINE_STAGE_LABELS.queued;
    const progress = job?.progressPct ?? 0;

    return (
        <div className={cn("flex flex-col gap-4", className)}>
            <div>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="text-sm font-semibold text-fg" aria-live="polite" aria-atomic="true">
                        {status === "completed" ? "Analysis complete" : status === "failed" ? "Analysis stopped" : currentLabel}
                    </p>
                    <p className="text-[13px] text-fg-muted tabular-nums">
                        {stageIndex >= 0 && status === "processing" ? `Stage ${stageIndex + 1} of ${WORK_STAGES.length} · ` : ""}
                        {progress}% · Elapsed {formatClock(elapsed)}
                    </p>
                </div>
                <ProgressBar value={progress} label="AI analysis progress" hideValue valueText={`${progress}%`} className="mt-2" tone={status === "failed" ? "danger" : status === "completed" ? "success" : "primary"} />
            </div>

            <ol aria-label="Pipeline stages" className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-flow-col sm:grid-rows-5">
                {PIPELINE_STAGES.map((stage) => {
                    const state = job ? detailedStageState(job, stage) : stage === "queued" ? "waiting" : "upcoming";
                    const reached = state !== "upcoming" && state !== "skipped";
                    return (
                        <li key={stage} className="flex items-center gap-2.5 text-sm">
                            <StageIcon state={state} />
                            <span className={cn(reached ? "text-fg" : "text-fg-subtle", reached && state !== "done" && "font-medium")}>{PIPELINE_STAGE_LABELS[stage]}</span>
                            <span className="sr-only">({STAGE_TEXT[state]})</span>
                        </li>
                    );
                })}
            </ol>

            {reconnecting && !error && (
                <p role="status" className="flex items-center gap-2 text-[13px] text-fg-muted">
                    <WifiOff aria-hidden className="size-4" />
                    Connection interrupted — retrying…
                </p>
            )}
            {error && (
                <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-fg ring-1 ring-danger-border ring-inset">
                    {error}
                </p>
            )}
        </div>
    );
}

/** Seconds since `from`, ticking while running. The first render uses the server time so hydration matches. */
function useElapsed(from: string | null, now: string, running: boolean): number {
    const initial = from ? Math.max(0, Math.round((Date.parse(now) - Date.parse(from)) / 1000)) : 0;
    const [elapsed, setElapsed] = useState(initial);
    const fromRef = useRef(from);

    useEffect(() => {
        fromRef.current = from;
    }, [from]);

    useEffect(() => {
        if (!running) return;
        const timer = window.setInterval(() => {
            const start = fromRef.current;
            if (start) setElapsed(Math.max(0, Math.round((Date.now() - Date.parse(start)) / 1000)));
        }, 1000);
        return () => window.clearInterval(timer);
    }, [running]);

    return elapsed;
}
