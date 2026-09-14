import type { ClearanceState } from "@/lib/domain/rules";
import { isDueSession } from "@/lib/domain/training-plan";
import type { Exercise, MedicalClearance, SessionExercise, TrainingPlan, TrainingProgress, TrainingSession } from "@/lib/domain/types";
import { addDaysToKey, dayKey, formatClock, isDateKey, pluralize } from "@/lib/format";
import { sortItems, type SortDirection } from "@/lib/query";
import { clamp } from "@/lib/utils";

/**
 * Pure helpers for the training screens. Safe for Server and Client Components.
 */

/** Monday (academy calendar) of the week containing `now`, shifted by `offset` weeks. */
export function weekStartKey(now: string | Date, offset = 0): string {
    const key = dayKey(now);
    const weekday = new Date(`${key}T12:00:00Z`).getUTCDay();
    const toMonday = weekday === 0 ? -6 : 1 - weekday;
    return addDaysToKey(key, toMonday + offset * 7);
}

export const MAX_WEEK_OFFSET = 26;

/** Reads ?week= as a whole number of weeks from the current week. */
export function parseWeekOffset(value: string | undefined): number {
    const parsed = Number.parseInt(value ?? "", 10);
    return Number.isNaN(parsed) ? 0 : clamp(parsed, -MAX_WEEK_OFFSET, MAX_WEEK_OFFSET);
}

export function describeWeekOffset(offset: number): string {
    if (offset === 0) return "This week";
    if (offset === 1) return "Next week";
    if (offset === -1) return "Last week";
    return offset > 0 ? `In ${pluralize(offset, "week")}` : `${pluralize(-offset, "week")} ago`;
}

/* ─── Intensity ───────────────────────────────────────────────────────────── */

const RPE_LABELS = [
    "Very light",
    "Light",
    "Light",
    "Moderate",
    "Moderate",
    "Somewhat hard",
    "Hard",
    "Very hard",
    "Extremely hard",
    "Maximal",
] as const;

/** Verbal anchor for a session RPE (1–10). */
export function rpeLabel(rpe: number): string {
    return RPE_LABELS[clamp(Math.round(rpe), 1, 10) - 1];
}

/* ─── Exercises ───────────────────────────────────────────────────────────── */

/** "6 × 3:00" for rounds, "4 × 8 reps" for sets, or null when no volume is set. */
export function exerciseVolume(item: Pick<SessionExercise, "rounds" | "roundSec" | "sets" | "reps">): string | null {
    if (item.rounds !== null) {
        return item.roundSec !== null ? `${item.rounds} × ${formatClock(item.roundSec)}` : pluralize(item.rounds, "round");
    }
    if (item.sets !== null) {
        return item.reps !== null ? `${item.sets} × ${item.reps} reps` : pluralize(item.sets, "set");
    }
    return null;
}

/** Whether an exercise is dosed in timed rounds (otherwise sets × reps). */
export function isRoundBased(exercise: Pick<Exercise, "defaultRounds" | "defaultSets">): boolean {
    return exercise.defaultRounds !== null || exercise.defaultSets === null;
}

/* ─── Plans ───────────────────────────────────────────────────────────────── */

export { planAdherence, planAdherencePct, planTimeline, type PlanAdherence, type PlanTimeline } from "@/lib/domain/training-plan";

export interface WeeklyAdherence {
    /** Monday of the week, YYYY-MM-DD. */
    weekStart: string;
    /** Non-cancelled sessions scheduled that week, including ones still ahead. */
    planned: number;
    /** Planned sessions that were due (scheduled at or before now). Undefined when session times aren't known. */
    due?: number;
    completed: number;
    missed: number;
    minutes: number;
}

export interface WeeklyAdherenceOptions {
    /** Keep only the most recent weeks. */
    maxWeeks?: number;
    /** Server time (ISO). When given, each week also counts its due sessions. */
    now?: string;
}

/** Planned (non-cancelled) vs completed sessions per Monday–Sunday week, from `fromKey` to `toKey` (inclusive weeks). */
export function weeklyAdherence(sessions: TrainingSession[], fromKey: string, toKey: string, { maxWeeks = 12, now }: WeeklyAdherenceOptions = {}): WeeklyAdherence[] {
    const first = weekStartKey(`${fromKey}T12:00:00Z`);
    const last = weekStartKey(`${toKey}T12:00:00Z`);
    const weeks: WeeklyAdherence[] = [];
    for (let key = first; key <= last; key = addDaysToKey(key, 7)) {
        const end = addDaysToKey(key, 7);
        const planned = sessions.filter((s) => {
            const day = dayKey(s.scheduledAt);
            return s.status !== "cancelled" && day >= key && day < end;
        });
        const completed = planned.filter((s) => s.status === "completed");
        weeks.push({
            weekStart: key,
            planned: planned.length,
            due: now === undefined ? undefined : planned.filter((s) => isDueSession(s, now)).length,
            completed: completed.length,
            missed: planned.filter((s) => s.status === "missed").length,
            minutes: completed.reduce((total, s) => total + (s.result?.actualDurationMin ?? s.durationMin), 0),
        });
    }
    return Number.isFinite(maxWeeks) ? weeks.slice(-maxWeeks) : weeks;
}

/**
 * Every week of a plan from its start to today (or its end, when that is earlier), counting due sessions,
 * so the weekly totals add up to `planAdherence` for the same sessions.
 */
export function planAdherenceWeeks(plan: Pick<TrainingPlan, "startDate" | "endDate">, sessions: TrainingSession[], now: string): WeeklyAdherence[] {
    return weeklyAdherence(sessions, dayKey(plan.startDate), dayKey(plan.endDate < now ? plan.endDate : now), { maxWeeks: Number.POSITIVE_INFINITY, now });
}

/** The last `weeks` academy weeks up to and including the current one, counting due sessions. */
export function recentAdherenceWeeks(sessions: TrainingSession[], now: string, weeks = 8): WeeklyAdherence[] {
    const today = dayKey(now);
    return weeklyAdherence(sessions, addDaysToKey(today, -(weeks - 1) * 7), today, { maxWeeks: weeks, now });
}

/** Adapts the service's weekly progress (UTC week starts) to academy calendar weeks. */
export function fromTrainingProgress(progress: TrainingProgress[]): WeeklyAdherence[] {
    return progress.map((week) => ({
        weekStart: dayKey(week.weekStart),
        planned: week.plannedSessions,
        completed: week.completedSessions,
        missed: week.missedSessions,
        minutes: week.trainingMinutes,
    }));
}

/* ─── Sessions ────────────────────────────────────────────────────────────── */

export const SESSION_SORT_KEYS = ["date", "title", "type", "fighter", "duration", "rpe", "rating", "status"] as const;
export type SessionSortKey = (typeof SESSION_SORT_KEYS)[number];

export function sortSessions(
    sessions: TrainingSession[],
    key: SessionSortKey,
    direction: SortDirection,
    fighterNames: Record<string, string> = {},
): TrainingSession[] {
    const accessors: Record<SessionSortKey, (s: TrainingSession) => string | number | null> = {
        date: (s) => s.scheduledAt,
        title: (s) => s.title,
        type: (s) => s.type,
        fighter: (s) => fighterNames[s.fighterId] ?? s.fighterId,
        duration: (s) => s.result?.actualDurationMin ?? s.durationMin,
        rpe: (s) => s.result?.rpe ?? null,
        rating: (s) => s.result?.coachRating ?? null,
        status: (s) => s.status,
    };
    return sortItems(sessions, accessors[key], direction);
}

/** True when `day` (YYYY-MM-DD) falls inside optional inclusive bounds. */
export function withinDayRange(day: string, from: string | undefined, to: string | undefined): boolean {
    return (!isDateKey(from) || day >= from) && (!isDateKey(to) || day <= to);
}

/* ─── Clearance ───────────────────────────────────────────────────────────── */

/** Clearance data a form or card needs for one fighter. Serializable. */
export interface ClearanceSummary {
    clearance: MedicalClearance | null;
    state: ClearanceState;
    doctorName?: string;
}

/** The lowest RPE cap across a clearance's restrictions, if any. */
export function clearanceMaxRpe(summary: ClearanceSummary | undefined): number | null {
    if (!summary?.clearance || summary.state !== "restricted") return null;
    const caps = summary.clearance.restrictions.map((r) => r.maxRpe).filter((cap): cap is number => cap !== null);
    return caps.length > 0 ? Math.min(...caps) : null;
}
