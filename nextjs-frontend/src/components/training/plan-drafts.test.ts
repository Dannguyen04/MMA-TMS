import { describe, expect, it } from "vitest";

import { planTemplate } from "@/lib/domain/training-templates";
import type { Exercise, PlanExercise, TrainingPlan } from "@/lib/domain/types";
import { draftFromLibrary, draftsFromPlanExercises, draftsFromTemplate, planCopyFrom, sentDrafts, serializePlanExerciseDrafts } from "./plan-drafts";

function exercise(id: string, name: string, overrides: Partial<Exercise> = {}): Exercise {
    return {
        id,
        name,
        category: "striking",
        description: "",
        techniques: [],
        intensity: null,
        equipment: [],
        defaultRounds: null,
        defaultRoundSec: null,
        defaultSets: null,
        defaultReps: null,
        loadsRegions: [],
        ...overrides,
    };
}

describe("plan exercise drafts", () => {
    const template = planTemplate("fight_week_taper")!;

    it("ticks template exercises the library has and lists the rest unticked, in template order", () => {
        const drafts = draftsFromTemplate(template, [exercise("ex-pads", "jab-cross-hook pad drill"), exercise("ex-hips", "Hip 90/90 mobility flow", { category: "mobility" })]);

        expect(drafts).toHaveLength(template.exercises.length);
        expect(drafts.filter((draft) => draft.included).map((draft) => [draft.name, draft.exerciseId])).toEqual([
            ["jab-cross-hook pad drill", "ex-pads"],
            ["Hip 90/90 mobility flow", "ex-hips"],
        ]);
        expect(drafts[0]).toMatchObject({ name: "Technical shadow boxing", exerciseId: null, included: false, categoryLabel: "Striking", sets: "3", durationMin: "9", targetRpe: "4" });
        expect(drafts.at(-1)).toMatchObject({ categoryLabel: "Mobility", durationMin: "10" });
    });

    it("sends only ticked rows that are in the library, with trimmed values", () => {
        const drafts = draftsFromTemplate(template, [exercise("ex-pads", "Jab–cross–hook pad drill")]);
        drafts[1] = { ...drafts[1], notes: "  Crisp  ", reps: " " };
        drafts.push({ ...drafts[1], key: "extra", included: false });

        expect(sentDrafts(drafts).map((draft) => draft.key)).toEqual([drafts[1].key]);
        expect(JSON.parse(serializePlanExerciseDrafts(drafts))).toEqual([{ exerciseId: "ex-pads", sets: "3", reps: "", durationMin: "9", targetRpe: "6", notes: "Crisp" }]);
    });

    it("starts a library exercise from its usual rounds or sets", () => {
        expect(draftFromLibrary(exercise("ex-bag", "Heavy bag", { defaultRounds: 5, defaultRoundSec: 180 }), "k1")).toMatchObject({ sets: "5", reps: "", durationMin: "15", included: true });
        expect(draftFromLibrary(exercise("ex-kb", "Kettlebell swings", { category: "strength", defaultSets: 4, defaultReps: 15 }), "k2")).toMatchObject({
            sets: "4",
            reps: "15",
            durationMin: "",
            categoryLabel: "Strength",
        });
    });

    it("copies a plan's exercises and leaves out ones the library lost", () => {
        const items = [
            { exerciseId: "ex-gone", sets: 3, reps: 10, durationSec: null, targetRpe: 5, notes: null },
            { exerciseId: "ex-bag", sets: null, reps: null, durationSec: 600, targetRpe: null, notes: "Power" },
        ];
        const drafts = draftsFromPlanExercises(items, [exercise("ex-bag", "Heavy bag")]);
        expect(drafts.map((draft) => [draft.exerciseId, draft.included])).toEqual([
            [null, false],
            ["ex-bag", true],
        ]);
        expect(drafts[1]).toMatchObject({ durationMin: "10", notes: "Power" });
    });
});

describe("planCopyFrom", () => {
    it("keeps the content and length, marks the title as a copy and orders the exercises", () => {
        const plan = {
            id: "plan-1",
            title: "Fight camp",
            phase: "fight_camp",
            objective: "Peak for fight night.",
            notes: "Weigh in daily.",
            // 1 to 28 September in the academy timezone: four whole weeks.
            startDate: "2026-08-31T17:00:00.000Z",
            endDate: "2026-09-28T16:59:00.000Z",
        } as TrainingPlan;
        const exercises = [
            { id: "b", planId: "plan-1", exerciseId: "ex-b", orderIndex: 2, sets: 3, reps: null, durationSec: null, targetRpe: null, notes: null },
            { id: "a", planId: "plan-1", exerciseId: "ex-a", orderIndex: 0, sets: null, reps: 5, durationSec: 60, targetRpe: 7, notes: "Fast" },
        ] satisfies PlanExercise[];

        expect(planCopyFrom(plan, exercises)).toEqual({
            planId: "plan-1",
            title: "Fight camp (copy)",
            phase: "fight_camp",
            objective: "Peak for fight night.",
            notes: "Weigh in daily.",
            days: 28,
            exercises: [
                { exerciseId: "ex-a", sets: null, reps: 5, durationSec: 60, targetRpe: 7, notes: "Fast" },
                { exerciseId: "ex-b", sets: 3, reps: null, durationSec: null, targetRpe: null, notes: null },
            ],
        });
        expect(planCopyFrom({ ...plan, endDate: null }, []).days).toBeNull();
    });
});
