import { ApiError } from "@/api/errors";
import type { MedicalClearance, MedicalExamination, MedicalHistoryEntry, PublicFighter, RecoveryPlan } from "@/api/types";
import {
  clearanceStatusLabel,
  clearanceTypeLabel,
  decisionLabel,
  injuryStatusLabel,
  jointLabel,
  recoveryStatusLabel,
  requesterRoleLabel,
  reviewStatusLabel,
  scopeLabel,
  severityLabel,
} from "@/components/medical/medical-format";
import { doctorRo } from "@/i18n/doctor-ro";
import { vi } from "@/i18n/vi";
import { ageFromDob, type ChipSpec, vnDate } from "@/screens/coach/readonly/ro-format";
import { mapFighterError } from "@/screens/fighter/errors";

const t = doctorRo.detail2;
export const NBSP = "\u00A0";

/** Nhãn riêng của chi tiết Doctor (không đổi nhãn dùng chung). */
export function planStatusText(v: unknown): string {
  return v === "ACTIVE" ? t.planActive : recoveryStatusLabel(v);
}
export function severityText(v: unknown): string {
  return v === "MODERATE" ? t.severityModerate : severityLabel(v);
}

/** Dòng thông tin dưới tên: tuổi · cao · tầm với · thế đứng; quốc tịch dòng riêng. Bỏ mục thiếu dữ liệu. */
export function headerFacts(f: PublicFighter, now: Date = new Date()): { line: string; nationality: string } {
  const age = f.dateOfBirth ? ageFromDob(f.dateOfBirth, now) : null;
  const stance = f.dominantStance ? (vi.stance as Record<string, string>)[f.dominantStance] ?? "" : "";
  // Khoảng trắng không ngắt trong từng mục; chỉ được xuống dòng sau dấu "·".
  const line = [age != null ? t.age(age) : "", f.heightCm ? t.height(f.heightCm) : "", f.reachCm ? t.reach(f.reachCm) : "", stance]
    .filter(Boolean)
    .map((s) => s.replace(/ /g, NBSP))
    .join(`${NBSP}· `);
  return { line, nationality: f.nationality?.trim() ?? "" };
}

/** Lỗi 403 ở chi tiết = bác sĩ không còn được phân công (thay câu "không có quyền" chung). */
export function detailError(message: string): string {
  return message && message === mapFighterError(new ApiError(403, "FORBIDDEN", "")) ? t.forbidden : message;
}

export const DECISION_CHIP: Record<MedicalExamination["decision"], ChipSpec> = {
  ELIGIBLE: { label: decisionLabel("ELIGIBLE"), tone: "success", icon: "success" },
  ELIGIBLE_WITH_RESTRICTIONS: { label: decisionLabel("ELIGIBLE_WITH_RESTRICTIONS"), tone: "attention", icon: "warning" },
  NOT_ELIGIBLE: { label: t.verdictFail, tone: "danger", icon: "ban" },
};

export function currentClearances(rows: readonly MedicalClearance[]): MedicalClearance[] {
  return rows.filter((c) => c.status === "ACTIVE" && c.isCurrentlyValid !== false);
}

export function expiresSoon(validUntil: string | null, now: Date = new Date(), days = 14): boolean {
  if (!validUntil) return false;
  const ms = Date.parse(validUntil) - now.getTime();
  return ms >= 0 && ms <= days * 86_400_000;
}

export function planProgress(plan: RecoveryPlan): { done: number; total: number; pct: number } {
  const ms = Array.isArray(plan.milestones) ? plan.milestones : [];
  const total = ms.length;
  const done = ms.filter((m) => m && typeof m === "object" && (m as { isCompleted?: unknown }).isCompleted === true).length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

export function vnDayMonth(iso: string | null | undefined): string {
  const d = vnDate(iso);
  return d.length >= 10 ? d.slice(0, 5) : d;
}

/** Đọc trường snapshot: máy chủ trả camelCase; chấp nhận cả snake_case cho bản ghi cũ. */
function snap(s: Record<string, unknown>, camel: string): unknown {
  if (s[camel] != null) return s[camel];
  const snake = camel.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
  return s[snake];
}
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : "");

/** Một dòng tóm tắt cho mục dòng thời gian Hồ sơ. */
export function historySummary(e: MedicalHistoryEntry): string {
  const s = (e.snapshot ?? {}) as Record<string, unknown>;
  const g = (k: string) => snap(s, k);
  const parts: string[] = [];
  switch (e.recordType) {
    case "INJURY":
      parts.push(jointLabel(g("affectedJoint")), str(g("injuryType")), severityText(g("severity")), injuryStatusLabel(g("status")));
      break;
    case "TREATMENT":
      parts.push(str(g("treatmentType")), str(g("outcomeNotes")));
      break;
    case "RECOVERY_PLAN":
      parts.push(str(g("title")), planStatusText(g("status")));
      break;
    case "MEDICAL_EXAMINATION":
      parts.push(scopeLabel(g("scope")), decisionLabel(g("decision")), str(g("reason")));
      break;
    case "MEDICAL_CLEARANCE":
      parts.push(clearanceTypeLabel(g("clearanceType")), clearanceStatusLabel(g("status")), str(g("revokedReason")));
      break;
    case "MEDICAL_REVIEW_REQUEST":
      parts.push(requesterRoleLabel(g("requesterRole")), str(g("reason")), reviewStatusLabel(g("status")));
      break;
  }
  return parts.filter((p) => p && p !== "—").join(" · ");
}

/** Màu chấm dòng thời gian Hồ sơ (tên token bảng màu). */
export function historyDot(e: MedicalHistoryEntry): "attention" | "danger" | "info" | "muted" | "success" {
  switch (e.recordType) {
    case "MEDICAL_REVIEW_REQUEST":
      return "attention";
    case "INJURY":
      return "danger";
    case "RECOVERY_PLAN":
    case "TREATMENT":
      return "info";
    case "MEDICAL_EXAMINATION":
      return "muted";
    case "MEDICAL_CLEARANCE":
      return snap((e.snapshot ?? {}) as Record<string, unknown>, "status") === "REVOKED" ? "danger" : "success";
    default:
      return "info";
  }
}

/** Nhóm theo tháng ("Tháng 10/2026"), giữ thứ tự mới nhất trước. */
export function groupByMonth<T>(rows: readonly T[], at: (r: T) => string): { label: string; rows: T[] }[] {
  const out: { label: string; rows: T[] }[] = [];
  for (const r of rows) {
    const d = new Date(at(r));
    const label = Number.isNaN(d.getTime()) ? "—" : `Tháng ${d.getMonth() + 1}/${d.getFullYear()}`;
    const last = out[out.length - 1];
    if (last && last.label === label) last.rows.push(r);
    else out.push({ label, rows: [r] });
  }
  return out;
}
