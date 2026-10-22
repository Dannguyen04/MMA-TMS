"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { planCopyFrom, type PlanCopy } from "@/components/training/plan-drafts";
import { ApiError } from "@/lib/api/client";
import { canAccessFighter } from "@/lib/auth/access";
import { authorizeAction } from "@/lib/auth/session";
import { FEEDBACK_KIND_LABELS, PLAN_STATUS_LABELS, TECHNIQUES, TRAINING_PHASE_LABELS, TRAINING_TYPE_LABELS } from "@/lib/domain/labels";
import type { EligibilityReason } from "@/lib/domain/medical-contract";
import type { ClearanceConflict } from "@/lib/domain/rules";
import { EXERCISE_LIMITS, exerciseNameKey, SERVICE_EXERCISE_CATEGORIES, SERVICE_TRAINING_TYPES } from "@/lib/domain/training-contract";
import { planTransitions } from "@/lib/domain/training-plan";
import { MAX_WEEKLY_REPEATS, missingStarterExercises, STARTER_EXERCISES, weeklyDates } from "@/lib/domain/training-templates";
import type { FeedbackKind, PlanStatus, TrainingPhase, TrainingPlan, TrainingSession, TrainingType, User } from "@/lib/domain/types";
import { academyDayEndIso, academyDayStartIso, academyWallClockToIso, dayKey, isDateKey, isTimeValue, pluralize } from "@/lib/format";
import { hrefWith } from "@/lib/query";
import { routes } from "@/lib/routes";
import { PLATFORM_FEATURE_UNAVAILABLE_MESSAGE, platformFeatureAvailable, usesTrainingServiceForms } from "@/lib/services/platform-features";
import * as training from "@/lib/services/training";
import { trainingEligibilityReasons, trainingWriteFailure } from "@/lib/services/training-errors";
import { text, texts } from "./form-helpers";
import { actionError, actionSuccess, FIX_FIELDS, validationError, type ActionState } from "./state";

/* ─── Shared ──────────────────────────────────────────────────────────────── */

const PHASES = Object.keys(TRAINING_PHASE_LABELS) as TrainingPhase[];
const TRAINING_TYPES = Object.keys(TRAINING_TYPE_LABELS) as TrainingType[];
const PLAN_STATUSES = Object.keys(PLAN_STATUS_LABELS) as PlanStatus[];
const FEEDBACK_KINDS = Object.keys(FEEDBACK_KIND_LABELS) as FeedbackKind[];

const NOT_ON_ROSTER = "You can only manage training for fighters on your roster.";
const PLAN_NOT_ON_ROSTER = "That plan no longer exists or isn't on your roster.";
/*
 * `?notice=` values the plan page reads: the new plan was saved but couldn't be activated, or some exercises
 * (`?failed=`) couldn't be added, which keeps a plan that was to be activated as a draft.
 */
const PLAN_NOT_ACTIVATED = "not-activated";
const PLAN_EXERCISES_FAILED = "exercises-failed";
const PLAN_EXERCISES_FAILED_DRAFT = "exercises-failed-draft";
/** `?notice=` on the first session's page after a weekly repeat, with `created`, `failed` and `skipped` counts. */
const SESSIONS_REPEATED = "repeated";
const NO_COACH_PROFILE = "Your account isn't linked to a coach profile, so you can't plan training.";

export interface SessionFormResult {
    /** Clearance conflicts found when the server checked the session. */
    conflicts: ClearanceConflict[];
}

/** Whole number within bounds, coerced from a form value. */
function wholeNumber(label: string, min: number, max: number) {
    const message = `${label} must be a whole number from ${min} to ${max}.`;
    return z.coerce.number(message).int(message).min(min, message).max(max, message);
}

/** A form value that may be left out: inputs only the demo's richer forms render read as missing when empty. */
function optionalText(formData: FormData, name: string): string | undefined {
    return text(formData, name) || undefined;
}

/** Authorizes a coach action and loads the coach profile id. */
async function authorizeCoach(): Promise<{ ok: true; user: User; coachId: string } | { ok: false; state: ActionState<never> }> {
    const auth = await authorizeAction("training:write");
    if (!auth.ok) return { ok: false, state: actionError(auth.message) };
    if (!auth.user.profileId) return { ok: false, state: actionError(NO_COACH_PROFILE) };
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
function planFieldsSchema(serviceForms: boolean) {
    const focusAreas = z.array(z.enum(TECHNIQUES, "Choose focus areas from the list."));
    const weeklySessionTarget = wholeNumber("Weekly sessions", 1, 14);
    return z
        .object({
            title: z.string().trim().min(3, "Enter a title of at least 3 characters.").max(120, "Keep the title under 120 characters."),
            // Optional, like the service's goals; when given it should say something.
            objective: z
                .string()
                .trim()
                .max(600, "Keep the objective under 600 characters.")
                .refine((value) => value === "" || value.length >= 10, "Describe the objective in at least 10 characters, or leave it empty."),
            phase: z.enum(PHASES, "Choose a training phase."),
            focusAreas: serviceForms ? focusAreas : focusAreas.min(1, "Choose at least one focus area."),
            startDate: z.string().refine(isDateKey, "Enter a valid start date."),
            endDate: z.string().refine(isDateKey, "Enter a valid end date."),
            weeklySessionTarget: serviceForms ? weeklySessionTarget.optional() : weeklySessionTarget,
            notes: z.string().trim().max(1000, "Keep notes under 1,000 characters."),
        })
        .refine((data) => data.endDate >= data.startDate, { path: ["endDate"], error: "The end date must be on or after the start date." });
}

type PlanFields = z.output<ReturnType<typeof planFieldsSchema>>;

const createPlacementSchema = z.object({
    fighterId: z.string().min(1, "Choose a fighter."),
    status: z.enum(["draft", "active"], "Choose whether to save a draft or publish the plan."),
});

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
function planWriteFailure(error: unknown): ActionState<never> {
    const failure = trainingWriteFailure(error, {
        fields: { title: "title", goals: "objective", description: "notes", phase: "phase", startDate: "startDate", endDate: "endDate" },
        conflictFields: { INVALID_PLAN_DATE_RANGE: "endDate" },
    });
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

/** Where a new plan's page opens, with a notice when it isn't quite what the coach asked for. */
function createdPlanHref(plan: TrainingPlan, status: "draft" | "active", failedExercises: number): string {
    if (failedExercises > 0) {
        return hrefWith(routes.coach.plan(plan.id), {}, { notice: status === "active" ? PLAN_EXERCISES_FAILED_DRAFT : PLAN_EXERCISES_FAILED, failed: failedExercises });
    }
    if (status === "active" && plan.status !== "active") return hrefWith(routes.coach.plan(plan.id), {}, { notice: PLAN_NOT_ACTIVATED });
    return routes.coach.plan(plan.id);
}

/**
 * Creates a plan with the exercises chosen on the form. The service saves the plan as a draft, adds the exercises in
 * order and only then activates it, so the fighter is told about a complete plan.
 */
export async function createPlan(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeCoach();
    if (!auth.ok) return auth.state;

    const parsed = planFieldsSchema(usesTrainingServiceForms())
        .and(createPlacementSchema)
        .and(z.object({ exercises: planExerciseListSchema }))
        .safeParse({
            ...readPlanForm(formData),
            fighterId: text(formData, "fighterId"),
            status: text(formData, "status"),
            exercises: parseJson(text(formData, "exercises") || "[]"),
        });
    if (!parsed.success) return validationError(parsed.error);
    const { fighterId, status, exercises } = parsed.data;
    if (!canAccessFighter(auth.user, fighterId)) return actionError(NOT_ON_ROSTER, { fighterId: "Choose a fighter from your roster." });

    let created: training.PlanCreation;
    try {
        created = await training.createPlan({ ...toPlanInput(parsed.data), fighterId, coachId: auth.coachId, status }, auth.user, exercises.map(toPlanExerciseInput));
    } catch (error) {
        return planWriteFailure(error);
    }
    const { plan, failedExercises } = created;
    revalidatePlan(plan.id, plan.fighterId);
    // The plan is saved either way; what's missing is finished from the plan page.
    redirect(createdPlanHref(plan, status, failedExercises.length));
}

/** A plan's content for "Copy an existing plan": read when the coach picks the plan, never its dates or status. */
export async function loadPlanCopy(planId: string): Promise<ActionState<PlanCopy>> {
    const auth = await authorizeCoach();
    if (!auth.ok) return auth.state;
    const parsed = z.string().min(1, "Choose a plan to copy.").safeParse(planId);
    if (!parsed.success) return validationError(parsed.error);

    const plan = await loadRosterPlan(auth.user, parsed.data);
    if (!plan) return actionError(PLAN_NOT_ON_ROSTER);
    try {
        return actionSuccess("Plan copied.", planCopyFrom(plan, await training.listPlanExercises(plan.id)));
    } catch (error) {
        if (error instanceof ApiError) return actionError("That plan's exercises couldn't be read. Try again in a moment.");
        throw error;
    }
}

export async function updatePlan(planId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeCoach();
    if (!auth.ok) return auth.state;

    const parsed = planFieldsSchema(usesTrainingServiceForms()).safeParse(readPlanForm(formData));
    if (!parsed.success) return validationError(parsed.error);

    const existing = await loadRosterPlan(auth.user, planId);
    if (!existing) return actionError(PLAN_NOT_ON_ROSTER);

    let plan: TrainingPlan | null;
    try {
        plan = await training.updatePlan(planId, toPlanInput(parsed.data), auth.user);
    } catch (error) {
        return planWriteFailure(error);
    }
    if (!plan) return actionError("That plan no longer exists.");
    revalidatePlan(plan.id, plan.fighterId);
    redirect(routes.coach.plan(plan.id));
}

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

    const existing = await loadRosterPlan(auth.user, planId);
    if (!existing) return actionError(PLAN_NOT_ON_ROSTER);
    if (!planTransitions(existing.status, { restoreArchived: !usesTrainingServiceForms() }).includes(parsed.data)) {
        return actionError(`A ${PLAN_STATUS_LABELS[existing.status].toLowerCase()} plan can't be moved to ${PLAN_STATUS_LABELS[parsed.data].toLowerCase()}.`);
    }

    let plan: TrainingPlan | null;
    try {
        plan = await training.setPlanStatus(planId, parsed.data, auth.user);
    } catch (error) {
        return planWriteFailure(error);
    }
    if (!plan) return actionError("That plan no longer exists.");
    revalidatePlan(plan.id, plan.fighterId);
    return actionSuccess(PLAN_STATUS_MESSAGES[plan.status]);
}

/* ─── Plan exercises ──────────────────────────────────────────────────────── */

/** A whole number a coach may leave empty. */
function blankableWholeNumber(label: string, min: number, max: number) {
    const message = `${label} must be a whole number from ${min} to ${max}.`;
    return z.preprocess((value) => (value === "" ? null : value), z.coerce.number(message).int(message).min(min, message).max(max, message).nullable());
}

const planExerciseSchema = z.object({
    sets: blankableWholeNumber("Sets", 1, 20),
    reps: blankableWholeNumber("Reps", 1, 200),
    durationMin: blankableWholeNumber("Duration", 1, 240),
    targetRpe: blankableWholeNumber("Target RPE", 1, 10),
    notes: z.string().trim().max(500, "Keep notes under 500 characters."),
});

function readPlanExerciseForm(formData: FormData) {
    return {
        sets: text(formData, "sets"),
        reps: text(formData, "reps"),
        durationMin: text(formData, "durationMin"),
        targetRpe: text(formData, "targetRpe"),
        notes: text(formData, "notes"),
    };
}

function toPlanExerciseFields({ durationMin, notes, ...rest }: z.output<typeof planExerciseSchema>) {
    return { ...rest, durationSec: durationMin === null ? null : durationMin * 60, notes: notes || null };
}

function planExerciseFailure(error: unknown): ActionState<never> {
    const failure = trainingWriteFailure(error, {
        fields: { exerciseId: "exerciseId", sets: "sets", reps: "reps", durationSeconds: "durationMin", targetRpe: "targetRpe", coachNotes: "notes" },
    });
    return actionError(failure.message, failure.fieldErrors);
}

/** The most exercises one form adds to a plan. */
const MAX_PLAN_EXERCISES_PER_SAVE = 40;

/** Exercise rows sent as JSON by the plan forms (`serializePlanExerciseDrafts`); errors land on `exercises.<row>.<field>`. */
const planExerciseListSchema = z
    .array(planExerciseSchema.extend({ exerciseId: z.string().min(1, "Choose an exercise.") }), "The exercise list couldn't be read. Reload the page and try again.")
    .max(MAX_PLAN_EXERCISES_PER_SAVE, `Add at most ${MAX_PLAN_EXERCISES_PER_SAVE} exercises at a time.`);

function toPlanExerciseInput({ exerciseId, ...fields }: z.output<typeof planExerciseListSchema>[number]): training.PlanExerciseInput {
    return { exerciseId, ...toPlanExerciseFields(fields) };
}

export interface AddPlanExercisesResult {
    /** Rows (in the order sent) that couldn't be added; the form keeps them so the coach can try again. */
    failedRows: number[];
}

/** Adds several exercises at the end of a plan in one go, in the order shown. */
export async function addPlanExercises(planId: string, _prev: ActionState<AddPlanExercisesResult>, formData: FormData): Promise<ActionState<AddPlanExercisesResult>> {
    const auth = await authorizeCoach();
    if (!auth.ok) return auth.state;

    const parsed = planExerciseListSchema.min(1, "Add at least one exercise.").safeParse(parseJson(text(formData, "exercises") || "[]"));
    if (!parsed.success) return validationError(parsed.error);
    const plan = await loadRosterPlan(auth.user, planId);
    if (!plan) return actionError(PLAN_NOT_ON_ROSTER);

    let result: training.PlanExercisesResult;
    try {
        result = await training.addPlanExercises(planId, parsed.data.map(toPlanExerciseInput), auth.user);
    } catch (error) {
        return planExerciseFailure(error);
    }
    if (result.added.length > 0) revalidatePlan(plan.id, plan.fighterId);
    if (result.failed.length === 0) return actionSuccess(`${pluralize(result.added.length, "exercise")} added to the plan.`);

    const reasons = [...new Set(result.failed.map((failure) => failure.message))].join(" ");
    const summary =
        result.added.length === 0
            ? `${result.failed.length === 1 ? "The exercise" : "The exercises"} couldn't be added.`
            : `${pluralize(result.added.length, "exercise")} added. ${pluralize(result.failed.length, "exercise")} couldn't be added and ${result.failed.length === 1 ? "is" : "are"} still listed below.`;
    return { status: "error", message: `${summary} ${reasons}`, data: { failedRows: result.failed.map((failure) => failure.index) } };
}

export async function addPlanExercise(planId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeCoach();
    if (!auth.ok) return auth.state;

    const parsed = planExerciseSchema
        .extend({ exerciseId: z.string().min(1, "Choose an exercise.") })
        .safeParse({ ...readPlanExerciseForm(formData), exerciseId: text(formData, "exerciseId") });
    if (!parsed.success) return validationError(parsed.error);
    const plan = await loadRosterPlan(auth.user, planId);
    if (!plan) return actionError(PLAN_NOT_ON_ROSTER);

    const { exerciseId, ...fields } = parsed.data;
    try {
        await training.addPlanExercise(planId, exerciseId, toPlanExerciseFields(fields), auth.user);
    } catch (error) {
        return planExerciseFailure(error);
    }
    revalidatePlan(plan.id, plan.fighterId);
    return actionSuccess("Exercise added to the plan.");
}

export async function updatePlanExercise(planId: string, planExerciseId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeCoach();
    if (!auth.ok) return auth.state;

    const parsed = planExerciseSchema.safeParse(readPlanExerciseForm(formData));
    if (!parsed.success) return validationError(parsed.error);
    const plan = await loadRosterPlan(auth.user, planId);
    if (!plan) return actionError(PLAN_NOT_ON_ROSTER);

    let updated: Awaited<ReturnType<typeof training.updatePlanExercise>>;
    try {
        updated = await training.updatePlanExercise(planId, planExerciseId, toPlanExerciseFields(parsed.data), auth.user);
    } catch (error) {
        return planExerciseFailure(error);
    }
    if (!updated) return actionError("That exercise is no longer on the plan.");
    revalidatePlan(plan.id, plan.fighterId);
    return actionSuccess("Exercise updated.");
}

export async function removePlanExercise(planId: string, planExerciseId: string): Promise<ActionState> {
    const auth = await authorizeCoach();
    if (!auth.ok) return auth.state;
    const plan = await loadRosterPlan(auth.user, planId);
    if (!plan) return actionError(PLAN_NOT_ON_ROSTER);

    let removed: boolean;
    try {
        removed = await training.removePlanExercise(planId, planExerciseId, auth.user);
    } catch (error) {
        return planExerciseFailure(error);
    }
    if (!removed) return actionError("That exercise is no longer on the plan.");
    revalidatePlan(plan.id, plan.fighterId);
    return actionSuccess("Exercise removed from the plan.");
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

/** Session fields. Target RPE and exercises belong to the demo's richer form: the training service stores neither. */
function sessionFieldsSchema(serviceForms: boolean) {
    const targetRpe = wholeNumber("Target RPE", 1, 10);
    return z.object({
        planId: z.string(),
        title: z.string().trim().min(3, "Enter a title of at least 3 characters.").max(120, "Keep the title under 120 characters."),
        type: z.enum(serviceForms ? SERVICE_TRAINING_TYPES : TRAINING_TYPES, "Choose a training type."),
        date: z.string().refine(isDateKey, "Enter a valid date."),
        time: z.string().refine(isTimeValue, "Enter a start time."),
        durationMin: wholeNumber("Duration", 10, 300),
        location: z.string().trim().min(2, "Enter where the session takes place.").max(120, "Keep the location under 120 characters."),
        targetRpe: serviceForms ? targetRpe.optional() : targetRpe,
        exercises: z.array(sessionExerciseSchema, "The exercise list couldn't be read. Reload the page and try again.").max(20, "Add at most 20 exercises."),
        notes: z.string().trim().max(1000, "Keep notes under 1,000 characters."),
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
async function writeSession(write: () => Promise<training.SessionMutationResult>): Promise<SessionWrite> {
    try {
        const result = await write();
        return result.ok ? { ok: true, session: result.session } : { ok: false, message: result.message, conflicts: result.conflicts };
    } catch (error) {
        return { ok: false, ...trainingWriteFailure(error, { fields: SESSION_FORM_FIELDS }), conflicts: [] };
    }
}

/** A refused write on the session form, which also shows the clearance conflicts found. */
function sessionFormFailure({ message, fieldErrors, conflicts }: Extract<SessionWrite, { ok: false }>): ActionState<SessionFormResult> {
    return { status: "error", message, fieldErrors, data: { conflicts } };
}

const repeatCountMessage = `Repeat for 2 to ${MAX_WEEKLY_REPEATS} weeks.`;
/** "Repeat weekly × N": N sessions in all, counting the first. Read only when the box is ticked. */
const repeatSchema = z.coerce.number(repeatCountMessage).int(repeatCountMessage).min(2, repeatCountMessage).max(MAX_WEEKLY_REPEATS, repeatCountMessage);

/** The last day of the session's plan, when it has one, so a weekly repeat stops there. */
async function planLastDay(planId: string): Promise<string | null> {
    if (!planId) return null;
    const plan = await training.getPlan(planId);
    return plan?.endDate ? dayKey(plan.endDate) : null;
}

/**
 * Schedules a session, or one a week at the same time for N weeks when "Repeat weekly" is ticked. Repeats stop at the
 * plan's last day. The first session is checked like any other; each later one is sent on its own and the coach is
 * told how many were scheduled.
 */
export async function createSession(_prev: ActionState<SessionFormResult>, formData: FormData): Promise<ActionState<SessionFormResult>> {
    const auth = await authorizeCoach();
    if (!auth.ok) return auth.state;

    const repeat = formData.get("repeat") === "on";
    const parsed = sessionFieldsSchema(usesTrainingServiceForms())
        .extend({ fighterId: z.string().min(1, "Choose a fighter."), repeatCount: repeat ? repeatSchema : z.unknown().transform(() => 1) })
        .safeParse({ ...readSessionForm(formData), fighterId: text(formData, "fighterId"), repeatCount: text(formData, "repeatCount") });
    if (!parsed.success) return validationError(parsed.error);
    const { fighterId, repeatCount } = parsed.data;
    if (!canAccessFighter(auth.user, fighterId)) return actionError(NOT_ON_ROSTER, { fighterId: "Choose a fighter from your roster." });

    const scheduledAt = academyWallClockToIso(parsed.data.date, parsed.data.time);
    if (Date.parse(scheduledAt) < Date.now() - PAST_GRACE_MS) {
        return actionError(FIX_FIELDS, { date: "Choose a date and time that hasn't passed." });
    }

    const { dates, skipped } = weeklyDates(parsed.data.date, repeatCount, repeatCount > 1 ? await planLastDay(parsed.data.planId) : null);
    const write = (at: string) => writeSession(() => training.createSession({ ...toServiceInput(parsed.data, at, auth.coachId), fighterId }, auth.user));

    const first = await write(scheduledAt);
    if (!first.ok) return sessionFormFailure(first);
    revalidateSession(first.session);
    if (dates.length === 1 && repeatCount === 1) redirect(routes.coach.session(first.session.id));

    // Later weeks go in one at a time; a refusal (a clearance block on that date, say) doesn't stop the others.
    let created = 1;
    for (const date of dates.slice(1)) {
        const later = await write(academyWallClockToIso(date, parsed.data.time));
        if (later.ok) created += 1;
    }
    redirect(
        hrefWith(routes.coach.session(first.session.id), {}, { notice: SESSIONS_REPEATED, created, failed: dates.length - created, skipped: skipped || null }),
    );
}

export async function updateSession(
    sessionId: string,
    _prev: ActionState<SessionFormResult>,
    formData: FormData,
): Promise<ActionState<SessionFormResult>> {
    const auth = await authorizeCoach();
    if (!auth.ok) return auth.state;

    const parsed = sessionFieldsSchema(usesTrainingServiceForms()).safeParse(readSessionForm(formData));
    if (!parsed.success) return validationError(parsed.error);

    const existing = await training.getSession(sessionId);
    if (!existing || !canAccessFighter(auth.user, existing.fighterId)) {
        return actionError("That session no longer exists or isn't on your roster.");
    }

    const scheduledAt = academyWallClockToIso(parsed.data.date, parsed.data.time);
    const rescheduled = scheduledAt !== existing.scheduledAt;
    if (rescheduled && Date.parse(scheduledAt) < Date.now() - PAST_GRACE_MS) {
        return actionError(FIX_FIELDS, { date: "Choose a date and time that hasn't passed." });
    }

    // Keep the assigned coach when another roster coach edits the session; a session without one takes the editor.
    const coachId = existing.coachId ?? auth.user.profileId;
    if (!coachId) return actionError("Your account isn't linked to a coach profile yet. Ask an administrator to link it.");
    const result = await writeSession(() => training.updateSession(sessionId, toServiceInput(parsed.data, scheduledAt, coachId), auth.user));
    if (!result.ok) return sessionFormFailure(result);
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

/**
 * A session's result. The training service measures the duration itself and keeps no rating, summary or exercise
 * check-off, so those are optional when it's in use.
 */
function resultSchema(serviceForms: boolean) {
    const ratingMessage = "Choose a rating from 1 to 5 stars.";
    const actualDurationMin = wholeNumber("Actual duration", 1, 300);
    const coachRating = z.coerce.number(ratingMessage).int(ratingMessage).min(1, ratingMessage).max(5, ratingMessage);
    const summary = z.string().trim().max(1000, "Keep the summary under 1,000 characters.");
    return z.object({
        actualDurationMin: serviceForms ? actualDurationMin.optional() : actualDurationMin,
        rpe: wholeNumber("RPE", 1, 10),
        roundsCompleted: wholeNumber("Rounds completed", 0, 100),
        coachRating: serviceForms ? coachRating.optional() : coachRating,
        summary: serviceForms ? summary : summary.min(3, "Add a short summary of how the session went."),
        completedExerciseIds: z.array(z.string()),
    });
}

export async function recordSessionResult(sessionId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeCoach();
    if (!auth.ok) return auth.state;

    const parsed = resultSchema(usesTrainingServiceForms()).safeParse({
        actualDurationMin: optionalText(formData, "actualDurationMin"),
        rpe: text(formData, "rpe"),
        roundsCompleted: text(formData, "roundsCompleted"),
        coachRating: optionalText(formData, "coachRating"),
        summary: text(formData, "summary"),
        completedExerciseIds: texts(formData, "completedExerciseIds"),
    });
    if (!parsed.success) return validationError(parsed.error);

    const session = await loadRosterSession(auth.user, sessionId);
    if (!session) return actionError("That session no longer exists or isn't on your roster.");
    const correction = session.status === "completed";

    const { actualDurationMin, coachRating, ...result } = parsed.data;
    const saved = await writeSession(() =>
        training.recordSessionResult(sessionId, { ...result, actualDurationMin: actualDurationMin ?? null, coachRating: coachRating ?? null }, auth.user),
    );
    if (!saved.ok) return actionError(saved.message, saved.fieldErrors);
    revalidateSession(saved.session);
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

    const result = await writeSession(() => training.cancelSession(sessionId, parsed.data.reason, auth.user));
    if (!result.ok) return actionError(result.message, result.fieldErrors);
    revalidateSession(result.session);
    return actionSuccess("Session cancelled. The fighter has been notified.");
}

export interface StartSessionResult {
    /** Why the fighter's Medical Clearance doesn't allow the session now, when the service said. */
    reasons: EligibilityReason[];
}

/** Checks the fighter in. The training service refuses when their Medical Clearance doesn't allow it now. */
export async function startSession(sessionId: string): Promise<ActionState<StartSessionResult>> {
    const auth = await authorizeCoach();
    if (!auth.ok) return auth.state;

    const session = await loadRosterSession(auth.user, sessionId);
    if (!session) return actionError("That session no longer exists or isn't on your roster.");

    try {
        const result = await training.startSession(sessionId, auth.user);
        if (!result.ok) return actionError(result.message);
        revalidateSession(result.session);
        return actionSuccess("Session started. Record the result when it's done.", { reasons: [] });
    } catch (error) {
        const failure = trainingWriteFailure(error, { fields: SESSION_FORM_FIELDS });
        return { status: "error", message: failure.message, data: { reasons: trainingEligibilityReasons(error) ?? [] } };
    }
}

/** Records that a scheduled session didn't happen. */
export async function markSessionMissed(sessionId: string): Promise<ActionState> {
    const auth = await authorizeCoach();
    if (!auth.ok) return auth.state;

    const session = await loadRosterSession(auth.user, sessionId);
    if (!session) return actionError("That session no longer exists or isn't on your roster.");

    const result = await writeSession(() => training.markSessionMissed(sessionId, auth.user));
    if (!result.ok) return actionError(result.message);
    revalidateSession(result.session);
    return actionSuccess("Session marked as missed.");
}

const feedbackSchema = z.object({
    kind: z.enum(FEEDBACK_KINDS, "Choose the kind of feedback."),
    techniques: z.array(z.enum(TECHNIQUES, "Choose techniques from the list.")),
    body: z.string().trim().min(3, "Write the feedback (at least 3 characters).").max(1000, "Keep feedback under 1,000 characters."),
});

export async function addSessionFeedback(sessionId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeCoach();
    if (!auth.ok) return auth.state;
    if (!platformFeatureAvailable("coachFeedback")) return actionError(PLATFORM_FEATURE_UNAVAILABLE_MESSAGE);

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

/* ─── Exercise library (administrators) ───────────────────────────────────── */

const LIBRARY_ADMIN_ONLY = "Only administrators can change the exercise library.";

/** The training service lets administrators alone add to the global library (`training.exercise:create`). */
async function authorizeLibraryAdmin(): Promise<{ ok: true; user: User } | { ok: false; state: ActionState<never> }> {
    const auth = await authorizeAction("settings:manage");
    if (!auth.ok) return { ok: false, state: actionError(auth.message) };
    if (auth.user.role !== "admin") return { ok: false, state: actionError(LIBRARY_ADMIN_ONLY) };
    return { ok: true, user: auth.user };
}

function revalidateLibrary(): void {
    revalidatePath(routes.admin.exercises);
    revalidatePath(routes.coach.newPlan);
}

/** A refused library write. The service's roster wording doesn't apply here: a 403 means the account isn't an administrator. */
function libraryWriteFailure(error: unknown): { message: string; fieldErrors?: Record<string, string> } {
    if (error instanceof ApiError && error.status === 403) return { message: `The training service refused this. ${LIBRARY_ADMIN_ONLY}` };
    return trainingWriteFailure(error, {
        fields: { name: "name", category: "category", description: "description", targetMuscleGroups: "targetMuscleGroups", videoUrl: "videoUrl" },
    });
}

const MUSCLE_GROUPS_MAX = 12;

const exerciseSchema = z.object({
    name: z.string().trim().min(2, "Enter the exercise name.").max(120, "Keep the name under 120 characters."),
    category: z.enum(SERVICE_EXERCISE_CATEGORIES, "Choose a category."),
    description: z.string().trim().max(EXERCISE_LIMITS.description, "Keep the description under 1,000 characters."),
    targetMuscleGroups: z
        .string()
        .max(300, "Keep the muscle groups under 300 characters.")
        .transform((value) => [...new Set(value.split(",").map((group) => group.trim().toLowerCase()).filter(Boolean))])
        .pipe(z.array(z.string().max(50, "Keep each muscle group under 50 characters.")).max(MUSCLE_GROUPS_MAX, `List at most ${MUSCLE_GROUPS_MAX} muscle groups.`)),
    videoUrl: z
        .string()
        .trim()
        .max(EXERCISE_LIMITS.url, "Keep the link under 1,000 characters.")
        .refine((value) => value === "" || /^https?:\/\/\S+$/i.test(value), "Enter a full link starting with https://, or leave it empty."),
});

/** Adds one exercise to the global library. A name already in the library is refused, ignoring case. */
export async function createLibraryExercise(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeLibraryAdmin();
    if (!auth.ok) return auth.state;

    const parsed = exerciseSchema.safeParse({
        name: text(formData, "name"),
        category: text(formData, "category"),
        description: text(formData, "description"),
        targetMuscleGroups: text(formData, "targetMuscleGroups"),
        videoUrl: text(formData, "videoUrl"),
    });
    if (!parsed.success) return validationError(parsed.error);
    const { name, category, description, targetMuscleGroups, videoUrl } = parsed.data;

    try {
        // The library has no unique names, so the same drill twice would confuse every plan form.
        const existing = await training.listExerciseCatalog({ search: name });
        if (existing.some((exercise) => exerciseNameKey(exercise.name) === exerciseNameKey(name))) {
            return actionError(FIX_FIELDS, { name: "That exercise is already in the library." });
        }
        await training.createExercise({ name, category, description: description || null, targetMuscleGroups, videoUrl: videoUrl || null }, auth.user);
    } catch (error) {
        const failure = libraryWriteFailure(error);
        return actionError(failure.message, failure.fieldErrors);
    }
    revalidateLibrary();
    return actionSuccess(`${name} added to the library.`);
}

export interface StarterImportResult {
    created: string[];
    /** Starter exercises the library already had. */
    skipped: string[];
    failed: { name: string; message: string }[];
}

/**
 * Adds every starter exercise the templates use that the library lacks (matched by name, ignoring case), one at a
 * time. The rest still go in when one is refused.
 */
export async function importStarterLibrary(): Promise<ActionState<StarterImportResult>> {
    const auth = await authorizeLibraryAdmin();
    if (!auth.ok) return auth.state;

    let catalog: training.LibraryExercise[];
    try {
        catalog = await training.listExerciseCatalog();
    } catch (error) {
        if (error instanceof ApiError) return actionError("The exercise library couldn't be read, so nothing was imported. Try again in a moment.");
        throw error;
    }
    const missing = missingStarterExercises(catalog);
    const missingNames = new Set(missing.map((exercise) => exercise.name));
    const result: StarterImportResult = { created: [], skipped: STARTER_EXERCISES.filter((exercise) => !missingNames.has(exercise.name)).map((exercise) => exercise.name), failed: [] };

    for (const exercise of missing) {
        try {
            await training.createExercise({ ...exercise, videoUrl: null }, auth.user);
            result.created.push(exercise.name);
        } catch (error) {
            result.failed.push({ name: exercise.name, message: libraryWriteFailure(error).message });
        }
    }
    if (result.created.length > 0) revalidateLibrary();

    if (missing.length === 0) return actionSuccess("The library already has every starter exercise.", result);
    if (result.created.length === 0) return { status: "error", message: `No exercises were imported. ${result.failed[0]?.message ?? ""}`.trim(), data: result };
    const failedText = result.failed.length > 0 ? ` ${pluralize(result.failed.length, "exercise")} couldn't be added.` : "";
    return actionSuccess(`Imported ${pluralize(result.created.length, "exercise")}.${failedText}`, result);
}
