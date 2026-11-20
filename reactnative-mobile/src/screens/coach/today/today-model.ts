import type { ReadinessRow, TodoItem, TodoSource } from "@/api/coach-today";
import type { CampBout, CampDetail } from "@/features/fight-camp/api";
import type { MedicalStatus } from "@/api/types";
import { todayText as t } from "@/i18n/coach-today";
import { gate1, kg } from "@/features/fight-camp/logic/camp-rules";

/** Pure rules for the coach "Hôm nay" dashboard (REDESIGN-BRIEF-2026-11.md, coach shape). */

const ZONE = "Asia/Ho_Chi_Minh";
/** Academy calendar date (YYYY-MM-DD) of an instant. */
export function academyDate(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("en-CA", { timeZone: ZONE });
}
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}
/** dd/mm of a date-only or ISO value. */
export function shortDate(value: string): string {
  const day = value.length === 10 ? value : academyDate(value);
  const [, m, d] = day.split("-");
  return `${d}/${m}`;
}

export const DONE: readonly CampBout["status"][] = ["COMPLETED", "CANCELLED"];
/** Live bouts, nearest fight first. */
export function liveBouts(bouts: readonly CampBout[]): CampBout[] {
  return bouts.filter(b => !DONE.includes(b.status)).sort((a, b) => a.boutAt.localeCompare(b.boutAt));
}

export type Countdown = { days: number; what: "WEIGH_IN" | "BOUT"; overdue: boolean };
/**
 * Days to the official weigh-in until it is recorded, then days to the fight. A date already past while the bout is
 * still open is overdue: `days` is then how many days ago it was (weigh-in not recorded, or result not recorded).
 */
export function countdown(b: Pick<CampBout, "status" | "weighInAt" | "boutAt">, now: Date = new Date()): Countdown {
  const what = b.status === "WEIGHED_IN" ? "BOUT" : "WEIGH_IN";
  const days = daysBetween(academyDate(now), academyDate(what === "BOUT" ? b.boutAt : b.weighInAt));
  return { days: Math.abs(days), what, overdue: days < 0 };
}

export type Stage = "DETAIL" | "WEIGH" | "CORNER";
/** The one red action of the spotlight, by bout stage. */
export function stageAction(status: CampBout["status"], overdue = false): Stage {
  // After the fight date the corner card is no use: the coach needs the bout detail to finish it.
  if (overdue && status === "WEIGHED_IN") return "DETAIL";
  return status === "FIGHT_WEEK" ? "WEIGH" : status === "WEIGHED_IN" ? "CORNER" : "DETAIL";
}

export type Fact = { label: string; value: string; tone?: "danger" | "success" };
/** Weight vs limit in words. Official weight wins once recorded. */
export function weightFact(b: CampBout, detail: CampDetail | null): Fact | null {
  const limit = b.catchweightKg ?? b.weightLimitKg;
  if (b.officialWeightKg != null) {
    const ok = b.madeWeight ?? b.officialWeightKg <= limit;
    return { label: t.officialWeight, value: `${kg(b.officialWeightKg)} kg · ${ok ? t.made : t.missed}`, tone: ok ? "success" : "danger" };
  }
  if (!detail) return null;
  const latest = detail.weight.latestKg;
  if (latest == null) return { label: t.latestWeight, value: t.notWeighed, tone: "danger" };
  const over = Math.round((latest - limit) * 10) / 10;
  return over > 0
    ? { label: t.latestWeight, value: `${kg(latest)} kg · ${t.over(kg(over))}`, tone: "danger" }
    : { label: t.latestWeight, value: `${kg(latest)} kg · ${t.within}`, tone: "success" };
}
export function paperworkFact(detail: CampDetail | null): Fact | null {
  if (!detail) return null;
  const gate = gate1(detail.requirements, detail.boutAt);
  const open = gate.missing.length + gate.expiring.length;
  return open ? { label: t.paperwork, value: t.paperworkMissing(open), tone: "danger" } : { label: t.paperwork, value: t.paperworkOk, tone: "success" };
}

/** Late or unsafe rather than merely due (same set as the website card). */
export const URGENT: ReadonlySet<TodoSource> = new Set<TodoSource>([
  "REQUIREMENTS_OVERDUE", "WEIGHT_OVER_LIMIT", "RESULT_OVERDUE", "WEIGHT_NOT_LOGGED",
  "SUSPENSION_AWAITING_CLEARANCE", "TRAINING_CONFLICTS_WITH_SUSPENSION",
]);
export function todoText(item: TodoItem): string {
  return t.todo[item.source]
    .replace("{count}", String(item.count ?? 0))
    .replace("{date}", item.dueOn ? shortDate(item.dueOn) : "");
}
/** Urgent first, then the server order. */
export function sortTodo(items: readonly TodoItem[]): TodoItem[] {
  return [...items].sort((a, b) => Number(URGENT.has(b.source)) - Number(URGENT.has(a.source)));
}

export type PersonRow = { fighterId: string; name: string; why: string | null; tone?: "danger" };
/** Medical statuses that rule a fighter out of a bout even when no suspension is open. */
const MEDICALLY_OUT: ReadonlySet<MedicalStatus> = new Set<MedicalStatus>(["INJURED", "NOT_CLEARED"]);
/**
 * READY from /readiness only means "no open suspension"; a fighter the doctor has not cleared (or who is injured)
 * is not ready for a bout, so the fighter list's medical status removes them here. Without the list, READY stands.
 */
export function readyRows(rows: readonly ReadinessRow[], fighters: readonly FighterLite[] | null = null): PersonRow[] {
  const out = new Set((fighters ?? []).filter(f => MEDICALLY_OUT.has(f.medicalStatus)).map(f => f.id));
  return rows.filter(r => r.status === "READY" && !out.has(r.fighterId)).map(r => ({
    fighterId: r.fighterId, name: r.fighterName,
    why: r.gradedReturn ? t.gradedReturn(shortDate(r.gradedReturn.fullReturnOn)) : null,
  }));
}

/** Medical statuses that need the coach's eye (brief: not cleared, watch, active injury). */
const MEDICAL_ATTENTION: Partial<Record<MedicalStatus, string>> = {
  NOT_CLEARED: t.attention.NOT_CLEARED, INJURED: t.attention.INJURED, MONITORING: t.attention.MONITORING,
};
export type FighterLite = { id: string; name: string; medicalStatus: MedicalStatus };
/**
 * Suspended or awaiting clearance (readiness) and medical flags (fighter list), one row per fighter, suspension first.
 * Either source may be missing; the other still counts.
 */
export function attentionRows(readiness: readonly ReadinessRow[] | null, fighters: readonly FighterLite[] | null): PersonRow[] {
  const out = new Map<string, PersonRow>();
  for (const r of readiness ?? []) {
    if (r.status === "SUSPENDED") {
      // Open-ended (needs clearance) has no resume date: say "suspended" without a date.
      const until = r.suspension?.expectedResumeOn ? r.suspension.endsOn : null;
      out.set(r.fighterId, { fighterId: r.fighterId, name: r.fighterName, why: until ? t.attention.SUSPENDED_UNTIL(shortDate(until)) : t.attention.SUSPENDED, tone: "danger" });
    } else if (r.status === "AWAITING_CLEARANCE") {
      out.set(r.fighterId, { fighterId: r.fighterId, name: r.fighterName, why: t.attention.AWAITING_CLEARANCE, tone: "danger" });
    }
  }
  for (const f of fighters ?? []) {
    const why = MEDICAL_ATTENTION[f.medicalStatus];
    if (!why || out.has(f.id)) continue;
    out.set(f.id, { fighterId: f.id, name: f.name, why, tone: f.medicalStatus === "MONITORING" ? undefined : "danger" });
  }
  return [...out.values()];
}
