import type { Fighter } from "@/lib/domain/types";

/** The fighter fields a figure is built from; a plain object so a Server Component can pass it to the portrait. */
export type FigureSource = Pick<Fighter, "sex" | "heightCm" | "weightKg" | "bodyFatPct" | "stance" | "healthStatus">;

/**
 * How one fighter's figure differs from the base mannequin. Every value comes from the fighter's record;
 * a missing field falls back to an average build for that sex, never to a guess about the person.
 */
export interface FigureParams {
    sex: "male" | "female";
    /** Standing height in metres. */
    height: number;
    /** Limb and torso thickness, 1 = average (from BMI). */
    bulk: number;
    /** Extra waist width from body fat, 0 = lean. */
    softness: number;
    /** Which hand leads in the guard: orthodox leads with the left. */
    lead: "left" | "right";
}

const DEFAULT_HEIGHT_CM = { male: 175, female: 165 } as const;
const DEFAULT_BMI = { male: 23.5, female: 22 } as const;
const LEAN_BODY_FAT = { male: 10, female: 18 } as const;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function figureParams(source: FigureSource): FigureParams {
    const sex = source.sex ?? "male";
    const heightCm = source.heightCm && source.heightCm > 120 && source.heightCm < 230 ? source.heightCm : DEFAULT_HEIGHT_CM[sex];
    const height = heightCm / 100;
    const bmi = source.weightKg && source.weightKg > 30 ? source.weightKg / (height * height) : DEFAULT_BMI[sex];
    const fat = source.bodyFatPct ?? LEAN_BODY_FAT[sex];
    return {
        sex,
        height: Math.round(height * 1000) / 1000,
        bulk: Math.round(clamp(0.86 + (bmi - 20) * 0.035, 0.84, 1.28) * 1000) / 1000,
        softness: Math.round(clamp((fat - LEAN_BODY_FAT[sex]) * 0.006, 0, 0.12) * 1000) / 1000,
        lead: source.stance === "southpaw" ? "right" : "left",
    };
}

/** Picks the figure fields from a fighter record, so a server page passes only these to the client. */
export function toFigureSource(fighter: FigureSource): FigureSource {
    const { sex, heightCm, weightKg, bodyFatPct, stance, healthStatus } = fighter;
    return { sex, heightCm, weightKg, bodyFatPct, stance, healthStatus };
}
