import type { MedicalClearance, MedicalDossier, MedicalEligibility, MedicalExamination, MedicalRestrictions } from "@/api/types";

export type EligibilityScope = "training" | "competition";
export type EligibilityLevel = "eligible" | "restricted" | "notEligible";

/** Có giới hạn khi một trong các danh sách hoặc ghi chú có nội dung. */
export function restrictionsActive(value: MedicalRestrictions | null | undefined): boolean {
  if (!value) return false;
  return Boolean(
    value.excludedJoints?.length || value.allowedSessionTypes?.length || value.allowedTechniqueTypes?.length || value.notes?.trim(),
  );
}

/** Giấy phép điều chỉnh: cấp từ kết luận hiện hành (máy chủ không gộp giấy cũ). */
export function governingClearance(dossier: MedicalDossier, exam: MedicalExamination | null): MedicalClearance | null {
  if (!exam) return null;
  return dossier.activeClearances.find((row) => row.examinationId === exam.id) ?? null;
}

/** "Có giới hạn" chỉ khi dữ liệu nói vậy: kết luận ELIGIBLE_WITH_RESTRICTIONS hoặc có giới hạn ghi trên kết luận/giấy phép. */
export function eligibilityLevel(
  value: MedicalEligibility,
  exam: MedicalExamination | null,
  clearance: MedicalClearance | null,
): EligibilityLevel {
  if (!value.eligible) return "notEligible";
  if (exam?.decision === "ELIGIBLE_WITH_RESTRICTIONS" || restrictionsActive(exam?.restrictions) || restrictionsActive(clearance?.restrictions)) {
    return "restricted";
  }
  return "eligible";
}

export type ScopeState = {
  value: MedicalEligibility;
  exam: MedicalExamination | null;
  clearance: MedicalClearance | null;
  level: EligibilityLevel;
};

export function scopeState(dossier: MedicalDossier, scope: EligibilityScope): ScopeState {
  const value = dossier.eligibility[scope];
  const exam = dossier.currentExaminations[scope];
  const clearance = governingClearance(dossier, exam);
  return { value, exam, clearance, level: eligibilityLevel(value, exam, clearance) };
}
