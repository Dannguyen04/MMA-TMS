import type { Href } from "expo-router";

import type { SessionStatus } from "@/api/types";
import { coachSchedule as t } from "@/i18n/coach-schedule";

/** Redesign step 18: the one session page (it replaced `schedule/[id]` and the read-only `schedule/chi-tiet`). */
export const COACH_SESSION_PATH = "/(coach)/schedule/chi-tiet";
export const coachSessionHref = (id: string): Href => ({ pathname: COACH_SESSION_PATH, params: { id } }) as unknown as Href;
export const coachSessionEditHref = (id: string): Href => ({ pathname: "/(coach)/schedule/sua", params: { id } }) as unknown as Href;
export const coachNewSessionHref = (params: { fighterId?: string; planId?: string } = {}): Href =>
  ({ pathname: "/(coach)/schedule/new", params }) as unknown as Href;

/** The status word and its colour: Xong is green; Bỏ buổi, Đã hủy and Kết thúc dở are red; the rest stay ink. */
export function sessionStatusWord(s: SessionStatus): { word: string; tone?: "ok" | "warn" } {
  const tone = s === "COMPLETED" ? "ok" : s === "SKIPPED" || s === "CANCELLED" || s === "ABANDONED" ? "warn" : undefined;
  return { word: t.status[s], tone };
}

/** "17:30" or "7:05" → "17:30" / "07:05"; null when it is not a time. */
export function parseHm(text: string): string | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

/** Whole minutes from seconds, or null. */
export const minutes = (sec: number | null | undefined) => (sec == null ? null : Math.round(sec / 60));
