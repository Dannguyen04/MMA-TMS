"use client";

import { Check, LibraryBig, Plus, Search, X } from "lucide-react";
import { useId, useRef, useState } from "react";

import { InlineNote } from "@/components/dashboard/inline-note";
import { TermHint } from "@/components/domain/term-hint";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { EXERCISE_CATEGORY_LABELS } from "@/lib/domain/labels";
import type { Exercise } from "@/lib/domain/types";
import { foldName } from "@/lib/query";
import { cn } from "@/lib/utils";
import { draftFromLibrary, sentDrafts, type PlanExerciseDraft } from "./plan-drafts";

export interface PlanExerciseRowsProps {
    /** Prefix for control ids, unique on the page. */
    idPrefix: string;
    rows: PlanExerciseDraft[];
    onChange(rows: PlanExerciseDraft[]): void;
    library: Exercise[];
    /** The form's error lookup; row errors are named `exercises.<sent row>.<field>`. */
    error(name: string): string | undefined;
    markEdited(nameOrPrefix: string): void;
    /** Shown when there are no rows yet. */
    emptyText?: string;
}

type NumberField = "sets" | "reps" | "durationMin" | "targetRpe";

const NUMBER_FIELDS: { field: NumberField; label: string; max: number }[] = [
    { field: "sets", label: "Sets", max: 20 },
    { field: "reps", label: "Reps", max: 200 },
    { field: "durationMin", label: "Min", max: 240 },
    { field: "targetRpe", label: "RPE", max: 10 },
];

const MAX_RESULTS = 8;

/**
 * Exercise rows with a compact prescription each (sets, reps, minutes, RPE, a note), plus a search over the library
 * to add more. Rows a template names but the library lacks are shown and skipped. Nothing here is submitted on its
 * own: the parent serializes the rows into one hidden field.
 */
export function PlanExerciseRows({ idPrefix, rows, onChange, library, error, markEdited, emptyText }: PlanExerciseRowsProps) {
    const sentIndex = new Map(sentDrafts(rows).map((row, index) => [row.key, index]));
    const missing = rows.filter((row) => row.exerciseId === null);
    const keySeq = useRef(0);

    const update = (key: string, patch: Partial<PlanExerciseDraft>) => {
        onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
        markEdited("exercises");
    };
    const remove = (key: string) => {
        onChange(rows.filter((row) => row.key !== key));
        markEdited("exercises");
    };
    const add = (exercise: Exercise) => {
        keySeq.current += 1;
        onChange([...rows, draftFromLibrary(exercise, `${idPrefix}-added-${keySeq.current}-${exercise.id}`)]);
        markEdited("exercises");
    };

    return (
        <div className="flex flex-col gap-4">
            {rows.length > 0 && (
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-fg-muted">
                    <span>Leave anything you don&apos;t prescribe empty.</span>
                    <span className="inline-flex items-center gap-0.5">
                        Sets <TermHint term="sets" />
                    </span>
                    <span className="inline-flex items-center gap-0.5">
                        Reps <TermHint term="reps" />
                    </span>
                    <span className="inline-flex items-center gap-0.5">
                        Min <TermHint term="exerciseMinutes" />
                    </span>
                    <span className="inline-flex items-center gap-0.5">
                        RPE <TermHint term="rpe" />
                    </span>
                </p>
            )}

            {missing.length > 0 && (
                <InlineNote icon={LibraryBig} tone="warning">
                    {missing.length === 1 ? "One exercise isn't" : `${missing.length} exercises aren't`} in the exercise library yet, so{" "}
                    {missing.length === 1 ? "it's" : "they're"} skipped. An administrator can add {missing.length === 1 ? "it" : "them"} from the exercise
                    library page.
                </InlineNote>
            )}

            {rows.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-fg-muted">{emptyText ?? "No exercises yet. Add some from the library below."}</p>
            ) : (
                <ol className="flex flex-col divide-y divide-border rounded-lg border border-border">
                    {rows.map((row) => (
                        <PlanExerciseRow
                            key={row.key}
                            idPrefix={idPrefix}
                            row={row}
                            sentIndex={sentIndex.get(row.key)}
                            error={error}
                            onUpdate={(patch) => update(row.key, patch)}
                            onRemove={() => remove(row.key)}
                        />
                    ))}
                </ol>
            )}

            <LibraryPicker idPrefix={idPrefix} library={library} addedIds={new Set(rows.filter((row) => row.included && row.exerciseId).map((row) => row.exerciseId as string))} onAdd={add} />
        </div>
    );
}

function PlanExerciseRow({
    idPrefix,
    row,
    sentIndex,
    error,
    onUpdate,
    onRemove,
}: {
    idPrefix: string;
    row: PlanExerciseDraft;
    sentIndex: number | undefined;
    error(name: string): string | undefined;
    onUpdate(patch: Partial<PlanExerciseDraft>): void;
    onRemove(): void;
}) {
    const id = `${idPrefix}-${row.key}`;
    const inLibrary = row.exerciseId !== null;
    const errorFor = (field: string) => (sentIndex === undefined ? undefined : error(`exercises.${sentIndex}.${field}`));
    const messages = [...NUMBER_FIELDS.map(({ field }) => errorFor(field)), errorFor("notes"), errorFor("exerciseId")].filter((message): message is string => Boolean(message));
    const errorId = `${id}-error`;

    return (
        <li className={cn("flex flex-col gap-3 px-3 py-3 sm:px-4", !row.included && "bg-surface-muted/60")}>
            <div className="flex items-start gap-3">
                <input
                    id={`${id}-included`}
                    type="checkbox"
                    checked={row.included}
                    disabled={!inLibrary}
                    onChange={(event) => onUpdate({ included: event.target.checked })}
                    className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-control-border accent-[var(--primary)] disabled:cursor-not-allowed"
                />
                <label htmlFor={`${id}-included`} className={cn("min-w-0 flex-1", inLibrary ? "cursor-pointer" : "cursor-not-allowed")}>
                    <span className={cn("block text-sm font-medium", row.included ? "text-fg" : "text-fg-muted")}>{row.name}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[13px] text-fg-muted">
                        {row.categoryLabel}
                        {!inLibrary && (
                            <Badge tone="warning" size="sm" icon={LibraryBig}>
                                Not in library
                            </Badge>
                        )}
                        {inLibrary && !row.included && <span className="text-fg-subtle">· Left out</span>}
                    </span>
                </label>
                <Button variant="ghost" size="icon-sm" onClick={onRemove} aria-label={`Remove ${row.name}`} className="-mt-1 -mr-1 hover:text-danger-fg">
                    <X aria-hidden />
                </Button>
            </div>

            {inLibrary && row.included && (
                <div className="flex flex-col gap-2 pl-7">
                    <div className="grid grid-cols-4 gap-2 sm:max-w-md">
                        {NUMBER_FIELDS.map(({ field, label, max }) => {
                            const controlId = `${id}-${field}`;
                            return (
                                <div key={field} className="flex min-w-0 flex-col gap-1">
                                    <label htmlFor={controlId} className="text-xs font-medium text-fg-muted">
                                        {label}
                                        <span className="sr-only"> for {row.name}</span>
                                    </label>
                                    <Input
                                        id={controlId}
                                        type="number"
                                        inputMode="numeric"
                                        min={1}
                                        max={max}
                                        step={1}
                                        value={row[field]}
                                        onChange={(event) => onUpdate({ [field]: event.target.value })}
                                        aria-invalid={errorFor(field) ? true : undefined}
                                        aria-describedby={errorFor(field) ? errorId : undefined}
                                        className="h-8 px-2"
                                    />
                                </div>
                            );
                        })}
                    </div>
                    <label htmlFor={`${id}-notes`} className="sr-only">
                        Notes for {row.name}
                    </label>
                    <Input
                        id={`${id}-notes`}
                        value={row.notes}
                        onChange={(event) => onUpdate({ notes: event.target.value })}
                        placeholder="Note for the fighter (optional)"
                        maxLength={500}
                        aria-invalid={errorFor("notes") ? true : undefined}
                        aria-describedby={errorFor("notes") ? errorId : undefined}
                        className="h-8 px-2"
                    />
                    {messages.length > 0 && (
                        <p id={errorId} className="text-[13px] font-medium text-danger-fg">
                            {[...new Set(messages)].join(" ")}
                        </p>
                    )}
                </div>
            )}
        </li>
    );
}

/** Search the library and add exercises one tap at a time. */
function LibraryPicker({ idPrefix, library, addedIds, onAdd }: { idPrefix: string; library: Exercise[]; addedIds: Set<string>; onAdd(exercise: Exercise): void }) {
    const [query, setQuery] = useState("");
    const searchId = useId();
    const resultsId = `${idPrefix}-library-results`;

    if (library.length === 0) {
        return (
            <InlineNote icon={LibraryBig}>
                The exercise library is empty, so there&apos;s nothing to add yet. An administrator can import the starter library from the exercise library page.
            </InlineNote>
        );
    }

    const needle = foldName(query);
    const matches = needle ? library.filter((exercise) => foldName(`${exercise.name} ${EXERCISE_CATEGORY_LABELS[exercise.category]}`).includes(needle)) : [];
    const shown = matches.slice(0, MAX_RESULTS);

    return (
        <div className="flex flex-col gap-2 rounded-lg bg-surface-muted p-3">
            <label htmlFor={searchId} className="text-sm font-medium text-fg">
                Add from the library
            </label>
            <div className="relative">
                <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" />
                <Input
                    id={searchId}
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                        // Enter adds the only match instead of moving to the next step.
                        if (event.key !== "Enter") return;
                        event.preventDefault();
                        const only = shown.length === 1 ? shown[0] : undefined;
                        if (only && !addedIds.has(only.id)) onAdd(only);
                    }}
                    placeholder={`Search ${library.length} exercises`}
                    aria-controls={resultsId}
                    autoComplete="off"
                    className="pl-9"
                />
            </div>
            <div id={resultsId} aria-live="polite">
                {needle && shown.length === 0 && <p className="px-1 py-1 text-[13px] text-fg-muted">No exercise matches &ldquo;{query.trim()}&rdquo;.</p>}
                {shown.length > 0 && (
                    <ul className="flex flex-col gap-1" aria-label="Matching exercises">
                        {shown.map((exercise) => {
                            const added = addedIds.has(exercise.id);
                            return (
                                <li key={exercise.id} className="flex items-center justify-between gap-3 rounded-md bg-surface px-3 py-1.5">
                                    <span className="min-w-0">
                                        <span className="block truncate text-sm text-fg">{exercise.name}</span>
                                        <span className="block text-xs text-fg-muted">{EXERCISE_CATEGORY_LABELS[exercise.category]}</span>
                                    </span>
                                    <Button variant="secondary" size="sm" disabled={added} onClick={() => onAdd(exercise)} aria-label={added ? `${exercise.name} added` : `Add ${exercise.name}`}>
                                        {added ? <Check aria-hidden /> : <Plus aria-hidden />}
                                        {added ? "Added" : "Add"}
                                    </Button>
                                </li>
                            );
                        })}
                        {matches.length > shown.length && (
                            <li className="px-1 text-xs text-fg-subtle">{matches.length - shown.length} more. Keep typing to narrow the list.</li>
                        )}
                    </ul>
                )}
            </div>
        </div>
    );
}
