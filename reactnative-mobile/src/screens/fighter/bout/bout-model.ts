import type { Href } from "expo-router";

import { campApi, type CampDetail, type Suspension, type WeightTrack } from "@/features/fight-camp/api";
import { listFighterMeasurements } from "@/api/fighters/fighters";
import { fighterTran as t } from "@/i18n/fighter/fighter-tran";
import { previewBout, previewSuspensionCases } from "@/features/fight-camp/state/camp-preview";
import { dayMonth, gate1, gateDecides, isToday, kg, liveSuspensions, requirementLabel, strictestSuspension, suspensionHeadline } from "@/features/fight-camp/logic/camp-rules";
import { loadAllSuspensions } from "@/features/fight-camp/components/fighter-suspension";
import { dmLocal, hmLocal } from "@/screens/fighter/health/health-model";

export const TRAN = "/tran" as Href;
export const WEIGH = "/tran/can-nang" as Href;
export const SUSPENSIONS = "/tran/dinh-chi" as Href;
export const GUIDE = "/tran/huong-dan" as Href;

const ACTIVE = ["SCHEDULED", "CAMP", "FIGHT_WEEK", "WEIGHED_IN"];
/** The fighter's next bout still in play, with its full detail. */
export async function activeBout(fighterId: string | undefined): Promise<CampDetail | null> {
  let cursor: string | undefined;
  do {
    const page = await campApi.list({ fighterId, cursor, limit: 50 });
    const first = page.data.find(b => ACTIVE.includes(b.status));
    if (first) return campApi.detail(first.id);
    cursor = page.hasNextPage ? page.nextCursor ?? undefined : undefined;
  } while (cursor);
  return null;
}

export type TranData = {
  bout: CampDetail | null;
  track: WeightTrack | null;
  /** Without a bout there is no track; the latest self-report still shows. */
  latest: { kg: number; on: string } | null;
  /** null = could not load; read-only context, never hides the bout. */
  suspensions: Suspension[] | null;
};

export async function loadTran(profileId: string | undefined, demo: boolean, canReadMeasurements = false): Promise<TranData> {
  if (demo) return { bout: previewBout, track: { ...previewBout.weight, limitKg: 60, points: [{ date: "2026-10-24", kg: 61 }, { date: "2026-10-26", kg: 60.4 }] }, latest: null, suspensions: previewSuspensionCases.active };
  const bout = await activeBout(profileId);
  const [track, latest, suspensions] = await Promise.all([
    bout ? campApi.weightTrack(bout.id) : Promise.resolve(null),
    !bout && profileId && canReadMeasurements ? listFighterMeasurements(profileId, { limit: 1 }).then(r => r.data[0] ? { kg: r.data[0].weightKg, on: r.data[0].measuredAt } : null).catch(() => null) : Promise.resolve(null),
    loadAllSuspensions().catch(() => null),
  ]);
  return { bout, track, latest, suspensions };
}

export const limitOf = (b: CampDetail) => b.catchweightKg ?? b.weightLimitKg;
export const when = (iso: string) => `${dmLocal(iso)} · ${hmLocal(iso)}`;

export type Tone = "ok" | "warn" | "lim" | "dim";
/** The weight word and its tone. */
export function weightWord(track: WeightTrack): { word: string; tone: Tone } {
  const tone: Record<WeightTrack["status"], Tone> = { ON_TRACK: "ok", ABOVE_TARGET: "lim", OVER_LIMIT: "warn", NOT_WEIGHED: "dim", NEUTRAL: "ok" };
  return { word: t.weight[track.status], tone: tone[track.status] };
}
/** "Hôm nay", or the day of the latest weight and that today is still missing. */
export const weighedLine = (latestOn: string | null, now = new Date()) =>
  !latestOn ? "" : isToday(latestOn, now) ? t.today : t.notToday(dayMonth(latestOn));
/** kg over the limit, only when the track says OVER_LIMIT. */
export function overBy(track: WeightTrack): string | null {
  if (track.status !== "OVER_LIMIT" || track.latestKg == null || track.limitKg == null) return null;
  return kg(Math.max(0, track.latestKg - track.limitKg));
}

/** Gate 1 (display only): blocked lines and how many papers need attention. */
export function gateView(b: CampDetail): { lines: string[]; count: number; blocking: Set<string> } {
  const g = gate1(b.requirements, b.boutAt);
  const blocking = new Set([...g.missing, ...g.expiring].map(i => i.code));
  if (!gateDecides(b.status) || g.passed) return { lines: [], count: 0, blocking: new Set() };
  return {
    lines: [t.gate.blocked, g.missing.length ? t.gate.missing(g.missing.map(i => i.label).join(", ")) : null, g.expiring.length ? t.gate.expiring(g.expiring.map(i => i.label).join(", ")) : null].filter((x): x is string => !!x),
    count: blocking.size,
    blocking,
  };
}
export const paperOk = (status: string) => status === "CONFIRMED" || status === "PROVIDED";
/** The status word (coloured when missing or rejected) and the rest of the line ("đến 20/11"). */
export const paperParts = (r: CampDetail["requirements"][number]) => ({
  word: requirementLabel[r.status] ?? r.status,
  rest: r.validUntil && paperOk(r.status) ? t.until(dayMonth(r.validUntil)) : undefined,
});
export const paperLine = (r: CampDetail["requirements"][number]) => {
  const p = paperParts(r);
  return [p.word, p.rest].filter(Boolean).join(" · ");
};

/** The Đình chỉ row: the strictest suspension in force, or that there is none. */
export function suspensionRow(items: Suspension[] | null): { line: string; warn: boolean } {
  if (items === null) return { line: t.rows.suspensionFailed, warn: true };
  const pick = strictestSuspension(items);
  if (!pick) return { line: t.rows.noSuspension, warn: false };
  return { line: suspensionHeadline(pick.main), warn: pick.main.status !== "UPCOMING" };
}
/** Suspension page: in force first (framed), then the rest as past rows. */
export function splitSuspensions(items: Suspension[]) {
  const live = liveSuspensions(items);
  const ids = new Set(live.map(s => s.id));
  return { live, past: items.filter(s => !ids.has(s.id)).sort((a, b) => b.endsOn.localeCompare(a.endsOn)) };
}

/** Back to Trận; after a reload there is no history. */
export function backToTran(router: { canGoBack: () => boolean; back: () => void; replace: (href: never) => void }) {
  if (router.canGoBack()) router.back(); else router.replace(TRAN as never);
}
