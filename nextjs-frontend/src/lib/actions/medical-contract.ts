"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { canAccessFighter, canAccessFighterClinically } from "@/lib/auth/access";
import { authorizeAction, authorizeClinicalAction } from "@/lib/auth/session";
import { milestoneDrafts, widenedLists, type MilestoneDraft, type RestrictionLists } from "@/lib/domain/medical-bodies";
import {
    API_INJURY_SEVERITIES,
    BODY_JOINTS,
    CLEARANCE_TYPES,
    CLEARANCE_TYPES_BY_SCOPE,
    EXAMINATION_DECISIONS,
    EXAMINATION_SCOPES,
    MEDICAL_TEXT_LIMITS,
    RECOVERY_MILESTONES_MAX,
    SESSION_TYPES,
    TECHNIQUE_TYPES,
} from "@/lib/domain/medical-contract";
import { academyWallClockToIso, dayKey, isDateKey, isDateTimeInputValue } from "@/lib/format";
import { hrefWith } from "@/lib/query";
import { routes } from "@/lib/routes";
import {
    createMilestonePlan,
    createReviewRequest,
    getClinicalDossier,
    issueClearance,
    listRecoveryPlans,
    recordExaminationDecision,
    recordInjury,
    recordTreatment,
    updateMilestonePlan,
} from "@/lib/services/medical";
import { medicalWriteFailure, type MedicalWriteErrorOptions } from "@/lib/services/medical-errors";
import { NOT_ASSIGNED, checked, isInFuture, jsonArray, optionalDate, revalidateClinical, text, texts } from "./form-helpers";
import { actionError, actionSuccess, FIX_FIELDS, validationError, type ActionState } from "./state";

/*
 * Server Actions for the medical service's own records (API mode). Each one validates the form, checks the
 * caller's assignment, sends one request and maps a refusal back onto the form. A failed request is never retried.
 */

/* ─── Parsing helpers (not exported: a "use server" module may only export actions) ─── */

const required = (message: string) => z.string().trim().min(1, message);

const boundedText = (label: string, max: number, min = 0, minMessage = "") =>
    z
        .string()
        .trim()
        .min(min, minMessage)
        .max(max, `Keep the ${label} under ${max.toLocaleString("en-US")} characters.`);

/** A datetime-local value in academy time, as an ISO timestamp. */
function wallClockIso(value: string): string {
    const [day, time] = value.split("T");
    return academyWallClockToIso(day, time);
}

/** A date the doctor picked as a time on that day: now for today, else midday academy time. */
function dayIso(key: string): string {
    return key === dayKey(new Date()) ? new Date().toISOString() : academyWallClockToIso(key, "12:00");
}

const maxIso = (a: string, b: string) => (Date.parse(a) >= Date.parse(b) ? a : b);

function failed(error: unknown, options?: MedicalWriteErrorOptions): ActionState<never> {
    const failure = medicalWriteFailure(error, options);
    return actionError(failure.message, failure.fieldErrors);
}

/* ─── Restriction lists (shared by examinations and clearances) ───────────── */

const RESTRICTION_FIELDS: Record<string, string> = {
    restrictions: "restrictions",
    "restrictions.allowedSessionTypes": "allowedSessionTypes",
    "restrictions.allowedTechniqueTypes": "allowedTechniqueTypes",
    "restrictions.excludedJoints": "excludedJoints",
    "restrictions.notes": "restrictionNotes",
};

const restrictionListsSchema = z
    .object({
        limitSessions: z.boolean(),
        allowedSessionTypes: z.array(z.enum(SESSION_TYPES)),
        limitTechniques: z.boolean(),
        allowedTechniqueTypes: z.array(z.enum(TECHNIQUE_TYPES)),
        excludedJoints: z.array(z.enum(BODY_JOINTS)),
    })
    .superRefine((lists, ctx) => {
        if (lists.limitSessions && lists.allowedSessionTypes.length === 0) {
            ctx.addIssue({ code: "custom", path: ["allowedSessionTypes"], message: "Choose at least one session type the fighter may do, or turn this limit off." });
        }
        if (lists.limitTechniques && lists.allowedTechniqueTypes.length === 0) {
            ctx.addIssue({ code: "custom", path: ["allowedTechniqueTypes"], message: "Choose at least one technique the fighter may use, or turn this limit off." });
        }
    });

function restrictionListsFrom(formData: FormData) {
    return {
        limitSessions: checked(formData, "limitSessions"),
        allowedSessionTypes: texts(formData, "allowedSessionTypes"),
        limitTechniques: checked(formData, "limitTechniques"),
        allowedTechniqueTypes: texts(formData, "allowedTechniqueTypes"),
        excludedJoints: texts(formData, "excludedJoints"),
    };
}

function toLists(lists: z.output<typeof restrictionListsSchema>): RestrictionLists {
    return {
        allowedSessionTypes: lists.limitSessions ? lists.allowedSessionTypes : null,
        allowedTechniqueTypes: lists.limitTechniques ? lists.allowedTechniqueTypes : null,
        excludedJoints: lists.excludedJoints.length > 0 ? lists.excludedJoints : null,
    };
}

/** Validation errors with restriction list errors reported under the list's own field name, as the form names them. */
function restrictionFormError(error: z.ZodError): ActionState<never> {
    const state = validationError(error);
    return { ...state, fieldErrors: Object.fromEntries(Object.entries(state.fieldErrors ?? {}).map(([key, message]) => [key.replace(/^lists\./, ""), message])) };
}

const limitsSomething = (lists: RestrictionLists) => lists.allowedSessionTypes !== null || lists.allowedTechniqueTypes !== null || lists.excludedJoints !== null;

/* ─── Review requests ─────────────────────────────────────────────────────── */

const reviewRequestSchema = z.object({
    fighterId: required("The fighter is missing. Reload the page and try again."),
    reason: boundedText("reason", MEDICAL_TEXT_LIMITS.reviewReason, 10, "Say what happened or what worries you, in a sentence or two."),
});

/** A fighter (for themselves), their coach or their doctor asks for a medical review. */
export async function requestMedicalReviewAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeAction("medical:request_review");
    if (!auth.ok) return actionError(auth.message);

    const parsed = reviewRequestSchema.safeParse({ fighterId: text(formData, "fighterId"), reason: text(formData, "reason") });
    if (!parsed.success) return validationError(parsed.error);
    const { fighterId, reason } = parsed.data;
    const allowed = auth.user.role === "fighter" ? auth.user.profileId === fighterId : canAccessFighter(auth.user, fighterId);
    if (!allowed) return actionError("You can only request a review for yourself or a fighter you're assigned to.");

    try {
        const result = await createReviewRequest(fighterId, reason, auth.user);
        if (!result.ok) return actionError(result.error);
    } catch (error) {
        return failed(error, { fields: { reason: "reason" } });
    }

    revalidateClinical();
    return actionSuccess("Review requested. Training is paused until the sports doctor examines the fighter.");
}

/* ─── Examination decisions ───────────────────────────────────────────────── */

const examinationSchema = z
    .object({
        fighterId: required("Choose the fighter you examined."),
        scope: z.enum(EXAMINATION_SCOPES, { error: "Choose what this examination decides." }),
        decision: z.enum(EXAMINATION_DECISIONS, { error: "Choose your decision." }),
        examinedAt: z.string().refine(isDateTimeInputValue, "Enter the date and time of the examination."),
        reason: boundedText("reasoning", MEDICAL_TEXT_LIMITS.examinationReason, 10, "Explain your decision in a sentence or two."),
        lists: restrictionListsSchema,
        restrictionNotes: boundedText("restriction notes", MEDICAL_TEXT_LIMITS.restrictionNotes),
        validUntil: optionalDate("Enter a valid date, or leave it empty."),
        supersedesId: z.string().trim(),
        reviewRequestIds: z.array(z.string().min(1)).max(50, "Choose at most 50 review requests."),
    })
    .superRefine((input, ctx) => {
        if (input.decision === "ELIGIBLE_WITH_RESTRICTIONS" && !limitsSomething(toLists(input.lists)) && !input.restrictionNotes) {
            ctx.addIssue({ code: "custom", path: ["restrictions"], message: "Set at least one limit or write the restrictions in the notes." });
        }
        if (input.validUntil && isDateTimeInputValue(input.examinedAt) && input.validUntil <= input.examinedAt.slice(0, 10)) {
            ctx.addIssue({ code: "custom", path: ["validUntil"], message: "The decision must stay valid past the examination day." });
        }
    });

const EXAMINATION_FIELDS: MedicalWriteErrorOptions = {
    fields: { scope: "scope", decision: "decision", examinedAt: "examinedAt", reason: "reason", validUntil: "validUntil", supersedesId: "supersedesId", reviewRequestIds: "reviewRequestIds", ...RESTRICTION_FIELDS },
    conflictFields: { EXAMINATION_CORRECTION_CONFLICT: "supersedesId", REVIEW_REQUEST_NOT_RESOLVABLE: "reviewRequestIds" },
};

export async function recordExaminationDecisionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeClinicalAction("medical:write");
    if (!auth.ok) return actionError(auth.message);

    const parsed = examinationSchema.safeParse({
        fighterId: text(formData, "fighterId"),
        scope: text(formData, "scope"),
        decision: text(formData, "decision"),
        examinedAt: text(formData, "examinedAt"),
        reason: text(formData, "reason"),
        lists: restrictionListsFrom(formData),
        restrictionNotes: text(formData, "restrictionNotes"),
        validUntil: text(formData, "validUntil"),
        supersedesId: checked(formData, "correction") ? text(formData, "supersedesId") : "",
        reviewRequestIds: texts(formData, "reviewRequestIds"),
    });
    if (!parsed.success) return restrictionFormError(parsed.error);
    const input = parsed.data;
    if (!canAccessFighterClinically(auth.user, input.fighterId)) return actionError(NOT_ASSIGNED, { fighterId: "Choose one of your assigned fighters." });

    const examinedAt = wallClockIso(input.examinedAt);
    if (isInFuture(examinedAt)) return actionError(FIX_FIELDS, { examinedAt: "The examination time can't be in the future." });

    let examinationId: string;
    try {
        const exam = await recordExaminationDecision(input.fighterId, {
            scope: input.scope,
            decision: input.decision,
            examinedAt,
            reason: input.reason,
            restrictions: { ...toLists(input.lists), notes: input.restrictionNotes || null },
            validUntil: input.validUntil ? academyWallClockToIso(input.validUntil, "23:59") : null,
            supersedesId: input.supersedesId || null,
            reviewRequestIds: input.reviewRequestIds,
        });
        examinationId = exam.id;
    } catch (error) {
        return failed(error, EXAMINATION_FIELDS);
    }

    revalidateClinical();
    // A positive decision still needs a clearance before the fighter can train: go straight to issuing it.
    if (input.decision === "NOT_ELIGIBLE") redirect(hrefWith(routes.doctor.fighter(input.fighterId), {}, { notice: "examination-not-eligible" }));
    redirect(hrefWith(routes.doctor.grantClearance, {}, { fighter: input.fighterId, exam: examinationId, notice: "examination-recorded" }));
}

/* ─── Clearances ──────────────────────────────────────────────────────────── */

const clearanceSchema = z
    .object({
        fighterId: required("Choose the fighter this clearance is for."),
        examinationId: required("Choose the examination this clearance comes from."),
        clearanceType: z.enum(CLEARANCE_TYPES, { error: "Choose the type of clearance." }),
        validFrom: optionalDate("Enter a valid start date, or leave it empty to start now."),
        validUntil: optionalDate("Enter a valid end date, or leave it empty to keep the examination's."),
        lists: restrictionListsSchema,
        notes: boundedText("notes", MEDICAL_TEXT_LIMITS.clearanceNotes),
    })
    .superRefine((input, ctx) => {
        if (input.validFrom && input.validUntil && input.validUntil <= input.validFrom) {
            ctx.addIssue({ code: "custom", path: ["validUntil"], message: "The clearance must end after it starts." });
        }
    });

export async function issueClearanceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeClinicalAction("clearance:manage");
    if (!auth.ok) return actionError(auth.message);

    const parsed = clearanceSchema.safeParse({
        fighterId: text(formData, "fighterId"),
        examinationId: text(formData, "examinationId"),
        clearanceType: text(formData, "clearanceType"),
        validFrom: text(formData, "validFrom"),
        validUntil: text(formData, "validUntil"),
        lists: restrictionListsFrom(formData),
        notes: text(formData, "notes"),
    });
    if (!parsed.success) return restrictionFormError(parsed.error);
    const input = parsed.data;
    if (!canAccessFighterClinically(auth.user, input.fighterId)) return actionError(NOT_ASSIGNED, { fighterId: "Choose one of your assigned fighters." });

    // Check the rules the service applies, so the doctor sees which field to change instead of a bare refusal.
    const dossier = await getClinicalDossier(input.fighterId);
    const exam = dossier ? Object.values(dossier.currentExaminations).find((current) => current?.id === input.examinationId) : null;
    if (!exam || exam.decision === "NOT_ELIGIBLE") {
        return actionError("A clearance can only come from the fighter's current positive examination. Reload the page and choose it again.", {
            examinationId: "Choose the current examination.",
        });
    }
    if (!CLEARANCE_TYPES_BY_SCOPE[exam.scope].includes(input.clearanceType)) {
        return actionError(FIX_FIELDS, { clearanceType: "This examination can't back that type of clearance." });
    }
    const lists = toLists(input.lists);
    const examLists: RestrictionLists = exam.restrictions ?? { allowedSessionTypes: null, allowedTechniqueTypes: null, excludedJoints: null };
    const widened = widenedLists(examLists, lists);
    if (widened.length > 0) {
        return actionError(
            "A clearance can only narrow what the examination allows.",
            Object.fromEntries(widened.map((name) => [name, name === "excludedJoints" ? "Keep out at least the joints the examination excluded." : "Allow only what the examination allows."])),
        );
    }
    // Starting on the examination day means starting once the examination was done.
    const validFrom = !input.validFrom ? null : input.validFrom === dayKey(exam.examinedAt) ? maxIso(dayIso(input.validFrom), exam.examinedAt) : dayIso(input.validFrom);
    if (validFrom && validFrom < exam.examinedAt) return actionError(FIX_FIELDS, { validFrom: "The clearance can't start before the examination." });
    const validUntil = input.validUntil ? academyWallClockToIso(input.validUntil, "23:59") : null;
    if (validUntil && exam.validUntil && validUntil > exam.validUntil) {
        return actionError(FIX_FIELDS, { validUntil: "The clearance can't outlast the examination's decision." });
    }

    try {
        await issueClearance(input.fighterId, {
            examinationId: exam.id,
            clearanceType: input.clearanceType,
            validFrom,
            validUntil,
            restrictions: lists,
            notes: input.notes || null,
        });
    } catch (error) {
        return failed(error, {
            fields: { examinationId: "examinationId", clearanceType: "clearanceType", validFrom: "validFrom", validUntil: "validUntil", notes: "notes", ...RESTRICTION_FIELDS },
            conflictFields: { EXAMINATION_NOT_ELIGIBLE_FOR_CLEARANCE: "examinationId", MEDICAL_RECORD_CONFLICT: "clearanceType" },
        });
    }

    revalidateClinical();
    redirect(hrefWith(routes.doctor.fighter(input.fighterId), {}, { notice: "clearance-issued" }));
}

/* ─── Injuries & treatments ───────────────────────────────────────────────── */

const injurySchema = z.object({
    fighterId: required("Choose the injured fighter."),
    affectedJoint: z.enum(BODY_JOINTS, { error: "Choose the affected joint." }),
    injuryType: boundedText("injury type", MEDICAL_TEXT_LIMITS.injuryType, 2, "Name the injury, e.g. “Lateral ankle sprain”."),
    severity: z.enum(API_INJURY_SEVERITIES, { error: "Choose a severity." }),
    occurredAt: z.string().refine(isDateTimeInputValue, "Enter the date and time the injury happened."),
    description: boundedText("description", MEDICAL_TEXT_LIMITS.clinicalText),
});

export async function recordInjuryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeClinicalAction("medical:write");
    if (!auth.ok) return actionError(auth.message);

    const parsed = injurySchema.safeParse({
        fighterId: text(formData, "fighterId"),
        affectedJoint: text(formData, "affectedJoint"),
        injuryType: text(formData, "injuryType"),
        severity: text(formData, "severity"),
        occurredAt: text(formData, "occurredAt"),
        description: text(formData, "description"),
    });
    if (!parsed.success) return validationError(parsed.error);
    const input = parsed.data;
    if (!canAccessFighterClinically(auth.user, input.fighterId)) return actionError(NOT_ASSIGNED, { fighterId: "Choose one of your assigned fighters." });

    const occurredAt = wallClockIso(input.occurredAt);
    if (isInFuture(occurredAt)) return actionError(FIX_FIELDS, { occurredAt: "The injury time can't be in the future." });

    let injuryId: string;
    try {
        const injury = await recordInjury(input.fighterId, {
            affectedJoint: input.affectedJoint,
            injuryType: input.injuryType,
            severity: input.severity,
            occurredAt,
            description: input.description || null,
        });
        injuryId = injury.id;
    } catch (error) {
        return failed(error, { fields: { affectedJoint: "affectedJoint", injuryType: "injuryType", severity: "severity", occurredAt: "occurredAt", description: "description" } });
    }

    revalidateClinical();
    redirect(hrefWith(routes.doctor.injury(injuryId), {}, { created: "1" }));
}

const treatmentSchema = z
    .object({
        injuryId: required("The injury is missing. Reload the page and try again."),
        fighterId: required("The fighter is missing. Reload the page and try again."),
        treatmentType: boundedText("treatment", MEDICAL_TEXT_LIMITS.treatmentType, 2, "Name the treatment, e.g. “Physiotherapy”."),
        treatmentDate: z.string().refine(isDateKey, "Enter the date of the treatment."),
        description: boundedText("description", MEDICAL_TEXT_LIMITS.clinicalText),
        outcomeNotes: boundedText("outcome notes", MEDICAL_TEXT_LIMITS.clinicalText),
        nextReviewAt: optionalDate("Enter a valid review date, or leave it empty."),
    })
    .superRefine((input, ctx) => {
        if (input.nextReviewAt && isDateKey(input.treatmentDate) && input.nextReviewAt < input.treatmentDate) {
            ctx.addIssue({ code: "custom", path: ["nextReviewAt"], message: "The review can't be before the treatment." });
        }
    });

export async function recordTreatmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeClinicalAction("medical:write");
    if (!auth.ok) return actionError(auth.message);

    const parsed = treatmentSchema.safeParse({
        injuryId: text(formData, "injuryId"),
        fighterId: text(formData, "fighterId"),
        treatmentType: text(formData, "treatmentType"),
        treatmentDate: text(formData, "treatmentDate"),
        description: text(formData, "description"),
        outcomeNotes: text(formData, "outcomeNotes"),
        nextReviewAt: text(formData, "nextReviewAt"),
    });
    if (!parsed.success) return validationError(parsed.error);
    const input = parsed.data;
    if (!canAccessFighterClinically(auth.user, input.fighterId)) return actionError(NOT_ASSIGNED);
    if (input.treatmentDate > dayKey(new Date())) return actionError(FIX_FIELDS, { treatmentDate: "The treatment date can't be in the future." });

    try {
        await recordTreatment(
            { id: input.injuryId, fighterId: input.fighterId },
            {
                treatmentType: input.treatmentType,
                treatmentDate: dayIso(input.treatmentDate),
                description: input.description || null,
                outcomeNotes: input.outcomeNotes || null,
                nextReviewAt: input.nextReviewAt ? academyWallClockToIso(input.nextReviewAt, "09:00") : null,
            },
        );
    } catch (error) {
        return failed(error, {
            fields: { treatmentType: "treatmentType", treatmentDate: "treatmentDate", description: "description", outcomeNotes: "outcomeNotes", nextReviewAt: "nextReviewAt" },
        });
    }

    revalidateClinical();
    return actionSuccess(`${input.treatmentType} recorded. Treatments can't be edited later, so add a new one if anything changes.`);
}

/* ─── Recovery plans ──────────────────────────────────────────────────────── */

const milestoneSchema = z.object({
    title: boundedText("milestone", MEDICAL_TEXT_LIMITS.planTitle, 2, "Name this milestone."),
    criteria: boundedText("criteria", MEDICAL_TEXT_LIMITS.clinicalText, 3, "Say how you'll know it's reached."),
    targetDate: optionalDate("Enter a valid target date, or leave it empty."),
    notes: boundedText("notes", MEDICAL_TEXT_LIMITS.clinicalText),
});

const milestoneList = jsonArray(milestoneSchema, "milestones", { max: RECOVERY_MILESTONES_MAX, maxMessage: `Use at most ${RECOVERY_MILESTONES_MAX} milestones.` });

const recoveryPlanSchema = z
    .object({
        fighterId: required("The fighter is missing. Reload the page and try again."),
        injuryId: required("Choose the injury this plan is for."),
        title: boundedText("title", MEDICAL_TEXT_LIMITS.planTitle, 3, "Give the plan a short title."),
        description: boundedText("description", MEDICAL_TEXT_LIMITS.clinicalText),
        startDate: z.string().refine(isDateKey, "Enter the plan start date."),
        estimatedEndDate: optionalDate("Enter a valid end date, or leave it empty."),
        milestones: milestoneList,
    })
    .superRefine((plan, ctx) => {
        if (plan.estimatedEndDate && isDateKey(plan.startDate) && plan.estimatedEndDate < plan.startDate) {
            ctx.addIssue({ code: "custom", path: ["estimatedEndDate"], message: "The plan can't end before it starts." });
        }
    });

const toDraft = (milestone: z.output<typeof milestoneSchema>): MilestoneDraft => ({
    title: milestone.title,
    criteria: milestone.criteria,
    targetDate: milestone.targetDate || null,
    notes: milestone.notes || null,
    isCompleted: false,
});

const PLAN_FIELDS: Record<string, string> = {
    injuryId: "injuryId",
    title: "title",
    description: "description",
    startDate: "startDate",
    estimatedEndDate: "estimatedEndDate",
    milestones: "milestones",
};

export async function createMilestonePlanAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeClinicalAction("medical:write");
    if (!auth.ok) return actionError(auth.message);

    const parsed = recoveryPlanSchema.safeParse({
        fighterId: text(formData, "fighterId"),
        injuryId: text(formData, "injuryId"),
        title: text(formData, "title"),
        description: text(formData, "description"),
        startDate: text(formData, "startDate"),
        estimatedEndDate: text(formData, "estimatedEndDate"),
        milestones: text(formData, "milestones"),
    });
    if (!parsed.success) return validationError(parsed.error);
    const input = parsed.data;
    if (!canAccessFighterClinically(auth.user, input.fighterId)) return actionError(NOT_ASSIGNED);

    let planId: string;
    try {
        const plan = await createMilestonePlan(input.fighterId, {
            injuryId: input.injuryId,
            title: input.title,
            description: input.description || null,
            startDate: input.startDate,
            estimatedEndDate: input.estimatedEndDate || null,
            milestones: input.milestones.map(toDraft),
        });
        planId = plan.id;
    } catch (error) {
        return failed(error, { fields: PLAN_FIELDS, conflictFields: { RECOVERY_PLAN_DATE_CONFLICT: "estimatedEndDate" } });
    }

    revalidateClinical();
    redirect(hrefWith(routes.doctor.recoveryPlan(planId), {}, { created: "1" }));
}

/** The plan as the service has it now, so a change is applied to fresh milestones rather than to a stale page. */
async function currentPlan(fighterId: string, planId: string) {
    return (await listRecoveryPlans({ fighterIds: [fighterId] })).find((plan) => plan.id === planId) ?? null;
}

const planRefSchema = z.object({ fighterId: z.string().min(1), planId: z.string().min(1) });

/** Ticks or unticks one milestone. The service replaces the whole list, so every other milestone is sent unchanged. */
export async function setPlanMilestoneAction(input: { fighterId: string; planId: string; milestoneId: string; done: boolean }): Promise<ActionState> {
    const auth = await authorizeClinicalAction("medical:write");
    if (!auth.ok) return actionError(auth.message);
    const parsed = planRefSchema.extend({ milestoneId: z.string().min(1), done: z.boolean() }).safeParse(input);
    if (!parsed.success) return actionError("That milestone couldn't be read. Reload the page and try again.");
    const { fighterId, planId, milestoneId, done } = parsed.data;
    if (!canAccessFighterClinically(auth.user, fighterId)) return actionError(NOT_ASSIGNED);

    try {
        const plan = await currentPlan(fighterId, planId);
        if (!plan?.milestones) return actionError("This plan's milestones can't be changed here. Reload the page and try again.");
        if (!plan.milestones.some((milestone) => milestone.id === milestoneId)) return actionError("That milestone no longer exists. Reload the page.");
        const drafts = milestoneDrafts(plan.milestones).map((draft) => (draft.id === milestoneId ? { ...draft, isCompleted: done } : draft));
        await updateMilestonePlan(planId, { milestones: drafts });
    } catch (error) {
        return failed(error);
    }

    revalidateClinical();
    return actionSuccess(done ? "Milestone marked reached." : "Milestone marked not reached.");
}

/** Adds a milestone to the end of the plan. */
export async function addPlanMilestoneAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeClinicalAction("medical:write");
    if (!auth.ok) return actionError(auth.message);
    const ref = planRefSchema.safeParse({ fighterId: text(formData, "fighterId"), planId: text(formData, "planId") });
    if (!ref.success) return actionError("The recovery plan is missing. Reload the page and try again.");
    const parsed = milestoneSchema.safeParse({
        title: text(formData, "title"),
        criteria: text(formData, "criteria"),
        targetDate: text(formData, "targetDate"),
        notes: text(formData, "notes"),
    });
    if (!parsed.success) return validationError(parsed.error);
    const { fighterId, planId } = ref.data;
    if (!canAccessFighterClinically(auth.user, fighterId)) return actionError(NOT_ASSIGNED);

    try {
        const plan = await currentPlan(fighterId, planId);
        if (!plan?.milestones) return actionError("This plan's milestones can't be changed here. Reload the page and try again.");
        if (plan.milestones.length >= RECOVERY_MILESTONES_MAX) return actionError(`A plan can have at most ${RECOVERY_MILESTONES_MAX} milestones.`);
        await updateMilestonePlan(planId, { milestones: [...milestoneDrafts(plan.milestones), toDraft(parsed.data)] });
    } catch (error) {
        return failed(error, { fields: { "milestones.0.title": "title", "milestones.0.criteria": "criteria" } });
    }

    revalidateClinical();
    return actionSuccess(`Milestone “${parsed.data.title}” added.`);
}

const CLOSE_MESSAGES = {
    COMPLETED: "Recovery plan completed. Review the injury and Medical Clearance next — completing a plan doesn't clear the fighter.",
    CANCELLED: "Recovery plan cancelled.",
} as const;

/** Completes or cancels an active plan. Neither clears the fighter to train. */
export async function closeRecoveryPlanAction(input: { fighterId: string; planId: string; status: "COMPLETED" | "CANCELLED" }): Promise<ActionState> {
    const auth = await authorizeClinicalAction("medical:write");
    if (!auth.ok) return actionError(auth.message);
    const parsed = planRefSchema.extend({ status: z.enum(["COMPLETED", "CANCELLED"]) }).safeParse(input);
    if (!parsed.success) return actionError("The recovery plan is missing. Reload the page and try again.");
    if (!canAccessFighterClinically(auth.user, parsed.data.fighterId)) return actionError(NOT_ASSIGNED);

    try {
        await updateMilestonePlan(parsed.data.planId, { status: parsed.data.status });
    } catch (error) {
        return failed(error);
    }

    revalidateClinical();
    return actionSuccess(CLOSE_MESSAGES[parsed.data.status]);
}
