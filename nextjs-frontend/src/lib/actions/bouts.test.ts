import { describe, expect, it } from "vitest";

import {
    addRequirementSchema,
    createBoutSchema,
    emptyToUndefined,
    updateBoutSchema,
} from "./bouts";

describe("bouts schema numeric preprocessing and validation", () => {
    describe("emptyToUndefined helper", () => {
        it("converts empty string to undefined", () => {
            expect(emptyToUndefined("")).toBeUndefined();
        });

        it("converts whitespace string to undefined", () => {
            expect(emptyToUndefined("   ")).toBeUndefined();
        });

        it("preserves undefined and null as undefined", () => {
            expect(emptyToUndefined(undefined)).toBeUndefined();
            expect(emptyToUndefined(null)).toBeUndefined();
        });

        it("replaces decimal commas with dots and trims strings", () => {
            expect(emptyToUndefined(" 63,5 ")).toBe("63.5");
        });

        it("preserves non-empty string and numbers", () => {
            expect(emptyToUndefined("30")).toBe("30");
            expect(emptyToUndefined(30)).toBe(30);
        });
    });

    describe("addRequirementSchema", () => {
        const baseValid = {
            boutId: "bout-1",
            code: "BRAIN_MRI",
            label: "Brain MRI",
            required: true,
        };

        it("(a) validityDays left empty is valid and results in undefined", () => {
            const parsedEmpty = addRequirementSchema.safeParse({
                ...baseValid,
                validityDays: "",
            });
            expect(parsedEmpty.success).toBe(true);
            if (parsedEmpty.success) {
                expect(parsedEmpty.data.validityDays).toBeUndefined();
            }

            const parsedWhitespace = addRequirementSchema.safeParse({
                ...baseValid,
                validityDays: "   ",
            });
            expect(parsedWhitespace.success).toBe(true);
            if (parsedWhitespace.success) {
                expect(parsedWhitespace.data.validityDays).toBeUndefined();
            }
        });

        it("(b) validityDays = '0' is rejected", () => {
            const parsedZero = addRequirementSchema.safeParse({
                ...baseValid,
                validityDays: "0",
            });
            expect(parsedZero.success).toBe(false);
        });

        it("accepts valid positive integer for validityDays", () => {
            const parsed = addRequirementSchema.safeParse({
                ...baseValid,
                validityDays: "180",
            });
            expect(parsed.success).toBe(true);
            if (parsed.success) {
                expect(parsed.data.validityDays).toBe(180);
            }
        });
    });

    describe("createBoutSchema and updateBoutSchema", () => {
        const baseCreate = {
            fighterId: "fighter-1",
            rulesetId: "ruleset-1",
            eventName: "Lotus Fight Night",
            weightClassCode: "welterweight",
            weightLimitKg: "77",
            weighInAt: "2026-11-01T09:00:00.000Z",
            boutAt: "2026-11-02T19:00:00.000Z",
        };

        it("(c) requirementsDueDays left empty in createBoutSchema does not become 0 (results in undefined)", () => {
            const parsedEmpty = createBoutSchema.safeParse({
                ...baseCreate,
                requirementsDueDays: "",
            });
            expect(parsedEmpty.success).toBe(true);
            if (parsedEmpty.success) {
                expect(parsedEmpty.data.requirementsDueDays).toBeUndefined();
                expect(parsedEmpty.data.requirementsDueDays).not.toBe(0);
            }

            const parsedWhitespace = createBoutSchema.safeParse({
                ...baseCreate,
                requirementsDueDays: "   ",
            });
            expect(parsedWhitespace.success).toBe(true);
            if (parsedWhitespace.success) {
                expect(parsedWhitespace.data.requirementsDueDays).toBeUndefined();
            }
        });

        it("(c) requirementsDueDays left empty in updateBoutSchema does not become 0 (results in undefined)", () => {
            const parsedEmpty = updateBoutSchema.safeParse({
                boutId: "bout-1",
                requirementsDueDays: "",
            });
            expect(parsedEmpty.success).toBe(true);
            if (parsedEmpty.success) {
                expect(parsedEmpty.data.requirementsDueDays).toBeUndefined();
                expect(parsedEmpty.data.requirementsDueDays).not.toBe(0);
            }
        });

        it("weightLimitKg left empty in updateBoutSchema does not fail min(30) (results in undefined)", () => {
            const parsedEmpty = updateBoutSchema.safeParse({
                boutId: "bout-1",
                weightLimitKg: "",
            });
            expect(parsedEmpty.success).toBe(true);
            if (parsedEmpty.success) {
                expect(parsedEmpty.data.weightLimitKg).toBeUndefined();
            }
        });
    });
});
