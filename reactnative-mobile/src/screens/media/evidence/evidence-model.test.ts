import { filterFindings, metricsOf } from "./evidence-model";
import { tabsFor } from "./evidence-tabs";
import type { ResultFinding, WorkerResult } from "@/components/video/pose-model";

const f = (id: string, severity: ResultFinding["severity"], timeMs: number): ResultFinding => ({
  id, actionId: null, title: id, description: "", severity, confidence: 1, timeMs, recommendation: "",
});

describe("evidence model", () => {
  it("filters and sorts findings", () => {
    const rows = [f("b", "warning", 900), f("a", "positive", 100), f("c", "critical", 50)];
    expect(filterFindings(rows, "all").map((r) => r.id)).toEqual(["c", "a", "b"]);
    expect(filterFindings(rows, "fix").map((r) => r.id)).toEqual(["c", "b"]);
    expect(filterFindings(rows, "good").map((r) => r.id)).toEqual(["a"]);
  });

  it("computes the four metrics with fallbacks", () => {
    const base: WorkerResult = { fps: 30, durationMs: 1000, width: null, height: null, frames: [], strikes: [], findings: [], movementEvidence: null, avgScore: null };
    expect(metricsOf(base)).toEqual({ strikes: 0, avgScore: null, peakSpeed: null, usablePct: null });
    const s = { actionId: null, family: "punch" as const, technique: "jab", side: "left" as const, startMs: 0, impactMs: 1, endMs: 2, confidence: null, angle: null, guardKept: null };
    const m = metricsOf({
      ...base,
      strikes: [{ ...s, score: 80, peakSpeed: 1.5 }, { ...s, score: 60, peakSpeed: 2.5 }],
      movementEvidence: { status: "limited", usableFrames: 87, totalFrames: 100, guidance: [], windows: [] },
    });
    expect(m).toEqual({ strikes: 2, avgScore: 70, peakSpeed: 2.5, usablePct: 87 });
  });

  it("gives doctors no review tab", () => {
    expect(tabsFor("doctor")).toEqual(["timeline", "metrics"]);
    expect(tabsFor("coach")).toContain("review");
  });
});
