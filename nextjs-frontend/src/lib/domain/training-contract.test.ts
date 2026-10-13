import { describe, expect, it } from "vitest";

import { SESSION_TYPES } from "./medical-contract";
import {
    EXERCISE_CATEGORY_FOR,
    exerciseCreateBody,
    exerciseNameKey,
    planBody,
    SERVICE_EXERCISE_CATEGORIES,
    SERVICE_TRAINING_TYPES,
    serviceExerciseCategoryFor,
    sessionBody,
    sessionStatusBody,
    sessionTypeFor,
    TRAINING_TYPE_FOR,
} from "./training-contract";

describe("training contract", () => {
    it("stores every interface exercise category under one of the service's four, and reads each back", () => {
        expect(serviceExerciseCategoryFor("defense")).toBe("STRIKING");
        expect(serviceExerciseCategoryFor("footwork")).toBe("STRIKING");
        expect(serviceExerciseCategoryFor("strength")).toBe("STRENGTH_CONDITIONING");
        expect(serviceExerciseCategoryFor("mobility")).toBe("RECOVERY");
        for (const category of SERVICE_EXERCISE_CATEGORIES) expect(serviceExerciseCategoryFor(EXERCISE_CATEGORY_FOR[category])).toBe(category);
    });

    it("sends a new library exercise with trimmed text, unique muscle groups and empty text as null", () => {
        expect(
            exerciseCreateBody({ name: "  Kettlebell swings ", category: "STRENGTH_CONDITIONING", description: " ", targetMuscleGroups: [" glutes", "glutes", "", "back"], videoUrl: null }),
        ).toEqual({ name: "Kettlebell swings", category: "STRENGTH_CONDITIONING", description: null, targetMuscleGroups: ["glutes", "back"], videoUrl: null });
    });

    it("matches exercise names regardless of case, spacing and dash style", () => {
        expect(exerciseNameKey(" Jab–cross—hook   PAD drill ")).toBe(exerciseNameKey("jab-cross-hook pad drill"));
        expect(exerciseNameKey("Hip 90/90 mobility flow")).not.toBe(exerciseNameKey("Hip mobility flow"));
    });

    it("maps every service session type to an interface type, and back for the types the service has", () => {
        for (const type of SESSION_TYPES) expect(TRAINING_TYPE_FOR[type]).toBeDefined();
        for (const type of SERVICE_TRAINING_TYPES) expect(TRAINING_TYPE_FOR[sessionTypeFor(type) ?? "RECOVERY"]).toBe(type);
        expect(sessionTypeFor("technical_drilling")).toBeNull();
    });

    it("sends plan dates as academy days, the phase, and empty text as null", () => {
        expect(
            planBody({ title: "  Camp ", objective: " ", phase: "fight_camp", notes: "Sparring capped", startDate: "2026-08-31T17:00:00.000Z", endDate: "2026-10-01T16:59:59.999Z" }),
        ).toEqual({
            title: "Camp",
            goals: null,
            description: "Sparring capped",
            phase: "fight_camp",
            startDate: "2026-09-01",
            endDate: "2026-10-01",
        });
    });

    it("leaves a session body out for a training type the service doesn't have", () => {
        const fields = { title: "Drills", scheduledAt: "2026-09-10T10:00:00.000Z", durationMin: 45, location: "", notes: null };
        expect(sessionBody({ ...fields, type: "technical_drilling" })).toBeNull();
        expect(sessionBody({ ...fields, type: "recovery_mobility" })).toMatchObject({ sessionType: "RECOVERY", plannedDurationSec: 2700, location: null });
    });

    it("sends a cancellation reason only with a cancellation", () => {
        expect(sessionStatusBody("CANCELLED", " Coach unwell ")).toEqual({ status: "CANCELLED", cancellationReason: "Coach unwell" });
        expect(sessionStatusBody("IN_PROGRESS", "ignored")).toEqual({ status: "IN_PROGRESS" });
    });
});
