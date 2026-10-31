"use client";

import { useDemoCopy } from "@/components/i18n/locale-provider";
import { Dumbbell, PenLine, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { ActionDialog } from "@/components/ui/action-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import type { ActionForm } from "@/components/ui/use-action-form";
import { useConfirmAction } from "@/components/ui/use-confirm-action";
import type { ActionState } from "@/lib/actions/state";
import { addPlanExercise, removePlanExercise, updatePlanExercise } from "@/lib/actions/training";
import { EXERCISE_CATEGORY_LABELS } from "@/lib/domain/labels";
import type { Exercise, PlanExercise } from "@/lib/domain/types";

export interface PlanExercisesCardProps {
    planId: string;
    items: PlanExercise[];
    /** The exercise library: names for the list, and the choices when adding. */
    library: Exercise[];
    /** Coaches add, edit and remove exercises; fighters read them. */
    editable: boolean;
}

/** "4 sets × 10 reps · 20 min · RPE 7", or null when nothing is prescribed. */
function prescription(item: PlanExercise, copy: ReturnType<typeof useDemoCopy>): string | null {
    const volume = [item.sets === null ? null : copy("{n} sets", { n: item.sets }), item.reps === null ? null : copy("{n} reps", { n: item.reps })].filter(Boolean).join(" × ");
    const parts = [volume || null, item.durationSec === null ? null : copy("{n} minutes", { n: Math.round(item.durationSec / 60) }), item.targetRpe === null ? null : `RPE ${item.targetRpe}`];
    return parts.filter(Boolean).join(" · ") || null;
}

/** Drills prescribed across a training plan, in running order. */
export function PlanExercisesCard({ planId, items, library, editable }: PlanExercisesCardProps) {
    const copy = useDemoCopy();
    const byId = new Map(library.map((exercise) => [exercise.id, exercise]));
    const nameOf = (item: PlanExercise) => byId.get(item.exerciseId)?.name ?? copy("Exercise");
    const toast = useToast();
    const [editing, setEditing] = useState<PlanExercise | null>(null);
    const [adding, setAdding] = useState(false);
    const remove = useConfirmAction((item: PlanExercise) => removePlanExercise(planId, item.id), {
        onSuccess: (state) => toast({ title: state.message ?? copy("Exercise removed.") }),
    });

    return (
        <Card className="min-w-0">
            <CardHeader
                title={copy("Plan exercises")}
                description={copy("Drills prescribed across the plan, in running order.")}
                icon={<Dumbbell />}
                action={
                    editable && (
                        <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
                            <Plus aria-hidden />
                            {copy("Add exercise")} </Button>
                    )
                }
            />
            <CardContent>
                {items.length === 0 ? (
                    <EmptyState
                        compact
                        icon={<Dumbbell />}
                        title={copy("No exercises on this plan yet")}
                        description={editable ? copy("Add the drills this plan is built around, with sets, reps or time.") : copy("Your coach hasn't listed exercises for this plan.")}
                        className="pt-0"
                    />
                ) : (
                    <ol className="flex flex-col divide-y divide-border">
                        {items.map((item, index) => {
                            const exercise = byId.get(item.exerciseId);
                            const details = prescription(item, copy);
                            return (
                                <li key={item.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                                    <span className="mt-0.5 w-5 shrink-0 text-right text-[13px] text-fg-subtle tabular-nums">{index + 1}.</span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-fg">{nameOf(item)}</p>
                                        <p className="text-[13px] text-fg-muted">
                                            {[exercise ? copy(EXERCISE_CATEGORY_LABELS[exercise.category]) : null, details].filter(Boolean).join(" · ") || copy("No prescription set")}
                                        </p>
                                        {item.notes && <p className="mt-1 text-[13px] text-pretty text-fg-muted">{item.notes}</p>}
                                    </div>
                                    {editable && (
                                        <div className="flex shrink-0 items-center gap-1">
                                            <Button variant="ghost" size="icon-sm" onClick={() => setEditing(item)} aria-label={copy("Edit {title}", { title: nameOf(item) })}>
                                                <PenLine aria-hidden />
                                            </Button>
                                            <Button variant="ghost" size="icon-sm" onClick={() => remove.request(item)} aria-label={copy("Remove {title}", { title: nameOf(item) })} className="hover:text-danger-fg">
                                                <Trash2 aria-hidden />
                                            </Button>
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ol>
                )}
            </CardContent>

            {editable && (
                <>
                    <ActionDialog
                        open={adding}
                        onClose={() => setAdding(false)}
                        title={copy("Add an exercise")}
                        description={copy("It's added at the end of the plan. Leave anything you don't prescribe empty.")}
                        action={(previous: ActionState, fd: FormData) => addPlanExercise(planId, previous, fd)}
                        submitLabel={copy("Add exercise")}
                        pendingLabel="Adding…"
                        onSuccess={(state) => toast({ title: state.message ?? copy("Exercise added.") })}
                    >
                        {(form) => <PlanExerciseFields form={form} library={library} />}
                    </ActionDialog>
                    <ActionDialog
                        open={editing !== null}
                        onClose={() => setEditing(null)}
                        title={editing ? copy("Edit {title}", { title: nameOf(editing) }) : copy("Edit exercise")}
                        action={(previous: ActionState, fd: FormData) => (editing ? updatePlanExercise(planId, editing.id, previous, fd) : Promise.resolve(previous))}
                        submitLabel="Save exercise"
                        pendingLabel={copy("Saving…")}
                        onSuccess={(state) => toast({ title: state.message ?? copy("Exercise updated.") })}
                    >
                        {(form) => editing && <PlanExerciseFields form={form} item={editing} />}
                    </ActionDialog>
                    <ConfirmDialog
                        {...remove.dialogProps}
                        tone="danger"
                        title={remove.payload ? copy("Remove {title}?", { title: nameOf(remove.payload) }) : copy("Remove this exercise?")}
                        description={copy("It's taken off the plan. Sessions already scheduled don't change.")}
                        confirmLabel={copy("Remove exercise")}
                    />
                </>
            )}
        </Card>
    );
}

/** The prescription fields, shared by adding and editing. The exercise is only chosen when adding. */
function PlanExerciseFields({ form, library, item }: { form: ActionForm<undefined>; library?: Exercise[]; item?: PlanExercise }) {
    const copy = useDemoCopy();
    const { control, error } = form;
    const numberField = (name: "sets" | "reps" | "durationMin" | "targetRpe", label: string, max: number, value: number | null) => (
        <Field label={label} htmlFor={control(name).id} optional error={error(name)}>
            <Input {...control(name)} type="number" inputMode="numeric" min={1} max={max} step={1} defaultValue={value ?? ""} />
        </Field>
    );

    return (
        <>
            {library && (
                <Field label={copy("Exercise")} htmlFor={control("exerciseId").id} required error={error("exerciseId")}>
                    <Select {...control("exerciseId", { required: true })} defaultValue="">
                        <option value="">{copy("Choose an exercise…")} </option>
                        {library.map((exercise) => (
                            <option key={exercise.id} value={exercise.id}>
                                {exercise.name} · {copy(EXERCISE_CATEGORY_LABELS[exercise.category])}
                            </option>
                        ))}
                    </Select>
                </Field>
            )}
            <div className="grid grid-cols-2 gap-4">
                {numberField("sets", copy("Sets"), 20, item?.sets ?? null)}
                {numberField("reps", copy("Reps"), 200, item?.reps ?? null)}
                {numberField("durationMin", copy("Minutes"), 240, item?.durationSec === null || item?.durationSec === undefined ? null : Math.round(item.durationSec / 60))}
                {numberField("targetRpe", copy("Target RPE"), 10, item?.targetRpe ?? null)}
            </div>
            <Field label={copy("Notes")} htmlFor={control("notes").id} optional error={error("notes")}>
                <Textarea {...control("notes")} rows={2} maxLength={500} defaultValue={item?.notes ?? ""} />
            </Field>
        </>
    );
}
