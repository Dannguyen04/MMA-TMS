import { formatNumber } from "@/lib/format";
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

export interface VitalAssessment {
    status: "normal" | "check";
    /** The reference the value was judged against, e.g. "Athlete range 38–75 bpm". */
    reference: string;
    /** What to do when the value needs a check. */
    advice?: string;
}

type Range = { readonly min: number; readonly max: number };

const within = (value: number, range: Range) => value >= range.min && value <= range.max;

function inRange(value: number, range: Range, reference: string): VitalAssessment {
    return { status: within(value, range) ? "normal" : "check", reference };
}

const { restingHeartRate, bloodPressureSystolic, bloodPressureDiastolic, temperatureC, spo2Pct } = VITAL_REFERENCE_RANGES;

const ASSESSORS: { [K in VitalKey]: (value: VitalValues[K], ctx: VitalContext) => VitalAssessment | null } = {
    weightKg: (weight, { weightLimitKg }) => {
        if (!weightLimitKg || weightLimitKg <= 0) return null;
        const limit = formatNumber(weightLimitKg, 1);
        const abovePct = ((weight - weightLimitKg) / weightLimitKg) * 100;
        if (abovePct <= 0) return { status: "normal", reference: `Within the ${limit} kg class limit` };
        return {
            status: abovePct > WEIGHT_REVIEW_PCT ? "check" : "normal",
            reference: `${formatNumber(weight - weightLimitKg, 1)} kg (${formatNumber(abovePct, 1)}%) above the ${limit} kg limit`,
        };
    },
    restingHeartRate: (value) => inRange(value, restingHeartRate, `Athlete range ${restingHeartRate.min}–${restingHeartRate.max} bpm`),
    bloodPressure: ({ systolic, diastolic }) => ({
        status: within(systolic, bloodPressureSystolic) && within(diastolic, bloodPressureDiastolic) ? "normal" : "check",
        reference: `Target ${bloodPressureSystolic.min}–${bloodPressureSystolic.max} / ${bloodPressureDiastolic.min}–${bloodPressureDiastolic.max} mmHg`,
    }),
    temperatureC: (value) => inRange(value, temperatureC, `Normal ${formatNumber(temperatureC.min, 1)}–${formatNumber(temperatureC.max, 1)} °C`),
    spo2Pct: (value) => inRange(value, spo2Pct, `Normal ${spo2Pct.min}% or higher`),
    hydration: (value) =>
        value === "good"
            ? { status: "normal", reference: "Well hydrated" }
            : { status: "check", reference: "Well hydrated", advice: "Increase fluids and recheck before hard sessions" },
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
