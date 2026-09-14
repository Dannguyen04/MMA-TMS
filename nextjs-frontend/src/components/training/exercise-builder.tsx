"use client";

import { ArrowDown, ArrowUp, ListPlus, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, fieldDescribedBy } from "@/components/ui/form";
import { EXERCISE_CATEGORY_LABELS, INTENSITY_LABELS } from "@/lib/domain/labels";
import type { BodyRegion, Exercise, ExerciseCategory, Technique } from "@/lib/domain/types";
import { formatClock } from "@/lib/format";
import { groupBy } from "@/lib/utils";
import { numberOrEmpty, type ExerciseRow } from "./exercise-rows";
import { isRoundBased } from "./training-utils";

export interface ExerciseBuilderProps {
    library: Exercise[];
    rows: ExerciseRow[];
    onChange: (rows: ExerciseRow[]) => void;
    /** Server field error for a name like "exercises" or "exercises.0.rounds" (hidden once edited). */
    error: (name: string) => string | undefined;
    /** Tells the form which errors are stale: "exercises" after add/remove/move, the row field after an edit. */
    markEdited: (name: string) => void;
    /** From the fighter's Medical Clearance, to flag exercises that touch a restriction. */
    restrictedTechniques: Technique[];
    restrictedRegions: BodyRegion[];
}

const CATEGORY_OPTIONS = Object.entries(EXERCISE_CATEGORY_LABELS) as [ExerciseCategory, string][];

/** Pick drills from the exercise library, set their volume, reorder and remove them. */
export function ExerciseBuilder({ library, rows, onChange, error: errorFor, markEdited, restrictedTechniques, restrictedRegions }: ExerciseBuilderProps) {
    const [category, setCategory] = useState<ExerciseCategory | "">("");
    const [pick, setPick] = useState("");
    const [announcement, setAnnouncement] = useState("");
    const byId = Object.fromEntries(library.map((exercise) => [exercise.id, exercise]));
    const used = new Set(rows.map((row) => row.exerciseId));
    const available = library.filter((exercise) => !used.has(exercise.id) && (!category || exercise.category === category));
    const groups = groupBy(available, (exercise) => exercise.category);

    const focus = (id: string, fallbackId?: string) =>
        window.requestAnimationFrame(() => {
            const target = document.getElementById(id) as HTMLButtonElement | null;
            const element = target && !target.disabled ? target : fallbackId ? document.getElementById(fallbackId) : null;
            element?.focus();
        });

    const changeRows = (next: ExerciseRow[]) => {
        onChange(next);
        markEdited("exercises");
    };

    const add = () => {
        const exercise = byId[pick];
        if (!exercise) return;
        const rounds = isRoundBased(exercise);
        changeRows([
            ...rows,
            {
                key: `${exercise.id}-${Date.now().toString(36)}`,
                exerciseId: exercise.id,
                rounds: rounds ? numberOrEmpty(exercise.defaultRounds ?? 3) : "",
                roundSec: rounds ? numberOrEmpty(exercise.defaultRoundSec ?? 180) : "",
                sets: rounds ? "" : numberOrEmpty(exercise.defaultSets),
                reps: rounds ? "" : numberOrEmpty(exercise.defaultReps),
                notes: "",
            },
        ]);
        setPick("");
        setAnnouncement(`Added ${exercise.name}. ${rows.length + 1} exercises in the session.`);
    };

    const update = (index: number, field: "rounds" | "roundSec" | "sets" | "reps" | "notes", value: string) => {
        onChange(rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
        markEdited(`exercises.${index}.${field}`);
    };

    const move = (index: number, direction: -1 | 1) => {
        const target = index + direction;
        if (target < 0 || target >= rows.length) return;
        const next = [...rows];
        [next[index], next[target]] = [next[target], next[index]];
        changeRows(next);
        const row = rows[index];
        setAnnouncement(`${byId[row.exerciseId]?.name ?? "Exercise"} moved to position ${target + 1} of ${rows.length}.`);
        focus(`${row.key}-${direction === -1 ? "up" : "down"}`, `${row.key}-${direction === -1 ? "down" : "up"}`);
    };

    const remove = (index: number) => {
        const row = rows[index];
        changeRows(rows.filter((_, i) => i !== index));
        setAnnouncement(`Removed ${byId[row.exerciseId]?.name ?? "exercise"}. ${rows.length - 1} exercises in the session.`);
        focus("exercise-pick");
    };

    return (
        <fieldset className="@container flex min-w-0 flex-col gap-3">
            <legend className="mb-1.5 text-sm font-medium text-fg">
                Exercises <span className="ml-1 text-xs font-normal text-fg-subtle">(optional)</span>
            </legend>

            <div className="grid grid-cols-1 gap-3 rounded-lg bg-surface-muted/70 p-3 @md:grid-cols-[minmax(0,10rem)_minmax(0,1fr)] @3xl:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_auto] @3xl:items-end">
                <div className="flex min-w-0 flex-col gap-1.5">
                    <label htmlFor="exercise-category" className="text-[13px] font-medium text-fg-muted">
                        Category
                    </label>
                    <Select
                        id="exercise-category"
                        value={category}
                        onChange={(event) => {
                            setCategory(event.target.value as ExerciseCategory | "");
                            setPick("");
                        }}
                    >
                        <option value="">All categories</option>
                        {CATEGORY_OPTIONS.map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </Select>
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                    <label htmlFor="exercise-pick" className="text-[13px] font-medium text-fg-muted">
                        Exercise library
                    </label>
                    <Select id="exercise-pick" value={pick} onChange={(event) => setPick(event.target.value)}>
                        <option value="">{available.length === 0 ? "No more exercises in this category" : "Choose an exercise…"}</option>
                        {(Object.entries(groups) as [ExerciseCategory, Exercise[]][]).map(([group, exercises]) => (
                            <optgroup key={group} label={EXERCISE_CATEGORY_LABELS[group]}>
                                {exercises.map((exercise) => (
                                    <option key={exercise.id} value={exercise.id}>
                                        {exercise.name}
                                    </option>
                                ))}
                            </optgroup>
                        ))}
                    </Select>
                </div>
                <Button variant="secondary" onClick={add} disabled={!pick} className="@md:col-span-2 @md:justify-self-end @3xl:col-span-1">
                    <Plus aria-hidden />
                    Add exercise
                </Button>
            </div>

            {errorFor("exercises") && <p className="text-[13px] font-medium text-danger-fg">{errorFor("exercises")}</p>}

            {rows.length === 0 ? (
                <div className="flex items-center gap-3 rounded-lg border border-dashed border-border-strong px-4 py-4 text-[13px] text-fg-muted">
                    <ListPlus aria-hidden className="size-5 shrink-0 text-fg-subtle" />
                    <p>No exercises yet. Add drills from the library — their techniques and loaded body areas are checked against the Medical Clearance.</p>
                </div>
            ) : (
                <ol className="flex flex-col gap-2">
                    {rows.map((row, index) => {
                        const exercise = byId[row.exerciseId];
                        const name = exercise?.name ?? "Unknown exercise";
                        const rounds = exercise ? isRoundBased(exercise) : row.rounds !== "";
                        const touchesRestriction =
                            exercise !== undefined &&
                            (exercise.techniques.some((t) => restrictedTechniques.includes(t)) || exercise.loadsRegions.some((r) => restrictedRegions.includes(r)));
                        const fieldId = (field: string) => `${row.key}-${field}`;
                        const error = (field: string) => errorFor(`exercises.${index}.${field}`);
                        const numberInput = (field: "rounds" | "roundSec" | "sets" | "reps", label: string, min: number, max: number, hint?: string) => (
                            <div className="flex min-w-0 flex-col gap-1">
                                <label htmlFor={fieldId(field)} className="text-xs font-medium text-fg-muted">
                                    {label}
                                </label>
                                <Input
                                    id={fieldId(field)}
                                    type="number"
                                    inputMode="numeric"
                                    min={min}
                                    max={max}
                                    step={1}
                                    value={row[field]}
                                    onChange={(event) => update(index, field, event.target.value)}
                                    aria-invalid={Boolean(error(field)) || undefined}
                                    aria-describedby={fieldDescribedBy(fieldId(field), { hint, error: error(field) })}
                                    className="h-8"
                                />
                                {hint && !error(field) && (
                                    <p id={`${fieldId(field)}-hint`} className="text-xs text-fg-subtle">
                                        {hint}
                                    </p>
                                )}
                                {error(field) && (
                                    <p id={`${fieldId(field)}-error`} className="text-xs font-medium text-danger-fg">
                                        {error(field)}
                                    </p>
                                )}
                            </div>
                        );
                        const roundSeconds = Number(row.roundSec);

                        return (
                            <li key={row.key} className="rounded-lg border border-border bg-surface p-3">
                                <div className="flex items-start gap-3">
                                    <span aria-hidden className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-surface-muted text-xs font-semibold text-fg-muted">
                                        {index + 1}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-fg">
                                            <span className="sr-only">Exercise {index + 1}: </span>
                                            {name}
                                        </p>
                                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                            {exercise && (
                                                <span className="text-xs text-fg-muted">
                                                    {EXERCISE_CATEGORY_LABELS[exercise.category]} · {INTENSITY_LABELS[exercise.intensity]} intensity
                                                </span>
                                            )}
                                            {touchesRestriction && (
                                                <Badge tone="warning" size="sm" icon={ShieldAlert}>
                                                    Touches a restriction
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-0.5">
                                        <Button
                                            id={fieldId("up")}
                                            variant="ghost"
                                            size="icon-sm"
                                            onClick={() => move(index, -1)}
                                            disabled={index === 0}
                                            aria-label={`Move ${name} up`}
                                        >
                                            <ArrowUp />
                                        </Button>
                                        <Button
                                            id={fieldId("down")}
                                            variant="ghost"
                                            size="icon-sm"
                                            onClick={() => move(index, 1)}
                                            disabled={index === rows.length - 1}
                                            aria-label={`Move ${name} down`}
                                        >
                                            <ArrowDown />
                                        </Button>
                                        <Button variant="ghost" size="icon-sm" onClick={() => remove(index)} aria-label={`Remove ${name}`} className="hover:text-danger-fg">
                                            <Trash2 />
                                        </Button>
                                    </div>
                                </div>
                                <div className="mt-3 grid grid-cols-2 gap-3 @md:grid-cols-[minmax(0,6rem)_minmax(0,7rem)_minmax(0,1fr)]">
                                    {rounds ? (
                                        <>
                                            {numberInput("rounds", "Rounds", 1, 30)}
                                            {numberInput(
                                                "roundSec",
                                                "Round (sec)",
                                                10,
                                                1800,
                                                roundSeconds >= 10 ? `${formatClock(roundSeconds)} per round` : undefined,
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            {numberInput("sets", "Sets", 1, 20)}
                                            {numberInput("reps", "Reps", 1, 200)}
                                        </>
                                    )}
                                    <div className="col-span-2 flex min-w-0 flex-col gap-1 @md:col-span-1">
                                        <label htmlFor={fieldId("notes")} className="text-xs font-medium text-fg-muted">
                                            Notes <span className="font-normal text-fg-subtle">(optional)</span>
                                        </label>
                                        <Input
                                            id={fieldId("notes")}
                                            value={row.notes}
                                            onChange={(event) => update(index, "notes", event.target.value)}
                                            maxLength={300}
                                            placeholder="e.g. Southpaw feeds only"
                                            aria-invalid={Boolean(error("notes")) || undefined}
                                            aria-describedby={fieldDescribedBy(fieldId("notes"), { error: error("notes") })}
                                            className="h-8"
                                        />
                                        {error("notes") && (
                                            <p id={`${fieldId("notes")}-error`} className="text-xs font-medium text-danger-fg">
                                                {error("notes")}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ol>
            )}
            <p aria-live="polite" className="sr-only">
                {announcement}
            </p>
        </fieldset>
    );
}
