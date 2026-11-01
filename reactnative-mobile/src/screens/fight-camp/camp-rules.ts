import { ApiError } from "@/api/errors";
import type { AnalysisInput, CampDetail, CampStatus, Suspension } from "@/api/fight-camp";
import { CampInputError } from "./camp-input-error";
import { backendErrorText, GENERIC_ERROR } from "@/i18n/backend-codes";
import { campText } from "@/i18n/fight-camp";

export const statusLabel: Record<CampStatus, string> = {
  SCHEDULED: campText.campRules.daLenLich, CAMP: campText.campRules.trongTraiTap, FIGHT_WEEK: campText.campRules.tuanThiDau,
  WEIGHED_IN: campText.campRules.daCanChinhThuc, COMPLETED: campText.campRules.daKetThuc, CANCELLED: campText.campRules.daHuy,
};
export const outcomeLabel = { EFFECTIVE: campText.campRules.hieuQua, INEFFECTIVE: campText.campRules.khongHieuQua, NOT_USED: campText.campRules.chuaDung };
export const kg = (value: number | null | undefined) => value == null ? "—" : value.toFixed(1).replace(".", ",");
export const dateLabel = (value: string) => new Date(value.length === 10 ? `${value}T12:00:00+07:00` : value).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" });
export function readKg(text: string): number {
  if (!/^\d{1,3}([.,]\d)?$/.test(text.trim())) throw new CampInputError(campText.campRules.nhapSoKgToiDa);
  const value = Number(text.trim().replace(",", "."));
  if (value < 30 || value > 200) throw new CampInputError(campText.campRules.canNangPhaiTu30);
  return value;
}
export function campError(error: unknown): string {
  // Only our own Vietnamese validation messages are shown verbatim; JS/server messages never are.
  if (!(error instanceof ApiError)) return error instanceof CampInputError ? error.message : GENERIC_ERROR;
  const details = error.details as { earliestOn?: string } | undefined;
  if (error.code === "BOUT_REQUIREMENTS_INCOMPLETE") {
    const gate = error.details as { missing?: Gate1Item[]; expiring?: Gate1Item[] } | undefined;
    const parts = [
      gate?.missing?.length ? campText.campRules.conThieu(gate.missing.map(i => i.label).join(", ")) : "",
      gate?.expiring?.length ? campText.campRules.hetHanTruocNgayThi(gate.expiring.map(i => i.label).join(", ")) : "",
    ].filter(Boolean);
    return campText.campRules.chuaDuHoSoThi(parts.length ? ` ${parts.join(". ")}.` : "");
  }
  if (error.code === "BOUT_REQUIREMENTS_LOCKED") return campText.campRules.hoSoThiDauDang;
  if (error.code === "BOUT_WEIGH_IN_TOO_EARLY") return campText.campRules.chuaDenNgayCanChinh(details?.earliestOn ? campText.campRules.coTheGhiTu(dateLabel(details.earliestOn)) : "");
  return backendErrorText(error);
}
export function validateAnalysis(a: AnalysisInput, maxRounds: number | null): void {
  if (a.observations.length > 6 || a.tactics.length > 5) throw new CampInputError(campText.campRules.toiDa6QuanSat);
  for (const o of a.observations) {
    if (!o.text.trim()) throw new CampInputError(campText.campRules.moiQuanSatCanCo);
    if (!o.evidenceNote?.trim() && !o.evidenceUrl?.trim()) throw new CampInputError(campText.campRules.moiQuanSatCanDuong);
    if (o.evidenceUrl && !/^https?:\/\/\S+$/i.test(o.evidenceUrl)) throw new CampInputError(campText.campRules.duongDanBangChungPhai);
  }
  for (const t of a.tactics) {
    if (!t.text.trim()) throw new CampInputError(campText.campRules.moiChienThuatCanCo);
    if (!t.observationIds.length) throw new CampInputError(campText.campRules.chonItNhatMotQuan);
    if (t.round != null && (!Number.isInteger(t.round) || t.round < 1 || t.round > (maxRounds ?? 12))) throw new CampInputError(campText.campRules.hiepApDungPhaiNam);
  }
}

/** Requirement status words, shared by coach and fighter. */
export const requirementLabel: Record<string, string> = { CONFIRMED: campText.campRules.daXacNhan, PROVIDED: campText.campRules.daCungCap, MISSING: campText.campRules.conThieu2, REJECTED: campText.campRules.chuaHopLe, EXPIRED: campText.campRules.hetHan };
export type Gate1Item = { code: string; label: string; status: string; validUntil: string | null };
/**
 * Mirrors the server's Gate 1 check (nestjs-api bouts.model.ts:204-216) for display only:
 * a required item blocks when it is not PROVIDED/CONFIRMED, or when it has no validity date
 * or expires before the bout date. The server stays the authority.
 */
export function gate1(requirements: CampDetail["requirements"], boutAt: string): { missing: Gate1Item[]; expiring: Gate1Item[]; passed: boolean } {
  const boutDate = dayKey(boutAt);
  const missing: Gate1Item[] = [], expiring: Gate1Item[] = [];
  for (const r of requirements) {
    if (!r.required) continue;
    const item = { code: r.code, label: r.label, status: r.status, validUntil: r.validUntil };
    if (r.status !== "PROVIDED" && r.status !== "CONFIRMED") missing.push(item);
    else if (r.validUntil === null || r.validUntil < boutDate) expiring.push(item);
  }
  return { missing, expiring, passed: !missing.length && !expiring.length };
}
/** Bout states where Gate 1 still decides whether fight week can start. */
export const gateDecides = (status: CampStatus) => status === "SCHEDULED" || status === "CAMP";
/** YYYY-MM-DD on the academy calendar (Asia/Ho_Chi_Minh). */
export function dayKey(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value.length === 10 ? `${value}T12:00:00+07:00` : value) : value;
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
}
export const isToday = (value: string | null | undefined, now = new Date()) => !!value && dayKey(value) === dayKey(now);

export const sessionNames: Record<string, string> = { SHADOW_BOXING: campText.campRules.danhGio, PAD_WORK: campText.campRules.danhDich, HEAVY_BAG: campText.campRules.danhBao, SPARRING: campText.campRules.doiLuyen, GRAPPLING: campText.campRules.vatKhoaSiet, STRENGTH_CONDITIONING: campText.campRules.theLucVaSucManh, RECOVERY: campText.campRules.phucHoi, PHYSICAL_THERAPY: campText.campRules.vatLyTriLieu };
export const suspensionStatusLabel: Record<Suspension["status"], string> = { UPCOMING: campText.campRules.sapApDung, ACTIVE: campText.campRules.dangDinhChi, AWAITING_CLEARANCE: campText.campRules.choXacNhanTapLai, ENDED: campText.campRules.daKetThuc2 };
export const suspensionReasonLabel: Record<string, string> = { KO: campText.campRules.knockOutKo, TKO: campText.campRules.knockOutKyThuatTko, DQ: campText.campRules.truatQuyenThiDau, MANDATORY_REST: campText.campRules.nghiBatBuoc, MEDICAL: campText.campRules.yTe, OTHER: campText.campRules.khac };
export const blockedSessionNames = (s: Suspension) => s.blockedSessionTypes.map(t => sessionNames[t] ?? t);
export const openSessionNames = (s: Suspension) => Object.keys(sessionNames).filter(t => !s.blockedSessionTypes.includes(t)).map(t => sessionNames[t]);
const graded = (s: Suspension) => s.status === "ENDED" && !!s.gradedReturn;
/**
 * Suspensions that limit training now or soon, most restrictive first. T-048 1A: `active=true` never returns
 * graded return (T-049 J1), so ENDED rows whose gradedReturn is still running are kept here on the device.
 */
export function liveSuspensions(items: readonly Suspension[]): Suspension[] {
  const rank = (s: Suspension) => s.status === "ACTIVE" ? 0 : s.status === "AWAITING_CLEARANCE" ? 1 : graded(s) ? 2 : 3;
  return items.filter(s => s.status === "UPCOMING" || s.status === "ACTIVE" || s.status === "AWAITING_CLEARANCE" || graded(s)).sort((a, b) => rank(a) - rank(b));
}
/**
 * T-048 line 47: without gradedReturn first, then the latest endsOn. UPCOMING does not limit training yet, so it
 * comes after every suspension in force (decision 1A keeps UPCOMING, which `active=true` never returned).
 */
export function strictestSuspension(items: readonly Suspension[]): { main: Suspension; others: number } | null {
  const live = liveSuspensions(items);
  if (!live.length) return null;
  const group = (s: Suspension) => s.status === "UPCOMING" ? 2 : s.gradedReturn ? 1 : 0;
  const [main] = [...live].sort((a, b) => group(a) - group(b) || b.endsOn.localeCompare(a.endsOn));
  return { main, others: live.length - 1 };
}
/** Intensity tiers (suspensions.constants.ts:27-39). Tier numbers stay out of the visible text (8B). */
export const intensityTiers = [
  { tier: 1, group: campText.campRules.nheKhongGangSuc, types: ["RECOVERY", "PHYSICAL_THERAPY"] },
  { tier: 2, group: campText.campRules.gangSucKhongDanh, types: ["STRENGTH_CONDITIONING"] },
  { tier: 3, group: campText.campRules.kyThuatKhongVaCham, types: ["SHADOW_BOXING", "HEAVY_BAG", "PAD_WORK"] },
  { tier: 4, group: campText.campRules.vaChamCoKiemSoat, types: ["GRAPPLING"] },
  { tier: 5, group: campText.campRules.doiKhangToanPhan, types: ["SPARRING"] },
] as const;
export const tierTypesText = (t: (typeof intensityTiers)[number]) => t.types.map(x => sessionNames[x]).join(", ");
/** Session types in tier order (lightest first). */
const TIER_ORDER: string[] = intensityTiers.flatMap(t => [...t.types]);
/**
 * Phase 5 B (1A): what the server gate lets the fighter do, from the same fields it reads
 * (suspension.gate.ts:38-57). In force (ACTIVE, AWAITING_CLEARANCE): every type NOT in
 * `blockedSessionTypes`, even when the free list skips a tier. Graded return (ENDED with
 * `gradedReturn`): every type up to the day's ceiling (3, then 4; full from fullReturnOn, when the
 * server sends no gradedReturn). UPCOMING: what will be allowed from startsOn. Otherwise `null`.
 * `maxAllowedTier` is not used: it is derived from the record and goes stale in graded return (T-051 U1).
 */
export function allowedTypes(s: Suspension): string[] | null {
  if (s.status === "ACTIVE" || s.status === "AWAITING_CLEARANCE" || s.status === "UPCOMING") return TIER_ORDER.filter(t => !s.blockedSessionTypes.includes(t));
  if (s.gradedReturn) { const ceiling = s.gradedReturn.ceiling; return intensityTiers.filter(t => t.tier <= ceiling).flatMap(t => [...t.types]); }
  return null;
}
/** The single allowed line on suspension cards (1A): "Hôm nay được tập: …", or from startsOn for UPCOMING. */
export function allowedTodayLine(s: Suspension): string | null {
  const types = allowedTypes(s);
  if (!types) return null;
  const when = s.status === "UPCOMING" ? campText.campRules.tu(dayMonth(s.startsOn)) : campText.campRules.homNay;
  if (!types.length) return campText.campRules.chuaDuocTapLoaiNao(when);
  if (types.length === TIER_ORDER.length) return campText.campRules.duocTapTatCaCac(when);
  return campText.campRules.duocTap(when, types.map(x => sessionNames[x].toLocaleLowerCase("vi")).join(", "));
}
/** True while a suspension limits training today (in force or graded return); UPCOMING does not yet. */
export function limitsTrainingToday(items: readonly Suspension[] | null | undefined): boolean {
  return !!items && liveSuspensions(items).some(s => s.status !== "UPCOMING");
}
/** dd/MM on the academy calendar. */
export const dayMonth = (value: string) => dateLabel(value).slice(0, 5);
const addDays = (day: string, n: number) => { const d = new Date(`${day}T12:00:00+07:00`); d.setDate(d.getDate() + n); return dayKey(d); };
/** Ticket lines 39-42, plus 6B for UPCOMING. */
export function suspensionHeadline(s: Suspension): string {
  if (s.gradedReturn) return campText.campRules.dangTapLaiTheoBac(dayMonth(s.gradedReturn.fullReturnOn));
  if (s.status === "AWAITING_CLEARANCE") return campText.campRules.choBacSiXacNhan;
  if (s.status === "ACTIVE") return campText.campRules.dangDinhChiDen(dayMonth(s.endsOn));
  if (s.status === "UPCOMING") return campText.campRules.sapDinhChiTu(dayMonth(s.startsOn));
  return campText.campRules.trangThaiDinhChiChua;
}
/** Graded return as 3 days: ceiling 3, ceiling 4, then full training from fullReturnOn. */
export function gradedSteps(g: NonNullable<Suspension["gradedReturn"]>): { date: string; text: string; current: boolean }[] {
  const t3 = intensityTiers[2].group, t4 = intensityTiers[3].group;
  return [
    { date: dayMonth(addDays(g.fullReturnOn, -2)), text: campText.campRules.tapDenNhom(t3.toLocaleLowerCase("vi")), current: g.ceiling === 3 },
    { date: dayMonth(addDays(g.fullReturnOn, -1)), text: campText.campRules.tapDenNhom2(t4.toLocaleLowerCase("vi")), current: g.ceiling === 4 },
    { date: dayMonth(g.fullReturnOn), text: campText.campRules.tapDayDu, current: false },
  ];
}
