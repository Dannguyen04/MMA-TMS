import { Ban, Circle, CircleCheck, CircleDashed, CircleX, Clock, LoaderCircle, type LucideIcon } from "lucide-react";

import { TONE_SOFT, type Tone } from "@/components/ui/tone";
import { PIPELINE_STAGES, PIPELINE_STAGE_LABELS } from "@/lib/domain/labels";
import type { AIJob } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { detailedStageState, type DetailedStageState } from "@/lib/video/job-progress";

const STATE_META: Record<DetailedStageState, { icon: LucideIcon; tone: Tone; text: string }> = {
    done: { icon: CircleCheck, tone: "success", text: "Done" },
    current: { icon: LoaderCircle, tone: "primary", text: "In progress" },
    waiting: { icon: Clock, tone: "neutral", text: "Waiting" },
    failed: { icon: CircleX, tone: "danger", text: "Failed here" },
    stopped: { icon: Ban, tone: "warning", text: "Stopped here" },
    upcoming: { icon: Circle, tone: "neutral", text: "Upcoming" },
    skipped: { icon: CircleDashed, tone: "neutral", text: "Not run" },
};

/** Vertical stepper of the analysis pipeline stages with done / current / failed markers. */
export function PipelineTimeline({ job, className }: { job: Pick<AIJob, "status" | "stage" | "errorCode" | "progressPct">; className?: string }) {
    return (
        <ol className={cn("flex flex-col", className)}>
            {PIPELINE_STAGES.map((stage, index) => {
                const state = detailedStageState(job, stage);
                const meta = STATE_META[state];
                const Icon = meta.icon;
                const isLast = index === PIPELINE_STAGES.length - 1;
                const isCurrent = state === "current" || state === "waiting" || state === "failed" || state === "stopped";
                return (
                    <li key={stage} aria-current={isCurrent ? "step" : undefined} className={cn("relative flex items-start gap-3", !isLast && "pb-3")}>
                        {!isLast && (
                            <span
                                aria-hidden
                                className={cn("absolute top-7 bottom-0 left-[11px] w-px", state === "done" ? "bg-success-border" : "bg-border")}
                            />
                        )}
                        <span aria-hidden className={cn("flex size-6 shrink-0 items-center justify-center rounded-full ring-1 ring-inset", TONE_SOFT[meta.tone])}>
                            <Icon className={cn("size-3.5", state === "current" && "animate-spin")} />
                        </span>
                        <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3 pt-0.5">
                            <span className={cn("text-sm", isCurrent ? "font-semibold text-fg" : state === "done" ? "text-fg" : "text-fg-muted")}>
                                {PIPELINE_STAGE_LABELS[stage]}
                            </span>
                            <span className={cn("text-xs", isCurrent ? "font-medium text-fg-muted" : "text-fg-subtle")}>
                                {state === "current" ? `${meta.text} · ${job.progressPct}%` : meta.text}
                            </span>
                        </div>
                    </li>
                );
            })}
        </ol>
    );
}
