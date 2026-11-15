import { describe, expect, it } from "vitest";
import { hasExtraEntries, mainObservationId, openRoundNo, quickTacticIds, summarizeRound } from "./rounds-view-model";

const nextRound = (roundNo: number) => ({ nextRound: { roundNo, suggested: [], plan: null } });
const record = (over: Partial<Parameters<typeof summarizeRound>[0] & { note: string | null }> = {}) => ({
    selfScore: null,
    knockdownsAgainst: 0,
    stunned: false,
    bleeding: false,
    fatigued: false,
    note: null,
    tacticMarks: {},
    observationMarks: {},
    ...over,
});

describe("openRoundNo", () => {
    it("opens round 1 while nothing is recorded", () => {
        expect(openRoundNo(null, 3)).toBe(1);
    });
    it("opens the advice's next round, not the count of recorded rounds", () => {
        expect(openRoundNo(nextRound(3), 3)).toBe(3);
    });
    it("opens nothing once the last round is recorded", () => {
        expect(openRoundNo(nextRound(4), 3)).toBeNull();
    });
});

describe("quickTacticIds", () => {
    const available = [{ id: "t1" }, { id: "t2" }, { id: "t3" }, { id: "r1-a1" }];

    it("uses the focus set at the previous break", () => {
        const rounds = [{ roundNo: 1, nextRoundPlan: { focusTacticIds: ["t3", "r1-a1"] } }];
        expect(quickTacticIds(2, rounds, { tactics: [{ id: "t1" }, { id: "t2" }] }, available)).toEqual(["t3", "r1-a1"]);
    });
    it("ignores focus ids that cannot be marked in this round", () => {
        const rounds = [{ roundNo: 1, nextRoundPlan: { focusTacticIds: ["gone"] } }];
        expect(quickTacticIds(2, rounds, { tactics: [{ id: "t2" }, { id: "t1" }, { id: "t3" }] }, available)).toEqual(["t2", "t1"]);
    });
    it("falls back to the first two re-ranked advice tactics", () => {
        expect(quickTacticIds(2, [{ roundNo: 1 }], { tactics: [{ id: "t3" }, { id: "t1" }, { id: "t2" }] }, available)).toEqual(["t3", "t1"]);
    });
    it("falls back to the first two analysis tactics without advice", () => {
        expect(quickTacticIds(1, [], null, available)).toEqual(["t1", "t2"]);
    });
    it("only uses the focus of the round right before", () => {
        const rounds = [{ roundNo: 1, nextRoundPlan: { focusTacticIds: ["t3"] } }, { roundNo: 2, nextRoundPlan: null }];
        expect(quickTacticIds(3, rounds, null, available)).toEqual(["t1", "t2"]);
    });
});

describe("mainObservationId", () => {
    const observations = [{ id: "o1" }, { id: "o2" }, { id: "o3" }];
    it("picks the first observation a quick tactic rests on", () => {
        expect(mainObservationId(observations, [{ observationIds: ["o3", "o2"] }])).toBe("o2");
    });
    it("falls back to the first observation", () => {
        expect(mainObservationId(observations, [{ observationIds: [] }])).toBe("o1");
    });
    it("is null without observations", () => {
        expect(mainObservationId([], [])).toBeNull();
    });
});

describe("hasExtraEntries", () => {
    it("is false for a new round or one with only the four default taps", () => {
        expect(hasExtraEntries(null, [], null)).toBe(false);
        expect(hasExtraEntries(record({ selfScore: "WIN", tacticMarks: { t1: "EFFECTIVE" }, observationMarks: { o1: "SEEN" } }), ["t1", "t2"], "o1")).toBe(false);
    });
    it("is true for condition, knockdowns, a note or marks outside the defaults", () => {
        expect(hasExtraEntries(record({ fatigued: true }), [], null)).toBe(true);
        expect(hasExtraEntries(record({ knockdownsAgainst: 1 }), [], null)).toBe(true);
        expect(hasExtraEntries(record({ note: "cut left eye" }), [], null)).toBe(true);
        expect(hasExtraEntries(record({ tacticMarks: { t3: "NOT_USED" } }), ["t1", "t2"], "o1")).toBe(true);
        expect(hasExtraEntries(record({ observationMarks: { o2: "SEEN" } }), ["t1"], "o1")).toBe(true);
    });
});

describe("summarizeRound", () => {
    it("lists self-score, knockdowns, condition flags and the mark count", () => {
        expect(
            summarizeRound(
                record({
                    selfScore: "LOSS",
                    knockdownsAgainst: 1,
                    stunned: true,
                    fatigued: true,
                    tacticMarks: { t1: "EFFECTIVE", t2: "INEFFECTIVE" },
                    observationMarks: { o1: "SEEN" },
                }),
            ),
        ).toEqual({ selfScore: "LOSS", knockdowns: 1, conditions: ["stunned", "fatigued"], marks: 3 });
    });
});
