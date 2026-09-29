"use client";

import { CircleCheck, CircleX, Flag, Plus } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";

import { ActionDialog } from "@/components/ui/action-dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/form";
import { ProgressBar } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";
import { useConfirmAction } from "@/components/ui/use-confirm-action";
import { addPlanMilestoneAction, closeRecoveryPlanAction, setPlanMilestoneAction } from "@/lib/actions/medical-contract";
import { MEDICAL_TEXT_LIMITS, RECOVERY_MILESTONES_MAX, type RecoveryMilestone } from "@/lib/domain/medical-contract";
import { milestoneProgressPct } from "@/lib/domain/medical-mappings";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface MilestoneTrackerProps {
    fighterId: string;
    planId: string;
    milestones: RecoveryMilestone[];
    /** Only an active plan's milestones can change. */
    editable: boolean;
    /** YYYY-MM-DD, earliest target date for a new milestone. */
    startDate: string;
}

/** A milestone plan's checklist: tick milestones off as they're reached, or add one at the end. */
export function MilestoneTracker({ fighterId, planId, milestones, editable, startDate }: MilestoneTrackerProps) {
    const toast = useToast();
    const [adding, setAdding] = useState(false);
    const [, startTransition] = useTransition();
    const [shown, setOptimistic] = useOptimistic(milestones, (current, change: { id: string; done: boolean }) =>
        current.map((milestone) => (milestone.id === change.id ? { ...milestone, isCompleted: change.done } : milestone)),
    );
    const reached = shown.filter((milestone) => milestone.isCompleted).length;

    const toggle = (milestone: RecoveryMilestone, done: boolean) =>
        startTransition(async () => {
            setOptimistic({ id: milestone.id, done });
            const result = await setPlanMilestoneAction({ fighterId, planId, milestoneId: milestone.id, done });
            if (result.status === "error") toast({ tone: "error", title: "Milestone not updated", description: result.message });
        });

    return (
        <div className="flex flex-col gap-4">
            {shown.length > 0 && (
                <ProgressBar value={milestoneProgressPct(shown)} label="Milestones reached" showLabel valueText={`${reached} of ${shown.length}`} tone={reached === shown.length ? "success" : "primary"} />
            )}
            {shown.length === 0 ? (
                <p className="rounded-lg bg-surface-muted px-4 py-3 text-sm text-fg-muted">No milestones yet.{editable ? " Add the first one." : ""}</p>
            ) : (
                <ol className="flex flex-col divide-y divide-border rounded-lg ring-1 ring-border ring-inset">
                    {shown.map((milestone, index) => (
                        <li key={milestone.id} className="flex items-start gap-3 px-3.5 py-3">
                            <input
                                type="checkbox"
                                id={`milestone-${milestone.id}`}
                                checked={milestone.isCompleted}
                                disabled={!editable}
                                onChange={(event) => toggle(milestone, event.target.checked)}
                                className="mt-1 size-4 shrink-0 cursor-pointer accent-[var(--primary)] disabled:cursor-not-allowed"
                            />
                            <label htmlFor={`milestone-${milestone.id}`} className={cn("min-w-0 flex-1", editable && "cursor-pointer")}>
                                <span className={cn("block text-sm font-medium", milestone.isCompleted ? "text-fg-muted line-through decoration-fg-subtle" : "text-fg")}>
                                    {index + 1}. {milestone.title}
                                </span>
                                <span className="mt-0.5 block text-[13px] text-pretty text-fg-muted">{milestone.criteria}</span>
                                <span className="mt-1 flex flex-wrap gap-x-3 text-xs text-fg-subtle">
                                    {milestone.targetDate && (
                                        <span className="inline-flex items-center gap-1">
                                            <Flag aria-hidden className="size-3" />
                                            Target {formatDate(milestone.targetDate)}
                                        </span>
                                    )}
                                    {milestone.completedAt && <span>Reached {formatDate(milestone.completedAt)}</span>}
                                </span>
                                {milestone.notes && <span className="mt-1 block text-[13px] text-fg-muted italic">{milestone.notes}</span>}
                            </label>
                        </li>
                    ))}
                </ol>
            )}
            {editable && (
                <>
                    <Button variant="secondary" size="sm" className="self-start" disabled={shown.length >= RECOVERY_MILESTONES_MAX} onClick={() => setAdding(true)}>
                        <Plus aria-hidden />
                        Add milestone
                    </Button>
                    <ActionDialog
                        open={adding}
                        onClose={() => setAdding(false)}
                        title="Add milestone"
                        description="It goes at the end of the plan. The fighter sees it on their Health page."
                        action={addPlanMilestoneAction}
                        submitLabel="Add milestone"
                        pendingLabel="Adding…"
                        onSuccess={(state) => toast({ title: "Milestone added", description: state.message })}
                    >
                        {(form) => (
                            <div className="flex flex-col gap-4">
                                <input type="hidden" name="fighterId" value={fighterId} />
                                <input type="hidden" name="planId" value={planId} />
                                <Field label="Milestone" htmlFor={form.control("title").id} error={form.error("title")} required>
                                    <Input {...form.control("title", { required: true })} maxLength={MEDICAL_TEXT_LIMITS.planTitle} />
                                </Field>
                                <Field label="How you'll know" htmlFor={form.control("criteria").id} error={form.error("criteria")} required>
                                    <Textarea {...form.control("criteria", { required: true })} rows={2} maxLength={MEDICAL_TEXT_LIMITS.clinicalText} />
                                </Field>
                                <Field label="Target date" htmlFor={form.control("targetDate").id} error={form.error("targetDate")} optional>
                                    <Input {...form.control("targetDate")} type="date" min={startDate} className="sm:w-56" />
                                </Field>
                                <Field label="Notes" htmlFor={form.control("notes").id} error={form.error("notes")} optional>
                                    <Textarea {...form.control("notes")} rows={2} maxLength={MEDICAL_TEXT_LIMITS.clinicalText} />
                                </Field>
                            </div>
                        )}
                    </ActionDialog>
                </>
            )}
        </div>
    );
}

/** A plan saved in an older format: shown as stored, never rewritten. */
export function LegacyMilestones({ items }: { items: readonly unknown[] }) {
    return (
        <div className="flex flex-col gap-2">
            <p className="text-[13px] text-fg-muted">These milestones were recorded in an older format and are shown as stored. They can&apos;t be ticked off here.</p>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-fg">
                {items.map((item, index) => (
                    <li key={index}>{typeof item === "string" ? item : typeof item === "object" && item && "title" in item ? String((item as { title: unknown }).title) : JSON.stringify(item)}</li>
                ))}
            </ul>
        </div>
    );
}

type Closing = "COMPLETED" | "CANCELLED";

const CLOSE_COPY: Record<Closing, { title: string; description: string; confirmLabel: string }> = {
    COMPLETED: {
        title: "Complete this recovery plan?",
        description: "The plan closes and can't be reopened. Completing it doesn't resolve the injury or clear the fighter — review those next.",
        confirmLabel: "Complete plan",
    },
    CANCELLED: {
        title: "Cancel this recovery plan?",
        description: "The plan closes and can't be reopened. Create a new plan if the fighter still needs one.",
        confirmLabel: "Cancel plan",
    },
};

/** Completes or cancels an active milestone plan, each behind a confirmation. */
export function PlanCloseActions({ fighterId, planId }: { fighterId: string; planId: string }) {
    const toast = useToast();
    const close = useConfirmAction((status: Closing) => closeRecoveryPlanAction({ fighterId, planId, status }), {
        onSuccess: (state) => toast({ title: "Recovery plan closed", description: state.message }),
    });
    const copy = close.payload ? CLOSE_COPY[close.payload] : null;

    return (
        <>
            <Button variant="ghost" onClick={() => close.request("CANCELLED")}>
                <CircleX aria-hidden />
                Cancel plan
            </Button>
            <Button variant="secondary" onClick={() => close.request("COMPLETED")}>
                <CircleCheck aria-hidden />
                Complete plan
            </Button>
            <ConfirmDialog
                {...close.dialogProps}
                title={copy?.title ?? ""}
                description={copy?.description ?? ""}
                confirmLabel={copy?.confirmLabel ?? ""}
                tone={close.payload === "CANCELLED" ? "danger" : "primary"}
            />
        </>
    );
}
