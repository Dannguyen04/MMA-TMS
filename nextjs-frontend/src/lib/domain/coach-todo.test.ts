import { describe, expect, it } from "vitest";

import { calculateWeightFeasibility, computeWeighInReminder, feasibilityWarnings } from "./bout-rules";
import { buildDemoCoachTodo } from "./coach-todo";
import type { Bout } from "./types";

const NOW = "2026-10-20T03:00:00.000Z"; // 2026-10-20 10:00 in Vietnam

function bout(over: Partial<Bout> = {}): Bout {
    return {
        id: "b1",
        fighterId: "f1",
        coachId: "c1",
        rulesetId: "r1",
        eventName: "Demo Cup",
        venue: null,
        opponentName: null,
        weightClassCode: "60",
        weightLimitKg: 60,
        acuteLossLimitPct: 8,
        requirementsDueDays: 7,
        weighInAt: "2026-11-09T01:00:00.000Z",
        boutAt: "2026-11-10T03:00:00.000Z",
        status: "CAMP",
        trainingPlanId: null,
        officialWeightKg: null,
        madeWeight: null,
        catchweightKg: null,
        hydrationCheck: null,
        result: null,
        method: null,
        resultRound: null,
        knockedDown: null,
        cancelReason: null,
        notes: null,
        history: [],
        createdById: "u1",
        createdAt: "2026-10-01T03:00:00.000Z",
        updatedAt: "2026-10-01T03:00:00.000Z",
        deletedAt: null,
        requirements: [],
        ...over,
    };
}

describe("calculateWeightFeasibility (R31)", () => {
    const base = { limitKg: 60, acuteLossLimitPct: 8, acuteWindowDays: 7, now: NOW };

    it("is OVER_LIMIT inside the acute window: 60 kg, 2 days, 66 kg is 9.1% > 8%", () => {
        const result = calculateWeightFeasibility({ ...base, weighInAt: "2026-10-22T01:00:00.000Z", latest: { date: "2026-10-19T03:00:00.000Z", kg: 66 } });
        expect(result).toMatchObject({ status: "OVER_LIMIT", remainingPct: 9.1, daysToWeighIn: 2 });
        expect(feasibilityWarnings(result.status)).toEqual([{ code: "WEIGHT_AT_RISK" }]);
    });

    it("is ON_TRACK at 64.5 kg and 0% under the limit", () => {
        expect(calculateWeightFeasibility({ ...base, weighInAt: "2026-10-22T01:00:00.000Z", latest: { date: NOW, kg: 64.5 } }).status).toBe("ON_TRACK");
        expect(calculateWeightFeasibility({ ...base, weighInAt: "2026-10-22T01:00:00.000Z", latest: { date: NOW, kg: 58 } }).remainingPct).toBe(0);
    });

    it("colours only when D <= A: 7 days is judged, 8 days is NEUTRAL with the figures", () => {
        const latest = { date: NOW, kg: 66 };
        expect(calculateWeightFeasibility({ ...base, weighInAt: "2026-10-27T01:00:00.000Z", latest }).status).toBe("OVER_LIMIT");
        const beyond = calculateWeightFeasibility({ ...base, weighInAt: "2026-10-28T01:00:00.000Z", latest });
        expect(beyond).toMatchObject({ status: "NEUTRAL", remainingPct: 9.1, latestKg: 66 });
        expect(feasibilityWarnings(beyond.status)).toEqual([]);
    });

    it("is NOT_WEIGHED without a weight in 7 days: 7 days old counts, 8 does not", () => {
        const weighInAt = "2026-10-22T01:00:00.000Z";
        expect(calculateWeightFeasibility({ ...base, weighInAt, latest: null }).status).toBe("NOT_WEIGHED");
        expect(calculateWeightFeasibility({ ...base, weighInAt, latest: { date: "2026-10-13T03:00:00.000Z", kg: 66 } }).status).toBe("OVER_LIMIT");
        const stale = calculateWeightFeasibility({ ...base, weighInAt, latest: { date: "2026-10-12T03:00:00.000Z", kg: 66 } });
        expect(stale).toMatchObject({ status: "NOT_WEIGHED", remainingPct: null });
        expect(feasibilityWarnings(stale.status)).toEqual([{ code: "WEIGHT_INSUFFICIENT_DATA" }]);
    });
});

describe("computeWeighInReminder (T0)", () => {
    it("asks for today after one day, escalates from two, stops when today has a weight", () => {
        expect(computeWeighInReminder({ status: "FIGHT_WEEK", latestOn: "2026-10-19", now: NOW })).toMatchObject({ active: true, level: "ASK_TODAY", daysSinceLastWeight: 1 });
        expect(computeWeighInReminder({ status: "FIGHT_WEEK", latestOn: "2026-10-18", now: NOW }).level).toBe("YESTERDAY_MISSING");
        expect(computeWeighInReminder({ status: "FIGHT_WEEK", latestOn: "2026-10-20", now: NOW }).active).toBe(false);
        expect(computeWeighInReminder({ status: "FIGHT_WEEK", latestOn: null, now: NOW })).toMatchObject({ active: true, level: "ASK_TODAY" });
    });

    it("reminds only in FIGHT_WEEK", () => {
        for (const status of ["SCHEDULED", "CAMP", "WEIGHED_IN", "COMPLETED", "CANCELLED"] as const) {
            expect(computeWeighInReminder({ status, latestOn: "2026-10-15", now: NOW }).active).toBe(false);
        }
    });
});

describe("buildDemoCoachTodo", () => {
    const sources = (items: ReturnType<typeof buildDemoCoachTodo>) => items.map((item) => item.source);

    it("lists paperwork due within 14 days and overdue paperwork, not far-off paperwork", () => {
        const open = { gate1: { passed: false, missing: ["Health certificate"], expiring: [] } };
        expect(sources(buildDemoCoachTodo([bout({ ...open, requirementsDueOn: "2026-11-03" })], NOW))).toEqual(["REQUIREMENTS_DUE"]);
        expect(sources(buildDemoCoachTodo([bout({ ...open, requirementsDueOn: "2026-11-04" })], NOW))).toEqual([]);
        expect(sources(buildDemoCoachTodo([bout({ ...open, requirementsDueOn: "2026-10-19" })], NOW))).toEqual(["REQUIREMENTS_OVERDUE"]);
    });

    it("lists red, yellow and grey weights before the official weigh-in but not NEUTRAL or green", () => {
        const weight = (status: NonNullable<Bout["weight"]>["status"]) => ({ weight: { latestKg: 66, latestOn: "2026-10-20", remainingPct: 9.1, status, referencePath: [] } });
        expect(sources(buildDemoCoachTodo([bout(weight("OVER_LIMIT"))], NOW))).toEqual(["WEIGHT_OVER_LIMIT"]);
        expect(sources(buildDemoCoachTodo([bout(weight("ABOVE_TARGET"))], NOW))).toEqual(["WEIGHT_ABOVE_TARGET"]);
        expect(sources(buildDemoCoachTodo([bout(weight("NOT_WEIGHED"))], NOW))).toEqual(["WEIGHT_NOT_WEIGHED"]);
        expect(sources(buildDemoCoachTodo([bout(weight("ON_TRACK"))], NOW))).toEqual([]);
        expect(sources(buildDemoCoachTodo([bout({ ...weight("NEUTRAL"), status: "WEIGHED_IN" })], NOW))).toEqual([]);
        expect(sources(buildDemoCoachTodo([bout({ ...weight("OVER_LIMIT"), status: "WEIGHED_IN" })], NOW))).toEqual([]);
    });

    it("lists the fight week entry, the weigh-in today, the overdue result and the escalated weigh reminder", () => {
        expect(sources(buildDemoCoachTodo([bout({ canEnterFightWeek: true })], NOW))).toEqual(["CAN_ENTER_FIGHT_WEEK"]);
        expect(sources(buildDemoCoachTodo([bout({ status: "FIGHT_WEEK", weighInAt: "2026-10-20T01:00:00.000Z", boutAt: "2026-10-21T03:00:00.000Z" })], NOW))).toEqual(["WEIGH_IN_TODAY"]);
        expect(sources(buildDemoCoachTodo([bout({ status: "WEIGHED_IN", weighInAt: "2026-10-18T01:00:00.000Z", boutAt: "2026-10-19T03:00:00.000Z" })], NOW))).toEqual(["RESULT_OVERDUE"]);
        const reminder = (level: "ASK_TODAY" | "YESTERDAY_MISSING") => ({ weightReminder: { active: true, level, daysSinceLastWeight: 2, messageCode: "x" } });
        expect(sources(buildDemoCoachTodo([bout({ status: "FIGHT_WEEK", ...reminder("YESTERDAY_MISSING") })], NOW))).toEqual(["WEIGHT_NOT_LOGGED"]);
        expect(sources(buildDemoCoachTodo([bout({ status: "FIGHT_WEEK", ...reminder("ASK_TODAY") })], NOW))).toEqual([]);
    });

    it("ignores finished and deleted bouts", () => {
        const noisy = { canEnterFightWeek: true, boutAt: "2026-10-01T03:00:00.000Z" };
        expect(buildDemoCoachTodo([bout({ ...noisy, status: "COMPLETED" }), bout({ ...noisy, status: "CANCELLED" }), bout({ ...noisy, deletedAt: NOW })], NOW)).toEqual([]);
    });
});
