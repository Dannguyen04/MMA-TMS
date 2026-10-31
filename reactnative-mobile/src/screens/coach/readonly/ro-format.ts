import type { FighterMeasurement, MedicalStatus, Paginated, PublicFighter, SessionStatus, TrainingPlan, TrainingPlanStatus } from "@/api/types";
import { coachRo } from "@/i18n/coach-ro";
import { CONTRAST_BODY, contrastRatio, ensureContrast, mixHex } from "@/theme/appearance/color-math";

/** Sắc thái của chip trạng thái; luôn đi kèm biểu tượng + chữ. */
export type Tone = "success" | "attention" | "info" | "danger" | "neutral";
export type ChipSpec = { label: string; tone: Tone; icon: "success" | "alertCircle" | "retry" | "warning" | "ban" | "schedule" | "training" | "xCircle" | "circle" | "info" };

export const MEDICAL_CHIP: Record<MedicalStatus, ChipSpec> = {
  HEALTHY: { label: coachRo.medicalStatus.HEALTHY, tone: "success", icon: "success" },
  MONITORING: { label: coachRo.medicalStatus.MONITORING, tone: "attention", icon: "alertCircle" },
  RECOVERY: { label: coachRo.medicalStatus.RECOVERY, tone: "info", icon: "retry" },
  INJURED: { label: coachRo.medicalStatus.INJURED, tone: "danger", icon: "warning" },
  NOT_CLEARED: { label: coachRo.medicalStatus.NOT_CLEARED, tone: "danger", icon: "ban" },
};

export const SESSION_CHIP: Record<SessionStatus, ChipSpec> = {
  SCHEDULED: { label: coachRo.sessionStatus.SCHEDULED, tone: "info", icon: "schedule" },
  IN_PROGRESS: { label: coachRo.sessionStatus.IN_PROGRESS, tone: "attention", icon: "training" },
  COMPLETED: { label: coachRo.sessionStatus.COMPLETED, tone: "success", icon: "success" },
  SKIPPED: { label: coachRo.sessionStatus.SKIPPED, tone: "attention", icon: "ban" },
  CANCELLED: { label: coachRo.sessionStatus.CANCELLED, tone: "danger", icon: "xCircle" },
  ABANDONED: { label: coachRo.sessionStatus.ABANDONED, tone: "danger", icon: "alertCircle" },
};

export const PLAN_CHIP: Record<TrainingPlanStatus, ChipSpec> = {
  DRAFT: { label: coachRo.planStatus.DRAFT, tone: "neutral", icon: "circle" },
  ACTIVE: { label: coachRo.planStatus.ACTIVE, tone: "info", icon: "training" },
  COMPLETED: { label: coachRo.planStatus.COMPLETED, tone: "success", icon: "success" },
  CANCELLED: { label: coachRo.planStatus.CANCELLED, tone: "danger", icon: "xCircle" },
};

type ToneInput = {
  scheme: "light" | "dark";
  bg: string;
  surface: string;
  ink: string;
  success: string;
  danger: string;
  attention: string;
  info: string;
  successSoft: string;
  attentionSoft: string;
  dangerSoft: string;
  infoSoft: string;
};

/** Màu chữ + nền chip. Xanh dương không có trong theme nên được chỉnh để đạt ≥ 4,5:1 trên nền chip. */
export function toneColors(p: ToneInput, tone: Tone): { fg: string; bg: string } {
  const base: Record<Tone, string> = {
    success: p.success,
    attention: p.attention,
    danger: p.danger,
    info: p.info,
    neutral: p.ink,
  };
  const raw = base[tone];
  const soft: Record<Exclude<Tone, "neutral">, string> = {
    success: p.successSoft,
    attention: p.attentionSoft,
    danger: p.dangerSoft,
    info: p.infoSoft,
  };
  // Nền chip = token nền trạng thái của theme (bảng "Đỏ võ đài": #E0EEE7, #FFF3D9, #FFEDF1, #E4ECF6 …).
  const bg = tone === "neutral" ? mixHex(p.bg, p.ink, 0.1) : soft[tone];
  const fg = ensureContrast(raw, bg, CONTRAST_BODY);
  return { fg, bg };
}

export function chipContrast(p: ToneInput, tone: Tone): number {
  const { fg, bg } = toneColors(p, tone);
  return contrastRatio(fg, bg);
}

export function fighterName(f: { firstName: string; lastName: string }): string {
  return `${f.firstName} ${f.lastName}`.trim();
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const last = parts[parts.length - 1]!;
  const first = parts.length > 1 ? parts[0]! : "";
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

export function ageFromDob(dob: string, now: Date = new Date()): number | null {
  const d = new Date(dob.length <= 10 ? `${dob}T00:00:00` : dob);
  if (Number.isNaN(d.getTime())) return null;
  let years = now.getFullYear() - d.getFullYear();
  const beforeBirthday =
    now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate());
  if (beforeBirthday) years -= 1;
  return years >= 0 && years < 120 ? years : null;
}

/** "dd/mm/yyyy" theo giờ Việt Nam. */
export function vnDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00+07:00` : iso);
  if (Number.isNaN(d.getTime())) return "—";
  const vn = new Date(d.getTime() + 7 * 3_600_000);
  const dd = String(vn.getUTCDate()).padStart(2, "0");
  const mm = String(vn.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${vn.getUTCFullYear()}`;
}

export function vnShort(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 7 * 3_600_000);
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
}

export function timeHm(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 7 * 3_600_000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** Số kiểu Việt Nam, 1 chữ số thập phân: 68,5. */
export function kgText(kg: number): string {
  return (Math.round(kg * 10) / 10).toFixed(1).replace(".", ",");
}

export function durationText(sec: number | null | undefined): string | null {
  if (sec == null || sec <= 0) return null;
  return coachRo.session.minutes(Math.round(sec / 60));
}

const WEEKDAY = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function vnDayKey(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 7 * 3_600_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** Nhãn nhóm ngày: Hôm nay / Ngày mai / Hôm qua / "T4, 21/10". */
export function dayLabel(iso: string, now: Date = new Date()): string {
  const key = vnDayKey(iso);
  const today = Date.parse(`${vnDayKey(now.toISOString())}T00:00:00Z`);
  const diff = Math.round((Date.parse(`${key}T00:00:00Z`) - today) / 86_400_000);
  if (diff === 0) return coachRo.schedule.today;
  if (diff === 1) return coachRo.schedule.tomorrow;
  if (diff === -1) return coachRo.schedule.yesterday;
  const d = new Date(new Date(iso).getTime() + 7 * 3_600_000);
  return `${WEEKDAY[d.getUTCDay()]}, ${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
}

export type DayGroup<T> = { key: string; label: string; items: T[] };

/** Nhóm buổi tập theo ngày (giờ VN), ngày tăng dần, trong ngày theo giờ. Nhóm "Hôm nay" luôn đứng đầu, có ghi rõ thứ + ngày. */
export function groupByDay<T extends { scheduledAt: string }>(rows: readonly T[], now: Date = new Date()): DayGroup<T>[] {
  const sorted = [...rows].sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt));
  const groups: DayGroup<T>[] = [];
  for (const row of sorted) {
    const key = vnDayKey(row.scheduledAt);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(row);
    else groups.push({ key, label: dayLabel(row.scheduledAt, now), items: [row] });
  }
  const todayKey = vnDayKey(now.toISOString());
  const at = groups.findIndex((g) => g.key === todayKey);
  if (at >= 0) {
    const [today] = groups.splice(at, 1);
    const d = new Date(Date.parse(`${todayKey}T00:00:00Z`));
    today!.label = coachRo.schedule.todayGroup(WEEKDAY[d.getUTCDay()]!, `${d.getUTCDate()}/${d.getUTCMonth() + 1}`);
    groups.unshift(today!);
  }
  return groups;
}

/** Điểm cân để vẽ: bỏ số đo đã bị thay thế, cũ → mới. */
export function weightSeries(rows: readonly FighterMeasurement[]): FighterMeasurement[] {
  return rows.filter((r) => !r.isSuperseded).sort((a, b) => Date.parse(a.measuredAt) - Date.parse(b.measuredAt));
}

export function weightChange(series: readonly FighterMeasurement[]): number | null {
  if (series.length < 2) return null;
  const a = series[series.length - 2]!;
  const b = series[series.length - 1]!;
  return Math.round((b.weightKg - a.weightKg) * 10) / 10;
}

export function clampPct(value: number | null | undefined): number {
  if (value == null || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function planPct(plan: Pick<TrainingPlan, "progress">): number {
  return clampPct(plan.progress?.completionPercentage);
}

/** Gộp một trang mới vào danh sách đang có (trang 1 thay thế; trang sau nối thêm, bỏ trùng id). */
export function mergePage<T extends { id: string }>(prev: readonly T[], next: Paginated<T>, page: number): T[] {
  if (page <= 1) return [...next.data];
  const seen = new Set(prev.map((r) => r.id));
  return [...prev, ...next.data.filter((r) => !seen.has(r.id))];
}

/** Map id → tên để hiện tên võ sĩ trên buổi tập / giáo án (API chỉ trả fighterId). */
export function nameMap(fighters: readonly Pick<PublicFighter, "id" | "firstName" | "lastName">[]): Record<string, string> {
  return Object.fromEntries(fighters.map((f) => [f.id, fighterName(f)]));
}
