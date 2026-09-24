"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { canAccessFighter } from "@/lib/auth/access";
import { authorizeAction } from "@/lib/auth/session";
import { FEEDBACK_KIND_LABELS, PLAN_STATUS_LABELS, TECHNIQUES, TRAINING_PHASE_LABELS, TRAINING_TYPE_LABELS } from "@/lib/domain/labels";
import type { ClearanceConflict } from "@/lib/domain/rules";
import type { FeedbackKind, PlanStatus, TrainingPhase, TrainingSession, TrainingType, User } from "@/lib/domain/types";
import { academyDayEndIso, academyDayStartIso, academyWallClockToIso, isDateKey, isTimeValue } from "@/lib/format";
import { routes } from "@/lib/routes";
import * as training from "@/lib/services/training";
import { actionError, actionSuccess, validationError, type ActionState } from "./state";

/* ─── Shared ──────────────────────────────────────────────────────────────── */

const PHASES = Object.keys(TRAINING_PHASE_LABELS) as TrainingPhase[];
const TRAINING_TYPES = Object.keys(TRAINING_TYPE_LABELS) as TrainingType[];
const PLAN_STATUSES = Object.keys(PLAN_STATUS_LABELS) as PlanStatus[];
const FEEDBACK_KINDS = Object.keys(FEEDBACK_KIND_LABELS) as FeedbackKind[];

const NOT_ON_ROSTER = "You can only manage training for fighters on your roster.";
const NO_COACH_PROFILE = "Your account isn't linked to a coach profile, so you can't plan training.";

export interface SessionFormResult {
    /** Clearance conflicts found when the server checked the session. */
    conflicts: ClearanceConflict[];
}

function text(formData: FormData, name: string): string {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
}

function texts(formData: FormData, name: string): string[] {
    return formData.getAll(name).filter((value): value is string => typeof value === "string");
}

/** Whole number within bounds, coerced from a form value. */
function wholeNumber(label: string, min: number, max: number) {
    const message = `${label} must be a whole number from ${min} to ${max}.`;
    return z.coerce.number(message).int(message).min(min, message).max(max, message);
}

/** Authorizes a coach action and loads the coach profile id. */
async function authorizeCoach(): Promise<{ ok: true; user: User; coachId: string } | { ok: false; state: ActionState<never> }> {
    const auth = await authorizeAction("training:write");
    if (!auth.ok) return { ok: false, state: actionError(auth.message) };
    if (!auth.user.profileId) return { ok: false, state: actionError(NO_COACH_PROFILE) };
    return { ok: true, user: auth.user, coachId: auth.user.profileId };
}

function revalidatePlan(planId: string, fighterId: string): void {
    revalidatePath(routes.coach.plans);
    revalidatePath(routes.coach.plan(planId));
    revalidatePath(routes.coach.fighterTraining(fighterId));
    revalidatePath(routes.fighter.training);
    revalidatePath(routes.fighter.plan(planId));
}

function revalidateSession(session: Pick<TrainingSession, "id" | "fighterId" | "planId">): void {
    revalidatePath(routes.coach.sessions);
    revalidatePath(routes.coach.session(session.id));
    revalidatePath(routes.coach.fighterTraining(session.fighterId));
    revalidatePath(routes.fighter.schedule);
    revalidatePath(routes.fighter.history);
    revalidatePath(routes.fighter.session(session.id));
    if (session.planId) revalidatePlan(session.planId, session.fighterId);
}

/* ─── Training plans ──────────────────────────────────────────────────────── */

const planFieldsSchema = z.object({
    title: z.string().trim().min(3, "Enter a title of at least 3 characters.").max(120, "Keep the title under 120 characters."),
    objective: z
        .string()
        .trim()
        .min(10, "Describe the objective in at least 10 characters.")
        .max(600, "Keep the objective under 600 characters."),
    phase: z.enum(PHASES, "Choose a training phase."),
    focusAreas: z.array(z.enum(TECHNIQUES, "Choose focus areas from the list.")).min(1, "Choose at least one focus area."),
    startDate: z.string().refine(isDateKey, "Enter a valid start date."),
    endDate: z.string().refine(isDateKey, "Enter a valid end date."),
    weeklySessionTarget: wholeNumber("Weekly sessions", 1, 14),
    notes: z.string().trim().max(2000, "Keep notes under 2,000 characters."),
});

const planDateOrder = { path: ["endDate"], error: "The end date must be on or after the start date." };

const createPlanSchema = planFieldsSchema
    .extend({
        fighterId: z.string().min(1, "Choose a fighter."),
        status: z.enum(["draft", "active"], "Choose whether to save a draft or publish the plan."),
    })
    .refine((data) => data.endDate >= data.startDate, planDateOrder);

const updatePlanSchema = planFieldsSchema.refine((data) => data.endDate >= data.startDate, planDateOrder);

function readPlanForm(formData: FormData) {
    return {
        title: text(formData, "title"),
        objective: text(formData, "objective"),
        phase: text(formData, "phase"),
        focusAreas: texts(formData, "focusAreas"),
        startDate: text(formData, "startDate"),
        endDate: text(formData, "endDate"),
        weeklySessionTarget: text(formData, "weeklySessionTarget"),
        notes: text(formData, "notes"),
    };
}

export async function createPlan(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeCoach();
    if (!auth.ok) return auth.state;

    const parsed = createPlanSchema.safeParse({
        ...readPlanForm(formData),
        fighterId: text(formData, "fighterId"),
        status: text(formData, "status"),
    });
    if (!parsed.success) return validationError(parsed.error);
    const input = parsed.data;
    if (!canAccessFighter(auth.user, input.fighterId)) return actionError(NOT_ON_ROSTER, { fighterId: "Choose a fighter from your roster." });

    const plan = await training.createPlan(
        {
            ...input,
            coachId: auth.coachId,
            startDate: academyDayStartIso(input.startDate),
            endDate: academyDayEndIso(input.endDate),
        },
        auth.user,
    );
    revalidatePlan(plan.id, plan.fighterId);
    redirect(routes.coach.plan(plan.id));
}

export async function updatePlan(planId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeCoach();
    if (!auth.ok) return auth.state;

    const parsed = updatePlanSchema.safeParse(readPlanForm(formData));
    if (!parsed.success) return validationError(parsed.error);

    const existing = await training.getPlan(planId);
    if (!existing || !canAccessFighter(auth.user, existing.fighterId)) return actionError("That plan no longer exists or isn't on your roster.");

    const input = parsed.data;
    const plan = await training.updatePlan(
        planId,
        { ...input, startDate: academyDayStartIso(input.startDate), endDate: academyDayEndIso(input.endDate) },
        auth.user,
    );
    if (!plan) return actionError("That plan no longer exists.");
    revalidatePlan(plan.id, plan.fighterId);
    redirect(routes.coach.plan(plan.id));
}

/** Allowed status changes. Archived plans can be restored as drafts. */
const PLAN_TRANSITIONS: Record<PlanStatus, PlanStatus[]> = {
    draft: ["active", "archived"],
    active: ["completed", "archived"],
    completed: ["archived"],
    archived: ["draft"],
};

const PLAN_STATUS_MESSAGES: Record<PlanStatus, string> = {
    draft: "Plan restored as a draft.",
    active: "Plan activated. The fighter has been notified.",
    completed: "Plan marked as completed.",
    archived: "Plan archived.",
};

export async function setPlanStatus(planId: string, status: PlanStatus): Promise<ActionState> {
    const auth = await authorizeCoach();
    if (!auth.ok) return auth.state;

    const parsed = z.enum(PLAN_STATUSES, "Choose a valid plan status.").safeParse(status);
    if (!parsed.success) return validationError(parsed.error);

    const existing = await training.getPlan(planId);
    if (!existing || !canAccessFighter(auth.user, existing.fighterId)) return actionError("That plan no longer exists or isn't on your roster.");
    if (!PLAN_TRANSITIONS[existing.status].includes(parsed.data)) {
        return actionError(`A ${PLAN_STATUS_LABELS[existing.status].toLowerCase()} plan can't be moved to ${PLAN_STATUS_LABELS[parsed.data].toLowerCase()}.`);
    }

    const plan = await training.setPlanStatus(planId, parsed.data, auth.user);
    if (!plan) return actionError("That plan no longer exists.");
    revalidatePlan(plan.id, plan.fighterId);
    return actionSuccess(PLAN_STATUS_MESSAGES[plan.status]);
}

/* ─── Training sessions ───────────────────────────────────────────────────── */

const optionalWhole = (label: string, min: number, max: number) => {
    const message = `${label} must be a whole number from ${min} to ${max}.`;
    return z.number(message).int(message).min(min, message).max(max, message).nullable();
};

const sessionExerciseSchema = z.object({
    exerciseId: z.string().min(1, "Choose an exercise."),
    rounds: optionalWhole("Rounds", 1, 30),
    roundSec: optionalWhole("Round length", 10, 1800),
    sets: optionalWhole("Sets", 1, 20),
    reps: optionalWhole("Reps", 1, 200),
    notes: z.string().trim().max(300, "Keep exercise notes under 300 characters.").nullable(),
});

const sessionFieldsSchema = z.object({
    planId: z.string(),
    title: z.string().trim().min(3, "Enter a title of at least 3 characters.").max(120, "Keep the title under 120 characters."),
    type: z.enum(TRAINING_TYPES, "Choose a training type."),
    date: z.string().refine(isDateKey, "Enter a valid date."),
    time: z.string().refine(isTimeValue, "Enter a start time."),
    durationMin: wholeNumber("Duration", 10, 300),
    location: z.string().trim().min(2, "Enter where the session takes place.").max(120, "Keep the location under 120 characters."),
    targetRpe: wholeNumber("Target RPE", 1, 10),
    exercises: z.array(sessionExerciseSchema, "The exercise list couldn't be read. Reload the page and try again.").max(20, "Add at most 20 exercises."),
    notes: z.string().trim().max(1000, "Keep notes under 1,000 characters."),
    acknowledgeWarnings: z.boolean(),
});

const createSessionSchema = sessionFieldsSchema.extend({ fighterId: z.string().min(1, "Choose a fighter.") });

function parseJson(value: string): unknown {
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

function readSessionForm(formData: FormData) {
    return {
        planId: text(formData, "planId"),
        title: text(formData, "title"),
        type: text(formData, "type"),
        date: text(formData, "date"),
        time: text(formData, "time"),
        durationMin: text(formData, "durationMin"),
        location: text(formData, "location"),
        targetRpe: text(formData, "targetRpe"),
        exercises: parseJson(text(formData, "exercises") || "[]"),
        notes: text(formData, "notes"),
        acknowledgeWarnings: formData.get("acknowledgeWarnings") === "on",
    };
}

type SessionFields = z.infer<typeof sessionFieldsSchema>;

/** Five minutes of grace so a session set for "now" isn't rejected while the coach types. */
const PAST_GRACE_MS = 5 * 60_000;

function toServiceInput(fields: SessionFields, scheduledAt: string, coachId: string): training.SessionUpdateInput {
    return {
        coachId,
        planId: fields.planId || null,
        title: fields.title,
        type: fields.type,
        scheduledAt,
        durationMin: fields.durationMin,
        location: fields.location,
        targetRpe: fields.targetRpe,
        exercises: fields.exercises,
        notes: fields.notes || null,
        acknowledgeWarnings: fields.acknowledgeWarnings,
    };
}

function sessionFailure(result: Extract<training.SessionMutationResult, { ok: false }>): ActionState<SessionFormResult> {
    return { status: "error", message: result.message, data: { conflicts: result.conflicts } };
}

export async function createSession(_prev: ActionState<SessionFormResult>, formData: FormData): Promise<ActionState<SessionFormResult>> {
    const auth = await authorizeCoach();
    if (!auth.ok) return auth.state;

    const parsed = createSessionSchema.safeParse({ ...readSessionForm(formData), fighterId: text(formData, "fighterId") });
    if (!parsed.success) return validationError(parsed.error);
    const { fighterId } = parsed.data;
    if (!canAccessFighter(auth.user, fighterId)) return actionError(NOT_ON_ROSTER, { fighterId: "Choose a fighter from your roster." });

    const scheduledAt = academyWallClockToIso(parsed.data.date, parsed.data.time);
    if (Date.parse(scheduledAt) < Date.now() - PAST_GRACE_MS) {
        return actionError("Please fix the highlighted fields.", { date: "Choose a date and time that hasn't passed." });
    }

    const result = await training.createSession({ ...toServiceInput(parsed.data, scheduledAt, auth.coachId), fighterId }, auth.user);
    if (!result.ok) return sessionFailure(result);
    revalidateSession(result.session);
    redirect(routes.coach.session(result.session.id));
}

export async function updateSession(
    sessionId: string,
    _prev: ActionState<SessionFormResult>,
    formData: FormData,
): Promise<ActionState<SessionFormResult>> {
    const auth = await authorizeCoach();
    if (!auth.ok) return auth.state;

    const parsed = sessionFieldsSchema.safeParse(readSessionForm(formData));
    if (!parsed.success) return validationError(parsed.error);

    const existing = await training.getSession(sessionId);
    if (!existing || !canAccessFighter(auth.user, existing.fighterId)) {
        return actionError("That session no longer exists or isn't on your roster.");
    }

    const scheduledAt = academyWallClockToIso(parsed.data.date, parsed.data.time);
    const rescheduled = scheduledAt !== existing.scheduledAt;
    if (rescheduled && Date.parse(scheduledAt) < Date.now() - PAST_GRACE_MS) {
        return actionError("Please fix the highlighted fields.", { date: "Choose a date and time that hasn't passed." });
    }

    // Keep the assigned coach when another roster coach edits the session.
    const result = await training.updateSession(sessionId, toServiceInput(parsed.data, scheduledAt, existing.coachId), auth.user);
    if (!result.ok) return sessionFailure(result);
    revalidateSession(result.session);
    if (existing.planId && existing.planId !== result.session.planId) revalidatePlan(existing.planId, existing.fighterId);
    redirect(routes.coach.session(result.session.id));
}

const previewSchema = z.object({
    fighterId: z.string().min(1, "Choose a fighter."),
    type: z.enum(TRAINING_TYPES, "Choose a training type."),
    targetRpe: z.number().int().min(1).max(10),
    exerciseIds: z.array(z.string()).max(20),
    date: z.string(),
    time: z.string(),
});

export type SessionConflictPreviewInput = z.input<typeof previewSchema>;

/** Read-only clearance check used by the session form while the coach edits. */
export async function previewSessionConflicts(input: SessionConflictPreviewInput): Promise<ActionState<SessionFormResult>> {
    const auth = await authorizeAction("training:write");
    if (!auth.ok) return actionError(auth.message);

    const parsed = previewSchema.safeParse(input);
    if (!parsed.success) return validationError(parsed.error);
    const { fighterId, type, targetRpe, exerciseIds, date, time } = parsed.data;
    if (!canAccessFighter(auth.user, fighterId)) return actionError(NOT_ON_ROSTER);

    const conflicts = await training.loadSessionClearanceConflicts({
        fighterId,
        type,
        targetRpe,
        // The form previews while the coach is still typing, so an incomplete date checks against now.
        scheduledAt: isDateKey(date) && isTimeValue(time) ? academyWallClockToIso(date, time) : new Date().toISOString(),
        exercises: exerciseIds.map((exerciseId) => ({ exerciseId, rounds: null, roundSec: null, sets: null, reps: null, notes: null })),
    });
    return actionSuccess(conflicts.length === 0 ? "No clearance conflicts." : "Clearance conflicts found.", { conflicts });
}

/** Loads a session the coach may act on. */
async function loadRosterSession(user: User, sessionId: string): Promise<TrainingSession | null> {
    const session = await training.getSession(sessionId);
    return session && canAccessFighter(user, session.fighterId) ? session : null;
}

const resultSchema = z.object({
    actualDurationMin: wholeNumber("Actual duration", 1, 300),
    rpe: wholeNumber("RPE", 1, 10),
    roundsCompleted: wholeNumber("Rounds completed", 0, 100),
    coachRating: z.coerce
        .number("Choose a rating from 1 to 5 stars.")
        .int("Choose a rating from 1 to 5 stars.")
        .min(1, "Choose a rating from 1 to 5 stars.")
        .max(5, "Choose a rating from 1 to 5 stars."),
    summary: z.string().trim().min(3, "Add a short summary of how the session went.").max(1000, "Keep the summary under 1,000 characters."),
    completedExerciseIds: z.array(z.string()),
});

export async function recordSessionResult(sessionId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeCoach();
    if (!auth.ok) return auth.state;

    const parsed = resultSchema.safeParse({
        actualDurationMin: text(formData, "actualDurationMin"),
        rpe: text(formData, "rpe"),
        roundsCompleted: text(formData, "roundsCompleted"),
        coachRating: text(formData, "coachRating"),
        summary: text(formData, "summary"),
        completedExerciseIds: texts(formData, "completedExerciseIds"),
    });
    if (!parsed.success) return validationError(parsed.error);

    const session = await loadRosterSession(auth.user, sessionId);
    if (!session) return actionError("That session no longer exists or isn't on your roster.");
    const correction = session.status === "completed";

    const result = await training.recordSessionResult(sessionId, parsed.data, auth.user);
    if (!result.ok) return actionError(result.message);
    revalidateSession(result.session);
    return actionSuccess(correction ? "Result updated." : "Result recorded. The session is now completed.");
}

const cancelSchema = z.object({
    reason: z
        .string()
        .trim()
        .min(5, "Give the fighter a short reason (at least 5 characters).")
        .max(300, "Keep the reason under 300 characters."),
});

export async function cancelSession(sessionId: string, input: { reason: string }): Promise<ActionState> {
    const auth = await authorizeCoach();
    if (!auth.ok) return auth.state;

    const parsed = cancelSchema.safeParse(input);
    if (!parsed.success) return validationError(parsed.error);

    const session = await loadRosterSession(auth.user, sessionId);
    if (!session) return actionError("That session no longer exists or isn't on your roster.");

    const result = await training.cancelSession(sessionId, parsed.data.reason, auth.user);
    if (!result.ok) return actionError(result.message);
    revalidateSession(result.session);
    return actionSuccess("Session cancelled. The fighter has been notified.");
}

const feedbackSchema = z.object({
    kind: z.enum(FEEDBACK_KINDS, "Choose the kind of feedback."),
    techniques: z.array(z.enum(TECHNIQUES, "Choose techniques from the list.")),
    body: z.string().trim().min(3, "Write the feedback (at least 3 characters).").max(1000, "Keep feedback under 1,000 characters."),
});

export async function addSessionFeedback(sessionId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeCoach();
    if (!auth.ok) return auth.state;

    const parsed = feedbackSchema.safeParse({
        kind: text(formData, "kind"),
        techniques: texts(formData, "techniques"),
        body: text(formData, "body"),
    });
    if (!parsed.success) return validationError(parsed.error);

    const session = await loadRosterSession(auth.user, sessionId);
    if (!session) return actionError("That session no longer exists or isn't on your roster.");

    await training.addCoachFeedback(
        { ...parsed.data, fighterId: session.fighterId, coachId: auth.coachId, sessionId: session.id, videoId: null },
        auth.user,
    );
    revalidateSession(session);
    return actionSuccess("Feedback shared with the fighter.");
}
