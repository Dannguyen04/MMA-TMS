import { addDaysToKey, dayKey, daysBetweenKeys } from "@/lib/format";
import type {
    Bout,
    BoutRequirement,
    BoutStatus,
    CompetitionRuleset,
    Gate1Result,
    WeighInReminderLevel,
    WeightFeasibility,
    WeightReminder,
    WeightStatusSummary,
    WeightWarningStatus,
} from "./types";

/**
 * Pure functions for bout business logic and rules.
 * Shared between demo services, API transformations, and unit tests.
 * Reference: Tech spec §3, §5, Business flows F1, F2, F3, F4, F8.
 */

/**
 * Snapshot calculation of acute loss limit percentage.
 * If boutAt - weighInAt >= 12 hours -> acuteLossLimitPctLong (default 8.0)
 * Otherwise (< 12 hours) -> acuteLossLimitPctShort (default 5.0)
 */
export function calculateSnapshotAcuteLimit(
    weighInAt: string | Date,
    boutAt: string | Date,
    ruleset?: Partial<Pick<CompetitionRuleset, "acuteLossLimitPctLong" | "acuteLossLimitPctShort">>,
): number {
    const weighInMs = typeof weighInAt === "string" ? new Date(weighInAt).getTime() : weighInAt.getTime();
    const boutMs = typeof boutAt === "string" ? new Date(boutAt).getTime() : boutAt.getTime();
    const diffMs = boutMs - weighInMs;
    const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

    const longPct = ruleset?.acuteLossLimitPctLong ?? 8.0;
    const shortPct = ruleset?.acuteLossLimitPctShort ?? 5.0;

    return diffMs >= TWELVE_HOURS_MS ? longPct : shortPct;
}

/**
 * Gate 1 verification:
 * Passed when all `required: true` requirements are PROVIDED or CONFIRMED,
 * and validUntil is on or after the academy day of boutAt.
 * Non-required requirements (required: false) never block Gate 1.
 */
export function evaluateGate1(requirements: BoutRequirement[], boutAt: string | Date): Gate1Result {
    const boutDateKey = dayKey(boutAt);
    const missing: string[] = [];
    const expiring: string[] = [];

    for (const req of requirements) {
        if (!req.required) continue;

        if (req.status !== "PROVIDED" && req.status !== "CONFIRMED") {
            missing.push(req.label);
        } else {
            // Must have a validUntil date on or after bout date
            if (!req.validUntil || dayKey(req.validUntil) < boutDateKey) {
                expiring.push(req.label);
            }
        }
    }

    return {
        passed: missing.length === 0 && expiring.length === 0,
        missing,
        expiring,
    };
}

/**
 * Checks whether a bout in CAMP status can transition to FIGHT_WEEK:
 * Status must be CAMP, Gate 1 must be passed, and today must be within
 * `fightWeekDays` of the weigh-in date (today >= weigh-in - fightWeekDays).
 */
export function canEnterFightWeek(
    bout: Pick<Bout, "status" | "weighInAt">,
    gate1: Gate1Result,
    fightWeekDays = 7,
    now: string | Date = new Date(),
): boolean {
    if (bout.status !== "CAMP") return false;
    if (!gate1.passed) return false;

    const todayKey = dayKey(now);
    const weighInKey = dayKey(bout.weighInAt);
    const fightWeekStartKey = addDaysToKey(weighInKey, -fightWeekDays);

    return todayKey >= fightWeekStartKey;
}

export interface WeightMeasurementPoint {
    date: string | Date;
    kg: number;
}

const WEIGHT_UNTRACKED_STATUSES: readonly BoutStatus[] = ["WEIGHED_IN", "COMPLETED", "CANCELLED"];

export interface WeightWarningParams {
    limitKg: number;
    acuteLossLimitPct: number; // L (typically 8.0 or 5.0)
    acuteWindowDays: number; // A (typically 7)
    weighInAt: string | Date;
    campStartDate: string | Date;
    measurements: WeightMeasurementPoint[];
    tolKg?: number; // default 1.0 kg
    now?: string | Date;
    /** From the official weigh-in on the track is not judged (status NEUTRAL). */
    boutStatus?: BoutStatus;
}

/**
 * Calculates weight warnings and the reference path according to Tech Spec §5.
 *
 * Algorithm:
 *   d = daysToWeighIn (today to weigh-in date in academy calendar days)
 *   W = latestKg
 *   remainingPct = max(0, (W - limitKg) / W * 100)
 *   targetAtWindow = limitKg / (1 - L / 100)
 *
 * Status:
 *   - Bout WEIGHED_IN, COMPLETED or CANCELLED (rehydration is expected) -> NEUTRAL
 *   - No weigh-in within the last 3 days (or no measurements) -> NOT_WEIGHED
 *   - d <= A && remainingPct > L -> OVER_LIMIT
 *   - d > A && W > reference(latestOn) + tolKg -> ABOVE_TARGET
 *   - Otherwise -> ON_TRACK
 */
export function calculateWeightWarning(params: WeightWarningParams): WeightStatusSummary {
    const { limitKg, acuteLossLimitPct: L, acuteWindowDays: A, weighInAt, campStartDate, tolKg = 1.0 } = params;

    const now = params.now ?? new Date();
    const todayKey = dayKey(now);
    const weighInKey = dayKey(weighInAt);
    const d = daysBetweenKeys(todayKey, weighInKey);

    const untracked = params.boutStatus !== undefined && WEIGHT_UNTRACKED_STATUSES.includes(params.boutStatus);

    if (params.measurements.length === 0) {
        return {
            latestKg: null,
            latestOn: null,
            remainingPct: null,
            status: untracked ? "NEUTRAL" : "NOT_WEIGHED",
            referencePath: [],
        };
    }

    // Sort measurements chronologically
    const sorted = [...params.measurements]
        .map((m) => ({ dateKey: dayKey(m.date), kg: m.kg }))
        .sort((a, b) => a.dateKey.localeCompare(b.dateKey));

    // Deduplicate on same calendar day: keep latest
    const deduped: Array<{ dateKey: string; kg: number }> = [];
    for (const m of sorted) {
        const last = deduped[deduped.length - 1];
        if (last && last.dateKey === m.dateKey) {
            last.kg = m.kg;
        } else {
            deduped.push({ ...m });
        }
    }

    const latest = deduped[deduped.length - 1];
    const latestKg = latest.kg;
    const latestKey = latest.dateKey;
    const daysSinceLatest = daysBetweenKeys(latestKey, todayKey);

    const remainingPct = Math.max(0, ((latestKg - limitKg) / latestKg) * 100);

    // Reference curve construction
    const W0 = deduped[0].kg;
    const startKey = dayKey(campStartDate);
    const windowKey = addDaysToKey(weighInKey, -A);
    const targetAtWindow = L < 100 ? limitKg / (1 - L / 100) : limitKg;

    function reference(dateKey: string): number {
        // If camp started at or after windowKey: linear interpolation directly to weighInKey
        if (daysBetweenKeys(startKey, windowKey) <= 0) {
            const totalDays = Math.max(1, daysBetweenKeys(startKey, weighInKey));
            const elapsed = daysBetweenKeys(startKey, dateKey);
            return W0 + (elapsed / totalDays) * (limitKg - W0);
        }

        // Before or on windowKey
        if (daysBetweenKeys(dateKey, windowKey) >= 0) {
            const windowDays = Math.max(1, daysBetweenKeys(startKey, windowKey));
            const elapsed = daysBetweenKeys(startKey, dateKey);
            return W0 + (elapsed / windowDays) * (targetAtWindow - W0);
        }

        // Between windowKey and weighInKey
        const finalDays = Math.max(1, daysBetweenKeys(windowKey, weighInKey));
        const elapsed = daysBetweenKeys(windowKey, dateKey);
        return targetAtWindow + (elapsed / finalDays) * (limitKg - targetAtWindow);
    }

    const referencePath: Array<{ date: string; kg: number }> = [
        { date: startKey, kg: Number(W0.toFixed(1)) },
        { date: windowKey, kg: Number(targetAtWindow.toFixed(1)) },
        { date: weighInKey, kg: Number(limitKg.toFixed(1)) },
    ];

    let status: WeightWarningStatus;
    if (untracked) {
        status = "NEUTRAL";
    } else if (daysSinceLatest >= 3) {
        status = "NOT_WEIGHED";
    } else if (d <= A && remainingPct > L) {
        status = "OVER_LIMIT";
    } else if (d > A && latestKg > reference(latestKey) + tolKg) {
        status = "ABOVE_TARGET";
    } else {
        status = "ON_TRACK";
    }

    return {
        latestKg: Number(latestKg.toFixed(1)),
        latestOn: latestKey,
        remainingPct: Number(remainingPct.toFixed(1)),
        status,
        referencePath,
    };
}

/** A weight older than this many academy days is "no data" for R31. */
export const FEASIBILITY_WEIGHT_MAX_AGE_DAYS = 7;

/**
 * R31 (mirror of the backend `computeWeightFeasibility`): OVER_LIMIT or ON_TRACK inside the
 * acute window, NEUTRAL while the weigh-in is further out, NOT_WEIGHED without a weight in 7 days.
 */
export function calculateWeightFeasibility(params: {
    limitKg: number;
    acuteLossLimitPct: number;
    acuteWindowDays: number;
    weighInAt: string | Date;
    latest: { date: string | Date; kg: number } | null;
    now?: string | Date;
}): Omit<WeightFeasibility, "warnings"> {
    const todayKey = dayKey(params.now ?? new Date());
    const daysToWeighIn = daysBetweenKeys(todayKey, dayKey(params.weighInAt));
    const latestKey = params.latest ? dayKey(params.latest.date) : null;
    if (!params.latest || latestKey === null || daysBetweenKeys(latestKey, todayKey) > FEASIBILITY_WEIGHT_MAX_AGE_DAYS) {
        return {
            status: "NOT_WEIGHED",
            remainingPct: null,
            latestKg: null,
            latestOn: null,
            daysToWeighIn,
            limitKg: params.limitKg,
            acuteLossLimitPct: params.acuteLossLimitPct,
        };
    }
    const raw = Math.max(0, ((params.latest.kg - params.limitKg) / params.latest.kg) * 100);
    let status: WeightWarningStatus = "NEUTRAL";
    if (daysToWeighIn <= params.acuteWindowDays) status = raw > params.acuteLossLimitPct ? "OVER_LIMIT" : "ON_TRACK";
    return {
        status,
        remainingPct: Number(raw.toFixed(1)),
        latestKg: params.latest.kg,
        latestOn: latestKey,
        daysToWeighIn,
        limitKg: params.limitKg,
        acuteLossLimitPct: params.acuteLossLimitPct,
    };
}

export function feasibilityWarnings(status: WeightWarningStatus): WeightFeasibility["warnings"] {
    if (status === "OVER_LIMIT") return [{ code: "WEIGHT_AT_RISK" }];
    if (status === "NOT_WEIGHED") return [{ code: "WEIGHT_INSUFFICIENT_DATA" }];
    return [];
}

/**
 * T0 (mirror of the backend `computeWeighInReminder`): only in FIGHT_WEEK, always pointing at today.
 * No weight at all counts as "ask today".
 */
export function computeWeighInReminder(params: {
    status: Bout["status"];
    latestOn: string | null;
    now?: string | Date;
}): WeightReminder {
    const daysSinceLastWeight = params.latestOn === null ? null : daysBetweenKeys(dayKey(params.latestOn), dayKey(params.now ?? new Date()));
    const none: WeightReminder = { active: false, level: null, daysSinceLastWeight, messageCode: null };
    if (params.status !== "FIGHT_WEEK") return none;
    if (daysSinceLastWeight !== null && daysSinceLastWeight <= 0) return none;
    const level: WeighInReminderLevel = daysSinceLastWeight !== null && daysSinceLastWeight >= 2 ? "YESTERDAY_MISSING" : "ASK_TODAY";
    return {
        active: true,
        level,
        daysSinceLastWeight,
        messageCode: level === "ASK_TODAY" ? "WEIGHT_REMINDER_ASK_TODAY" : "WEIGHT_REMINDER_YESTERDAY_MISSING",
    };
}

/**
 * Computes all dynamically calculated fields for a bout (T-003 §3).
 */
export function computeBoutComputedFields(
    bout: Bout,
    ruleset?: CompetitionRuleset | null,
    measurements: WeightMeasurementPoint[] = [],
    now: string | Date = new Date(),
    campStartDate?: string | Date,
): {
    daysToWeighIn: number;
    requirementsDueOn: string;
    gate1: Gate1Result;
    canEnterFightWeek: boolean;
    weight: WeightStatusSummary;
    weightReminder: WeightReminder;
} {
    const todayKey = dayKey(now);
    const weighInKey = dayKey(bout.weighInAt);
    const daysToWeighIn = daysBetweenKeys(todayKey, weighInKey);
    const requirementsDueOn = addDaysToKey(weighInKey, -bout.requirementsDueDays);

    const gate1 = evaluateGate1(bout.requirements ?? [], bout.boutAt);
    const fightWeekDays = ruleset?.fightWeekDays ?? 7;
    const canEnter = canEnterFightWeek(bout, gate1, fightWeekDays, now);

    const effectiveCampStart = campStartDate ?? bout.createdAt;

    const weight = calculateWeightWarning({
        limitKg: bout.catchweightKg ?? bout.weightLimitKg,
        acuteLossLimitPct: bout.acuteLossLimitPct,
        acuteWindowDays: ruleset?.acuteWindowDays ?? 7,
        weighInAt: bout.weighInAt,
        campStartDate: effectiveCampStart,
        measurements,
        now,
        boutStatus: bout.status,
    });

    return {
        daysToWeighIn,
        requirementsDueOn,
        gate1,
        canEnterFightWeek: canEnter,
        weight,
        weightReminder: computeWeighInReminder({ status: bout.status, latestOn: weight.latestOn, now }),
    };
}

/**
 * Deduplicates weight measurements by academy calendar day, taking the latest
 * measurement on each day and returning points sorted chronologically.
 * Reference: T-003 §3, criterion 12b.
 */
export function computeWeightPoints(
    measurements: Array<{ date: string | Date; kg: number }>,
): Array<{ date: string; kg: number }> {
    const sorted = [...measurements].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    const byDay = new Map<string, number>();
    for (const m of sorted) {
        byDay.set(dayKey(m.date), m.kg);
    }
    return Array.from(byDay.entries())
        .map(([date, kg]) => ({ date, kg: Number(kg.toFixed(1)) }))
        .sort((a, b) => a.date.localeCompare(b.date));
}

