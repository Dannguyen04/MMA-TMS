import { z } from "zod";

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

/* ─── Create Bout Schema ─────────────────────────────────────────────────── */

export const createBoutSchema = z
    .object({
        fighterId: z.string({ error: "Choose a fighter." }).min(1, "Choose a fighter."),
        rulesetId: z.string({ error: "Choose a competition ruleset." }).min(1, "Choose a competition ruleset."),
        eventName: z.string({ error: "Enter the event name." }).trim().min(2, "Event name must be at least 2 characters."),
        venue: z.string().trim().optional(),
        opponentName: z.string().trim().optional(),
        weightClassCode: z.string({ error: "Select or enter a weight class." }).min(1, "Select or enter a weight class."),
        weightLimitKg: z.preprocess(
            emptyToUndefined,
            z.coerce.number({ error: "Enter a valid weight limit." }).min(30, "Weight limit must be at least 30 kg.").max(200, "Weight limit must be at most 200 kg."),
        ),
        weighInAt: z.string({ error: "Choose weigh-in date and time." }).min(1, "Choose weigh-in date and time."),
        boutAt: z.string({ error: "Choose bout date and time." }).min(1, "Choose bout date and time."),
        requirementsDueDays: optionalCoercedNumber(z.coerce.number().int().min(0).max(60)),
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
                message: "Weigh-in must be scheduled before the bout.",
            });
        }
    });

/* ─── Update Bout Schema ─────────────────────────────────────────────────── */

export const updateBoutSchema = z
    .object({
        boutId: z.string().min(1, "Bout id required."),
        eventName: z.string().trim().min(2, "Event name must be at least 2 characters.").optional(),
        venue: z.string().trim().optional(),
        opponentName: z.string().trim().optional(),
        weightLimitKg: optionalCoercedNumber(z.coerce.number().min(30).max(200)),
        requirementsDueDays: optionalCoercedNumber(z.coerce.number().int().min(0).max(60)),
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
                    message: "Weigh-in must be scheduled before the bout.",
                });
            }
        }
    });

/* ─── Requirement Schemas ─────────────────────────────────────────────────── */

export const addRequirementSchema = z.object({
    boutId: z.string().min(1),
    code: z.string().trim().min(2, "Enter a short code, e.g. BLOOD_TEST.").max(40),
    label: z.string().trim().min(2, "Enter a requirement label.").max(120),
    required: z.coerce.boolean(),
    validityDays: optionalCoercedNumber(z.coerce.number().int().min(1)),
});

export const updateRequirementSchema = z
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
                message: "Valid until date is required when marked as Provided.",
            });
        }
        if (data.status === "REJECTED" && !data.statusReason) {
            ctx.addIssue({
                code: "custom",
                path: ["statusReason"],
                message: "Status reason is required when rejected.",
            });
        }
    });
