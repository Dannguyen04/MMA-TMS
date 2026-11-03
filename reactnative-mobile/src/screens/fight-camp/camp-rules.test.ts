/// <reference types="jest" />
import { ApiError } from "@/api/errors";
import { campError, dayKey, gate1, gateDecides, isToday, liveSuspensions, openSessionNames, readKg, validateAnalysis } from "./camp-rules";
import type { Suspension } from "@/api/fight-camp";
describe("Fight Camp input and server errors", () => {
  it("accepts comma or dot and rejects rounding, exponents, negatives and out-of-range weights", () => {
    expect(readKg("59,8")).toBe(59.8); expect(readKg("60.5")).toBe(60.5);
    expect(readKg("30")).toBe(30); expect(readKg("200,0")).toBe(200);
    for (const invalid of ["", "60,55", "1e2", "-60", "29,9", "200,1", "NaN"]) expect(() => readKg(invalid)).toThrow();
  });
  it("explains an early weigh-in using earliestOn supplied by the backend", () => {
    const text = campError(new ApiError(409, "BOUT_WEIGH_IN_TOO_EARLY", "early", { earliestOn: "2026-10-29" }));
    expect(text).toContain("29/10/2026"); expect(text).toContain("giữ lại");
  });
  it("requires evidence and an observation basis before saving a tactic", () => {
    const a = { profile: {}, observations: [{ id: "o1", kind: "OPENING" as const, text: "Hạ tay", confidence: "ONCE" as const, evidenceNote: "Video hiệp 1" }], tactics: [{ id: "t1", text: "Đổi góc", round: null, observationIds: ["o1"], sessionIds: [] }] };
    expect(() => validateAnalysis(a, 3)).not.toThrow();
    expect(() => validateAnalysis({ ...a, observations: [{ ...a.observations[0], evidenceNote: "" }] }, 3)).toThrow("bằng chứng");
    expect(() => validateAnalysis({ ...a, tactics: [{ ...a.tactics[0], observationIds: [] }] }, 3)).toThrow("căn cứ");
    expect(() => validateAnalysis({ ...a, tactics: [{ ...a.tactics[0], round: 4 }] }, 3)).toThrow("Hiệp");
  });
  it("names missing and expiring items for the Gate 1 conflict and the requirements lock", () => {
    const text = campError(new ApiError(409, "BOUT_REQUIREMENTS_INCOMPLETE", "Gate 1 failed", {
      missing: [{ code: "MEDICAL", label: "Hồ sơ y tế thi đấu", status: "MISSING", validUntil: null }],
      expiring: [{ code: "BLOOD", label: "Xét nghiệm máu", status: "CONFIRMED", validUntil: "2026-11-01" }],
    }));
    expect(text).toContain("Còn thiếu: Hồ sơ y tế thi đấu"); expect(text).toContain("Hết hạn trước ngày thi đấu: Xét nghiệm máu");
    expect(campError(new ApiError(409, "BOUT_REQUIREMENTS_INCOMPLETE", "x"))).toContain("Chưa đủ hồ sơ");
    expect(campError(new ApiError(409, "BOUT_REQUIREMENTS_LOCKED", "x"))).toContain("lý do mở khoá");
  });
});
describe("Gate 1 mirror, academy day and suspensions", () => {
  const req = (status: string, validUntil: string | null, required = true) => ({ code: status + validUntil, label: status, required, status, validUntil });
  it("blocks on required items that are not provided/confirmed or expire before the bout, like the server", () => {
    const g = gate1([req("MISSING", null), req("CONFIRMED", "2026-11-01"), req("PROVIDED", "2026-12-01"), req("MISSING", null, false), req("CONFIRMED", null)], "2026-11-02T19:00:00+07:00");
    expect(g.missing.map(i => i.status)).toEqual(["MISSING"]);
    expect(g.expiring.map(i => i.validUntil)).toEqual(["2026-11-01", null]);
    expect(g.passed).toBe(false);
    expect(gate1([req("CONFIRMED", "2026-11-02")], "2026-11-02T19:00:00+07:00").passed).toBe(true);
    expect(gateDecides("CAMP")).toBe(true); expect(gateDecides("FIGHT_WEEK")).toBe(false);
  });
  it("reads the day on the Asia/Ho_Chi_Minh calendar", () => {
    expect(dayKey("2026-10-31T18:30:00Z")).toBe("2026-11-01");
    expect(isToday("2026-10-31", new Date("2026-10-31T10:00:00+07:00"))).toBe(true);
    expect(isToday("2026-10-30", new Date("2026-10-31T10:00:00+07:00"))).toBe(false);
    expect(isToday(null)).toBe(false);
  });
  it("lists live suspensions most restrictive first and the session types they leave open", () => {
    const s = (id: string, status: Suspension["status"]): Suspension => ({ id, reason: "KO", status, startsOn: "2026-10-26", endsOn: "2026-11-20", blockedSessionTypes: ["SPARRING", "PAD_WORK"], requiresClearance: true, clearedAt: null, clearanceNote: null, maxAllowedTier: 1, gradedReturn: null });
    expect(liveSuspensions([s("a", "ENDED"), s("b", "UPCOMING"), s("c", "ACTIVE")]).map(x => x.id)).toEqual(["c", "b"]);
    expect(openSessionNames(s("x", "ACTIVE"))).not.toContain("Đối luyện");
    expect(openSessionNames(s("x", "ACTIVE"))).toContain("Phục hồi");
  });
});
