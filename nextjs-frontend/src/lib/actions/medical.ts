"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { accessibleFighterIds, canAccessFighterClinically } from "@/lib/auth/access";
import { authorizeClinicalAction } from "@/lib/auth/session";
import {
    ASSESSMENT_RESULT_LABELS,
    BODY_REGION_LABELS,
    CLEARANCE_LEVEL_LABELS,
    EXAMINATION_OUTCOME_LABELS,
    EXAMINATION_TYPE_LABELS,
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
import { actionError, actionSuccess, validationError, type ActionState } from "./state";

/* ─── Parsing helpers (not exported: a "use server" module may only export actions) ─── */

const NOT_ASSIGNED = "You aren't assigned to this fighter, so you can't change their medical information.";
const MAX_CLEARANCE_DAYS = 365;

function keysOf<T extends string>(record: Record<T, string>): [T, ...T[]] {
    return Object.keys(record) as [T, ...T[]];
}

function text(formData: FormData, name: string): string {
    const value = formData.get(name);
    return typeof value === "string" ? value : "";
}

/** A JSON-encoded array posted from a client-side builder. */
function jsonArray<T extends z.ZodType>(item: T, label: string, minItems = 0, minMessage = "") {
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
        .pipe(z.array(item).min(minItems, minMessage));
}

/** A required numeric measurement within a plausible clinical range. */
function measurement(label: string, min: number, max: number, unit: string, integer = false) {
    const range = `${label} must be between ${min} and ${max}${unit ? ` ${unit}` : ""}.`;
    let schema = z.number({ error: `Enter the ${label.toLowerCase()} as a number.` }).min(min, range).max(max, range);
    if (integer) schema = schema.int(`Enter the ${label.toLowerCase()} as a whole number.`);
    return z
        .string()
        .trim()
        .min(1, `Enter the ${label.toLowerCase()}.`)
        .transform((value) => Number(value))
        .pipe(schema);
}

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

const assessmentSchema = z
    .object({
        area: z.string().trim().min(1, "Name the area assessed.").max(120, "Keep the area under 120 characters."),
        result: z.enum(keysOf(ASSESSMENT_RESULT_LABELS), { error: "Choose a result." }),
        note: z.string().trim().max(500, "Keep the note under 500 characters."),
    })
    .superRefine((assessment, ctx) => {
        if (assessment.result === "abnormal" && !assessment.note) {
            ctx.addIssue({ code: "custom", path: ["note"], message: "Describe the abnormal finding." });
        }
    });

const examinationSchema = z
    .object({
        fighterId: z.string().min(1, "Choose the fighter you examined."),
        type: z.enum(keysOf(EXAMINATION_TYPE_LABELS), { error: "Choose the examination type." }),
        date: z.string().refine(isDateTimeInputValue, "Enter the date and time of the examination."),
        weightKg: measurement("Weight", 35, 180, "kg"),
        restingHeartRate: measurement("Resting heart rate", 25, 150, "bpm", true),
        bloodPressureSystolic: measurement("Systolic pressure", 70, 220, "mmHg", true),
        bloodPressureDiastolic: measurement("Diastolic pressure", 40, 140, "mmHg", true),
        temperatureC: measurement("Temperature", 33, 42, "°C"),
        spo2Pct: measurement("SpO₂", 70, 100, "%", true),
        hydration: z.enum(["good", "fair", "poor"], { error: "Choose the hydration status." }),
        assessments: jsonArray(assessmentSchema, "assessments", 1, "Add at least one assessment."),
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
        if (exam.bloodPressureDiastolic >= exam.bloodPressureSystolic) {
            ctx.addIssue({ code: "custom", path: ["bloodPressureDiastolic"], message: "Diastolic pressure must be lower than systolic." });
        }
        if (exam.followUpDate && exam.followUpDate <= exam.date.slice(0, 10)) {
            ctx.addIssue({ code: "custom", path: ["followUpDate"], message: "Schedule the follow-up after the examination date." });
        }
    });

export async function createExaminationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeClinicalAction("medical:write");
    if (!auth.ok) return actionError(auth.message);

    const parsed = examinationSchema.safeParse({
        fighterId: text(formData, "fighterId"),
        type: text(formData, "type"),
        date: text(formData, "date"),
        weightKg: text(formData, "weightKg"),
        restingHeartRate: text(formData, "restingHeartRate"),
        bloodPressureSystolic: text(formData, "bloodPressureSystolic"),
        bloodPressureDiastolic: text(formData, "bloodPressureDiastolic"),
        temperatureC: text(formData, "temperatureC"),
        spo2Pct: text(formData, "spo2Pct"),
        hydration: text(formData, "hydration"),
        assessments: text(formData, "assessments"),
        outcome: text(formData, "outcome"),
        summary: text(formData, "summary"),
        recommendations: text(formData, "recommendations"),
        followUpDate: text(formData, "followUpDate"),
    });
    if (!parsed.success) return validationError(parsed.error);
    const input = parsed.data;
    if (!canAccessFighterClinically(auth.user, input.fighterId)) return actionError(NOT_ASSIGNED, { fighterId: "Choose one of your assigned fighters." });

    const [day, time] = input.date.split("T");
    const examinedAt = academyWallClockToIso(day, time);
    if (Date.parse(examinedAt) > Date.now() + 5 * 60_000) {
        return actionError("Please fix the highlighted fields.", { date: "The examination time can't be in the future." });
    }

    const result = await createExamination(
        {
            fighterId: input.fighterId,
            date: examinedAt,
            type: input.type,
            vitals: {
                weightKg: Math.round(input.weightKg * 10) / 10,
                restingHeartRate: input.restingHeartRate,
                bloodPressureSystolic: input.bloodPressureSystolic,
                bloodPressureDiastolic: input.bloodPressureDiastolic,
                temperatureC: Math.round(input.temperatureC * 10) / 10,
                spo2Pct: input.spo2Pct,
                hydration: input.hydration,
            },
            assessments: input.assessments,
            outcome: input.outcome,
            summary: input.summary,
            recommendations: input.recommendations,
            followUpDate: input.followUpDate ? academyWallClockToIso(input.followUpDate, "10:00") : null,
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
        if (days < 0) return actionError("Please fix the highlighted fields.", { validUntil: "The validity date can't be in the past." });
        if (days > MAX_CLEARANCE_DAYS) {
            return actionError("Please fix the highlighted fields.", { validUntil: "Issue clearances for 12 months at most, then re-examine." });
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
    reason: z
        .string()
        .trim()
        .min(10, "Explain why the clearance is being revoked in a sentence or two.")
        .max(1000, "Keep the reason under 1,000 characters."),
});

export async function revokeClearanceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeClinicalAction("clearance:manage");
    if (!auth.ok) return actionError(auth.message);

    const parsed = revokeSchema.safeParse({ clearanceId: text(formData, "clearanceId"), reason: text(formData, "reason") });
    if (!parsed.success) return validationError(parsed.error);

    const scoped = await listClearances({ fighterIds: accessibleFighterIds(auth.user) });
    const clearance = scoped.find((c) => c.id === parsed.data.clearanceId);
    if (!clearance || !canAccessFighterClinically(auth.user, clearance.fighterId)) {
        return actionError("This clearance isn't available. It may belong to a fighter you aren't assigned to.");
    }

    const result = await revokeClearance(clearance.id, parsed.data.reason, auth.user);
    if (!result.ok) return actionError(result.error);

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

    const parsed = healthStatusSchema.safeParse({ fighterId: text(formData, "fighterId"), status: text(formData, "status") });
    if (!parsed.success) return validationError(parsed.error);
    if (!canAccessFighterClinically(auth.user, parsed.data.fighterId)) return actionError(NOT_ASSIGNED);

    const result = await updateHealthStatus(parsed.data.fighterId, parsed.data.status, auth.user);
    if (!result.ok) return actionError(result.error);

    revalidateDoctorArea();
    return actionSuccess(`Health status set to ${HEALTH_STATUS_LABELS[result.data.healthStatus]}.`);
}
