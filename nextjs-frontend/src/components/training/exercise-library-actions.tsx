"use client";

import { CircleAlert, CircleCheck, LibraryBig, Plus } from "lucide-react";
import { useState } from "react";

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
import { pluralize } from "@/lib/format";
import { Callout } from "./callout";

const CATEGORY_OPTIONS = SERVICE_EXERCISE_CATEGORIES.map((value) => ({ value, label: EXERCISE_CATEGORY_LABELS[EXERCISE_CATEGORY_FOR[value]] }));

/** "Add exercise": one exercise for the global library, in the training service's fields. */
export function AddExerciseButton() {
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
                Add exercise
            </Button>
            <ActionDialog
                open={open}
                onClose={() => setOpen(false)}
                title="Add an exercise"
                description="Coaches can add it to their plans straight away."
                action={(previous: ActionState, fd: FormData) => createLibraryExercise(previous, fd)}
                submitLabel="Add exercise"
                pendingLabel="Adding…"
                onSuccess={(state) => toast({ title: state.message ?? "Exercise added." })}
            >
                {(form) => (
                    <>
                        <Field label="Name" htmlFor={form.control("name").id} required error={form.error("name")}>
                            <Input {...form.control("name", { required: true })} maxLength={120} placeholder="e.g. Jab–cross–hook pad drill" />
                        </Field>
                        <ChoiceGroup
                            id={form.control("category").id}
                            name="category"
                            legend="Category"
                            required
                            variant="compact"
                            columns={2}
                            options={CATEGORY_OPTIONS}
                            value={category}
                            onChange={setCategory}
                            error={form.error("category")}
                        />
                        <Field label="Description" htmlFor={form.control("description").id} optional error={form.error("description")}>
                            <Textarea {...form.control("description")} rows={3} maxLength={1000} />
                        </Field>
                        <Field
                            label="Muscle groups"
                            htmlFor={form.control("targetMuscleGroups").id}
                            optional
                            hint="Separate with commas, e.g. shoulders, core."
                            error={form.error("targetMuscleGroups")}
                        >
                            <Input {...form.control("targetMuscleGroups", { hint: true })} maxLength={300} />
                        </Field>
                        <Field label="Video link" htmlFor={form.control("videoUrl").id} optional hint="A demonstration coaches can open." error={form.error("videoUrl")}>
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
    const toast = useToast();
    const [result, setResult] = useState<{ message: string; data: StarterImportResult } | null>(null);
    const run = useConfirmAction(() => importStarterLibrary(), {
        onSuccess: (state) => {
            if (state.data) setResult({ message: state.message ?? "Import finished.", data: state.data });
            toast({ title: state.message ?? "Import finished.", tone: state.data && state.data.failed.length > 0 ? "warning" : "success" });
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
                        title="Import the starter library"
                        action={
                            <Button variant="secondary" size="sm" onClick={() => run.request(undefined)}>
                                Import {pluralize(missing.length, "exercise")}
                            </Button>
                        }
                    >
                        {missing.length === total
                            ? `The plan templates use ${pluralize(total, "exercise")} the library doesn't have yet.`
                            : `${missing.length} of the ${total} exercises the plan templates use aren't in the library yet.`}{" "}
                        Import them so templates fill in their exercises for coaches.
                    </Callout>
                )
            )}
            <ConfirmDialog
                {...run.dialogProps}
                tone="primary"
                title={`Import ${pluralize(missing.length, "exercise")}?`}
                description="Each one is added to the global library, where every coach can use it. Exercises already in the library, matched by name, are skipped."
                confirmLabel="Import"
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
    const failed = data.failed.length > 0;
    return (
        <Callout tone={failed ? "warning" : "success"} icon={failed ? CircleAlert : CircleCheck} title={message} role="status">
            <p>
                {pluralize(data.created.length, "exercise")} created · {data.skipped.length} already in the library · {data.failed.length} failed
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
                    <summary className="cursor-pointer text-fg">Show what was created</summary>
                    <p className="mt-1">{data.created.join(", ")}</p>
                </details>
            )}
        </Callout>
    );
}
