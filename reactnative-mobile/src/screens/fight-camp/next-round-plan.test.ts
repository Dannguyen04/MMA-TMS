import type { Analysis, CampRound, NextRoundPlan } from "@/api/fight-camp";
import { betweenRound, instructionText } from "@/i18n/between-round";
import { pendingVi } from "@/i18n/pending-vi";
import { previewBout } from "./camp-preview";
import { compactTactics, cornerPlanTactics, currentRound, emptyPlan, entryTactics, validatePlan, validateRoundMarks } from "./next-round-plan";
import { previewCornerCard, previewRoundAdvice } from "./round-advice-preview";
import { readPreviewRounds, resetPreviewRounds, savePreviewRound } from "./preview-round-store";

const plan = (p: Partial<NextRoundPlan> = {}): NextRoundPlan => ({ ...emptyPlan(), ...p });
const bout = { ...previewBout, id: "t037-domain" };
const tactic = (id: string) => ({ id, text: id, round: null, observationIds: ["o1"], sessionIds: [] });
const analysis: Analysis = { observations: [{ id: "o1", text: "o1", kind: "OPENING", confidence: "ONCE" }], tactics: [tactic("t1"), tactic("t2")] };
const advice = (rounds: CampRound[], a = analysis, total = 3) => previewRoundAdvice(a, rounds, total);
beforeEach(() => resetPreviewRounds(bout.id));

describe("T-037 cases ported from Nest bout-analysis.model.spec", () => {
  it("prioritizes coach order, including a dropped tactic, without mutating input", () => {
    const rounds: CampRound[] = [{ id: "1", roundNo: 1, tacticMarks: { t1: "INEFFECTIVE", t2: "EFFECTIVE" } }, { id: "2", roundNo: 2, tacticMarks: { t1: "INEFFECTIVE" }, nextRoundPlan: plan({ focusTacticIds: ["t1", "t2"] }) }];
    const before = JSON.stringify(rounds); const result = advice(rounds);
    expect(result.tactics.map(a => a.id)).toEqual(["t1", "t2"]);
    expect(result.tactics[0]).toMatchObject({ focus: true, dropped: true, addedRound: null });
    expect(result.nextRound).toMatchObject({ roundNo: 3, plan: rounds[1].nextRoundPlan });
    expect(JSON.stringify(rounds)).toBe(before);
  });
  it("merges added tactics from every round and uses only the latest plan", () => {
    const result = advice([{ id: "2", roundNo: 2, nextRoundPlan: plan({ addedTactics: [{ id: "new2", text: "second", observationIds: [] }] }) }, { id: "1", roundNo: 1, observationMarks: { o1: "SEEN" }, nextRoundPlan: plan({ focusTacticIds: ["new1"], addedTactics: [{ id: "new1", text: "new", observationIds: ["o1"] }] }) }]);
    expect(result.tactics.find(a => a.id === "new1")).toMatchObject({ addedRound: 1, trained: false, basis: "REPEATED", focus: false });
    expect(result.tactics.find(a => a.id === "new2")?.addedRound).toBe(2);
    expect(advice([{ id: "1", roundNo: 1, nextRoundPlan: plan() }]).nextRound.plan).toBeNull();
  });
  it("orders safety, newly dropped, up to two uses, then must-win; no repeated stop", () => {
    const a = { ...analysis, tactics: [tactic("t1"), tactic("t2"), tactic("t3")] };
    const rounds: CampRound[] = [{ id: "1", roundNo: 1, tacticMarks: { t1: "INEFFECTIVE" }, stunned: true, selfScore: "LOSS" }, { id: "2", roundNo: 2, tacticMarks: { t1: "INEFFECTIVE" }, stunned: true, selfScore: "WIN" }];
    expect(advice(rounds, a).nextRound.suggested).toEqual([{ code: "SAFETY_CHECK" }, { code: "STOP_TACTIC", tacticId: "t1" }, { code: "USE_TACTIC", tacticId: "t2" }, { code: "USE_TACTIC", tacticId: "t3" }, { code: "MUST_WIN_ROUND" }]);
    expect(advice([...rounds, { id: "3", roundNo: 3 }], a, 5).nextRound.suggested.some(i => i.code === "STOP_TACTIC")).toBe(false);
  });
  it("rechecks changed evidence and reports hard-to-win points with a five-item cap", () => {
    const rounds: CampRound[] = [{ id: "1", roundNo: 1, selfScore: "LOSS", observationMarks: { o1: "NOT_SEEN" } }, { id: "2", roundNo: 2, selfScore: "LOSS", observationMarks: { o1: "NOT_SEEN" } }];
    expect(advice(rounds).nextRound.suggested).toEqual([{ code: "RECHECK_OPPONENT", tacticId: "t1" }, { code: "RECHECK_OPPONENT", tacticId: "t2" }, { code: "HARD_TO_WIN_ON_POINTS" }]);
    expect(advice(rounds, { ...analysis, tactics: Array.from({ length: 7 }, (_, i) => tactic(`t${i}`)) }).nextRound.suggested).toHaveLength(5);
  });
});

describe("plan validation, persistence and round selection", () => {
  it("round-trips a focus, added tactic and custom instruction, then permits marking the new tactic", () => {
    const p = plan({ focusTacticIds: ["t1"], addedTactics: [{ id: "r1-a1", text: "Đổi góc trái", observationIds: ["o1"] }], instructions: [{ code: "CUSTOM", text: "Giữ cự ly" }] });
    const saved = savePreviewRound(bout, 1, { nextRoundPlan: p });
    p.addedTactics[0].text = "mutated";
    expect(readPreviewRounds(bout).rounds[0].nextRoundPlan?.addedTactics[0].text).toBe("Đổi góc trái");
    saved.rounds[0].nextRoundPlan!.focusTacticIds.push("t2");
    expect(readPreviewRounds(bout).rounds[0].nextRoundPlan?.focusTacticIds).toEqual(["t1"]);
    expect(savePreviewRound(bout, 2, { tacticMarks: { "r1-a1": "EFFECTIVE" } }).rounds[1].tacticMarks).toEqual({ "r1-a1": "EFFECTIVE" });
    expect(savePreviewRound(bout, 1, { note: "edit only" }).rounds[0].nextRoundPlan?.instructions[0].text).toBe("Giữ cự ly");
  });
  it("enforces limits, identifiers, required text, references and last-round restrictions", () => {
    const invalid = [plan({ focusTacticIds: ["t1", "t1"] }), plan({ focusTacticIds: ["unknown"] }), plan({ instructions: [{ code: "CUSTOM" }] }), plan({ instructions: [{ code: "USE_TACTIC" }] }), plan({ instructions: Array(4).fill({ code: "SAFETY_CHECK" }) }), plan({ addedTactics: [{ id: "bad ID", text: "x", observationIds: [] }] }), plan({ addedTactics: [{ id: "t1", text: "x", observationIds: [] }] }), plan({ addedTactics: [{ id: "new", text: "x".repeat(141), observationIds: [] }] }), plan({ addedTactics: [{ id: "new", text: "x", observationIds: ["unknown"] }] })];
    for (const p of invalid) expect(() => validatePlan(p, bout, [], 1)).toThrow();
    expect(() => validatePlan(plan({ focusTacticIds: ["t1"] }), bout, [], 3)).toThrow("Hiệp cuối");
    expect(() => validatePlan(emptyPlan(), bout, [], 3)).not.toThrow();
  });
  it("rejects same-round marks for new tactics and protects references in later rounds", () => {
    const p = plan({ addedTactics: [{ id: "r1-a1", text: "New", observationIds: [] }] });
    expect(() => savePreviewRound(bout, 1, { nextRoundPlan: p, tacticMarks: { "r1-a1": "EFFECTIVE" } })).toThrow();
    savePreviewRound(bout, 1, { nextRoundPlan: p }); savePreviewRound(bout, 2, { tacticMarks: { "r1-a1": "EFFECTIVE" } });
    expect(() => savePreviewRound(bout, 1, { nextRoundPlan: emptyPlan() })).toThrow("hiệp sau");
    expect(() => validateRoundMarks({ observationMarks: { unknown: "SEEN" } }, bout, readPreviewRounds(bout), 2)).toThrow();
  });
  it("uses server nextRound, exposes added tactics only after introduction, and decorates cards at full time", () => {
    const p = plan({ focusTacticIds: ["r1-a1"], addedTactics: [{ id: "r1-a1", text: "New", observationIds: [] }] });
    const data = savePreviewRound(bout, 1, { nextRoundPlan: p });
    data.advice!.nextRound.roundNo = 3;
    expect(currentRound(data, 3)).toBe(3);
    expect(entryTactics(bout, data, 1).some(a => a.id === "r1-a1")).toBe(false);
    expect(compactTactics(entryTactics(bout, data, 2), data, 2).map(a => a.id)).toContain("r1-a1");
    expect(cornerPlanTactics(previewCornerCard(bout.opponentAnalysis), { ...data, advice: null }).find(a => a.id === "r1-a1")).toMatchObject({ focus: true, addedRound: 1 });
  });
  it("translates all seven backend codes and never shows a raw tactic id", () => {
    for (const code of ["SAFETY_CHECK", "STOP_TACTIC", "USE_TACTIC", "RECHECK_OPPONENT", "MUST_WIN_ROUND", "HARD_TO_WIN_ON_POINTS", "CUSTOM"] as const)
      expect(instructionText({ code, tacticId: "t1", text: "Lời dặn" }, [{ id: "t1", text: "Jab" }])).toBeTruthy();
    const missing = instructionText({ code: "USE_TACTIC", tacticId: "t9" }, []);
    expect(missing).toBe(`Dùng: ${betweenRound.unknownTactic}`); expect(missing).not.toContain("t9");
    expect(instructionText({ code: "NEW_CODE" as never }, [])).toBe(pendingVi.unknownInstruction);
  });
});
