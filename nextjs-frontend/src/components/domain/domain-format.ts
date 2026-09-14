import { formatNumber, pluralize } from "@/lib/format";

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
export function describeDaysUntil(days: number): string {
    if (days === 0) return "today";
    if (days === 1) return "tomorrow";
    if (days === -1) return "yesterday";
    return days > 0 ? `in ${pluralize(days, "day")}` : `${pluralize(-days, "day")} ago`;
}

/** Capitalises the first letter, e.g. for sentence starts built from `describeDaysUntil`. */
export function capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
}
