import { describe, expect, it, vi } from "vitest";

import type { BoutOutcome, CompetitionRuleset } from "@/lib/domain/bout";
import { boutGate1, canEnterFightWeek, requirementsOverdue } from "@/lib/domain/bout-rules";
import { nutritionPhaseFor } from "@/lib/domain/nutrition";
import type { TrainingPlan } from "@/lib/domain/types";
import { academyWallClockToIso, addDaysToKey, dayKey } from "@/lib/format";
import { VMMAF_2021_ID, AIBA_REFERENCE_ID } from "@/lib/mocks/rulesets";

import {
    addDemoRequirement,
    cancelDemoBout,
    clearDemoSuspension,
    createDemoBout,
    createDemoSuspension,
    demoBlockingSuspensions,
    demoCampStore,
    demoCheckinsFor,
    demoWeightTrack,
    enterDemoFightWeek,
    getDemoBout,
    getCoachTodo,
    getFeasibility,
    getDemoCurrentBout,
    linkDemoCamp,
    listDemoBouts,
    listDemoWeightAlerts,
    recordDemoCheckin,
    recordDemoResult,
    recordDemoSelfWeight,
    recordDemoWeighIn,
    resetDemoCampStore,
    saveDemoNutritionPlan,
    updateDemoRequirement,
    type NewBout,
} from "./bouts.demo";

const TODAY = "2026-10-20";
const NOW = new Date("2026-10-20T01:00:00.000Z");
const RAFAEL = { name: "Rafael Costa" };
const day = (offset: number) => addDaysToKey(TODAY, offset);

function plan(overrides: Partial<TrainingPlan> = {}): TrainingPlan {
    return {
        id: "tp-minh-fight-camp",
        title: "Fight camp — Lotus Fight Night 18",
        fighterId: "f-minh-tran",
        coachId: "c-rafael-costa",
        objective: "",
        phase: "fight_camp",
        focusAreas: [],
        startDate: academyWallClockToIso(day(-28), "00:00"),
        endDate: academyWallClockToIso(day(41), "23:59"),
        weeklySessionTarget: 7,
        status: "active",
        notes: "",
        createdAt: academyWallClockToIso(day(-32), "14:20"),
        updatedAt: academyWallClockToIso(day(-3), "16:45"),
        ...overrides,
    };
}

/** The live demo: Lotus Fight Night 18 for Minh, VMMAF 60 kg, weigh-in in two days, bout the day after. */
function minhBout(overrides: Partial<NewBout> = {}): NewBout {
    return {
        fighterId: "f-minh-tran",
        fighterName: "Minh Trần",
        rulesetId: VMMAF_2021_ID,
        event: "Lotus Fight Night 18",
        venue: null,
        opponent: "Arman Petrosyan",
        weightClass: { code: "60", label: "60 kg", limitKg: 60 },
        weighInAt: academyWallClockToIso(day(2), "10:00"),
        boutAt: academyWallClockToIso(day(3), "19:00"),
        coachId: "c-rafael-costa",
        ...overrides,
    };
}

function created(result: ReturnType<typeof createDemoBout>): string {
    if (!result.ok) throw new Error(result.message);
    return result.boutId;
}

describe("demo camp seed", () => {
    it("seeds a red, a yellow and a grey bout on the coach's roster, and no bout for Minh", () => {
        resetDemoCampStore(TODAY);
        expect(demoWeightTrack("b-kenji-pacific", NOW)?.status).toBe("OVER_LIMIT");
        expect(demoWeightTrack("b-kenji-pacific", NOW)?.remainingPct).toBe(10.8);
        expect(demoWeightTrack("b-aigerim-asian", NOW)?.status).toBe("ABOVE_TARGET");
        expect(demoWeightTrack("b-emma-nordic", NOW)?.status).toBe("NOT_WEIGHED");
        expect(demoWeightTrack("b-linh-saigon", NOW)?.status).toBe("ON_TRACK");
        expect(getDemoCurrentBout("f-minh-tran")).toBeNull();

        const alerts = listDemoWeightAlerts("all", NOW);
        expect(alerts.map((alert) => [alert.bout.id, alert.track.status])).toEqual([
            ["b-kenji-pacific", "OVER_LIMIT"],
            ["b-aigerim-asian", "ABOVE_TARGET"],
            ["b-emma-nordic", "NOT_WEIGHED"],
        ]);
        expect(alerts[0]?.wayOff).toBe(2);
    });

    it("covers T-004 criterion 1: one bout ready for fight week, one blocked by a missing document", () => {
        resetDemoCampStore(TODAY);
        const kenji = getDemoBout("b-kenji-pacific")!;
        const emma = getDemoBout("b-emma-nordic")!;
        expect(canEnterFightWeek(kenji, TODAY)).toEqual({ ok: true });
        expect(boutGate1(emma).missing.map((gap) => [gap.requirement.label, gap.reason])).toEqual([["Chụp CT não", "MISSING"]]);
        expect(canEnterFightWeek(emma, TODAY)).toMatchObject({ ok: false, reason: "REQUIREMENTS_INCOMPLETE" });
        expect(requirementsOverdue(emma, TODAY)).toBe(true);
        // Aigerim's only missing item is optional, so Gate 1 passes; fight week just isn't open yet.
        const aigerim = getDemoBout("b-aigerim-asian")!;
        expect(boutGate1(aigerim).passed).toBe(true);
        expect(canEnterFightWeek(aigerim, TODAY)).toMatchObject({ ok: false, reason: "TOO_EARLY" });
    });

    it("keeps every provided document with a valid-until date", () => {
        resetDemoCampStore(TODAY);
        const ready = listDemoBouts().flatMap((bout) => bout.requirements).filter((item) => item.state === "PROVIDED" || item.state === "CONFIRMED");
        expect(ready.length).toBeGreaterThan(0);
        expect(ready.every((item) => item.validUntil !== null)).toBe(true);
    });
});

describe("daily weight and plan answers", () => {
    it("keeps each seeded bout's meal plan to itself", () => {
        resetDemoCampStore(TODAY);
        expect(saveDemoNutritionPlan("b-emma-nordic", { camp: "Fish and rice", fightWeek: "", postWeighIn: "" }, "Rafael Costa", NOW)).toEqual({ ok: true });
        expect(getDemoBout("b-aigerim-asian")?.nutritionPlan.camp).toBeNull();
        resetDemoCampStore(TODAY);
        expect(getDemoBout("b-emma-nordic")?.nutritionPlan.camp).toBeNull();
    });

    it("keeps one weight per academy day and lets a later save replace it", () => {
        resetDemoCampStore(TODAY);
        recordDemoSelfWeight("f-kenji-morita", 63, NOW);
        recordDemoSelfWeight("f-kenji-morita", 62.5, NOW);
        const todayPoints = demoWeightTrack("b-kenji-pacific", NOW)?.points.filter((point) => point.date === TODAY) ?? [];
        expect(todayPoints).toEqual([expect.objectContaining({ date: TODAY, kg: 62.5 })]);
    });

    it("replaces yesterday's plan answer when the fighter answers again today", () => {
        resetDemoCampStore(TODAY);
        expect(recordDemoCheckin("f-kenji-morita", "WAY_OFF", "Late dinner", NOW)).toEqual({ ok: true });
        expect(recordDemoCheckin("f-kenji-morita", "ON_PLAN", null, NOW)).toEqual({ ok: true });
        const yesterday = demoCheckinsFor("b-kenji-pacific").filter((item) => item.academyDate === day(-1));
        expect(yesterday).toHaveLength(1);
        expect(yesterday[0]).toMatchObject({ adherence: "ON_PLAN", note: null, loggedOn: dayKey(NOW) });
    });
});

describe("the review 2 flow", () => {
    it("creates a scheduled bout with the ruleset's checklist and thresholds", () => {
        resetDemoCampStore(TODAY);
        const id = created(createDemoBout(minhBout(), RAFAEL, NOW));
        const bout = getDemoBout(id)!;
        expect(bout).toMatchObject({ phase: "SCHEDULED", acuteLossLimitPct: 8, requirementsDueDays: 7, fightWeekDays: 7, campStartedOn: TODAY, rulesetVerified: true });
        expect(bout.requirements).toEqual([]);
        expect(bout.history).toEqual([expect.objectContaining({ from: null, to: "SCHEDULED", by: "Rafael Costa" })]);
        expect(getDemoCurrentBout("f-minh-tran")?.id).toBe(id);
    });

    it("starts the checklist from a ruleset's templates, every item missing", () => {
        resetDemoCampStore(TODAY);
        const withTemplates: CompetitionRuleset = {
            ...demoCampStore().rulesets[0],
            id: "rs-test",
            requirementTemplates: [
                { code: "HEALTH_CERT", label: "Health certificate", required: true, validityDays: 180 },
                { code: "BLOOD_TEST", label: "Blood test", required: true, validityDays: 90 },
                { code: "EYE_EXAM", label: "Eye exam", required: false, validityDays: null },
            ],
        };
        demoCampStore().rulesets.push(withTemplates);
        const bout = getDemoBout(created(createDemoBout(minhBout({ rulesetId: "rs-test" }), RAFAEL, NOW)))!;
        expect(bout.requirements.map((item) => [item.code, item.state, item.source])).toEqual([
            ["HEALTH_CERT", "MISSING", "PRESET"],
            ["BLOOD_TEST", "MISSING", "PRESET"],
            ["EYE_EXAM", "MISSING", "PRESET"],
        ]);
    });

    it("links only the fighter's own fight-camp plan, and starts the weight chart on the plan's first day", () => {
        resetDemoCampStore(TODAY);
        const id = created(createDemoBout(minhBout(), RAFAEL, NOW));
        expect(demoWeightTrack(id, NOW)?.points).toEqual([]);

        expect(linkDemoCamp(id, plan({ fighterId: "f-kenji-morita" }), RAFAEL, NOW)).toMatchObject({ ok: false, fieldErrors: { trainingPlanId: "That plan belongs to another fighter." } });
        expect(linkDemoCamp(id, plan({ phase: "build" }), RAFAEL, NOW)).toMatchObject({ ok: false, fieldErrors: { trainingPlanId: "Choose a plan in the fight-camp phase." } });
        expect(getDemoBout(id)?.phase).toBe("SCHEDULED");

        expect(linkDemoCamp(id, plan(), RAFAEL, NOW)).toEqual({ ok: true });
        const bout = getDemoBout(id)!;
        expect(bout).toMatchObject({ phase: "CAMP", trainingPlanId: "tp-minh-fight-camp", campStartedOn: day(-28) });
        const track = demoWeightTrack(id, NOW)!;
        expect(track.points[0]?.date).toBe(day(-28));
        expect(track.latestOn).toBe(day(-4));
        expect(track.status).toBe("NOT_WEIGHED");

        recordDemoSelfWeight("f-minh-tran", 66.5, NOW);
        expect(demoWeightTrack(id, NOW)).toMatchObject({ status: "OVER_LIMIT", latestKg: 66.5, remainingPct: 9.8 });
    });

    it("allows one bout in camp per fighter", () => {
        resetDemoCampStore(TODAY);
        const id = created(createDemoBout(minhBout({ fighterId: "f-kenji-morita", fighterName: "Kenji Morita" }), RAFAEL, NOW));
        const result = linkDemoCamp(id, plan({ id: "tp-kenji-fight-camp", fighterId: "f-kenji-morita" }), RAFAEL, NOW);
        expect(result).toMatchObject({ ok: false });
        expect(result.ok ? "" : result.message).toContain("Pacific Invitational 4");
        expect(getDemoBout(id)?.phase).toBe("SCHEDULED");
    });

    it("blocks fight week while Brain CT is missing, then lets the bout in once it is provided", () => {
        resetDemoCampStore(TODAY);
        const id = created(createDemoBout(minhBout(), RAFAEL, NOW));
        linkDemoCamp(id, plan(), RAFAEL, NOW);
        for (const label of ["Health certificate", "Blood test", "Brain CT"]) {
            expect(addDemoRequirement(id, { label, required: true, validityDays: 180 })).toEqual({ ok: true });
        }
        const valid = { issuedOn: day(-10), validUntil: day(170), statusReason: null };
        updateDemoRequirement(id, "HEALTH_CERTIFICATE", { state: "PROVIDED", ...valid });
        updateDemoRequirement(id, "BLOOD_TEST", { state: "PROVIDED", ...valid });
        expect(getDemoBout(id)?.requirements.every((item) => item.source === "COACH")).toBe(true);

        expect(enterDemoFightWeek(id, RAFAEL, NOW)).toEqual({ ok: false, message: "Gate 1 is not met. The bout stays in camp.", lines: ["Brain CT: missing"] });
        expect(getDemoBout(id)?.phase).toBe("CAMP");

        // Provided, but valid only until the day before the bout: still blocked.
        updateDemoRequirement(id, "BRAIN_CT", { state: "PROVIDED", issuedOn: day(-30), validUntil: day(2), statusReason: null });
        expect(enterDemoFightWeek(id, RAFAEL, NOW)).toMatchObject({ ok: false, lines: ["Brain CT: expires before the bout"] });

        updateDemoRequirement(id, "BRAIN_CT", { state: "PROVIDED", ...valid });
        expect(enterDemoFightWeek(id, RAFAEL, NOW)).toEqual({ ok: true });
        const bout = getDemoBout(id)!;
        expect(bout.phase).toBe("FIGHT_WEEK");
        expect(nutritionPhaseFor(bout.phase)).toBe("fightWeek");
        expect(bout.history.at(-1)).toMatchObject({ from: "CAMP", to: "FIGHT_WEEK", by: "Rafael Costa" });
        // Fight week locks the checklist.
        expect(addDemoRequirement(id, { label: "Eye exam", required: false, validityDays: null })).toMatchObject({ ok: false });
    });

    it("records a cancellation in the history and frees the fighter", () => {
        resetDemoCampStore(TODAY);
        expect(cancelDemoBout("b-emma-nordic", "OPPONENT_WITHDREW", null, RAFAEL, NOW)).toEqual({ ok: true });
        const bout = getDemoBout("b-emma-nordic")!;
        expect(bout).toMatchObject({ phase: "CANCELLED", cancelReason: "OPPONENT_WITHDREW" });
        expect(bout.history.at(-1)).toMatchObject({ from: "CAMP", to: "CANCELLED", reason: "Opponent withdrew" });
        expect(getDemoCurrentBout("f-emma-lindqvist")).toBeNull();
        expect(cancelDemoBout("b-emma-nordic", "OTHER", "again", RAFAEL, NOW)).toMatchObject({ ok: false });
    });
});

describe("official weigh-in and result (T-006)", () => {
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

    it("moves to weighed in when the fighter makes weight, and saves the scale as today's weight", () => {
        resetDemoCampStore(TODAY);
        expect(recordDemoWeighIn("b-linh-saigon", { weightKg: 59.8, hydrationCheck: "PASSED", decision: null, catchweightKg: null, note: null }, RAFAEL, NOW)).toEqual({ ok: true });
        const bout = getDemoBout("b-linh-saigon")!;
        expect(bout.phase).toBe("WEIGHED_IN");
        expect(bout.weighIn).toMatchObject({ weightKg: 59.8, madeWeight: true, hydrationCheck: "PASSED" });
        expect(demoWeightTrack("b-linh-saigon", NOW)?.latestKg).toBe(59.8);
    });

    it("asks what happens after a miss: a catchweight, or a cancellation", () => {
        resetDemoCampStore(TODAY);
        const miss = { weightKg: 60.6, hydrationCheck: null, catchweightKg: null, note: null };
        expect(recordDemoWeighIn("b-linh-saigon", { ...miss, decision: null }, RAFAEL, NOW)).toMatchObject({ ok: false, fieldErrors: { decision: expect.any(String) } });
        expect(recordDemoWeighIn("b-linh-saigon", { ...miss, decision: "CATCHWEIGHT", catchweightKg: 61, note: "20% purse" }, RAFAEL, NOW)).toEqual({ ok: true });
        expect(getDemoBout("b-linh-saigon")).toMatchObject({ phase: "WEIGHED_IN", catchweightKg: 61 });

        resetDemoCampStore(TODAY);
        expect(recordDemoWeighIn("b-linh-saigon", { ...miss, decision: "CANCEL" }, RAFAEL, NOW)).toEqual({ ok: true });
        expect(getDemoBout("b-linh-saigon")).toMatchObject({ phase: "CANCELLED", cancelReason: "MISSED_WEIGHT" });
    });

    it("treats a failed hydration check as a miss, and keeps the scale's verdict (R17)", () => {
        resetDemoCampStore(TODAY);
        const dry = { weightKg: 59.8, hydrationCheck: "FAILED" as const, catchweightKg: null, note: null };
        expect(recordDemoWeighIn("b-linh-saigon", { ...dry, decision: null }, RAFAEL, NOW)).toMatchObject({ ok: false, fieldErrors: { decision: expect.any(String) } });
        expect(recordDemoWeighIn("b-linh-saigon", { ...dry, decision: "CANCEL" }, RAFAEL, NOW)).toEqual({ ok: true });
        expect(getDemoBout("b-linh-saigon")).toMatchObject({ phase: "CANCELLED", weighIn: { madeWeight: true, hydrationCheck: "FAILED" } });
    });

    it("keeps the acute loss from the daily weights before the official one (R19)", () => {
        resetDemoCampStore(TODAY);
        const before = getDemoBout("b-linh-saigon")!;
        recordDemoWeighIn("b-linh-saigon", { weightKg: 59.8, hydrationCheck: null, decision: null, catchweightKg: null, note: null }, RAFAEL, NOW);
        const loss = getDemoBout("b-linh-saigon")!.weighIn?.acuteLoss;
        expect(loss?.limitPct).toBe(before.acuteLossLimitPct);
        expect(loss?.startKg).not.toBe(59.8);
    });

    it("records the result from the bout day only", () => {
        resetDemoCampStore(TODAY);
        recordDemoWeighIn("b-linh-saigon", { weightKg: 59.8, hydrationCheck: null, decision: null, catchweightKg: null, note: null }, RAFAEL, NOW);
        expect(recordDemoResult("b-linh-saigon", koLoss, RAFAEL, new Date("2026-10-19T12:00:00.000Z"))).toMatchObject({ ok: false });
        expect(recordDemoResult("b-linh-saigon", koLoss, RAFAEL, NOW)).toEqual({ ok: true });
        expect(getDemoBout("b-linh-saigon")).toMatchObject({ phase: "COMPLETED", outcome: { result: "LOSS", method: "KO" } });
    });
});

describe("suspensions and Gate 2 (T-007)", () => {
    it("blocks the session types a suspension names, and only while it is active", () => {
        resetDemoCampStore(TODAY);
        expect(demoBlockingSuspensions("f-diego-alvarez", "sparring", TODAY)).toHaveLength(1);
        expect(demoBlockingSuspensions("f-diego-alvarez", "pad_work", TODAY)).toEqual([]);
        expect(demoBlockingSuspensions("f-diego-alvarez", "sparring", day(-7))).toEqual([]);
        // A knockout suspension waits for clearance after its last day.
        expect(demoBlockingSuspensions("f-diego-alvarez", "sparring", day(40))).toHaveLength(1);
    });

    it("saves a suspension after a knockout loss and blocks everything but recovery under AIBA", () => {
        resetDemoCampStore(TODAY);
        const rules = demoCampStore().rulesets.find((item) => item.id === AIBA_REFERENCE_ID)!;
        expect(
            createDemoSuspension(
                "f-linh-pham",
                "b-linh-saigon",
                {
                    reason: "KO",
                    startsOn: TODAY,
                    endsOn: day(90),
                    suggestedDays: 90,
                    overrideReason: null,
                    blockedSessionTypes: rules.defaultBlockedSessionTypes,
                    requiresClearance: true,
                    note: null,
                },
                RAFAEL,
                NOW,
            ),
        ).toEqual({ ok: true });
        expect(demoBlockingSuspensions("f-linh-pham", "pad_work", day(1))).toHaveLength(1);
        expect(demoBlockingSuspensions("f-linh-pham", "recovery_mobility", day(1))).toEqual([]);
    });

    it("clears a fighter before the last day without changing the end date", () => {
        resetDemoCampStore(TODAY);
        const end = demoCampStore().suspensions.find(item => item.id === "sus-diego-sparring")!.endsOn;
        expect(clearDemoSuspension("sus-diego-sparring", "Neurologist cleared, CT normal", RAFAEL, NOW)).toEqual({ ok: true });
        expect(demoCampStore().suspensions.find(item => item.id === "sus-diego-sparring")!.endsOn).toBe(end);
        expect(demoBlockingSuspensions("f-diego-alvarez", "sparring", TODAY)).toEqual([]);
        resetDemoCampStore(TODAY);
        const after = new Date(`${day(25)}T03:00:00.000Z`);
        expect(clearDemoSuspension("sus-diego-sparring", "Neurologist cleared, CT normal", RAFAEL, after)).toEqual({ ok: true });
        expect(demoBlockingSuspensions("f-diego-alvarez", "sparring", day(25))).toEqual([]);
    });
});


describe("T-029 reads from the lifecycle demo store", () => {
    it("stops cut warnings after official weigh-in and refreshes the coach task list", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
        try {
            resetDemoCampStore(TODAY);
            expect((await getCoachTodo(["f-linh-pham"])).items.some(item => item.source === "WEIGH_IN_TODAY")).toBe(true);
            expect(recordDemoWeighIn("b-linh-saigon", { weightKg: 55, hydrationCheck: "PASSED", decision: null, catchweightKg: null, note: null }, RAFAEL, NOW)).toMatchObject({ ok: true });
            expect(demoWeightTrack("b-linh-saigon", NOW)).toMatchObject({ latestKg: 55, status: "NEUTRAL" });
            expect((await getCoachTodo(["f-linh-pham"])).items.some(item => item.source === "WEIGH_IN_TODAY" || item.source === "WEIGHT_OVER_LIMIT")).toBe(false);
        } finally { vi.useRealTimers(); }
    });
    it("previews feasibility from the same self-reported measurements", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
        try {
            resetDemoCampStore(TODAY);
            const bout = getDemoBout("b-kenji-pacific")!;
            const input = { fighterId: bout.fighterId, rulesetId: bout.rulesetId, weightClassCode: bout.weightClassCode, weightLimitKg: bout.limitKg!, weighInAt: bout.weighInAt, boutAt: bout.boutAt };
            expect(await getFeasibility(input)).toMatchObject({ status: "OVER_LIMIT" });
            recordDemoSelfWeight(bout.fighterId, 55, NOW);
            expect(await getFeasibility(input)).toMatchObject({ latestKg: 55, status: "ON_TRACK", warnings: [] });
        } finally { vi.useRealTimers(); }
    });
});
