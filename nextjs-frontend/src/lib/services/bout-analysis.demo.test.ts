import { describe, expect, it } from "vitest";

import type { BoutOutcome } from "@/lib/domain/bout";
import type { User } from "@/lib/domain/types";
import { getBoutReport, saveTacticReviews, upsertBoutRound } from "./bout-analysis.demo";
import { recordDemoResult, resetDemoCampStore } from "./bouts.demo";

// Diego's seeded bout is weighed in and fights today, so demo mode can walk it to the report (T-041 R8).
const TODAY = "2026-10-20";
const NOW = new Date("2026-10-20T01:00:00.000Z");
const BOUT = "bout-weighed-in";
const coach = { id: "u-rafael-costa" } as User;
const koLoss: BoutOutcome = {
    result: "LOSS",
    method: "KO",
    round: 2,
    knockedDown: true,
    lossOfConsciousness: "UNDER_1_MIN",
    stoppedByHeadStrikes: null,
    injuryNote: null,
    notes: null,
    recordedAt: NOW.toISOString(),
};

async function finishBout() {
    await upsertBoutRound(BOUT, 1, { tacticMarks: { "tac-1": "EFFECTIVE", "tac-2": "INEFFECTIVE" }, fatigued: true }, coach);
    await upsertBoutRound(BOUT, 2, { tacticMarks: { "tac-1": "EFFECTIVE", "tac-2": "INEFFECTIVE" }, fatigued: true }, coach);
    expect(recordDemoResult(BOUT, koLoss, { name: "Rafael Costa" }, NOW)).toEqual({ ok: true });
}

describe("demo post-bout report (T-041)", () => {
    it("answers like the API's 409 until the result is recorded", async () => {
        resetDemoCampStore(TODAY);
        await expect(getBoutReport(BOUT)).resolves.toEqual({ ok: false, error: "BOUT_INVALID_TRANSITION" });
        await expect(getBoutReport("no-such-bout")).resolves.toEqual({ ok: false, error: "BOUT_NOT_FOUND" });
    });

    it("reports R29 outcomes, R30 points and the result once the bout is done", async () => {
        resetDemoCampStore(TODAY);
        await finishBout();
        const report = await getBoutReport(BOUT);
        if (!report.ok) throw new Error(report.error);

        expect(report.report.result).toEqual({ result: "LOSS", method: "KO", resultRound: 2, knockedDown: true });
        expect(report.report.roundsRecorded).toBe(2);
        // Like BoutsService.recordResult, the result freezes R29 as `auto` reviews ("filled in by the app").
        expect(report.report.tactics.find((t) => t.id === "tac-1")).toMatchObject({
            effectiveRounds: 2,
            outcome: "EFFECTIVE",
            review: { outcome: "EFFECTIVE", note: null, auto: true },
        });
        expect(report.report.tactics.find((t) => t.id === "tac-2")).toMatchObject({ ineffectiveRounds: 2, outcome: "INEFFECTIVE" });
        expect(report.report.improvementPoints).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ code: "TACTIC_INEFFECTIVE", tacticId: "tac-2" }),
                { code: "FATIGUE_FROM_ROUND_1", fromRound: 1 },
            ]),
        );
    });

    it("keeps the verdict frozen at the result when a round is edited afterwards, as the API does", async () => {
        resetDemoCampStore(TODAY);
        await finishBout();
        await upsertBoutRound(BOUT, 2, { tacticMarks: { "tac-1": "INEFFECTIVE", "tac-2": "EFFECTIVE" } }, coach);
        const report = await getBoutReport(BOUT);
        if (!report.ok) throw new Error(report.error);

        expect(report.report.tactics.find((t) => t.id === "tac-2")).toMatchObject({ outcome: "EFFECTIVE", review: { outcome: "INEFFECTIVE", auto: true } });
        expect(report.report.improvementPoints).toEqual(expect.arrayContaining([expect.objectContaining({ code: "TACTIC_INEFFECTIVE", tacticId: "tac-2" })]));
    });

    it("saves the coach's verdict, which then wins over R29 and drops out of the points", async () => {
        resetDemoCampStore(TODAY);
        await finishBout();

        await expect(saveTacticReviews(BOUT, { reviews: [{ tacticId: "nope", outcome: "EFFECTIVE" }] })).resolves.toEqual({
            ok: false,
            error: "OPPONENT_TACTIC_UNKNOWN",
        });
        await expect(
            saveTacticReviews(BOUT, { reviews: [{ tacticId: "tac-2", outcome: "EFFECTIVE", note: "Worked once he tired" }] }),
        ).resolves.toEqual({ ok: true });

        const report = await getBoutReport(BOUT);
        if (!report.ok) throw new Error(report.error);
        expect(report.report.tactics.find((t) => t.id === "tac-2")?.review).toEqual({ outcome: "EFFECTIVE", note: "Worked once he tired", auto: false });
        expect(report.report.improvementPoints.some((p) => "tacticId" in p && p.tacticId === "tac-2")).toBe(false);
    });

    it("refuses a review before the bout is done", async () => {
        resetDemoCampStore(TODAY);
        await expect(saveTacticReviews(BOUT, { reviews: [] })).resolves.toEqual({ ok: false, error: "BOUT_INVALID_TRANSITION" });
    });
});
