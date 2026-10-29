import { z } from "zod";

import { SESSION_TYPES } from "@/lib/domain/medical-contract";
import {
    academyDateOf,
    deriveRequiresClearance,
} from "@/lib/domain/suspension-rules";
import type { Translator } from "@/lib/i18n/translate";

/* ─── Zod Schemas ─────────────────────────────────────────────────────────── */

function emptyToUndefined(val: unknown): unknown {
    if (val === "" || val === null || val === undefined) return undefined;
    if (typeof val === "string" && val.trim() === "") return undefined;
    return val;
}

export function buildCreateSuspensionSchema(t: Translator) {
    return z
        .object({
            fighterId: z.string().min(1, t("form.fixFields")),
            reason: z.enum(["KO", "TKO", "DQ", "MANDATORY_REST", "MEDICAL", "OTHER"]),
            days: z.coerce.number().int().min(1, t("suspensions.action.daysRange")).max(365, t("suspensions.action.daysRange")),
            startsOn: z
                .string()
                .optional()
                .or(z.literal(""))
                .transform((val) => (val && val.trim().length > 0 ? val.trim() : undefined)),
            maxTier: z.preprocess(
                emptyToUndefined,
                z.coerce.number().int().min(1).max(5).optional(),
            ),
            blockedSessionTypes: z
                .array(z.enum(SESSION_TYPES))
                .min(1, t("suspensions.action.blockedSessionTypesMin"))
                .refine(
                    (items) => new Set(items).size === items.length,
                    t("suspensions.action.duplicateSessionTypes"),
                )
                .optional(),
            requiresClearance: z.preprocess((val) => {
                if (val === "true" || val === true || val === "on" || val === "1") return true;
                if (val === "false" || val === false || val === "0" || val === "") return false;
                return undefined;
            }, z.boolean().optional()),
            lossOfConsciousness: z.preprocess(
                emptyToUndefined,
                z.enum(["NONE", "UNDER_1_MIN", "OVER_1_MIN", "UNKNOWN"]).nullable().optional(),
            ),
        })
        .superRefine((data, ctx) => {
            if (data.maxTier !== undefined && data.blockedSessionTypes !== undefined) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["maxTier"],
                    message: t("suspensions.action.maxTierAndTypesExclusive"),
                });
            }

            const clearance = deriveRequiresClearance(data.reason, data.requiresClearance);
            if (!clearance.ok) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ["requiresClearance"],
                    message:
                        clearance.reason === "REQUIRES_CLEARANCE_MANDATORY"
                            ? t("suspensions.action.requiresClearanceKoMandatory")
                            : t("suspensions.action.requiresClearanceDqForbidden"),
                });
            }

            if (data.startsOn !== undefined) {
                const today = academyDateOf(new Date());
                if (data.startsOn < today) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        path: ["startsOn"],
                        message: t("suspensions.action.startsOnNotBeforeToday"),
                    });
                }
            }
        });
}

export function buildClearSuspensionSchema(t: Translator) {
    return z.object({
        id: z.string().min(1),
        clearanceNote: z
            .string()
            .trim()
            .min(3, t("suspensions.action.clearanceNoteLength"))
            .max(500, t("suspensions.action.clearanceNoteLength")),
    });
}

export function buildApplyConflictsSchema(_t?: Translator) {
    void _t;
    return z.object({
        id: z.string().min(1),
        sessionIds: z.array(z.string().min(1)),
    });
}
