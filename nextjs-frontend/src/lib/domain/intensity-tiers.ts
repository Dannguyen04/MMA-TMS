import { SESSION_TYPES, type SessionType } from "./medical-contract";
import type { TrainingType } from "./types";

export type SessionIntensityTier = 1 | 2 | 3 | 4 | 5;

/**
 * Intensity tier for each backend session type (T-045, Decision 25).
 * Mirrors `SESSION_INTENSITY_TIERS` in `nestjs-api/src/suspensions/suspensions.constants.ts`.
 */
export const SESSION_INTENSITY_TIERS: Record<SessionType, SessionIntensityTier> = {
    RECOVERY: 1,
    PHYSICAL_THERAPY: 1,
    STRENGTH_CONDITIONING: 2,
    SHADOW_BOXING: 3,
    HEAVY_BAG: 3,
    PAD_WORK: 3,
    GRAPPLING: 4,
    SPARRING: 5,
};

/**
 * Default blocked session types for manual suspensions: the 6 non-recovery/PT types (Decision 22).
 */
export const DEFAULT_MANUAL_BLOCKED_SESSION_TYPES: readonly SessionType[] = SESSION_TYPES.filter(
    (type) => type !== "RECOVERY" && type !== "PHYSICAL_THERAPY",
);

/**
 * Returns all session types whose intensity tier is strictly greater than `maxTier`,
 * preserving `SESSION_TYPES` order.
 */
export function blockedTypesForMaxTier(maxTier: number): SessionType[] {
    return SESSION_TYPES.filter((type) => SESSION_INTENSITY_TIERS[type] > maxTier);
}

/**
 * Highest intensity tier `t` (1..5) such that every session type at tier `<= t`
 * is NOT in `blockedSessionTypes` (returns 0 if any tier-1 session type is blocked).
 */
export function maxAllowedTier(blockedSessionTypes: readonly SessionType[]): 0 | SessionIntensityTier {
    const blocked = new Set<SessionType>(blockedSessionTypes);
    let highest: 0 | SessionIntensityTier = 0;
    for (const tier of [1, 2, 3, 4, 5] as const) {
        const typesInTier = SESSION_TYPES.filter((type) => SESSION_INTENSITY_TIERS[type] === tier);
        if (typesInTier.some((type) => blocked.has(type))) {
            break;
        }
        highest = tier;
    }
    return highest;
}

/**
 * Returns the intensity tier for a frontend `TrainingType`.
 * - `recovery_mobility` = 1
 * - `technical_drilling`: không có mã backend tương đương, là bài tập kỹ thuật không va chạm nên thuộc bậc 3
 * - `sparring` = 5
 */
export function tierOfTrainingType(type: TrainingType): SessionIntensityTier {
    switch (type) {
        case "recovery_mobility":
            return 1;
        case "strength_conditioning":
            return 2;
        case "shadow_boxing":
        case "heavy_bag":
        case "pad_work":
            return 3;
        case "technical_drilling":
            // technical_drilling: không có mã backend tương đương, là bài tập kỹ thuật không va chạm nên thuộc bậc 3
            return 3;
        case "grappling":
            return 4;
        case "sparring":
            return 5;
    }
}
