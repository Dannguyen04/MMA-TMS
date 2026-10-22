import { addDaysToKey, daysBetweenKeys, formatShortDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import type { WeightTrack } from "./types";

export interface WeightChartData {
    /** Every academy day from `from` to `to`, both included (`YYYY-MM-DD`). */
    days: string[];
    /** Axis labels, one per day. */
    labels: string[];
    /** Daily weigh-ins; `null` on days without one, so the line shows a gap. */
    weight: (number | null)[];
    /** The reference cut path, straight between its anchor days; `null` outside the path. */
    reference: (number | null)[];
    target: { value: number; label: string };
}

/**
 * The chart window for a track: from the first weigh-in (or the start of the reference path when
 * there is none yet) to the weigh-in day. A weigh-in later than that day stretches the window.
 */
export function weightChartRange(track: WeightTrack, weighInDay: string): { from: string; to: string } {
    const from = track.points[0]?.date ?? track.referencePath[0]?.date ?? weighInDay;
    const lastPoint = track.points[track.points.length - 1]?.date;
    const to = lastPoint && lastPoint > weighInDay ? lastPoint : weighInDay;
    return { from: from < to ? from : to, to };
}

/** Values for `LineChart`: a weight series, a reference series and the limit line. */
export function weightChartData(track: WeightTrack, from: string, to: string, locale: Locale = "en"): WeightChartData {
    const count = Math.max(0, daysBetweenKeys(from, to)) + 1;
    const days = Array.from({ length: count }, (_, index) => addDaysToKey(from, index));
    const byDay = new Map(track.points.map((point) => [point.date, point.kg]));
    const anchors = [...track.referencePath].sort((a, b) => a.date.localeCompare(b.date));

    return {
        days,
        labels: days.map((day) => formatShortDate(`${day}T12:00:00+07:00`, locale)),
        weight: days.map((day) => byDay.get(day) ?? null),
        reference: days.map((day) => referenceAt(anchors, day)),
        target: { value: track.limitKg, label: "Limit" },
    };
}

/** The reference path is a polyline through its anchors (sorted by date); between two anchors the value is linear. */
function referenceAt(anchors: WeightTrack["referencePath"], day: string): number | null {
    for (let index = 0; index < anchors.length; index++) {
        const anchor = anchors[index];
        if (anchor.date === day) return anchor.kg;
        const next = anchors[index + 1];
        if (next && anchor.date < day && day < next.date) {
            const span = daysBetweenKeys(anchor.date, next.date);
            const elapsed = daysBetweenKeys(anchor.date, day);
            return Math.round((anchor.kg + ((next.kg - anchor.kg) * elapsed) / span) * 10) / 10;
        }
    }
    return null;
}
