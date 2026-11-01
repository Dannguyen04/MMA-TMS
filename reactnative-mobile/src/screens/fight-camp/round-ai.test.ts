/// <reference types="jest" />
import { ApiError } from "@/api/errors";
import type { AiSuggestion, RoundsResponse } from "@/api/fight-camp";
import { aiDecision, aiLines, aiProblem, aiRequestError, aiTargetRound, isAlreadyDecided, sampleRoundAdvice } from "./round-ai";

const data = (rounds: number[]): RoundsResponse => ({ scheduledRounds: 3, rounds: rounds.map(roundNo => ({ id: `r${roundNo}`, roundNo })), advice: null });
const suggestion = (over: Partial<AiSuggestion> = {}): AiSuggestion => ({ id: "s1", kind: "BETWEEN_ROUNDS", roundNo: 2, status: "OK", errorCode: null, model: "m", cached: false, createdAt: "2026-10-31T12:00:00.000Z",
  output: { instructions: [{ id: "ai1", text: "Một" }, { id: "ai2", text: "Hai" }, { id: "ai3", text: "Ba" }] }, ...over });
const plan = (texts: string[], extra: { code: "SAFETY_CHECK" }[] = []) => ({ focusTacticIds: [], addedTactics: [], instructions: [...extra, ...texts.map(text => ({ code: "CUSTOM" as const, text }))] });

describe("T-038 B2 AI rules", () => {
  it("gates like the server: roundNo ≥ 2, = last saved + 1, ≤ scheduled, WEIGHED_IN or COMPLETED", () => {
    const ok = { status: "WEIGHED_IN" as const };
    expect(aiTargetRound(ok, data([1]), 1, 3)).toBe(2);
    expect(aiTargetRound({ status: "COMPLETED" }, data([1, 2]), 2, 3)).toBe(3);
    expect(aiTargetRound(ok, data([]), 1, 3)).toBeNull();          // round 1 not saved: roundNo 2 ≠ 0 + 1
    expect(aiTargetRound(ok, data([1, 2]), 1, 3)).toBeNull();      // not the last saved round
    expect(aiTargetRound(ok, data([1, 2, 3]), 3, 3)).toBeNull();   // final round has no next round
    expect(aiTargetRound(ok, data([1]), 2, 3)).toBeNull();         // tab 2 before it is saved
    expect(aiTargetRound({ status: "FIGHT_WEEK" }, data([1]), 1, 3)).toBeNull();
    expect(aiTargetRound(ok, null, 1, 3)).toBeNull();
    expect(aiTargetRound(ok, data([1]), 1, null)).toBeNull();
  });
  it("shows at most 3 lines and never offers text over 140 characters", () => {
    const long = "x".repeat(141);
    const r = aiLines(suggestion({ output: { instructions: [{ id: "ai1", text: long }, { id: "ai2", text: " Giữ cự ly " }, { id: "ai3", text: "x".repeat(140) }, { id: "ai4", text: "thừa" }] } }));
    expect(r.lines).toEqual([{ id: "ai2", text: "Giữ cự ly" }, { id: "ai3", text: "x".repeat(140) }]);
    expect(r.hidden).toBe(1);
    expect(aiLines(suggestion({ output: { instructions: "lạ" } })).lines).toEqual([]);
    expect(aiLines(suggestion({ status: "FAILED", errorCode: "TIMEOUT" })).lines).toEqual([]);
    expect(aiProblem(suggestion({ output: { instructions: [{ id: "ai1", text: long }] } }))).toBe("AI chưa có lời dặn phù hợp");
  });
  it("computes ACCEPTED / PARTIAL / REJECTED from the saved plan", () => {
    const { lines } = aiLines(suggestion());
    expect(aiDecision(lines, plan(["Một", "Hai", "Ba"]))).toEqual({ decision: "ACCEPTED", acceptedItemIds: ["ai1", "ai2", "ai3"] });
    expect(aiDecision(lines, plan(["Hai"], [{ code: "SAFETY_CHECK" }]))).toEqual({ decision: "PARTIAL", acceptedItemIds: ["ai2"] });
    expect(aiDecision(lines, plan(["Tự viết"]))).toEqual({ decision: "REJECTED", acceptedItemIds: [] });
    expect(aiDecision([], plan(["Một"]))).toBeNull();
  });
  it("maps failures to Vietnamese and never to the server or JS message", () => {
    expect(aiProblem(suggestion({ status: "FAILED", errorCode: "NOT_CONFIGURED" }))).toBe("AI chưa được bật");
    expect(aiProblem(suggestion({ status: "FAILED", errorCode: "TIMEOUT" }))).toBe("AI không trả lời kịp");
    expect(aiProblem(suggestion({ status: "FAILED", errorCode: "SOMETHING_NEW" }))).toBe("AI không trả lời kịp");
    expect(aiProblem(suggestion())).toBeNull();
    expect(aiRequestError(new ApiError(422, "BOUT_ROUND_OUT_OF_RANGE", "Round out of range"), false)).toBe("Hiệp này nằm ngoài số hiệp của trận hoặc chưa đến lượt.");
    expect(aiRequestError(new Error("boom"), false)).not.toMatch(/boom/);
    expect(aiRequestError(new ApiError(0, "NETWORK_ERROR", "aborted"), true)).toBe("AI không trả lời kịp");
  });
  it("recognises the 409 already-decided answer only", () => {
    expect(isAlreadyDecided(new ApiError(409, "BOUT_AI_ALREADY_DECIDED", "x"))).toBe(true);
    expect(isAlreadyDecided(new ApiError(409, "BOUT_STATE_CONFLICT", "x"))).toBe(false);
    expect(isAlreadyDecided(new Error("x"))).toBe(false);
  });
  it("demo sample has three short lines", () => {
    expect(aiLines(sampleRoundAdvice(2)).lines).toHaveLength(3);
  });
});
