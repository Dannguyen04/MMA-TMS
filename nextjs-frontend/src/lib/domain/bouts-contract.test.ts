import { describe, expect, it } from "vitest";

import { apiBoutSchema, apiRulesetSchema, createBoutBody, requirementUpdateBody, toCampBout, toRuleset } from "./bouts-contract";

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

    it("names the requirement state `status`", () => {
        expect(requirementUpdateBody({ state: "PROVIDED", issuedOn: "2026-10-01", validUntil: "2027-03-30", statusReason: null })).toEqual({
            status: "PROVIDED",
            issuedOn: "2026-10-01",
            validUntil: "2027-03-30",
            statusReason: null,
        });
    });
});
