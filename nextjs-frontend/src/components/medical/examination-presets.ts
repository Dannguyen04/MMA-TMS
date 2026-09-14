import type { ExaminationType, Vitals } from "@/lib/domain/types";
import { assessVital, type VitalAssessment, type VitalKey } from "@/lib/domain/vitals";

/** Assessment areas pre-filled for each examination type. Doctors can rename, remove or add rows. */
export const ASSESSMENT_PRESETS: Record<ExaminationType, string[]> = {
    baseline: ["Cardiovascular", "Respiratory", "Neurological screen", "SCAT6 baseline", "Vision", "Musculoskeletal screen"],
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

export type VitalCheck = { status: "normal" | "check"; text: string } | null;

/** A typed number, or null while the field is empty or not a number yet. */
const parse = (value: string): number | null => {
    if (value.trim() === "") return null;
    const number = Number(value);
    return Number.isNaN(number) ? null : number;
};

const toCheck = (assessment: VitalAssessment | null): VitalCheck =>
    assessment && { status: assessment.status, text: assessment.advice ?? assessment.reference };

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
