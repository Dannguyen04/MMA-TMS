/// <reference types="jest" />
import type { TrainingPlan, TrainingSession } from "@/api/types";
import { currentPlan, dose, nextPlanSession, planWeek, rowLead, shortRange } from "./plans-model";

const plan = (over: Partial<TrainingPlan>): TrainingPlan => ({
  id: "p", title: "Plan", phase: "base", status: "ACTIVE", startDate: "2026-11-02", endDate: "2026-12-27", milestones: [], ...over,
}) as TrainingPlan;

describe("currentPlan", () => {
  const base = plan({ id: "base", phase: "base", startDate: "2026-11-09" });
  const camp = plan({ id: "camp", phase: "fight_camp", startDate: "2026-10-01" });
  const done = plan({ id: "done", status: "COMPLETED", startDate: "2026-11-10" });

  it("prefers the plan in a bout phase while a bout is open", () => {
    expect(currentPlan([base, camp, done], true)?.id).toBe("camp");
  });
  it("takes the active plan that started last without a bout", () => {
    expect(currentPlan([camp, base, done], false)?.id).toBe("base");
  });
  it("falls back to the latest active plan when none is in a bout phase", () => {
    expect(currentPlan([base, done], true)?.id).toBe("base");
  });
  it("is null when nothing is active", () => {
    expect(currentPlan([done], false)).toBeNull();
  });
});

describe("plan weeks", () => {
  it("counts the week today, clamped to the plan", () => {
    const p = plan({ startDate: "2026-11-02", endDate: "2026-12-27" });
    expect(planWeek(p, "2026-11-11")).toEqual({ now: 2, total: 8 });
    expect(planWeek(p, "2026-10-01")).toEqual({ now: 1, total: 8 });
    expect(planWeek(p, "2027-02-01")).toEqual({ now: 8, total: 8 });
    expect(planWeek(plan({ endDate: null as never }), "2026-11-11")).toBeNull();
  });
  it("leads other rows with the week, a check when done, a dash otherwise", () => {
    expect(rowLead(plan({}), "2026-11-11")).toEqual({ text: "2", sub: "/8" });
    expect(rowLead(plan({ status: "COMPLETED" }), "2026-11-11")).toEqual({ text: "✓", done: true });
    expect(rowLead(plan({ status: "CANCELLED" }), "2026-11-11")).toEqual({ text: "–" });
    expect(shortRange(plan({}))).toBe("02/11 – 27/12");
  });
});

describe("dose", () => {
  it("reads the time as the exercise total, not per round", () => {
    expect(dose({ sets: 5, reps: null, durationSeconds: 1500, targetRpe: 8 } as never)).toBe("5 hiệp · 25 phút · RPE 8");
  });
  it("covers sets × reps, time alone, sets alone and nothing", () => {
    expect(dose({ sets: 4, reps: 6, durationSeconds: null, targetRpe: 8 } as never)).toBe("4 × 6 · RPE 8");
    expect(dose({ sets: null, reps: null, durationSeconds: 630, targetRpe: null } as never)).toBe("10,5 phút");
    expect(dose({ sets: 3, reps: null, durationSeconds: null, targetRpe: null } as never)).toBe("3 hiệp");
    expect(dose({ sets: null, reps: null, durationSeconds: 45, targetRpe: null } as never)).toBe("45 giây");
    expect(dose({ sets: null, reps: null, durationSeconds: null, targetRpe: null } as never)).toBe("");
  });
});

describe("nextPlanSession", () => {
  const s = (id: string, planId: string, at: string, status = "SCHEDULED") => ({ id, planId, scheduledAt: at, status }) as TrainingSession;
  it("picks the plan's earliest scheduled session from now", () => {
    const now = new Date("2026-11-11T05:00:00.000Z");
    const list = [s("past", "p", "2026-11-10T05:00:00.000Z"), s("other", "q", "2026-11-12T01:00:00.000Z"),
      s("later", "p", "2026-11-14T05:00:00.000Z"), s("done", "p", "2026-11-12T00:00:00.000Z", "COMPLETED"), s("next", "p", "2026-11-13T05:00:00.000Z")];
    expect(nextPlanSession(list, "p", now)?.id).toBe("next");
    expect(nextPlanSession(list, "z", now)).toBeNull();
  });
});
