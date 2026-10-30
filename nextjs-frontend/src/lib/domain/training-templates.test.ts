import { describe, expect, it } from "vitest";

import { createTranslator } from "@/lib/i18n/translate";

import { TRAINING_PHASE_LABELS } from "./labels";
import { exerciseNameKey, SERVICE_EXERCISE_CATEGORIES, SERVICE_TRAINING_TYPES } from "./training-contract";
import {
    copyTitle,
    missingStarterExercises,
    nextWeeklySlot,
    PHASE_OBJECTIVE_SUGGESTIONS,
    PLAN_TEMPLATES,
    planEndKey,
    planSpanDays,
    planTemplate,
    planWholeWeeks,
    presetDuration,
    resolvePlanTemplate,
    SESSION_PRESETS,
    STARTER_EXERCISES,
    suggestedSessionTitle,
    weeklyDates,
} from "./training-templates";

/*
 * Limits a template must respect: the training service's DTOs (`training.model.ts`) and, where the coach's form is
 * stricter, the plan and plan-exercise actions (`lib/actions/training.ts`), so a template never fills in a value the
 * form would then refuse.
 */
const PLAN = { titleMin: 3, titleMax: 120, objectiveMin: 10, objectiveMax: 600, notesMax: 1000 };
const EXERCISE = { setsMax: 20, repsMax: 200, minutesMax: 240, rpeMin: 1, rpeMax: 10, notesMax: 500 };
const LIBRARY = { nameMax: 255, descriptionMax: 1000 };
const SESSION = { minutesMin: 10, minutesMax: 300, notesMax: 1000 };

const isWhole = (value: number) => Number.isInteger(value) && value > 0;

describe("plan templates", () => {
    it("covers the five starting points with unique ids and real phases", () => {
        expect(PLAN_TEMPLATES.map((template) => template.id)).toEqual(["boxing_fundamentals", "muay_thai_conditioning", "fight_camp", "fight_week_taper", "return_from_rehab"]);
        expect(PLAN_TEMPLATES.map((template) => [template.phase, template.weeks])).toEqual([
            ["build", 4],
            ["base", 6],
            ["fight_camp", 8],
            ["taper", 2],
            ["rehab", 3],
        ]);
        for (const template of PLAN_TEMPLATES) expect(Object.keys(TRAINING_PHASE_LABELS)).toContain(template.phase);
        expect(planTemplate("fight_camp")?.label).toBe("Fight camp");
        expect(planTemplate("unknown")).toBeUndefined();
    });

    it.each(PLAN_TEMPLATES)("$label fits the plan limits", (template) => {
        expect(template.label.length).toBeGreaterThanOrEqual(PLAN.titleMin);
        expect(template.label.length).toBeLessThanOrEqual(PLAN.titleMax);
        expect(template.objective.trim().length).toBeGreaterThanOrEqual(PLAN.objectiveMin);
        expect(template.objective.length).toBeLessThanOrEqual(PLAN.objectiveMax);
        expect(template.notes.length).toBeLessThanOrEqual(PLAN.notesMax);
        expect(isWhole(template.weeks)).toBe(true);
        expect(template.exercises.length).toBeGreaterThan(0);
    });

    it.each(PLAN_TEMPLATES)("$label prescribes every exercise within the plan-exercise limits", (template) => {
        const names = template.exercises.map((exercise) => exerciseNameKey(exercise.name));
        expect(new Set(names).size).toBe(names.length);
        for (const exercise of template.exercises) {
            const where = `${template.id}: ${exercise.name}`;
            expect(SERVICE_EXERCISE_CATEGORIES, where).toContain(exercise.category);
            expect([exercise.sets, exercise.reps, exercise.durationSec].some((value) => value !== null), `${where} prescribes something`).toBe(true);
            if (exercise.sets !== null) expect(isWhole(exercise.sets) && exercise.sets <= EXERCISE.setsMax, where).toBe(true);
            if (exercise.reps !== null) expect(isWhole(exercise.reps) && exercise.reps <= EXERCISE.repsMax, where).toBe(true);
            if (exercise.durationSec !== null) {
                // The form edits whole minutes.
                expect(exercise.durationSec % 60, where).toBe(0);
                expect(isWhole(exercise.durationSec / 60) && exercise.durationSec / 60 <= EXERCISE.minutesMax, where).toBe(true);
            }
            if (exercise.targetRpe !== null) {
                expect(Number.isInteger(exercise.targetRpe), where).toBe(true);
                expect(exercise.targetRpe, where).toBeGreaterThanOrEqual(EXERCISE.rpeMin);
                expect(exercise.targetRpe, where).toBeLessThanOrEqual(EXERCISE.rpeMax);
            }
            if (exercise.notes !== null) {
                expect(exercise.notes.trim(), where).not.toBe("");
                expect(exercise.notes.length, where).toBeLessThanOrEqual(EXERCISE.notesMax);
            }
        }
    });

    it("draws every template exercise from the starter library, with its category", () => {
        for (const template of PLAN_TEMPLATES) {
            for (const exercise of template.exercises) {
                const starter = STARTER_EXERCISES.find((candidate) => candidate.name === exercise.name);
                expect(starter, exercise.name).toBeDefined();
                expect(exercise.category).toBe(starter?.category);
            }
        }
    });

    it("suggests objectives for every phase within the objective limits", () => {
        for (const phase of Object.keys(TRAINING_PHASE_LABELS) as (keyof typeof PHASE_OBJECTIVE_SUGGESTIONS)[]) {
            expect(PHASE_OBJECTIVE_SUGGESTIONS[phase].length, phase).toBeGreaterThan(0);
            for (const suggestion of PHASE_OBJECTIVE_SUGGESTIONS[phase]) {
                expect(suggestion.length).toBeGreaterThanOrEqual(PLAN.objectiveMin);
                expect(suggestion.length).toBeLessThanOrEqual(PLAN.objectiveMax);
            }
        }
    });
});

describe("starter library", () => {
    it("fits the service's create-exercise limits with unique names", () => {
        const keys = STARTER_EXERCISES.map((exercise) => exerciseNameKey(exercise.name));
        expect(new Set(keys).size).toBe(keys.length);
        for (const exercise of STARTER_EXERCISES) {
            expect(exercise.name.trim().length, exercise.name).toBeGreaterThan(0);
            expect(exercise.name.length, exercise.name).toBeLessThanOrEqual(LIBRARY.nameMax);
            expect(exercise.description.length, exercise.name).toBeLessThanOrEqual(LIBRARY.descriptionMax);
            expect(SERVICE_EXERCISE_CATEGORIES, exercise.name).toContain(exercise.category);
            for (const group of exercise.targetMuscleGroups) expect(group.trim(), exercise.name).not.toBe("");
        }
    });

    it("only lists exercises the library doesn't have, ignoring case and dash style", () => {
        const missing = missingStarterExercises([{ name: "technical SHADOW boxing" }, { name: "Jab-cross-hook  pad drill" }]);
        expect(missing).toHaveLength(STARTER_EXERCISES.length - 2);
        expect(missing.map((exercise) => exercise.name)).not.toContain("Technical shadow boxing");
        expect(missing.map((exercise) => exercise.name)).not.toContain("Jab–cross–hook pad drill");
        expect(missingStarterExercises(STARTER_EXERCISES)).toEqual([]);
    });
});

describe("resolvePlanTemplate", () => {
    const template = planTemplate("boxing_fundamentals")!;

    it("matches names case-insensitively and keeps the template order", () => {
        const catalog = [
            { id: "ex-bag", name: "HEAVY BAG POWER ROUNDS" },
            { id: "ex-shadow", name: " technical shadow boxing " },
            { id: "ex-pads", name: "Jab-cross-hook pad drill" },
            { id: "ex-shadow-2", name: "Technical shadow boxing" },
        ];
        const { items, missing } = resolvePlanTemplate(template, catalog);
        expect(items.map((item) => [item.name, item.exerciseId])).toEqual([
            ["Technical shadow boxing", "ex-shadow"],
            ["Jab–cross–hook pad drill", "ex-pads"],
            ["Heavy bag power rounds", "ex-bag"],
        ]);
        expect(items[0]).toMatchObject({ sets: 3, durationSec: 540, targetRpe: 4 });
        expect(missing.map((exercise) => exercise.name)).toEqual(["Slip-roll line drill", "Pivot-and-angle footwork ladder", "Skipping rope rounds", "Band pull-aparts"]);
    });

    it("reports everything missing from an empty library", () => {
        expect(resolvePlanTemplate(template, [])).toEqual({ items: [], missing: template.exercises });
    });
});

describe("plan dates and titles", () => {
    it("ends a plan after whole weeks, counting the first day", () => {
        expect(planEndKey("2026-10-12", 4)).toBe("2026-11-08");
        expect(planSpanDays("2026-10-12", "2026-11-08")).toBe(28);
        expect(planWholeWeeks("2026-10-12", "2026-11-08")).toBe(4);
        expect(planWholeWeeks("2026-10-12", "2026-11-09")).toBeNull();
        expect(planSpanDays("2026-10-12", "2026-10-11")).toBeNull();
        expect(planSpanDays("", "2026-10-11")).toBeNull();
    });

    it("marks a copy and keeps it within the title limit", () => {
        expect(copyTitle("Fight camp ")).toBe("Fight camp (copy)");
        const long = copyTitle("x".repeat(PLAN.titleMax));
        expect(long).toHaveLength(PLAN.titleMax);
        expect(long.endsWith(" (copy)")).toBe(true);
    });
});

describe("session presets", () => {
    it("covers exactly the training types the service can schedule, within the session limits", () => {
        expect(Object.keys(SESSION_PRESETS).sort()).toEqual([...SERVICE_TRAINING_TYPES].sort());
        for (const [type, preset] of Object.entries(SESSION_PRESETS)) {
            expect(Number.isInteger(preset.durationMin), type).toBe(true);
            expect(preset.durationMin % 5, type).toBe(0);
            expect(preset.durationMin, type).toBeGreaterThanOrEqual(SESSION.minutesMin);
            expect(preset.durationMin, type).toBeLessThanOrEqual(SESSION.minutesMax);
            for (const locale of ["en", "vi"] as const) {
                const notes = createTranslator(locale)(preset.notes);
                expect(notes.trim(), type).not.toBe("");
                expect(notes.length, type).toBeLessThanOrEqual(SESSION.notesMax);
            }
        }
        expect(presetDuration("grappling")).toBe(75);
        expect(presetDuration("technical_drilling")).toBe(60);
    });

    it("suggests a title from the type and the plan", () => {
        expect(suggestedSessionTitle("pad_work")).toBe("Pad work");
        expect(suggestedSessionTitle("pad_work", "  Fight camp ")).toBe("Pad work — Fight camp");
        const long = suggestedSessionTitle("strength_conditioning", "y".repeat(200));
        expect(long).toHaveLength(120);
        expect(long.endsWith("…")).toBe(true);
    });
});

describe("weekly repeats", () => {
    it("lists one date a week and stops at the plan's last day", () => {
        expect(weeklyDates("2026-10-12", 3)).toEqual({ dates: ["2026-10-12", "2026-10-19", "2026-10-26"], skipped: 0 });
        expect(weeklyDates("2026-10-12", 4, "2026-10-25")).toEqual({ dates: ["2026-10-12", "2026-10-19"], skipped: 2 });
        // The first session always stays: the coach picked its date.
        expect(weeklyDates("2026-10-12", 2, "2026-10-01")).toEqual({ dates: ["2026-10-12"], skipped: 1 });
    });

    it("caps a repeat at twelve sessions", () => {
        expect(weeklyDates("2026-10-12", 40).dates).toHaveLength(12);
        expect(weeklyDates("2026-10-12", 0).dates).toEqual(["2026-10-12"]);
    });

    it("schedules again a week later at the same academy time, never in the past", () => {
        // 17:30 in Ho Chi Minh City is 10:30 UTC.
        expect(nextWeeklySlot("2026-10-05T10:30:00.000Z", "2026-10-06T00:00:00.000Z")).toEqual({ date: "2026-10-12", time: "17:30" });
        expect(nextWeeklySlot("2026-09-01T10:30:00.000Z", "2026-10-11T00:00:00.000Z")).toEqual({ date: "2026-10-13", time: "17:30" });
        expect(nextWeeklySlot("2026-10-04T10:30:00.000Z", "2026-10-11T10:31:00.000Z")).toEqual({ date: "2026-10-18", time: "17:30" });
    });
});
