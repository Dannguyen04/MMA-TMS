import { EXERCISE_CATEGORY_LABELS } from "@/lib/domain/labels";
import { EXERCISE_CATEGORY_FOR, exerciseNameKey } from "@/lib/domain/training-contract";
import { copyTitle, planSpanDays, type PlanTemplate, type TemplateExercise } from "@/lib/domain/training-templates";
import type { Exercise, PlanExercise, TrainingPhase, TrainingPlan } from "@/lib/domain/types";
import { dayKey } from "@/lib/format";
import { numberOrEmpty } from "./exercise-rows";

/**
 * Editable plan-exercise rows for the plan forms, and the plan a coach copies from. Pure helpers, safe on server and
 * client. Values stay strings while the coach edits; the Server Action validates the ranges.
 */

export interface PlanExerciseDraft {
    /** Stable React key. */
    key: string;
    /** Null when the template names an exercise the library doesn't have: shown, never sent. */
    exerciseId: string | null;
    name: string;
    categoryLabel: string;
    /** Ticked rows are added to the plan. */
    included: boolean;
    sets: string;
    reps: string;
    durationMin: string;
    targetRpe: string;
    notes: string;
}

type Prescription = Pick<PlanExercise, "sets" | "reps" | "durationSec" | "targetRpe" | "notes">;

const minutes = (seconds: number | null) => (seconds === null ? "" : String(Math.max(1, Math.round(seconds / 60))));

function prescriptionFields(item: Prescription): Pick<PlanExerciseDraft, "sets" | "reps" | "durationMin" | "targetRpe" | "notes"> {
    return {
        sets: numberOrEmpty(item.sets),
        reps: numberOrEmpty(item.reps),
        durationMin: minutes(item.durationSec),
        targetRpe: numberOrEmpty(item.targetRpe),
        notes: item.notes ?? "",
    };
}

function libraryIndex(library: Pick<Exercise, "id" | "name" | "category">[]) {
    const byName = new Map<string, Pick<Exercise, "id" | "name" | "category">>();
    for (const exercise of library) if (!byName.has(exerciseNameKey(exercise.name))) byName.set(exerciseNameKey(exercise.name), exercise);
    return byName;
}

/** A template's exercises in template order: ticked when the library has them, shown unticked when it doesn't. */
export function draftsFromTemplate(template: Pick<PlanTemplate, "id" | "exercises">, library: Pick<Exercise, "id" | "name" | "category">[]): PlanExerciseDraft[] {
    const byName = libraryIndex(library);
    return template.exercises.map((item: TemplateExercise, index) => {
        const match = byName.get(exerciseNameKey(item.name));
        return {
            key: `${template.id}-${index}`,
            exerciseId: match?.id ?? null,
            name: match?.name ?? item.name,
            categoryLabel: EXERCISE_CATEGORY_LABELS[match?.category ?? EXERCISE_CATEGORY_FOR[item.category]],
            included: match !== undefined,
            ...prescriptionFields(item),
        };
    });
}

/** A library exercise added by the coach, with the library's usual dose when it has one. */
export function draftFromLibrary(exercise: Exercise, key: string): PlanExerciseDraft {
    const rounds = exercise.defaultRounds !== null;
    const roundMinutes = rounds && exercise.defaultRoundSec !== null ? Math.round(((exercise.defaultRounds ?? 0) * exercise.defaultRoundSec) / 60) : null;
    return {
        key,
        exerciseId: exercise.id,
        name: exercise.name,
        categoryLabel: EXERCISE_CATEGORY_LABELS[exercise.category],
        included: true,
        sets: numberOrEmpty(rounds ? exercise.defaultRounds : exercise.defaultSets),
        reps: rounds ? "" : numberOrEmpty(exercise.defaultReps),
        durationMin: roundMinutes ? String(roundMinutes) : "",
        targetRpe: "",
        notes: "",
    };
}

/** Exercises copied from another plan; one the library no longer has is shown unticked. */
export function draftsFromPlanExercises(items: (Prescription & { exerciseId: string })[], library: Pick<Exercise, "id" | "name" | "category">[], keyPrefix = "copy"): PlanExerciseDraft[] {
    const byId = new Map(library.map((exercise) => [exercise.id, exercise]));
    return items.map((item, index) => {
        const exercise = byId.get(item.exerciseId);
        return {
            key: `${keyPrefix}-${index}`,
            exerciseId: exercise ? exercise.id : null,
            name: exercise?.name ?? "Exercise no longer in the library",
            categoryLabel: exercise ? EXERCISE_CATEGORY_LABELS[exercise.category] : "",
            included: exercise !== undefined,
            ...prescriptionFields(item),
        };
    });
}

/** Rows that will be sent: ticked and in the library, in the order shown. */
export function sentDrafts(drafts: PlanExerciseDraft[]): (PlanExerciseDraft & { exerciseId: string })[] {
    return drafts.filter((draft): draft is PlanExerciseDraft & { exerciseId: string } => draft.included && draft.exerciseId !== null);
}

/** The rows as the JSON the plan actions expect. Error paths (`exercises.2.sets`) index into this list. */
export function serializePlanExerciseDrafts(drafts: PlanExerciseDraft[]): string {
    return JSON.stringify(
        sentDrafts(drafts).map((draft) => ({
            exerciseId: draft.exerciseId,
            sets: draft.sets.trim(),
            reps: draft.reps.trim(),
            durationMin: draft.durationMin.trim(),
            targetRpe: draft.targetRpe.trim(),
            notes: draft.notes.trim(),
        })),
    );
}

/* ─── Copying a plan ──────────────────────────────────────────────────────── */

/** What "Copy an existing plan" takes from a plan: its content and length, never its dates or status. */
export interface PlanCopy {
    planId: string;
    title: string;
    phase: TrainingPhase;
    objective: string;
    notes: string;
    /** Days the source plan spans, counting both ends; null for an open-ended plan. */
    days: number | null;
    exercises: (Prescription & { exerciseId: string })[];
}

export function planCopyFrom(plan: TrainingPlan, exercises: PlanExercise[]): PlanCopy {
    return {
        planId: plan.id,
        title: copyTitle(plan.title),
        phase: plan.phase,
        objective: plan.objective,
        notes: plan.notes,
        days: plan.endDate === null ? null : planSpanDays(dayKey(plan.startDate), dayKey(plan.endDate)),
        exercises: [...exercises]
            .sort((left, right) => left.orderIndex - right.orderIndex)
            .map(({ exerciseId, sets, reps, durationSec, targetRpe, notes }) => ({ exerciseId, sets, reps, durationSec, targetRpe, notes })),
    };
}
