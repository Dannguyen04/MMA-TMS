import type { Href } from "expo-router";

import type { PlanMilestone, TrainingPlan, TrainingPlanStatus } from "@/api/types";
import { coachPlans as t } from "@/i18n/coach/coach-plans";
import { planPct } from "@/screens/coach/readonly/ro-format";
import type { LeadTone } from "@/screens/fighter/redesign/tab-page";
import { isValidDateOnly } from "@/utils/is-valid-date-only";

/** Redesign step 17: the one plan page (it replaced `plans/[id]`); every coach link opens it. Sub-pages take `?id=`. */
export const COACH_PLAN_PATH = "/(coach)/plans/chi-tiet";
export type PlanSubPage = "sua" | "cot-moc" | "bai-tap" | "them-bai-tap";
export const coachPlanHref = (id: string): Href => ({ pathname: COACH_PLAN_PATH, params: { id } }) as unknown as Href;
export const coachPlanSubHref = (page: PlanSubPage, params: Record<string, string>): Href =>
  ({ pathname: `/(coach)/plans/${page}`, params }) as unknown as Href;

/** Row lead: progress % while active or draft with sessions, ✓ done, × cancelled, – nothing yet. */
export function planLead(plan: Pick<TrainingPlan, "status" | "progress">): { lead: string; sub?: string; tone?: LeadTone } {
  if (plan.status === "COMPLETED") return { lead: "✓", tone: "ok" };
  if (plan.status === "CANCELLED") return { lead: "×", tone: "warn" };
  if (!plan.progress?.totalSessions) return { lead: "–", tone: "dim" };
  return { lead: String(planPct(plan)), sub: "%" };
}

/** The status word and its colour: only Hoàn thành (green) and Đã hủy (red) are coloured. */
export function statusWord(s: TrainingPlanStatus): { word: string; tone?: "ok" | "warn" } {
  return { word: t.status[s], tone: s === "COMPLETED" ? "ok" : s === "CANCELLED" ? "warn" : undefined };
}

/** "21/10/2026" ⇄ "2026-10-21". `fromVnDate` returns null for an invalid or partial date. */
export const toVnDate = (iso: string | null | undefined) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");
export function fromVnDate(text: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const iso = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return isValidDateOnly(iso) ? iso : null;
}

/** `null` = empty, `undefined` = invalid. No rounding: the API rejects non-integers. */
export function parseIntField(raw: string, min: number): number | null | undefined {
  const s = raw.trim();
  if (!s) return null;
  if (!/^\d+$/.test(s)) return undefined;
  const n = Number(s);
  return Number.isSafeInteger(n) && n >= min ? n : undefined;
}

/** The milestone list with one milestone toggled, as the API takes it (completedAt only while done). */
export function toggledMilestones(list: readonly PlanMilestone[], index: number, now: string): PlanMilestone[] {
  return list.map((m, i) => {
    const done = i === index ? !m.isCompleted : !!m.isCompleted;
    const { completedAt: _drop, ...rest } = m;
    return { ...rest, isCompleted: done, ...(done ? { completedAt: i === index ? now : m.completedAt ?? now } : {}) };
  });
}
