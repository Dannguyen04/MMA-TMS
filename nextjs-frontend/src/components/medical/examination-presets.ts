import { examinationTitle } from "@/lib/domain/labels";
import type { AssessmentResult, ExaminationType, Vitals } from "@/lib/domain/types";
import { assessVital, vitalAssessmentMessage, type VitalAssessment, type VitalKey } from "@/lib/domain/vitals";
import { plural, type MessageKey, type Translator } from "@/lib/i18n/translate";

/**
 * A label from `lib/domain/labels` in the viewer's language: in Vietnamese the wording these screens have always shown
 * (the domain map), in English the shared dictionary key.
 */
export function localLabel(t: Translator, key: MessageKey, vi: string): string {
    return (t.locale ?? "vi") === "en" ? t(key) : vi;
}

/** `examinationTitle` in the viewer's language, keeping the Vietnamese wording of these screens. */
export function localExaminationTitle(t: Translator, examination: Parameters<typeof examinationTitle>[0]): string {
    return (t.locale ?? "vi") === "en" ? examinationTitle(examination, "en") : examinationTitle(examination);
}

/** The locale to hand a shared badge: English only, so Vietnamese badges keep the wording they always had. */
export function badgeLocale(t: Translator): "en" | undefined {
    return t.locale === "en" ? "en" : undefined;
}

/**
 * Assessment areas pre-filled for each examination type, with no result: the doctor marks each one. Doctors can rename,
 * remove or add rows. A baseline's SCAT6 has its own steps, so it isn't an area here.
 */
export const ASSESSMENT_PRESETS: Record<ExaminationType, MessageKey[]> = {
    baseline: ["doctorMedical.area.cardiovascular", "doctorMedical.area.respiratory", "doctorMedical.area.neuroScreen", "doctorMedical.area.vision", "doctorMedical.area.mskScreen"],
    routine: ["doctorMedical.area.cardiovascular", "doctorMedical.area.respiratory", "doctorMedical.area.activeRom", "doctorMedical.area.strength", "doctorMedical.area.specialTests", "doctorMedical.area.weightHydration"],
    pre_fight: ["doctorMedical.area.cardiovascular", "doctorMedical.area.neuroScreen", "doctorMedical.area.eyeScreen", "doctorMedical.area.mskScreen", "doctorMedical.area.weightCheck", "doctorMedical.area.infectiousScreen"],
    post_injury: ["doctorMedical.area.inspection", "doctorMedical.area.palpation", "doctorMedical.area.activeRom", "doctorMedical.area.strength", "doctorMedical.area.specialTests", "doctorMedical.area.neurovascular"],
    concussion_screen: ["doctorMedical.area.redFlags", "doctorMedical.area.symptoms", "doctorMedical.area.sac", "doctorMedical.area.mbess", "doctorMedical.area.cervicalSpine"],
    return_to_play: ["doctorMedical.area.symptomReview", "doctorMedical.area.activeRom", "doctorMedical.area.strength", "doctorMedical.area.functionalTests", "doctorMedical.area.sportDrills", "doctorMedical.area.exertion"],
};

/** The starting assessment areas of an examination type, worded in the viewer's language. */
export function assessmentPresets(t: Translator, type: ExaminationType): string[] {
    return ASSESSMENT_PRESETS[type].map((key) => t(key));
}

export const EXAMINATION_TYPE_HINTS: Record<ExaminationType, MessageKey> = {
    baseline: "doctorMedical.typeHint.baseline",
    routine: "doctorMedical.typeHint.routine",
    pre_fight: "doctorMedical.typeHint.pre_fight",
    post_injury: "doctorMedical.typeHint.post_injury",
    concussion_screen: "doctorMedical.typeHint.concussion_screen",
    return_to_play: "doctorMedical.typeHint.return_to_play",
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
export function assessmentRowsProblem(t: Translator, rows: readonly AssessmentRowDraft[], { baseline }: { baseline: boolean }): string | null {
    if (baseline && rows.length === 0) return t("doctorMedical.rowsProblem.baselineEmpty");
    const unnamed = rows.filter((row) => row.area.trim() === "").length;
    const unmarked = rows.filter((row) => row.area.trim() !== "" && row.result === "").length;
    const undescribed = rows.filter((row) => row.result === "abnormal" && row.note.trim() === "").length;
    const parts = [
        unmarked > 0 ? plural(t, "doctorMedical.rowsProblem.unmarked", unmarked) : null,
        unnamed > 0 ? plural(t, "doctorMedical.rowsProblem.unnamed", unnamed) : null,
        undescribed > 0 ? plural(t, "doctorMedical.rowsProblem.undescribed", undescribed) : null,
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

const toCheck = (t: Translator, assessment: VitalAssessment | null): VitalCheck =>
    assessment && { status: assessment.status, text: vitalAssessmentMessage(t, assessment) };

const HYDRATION_LEVELS: Vitals["hydration"][] = ["good", "fair", "poor"];

/**
 * Live reference-range hints while vitals are typed. Judged by `lib/domain/vitals`, like the
 * VitalsGrid on examination pages, so the form and the saved record agree.
 */
export function checkVitals(
    t: Translator,
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
        weightKg: weight === null ? null : (toCheck(t, assessVital("weightKg", weight, { weightLimitKg })) ?? { status: "normal", text: t("doctorMedical.vitals.noClassReference") }),
        restingHeartRate: heartRate === null ? null : toCheck(t, assessVital("restingHeartRate", heartRate)),
        bloodPressure: systolic === null || diastolic === null ? null : toCheck(t, assessVital("bloodPressure", { systolic, diastolic })),
        temperatureC: temperature === null ? null : toCheck(t, assessVital("temperatureC", temperature)),
        spo2Pct: spo2 === null ? null : toCheck(t, assessVital("spo2Pct", spo2)),
        hydration: hydration ? toCheck(t, assessVital("hydration", hydration)) : null,
    };
}

/**
 * When to see the fighter again, by examination type, as the form's starting follow-up date. The doctor can change or
 * clear it; a pre-fight check has none, since the bout is what comes next.
 */
export const FOLLOW_UP_DEFAULT_DAYS: Record<ExaminationType, number | null> = {
    baseline: 28,
    routine: 28,
    pre_fight: null,
    post_injury: 7,
    concussion_screen: 7,
    return_to_play: 14,
};

/** The type a new examination starts on when no link chose one: a baseline for a fighter never examined, otherwise a routine check. */
export function defaultExaminationType(hasPreviousExamination: boolean): ExaminationType {
    return hasPreviousExamination ? "routine" : "baseline";
}

/** The previous examination's vitals as form text, for the placeholders and the "use previous readings" fill. */
export function vitalsDraftFrom(vitals: Vitals | null | undefined): Record<keyof Vitals, string> | null {
    if (!vitals) return null;
    return {
        weightKg: String(vitals.weightKg),
        restingHeartRate: String(vitals.restingHeartRate),
        bloodPressureSystolic: String(vitals.bloodPressureSystolic),
        bloodPressureDiastolic: String(vitals.bloodPressureDiastolic),
        temperatureC: String(vitals.temperatureC),
        spo2Pct: String(vitals.spo2Pct),
        hydration: vitals.hydration,
    };
}

/** Fills only the blank readings from the previous examination; a reading already typed is never replaced. */
export function fillBlankVitals<T extends Record<string, string>>(current: T, previous: Partial<Record<keyof T, string>>): { next: T; filled: (keyof T)[] } {
    const filled: (keyof T)[] = [];
    const next = { ...current };
    for (const key of Object.keys(current) as (keyof T)[]) {
        const value = previous[key];
        if (current[key].trim() === "" && value) {
            next[key] = value as T[keyof T];
            filled.push(key);
        }
    }
    return { next, filled };
}
