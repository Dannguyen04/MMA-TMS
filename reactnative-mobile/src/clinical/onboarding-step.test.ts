import { clearanceFollowUp, nextClinicalStep } from "./onboarding-step";

describe("nextClinicalStep", () => {
  it("asks for a doctor before a baseline exam", () => {
    expect(
      nextClinicalStep({
        hasActiveDoctor: false,
        eligible: false,
        reasons: ["EXAMINATION_REQUIRED"],
      }).step,
    ).toBe("assign-doctor");
  });

  it("keeps EXAMINATION_REQUIRED as the baseline step", () => {
    expect(
      nextClinicalStep({
        hasActiveDoctor: true,
        eligible: false,
        reasons: ["EXAMINATION_REQUIRED"],
      }).step,
    ).toBe("baseline-exam");
  });

  it("does not treat eligible false with empty reasons as eligible", () => {
    const step = nextClinicalStep({ hasActiveDoctor: true, eligible: false, reasons: [] });
    expect(step.step).toBe("not-eligible");
    expect(step.step).not.toBe("eligible");
  });

  it("does not claim training eligibility before a refetch", () => {
    expect(clearanceFollowUp(null).claimEligible).toBe(false);
    expect(clearanceFollowUp(undefined).kind).toBe("unconfirmed");
  });

  it("claims eligibility only when the refetched dossier says so", () => {
    expect(clearanceFollowUp({ eligible: true, reasons: [] })).toEqual({
      kind: "eligible",
      claimEligible: true,
    });
    expect(
      clearanceFollowUp({ eligible: false, reasons: ["EXAMINATION_REQUIRED"] }),
    ).toEqual({
      kind: "blocked",
      claimEligible: false,
      reasons: ["EXAMINATION_REQUIRED"],
    });
  });

  it("waits for clearance when the server says so", () => {
    expect(
      nextClinicalStep({
        hasActiveDoctor: true,
        eligible: false,
        reasons: ["CLEARANCE_REQUIRED"],
      }).step,
    ).toBe("clearance");
  });
});
