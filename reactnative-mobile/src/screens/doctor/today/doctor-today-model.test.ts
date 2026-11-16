/// <reference types="jest" />
import type { Suspension } from "@/api/fight-camp";
import type { PublicFighter } from "@/api/types";
import { previewSuspension } from "@/screens/fight-camp/camp-preview";
import { aiRows, pendingClearances, reviewRows, todayGroups, watchRows } from "./doctor-today-model";

const names = new Map([["f1", "Kenji Morita"], ["f2", "Aigerim Sadykova"], ["f3", "Anh Le"]]);
const sus = (over: Partial<Suspension>): Suspension => ({ ...previewSuspension, status: "AWAITING_CLEARANCE", clearedAt: null, requiresClearance: true, ...over });
const fighter = (id: string, status: PublicFighter["currentMedicalStatus"]) => ({ id, firstName: id, lastName: "", currentMedicalStatus: status }) as PublicFighter;

describe("doctor Hôm nay rules", () => {
  it("lists clearances waiting for the doctor, longest wait first, with one-line parts", () => {
    const out = pendingClearances([
      sus({ id: "a", fighterId: "f2", reason: "MEDICAL", endsOn: "2026-11-10" }),
      sus({ id: "b", fighterId: "f1", reason: "KO", endsOn: "2026-11-08" }),
      sus({ id: "c", fighterId: "f3", status: "ACTIVE" }),
      sus({ id: "d", fighterId: "f3", clearedAt: "2026-11-09T00:00:00Z" }),
    ], names, "2026-11-11");
    expect(out.map(p => [p.name, p.wait, p.line])).toEqual([["Kenji Morita", 3, "KO · hết 08/11"], ["Aigerim Sadykova", 1, "Y tế · hết 10/11"]]);
  });

  it("counts today's follow-ups, expiries and weigh-ins only", () => {
    const g = todayGroups([
      { kind: "FOLLOW_UP", date: "2026-11-11", at: null, fighterId: "f1", fighterName: "Kenji", refId: "1", label: null },
      { kind: "FOLLOW_UP", date: "2026-11-12", at: null, fighterId: "f1", fighterName: "Kenji", refId: "2", label: null },
      { kind: "CLEARANCE_EXPIRY", date: "2026-11-11", at: null, fighterId: "f2", fighterName: "A", refId: "3", label: "TRAINING" },
      { kind: "SUSPENSION_END", date: "2026-11-11", at: null, fighterId: "f2", fighterName: "A", refId: "4", label: "KO" },
    ], "2026-11-11");
    expect([g.follow.length, g.expire.length, g.weigh.length]).toEqual([1, 1, 0]);
  });

  it("puts not-cleared and injured fighters before those under watch, and skips healthy ones", () => {
    expect(watchRows([fighter("w", "MONITORING"), fighter("h", "HEALTHY"), fighter("n", "NOT_CLEARED"), fighter("i", "INJURED")]).map(r => [r.title, r.line])).toEqual([
      ["n", "Chưa cho phép tập"], ["i", "Chấn thương"], ["w", "Theo dõi"],
    ]);
  });

  it("lists AI impairment jobs newest first and review requests with who asked", () => {
    const ai = aiRows([
      { id: "j1", status: "DONE", score: null, fighterId: "f1", sessionId: null, videoId: null, alertCount: 2, hasImpairment: true, createdAt: "2026-11-09T03:00:00Z", updatedAt: "" },
      { id: "j2", status: "DONE", score: null, fighterId: "f3", sessionId: null, videoId: null, alertCount: 0, hasImpairment: false, createdAt: "2026-11-10T03:00:00Z", updatedAt: "" },
    ], names);
    expect(ai.map(r => [r.title, r.line, r.jobId])).toEqual([["Kenji Morita", "2 cảnh báo · 09/11", "j1"]]);
    expect(reviewRows([{ id: "r1", fighterId: "f1", fighterName: "Kenji Morita", reason: "Đau đầu", requestedAt: "2026-11-10T03:00:00Z", requesterName: "Rafael Costa" }])[0].line).toBe("Đau đầu · Rafael Costa · 10/11");
  });
});
