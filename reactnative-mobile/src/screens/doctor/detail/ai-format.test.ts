import type { AnalysisJob, HealthAlert, JobHealthAlerts } from "@/api/media";

import { clock, fighterJobs, groupAlerts, jobPhase, severityText } from "./ai-format";

const job = (id: string, fighterId: string, at: string): AnalysisJob => ({ id, status: "DONE", score: null, fighterId, sessionId: null, videoId: null, alertCount: 1, hasImpairment: true, createdAt: at, updatedAt: at });
const al = (joint: string, severity: string, t = 0): HealthAlert => ({ joint, state: "CONFIRMED_IMPAIRMENT", severity, triggerTimeMs: t, windowStartMs: 0, consecutiveLowRom: 3, avgRomRatio: 0.5, motionClass: "UNKNOWN", recommendation: "" });
const res = (jobId: string, a: HealthAlert[]): JobHealthAlerts => ({ jobId, status: "DONE", alertCount: a.length, hasImpairment: true, healthAlerts: a, jointStates: {} });

describe("ai-format", () => {
  it("lọc theo võ sĩ, mới nhất trước, tối đa 10", () => {
    const rows = [job("a", "f1", "2026-10-01"), job("b", "f2", "2026-10-05"), job("c", "f1", "2026-10-09")];
    expect(fighterJobs(rows, "f1").map((j) => j.id)).toEqual(["c", "a"]);
    expect(fighterJobs(Array.from({ length: 15 }, (_, i) => job(`j${i}`, "f1", `2026-09-${String(i + 1).padStart(2, "0")}`)), "f1")).toHaveLength(10);
  });
  it("nhóm theo khớp, nặng nhất lên trước", () => {
    const g = groupAlerts([
      { job: job("j1", "f", "2026-10-01"), res: res("j1", [al("LEFT_SHOULDER", "medium")]) },
      { job: job("j2", "f", "2026-10-03"), res: res("j2", [al("RIGHT_KNEE", "high", 9000), al("RIGHT_KNEE", "medium", 1000)]) },
    ]);
    expect(g.map((x) => [x.label, x.worst, x.items.length])).toEqual([["Gối phải", "high", 2], ["Vai trái", "medium", 1]]);
    expect(g[0]!.items.map((i) => i.alert.triggerTimeMs)).toEqual([1000, 9000]);
  });
  it("định dạng", () => {
    expect(clock(95_500)).toBe("1:36");
    expect(severityText("critical")).toBe("Nghiêm trọng");
    expect(severityText("weird")).toBe("Chưa rõ mức");
    expect([jobPhase("PENDING"), jobPhase("PROCESSING"), jobPhase("FAILED"), jobPhase("DONE")]).toEqual(["running", "running", "failed", "done"]);
  });
});
