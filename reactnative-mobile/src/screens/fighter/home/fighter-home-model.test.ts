/// <reference types="jest" />
import type { CampBout, Suspension } from "@/features/fight-camp/api";
import type { TrainingPlan, TrainingSession } from "@/api/types";
import type { AiJob } from "@/api/video/video-ai.types";
import { previewBout, previewSuspension } from "@/features/fight-camp/state/camp-preview";
import { healthLine, nearestBout, planLine, shortSession, upcoming, videoLine, weightLine } from "./fighter-home-model";

const bout = (over: Partial<CampBout>): CampBout => ({ ...previewBout, ...over });
const sus = (over: Partial<Suspension>): Suspension => ({ ...previewSuspension, ...over });
const session = (over: Partial<TrainingSession>) => ({ id: "s", title: "Đấm đích", status: "SCHEDULED", sessionType: "PAD_WORK", scheduledAt: "2026-11-11T09:00:00Z", ...over }) as TrainingSession;

describe("fighter home rules", () => {
  it("picks the nearest open bout and ignores finished ones", () => {
    expect(nearestBout([bout({ id: "late", status: "CAMP", boutAt: "2026-12-26T12:00:00Z" }), bout({ id: "done", status: "COMPLETED", boutAt: "2026-11-01T12:00:00Z" }), bout({ id: "soon", status: "FIGHT_WEEK", boutAt: "2026-11-14T12:00:00Z" })])?.id).toBe("soon");
    expect(nearestBout([bout({ status: "CANCELLED" })])).toBeNull();
  });

  it("says weight against the limit with when it was logged", () => {
    expect(weightLine(77.6, "2026-11-10", 77, "2026-11-11")).toEqual({ label: "Cân hôm qua", value: "77,6 kg · vượt 0,6 kg", danger: true });
    expect(weightLine(76.5, "2026-11-11", 77, "2026-11-11").value).toBe("76,5 kg · trong giới hạn");
    expect(weightLine(76.5, "2026-11-05", 77, "2026-11-11").label).toBe("Cân ngày 05/11");
    expect(weightLine(null, null, 77, "2026-11-11")).toMatchObject({ value: "Chưa ghi cân", danger: true });
  });

  it("lists upcoming scheduled sessions and words a later one", () => {
    const now = new Date("2026-11-11T08:00:00Z");
    const list = upcoming([session({ id: "b", scheduledAt: "2026-11-12T00:30:00Z" }), session({ id: "a" }), session({ id: "x", status: "COMPLETED" }), session({ id: "old", scheduledAt: "2026-11-10T00:00:00Z" })], now);
    expect(list.map(s => s.id)).toEqual(["a", "b"]);
    expect(shortSession(list[1], () => "Thể lực")).toBe("T5 07:30 · Thể lực");
  });

  it("puts a suspension in force before the doctor's eligibility", () => {
    expect(healthLine([sus({ status: "ACTIVE", endsOn: "2026-12-08", blockedSessionTypes: ["SPARRING", "GRAPPLING"] })], true)).toEqual({ mark: "warn", line: "Đình chỉ đến 08/12 · không đối luyện" });
    expect(healthLine([sus({ status: "AWAITING_CLEARANCE" })], true)?.line).toBe("Chờ bác sĩ xác nhận tập lại");
    expect(healthLine([], false)).toEqual({ mark: "warn", line: "Chưa được tập luyện" });
    expect(healthLine([sus({ status: "ENDED", gradedReturn: null })], true)).toEqual({ mark: "ok", line: "Đủ điều kiện tập luyện" });
  });

  it("shows the active plan's progress and week", () => {
    const p = { title: "Tăng sức bền", status: "ACTIVE", startDate: "2026-10-01", endDate: "2026-11-25", progress: { totalSessions: 10, completedSessions: 6, completionPercentage: 60 } } as TrainingPlan;
    expect(planLine([p], "2026-11-11")).toEqual({ lead: "60%", line: "Tăng sức bền · tuần 6/8" });
    expect(planLine([{ ...p, progress: undefined }], "2026-11-11")).toEqual({ lead: "6/8", line: "Tăng sức bền · tuần hiện tại" });
    expect(planLine([{ ...p, status: "COMPLETED" }], "2026-11-11")).toBeNull();
  });

  it("counts last week's videos and describes the newest", () => {
    const job = (over: Partial<AiJob>) => ({ id: "j", status: "DONE", score: null, fighterId: "f", sessionId: null, videoId: null, alertCount: 0, hasImpairment: false, exerciseName: "Đấm đích", createdAt: "2026-11-10T03:00:00Z", updatedAt: "", ...over }) as AiJob;
    expect(videoLine([job({ alertCount: 2 }), job({ id: "old", createdAt: "2026-10-01T00:00:00Z" })], new Date("2026-11-11T08:00:00Z"))).toEqual({ count: 1, line: "Đấm đích · 10/11 · 2 cảnh báo" });
    expect(videoLine([], new Date())).toEqual({ count: 0, line: null });
  });
});
