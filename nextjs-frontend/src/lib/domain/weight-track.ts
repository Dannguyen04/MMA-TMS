import { addDaysToKey, daysBetweenKeys, isDateKey } from "@/lib/format";
import { round } from "@/lib/utils";

import type { DatedKg, WeightStatus } from "./weight-chart";

/** How far above the reference line still counts as on pace, in kilograms. */
export const WEIGHT_TOLERANCE_KG = 1;

/** A camp day with no weigh-in for this many academy days is grey. */
export const WEIGHT_STALE_DAYS = 3;

export interface WeightTrackPoint extends DatedKg {
    /** Set when the fighter answered the plan question on this academy day. */
    adherence?: "ON_PLAN" | "SLIGHTLY_OFF" | "WAY_OFF" | null;
}

export interface WeightTrackInput {
    /** Null for an open class: there is nothing to cut to, so the status only says whether the fighter logs. */
    limitKg: number | null;
    /** Acute-loss limit, 8 or 5. Compared with remaining percent. */
    acuteLossLimitPct: number;
    /** Days before weigh-in in which remaining percent can turn the camp red. */
    acuteWindowDays: number;
    toleranceKg?: number;
    /** Academy date the camp (or the bout record) started. */
    campStartedOn: string;
    /** Academy date of the official weigh-in. */
    weighInOn: string;
    /** Academy date the status is judged against. */
    todayOn: string;
    points: WeightTrackPoint[];
}

export interface WeightTrack {
    limitKg: number | null;
    points: WeightTrackPoint[];
    latestKg: number | null;
    latestOn: string | null;
    /** Share of the latest weight still above the limit. Null when there is no weight. */
    remainingPct: number | null;
    status: WeightStatus;
    referencePath: DatedKg[];
    weighInOn: string;
    daysToWeighIn: number;
    acuteLossLimitPct: number;
    acuteWindowDays: number;
}

/**
 * Demo (and any client) reading of the camp weight rules.
 * The reference line is a display guide from the first camp weight down to the limit.
 * It is not a meal plan and not a prescription.
 */
export function buildWeightTrack(input: WeightTrackInput): WeightTrack {
    const toleranceKg = input.toleranceKg ?? WEIGHT_TOLERANCE_KG;
    const points = pointsInCamp(input.points, input.campStartedOn, input.todayOn);
    const latest = points[points.length - 1] ?? null;
    const daysToWeighIn = isDateKey(input.weighInOn) && isDateKey(input.todayOn) ? daysBetweenKeys(input.todayOn, input.weighInOn) : 0;
    const limitKg = input.limitKg;
    const referencePath = limitKg === null ? [] : referenceSeries({ ...input, limitKg }, points[0] ?? null);
    const latestKg = latest?.kg ?? null;
    const remainingPct = latestKg === null || latestKg <= 0 || limitKg === null ? null : round(Math.max(0, ((latestKg - limitKg) / latestKg) * 100), 1);
    const stale = latest === null || !isDateKey(input.todayOn) || daysBetweenKeys(latest.date, input.todayOn) >= WEIGHT_STALE_DAYS;
    const referenceKg = latest && limitKg !== null ? referenceKgOn({ ...input, limitKg }, points[0] ?? null, latest.date) : null;

    let status: WeightStatus = "ON_TRACK";
    if (stale) status = "NOT_WEIGHED";
    else if (remainingPct !== null && daysToWeighIn <= input.acuteWindowDays && remainingPct > input.acuteLossLimitPct) status = "OVER_LIMIT";
    else if (latestKg !== null && referenceKg !== null && daysToWeighIn > input.acuteWindowDays && latestKg > referenceKg + toleranceKg) status = "ABOVE_TARGET";

    return {
        limitKg: input.limitKg,
        points,
        latestKg,
        latestOn: latest?.date ?? null,
        remainingPct,
        status,
        referencePath,
        weighInOn: input.weighInOn,
        daysToWeighIn,
        acuteLossLimitPct: input.acuteLossLimitPct,
        acuteWindowDays: input.acuteWindowDays,
    };
}

function pointsInCamp(points: WeightTrackPoint[], campStartedOn: string, todayOn: string): WeightTrackPoint[] {
    const byDay = new Map<string, WeightTrackPoint>();
    for (const point of points) {
        if (!isDateKey(point.date) || !Number.isFinite(point.kg)) continue;
        if (isDateKey(campStartedOn) && daysBetweenKeys(campStartedOn, point.date) < 0) continue;
        if (isDateKey(todayOn) && daysBetweenKeys(point.date, todayOn) < 0) continue;
        byDay.set(point.date, point);
    }
    return [...byDay.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

type LimitedInput = WeightTrackInput & { limitKg: number };

function referenceSeries(input: LimitedInput, first: WeightTrackPoint | null): DatedKg[] {
    if (!first || !isDateKey(first.date) || !isDateKey(input.weighInOn)) return [];
    const end = daysBetweenKeys(first.date, input.weighInOn) >= 0 ? input.weighInOn : first.date;
    const series: DatedKg[] = [];
    for (let cursor = first.date; series.length < 400; cursor = addDaysToKey(cursor, 1)) {
        series.push({ date: cursor, kg: round(referenceKgOn(input, first, cursor) ?? first.kg, 2) });
        if (cursor === end) break;
    }
    return series;
}

/**
 * Linear from the first camp weight to `limit / (1 - L/100)` on the day the acute
 * window opens, then linear from there to the limit on weigh-in day.
 *
 * The line never rises above the first camp weight: a fighter who starts below the
 * window's mark (or under the limit) would otherwise be shown a line that climbs,
 * which reads as "gain weight". Tech spec §5 leaves that case open; see the T-004 handover.
 */
function referenceKgOn(input: LimitedInput, first: WeightTrackPoint | null, date: string): number | null {
    const kg = straightReferenceKgOn(input, first, date);
    return kg === null || !first ? kg : Math.min(kg, first.kg);
}

function straightReferenceKgOn(input: LimitedInput, first: WeightTrackPoint | null, date: string): number | null {
    if (!first || !isDateKey(date) || !isDateKey(input.weighInOn) || !isDateKey(first.date)) return null;
    const loss = input.acuteLossLimitPct / 100;
    if (loss <= 0 || loss >= 1) return input.limitKg;
    const targetAtWindow = input.limitKg / (1 - loss);
    const windowOn = addDaysToKey(input.weighInOn, -input.acuteWindowDays);
    if (daysBetweenKeys(date, first.date) > 0) return first.kg;
    if (daysBetweenKeys(input.weighInOn, date) > 0) return input.limitKg;

    const windowAfterStart = daysBetweenKeys(first.date, windowOn) > 0;
    const windowBeforeWeighIn = daysBetweenKeys(windowOn, input.weighInOn) > 0;
    if (windowAfterStart && windowBeforeWeighIn && daysBetweenKeys(date, windowOn) >= 0) {
        return lerp(first.date, first.kg, windowOn, targetAtWindow, date);
    }
    const startOn = windowAfterStart && windowBeforeWeighIn ? windowOn : first.date;
    const startKg = windowAfterStart && windowBeforeWeighIn ? targetAtWindow : first.kg;
    return lerp(startOn, startKg, input.weighInOn, input.limitKg, date);
}

function lerp(fromOn: string, fromKg: number, toOn: string, toKg: number, date: string): number {
    const span = daysBetweenKeys(fromOn, toOn);
    if (span <= 0) return toKg;
    const t = Math.min(1, Math.max(0, daysBetweenKeys(fromOn, date) / span));
    return fromKg + (toKg - fromKg) * t;
}
