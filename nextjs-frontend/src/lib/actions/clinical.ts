"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { canAccessFighterClinically } from "@/lib/auth/access";
import { authorizeClinicalAction } from "@/lib/auth/session";
import {
    BODY_REGION_LABELS,
    INJURY_MECHANISM_LABELS,
    INJURY_SEVERITY_LABELS,
    INJURY_STATUS_LABELS,
    INJURY_TYPE_LABELS,
    TREATMENT_STATUS_LABELS,
    TREATMENT_TYPE_LABELS,
} from "@/lib/domain/labels";
import type { InjuryStatus } from "@/lib/domain/types";
import { academyWallClockToIso, dayKey, isDateKey, isDateTimeInputValue } from "@/lib/format";
import { routes } from "@/lib/routes";
import { getAlertDetail, reviewAlert } from "@/lib/services/ai";
import {
    addRecoveryCheckIn,
    addTreatment,
    advanceRecoveryPhase,
    createInjury,
    createRecoveryPlan,
    getInjury,
    getInjuryDetail,
    getRecoveryPlan,
    setMilestone,
    updateInjury,
    updateTreatmentStatus,
} from "@/lib/services/medical";
import { actionError, actionSuccess, validationError, type ActionState } from "./state";

/* ─── Parsing helpers (not exported: a "use server" module may only export actions) ─── */

const NOT_ASSIGNED = "You aren't assigned to this fighter, so you can't change their medical information.";
const FIX_FIELDS = "Please fix the highlighted fields.";
/** Clock skew tolerated when checking that a time isn't in the future. */
const FUTURE_TOLERANCE_MS = 5 * 60_000;

function keysOf<T extends string>(record: Record<T, string>): [T, ...T[]] {
    return Object.keys(record) as [T, ...T[]];
}

function text(formData: FormData, name: string): string {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
}

const optionalDate = (message: string) =>
    z
        .string()
        .trim()
        .refine((value) => value === "" || isDateKey(value), message);

/** Today's calendar day (YYYY-MM-DD) in the academy timezone. */
function todayKey(): string {
    return dayKey(new Date());
}

/** A whole number posted from a numeric input, within [min, max]. */
function wholeNumber(label: string, min: number, max: number) {
    const range = `${label} must be a whole number from ${min} to ${max}.`;
    return z
        .string()
        .trim()
        .min(1, `Enter the ${label.toLowerCase()}.`)
        .transform((value) => Number(value))
        .pipe(z.number({ error: range }).int(range).min(min, range).max(max, range));
}

/** A JSON-encoded array posted from a client-side builder. */
function jsonArray<T extends z.ZodType>(item: T, label: string, bounds: { min: number; minMessage: string; max: number; maxMessage: string }) {
    return z
        .string()
        .transform((value, ctx) => {
            try {
                return JSON.parse(value || "[]") as unknown;
            } catch {
                ctx.addIssue({ code: "custom", message: `The ${label} couldn't be read. Reload the page and try again.` });
                return z.NEVER;
            }
        })
        .pipe(z.array(item).min(bounds.min, bounds.minMessage).max(bounds.max, bounds.maxMessage));
}

/** Clinical changes show up on doctor, fighter and coach screens. */
function revalidateClinical() {
    revalidatePath("/doctor", "layout");
    revalidatePath("/fighter", "layout");
    revalidatePath("/coach", "layout");
}

/* ─── Injuries ────────────────────────────────────────────────────────────── */

const createInjurySchema = z
    .object({
        fighterId: z.string().min(1, "Choose the injured fighter."),
        type: z.enum(keysOf(INJURY_TYPE_LABELS), { error: "Choose the injury type." }),
        bodyRegion: z.enum(keysOf(BODY_REGION_LABELS), { error: "Choose the body region." }),
        severity: z.enum(keysOf(INJURY_SEVERITY_LABELS), { error: "Choose a severity." }),
        status: z.enum(["active", "recovering"], { error: "Choose the current status." }),
        mechanism: z.enum(keysOf(INJURY_MECHANISM_LABELS), { error: "Choose how the injury happened." }),
        occurredAt: z.string().refine(isDateTimeInputValue, "Enter the date and time the injury happened."),
        diagnosedAt: z.string().refine(isDateKey, "Enter the date of diagnosis."),
        expectedReturnAt: optionalDate("Enter a valid date, or leave it empty if return can't be estimated yet."),
        description: z
            .string()
            .trim()
            .min(20, "Describe the clinical findings in a sentence or two.")
            .max(3000, "Keep the description under 3,000 characters."),
        linkedAlertId: z.string().trim(),
    })
    .superRefine((input, ctx) => {
        const occurredDay = input.occurredAt.slice(0, 10);
        if (isDateKey(input.diagnosedAt) && input.diagnosedAt < occurredDay) {
            ctx.addIssue({ code: "custom", path: ["diagnosedAt"], message: "The diagnosis can't be dated before the injury." });
        }
        if (input.expectedReturnAt && isDateKey(input.diagnosedAt) && input.expectedReturnAt < input.diagnosedAt) {
            ctx.addIssue({ code: "custom", path: ["expectedReturnAt"], message: "The expected return must be on or after the diagnosis date." });
        }
    });

export async function createInjuryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeClinicalAction("medical:write");
    if (!auth.ok) return actionError(auth.message);

    const parsed = createInjurySchema.safeParse({
        fighterId: text(formData, "fighterId"),
        type: text(formData, "type"),
        bodyRegion: text(formData, "bodyRegion"),
        severity: text(formData, "severity"),
        status: text(formData, "status"),
        mechanism: text(formData, "mechanism"),
        occurredAt: text(formData, "occurredAt"),
        diagnosedAt: text(formData, "diagnosedAt"),
        expectedReturnAt: text(formData, "expectedReturnAt"),
        description: text(formData, "description"),
        linkedAlertId: text(formData, "linkedAlertId"),
    });
    if (!parsed.success) return validationError(parsed.error);
    const input = parsed.data;
    if (!canAccessFighterClinically(auth.user, input.fighterId)) return actionError(NOT_ASSIGNED, { fighterId: "Choose one of your assigned fighters." });

    const [occurredDay, occurredTime] = input.occurredAt.split("T");
    const occurredAt = academyWallClockToIso(occurredDay, occurredTime);
    if (Date.parse(occurredAt) > Date.now() + FUTURE_TOLERANCE_MS) {
        return actionError(FIX_FIELDS, { occurredAt: "The injury time can't be in the future." });
    }
    if (input.diagnosedAt > todayKey()) {
        return actionError(FIX_FIELDS, { diagnosedAt: "The diagnosis date can't be in the future." });
    }

    if (input.linkedAlertId) {
        const detail = await getAlertDetail(input.linkedAlertId);
        if (!detail || detail.alert.fighterId !== input.fighterId) {
            return actionError(FIX_FIELDS, { linkedAlertId: "Choose an AI movement observation for this fighter, or leave it unlinked." });
        }
    }

    const diagnosedNoon = input.diagnosedAt === todayKey() ? new Date().toISOString() : academyWallClockToIso(input.diagnosedAt, "12:00");
    const diagnosedAt = diagnosedNoon < occurredAt ? occurredAt : diagnosedNoon;

    const result = await createInjury(
        {
            fighterId: input.fighterId,
            type: input.type,
            bodyRegion: input.bodyRegion,
            severity: input.severity,
            status: input.status,
            mechanism: input.mechanism,
            occurredAt,
            diagnosedAt,
            description: input.description,
            expectedReturnAt: input.expectedReturnAt ? academyWallClockToIso(input.expectedReturnAt, "09:00") : null,
            linkedAlertId: input.linkedAlertId || null,
        },
        auth.user,
    );
    if (!result.ok) return actionError(result.error);

    revalidateClinical();
    redirect(`${routes.doctor.injury(result.data.id)}?created=1`);
}

const updateInjurySchema = z.object({
    injuryId: z.string().min(1, "The injury is missing. Reload the page and try again."),
    status: z.enum(keysOf(INJURY_STATUS_LABELS), { error: "Choose a status." }),
});

const INJURY_STATUS_MESSAGES: Record<InjuryStatus, string> = {
    active: "Injury marked as active.",
    recovering: "Injury marked as recovering.",
    resolved: "Injury resolved. The fighter and their coaches have been notified.",
};

export async function updateInjuryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeClinicalAction("medical:write");
    if (!auth.ok) return actionError(auth.message);

    const parsed = updateInjurySchema.safeParse({ injuryId: text(formData, "injuryId"), status: text(formData, "status") });
    if (!parsed.success) return validationError(parsed.error);

    const injury = await getInjury(parsed.data.injuryId);
    if (!injury || !canAccessFighterClinically(auth.user, injury.fighterId)) {
        return actionError("This injury record isn't available. It may belong to a fighter you aren't assigned to.");
    }
    if (injury.status === parsed.data.status) return actionSuccess(`The injury is already ${INJURY_STATUS_LABELS[injury.status].toLowerCase()}.`);

    const reopened = injury.status === "resolved";
    const result = await updateInjury(injury.id, { status: parsed.data.status }, auth.user);
    if (!result.ok) return actionError(result.error);

    revalidateClinical();
    return actionSuccess(
        reopened ? `Injury reopened as ${INJURY_STATUS_LABELS[result.data.status].toLowerCase()}.` : INJURY_STATUS_MESSAGES[result.data.status],
    );
}

/* ─── Treatments ──────────────────────────────────────────────────────────── */

const addTreatmentSchema = z
    .object({
        injuryId: z.string().min(1, "The injury is missing. Reload the page and try again."),
        type: z.enum(keysOf(TREATMENT_TYPE_LABELS), { error: "Choose the treatment type." }),
        description: z.string().trim().min(3, "Describe the treatment.").max(300, "Keep the description under 300 characters."),
        providerName: z.string().trim().min(2, "Enter who provides this treatment.").max(120, "Keep the provider under 120 characters."),
        frequency: z.string().trim().min(2, "Enter how often it happens, e.g. “3× per week”.").max(120, "Keep the frequency under 120 characters."),
        startDate: z.string().refine(isDateKey, "Enter the start date."),
        endDate: optionalDate("Enter a valid end date, or leave it empty for open-ended treatment."),
        status: z.enum(keysOf(TREATMENT_STATUS_LABELS), { error: "Choose a status." }),
        notes: z.string().trim().max(1000, "Keep notes under 1,000 characters."),
    })
    .superRefine((input, ctx) => {
        if (input.endDate && isDateKey(input.startDate) && input.endDate < input.startDate) {
            ctx.addIssue({ code: "custom", path: ["endDate"], message: "The end date must be on or after the start date." });
        }
        if (input.status === "completed" && !input.endDate) {
            ctx.addIssue({ code: "custom", path: ["endDate"], message: "Add the end date for a completed treatment." });
        }
        if (input.status === "completed" && input.endDate > todayKey()) {
            ctx.addIssue({ code: "custom", path: ["endDate"], message: "A completed treatment can't end in the future." });
        }
    });

export async function addTreatmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeClinicalAction("medical:write");
    if (!auth.ok) return actionError(auth.message);

    const parsed = addTreatmentSchema.safeParse({
        injuryId: text(formData, "injuryId"),
        type: text(formData, "type"),
        description: text(formData, "description"),
        providerName: text(formData, "providerName"),
        frequency: text(formData, "frequency"),
        startDate: text(formData, "startDate"),
        endDate: text(formData, "endDate"),
        status: text(formData, "status"),
        notes: text(formData, "notes"),
    });
    if (!parsed.success) return validationError(parsed.error);
    const input = parsed.data;

    const injury = await getInjury(input.injuryId);
    if (!injury || !canAccessFighterClinically(auth.user, injury.fighterId)) return actionError(NOT_ASSIGNED);

    const result = await addTreatment(
        {
            injuryId: injury.id,
            type: input.type,
            description: input.description,
            providerName: input.providerName,
            frequency: input.frequency,
            startDate: academyWallClockToIso(input.startDate, "09:00"),
            endDate: input.endDate ? academyWallClockToIso(input.endDate, "18:00") : null,
            status: input.status,
            notes: input.notes || null,
        },
        auth.user,
    );
    if (!result.ok) return actionError(result.error);

    revalidateClinical();
    return actionSuccess(`${TREATMENT_TYPE_LABELS[result.data.type]} added as ${TREATMENT_STATUS_LABELS[result.data.status].toLowerCase()}.`);
}

const treatmentStatusSchema = z.object({
    injuryId: z.string().min(1),
    treatmentId: z.string().min(1),
    status: z.enum(keysOf(TREATMENT_STATUS_LABELS)),
});

export async function updateTreatmentStatusAction(input: { injuryId: string; treatmentId: string; status: string }): Promise<ActionState> {
    const auth = await authorizeClinicalAction("medical:write");
    if (!auth.ok) return actionError(auth.message);

    const parsed = treatmentStatusSchema.safeParse(input);
    if (!parsed.success) return actionError("That status change couldn't be read. Reload the page and try again.");

    const detail = await getInjuryDetail(parsed.data.injuryId);
    const treatment = detail?.treatments.find((t) => t.id === parsed.data.treatmentId);
    if (!detail || !treatment || !canAccessFighterClinically(auth.user, detail.injury.fighterId)) {
        return actionError("This treatment isn't available. It may belong to a fighter you aren't assigned to.");
    }

    const result = await updateTreatmentStatus(treatment.id, parsed.data.status, auth.user);
    if (!result.ok) return actionError(result.error);

    revalidateClinical();
    return actionSuccess(`${TREATMENT_TYPE_LABELS[result.data.type]} marked ${TREATMENT_STATUS_LABELS[result.data.status].toLowerCase()}.`);
}

/* ─── Recovery plans ──────────────────────────────────────────────────────── */

const phaseSchema = z
    .object({
        name: z.string().trim().min(2, "Name this phase.").max(80, "Keep the phase name under 80 characters."),
        goal: z.string().trim().min(5, "Describe what this phase should achieve.").max(300, "Keep the goal under 300 characters."),
        startDate: z.string().refine(isDateKey, "Enter the phase start date."),
        endDate: z.string().refine(isDateKey, "Enter the phase end date."),
        milestones: z
            .array(z.string().trim().max(160, "Keep each milestone under 160 characters."))
            .transform((items) => items.filter(Boolean))
            .pipe(
                z.array(z.string()).min(1, "Add at least one milestone so progress can be tracked.").max(12, "Use at most 12 milestones per phase."),
            ),
    })
    .superRefine((phase, ctx) => {
        if (isDateKey(phase.startDate) && isDateKey(phase.endDate) && phase.endDate < phase.startDate) {
            ctx.addIssue({ code: "custom", path: ["endDate"], message: "The phase must end on or after its start date." });
        }
    });

const createRecoveryPlanSchema = z
    .object({
        injuryId: z.string().min(1, "Choose the injury this plan is for."),
        title: z.string().trim().min(3, "Give the plan a short title.").max(120, "Keep the title under 120 characters."),
        startDate: z.string().refine(isDateKey, "Enter the plan start date."),
        targetReturnDate: z.string().refine(isDateKey, "Enter the target return date."),
        phases: jsonArray(phaseSchema, "phases", {
            min: 1,
            minMessage: "Add at least one recovery phase.",
            max: 10,
            maxMessage: "Use at most 10 phases.",
        }),
    })
    .superRefine((plan, ctx) => {
        if (!isDateKey(plan.startDate) || !isDateKey(plan.targetReturnDate)) return;
        if (plan.targetReturnDate < plan.startDate) {
            ctx.addIssue({ code: "custom", path: ["targetReturnDate"], message: "The target return must be on or after the start date." });
        }
        plan.phases.forEach((phase, index) => {
            if (phase.startDate < plan.startDate) {
                ctx.addIssue({ code: "custom", path: ["phases", index, "startDate"], message: "A phase can't start before the plan." });
            }
            if (phase.endDate > plan.targetReturnDate) {
                ctx.addIssue({ code: "custom", path: ["phases", index, "endDate"], message: "This phase ends after the target return date." });
            }
            const previous = plan.phases[index - 1];
            if (previous && phase.startDate < previous.startDate) {
                ctx.addIssue({ code: "custom", path: ["phases", index, "startDate"], message: "Phases must be in date order." });
            }
        });
    });

export async function createRecoveryPlanAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeClinicalAction("medical:write");
    if (!auth.ok) return actionError(auth.message);

    const parsed = createRecoveryPlanSchema.safeParse({
        injuryId: text(formData, "injuryId"),
        title: text(formData, "title"),
        startDate: text(formData, "startDate"),
        targetReturnDate: text(formData, "targetReturnDate"),
        phases: text(formData, "phases"),
    });
    if (!parsed.success) return validationError(parsed.error);
    const input = parsed.data;

    const injury = await getInjury(input.injuryId);
    if (!injury || !canAccessFighterClinically(auth.user, injury.fighterId))
        return actionError(NOT_ASSIGNED, { injuryId: "Choose an injury of one of your assigned fighters." });

    const result = await createRecoveryPlan(
        {
            injuryId: injury.id,
            title: input.title,
            startDate: academyWallClockToIso(input.startDate, "09:00"),
            targetReturnDate: academyWallClockToIso(input.targetReturnDate, "18:00"),
            phases: input.phases.map((phase) => ({
                name: phase.name,
                goal: phase.goal,
                startDate: academyWallClockToIso(phase.startDate, "09:00"),
                endDate: academyWallClockToIso(phase.endDate, "18:00"),
                milestones: phase.milestones,
            })),
        },
        auth.user,
    );
    if (!result.ok) return actionError(result.error);

    revalidateClinical();
    redirect(`${routes.doctor.recoveryPlan(result.data.id)}?created=1`);
}

const checkInSchema = z.object({
    planId: z.string().min(1, "The recovery plan is missing. Reload the page and try again."),
    date: z.string().refine(isDateKey, "Enter the check-in date."),
    painLevel: wholeNumber("Pain level", 0, 10),
    mobilityPct: wholeNumber("Mobility", 0, 100),
    strengthPct: wholeNumber("Strength", 0, 100),
    note: z.string().trim().max(500, "Keep the note under 500 characters."),
});

export async function addCheckInAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeClinicalAction("medical:write");
    if (!auth.ok) return actionError(auth.message);

    const parsed = checkInSchema.safeParse({
        planId: text(formData, "planId"),
        date: text(formData, "date"),
        painLevel: text(formData, "painLevel"),
        mobilityPct: text(formData, "mobilityPct"),
        strengthPct: text(formData, "strengthPct"),
        note: text(formData, "note"),
    });
    if (!parsed.success) return validationError(parsed.error);
    const input = parsed.data;

    const plan = await getRecoveryPlan(input.planId);
    if (!plan || !canAccessFighterClinically(auth.user, plan.fighterId)) return actionError(NOT_ASSIGNED);

    const today = todayKey();
    if (input.date > today) return actionError(FIX_FIELDS, { date: "The check-in date can't be in the future." });
    if (input.date < dayKey(plan.startDate)) return actionError(FIX_FIELDS, { date: "The check-in can't be dated before the plan started." });

    const result = await addRecoveryCheckIn(
        plan.id,
        {
            date: input.date === today ? new Date().toISOString() : academyWallClockToIso(input.date, "12:00"),
            painLevel: input.painLevel,
            mobilityPct: input.mobilityPct,
            strengthPct: input.strengthPct,
            note: input.note,
        },
        auth.user,
    );
    if (!result.ok) return actionError(result.error);

    revalidateClinical();
    return actionSuccess(`Check-in logged: pain ${input.painLevel}/10, mobility ${input.mobilityPct}%, strength ${input.strengthPct}%.`);
}

const milestoneSchema = z.object({
    planId: z.string().min(1),
    phaseId: z.string().min(1),
    milestoneIndex: z.number().int().min(0),
    done: z.boolean(),
});

export async function setMilestoneAction(input: { planId: string; phaseId: string; milestoneIndex: number; done: boolean }): Promise<ActionState> {
    const auth = await authorizeClinicalAction("medical:write");
    if (!auth.ok) return actionError(auth.message);

    const parsed = milestoneSchema.safeParse(input);
    if (!parsed.success) return actionError("That milestone couldn't be read. Reload the page and try again.");

    const plan = await getRecoveryPlan(parsed.data.planId);
    if (!plan || !canAccessFighterClinically(auth.user, plan.fighterId)) return actionError(NOT_ASSIGNED);

    const result = await setMilestone(plan.id, parsed.data.phaseId, parsed.data.milestoneIndex, parsed.data.done, auth.user);
    if (!result.ok) return actionError(result.error);

    revalidateClinical();
    return actionSuccess(parsed.data.done ? "Milestone marked done." : "Milestone marked not done.");
}

export async function advancePhaseAction(input: { planId: string }): Promise<ActionState> {
    const auth = await authorizeClinicalAction("medical:write");
    if (!auth.ok) return actionError(auth.message);

    const parsed = z.object({ planId: z.string().min(1) }).safeParse(input);
    if (!parsed.success) return actionError("The recovery plan is missing. Reload the page and try again.");

    const plan = await getRecoveryPlan(parsed.data.planId);
    if (!plan || !canAccessFighterClinically(auth.user, plan.fighterId)) return actionError(NOT_ASSIGNED);

    const result = await advanceRecoveryPhase(plan.id, auth.user);
    if (!result.ok) return actionError(result.error);

    revalidateClinical();
    const current = result.data.phases.find((phase) => phase.status === "current");
    return actionSuccess(
        current ? `Moved to the next phase: ${current.name}.` : "Recovery plan completed. Update the injury and Medical Clearance when you're ready.",
    );
}

/* ─── AI movement observations ────────────────────────────────────────────── */

const reviewAlertSchema = z.object({
    alertId: z.string().min(1, "The observation is missing. Reload the page and try again."),
    decision: z.enum(["acknowledged", "follow_up", "dismissed"], { error: "Choose your decision." }),
    note: z.string().trim().min(10, "Add a short clinical note explaining your decision.").max(1000, "Keep the note under 1,000 characters."),
});

const DECISION_MESSAGES = {
    acknowledged: "Observation acknowledged.",
    follow_up: "Follow-up scheduled. Coaches have been told to check Medical Clearance — without clinical detail.",
    dismissed: "Observation dismissed.",
} as const;

export async function reviewAlertAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeClinicalAction("ai_alerts:review");
    if (!auth.ok) return actionError(auth.message);

    const parsed = reviewAlertSchema.safeParse({
        alertId: text(formData, "alertId"),
        decision: text(formData, "decision"),
        note: text(formData, "note"),
    });
    if (!parsed.success) return validationError(parsed.error);

    const detail = await getAlertDetail(parsed.data.alertId);
    if (!detail || !canAccessFighterClinically(auth.user, detail.alert.fighterId)) {
        return actionError("This observation isn't available. It may belong to a fighter you aren't assigned to.");
    }

    const result = await reviewAlert(detail.alert.id, { decision: parsed.data.decision, note: parsed.data.note }, auth.user);
    if (!result.ok) return actionError(result.message, result.code === "note_required" ? { note: result.message } : undefined);

    revalidateClinical();
    return actionSuccess(DECISION_MESSAGES[parsed.data.decision]);
}
