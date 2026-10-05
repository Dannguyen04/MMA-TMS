import { dayKey } from "@/lib/format";
import type { SessionType } from "./medical-contract";
import type { TrainingPhase, TrainingType } from "./types";

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
