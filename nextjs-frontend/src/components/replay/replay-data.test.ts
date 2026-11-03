import { describe, expect, it } from "vitest";

import type { OpponentAnalysis, RoundRecord, TacticOutcome } from "@/lib/domain/round-advice";
import { buildReplay } from "./replay-data";

const analysis: OpponentAnalysis = {
    observations: [
        { id: "o-low", kind: "OPENING", text: "Slow low-kick recovery", evidenceNote: "Clip 2", confidence: "REPEATED" },
        { id: "o-hand", kind: "HABIT", text: "Drops left hand", evidenceNote: "Clip 1", confidence: "ONCE" },
    ],
    tactics: [
        { id: "t-kick", text: "Check and counter low kick", round: null, observationIds: ["o-low"], sessionIds: [] },
        { id: "t-cross", text: "Right cross counter", round: null, observationIds: ["o-hand"], sessionIds: [] },
    ],
};

function record(roundNo: number, marks: Record<string, TacticOutcome>, extra: Partial<RoundRecord> = {}): RoundRecord {
    return {
        id: `r${roundNo}`,
        boutId: "b1",
        roundNo,
        tacticMarks: marks,
        observationMarks: {},
        selfScore: "WIN",
        knockdownsAgainst: 0,
        stunned: false,
        bleeding: false,
        fatigued: false,
        note: null,
        recordedById: "u1",
        createdAt: "2026-10-30T10:00:00Z",
        updatedAt: "2026-10-30T10:00:00Z",
        ...extra,
    };
}

describe("buildReplay", () => {
    it("has nothing to play without recorded rounds or a scheduled length", () => {
        expect(buildReplay(analysis, [], 3)).toBeNull();
        expect(buildReplay(analysis, [record(1, {})], null)).toBeNull();
    });

    it("gives one break per recorded round except after the last scheduled round", () => {
        const replay = buildReplay(analysis, [record(3, {}), record(1, {}), record(2, {})], 3);
        expect(replay?.rounds.map((r) => r.roundNo)).toEqual([1, 2, 3]);
        expect(replay?.breaks.map((b) => b.afterRound)).toEqual([1, 2]);
    });

    it("drops a tactic at the break after its second ineffective round, and only there", () => {
        const replay = buildReplay(
            analysis,
            [record(1, { "t-cross": "INEFFECTIVE", "t-kick": "EFFECTIVE" }), record(2, { "t-cross": "INEFFECTIVE", "t-kick": "EFFECTIVE" })],
            3,
        );
        expect(replay?.breaks[0].dropped).toEqual([]);
        expect(replay?.breaks[1].dropped).toEqual(["Right cross counter"]);
        expect(replay?.droppedAfter).toEqual({ "t-cross": 2 });
        expect(replay?.breaks[1].keep).not.toContain("Right cross counter");
    });

    it("raises the safety flag from the recorded knockdowns", () => {
        const replay = buildReplay(analysis, [record(1, {}, { knockdownsAgainst: 2, selfScore: "LOSS" })], 3);
        expect(replay?.breaks[0].safety?.level).toBe("RED");
        expect(replay?.breaks[0].safety?.reasons).toContain("KNOCKDOWNS");
    });
});
