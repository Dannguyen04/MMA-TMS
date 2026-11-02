/// <reference types="jest" />
import { improvementPointText } from "@/i18n/backend-codes";
import { buildImprovementPoints, evaluateTactics, previewReportFrom, resetPreviewReviews, savePreviewReview, type ReportRound } from "./bout-report-model";
import { previewBout } from "./camp-preview";
import type { Analysis } from "@/api/fight-camp";

// Ca chép từ nestjs-api/src/bouts/bout-analysis.model.spec.ts (origin/fight-camp a40c499), describe "T-010 report calculations".
const observation = (id: string) => ({ id, kind: "OPENING" as const, text: id, evidenceNote: "video", confidence: "ONCE" as const });
const tactic = (id: string) => ({ id, text: id, observationIds: ["o1"], sessionIds: [], round: null });

describe("T-041 R8: demo khớp backend R29/R30", () => {
  it("R29 đếm hiệp, hoà, chiến thuật chưa dùng và quan sát, không sửa dữ liệu vào", () => {
    const a: Analysis = { observations: [observation("o1"), observation("o2"), observation("o3")], tactics: [tactic("t1"), tactic("t2"), tactic("t3")] };
    const rounds: ReportRound[] = [
      { roundNo: 1, tacticMarks: { t1: "EFFECTIVE", t2: "EFFECTIVE" }, observationMarks: { o1: "NOT_SEEN", o2: "SEEN" } },
      { roundNo: 2, tacticMarks: { t1: "EFFECTIVE", t2: "INEFFECTIVE" }, observationMarks: { o1: "NOT_SEEN", o2: "NOT_SEEN" } },
      { roundNo: 3, tacticMarks: { t1: "NOT_USED", t2: "INEFFECTIVE" } },
    ];
    const before = structuredClone({ a, rounds });
    expect(evaluateTactics(a, rounds).tactics).toEqual([
      { id: "t1", text: "t1", effectiveRounds: 2, ineffectiveRounds: 0, outcome: "EFFECTIVE" },
      { id: "t2", text: "t2", effectiveRounds: 1, ineffectiveRounds: 2, outcome: "INEFFECTIVE" },
      { id: "t3", text: "t3", effectiveRounds: 0, ineffectiveRounds: 0, outcome: "NOT_USED" },
    ]);
    expect(evaluateTactics(a, rounds.slice(0, 2)).tactics[1]?.outcome).toBe("EFFECTIVE");
    expect(evaluateTactics(a, rounds).observations.map(o => o.notSeenInBout)).toEqual([true, false, false]);
    expect(evaluateTactics({}, [])).toEqual({ tactics: [], observations: [] });
    expect({ a, rounds }).toEqual(before);
  });

  it("R30 ưu tiên đánh giá đã lưu và bỏ chiến thuật khi chưa có hiệp", () => {
    const a: Analysis = { tactics: [{ ...tactic("t1"), review: { outcome: "INEFFECTIVE", auto: false } }, { ...tactic("t2"), review: { outcome: "EFFECTIVE", auto: true } }, tactic("t3")] };
    const rounds: ReportRound[] = [{ roundNo: 1, tacticMarks: { t1: "EFFECTIVE", t2: "INEFFECTIVE", t3: "INEFFECTIVE" } }];
    expect(buildImprovementPoints(a, rounds, null)).toEqual([
      { code: "TACTIC_INEFFECTIVE", tacticId: "t1", text: "t1" },
      { code: "TACTIC_INEFFECTIVE", tacticId: "t3", text: "t3" },
    ]);
    expect(buildImprovementPoints(a, [], { status: "EXCEEDED" })).toEqual([{ code: "ACUTE_LOSS_EXCEEDED" }]);
  });

  it("R30 chỉ nhận chuỗi đuối sức liên tiếp ở cuối trận, sắp xếp không sửa dữ liệu vào", () => {
    const rounds = [4, 2, 3, 1].map(roundNo => ({ roundNo, fatigued: roundNo >= 2 }));
    const before = structuredClone(rounds);
    expect(buildImprovementPoints({}, rounds, { status: "EXCEEDED" })).toEqual([{ code: "ACUTE_LOSS_EXCEEDED" }, { code: "FATIGUE_FROM_ROUND_2", fromRound: 2 }]);
    expect(rounds).toEqual(before);
    for (const status of ["NO_DATA", "WITHIN"]) {
      expect(buildImprovementPoints({}, [{ roundNo: 2, fatigued: true }, { roundNo: 3 }, { roundNo: 4, fatigued: true }], { status })).toEqual([]);
      expect(buildImprovementPoints({}, [{ roundNo: 2, fatigued: true }, { roundNo: 4, fatigued: true }], { status })).toEqual([]);
      expect(buildImprovementPoints({}, [{ roundNo: 1, fatigued: true }, { roundNo: 2, fatigued: true }, { roundNo: 3 }], { status })).toEqual([]);
    }
  });

  it("demo: chưa đánh giá thì app điền sẵn; HLV lưu thì bỏ nhãn và dùng đánh giá của HLV", () => {
    const bout = { ...previewBout, id: "model-demo", status: "COMPLETED" as const };
    resetPreviewReviews(bout.id);
    const rounds: ReportRound[] = [{ roundNo: 1, tacticMarks: { t1: "EFFECTIVE" }, knockdownsAgainst: 1 }, { roundNo: 2, tacticMarks: { t1: "EFFECTIVE" } }];
    const first = previewReportFrom(bout, rounds);
    expect(first.result).toEqual({ result: "WIN", method: "DECISION", resultRound: 2, knockedDown: true });
    expect(first.tactics[0]).toMatchObject({ outcome: "EFFECTIVE", review: { outcome: "EFFECTIVE", auto: true } });
    savePreviewReview(bout.id, [{ tacticId: "t1", outcome: "INEFFECTIVE", note: "Bị bắt bài" }]);
    const next = previewReportFrom(bout, rounds);
    expect(next.tactics[0].review).toEqual({ outcome: "INEFFECTIVE", note: "Bị bắt bài", auto: false });
    expect(next.improvementPoints).toContainEqual({ code: "TACTIC_INEFFECTIVE", tacticId: "t1", text: bout.opponentAnalysis.tactics![0].text });
    expect(previewReportFrom(bout, []).roundsRecorded).toBe(0);
  });
});

describe("T-041 R1/R2: câu cho điểm cần luyện", () => {
  it("đổi ba dạng thành câu tiếng Việt, mã lạ trả null", () => {
    expect(improvementPointText({ code: "FATIGUE_FROM_ROUND_2", fromRound: 2 })).toBe("Đuối sức từ hiệp 2");
    expect(improvementPointText({ code: "ACUTE_LOSS_EXCEEDED" })).toBe("Giảm cân cấp tốc vượt ngưỡng");
    expect(improvementPointText({ code: "TACTIC_INEFFECTIVE", tacticId: "t1", text: "Đổi góc sau jab" })).toBe("Chưa hiệu quả: Đổi góc sau jab");
    for (const code of ["SOMETHING_NEW", "FATIGUE_FROM_ROUND_13", "TACTIC_INEFFECTIVE", undefined]) expect(improvementPointText({ code })).toBeNull();
  });
});
