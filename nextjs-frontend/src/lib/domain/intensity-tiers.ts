import { formatShortDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator, type MessageKey } from "@/lib/i18n/translate";
import { SESSION_TYPES, type SessionType } from "./medical-contract";
import { addDaysToDate } from "./suspension-rules";
import type { GradedReturn, TrainingType } from "./types";

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
        case "technical_drilling":
            return 3;
        case "grappling":
            return 4;
        case "sparring":
            return 5;
    }
}

/* ─── Pure functions for IntensityLadder ──────────────────────────────────── */

export type LadderSegmentStatus = "allowed" | "blocked" | "blocked_ceiling";

export interface LadderSegmentInfo {
    tier: SessionIntensityTier;
    status: LadderSegmentStatus;
    name: string;
    label: string;
    statusLabel: string;
    screenReaderLabel: string;
    trainingType: TrainingType;
}

export const TIER_REPRESENTATIVE_TYPES: Record<SessionIntensityTier, TrainingType> = {
    1: "recovery_mobility",
    2: "strength_conditioning",
    3: "shadow_boxing",
    4: "grappling",
    5: "sparring",
};

export function getTierName(tier: SessionIntensityTier, locale: Locale = "vi"): string {
    const t = createTranslator(locale);
    return t(`intensityTier.${tier}.name` as MessageKey);
}

export function computeLadderSegments(
    maxAllowedTier: number,
    ceiling?: 3 | 4,
    locale: Locale = "vi",
): LadderSegmentInfo[] {
    const t = createTranslator(locale);
    return ([1, 2, 3, 4, 5] as const).map((tier) => {
        let status: LadderSegmentStatus;
        if (tier > maxAllowedTier) {
            status = "blocked";
        } else if (ceiling !== undefined && tier > ceiling) {
            status = "blocked_ceiling";
        } else {
            status = "allowed";
        }

        const name = t(`intensityTier.${tier}.name` as MessageKey);
        const label = t(`intensityTier.${tier}.label` as MessageKey);
        let statusLabel: string;
        if (status === "allowed") {
            statusLabel = t("intensityLadder.allowed");
        } else if (status === "blocked_ceiling") {
            statusLabel = t("intensityLadder.blockedToday");
        } else {
            statusLabel = t("intensityLadder.blocked");
        }

        const srName = locale === "vi" ? name.charAt(0).toLowerCase() + name.slice(1) : name;
        const screenReaderLabel = t("intensityLadder.segmentSr", {
            tier,
            label,
            name: srName,
            status: statusLabel,
        });

        return {
            tier,
            status,
            name,
            label,
            statusLabel,
            screenReaderLabel,
            trainingType: TIER_REPRESENTATIVE_TYPES[tier],
        };
    });
}

export function handleLadderKeyDown(
    key: string,
    currentValue: number,
    onChange?: (tier: SessionIntensityTier) => void,
): boolean {
    let nextTier: SessionIntensityTier | undefined;
    if (key === "ArrowRight" || key === "ArrowUp") {
        nextTier = Math.min(5, Math.max(1, currentValue + 1)) as SessionIntensityTier;
    } else if (key === "ArrowLeft" || key === "ArrowDown") {
        nextTier = Math.max(1, Math.min(5, currentValue - 1)) as SessionIntensityTier;
    } else if (key === "Home") {
        nextTier = 1;
    } else if (key === "End") {
        nextTier = 5;
    }
    if (nextTier !== undefined) {
        if (nextTier !== currentValue) {
            onChange?.(nextTier);
        }
        return true;
    }
    return false;
}

/* ─── Pure functions for GradedReturnSteps ────────────────────────────────── */

export type GradedStepStatus = "passed" | "current" | "upcoming";

export interface GradedStepItem {
    id: 3 | 4 | "full";
    stepNumber: 1 | 2 | 3;
    label: string;
    date: string;
    dateFormatted: string;
    status: GradedStepStatus;
    statusText: string;
}

const GRADED_STEP_LABELS = { 3: "gradedReturn.step.tier3", 4: "gradedReturn.step.tier4", full: "gradedReturn.step.full" } as const;

export function computeGradedReturnSteps(
    gradedReturn: GradedReturn,
    locale: Locale = "vi",
): GradedStepItem[] {
    const t = createTranslator(locale);
    return ([3, 4, "full"] as const).map((id, index) => {
        const date = addDaysToDate(gradedReturn.fullReturnOn, index - 2);
        // The current step is the ceiling's; the steps before it are passed, the full return is always ahead.
        const status: GradedStepStatus = id === gradedReturn.ceiling ? "current" : id === "full" || id > gradedReturn.ceiling ? "upcoming" : "passed";
        return {
            id,
            stepNumber: (index + 1) as 1 | 2 | 3,
            label: t(GRADED_STEP_LABELS[id]),
            date,
            dateFormatted: formatShortDate(date, locale),
            status,
            statusText: t(`gradedReturn.status.${status}`),
        };
    });
}
