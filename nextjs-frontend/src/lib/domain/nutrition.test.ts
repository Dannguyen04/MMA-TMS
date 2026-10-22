import { describe, expect, it } from "vitest";

import type { NutritionPlan } from "./bout";
import { adherenceAlertLine, nutritionPhaseFor, planForPhase, readPlanAnswer, RED_WEIGHT_RECOMMENDATION, savedWeightMessage, wayOffCount, weighInCountdown } from "./nutrition";

const plan: NutritionPlan = {
    camp: { text: "Camp meals", authorName: "Rafael Costa", updatedAt: "2026-10-01T01:00:00.000Z" },
    fightWeek: { text: "Fight week meals", authorName: "Rafael Costa", updatedAt: "2026-10-10T01:00:00.000Z" },
    postWeighIn: { text: "After the scale", authorName: "Minh's nutritionist", updatedAt: "2026-10-18T01:00:00.000Z" },
};

describe("nutrition phase", () => {
    it("shows the fight-week plan only during fight week", () => {
        expect(nutritionPhaseFor("FIGHT_WEEK")).toBe("fightWeek");
        expect(planForPhase(plan, "FIGHT_WEEK")?.text).toBe("Fight week meals");
    });

    it("shows camp before fight week and the post-weigh-in note after the scale", () => {
        expect(planForPhase(plan, "CAMP")?.text).toBe("Camp meals");
        expect(planForPhase(plan, "SCHEDULED")?.text).toBe("Camp meals");
        expect(planForPhase(plan, "WEIGHED_IN")?.text).toBe("After the scale");
        expect(planForPhase(plan, "COMPLETED")).toBeNull();
    });
});

describe("plan answer", () => {
    it("treats a blank answer as a skip", () => {
        expect(readPlanAnswer("", "")).toEqual({ ok: true, adherence: null, note: null });
    });

    it("keeps a chosen answer and an optional note", () => {
        expect(readPlanAnswer("WAY_OFF", "  Late dinner ")).toEqual({ ok: true, adherence: "WAY_OFF", note: "Late dinner" });
    });

    it("asks for an answer when a note is filled in on its own", () => {
        expect(readPlanAnswer("", "Late dinner").ok).toBe(false);
    });
});

describe("adherence count", () => {
    it("counts way-off answers in the last three academy days", () => {
        const count = wayOffCount(
            [
                { loggedOn: "2026-10-13", adherence: "WAY_OFF" },
                { loggedOn: "2026-10-14", adherence: "WAY_OFF" },
                { loggedOn: "2026-10-15", adherence: "WAY_OFF" },
                { loggedOn: "2026-10-16", adherence: "ON_PLAN" },
            ],
            "2026-10-16",
        );
        expect(count).toBe(2);
        expect(adherenceAlertLine(count)).toBe("Last 3 days: 2 way off.");
    });
});

describe("copy", () => {
    it("does not turn a red camp into a calorie, water, or sauna figure", () => {
        expect(RED_WEIGHT_RECOMMENDATION.toLowerCase()).not.toMatch(/calorie|sauna|\d+\s*ml|water cut/);
    });

    it("describes the days until weigh-in", () => {
        expect(weighInCountdown(2)).toBe("2 days to weigh-in");
        expect(weighInCountdown(0)).toBe("Weigh-in is today");
    });
});

describe("saved weight notice", () => {
    it("repeats the kilograms the action sent with one decimal, and the status in words", () => {
        expect(savedWeightMessage((66.5).toFixed(1), "RED")).toBe("Saved 66.5 kg. Status: Red");
        expect(savedWeightMessage((70).toFixed(1), undefined)).toBe("Saved 70.0 kg.");
    });

    it("does not invent a notice from a hand-edited query", () => {
        expect(savedWeightMessage("nope", "RED")).toBeNull();
        expect(savedWeightMessage("999", "RED")).toBeNull();
        expect(savedWeightMessage("66.55", "RED")).toBeNull();
        expect(savedWeightMessage("66.5", "BLUE")).toBe("Saved 66.5 kg.");
    });
});
