import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("doctor medical reads", () => {
  const source = readFileSync(join(__dirname, "medical-screen.tsx"), "utf8");

  it("does not call the coach measurement list or the training-session list", () => {
    expect(source).not.toContain("listFighterMeasurements");
    expect(source).not.toContain("createFighterMeasurement");
    expect(source).not.toContain("listTrainingSessions");
    expect(source).not.toContain("/measurements");
    expect(source).not.toContain("/training-sessions");
    expect(source).toContain("getFighterMedicalSummary");
  });
});
