import { addDaysToKey, daysBetweenKeys } from "@/lib/format";

import type { SessionStatus, TrainingType } from "./types";

/** Recorded facts the camp timeline draws. Every date is an academy date key (YYYY-MM-DD). */
export interface CampTimelineInput {
    startOn: string;
    weighInOn: string;
    boutOn: string;
    todayOn: string;
    /** Fight week ends on weigh-in day and is this many days long. */
    fightWeekDays: number;
    sessions: { id: string; title: string; type: TrainingType; status: SessionStatus; on: string }[];
    suspensions: { id: string; from: string; to: string }[];
}

export interface CampTimelineSession {
    id: string;
    title: string;
    type: TrainingType;
    status: SessionStatus;
    on: string;
    /** Horizontal position in percent of the camp. */
    at: number;
    /** 0 for the first session of a day, 1 for the second… */
    lane: number;
}

export interface CampTimelineModel {
    totalDays: number;
    /** Today's position, or null when today is outside the camp. */
    todayAt: number | null;
    fightWeek: { from: number; to: number; fromOn: string };
    weighInAt: number;
    boutAt: number;
    sessions: CampTimelineSession[];
    suspensions: { id: string; from: number; to: number; fromOn: string; toOn: string }[];
    lanes: number;
    /** Days left until the bout; negative once it is over. */
    daysToBout: number;
    week: number;
    weeks: number;
    counts: { done: number; upcoming: number; missed: number };
}

const clampPct = (value: number) => Math.min(100, Math.max(0, value));

/** Positions for the camp timeline: the camp from its start to bout day, the fight week, sessions and suspensions. */
export function campTimeline(input: CampTimelineInput): CampTimelineModel {
    const totalDays = Math.max(1, daysBetweenKeys(input.startOn, input.boutOn));
    const at = (on: string) => clampPct((daysBetweenKeys(input.startOn, on) / totalDays) * 100);
    const inCamp = (on: string) => on >= input.startOn && on <= input.boutOn;
    const fightWeekFromOn = addDaysToKey(input.weighInOn, -Math.max(0, input.fightWeekDays - 1));

    const perDay = new Map<string, number>();
    const sessions = input.sessions
        .filter((session) => inCamp(session.on))
        .sort((a, b) => (a.on === b.on ? a.id.localeCompare(b.id) : a.on < b.on ? -1 : 1))
        .map((session) => {
            const lane = perDay.get(session.on) ?? 0;
            perDay.set(session.on, lane + 1);
            return { ...session, at: at(session.on), lane };
        });

    const suspensions = input.suspensions
        .filter((item) => item.to >= input.startOn && item.from <= input.boutOn)
        .map((item) => ({ id: item.id, from: at(item.from), to: at(item.to), fromOn: item.from, toOn: item.to }));

    const elapsed = daysBetweenKeys(input.startOn, input.todayOn);
    return {
        totalDays,
        todayAt: inCamp(input.todayOn) ? at(input.todayOn) : null,
        fightWeek: { from: at(fightWeekFromOn), to: at(input.weighInOn), fromOn: fightWeekFromOn },
        weighInAt: at(input.weighInOn),
        boutAt: 100,
        sessions,
        suspensions,
        lanes: Math.max(1, ...perDay.values()),
        daysToBout: daysBetweenKeys(input.todayOn, input.boutOn),
        week: Math.min(Math.max(1, Math.floor(elapsed / 7) + 1), Math.ceil(totalDays / 7)),
        weeks: Math.ceil(totalDays / 7),
        counts: {
            done: sessions.filter((session) => session.status === "completed").length,
            upcoming: sessions.filter((session) => (session.status === "scheduled" || session.status === "in_progress") && session.on >= input.todayOn).length,
            missed: sessions.filter((session) => session.status === "missed").length,
        },
    };
}
