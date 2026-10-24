import { formatNumber } from "@/lib/format";
import type { Translator } from "@/lib/i18n/translate";
import type { Vitals } from "./types";

/** Athlete reference ranges for examination vitals, inclusive. */
export const VITAL_REFERENCE_RANGES = {
    restingHeartRate: { min: 38, max: 75 },
    bloodPressureSystolic: { min: 90, max: 139 },
    bloodPressureDiastolic: { min: 55, max: 89 },
    temperatureC: { min: 36, max: 37.5 },
    spo2Pct: { min: 95, max: 100 },
} as const;

/** Walk-around weight more than this share above the class limit is flagged for review. */
export const WEIGHT_REVIEW_PCT = 10;

export interface VitalValues {
    weightKg: number;
    restingHeartRate: number;
    bloodPressure: { systolic: number; diastolic: number };
    temperatureC: number;
    spo2Pct: number;
    hydration: Vitals["hydration"];
}

export type VitalKey = keyof VitalValues;

export interface VitalContext {
    /** Weight-class limit in kg; without it weight can't be judged. */
    weightLimitKg?: number | null;
}

export type VitalCode =
    | "weight_within_limit"
    | "weight_above_limit"
    | "heart_rate_range"
    | "blood_pressure_target"
    | "temperature_range"
    | "spo2_min"
    | "hydration_good";

export type VitalAdviceCode = "increase_fluids";

export interface VitalAssessment {
    status: "normal" | "check";
    code: VitalCode;
    params?: Record<string, string | number>;
    adviceCode?: VitalAdviceCode;
}

type Range = { readonly min: number; readonly max: number };

const within = (value: number, range: Range) => value >= range.min && value <= range.max;

const { restingHeartRate, bloodPressureSystolic, bloodPressureDiastolic, temperatureC, spo2Pct } = VITAL_REFERENCE_RANGES;

const ASSESSORS: { [K in VitalKey]: (value: VitalValues[K], ctx: VitalContext) => VitalAssessment | null } = {
    weightKg: (weight, { weightLimitKg }) => {
        if (!weightLimitKg || weightLimitKg <= 0) return null;
        const limit = formatNumber(weightLimitKg, 1);
        const abovePct = ((weight - weightLimitKg) / weightLimitKg) * 100;
        if (abovePct <= 0) {
            return {
                status: "normal",
                code: "weight_within_limit",
                params: { limit },
            };
        }
        return {
            status: abovePct > WEIGHT_REVIEW_PCT ? "check" : "normal",
            code: "weight_above_limit",
            params: {
                diffKg: formatNumber(weight - weightLimitKg, 1),
                abovePct: formatNumber(abovePct, 1),
                limit,
            },
        };
    },
    restingHeartRate: (value) => ({
        status: within(value, restingHeartRate) ? "normal" : "check",
        code: "heart_rate_range",
        params: { min: restingHeartRate.min, max: restingHeartRate.max },
    }),
    bloodPressure: ({ systolic, diastolic }) => ({
        status: within(systolic, bloodPressureSystolic) && within(diastolic, bloodPressureDiastolic) ? "normal" : "check",
        code: "blood_pressure_target",
        params: {
            sysMin: bloodPressureSystolic.min,
            sysMax: bloodPressureSystolic.max,
            diaMin: bloodPressureDiastolic.min,
            diaMax: bloodPressureDiastolic.max,
        },
    }),
    temperatureC: (value) => ({
        status: within(value, temperatureC) ? "normal" : "check",
        code: "temperature_range",
        params: { min: formatNumber(temperatureC.min, 1), max: formatNumber(temperatureC.max, 1) },
    }),
    spo2Pct: (value) => ({
        status: within(value, spo2Pct) ? "normal" : "check",
        code: "spo2_min",
        params: { min: spo2Pct.min },
    }),
    hydration: (value) =>
        value === "good"
            ? { status: "normal", code: "hydration_good" }
            : { status: "check", code: "hydration_good", adviceCode: "increase_fluids" },
};

/** Judges one vital against its reference; null when there is nothing to judge it against. */
export function assessVital<K extends VitalKey>(key: K, value: VitalValues[K], ctx: VitalContext = {}): VitalAssessment | null {
    return ASSESSORS[key](value, ctx);
}

/** Every vital of an examination judged against its reference. */
export function assessVitals(vitals: Vitals, weightLimitKg: number | null | undefined): Record<VitalKey, VitalAssessment | null> {
    const ctx = { weightLimitKg };
    return {
        weightKg: assessVital("weightKg", vitals.weightKg, ctx),
        restingHeartRate: assessVital("restingHeartRate", vitals.restingHeartRate),
        bloodPressure: assessVital("bloodPressure", { systolic: vitals.bloodPressureSystolic, diastolic: vitals.bloodPressureDiastolic }),
        temperatureC: assessVital("temperatureC", vitals.temperatureC),
        spo2Pct: assessVital("spo2Pct", vitals.spo2Pct),
        hydration: assessVital("hydration", vitals.hydration),
    };
}

/** The rendered reference or advice string for a judged vital in the viewer's language. */
export function vitalAssessmentMessage(t: Translator, assessment: VitalAssessment): string {
    if (assessment.adviceCode) return t(`vitalAdvice.${assessment.adviceCode}`);
    return t(`vitalReference.${assessment.code}`, assessment.params);
}
