import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BoutOutcome, CompetitionRuleset } from "@/lib/domain/bout";
import { boutGate1, canEnterFightWeek, requirementsOverdue } from "@/lib/domain/bout-rules";
import { liveSuspensions } from "@/lib/domain/fighter-suspension-view";
import { nutritionPhaseFor } from "@/lib/domain/nutrition";
import type { TrainingPlan, User } from "@/lib/domain/types";
import { academyWallClockToIso, addDaysToKey, dayKey } from "@/lib/format";
import { db } from "@/lib/mocks/db";
import { mockUsers } from "@/lib/mocks/people";
import { VMMAF_2021_ID, AIBA_REFERENCE_ID } from "@/lib/mocks/rulesets";
import { TODAY_KEY } from "@/lib/mocks/time";

import {
    addDemoRequirement,
    cancelDemoBout,
    clearDemoSuspension,
    createDemoBout,
    createDemoSuspension,
    demoBlockingSuspensions,
    demoCampStore,
    demoCheckinsFor,
    demoKnockoutHistory,
    demoWeightTrack,
    enterDemoFightWeek,
    getDemoBout,
    getCoachTodo,
    getFeasibility,
    getDemoCurrentBout,
    linkDemoCamp,
    listDemoBouts,
    listDemoSuspensions,
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
import { clearSuspension, listSuspensions } from "./suspensions.demo";

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

/** Rafael as the suspensions store checks him: a coach with the fighters these tests use on his roster. */
const RAFAEL_USER: User = {
    ...mockUsers.find((user) => user.id === "u-rafael-costa")!,
    effectiveCapabilities: ["fighters:read"],
    assignmentScope: { fighterIds: ["f-diego-alvarez", "f-linh-pham", "f-marcus-hale", "f-minh-tran"] },
};

/** Starts the suspensions store (`db()`) again from its seed, which is anchored on the real academy day. */
function resetSuspensionsStore() {
    delete (globalThis as Record<string, unknown>).__mmaMockDb;
}

const outcome = (overrides: Partial<BoutOutcome>): BoutOutcome => ({
    result: "LOSS",
    method: "KO",
    round: 2,
    knockedDown: true,
    lossOfConsciousness: "UNDER_1_MIN",
    stoppedByHeadStrikes: null,
    injuryNote: null,
    notes: null,
    recordedAt: new Date().toISOString(),
    ...overrides,
});

describe("suspensions and Gate 2 read the one suspensions store (T-007, T-030)", () => {
    beforeEach(resetSuspensionsStore);

    it("blocks the session types a suspension names, and only while it is in force", () => {
        resetDemoCampStore(TODAY);
        const on = (offset: number) => addDaysToKey(TODAY_KEY, offset);
        // Marcus: the sample KO from ten days ago, 30 days, every type but recovery.
        expect(demoBlockingSuspensions("f-marcus-hale", "sparring", TODAY_KEY).map((item) => item.id)).toEqual(["susp-active-ko"]);
        expect(demoBlockingSuspensions("f-marcus-hale", "recovery_mobility", TODAY_KEY)).toEqual([]);
        expect(demoBlockingSuspensions("f-marcus-hale", "sparring", on(-11))).toEqual([]);
        // A knockout suspension waits for clearance after its last day.
        expect(demoBlockingSuspensions("f-marcus-hale", "sparring", on(40)).map((item) => item.id)).toEqual(["susp-active-ko"]);
    });

    it("saves a suspension confirmed on the bout page as POST /suspensions would, and only one per bout", () => {
        resetDemoCampStore(TODAY);
        const rules = demoCampStore().rulesets.find((item) => item.id === AIBA_REFERENCE_ID)!;
        const draft = {
            reason: "KO" as const,
            startsOn: TODAY,
            endsOn: day(90),
            suggestedDays: 90,
            overrideReason: null,
            blockedSessionTypes: rules.defaultBlockedSessionTypes,
            requiresClearance: false,
            note: null,
        };
        expect(createDemoSuspension("f-linh-pham", "b-linh-saigon", draft, RAFAEL, NOW)).toEqual({ ok: true });
        const saved = db().suspensions.filter((item) => item.boutId === "b-linh-saigon");
        // 90 days with the start as day 1; a KO always needs clearance; AIBA blocks everything but recovery.
        expect(saved).toEqual([
            expect.objectContaining({ reason: "KO", startsOn: TODAY, endsOn: day(89), requiresClearance: true, maxAllowedTier: 1, issuedBy: "CLUB" }),
        ]);
        expect(demoBlockingSuspensions("f-linh-pham", "pad_work", day(1))).toHaveLength(1);
        expect(demoBlockingSuspensions("f-linh-pham", "recovery_mobility", day(1))).toEqual([]);
        expect(createDemoSuspension("f-linh-pham", "b-linh-saigon", draft, RAFAEL, NOW)).toEqual({ ok: false, message: "This bout already has a suspension." });
        expect(db().suspensions.filter((item) => item.boutId === "b-linh-saigon")).toHaveLength(1);
    });

    it("clears only once the suspension awaits clearance (T-049), and then stops blocking", async () => {
        resetDemoCampStore(TODAY);
        expect(await clearDemoSuspension("susp-active-ko", "Neurologist cleared, CT normal", RAFAEL_USER)).toEqual({
            ok: false,
            message: "The suspension can only be cleared while it is awaiting clearance.",
        });
        expect(demoBlockingSuspensions("f-diego-alvarez", "sparring", TODAY_KEY).map((item) => item.id)).toEqual(["susp-awaiting-clearance"]);
        expect(await clearDemoSuspension("susp-awaiting-clearance", "Neurologist cleared, CT normal", RAFAEL_USER)).toEqual({ ok: true });
        expect(demoBlockingSuspensions("f-diego-alvarez", "sparring", TODAY_KEY)).toEqual([]);
    });

    it("warns when a new bout falls inside a suspension", () => {
        resetDemoCampStore(TODAY_KEY);
        const at = (offset: number, time: string) => academyWallClockToIso(addDaysToKey(TODAY_KEY, offset), time);
        const marcus = minhBout({ fighterId: "f-marcus-hale", fighterName: "Marcus Hale", weighInAt: at(2, "10:00"), boutAt: at(3, "19:00") });
        expect(createDemoBout(marcus, RAFAEL, new Date())).toMatchObject({ ok: true, warning: expect.stringContaining("Marcus Hale is suspended") });
        expect(createDemoBout(minhBout({ weighInAt: at(2, "10:00"), boutAt: at(3, "19:00") }), RAFAEL, new Date())).toMatchObject({ ok: true, warning: null });
    });
});

describe("a bout's result saves its suspensions where the API would (R27)", () => {
    // On the real clock: the suspensions store's seed is anchored on today, and the seeded bouts fight today.
    let now: Date;
    let today: string;
    beforeEach(() => {
        resetSuspensionsStore();
        now = new Date();
        today = dayKey(now);
        resetDemoCampStore(today);
    });
    const coach = { id: "u-rafael-costa", name: "Rafael Costa" };
    const weighInLinh = () => recordDemoWeighIn("b-linh-saigon", { weightKg: 59.8, hydrationCheck: null, decision: null, catchweightKg: null, note: null }, coach, now);
    const boutRows = (boutId: string) => db().suspensions.filter((item) => item.boutId === boutId);

    it("saves a KO loss's suspension with the coach's days when the ruleset suggests none, with the T-030 fields", async () => {
        expect(recordDemoResult("bout-weighed-in", outcome({}), coach, now, 30)).toEqual({ ok: true });
        const [ko, ...others] = boutRows("bout-weighed-in");
        expect(others).toEqual([]);
        expect(ko).toMatchObject({
            fighterId: "f-diego-alvarez",
            reason: "KO",
            startsOn: today,
            endsOn: addDaysToKey(today, 29),
            lossOfConsciousness: "UNDER_1_MIN",
            suggestedDays: null,
            overrideReason: null,
            // VMMAF 2021 blocks sparring and grappling: tiers 1 to 3 stay open.
            blockedSessionTypes: ["SPARRING", "GRAPPLING"],
            maxAllowedTier: 3,
            requiresClearance: true,
            clearedAt: null,
            createdById: "u-rafael-costa",
            status: "ACTIVE",
            gradedReturn: null,
            issuedBy: "CLUB",
            issuerReference: null,
        });

        // The Suspensions page and the fighter's card read it, 30 days, active.
        const listed = (await listSuspensions({ fighterId: "f-diego-alvarez" }, RAFAEL_USER)).find((item) => item.id === ko.id);
        expect(listed).toMatchObject({ status: "ACTIVE", startsOn: today, endsOn: addDaysToKey(today, 29) });
        expect(liveSuspensions(await listSuspensions({ fighterId: "f-diego-alvarez" }, RAFAEL_USER)).map((item) => item.id)).toContain(ko.id);
        // The bout page reads the same row, under the same id.
        expect(listDemoSuspensions(["f-diego-alvarez"]).filter((item) => item.boutId === "bout-weighed-in")).toEqual([
            expect.objectContaining({ id: ko.id, reason: "KO", days: 30, blockedSessionTypes: ["sparring", "grappling"], requiresClearance: true, createdBy: "Rafael Costa" }),
        ]);
        // Gate 2 and the next suggestion see it.
        expect(demoBlockingSuspensions("f-diego-alvarez", "grappling", today).map((item) => item.id)).toContain(ko.id);
        expect(demoKnockoutHistory("f-diego-alvarez")).toContain(today);
    });

    it("refuses like the service when the days are missing or differ from the suggestion, and saves nothing", () => {
        // VMMAF 2021 suggests no length for a KO.
        expect(recordDemoResult("bout-weighed-in", outcome({}), coach, now, null)).toEqual({
            ok: false,
            message: "This bout's ruleset suggests no suspension length. Enter the days the event rules set, then save again.",
            fieldErrors: { suspensionDays: expect.any(String) },
        });
        expect(getDemoBout("bout-weighed-in")?.phase).toBe("WEIGHED_IN");
        expect(boutRows("bout-weighed-in")).toEqual([]);

        // AIBA: Linh's KO five weeks ago makes this one her second within 90 days, so 90 days.
        weighInLinh();
        const second = outcome({ lossOfConsciousness: "NONE" });
        expect(recordDemoResult("b-linh-saigon", second, coach, now, 30)).toMatchObject({
            ok: false,
            message: "This bout's ruleset suggests 90 days of suspension. Leave the days empty to use them, or enter 90.",
        });
        expect(boutRows("b-linh-saigon")).toEqual([]);
        expect(recordDemoResult("b-linh-saigon", second, coach, now, null)).toEqual({ ok: true });
        expect(boutRows("b-linh-saigon")).toEqual([expect.objectContaining({ reason: "KO", suggestedDays: 90, endsOn: addDaysToKey(today, 89), maxAllowedTier: 1 })]);
    });

    it("saves a head-strike TKO, but nothing for a TKO without head strikes or a win", () => {
        expect(recordDemoResult("bout-weighed-in", outcome({ method: "TKO", lossOfConsciousness: null, stoppedByHeadStrikes: false }), coach, now, null)).toEqual({ ok: true });
        expect(boutRows("bout-weighed-in")).toEqual([]);

        weighInLinh();
        expect(recordDemoResult("b-linh-saigon", outcome({ method: "TKO", lossOfConsciousness: null, stoppedByHeadStrikes: true }), coach, now, null)).toEqual({ ok: true });
        expect(boutRows("b-linh-saigon")).toEqual([expect.objectContaining({ reason: "TKO", requiresClearance: true })]);
    });

    it("cancels the fighter's scheduled sessions it blocks and moves her fight-camp plan to rehab (R28)", () => {
        const template = db().trainingSessions.find((item) => item.fighterId === "f-linh-pham")!;
        const tomorrow = academyWallClockToIso(addDaysToKey(today, 1), "17:00");
        db().trainingSessions.push(
            { ...template, id: "ts-r28-sparring", type: "sparring", status: "scheduled", scheduledAt: tomorrow },
            { ...template, id: "ts-r28-recovery", type: "recovery_mobility", status: "scheduled", scheduledAt: tomorrow },
        );
        const plan = db().trainingPlans.find((item) => item.fighterId === "f-linh-pham")!;
        db().trainingPlans.push({ ...plan, id: "tp-r28-camp", phase: "fight_camp", status: "active" });

        weighInLinh();
        expect(recordDemoResult("b-linh-saigon", outcome({ lossOfConsciousness: "NONE" }), coach, now, null)).toEqual({ ok: true });
        const session = (id: string) => db().trainingSessions.find((item) => item.id === id);
        expect(session("ts-r28-sparring")?.status).toBe("cancelled");
        expect(session("ts-r28-recovery")?.status).toBe("scheduled");
        expect(db().trainingPlans.find((item) => item.id === "tp-r28-camp")?.phase).toBe("rehab");
    });

    it("saves the ruleset's mandatory rest after any bout, beside the knockout's suspension", () => {
        demoCampStore().rulesets.find((item) => item.id === VMMAF_2021_ID)!.restDaysAfterBout = 7;
        expect(recordDemoResult("bout-weighed-in", outcome({ method: "KO" }), coach, now, 30)).toEqual({ ok: true });
        expect(boutRows("bout-weighed-in").map((item) => [item.reason, item.startsOn, item.endsOn, item.requiresClearance])).toEqual([
            ["KO", today, addDaysToKey(today, 29), true],
            ["MANDATORY_REST", today, addDaysToKey(today, 6), false],
        ]);

        weighInLinh();
        demoCampStore().rulesets.find((item) => item.id === AIBA_REFERENCE_ID)!.restDaysAfterBout = 7;
        expect(recordDemoResult("b-linh-saigon", outcome({ result: "WIN", method: "DECISION", round: null, knockedDown: false, lossOfConsciousness: null }), coach, now, null)).toEqual({ ok: true });
        expect(boutRows("b-linh-saigon")).toEqual([expect.objectContaining({ reason: "MANDATORY_REST", suggestedDays: 7, requiresClearance: false, status: "ACTIVE" })]);
    });

    it("keeps one copy: no second suspension for the bout, and a clearance on the Suspensions page is seen by Gate 2", async () => {
        weighInLinh();
        expect(recordDemoResult("b-linh-saigon", outcome({ lossOfConsciousness: "NONE" }), coach, now, null)).toEqual({ ok: true });
        expect(recordDemoResult("b-linh-saigon", outcome({ lossOfConsciousness: "NONE" }), coach, now, null)).toMatchObject({ ok: false });
        const [ko] = boutRows("b-linh-saigon");
        const draft = { reason: "KO" as const, startsOn: today, endsOn: addDaysToKey(today, 90), suggestedDays: 90, overrideReason: null, blockedSessionTypes: ["sparring" as const], requiresClearance: true, note: null };
        expect(createDemoSuspension("f-linh-pham", "b-linh-saigon", draft, coach, now)).toMatchObject({ ok: false });
        expect(boutRows("b-linh-saigon")).toHaveLength(1);

        // Ninety days on, it awaits clearance and still blocks; cleared on the Suspensions page, it blocks nowhere.
        Object.assign(ko, { startsOn: addDaysToKey(today, -90), endsOn: addDaysToKey(today, -1) });
        expect(demoBlockingSuspensions("f-linh-pham", "sparring", today).map((item) => item.id)).toEqual([ko.id]);
        await clearSuspension(ko.id, "Neurologist cleared, CT normal", RAFAEL_USER);
        expect(demoBlockingSuspensions("f-linh-pham", "sparring", today)).toEqual([]);
        expect(listDemoSuspensions(["f-linh-pham"]).find((item) => item.id === ko.id)).toMatchObject({ clearedBy: "Rafael Costa", clearanceNote: "Neurologist cleared, CT normal" });
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
