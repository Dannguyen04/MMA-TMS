import { ApiError, MEDICAL_GATE_CODE, medicalGateReasons } from "@/api/errors";

describe("medicalGateReasons", () => {
  it("returns string reasons for the medical gate code", () => {
    const error = new ApiError(409, MEDICAL_GATE_CODE, "blocked", {
      reasons: ["NO_VALID_PRE_TRAINING_EXAM", 42, "ACTIVE_INJURY"],
    });
    expect(medicalGateReasons(error)).toEqual(["NO_VALID_PRE_TRAINING_EXAM", "ACTIVE_INJURY"]);
  });

  it("returns an empty list when the gate has no readable reasons", () => {
    expect(medicalGateReasons(new ApiError(409, MEDICAL_GATE_CODE, "blocked"))).toEqual([]);
  });

  it("returns null for other 409 codes and non-API errors", () => {
    expect(medicalGateReasons(new ApiError(409, "REGISTRATION_CONFLICT", "taken"))).toBeNull();
    expect(medicalGateReasons(new Error("boom"))).toBeNull();
  });
});
