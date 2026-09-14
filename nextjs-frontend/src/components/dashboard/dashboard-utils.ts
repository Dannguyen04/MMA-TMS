import { capitalize, describeDaysUntil } from "@/components/domain/domain-format";
import { WEIGHT_CLASS_LIMIT_KG } from "@/lib/domain/labels";
import type { ClearanceState } from "@/lib/domain/rules";
import type { Fighter, HealthStatus, PerformanceMetric, WeightClass } from "@/lib/domain/types";
import { APP_TIMEZONE, daysBetween, formatNumber } from "@/lib/format";
import { round } from "@/lib/utils";

/** Pure helpers shared by the dashboards, roster, profile and health screens. Safe for Server and Client Components. */

const hourFmt = new Intl.DateTimeFormat("en-GB", { timeZone: APP_TIMEZONE, hour: "numeric", hourCycle: "h23" });

/** "Good morning" / "Good afternoon" / "Good evening" by the academy's wall clock. */
export function greetingFor(now: string): string {
    const hour = Number(hourFmt.format(new Date(now)));
    if (hour >= 5 && hour < 12) return "Good morning";
    if (hour >= 12 && hour < 18) return "Good afternoon";
    return "Good evening";
}

/** First given name for greetings, e.g. "Minh Trần" → "Minh". */
export function firstName(name: string): string {
    return name.trim().split(/\s+/)[0] ?? name;
}

/** "Today", "Tomorrow", "In 3 days", "Yesterday" for a timestamp relative to `now` (academy calendar days). */
export function relativeDay(value: string, now: string): string {
    return capitalize(describeDaysUntil(daysBetween(now, value)));
}

/** W-L-D record as text, e.g. "14-3-0". */
export function recordText(fighter: Pick<Fighter, "record">): string {
    const { wins, losses, draws } = fighter.record;
    return `${wins}-${losses}-${draws}`;
}

/* ─── Weight ──────────────────────────────────────────────────────────────── */

/** Weekly weight-cut pace above which the note suggests planning the cut with coach and doctor. */
const FAST_CUT_KG_PER_WEEK = 1;

export interface WeightCheck {
    currentKg: number;
    limitKg: number;
    /** Positive when above the limit. */
    toCutKg: number;
    onWeight: boolean;
    /** kg per week needed to make weight by `days`; null when on weight or no date. */
    pacePerWeek: number | null;
    fastPace: boolean;
}

/** Current weight against a weight class limit, optionally with the pace needed to make weight in `daysLeft`. */
export function weightCheck(currentKg: number, weightClass: WeightClass, daysLeft: number | null = null): WeightCheck {
    const limitKg = WEIGHT_CLASS_LIMIT_KG[weightClass];
    const toCutKg = round(currentKg - limitKg, 1);
    const onWeight = toCutKg <= 0;
    const pacePerWeek = !onWeight && daysLeft !== null && daysLeft > 0 ? round((toCutKg / daysLeft) * 7, 2) : null;
    return { currentKg, limitKg, toCutKg, onWeight, pacePerWeek, fastPace: pacePerWeek !== null && pacePerWeek > FAST_CUT_KG_PER_WEEK };
}

/** "3.1 kg to cut" or "0.4 kg under the limit". */
export function weightGapText(check: WeightCheck): string {
    return check.onWeight ? `${formatNumber(Math.abs(check.toCutKg), 1)} kg under the limit` : `${formatNumber(check.toCutKg, 1)} kg to cut`;
}

/* ─── Ordering ────────────────────────────────────────────────────────────── */

/** Most restrictive first, for sorting by health. */
export const HEALTH_PRIORITY: Record<HealthStatus, number> = { not_cleared: 0, injured: 1, recovery: 2, monitoring: 3, healthy: 4 };

/** Needs attention first, for sorting by clearance. */
export const CLEARANCE_PRIORITY: Record<ClearanceState, number> = { not_cleared: 0, expired: 1, none: 2, restricted: 3, full: 4 };

/* ─── Performance ─────────────────────────────────────────────────────────── */

const WEEK_MS = 7 * 86_400_000;

/** Snapshots whose week has fully passed — the running week is partial and left out of trends. */
export function completeWeeks(history: PerformanceMetric[], now: string): PerformanceMetric[] {
    const nowMs = Date.parse(now);
    return history.filter((metric) => Date.parse(metric.weekStart) + WEEK_MS <= nowMs);
}
