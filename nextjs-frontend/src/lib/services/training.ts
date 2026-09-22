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
import { academyDayStartIso, DAY_MS, dayKey } from "@/lib/format";
import { matchesSearch } from "@/lib/query";
import { drainNumberedPages, nullIfNotFound } from "./api-helpers";

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
    sessionType: z.enum([
        "SHADOW_BOXING",
        "PAD_WORK",
        "HEAVY_BAG",
        "SPARRING",
        "GRAPPLING",
        "STRENGTH_CONDITIONING",
        "RECOVERY",
        "PHYSICAL_THERAPY",
        "TECHNICAL_DRILLING",
        "RECOVERY_MOBILITY",
    ]),
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
    targetRpe: z.number().int().min(1).max(10).optional(),
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
const trainingTypeFromApi: Record<BackendSession["sessionType"], TrainingType> = {
    SHADOW_BOXING: "shadow_boxing",
    PAD_WORK: "pad_work",
    HEAVY_BAG: "heavy_bag",
    SPARRING: "sparring",
    GRAPPLING: "grappling",
    STRENGTH_CONDITIONING: "strength_conditioning",
    RECOVERY: "recovery_mobility",
    PHYSICAL_THERAPY: "recovery_mobility",
    TECHNICAL_DRILLING: "technical_drilling",
    RECOVERY_MOBILITY: "recovery_mobility",
};
const trainingTypeToApi: Record<TrainingType, BackendSession["sessionType"]> = {
    shadow_boxing: "SHADOW_BOXING",
    pad_work: "PAD_WORK",
    heavy_bag: "HEAVY_BAG",
    sparring: "SPARRING",
    grappling: "GRAPPLING",
    strength_conditioning: "STRENGTH_CONDITIONING",
    recovery_mobility: "RECOVERY",
    technical_drilling: "TECHNICAL_DRILLING",
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

function unsupported(operation: string, detail: string): never {
    throw new ApiError({
        message: `${operation} is unavailable because the backend does not yet support ${detail}.`,
        kind: "http",
        status: 501,
        code: "API_OPERATION_UNSUPPORTED",
        details: { operation, missingCapability: detail },
    });
}

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

function toPlan(plan: BackendPlan): TrainingPlan {
    if (plan.phase === undefined || plan.focusAreas === undefined || plan.weeklySessionTarget === undefined || plan.endDate === null) {
        unsupported("Reading a training plan", "phase, focus areas, weekly target, and end-date fields");
    }
    return {
        id: plan.id,
        title: plan.title,
        fighterId: plan.fighterId,
        coachId: plan.coachId,
        objective: plan.goals ?? "",
        phase: plan.phase,
        focusAreas: plan.focusAreas,
        startDate: plan.startDate,
        endDate: plan.endDate,
        weeklySessionTarget: plan.weeklySessionTarget,
        status: planStatusFromApi[plan.status],
        notes: plan.description ?? "",
        createdAt: plan.createdAt,
        updatedAt: plan.updatedAt,
    };
}

function toSession(session: BackendSession): TrainingSession {
    const completed = session.status === "COMPLETED" && session.completedAt !== null;
    if (
        session.coachId === null ||
        session.plannedDurationSec === null ||
        session.targetRpe === undefined ||
        session.exercises === undefined ||
        session.videoIds === undefined
    ) {
        unsupported("Reading a training session", "coach, planned duration, target RPE, exercises, and video-link fields");
    }
    if (
        completed &&
        (session.actualDurationSec === null ||
            session.reportedRpe === null ||
            session.coachRating === undefined ||
            session.coachRating === null ||
            session.resultSummary === undefined)
    ) {
        unsupported("Reading a completed training session", "duration, RPE, coach rating, and result-summary fields");
    }
    return {
        id: session.id,
        planId: session.planId,
        fighterId: session.fighterId,
        coachId: session.coachId,
        title: session.title,
        type: trainingTypeFromApi[session.sessionType],
        scheduledAt: session.scheduledAt,
        durationMin: Math.max(1, Math.round(session.plannedDurationSec / 60)),
        location: session.location ?? "",
        targetRpe: session.targetRpe,
        status: sessionStatusFromApi[session.status],
        exercises: session.exercises,
        result: completed
            ? {
                  completedAt: session.completedAt!,
                  actualDurationMin: Math.max(1, Math.round(session.actualDurationSec! / 60)),
                  rpe: session.reportedRpe!,
                  roundsCompleted: session.roundCount,
                  coachRating: session.coachRating!,
                  summary: session.resultSummary ?? "",
              }
            : null,
        videoIds: session.videoIds,
        cancellationReason: session.cancellationReason,
        notes: session.coachNotes,
    };
}

function toExercise(exercise: BackendExercise): Exercise {
    if (
        exercise.techniques === undefined ||
        exercise.intensity === undefined ||
        exercise.equipment === undefined ||
        exercise.defaultRounds === undefined ||
        exercise.defaultRoundSec === undefined ||
        exercise.defaultSets === undefined ||
        exercise.defaultReps === undefined ||
        exercise.loadsRegions === undefined
    ) {
        unsupported("Reading an exercise", "technique, intensity, equipment, default prescription, and body-load fields");
    }
    return {
        id: exercise.id,
        name: exercise.name,
        category: exerciseCategoryFromApi[exercise.category],
        description: exercise.description ?? "",
        techniques: exercise.techniques,
        intensity: exercise.intensity,
        equipment: exercise.equipment,
        defaultRounds: exercise.defaultRounds,
        defaultRoundSec: exercise.defaultRoundSec,
        defaultSets: exercise.defaultSets,
        defaultReps: exercise.defaultReps,
        loadsRegions: exercise.loadsRegions,
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
    phase: TrainingPhase;
    focusAreas: Technique[];
    startDate: string;
    endDate: string;
    weeklySessionTarget: number;
    notes: string;
    /** New plans start as drafts unless published straight away. */
    status?: Extract<PlanStatus, "draft" | "active">;
}

/** Fields a coach can edit after creation. The fighter and status are changed through their own flows. */
export type PlanUpdateInput = Partial<Omit<PlanInput, "fighterId" | "status">>;

export async function createPlan(input: PlanInput, actor: User): Promise<TrainingPlan> {
    if (isDemoAuthEnabled()) return (await demoService()).createPlan(input, actor);
    unsupported("Creating a training plan", "phase, focus-area, and weekly-target persistence");
}

export async function updatePlan(id: string, input: PlanUpdateInput, actor: User): Promise<TrainingPlan | null> {
    if (isDemoAuthEnabled()) return (await demoService()).updatePlan(id, input, actor);
    if (input.phase !== undefined || input.focusAreas !== undefined || input.weeklySessionTarget !== undefined || input.coachId !== undefined) {
        unsupported("Updating a training plan", "phase, focus-area, weekly-target, and coach reassignment persistence");
    }
    const body = {
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.objective !== undefined ? { goals: input.objective.trim() || null } : {}),
        ...(input.notes !== undefined ? { description: input.notes.trim() || null } : {}),
        ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
        ...(input.endDate !== undefined ? { endDate: input.endDate || null } : {}),
    };
    if (Object.keys(body).length === 0) return getPlan(id);
    const plan = await nullIfNotFound(
        authenticatedMutableApiRequest(`/training-plans/${encodeURIComponent(id)}`, backendPlanSchema, {
            method: "PATCH",
            body: JSON.stringify(body),
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
                    sessionType: filter.type ? trainingTypeToApi[filter.type] : undefined,
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
    return (await listBackendSessions(filter))
        .map(toSession)
        .filter((session) => matchesSearch(filter.search, session.title, session.location, session.notes))
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
        .filter((session) => Date.parse(session.scheduledAt) + session.durationMin * 60_000 >= now)
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
    /** Planned intensity, RPE 1–10. */
    targetRpe: number;
    exercises: SessionExerciseInput[];
    notes: string | null;
    /** The coach has read the clearance warnings and schedules anyway. Blocking conflicts can never be overridden. */
    acknowledgeWarnings?: boolean;
}
/** Sessions stay with the fighter they were created for. */
export type SessionUpdateInput = Omit<SessionInput, "fighterId">;
export interface SessionResultInput {
    actualDurationMin: number;
    /** Session RPE reported by the fighter, 1–10. */
    rpe: number;
    roundsCompleted: number;
    /** Coach rating of the session quality, 1–5. */
    coachRating: number;
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
type PlannedSession = Pick<SessionInput, "fighterId" | "type" | "targetRpe" | "exercises" | "scheduledAt">;

/** Planned training checked against the fighter's Medical Clearance. The API has no endpoint for it yet. */
export async function loadSessionClearanceConflicts(planned: PlannedSession): Promise<ClearanceConflict[]> {
    if (isDemoAuthEnabled()) return (await demoService()).getSessionClearanceConflicts(planned);
    unsupported("Previewing a training session", "the authenticated clearance-conflict endpoint");
}
export async function createSession(input: SessionInput, actor: User): Promise<SessionMutationResult> {
    if (isDemoAuthEnabled()) return (await demoService()).createSession(input, actor);
    unsupported("Creating a training session", "exercise, target-RPE, and clearance-conflict persistence");
}
export async function updateSession(id: string, input: SessionUpdateInput, actor: User): Promise<SessionMutationResult> {
    if (isDemoAuthEnabled()) return (await demoService()).updateSession(id, input, actor);
    unsupported("Updating a training session", "exercise, target-RPE, and clearance-conflict persistence");
}
export async function recordSessionResult(id: string, input: SessionResultInput, actor: User): Promise<SessionMutationResult> {
    if (isDemoAuthEnabled()) return (await demoService()).recordSessionResult(id, input, actor);
    unsupported("Recording a session result", "coach rating, summary, and completed-exercise persistence");
}
export async function cancelSession(id: string, reason: string, actor: User): Promise<SessionMutationResult> {
    if (isDemoAuthEnabled()) return (await demoService()).cancelSession(id, reason, actor);
    unsupported("Cancelling a training session", "an atomic cancellation-reason transition");
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
            trainingMinutes: completed.reduce((total, session) => total + (session.result?.actualDurationMin ?? session.durationMin), 0),
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
