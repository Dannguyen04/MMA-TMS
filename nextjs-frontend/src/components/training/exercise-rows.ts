import type { Exercise, SessionExercise } from "@/lib/domain/types";
import { isRoundBased } from "./training-utils";

/** Editable exercise rows for the session form. Pure helpers, safe on server and client. */

export interface ExerciseRow {
    /** Stable React key. */
    key: string;
    exerciseId: string;
    rounds: string;
    roundSec: string;
    sets: string;
    reps: string;
    notes: string;
}

export const numberOrEmpty = (value: number | null) => (value === null ? "" : String(value));

export function rowFromSessionExercise(item: Omit<SessionExercise, "completed">, index: number): ExerciseRow {
    return {
        key: `${item.exerciseId}-${index}`,
        exerciseId: item.exerciseId,
        rounds: numberOrEmpty(item.rounds),
        roundSec: numberOrEmpty(item.roundSec),
        sets: numberOrEmpty(item.sets),
        reps: numberOrEmpty(item.reps),
        notes: item.notes ?? "",
    };
}

function toNumber(value: string): number | null {
    const parsed = Number(value);
    return value.trim() === "" || Number.isNaN(parsed) ? null : parsed;
}

/** Rows as the JSON the session action expects. Empty volume fields are sent as null; the server validates ranges. */
export function serializeExerciseRows(rows: ExerciseRow[], library: Record<string, Exercise>): string {
    return JSON.stringify(
        rows.map((row) => {
            const exercise = library[row.exerciseId];
            const rounds = exercise ? isRoundBased(exercise) : row.rounds !== "";
            return {
                exerciseId: row.exerciseId,
                rounds: rounds ? toNumber(row.rounds) : null,
                roundSec: rounds ? toNumber(row.roundSec) : null,
                sets: rounds ? null : toNumber(row.sets),
                reps: rounds ? null : toNumber(row.reps),
                notes: row.notes.trim() || null,
            };
        }),
    );
}
