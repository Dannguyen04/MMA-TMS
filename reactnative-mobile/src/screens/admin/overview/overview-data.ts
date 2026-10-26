import type { AppNotification, MedicalStatus, PublicFighter, SessionStatus, TrainingSession, UserRole } from "@/api/types";
import { MEDICAL_STATUSES } from "@/api/types";
import { WEIGHT_CLASSES, type WeightClass } from "@/constants/weight-classes";

/** Giờ Việt Nam cố định UTC+7 (không có giờ mùa hè). */
const VN_OFFSET = 7 * 3_600_000;
const DAY = 86_400_000;

/** Mốc 00:00 giờ Việt Nam của ngày (hôm nay + `offset`), dạng epoch ms. */
export function vnDayStart(offset = 0, now = Date.now()): number {
  const vn = now + VN_OFFSET;
  return vn - (vn % DAY) - VN_OFFSET + offset * DAY;
}

/** Khoảng [from, to] ISO của các ngày từ `fromOffset` đến hết ngày `toOffset`. */
export function vnRange(fromOffset: number, toOffset: number, now = Date.now()): { fromDate: string; toDate: string } {
  return {
    fromDate: new Date(vnDayStart(fromOffset, now)).toISOString(),
    toDate: new Date(vnDayStart(toOffset + 1, now) - 1).toISOString(),
  };
}

/** "23:10" theo giờ Việt Nam. */
export function vnClock(ms: number): string {
  const d = new Date(ms + VN_OFFSET);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

const WEEKDAY = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"] as const;

/** Số có dấu chấm ngăn cách hàng nghìn (1.234). */
export function num(n: number): string {
  return Math.max(0, Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Phần trăm làm tròn, tổng 0 → 0. */
export function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

// ---------- Võ sĩ ----------

export type MedicalCounts = Record<MedicalStatus, number>;

export function medicalCounts(rows: readonly Pick<PublicFighter, "currentMedicalStatus">[]): MedicalCounts {
  const out = Object.fromEntries(MEDICAL_STATUSES.map((s) => [s, 0])) as MedicalCounts;
  for (const r of rows) if (r.currentMedicalStatus in out) out[r.currentMedicalStatus] += 1;
  return out;
}

/** Hạng cân có > 0 võ sĩ, theo thứ tự nhẹ → nặng (thứ tự enum). */
export function weightCounts(rows: readonly Pick<PublicFighter, "weightClass">[]): { weightClass: WeightClass; count: number }[] {
  const map = new Map<WeightClass, number>();
  for (const r of rows) map.set(r.weightClass, (map.get(r.weightClass) ?? 0) + 1);
  return WEIGHT_CLASSES.filter((w) => (map.get(w) ?? 0) > 0)
    .map((w) => ({ weightClass: w, count: map.get(w)! }));
}

/** Võ sĩ cần chú ý: chấn thương trước, rồi chưa cho phép. */
export function attentionList<T extends Pick<PublicFighter, "currentMedicalStatus">>(rows: readonly T[]): T[] {
  return [...rows.filter((r) => r.currentMedicalStatus === "INJURED"), ...rows.filter((r) => r.currentMedicalStatus === "NOT_CLEARED")];
}

// ---------- Buổi tập ----------

export type SessionGroup = "done" | "skipped" | "abandoned" | "cancelled" | "inProgress" | "planned";
/** Thứ tự xếp chồng (dưới → trên) và chú thích. */
export const SESSION_GROUPS: readonly SessionGroup[] = ["done", "skipped", "abandoned", "cancelled", "inProgress", "planned"];
/** Nhóm chỉ hiện trong chú thích khi > 0. */
export const OPTIONAL_GROUPS: readonly SessionGroup[] = ["abandoned", "inProgress"];

function emptyGroups(): Record<SessionGroup, number> {
  return { done: 0, skipped: 0, abandoned: 0, cancelled: 0, inProgress: 0, planned: 0 };
}

/** Nhóm hiện trong chú thích: nhóm chính luôn hiện, "Bỏ dở"/"Đang tập" chỉ khi > 0. */
export function legendGroups(t: Record<SessionGroup, number>): SessionGroup[] {
  return SESSION_GROUPS.filter((g) => !OPTIONAL_GROUPS.includes(g) || t[g] > 0);
}

export function sessionGroup(status: SessionStatus): SessionGroup {
  switch (status) {
    case "COMPLETED":
      return "done";
    case "SKIPPED":
      return "skipped";
    case "ABANDONED":
      return "abandoned";
    case "CANCELLED":
      return "cancelled";
    case "IN_PROGRESS":
      return "inProgress";
    default:
      return "planned";
  }
}

export type DayColumn = { key: string; label: string; today: boolean; counts: Record<SessionGroup, number>; total: number };

/** 7 cột: 6 ngày trước + hôm nay, nhãn thứ (T2…CN). */
export function sessionColumns(rows: readonly Pick<TrainingSession, "scheduledAt" | "status">[], now = Date.now()): DayColumn[] {
  const cols: DayColumn[] = [];
  for (let off = -6; off <= 0; off += 1) {
    const start = vnDayStart(off, now);
    const weekday = new Date(start + VN_OFFSET).getUTCDay();
    cols.push({ key: String(start), label: WEEKDAY[weekday]!, today: off === 0, counts: emptyGroups(), total: 0 });
  }
  const first = vnDayStart(-6, now);
  for (const r of rows) {
    const t = Date.parse(r.scheduledAt);
    const idx = Math.floor((t - first) / DAY);
    if (idx < 0 || idx > 6 || Number.isNaN(idx)) continue;
    const col = cols[idx]!;
    col.counts[sessionGroup(r.status)] += 1;
    col.total += 1;
  }
  return cols;
}

export function groupTotals(cols: readonly DayColumn[]): Record<SessionGroup, number> {
  const out = emptyGroups();
  for (const c of cols) for (const g of SESSION_GROUPS) out[g] += c.counts[g];
  return out;
}

/** Hoàn thành / (Hoàn thành + Bỏ buổi + Bỏ dở + Đã hủy); chưa có buổi kết thúc → null. */
export function completionRate(t: Record<SessionGroup, number>): number | null {
  const ended = t.done + t.skipped + t.abandoned + t.cancelled;
  return ended > 0 ? pct(t.done, ended) : null;
}

// ---------- Người dùng ----------

export const ROLE_ORDER: readonly UserRole[] = ["FIGHTER", "COACH", "DOCTOR", "ADMIN", "GUEST"];

// ---------- Thông báo ----------

/** "Vừa xong", "5 phút trước", "3 giờ trước", "Hôm qua", "4 ngày trước", rồi ngày dd/mm/yyyy. */
export function relativeTime(iso: string, now = Date.now()): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const diff = Math.max(0, now - t);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "Vừa xong";
  if (min < 60) return `${min} phút trước`;
  const hours = Math.floor(min / 60);
  const days = Math.round((vnDayStart(0, now) - vnDayStart(0, t)) / DAY);
  if (days === 0) return `${hours} giờ trước`;
  if (days === 1) return "Hôm qua";
  if (days < 7) return `${days} ngày trước`;
  const d = new Date(t + VN_OFFSET);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

export function latestNotifications(rows: readonly AppNotification[], n = 3): AppNotification[] {
  return [...rows].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, n);
}
