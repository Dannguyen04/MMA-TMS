import { addDaysToKey, daysBetweenKeys, formatNumber, isDateKey } from "@/lib/format";

/** Camp weight status. The service that owns the bout computes this; the chart only displays it. */
export type WeightStatus = "GREEN" | "YELLOW" | "RED" | "GREY";

/** Whether yesterday followed the meal plan the coach wrote. The app does not score the food. */
export type PlanAdherence = "ON_PLAN" | "SLIGHTLY_OFF" | "WAY_OFF";

export interface DatedKg {
    date: string;
    kg: number;
    /** Present when the fighter answered the plan question on this academy day. */
    adherence?: PlanAdherence | null;
}

/** The part of a weight track the chart needs. Missing days stay out of the arrays. */
export interface WeightChartTrack {
    limitKg: number | null;
    points: DatedKg[];
    referencePath: DatedKg[];
    latestKg: number | null;
    status: WeightStatus;
    /** Academy date of the official weigh-in, when the bout has one. */
    weighInOn: string | null;
}

export interface WeightChartData {
    /** One academy date per day, from `from` through `to` inclusive. */
    labels: string[];
    /** Kilograms aligned with `labels`. A missing day is `null`, so the line breaks. */
    weight: (number | null)[];
    /** Reference kilograms aligned with `labels`. */
    reference: (number | null)[];
    /** Plan answer aligned with `labels`. A day with no answer is `null`. */
    adherence: (PlanAdherence | null)[];
}

const STATUS_LABEL: Record<WeightStatus, string> = {
    GREEN: "Green",
    YELLOW: "Yellow",
    RED: "Red",
    GREY: "Grey",
};

export function weightStatusLabel(status: WeightStatus): string {
    return STATUS_LABEL[status];
}

/**
 * Categories and series for the camp weight chart.
 * `from` and `to` are academy dates (YYYY-MM-DD). Labels cover every day in that range.
 * A day with no measurement is `null`, so the line does not invent a join across the gap.
 */
export function weightChartData(track: Pick<WeightChartTrack, "points" | "referencePath">, from: string, to: string): WeightChartData {
    if (!isDateKey(from) || !isDateKey(to) || daysBetweenKeys(from, to) < 0) {
        return { labels: [], weight: [], reference: [], adherence: [] };
    }

    const labels: string[] = [];
    for (let cursor = from; labels.length < 400; cursor = addDaysToKey(cursor, 1)) {
        labels.push(cursor);
        if (cursor === to) break;
    }

    const weightByDay = latestByDay(track.points);
    const referenceByDay = latestByDay(track.referencePath);
    return {
        labels,
        weight: labels.map((day) => weightByDay.get(day)?.kg ?? null),
        reference: labels.map((day) => referenceByDay.get(day)?.kg ?? null),
        adherence: labels.map((day) => weightByDay.get(day)?.adherence ?? null),
    };
}

/**
 * First plotted day through weigh-in day. The first day is the earlier of the first
 * measurement and the first reference day. Weigh-in day is the end, extended when a
 * later measurement exists so that log still appears.
 */
export function weightChartWindow(track: Pick<WeightChartTrack, "points" | "referencePath" | "weighInOn">): { from: string; to: string } | null {
    const dated = [...track.points, ...track.referencePath].map((point) => point.date).filter(isAcademyDate);
    if (dated.length === 0 && !isAcademyDate(track.weighInOn)) return null;
    const sorted = [...dated].sort();
    const from = sorted[0] ?? track.weighInOn;
    if (!isAcademyDate(from)) return null;
    const lastPoint = sorted[sorted.length - 1];
    const candidates = [track.weighInOn, lastPoint, from].filter(isAcademyDate);
    const to = candidates.reduce((latest, day) => (daysBetweenKeys(latest, day) > 0 ? day : latest));
    return daysBetweenKeys(from, to) < 0 ? { from: to, to: from } : { from, to };
}

/** Screen-reader summary: the limit, the latest weight, and the status. */
export function weightChartAriaLabel(track: Pick<WeightChartTrack, "limitKg" | "latestKg" | "status">): string {
    const limit = track.limitKg === null ? "no limit set" : `a ${formatNumber(track.limitKg, 1)} kg limit`;
    const latest = track.latestKg === null ? "No weight logged" : `Latest ${formatNumber(track.latestKg, 1)} kg`;
    return `Weight against ${limit}. ${latest}, status ${weightStatusLabel(track.status)}.`;
}

function isAcademyDate(value: string | null | undefined): value is string {
    return isDateKey(value ?? undefined);
}

function latestByDay(points: DatedKg[]): Map<string, DatedKg> {
    const byDay = new Map<string, DatedKg>();
    for (const point of points) {
        if (!isDateKey(point.date) || !Number.isFinite(point.kg)) continue;
        byDay.set(point.date, point);
    }
    return byDay;
}
