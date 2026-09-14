import { formatNumber } from "@/lib/format";

/** Axis ticks and the domain they span. */
export interface TickScale {
    min: number;
    max: number;
    step: number;
    ticks: number[];
}

const NICE_MULTIPLIERS = [1, 2, 2.5, 5, 10];
const MAX_DECIMALS = 6;

/** Removes floating-point noise and negative zero from a computed tick value. */
function cleanNumber(value: number, decimals: number): number {
    const rounded = Number(value.toFixed(decimals));
    return rounded === 0 ? 0 : rounded;
}

/** Smallest "clean" step (1, 2, 2.5 or 5 × 10ⁿ) that is at least `roughStep`. */
export function niceStep(roughStep: number): number {
    if (!Number.isFinite(roughStep) || roughStep <= 0) return 1;
    const magnitude = 10 ** Math.floor(Math.log10(roughStep));
    const normalized = roughStep / magnitude;
    const multiplier = NICE_MULTIPLIERS.find((m) => m >= normalized - 1e-9) ?? 10;
    return cleanNumber(multiplier * magnitude, MAX_DECIMALS + 4);
}

/** Number of decimals needed to print every multiple of `step` exactly (2.5 → 1, 0.25 → 2). */
export function stepDecimals(step: number): number {
    for (let decimals = 0; decimals <= MAX_DECIMALS; decimals++) {
        const scaled = step * 10 ** decimals;
        if (Math.abs(Math.round(scaled) - scaled) < 1e-7) return decimals;
    }
    return MAX_DECIMALS;
}

function buildTicks(first: number, last: number, step: number): number[] {
    const decimals = stepDecimals(step);
    const ticks: number[] = [];
    const count = Math.floor((last - first) / step + 1e-9);
    for (let i = 0; i <= count; i++) ticks.push(cleanNumber(first + i * step, decimals));
    return ticks;
}

/** Expands a zero-width range so a scale can still be drawn. */
function spread(min: number, max: number): [number, number] {
    if (max > min) return [min, max];
    const pad = Math.abs(min) * 0.1 || 1;
    return [min - pad, max + pad];
}

/**
 * Rounds `[min, max]` outwards to clean tick boundaries, aiming for about `targetCount`
 * ticks (never more than `targetCount + 1`).
 */
export function niceScale(min: number, max: number, targetCount = 5): TickScale {
    const [low, high] = spread(Math.min(min, max), Math.max(min, max));
    const step = niceStep((high - low) / Math.max(1, targetCount - 1));
    const decimals = stepDecimals(step);
    const niceMin = cleanNumber(Math.floor(low / step + 1e-9) * step, decimals);
    const niceMax = cleanNumber(Math.ceil(high / step - 1e-9) * step, decimals);
    return { min: niceMin, max: niceMax, step, ticks: buildTicks(niceMin, niceMax, step) };
}

/** Clean ticks inside a fixed domain (the domain itself is kept as given). */
export function ticksWithin(min: number, max: number, targetCount = 5): TickScale {
    const [low, high] = spread(Math.min(min, max), Math.max(min, max));
    const step = niceStep((high - low) / Math.max(1, targetCount - 1));
    const decimals = stepDecimals(step);
    const first = cleanNumber(Math.ceil(low / step - 1e-9) * step, decimals);
    return { min: low, max: high, step, ticks: buildTicks(first, high, step) };
}

/** Value formatting that can cross the Server → Client boundary (no functions). */
interface ValueFormat {
    decimals?: number;
    suffix?: string;
}

/** Formats a data value for tooltips, labels and tables, e.g. `1,240 min` or `72%`. */
export function formatChartValue(value: number, { decimals = 0, suffix = "" }: ValueFormat = {}): string {
    return `${formatNumber(value, decimals)}${suffix}`;
}

/**
 * Formats an axis tick. Only compact single-character suffixes such as `%` ride on the
 * ticks; longer units (` kg`, ` min`) belong in the chart title.
 */
export function formatTick(value: number, step: number, suffix = ""): string {
    const tickSuffix = /^\S$/.test(suffix) ? suffix : "";
    return `${formatNumber(value, stepDecimals(step))}${tickSuffix}`;
}

const NARROW_CHARS = new Set([..."ijlrtf.,:;|!'()[] 1"]);
const WIDE_CHARS = new Set([..."mwMW%@—"]);

/**
 * Approximate rendered width of `text` in the app's sans font. Used to reserve axis space
 * and decide whether labels fit before rendering (SVG text cannot be measured on the server).
 */
export function estimateTextWidth(text: string, fontSize: number): number {
    let em = 0;
    for (const char of text) {
        if (NARROW_CHARS.has(char)) em += 0.32;
        else if (WIDE_CHARS.has(char)) em += 0.86;
        else if (char >= "0" && char <= "9") em += 0.6;
        else if (char >= "A" && char <= "Z") em += 0.68;
        else em += 0.56;
    }
    return em * fontSize;
}

/** Widest estimated width among `texts` (0 for an empty list). */
export function maxTextWidth(texts: string[], fontSize: number): number {
    return texts.reduce((max, text) => Math.max(max, estimateTextWidth(text, fontSize)), 0);
}

/**
 * Indices of evenly spaced category labels that can be shown without colliding.
 * The last label (usually the most recent period) is always kept.
 */
export function visibleLabelIndices(count: number, step: number, maxLabelWidth: number, minGap = 12): number[] {
    if (count <= 0) return [];
    const every = step > 0 ? Math.max(1, Math.ceil((maxLabelWidth + minGap) / step)) : count;
    const indices: number[] = [];
    for (let i = 0; i < count; i++) {
        if ((count - 1 - i) % every === 0) indices.push(i);
    }
    return indices;
}
