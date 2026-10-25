"use client";

import { useT } from "@/components/i18n/locale-provider";
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
import { exerciseCategoryLabel } from "@/lib/domain/labels";
import type { Exercise, PlanExercise } from "@/lib/domain/types";
import type { Translator } from "@/lib/i18n/translate";

export interface PlanExercisesCardProps {
    planId: string;
    items: PlanExercise[];
    /** The exercise library: names for the list, and the choices when adding. */
    library: Exercise[];
    /** Coaches add, edit and remove exercises; fighters read them. */
    editable: boolean;
}

/** "4 sets × 10 reps · 20 min · RPE 7", or null when nothing is prescribed. */
function prescription(item: PlanExercise, t: Translator): string | null {
    const volume = [
        item.sets === null ? null : `${item.sets} ${t("training.planExercises.fieldSets").toLowerCase()}`,
        item.reps === null ? null : `${item.reps} ${t("training.planExercises.fieldReps").toLowerCase()}`
    ].filter(Boolean).join(" × ");
    const parts = [
        volume || null,
        item.durationSec === null ? null : t("training.planExercises.durationMin", { min: Math.round(item.durationSec / 60) }),
        item.targetRpe === null ? null : t("training.planExercises.rpeVal", { rpe: item.targetRpe })
    ];
    return parts.filter(Boolean).join(" · ") || null;
}

/** Drills prescribed across a training plan, in running order. */
export function PlanExercisesCard({ planId, items, library, editable }: PlanExercisesCardProps) {
    const t = useT();
    const byId = new Map(library.map((exercise) => [exercise.id, exercise]));
    const nameOf = (item: PlanExercise) => byId.get(item.exerciseId)?.name ?? t("training.planExercises.fieldExercise");
    const toast = useToast();
    const [editing, setEditing] = useState<PlanExercise | null>(null);
    const [adding, setAdding] = useState(false);
    const remove = useConfirmAction((item: PlanExercise) => removePlanExercise(planId, item.id), {
        onSuccess: (state) => toast({ title: state.message ?? t("training.planExercises.removedToast") }),
    });

    return (
        <Card className="min-w-0">
            <CardHeader
                title={t("training.planExercises.title")}
                description={t("training.planExercises.description")}
                icon={<Dumbbell />}
                action={
                    editable && (
                        <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
                            <Plus aria-hidden />
                            {t("training.planExercises.add")}
                        </Button>
                    )
                }
            />
            <CardContent>
                {items.length === 0 ? (
                    <EmptyState
                        compact
                        icon={<Dumbbell />}
                        title={t("training.planExercises.emptyTitle")}
                        description={editable ? t("training.planExercises.emptyDescCoach") : t("training.planExercises.emptyDescFighter")}
                        className="pt-0"
                    />
                ) : (
                    <ol className="flex flex-col divide-y divide-border">
                        {items.map((item, index) => {
                            const exercise = byId.get(item.exerciseId);
                            const details = prescription(item, t);
                            return (
                                <li key={item.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                                    <span className="mt-0.5 w-5 shrink-0 text-right text-[13px] text-fg-subtle tabular-nums">{index + 1}.</span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-fg">{nameOf(item)}</p>
                                        <p className="text-[13px] text-fg-muted">
                                            {[exercise ? exerciseCategoryLabel(t, exercise.category) : null, details].filter(Boolean).join(" · ") || t("training.planExercises.noPrescription")}
                                        </p>
                                        {item.notes && <p className="mt-1 text-[13px] text-pretty text-fg-muted">{item.notes}</p>}
                                    </div>
                                    {editable && (
                                        <div className="flex shrink-0 items-center gap-1">
                                            <Button variant="ghost" size="icon-sm" onClick={() => setEditing(item)} aria-label={t("training.planExercises.editAria", { name: nameOf(item) })}>
                                                <PenLine aria-hidden />
                                            </Button>
                                            <Button variant="ghost" size="icon-sm" onClick={() => remove.request(item)} aria-label={t("training.planExercises.removeAria", { name: nameOf(item) })} className="hover:text-danger-fg">
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
                        title={t("training.planExercises.dialogAddTitle")}
                        description={t("training.planExercises.dialogAddDesc")}
                        action={(previous: ActionState, fd: FormData) => addPlanExercise(planId, previous, fd)}
                        submitLabel={t("training.planExercises.submitAdd")}
                        pendingLabel={t("training.planExercises.submittingAdd")}
                        onSuccess={(state) => toast({ title: state.message ?? t("training.planExercises.addedToast") })}
                    >
                        {(form) => <PlanExerciseFields form={form} library={library} />}
                    </ActionDialog>
                    <ActionDialog
                        open={editing !== null}
                        onClose={() => setEditing(null)}
                        title={editing ? t("training.planExercises.dialogEditTitle", { name: nameOf(editing) }) : t("training.planExercises.dialogEditGeneric")}
                        action={(previous: ActionState, fd: FormData) => (editing ? updatePlanExercise(planId, editing.id, previous, fd) : Promise.resolve(previous))}
                        submitLabel={t("training.planExercises.submitEdit")}
                        pendingLabel={t("training.planExercises.submittingEdit")}
                        onSuccess={(state) => toast({ title: state.message ?? t("training.planExercises.updatedToast") })}
                    >
                        {(form) => editing && <PlanExerciseFields form={form} item={editing} />}
                    </ActionDialog>
                    <ConfirmDialog
                        {...remove.dialogProps}
                        tone="danger"
                        title={remove.payload ? t("training.planExercises.dialogRemoveTitle", { name: nameOf(remove.payload) }) : t("training.planExercises.dialogRemoveGeneric")}
                        description={t("training.planExercises.dialogRemoveDesc")}
                        confirmLabel={t("training.planExercises.confirmRemove")}
                    />
                </>
            )}
        </Card>
    );
}

/** The prescription fields, shared by adding and editing. The exercise is only chosen when adding. */
function PlanExerciseFields({ form, library, item }: { form: ActionForm<undefined>; library?: Exercise[]; item?: PlanExercise }) {
    const t = useT();
    const { control, error } = form;
    const numberField = (name: "sets" | "reps" | "durationMin" | "targetRpe", label: string, max: number, value: number | null) => (
        <Field label={label} htmlFor={control(name).id} optional error={error(name)}>
            <Input {...control(name)} type="number" inputMode="numeric" min={1} max={max} step={1} defaultValue={value ?? ""} />
        </Field>
    );

    return (
        <>
            {library && (
                <Field label={t("training.planExercises.fieldExercise")} htmlFor={control("exerciseId").id} required error={error("exerciseId")}>
                    <Select {...control("exerciseId", { required: true })} defaultValue="">
                        <option value="">{t("training.planExercises.chooseExercise")}</option>
                        {library.map((exercise) => (
                            <option key={exercise.id} value={exercise.id}>
                                {exercise.name} · {exerciseCategoryLabel(t, exercise.category)}
                            </option>
                        ))}
                    </Select>
                </Field>
            )}
            <div className="grid grid-cols-2 gap-4">
                {numberField("sets", t("training.planExercises.fieldSets"), 20, item?.sets ?? null)}
                {numberField("reps", t("training.planExercises.fieldReps"), 200, item?.reps ?? null)}
                {numberField("durationMin", t("training.planExercises.fieldMinutes"), 240, item?.durationSec === null || item?.durationSec === undefined ? null : Math.round(item.durationSec / 60))}
                {numberField("targetRpe", t("training.planExercises.fieldTargetRpe"), 10, item?.targetRpe ?? null)}
            </div>
            <Field label={t("training.planExercises.fieldNotes")} htmlFor={control("notes").id} optional error={error("notes")}>
                <Textarea {...control("notes")} rows={2} maxLength={500} defaultValue={item?.notes ?? ""} />
            </Field>
        </>
    );
}
