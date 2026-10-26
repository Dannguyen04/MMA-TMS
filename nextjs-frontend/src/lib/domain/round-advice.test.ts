import { describe, expect, it } from "vitest";
import {
    buildCornerCard,
    buildRoundAdvice,
    filterCornerCardTactics,
    type OpponentAnalysis,
} from "./round-advice";

describe("round-advice domain (R20–R24)", () => {
    it("R20: ranks REPEATED basis before ONCE, and trained before untrained within same basis", () => {
        const analysis: OpponentAnalysis = {
            observations: [
                { id: "o-once", kind: "HABIT", text: "Drops left hand", evidenceNote: "Clip 1", confidence: "ONCE" },
                { id: "o-rep", kind: "OPENING", text: "Slow low-kick recovery", evidenceNote: "Clip 2", confidence: "REPEATED" },
            ],
            tactics: [
                {
                    id: "t1",
                    text: "Right cross counter",
                    round: null,
                    observationIds: ["o-once"],
                    sessionIds: ["00000000-0000-4000-8000-000000000001"],
                },
                {
                    id: "t2",
                    text: "Check and counter low kick",
                    round: null,
                    observationIds: ["o-rep"],
                    sessionIds: [],
                },
            ],
        };

        const card1 = buildCornerCard(analysis);
        expect(card1.tactics.map((t) => t.id)).toEqual(["t2", "t1"]);
        expect(card1.tactics[0]?.trained).toBe(false);
        expect(card1.tactics[1]?.trained).toBe(true);

        const sameBasisAnalysis: OpponentAnalysis = {
            observations: [
                { id: "o-rep", kind: "OPENING", text: "Slow recovery", evidenceNote: "Clip", confidence: "REPEATED" },
            ],
            tactics: [
                { id: "t-untrained", text: "Untrained", round: null, observationIds: ["o-rep"], sessionIds: [] },
                {
                    id: "t-trained",
                    text: "Trained",
                    round: null,
                    observationIds: ["o-rep"],
                    sessionIds: ["00000000-0000-4000-8000-000000000001"],
                },
            ],
        };

        const card2 = buildCornerCard(sameBasisAnalysis);
        expect(card2.tactics.map((t) => t.id)).toEqual(["t-trained", "t-untrained"]);
    });

    it("R21: drops tactic after 2 consecutive INEFFECTIVE rounds and promotes unused tactic sharing basis; resets streak on EFFECTIVE", () => {
        const analysis: OpponentAnalysis = {
            observations: [
                { id: "o1", kind: "OPENING", text: "High guard leaves body open", evidenceNote: "Note", confidence: "REPEATED" },
                { id: "o2", kind: "HABIT", text: "Circles right", evidenceNote: "Note", confidence: "REPEATED" },
            ],
            tactics: [
                { id: "t1", text: "Body jab", round: null, observationIds: ["o1"], sessionIds: ["s1"] },
                { id: "t3", text: "Left hook", round: null, observationIds: ["o2"], sessionIds: ["s1"] },
                { id: "t2", text: "Knee to body", round: null, observationIds: ["o1"], sessionIds: ["s1"] },
            ],
        };

        const adviceForR3 = buildRoundAdvice(
            analysis,
            [
                { roundNo: 1, tacticMarks: { t1: "INEFFECTIVE" } },
                { roundNo: 2, tacticMarks: { t1: "INEFFECTIVE" } },
            ],
            3,
        );

        expect(adviceForR3.tactics[0]?.id).toBe("t2");
        const droppedT1 = adviceForR3.tactics.find((t) => t.id === "t1");
        expect(droppedT1?.dropped).toBe(true);
        expect(adviceForR3.tactics[adviceForR3.tactics.length - 1]?.id).toBe("t1");

        const resetAdvice = buildRoundAdvice(
            analysis,
            [
                { roundNo: 1, tacticMarks: { t1: "INEFFECTIVE" } },
                { roundNo: 2, tacticMarks: { t1: "EFFECTIVE" } },
            ],
            3,
        );
        const resetT1 = resetAdvice.tactics.find((t) => t.id === "t1");
        expect(resetT1?.dropped).toBe(false);
        expect(resetT1?.score).toBe(0);
    });

    it("R22: demotes tactic whose only observations are NOT_SEEN in 2 consecutive rounds, and upgrades ONCE observation when SEEN", () => {
        const analysis: OpponentAnalysis = {
            observations: [
                { id: "o1", kind: "HABIT", text: "Telegraphs overhand", evidenceNote: "Note", confidence: "REPEATED" },
                { id: "o2", kind: "OPENING", text: "Flat-footed", evidenceNote: "Note", confidence: "ONCE" },
            ],
            tactics: [
                { id: "t3", text: "Duck under overhand", round: null, observationIds: ["o1"], sessionIds: ["s1"] },
                { id: "t4", text: "Angle off and low kick", round: null, observationIds: ["o1", "o2"], sessionIds: ["s1"] },
            ],
        };

        const advice = buildRoundAdvice(
            analysis,
            [
                { roundNo: 1, observationMarks: { o1: "NOT_SEEN", o2: "SEEN" } },
                { roundNo: 2, observationMarks: { o1: "NOT_SEEN" } },
            ],
            3,
        );

        expect(advice.tactics.map((t) => t.id)).toEqual(["t4", "t3"]);
        const t3 = advice.tactics.find((t) => t.id === "t3");
        const t4 = advice.tactics.find((t) => t.id === "t4");
        expect(t3?.note).toBe("OPPONENT_MAY_HAVE_CHANGED");
        expect(t4?.note).toBeUndefined();
        expect(t4?.basis).toBe("REPEATED");
    });

    it("R23: computes self-scored standing (HARD_TO_WIN_ON_POINTS, NEED_WINS, AHEAD) with selfScored = true", () => {
        const emptyAnalysis: OpponentAnalysis = { observations: [], tactics: [] };

        const hardToWin = buildRoundAdvice(
            emptyAnalysis,
            [
                { roundNo: 1, selfScore: "LOSS" },
                { roundNo: 2, selfScore: "LOSS" },
            ],
            3,
        );
        expect(hardToWin.standing).toEqual({
            kind: "HARD_TO_WIN_ON_POINTS",
            selfScored: true,
        });

        const needWins = buildRoundAdvice(
            emptyAnalysis,
            [
                { roundNo: 1, selfScore: "LOSS" },
                { roundNo: 2, selfScore: "WIN" },
            ],
            3,
        );
        expect(needWins.standing).toEqual({
            kind: "NEED_WINS",
            needed: 1,
            remaining: 1,
            selfScored: true,
        });

        const ahead = buildRoundAdvice(
            emptyAnalysis,
            [
                { roundNo: 1, selfScore: "WIN" },
                { roundNo: 2, selfScore: "WIN" },
                { roundNo: 3, selfScore: "LOSS" },
            ],
            5,
        );
        expect(ahead.standing).toEqual({
            kind: "AHEAD",
            selfScored: true,
        });
    });

    it("R24: triggers RED safety warning on >= 2 total knockdowns or >= 2 consecutive stunned rounds", () => {
        const emptyAnalysis: OpponentAnalysis = { observations: [], tactics: [] };

        const twoKnockdowns = buildRoundAdvice(
            emptyAnalysis,
            [
                { roundNo: 1, knockdownsAgainst: 1 },
                { roundNo: 2, knockdownsAgainst: 1 },
            ],
            3,
        );
        expect(twoKnockdowns.safety).toEqual({
            level: "RED",
            reasons: ["KNOCKDOWNS"],
        });

        const oneKnockdown = buildRoundAdvice(
            emptyAnalysis,
            [
                { roundNo: 1, knockdownsAgainst: 1 },
                { roundNo: 2, knockdownsAgainst: 0 },
            ],
            3,
        );
        expect(oneKnockdown.safety).toBeNull();

        const stunnedStreak = buildRoundAdvice(
            emptyAnalysis,
            [
                { roundNo: 1, stunned: false },
                { roundNo: 2, stunned: true },
                { roundNo: 3, stunned: true },
            ],
            5,
        );
        expect(stunnedStreak.safety).toEqual({
            level: "RED",
            reasons: ["STUNNED_STREAK"],
        });

        const nonConsecutiveStunned = buildRoundAdvice(
            emptyAnalysis,
            [
                { roundNo: 1, stunned: true },
                { roundNo: 2, stunned: false },
                { roundNo: 3, stunned: true },
            ],
            5,
        );
        expect(nonConsecutiveStunned.safety).toBeNull();
    });

    it("filters corner card tactics by round while preserving backend order", () => {
        const tactics = [
            { id: "t1", text: "All rounds 1", round: null, partnerBrief: null, trained: true, basis: "REPEATED" as const },
            { id: "t2", text: "Round 1 only", round: 1, partnerBrief: null, trained: false, basis: "REPEATED" as const },
            { id: "t3", text: "Round 2 only", round: 2, partnerBrief: null, trained: true, basis: "ONCE" as const },
            { id: "t4", text: "All rounds 2", round: null, partnerBrief: null, trained: false, basis: "ONCE" as const },
        ];

        expect(filterCornerCardTactics(tactics, null).map((t) => t.id)).toEqual(["t1", "t2", "t3", "t4"]);
        expect(filterCornerCardTactics(tactics, 1).map((t) => t.id)).toEqual(["t1", "t2", "t4"]);
        expect(filterCornerCardTactics(tactics, 2).map((t) => t.id)).toEqual(["t1", "t3", "t4"]);
        expect(filterCornerCardTactics(tactics, 3).map((t) => t.id)).toEqual(["t1", "t4"]);
    });
});
