"use client";

import { Check, LibraryBig, Plus, Search, X } from "lucide-react";
import { useId, useRef, useState } from "react";

import { InlineNote } from "@/components/dashboard/inline-note";
import { useLocale, useT } from "@/components/i18n/locale-provider";
import { TermHint } from "@/components/domain/term-hint";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { exerciseCategoryLabel } from "@/lib/domain/labels";
import type { Exercise } from "@/lib/domain/types";
import type { MessageKey } from "@/lib/i18n/translate";
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

const NUMBER_FIELDS: { field: NumberField; label: MessageKey; max: number }[] = [
    { field: "sets", label: "screens.training.exerciseRows.sets", max: 20 },
    { field: "reps", label: "screens.training.exerciseRows.reps", max: 200 },
    { field: "durationMin", label: "screens.training.exerciseRows.min", max: 240 },
    { field: "targetRpe", label: "screens.training.exerciseRows.rpe", max: 10 },
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
    const t = useT();
    const locale = useLocale();

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
        onChange([...rows, draftFromLibrary(exercise, `${idPrefix}-added-${keySeq.current}-${exercise.id}`, t)]);
        markEdited("exercises");
    };

    return (
        <div className="flex flex-col gap-4">
            {rows.length > 0 && (
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-fg-muted">
                    <span>{t("screens.training.exerciseRows.leaveEmpty")}</span>
                    <span className="inline-flex items-center gap-0.5">
                        {t("screens.training.exerciseRows.sets")} <TermHint term="sets" locale={locale} />
                    </span>
                    <span className="inline-flex items-center gap-0.5">
                        {t("screens.training.exerciseRows.reps")} <TermHint term="reps" locale={locale} />
                    </span>
                    <span className="inline-flex items-center gap-0.5">
                        {t("screens.training.exerciseRows.min")} <TermHint term="exerciseMinutes" locale={locale} />
                    </span>
                    <span className="inline-flex items-center gap-0.5">
                        {t("screens.training.exerciseRows.rpe")} <TermHint term="rpe" locale={locale} />
                    </span>
                </p>
            )}

            {missing.length > 0 && (
                <InlineNote icon={LibraryBig} tone="warning">
                    {missing.length === 1 ? t("screens.training.exerciseRows.missing.one") : t("screens.training.exerciseRows.missing", { n: missing.length })}
                </InlineNote>
            )}

            {rows.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-fg-muted">{emptyText ?? t("screens.training.exerciseRows.empty")}</p>
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
    const t = useT();

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
                                {t("screens.training.exerciseRows.notInLibrary")}
                            </Badge>
                        )}
                        {inLibrary && !row.included && <span className="text-fg-subtle">· {t("screens.training.exerciseRows.leftOut")}</span>}
                    </span>
                </label>
                <Button variant="ghost" size="icon-sm" onClick={onRemove} aria-label={t("screens.training.exerciseRows.remove", { name: row.name })} className="-mt-1 -mr-1 hover:text-danger-fg">
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
                                        {t(label)}
                                        <span className="sr-only"> {t("screens.training.exerciseRows.forName", { name: row.name })}</span>
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
                        {t("screens.training.exerciseRows.notesFor", { name: row.name })}
                    </label>
                    <Input
                        id={`${id}-notes`}
                        value={row.notes}
                        onChange={(event) => onUpdate({ notes: event.target.value })}
                        placeholder={t("screens.training.exerciseRows.notePlaceholder")}
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
    const t = useT();

    if (library.length === 0) {
        return (
            <InlineNote icon={LibraryBig}>
                {t("screens.training.exerciseRows.libraryEmpty")}
            </InlineNote>
        );
    }

    const needle = foldName(query);
    const matches = needle ? library.filter((exercise) => foldName(`${exercise.name} ${exerciseCategoryLabel(t, exercise.category)}`).includes(needle)) : [];
    const shown = matches.slice(0, MAX_RESULTS);

    return (
        <div className="flex flex-col gap-2 rounded-lg bg-surface-muted p-3">
            <label htmlFor={searchId} className="text-sm font-medium text-fg">
                {t("screens.training.exerciseRows.addFromLibrary")}
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
                    placeholder={t("screens.training.exerciseRows.search", { n: library.length })}
                    aria-controls={resultsId}
                    autoComplete="off"
                    className="pl-9"
                />
            </div>
            <div id={resultsId} aria-live="polite">
                {needle && shown.length === 0 && <p className="px-1 py-1 text-[13px] text-fg-muted">{t("screens.training.exerciseRows.noMatch", { query: query.trim() })}</p>}
                {shown.length > 0 && (
                    <ul className="flex flex-col gap-1" aria-label={t("screens.training.exerciseRows.matching")}>
                        {shown.map((exercise) => {
                            const added = addedIds.has(exercise.id);
                            return (
                                <li key={exercise.id} className="flex items-center justify-between gap-3 rounded-md bg-surface px-3 py-1.5">
                                    <span className="min-w-0">
                                        <span className="block truncate text-sm text-fg">{exercise.name}</span>
                                        <span className="block text-xs text-fg-muted">{exerciseCategoryLabel(t, exercise.category)}</span>
                                    </span>
                                    <Button variant="secondary" size="sm" disabled={added} onClick={() => onAdd(exercise)} aria-label={added ? t("screens.training.exerciseRows.addedName", { name: exercise.name }) : t("screens.training.exerciseRows.addName", { name: exercise.name })}>
                                        {added ? <Check aria-hidden /> : <Plus aria-hidden />}
                                        {added ? t("screens.training.exerciseRows.added") : t("screens.training.exerciseRows.add")}
                                    </Button>
                                </li>
                            );
                        })}
                        {matches.length > shown.length && (
                            <li className="px-1 text-xs text-fg-subtle">{t("screens.training.exerciseRows.more", { n: matches.length - shown.length })}</li>
                        )}
                    </ul>
                )}
            </div>
        </div>
    );
}
