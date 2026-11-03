"use client";

import { ChartNoAxesColumnIncreasing, PenLine, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";

import { formatMeasure } from "@/components/domain/domain-format";
import { useLocale, useT } from "@/components/i18n/locale-provider";
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
import { formatWeekdayDate } from "@/lib/format";
import { plural } from "@/lib/i18n/translate";
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
    const t = useT();
    const [open, setOpen] = useState<OpenDialog>(null);
    const toast = useToast();
    const close = () => setOpen(null);
    const remove = useConfirmAction((goalId: string) => deleteGoal(goalId), {
        onSuccess: (state) => toast({ title: t("screens.performance.goalActions.deleted"), description: state.message }),
    });

    const triggers =
        variant === "icons" ? (
            <div className={cn("flex items-center justify-end gap-0.5", className)}>
                <IconAction
                    label={t("screens.performance.goalActions.logProgressFor", { title: goal.title })}
                    tooltip={t("screens.performance.goalActions.logProgress")}
                    onClick={() => setOpen("progress")}
                >
                    <ChartNoAxesColumnIncreasing />
                </IconAction>
                <IconAction
                    label={t("screens.performance.goalActions.editTitle", { title: goal.title })}
                    tooltip={t("screens.performance.goalActions.edit")}
                    onClick={() => setOpen("edit")}
                >
                    <PenLine />
                </IconAction>
                <IconAction
                    label={t("screens.performance.goalActions.deleteTitle", { title: goal.title })}
                    tooltip={t("screens.performance.goalActions.delete")}
                    onClick={() => remove.request(goal.id)}
                >
                    <Trash2 />
                </IconAction>
            </div>
        ) : (
            <div className={cn("flex flex-wrap items-center gap-2", className)}>
                <Button variant="secondary" size="sm" onClick={() => setOpen("progress")}>
                    <ChartNoAxesColumnIncreasing aria-hidden />
                    {t("screens.performance.goalActions.logProgress")}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setOpen("edit")} aria-label={t("screens.performance.goalActions.editTitle", { title: goal.title })}>
                    <PenLine aria-hidden />
                    {t("screens.performance.goalActions.edit")}
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => remove.request(goal.id)}
                    aria-label={t("screens.performance.goalActions.deleteTitle", { title: goal.title })}
                >
                    <Trash2 aria-hidden />
                    {t("screens.performance.goalActions.delete")}
                </Button>
            </div>
        );

    return (
        <>
            {triggers}

            <ActionDialog
                open={open === "progress"}
                onClose={close}
                title={t("screens.performance.goalActions.logProgress")}
                description={`${goal.title} — ${fighterName}`}
                size="sm"
                action={logGoalProgress}
                submitLabel={t("screens.performance.goalActions.logProgress")}
                pendingLabel={t("screens.performance.goalActions.logging")}
                onSuccess={(state) => toast({ title: t("screens.performance.goalActions.logged"), description: state.message })}
            >
                {(form) => <LogProgressFields form={form} goal={goal} now={now} />}
            </ActionDialog>

            <ActionDialog
                open={open === "edit"}
                onClose={close}
                title={t("screens.performance.goalActions.editGoal")}
                description={t("screens.performance.goalActions.forFighter", { name: fighterName })}
                size="lg"
                action={updateGoal}
                submitLabel={t("screens.performance.goalActions.saveChanges")}
                pendingLabel={t("screens.performance.goalActions.saving")}
                onSuccess={(state) => toast({ title: t("screens.performance.goalActions.updated"), description: state.message })}
            >
                {(form) => <GoalForm form={form} mode="edit" goal={goal} now={now} />}
            </ActionDialog>

            <ConfirmDialog
                {...remove.dialogProps}
                title={t("screens.performance.goalActions.deleteConfirmTitle")}
                confirmLabel={t("screens.performance.goalActions.deleteConfirm")}
                description={t("screens.performance.goalActions.deleteDesc", {
                    title: goal.title,
                    checkIns: plural(t, "screens.performance.goalTrend.checkIns", goal.history.length),
                    name: fighterName,
                })}
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
    const t = useT();
    const locale = useLocale();
    const value = form.control("value", { required: true, hint: true });
    const dateId = form.control("date").id;
    const hint = `${goal.lowerIsBetter ? t("screens.performance.goalActions.lowerIsBetterHint") : ""}${t("screens.performance.goalActions.unitHint", { unit: goal.unit })}`;

    return (
        <>
            <input type="hidden" name="goalId" value={goal.id} />
            <dl className="grid grid-cols-3 gap-2 rounded-lg bg-surface-muted px-3 py-2.5 text-center">
                {[
                    { id: "baseline", label: t("screens.performance.goalActions.baseline"), value: goal.baseline },
                    { id: "current", label: t("screens.performance.goalActions.current"), value: goal.current },
                    { id: "target", label: t("screens.performance.goalActions.target"), value: goal.target },
                ].map((item) => (
                    <div key={item.id} className="min-w-0">
                        <dt className="text-[11px] tracking-wide text-fg-subtle uppercase">{item.label}</dt>
                        <dd className="mt-0.5 truncate text-sm font-semibold text-fg">{formatMeasure(item.value, goal.unit)}</dd>
                    </div>
                ))}
            </dl>

            <Field label={t("screens.performance.goalActions.newValue", { unit: goal.unit })} htmlFor={value.id} error={form.error("value")} hint={hint} required>
                <Input {...value} type="number" step="any" inputMode="decimal" suffix={goal.unit} />
            </Field>

            <Field label={t("screens.performance.goalActions.checkInDate")} htmlFor={dateId} hint={t("screens.performance.goalActions.checkInDateHint")}>
                <Input
                    id={dateId}
                    value={t("screens.performance.goalActions.today", { date: formatWeekdayDate(now, locale) })}
                    readOnly
                    className="bg-surface-muted text-fg-muted"
                />
            </Field>
        </>
    );
}
