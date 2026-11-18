import type { MedicalDossier } from "@/api/types";
import { clearanceDates, clearanceProblem, clearanceState, clearanceWord, olderClearances, reasonFor } from "./clearance-state";

const now = new Date("2026-11-15T03:00:00.000Z");
const exam = { id: "e-now", scope: "TRAINING", examinedAt: "2026-11-10T02:00:00.000Z" };
const clr = (id: string, examinationId: string, validFrom: string, validUntil: string | null) =>
  ({ id, examinationId, clearanceType: "TRAINING", status: "ACTIVE", validFrom, validUntil, isCurrentlyValid: true });
const dossier = (clearances: object[], reasons: string[] = ["CLEARANCE_REQUIRED"]) => ({
  currentExaminations: { training: exam, competition: null },
  activeClearances: clearances,
  eligibility: { training: { scope: "TRAINING", eligible: !reasons.length, reasons }, competition: { scope: "COMPETITION", eligible: true, reasons: [] } },
}) as unknown as MedicalDossier;
const old = clr("old", "e-old", "2026-01-01T00:00:00.000Z", "2027-06-30T00:00:00.000Z");
const generic = (code: string) => `generic ${code}`;

describe("clearance state", () => {
  it("never lets an older exam's clearance stand in for the current one", () => {
    const d = dossier([old]);
    expect(clearanceState(d, "training", now).kind).toBe("missing");
    expect(reasonFor(d, "training", "CLEARANCE_REQUIRED", generic)).toBe("Chưa có giấy phép cho lần khám 10/11.");
    expect(olderClearances(d).map(c => c.id)).toEqual(["old"]);
  });

  it("tells a licence that starts later from a missing one", () => {
    const s = clearanceState(dossier([clr("next", "e-now", "2026-11-30T22:00:00.000Z", "2026-12-02T09:59:00.000Z")]), "training", now);
    expect(s.kind).toBe("notYet");
    expect(clearanceWord(s)).toBe("Chưa hiệu lực");
    expect(clearanceDates(s)).toBe("01/12 – 02/12");
    expect(clearanceProblem(s, "training")).toBe("Giấy phép có hiệu lực từ 01/12.");
  });

  it("says Cần cấp lại only when the licence really expired", () => {
    const s = clearanceState(dossier([clr("past", "e-now", "2026-10-01T00:00:00.000Z", "2026-11-12T00:00:00.000Z")], ["CLEARANCE_EXPIRED"]), "training", now);
    expect(s.kind).toBe("expired");
    expect(clearanceWord(s)).toBe("Cần cấp lại");
    expect(clearanceProblem(s, "training")).toBe("Giấy phép đã hết hạn ngày 12/11.");
  });

  it("keeps a valid licence quiet and other reason codes untouched", () => {
    const d = dossier([clr("ok", "e-now", "2026-11-10T00:00:00.000Z", null)], []);
    const s = clearanceState(d, "training", now);
    expect(s.kind).toBe("valid");
    expect(clearanceWord(s)).toBeNull();
    expect(clearanceDates(s)).toBe("không thời hạn");
    expect(reasonFor(d, "training", "EXAMINATION_NOT_ELIGIBLE", generic)).toBe("generic EXAMINATION_NOT_ELIGIBLE");
    expect(clearanceState(d, "competition", now).kind).toBe("noExam");
  });
});
