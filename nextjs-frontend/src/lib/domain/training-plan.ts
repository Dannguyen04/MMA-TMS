import { daysBetween, pluralize } from "@/lib/format";
import { clamp } from "@/lib/utils";
import type { TrainingPlan, TrainingSession } from "./types";

/* ─── Timeline ────────────────────────────────────────────────────────────── */

export interface PlanTimeline {
    /** Share of the plan window that has passed, 0–100. */
    elapsedPct: number;
    /** "Starts in 3 days", "Week 3 of 8 · 40 days left" or "Finished". */
    text: string;
}

/** Elapsed share of the plan window and a short phrase such as "Week 3 of 8 · 40 days left". */
export function planTimeline(plan: Pick<TrainingPlan, "startDate" | "endDate" | "status">, now: string): PlanTimeline {
    const totalDays = Math.max(1, daysBetween(plan.startDate, plan.endDate));
    const elapsedDays = daysBetween(plan.startDate, now);
    if (elapsedDays < 0) {
        const days = -elapsedDays;
        return { elapsedPct: 0, text: days === 1 ? "Starts tomorrow" : `Starts in ${pluralize(days, "day")}` };
    }
    if (elapsedDays > totalDays || plan.status === "completed") return { elapsedPct: 100, text: "Finished" };
    const weeks = Math.max(1, Math.ceil(totalDays / 7));
    const week = clamp(Math.floor(elapsedDays / 7) + 1, 1, weeks);
    return {
        elapsedPct: Math.round((elapsedDays / totalDays) * 100),
        text: `Week ${week} of ${weeks} · ${pluralize(totalDays - elapsedDays, "day")} left`,
    };
}

/* ─── Adherence ───────────────────────────────────────────────────────────── */

export interface PlanAdherence {
    /** Sessions scheduled at or before now, cancelled ones excluded. */
    due: number;
    /** Due sessions that were completed. */
    completed: number;
    /** completed / due, rounded, 0–100. */
    pct: number;
}

/** Whether a session counts towards adherence at `now`: it was due and not cancelled. */
export function isDueSession(session: Pick<TrainingSession, "status" | "scheduledAt">, now: string): boolean {
    return session.status !== "cancelled" && session.scheduledAt <= now;
}

/**
 * Adherence as every training screen reports it: completed sessions out of the sessions that were due
 * by `now`. Upcoming sessions never count against the fighter. Null when nothing is due yet.
 */
export function planAdherence(sessions: Pick<TrainingSession, "status" | "scheduledAt">[], now: string): PlanAdherence | null {
    const due = sessions.filter((session) => isDueSession(session, now));
    if (due.length === 0) return null;
    const completed = due.filter((session) => session.status === "completed").length;
    return { due: due.length, completed, pct: Math.round((completed / due.length) * 100) };
}

/** Completed share of the sessions due by `now`, 0–100; undefined when nothing is due yet. */
export function planAdherencePct(sessions: Pick<TrainingSession, "status" | "scheduledAt">[], now: string): number | undefined {
    return planAdherence(sessions, now)?.pct;
}
