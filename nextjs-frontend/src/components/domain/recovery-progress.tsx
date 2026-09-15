import { Check, Circle, CircleCheck, Flag } from "lucide-react";

import { ProgressBar } from "@/components/ui/progress";
import { recoveryProgressPct } from "@/lib/domain/rules";
import type { RecoveryPhase, RecoveryPhaseStatus, RecoveryPlan } from "@/lib/domain/types";
import { daysBetween, formatDate, formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { describeDaysUntil } from "./domain-format";

export const RECOVERY_PHASE_STATUS_TEXT: Record<RecoveryPhaseStatus, string> = {
    completed: "Completed",
    current: "Current phase",
    upcoming: "Upcoming",
};

export interface RecoveryProgressProps {
    plan: RecoveryPlan;
    /** Server time (ISO) used for days to the target return date. */
    now: string;
    className?: string;
}

/** Recovery plan stepper: overall progress, target return, phases and current milestones. */
export function RecoveryProgress({ plan, now, className }: RecoveryProgressProps) {
    const progress = recoveryProgressPct(plan);
    const current = plan.phases.find((phase) => phase.status === "current");

    return (
        <div className={cn("flex flex-col gap-6", className)}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-8">
                <ProgressBar
                    value={progress}
                    label="Overall recovery progress"
                    showLabel
                    tone={plan.status === "completed" ? "success" : "info"}
                    className="flex-1"
                />
                <RecoveryTargetReturn plan={plan} now={now} />
            </div>

            <RecoveryPhaseSteps phases={plan.phases} detail="goal" />

            {current && current.milestones.length > 0 && (
                <div className="rounded-lg bg-surface-muted px-4 py-3">
                    <h3 className="text-[13px] font-semibold text-fg">
                        {current.name} milestones
                        <span className="ml-1.5 font-normal text-fg-muted">
                            ({current.milestones.filter((m) => m.done).length} of {current.milestones.length} done)
                        </span>
                    </h3>
                    <ul className="mt-2 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                        {current.milestones.map((milestone) => (
                            <li key={milestone.label} className="flex items-start gap-2 text-[13px]">
                                {milestone.done ? (
                                    <CircleCheck aria-hidden className="mt-px size-4 shrink-0 text-success-fg" />
                                ) : (
                                    <Circle aria-hidden className="mt-px size-4 shrink-0 text-fg-subtle" />
                                )}
                                <span className={milestone.done ? "text-fg" : "text-fg-muted"}>
                                    <span className="sr-only">{milestone.done ? "Done: " : "Not done yet: "}</span>
                                    {milestone.label}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

/** Target return date with the distance to it; an overdue target is shown in the warning tone. */
export function RecoveryTargetReturn({ plan, now, className }: { plan: Pick<RecoveryPlan, "status" | "targetReturnDate">; now: string; className?: string }) {
    const days = daysBetween(now, plan.targetReturnDate);
    return (
        <div className={cn("flex shrink-0 items-center gap-2.5", className)}>
            <Flag aria-hidden className="size-4 text-fg-subtle" />
            <p className="text-[13px] leading-tight">
                <span className="block text-fg-muted">Target return</span>
                <span className="font-medium text-fg">
                    <time dateTime={plan.targetReturnDate}>{formatDate(plan.targetReturnDate)}</time>
                    {plan.status !== "completed" && (
                        <span className={cn("font-normal", days < 0 ? "text-warning-fg" : "text-fg-muted")}>
                            {" · "}
                            {days >= 0 ? describeDaysUntil(days) : `passed ${describeDaysUntil(days)}`}
                        </span>
                    )}
                </span>
            </p>
        </div>
    );
}

/** The plan's phases as a stepper, each with its dates and either its goal or its milestone count. */
export function RecoveryPhaseSteps({ phases, detail, className }: { phases: RecoveryPhase[]; detail: "goal" | "milestones"; className?: string }) {
    return (
        <ol aria-label="Recovery phases" className={cn("flex flex-col md:flex-row", className)}>
            {phases.map((phase, index) => {
                const isCurrent = phase.status === "current";
                return (
                    <li
                        key={phase.id}
                        aria-current={isCurrent ? "step" : undefined}
                        className="relative flex min-w-0 gap-3 pb-5 last:pb-0 md:flex-1 md:flex-col md:gap-2.5 md:pr-4 md:pb-0"
                    >
                        {index < phases.length - 1 && (
                            <span
                                aria-hidden
                                className={cn(
                                    "absolute top-8 bottom-1 left-[13px] w-0.5 rounded-full md:top-[13px] md:right-1 md:bottom-auto md:left-9 md:h-0.5 md:w-auto",
                                    phase.status === "completed" ? "bg-success-solid" : "bg-border",
                                )}
                            />
                        )}
                        <RecoveryPhaseDot status={phase.status} index={index} />
                        <div className="min-w-0">
                            <p className={cn("text-[11px] font-semibold tracking-wide uppercase", isCurrent ? "text-info-fg" : "text-fg-subtle")}>
                                {RECOVERY_PHASE_STATUS_TEXT[phase.status]}
                            </p>
                            <p className={cn("text-sm font-medium", phase.status === "upcoming" ? "text-fg-muted" : "text-fg")}>
                                <span className="sr-only">Phase {index + 1}: </span>
                                {phase.name}
                            </p>
                            <p className="text-xs text-fg-muted">
                                <time dateTime={phase.startDate}>{formatShortDate(phase.startDate)}</time> –{" "}
                                <time dateTime={phase.endDate}>{formatShortDate(phase.endDate)}</time>
                            </p>
                            {detail === "goal" ? (
                                <p className="mt-1 line-clamp-2 text-xs text-pretty text-fg-subtle">{phase.goal}</p>
                            ) : (
                                <p className="mt-1 text-xs text-fg-subtle">
                                    {phase.milestones.filter((m) => m.done).length}/{phase.milestones.length} milestones
                                </p>
                            )}
                        </div>
                    </li>
                );
            })}
        </ol>
    );
}

/** Numbered phase marker: a tick once completed, a ring on the current phase. */
export function RecoveryPhaseDot({ status, index, size = "md" }: { status: RecoveryPhaseStatus; index: number; size?: "sm" | "md" }) {
    return (
        <span
            aria-hidden
            className={cn(
                "relative flex shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                size === "sm" ? "size-6" : "size-7",
                status === "completed" && "bg-success-solid text-white",
                status === "current" && "bg-info-soft text-info-fg ring-2 ring-info-solid",
                status === "upcoming" && "bg-surface text-fg-subtle ring-1 ring-border-strong",
            )}
        >
            {status === "completed" ? <Check className="size-4" strokeWidth={2.75} /> : index + 1}
        </span>
    );
}
