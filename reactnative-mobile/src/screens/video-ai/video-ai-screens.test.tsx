import type { AiJob } from "@/api/video-ai.types";

/* eslint-disable @typescript-eslint/no-require-imports */
const model = () => require("./ai-model") as typeof import("./ai-model");

describe("ai-model", () => {
  const job = (id: string, status: string, h: number, extra: Partial<AiJob> = {}): AiJob => ({
    id, status, score: status === "DONE" ? 70 : null, fighterId: "f", sessionId: null, videoId: `v-${id}`, alertCount: 0, hasImpairment: false, exerciseName: null,
    createdAt: new Date(Date.now() - h * 3_600_000).toISOString(), updatedAt: "", ...extra,
  });

  it("lọc trên máy, mới nhất trước, job chờ HLV duyệt lên đầu", () => {
    const { arrangeJobs } = model();
    const rows = [job("a", "DONE", 1), job("b", "DONE", 5), job("c", "FAILED", 0), job("d", "DONE", 3)];
    expect(arrangeJobs(rows, { status: "DONE" }).map((j) => j.id)).toEqual(["a", "d", "b"]);
    expect(arrangeJobs(rows, { status: "DONE" }, new Set(["b"])).map((j) => j.id)).toEqual(["b", "a", "d"]);
    expect(arrangeJobs(rows, { status: "ALL" }).map((j) => j.id)).toEqual(["c", "a", "d", "b"]);
  });

  it("điểm hiện nguyên số backend trả, không '/100'; chưa xong → '–'", () => {
    const { scoreText } = model();
    expect(scoreText({ status: "DONE", score: 71 })).toBe("71");
    expect(scoreText({ status: "DONE", score: 0 })).toBe("0");
    expect(scoreText({ status: "PROCESSING", score: 50 })).toBe("–");
  });

  it("người duyệt: không lộ id; trùng người đăng nhập → 'Bạn đã duyệt'", () => {
    const { reviewerText } = model();
    const at = "2026-10-19T03:00:00.000Z";
    expect(reviewerText("u-1", at, "u-2")).toBe("Đã duyệt · 19/10/2026");
    expect(reviewerText("u-2", at, "u-2")).toBe("Bạn đã duyệt · 19/10/2026");
    expect(reviewerText("u-1", at, "u-2")).not.toContain("u-1");
  });

  it("đúng 100 bản ghi mới hiện dòng giới hạn", () => {
    const { isCapped } = model();
    expect(isCapped(100)).toBe(true);
    expect(isCapped(99)).toBe(false);
    expect(isCapped(101)).toBe(false);
  });

  it("mức cảnh báo: thấp/trung bình = warning, cao = danger; nhóm theo khớp", () => {
    const { severityTone, groupByJoint } = model();
    expect(severityTone("medium")).toBe("attention");
    expect(severityTone("high")).toBe("danger");
    expect(severityTone("CRITICAL")).toBe("danger");
    const a = (joint: string, severity: string, t: number) => ({ joint, state: "SUSPECTED", severity, triggerTimeMs: t, windowStartMs: null, consecutiveLowRom: null, avgRomRatio: null, motionClass: null, recommendation: "" });
    const g = groupByJoint([a("LEFT_KNEE", "medium", 5), a("RIGHT_KNEE", "high", 9), a("LEFT_KNEE", "high", 2)]);
    expect(g.map((x) => [x.joint, x.worst, x.items.length])).toEqual([["LEFT_KNEE", "high", 2], ["RIGHT_KNEE", "high", 1]]);
    expect(g[0]!.items[0]!.triggerTimeMs).toBe(2);
  });

  it("tiến trình 4 bước và thời gian mm:ss", () => {
    const { currentStep, mmss } = model();
    expect(currentStep("PENDING")).toBe(0);
    expect(currentStep("PROCESSING")).toBe(1);
    expect(mmss(41_500)).toBe("00:42");
  });
});

describe("Cần chú ý (Bác sĩ)", () => {
  it("đếm võ sĩ khác nhau: hợp tình trạng y tế và cảnh báo suy giảm AI", () => {
    const { attentionUnion } = require("@/screens/doctor/redesign/doctor-format") as typeof import("@/screens/doctor/redesign/doctor-format");
    const items = [
      { id: "a", currentMedicalStatus: "INJURED" as const },
      { id: "b", currentMedicalStatus: "HEALTHY" as const },
      { id: "c", currentMedicalStatus: "NOT_CLEARED" as const },
    ];
    expect(attentionUnion(items, [])).toBe(2);
    expect(attentionUnion(items, ["a", "a", "b", "zz"])).toBe(3);
  });
});
