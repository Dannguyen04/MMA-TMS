import { daysBetween, formatDate } from "@/lib/format";
import { clamp } from "@/lib/utils";
import { TECHNIQUE_LABELS, TRAINING_TYPE_LABELS, BODY_REGION_LABELS } from "./labels";
import type {
    BodyRegion,
    ClearanceLevel,
    Goal,
    MedicalClearance,
    RecoveryPlan,
    Technique,
    TrainingType,
} from "./types";

/* ─── AI confidence ───────────────────────────────────────────────────────── */

/** Detections below this confidence require human review. Mirrors SystemSettings.aiLowConfidenceThreshold. */
export const LOW_CONFIDENCE_THRESHOLD = 0.6;
export const HIGH_CONFIDENCE_THRESHOLD = 0.8;

export type ConfidenceBand = "high" | "medium" | "low";

export function confidenceBand(confidence: number, lowThreshold = LOW_CONFIDENCE_THRESHOLD): ConfidenceBand {
    if (confidence < lowThreshold) return "low";
    if (confidence < HIGH_CONFIDENCE_THRESHOLD) return "medium";
    return "high";
}

export function isLowConfidence(confidence: number, lowThreshold = LOW_CONFIDENCE_THRESHOLD): boolean {
    return confidence < lowThreshold;
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
 * phase counts by the share of its milestones that are done.
 */
export function recoveryProgressPct(plan: Pick<RecoveryPlan, "status" | "phases">): number {
    if (plan.status === "completed") return 100;
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

export interface PlannedTraining {
    type: TrainingType;
    targetRpe: number;
    techniques: Technique[];
    loadsRegions: BodyRegion[];
}

export interface ClearanceConflict {
    /** "block" means the session must not go ahead as planned; "warn" needs coach judgement. */
    severity: "block" | "warn";
    message: string;
}

/**
 * Checks planned training against the fighter's Medical Clearance.
 * Coaches see these conflicts when scheduling; the doctor's clearance is always the authority.
 */
export function checkTrainingAgainstClearance(
    planned: PlannedTraining,
    clearance: MedicalClearance | null,
    now: string | Date = new Date(),
): ClearanceConflict[] {
    const state = clearanceState(clearance, now);

    if (state === "none") {
        return [{ severity: "warn", message: "No Medical Clearance on file. Ask the sports doctor to complete a baseline examination." }];
    }
    if (state === "expired" && clearance) {
        return [
            {
                severity: "block",
                message: `Medical Clearance expired on ${formatDate(clearance.validUntil ?? clearance.issuedAt)}. A doctor must renew it before training.`,
            },
        ];
    }
    if (state === "not_cleared") {
        return [{ severity: "block", message: "Fighter is not cleared to train. Only the sports doctor can change this." }];
    }
    if (!clearance || state === "full") return [];

    const conflicts: ClearanceConflict[] = [];
    for (const restriction of clearance.restrictions) {
        if (restriction.blockedTrainingTypes.includes(planned.type)) {
            conflicts.push({
                severity: "block",
                message: `${TRAINING_TYPE_LABELS[planned.type]} is restricted: ${restriction.label}.`,
            });
        }
        if (restriction.maxRpe !== null && planned.targetRpe > restriction.maxRpe) {
            conflicts.push({
                severity: "block",
                message: `Target intensity RPE ${planned.targetRpe} exceeds the cleared maximum of RPE ${restriction.maxRpe}.`,
            });
        }
        const techniques = planned.techniques.filter((t) => restriction.blockedTechniques.includes(t));
        if (techniques.length > 0) {
            conflicts.push({
                severity: "warn",
                message: `Includes restricted techniques (${techniques.map((t) => TECHNIQUE_LABELS[t]).join(", ")}): ${restriction.label}.`,
            });
        }
        const regions = planned.loadsRegions.filter((r) => restriction.blockedRegions.includes(r));
        if (regions.length > 0) {
            conflicts.push({
                severity: "warn",
                message: `Loads a protected area (${regions.map((r) => BODY_REGION_LABELS[r]).join(", ")}): ${restriction.label}.`,
            });
        }
    }
    return conflicts;
}
