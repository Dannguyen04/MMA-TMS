import type { DoctorScheduleItem } from "@/api/schedule";
import type { CampBout, Suspension } from "@/features/fight-camp/api";
import type { TrainingSession } from "@/api/types";
import { scheduleText as t } from "@/i18n/schedule";

/** Pure rules for the shared week schedule (REDESIGN-BRIEF-2026-11.md "Schedules"). Academy time is UTC+7. */
export type ScheduleKind = "session" | "weigh" | "fight" | "free" | "expire" | "follow";
export type ScheduleTarget =
  | { kind: "session"; id: string }
  | { kind: "bout"; id: string }
  | { kind: "fighter"; id: string };
export type ScheduleItem = {
  key: string;
  kind: ScheduleKind;
  /** Academy date YYYY-MM-DD. */
  date: string;
  /** "HH:MM" academy time, null for whole-day items. */
  time: string | null;
  title: string;
  who: string;
  target: ScheduleTarget;
};

const OFFSET = 7 * 3_600_000;
const DAY = 86_400_000;
/** Academy date of an instant. */
export function dateKey(value: string | Date): string {
  const ms = (typeof value === "string" ? Date.parse(value) : value.getTime()) + OFFSET;
  return new Date(ms).toISOString().slice(0, 10);
}
export function academyTime(value: string): string {
  return new Date(Date.parse(value) + OFFSET).toISOString().slice(11, 16);
}
export function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
}
/** Monday of the academy week that holds `date`. */
export function mondayOf(date: string): string {
  const dow = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7; // 0 = Monday
  return addDays(date, -dow);
}
export function weekDays(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}
/** dd/mm */
export const shortDay = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;
/** First instant of an academy date, for API windows. */
export const startOfDay = (date: string) => new Date(Date.parse(`${date}T00:00:00Z`) - OFFSET).toISOString();
export const endOfDay = (date: string) => new Date(Date.parse(`${addDays(date, 1)}T00:00:00Z`) - OFFSET - 1).toISOString();

/** Weigh-ins and fights matter most: they get the red dot and are never pushed out by a busy day. */
export const HOT: ReadonlySet<ScheduleKind> = new Set<ScheduleKind>(["weigh", "fight"]);
/** At most 3 dots per day (owner 2026-11-11), red first, no "+N". */
export function dayDots(items: readonly ScheduleItem[]): ("hot" | "plain")[] {
  return [...items].sort((a, b) => Number(HOT.has(b.kind)) - Number(HOT.has(a.kind))).slice(0, 3).map(x => (HOT.has(x.kind) ? "hot" : "plain"));
}
/** Whole-day items first, then by time. */
export function sortDay(items: readonly ScheduleItem[]): ScheduleItem[] {
  return [...items].sort((a, b) => Number(a.time !== null) - Number(b.time !== null) || (a.time ?? "").localeCompare(b.time ?? "") || a.title.localeCompare(b.title));
}

const OPEN_BOUT: readonly CampBout["status"][] = ["SCHEDULED", "CAMP", "FIGHT_WEEK", "WEIGHED_IN"];
const inWeek = (date: string, days: readonly string[]) => date >= days[0] && date <= days[6];

export function sessionItems(sessions: readonly TrainingSession[], who: (s: TrainingSession) => string): ScheduleItem[] {
  return sessions.filter(s => s.status !== "CANCELLED").map(s => ({
    key: `s-${s.id}`, kind: "session", date: dateKey(s.scheduledAt), time: academyTime(s.scheduledAt), title: s.title, who: who(s), target: { kind: "session", id: s.id },
  }));
}
/** Open bouts give a weigh-in and a fight item when those dates fall in the week. */
export function boutItems(bouts: readonly CampBout[], days: readonly string[], who: (b: CampBout) => string, fightWho?: (b: CampBout) => string): ScheduleItem[] {
  const out: ScheduleItem[] = [];
  for (const b of bouts) {
    if (!OPEN_BOUT.includes(b.status)) continue;
    if (b.status !== "WEIGHED_IN" && inWeek(dateKey(b.weighInAt), days)) {
      out.push({ key: `w-${b.id}`, kind: "weigh", date: dateKey(b.weighInAt), time: academyTime(b.weighInAt), title: b.eventName, who: who(b), target: { kind: "bout", id: b.id } });
    }
    if (inWeek(dateKey(b.boutAt), days)) {
      out.push({ key: `f-${b.id}`, kind: "fight", date: dateKey(b.boutAt), time: academyTime(b.boutAt), title: b.opponentName ? `${b.eventName} · ${t.vs(b.opponentName)}` : b.eventName, who: (fightWho ?? who)(b), target: { kind: "bout", id: b.id } });
    }
  }
  return out;
}
/** A suspension still running ends on endsOn; one cleared or ended is not an upcoming date. */
export function suspensionItems(list: readonly Suspension[], days: readonly string[], who: (s: Suspension) => string): ScheduleItem[] {
  return list.filter(s => s.status !== "ENDED" && !s.clearedAt && inWeek(s.endsOn, days)).map(s => ({
    key: `x-${s.id}`, kind: "free", date: s.endsOn, time: null, title: s.requiresClearance ? t.awaitingClearance : t.canTrainAgain, who: who(s), target: { kind: "fighter", id: s.fighterId ?? "" },
  }));
}
export function doctorItems(items: readonly DoctorScheduleItem[]): ScheduleItem[] {
  return items.map(x => {
    const base = { date: x.date, who: x.fighterName };
    switch (x.kind) {
      case "WEIGH_IN": return { ...base, key: `w-${x.refId}`, kind: "weigh", time: x.at ? academyTime(x.at) : null, title: x.label ?? "", target: { kind: "fighter", id: x.fighterId } };
      case "BOUT": return { ...base, key: `f-${x.refId}`, kind: "fight", time: x.at ? academyTime(x.at) : null, title: x.label ?? "", target: { kind: "fighter", id: x.fighterId } };
      case "SUSPENSION_END": return { ...base, key: `x-${x.refId}`, kind: "free", time: null, title: t.canTrainAgain, target: { kind: "fighter", id: x.fighterId } };
      case "CLEARANCE_EXPIRY": return { ...base, key: `c-${x.refId}`, kind: "expire", time: null, title: (x.label && t.clearance[x.label]) || t.clearanceFallback, target: { kind: "fighter", id: x.fighterId } };
      // The kind label already says "Tái khám": the fighter is the title, no repeated line.
      default: return { ...base, who: "", key: `e-${x.refId}`, kind: "follow", time: null, title: x.fighterName, target: { kind: "fighter", id: x.fighterId } };
    }
  });
}
