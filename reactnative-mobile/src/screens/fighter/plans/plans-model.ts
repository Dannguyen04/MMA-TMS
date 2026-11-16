import type { TrainingPlan, TrainingPlanExercise, TrainingSession } from "@/api/types";
import { fighterPlans as t } from "@/i18n/fighter-plans";

/** Phases that belong to a bout: a plan in one of these is "the bout's plan" while a bout is open. */
const BOUT_PHASES = new Set(["fight_camp", "taper", "rehab"]);
const DAY = 86_400_000;

const day = (iso: string) => iso.slice(0, 10);
/** "dd/mm" from an ISO date or date-time. */
export const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
/** "dd/mm/yyyy". */
export const dmy = (iso: string) => `${dm(iso)}/${iso.slice(0, 4)}`;

/**
 * The plan the spotlight shows (owner 2026-11-11): with an open bout, the active plan in a bout phase
 * (fight_camp / taper / rehab); otherwise, or when none is in such a phase, the active plan that started last.
 */
export function currentPlan(plans: readonly TrainingPlan[], hasBout: boolean): TrainingPlan | null {
  const active = plans.filter(p => p.status === "ACTIVE").sort((a, b) => b.startDate.localeCompare(a.startDate));
  if (!active.length) return null;
  if (hasBout) return active.find(p => BOUT_PHASES.has(p.phase)) ?? active[0];
  return active[0];
}

/** The plan's week today, 1-based and clamped; null without an end date. */
export function planWeek(plan: Pick<TrainingPlan, "startDate" | "endDate">, today: string): { now: number; total: number } | null {
  if (!plan.endDate) return null;
  const start = Date.parse(day(plan.startDate));
  const total = Math.max(1, Math.ceil((Date.parse(day(plan.endDate)) - start + DAY) / (7 * DAY)));
  const now = Math.min(total, Math.max(1, Math.floor((Date.parse(today) - start) / (7 * DAY)) + 1));
  return { now, total };
}

/** Lead of another plan's row: "a/b" week while active, "✓" when done, "–" otherwise. */
export function rowLead(plan: TrainingPlan, today: string): { text: string; sub?: string; done?: boolean } {
  if (plan.status === "COMPLETED") return { text: "✓", done: true };
  if (plan.status !== "ACTIVE") return { text: "–" };
  const w = planWeek(plan, today);
  return w ? { text: String(w.now), sub: `/${w.total}` } : { text: "–" };
}

/** "dd/mm – dd/mm" (or just the start). */
export function shortRange(plan: Pick<TrainingPlan, "startDate" | "endDate">): string {
  return plan.endDate ? `${dm(plan.startDate)} – ${dm(plan.endDate)}` : dm(plan.startDate);
}

/** The plan's next session that is still scheduled, from now. */
export function nextPlanSession(sessions: readonly TrainingSession[], planId: string, now: Date): TrainingSession | null {
  const iso = now.toISOString();
  return [...sessions]
    .filter(s => s.planId === planId && s.status === "SCHEDULED" && s.scheduledAt >= iso)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0] ?? null;
}

/** "5 hiệp · 25 phút · RPE 8" (time is the total), "4 × 6 · RPE 8", "10 phút · RPE 3". Empty when the coach set nothing. */
export function dose(row: Pick<TrainingPlanExercise, "sets" | "reps" | "durationSeconds" | "targetRpe">): string {
  const time = row.durationSeconds != null ? duration(row.durationSeconds) : null;
  const main = row.sets != null && row.reps != null ? t.sets(row.sets, row.reps)
    : row.sets != null && time ? t.setsTime(row.sets, time)
    : time ?? (row.sets != null ? t.setsOnly(row.sets) : null);
  return [main, row.targetRpe != null ? t.rpe(row.targetRpe) : null].filter(Boolean).join(" · ");
}

function duration(sec: number): string {
  if (sec < 60) return t.seconds(sec);
  const min = Math.round((sec / 60) * 10) / 10;
  return t.minutes(String(min).replace(".", ","));
}
