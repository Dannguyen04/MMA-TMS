import "server-only";

import { z } from "zod";

import { ApiError, authenticatedApiRequest, authenticatedMutableApiRequest } from "@/lib/api/client";
import { isDemoAuthEnabled } from "@/lib/auth/constants";
import type { ClearanceConflict } from "@/lib/domain/rules";
import type {
    CoachFeedback,
    Exercise,
    ExerciseCategory,
    FeedbackKind,
    PlanExercise,
    PlanStatus,
    SessionExercise,
    SessionStatus,
    Technique,
    TrainingPhase,
    TrainingPlan,
    TrainingProgress,
    TrainingSession,
    TrainingType,
    User,
} from "@/lib/domain/types";
import { SESSION_TYPES } from "@/lib/domain/medical-contract";
import {
    planBody,
    planCreateBody,
    planExerciseBody,
    sessionBody,
    sessionCreateBody,
    sessionResultBody,
    sessionStatusBody,
    TRAINING_TYPE_FOR,
    type PlanExerciseFields,
} from "@/lib/domain/training-contract";
import { academyDayEndIso, academyDayStartIso, DAY_MS, dayKey } from "@/lib/format";
import { matchesSearch } from "@/lib/query";
import { drainNumberedPages, nullIfNotFound, unsupportedOperation } from "./api-helpers";
import { platformFeatureAvailable } from "./platform-features";
import { plannedEndMs, sessionMinutes } from "@/components/training/training-utils";

type FighterScope = string[] | "all";

const demoService = () => import("./training.demo");

const isoDateSchema = z.string().min(1);
const nullableTextSchema = z.string().nullable();
const techniqueSchema = z.enum(["jab", "cross", "hook", "kick", "combination", "footwork", "guard", "head_movement"]);
const bodyRegionSchema = z.enum([
    "head",
    "neck",
    "left_shoulder",
    "right_shoulder",
    "left_elbow",
    "right_elbow",
    "left_hand",
    "right_hand",
    "chest",
    "ribs",
    "lower_back",
    "left_hip",
    "right_hip",
    "left_hamstring",
    "right_hamstring",
    "left_knee",
    "right_knee",
    "left_shin",
    "right_shin",
    "left_ankle",
    "right_ankle",
]);

const backendPlanSchema = z.object({
    id: z.string(),
    fighterId: z.string(),
    coachId: z.string(),
    title: z.string(),
    description: nullableTextSchema,
    startDate: isoDateSchema,
    endDate: isoDateSchema.nullable(),
    status: z.enum(["DRAFT", "ACTIVE", "COMPLETED", "CANCELLED"]),
    goals: nullableTextSchema,
    milestones: z.array(z.unknown()),
    isActive: z.boolean(),
    createdAt: isoDateSchema,
    updatedAt: isoDateSchema,
    deletedAt: isoDateSchema.nullable(),
    progress: z.unknown().optional(),
    phase: z.enum(["base", "build", "fight_camp", "taper", "rehab", "maintenance"]).optional(),
    focusAreas: z.array(techniqueSchema).optional(),
    weeklySessionTarget: z.number().int().positive().optional(),
});

const backendSessionSchema = z.object({
    id: z.string(),
    fighterId: z.string(),
    coachId: z.string().nullable(),
    planId: z.string().nullable(),
    title: z.string(),
    scheduledAt: isoDateSchema,
    plannedDurationSec: z.number().int().positive().nullable(),
    actualDurationSec: z.number().int().positive().nullable(),
    roundCount: z.number().int().nonnegative(),
    location: nullableTextSchema,
    sessionType: z.enum(SESSION_TYPES),
    status: z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "SKIPPED", "CANCELLED", "ABANDONED"]),
    coachNotes: nullableTextSchema,
    cancellationReason: nullableTextSchema,
    checkedInAt: isoDateSchema.nullable(),
    completedAt: isoDateSchema.nullable(),
    abandonedAt: isoDateSchema.nullable(),
    skippedAt: isoDateSchema.nullable(),
    reportedRpe: z.number().int().min(1).max(10).nullable(),
    isActive: z.boolean(),
    createdAt: isoDateSchema,
    updatedAt: isoDateSchema,
    deletedAt: isoDateSchema.nullable(),
    cancelledAt: isoDateSchema.nullable(),
    // Not in the API yet: sessions without them read as null or empty.
    targetRpe: z.number().int().min(1).max(10).nullable().optional(),
    exercises: z
        .array(
            z.object({
                exerciseId: z.string(),
                rounds: z.number().int().positive().nullable(),
                roundSec: z.number().int().positive().nullable(),
                sets: z.number().int().positive().nullable(),
                reps: z.number().int().positive().nullable(),
                notes: z.string().nullable(),
                completed: z.boolean(),
            }),
        )
        .optional(),
    videoIds: z.array(z.string()).optional(),
    coachRating: z.number().int().min(1).max(5).nullable().optional(),
    resultSummary: z.string().nullable().optional(),
});

const backendExerciseSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: nullableTextSchema,
    category: z.enum(["STRIKING", "DEFENSE", "FOOTWORK", "GRAPPLING", "STRENGTH_CONDITIONING", "STRENGTH", "RECOVERY", "MOBILITY"]),
    targetMuscleGroups: z.array(z.string()),
    videoUrl: nullableTextSchema,
    thumbnailUrl: nullableTextSchema,
    isActive: z.boolean(),
    createdAt: isoDateSchema,
    updatedAt: isoDateSchema,
    deletedAt: isoDateSchema.nullable(),
    techniques: z.array(techniqueSchema).optional(),
    intensity: z.enum(["low", "moderate", "high"]).optional(),
    equipment: z.array(z.string()).optional(),
    defaultRounds: z.number().int().positive().nullable().optional(),
    defaultRoundSec: z.number().int().positive().nullable().optional(),
    defaultSets: z.number().int().positive().nullable().optional(),
    defaultReps: z.number().int().positive().nullable().optional(),
    loadsRegions: z.array(bodyRegionSchema).optional(),
});

const backendPlanExerciseSchema = z.object({
    id: z.string(),
    planId: z.string(),
    exerciseId: z.string(),
    orderIndex: z.number().int().nonnegative(),
    sets: z.number().int().positive().nullable(),
    reps: z.number().int().positive().nullable(),
    durationSeconds: z.number().int().positive().nullable(),
    targetRpe: z.number().int().min(1).max(10).nullable(),
    coachNotes: nullableTextSchema,
});

const backendFeedbackSchema = z.object({
    id: z.string().uuid(),
    fighterId: z.string().uuid(),
    coachId: z.string().uuid(),
    sessionId: z.string().uuid().nullable(),
    videoId: z.string().uuid().nullable(),
    kind: z.enum(["PRAISE", "CORRECTION", "NOTE"]),
    body: z.string(),
    techniques: z.array(techniqueSchema),
    createdAt: isoDateSchema,
});

type BackendPlan = z.infer<typeof backendPlanSchema>;
type BackendSession = z.infer<typeof backendSessionSchema>;
type BackendExercise = z.infer<typeof backendExerciseSchema>;
type BackendFeedback = z.infer<typeof backendFeedbackSchema>;
type BackendPlanExercise = z.infer<typeof backendPlanExerciseSchema>;

const planStatusFromApi: Record<BackendPlan["status"], PlanStatus> = {
    DRAFT: "draft",
    ACTIVE: "active",
    COMPLETED: "completed",
    CANCELLED: "archived",
};
const planStatusToApi: Record<PlanStatus, BackendPlan["status"]> = {
    draft: "DRAFT",
    active: "ACTIVE",
    completed: "COMPLETED",
    archived: "CANCELLED",
};
const sessionStatusFromApi: Record<BackendSession["status"], SessionStatus> = {
    SCHEDULED: "scheduled",
    IN_PROGRESS: "in_progress",
    COMPLETED: "completed",
    SKIPPED: "missed",
    CANCELLED: "cancelled",
    ABANDONED: "cancelled",
};
const sessionStatusToApi: Record<SessionStatus, BackendSession["status"]> = {
    scheduled: "SCHEDULED",
    in_progress: "IN_PROGRESS",
    completed: "COMPLETED",
    missed: "SKIPPED",
    cancelled: "CANCELLED",
};
const exerciseCategoryFromApi: Record<BackendExercise["category"], ExerciseCategory> = {
    STRIKING: "striking",
    DEFENSE: "defense",
    FOOTWORK: "footwork",
    GRAPPLING: "grappling",
    STRENGTH_CONDITIONING: "conditioning",
    STRENGTH: "strength",
    RECOVERY: "mobility",
    MOBILITY: "mobility",
};

/**
 * The API filters by a single fighter, so scoped reads fan out one request per fighter and merge
 * the results by id. An empty scope reads nothing.
 */
async function readPerFighter<T extends { id: string }>(
    scope: FighterScope | undefined,
    read: (fighterId: string | undefined) => Promise<T[]>,
): Promise<T[]> {
    if (Array.isArray(scope) && scope.length === 0) return [];
    const pages = await Promise.all((Array.isArray(scope) ? scope : [undefined]).map(read));
    return [...new Map(pages.flat().map((item) => [item.id, item])).values()];
}

/**
 * The service stores plan dates as academy calendar days; the interface keeps them as the start of the first day and
 * the end of the last, as the demo does. Phase, focus areas and weekly target aren't stored yet and stay empty.
 */
function toPlan(plan: BackendPlan): TrainingPlan {
    return {
        id: plan.id,
        title: plan.title,
        fighterId: plan.fighterId,
        coachId: plan.coachId,
        objective: plan.goals ?? "",
        phase: plan.phase ?? null,
        focusAreas: plan.focusAreas ?? [],
        startDate: academyDayStartIso(dayKey(plan.startDate)),
        endDate: plan.endDate === null ? null : academyDayEndIso(dayKey(plan.endDate)),
        weeklySessionTarget: plan.weeklySessionTarget ?? null,
        status: planStatusFromApi[plan.status],
        notes: plan.description ?? "",
        createdAt: plan.createdAt,
        updatedAt: plan.updatedAt,
    };
}

/** Fields the API doesn't return yet (target RPE, exercises, linked videos, coach rating) read as null or empty. */
function toSession(session: BackendSession): TrainingSession {
    const completedAt = session.status === "COMPLETED" ? session.completedAt : null;
    return {
        id: session.id,
        planId: session.planId,
        fighterId: session.fighterId,
        coachId: session.coachId,
        title: session.title,
        type: TRAINING_TYPE_FOR[session.sessionType],
        scheduledAt: session.scheduledAt,
        durationMin: session.plannedDurationSec === null ? null : Math.max(1, Math.round(session.plannedDurationSec / 60)),
        location: session.location ?? "",
        targetRpe: session.targetRpe ?? null,
        status: sessionStatusFromApi[session.status],
        exercises: session.exercises ?? [],
        result: completedAt
            ? {
                  completedAt,
                  actualDurationMin: session.actualDurationSec === null ? null : Math.max(1, Math.round(session.actualDurationSec / 60)),
                  rpe: session.reportedRpe,
                  roundsCompleted: session.roundCount,
                  coachRating: session.coachRating ?? null,
                  summary: session.resultSummary ?? "",
              }
            : null,
        videoIds: session.videoIds ?? [],
        cancellationReason: session.cancellationReason,
        notes: session.coachNotes,
    };
}

/** Library details the training service doesn't keep yet (techniques, intensity, prescription, body load) stay empty. */
function toExercise(exercise: BackendExercise): Exercise {
    return {
        id: exercise.id,
        name: exercise.name,
        category: exerciseCategoryFromApi[exercise.category],
        description: exercise.description ?? "",
        techniques: exercise.techniques ?? [],
        intensity: exercise.intensity ?? null,
        equipment: exercise.equipment ?? [],
        defaultRounds: exercise.defaultRounds ?? null,
        defaultRoundSec: exercise.defaultRoundSec ?? null,
        defaultSets: exercise.defaultSets ?? null,
        defaultReps: exercise.defaultReps ?? null,
        loadsRegions: exercise.loadsRegions ?? [],
    };
}

function toFeedback(feedback: BackendFeedback): CoachFeedback {
    return {
        ...feedback,
        kind: feedback.kind.toLowerCase() as FeedbackKind,
    };
}

export interface ExerciseFilter {
    category?: ExerciseCategory;
    technique?: Technique;
    search?: string;
}

export async function listExercises(filter: ExerciseFilter = {}): Promise<Exercise[]> {
    if (isDemoAuthEnabled()) return (await demoService()).listExercises(filter);
    const exercises = (await drainNumberedPages("/exercises", backendExerciseSchema, { search: filter.search })).map(toExercise);
    return exercises
        .filter((exercise) => (!filter.category || exercise.category === filter.category) && (!filter.technique || exercise.techniques.includes(filter.technique)))
        .sort((left, right) => left.category.localeCompare(right.category) || left.name.localeCompare(right.name));
}

export interface PlanFilter {
    /** Fighters the viewer may see (from `accessibleFighterIds`). Omit for all. */
    fighterIds?: FighterScope;
    coachId?: string;
    status?: PlanStatus;
    search?: string;
}

function listBackendPlans(filter: PlanFilter): Promise<BackendPlan[]> {
    return readPerFighter(filter.fighterIds, (fighterId) =>
        drainNumberedPages("/training-plans", backendPlanSchema, {
            fighterId,
            coachId: filter.coachId,
            status: filter.status ? planStatusToApi[filter.status] : undefined,
        }),
    );
}

export async function listPlans(filter: PlanFilter = {}): Promise<TrainingPlan[]> {
    if (isDemoAuthEnabled()) return (await demoService()).listPlans(filter);
    return (await listBackendPlans(filter))
        .map(toPlan)
        .filter((plan) => matchesSearch(filter.search, plan.title, plan.objective, plan.notes))
        .sort((left, right) => right.startDate.localeCompare(left.startDate));
}

export async function getPlan(id: string): Promise<TrainingPlan | null> {
    if (isDemoAuthEnabled()) return (await demoService()).getPlan(id);
    const plan = await nullIfNotFound(authenticatedApiRequest(`/training-plans/${encodeURIComponent(id)}`, backendPlanSchema));
    return plan && toPlan(plan);
}

export interface PlanWithSessions {
    plan: TrainingPlan;
    /** Sessions linked to the plan, oldest first. */
    sessions: TrainingSession[];
}

export async function getPlanWithSessions(id: string): Promise<PlanWithSessions | null> {
    if (isDemoAuthEnabled()) return (await demoService()).getPlanWithSessions(id);
    const plan = await getPlan(id);
    if (!plan) return null;
    return { plan, sessions: await listSessions({ planId: id }) };
}

export interface PlanInput {
    title: string;
    fighterId: string;
    coachId: string;
    objective: string;
    /** Phase, focus areas and weekly target are demo-only: the training service doesn't store them. */
    phase: TrainingPhase | null;
    focusAreas: Technique[];
    startDate: string;
    endDate: string;
    weeklySessionTarget: number | null;
    notes: string;
    /** New plans start as drafts unless published straight away. */
    status?: Extract<PlanStatus, "draft" | "active">;
}

/** Fields a coach can edit after creation. The fighter and status are changed through their own flows. */
export type PlanUpdateInput = Omit<PlanInput, "fighterId" | "coachId" | "status">;

/**
 * API mode creates the plan, then publishes it when asked: the service always creates drafts. When publishing is
 * refused the draft is returned as it is, so the caller can tell the coach it wasn't activated.
 */
export async function createPlan(input: PlanInput, actor: User): Promise<TrainingPlan> {
    if (isDemoAuthEnabled()) return (await demoService()).createPlan(input, actor);
    const plan = toPlan(
        await authenticatedMutableApiRequest("/training-plans", backendPlanSchema, { method: "POST", body: JSON.stringify(planCreateBody(input)) }),
    );
    if (input.status !== "active") return plan;
    try {
        return (await setPlanStatus(plan.id, "active", actor)) ?? plan;
    } catch (error) {
        if (error instanceof ApiError) return plan;
        throw error;
    }
}

/** The whole plan as the form edits it. API mode saves what the service stores; the fighter and coach stay. */
export async function updatePlan(id: string, input: PlanUpdateInput, actor: User): Promise<TrainingPlan | null> {
    if (isDemoAuthEnabled()) return (await demoService()).updatePlan(id, input, actor);
    const plan = await nullIfNotFound(
        authenticatedMutableApiRequest(`/training-plans/${encodeURIComponent(id)}`, backendPlanSchema, {
            method: "PATCH",
            body: JSON.stringify(planBody(input)),
        }),
    );
    return plan && toPlan(plan);
}

export async function setPlanStatus(id: string, status: PlanStatus, actor: User): Promise<TrainingPlan | null> {
    if (isDemoAuthEnabled()) return (await demoService()).setPlanStatus(id, status, actor);
    const plan = await nullIfNotFound(
        authenticatedMutableApiRequest(`/training-plans/${encodeURIComponent(id)}/status`, backendPlanSchema, {
            method: "PATCH",
            body: JSON.stringify({ status: planStatusToApi[status] }),
        }),
    );
    return plan && toPlan(plan);
}

/* ─── Plan exercises ──────────────────────────────────────────────────────── */

function toPlanExercise(item: BackendPlanExercise): PlanExercise {
    return {
        id: item.id,
        planId: item.planId,
        exerciseId: item.exerciseId,
        orderIndex: item.orderIndex,
        sets: item.sets,
        reps: item.reps,
        durationSec: item.durationSeconds,
        targetRpe: item.targetRpe,
        notes: item.coachNotes,
    };
}

function planExercisesPath(planId: string, id?: string): string {
    return `/training-plans/${encodeURIComponent(planId)}/exercises${id ? `/${encodeURIComponent(id)}` : ""}`;
}

/** A plan's exercises in running order. */
export async function listPlanExercises(planId: string): Promise<PlanExercise[]> {
    if (isDemoAuthEnabled()) return (await demoService()).listPlanExercises(planId);
    const items = await authenticatedApiRequest(planExercisesPath(planId), z.array(backendPlanExerciseSchema));
    return items.map(toPlanExercise).sort((left, right) => left.orderIndex - right.orderIndex);
}

/** Adds an exercise at the end of the plan. API-mode writes throw the service's ApiError on failure. */
export async function addPlanExercise(planId: string, exerciseId: string, input: PlanExerciseFields, actor: User): Promise<PlanExercise> {
    if (isDemoAuthEnabled()) return (await demoService()).addPlanExercise(planId, exerciseId, input, actor);
    const current = await listPlanExercises(planId);
    const orderIndex = current.reduce((next, item) => Math.max(next, item.orderIndex + 1), 0);
    return toPlanExercise(
        await authenticatedMutableApiRequest(planExercisesPath(planId), backendPlanExerciseSchema, {
            method: "POST",
            body: JSON.stringify({ exerciseId, orderIndex, ...planExerciseBody(input) }),
        }),
    );
}

export async function updatePlanExercise(planId: string, id: string, input: PlanExerciseFields, actor: User): Promise<PlanExercise | null> {
    if (isDemoAuthEnabled()) return (await demoService()).updatePlanExercise(planId, id, input, actor);
    const item = await nullIfNotFound(
        authenticatedMutableApiRequest(planExercisesPath(planId, id), backendPlanExerciseSchema, { method: "PATCH", body: JSON.stringify(planExerciseBody(input)) }),
    );
    return item && toPlanExercise(item);
}

/** False when the exercise was no longer on the plan. */
export async function removePlanExercise(planId: string, id: string, actor: User): Promise<boolean> {
    if (isDemoAuthEnabled()) return (await demoService()).removePlanExercise(planId, id, actor);
    const removed = await nullIfNotFound(authenticatedMutableApiRequest(planExercisesPath(planId, id), z.object({ id: z.string() }), { method: "DELETE" }));
    return removed !== null;
}

export interface SessionFilter {
    /** Fighters the viewer may see (from `accessibleFighterIds`). Omit for all. */
    fighterIds?: FighterScope;
    coachId?: string;
    planId?: string;
    status?: SessionStatus | SessionStatus[];
    type?: TrainingType;
    /** Inclusive lower bound on `scheduledAt` (any ISO-8601 string). */
    from?: string;
    /** Inclusive upper bound on `scheduledAt` (any ISO-8601 string). */
    to?: string;
    search?: string;
    /** Sort by scheduled time. Defaults to oldest first. */
    order?: "asc" | "desc";
}

function validIso(value: string | undefined): string | undefined {
    if (!value || Number.isNaN(Date.parse(value))) return undefined;
    return new Date(value).toISOString();
}

function listBackendSessions(filter: SessionFilter): Promise<BackendSession[]> {
    const statuses = filter.status === undefined ? [undefined] : Array.isArray(filter.status) ? filter.status : [filter.status];
    return readPerFighter(filter.fighterIds, async (fighterId) => {
        const pages = await Promise.all(
            statuses.map((status) =>
                drainNumberedPages("/training-sessions", backendSessionSchema, {
                    fighterId,
                    coachId: filter.coachId,
                    planId: filter.planId,
                    status: status ? sessionStatusToApi[status] : undefined,
                    fromDate: validIso(filter.from),
                    toDate: validIso(filter.to),
                }),
            ),
        );
        return pages.flat();
    });
}

export async function listSessions(filter: SessionFilter = {}): Promise<TrainingSession[]> {
    if (isDemoAuthEnabled()) return (await demoService()).listSessions(filter);
    const direction = filter.order === "desc" ? -1 : 1;
    // Types filter here: physical therapy and recovery sessions both read as recovery & mobility.
    return (await listBackendSessions(filter))
        .map(toSession)
        .filter((session) => (!filter.type || session.type === filter.type) && matchesSearch(filter.search, session.title, session.location, session.notes))
        .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt) * direction);
}

export async function getSession(id: string): Promise<TrainingSession | null> {
    if (isDemoAuthEnabled()) return (await demoService()).getSession(id);
    const session = await nullIfNotFound(authenticatedApiRequest(`/training-sessions/${encodeURIComponent(id)}`, backendSessionSchema));
    return session && toSession(session);
}

export async function getUpcomingSessions(fighterIds: FighterScope, limit = 5): Promise<TrainingSession[]> {
    if (isDemoAuthEnabled()) return (await demoService()).getUpcomingSessions(fighterIds, limit);
    const now = Date.now();
    return (await listSessions({ fighterIds, status: ["scheduled", "in_progress"] }))
        .filter((session) => plannedEndMs(session) >= now)
        .slice(0, limit);
}

export async function getSessionHistory(fighterId: string, limit?: number): Promise<TrainingSession[]> {
    if (isDemoAuthEnabled()) return (await demoService()).getSessionHistory(fighterId, limit);
    const history = await listSessions({
        fighterIds: [fighterId],
        status: ["completed", "missed", "cancelled"],
        to: new Date().toISOString(),
        order: "desc",
    });
    return limit === undefined ? history : history.slice(0, limit);
}

export type SessionExerciseInput = Omit<SessionExercise, "completed">;
export interface SessionInput {
    fighterId: string;
    coachId: string;
    planId: string | null;
    title: string;
    type: TrainingType;
    scheduledAt: string;
    durationMin: number;
    location: string;
    /** Planned intensity, RPE 1–10. Demo-only, like the exercise list: the training service stores neither. */
    targetRpe: number | null;
    exercises: SessionExerciseInput[];
    notes: string | null;
    /** The coach has read the clearance warnings and schedules anyway. Blocking conflicts can never be overridden. */
    acknowledgeWarnings?: boolean;
}
/** Sessions stay with the fighter they were created for. */
export type SessionUpdateInput = Omit<SessionInput, "fighterId">;
/** The service measures the actual duration itself and keeps no rating or summary: those are demo-only. */
export interface SessionResultInput {
    actualDurationMin: number | null;
    /** Session RPE reported by the fighter, 1–10. */
    rpe: number;
    roundsCompleted: number;
    /** Coach rating of the session quality, 1–5. */
    coachRating: number | null;
    summary: string;
    /** Defaults to now. */
    completedAt?: string;
    /** Exercises that were finished. Defaults to every exercise in the session. */
    completedExerciseIds?: string[];
}
export type SessionFailureReason = "not_found" | "invalid" | "invalid_state" | "blocked" | "warnings_not_acknowledged";
export type SessionMutationResult =
    | { ok: true; session: TrainingSession; conflicts: ClearanceConflict[] }
    | { ok: false; reason: SessionFailureReason; message: string; conflicts: ClearanceConflict[] };
type PlannedSession = Pick<SessionInput, "fighterId" | "type" | "exercises" | "scheduledAt"> & { targetRpe: number | null };

/**
 * Planned training checked against the fighter's Medical Clearance. The API has no preview for this: it enforces
 * medical eligibility itself when a session starts (409 TRAINING_MEDICAL_ELIGIBILITY_REQUIRED), so in API mode
 * there are no conflicts to show ahead of time.
 */
export async function loadSessionClearanceConflicts(planned: PlannedSession): Promise<ClearanceConflict[]> {
    if (isDemoAuthEnabled()) return (await demoService()).getSessionClearanceConflicts(planned);
    return [];
}
/*
 * API-mode session writes throw the service's ApiError on failure (Server Actions map it with `trainingWriteFailure`).
 * The service checks Medical Clearance itself when a session starts, so they report no conflicts of their own.
 */

function sessionPath(id: string, rest = ""): string {
    return `/training-sessions/${encodeURIComponent(id)}${rest}`;
}

async function sendSession(path: string, method: "POST" | "PATCH", body: object): Promise<SessionMutationResult> {
    const session = await authenticatedMutableApiRequest(path, backendSessionSchema, { method, body: JSON.stringify(body) });
    return { ok: true, session: toSession(session), conflicts: [] };
}

function unsupportedType(operation: string): never {
    unsupportedOperation(operation, "this training type");
}

export async function createSession(input: SessionInput, actor: User): Promise<SessionMutationResult> {
    if (isDemoAuthEnabled()) return (await demoService()).createSession(input, actor);
    return sendSession("/training-sessions", "POST", sessionCreateBody(input) ?? unsupportedType("Scheduling a session"));
}

/** API mode keeps the session's plan and coach: the service doesn't move a session between them. */
export async function updateSession(id: string, input: SessionUpdateInput, actor: User): Promise<SessionMutationResult> {
    if (isDemoAuthEnabled()) return (await demoService()).updateSession(id, input, actor);
    return sendSession(sessionPath(id), "PATCH", sessionBody(input) ?? unsupportedType("Updating a session"));
}

/** Checks the fighter in. The service refuses (409) when their Medical Clearance doesn't allow this training now. */
export async function startSession(id: string, actor: User): Promise<SessionMutationResult> {
    if (isDemoAuthEnabled()) return (await demoService()).startSession(id, actor);
    return sendSession(sessionPath(id, "/status"), "PATCH", sessionStatusBody("IN_PROGRESS"));
}

/** Records that a scheduled session didn't happen. */
export async function markSessionMissed(id: string, actor: User): Promise<SessionMutationResult> {
    if (isDemoAuthEnabled()) return (await demoService()).markSessionMissed(id, actor);
    return sendSession(sessionPath(id, "/status"), "PATCH", sessionStatusBody("SKIPPED"));
}

/**
 * API mode saves the RPE and rounds, then completes a running session; a completed one only has its numbers
 * corrected. The service measures the duration from the check-in.
 */
export async function recordSessionResult(id: string, input: SessionResultInput, actor: User): Promise<SessionMutationResult> {
    if (isDemoAuthEnabled()) return (await demoService()).recordSessionResult(id, input, actor);
    const saved = await sendSession(sessionPath(id), "PATCH", sessionResultBody(input));
    if (!saved.ok || saved.session.status === "completed") return saved;
    return sendSession(sessionPath(id, "/status"), "PATCH", sessionStatusBody("COMPLETED"));
}

export async function cancelSession(id: string, reason: string, actor: User): Promise<SessionMutationResult> {
    if (isDemoAuthEnabled()) return (await demoService()).cancelSession(id, reason, actor);
    return sendSession(sessionPath(id, "/status"), "PATCH", sessionStatusBody("CANCELLED", reason));
}

function mostCommonPlanId(sessions: TrainingSession[]): string | null {
    const counts = new Map<string, number>();
    for (const session of sessions) {
        if (session.planId) counts.set(session.planId, (counts.get(session.planId) ?? 0) + 1);
    }
    return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
}

function mondayStart(date: Date): Date {
    const result = new Date(date);
    const day = result.getUTCDay();
    result.setUTCDate(result.getUTCDate() - (day === 0 ? 6 : day - 1));
    result.setUTCHours(0, 0, 0, 0);
    return result;
}

export async function getTrainingProgress(fighterId: string, weeks = 8): Promise<TrainingProgress[]> {
    if (isDemoAuthEnabled()) return (await demoService()).getTrainingProgress(fighterId, weeks);
    const currentWeek = mondayStart(new Date());
    const firstWeek = new Date(currentWeek.getTime() - (Math.max(1, weeks) - 1) * 7 * DAY_MS);
    const sessions = await listSessions({ fighterIds: [fighterId], from: firstWeek.toISOString() });
    return Array.from({ length: Math.max(0, weeks) }, (_, index) => {
        const start = new Date(firstWeek.getTime() + index * 7 * DAY_MS);
        const end = new Date(start.getTime() + 7 * DAY_MS);
        const planned = sessions.filter((session) => {
            const scheduled = Date.parse(session.scheduledAt);
            return scheduled >= start.getTime() && scheduled < end.getTime() && session.status !== "cancelled";
        });
        const completed = planned.filter((session) => session.status === "completed");
        return {
            fighterId,
            planId: mostCommonPlanId(planned),
            weekStart: start.toISOString(),
            plannedSessions: planned.length,
            completedSessions: completed.length,
            missedSessions: planned.filter((session) => session.status === "missed").length,
            adherencePct: planned.length === 0 ? 0 : Math.round((completed.length / planned.length) * 100),
            trainingMinutes: completed.reduce((total, session) => total + sessionMinutes(session), 0),
        };
    });
}

export interface AgendaDay {
    /** Calendar day in the academy timezone, YYYY-MM-DD. */
    date: string;
    /** Sessions that day (all statuses), earliest first. */
    sessions: TrainingSession[];
}

export async function getWeekAgenda(fighterIds: FighterScope, fromISO: string, days = 7): Promise<AgendaDay[]> {
    if (isDemoAuthEnabled()) return (await demoService()).getWeekAgenda(fighterIds, fromISO, days);
    const parsedStart = validIso(fromISO) ?? new Date().toISOString();
    const startMs = Date.parse(academyDayStartIso(dayKey(parsedStart)));
    const startIso = new Date(startMs).toISOString();
    const endIso = new Date(startMs + days * DAY_MS).toISOString();
    const sessions = await listSessions({ fighterIds, from: startIso, to: endIso });
    const agenda = Array.from({ length: days }, (_, index) => ({
        date: dayKey(new Date(startMs + (index + 0.5) * DAY_MS)),
        sessions: [] as TrainingSession[],
    }));
    const byDate = new Map(agenda.map((day) => [day.date, day]));
    for (const session of sessions) byDate.get(dayKey(session.scheduledAt))?.sessions.push(session);
    return agenda;
}

export interface FeedbackFilter {
    fighterIds?: FighterScope;
    coachId?: string;
    sessionId?: string;
    videoId?: string;
    kind?: FeedbackKind;
}
export async function listCoachFeedback(filter: FeedbackFilter = {}): Promise<CoachFeedback[]> {
    if (isDemoAuthEnabled()) return (await demoService()).listCoachFeedback(filter);
    if (!platformFeatureAvailable("coachFeedback")) return [];
    const feedback = await readPerFighter(filter.fighterIds, (fighterId) =>
        drainNumberedPages("/coach-feedback", backendFeedbackSchema, {
            fighterId,
            coachId: filter.coachId,
            sessionId: filter.sessionId,
            videoId: filter.videoId,
            kind: filter.kind?.toUpperCase(),
        }),
    );
    return feedback.map(toFeedback).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}
export type FeedbackInput = Omit<CoachFeedback, "id" | "createdAt">;
export async function addCoachFeedback(input: FeedbackInput, actor: User): Promise<CoachFeedback> {
    if (isDemoAuthEnabled()) return (await demoService()).addCoachFeedback(input, actor);
    if (!platformFeatureAvailable("coachFeedback")) unsupportedOperation("Adding coach feedback", "coach feedback");
    return toFeedback(
        await authenticatedMutableApiRequest("/coach-feedback", backendFeedbackSchema, {
            method: "POST",
            body: JSON.stringify({
                fighterId: input.fighterId,
                sessionId: input.sessionId,
                videoId: input.videoId,
                kind: input.kind.toUpperCase(),
                body: input.body,
                techniques: input.techniques,
            }),
        }),
    );
}
