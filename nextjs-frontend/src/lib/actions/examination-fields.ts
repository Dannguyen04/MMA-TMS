import { z } from "zod";

import { EXAMINATION_DETAIL_LIMITS } from "@/lib/domain/medical-contract";
import { ASSESSMENT_RESULT_LABELS, EXAMINATION_TYPE_LABELS } from "@/lib/domain/labels";
import { scat6InputSchema } from "@/lib/domain/scat6";
import type { Vitals } from "@/lib/domain/types";
import { isDateTimeInputValue } from "@/lib/format";
import { jsonField, keysOf, text } from "./form-helpers";

/** What a doctor records at the visit, validated the same way by the demo examination action and the medical service's. */

export const EXAMINATION_TYPES = keysOf(EXAMINATION_TYPE_LABELS);

/** A required numeric measurement within a plausible clinical range. */
export function measurement(label: string, min: number, max: number, unit: string, integer = false) {
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

/** The seven readings, as top-level form fields. */
export const VITAL_FIELDS = {
    weightKg: measurement("Weight", 35, 180, "kg"),
    restingHeartRate: measurement("Resting heart rate", 25, 150, "bpm", true),
    bloodPressureSystolic: measurement("Systolic pressure", 70, 220, "mmHg", true),
    bloodPressureDiastolic: measurement("Diastolic pressure", 40, 140, "mmHg", true),
    temperatureC: measurement("Temperature", 33, 42, "°C"),
    spo2Pct: measurement("SpO₂", 70, 100, "%", true),
    hydration: z.enum(["good", "fair", "poor"], { error: "Choose the hydration status." }),
};

type VitalFieldValues = { [K in keyof typeof VITAL_FIELDS]: z.output<(typeof VITAL_FIELDS)[K]> };

export function readVitals(formData: FormData): Record<keyof typeof VITAL_FIELDS, string> {
    return {
        weightKg: text(formData, "weightKg"),
        restingHeartRate: text(formData, "restingHeartRate"),
        bloodPressureSystolic: text(formData, "bloodPressureSystolic"),
        bloodPressureDiastolic: text(formData, "bloodPressureDiastolic"),
        temperatureC: text(formData, "temperatureC"),
        spo2Pct: text(formData, "spo2Pct"),
        hydration: text(formData, "hydration"),
    };
}

/** The diastolic reading sits below the systolic one. */
export function checkBloodPressure(vitals: Pick<VitalFieldValues, "bloodPressureSystolic" | "bloodPressureDiastolic">, ctx: z.RefinementCtx) {
    if (vitals.bloodPressureDiastolic >= vitals.bloodPressureSystolic) {
        ctx.addIssue({ code: "custom", path: ["bloodPressureDiastolic"], message: "Diastolic pressure must be lower than systolic." });
    }
}

/** The readings as stored, weight and temperature to one decimal. */
export function toVitals(input: VitalFieldValues): Vitals {
    return {
        weightKg: Math.round(input.weightKg * 10) / 10,
        restingHeartRate: input.restingHeartRate,
        bloodPressureSystolic: input.bloodPressureSystolic,
        bloodPressureDiastolic: input.bloodPressureDiastolic,
        temperatureC: Math.round(input.temperatureC * 10) / 10,
        spo2Pct: input.spo2Pct,
        hydration: input.hydration,
    };
}

export const assessmentSchema = z
    .object({
        area: z
            .string()
            .trim()
            .min(1, "Name the area assessed.")
            .max(EXAMINATION_DETAIL_LIMITS.area, `Keep the area under ${EXAMINATION_DETAIL_LIMITS.area} characters.`),
        result: z.enum(keysOf(ASSESSMENT_RESULT_LABELS), { error: "Choose a result." }),
        note: z
            .string()
            .trim()
            .max(EXAMINATION_DETAIL_LIMITS.note, `Keep the note under ${EXAMINATION_DETAIL_LIMITS.note.toLocaleString("en")} characters.`),
    })
    .superRefine((assessment, ctx) => {
        if (assessment.result === "abnormal" && !assessment.note) {
            ctx.addIssue({ code: "custom", path: ["note"], message: "Describe the abnormal finding." });
        }
    });

/** A follow-up is booked for a day after the examination. */
export function checkFollowUpDate(followUpDate: string, examinedAt: string, ctx: z.RefinementCtx) {
    if (followUpDate && isDateTimeInputValue(examinedAt) && followUpDate <= examinedAt.slice(0, 10)) {
        ctx.addIssue({ code: "custom", path: ["followUpDate"], message: "Schedule the follow-up after the examination day." });
    }
}

/** A baseline's SCAT6, posted as one serialized field by the SCAT6 form. */
export const scat6Field = jsonField(scat6InputSchema, "SCAT6");

type ParseResult = { success: boolean; error?: z.ZodError } | undefined;

/** Issues from one of several independent parses, placed under `prefix`, to report them as one validation error. */
export function issuesOf(result: ParseResult, prefix: string[] = []): z.core.$ZodIssue[] {
    return result?.success === false && result.error ? result.error.issues.map((issue) => ({ ...issue, path: [...prefix, ...issue.path] })) : [];
}

/** The SCAT6's issues under `scat6`. The alternate row's numbers share one text field, so a bad number is reported there. */
export function scat6Issues(result: ParseResult): z.core.$ZodIssue[] {
    return issuesOf(result, ["scat6"]).map((issue) => {
        const list = issue.path.lastIndexOf("responses");
        return list > 0 && typeof issue.path[list + 1] === "number" ? { ...issue, path: issue.path.slice(0, list + 1) } : issue;
    });
}
