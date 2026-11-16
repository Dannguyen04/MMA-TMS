import type { MedicalClearance, MedicalDossier, MedicalExamination } from "@/api/types";
import { clearanceCopy as t } from "@/i18n/clearance";
import type { EligibilityScope } from "./eligibility-model";

/**
 * What the licence for one scope (training / competition) means today. Only the clearance issued from that scope's
 * current examination governs it (the server does the same); clearances from older exams can still be ACTIVE in the
 * dossier but no longer count, so they never stand in for the current one.
 */
export type ClearanceState =
  | { kind: "valid"; clearance: MedicalClearance }
  /** Issued for the current exam, but its validity starts later. */
  | { kind: "notYet"; clearance: MedicalClearance }
  | { kind: "expired"; clearance: MedicalClearance | null }
  /** The current exam has no (live) clearance yet: not issued, or revoked. */
  | { kind: "missing"; exam: MedicalExamination }
  | { kind: "noExam" };

export const SCOPES: readonly EligibilityScope[] = ["training", "competition"];

/** dd/mm on the academy calendar (UTC+7). */
export function dmAcademy(iso: string | null | undefined): string | null {
  const ms = Date.parse(iso ?? "");
  if (!Number.isFinite(ms)) return null;
  const s = new Date(ms + 7 * 3_600_000).toISOString();
  return `${s.slice(8, 10)}/${s.slice(5, 7)}`;
}

export function governingClearanceFor(d: MedicalDossier, scope: EligibilityScope): MedicalClearance | null {
  const exam = d.currentExaminations?.[scope];
  return exam ? (d.activeClearances ?? []).find(c => c.examinationId === exam.id) ?? null : null;
}

export function clearanceState(d: MedicalDossier, scope: EligibilityScope, now: Date = new Date()): ClearanceState {
  const exam = d.currentExaminations?.[scope];
  const reasons = d.eligibility?.[scope]?.reasons ?? [];
  if (!exam) return { kind: "noExam" };
  const c = governingClearanceFor(d, scope);
  if (!c) return reasons.includes("CLEARANCE_EXPIRED") ? { kind: "expired", clearance: null } : { kind: "missing", exam };
  if (Date.parse(c.validFrom) > now.getTime()) return { kind: "notYet", clearance: c };
  if (c.validUntil && Date.parse(c.validUntil) <= now.getTime()) return { kind: "expired", clearance: c };
  return { kind: "valid", clearance: c };
}

/** One sentence for the state, or null when the licence is fine. Used in place of the server's generic code. */
export function clearanceProblem(state: ClearanceState, scope: EligibilityScope): string | null {
  switch (state.kind) {
    case "valid": return null;
    case "notYet": return t.notYet(dmAcademy(state.clearance.validFrom));
    case "expired": return dmAcademy(state.clearance?.validUntil) ? t.expiredOn(dmAcademy(state.clearance?.validUntil)!) : t.expired;
    case "missing": return t.missing(dmAcademy(state.exam.examinedAt));
    case "noExam": return t.noExam(scope);
  }
}

/**
 * The reason line for one eligibility code. CLEARANCE_REQUIRED covers three different situations on the server
 * (none issued, revoked, not yet valid), so it is spelled out from the dossier; other codes use `fallback`.
 */
export function reasonFor(d: MedicalDossier, scope: EligibilityScope, code: string, fallback: (code: string) => string): string {
  if (code !== "CLEARANCE_REQUIRED" && code !== "CLEARANCE_EXPIRED") return fallback(code);
  return clearanceProblem(clearanceState(d, scope), scope) ?? fallback(code);
}

/** The short word for a licence row ("Chưa hiệu lực", "Cần cấp lại", "Chưa cấp"), or null when valid. */
export function clearanceWord(state: ClearanceState): string | null {
  switch (state.kind) {
    case "valid": return null;
    case "notYet": return t.word.notYet;
    case "expired": return t.word.expired;
    case "missing": return t.word.missing;
    case "noExam": return t.word.noExam;
  }
}

/** The date part of a licence row: "01/12 – 02/12", "đến 30/11", "lần khám 10/11". */
export function clearanceDates(state: ClearanceState): string {
  switch (state.kind) {
    case "valid": return state.clearance.validUntil ? t.until(dmAcademy(state.clearance.validUntil)) : t.noEnd;
    case "notYet": return state.clearance.validUntil
      ? t.range(dmAcademy(state.clearance.validFrom), dmAcademy(state.clearance.validUntil))
      : t.from(dmAcademy(state.clearance.validFrom));
    case "expired": return state.clearance?.validUntil ? t.endedOn(dmAcademy(state.clearance.validUntil)) : "";
    case "missing": return t.exam(dmAcademy(state.exam.examinedAt));
    case "noExam": return "";
  }
}

/** ACTIVE clearances that no current exam points at: left over from earlier exams; they do not count any more. */
export function olderClearances(d: MedicalDossier): MedicalClearance[] {
  const governing = new Set(SCOPES.map(s => governingClearanceFor(d, s)?.id).filter(Boolean));
  return (d.activeClearances ?? []).filter(c => !governing.has(c.id));
}
