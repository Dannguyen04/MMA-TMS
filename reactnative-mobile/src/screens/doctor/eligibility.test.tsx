import type { MedicalClearance, MedicalExamination } from "@/api/types";
import { eligibilityLevel, reasonText } from "@/screens/doctor/eligibility";

jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));

const exam = { id: "e1", decision: "ELIGIBLE", restrictions: null } as unknown as MedicalExamination;
const ok = { scope: "TRAINING" as const, eligible: true, reasons: [] };

describe("điều kiện tham gia", () => {
  it("phân mức Đủ / Đủ có giới hạn / Chưa đủ chỉ từ dữ liệu", () => {
    expect(eligibilityLevel(ok, exam, null)).toBe("eligible");
    expect(eligibilityLevel(ok, { ...exam, decision: "ELIGIBLE_WITH_RESTRICTIONS" }, null)).toBe("restricted");
    const clr = { restrictions: { excludedJoints: ["LEFT_KNEE"], allowedSessionTypes: null, allowedTechniqueTypes: null, notes: null } } as unknown as MedicalClearance;
    expect(eligibilityLevel(ok, exam, clr)).toBe("restricted");
    expect(eligibilityLevel({ ...ok, eligible: false, reasons: ["CLEARANCE_REQUIRED"] }, exam, null)).toBe("notEligible");
  });

  it("không in mã lý do thô", () => {
    expect(reasonText("CLEARANCE_EXPIRED")).not.toContain("CLEARANCE");
    expect(reasonText("ABC_UNKNOWN")).not.toContain("ABC");
  });
});
