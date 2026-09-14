import type { Technique } from "@/lib/domain/types";

/**
 * Categorical chart colours, in the validated order defined in `globals.css`.
 * Values are CSS variables so light and dark themes resolve their own steps.
 * Assign slots in this fixed order and never cycle past the eighth.
 */
export const CHART_SERIES = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
    "var(--chart-6)",
    "var(--chart-7)",
    "var(--chart-8)",
] as const;

/** De-emphasis colour for context series and folded "Other" data. Never used for status. */
export const CHART_MUTED = "var(--neutral-solid)";

/** Fixed technique → colour identity, so a technique keeps its hue on every screen. */
export const TECHNIQUE_COLOR: Record<Technique, string> = {
    jab: CHART_SERIES[0],
    cross: CHART_SERIES[1],
    hook: CHART_SERIES[2],
    kick: CHART_SERIES[3],
    combination: CHART_SERIES[4],
    footwork: CHART_SERIES[5],
    guard: CHART_SERIES[6],
    head_movement: CHART_SERIES[7],
};

/** Fixed colours for recovery check-in measures, shared by every check-in chart and sparkline. */
export const CHECK_IN_COLORS = { pain: CHART_SERIES[1], mobility: CHART_SERIES[0], strength: CHART_SERIES[2] } as const;

/**
 * Colour for a 1-based series slot (1 → `--chart-1`). Slots outside 1–8 fall back to the
 * de-emphasis colour instead of generating or cycling hues.
 */
export function seriesColor(slot: number): string {
    return Number.isInteger(slot) && slot >= 1 && slot <= CHART_SERIES.length ? CHART_SERIES[slot - 1] : CHART_MUTED;
}
