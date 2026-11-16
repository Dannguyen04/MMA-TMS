import type { Href } from "expo-router";

import type { DoctorAssignment } from "@/api";
import { findCountry } from "@/constants/countries";
import { fighterMe as t } from "@/i18n/fighter-me";
import { formatDay, stanceLabel, weightClassLabel } from "@/screens/fighter/format";

/** The profile fields Tôi reads; the session profile and `GET /me` both carry them. */
export type MeProfile = {
  firstName: string; lastName: string; gym?: string | null; weightClass: string; dominantStance?: string | null;
  heightCm?: number | null; reachCm?: number | null; dateOfBirth?: string | null; nationality?: string | null; bio?: string | null;
};

export const TOI = "/toi" as Href;
export const MY_PROFILE = "/ca-nhan" as Href;

export const fullName = (p: MeProfile) => `${p.firstName} ${p.lastName}`.trim();

export function initials(p: MeProfile): string {
  return `${p.firstName.trim().charAt(0)}${p.lastName.trim().charAt(0)}`.toLocaleUpperCase("vi") || "•";
}

export type Stat = { label: string; value: string | null; unit?: string };
/** The 4-stat strip; a missing value is null and shows as "–". */
/** The tile's label already says "Hạng cân", so the value drops the leading "Hạng" ("Hạng bán trung" → "Bán trung"). */
function weightShort(label: string): string {
  const rest = label.replace(/^Hạng\s+/u, "");
  return rest ? rest.charAt(0).toLocaleUpperCase("vi") + rest.slice(1) : label;
}

export function stats(p: MeProfile): Stat[] {
  const stance = stanceLabel(p.dominantStance);
  return [
    { label: t.stats.weight, value: p.weightClass ? weightShort(weightClassLabel(p.weightClass)) : null },
    { label: t.stats.stance, value: stance === "—" ? null : (t.stanceShort[p.dominantStance ?? ""] ?? stance) },
    { label: t.stats.height, value: p.heightCm != null ? String(p.heightCm) : null, unit: "cm" },
    { label: t.stats.reach, value: p.reachCm != null ? String(p.reachCm) : null, unit: "cm" },
  ];
}

/** Personal fields for Hồ sơ của tôi; empty ones show "–". */
export function facts(p: MeProfile, email: string | null | undefined): { label: string; value: string }[] {
  const dash = (v: string | null | undefined) => (v && v.trim() ? v.trim() : "–");
  return [
    { label: t.profile.last, value: dash(p.lastName) },
    { label: t.profile.first, value: dash(p.firstName) },
    { label: t.profile.born, value: p.dateOfBirth ? formatDay(p.dateOfBirth) : "–" },
    { label: t.profile.nationality, value: p.nationality ? findCountry(p.nationality)?.name ?? p.nationality : "–" },
    { label: t.profile.email, value: dash(email) },
  ];
}

/** The doctor in charge now: the assignment without an end date. */
export const activeDoctor = (list: DoctorAssignment[]) => list.find(d => d.endsAt == null) ?? null;

/** Back to Tôi; after a web reload there is no history, so go to the tab. */
export function backToMe(router: { canGoBack: () => boolean; back: () => void; replace: (href: never) => void }) {
  if (router.canGoBack()) router.back();
  else router.replace(TOI as never);
}
