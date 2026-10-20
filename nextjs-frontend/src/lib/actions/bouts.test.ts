import { describe, expect, it } from "vitest";
import { z } from "zod";

import { enCoachBouts } from "@/lib/i18n/messages/coach-bouts.en";
import { viCoachBouts } from "@/lib/i18n/messages/coach-bouts.vi";
import {
    addRequirementSchema,
    buildAddRequirementSchema,
    buildCreateBoutSchema,
    buildUpdateBoutSchema,
    createBoutSchema,
    emptyToUndefined,
    updateBoutSchema,
} from "./bout-schemas";
import { FIX_FIELDS, validationError } from "./state";

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

    describe("validationError custom message", () => {
        const testSchema = z.object({ code: z.string().min(1) });

        it("uses FIX_FIELDS by default", () => {
            const res = testSchema.safeParse({});
            expect(res.success).toBe(false);
            if (!res.success) {
                const state = validationError(res.error);
                expect(state.message).toBe(FIX_FIELDS);
            }
        });

        it("uses custom message when provided", () => {
            const res = testSchema.safeParse({});
            expect(res.success).toBe(false);
            if (!res.success) {
                const state = validationError(res.error, "Vui lòng sửa các ô được đánh dấu.");
                expect(state.message).toBe("Vui lòng sửa các ô được đánh dấu.");
            }
        });
    });

    describe("translated numeric validation messages in English and Vietnamese", () => {
        const fakeTEn = (key: string) => (enCoachBouts as Record<string, string>)[key] ?? key;
        const fakeTVi = (key: string) => (viCoachBouts as Record<string, string>)[key] ?? key;

        it("translates validityDays errors", () => {
            const enSchema = buildAddRequirementSchema(fakeTEn);
            const viSchema = buildAddRequirementSchema(fakeTVi);

            const enMin = enSchema.safeParse({ boutId: "1", code: "TEST", label: "Test", required: true, validityDays: "0" });
            const viMin = viSchema.safeParse({ boutId: "1", code: "TEST", label: "Test", required: true, validityDays: "0" });
            expect(enMin.error?.issues[0].message).toBe("Validity period must be at least 1 day.");
            expect(viMin.error?.issues[0].message).toBe("Thời hạn hiệu lực phải từ 1 ngày trở lên.");

            const enInt = enSchema.safeParse({ boutId: "1", code: "TEST", label: "Test", required: true, validityDays: "1.5" });
            const viInt = viSchema.safeParse({ boutId: "1", code: "TEST", label: "Test", required: true, validityDays: "1.5" });
            expect(enInt.error?.issues[0].message).toBe("Validity period must be an integer.");
            expect(viInt.error?.issues[0].message).toBe("Thời hạn hiệu lực phải là số nguyên.");

            const enInvalid = enSchema.safeParse({ boutId: "1", code: "TEST", label: "Test", required: true, validityDays: "abc" });
            const viInvalid = viSchema.safeParse({ boutId: "1", code: "TEST", label: "Test", required: true, validityDays: "abc" });
            expect(enInvalid.error?.issues[0].message).toBe("Enter a valid validity period in days.");
            expect(viInvalid.error?.issues[0].message).toBe("Nhập số ngày thời hạn hợp lệ.");
        });

        it("translates requirementsDueDays errors", () => {
            const enSchema = buildUpdateBoutSchema(fakeTEn);
            const viSchema = buildUpdateBoutSchema(fakeTVi);

            const enMin = enSchema.safeParse({ boutId: "1", requirementsDueDays: "-1" });
            const viMin = viSchema.safeParse({ boutId: "1", requirementsDueDays: "-1" });
            expect(enMin.error?.issues[0].message).toBe("Checklist due days must be at least 0.");
            expect(viMin.error?.issues[0].message).toBe("Số ngày nộp hồ sơ phải từ 0 trở lên.");

            const enMax = enSchema.safeParse({ boutId: "1", requirementsDueDays: "61" });
            const viMax = viSchema.safeParse({ boutId: "1", requirementsDueDays: "61" });
            expect(enMax.error?.issues[0].message).toBe("Checklist due days must be at most 60.");
            expect(viMax.error?.issues[0].message).toBe("Số ngày nộp hồ sơ tối đa là 60 ngày.");

            const enInt = enSchema.safeParse({ boutId: "1", requirementsDueDays: "3.5" });
            const viInt = viSchema.safeParse({ boutId: "1", requirementsDueDays: "3.5" });
            expect(enInt.error?.issues[0].message).toBe("Checklist due days must be an integer.");
            expect(viInt.error?.issues[0].message).toBe("Số ngày nộp hồ sơ phải là số nguyên.");

            const enInvalid = enSchema.safeParse({ boutId: "1", requirementsDueDays: "abc" });
            const viInvalid = viSchema.safeParse({ boutId: "1", requirementsDueDays: "abc" });
            expect(enInvalid.error?.issues[0].message).toBe("Enter a valid number of days.");
            expect(viInvalid.error?.issues[0].message).toBe("Nhập số ngày hợp lệ.");
        });

        it("translates weightLimitKg errors in updateBoutSchema", () => {
            const enSchema = buildUpdateBoutSchema(fakeTEn);
            const viSchema = buildUpdateBoutSchema(fakeTVi);

            const enMin = enSchema.safeParse({ boutId: "1", weightLimitKg: "25" });
            const viMin = viSchema.safeParse({ boutId: "1", weightLimitKg: "25" });
            expect(enMin.error?.issues[0].message).toBe("Weight limit must be at least 30 kg.");
            expect(viMin.error?.issues[0].message).toBe("Giới hạn cân phải từ 30 kg trở lên.");

            const enMax = enSchema.safeParse({ boutId: "1", weightLimitKg: "250" });
            const viMax = viSchema.safeParse({ boutId: "1", weightLimitKg: "250" });
            expect(enMax.error?.issues[0].message).toBe("Weight limit must be at most 200 kg.");
            expect(viMax.error?.issues[0].message).toBe("Giới hạn cân tối đa là 200 kg.");

            const enInvalid = enSchema.safeParse({ boutId: "1", weightLimitKg: "abc" });
            const viInvalid = viSchema.safeParse({ boutId: "1", weightLimitKg: "abc" });
            expect(enInvalid.error?.issues[0].message).toBe("Enter a valid weight limit.");
            expect(viInvalid.error?.issues[0].message).toBe("Nhập giới hạn cân hợp lệ.");
        });

        it("translates requirementsDueDays and weightLimitKg errors in createBoutSchema", () => {
            const enSchema = buildCreateBoutSchema(fakeTEn);
            const viSchema = buildCreateBoutSchema(fakeTVi);

            const base = {
                fighterId: "f-1",
                rulesetId: "r-1",
                eventName: "Lotus Fight",
                weightClassCode: "welterweight",
                weighInAt: "2026-11-01T09:00:00.000Z",
                boutAt: "2026-11-02T19:00:00.000Z",
            };

            const enWeightMin = enSchema.safeParse({ ...base, weightLimitKg: "25" });
            const viWeightMin = viSchema.safeParse({ ...base, weightLimitKg: "25" });
            expect(enWeightMin.error?.issues[0].message).toBe("Weight limit must be at least 30 kg.");
            expect(viWeightMin.error?.issues[0].message).toBe("Giới hạn cân phải từ 30 kg trở lên.");

            const enDueMax = enSchema.safeParse({ ...base, weightLimitKg: "70", requirementsDueDays: "70" });
            const viDueMax = viSchema.safeParse({ ...base, weightLimitKg: "70", requirementsDueDays: "70" });
            expect(enDueMax.error?.issues[0].message).toBe("Checklist due days must be at most 60.");
            expect(viDueMax.error?.issues[0].message).toBe("Số ngày nộp hồ sơ tối đa là 60 ngày.");
        });
    });
});
