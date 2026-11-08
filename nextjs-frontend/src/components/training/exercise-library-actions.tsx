"use client";

import { CircleAlert, CircleCheck, LibraryBig, Plus } from "lucide-react";
import { useState } from "react";

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
import { EXERCISE_CATEGORY_LABELS } from "@/lib/domain/labels";
import { EXERCISE_CATEGORY_FOR, SERVICE_EXERCISE_CATEGORIES, type ServiceExerciseCategory } from "@/lib/domain/training-contract";
import { plural } from "@/lib/i18n/translate";
import { Callout } from "./callout";

const CATEGORY_OPTIONS = SERVICE_EXERCISE_CATEGORIES.map((value) => ({ value, label: EXERCISE_CATEGORY_LABELS[EXERCISE_CATEGORY_FOR[value]] }));

/** "Add exercise": one exercise for the global library, in the training service's fields. */
export function AddExerciseButton() {
    const t = useT();
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
                {t("adminForms.addExercise")}
            </Button>
            <ActionDialog
                open={open}
                onClose={() => setOpen(false)}
                title={t("adminForms.addExerciseTitle")}
                description={t("adminForms.addExerciseDesc")}
                action={(previous: ActionState, fd: FormData) => createLibraryExercise(previous, fd)}
                submitLabel={t("adminForms.addExercise")}
                pendingLabel={t("adminForms.adding")}
                onSuccess={(state) => toast({ title: state.message ?? t("adminForms.exerciseAdded") })}
            >
                {(form) => (
                    <>
                        <Field label={t("adminForms.exerciseName")} htmlFor={form.control("name").id} required error={form.error("name")}>
                            <Input {...form.control("name", { required: true })} maxLength={120} placeholder={t("adminForms.exercisePh")} />
                        </Field>
                        <ChoiceGroup
                            id={form.control("category").id}
                            name="category"
                            legend={t("adminForms.category")}
                            required
                            variant="compact"
                            columns={2}
                            options={CATEGORY_OPTIONS}
                            value={category}
                            onChange={setCategory}
                            error={form.error("category")}
                        />
                        <Field label={t("adminForms.description")} htmlFor={form.control("description").id} optional error={form.error("description")}>
                            <Textarea {...form.control("description")} rows={3} maxLength={1000} />
                        </Field>
                        <Field
                            label={t("adminForms.muscles")}
                            htmlFor={form.control("targetMuscleGroups").id}
                            optional
                            hint={t("adminForms.musclesHint")}
                            error={form.error("targetMuscleGroups")}
                        >
                            <Input {...form.control("targetMuscleGroups", { hint: true })} maxLength={300} />
                        </Field>
                        <Field label={t("adminForms.videoLink")} htmlFor={form.control("videoUrl").id} optional hint={t("adminForms.videoHint")} error={form.error("videoUrl")}>
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
            if (state.data) setResult({ message: state.message ?? t("adminForms.importDone"), data: state.data });
            toast({ title: state.message ?? t("adminForms.importDone"), tone: state.data && state.data.failed.length > 0 ? "warning" : "success" });
        },
    });

    return (
        <div className="flex flex-col gap-3">
            {result ? (
                <ImportResult {...result} />
            ) : (
                missing.length > 0 && (
                    <Callout
                        tone="info"
                        icon={LibraryBig}
                        title={t("adminForms.importTitle")}
                        action={
                            <Button variant="secondary" size="sm" onClick={() => run.request(undefined)}>
                                {plural(t, "adminForms.importN", missing.length)}
                            </Button>
                        }
                    >
                        {missing.length === total ? t("adminForms.importAll", { n: total }) : t("adminForms.importSome", { missing: missing.length, total })}{" "}
                        {t("adminForms.importTail")}
                    </Callout>
                )
            )}
            <ConfirmDialog
                {...run.dialogProps}
                tone="primary"
                title={plural(t, "adminForms.importAsk", missing.length)}
                description={t("adminForms.importDesc")}
                confirmLabel={t("adminForms.import")}
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

function ImportResult({ message, data }: { message: string; data: StarterImportResult }) {
    const t = useT();
    const failed = data.failed.length > 0;
    return (
        <Callout tone={failed ? "warning" : "success"} icon={failed ? CircleAlert : CircleCheck} title={message} role="status">
            <p>
                {t("adminForms.importSummary", { created: data.created.length, skipped: data.skipped.length, failed: data.failed.length })}
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
                    <summary className="cursor-pointer text-fg">{t("adminForms.showCreated")}</summary>
                    <p className="mt-1">{data.created.join(", ")}</p>
                </details>
            )}
        </Callout>
    );
}
