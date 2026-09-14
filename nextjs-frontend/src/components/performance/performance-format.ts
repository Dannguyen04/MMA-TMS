import type { StatDelta } from "@/components/ui/stat-card";
import { TECHNIQUE_LABELS, TECHNIQUES } from "@/lib/domain/labels";
import type { Goal, Technique } from "@/lib/domain/types";
import { formatDelta, formatShortDate } from "@/lib/format";

/** Complete weeks the performance service averages into its comparison baseline. */
export const COMPARISON_WEEKS = 4;

/** Short technique names for dense table headers. */
export const TECHNIQUE_SHORT_LABELS: Record<Technique, string> = {
    ...TECHNIQUE_LABELS,
    combination: "Combos",
    head_movement: "Head mvmt",
};

/** Axis/table label for a weekly snapshot, e.g. "7 Sept". */
export function weekLabel(weekStart: string): string {
    return formatShortDate(weekStart);
}

/**
 * Snapshots up to and including the reporting week. The running week is left out of charts
 * while its footage and volume are still partial, so every chart matches the headline numbers.
 */
export function throughWeek<T extends { weekStart: string }>(history: T[], weekStart: string): T[] {
    const index = history.findIndex((item) => item.weekStart === weekStart);
    return index === -1 ? history : history.slice(0, index + 1);
}

/**
 * A y domain that spans at least `minSpan`, snapped to `step` and kept inside `bounds`, so small
 * week-to-week noise isn't magnified into a dramatic-looking line.
 */
export function steadyDomain(values: (number | null)[], { minSpan, step, bounds }: { minSpan: number; step: number; bounds?: [number, number] }): [number, number] | undefined {
    const defined = values.filter((value): value is number => value !== null && Number.isFinite(value));
    if (defined.length === 0) return undefined;
    const low = Math.min(...defined);
    const high = Math.max(...defined);
    const half = Math.max(high - low, minSpan) / 2;
    const middle = (low + high) / 2;
    let min = Math.floor((middle - half) / step) * step;
    let max = Math.ceil((middle + half) / step) * step;
    if (bounds) {
        min = Math.max(bounds[0], min);
        max = Math.min(bounds[1], max);
    }
    return [min, max];
}

/** "vs 4-wk avg" — shortened when fewer earlier weeks exist. */
export function comparisonLabel(weeks: number): string {
    if (weeks >= COMPARISON_WEEKS) return "vs 4-wk avg";
    return weeks === 1 ? "vs week before" : `vs ${weeks}-wk avg`;
}

/** Score changes smaller than this (points) are noise, matching the service's "steady" trend band. */
export const SCORE_NOISE_POINTS = 1;

interface ChangeOptions {
    decimals?: number;
    label?: string;
    suffix?: string;
    higherIsBetter?: boolean;
    /** Changes smaller than this magnitude get neutral colouring. */
    neutralWithin?: number;
}

/** Signed change as a StatDelta; the arrow shows direction, sentiment says whether it is good news. */
export function changeDelta(change: number, { decimals = 0, label, suffix = "", higherIsBetter = true, neutralWithin = 0 }: ChangeOptions = {}): StatDelta {
    const rounded = Number(change.toFixed(decimals));
    const direction = rounded > 0 ? "up" : rounded < 0 ? "down" : "flat";
    const improved = higherIsBetter ? rounded > 0 : rounded < 0;
    const negligible = rounded === 0 || Math.abs(rounded) < neutralWithin;
    return {
        value: `${formatDelta(rounded, decimals)}${suffix}`,
        direction,
        sentiment: negligible ? "neutral" : improved ? "good" : "bad",
        label,
    };
}

/** Score change against the comparison average; undefined when there is no earlier week yet. */
export function scoreDelta(change: number, comparisonWeeks: number): StatDelta | undefined {
    if (comparisonWeeks === 0) return undefined;
    return changeDelta(change, { decimals: 1, label: comparisonLabel(comparisonWeeks), neutralWithin: SCORE_NOISE_POINTS });
}

/** Percentage change between two totals; null when the earlier total is zero. */
export function percentChange(current: number, previous: number): number | null {
    return previous === 0 ? null : ((current - previous) / previous) * 100;
}

/** 1 → "1st", 2 → "2nd", 11 → "11th". */
export function ordinal(value: number): string {
    const mod100 = value % 100;
    if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
    const suffix = { 1: "st", 2: "nd", 3: "rd" }[value % 10] ?? "th";
    return `${value}${suffix}`;
}

/** Techniques ordered from highest to lowest score. */
export function rankTechniques(scores: Record<Technique, number>): Technique[] {
    return [...TECHNIQUES].sort((a, b) => scores[b] - scores[a]);
}

/** An open goal (on track or at risk) that measures exactly this metric, for a chart target line. */
export function goalForMetric(goals: Goal[], metricLabel: string, unit: string): Goal | null {
    const label = metricLabel.trim().toLowerCase();
    return (
        goals.find(
            (goal) =>
                (goal.status === "on_track" || goal.status === "at_risk") &&
                goal.metricLabel.trim().toLowerCase() === label &&
                goal.unit.trim() === unit,
        ) ?? null
    );
}
