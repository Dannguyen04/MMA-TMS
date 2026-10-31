import { describe, expect, it } from "vitest";

import { apiBoutSchema, apiRulesetSchema, catchweightBody, createBoutBody, requirementUpdateBody, resultBody, toCampBout, toRuleset, weighInBody } from "./bouts-contract";

const vmmaf = toRuleset(
    apiRulesetSchema.parse({
        id: "rs-1",
        name: "MMA – VMMAF 2021",
        sport: "MMA",
        verified: true,
        weightClasses: [{ code: "60", label: "60 kg", limitKg: 60 }],
        requirementTemplates: [],
        fightWeekDays: 7,
        requirementsDueDays: 7,
        acuteWindowDays: 7,
        acuteLossLimitPctLong: "8.0",
        acuteLossLimitPctShort: "5.0",
        defaultBlockedSessionTypes: ["SPARRING", "GRAPPLING", "UNKNOWN"],
    }),
);

describe("bouts contract (T-003 §2)", () => {
    it("reads a ruleset, numeric strings and session types included", () => {
        expect(vmmaf).toMatchObject({ acuteLossLimitPctLong: 8, acuteLossLimitPctShort: 5, defaultBlockedSessionTypes: ["sparring", "grappling"] });
    });

    it("reads a bout into the frontend's terms, the class label from its ruleset", () => {
        const bout = toCampBout(
            apiBoutSchema.parse({
                id: "b-1",
                fighterId: "f-1",
                coachId: "c-1",
                rulesetId: "rs-1",
                eventName: "Lotus Fight Night 18",
                opponentName: null,
                weightClassCode: "60",
                weightLimitKg: "60.00",
                acuteLossLimitPct: 8,
                requirementsDueDays: 7,
                weighInAt: "2026-10-22T03:00:00.000Z",
                boutAt: "2026-10-23T12:00:00.000Z",
                status: "CAMP",
                trainingPlanId: "tp-1",
                cancelReason: null,
                createdAt: "2026-10-20T09:00:00.000Z",
                requirements: [{ code: "BRAIN_CT", label: "Brain CT", required: true, status: "MISSING", source: "COACH" }],
            }),
            vmmaf,
        );
        expect(bout).toMatchObject({
            event: "Lotus Fight Night 18",
            opponent: null,
            weightClassLabel: "60 kg",
            limitKg: 60,
            phase: "CAMP",
            rulesetName: "MMA – VMMAF 2021",
            campStartedOn: "2026-10-20",
            requirements: [{ code: "BRAIN_CT", state: "MISSING", validUntil: null }],
        });
    });

    it("sends a class code for a preset and the limit for a custom ruleset", () => {
        const base = { fighterId: "f-1", rulesetId: "rs-1", event: "E", venue: null, opponent: null, weighInAt: "a", boutAt: "b" };
        expect(createBoutBody({ ...base, weightClass: { code: "60", limitKg: 60 }, customLimit: false })).toMatchObject({ weightClassCode: "60", eventName: "E" });
        expect(createBoutBody({ ...base, weightClass: { code: "63.5", limitKg: 63.5 }, customLimit: true })).toMatchObject({ weightLimitKg: 63.5 });
        expect(createBoutBody({ ...base, weightClass: { code: "63.5", limitKg: 63.5 }, customLimit: true })).not.toHaveProperty("weightClassCode");
    });

    it("reads the official weigh-in, its acute loss and the result from the row and the history (T-006)", () => {
        const row = {
            id: "b-1",
            fighterId: "f-1",
            coachId: "c-1",
            rulesetId: "rs-1",
            eventName: "E",
            venue: null,
            opponentName: null,
            weightClassCode: "60",
            weightLimitKg: 60,
            catchweightKg: 60.5,
            acuteLossLimitPct: 8,
            requirementsDueDays: 7,
            weighInAt: "2026-10-22T03:00:00.000Z",
            boutAt: "2026-10-23T12:00:00.000Z",
            status: "COMPLETED",
            trainingPlanId: null,
            cancelReason: null,
            notes: "Clean fight",
            createdAt: "2026-10-01T09:00:00.000Z",
            updatedAt: "2026-10-23T14:00:00.000Z",
            officialWeightKg: 60.5,
            madeWeight: true,
            hydrationCheck: "NOT_APPLICABLE",
            result: "LOSS",
            method: "TKO",
            resultRound: 2,
            knockedDown: true,
            acuteLoss: { status: "WITHIN", startKg: 66, startOn: "2026-10-15", lossPct: 7.9, limitPct: 8 },
            history: [
                { at: "2026-10-22T03:10:00.000Z", by: "u-1", from: "FIGHT_WEEK", to: "WEIGHED_IN", reason: "20% purse", catchweightKg: 60.5 },
                { at: "2026-10-23T13:00:00.000Z", by: "u-1", from: "WEIGHED_IN", to: "COMPLETED", lossOfConsciousness: "NONE", stoppedByHeadStrike: true, injuryNote: "Cut over the eye" },
            ],
        };
        const bout = toCampBout(apiBoutSchema.parse(row), vmmaf);
        expect(bout.weighIn).toEqual({
            weightKg: 60.5,
            madeWeight: true,
            hydrationCheck: "NOT_APPLICABLE",
            recordedAt: "2026-10-22T03:10:00.000Z",
            catchweightNote: "20% purse",
            acuteLoss: { status: "WITHIN", startKg: 66, startOn: "2026-10-15", lossPct: 7.9, limitPct: 8 },
        });
        expect(bout.outcome).toEqual({
            result: "LOSS",
            method: "TKO",
            round: 2,
            knockedDown: true,
            lossOfConsciousness: "NONE",
            stoppedByHeadStrikes: true,
            injuryNote: "Cut over the eye",
            notes: "Clean fight",
            recordedAt: "2026-10-23T13:00:00.000Z",
        });
        // Rows from before T-006 have neither.
        const before = toCampBout(apiBoutSchema.parse({ ...row, status: "CAMP", officialWeightKg: null, result: null, method: null, history: [] }), vmmaf);
        expect(before).toMatchObject({ weighIn: null, outcome: null });
    });

    it("sends only the fields the result's rules allow (T-006 §4)", () => {
        const decision = { result: "WIN", method: "DECISION", round: null, knockedDown: false, lossOfConsciousness: null, stoppedByHeadStrikes: null, injuryNote: null, notes: null, recordedAt: "" } as const;
        expect(resultBody(decision)).toEqual({ result: "WIN", method: "DECISION", knockedDown: false });
        expect(resultBody({ ...decision, result: "LOSS", method: "TKO", round: 2, lossOfConsciousness: "NONE", stoppedByHeadStrikes: true, injuryNote: "Cut" })).toEqual({
            result: "LOSS",
            method: "TKO",
            resultRound: 2,
            knockedDown: false,
            lossOfConsciousness: "NONE",
            stoppedByHeadStrike: true,
            injuryNote: "Cut",
        });
        expect(weighInBody({ weightKg: 59.8, hydrationCheck: null })).toEqual({ weightKg: 59.8 });
        expect(weighInBody({ weightKg: 59.8, hydrationCheck: "FAILED" })).toEqual({ weightKg: 59.8, hydrationCheck: "FAILED" });
        expect(catchweightBody({ catchweightKg: null, note: null })).toEqual({});
        expect(catchweightBody({ catchweightKg: 61, note: "20% purse" })).toEqual({ catchweightKg: 61, note: "20% purse" });
    });

    it("adds the unlock reason to a fight-week checklist change", () => {
        expect(requirementUpdateBody({ state: "PROVIDED", issuedOn: null, validUntil: null, statusReason: null }, "New scan from the event doctor")).toMatchObject({
            unlockReason: "New scan from the event doctor",
        });
    });

    it("names the requirement state `status`", () => {
        expect(requirementUpdateBody({ state: "PROVIDED", issuedOn: "2026-10-01", validUntil: "2027-03-30", statusReason: null })).toEqual({
            status: "PROVIDED",
            issuedOn: "2026-10-01",
            validUntil: "2027-03-30",
            statusReason: null,
        });
    });
});
