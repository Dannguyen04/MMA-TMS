"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { canAccessFighter } from "@/lib/auth/access";
import { authorizeAction } from "@/lib/auth/session";
import { FEEDBACK_KIND_LABELS, PLAN_STATUS_LABELS, planStatusLabel, TECHNIQUES, TRAINING_PHASE_LABELS, TRAINING_TYPE_LABELS } from "@/lib/domain/labels";
import type { EligibilityReason } from "@/lib/domain/medical-contract";
import type { ClearanceConflict } from "@/lib/domain/rules";
import { SERVICE_TRAINING_TYPES } from "@/lib/domain/training-contract";
import { planTransitions } from "@/lib/domain/training-plan";
import type { FeedbackKind, PlanStatus, TrainingPhase, TrainingPlan, TrainingSession, TrainingType, User } from "@/lib/domain/types";
import { academyDayEndIso, academyDayStartIso, academyWallClockToIso, isDateKey, isTimeValue } from "@/lib/format";
import { getTranslator } from "@/lib/i18n/server";
import type { MessageKey, Translator } from "@/lib/i18n/translate";
import { hrefWith } from "@/lib/query";
import { routes } from "@/lib/routes";
import { PLATFORM_FEATURE_UNAVAILABLE_MESSAGE, platformFeatureAvailable, usesTrainingServiceForms } from "@/lib/services/platform-features";
import * as training from "@/lib/services/training";
import { trainingEligibilityReasons, trainingWriteFailure } from "@/lib/services/training-errors";
import { text, texts } from "./form-helpers";
import { actionError, actionSuccess, validationError, type ActionState } from "./state";

/* ─── Shared ──────────────────────────────────────────────────────────────── */

const PHASES = Object.keys(TRAINING_PHASE_LABELS) as TrainingPhase[];
const TRAINING_TYPES = Object.keys(TRAINING_TYPE_LABELS) as TrainingType[];
const PLAN_STATUSES = Object.keys(PLAN_STATUS_LABELS) as PlanStatus[];
const FEEDBACK_KINDS = Object.keys(FEEDBACK_KIND_LABELS) as FeedbackKind[];

/** `?notice=` on the plan page when a new plan was saved but couldn't be activated. */
const PLAN_NOT_ACTIVATED = "not-activated";

export interface SessionFormResult {
    /** Clearance conflicts found when the server checked the session. */
    conflicts: ClearanceConflict[];
}

/** Whole number within bounds, coerced from a form value. */
function wholeNumber(label: string, min: number, max: number, t?: Translator) {
    const message = t ? t("training.schema.wholeNumber", { label, min, max }) : `${label} must be a whole number from ${min} to ${max}.`;
    return z.coerce.number(message).int(message).min(min, message).max(max, message);
}

/** A form value that may be left out: inputs only the demo's richer forms render read as missing when empty. */
function optionalText(formData: FormData, name: string): string | undefined {
    return text(formData, name) || undefined;
}

/** Authorizes a coach action and loads the coach profile id. */
async function authorizeCoach(t: Translator): Promise<{ ok: true; user: User; coachId: string } | { ok: false; state: ActionState<never> }> {
    const auth = await authorizeAction("training:write");
    if (!auth.ok) return { ok: false, state: actionError(auth.message) };
    if (!auth.user.profileId) return { ok: false, state: actionError(t("training.action.noCoachProfile")) };
    return { ok: true, user: auth.user, coachId: auth.user.profileId };
}

/** Loads a plan the coach may act on. */
async function loadRosterPlan(user: User, planId: string): Promise<TrainingPlan | null> {
    const plan = await training.getPlan(planId);
    return plan && canAccessFighter(user, plan.fighterId) ? plan : null;
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

/**
 * Plan fields. Focus areas and weekly target belong to the demo's richer form: the training service doesn't store
 * them, so they are optional when it's in use and required otherwise. Every plan has a phase.
 */
function planFieldsSchema(serviceForms: boolean, t: Translator) {
    const focusAreas = z.array(z.enum(TECHNIQUES, t("training.schema.focusAreasChoose")));
    const weeklySessionTarget = wholeNumber(t("training.label.weeklySessions"), 1, 14, t);
    return z
        .object({
            title: z.string().trim().min(3, t("training.schema.titleMin")).max(120, t("training.schema.titleMax")),
            objective: z
                .string()
                .trim()
                .min(10, t("training.schema.objectiveMin"))
                .max(600, t("training.schema.objectiveMax")),
            phase: z.enum(PHASES, t("training.schema.phaseChoose")),
            focusAreas: serviceForms ? focusAreas : focusAreas.min(1, t("training.schema.focusAreasMin")),
            startDate: z.string().refine(isDateKey, t("training.schema.startDateValid")),
            endDate: z.string().refine(isDateKey, t("training.schema.endDateValid")),
            weeklySessionTarget: serviceForms ? weeklySessionTarget.optional() : weeklySessionTarget,
            notes: z.string().trim().max(1000, t("training.schema.notesMax")),
        })
        .refine((data) => data.endDate >= data.startDate, { path: ["endDate"], error: t("training.schema.endDateAfterStart") });
}

type PlanFields = z.output<ReturnType<typeof planFieldsSchema>>;

function createPlacementSchema(t: Translator) {
    return z.object({
        fighterId: z.string().min(1, t("training.schema.fighterChoose")),
        status: z.enum(["draft", "active"], t("training.schema.statusChoose")),
    });
}

/** The plan as the service takes it: academy days as instants, and the demo-only details empty when not asked for. */
function toPlanInput(fields: PlanFields) {
    return {
        title: fields.title,
        objective: fields.objective,
        phase: fields.phase,
        focusAreas: fields.focusAreas,
        startDate: academyDayStartIso(fields.startDate),
        endDate: academyDayEndIso(fields.endDate),
        weeklySessionTarget: fields.weeklySessionTarget ?? null,
        notes: fields.notes,
    };
}

/** Maps a failed plan write to the form; a bad date range lands on the end date. */
function planWriteFailure(error: unknown, t: Translator): ActionState<never> {
    const failure = trainingWriteFailure(error, {
        fields: { title: "title", goals: "objective", description: "notes", phase: "phase", startDate: "startDate", endDate: "endDate" },
        conflictFields: { INVALID_PLAN_DATE_RANGE: "endDate" },
    }, t);
    return actionError(failure.message, failure.fieldErrors);
}

function readPlanForm(formData: FormData) {
    return {
        title: text(formData, "title"),
        objective: text(formData, "objective"),
        phase: optionalText(formData, "phase"),
        focusAreas: texts(formData, "focusAreas"),
        startDate: text(formData, "startDate"),
        endDate: text(formData, "endDate"),
        weeklySessionTarget: optionalText(formData, "weeklySessionTarget"),
        notes: text(formData, "notes"),
    };
}

export async function createPlan(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const { t } = await getTranslator();
    const auth = await authorizeCoach(t);
    if (!auth.ok) return auth.state;

    const parsed = planFieldsSchema(usesTrainingServiceForms(), t)
        .and(createPlacementSchema(t))
        .safeParse({ ...readPlanForm(formData), fighterId: text(formData, "fighterId"), status: text(formData, "status") });
    if (!parsed.success) return validationError(parsed.error);
    const { fighterId, status } = parsed.data;
    if (!canAccessFighter(auth.user, fighterId)) return actionError(t("training.action.notOnRoster"), { fighterId: t("training.action.chooseFighterFromRoster") });

    let plan: TrainingPlan;
    try {
        plan = await training.createPlan({ ...toPlanInput(parsed.data), fighterId, coachId: auth.coachId, status }, auth.user);
    } catch (error) {
        return planWriteFailure(error, t);
    }
    revalidatePlan(plan.id, plan.fighterId);
    // The plan is saved either way; a refused activation leaves a draft the coach can activate from the plan page.
    redirect(status === "active" && plan.status !== "active" ? hrefWith(routes.coach.plan(plan.id), {}, { notice: PLAN_NOT_ACTIVATED }) : routes.coach.plan(plan.id));
}

export async function updatePlan(planId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
    const { t } = await getTranslator();
    const auth = await authorizeCoach(t);
    if (!auth.ok) return auth.state;

    const parsed = planFieldsSchema(usesTrainingServiceForms(), t).safeParse(readPlanForm(formData));
    if (!parsed.success) return validationError(parsed.error);

    const existing = await loadRosterPlan(auth.user, planId);
    if (!existing) return actionError(t("training.action.planNotOnRoster"));

    let plan: TrainingPlan | null;
    try {
        plan = await training.updatePlan(planId, toPlanInput(parsed.data), auth.user);
    } catch (error) {
        return planWriteFailure(error, t);
    }
    if (!plan) return actionError(t("training.action.planNotFound"));
    revalidatePlan(plan.id, plan.fighterId);
    redirect(routes.coach.plan(plan.id));
}

const PLAN_STATUS_KEYS: Record<PlanStatus, MessageKey> = {
    draft: "training.action.planStatusRestored",
    active: "training.action.planStatusActive",
    completed: "training.action.planStatusCompleted",
    archived: "training.action.planStatusArchived",
};

export async function setPlanStatus(planId: string, status: PlanStatus): Promise<ActionState> {
    const { t } = await getTranslator();
    const auth = await authorizeCoach(t);
    if (!auth.ok) return auth.state;

    const parsed = z.enum(PLAN_STATUSES, t("training.schema.validPlanStatus")).safeParse(status);
    if (!parsed.success) return validationError(parsed.error);

    const existing = await loadRosterPlan(auth.user, planId);
    if (!existing) return actionError(t("training.action.planNotOnRoster"));
    if (!planTransitions(existing.status, { restoreArchived: !usesTrainingServiceForms() }).includes(parsed.data)) {
        return actionError(t("training.action.invalidTransition", {
            from: planStatusLabel(t, existing.status).toLowerCase(),
            to: planStatusLabel(t, parsed.data).toLowerCase(),
        }));
    }

    let plan: TrainingPlan | null;
    try {
        plan = await training.setPlanStatus(planId, parsed.data, auth.user);
    } catch (error) {
        return planWriteFailure(error, t);
    }
    if (!plan) return actionError(t("training.action.planNotFound"));
    revalidatePlan(plan.id, plan.fighterId);
    return actionSuccess(t(PLAN_STATUS_KEYS[plan.status]));
}

/* ─── Plan exercises ──────────────────────────────────────────────────────── */

/** A whole number a coach may leave empty. */
function blankableWholeNumber(label: string, min: number, max: number, t?: Translator) {
    const message = t ? t("training.schema.wholeNumber", { label, min, max }) : `${label} must be a whole number from ${min} to ${max}.`;
    return z.preprocess((value) => (value === "" ? null : value), z.coerce.number(message).int(message).min(min, message).max(max, message).nullable());
}

function planExerciseSchema(t: Translator) {
    return z.object({
        sets: blankableWholeNumber(t("training.label.sets"), 1, 20, t),
        reps: blankableWholeNumber(t("training.label.reps"), 1, 200, t),
        durationMin: blankableWholeNumber(t("training.label.duration"), 1, 240, t),
        targetRpe: blankableWholeNumber(t("training.label.targetRpe"), 1, 10, t),
        notes: z.string().trim().max(500, t("training.schema.exerciseNotesMax")),
    });
}

function readPlanExerciseForm(formData: FormData) {
    return {
        sets: text(formData, "sets"),
        reps: text(formData, "reps"),
        durationMin: text(formData, "durationMin"),
        targetRpe: text(formData, "targetRpe"),
        notes: text(formData, "notes"),
    };
}

function toPlanExerciseFields({ durationMin, notes, ...rest }: { sets: number | null; reps: number | null; durationMin: number | null; targetRpe: number | null; notes: string }) {
    return { ...rest, durationSec: durationMin === null ? null : durationMin * 60, notes: notes || null };
}

function planExerciseFailure(error: unknown, t: Translator): ActionState<never> {
    const failure = trainingWriteFailure(error, {
        fields: { exerciseId: "exerciseId", sets: "sets", reps: "reps", durationSeconds: "durationMin", targetRpe: "targetRpe", coachNotes: "notes" },
    }, t);
    return actionError(failure.message, failure.fieldErrors);
}

export async function addPlanExercise(planId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
    const { t } = await getTranslator();
    const auth = await authorizeCoach(t);
    if (!auth.ok) return auth.state;

    const parsed = planExerciseSchema(t)
        .extend({ exerciseId: z.string().min(1, t("training.schema.exerciseChoose")) })
        .safeParse({ ...readPlanExerciseForm(formData), exerciseId: text(formData, "exerciseId") });
    if (!parsed.success) return validationError(parsed.error);
    const plan = await loadRosterPlan(auth.user, planId);
    if (!plan) return actionError(t("training.action.planNotOnRoster"));

    const { exerciseId, ...fields } = parsed.data;
    try {
        await training.addPlanExercise(planId, exerciseId, toPlanExerciseFields(fields), auth.user);
    } catch (error) {
        return planExerciseFailure(error, t);
    }
    revalidatePlan(plan.id, plan.fighterId);
    return actionSuccess(t("training.action.exerciseAddedToPlan"));
}

export async function updatePlanExercise(planId: string, planExerciseId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
    const { t } = await getTranslator();
    const auth = await authorizeCoach(t);
    if (!auth.ok) return auth.state;

    const parsed = planExerciseSchema(t).safeParse(readPlanExerciseForm(formData));
    if (!parsed.success) return validationError(parsed.error);
    const plan = await loadRosterPlan(auth.user, planId);
    if (!plan) return actionError(t("training.action.planNotOnRoster"));

    let updated: Awaited<ReturnType<typeof training.updatePlanExercise>>;
    try {
        updated = await training.updatePlanExercise(planId, planExerciseId, toPlanExerciseFields(parsed.data), auth.user);
    } catch (error) {
        return planExerciseFailure(error, t);
    }
    if (!updated) return actionError(t("training.action.exerciseNotFoundOnPlan"));
    revalidatePlan(plan.id, plan.fighterId);
    return actionSuccess(t("training.action.exerciseUpdated"));
}

export async function removePlanExercise(planId: string, planExerciseId: string): Promise<ActionState> {
    const { t } = await getTranslator();
    const auth = await authorizeCoach(t);
    if (!auth.ok) return auth.state;
    const plan = await loadRosterPlan(auth.user, planId);
    if (!plan) return actionError(t("training.action.planNotOnRoster"));

    let removed: boolean;
    try {
        removed = await training.removePlanExercise(planId, planExerciseId, auth.user);
    } catch (error) {
        return planExerciseFailure(error, t);
    }
    if (!removed) return actionError(t("training.action.exerciseNotFoundOnPlan"));
    revalidatePlan(plan.id, plan.fighterId);
    return actionSuccess(t("training.action.exerciseRemovedFromPlan"));
}

/* ─── Training sessions ───────────────────────────────────────────────────── */

const optionalWhole = (label: string, min: number, max: number, t?: Translator) => {
    const message = t ? t("training.schema.wholeNumber", { label, min, max }) : `${label} must be a whole number from ${min} to ${max}.`;
    return z.number(message).int(message).min(min, message).max(max, message).nullable();
};

function sessionExerciseSchema(t: Translator) {
    return z.object({
        exerciseId: z.string().min(1, t("training.schema.exerciseChoose")),
        rounds: optionalWhole(t("training.label.roundsCompleted"), 1, 30, t),
        roundSec: optionalWhole("Round length", 10, 1800, t),
        sets: optionalWhole(t("training.label.sets"), 1, 20, t),
        reps: optionalWhole(t("training.label.reps"), 1, 200, t),
        notes: z.string().trim().max(300, t("training.schema.sessionExerciseNotesMax")).nullable(),
    });
}

/** Session fields. Target RPE and exercises belong to the demo's richer form: the training service stores neither. */
function sessionFieldsSchema(serviceForms: boolean, t: Translator) {
    const targetRpe = wholeNumber(t("training.label.targetRpe"), 1, 10, t);
    return z.object({
        planId: z.string(),
        title: z.string().trim().min(3, t("training.schema.titleMin")).max(120, t("training.schema.titleMax")),
        type: z.enum(serviceForms ? SERVICE_TRAINING_TYPES : TRAINING_TYPES, t("training.schema.trainingTypeChoose")),
        date: z.string().refine(isDateKey, t("training.schema.dateValid")),
        time: z.string().refine(isTimeValue, t("training.schema.timeValid")),
        durationMin: wholeNumber(t("training.label.duration"), 10, 300, t),
        location: z.string().trim().min(2, t("training.schema.locationMin")).max(120, t("training.schema.locationMax")),
        targetRpe: serviceForms ? targetRpe.optional() : targetRpe,
        exercises: z.array(sessionExerciseSchema(t), t("training.schema.exerciseListReadError")).max(20, t("training.schema.exercisesMax")),
        notes: z.string().trim().max(1000, t("training.schema.notesMax")),
        acknowledgeWarnings: z.boolean(),
    });
}

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
        targetRpe: optionalText(formData, "targetRpe"),
        exercises: parseJson(text(formData, "exercises") || "[]"),
        notes: text(formData, "notes"),
        acknowledgeWarnings: formData.get("acknowledgeWarnings") === "on",
    };
}

type SessionFields = z.output<ReturnType<typeof sessionFieldsSchema>>;

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
        targetRpe: fields.targetRpe ?? null,
        exercises: fields.exercises,
        notes: fields.notes || null,
        acknowledgeWarnings: fields.acknowledgeWarnings,
    };
}

/** Service field names → session form fields, for the training service's validation errors. */
const SESSION_FORM_FIELDS = {
    title: "title",
    sessionType: "type",
    scheduledAt: "date",
    plannedDurationSec: "durationMin",
    location: "location",
    coachNotes: "notes",
    reportedRpe: "rpe",
    roundCount: "roundsCompleted",
    cancellationReason: "reason",
};

type SessionWrite =
    | { ok: true; session: TrainingSession }
    | { ok: false; message: string; fieldErrors?: Record<string, string>; conflicts: ClearanceConflict[] };

/** Runs a session write. The demo refuses with a result and the training service with an error; both read the same. */
async function writeSession(write: () => Promise<training.SessionMutationResult>, t?: Translator): Promise<SessionWrite> {
    try {
        const result = await write();
        return result.ok ? { ok: true, session: result.session } : { ok: false, message: result.message, conflicts: result.conflicts };
    } catch (error) {
        return { ok: false, ...trainingWriteFailure(error, { fields: SESSION_FORM_FIELDS }, t), conflicts: [] };
    }
}

/** A refused write on the session form, which also shows the clearance conflicts found. */
function sessionFormFailure({ message, fieldErrors, conflicts }: Extract<SessionWrite, { ok: false }>): ActionState<SessionFormResult> {
    return { status: "error", message, fieldErrors, data: { conflicts } };
}

export async function createSession(_prev: ActionState<SessionFormResult>, formData: FormData): Promise<ActionState<SessionFormResult>> {
    const { t } = await getTranslator();
    const auth = await authorizeCoach(t);
    if (!auth.ok) return auth.state;

    const parsed = sessionFieldsSchema(usesTrainingServiceForms(), t)
        .extend({ fighterId: z.string().min(1, t("training.schema.fighterChoose")) })
        .safeParse({ ...readSessionForm(formData), fighterId: text(formData, "fighterId") });
    if (!parsed.success) return validationError(parsed.error);
    const { fighterId } = parsed.data;
    if (!canAccessFighter(auth.user, fighterId)) return actionError(t("training.action.notOnRoster"), { fighterId: t("training.action.chooseFighterFromRoster") });

    const scheduledAt = academyWallClockToIso(parsed.data.date, parsed.data.time);
    if (Date.parse(scheduledAt) < Date.now() - PAST_GRACE_MS) {
        return actionError(t("form.fixFields"), { date: t("training.action.pastDateTimeError") });
    }

    const result = await writeSession(() => training.createSession({ ...toServiceInput(parsed.data, scheduledAt, auth.coachId), fighterId }, auth.user), t);
    if (!result.ok) return sessionFormFailure(result);
    revalidateSession(result.session);
    redirect(routes.coach.session(result.session.id));
}

export async function updateSession(
    sessionId: string,
    _prev: ActionState<SessionFormResult>,
    formData: FormData,
): Promise<ActionState<SessionFormResult>> {
    const { t } = await getTranslator();
    const auth = await authorizeCoach(t);
    if (!auth.ok) return auth.state;

    const parsed = sessionFieldsSchema(usesTrainingServiceForms(), t).safeParse(readSessionForm(formData));
    if (!parsed.success) return validationError(parsed.error);

    const existing = await training.getSession(sessionId);
    if (!existing || !canAccessFighter(auth.user, existing.fighterId)) {
        return actionError(t("training.action.sessionNotFound"));
    }

    const scheduledAt = academyWallClockToIso(parsed.data.date, parsed.data.time);
    const rescheduled = scheduledAt !== existing.scheduledAt;
    if (rescheduled && Date.parse(scheduledAt) < Date.now() - PAST_GRACE_MS) {
        return actionError(t("form.fixFields"), { date: t("training.action.pastDateTimeError") });
    }

    // Keep the assigned coach when another roster coach edits the session; a session without one takes the editor.
    const coachId = existing.coachId ?? auth.user.profileId;
    if (!coachId) return actionError(t("training.action.linkCoachProfile"));
    const result = await writeSession(() => training.updateSession(sessionId, toServiceInput(parsed.data, scheduledAt, coachId), auth.user), t);
    if (!result.ok) return sessionFormFailure(result);
    revalidateSession(result.session);
    if (existing.planId && existing.planId !== result.session.planId) revalidatePlan(existing.planId, existing.fighterId);
    redirect(routes.coach.session(result.session.id));
}

function previewSchema(t: Translator) {
    return z.object({
        fighterId: z.string().min(1, t("training.schema.fighterChoose")),
        type: z.enum(TRAINING_TYPES, t("training.schema.trainingTypeChoose")),
        targetRpe: z.number().int().min(1).max(10),
        exerciseIds: z.array(z.string()).max(20),
        date: z.string(),
        time: z.string(),
    });
}

export type SessionConflictPreviewInput = {
    fighterId: string;
    type: TrainingType;
    targetRpe: number;
    exerciseIds: string[];
    date: string;
    time: string;
};

/** Read-only clearance check used by the session form while the coach edits. */
export async function previewSessionConflicts(input: SessionConflictPreviewInput): Promise<ActionState<SessionFormResult>> {
    const { t } = await getTranslator();
    const auth = await authorizeAction("training:write");
    if (!auth.ok) return actionError(auth.message);

    const parsed = previewSchema(t).safeParse(input);
    if (!parsed.success) return validationError(parsed.error);
    const { fighterId, type, targetRpe, exerciseIds, date, time } = parsed.data;
    if (!canAccessFighter(auth.user, fighterId)) return actionError(t("training.action.notOnRoster"));

    const conflicts = await training.loadSessionClearanceConflicts({
        fighterId,
        type,
        targetRpe,
        // The form previews while the coach is still typing, so an incomplete date checks against now.
        scheduledAt: isDateKey(date) && isTimeValue(time) ? academyWallClockToIso(date, time) : new Date().toISOString(),
        exercises: exerciseIds.map((exerciseId) => ({ exerciseId, rounds: null, roundSec: null, sets: null, reps: null, notes: null })),
    });
    return actionSuccess(conflicts.length === 0 ? t("training.action.noClearanceConflicts") : t("training.action.clearanceConflictsFound"), { conflicts });
}

/** Loads a session the coach may act on. */
async function loadRosterSession(user: User, sessionId: string): Promise<TrainingSession | null> {
    const session = await training.getSession(sessionId);
    return session && canAccessFighter(user, session.fighterId) ? session : null;
}

/**
 * A session's result. The training service measures the duration itself and keeps no rating, summary or exercise
 * check-off, so those are optional when it's in use.
 */
function resultSchema(serviceForms: boolean, t: Translator) {
    const ratingMessage = t("training.schema.ratingChoose");
    const actualDurationMin = wholeNumber(t("training.label.actualDuration"), 1, 300, t);
    const coachRating = z.coerce.number(ratingMessage).int(ratingMessage).min(1, ratingMessage).max(5, ratingMessage);
    const summary = z.string().trim().max(1000, t("training.schema.summaryMax"));
    return z.object({
        actualDurationMin: serviceForms ? actualDurationMin.optional() : actualDurationMin,
        rpe: wholeNumber(t("training.label.rpe"), 1, 10, t),
        roundsCompleted: wholeNumber(t("training.label.roundsCompleted"), 0, 100, t),
        coachRating: serviceForms ? coachRating.optional() : coachRating,
        summary: serviceForms ? summary : summary.min(3, t("training.schema.summaryMin")),
        completedExerciseIds: z.array(z.string()),
    });
}

export async function recordSessionResult(sessionId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
    const { t } = await getTranslator();
    const auth = await authorizeCoach(t);
    if (!auth.ok) return auth.state;

    const parsed = resultSchema(usesTrainingServiceForms(), t).safeParse({
        actualDurationMin: optionalText(formData, "actualDurationMin"),
        rpe: text(formData, "rpe"),
        roundsCompleted: text(formData, "roundsCompleted"),
        coachRating: optionalText(formData, "coachRating"),
        summary: text(formData, "summary"),
        completedExerciseIds: texts(formData, "completedExerciseIds"),
    });
    if (!parsed.success) return validationError(parsed.error);

    const session = await loadRosterSession(auth.user, sessionId);
    if (!session) return actionError(t("training.action.sessionNotFound"));
    const correction = session.status === "completed";

    const { actualDurationMin, coachRating, ...result } = parsed.data;
    const saved = await writeSession(() =>
        training.recordSessionResult(sessionId, { ...result, actualDurationMin: actualDurationMin ?? null, coachRating: coachRating ?? null }, auth.user),
    t);
    if (!saved.ok) return actionError(saved.message, saved.fieldErrors);
    revalidateSession(saved.session);
    return actionSuccess(correction ? t("training.action.resultUpdated") : t("training.action.resultRecorded"));
}

function cancelSchema(t: Translator) {
    return z.object({
        reason: z
            .string()
            .trim()
            .min(5, t("training.schema.cancelReasonMin"))
            .max(300, t("training.schema.cancelReasonMax")),
    });
}

export async function cancelSession(sessionId: string, input: { reason: string }): Promise<ActionState> {
    const { t } = await getTranslator();
    const auth = await authorizeCoach(t);
    if (!auth.ok) return auth.state;

    const parsed = cancelSchema(t).safeParse(input);
    if (!parsed.success) return validationError(parsed.error);

    const session = await loadRosterSession(auth.user, sessionId);
    if (!session) return actionError(t("training.action.sessionNotFound"));

    const result = await writeSession(() => training.cancelSession(sessionId, parsed.data.reason, auth.user), t);
    if (!result.ok) return actionError(result.message, result.fieldErrors);
    revalidateSession(result.session);
    return actionSuccess(t("training.action.sessionCancelledNotified"));
}

export interface StartSessionResult {
    /** Why the fighter's Medical Clearance doesn't allow the session now, when the service said. */
    reasons: EligibilityReason[];
}

/** Checks the fighter in. The training service refuses when their Medical Clearance doesn't allow it now. */
export async function startSession(sessionId: string): Promise<ActionState<StartSessionResult>> {
    const { t } = await getTranslator();
    const auth = await authorizeCoach(t);
    if (!auth.ok) return auth.state;

    const session = await loadRosterSession(auth.user, sessionId);
    if (!session) return actionError(t("training.action.sessionNotFound"));

    try {
        const result = await training.startSession(sessionId, auth.user);
        if (!result.ok) return actionError(result.message);
        revalidateSession(result.session);
        return actionSuccess(t("training.action.sessionStartedRecord"), { reasons: [] });
    } catch (error) {
        const failure = trainingWriteFailure(error, { fields: SESSION_FORM_FIELDS }, t);
        return { status: "error", message: failure.message, data: { reasons: trainingEligibilityReasons(error) ?? [] } };
    }
}

/** Records that a scheduled session didn't happen. */
export async function markSessionMissed(sessionId: string): Promise<ActionState> {
    const { t } = await getTranslator();
    const auth = await authorizeCoach(t);
    if (!auth.ok) return auth.state;

    const session = await loadRosterSession(auth.user, sessionId);
    if (!session) return actionError(t("training.action.sessionNotFound"));

    const result = await writeSession(() => training.markSessionMissed(sessionId, auth.user), t);
    if (!result.ok) return actionError(result.message);
    revalidateSession(result.session);
    return actionSuccess(t("training.action.sessionMarkedMissed"));
}

function feedbackSchema(t: Translator) {
    return z.object({
        kind: z.enum(FEEDBACK_KINDS, t("training.schema.feedbackKindChoose")),
        techniques: z.array(z.enum(TECHNIQUES, t("training.schema.feedbackTechniquesChoose"))),
        body: z.string().trim().min(3, t("training.schema.feedbackBodyMin")).max(1000, t("training.schema.feedbackBodyMax")),
    });
}

export async function addSessionFeedback(sessionId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
    const { t } = await getTranslator();
    const auth = await authorizeCoach(t);
    if (!auth.ok) return auth.state;
    if (!platformFeatureAvailable("coachFeedback")) return actionError(PLATFORM_FEATURE_UNAVAILABLE_MESSAGE);

    const parsed = feedbackSchema(t).safeParse({
        kind: text(formData, "kind"),
        techniques: texts(formData, "techniques"),
        body: text(formData, "body"),
    });
    if (!parsed.success) return validationError(parsed.error);

    const session = await loadRosterSession(auth.user, sessionId);
    if (!session) return actionError(t("training.action.sessionNotFound"));

    await training.addCoachFeedback(
        { ...parsed.data, fighterId: session.fighterId, coachId: auth.coachId, sessionId: session.id, videoId: null },
        auth.user,
    );
    revalidateSession(session);
    return actionSuccess(t("training.action.feedbackShared"));
}
