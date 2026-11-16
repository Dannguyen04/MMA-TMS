import type { Href } from "expo-router";

import type { MedicalStatus, PublicFighter } from "@/api/types";
import type { IconName } from "@/components/icon";
import { coachRo } from "@/i18n/coach-ro";
import { vi } from "@/i18n/vi";
import type { LeadTone } from "@/screens/fighter/redesign/tab-page";

/** Redesign step 16: the one fighter page (it replaced `fighters/[id]`); every coach link opens it. */
export const COACH_FIGHTER_PATH = "/(coach)/fighters/chi-tiet";
export const coachFighterHref = (id: string, tab?: "medical"): Href =>
  ({ pathname: COACH_FIGHTER_PATH, params: tab ? { id, tab } : { id } }) as unknown as Href;
export const coachFighterSubHref = (id: string, page: "lich-su-y-te" | "yeu-cau-kham" | "videos"): Href =>
  `/(coach)/fighters/${id}/${page}` as Href;

const weightLabels = vi.weightClass as Record<string, string>;
export const weightLabel = (w: string) => weightLabels[w] ?? w;

/** Medical status as a mark and a word (no pills): ✓ healthy, a clock while watched or recovering, ! when out. */
export type StatusMark = { lead?: string; icon?: IconName; tone: LeadTone; word: string; wordTone?: "ok" | "warn" };
export function statusMark(s: MedicalStatus): StatusMark {
  const word = coachRo.medicalStatus[s];
  if (s === "HEALTHY") return { lead: "✓", tone: "ok", word, wordTone: "ok" };
  if (s === "INJURED" || s === "NOT_CLEARED") return { lead: "!", tone: "warn", word, wordTone: "warn" };
  return { icon: "history", tone: "dim", word };
}

/** "Hạng lông · CLB Sài Gòn" */
export function fighterLine(f: Pick<PublicFighter, "weightClass" | "gym">): string {
  return [weightLabel(f.weightClass), f.gym ?? ""].filter(Boolean).join(" · ");
}

/** "Hạng lông · 175 cm · CLB Sài Gòn" */
export function fighterTopLine(f: Pick<PublicFighter, "weightClass" | "gym" | "heightCm">, cm: (n: number) => string): string {
  return [weightLabel(f.weightClass), f.heightCm ? cm(f.heightCm) : "", f.gym ?? ""].filter(Boolean).join(" · ");
}

/** 4 → "04" for the date lead of a session row. */
export const dayLead = (iso: string) => String(new Date(iso).getDate()).padStart(2, "0");
const WEEKDAYS = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
export function whenLine(iso: string): string {
  const d = new Date(iso);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1} · ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
