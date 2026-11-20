import type { DoctorScheduleItem } from "@/api/doctor/schedule";
import type { Suspension } from "@/features/fight-camp/api";
import type { PublicFighter } from "@/api/types";
import type { AnalysisJob } from "@/api/video/media";
import { doctorToday as t } from "@/i18n/doctor/doctor-today";
import { dateKey } from "@/components/schedule/week-model";

/** Pure rules for doctor "Hôm nay" (REDESIGN-BRIEF-2026-11.md). */

export const nameOf = (f: Pick<PublicFighter, "firstName" | "lastName">) => `${f.firstName} ${f.lastName}`.trim();
const dd = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

export type Pending = { suspension: Suspension; fighterId: string; name: string; wait: number; line: string };
/** Waiting 2+ days is urgent (red tag). */
export const URGENT_WAIT = 2;
/**
 * Suspensions waiting for the doctor's clearance, longest wait first. The wait counts from the day after endsOn
 * (the first day the fighter could have trained again).
 */
export function pendingClearances(list: readonly Suspension[], names: ReadonlyMap<string, string>, today: string): Pending[] {
  return list
    .filter(s => s.status === "AWAITING_CLEARANCE" && !s.clearedAt && s.fighterId)
    .map(s => ({
      suspension: s, fighterId: s.fighterId!, name: names.get(s.fighterId!) ?? t.fighterFallback,
      wait: Math.max(0, daysBetween(s.endsOn, today)),
      line: t.ended(t.reason[s.reason] ?? s.reason, dd(s.endsOn)),
    }))
    .sort((a, b) => b.wait - a.wait || a.name.localeCompare(b.name));
}

export type TodayKind = "follow" | "expire" | "weigh";
const KIND: Partial<Record<DoctorScheduleItem["kind"], TodayKind>> = { FOLLOW_UP: "follow", CLEARANCE_EXPIRY: "expire", WEIGH_IN: "weigh" };
export function todayGroups(items: readonly DoctorScheduleItem[], today: string): Record<TodayKind, DoctorScheduleItem[]> {
  const out: Record<TodayKind, DoctorScheduleItem[]> = { follow: [], expire: [], weigh: [] };
  for (const x of items) {
    const k = KIND[x.kind];
    if (k && x.date === today) out[k].push(x);
  }
  return out;
}

export type Row = { key: string; fighterId: string; title: string; line: string; danger?: boolean; jobId?: string };
const WATCH_ORDER = ["NOT_CLEARED", "INJURED", "MONITORING"] as const;
/** Assigned fighters not cleared, injured or under watch, most serious first. */
export function watchRows(roster: readonly PublicFighter[]): Row[] {
  return roster
    .filter(f => (WATCH_ORDER as readonly string[]).includes(f.currentMedicalStatus))
    .sort((a, b) => WATCH_ORDER.indexOf(a.currentMedicalStatus as never) - WATCH_ORDER.indexOf(b.currentMedicalStatus as never))
    .map(f => ({ key: f.id, fighterId: f.id, title: nameOf(f), line: t.watch[f.currentMedicalStatus], danger: f.currentMedicalStatus !== "MONITORING" }));
}
/** AI video jobs that flagged a possible impairment, newest first. */
export function aiRows(jobs: readonly AnalysisJob[], names: ReadonlyMap<string, string>): Row[] {
  return jobs
    .filter(j => j.hasImpairment && j.fighterId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(j => ({
      key: j.id, jobId: j.id, fighterId: j.fighterId!, title: names.get(j.fighterId!) ?? t.fighterFallback, danger: true,
      line: [j.alertCount ? t.aiAlerts(j.alertCount) : t.aiSuspected, dd(dateKey(j.createdAt))].filter(Boolean).join(" · "),
    }));
}
export function reviewRows(items: readonly { id: string; fighterId: string; fighterName: string; reason: string; requestedAt: string; requesterName: string | null }[]): Row[] {
  return items.map(r => ({ key: r.id, fighterId: r.fighterId, title: r.fighterName, danger: true,
    line: [r.reason, r.requesterName, dd(dateKey(r.requestedAt))].filter(Boolean).join(" · ") }));
}
