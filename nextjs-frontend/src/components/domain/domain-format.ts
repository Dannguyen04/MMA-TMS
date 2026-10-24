import { formatNumber, pluralize } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";

/**
 * Presentation helpers shared by the domain components. Generic date and number
 * formatting lives in `@/lib/format`; these add domain phrasing on top of it.
 */

/** 71 + "%" → "71%", 412 + "ms" → "412 ms", 6.84 + "m/s" → "6.8 m/s". */
export function formatMeasure(value: number, unit: string): string {
    const text = formatNumber(value, Number.isInteger(value) ? 0 : 1);
    if (!unit) return text;
    return unit === "%" || unit === "°" ? `${text}${unit}` : `${text} ${unit}`;
}

/** Whole-day distance as words: "today", "tomorrow", "in 5 days", "yesterday", "3 days ago". */
export function describeDaysUntil(days: number, locale: Locale = "en"): string {
    if (locale === "vi") {
        if (days === 0) return "hôm nay";
        if (days === 1) return "ngày mai";
        if (days === -1) return "hôm qua";
        return days > 0 ? `sau ${days} ngày` : `${-days} ngày trước`;
    }
    if (days === 0) return "today";
    if (days === 1) return "tomorrow";
    if (days === -1) return "yesterday";
    return days > 0 ? `in ${pluralize(days, "day")}` : `${pluralize(-days, "day")} ago`;
}

/** Shown in place of a profile value the API hasn't provided yet. */
export const NOT_RECORDED = "Not recorded";

/** "1920×1080 · 30 fps", or the not-recorded label before the footage's metadata has been read. */
export function formatVideoResolution(video: { resolution: string; fps: number }): string {
    return video.fps > 0 && video.resolution ? `${video.resolution.replace("x", "×")} · ${video.fps} fps` : NOT_RECORDED;
}

/** The label for a value that may not be recorded yet; null when it isn't. */
export function labelOf<K extends string>(labels: Record<K, string>, value: K | null): string | null {
    return value === null ? null : labels[value];
}

/** Facts for a one-line summary, leaving out the ones not recorded yet. */
export function presentFacts(...facts: (string | null | undefined)[]): string[] {
    return facts.filter((fact): fact is string => Boolean(fact));
}

/** Capitalises the first letter, e.g. for sentence starts built from `describeDaysUntil`. */
export function capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
}
