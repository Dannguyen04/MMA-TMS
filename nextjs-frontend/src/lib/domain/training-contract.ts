import { dayKey } from "@/lib/format";
import type { SessionType } from "./medical-contract";
import type { ExerciseCategory, TrainingPhase, TrainingType } from "./types";

/**
 * The training service's vocabulary and request bodies, built from input a form has already validated. Pure, so the
 * rules the service enforces on a body's shape are tested here rather than discovered as a 422. Safe for Server and
 * Client Components.
 */

/** The training service's session type for each interface training type. Technical drilling has none yet. */
const SESSION_TYPE_FOR: Partial<Record<TrainingType, SessionType>> = {
    shadow_boxing: "SHADOW_BOXING",
    pad_work: "PAD_WORK",
    heavy_bag: "HEAVY_BAG",
    sparring: "SPARRING",
    grappling: "GRAPPLING",
    strength_conditioning: "STRENGTH_CONDITIONING",
    recovery_mobility: "RECOVERY",
};

/** The interface training type for each of the service's session types. Physical therapy reads as recovery. */
export const TRAINING_TYPE_FOR: Record<SessionType, TrainingType> = {
    SHADOW_BOXING: "shadow_boxing",
    PAD_WORK: "pad_work",
    HEAVY_BAG: "heavy_bag",
    SPARRING: "sparring",
    GRAPPLING: "grappling",
    STRENGTH_CONDITIONING: "strength_conditioning",
    RECOVERY: "recovery_mobility",
    PHYSICAL_THERAPY: "recovery_mobility",
};

/** Training types a session can be scheduled with through the training service. */
export const SERVICE_TRAINING_TYPES = Object.keys(SESSION_TYPE_FOR) as TrainingType[];

/** The service's session type, or null for a training type it has no equivalent for. */
export function sessionTypeFor(type: TrainingType): SessionType | null {
    return SESSION_TYPE_FOR[type] ?? null;
}

/** Text the service stores as null when it's empty. */
function textOrNull(value: string | null | undefined): string | null {
    const trimmed = value?.trim() ?? "";
    return trimmed === "" ? null : trimmed;
}

/* ─── Plans ───────────────────────────────────────────────────────────────── */

export interface PlanFields {
    title: string;
    objective: string;
    phase: TrainingPhase;
    /** ISO instant on the first academy day of the plan. */
    startDate: string;
    /** ISO instant on the last academy day of the plan. */
    endDate: string;
    notes: string;
}

export interface PlanBody {
    title: string;
    goals: string | null;
    description: string | null;
    /** Required when creating; the service never takes null. */
    phase: TrainingPhase;
    /** Academy calendar days (YYYY-MM-DD): the service stores plan dates without a time. */
    startDate: string;
    endDate: string;
}

export function planBody(input: PlanFields): PlanBody {
    return {
        title: input.title.trim(),
        goals: textOrNull(input.objective),
        description: textOrNull(input.notes),
        phase: input.phase,
        startDate: dayKey(input.startDate),
        endDate: dayKey(input.endDate),
    };
}

export function planCreateBody(input: PlanFields & { fighterId: string; coachId: string }): PlanBody & { fighterId: string; coachId: string } {
    return { fighterId: input.fighterId, coachId: input.coachId, ...planBody(input) };
}

/** A plan exercise's prescription as a coach enters it. */
export interface PlanExerciseFields {
    sets: number | null;
    reps: number | null;
    durationSec: number | null;
    targetRpe: number | null;
    notes: string | null;
}

export interface PlanExerciseBody {
    sets: number | null;
    reps: number | null;
    durationSeconds: number | null;
    targetRpe: number | null;
    coachNotes: string | null;
}

export function planExerciseBody(input: PlanExerciseFields): PlanExerciseBody {
    return { sets: input.sets, reps: input.reps, durationSeconds: input.durationSec, targetRpe: input.targetRpe, coachNotes: textOrNull(input.notes) };
}

/* ─── Exercise library ────────────────────────────────────────────────────── */

/** The training service's exercise categories (its catalog has no defense, footwork or strength of its own). */
export const SERVICE_EXERCISE_CATEGORIES = ["STRIKING", "GRAPPLING", "STRENGTH_CONDITIONING", "RECOVERY"] as const;
export type ServiceExerciseCategory = (typeof SERVICE_EXERCISE_CATEGORIES)[number];

/** The interface category each service category reads as; its label comes from `EXERCISE_CATEGORY_LABELS`. */
export const EXERCISE_CATEGORY_FOR: Record<ServiceExerciseCategory, ExerciseCategory> = {
    STRIKING: "striking",
    GRAPPLING: "grappling",
    STRENGTH_CONDITIONING: "conditioning",
    RECOVERY: "mobility",
};

const SERVICE_CATEGORY_FOR: Record<ExerciseCategory, ServiceExerciseCategory> = {
    striking: "STRIKING",
    defense: "STRIKING",
    footwork: "STRIKING",
    grappling: "GRAPPLING",
    conditioning: "STRENGTH_CONDITIONING",
    strength: "STRENGTH_CONDITIONING",
    mobility: "RECOVERY",
};

/** The service category an interface category is stored under. */
export function serviceExerciseCategoryFor(category: ExerciseCategory): ServiceExerciseCategory {
    return SERVICE_CATEGORY_FOR[category];
}

/** The service's limits for a new library exercise (`createExerciseSchema`). */
export const EXERCISE_LIMITS = { name: 255, description: 1000, url: 1000 } as const;

/** A library exercise as an administrator enters it. */
export interface ExerciseFields {
    name: string;
    category: ServiceExerciseCategory;
    description: string | null;
    targetMuscleGroups: string[];
    videoUrl: string | null;
}

export interface ExerciseBody {
    name: string;
    category: ServiceExerciseCategory;
    description: string | null;
    targetMuscleGroups: string[];
    videoUrl: string | null;
}

export function exerciseCreateBody(input: ExerciseFields): ExerciseBody {
    const muscles = [...new Set(input.targetMuscleGroups.map((group) => group.trim()).filter(Boolean))];
    return {
        name: input.name.trim(),
        category: input.category,
        description: textOrNull(input.description),
        targetMuscleGroups: muscles,
        videoUrl: textOrNull(input.videoUrl),
    };
}

/**
 * A name folded for matching a template's exercises to the library: case, spacing and the kind of dash don't matter,
 * so "Jab-cross-hook pad drill" finds "Jab–cross–hook pad drill".
 */
export function exerciseNameKey(name: string): string {
    return name
        .normalize("NFKC")
        .replace(/[‐-―−]/g, "-")
        .replace(/\s+/g, " ")
        .trim()
        .toLocaleLowerCase("en");
}

/* ─── Sessions ────────────────────────────────────────────────────────────── */

export interface SessionFields {
    title: string;
    type: TrainingType;
    scheduledAt: string;
    durationMin: number;
    location: string;
    notes: string | null;
}

export interface SessionBody {
    title: string;
    sessionType: SessionType;
    scheduledAt: string;
    plannedDurationSec: number;
    location: string | null;
    coachNotes: string | null;
}

/** Null when the training type has no service equivalent; the form never offers those in API mode. */
export function sessionBody(input: SessionFields): SessionBody | null {
    const sessionType = sessionTypeFor(input.type);
    if (!sessionType) return null;
    return {
        title: input.title.trim(),
        sessionType,
        scheduledAt: input.scheduledAt,
        plannedDurationSec: input.durationMin * 60,
        location: textOrNull(input.location),
        coachNotes: textOrNull(input.notes),
    };
}

export function sessionCreateBody(
    input: SessionFields & { fighterId: string; coachId: string; planId: string | null },
): (SessionBody & { fighterId: string; coachId: string; planId: string | null }) | null {
    const body = sessionBody(input);
    return body && { fighterId: input.fighterId, coachId: input.coachId, planId: input.planId, ...body };
}

/** What the coach records about a session; the service measures its length itself from the check-in. */
export function sessionResultBody(input: { rpe: number; roundsCompleted: number }): { reportedRpe: number; roundCount: number } {
    return { reportedRpe: input.rpe, roundCount: input.roundsCompleted };
}

/** A cancellation carries its reason; every other status change must not. */
export function sessionStatusBody(
    status: "IN_PROGRESS" | "COMPLETED" | "SKIPPED" | "CANCELLED",
    cancellationReason?: string,
): { status: string; cancellationReason?: string } {
    return status === "CANCELLED" ? { status, cancellationReason: cancellationReason?.trim() ?? "" } : { status };
}
