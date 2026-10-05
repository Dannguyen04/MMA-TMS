import "server-only";

import { TRAINING_TYPE_LABELS } from "@/lib/domain/labels";
import type { PlanExerciseFields } from "@/lib/domain/training-contract";
import { checkTrainingAgainstClearance, currentClearance, type ClearanceConflict } from "@/lib/domain/rules";
import type {
    BodyRegion,
    CoachFeedback,
    Exercise,
    ExerciseCategory,
    PlanExercise,
    PlanStatus,
    SessionResult,
    SessionStatus,
    Technique,
    TrainingPlan,
    TrainingProgress,
    TrainingSession,
    User,
} from "@/lib/domain/types";
import { academyDayStartIso, DAY_MS, dayKey, formatDateTime } from "@/lib/format";
import { db, newId, nowIso, simulateLatency } from "@/lib/mocks/db";
import { weekStart } from "@/lib/mocks/time";
import { matchesSearch } from "@/lib/query";
import { routes } from "@/lib/routes";
import { recordAudit } from "./audit.demo";
import { notifyUsers, staffUserIdsForFighter } from "./notifications.demo";
import type {
    AgendaDay,
    ExerciseFilter,
    FeedbackFilter,
    FeedbackInput,
    PlanFilter,
    PlanInput,
    PlanUpdateInput,
    PlanWithSessions,
    SessionFilter,
    SessionInput,
    SessionMutationResult,
    SessionResultInput,
    SessionUpdateInput,
} from "./training";
import { plannedEndMs, sessionMinutes } from "@/components/training/training-utils";

/* ─── Shared helpers ──────────────────────────────────────────────────────── */

type FighterScope = string[] | "all";

const inScope = (scope: FighterScope | undefined, fighterId: string) =>
    scope === undefined || scope === "all" || scope.includes(fighterId);

function fighterName(fighterId: string): string {
    return db().fighters.find((f) => f.id === fighterId)?.name ?? "Unknown fighter";
}

function fighterUserIds(fighterId: string): string[] {
    return staffUserIdsForFighter(fighterId, ["fighter"]);
}

function coachUserId(coachId: string): string | null {
    return db().coaches.find((c) => c.id === coachId)?.userId ?? null;
}

/** User ids of the given people, excluding the actor (nobody is notified about their own change). */
function recipients(ids: (string | null)[], actor: User): string[] {
    return [...new Set(ids.filter((id): id is string => id !== null && id !== actor.id))];
}

const unique = <T>(items: T[]): T[] => [...new Set(items)];

/* ─── Exercises ───────────────────────────────────────────────────────────── */

const CATEGORY_ORDER: ExerciseCategory[] = ["striking", "defense", "footwork", "grappling", "conditioning", "strength", "mobility"];

/** Exercise library, ordered by category then name. */
export async function listExercises(filter: ExerciseFilter = {}): Promise<Exercise[]> {
    await simulateLatency();
    return db()
        .exercises.filter(
            (e) =>
                (!filter.category || e.category === filter.category) &&
                (!filter.technique || e.techniques.includes(filter.technique)) &&
                matchesSearch(filter.search, e.name, e.description, e.equipment.join(" ")),
        )
        .sort(
            (a, b) =>
                CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) || a.name.localeCompare(b.name),
        );
}

/* ─── Training plans ──────────────────────────────────────────────────────── */

const PLAN_STATUS_ORDER: PlanStatus[] = ["active", "draft", "completed", "archived"];

/** Plans ordered by status (active first) then most recent start date. */
export async function listPlans(filter: PlanFilter = {}): Promise<TrainingPlan[]> {
    await simulateLatency();
    return db()
        .trainingPlans.filter(
            (p) =>
                inScope(filter.fighterIds, p.fighterId) &&
                (!filter.coachId || p.coachId === filter.coachId) &&
                (!filter.status || p.status === filter.status) &&
                matchesSearch(filter.search, p.title, p.objective, fighterName(p.fighterId)),
        )
        .sort(
            (a, b) =>
                PLAN_STATUS_ORDER.indexOf(a.status) - PLAN_STATUS_ORDER.indexOf(b.status) ||
                b.startDate.localeCompare(a.startDate),
        );
}

/** A single plan, or null when it doesn't exist. */
export async function getPlan(id: string): Promise<TrainingPlan | null> {
    await simulateLatency(0.5);
    return db().trainingPlans.find((p) => p.id === id) ?? null;
}

/** A plan with its linked sessions, or null when the plan doesn't exist. */
export async function getPlanWithSessions(id: string): Promise<PlanWithSessions | null> {
    await simulateLatency();
    const store = db();
    const plan = store.trainingPlans.find((p) => p.id === id);
    if (!plan) return null;
    const sessions = store.trainingSessions
        .filter((s) => s.planId === id)
        .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    return { plan, sessions };
}

function notifyPlanActivated(plan: TrainingPlan, actor: User): void {
    const userIds = recipients(fighterUserIds(plan.fighterId), actor);
    if (userIds.length === 0) return;
    notifyUsers({
        userIds,
        category: "training",
        title: "New training plan",
        body: `${plan.title} is now active. Objective: ${plan.objective}`,
        href: routes.fighter.plan(plan.id),
    });
}

/** Creates a training plan and tells the fighter when it is published as active. */
export async function createPlan(input: PlanInput, actor: User): Promise<TrainingPlan> {
    const now = nowIso();
    const plan: TrainingPlan = {
        id: newId("tp"),
        title: input.title.trim(),
        fighterId: input.fighterId,
        coachId: input.coachId,
        objective: input.objective.trim(),
        phase: input.phase,
        focusAreas: unique(input.focusAreas),
        startDate: input.startDate,
        endDate: input.endDate,
        weeklySessionTarget: input.weeklySessionTarget,
        status: input.status ?? "draft",
        notes: input.notes.trim(),
        createdAt: now,
        updatedAt: now,
    };
    db().trainingPlans.unshift(plan);
    recordAudit({
        actor,
        action: "training_plan.create",
        resourceType: "training_plan",
        resourceId: plan.id,
        resourceLabel: `${fighterName(plan.fighterId)} — ${plan.title}`,
        details: `Status ${plan.status}, phase ${plan.phase}`,
    });
    if (plan.status === "active") notifyPlanActivated(plan, actor);
    return plan;
}

/** Updates plan details. Returns null when the plan doesn't exist. */
export async function updatePlan(id: string, input: PlanUpdateInput, actor: User): Promise<TrainingPlan | null> {
    const plan = db().trainingPlans.find((p) => p.id === id);
    if (!plan) return null;
    const changed = (Object.keys(input) as (keyof PlanUpdateInput)[]).filter((key) => input[key] !== undefined);
    if (input.title !== undefined) plan.title = input.title.trim();
    if (input.objective !== undefined) plan.objective = input.objective.trim();
    if (input.phase !== undefined) plan.phase = input.phase;
    if (input.focusAreas !== undefined) plan.focusAreas = unique(input.focusAreas);
    if (input.startDate !== undefined) plan.startDate = input.startDate;
    if (input.endDate !== undefined) plan.endDate = input.endDate;
    if (input.weeklySessionTarget !== undefined) plan.weeklySessionTarget = input.weeklySessionTarget;
    if (input.notes !== undefined) plan.notes = input.notes.trim();
    plan.updatedAt = nowIso();
    recordAudit({
        actor,
        action: "training_plan.update",
        resourceType: "training_plan",
        resourceId: plan.id,
        resourceLabel: `${fighterName(plan.fighterId)} — ${plan.title}`,
        details: changed.length > 0 ? `Changed: ${changed.join(", ")}` : null,
    });
    return plan;
}

/** Moves a plan through draft → active → completed/archived. Returns null when the plan doesn't exist. */
export async function setPlanStatus(id: string, status: PlanStatus, actor: User): Promise<TrainingPlan | null> {
    const plan = db().trainingPlans.find((p) => p.id === id);
    if (!plan) return null;
    if (plan.status === status) return plan;
    const previous = plan.status;
    plan.status = status;
    plan.updatedAt = nowIso();
    recordAudit({
        actor,
        action: "training_plan.status_change",
        resourceType: "training_plan",
        resourceId: plan.id,
        resourceLabel: `${fighterName(plan.fighterId)} — ${plan.title}`,
        details: `${previous} → ${status}`,
    });
    if (status === "active") notifyPlanActivated(plan, actor);
    return plan;
}

/* ─── Training sessions ───────────────────────────────────────────────────── */

const toUtcIso = (value: string) => new Date(value).toISOString();

/** Normalises an optional date bound from a URL or form; unparseable values are ignored. */
function parseBound(value: string | undefined): string | null {
    const ms = value ? Date.parse(value) : Number.NaN;
    return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

/** Sessions matching the filter, sorted by scheduled time. */
export async function listSessions(filter: SessionFilter = {}): Promise<TrainingSession[]> {
    await simulateLatency();
    const statuses = filter.status === undefined ? null : Array.isArray(filter.status) ? filter.status : [filter.status];
    const from = parseBound(filter.from);
    const to = parseBound(filter.to);
    const direction = filter.order === "desc" ? -1 : 1;
    return db()
        .trainingSessions.filter(
            (s) =>
                inScope(filter.fighterIds, s.fighterId) &&
                (!filter.coachId || s.coachId === filter.coachId) &&
                (!filter.planId || s.planId === filter.planId) &&
                (!statuses || statuses.includes(s.status)) &&
                (!filter.type || s.type === filter.type) &&
                (!from || s.scheduledAt >= from) &&
                (!to || s.scheduledAt <= to) &&
                matchesSearch(filter.search, s.title, s.location, fighterName(s.fighterId)),
        )
        .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt) * direction);
}

/** A single session, or null when it doesn't exist. */
export async function getSession(id: string): Promise<TrainingSession | null> {
    await simulateLatency(0.5);
    return db().trainingSessions.find((s) => s.id === id) ?? null;
}

/** Next scheduled (or currently running) sessions, soonest first. */
export async function getUpcomingSessions(fighterIds: FighterScope, limit = 5): Promise<TrainingSession[]> {
    await simulateLatency();
    const now = Date.now();
    return db()
        .trainingSessions.filter(
            (s) =>
                inScope(fighterIds, s.fighterId) &&
                (s.status === "scheduled" || s.status === "in_progress") &&
                plannedEndMs(s) >= now,
        )
        .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
        .slice(0, limit);
}

const HISTORY_STATUSES: SessionStatus[] = ["completed", "missed", "cancelled"];

/** A fighter's past sessions (completed, missed or cancelled), most recent first. */
export async function getSessionHistory(fighterId: string, limit?: number): Promise<TrainingSession[]> {
    await simulateLatency();
    const now = nowIso();
    const history = db()
        .trainingSessions.filter(
            (s) => s.fighterId === fighterId && s.scheduledAt <= now && HISTORY_STATUSES.includes(s.status),
        )
        .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
    return limit === undefined ? history : history.slice(0, limit);
}

type PlannedSession = Pick<SessionInput, "fighterId" | "type" | "exercises" | "scheduledAt"> & { targetRpe: number | null };

/**
 * Checks planned training against the fighter's current Medical Clearance, using the techniques and
 * loaded body regions of the session's exercises. Evaluated at the session time (or now, for past times)
 * so a clearance that lapses before the session is caught. Use it to preview conflicts in forms.
 */
export function getSessionClearanceConflicts(planned: PlannedSession): ClearanceConflict[] {
    const store = db();
    const exercises = planned.exercises
        .map((item) => store.exercises.find((e) => e.id === item.exerciseId))
        .filter((e): e is Exercise => e !== undefined);
    const scheduledMs = Date.parse(planned.scheduledAt);
    const evaluatedAt = new Date(Number.isNaN(scheduledMs) ? Date.now() : Math.max(Date.now(), scheduledMs));
    return checkTrainingAgainstClearance(
        {
            type: planned.type,
            targetRpe: planned.targetRpe,
            techniques: unique<Technique>(exercises.flatMap((e) => e.techniques)),
            loadsRegions: unique<BodyRegion>(exercises.flatMap((e) => e.loadsRegions)),
        },
        currentClearance(store.medicalClearances, planned.fighterId),
        evaluatedAt,
    );
}

/** Referential checks the form schema can't do. Returns an error message or null. */
function validateSessionInput(input: SessionUpdateInput, fighterId: string): string | null {
    const store = db();
    if (!store.fighters.some((f) => f.id === fighterId)) return "That fighter no longer exists.";
    if (!store.coaches.some((c) => c.id === input.coachId)) return "Choose a coach for this session.";
    if (input.planId) {
        const plan = store.trainingPlans.find((p) => p.id === input.planId);
        if (!plan || plan.fighterId !== fighterId) return "The selected training plan doesn't belong to this fighter.";
    }
    if (Number.isNaN(Date.parse(input.scheduledAt))) return "Enter a valid date and time.";
    const rpe = input.targetRpe;
    if (rpe === null || !Number.isInteger(rpe) || rpe < 1 || rpe > 10) return "Target RPE must be a whole number from 1 to 10.";
    if (input.durationMin <= 0) return "Duration must be longer than 0 minutes.";
    const unknown = input.exercises.find((item) => !store.exercises.some((e) => e.id === item.exerciseId));
    if (unknown) return `Exercise ${unknown.exerciseId} is not in the library.`;
    return null;
}

/** Blocks are never overridable; warnings need explicit acknowledgement. */
function clearanceGate(
    conflicts: ClearanceConflict[],
    acknowledged: boolean,
): Extract<SessionMutationResult, { ok: false }> | null {
    if (conflicts.some((c) => c.severity === "block")) {
        return {
            ok: false,
            reason: "blocked",
            message: "This session conflicts with the fighter's Medical Clearance and can't be scheduled as planned.",
            conflicts,
        };
    }
    if (conflicts.length > 0 && !acknowledged) {
        return {
            ok: false,
            reason: "warnings_not_acknowledged",
            message: "Review the Medical Clearance warnings and confirm to schedule this session anyway.",
            conflicts,
        };
    }
    return null;
}

const sessionLabel = (session: Pick<TrainingSession, "fighterId" | "title">) =>
    `${fighterName(session.fighterId)} — ${session.title}`;

const conflictSummary = (conflicts: ClearanceConflict[]) => conflicts.map((c) => c.message).join(" ");

/** Doctors are told when a coach schedules training over clearance warnings. */
function notifyDoctorsOfWarnings(session: TrainingSession, conflicts: ClearanceConflict[], actor: User): void {
    const userIds = recipients(staffUserIdsForFighter(session.fighterId, ["doctor"]), actor);
    if (conflicts.length === 0 || userIds.length === 0) return;
    notifyUsers({
        userIds,
        category: "clearance",
        severity: "warning",
        title: "Session scheduled with clearance warnings",
        body: `${actor.name} scheduled ${session.title} for ${fighterName(session.fighterId)} on ${formatDateTime(session.scheduledAt)}. ${conflictSummary(conflicts)}`,
        href: routes.doctor.fighter(session.fighterId),
    });
}

type EditableSessionFields = Pick<
    TrainingSession,
    "planId" | "coachId" | "title" | "type" | "scheduledAt" | "durationMin" | "location" | "targetRpe" | "exercises" | "notes"
>;

function editableSessionFields(input: SessionUpdateInput): EditableSessionFields {
    return {
        planId: input.planId,
        coachId: input.coachId,
        title: input.title.trim(),
        type: input.type,
        scheduledAt: toUtcIso(input.scheduledAt),
        durationMin: input.durationMin,
        location: input.location.trim(),
        targetRpe: input.targetRpe,
        exercises: input.exercises.map((e) => ({ ...e, completed: false })),
        notes: input.notes?.trim() || null,
    };
}

/**
 * Schedules a session after checking it against the fighter's Medical Clearance.
 * Refuses blocking conflicts outright and warnings unless `acknowledgeWarnings` is set.
 * Notifies the fighter, the assigned coach and — when warnings were acknowledged — the fighter's doctors.
 */
export async function createSession(input: SessionInput, actor: User): Promise<SessionMutationResult> {
    const invalid = validateSessionInput(input, input.fighterId);
    if (invalid) return { ok: false, reason: "invalid", message: invalid, conflicts: [] };

    const conflicts = getSessionClearanceConflicts(input);
    const refused = clearanceGate(conflicts, input.acknowledgeWarnings === true);
    if (refused) {
        if (refused.reason === "blocked") {
            recordAudit({
                actor,
                action: "training_session.create",
                resourceType: "training_session",
                resourceId: "new",
                resourceLabel: sessionLabel(input),
                status: "failure",
                details: `Blocked by Medical Clearance: ${conflictSummary(conflicts)}`,
            });
        }
        return refused;
    }

    const session: TrainingSession = {
        id: newId("s"),
        fighterId: input.fighterId,
        ...editableSessionFields(input),
        status: "scheduled",
        result: null,
        videoIds: [],
        cancellationReason: null,
    };
    db().trainingSessions.push(session);

    recordAudit({
        actor,
        action: "training_session.create",
        resourceType: "training_session",
        resourceId: session.id,
        resourceLabel: sessionLabel(session),
        details: conflicts.length > 0 ? `Scheduled with acknowledged clearance warnings: ${conflictSummary(conflicts)}` : null,
    });

    const when = formatDateTime(session.scheduledAt);
    const fighterIds = recipients(fighterUserIds(session.fighterId), actor);
    if (fighterIds.length > 0) {
        notifyUsers({
            userIds: fighterIds,
            category: "training",
            title: "New session scheduled",
            body: `${session.title} (${TRAINING_TYPE_LABELS[session.type]}) on ${when} — ${session.location}.`,
            href: routes.fighter.session(session.id),
        });
    }
    const coachIds = recipients(session.coachId ? [coachUserId(session.coachId)] : [], actor);
    if (coachIds.length > 0) {
        notifyUsers({
            userIds: coachIds,
            category: "training",
            title: "Session assigned to you",
            body: `${actor.name} scheduled ${session.title} with ${fighterName(session.fighterId)} on ${when}.`,
            href: routes.coach.session(session.id),
        });
    }
    notifyDoctorsOfWarnings(session, conflicts, actor);
    return { ok: true, session, conflicts };
}

/** Edits a scheduled session with the same clearance checks as `createSession`. */
export async function updateSession(id: string, input: SessionUpdateInput, actor: User): Promise<SessionMutationResult> {
    const session = db().trainingSessions.find((s) => s.id === id);
    if (!session) return { ok: false, reason: "not_found", message: "That session no longer exists.", conflicts: [] };
    if (session.status !== "scheduled") {
        return { ok: false, reason: "invalid_state", message: "Only scheduled sessions can be edited.", conflicts: [] };
    }
    const invalid = validateSessionInput(input, session.fighterId);
    if (invalid) return { ok: false, reason: "invalid", message: invalid, conflicts: [] };

    const conflicts = getSessionClearanceConflicts({ ...input, fighterId: session.fighterId });
    const refused = clearanceGate(conflicts, input.acknowledgeWarnings === true);
    if (refused) {
        if (refused.reason === "blocked") {
            recordAudit({
                actor,
                action: "training_session.update",
                resourceType: "training_session",
                resourceId: session.id,
                resourceLabel: sessionLabel(session),
                status: "failure",
                details: `Blocked by Medical Clearance: ${conflictSummary(conflicts)}`,
            });
        }
        return refused;
    }

    const previousStart = session.scheduledAt;
    const previousLocation = session.location;
    Object.assign(session, editableSessionFields(input));
    const rescheduled = previousStart !== session.scheduledAt;

    recordAudit({
        actor,
        action: "training_session.update",
        resourceType: "training_session",
        resourceId: session.id,
        resourceLabel: sessionLabel(session),
        details: [
            rescheduled ? `Rescheduled from ${formatDateTime(previousStart)} to ${formatDateTime(session.scheduledAt)}` : null,
            conflicts.length > 0 ? `Acknowledged clearance warnings: ${conflictSummary(conflicts)}` : null,
        ]
            .filter(Boolean)
            .join(". ") || null,
    });

    // Like the training service, the fighter hears about a change of time or place only.
    const fighterIds = recipients(fighterUserIds(session.fighterId), actor);
    if ((rescheduled || previousLocation !== session.location) && fighterIds.length > 0) {
        notifyUsers({
            userIds: fighterIds,
            category: "training",
            title: "Session changed",
            body: `${session.title} is now on ${formatDateTime(session.scheduledAt)} — ${session.location}.`,
            href: routes.fighter.session(session.id),
        });
    }
    notifyDoctorsOfWarnings(session, conflicts, actor);
    return { ok: true, session, conflicts };
}

/** The lowest RPE cap in the fighter's current clearance, when that clearance already applied to the session. */
function clearanceRpeCap(session: TrainingSession): number | null {
    const clearance = currentClearance(db().medicalClearances, session.fighterId);
    if (!clearance || clearance.issuedAt > session.scheduledAt) return null;
    const caps = clearance.restrictions.map((r) => r.maxRpe).filter((cap): cap is number => cap !== null);
    return caps.length > 0 ? Math.min(...caps) : null;
}

/**
 * Records how a session went and marks it completed. Corrections to an already completed session are allowed.
 * Notifies the fighter, and the fighter's doctors when the reported RPE exceeded the clearance cap.
 */
export async function recordSessionResult(
    id: string,
    input: SessionResultInput,
    actor: User,
): Promise<SessionMutationResult> {
    const session = db().trainingSessions.find((s) => s.id === id);
    if (!session) return { ok: false, reason: "not_found", message: "That session no longer exists.", conflicts: [] };
    if (session.status === "cancelled" || session.status === "missed") {
        return {
            ok: false,
            reason: "invalid_state",
            message: `This session was ${session.status}, so results can't be recorded.`,
            conflicts: [],
        };
    }
    if (Date.parse(session.scheduledAt) > Date.now()) {
        return { ok: false, reason: "invalid_state", message: "This session hasn't started yet.", conflicts: [] };
    }

    const result: SessionResult = {
        completedAt: input.completedAt ? toUtcIso(input.completedAt) : nowIso(),
        actualDurationMin: input.actualDurationMin,
        rpe: input.rpe,
        roundsCompleted: input.roundsCompleted,
        coachRating: input.coachRating,
        summary: input.summary.trim(),
    };
    const correction = session.status === "completed";
    session.status = "completed";
    session.result = result;
    session.exercises = session.exercises.map((e) => ({
        ...e,
        completed: input.completedExerciseIds ? input.completedExerciseIds.includes(e.exerciseId) : true,
    }));

    recordAudit({
        actor,
        action: correction ? "training_session.correct_result" : "training_session.record_result",
        resourceType: "training_session",
        resourceId: session.id,
        resourceLabel: sessionLabel(session),
        details: `RPE ${result.rpe}, coach rating ${result.coachRating}/5, ${result.actualDurationMin} min`,
    });

    const cap = clearanceRpeCap(session);
    const doctorIds = recipients(staffUserIdsForFighter(session.fighterId, ["doctor"]), actor);
    if (cap !== null && result.rpe !== null && result.rpe > cap && doctorIds.length > 0) {
        notifyUsers({
            userIds: doctorIds,
            category: "clearance",
            severity: "warning",
            title: "Session RPE above cleared maximum",
            body: `${fighterName(session.fighterId)} reported RPE ${result.rpe} for ${session.title} on ${formatDateTime(session.scheduledAt)}. The current clearance allows up to RPE ${cap}.`,
            href: routes.doctor.fighter(session.fighterId),
        });
    }
    return { ok: true, session, conflicts: [] };
}

/** Checks the fighter in, unless their Medical Clearance blocks this training now (as the training service does). */
export async function startSession(id: string, actor: User): Promise<SessionMutationResult> {
    const session = db().trainingSessions.find((s) => s.id === id);
    if (!session) return { ok: false, reason: "not_found", message: "That session no longer exists.", conflicts: [] };
    if (session.status !== "scheduled") return { ok: false, reason: "invalid_state", message: "Only a scheduled session can be started.", conflicts: [] };
    const conflicts = getSessionClearanceConflicts({ ...session, scheduledAt: nowIso() });
    if (conflicts.some((c) => c.severity === "block")) {
        return { ok: false, reason: "blocked", message: "The fighter's Medical Clearance doesn't allow this training right now.", conflicts };
    }
    session.status = "in_progress";
    recordAudit({ actor, action: "training_session.start", resourceType: "training_session", resourceId: session.id, resourceLabel: sessionLabel(session) });
    return { ok: true, session, conflicts };
}

/** Records that a scheduled session didn't happen once its start time has passed. */
export async function markSessionMissed(id: string, actor: User): Promise<SessionMutationResult> {
    const session = db().trainingSessions.find((s) => s.id === id);
    if (!session) return { ok: false, reason: "not_found", message: "That session no longer exists.", conflicts: [] };
    if (session.status !== "scheduled" || Date.parse(session.scheduledAt) > Date.now()) {
        return { ok: false, reason: "invalid_state", message: "Only a scheduled session whose start time has passed can be marked as missed.", conflicts: [] };
    }
    session.status = "missed";
    recordAudit({ actor, action: "training_session.miss", resourceType: "training_session", resourceId: session.id, resourceLabel: sessionLabel(session) });
    return { ok: true, session, conflicts: [] };
}

/* ─── Plan exercises ──────────────────────────────────────────────────────── */

export async function listPlanExercises(planId: string): Promise<PlanExercise[]> {
    await simulateLatency();
    return db()
        .planExercises.filter((item) => item.planId === planId)
        .sort((left, right) => left.orderIndex - right.orderIndex);
}

function planExerciseAudit(action: string, item: PlanExercise, actor: User): void {
    const plan = db().trainingPlans.find((p) => p.id === item.planId);
    const exercise = db().exercises.find((e) => e.id === item.exerciseId);
    recordAudit({
        actor,
        action,
        resourceType: "training_plan",
        resourceId: item.planId,
        resourceLabel: plan ? `${fighterName(plan.fighterId)} — ${plan.title}` : item.planId,
        details: exercise?.name ?? null,
    });
}

export async function addPlanExercise(planId: string, exerciseId: string, input: PlanExerciseFields, actor: User): Promise<PlanExercise> {
    const store = db();
    const orderIndex = store.planExercises.filter((item) => item.planId === planId).reduce((next, item) => Math.max(next, item.orderIndex + 1), 0);
    const item: PlanExercise = { id: newId("plan-exercise"), planId, exerciseId, orderIndex, ...input, notes: input.notes?.trim() || null };
    store.planExercises.push(item);
    planExerciseAudit("training_plan.add_exercise", item, actor);
    return item;
}

export async function updatePlanExercise(planId: string, id: string, input: PlanExerciseFields, actor: User): Promise<PlanExercise | null> {
    const item = db().planExercises.find((candidate) => candidate.id === id && candidate.planId === planId);
    if (!item) return null;
    Object.assign(item, input, { notes: input.notes?.trim() || null });
    planExerciseAudit("training_plan.update_exercise", item, actor);
    return item;
}

export async function removePlanExercise(planId: string, id: string, actor: User): Promise<boolean> {
    const store = db();
    const item = store.planExercises.find((candidate) => candidate.id === id && candidate.planId === planId);
    if (!item) return false;
    store.planExercises = store.planExercises.filter((candidate) => candidate !== item);
    planExerciseAudit("training_plan.remove_exercise", item, actor);
    return true;
}

/** Cancels a scheduled session and tells the fighter and the assigned coach why. */
export async function cancelSession(id: string, reason: string, actor: User): Promise<SessionMutationResult> {
    const session = db().trainingSessions.find((s) => s.id === id);
    if (!session) return { ok: false, reason: "not_found", message: "That session no longer exists.", conflicts: [] };
    if (session.status !== "scheduled" && session.status !== "in_progress") {
        return { ok: false, reason: "invalid_state", message: "Only upcoming sessions can be cancelled.", conflicts: [] };
    }
    const trimmedReason = reason.trim();
    session.status = "cancelled";
    session.cancellationReason = trimmedReason;
    session.exercises = session.exercises.map((e) => ({ ...e, completed: false }));

    recordAudit({
        actor,
        action: "training_session.cancel",
        resourceType: "training_session",
        resourceId: session.id,
        resourceLabel: sessionLabel(session),
        details: trimmedReason,
    });

    const body = `${session.title} on ${formatDateTime(session.scheduledAt)} was cancelled: ${trimmedReason}`;
    const fighterIds = recipients(fighterUserIds(session.fighterId), actor);
    if (fighterIds.length > 0) {
        notifyUsers({
            userIds: fighterIds,
            category: "training",
            severity: "warning",
            title: "Session cancelled",
            body,
            href: routes.fighter.session(session.id),
        });
    }
    const coachIds = recipients(session.coachId ? [coachUserId(session.coachId)] : [], actor);
    if (coachIds.length > 0) {
        notifyUsers({
            userIds: coachIds,
            category: "training",
            severity: "warning",
            title: `Session cancelled — ${fighterName(session.fighterId)}`,
            body,
            href: routes.coach.session(session.id),
        });
    }
    return { ok: true, session, conflicts: [] };
}

/* ─── Progress & agenda ───────────────────────────────────────────────────── */

function mostCommonPlanId(sessions: TrainingSession[]): string | null {
    const counts = new Map<string, number>();
    for (const s of sessions) {
        if (s.planId) counts.set(s.planId, (counts.get(s.planId) ?? 0) + 1);
    }
    let best: string | null = null;
    let bestCount = 0;
    counts.forEach((count, planId) => {
        if (count > bestCount) {
            best = planId;
            bestCount = count;
        }
    });
    return best;
}

/**
 * Weekly plan adherence for the last `weeks` weeks (Monday–Sunday, academy time), oldest first; the last
 * entry is the current week. Planned = non-cancelled sessions scheduled that week (including ones still
 * upcoming), adherence = completed / planned (0 when nothing was planned).
 */
export async function getTrainingProgress(fighterId: string, weeks = 8): Promise<TrainingProgress[]> {
    await simulateLatency();
    const sessions = db().trainingSessions.filter((s) => s.fighterId === fighterId && s.status !== "cancelled");
    const progress: TrainingProgress[] = [];
    for (let weeksAgo = weeks - 1; weeksAgo >= 0; weeksAgo--) {
        const start = weekStart(weeksAgo);
        const end = weekStart(weeksAgo - 1);
        const planned = sessions.filter((s) => s.scheduledAt >= start && s.scheduledAt < end);
        const completed = planned.filter((s) => s.status === "completed");
        progress.push({
            fighterId,
            planId: mostCommonPlanId(planned),
            weekStart: start,
            plannedSessions: planned.length,
            completedSessions: completed.length,
            missedSessions: planned.filter((s) => s.status === "missed").length,
            adherencePct: planned.length === 0 ? 0 : Math.round((completed.length / planned.length) * 100),
            trainingMinutes: completed.reduce((total, s) => total + sessionMinutes(s), 0),
        });
    }
    return progress;
}

/** Day-by-day agenda starting on the academy-local day of `fromISO` (today when it can't be parsed). */
export async function getWeekAgenda(fighterIds: FighterScope, fromISO: string, days = 7): Promise<AgendaDay[]> {
    await simulateLatency();
    const startMs = Date.parse(academyDayStartIso(dayKey(parseBound(fromISO) ?? nowIso())));
    const startIso = new Date(startMs).toISOString();
    const endIso = new Date(startMs + days * DAY_MS).toISOString();
    const agenda: AgendaDay[] = Array.from({ length: days }, (_, index) => ({
        date: dayKey(new Date(startMs + (index + 0.5) * DAY_MS)),
        sessions: [],
    }));
    const byDate = new Map(agenda.map((day) => [day.date, day]));
    db()
        .trainingSessions.filter(
            (s) => inScope(fighterIds, s.fighterId) && s.scheduledAt >= startIso && s.scheduledAt < endIso,
        )
        .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
        .forEach((s) => byDate.get(dayKey(s.scheduledAt))?.sessions.push(s));
    return agenda;
}

/* ─── Coach feedback ──────────────────────────────────────────────────────── */

/** Coach feedback, newest first. */
export async function listCoachFeedback(filter: FeedbackFilter = {}): Promise<CoachFeedback[]> {
    await simulateLatency();
    return db()
        .coachFeedback.filter(
            (f) =>
                inScope(filter.fighterIds, f.fighterId) &&
                (!filter.coachId || f.coachId === filter.coachId) &&
                (!filter.sessionId || f.sessionId === filter.sessionId) &&
                (!filter.videoId || f.videoId === filter.videoId) &&
                (!filter.kind || f.kind === filter.kind),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Adds coach feedback on a session, a video or the fighter in general, and notifies the fighter. */
export async function addCoachFeedback(input: FeedbackInput, actor: User): Promise<CoachFeedback> {
    const feedback: CoachFeedback = {
        ...input,
        body: input.body.trim(),
        techniques: unique(input.techniques),
        id: newId("fb"),
        createdAt: nowIso(),
    };
    db().coachFeedback.unshift(feedback);

    const resource = feedback.sessionId
        ? { resourceType: "training_session" as const, resourceId: feedback.sessionId }
        : feedback.videoId
          ? { resourceType: "video" as const, resourceId: feedback.videoId }
          : { resourceType: "fighter" as const, resourceId: feedback.fighterId };
    recordAudit({
        actor,
        action: "coach_feedback.create",
        ...resource,
        resourceLabel: fighterName(feedback.fighterId),
        details: `${feedback.kind} feedback`,
    });

    const userIds = recipients(fighterUserIds(feedback.fighterId), actor);
    if (userIds.length > 0) {
        notifyUsers({
            userIds,
            category: "feedback",
            title: `New feedback from ${actor.name}`,
            body: feedback.body.length > 160 ? `${feedback.body.slice(0, 157)}…` : feedback.body,
            href: feedback.sessionId
                ? routes.fighter.session(feedback.sessionId)
                : feedback.videoId
                  ? routes.fighter.video(feedback.videoId)
                  : routes.fighter.training,
        });
    }
    return feedback;
}
