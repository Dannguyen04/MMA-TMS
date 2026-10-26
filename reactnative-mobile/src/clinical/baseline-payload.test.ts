import { buildBaselineExamination, buildClearanceRetry, emptyBaselineDraft } from "./baseline-payload";

function ready() {
  const draft = emptyBaselineDraft();
  draft.decision = "ELIGIBLE";
  draft.reason = "Baseline onboarding exam";
  draft.weightKg = "70";
  draft.restingHeartRate = "60";
  draft.bloodPressureSystolic = "120";
  draft.bloodPressureDiastolic = "80";
  draft.temperatureC = "36.6";
  draft.spo2Pct = "98";
  draft.hydration = "GOOD";
  draft.results = { cardio: "NORMAL", neuro: "ABNORMAL", msk: "INCONCLUSIVE" };
  draft.scat6Reason = "Official SCAT6 wording is not licensed for this form";
  return draft;
}

describe("buildBaselineExamination", () => {
  it("sends uppercase enums and no injury", () => {
    const built = buildBaselineExamination(ready(), "2026-10-04T08:00:00.000Z");
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.body.examinationType).toBe("BASELINE");
    expect(built.body.vitals.hydration).toBe("GOOD");
    expect(built.body.assessments.map((row) => row.result)).toEqual([
      "NORMAL",
      "ABNORMAL",
      "INCONCLUSIVE",
    ]);
    expect(built.body).not.toHaveProperty("injuryId");
    expect(built.body.restrictions).toBeUndefined();
    expect(JSON.stringify(built.body)).not.toContain("baseline");
  });

  it("requires restrictions only for ELIGIBLE_WITH_RESTRICTIONS", () => {
    const missing = ready();
    missing.decision = "ELIGIBLE_WITH_RESTRICTIONS";
    expect(buildBaselineExamination(missing, "2026-10-04T08:00:00.000Z").ok).toBe(false);
    missing.restrictionNotes = "No sparring";
    const built = buildBaselineExamination(missing, "2026-10-04T08:00:00.000Z");
    expect(built.ok).toBe(true);
    if (built.ok) expect(built.body.restrictions).toEqual({ notes: "No sparring" });
  });

  it("refuses an empty examination", () => {
    expect(buildBaselineExamination(emptyBaselineDraft(), "2026-10-04T08:00:00.000Z").ok).toBe(false);
  });
});

describe("buildClearanceRetry", () => {
  it("retries clearance with the same examination id", () => {
    expect(buildClearanceRetry("exam-1", "TRAINING")).toEqual({
      examinationId: "exam-1",
      clearanceType: "TRAINING",
    });
    expect(buildClearanceRetry("", "TRAINING")).toBeNull();
  });
});
