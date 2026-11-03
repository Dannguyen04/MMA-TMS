import { describe, expect, it } from "vitest";

import type { SuspensionRule } from "./bout";
import {
    blockingSuspensions,
    canClearSuspension,
    describeRule,
    isSuspensionActive,
    suggestSuspension,
    suspensionEndsOn,
    suspensionReasonFor,
    suspensionState,
    validateSuspension,
    MANUAL_SUSPENSION_REASONS,
} from "./bout-suspension-rules";

/** The AIBA preset's rules (Tech spec §2.2). */
const AIBA: SuspensionRule[] = [
    { reason: ["KO", "TKO"], minDays: 30 },
    { reason: ["KO", "TKO"], priorCount: 1, withinDays: 90, minDays: 90 },
    { reason: ["KO", "TKO"], priorCount: 2, withinDays: 365, minDays: 365 },
    { loc: "UNDER_1_MIN", minDays: 90 },
    { loc: "OVER_1_MIN", minDays: 180 },
];

const ON = "2026-10-23";

describe("suggested days (Business flows F7)", () => {
    it("suggests 30 days for a first KO", () => {
        expect(suggestSuspension(AIBA, { reason: "KO", lossOfConsciousness: "NONE", priorKnockoutStarts: [], on: ON })?.days).toBe(30);
    });

    it("suggests 90 days for a second KO within 90 days, counting one in sparring", () => {
        expect(suggestSuspension(AIBA, { reason: "KO", lossOfConsciousness: "NONE", priorKnockoutStarts: ["2026-08-30"], on: ON })?.days).toBe(90);
        expect(suggestSuspension(AIBA, { reason: "KO", lossOfConsciousness: "NONE", priorKnockoutStarts: ["2026-06-01"], on: ON })?.days).toBe(30);
    });

    it("suggests a year for a third KO within 12 months", () => {
        expect(suggestSuspension(AIBA, { reason: "TKO", lossOfConsciousness: "NONE", priorKnockoutStarts: ["2026-03-01", "2026-09-01"], on: ON })?.days).toBe(365);
    });

    it("suggests 180 days after more than a minute unconscious, even the first time", () => {
        expect(suggestSuspension(AIBA, { reason: "KO", lossOfConsciousness: "OVER_1_MIN", priorKnockoutStarts: [], on: ON })).toMatchObject({ days: 180, rule: { loc: "OVER_1_MIN" } });
    });

    it("suggests nothing when the ruleset has no rule (VMMAF) or for a disqualification under AIBA", () => {
        expect(suggestSuspension([], { reason: "KO", lossOfConsciousness: "NONE", priorKnockoutStarts: [], on: ON })).toBeNull();
        expect(suggestSuspension(AIBA, { reason: "DQ", lossOfConsciousness: "OVER_1_MIN", priorKnockoutStarts: [], on: ON })).toBeNull();
    });

    it("describes the rule it used", () => {
        expect(describeRule(AIBA[1])).toBe("KO or TKO, 1 earlier knockout within 90 days: 90 days");
    });
});

describe("which results call for a suspension (H3, H6)", () => {
    it("follows a KO loss, and a TKO loss only when head strikes stopped it", () => {
        expect(suspensionReasonFor({ result: "LOSS", method: "KO", stoppedByHeadStrikes: null })).toBe("KO");
        expect(suspensionReasonFor({ result: "LOSS", method: "TKO", stoppedByHeadStrikes: true })).toBe("TKO");
        expect(suspensionReasonFor({ result: "LOSS", method: "TKO", stoppedByHeadStrikes: false })).toBeNull();
    });

    it("never follows a win, even after a knockdown", () => {
        expect(suspensionReasonFor({ result: "WIN", method: "KO", stoppedByHeadStrikes: null })).toBeNull();
        expect(suspensionReasonFor({ result: "LOSS", method: "DECISION", stoppedByHeadStrikes: null })).toBeNull();
    });
});

describe("Gate 2 (Business flows §6)", () => {
    const ko = {
        fighterId: "f-1",
        startsOn: "2026-10-23",
        endsOn: suspensionEndsOn("2026-10-23", 45),
        requiresClearance: true,
        clearedAt: null as string | null,
        blockedSessionTypes: ["sparring" as const],
    };

    it("blocks sparring on day 10 of a 45-day suspension but allows pad work", () => {
        expect(blockingSuspensions([ko], "f-1", "sparring", "2026-11-02")).toHaveLength(1);
        expect(blockingSuspensions([ko], "f-1", "pad_work", "2026-11-02")).toEqual([]);
        expect(blockingSuspensions([ko], "f-2", "sparring", "2026-11-02")).toEqual([]);
    });

    it("keeps blocking after the last day until the fighter is cleared", () => {
        expect(ko.endsOn).toBe("2026-12-07");
        expect(suspensionState(ko, "2026-12-08")).toBe("AWAITING_CLEARANCE");
        expect(isSuspensionActive(ko, "2026-12-08")).toBe(true);
        expect(isSuspensionActive({ ...ko, clearedAt: "2026-12-08T03:00:00.000Z" }, "2026-12-08")).toBe(false);
        expect(isSuspensionActive({ ...ko, requiresClearance: false }, "2026-12-08")).toBe(false);
    });

    it("lets a coach end an uncleared suspension early", () => {
        expect(canClearSuspension(ko, "2026-12-07")).toBe(true);
        expect(canClearSuspension(ko, "2026-12-08")).toBe(true);
        expect(isSuspensionActive({ ...ko, clearedAt: "2026-11-01T03:00:00.000Z" }, "2026-11-01")).toBe(false);
        expect(canClearSuspension({ ...ko, clearedAt: "2026-11-01T03:00:00.000Z" }, "2026-11-01")).toBe(false);
        expect(canClearSuspension({ ...ko, requiresClearance: false }, "2026-12-08")).toBe(true);
    });

    it("is not active before it starts", () => {
        expect(suspensionState(ko, "2026-10-22")).toBe("UPCOMING");
    });
});

describe("a suspension form", () => {
    const input = {
        reason: "KO",
        startsOn: "2026-10-23",
        days: "30",
        suggestedDays: 30,
        overrideReason: "",
        blockedSessionTypes: ["sparring", "grappling"],
        requiresClearance: true,
        note: "",
    };

    it("keeps the suggestion and works out the last day", () => {
        expect(validateSuspension(input, ["KO"], ["sparring", "grappling", "pad_work"])).toMatchObject({ ok: true, value: { endsOn: "2026-11-22", overrideReason: null } });
    });

    it("needs a reason to change the suggested days (SUSPENSION_OVERRIDE_REASON_REQUIRED)", () => {
        expect(validateSuspension({ ...input, days: "45" }, ["KO"], ["sparring"])).toMatchObject({ ok: false, fieldErrors: { overrideReason: expect.any(String) } });
        expect(validateSuspension({ ...input, days: "45", overrideReason: "Doctor asked for longer" }, ["KO"], ["sparring"])).toMatchObject({
            ok: true,
            value: { overrideReason: "Doctor asked for longer", suggestedDays: 30 },
        });
    });

    it("needs whole days, a known reason and at least one blocked session type", () => {
        expect(validateSuspension({ ...input, suggestedDays: null, days: "0", reason: "BOXING", blockedSessionTypes: ["kicks"] }, MANUAL_SUSPENSION_REASONS, ["sparring"])).toMatchObject({
            ok: false,
            fieldErrors: { days: expect.any(String), reason: "Choose a reason.", blockedSessionTypes: "Block at least one kind of session." },
        });
    });
});
