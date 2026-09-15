"use client";

import { ChevronDown, Lock, SkipForward, TriangleAlert } from "lucide-react";
import { useId, useOptimistic, useTransition } from "react";

import { InlineNote } from "@/components/dashboard/inline-note";
import {
    RECOVERY_PHASE_STATUS_TEXT,
    RecoveryPhaseDot,
    RecoveryPhaseSteps,
    RecoveryTargetReturn,
} from "@/components/domain/recovery-progress";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/form";
import { ProgressBar } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";
import { useConfirmAction } from "@/components/ui/use-confirm-action";
import { advancePhaseAction, setMilestoneAction } from "@/lib/actions/clinical";
import { recoveryProgressPct } from "@/lib/domain/rules";
import type { RecoveryPhase, RecoveryPlan } from "@/lib/domain/types";
import { formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

interface MilestoneToggle {
    phaseId: string;
    index: number;
    done: boolean;
}

export interface RecoveryTrackerProps {
    plan: RecoveryPlan;
    /** Server time (ISO). */
    now: string;
}

/** Interactive recovery stepper: overall progress, phases, milestone checkboxes and moving to the next phase. */
export function RecoveryTracker({ plan, now }: RecoveryTrackerProps) {
    const toast = useToast();
    const baseId = useId();
    const [, startToggle] = useTransition();
    // The payload records whether a next phase existed, so the toast after closing reads right once the plan has moved on.
    const advance = useConfirmAction<{ hasNext: boolean }>(() => advancePhaseAction({ planId: plan.id }), {
        onSuccess: (result, { hasNext }) => toast({ title: hasNext ? "Next phase started" : "Recovery plan completed", description: result.message }),
    });

    const [optimisticPlan, applyToggle] = useOptimistic(plan, (current: RecoveryPlan, toggle: MilestoneToggle) => ({
        ...current,
        phases: current.phases.map((phase) =>
            phase.id === toggle.phaseId
                ? { ...phase, milestones: phase.milestones.map((m, i) => (i === toggle.index ? { ...m, done: toggle.done } : m)) }
                : phase,
        ),
    }));

    const progress = recoveryProgressPct(optimisticPlan);
    const currentIndex = optimisticPlan.phases.findIndex((phase) => phase.status === "current");
    const current = currentIndex === -1 ? null : optimisticPlan.phases[currentIndex];
    const next = optimisticPlan.phases.find((phase, index) => index > currentIndex && phase.status === "upcoming") ?? null;
    const isActive = optimisticPlan.status === "active";
    const openMilestones = current ? current.milestones.filter((m) => !m.done).length : 0;

    const toggle = (phase: RecoveryPhase, index: number, done: boolean) => {
        startToggle(async () => {
            applyToggle({ phaseId: phase.id, index, done });
            const result = await setMilestoneAction({ planId: plan.id, phaseId: phase.id, milestoneIndex: index, done });
            if (result.status === "success") {
                toast({ title: done ? "Milestone done" : "Milestone reopened", description: phase.milestones[index]?.label });
            } else {
                toast({ tone: "error", title: "Couldn't update the milestone", description: result.message });
            }
        });
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-8">
                <ProgressBar
                    value={progress}
                    label="Overall recovery progress"
                    showLabel
                    tone={optimisticPlan.status === "completed" ? "success" : "info"}
                    className="flex-1"
                />
                <RecoveryTargetReturn plan={optimisticPlan} now={now} />
            </div>

            <RecoveryPhaseSteps phases={optimisticPlan.phases} detail="milestones" />

            {current && (
                <section aria-labelledby={`${baseId}-current`} className="rounded-xl border border-info-border bg-info-soft/30 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                            <p className="text-[11px] font-semibold tracking-wide text-info-fg uppercase">
                                Phase {currentIndex + 1} of {optimisticPlan.phases.length} · now
                            </p>
                            <h3 id={`${baseId}-current`} className="text-base font-semibold text-fg">
                                {current.name}
                            </h3>
                            <p className="mt-0.5 text-sm text-pretty text-fg-muted">{current.goal}</p>
                            <p className="mt-1 text-xs text-fg-subtle">
                                <time dateTime={current.startDate}>{formatShortDate(current.startDate)}</time> –{" "}
                                <time dateTime={current.endDate}>{formatShortDate(current.endDate)}</time>
                            </p>
                        </div>
                        {isActive && (
                            <Button variant="secondary" onClick={() => advance.request({ hasNext: next !== null })} className="self-start">
                                <SkipForward aria-hidden />
                                {next ? "Advance to next phase" : "Complete plan"}
                            </Button>
                        )}
                    </div>
                    <MilestoneList
                        phase={current}
                        idPrefix={baseId}
                        editable={isActive}
                        onToggle={toggle}
                        className="mt-4 rounded-lg border border-border bg-surface px-4 py-3"
                    />
                </section>
            )}

            {optimisticPlan.phases.some((phase) => phase.status !== "current") && (
                <div className="flex flex-col gap-2">
                    <h3 className="text-[13px] font-semibold text-fg">Other phases</h3>
                    {optimisticPlan.phases.map((phase, index) =>
                        phase.status === "current" ? null : (
                            <details key={phase.id} className="group rounded-lg border border-border bg-surface">
                                <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-2.5 [&::-webkit-details-marker]:hidden">
                                    <RecoveryPhaseDot status={phase.status} index={index} size="sm" />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-sm font-medium text-fg">{phase.name}</span>
                                        <span className="text-xs text-fg-muted">
                                            {RECOVERY_PHASE_STATUS_TEXT[phase.status]} · {phase.milestones.filter((m) => m.done).length} of {phase.milestones.length}{" "}
                                            milestones
                                        </span>
                                    </span>
                                    <ChevronDown aria-hidden className="size-4 shrink-0 text-fg-subtle transition-transform group-open:rotate-180" />
                                </summary>
                                <div className="border-t border-border px-4 py-3">
                                    <p className="mb-3 text-[13px] text-pretty text-fg-muted">{phase.goal}</p>
                                    <MilestoneList
                                        phase={phase}
                                        idPrefix={baseId}
                                        editable={isActive && phase.status === "completed"}
                                        onToggle={toggle}
                                        note={phase.status === "upcoming" ? "Milestones can be ticked once this phase starts." : undefined}
                                    />
                                </div>
                            </details>
                        ),
                    )}
                </div>
            )}

            <ConfirmDialog
                {...advance.dialogProps}
                tone="primary"
                title={next ? `Start “${next.name}”?` : "Complete this recovery plan?"}
                description={
                    next
                        ? `“${current?.name ?? "The current phase"}” is marked completed and the fighter is notified that the next phase has started.`
                        : "The final phase is marked completed and the plan closes. The injury and Medical Clearance don't change — update them separately."
                }
                confirmLabel={next ? "Start next phase" : "Complete plan"}
            >
                {openMilestones > 0 && (
                    <InlineNote icon={TriangleAlert} tone="warning">
                        {openMilestones === 1 ? "1 milestone" : `${openMilestones} milestones`} in this phase{" "}
                        {openMilestones === 1 ? "isn't" : "aren't"} done yet. Move on only if your clinical assessment supports it.
                    </InlineNote>
                )}
            </ConfirmDialog>
        </div>
    );
}

function MilestoneList({
    phase,
    idPrefix,
    editable,
    onToggle,
    note,
    className,
}: {
    phase: RecoveryPhase;
    idPrefix: string;
    editable: boolean;
    onToggle: (phase: RecoveryPhase, index: number, done: boolean) => void;
    note?: string;
    className?: string;
}) {
    const doneCount = phase.milestones.filter((m) => m.done).length;
    return (
        <fieldset className={cn("min-w-0", className)}>
            <legend className="sr-only">{phase.name} milestones</legend>
            <p aria-live="polite" className="mb-2 text-[13px] font-semibold text-fg">
                Milestones
                <span className="ml-1.5 font-normal text-fg-muted">
                    ({doneCount} of {phase.milestones.length} done)
                </span>
            </p>
            {phase.milestones.length === 0 ? (
                <p className="text-[13px] text-fg-muted">No milestones in this phase.</p>
            ) : (
                <ul className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
                    {phase.milestones.map((milestone, index) => (
                        <li key={`${phase.id}-${index}`}>
                            <Checkbox
                                id={`${idPrefix}-${phase.id}-${index}`}
                                label={<span className={cn("font-normal", milestone.done ? "text-fg" : "text-fg-muted")}>{milestone.label}</span>}
                                checked={milestone.done}
                                disabled={!editable}
                                onChange={(event) => onToggle(phase, index, event.target.checked)}
                            />
                        </li>
                    ))}
                </ul>
            )}
            {note && (
                <InlineNote icon={Lock} className="mt-3">
                    {note}
                </InlineNote>
            )}
        </fieldset>
    );
}
