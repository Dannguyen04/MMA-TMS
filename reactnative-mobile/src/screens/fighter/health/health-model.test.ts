/// <reference types="jest" />
import type { Suspension } from "@/api/fight-camp";
import type { MedicalDossier, MedicalHistoryEntry } from "@/api/types";
import { bodyMarks, byMonth, clearanceRows, dmLocal, historyRow, suspensionToday, verdict } from "./health-model";

const ok = { eligible: true, reasons: [] };
const dossier = (over: object = {}): MedicalDossier => ({
  fighterId: "f1", activeInjuries: [], activeRecoveryPlans: [], currentExaminations: { training: null, competition: null },
  activeClearances: [], openReviewRequests: [], eligibility: { training: ok, competition: ok }, ...over,
}) as unknown as MedicalDossier;
const susp = (over: Partial<Suspension>): Suspension => ({
  id: "s1", reason: "KO", status: "ACTIVE", startsOn: "2026-11-01", endsOn: "2026-11-20", blockedSessionTypes: ["SPARRING"],
  requiresClearance: false, clearedAt: null, clearanceNote: null, maxAllowedTier: 2, gradedReturn: null, ...over,
});

describe("verdict", () => {
  it("clears training and competition with one line", () => {
    const v = verdict(dossier(), null);
    expect(v).toMatchObject({ tone: "ok", word: "Được tập", lines: ["Được tập luyện và thi đấu."], frame: "success" });
    expect(v.competition.word).toBe("Được");
  });

  it("says competition is not cleared when only training is", () => {
    const v = verdict(dossier({ eligibility: { training: ok, competition: { eligible: false, reasons: ["CLEARANCE_REQUIRED"] } } }), null);
    expect(v.lines).toEqual(["Chưa được thi đấu."]);
    expect(v.competition).toEqual({ tone: "no", word: "Chưa được" });
  });

  it("gives the backend reason only, one sentence per line", () => {
    const v = verdict(dossier({ eligibility: { training: { eligible: false, reasons: ["CLEARANCE_REQUIRED"] }, competition: { eligible: false, reasons: [] } } }), null);
    expect(v).toMatchObject({ tone: "no", word: "Chưa được tập", frame: "danger" });
    // No current exam: "chưa cấp" would be wrong, the fighter has not been examined for it.
    expect(v.lines).toEqual(["Chưa khám để tập luyện."]);
  });

  it("lists the doctor's limits when training is restricted", () => {
    const exam = { id: "e1", scope: "TRAINING", decision: "ELIGIBLE_WITH_RESTRICTIONS", restrictions: { excludedJoints: ["LEFT_SHOULDER"], allowedSessionTypes: null, allowedTechniqueTypes: null, notes: null } };
    const v = verdict(dossier({ currentExaminations: { training: exam as never, competition: null } }), null);
    expect(v.word).toBe("Tập có giới hạn");
    expect(v.lines[0]).toBe("Tránh dùng: vai trái.");
  });

  it("reads a suspension over a medical clearance, but not over a medical no", () => {
    const s = susp({});
    const v = verdict(dossier(), s);
    expect(v).toMatchObject({ tone: "no", word: "Theo đình chỉ", training: { tone: "lim", word: "Theo đình chỉ" } });
    expect(v.lines[1]).toBe("Đang đình chỉ đến 20/11.");
    expect(verdict(dossier({ eligibility: { training: { eligible: false, reasons: [] }, competition: ok } }), s).word).toBe("Chưa được tập");
  });

  it("ignores an upcoming suspension", () => {
    expect(suspensionToday([susp({ status: "UPCOMING" })])).toBeNull();
    expect(suspensionToday([susp({})])?.id).toBe("s1");
    expect(suspensionToday(null)).toBeNull();
  });
});

describe("rows", () => {
  it("dates on the academy calendar", () => {
    expect(dmLocal("2026-11-10T20:00:00.000Z")).toBe("11/11");
    expect(dmLocal("2026-11-10")).toBe("10/11");
  });

  it("reads the licence from the current exam only, and tells a future one from a missing one", () => {
    const now = new Date("2026-11-15T03:00:00.000Z");
    const exam = (id: string, scope: string) => ({ id, scope, examinedAt: "2026-11-10T02:00:00.000Z" });
    const clr = (id: string, examinationId: string, validFrom: string, validUntil: string | null) =>
      ({ id, examinationId, clearanceType: "TRAINING", status: "ACTIVE", validFrom, validUntil, isCurrentlyValid: true });
    const required = { scope: "TRAINING", eligible: false, reasons: ["CLEARANCE_REQUIRED"] };
    const d = dossier({
      currentExaminations: { training: exam("e-now", "TRAINING"), competition: exam("e-comp", "COMPETITION") } as never,
      // An old exam's clearance, valid into 2027, must not stand in for the current one.
      activeClearances: [clr("old", "e-old", "2026-01-01T00:00:00.000Z", "2027-06-30T00:00:00.000Z"),
        clr("next", "e-now", "2026-11-30T22:00:00.000Z", "2026-12-02T09:59:00.000Z")] as never,
      eligibility: { training: required, competition: { ...required, scope: "COMPETITION" } } as never,
    });
    expect(clearanceRows(d, now)).toEqual([
      { scope: "training", ok: false, word: "Chưa hiệu lực", line: "Tập luyện · 01/12 – 02/12" },
      { scope: "competition", ok: false, word: "Chưa cấp", line: "Thi đấu · lần khám 10/11" },
    ]);
    expect(verdict(d, null).lines).toEqual(["Giấy phép có hiệu lực từ 01/12."]);
    expect(clearanceRows(dossier(), now)).toEqual([]);
  });

  it("turns history entries into one-line rows grouped by month", () => {
    const e = (recordType: string, recordedAt: string, snapshot: object) => ({ recordType, recordId: recordType, revision: 1, source: null, recordedAt, recordedByUserId: null, snapshot }) as MedicalHistoryEntry;
    const inj = e("INJURY", "2026-11-02T10:00:00.000Z", { affected_joint: "LEFT_SHOULDER", injury_type: "bong gân", status: "ACTIVE" });
    expect(historyRow(inj)).toMatchObject({ day: "02", title: "Chấn thương", tone: "warn" });
    expect(historyRow(inj).line).toMatch(/^Vai trái · bong gân · /);
    const exam = e("MEDICAL_EXAMINATION", "2025-10-28T10:00:00.000Z", { scope: "TRAINING", decision: "NOT_ELIGIBLE" });
    expect(historyRow(exam).tone).toBe("warn");
    expect(byMonth([inj, exam], 2026).map(g => g.label)).toEqual(["Tháng 11", "Tháng 10 · 2025"]);
  });

  it("reads the camelCase snapshots the API sends today", () => {
    const e = (recordType: string, snapshot: object) => ({ recordType, recordId: "x", revision: 1, source: null, recordedAt: "2026-11-10T07:12:45.906Z", recordedByUserId: null, snapshot }) as MedicalHistoryEntry;
    expect(historyRow(e("INJURY", { affectedJoint: "LEFT_ANKLE", injuryType: "Đau", status: "ACTIVE" })).line).toMatch(/^Cổ chân trái · Đau · /);
    expect(historyRow(e("MEDICAL_CLEARANCE", { clearanceType: "TRAINING", status: "ACTIVE", validUntil: "2026-12-02T16:59:00+00:00" })).line).toBe("Tập luyện · đến 02/12");
  });
});

describe("bodyMarks", () => {
  it("marks injured joints, rings joints to avoid, and the head only after a KO or TKO", () => {
    const exam = { id: "e1", decision: "ELIGIBLE_WITH_RESTRICTIONS", restrictions: { excludedJoints: ["LEFT_SHOULDER", "RIGHT_ANKLE"], allowedSessionTypes: null, allowedTechniqueTypes: null, notes: null } };
    const d = dossier({ activeInjuries: [{ id: "i1", affectedJoint: "LEFT_SHOULDER" }], currentExaminations: { training: exam, competition: null } });
    expect(bodyMarks(d, null)).toEqual({ hurt: ["LEFT_SHOULDER"], avoid: ["RIGHT_ANKLE"], head: false });
    expect(bodyMarks(dossier(), susp({ reason: "TKO" })).head).toBe(true);
    expect(bodyMarks(dossier(), susp({ reason: "MANDATORY_REST" })).head).toBe(false);
  });
});
