"use client";

import { ChartNoAxesColumnIncreasing, PenLine, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";

import { formatMeasure } from "@/components/domain/domain-format";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import type { ActionForm } from "@/components/ui/use-action-form";
import { useConfirmAction } from "@/components/ui/use-confirm-action";
import { deleteGoal, logGoalProgress, updateGoal } from "@/lib/actions/goals";
import type { Goal } from "@/lib/domain/types";
import { formatWeekdayDate, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { GoalForm } from "./goal-form";

type OpenDialog = "progress" | "edit" | null;

export interface GoalActionsProps {
    goal: Goal;
    fighterName: string;
    /** Server time (ISO). */
    now: string;
    /** "buttons" for cards, "icons" for dense table rows. */
    variant?: "buttons" | "icons";
    className?: string;
}

/** Coach controls for one goal: log progress, edit and delete, each in its own dialog. */
export function GoalActions({ goal, fighterName, now, variant = "buttons", className }: GoalActionsProps) {
    const [open, setOpen] = useState<OpenDialog>(null);
    const toast = useToast();
    const close = () => setOpen(null);
    const remove = useConfirmAction((goalId: string) => deleteGoal(goalId), {
        onSuccess: (state) => toast({ title: "Goal deleted", description: state.message }),
    });

    const triggers =
        variant === "icons" ? (
            <div className={cn("flex items-center justify-end gap-0.5", className)}>
                <IconAction label={`Log progress for ${goal.title}`} tooltip="Log progress" onClick={() => setOpen("progress")}>
                    <ChartNoAxesColumnIncreasing />
                </IconAction>
                <IconAction label={`Edit ${goal.title}`} tooltip="Edit" onClick={() => setOpen("edit")}>
                    <PenLine />
                </IconAction>
                <IconAction label={`Delete ${goal.title}`} tooltip="Delete" onClick={() => remove.request(goal.id)}>
                    <Trash2 />
                </IconAction>
            </div>
        ) : (
            <div className={cn("flex flex-wrap items-center gap-2", className)}>
                <Button variant="secondary" size="sm" onClick={() => setOpen("progress")}>
                    <ChartNoAxesColumnIncreasing aria-hidden />
                    Log progress
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setOpen("edit")} aria-label={`Edit ${goal.title}`}>
                    <PenLine aria-hidden />
                    Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => remove.request(goal.id)} aria-label={`Delete ${goal.title}`}>
                    <Trash2 aria-hidden />
                    Delete
                </Button>
            </div>
        );

    return (
        <>
            {triggers}

            <ActionDialog
                open={open === "progress"}
                onClose={close}
                title="Log progress"
                description={`${goal.title} — ${fighterName}`}
                size="sm"
                action={logGoalProgress}
                submitLabel="Log progress"
                pendingLabel="Logging…"
                onSuccess={(state) => toast({ title: "Progress logged", description: state.message })}
            >
                {(form) => <LogProgressFields form={form} goal={goal} now={now} />}
            </ActionDialog>

            <ActionDialog
                open={open === "edit"}
                onClose={close}
                title="Edit goal"
                description={`For ${fighterName}`}
                size="lg"
                action={updateGoal}
                submitLabel="Save changes"
                pendingLabel="Saving…"
                onSuccess={(state) => toast({ title: "Goal updated", description: state.message })}
            >
                {(form) => <GoalForm form={form} mode="edit" goal={goal} now={now} />}
            </ActionDialog>

            <ConfirmDialog
                {...remove.dialogProps}
                title="Delete this goal?"
                confirmLabel="Delete goal"
                description={`“${goal.title}” and its ${pluralize(goal.history.length, "check-in")} will be permanently removed. ${fighterName} will no longer see it on their Goals page. This can't be undone.`}
            />
        </>
    );
}

function IconAction({ label, tooltip, onClick, children }: { label: string; tooltip: string; onClick: () => void; children: ReactNode }) {
    return (
        <Tooltip content={tooltip}>
            <Button variant="ghost" size="icon-sm" onClick={onClick} aria-label={label}>
                {children}
            </Button>
        </Tooltip>
    );
}

/** New measurement for a goal. Check-ins are dated today; a second one today replaces today's value. */
function LogProgressFields({ form, goal, now }: { form: ActionForm<undefined>; goal: Goal; now: string }) {
    const value = form.control("value", { required: true, hint: true });
    const dateId = form.control("date").id;
    const hint = `${goal.lowerIsBetter ? "Lower is better. " : ""}Unit: ${goal.unit}`;

    return (
        <>
            <input type="hidden" name="goalId" value={goal.id} />
            <dl className="grid grid-cols-3 gap-2 rounded-lg bg-surface-muted px-3 py-2.5 text-center">
                {[
                    { label: "Baseline", value: goal.baseline },
                    { label: "Current", value: goal.current },
                    { label: "Target", value: goal.target },
                ].map((item) => (
                    <div key={item.label} className="min-w-0">
                        <dt className="text-[11px] tracking-wide text-fg-subtle uppercase">{item.label}</dt>
                        <dd className="mt-0.5 truncate text-sm font-semibold text-fg">{formatMeasure(item.value, goal.unit)}</dd>
                    </div>
                ))}
            </dl>

            <Field label={`New value (${goal.unit})`} htmlFor={value.id} error={form.error("value")} hint={hint} required>
                <Input {...value} type="number" step="any" inputMode="decimal" suffix={goal.unit} />
            </Field>

            <Field label="Check-in date" htmlFor={dateId} hint="Check-ins are recorded for today. Logging again today replaces today's value.">
                <Input id={dateId} value={`${formatWeekdayDate(now)} (today)`} readOnly className="bg-surface-muted text-fg-muted" />
            </Field>
        </>
    );
}
