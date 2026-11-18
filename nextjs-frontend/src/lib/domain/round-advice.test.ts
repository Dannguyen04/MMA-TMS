import { describe, expect, it } from "vitest";
import {
    breakChanges,
    buildCornerCard,
    buildImprovementPoints,
    buildRoundAdvice,
    evaluateTactics,
    filterCornerCardTactics,
    roundInputSchema,
    type AnalysisRound,
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

// T-041 R8: the same cases as nestjs-api `bout-analysis.model.spec.ts` ("T-010 report calculations"), so demo mode
// and the API agree on R29 and R30.
describe("report calculations mirrored from the backend (R29, R30)", () => {
    const observation = (id: string) => ({ id, kind: "OPENING" as const, text: id, evidenceNote: "video", confidence: "ONCE" as const });
    const tactic = (id: string) => ({ id, text: id, observationIds: ["o1"], sessionIds: [], round: null });

    it("R29 evaluates counts, ties, unused tactics and observation evidence without mutation", () => {
        const a: OpponentAnalysis = {
            observations: [observation("o1"), observation("o2"), observation("o3")],
            tactics: [tactic("t1"), tactic("t2"), tactic("t3")],
        };
        const rounds: AnalysisRound[] = [
            { roundNo: 1, tacticMarks: { t1: "EFFECTIVE", t2: "EFFECTIVE" }, observationMarks: { o1: "NOT_SEEN", o2: "SEEN" } },
            { roundNo: 2, tacticMarks: { t1: "EFFECTIVE", t2: "INEFFECTIVE" }, observationMarks: { o1: "NOT_SEEN", o2: "NOT_SEEN" } },
            { roundNo: 3, tacticMarks: { t1: "NOT_USED", t2: "INEFFECTIVE" } },
        ];
        const before = structuredClone({ a, rounds });
        const evaluated = evaluateTactics(a, rounds);
        expect(evaluated.tactics).toEqual([
            { id: "t1", text: "t1", effectiveRounds: 2, ineffectiveRounds: 0, outcome: "EFFECTIVE" },
            { id: "t2", text: "t2", effectiveRounds: 1, ineffectiveRounds: 2, outcome: "INEFFECTIVE" },
            { id: "t3", text: "t3", effectiveRounds: 0, ineffectiveRounds: 0, outcome: "NOT_USED" },
        ]);
        expect(evaluateTactics(a, rounds.slice(0, 2)).tactics[1]?.outcome).toBe("EFFECTIVE");
        expect(evaluated.observations.map((o) => o.notSeenInBout)).toEqual([true, false, false]);
        expect(evaluateTactics({}, [])).toEqual({ tactics: [], observations: [] });
        expect({ a, rounds }).toEqual(before);
    });

    it("R30 uses saved reviews before calculated outcomes and omits tactics without rounds", () => {
        const a: OpponentAnalysis = {
            tactics: [
                { ...tactic("t1"), review: { outcome: "INEFFECTIVE", auto: false } },
                { ...tactic("t2"), review: { outcome: "EFFECTIVE", auto: true } },
                tactic("t3"),
            ],
        };
        const rounds: AnalysisRound[] = [{ roundNo: 1, tacticMarks: { t1: "EFFECTIVE", t2: "INEFFECTIVE", t3: "INEFFECTIVE" } }];
        expect(buildImprovementPoints(a, rounds, null)).toEqual([
            { code: "TACTIC_INEFFECTIVE", tacticId: "t1", text: "t1" },
            { code: "TACTIC_INEFFECTIVE", tacticId: "t3", text: "t3" },
        ]);
        expect(buildImprovementPoints(a, [], { status: "EXCEEDED" })).toEqual([{ code: "ACUTE_LOSS_EXCEEDED" }]);
    });

    it("R30 detects only a consecutive fatigue suffix, sorting without mutation", () => {
        const rounds = [4, 2, 3, 1].map((roundNo) => ({ roundNo, fatigued: roundNo >= 2 }));
        const before = structuredClone(rounds);
        expect(buildImprovementPoints({}, rounds, { status: "EXCEEDED" })).toEqual([
            { code: "ACUTE_LOSS_EXCEEDED" },
            { code: "FATIGUE_FROM_ROUND_2", fromRound: 2 },
        ]);
        expect(rounds).toEqual(before);
        for (const status of ["NO_DATA", "WITHIN"]) {
            expect(buildImprovementPoints({}, [{ roundNo: 2, fatigued: true }, { roundNo: 3 }, { roundNo: 4, fatigued: true }], { status })).toEqual([]);
            expect(buildImprovementPoints({}, [{ roundNo: 2, fatigued: true }, { roundNo: 4, fatigued: true }], { status })).toEqual([]);
            expect(buildImprovementPoints({}, [{ roundNo: 1, fatigued: true }, { roundNo: 2, fatigued: true }, { roundNo: 3 }], { status })).toEqual([]);
        }
    });
});

// T-037 B criterion 1: the cases of nestjs-api `bout-analysis.model.spec.ts` ("T-037 next-round plans").
describe("next-round plans mirrored from the backend (T-037)", () => {
    const observation = (id: string, confidence: "ONCE" | "REPEATED" = "ONCE") => ({ id, kind: "OPENING" as const, text: id, evidenceNote: "video", confidence });
    const tactic = (id: string, observationIds = ["o1"], sessionIds: string[] = []) => ({ id, text: id, observationIds, sessionIds, round: null });
    const analysis: OpponentAnalysis = {
        observations: [observation("o1"), observation("o2", "REPEATED")],
        tactics: [tactic("t1", ["o1"], ["session"]), tactic("t2", ["o2"])],
    };
    const advice = (a: OpponentAnalysis, rounds: AnalysisRound[], scheduled = 3) => buildRoundAdvice(a, rounds, scheduled);
    const plan = (over = {}) => ({ focusTacticIds: [], addedTactics: [], instructions: [], ...over });

    it("prioritizes coach order even when a focused tactic is dropped, without mutation", () => {
        const rounds: AnalysisRound[] = [
            { roundNo: 1, tacticMarks: { t1: "INEFFECTIVE", t2: "EFFECTIVE" } },
            { roundNo: 2, tacticMarks: { t1: "INEFFECTIVE" }, nextRoundPlan: plan({ focusTacticIds: ["t1", "t2"] }) },
        ];
        const before = structuredClone(rounds);
        const result = advice(analysis, rounds);
        expect(result.tactics.map((t) => t.id)).toEqual(["t1", "t2"]);
        expect(result.tactics[0]).toMatchObject({ focus: true, dropped: true, addedRound: null });
        expect(result.nextRound.plan).toEqual(rounds[1]!.nextRoundPlan);
        expect(result.nextRound.roundNo).toBe(3);
        expect(rounds).toEqual(before);
    });

    it("merges added tactics from every round and uses only the latest plan", () => {
        const result = advice(analysis, [
            { roundNo: 2, nextRoundPlan: plan({ addedTactics: [{ id: "new2", text: "second", observationIds: [] }] }) },
            { roundNo: 1, observationMarks: { o1: "SEEN" }, nextRoundPlan: plan({ focusTacticIds: ["new1"], addedTactics: [{ id: "new1", text: "new", observationIds: ["o1"] }] }) },
        ]);
        expect(result.tactics.find((t) => t.id === "new1")).toMatchObject({ addedRound: 1, trained: false, basis: "REPEATED", focus: false, round: null, partnerBrief: null });
        expect(result.tactics.find((t) => t.id === "new2")?.addedRound).toBe(2);
        expect(advice(analysis, [{ roundNo: 1, nextRoundPlan: plan() }]).nextRound.plan).toBeNull();
        expect(advice(analysis, [{ roundNo: 1 }]).tactics.every((t) => !t.focus)).toBe(true);
    });

    it("suggests safety, newly dropped, up to two uses, then must-win in order", () => {
        const a = { ...analysis, tactics: [tactic("t1"), tactic("t2"), tactic("t3")] };
        const rounds: AnalysisRound[] = [
            { roundNo: 1, tacticMarks: { t1: "INEFFECTIVE" }, stunned: true, selfScore: "LOSS" },
            { roundNo: 2, tacticMarks: { t1: "INEFFECTIVE" }, stunned: true, selfScore: "WIN" },
        ];
        expect(advice(a, rounds).nextRound.suggested).toEqual([
            { code: "SAFETY_CHECK" },
            { code: "STOP_TACTIC", tacticId: "t1" },
            { code: "USE_TACTIC", tacticId: "t2" },
            { code: "USE_TACTIC", tacticId: "t3" },
            { code: "MUST_WIN_ROUND" },
        ]);
        expect(advice(a, [...rounds, { roundNo: 3 }], 5).nextRound.suggested.some((i) => i.code === "STOP_TACTIC")).toBe(false);
    });

    it("rechecks changed evidence after uses and reports hard-to-win points", () => {
        const result = advice(analysis, [
            { roundNo: 1, selfScore: "LOSS", observationMarks: { o1: "NOT_SEEN" } },
            { roundNo: 2, selfScore: "LOSS", observationMarks: { o1: "NOT_SEEN" } },
        ]);
        expect(result.nextRound.suggested).toEqual([
            { code: "USE_TACTIC", tacticId: "t2" },
            { code: "RECHECK_OPPONENT", tacticId: "t1" },
            { code: "HARD_TO_WIN_ON_POINTS" },
        ]);
        expect(advice({}, [{ roundNo: 1, selfScore: "WIN" }]).nextRound.suggested).toEqual([]);
    });

    it("caps suggestions at five in rule order", () => {
        const a = { tactics: Array.from({ length: 5 }, (_, i) => tactic(`t${i}`, [])) };
        const marks = Object.fromEntries(a.tactics.map((t) => [t.id, "INEFFECTIVE" as const]));
        expect(advice(a, [{ roundNo: 1, tacticMarks: marks }, { roundNo: 2, tacticMarks: marks, knockdownsAgainst: 2 }]).nextRound.suggested).toEqual([
            { code: "SAFETY_CHECK" },
            ...a.tactics.slice(0, 4).map((t) => ({ code: "STOP_TACTIC", tacticId: t.id })),
        ]);
    });

    it.each(["CUSTOM", "USE_TACTIC", "STOP_TACTIC", "RECHECK_OPPONENT"])("requires instruction fields for %s", (code) => {
        expect(roundInputSchema.safeParse({ nextRoundPlan: { instructions: [{ code }] } }).success).toBe(false);
    });

    it("accepts trimmed custom text and enforces array, text and strict-key limits", () => {
        expect(roundInputSchema.parse({ nextRoundPlan: { instructions: [{ code: "CUSTOM", text: "  act  " }] } }).nextRoundPlan?.instructions[0]?.text).toBe("act");
        for (const nextRoundPlan of [
            { focusTacticIds: ["t1", "t2", "t3"] },
            { addedTactics: Array.from({ length: 3 }, (_, i) => ({ id: `t${i}`, text: "new" })) },
            { addedTactics: [{ id: "t1", text: "x".repeat(141) }] },
            { addedTactics: [{ id: "t1", text: "new", observationIds: ["o1", "o2", "o3", "o4"] }] },
            { instructions: Array.from({ length: 4 }, () => ({ code: "SAFETY_CHECK" })) },
            { instructions: [{ code: "CUSTOM", text: " " }] },
            { unknown: true },
        ]) {
            expect(roundInputSchema.safeParse({ nextRoundPlan }).success).toBe(false);
        }
    });
});

describe("breakChanges (corner card, T-037 B)", () => {
    it("takes focus from the latest round and every added tactic with its round", () => {
        const add = (id: string) => ({ id, text: id, observationIds: [] });
        expect(
            breakChanges([
                { roundNo: 2, nextRoundPlan: { focusTacticIds: ["t2"], addedTactics: [add("b")], instructions: [] } },
                { roundNo: 1, nextRoundPlan: { focusTacticIds: ["t1"], addedTactics: [add("a")], instructions: [] } },
            ]),
        ).toEqual({ focusIds: ["t2"], added: [{ id: "a", text: "a", addedRound: 1 }, { id: "b", text: "b", addedRound: 2 }] });
        expect(breakChanges([])).toEqual({ focusIds: [], added: [] });
    });
});
