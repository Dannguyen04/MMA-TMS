"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { accessibleFighterIds, canAccessFighterClinically } from "@/lib/auth/access";
import { authorizeClinicalAction } from "@/lib/auth/session";
import {
    BODY_REGION_LABELS,
    CLEARANCE_LEVEL_LABELS,
    EXAMINATION_OUTCOME_LABELS,
    HEALTH_STATUS_LABELS,
    TECHNIQUE_LABELS,
    TRAINING_TYPE_LABELS,
} from "@/lib/domain/labels";
import { academyWallClockToIso, daysBetween, isDateKey, isDateTimeInputValue } from "@/lib/format";
import { routes } from "@/lib/routes";
import {
    createExamination,
    grantClearance,
    listClearances,
    revokeClearance,
    updateHealthStatus,
    updateMedicalRecord,
} from "@/lib/services/medical";
import { medicalWriteFailure } from "@/lib/services/medical-errors";
import { FEATURE_UNAVAILABLE_MESSAGE, medicalFeatureAvailable } from "@/lib/services/medical-features";
import { assessmentSchema, checkBloodPressure, checkFollowUpDate, EXAMINATION_TYPES, issuesOf, readVitals, scat6Field, scat6Issues, toVitals, VITAL_FIELDS } from "./examination-fields";
import { NOT_ASSIGNED, isInFuture, jsonArray, keysOf, text } from "./form-helpers";
import { actionError, actionSuccess, FIX_FIELDS, validationError, type ActionState } from "./state";

/* ─── Parsing helpers (not exported: a "use server" module may only export actions) ─── */

const MAX_CLEARANCE_DAYS = 365;

function revalidateDoctorArea() {
    revalidatePath("/doctor", "layout");
}

/* ─── Medical record ──────────────────────────────────────────────────────── */

const lineList = (label: string) =>
    z
        .string()
        .transform((value) =>
            value
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean),
        )
        .pipe(z.array(z.string().max(200, `Keep each ${label} under 200 characters.`)).max(30, `List at most 30 ${label}s.`));

const currentYear = new Date().getUTCFullYear();

const medicalRecordSchema = z.object({
    fighterId: z.string().min(1, "The fighter is missing. Reload the page and try again."),
    bloodType: z.string().trim().min(1, "Choose a blood type, or “Not recorded”.").max(20),
    allergies: lineList("allergy"),
    chronicConditions: lineList("condition"),
    medications: lineList("medication"),
    surgicalHistory: jsonArray(
        z.object({
            year: z
                .number({ error: "Enter the year of the procedure." })
                .int("Enter a four-digit year.")
                .min(1950, "Enter a year from 1950 onwards.")
                .max(currentYear, "The year can't be in the future."),
            procedure: z.string().trim().min(1, "Describe the procedure.").max(200, "Keep the procedure under 200 characters."),
        }),
        "surgical history",
    ),
    emergencyName: z.string().trim().max(120, "Keep the name under 120 characters."),
    emergencyRelation: z.string().trim().max(60, "Keep the relationship under 60 characters."),
    emergencyPhone: z
        .string()
        .trim()
        .max(40, "Keep the phone number under 40 characters.")
        .refine((value) => value === "" || /^\+?[\d\s().-]{6,}$/.test(value), "Enter a phone number using digits, spaces and an optional leading +."),
    notes: z.string().trim().max(3000, "Keep clinical notes under 3,000 characters."),
});

export async function updateMedicalRecordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeClinicalAction("medical:write");
    if (!auth.ok) return actionError(auth.message);
    if (!medicalFeatureAvailable("medicalRecord")) return actionError(FEATURE_UNAVAILABLE_MESSAGE);

    const parsed = medicalRecordSchema.safeParse({
        fighterId: text(formData, "fighterId"),
        bloodType: text(formData, "bloodType"),
        allergies: text(formData, "allergies"),
        chronicConditions: text(formData, "chronicConditions"),
        medications: text(formData, "medications"),
        surgicalHistory: text(formData, "surgicalHistory"),
        emergencyName: text(formData, "emergencyName"),
        emergencyRelation: text(formData, "emergencyRelation"),
        emergencyPhone: text(formData, "emergencyPhone"),
        notes: text(formData, "notes"),
    });
    if (!parsed.success) return validationError(parsed.error);
    const input = parsed.data;
    if (!canAccessFighterClinically(auth.user, input.fighterId)) return actionError(NOT_ASSIGNED);

    const result = await updateMedicalRecord(
        input.fighterId,
        {
            bloodType: input.bloodType,
            allergies: input.allergies,
            chronicConditions: input.chronicConditions,
            medications: input.medications,
            surgicalHistory: [...input.surgicalHistory].sort((a, b) => a.year - b.year),
            emergencyContact: { name: input.emergencyName, relation: input.emergencyRelation, phone: input.emergencyPhone },
            notes: input.notes,
        },
        auth.user,
    );
    if (!result.ok) return actionError(result.error);

    revalidateDoctorArea();
    return actionSuccess("Medical record saved.");
}

/* ─── Examinations ────────────────────────────────────────────────────────── */

const examinationSchema = z
    .object({
        fighterId: z.string().min(1, "Choose the fighter you examined."),
        type: z.enum(EXAMINATION_TYPES, { error: "Choose the examination type." }),
        date: z.string().refine(isDateTimeInputValue, "Enter the date and time of the examination."),
        ...VITAL_FIELDS,
        assessments: jsonArray(assessmentSchema, "assessments", { min: 1, minMessage: "Add at least one assessment." }),
        outcome: z.enum(keysOf(EXAMINATION_OUTCOME_LABELS), { error: "Choose the examination outcome." }),
        summary: z.string().trim().min(10, "Summarise the findings in a sentence or two.").max(3000, "Keep the summary under 3,000 characters."),
        recommendations: z
            .string()
            .trim()
            .min(1, "Add recommendations — for example training guidance or next steps.")
            .max(3000, "Keep recommendations under 3,000 characters."),
        followUpDate: z.string().trim().refine((value) => value === "" || isDateKey(value), "Enter a valid follow-up date."),
    })
    .superRefine((exam, ctx) => {
        checkBloodPressure(exam, ctx);
        checkFollowUpDate(exam.followUpDate, exam.date, ctx);
    });

export async function createExaminationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeClinicalAction("medical:write");
    if (!auth.ok) return actionError(auth.message);

    const parsed = examinationSchema.safeParse({
        fighterId: text(formData, "fighterId"),
        type: text(formData, "type"),
        date: text(formData, "date"),
        ...readVitals(formData),
        assessments: text(formData, "assessments"),
        outcome: text(formData, "outcome"),
        summary: text(formData, "summary"),
        recommendations: text(formData, "recommendations"),
        followUpDate: text(formData, "followUpDate"),
    });
    const scat6 = text(formData, "type") === "baseline" ? scat6Field.safeParse(text(formData, "scat6")) : undefined;
    if (!parsed.success || scat6?.success === false) return validationError(new z.ZodError([...issuesOf(parsed), ...scat6Issues(scat6)]));
    const input = parsed.data;
    if (!canAccessFighterClinically(auth.user, input.fighterId)) return actionError(NOT_ASSIGNED, { fighterId: "Choose one of your assigned fighters." });

    const [day, time] = input.date.split("T");
    const examinedAt = academyWallClockToIso(day, time);
    if (isInFuture(examinedAt)) {
        return actionError(FIX_FIELDS, { date: "The examination time can't be in the future." });
    }

    const result = await createExamination(
        {
            fighterId: input.fighterId,
            date: examinedAt,
            type: input.type,
            vitals: toVitals(input),
            assessments: input.assessments,
            outcome: input.outcome,
            summary: input.summary,
            recommendations: input.recommendations,
            followUpDate: input.followUpDate ? academyWallClockToIso(input.followUpDate, "10:00") : null,
            scat6: scat6?.success ? scat6.data : null,
        },
        auth.user,
    );
    if (!result.ok) return actionError(result.error);

    revalidateDoctorArea();
    redirect(`${routes.doctor.examination(result.data.id)}?notice=examination-recorded`);
}

/* ─── Medical Clearance ───────────────────────────────────────────────────── */

const restrictionSchema = z.object({
    label: z.string().trim().min(1, "Give this restriction a label coaches will understand.").max(140, "Keep the label under 140 characters."),
    blockedTrainingTypes: z.array(z.enum(keysOf(TRAINING_TYPE_LABELS))).max(8),
    blockedTechniques: z.array(z.enum(keysOf(TECHNIQUE_LABELS))).max(8),
    blockedRegions: z.array(z.enum(keysOf(BODY_REGION_LABELS))).max(21),
    maxRpe: z.number().int().min(1, "Max RPE must be between 1 and 10.").max(10, "Max RPE must be between 1 and 10.").nullable(),
});

const grantClearanceSchema = z
    .object({
        fighterId: z.string().min(1, "Choose the fighter this clearance is for."),
        level: z.enum(keysOf(CLEARANCE_LEVEL_LABELS), { error: "Choose a clearance level." }),
        validUntil: z.string().trim(),
        reason: z
            .string()
            .trim()
            .min(10, "Give the clinical reason for this decision in a sentence or two.")
            .max(2000, "Keep the reason under 2,000 characters."),
        examinationId: z.string().trim(),
        restrictions: jsonArray(restrictionSchema, "restrictions"),
        confirmNotCleared: z.string(),
    })
    .superRefine((input, ctx) => {
        if (input.level !== "not_cleared" && !isDateKey(input.validUntil)) {
            ctx.addIssue({ code: "custom", path: ["validUntil"], message: "Choose the date this clearance is valid until." });
        }
        if (input.level === "restricted" && input.restrictions.length === 0) {
            ctx.addIssue({ code: "custom", path: ["restrictions"], message: "Add at least one restriction, or choose full clearance." });
        }
    });

export async function grantClearanceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeClinicalAction("clearance:manage");
    if (!auth.ok) return actionError(auth.message);

    const parsed = grantClearanceSchema.safeParse({
        fighterId: text(formData, "fighterId"),
        level: text(formData, "level"),
        validUntil: text(formData, "validUntil"),
        reason: text(formData, "reason"),
        examinationId: text(formData, "examinationId"),
        restrictions: text(formData, "restrictions"),
        confirmNotCleared: text(formData, "confirmNotCleared"),
    });
    if (!parsed.success) return validationError(parsed.error);
    const input = parsed.data;
    if (!canAccessFighterClinically(auth.user, input.fighterId)) return actionError(NOT_ASSIGNED, { fighterId: "Choose one of your assigned fighters." });

    if (input.level === "not_cleared" && input.confirmNotCleared !== "yes") {
        return actionError("Confirm that this fighter must stop training before setting them as not cleared.");
    }

    let validUntil: string | null = null;
    if (input.level !== "not_cleared") {
        const days = daysBetween(new Date(), `${input.validUntil}T12:00:00Z`);
        if (days < 0) return actionError(FIX_FIELDS, { validUntil: "The validity date can't be in the past." });
        if (days > MAX_CLEARANCE_DAYS) {
            return actionError(FIX_FIELDS, { validUntil: "Issue clearances for 12 months at most, then re-examine." });
        }
        validUntil = academyWallClockToIso(input.validUntil, "23:59");
    }

    const result = await grantClearance(
        {
            fighterId: input.fighterId,
            level: input.level,
            validUntil,
            reason: input.reason,
            restrictions: input.level === "restricted" ? input.restrictions : [],
            examinationId: input.examinationId || null,
        },
        auth.user,
    );
    if (!result.ok) return actionError(result.error);

    revalidateDoctorArea();
    redirect(`${routes.doctor.fighter(input.fighterId)}?notice=clearance-${input.level}`);
}

const revokeSchema = z.object({
    clearanceId: z.string().min(1, "The clearance is missing. Reload the page and try again."),
    fighterId: z.string(),
    reason: z
        .string()
        .trim()
        .min(10, "Explain why the clearance is being revoked in a sentence or two.")
        .max(1000, "Keep the reason under 1,000 characters."),
});

export async function revokeClearanceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeClinicalAction("clearance:manage");
    if (!auth.ok) return actionError(auth.message);

    const parsed = revokeSchema.safeParse({ clearanceId: text(formData, "clearanceId"), fighterId: text(formData, "fighterId"), reason: text(formData, "reason") });
    if (!parsed.success) return validationError(parsed.error);

    // Look in the one fighter's clearances when the page says whose it is: in API mode every fighter read is audited.
    const scope = parsed.data.fighterId ? [parsed.data.fighterId] : accessibleFighterIds(auth.user);
    const clearance = (await listClearances({ fighterIds: scope })).find((c) => c.id === parsed.data.clearanceId);
    if (!clearance || !canAccessFighterClinically(auth.user, clearance.fighterId)) {
        return actionError("This clearance isn't available. It may belong to a fighter you aren't assigned to.");
    }

    try {
        const result = await revokeClearance(clearance.id, parsed.data.reason, auth.user);
        if (!result.ok) return actionError(result.error);
    } catch (error) {
        const failure = medicalWriteFailure(error, { fields: { revokedReason: "reason" } });
        return actionError(failure.message, failure.fieldErrors);
    }

    revalidateDoctorArea();
    return actionSuccess("Medical Clearance revoked. The fighter is now not cleared and their coaches have been notified.");
}

/* ─── Health status ───────────────────────────────────────────────────────── */

const healthStatusSchema = z.object({
    fighterId: z.string().min(1, "The fighter is missing. Reload the page and try again."),
    status: z.enum(keysOf(HEALTH_STATUS_LABELS), { error: "Choose a health status." }),
});

export async function updateHealthStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeClinicalAction("medical:write");
    if (!auth.ok) return actionError(auth.message);
    if (!medicalFeatureAvailable("healthStatusOverride")) return actionError(FEATURE_UNAVAILABLE_MESSAGE);

    const parsed = healthStatusSchema.safeParse({ fighterId: text(formData, "fighterId"), status: text(formData, "status") });
    if (!parsed.success) return validationError(parsed.error);
    if (!canAccessFighterClinically(auth.user, parsed.data.fighterId)) return actionError(NOT_ASSIGNED);

    const result = await updateHealthStatus(parsed.data.fighterId, parsed.data.status, auth.user);
    if (!result.ok) return actionError(result.error);

    revalidateDoctorArea();
    return actionSuccess(`Health status set to ${HEALTH_STATUS_LABELS[result.data.healthStatus]}.`);
}
