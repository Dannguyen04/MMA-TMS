import type { AssessmentResult, ExaminationType, Vitals } from "@/lib/domain/types";
import { assessVital, vitalAssessmentMessage, type VitalAssessment, type VitalKey } from "@/lib/domain/vitals";
import { createTranslator } from "@/lib/i18n/translate";

/**
 * Assessment areas pre-filled for each examination type, with no result: the doctor marks each one. Doctors can rename,
 * remove or add rows. A baseline's SCAT6 has its own steps, so it isn't an area here.
 */
export const ASSESSMENT_PRESETS: Record<ExaminationType, string[]> = {
    baseline: ["Cardiovascular", "Respiratory", "Neurological screen", "Vision", "Musculoskeletal screen"],
    routine: ["Cardiovascular", "Respiratory", "Active ROM", "Strength", "Special tests", "Weight & hydration"],
    pre_fight: ["Cardiovascular", "Neurological screen", "Ophthalmic screen", "Musculoskeletal screen", "Weight check", "Infectious disease screen"],
    post_injury: ["Inspection", "Palpation", "Active ROM", "Strength", "Special tests", "Neurovascular status"],
    concussion_screen: ["Red flag screen", "Symptom evaluation", "Cognitive screening (SAC)", "Balance (mBESS)", "Cervical spine"],
    return_to_play: ["Symptom review", "Active ROM", "Strength", "Functional testing", "Sport-specific drills", "Exertional tolerance"],
};

export const EXAMINATION_TYPE_HINTS: Record<ExaminationType, string> = {
    baseline: "First full physical. Sets the reference values later examinations are compared with.",
    routine: "Periodic check, or a focused assessment when no injury has been recorded.",
    pre_fight: "Required before competition and usually renews the Medical Clearance.",
    post_injury: "Assessment of a new or suspected injury.",
    concussion_screen: "SCAT-based screening after a head impact: symptoms, cognition and balance.",
    return_to_play: "Checks readiness to progress training after an injury or illness.",
};

/** A row of the assessments list as the form keeps it: the result stays empty until the doctor marks it. */
export interface AssessmentRowDraft {
    area: string;
    result: AssessmentResult | "";
    note: string;
}

/** Named rows the doctor hasn't marked yet. Rows without an area name are left for the doctor to name first. */
export function unmarkedAreas<T extends AssessmentRowDraft>(rows: readonly T[]): T[] {
    return rows.filter((row) => row.result === "" && row.area.trim() !== "");
}

/**
 * "Mark the unmarked areas Normal": an explicit doctor action that sets only named rows with no result yet. A row
 * already marked (normal, abnormal or inconclusive) is never changed. Returns the rows and the areas it filled.
 */
export function markUnmarkedNormal<T extends AssessmentRowDraft>(rows: readonly T[]): { rows: T[]; filled: string[] } {
    const filled: string[] = [];
    const next = rows.map((row) => {
        if (row.result !== "" || row.area.trim() === "") return row;
        filled.push(row.area.trim());
        return { ...row, result: "normal" as const };
    });
    return { rows: next, filled };
}

/** What stops the doctor leaving the assessments, in one sentence, or null. Mirrors the action's rules for the rows. */
export function assessmentRowsProblem(rows: readonly AssessmentRowDraft[], { baseline }: { baseline: boolean }): string | null {
    if (baseline && rows.length === 0) return "A baseline needs at least one assessed area. Add one.";
    const unnamed = rows.filter((row) => row.area.trim() === "").length;
    const unmarked = rows.filter((row) => row.area.trim() !== "" && row.result === "").length;
    const undescribed = rows.filter((row) => row.result === "abnormal" && row.note.trim() === "").length;
    const parts = [
        unmarked > 0 ? `mark a result for ${unmarked === 1 ? "1 area" : `${unmarked} areas`}` : null,
        unnamed > 0 ? `name ${unnamed === 1 ? "1 row" : `${unnamed} rows`} or remove ${unnamed === 1 ? "it" : "them"}` : null,
        undescribed > 0 ? `describe ${undescribed === 1 ? "the abnormal finding" : `${undescribed} abnormal findings`}` : null,
    ].filter(Boolean);
    if (parts.length === 0) return null;
    const sentence = parts.join(", ");
    return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
}

export type VitalCheck = { status: "normal" | "check"; text: string } | null;

/** A typed number, or null while the field is empty or not a number yet. */
const parse = (value: string): number | null => {
    if (value.trim() === "") return null;
    const number = Number(value);
    return Number.isNaN(number) ? null : number;
};

const toCheck = (assessment: VitalAssessment | null): VitalCheck =>
    assessment && { status: assessment.status, text: vitalAssessmentMessage(createTranslator("en"), assessment) };

const HYDRATION_LEVELS: Vitals["hydration"][] = ["good", "fair", "poor"];

/**
 * Live reference-range hints while vitals are typed. Judged by `lib/domain/vitals`, like the
 * VitalsGrid on examination pages, so the form and the saved record agree.
 */
export function checkVitals(
    values: Record<keyof Omit<Vitals, "hydration">, string> & { hydration: string },
    weightLimitKg: number | null,
): Record<VitalKey, VitalCheck> {
    const weight = parse(values.weightKg);
    const heartRate = parse(values.restingHeartRate);
    const systolic = parse(values.bloodPressureSystolic);
    const diastolic = parse(values.bloodPressureDiastolic);
    const temperature = parse(values.temperatureC);
    const spo2 = parse(values.spo2Pct);
    const hydration = HYDRATION_LEVELS.find((level) => level === values.hydration);

    return {
        weightKg: weight === null ? null : (toCheck(assessVital("weightKg", weight, { weightLimitKg })) ?? { status: "normal", text: "No weight-class reference" }),
        restingHeartRate: heartRate === null ? null : toCheck(assessVital("restingHeartRate", heartRate)),
        bloodPressure: systolic === null || diastolic === null ? null : toCheck(assessVital("bloodPressure", { systolic, diastolic })),
        temperatureC: temperature === null ? null : toCheck(assessVital("temperatureC", temperature)),
        spo2Pct: spo2 === null ? null : toCheck(assessVital("spo2Pct", spo2)),
        hydration: hydration ? toCheck(assessVital("hydration", hydration)) : null,
    };
}
