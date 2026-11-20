import type { CampBout, Suspension } from "@/features/fight-camp/api";
import type { TrainingPlan, TrainingSession } from "@/api/types";
import type { AiJob } from "@/api/video/video-ai.types";
import { fighterHome as t } from "@/i18n/fighter/fighter-home";
import { academyTime, addDays, dateKey } from "@/components/schedule/week-model";
import { liveSuspensions, sessionNames } from "@/features/fight-camp/logic/camp-rules";

/** Pure rules for the fighter home (REDESIGN-BRIEF-2026-11.md "Fighter home"). */

const dd = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;
const OPEN: readonly CampBout["status"][] = ["SCHEDULED", "CAMP", "FIGHT_WEEK", "WEIGHED_IN"];
/** The fighter's nearest open bout: the spotlight while they are in a fight camp. */
export function nearestBout(bouts: readonly CampBout[]): CampBout | null {
  return [...bouts].filter(b => OPEN.includes(b.status)).sort((a, b) => a.boutAt.localeCompare(b.boutAt))[0] ?? null;
}

export type WeightLine = { label: string; value: string; danger: boolean };
/** "Cân hôm qua · 77,6 kg · vượt 0,6 kg" in words; null when unknown. */
export function weightLine(latestKg: number | null, latestOn: string | null, limitKg: number, today: string): WeightLine {
  if (latestKg == null || !latestOn) return { label: t.lastWeight(t.weighedToday), value: t.noWeight, danger: true };
  const when = latestOn === today ? t.weighedToday : latestOn === addDays(today, -1) ? t.weighedYesterday : t.weighedOn(dd(latestOn));
  const over = Math.round((latestKg - limitKg) * 10) / 10;
  const kg = (n: number) => n.toFixed(1).replace(".", ",");
  return { label: t.lastWeight(when), value: `${kg(latestKg)} kg · ${over > 0 ? t.over(kg(over)) : t.within}`, danger: over > 0 };
}

/** Upcoming scheduled sessions, earliest first. */
export function upcoming(sessions: readonly TrainingSession[], now: Date): TrainingSession[] {
  return sessions.filter(s => s.status === "SCHEDULED" && Date.parse(s.scheduledAt) >= now.getTime() - 30 * 60_000)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
}
/** "T5 07:30 · Thể lực" for a later session. */
export function shortSession(s: TrainingSession, typeLabel: (t: string) => string): string {
  const d = new Date(Date.parse(s.scheduledAt) + 7 * 3_600_000).getUTCDay();
  const dow = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][d];
  return `${dow} ${academyTime(s.scheduledAt)} · ${typeLabel(s.sessionType)}`;
}

export type Health = { mark: "ok" | "warn"; line: string };
/** Suspension in force wins; then the doctor's training eligibility. Unknown eligibility counts as cleared only if no suspension. */
export function healthLine(suspensions: readonly Suspension[] | null, trainingEligible: boolean | null): Health | null {
  const live = suspensions ? liveSuspensions(suspensions).filter(s => s.status === "ACTIVE" || s.status === "AWAITING_CLEARANCE") : [];
  const s = live[0];
  if (s) {
    if (s.status === "AWAITING_CLEARANCE") return { mark: "warn", line: t.awaiting };
    const blocked = s.blockedSessionTypes.map(x => sessionNames[x] ?? x);
    const extra = blocked.includes(sessionNames.SPARRING) ? ` · ${t.noSparring(sessionNames.SPARRING)}` : "";
    return { mark: "warn", line: `${t.suspendedUntil(dd(s.endsOn))}${extra}` };
  }
  if (trainingEligible === false) return { mark: "warn", line: t.notCleared };
  if (trainingEligible === true) return { mark: "ok", line: t.cleared };
  return null;
}

export type PlanLine = { lead: string | null; line: string };
/**
 * The active plan. The big lead is the completion % when the API has it, otherwise the week "a/b" from the plan dates
 * (owner 2026-11-11: no lone placeholder in the number column); the line is the name, plus the week when the lead is %.
 */
export function planLine(plans: readonly TrainingPlan[], today: string): PlanLine | null {
  const p = plans.find(x => x.status === "ACTIVE") ?? null;
  if (!p) return null;
  let week: string | null = null;
  if (p.endDate) {
    const total = Math.max(1, Math.ceil((Date.parse(p.endDate.slice(0, 10)) - Date.parse(p.startDate.slice(0, 10)) + 86_400_000) / (7 * 86_400_000)));
    const now = Math.min(total, Math.max(1, Math.floor((Date.parse(today) - Date.parse(p.startDate.slice(0, 10))) / (7 * 86_400_000)) + 1));
    week = `${now}/${total}`;
  }
  if (p.progress) return { lead: `${Math.round(p.progress.completionPercentage)}%`, line: week ? `${p.title} · tuần ${week}` : p.title };
  return { lead: week, line: week ? `${p.title} · ${t.thisWeek}` : p.title };
}

/** Video jobs of the last 7 days, newest first; the line describes the newest one. */
export function videoLine(jobs: readonly AiJob[], now: Date): { count: number; line: string | null } {
  const since = dateKey(new Date(now.getTime() - 7 * 86_400_000));
  const recent = [...jobs].filter(j => dateKey(j.createdAt) >= since).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const j = recent[0];
  if (!j) return { count: 0, line: null };
  const status = j.status === "DONE" && j.alertCount ? t.alerts(j.alertCount) : t.jobStatus[j.status] ?? j.status;
  return { count: recent.length, line: [j.exerciseName || t.videoDefault, dd(dateKey(j.createdAt)), status].join(" · ") };
}
