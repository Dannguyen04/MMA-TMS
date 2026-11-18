import { describe, expect, it } from "vitest";

import { createTranslator } from "@/lib/i18n/translate";
import type { BoutOutcome } from "./bout";
import {
    boutReportSchema,
    buildBoutReport,
    improvementPointMessage,
    isPrefilled,
    reportedOutcome,
    tacticReviewsInputSchema,
    type ReportTactic,
} from "./bout-report";
import type { OpponentAnalysis } from "./round-advice";

const SAMPLE = {
    result: { result: "LOSS", method: "KO", resultRound: 2, knockedDown: true },
    tactics: [
        { id: "t1", text: "Jab to the body", effectiveRounds: 2, ineffectiveRounds: 0, outcome: "EFFECTIVE", review: null },
        { id: "t2", text: "Clinch on the fence", effectiveRounds: 0, ineffectiveRounds: 2, outcome: "INEFFECTIVE", review: { outcome: "INEFFECTIVE", note: null, auto: false } },
    ],
    observations: [{ id: "o1", text: "Drops the left hand", notSeenInBout: true }],
    acuteLoss: { status: "EXCEEDED", startKg: 75.4, startOn: "2026-11-02", lossPct: 7.2, limitPct: 5 },
    improvementPoints: [
        { code: "TACTIC_INEFFECTIVE", tacticId: "t2", text: "Clinch on the fence" },
        { code: "ACUTE_LOSS_EXCEEDED" },
        { code: "FATIGUE_FROM_ROUND_2", fromRound: 2 },
    ],
    roundsRecorded: 2,
};

const tactic = (over: Partial<ReportTactic> = {}): ReportTactic => ({
    id: "t1",
    text: "t1",
    effectiveRounds: 1,
    ineffectiveRounds: 0,
    outcome: "EFFECTIVE",
    review: null,
    ...over,
});

describe("bout report (T-041)", () => {
    it("R1: parses the contract and words every improvement point, never the raw code", () => {
        const report = boutReportSchema.parse(SAMPLE);
        const vi = createTranslator("vi");
        const lines = report.improvementPoints.map((point) => {
            const { key, values } = improvementPointMessage(point);
            return vi(key, values);
        });
        expect(lines).toEqual(["Chiến thuật không hiệu quả: Clinch on the fence", "Giảm cân cấp tốc vượt ngưỡng", "Đuối sức từ hiệp 2"]);
        expect(lines.join(" ")).not.toMatch(/FATIGUE_|ACUTE_|TACTIC_/);
    });

    it("R2: leaves out a point with an unknown code instead of failing", () => {
        const report = boutReportSchema.parse({
            ...SAMPLE,
            improvementPoints: [{ code: "SOMETHING_NEW", extra: 1 }, { code: "FATIGUE_FROM_ROUND_99", fromRound: 99 }, { code: "ACUTE_LOSS_EXCEEDED" }],
        });
        expect(report.improvementPoints).toEqual([{ code: "ACUTE_LOSS_EXCEEDED" }]);
    });

    it("R4: a tactic without a review shows the calculated outcome, marked as filled in by the app", () => {
        const prefilled = tactic({ outcome: "EFFECTIVE", review: null });
        expect(reportedOutcome(prefilled)).toBe("EFFECTIVE");
        expect(isPrefilled(prefilled)).toBe(true);
        expect(isPrefilled(tactic({ review: { outcome: "EFFECTIVE", auto: true } }))).toBe(true);
    });

    it("R5: the coach's saved review wins over R29 and drops the 'filled in' mark", () => {
        const reviewed = tactic({ outcome: "EFFECTIVE", review: { outcome: "INEFFECTIVE", note: "Read it early", auto: false } });
        expect(reportedOutcome(reviewed)).toBe("INEFFECTIVE");
        expect(isPrefilled(reviewed)).toBe(false);
    });

    it("R6: a 301-character note is rejected, 300 is accepted", () => {
        const review = (note: string) => tacticReviewsInputSchema.safeParse({ reviews: [{ tacticId: "t1", outcome: "INEFFECTIVE", note }] }).success;
        expect(review("x".repeat(300))).toBe(true);
        expect(review("x".repeat(301))).toBe(false);
    });

    it("rejects the same tactic reviewed twice", () => {
        const twice = { reviews: [{ tacticId: "t1", outcome: "EFFECTIVE" }, { tacticId: "t1", outcome: "NOT_USED" }] };
        expect(tacticReviewsInputSchema.safeParse(twice).success).toBe(false);
    });

    it("demo mode builds the same shape the API returns, with no outcome before any round", () => {
        const analysis: OpponentAnalysis = {
            observations: [{ id: "o1", kind: "OPENING", text: "o1", confidence: "ONCE" }],
            tactics: [{ id: "t1", text: "t1", round: null, observationIds: ["o1"], sessionIds: [], review: { outcome: "INEFFECTIVE", note: null, auto: false } }],
        };
        const outcome = { result: "LOSS", method: "KO", round: 2, knockedDown: true } as BoutOutcome;

        const empty = buildBoutReport(analysis, [], outcome, null);
        expect(boutReportSchema.parse(empty)).toEqual(empty);
        expect(empty.tactics[0]).toMatchObject({ outcome: null, review: { outcome: "INEFFECTIVE" } });
        expect(empty.improvementPoints).toEqual([]);
        expect(empty.roundsRecorded).toBe(0);

        const played = buildBoutReport(analysis, [{ roundNo: 1, tacticMarks: { t1: "EFFECTIVE" }, observationMarks: { o1: "NOT_SEEN" } }], outcome, null);
        expect(played.result).toEqual({ result: "LOSS", method: "KO", resultRound: 2, knockedDown: true });
        expect(played.tactics[0]?.outcome).toBe("EFFECTIVE");
        expect(played.observations[0]?.notSeenInBout).toBe(true);
        expect(played.improvementPoints).toEqual([{ code: "TACTIC_INEFFECTIVE", tacticId: "t1", text: "t1" }]);
    });
});
