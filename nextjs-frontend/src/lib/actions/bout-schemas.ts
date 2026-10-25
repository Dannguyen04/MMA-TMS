import { z } from "zod";

import type { Translator } from "@/lib/i18n/translate";

/**
 * Normalizes empty string / whitespace to undefined so that
 * numeric schemas don't coerce "" into 0. Also replaces decimal commas with dots.
 */
export function emptyToUndefined(val: unknown): unknown {
    if (val === "" || val === null || val === undefined) return undefined;
    if (typeof val === "string") {
        const trimmed = val.replace(",", ".").trim();
        return trimmed === "" ? undefined : trimmed;
    }
    return val;
}

export function optionalCoercedNumber<T extends z.ZodTypeAny>(schema: T) {
    return z.preprocess(emptyToUndefined, schema.optional());
}

/* ─── Create Bout Schema Builder ─────────────────────────────────────────── */

export function buildCreateBoutSchema(t: Translator) {
    return z
        .object({
            fighterId: z.string({ error: t("coachBouts.action.chooseFighter") }).min(1, t("coachBouts.action.chooseFighter")),
            rulesetId: z.string({ error: t("coachBouts.action.chooseRuleset") }).min(1, t("coachBouts.action.chooseRuleset")),
            eventName: z.string({ error: t("coachBouts.action.enterEventName") }).trim().min(2, t("coachBouts.action.eventNameMin")),
            venue: z.string().trim().optional(),
            opponentName: z.string().trim().optional(),
            weightClassCode: z.string({ error: t("coachBouts.action.selectWeightClass") }).min(1, t("coachBouts.action.selectWeightClass")),
            weightLimitKg: z.preprocess(
                emptyToUndefined,
                z.coerce
                    .number({ error: t("coachBouts.action.enterValidWeightLimit") })
                    .min(30, t("coachBouts.action.weightLimitMin"))
                    .max(200, t("coachBouts.action.weightLimitMax")),
            ),
            weighInAt: z.string({ error: t("coachBouts.action.chooseWeighInAt") }).min(1, t("coachBouts.action.chooseWeighInAt")),
            boutAt: z.string({ error: t("coachBouts.action.chooseBoutAt") }).min(1, t("coachBouts.action.chooseBoutAt")),
            requirementsDueDays: optionalCoercedNumber(
                z.coerce
                    .number({ error: t("coachBouts.action.dueDaysValid") })
                    .int(t("coachBouts.action.dueDaysInt"))
                    .min(0, t("coachBouts.action.dueDaysMin"))
                    .max(60, t("coachBouts.action.dueDaysMax")),
            ),
            notes: z.string().trim().optional(),
        })
        .superRefine((data, ctx) => {
            const weighInMs = new Date(data.weighInAt).getTime();
            const boutMs = new Date(data.boutAt).getTime();
            if (Number.isNaN(weighInMs) || Number.isNaN(boutMs)) return;
            if (weighInMs >= boutMs) {
                ctx.addIssue({
                    code: "custom",
                    path: ["weighInAt"],
                    message: t("coachBouts.form.error.weighInBeforeBout"),
                });
            }
        });
}

/* ─── Update Bout Schema Builder ─────────────────────────────────────────── */

export function buildUpdateBoutSchema(t: Translator) {
    return z
        .object({
            boutId: z.string().min(1, t("coachBouts.action.boutIdRequired")),
            eventName: z.string().trim().min(2, t("coachBouts.action.eventNameMin")).optional(),
            venue: z.string().trim().optional(),
            opponentName: z.string().trim().optional(),
            weightLimitKg: optionalCoercedNumber(
                z.coerce
                    .number({ error: t("coachBouts.action.enterValidWeightLimit") })
                    .min(30, t("coachBouts.action.weightLimitMin"))
                    .max(200, t("coachBouts.action.weightLimitMax")),
            ),
            requirementsDueDays: optionalCoercedNumber(
                z.coerce
                    .number({ error: t("coachBouts.action.dueDaysValid") })
                    .int(t("coachBouts.action.dueDaysInt"))
                    .min(0, t("coachBouts.action.dueDaysMin"))
                    .max(60, t("coachBouts.action.dueDaysMax")),
            ),
            weighInAt: z.string().optional(),
            boutAt: z.string().optional(),
            notes: z.string().trim().optional(),
        })
        .superRefine((data, ctx) => {
            if (data.weighInAt && data.boutAt) {
                const weighInMs = new Date(data.weighInAt).getTime();
                const boutMs = new Date(data.boutAt).getTime();
                if (weighInMs >= boutMs) {
                    ctx.addIssue({
                        code: "custom",
                        path: ["weighInAt"],
                        message: t("coachBouts.form.error.weighInBeforeBout"),
                    });
                }
            }
        });
}

/* ─── Requirement Schema Builders ─────────────────────────────────────────── */

export function buildAddRequirementSchema(t: Translator) {
    return z.object({
        boutId: z.string().min(1),
        code: z.string().trim().min(2, t("coachBouts.action.enterShortCode")).max(40),
        label: z.string().trim().min(2, t("coachBouts.action.enterRequirementLabel")).max(120),
        required: z.coerce.boolean(),
        validityDays: optionalCoercedNumber(
            z.coerce
                .number({ error: t("coachBouts.action.validityDaysValid") })
                .int(t("coachBouts.action.validityDaysInt"))
                .min(1, t("coachBouts.action.validityDaysMin")),
        ),
    });
}

export function buildUpdateRequirementSchema(t: Translator) {
    return z
        .object({
            boutId: z.string().min(1),
            code: z.string().min(1),
            status: z.enum(["MISSING", "PROVIDED", "CONFIRMED", "REJECTED"]).optional(),
            issuedOn: z.string().optional(),
            validUntil: z.string().optional(),
            label: z.string().trim().min(2).optional(),
            required: z.coerce.boolean().optional(),
            statusReason: z.string().trim().optional(),
        })
        .superRefine((data, ctx) => {
            if (data.status === "PROVIDED" && !data.validUntil) {
                ctx.addIssue({
                    code: "custom",
                    path: ["validUntil"],
                    message: t("coachBouts.action.validUntilRequiredWhenProvided"),
                });
            }
            if (data.status === "REJECTED" && !data.statusReason) {
                ctx.addIssue({
                    code: "custom",
                    path: ["statusReason"],
                    message: t("coachBouts.action.statusReasonRequiredWhenRejected"),
                });
            }
        });
}

/* ─── Default Schemas (for tests or callers not providing custom translator) ── */

const defaultTranslator: Translator = (key: string) => key;

export const createBoutSchema = buildCreateBoutSchema(defaultTranslator);
export const updateBoutSchema = buildUpdateBoutSchema(defaultTranslator);
export const addRequirementSchema = buildAddRequirementSchema(defaultTranslator);
export const updateRequirementSchema = buildUpdateRequirementSchema(defaultTranslator);
