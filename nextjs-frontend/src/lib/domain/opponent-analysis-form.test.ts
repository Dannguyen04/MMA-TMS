import { describe, expect, it } from "vitest";

import { createTranslator } from "@/lib/i18n/translate";
import {
    analysisFieldErrors,
    buildOpponentAnalysisInput,
    nextAnalysisId,
    removeObservation,
} from "./opponent-analysis-form";
import type { OpponentAnalysis, OpponentObservation, OpponentTactic } from "./round-advice";

const obs = (id: string, patch: Partial<OpponentObservation> = {}): OpponentObservation => ({
    id,
    kind: "OPENING",
    text: "Drops the right hand after a jab",
    evidenceUrl: null,
    evidenceNote: "Watched live",
    confidence: "REPEATED",
    ...patch,
});

const tac = (id: string, observationIds: string[], patch: Partial<OpponentTactic> = {}): OpponentTactic => ({
    id,
    text: "When he jabs, slip left and hook",
    round: null,
    observationIds,
    sessionIds: [],
    partnerBrief: null,
    ...patch,
});

const existing: OpponentAnalysis = {
    profile: { stance: "SOUTHPAW" },
    observations: [obs("o1", { evidenceTime: "02:15" })],
    tactics: [tac("t1", ["o1"], { sessionIds: ["11111111-1111-4111-8111-111111111111"], review: { outcome: "EFFECTIVE" } })],
};

function errorsOf(raw: unknown, rounds: number | null = 3): Record<string, string> {
    const result = buildOpponentAnalysisInput(raw, existing, rounds);
    if (result.success) throw new Error("expected failure");
    return Object.fromEntries(result.error.issues.map((i) => [i.path.join("."), i.message]));
}

describe("buildOpponentAnalysisInput", () => {
    it("rejects a tactic without a basis observation (R13)", () => {
        expect(errorsOf({ observations: [obs("o1")], tactics: [tac("t1", [])] })).toMatchObject({
            "tactics.0.observationIds": "basis",
        });
    });

    it("rejects a basis that points to a removed observation", () => {
        expect(errorsOf({ observations: [obs("o1")], tactics: [tac("t1", ["o9"])] })).toMatchObject({
            "tactics.0.observationIds": "basis",
        });
    });

    it("caps observations at 6 and tactics at 5", () => {
        const sevenObs = Array.from({ length: 7 }, (_, i) => obs(`o${i + 1}`));
        expect(buildOpponentAnalysisInput({ observations: sevenObs, tactics: [] }, existing, 3).success).toBe(false);
        const sixTactics = Array.from({ length: 6 }, (_, i) => tac(`t${i + 1}`, ["o1"]));
        expect(buildOpponentAnalysisInput({ observations: [obs("o1")], tactics: sixTactics }, existing, 3).success).toBe(false);
    });

    it("requires an evidence link or note, and only http(s) links", () => {
        expect(errorsOf({ observations: [obs("o1", { evidenceNote: "  " })], tactics: [] })).toMatchObject({
            "observations.0.evidenceNote": "evidence",
        });
        expect(errorsOf({ observations: [obs("o1", { evidenceUrl: "ftp://x.test/v" })], tactics: [] })).toMatchObject({
            "observations.0.evidenceUrl": "url",
        });
        const ok = buildOpponentAnalysisInput(
            { observations: [obs("o1", { evidenceNote: null, evidenceUrl: "https://youtu.be/x" })], tactics: [] },
            existing,
            3,
        );
        expect(ok.success).toBe(true);
    });

    it("rejects duplicate ids and rounds beyond the scheduled rounds", () => {
        expect(errorsOf({ observations: [obs("o1"), obs("o1")], tactics: [] })).toMatchObject({
            "observations.1.id": "uniqueId",
        });
        expect(errorsOf({ observations: [obs("o1")], tactics: [tac("t1", ["o1"], { round: 4 })] }, 3)).toMatchObject({
            "tactics.0.round": "round",
        });
    });

    it("keeps profile, sessionIds and evidenceTime from the server and drops review", () => {
        const result = buildOpponentAnalysisInput(
            {
                observations: [obs("o1", { evidenceTime: "99:99" }), obs("obs-1")],
                tactics: [
                    { ...tac("t1", ["o1"], { text: "Edited" }), sessionIds: ["forged"], review: { outcome: "INEFFECTIVE" } },
                    tac("tac-1", ["obs-1"]),
                ],
            },
            existing,
            3,
        );
        if (!result.success) throw new Error("expected success");
        expect(result.data.profile).toEqual({ stance: "SOUTHPAW" });
        expect(result.data.observations[0]?.evidenceTime).toBe("02:15");
        expect(result.data.tactics[0]).toMatchObject({ id: "t1", text: "Edited", sessionIds: ["11111111-1111-4111-8111-111111111111"] });
        expect(result.data.tactics[0]).not.toHaveProperty("review");
        expect(result.data.tactics[1]?.sessionIds).toEqual([]);
    });
});

describe("form helpers", () => {
    it("generates ids that do not clash and match the backend pattern", () => {
        const id = nextAnalysisId("obs", ["obs-1", "obs-2", "tac-1"]);
        expect(id).toBe("obs-3");
        expect(id).toMatch(/^[a-z0-9_-]{1,20}$/);
    });

    it("removes an observation from every tactic basis", () => {
        const next = removeObservation({ observations: [obs("o1"), obs("o2")], tactics: [tac("t1", ["o1", "o2"])] }, "o1");
        expect(next.observations.map((o) => o.id)).toEqual(["o2"]);
        expect(next.tactics[0]?.observationIds).toEqual(["o2"]);
    });

    it("translates issue codes into field messages", () => {
        const result = buildOpponentAnalysisInput({ observations: [obs("o1")], tactics: [tac("t1", [])] }, existing, 3);
        if (result.success) throw new Error("expected failure");
        expect(analysisFieldErrors(result.error, createTranslator("vi"))).toEqual({
            "tactics.0.observationIds": "Chọn ít nhất một quan sát làm căn cứ.",
        });
    });
});
