import type { UpcomingBout } from "@/lib/domain/types";
import { daysBetween } from "@/lib/format";
import { clamp } from "@/lib/utils";

/** Pure fight-camp arithmetic for the fighter's Today hero. Safe for Server and Client Components. */

const DAY_MS = 86_400_000;
/** Camp length assumed when there is no fight-camp plan to date it from. */
export const DEFAULT_CAMP_DAYS = 56;
/** Fight week starts this many days before the bout. */
export const FIGHT_WEEK_DAYS = 6;

export interface CampTimeline {
    /** Academy calendar days until fight night, never negative. */
    daysToGo: number;
    /** Camp start (ISO): the camp plan's start, or an estimate counted back from the bout. */
    start: string;
    estimatedStart: boolean;
    /** Camp length in days, at least 1. */
    campDays: number;
    /** 1-based day of camp today; 0 before the camp starts. */
    campDay: number;
    /** Days until an estimated or planned camp starts; 0 once it has. */
    daysToStart: number;
    fightWeek: string;
    /** Position of today and of fight week along the camp, 0–100. */
    progressPct: number;
    fightWeekPct: number;
}

export function campTimeline(bout: Pick<UpcomingBout, "date">, campStart: string | null, now: string): CampTimeline {
    const start = campStart ?? new Date(Date.parse(bout.date) - DEFAULT_CAMP_DAYS * DAY_MS).toISOString();
    const campDays = Math.max(1, daysBetween(start, bout.date));
    const campDay = clamp(daysBetween(start, now) + 1, 0, campDays);
    const fightWeek = new Date(Date.parse(bout.date) - FIGHT_WEEK_DAYS * DAY_MS).toISOString();
    return {
        daysToGo: Math.max(0, daysBetween(now, bout.date)),
        start,
        estimatedStart: campStart === null,
        campDays,
        campDay,
        daysToStart: Math.max(0, daysBetween(now, start)),
        fightWeek,
        progressPct: Math.round((campDay / campDays) * 100),
        fightWeekPct: Math.round((clamp(daysBetween(start, fightWeek), 0, campDays) / campDays) * 100),
    };
}

/** "Fight camp · Day 29 of 69", "Est. camp day 12 of 56" or "Camp starts in 5 days". */
export function campDayLabel(timeline: CampTimeline): string {
    if (timeline.campDay === 0) return `Camp starts in ${timeline.daysToStart} ${timeline.daysToStart === 1 ? "day" : "days"}`;
    return `${timeline.estimatedStart ? "Est. camp day" : "Fight camp · Day"} ${timeline.campDay} of ${timeline.campDays}`;
}
