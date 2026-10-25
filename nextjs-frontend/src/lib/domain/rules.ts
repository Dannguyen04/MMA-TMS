import { daysBetween } from "@/lib/format";
import { clamp } from "@/lib/utils";

import type {
    ClearanceLevel,
    Goal,
    HealthStatus,
    MedicalClearance,
    RecoveryPlan,
} from "./types";

/* ─── AI confidence ───────────────────────────────────────────────────────── */

/** Detections below this confidence require human review. Mirrors SystemSettings.aiLowConfidenceThreshold. */
export const LOW_CONFIDENCE_THRESHOLD = 0.6;
export const HIGH_CONFIDENCE_THRESHOLD = 0.8;

export type ConfidenceBand = "high" | "medium" | "low";

export function confidenceBand(confidence: number | null, lowThreshold = LOW_CONFIDENCE_THRESHOLD): ConfidenceBand {
    if (confidence === null || confidence < lowThreshold) return "low";
    if (confidence < HIGH_CONFIDENCE_THRESHOLD) return "medium";
    return "high";
}

export function isLowConfidence(confidence: number | null, lowThreshold = LOW_CONFIDENCE_THRESHOLD): boolean {
    return confidence === null || confidence < lowThreshold;
}

/* ─── Goals ───────────────────────────────────────────────────────────────── */

/** Progress from baseline to target, 0–100. Works for lower-is-better metrics. */
export function goalProgressPct(goal: Pick<Goal, "baseline" | "target" | "current">): number {
    const span = goal.target - goal.baseline;
    if (span === 0) return 100;
    return Math.round(clamp(((goal.current - goal.baseline) / span) * 100, 0, 100));
}

/* ─── Recovery ────────────────────────────────────────────────────────────── */

/**
 * Recovery plan progress, 0–100: each completed phase counts fully and the current
 * phase counts by the share of its milestones that are done. A milestone plan (the medical
 * service's) counts the share of milestones reached.
 */
export function recoveryProgressPct(plan: Pick<RecoveryPlan, "status" | "phases" | "milestones">): number {
    if (plan.status === "completed") return 100;
    if (plan.milestones) return plan.milestones.length === 0 ? 0 : Math.round((plan.milestones.filter((m) => m.isCompleted).length / plan.milestones.length) * 100);
    if (plan.phases.length === 0) return 0;
    const units = plan.phases.reduce((total, phase) => {
        if (phase.status === "completed") return total + 1;
        if (phase.status === "upcoming" || phase.milestones.length === 0) return total;
        return total + phase.milestones.filter((m) => m.done).length / phase.milestones.length;
    }, 0);
    return Math.round(clamp((units / plan.phases.length) * 100, 0, 100));
}

/* ─── Medical Clearance ───────────────────────────────────────────────────── */

export type ClearanceState = ClearanceLevel | "expired" | "none";

/**
 * The clearance currently governing training, if any: the most recently issued record that
 * hasn't been superseded. A revoked record still governs (the fighter is not cleared) until a
 * doctor issues a new clearance.
 */
export function currentClearance(
    clearances: MedicalClearance[],
    fighterId: string,
): MedicalClearance | null {
    const forFighter = clearances
        .filter((c) => c.fighterId === fighterId && c.status !== "superseded")
        .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
    return forFighter[0] ?? null;
}

export function clearanceState(clearance: MedicalClearance | null, now: string | Date = new Date()): ClearanceState {
    if (!clearance) return "none";
    if (clearance.status === "revoked") return "not_cleared";
    if (clearance.status === "expired") return "expired";
    if (clearance.validUntil && daysBetween(now, clearance.validUntil) < 0) return "expired";
    return clearance.level;
}

/** The health status a clearance gives the fighter: recovery while an injury is open, else healthy or monitoring. */
export function healthStatusForClearance(level: ClearanceLevel, hasOpenInjury: boolean): HealthStatus {
    if (level === "not_cleared") return "not_cleared";
    if (hasOpenInjury) return "recovery";
    return level === "full" ? "healthy" : "monitoring";
}

/**
 * The medical service keeps the "not cleared" status every fighter starts with, even after a doctor clears them. While
 * a clearance is in effect, read that stored status the way granting the clearance sets it.
 */
export function currentHealthStatus(stored: HealthStatus, state: ClearanceState, hasOpenInjury: boolean): HealthStatus {
    return stored === "not_cleared" && (state === "full" || state === "restricted") ? healthStatusForClearance(state, hasOpenInjury) : stored;
}

/** Follow-ups due within this many days, and every overdue one, wait for the doctor. */
export const FOLLOW_UP_WINDOW_DAYS = 7;

/** Days until the clearance lapses; null when open-ended. */
export function clearanceDaysRemaining(clearance: MedicalClearance, now: string | Date = new Date()): number | null {
    return clearance.validUntil ? daysBetween(now, clearance.validUntil) : null;
}

export function clearanceExpiresSoon(
    clearance: MedicalClearance | null,
    withinDays: number,
    now: string | Date = new Date(),
): boolean {
    if (!clearance || clearance.status !== "active") return false;
    const remaining = clearanceDaysRemaining(clearance, now);
    return remaining !== null && remaining >= 0 && remaining <= withinDays;
}

export {
    checkTrainingAgainstClearance,
    clearanceConflictMessage,
    type ClearanceConflict,
    type ClearanceConflictCode,
    type PlannedTraining,
} from "./clearance-rules";
