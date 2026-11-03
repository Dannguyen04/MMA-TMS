import type { MedicalDossier } from "@/api/types";
import { scopeState, restrictionsActive } from "@/components/medical/eligibility-model";
import { reasonLine } from "@/screens/fighter/redesign/health-status";

const base = {
  fighterId: "f",
  activeInjuries: [],
  activeRecoveryPlans: [],
  currentExaminations: { training: { id: "e1", decision: "ELIGIBLE", restrictions: null }, competition: null },
  activeClearances: [],
  openReviewRequests: [],
  eligibility: {
    training: { scope: "TRAINING", eligible: true, reasons: [] },
    competition: { scope: "COMPETITION", eligible: false, reasons: ["CLEARANCE_REQUIRED"] },
  },
} as unknown as MedicalDossier;

describe("Cơ thể võ sĩ", () => {
  it("phân mức từ dữ liệu", () => {
    expect(scopeState(base, "training").level).toBe("eligible");
    expect(scopeState(base, "competition").level).toBe("notEligible");
    const restricted = { ...base, activeClearances: [{ examinationId: "e1", restrictions: { excludedJoints: ["LEFT_KNEE"], allowedSessionTypes: null, allowedTechniqueTypes: null, notes: null } }] } as unknown as MedicalDossier;
    expect(scopeState(restricted, "training").level).toBe("restricted");
    expect(restrictionsActive({ excludedJoints: [], allowedSessionTypes: null, allowedTechniqueTypes: null, notes: " " })).toBe(false);
  });

  it("lý do bằng lời thường, không mã thô", () => {
    expect(reasonLine("EXAMINATION_REQUIRED")).toBe("Cần khám sức khỏe ban đầu với bác sĩ.");
    expect(reasonLine("XYZ")).not.toContain("XYZ");
  });
});
