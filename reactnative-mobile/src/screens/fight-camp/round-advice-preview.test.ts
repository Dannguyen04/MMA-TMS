/// <reference types="jest" />
import type { Analysis, CampDetail, RoundInput } from "@/api/fight-camp";
import { previewBout } from "./camp-preview";
import { previewCornerCard, previewRoundAdvice, previewRoundsResponse } from "./round-advice-preview";
import { readPreviewRounds, resetPreviewRounds, savePreviewRound } from "./preview-round-store";

const analysis: Analysis = {
  observations: [{ id: "o1", text: "Hạ tay", kind: "OPENING", confidence: "ONCE", evidenceNote: "Video" }, { id: "o2", text: "Đổi trụ", kind: "HABIT", confidence: "REPEATED", evidenceNote: "Video" }],
  tactics: [
    { id: "t1", text: "Phản đòn", round: null, observationIds: ["o1"], sessionIds: ["trained"] },
    { id: "t2", text: "Đổi góc", round: null, observationIds: ["o1"], sessionIds: [] },
    { id: "t3", text: "Đánh thấp", round: null, observationIds: ["o1", "o2"], sessionIds: [] },
  ],
};
const bout: CampDetail = { ...previewBout, id: "preview-rules-test", opponentAnalysis: analysis };
const round = (roundNo: number, input: RoundInput = {}) => ({ roundNo, ...input });
describe("R20–R24 sample advice mirrors the server rules", () => {
  it("R20 sorts repeated evidence before trained tactics and SEEN upgrades evidence", () => {
    expect(previewCornerCard(analysis).tactics.map(t => t.id)).toEqual(["t3", "t1", "t2"]);
    const card = previewCornerCard(analysis, [round(1, { observationMarks: { o1: "SEEN" } })]);
    expect(card.tactics[0]).toMatchObject({ id: "t1", trained: true, basis: "REPEATED" });
  });
  it("R21 lowers score after one failure, drops after two, promotes unused alternatives", () => {
    const once = previewRoundAdvice(analysis, [round(1, { tacticMarks: { t1: "INEFFECTIVE" } })], 3);
    expect(once.tactics.find(t => t.id === "t1")).toMatchObject({ score: -1, dropped: false });
    const twice = previewRoundAdvice(analysis, [round(1, { tacticMarks: { t1: "INEFFECTIVE" } }), round(2, { tacticMarks: { t1: "INEFFECTIVE" } })], 3);
    expect(twice.tactics.at(-1)).toMatchObject({ id: "t1", score: -2, dropped: true });
    const promoteCase = { ...analysis, tactics: analysis.tactics!.map(t => t.id === "t3" ? { ...t, observationIds: ["o2"] } : t) };
    const tied = previewRoundAdvice(promoteCase, [round(1, { tacticMarks: { t1: "EFFECTIVE" } }), round(2, { tacticMarks: { t1: "INEFFECTIVE" } })], 3);
    expect(tied.tactics[0].id).toBe("t2");
  });
  it("R21 NOT_USED does not reset the streak; EFFECTIVE resets it", () => {
    expect(previewRoundAdvice(analysis, [round(1, { tacticMarks: { t1: "INEFFECTIVE" } }), round(2, { tacticMarks: { t1: "NOT_USED" } }), round(3, { tacticMarks: { t1: "INEFFECTIVE" } })], 5).tactics.find(t => t.id === "t1")?.dropped).toBe(true);
    expect(previewRoundAdvice(analysis, [round(1, { tacticMarks: { t1: "INEFFECTIVE" } }), round(2, { tacticMarks: { t1: "EFFECTIVE" } })], 3).tactics.find(t => t.id === "t1")?.dropped).toBe(false);
  });
  it("R22 demotes only when all evidence is unseen in two adjacent rounds", () => {
    const rounds = [round(1, { observationMarks: { o1: "NOT_SEEN" as const } }), round(2, { observationMarks: { o1: "NOT_SEEN" as const } })];
    const advice = previewRoundAdvice(analysis, rounds, 3);
    expect(advice.tactics.find(t => t.id === "t1")?.note).toBe("OPPONENT_MAY_HAVE_CHANGED");
    expect(advice.tactics.find(t => t.id === "t3")?.note).toBeUndefined();
    expect(previewRoundAdvice(analysis, [rounds[0], { ...rounds[1], roundNo: 3 }], 5).tactics.every(t => !t.note)).toBe(true);
  });
  it("R23 calculates standing from actual scheduled rounds, including unscored records", () => {
    expect(previewRoundAdvice({}, [round(1, { selfScore: "LOSS" }), round(2, { selfScore: "LOSS" })], 3).standing.kind).toBe("HARD_TO_WIN_ON_POINTS");
    expect(previewRoundAdvice({}, [round(1, { selfScore: "WIN" })], 5).standing.kind).toBe("AHEAD");
    expect(previewRoundAdvice({}, [round(1), round(2, { selfScore: null })], 5).standing).toEqual({ kind: "NEED_WINS", needed: 1, remaining: 3, selfScored: true });
  });
  it("R24 warns for cumulative knockdowns or the most recent adjacent stunned streak", () => {
    expect(previewRoundAdvice({}, [round(1, { knockdownsAgainst: 1 })], 3).safety).toBeNull();
    expect(previewRoundAdvice({}, [round(1, { knockdownsAgainst: 1 }), round(2, { knockdownsAgainst: 1 })], 3).safety?.reasons).toEqual(["KNOCKDOWNS"]);
    expect(previewRoundAdvice({}, [round(1, { stunned: true }), round(2, { stunned: true })], 3).safety?.reasons).toEqual(["STUNNED_STREAK"]);
    expect(previewRoundAdvice({}, [round(1, { stunned: true }), round(3, { stunned: true })], 5).safety).toBeNull();
    expect(previewRoundAdvice({}, [round(1, { stunned: true }), round(2, { stunned: true }), round(3, { stunned: false })], 5).safety).toBeNull();
  });
  it("does not mutate the analysis or round inputs", () => {
    const rounds = [round(2), round(1)]; const before = JSON.stringify({ analysis, rounds });
    previewRoundAdvice(analysis, rounds, 3);
    expect(JSON.stringify({ analysis, rounds })).toBe(before);
  });
  it("suppresses advice before the first saved round, at full-time, or without a round count", () => {
    expect(previewRoundsResponse(bout, []).advice).toBeNull();
    const rounds = [1, 2, 3].map(n => ({ id: String(n), roundNo: n }));
    expect(previewRoundsResponse(bout, rounds).advice).toBeNull();
    expect(previewRoundsResponse({ ...bout, scheduledRounds: null }, rounds.slice(0, 1)).advice).toBeNull();
  });
  it("sample writes upsert, edits recompute advice, reset and bout stores are isolated", () => {
    resetPreviewRounds(bout.id);
    const other = { ...bout, id: "other-preview" }; resetPreviewRounds(other.id);
    savePreviewRound(bout, 1, { selfScore: "LOSS", knockdownsAgainst: 1 });
    expect(savePreviewRound(bout, 2, { selfScore: "LOSS", knockdownsAgainst: 1 }).advice?.safety?.reasons).toContain("KNOCKDOWNS");
    const changed = savePreviewRound(bout, 2, { selfScore: "WIN", knockdownsAgainst: 0 });
    expect(changed.rounds).toHaveLength(2); expect(changed.advice?.safety).toBeNull();
    expect(readPreviewRounds(other).rounds).toHaveLength(0);
    resetPreviewRounds(bout.id); expect(readPreviewRounds(bout).rounds).toHaveLength(0);
  });
});
