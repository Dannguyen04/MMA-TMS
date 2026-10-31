import { describe, expect, it } from "vitest";

import { matchupRows, planFindings, tacticInsights, type FighterSide } from "./opponent-analysis-insights";
import type { OpponentAnalysis, OpponentObservation, OpponentTactic } from "./round-advice";

const obs = (id: string, kind: OpponentObservation["kind"], confidence: OpponentObservation["confidence"]): OpponentObservation => ({
    id,
    kind,
    text: `obs ${id}`,
    evidenceNote: "note",
    confidence,
});

const tac = (id: string, observationIds: string[], patch: Partial<OpponentTactic> = {}): OpponentTactic => ({
    id,
    text: `tac ${id}`,
    round: null,
    observationIds,
    sessionIds: [],
    ...patch,
});

const codes = (analysis: OpponentAnalysis, rounds: number | null = 3) => planFindings(analysis, rounds).map((f) => f.code);

describe("tacticInsights", () => {
    it("labels basis and training and gives the corner-card order", () => {
        const insights = tacticInsights({
            observations: [obs("o1", "HABIT", "ONCE"), obs("o2", "OPENING", "REPEATED")],
            tactics: [tac("weak", ["o1"]), tac("strong", ["o2"], { sessionIds: ["s1"] })],
        });
        expect(insights.get("strong")).toMatchObject({ basis: "REPEATED", trained: true, cardOrder: 1 });
        expect(insights.get("weak")).toMatchObject({ basis: "ONCE", trained: false, cardOrder: 2 });
    });
});

describe("planFindings", () => {
    it("flags an opening no tactic uses and a strength with no answer", () => {
        const findings = planFindings(
            { observations: [obs("o1", "OPENING", "REPEATED"), obs("o2", "STRENGTH", "REPEATED"), obs("o3", "HABIT", "ONCE")], tactics: [] },
            3,
        );
        expect(findings).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ code: "OPENING_UNUSED", observationId: "o1" }),
                expect.objectContaining({ code: "STRENGTH_UNANSWERED", observationId: "o2" }),
            ]),
        );
        expect(findings.some((f) => "observationId" in f && f.observationId === "o3")).toBe(false);
    });

    it("flags a tactic resting only on observations seen once, and untrained tactics (R14)", () => {
        const found = codes({
            observations: [obs("o1", "OPENING", "ONCE")],
            tactics: [tac("t1", ["o1"]), tac("t2", ["o1"], { sessionIds: ["s"] }), tac("t3", ["o1"], { sessionIds: ["s"] })],
        });
        expect(found.filter((c) => c === "WEAK_BASIS")).toHaveLength(3);
        expect(found.filter((c) => c === "UNTRAINED")).toHaveLength(1);
        expect(found.filter((c) => c === "NOT_YET_PRACTISED")).toHaveLength(2);
    });

    it("reports rounds with no tactic only when every tactic is round-specific", () => {
        const base = { observations: [obs("o1", "OPENING", "REPEATED")] };
        expect(codes({ ...base, tactics: [tac("t1", ["o1"], { round: 1 }), tac("t2", ["o1"], { round: 3 }), tac("t3", ["o1"], { round: 1 })] })).toContain("ROUND_GAP");
        expect(planFindings({ ...base, tactics: [tac("t1", ["o1"], { round: 1 }), tac("t2", ["o1"], { round: 3 }), tac("t3", ["o1"], { round: 1 })] }, 3))
            .toContainEqual({ code: "ROUND_GAP", level: "info", round: 2 });
        expect(codes({ ...base, tactics: [tac("t1", ["o1"], { round: 1 }), tac("t2", ["o1"]), tac("t3", ["o1"])] })).not.toContain("ROUND_GAP");
    });

    it("asks for at least three tactics", () => {
        expect(codes({ observations: [obs("o1", "OPENING", "REPEATED")], tactics: [tac("t1", ["o1"])] })).toContain("TOO_FEW_TACTICS");
    });
});

describe("practice state", () => {
    const analysis: OpponentAnalysis = {
        observations: [obs("o1", "OPENING", "REPEATED")],
        tactics: [
            tac("none", ["o1"]),
            tac("planned", ["o1"], { sessionIds: ["s-future"] }),
            tac("done", ["o1"], { sessionIds: ["s-future", "s-done"] }),
        ],
    };
    const completed = new Set(["s-done"]);

    it("counts only completed sessions as practised", () => {
        const insights = tacticInsights(analysis, completed);
        expect(insights.get("none")?.practice).toBe("NONE");
        expect(insights.get("planned")?.practice).toBe("SCHEDULED");
        expect(insights.get("done")?.practice).toBe("PRACTISED");
    });

    it("warns for no session and notes scheduled-only tactics", () => {
        const findings = planFindings(analysis, 3, completed);
        expect(findings).toContainEqual(expect.objectContaining({ code: "UNTRAINED", tacticId: "none" }));
        expect(findings).toContainEqual(expect.objectContaining({ code: "NOT_YET_PRACTISED", tacticId: "planned" }));
        expect(findings.some((f) => "tacticId" in f && f.tacticId === "done")).toBe(false);
    });
});

describe("matchupRows", () => {
    const fighter: FighterSide = { stance: "orthodox", heightCm: 180, reachCm: 185 };

    it("puts both sides' figures together and marks notable gaps", () => {
        expect(matchupRows({ stance: "SOUTHPAW", reachCm: 176, heightCm: 182 }, fighter)).toEqual([
            { field: "stance", opponent: "SOUTHPAW", fighter: "orthodox", notable: true },
            { field: "heightCm", opponent: 182, fighter: 180, diffCm: 2, notable: false },
            { field: "reachCm", opponent: 176, fighter: 185, diffCm: -9, notable: true },
        ]);
    });

    it("treats a switch-stance opponent as notable and skips unknown values", () => {
        expect(matchupRows({ stance: "SWITCH" }, { stance: "southpaw", heightCm: null, reachCm: null })).toEqual([
            { field: "stance", opponent: "SWITCH", fighter: "southpaw", notable: true },
        ]);
        expect(matchupRows({ stance: "ORTHODOX" }, fighter)).toEqual([
            { field: "stance", opponent: "ORTHODOX", fighter: "orthodox", notable: false },
        ]);
        expect(matchupRows(undefined, fighter)).toEqual([]);
    });
});
