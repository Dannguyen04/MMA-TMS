import { TRAINING_PLAN_PHASES } from "@/api/types";

import { buildCreateTrainingPlanBody, isTrainingPlanPhase, planPhaseLabel } from "./plan-phase";

const base = {
  fighterId: "fighter-1",
  coachId: "coach-1",
  title: "Kế hoạch nền",
  startDate: "2026-10-04",
};

describe("buildCreateTrainingPlanBody", () => {
  it("requires a lowercase phase on create", () => {
    expect(buildCreateTrainingPlanBody({ ...base, phase: "" }).ok).toBe(false);
    expect(buildCreateTrainingPlanBody({ ...base, phase: "BASE" })).toEqual({
      ok: false,
      reason: "phase",
    });
    const built = buildCreateTrainingPlanBody({ ...base, phase: "fight_camp" });
    expect(built.ok).toBe(true);
    if (built.ok) expect(built.body.phase).toBe("fight_camp");
  });

  it("maps every backend phase to a Vietnamese label and the enum", () => {
    for (const phase of TRAINING_PLAN_PHASES) {
      expect(isTrainingPlanPhase(phase)).toBe(true);
      expect(planPhaseLabel(phase)).toContain(phase);
      expect(planPhaseLabel(phase)).not.toBe(phase);
    }
    expect(planPhaseLabel("BASE")).toBe("BASE");
  });
});
