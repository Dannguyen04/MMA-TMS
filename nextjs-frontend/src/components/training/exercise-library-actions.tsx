"use client";

import { CircleAlert, CircleCheck, LibraryBig, Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { useT } from "@/components/i18n/locale-provider";
import { ActionDialog } from "@/components/ui/action-dialog";
import { Button } from "@/components/ui/button";
import { ChoiceGroup } from "@/components/ui/choice-group";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { useConfirmAction } from "@/components/ui/use-confirm-action";
import type { ActionState } from "@/lib/actions/state";
import { createLibraryExercise, importStarterLibrary, type StarterImportResult } from "@/lib/actions/training";
import { exerciseCategoryLabel } from "@/lib/domain/labels";
import { EXERCISE_CATEGORY_FOR, SERVICE_EXERCISE_CATEGORIES, type ServiceExerciseCategory } from "@/lib/domain/training-contract";
import { formatNumber } from "@/lib/format";
import { plural, type Translator } from "@/lib/i18n/translate";
import { Callout } from "./callout";

const categoryOptions = (t: Translator) => SERVICE_EXERCISE_CATEGORIES.map((value) => ({ value, label: exerciseCategoryLabel(t, EXERCISE_CATEGORY_FOR[value]) }));

/** "12 exercises", in the viewer's language. */
const exercises = (t: Translator, count: number) => plural(t, "screens.admin.count.exercises", count, { n: formatNumber(count) });

/** "Add exercise": one exercise for the global library, in the training service's fields. */
export function AddExerciseButton() {
    const t = useT();
    const options = useMemo(() => categoryOptions(t), [t]);
    const [open, setOpen] = useState(false);
    const [category, setCategory] = useState<ServiceExerciseCategory | "">("");
    const toast = useToast();

    return (
        <>
            <Button
                onClick={() => {
                    setCategory("");
                    setOpen(true);
                }}
            >
                <Plus aria-hidden />
                {t("training.exerciseBuilder.add")}
            </Button>
            <ActionDialog
                open={open}
                onClose={() => setOpen(false)}
                title={t("screens.misc.library.addTitle")}
                description={t("screens.misc.library.addDescription")}
                action={(previous: ActionState, fd: FormData) => createLibraryExercise(previous, fd)}
                submitLabel={t("training.exerciseBuilder.add")}
                pendingLabel={t("training.planExercises.submittingAdd")}
                onSuccess={(state) => toast({ title: state.message ?? t("screens.misc.library.added") })}
            >
                {(form) => (
                    <>
                        <Field label={t("screens.misc.library.name")} htmlFor={form.control("name").id} required error={form.error("name")}>
                            <Input {...form.control("name", { required: true })} maxLength={120} placeholder={t("screens.misc.library.namePlaceholder")} />
                        </Field>
                        <ChoiceGroup
                            id={form.control("category").id}
                            name="category"
                            legend={t("screens.admin.exercises.category")}
                            required
                            variant="compact"
                            columns={2}
                            options={options}
                            value={category}
                            onChange={setCategory}
                            error={form.error("category")}
                        />
                        <Field label={t("screens.misc.library.description")} htmlFor={form.control("description").id} optional error={form.error("description")}>
                            <Textarea {...form.control("description")} rows={3} maxLength={1000} />
                        </Field>
                        <Field
                            label={t("screens.admin.exercises.muscleGroups")}
                            htmlFor={form.control("targetMuscleGroups").id}
                            optional
                            hint={t("screens.misc.library.muscleHint")}
                            error={form.error("targetMuscleGroups")}
                        >
                            <Input {...form.control("targetMuscleGroups", { hint: true })} maxLength={300} />
                        </Field>
                        <Field label={t("screens.misc.library.videoLink")} htmlFor={form.control("videoUrl").id} optional hint={t("screens.misc.library.videoHint")} error={form.error("videoUrl")}>
                            <Input {...form.control("videoUrl", { hint: true })} type="url" inputMode="url" placeholder="https://" maxLength={1000} />
                        </Field>
                    </>
                )}
            </ActionDialog>
        </>
    );
}

export interface StarterLibraryImportProps {
    /** Starter exercises the library doesn't have yet. */
    missing: string[];
    /** How many starter exercises there are in all. */
    total: number;
}

/**
 * "Import starter library": adds the exercises the plan templates use and the library lacks, so templates can fill
 * in their exercises. Shows what was created, skipped and refused.
 */
export function StarterLibraryImport({ missing, total }: StarterLibraryImportProps) {
    const t = useT();
    const toast = useToast();
    const [result, setResult] = useState<{ message: string; data: StarterImportResult } | null>(null);
    const run = useConfirmAction(() => importStarterLibrary(), {
        onSuccess: (state) => {
            if (state.data) setResult({ message: state.message ?? t("screens.misc.library.importFinished"), data: state.data });
            toast({ title: state.message ?? t("screens.misc.library.importFinished"), tone: state.data && state.data.failed.length > 0 ? "warning" : "success" });
        },
    });

    return (
        <div className="flex flex-col gap-3">
            {result ? (
                <ImportResult {...result} t={t} />
            ) : (
                missing.length > 0 && (
                    <Callout
                        tone="info"
                        icon={LibraryBig}
                        title={t("screens.misc.library.importTitle")}
                        action={
                            <Button variant="secondary" size="sm" onClick={() => run.request(undefined)}>
                                {t("screens.misc.library.importButton", { exercises: exercises(t, missing.length) })}
                            </Button>
                        }
                    >
                        {missing.length === total
                            ? t("screens.misc.library.allMissing", { exercises: exercises(t, total) })
                            : t("screens.misc.library.someMissing", { missing: missing.length, total })}{" "}
                        {t("screens.misc.library.importThem")}
                    </Callout>
                )
            )}
            <ConfirmDialog
                {...run.dialogProps}
                tone="primary"
                title={t("screens.misc.library.confirmTitle", { exercises: exercises(t, missing.length) })}
                description={t("screens.misc.library.confirmDescription")}
                confirmLabel={t("screens.misc.library.confirmLabel")}
            >
                <ul className="mt-3 max-h-48 list-disc overflow-y-auto pl-5 text-[13px] text-fg-muted">
                    {missing.map((name) => (
                        <li key={name}>{name}</li>
                    ))}
                </ul>
            </ConfirmDialog>
        </div>
    );
}

function ImportResult({ message, data, t }: { message: string; data: StarterImportResult; t: Translator }) {
    const failed = data.failed.length > 0;
    return (
        <Callout tone={failed ? "warning" : "success"} icon={failed ? CircleAlert : CircleCheck} title={message} role="status">
            <p>
                {t("screens.misc.library.result", { created: exercises(t, data.created.length), skipped: data.skipped.length, failed: data.failed.length })}
            </p>
            {failed && (
                <ul className="mt-2 flex flex-col gap-1">
                    {data.failed.map((failure) => (
                        <li key={failure.name}>
                            <span className="font-medium text-fg">{failure.name}:</span> {failure.message}
                        </li>
                    ))}
                </ul>
            )}
            {data.created.length > 0 && (
                <details className="mt-2">
                    <summary className="cursor-pointer text-fg">{t("screens.misc.library.showCreated")}</summary>
                    <p className="mt-1">{data.created.join(", ")}</p>
                </details>
            )}
        </Callout>
    );
}
