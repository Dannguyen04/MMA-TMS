import type { Locale } from "@/lib/i18n/config";
import type { ClearanceState } from "@/lib/domain/rules";
import { isDueSession } from "@/lib/domain/training-plan";
import type { Exercise, MedicalClearance, SessionExercise, TrainingPlan, TrainingProgress, TrainingSession } from "@/lib/domain/types";
import { addDaysToKey, dayKey, formatClock, isDateKey, pluralize } from "@/lib/format";
import { sortItems, type SortDirection } from "@/lib/query";
import { createTranslator, plural, type MessageKey, type Translator } from "@/lib/i18n/translate";
import { clamp } from "@/lib/utils";

/**
 * Pure helpers for the training screens. Safe for Server and Client Components.
 */

const MINUTE_MS = 60_000;

/** Middle of the 1–10 RPE scale: where an intensity input starts when nothing was planned. */
export const MID_RPE = 5;

/** When a session is planned to end, in ms. A session with no planned length counts as ending when it starts. */
export function plannedEndMs(session: Pick<TrainingSession, "scheduledAt" | "durationMin">): number {
    return Date.parse(session.scheduledAt) + (session.durationMin ?? 0) * MINUTE_MS;
}

/** Minutes a session took, or was planned to take, for totals; 0 when neither is known. */
export function sessionMinutes(session: Pick<TrainingSession, "durationMin" | "result">): number {
    return session.result?.actualDurationMin ?? session.durationMin ?? 0;
}

/** "RPE 7 · Hard", or null when no intensity was set. */
/** `rpeText` in the viewer's language. */
export function rpeTextFor(t: Translator, rpe: number | null): string | null {
    if (rpe === null) return null;
    const step = clamp(Math.round(rpe), 1, 10);
    return t("rpe.text", { n: rpe, label: t(`rpe.${step}` as MessageKey) });
}

export function rpeText(rpe: number | null): string | null {
    return rpe === null ? null : `RPE ${rpe} · ${rpeLabel(rpe)}`;
}

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

export function describeWeekOffset(offset: number, locale: Locale = "en"): string {
    const t = createTranslator(locale);
    if (offset === 0) return t("training.weekNav.thisWeek");
    if (offset === 1) return t("training.weekNav.nextWeek");
    if (offset === -1) return t("training.weekNav.lastWeek");
    return offset > 0 ? plural(t, "training.weekNav.inWeeks", offset) : plural(t, "training.weekNav.weeksAgo", -offset);
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

/** Verbal anchor for a session RPE (1–10), in the viewer's language when `t` is given. */
export function rpeLabel(rpe: number, t?: Translator): string {
    const step = clamp(Math.round(rpe), 1, 10);
    return t ? t(`rpe.${step}` as MessageKey) : RPE_LABELS[step - 1];
}

/* ─── Exercises ───────────────────────────────────────────────────────────── */

/** "6 × 3:00" for rounds, "4 × 8 reps" for sets, or null when no volume is set; in the viewer's language when `t` is given. */
export function exerciseVolume(item: Pick<SessionExercise, "rounds" | "roundSec" | "sets" | "reps">, t?: Translator): string | null {
    if (item.rounds !== null) {
        if (item.roundSec !== null) return `${item.rounds} × ${formatClock(item.roundSec)}`;
        return t ? plural(t, "screens.training.volume.rounds", item.rounds) : pluralize(item.rounds, "round");
    }
    if (item.sets !== null) {
        if (item.reps !== null) return t ? t("screens.training.volume.setsReps", { sets: item.sets, reps: item.reps }) : `${item.sets} × ${item.reps} reps`;
        return t ? plural(t, "screens.training.volume.sets", item.sets) : pluralize(item.sets, "set");
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
            minutes: completed.reduce((total, s) => total + sessionMinutes(s), 0),
        });
    }
    return Number.isFinite(maxWeeks) ? weeks.slice(-maxWeeks) : weeks;
}

/**
 * Every week of a plan from its start to today (or its end, when that is earlier), counting due sessions,
 * so the weekly totals add up to `planAdherence` for the same sessions.
 */
export function planAdherenceWeeks(plan: Pick<TrainingPlan, "startDate" | "endDate">, sessions: TrainingSession[], now: string): WeeklyAdherence[] {
    const last = plan.endDate !== null && plan.endDate < now ? plan.endDate : now;
    return weeklyAdherence(sessions, dayKey(plan.startDate), dayKey(last), { maxWeeks: Number.POSITIVE_INFINITY, now });
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
