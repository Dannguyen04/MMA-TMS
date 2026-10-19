"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { canAccessFighter } from "@/lib/auth/access";
import { authorizeAction } from "@/lib/auth/session";
import type { User } from "@/lib/domain/types";
import { routes } from "@/lib/routes";
import {
    addRequirement as addRequirementService,
    cancelBout as cancelBoutService,
    createBout as createBoutService,
    enterFightWeek as enterFightWeekService,
    getBout,
    linkCamp as linkCampService,
    removeRequirement as removeRequirementService,
    updateBout as updateBoutService,
    updateRequirement as updateRequirementService,
} from "@/lib/services/bouts";
import { actionError, actionSuccess, validationError, type ActionState } from "./state";

const NOT_ON_ROSTER = "You can only manage bouts for fighters on your roster.";
const NO_COACH_PROFILE = "Your account isn't linked to a coach profile, so you cannot manage bouts.";

async function authorizeCoach(): Promise<{ ok: true; user: User; coachId: string } | { ok: false; state: ActionState<never> }> {
    const auth = await authorizeAction("training:write");
    if (!auth.ok) return { ok: false, state: actionError(auth.message) };
    if (!auth.user.profileId) return { ok: false, state: actionError(NO_COACH_PROFILE) };
    return { ok: true, user: auth.user, coachId: auth.user.profileId };
}

function revalidateBoutPaths(boutId: string, fighterId?: string) {
    revalidatePath(routes.coach.bouts);
    revalidatePath(routes.coach.bout(boutId));
    revalidatePath(routes.coach.dashboard);
    if (fighterId) {
        revalidatePath(routes.coach.fighter(fighterId));
    }
}

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

/* ─── Create Bout ─────────────────────────────────────────────────────────── */

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

export async function createBoutAction(_prev: ActionState<{ id: string }>, formData: FormData): Promise<ActionState<{ id: string }>> {
    const auth = await authorizeCoach();
    if (!auth.ok) return auth.state;

    const raw = Object.fromEntries(formData.entries());
    const parsed = createBoutSchema.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);

    const input = parsed.data;
    if (!canAccessFighter(auth.user, input.fighterId)) {
        return actionError(NOT_ON_ROSTER, { fighterId: "Select a fighter from your roster." });
    }

    try {
        const bout = await createBoutService(
            {
                ...input,
                coachId: auth.coachId,
                weighInAt: new Date(input.weighInAt).toISOString(),
                boutAt: new Date(input.boutAt).toISOString(),
            },
            auth.user,
        );

        revalidateBoutPaths(bout.id, bout.fighterId);
        return actionSuccess("Bout created successfully.", { id: bout.id });
    } catch (error: unknown) {
        return actionError(error instanceof Error ? error.message : "Failed to create bout.");
    }
}

/* ─── Update Bout ─────────────────────────────────────────────────────────── */

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

export async function updateBoutAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeCoach();
    if (!auth.ok) return auth.state;

    const raw = Object.fromEntries(formData.entries());
    const parsed = updateBoutSchema.safeParse(raw);
    if (!parsed.success) return validationError(parsed.error);

    const { boutId, ...input } = parsed.data;
    const existing = await getBout(boutId);
    if (!existing || !canAccessFighter(auth.user, existing.fighterId)) {
        return actionError("Bout not found or not on your roster.");
    }

    try {
        await updateBoutService(
            boutId,
            {
                ...input,
                weighInAt: input.weighInAt ? new Date(input.weighInAt).toISOString() : undefined,
                boutAt: input.boutAt ? new Date(input.boutAt).toISOString() : undefined,
            },
            auth.user,
        );

        revalidateBoutPaths(boutId, existing.fighterId);
        return actionSuccess("Bout details updated.");
    } catch (error: unknown) {
        return actionError(error instanceof Error ? error.message : "Failed to update bout.");
    }
}

/* ─── Link Camp Plan ──────────────────────────────────────────────────────── */

export async function linkCampAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeCoach();
    if (!auth.ok) return auth.state;

    const boutId = formData.get("boutId") as string;
    const trainingPlanId = formData.get("trainingPlanId") as string;

    if (!boutId || !trainingPlanId) {
        return actionError("Please select a training camp plan.");
    }

    const existing = await getBout(boutId);
    if (!existing || !canAccessFighter(auth.user, existing.fighterId)) {
        return actionError("Bout not found or not on your roster.");
    }

    try {
        await linkCampService(boutId, trainingPlanId, auth.user);
        revalidateBoutPaths(boutId, existing.fighterId);
        return actionSuccess("Fight camp linked successfully.");
    } catch (error: unknown) {
        return actionError(error instanceof Error ? error.message : "Failed to link fight camp.");
    }
}

/* ─── Enter Fight Week ────────────────────────────────────────────────────── */

export async function enterFightWeekAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeCoach();
    if (!auth.ok) return auth.state;

    const boutId = formData.get("boutId") as string;
    if (!boutId) return actionError("Bout id is required.");

    const existing = await getBout(boutId);
    if (!existing || !canAccessFighter(auth.user, existing.fighterId)) {
        return actionError("Bout not found or not on your roster.");
    }

    try {
        const result = await enterFightWeekService(boutId, auth.user);
        if (!result.ok) {
            if (result.error === "BOUT_REQUIREMENTS_INCOMPLETE") {
                const missingList = [...(result.missing ?? []), ...(result.expiring ?? [])];
                const msg = `Cannot enter fight week: requirements incomplete. Pending items: ${missingList.join(", ")}`;
                return actionError(msg);
            }
            if (result.error === "BOUT_FIGHT_WEEK_TOO_EARLY") {
                return actionError("Too early to enter fight week. Must be within the final week before weigh-in.");
            }
            return actionError(`Failed to enter fight week (${result.error}).`);
        }

        revalidateBoutPaths(boutId, existing.fighterId);
        return actionSuccess("Fighter entered fight week.");
    } catch (error: unknown) {
        return actionError(error instanceof Error ? error.message : "Failed to enter fight week.");
    }
}

/* ─── Cancel Bout ─────────────────────────────────────────────────────────── */

export async function cancelBoutAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeCoach();
    if (!auth.ok) return auth.state;

    const boutId = formData.get("boutId") as string;
    const reason = formData.get("reason") as string;

    if (!boutId || !reason?.trim()) {
        return actionError("A reason for cancelling the bout is required.", { reason: "Enter a cancellation reason." });
    }

    const existing = await getBout(boutId);
    if (!existing || !canAccessFighter(auth.user, existing.fighterId)) {
        return actionError("Bout not found or not on your roster.");
    }

    try {
        await cancelBoutService(boutId, reason.trim(), auth.user);
        revalidateBoutPaths(boutId, existing.fighterId);
        return actionSuccess("Bout has been cancelled.");
    } catch (error: unknown) {
        return actionError(error instanceof Error ? error.message : "Failed to cancel bout.");
    }
}

/* ─── Requirement Actions ─────────────────────────────────────────────────── */

export const addRequirementSchema = z.object({
    boutId: z.string().min(1),
    code: z.string().trim().min(2, "Enter a short code, e.g. BLOOD_TEST.").max(40),
    label: z.string().trim().min(2, "Enter a requirement label.").max(120),
    required: z.coerce.boolean(),
    validityDays: optionalCoercedNumber(z.coerce.number().int().min(1)),
});

export async function addRequirementAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeCoach();
    if (!auth.ok) return auth.state;

    const raw = Object.fromEntries(formData.entries());
    const parsed = addRequirementSchema.safeParse({
        ...raw,
        required: raw.required === "on" || raw.required === "true",
    });
    if (!parsed.success) return validationError(parsed.error);

    const { boutId, ...input } = parsed.data;
    const existing = await getBout(boutId);
    if (!existing || !canAccessFighter(auth.user, existing.fighterId)) {
        return actionError("Bout not found or not on your roster.");
    }

    try {
        const req = await addRequirementService(boutId, input, auth.user);
        if (!req) return actionError("A requirement with this code already exists for this bout.");

        revalidateBoutPaths(boutId, existing.fighterId);
        return actionSuccess("Requirement added to checklist.");
    } catch (error: unknown) {
        return actionError(error instanceof Error ? error.message : "Failed to add requirement.");
    }
}

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

export async function updateRequirementAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeCoach();
    if (!auth.ok) return auth.state;

    const raw = Object.fromEntries(formData.entries());
    const parsed = updateRequirementSchema.safeParse({
        ...raw,
        required: raw.required !== undefined ? raw.required === "on" || raw.required === "true" : undefined,
    });
    if (!parsed.success) return validationError(parsed.error);

    const { boutId, code, ...input } = parsed.data;
    const existing = await getBout(boutId);
    if (!existing || !canAccessFighter(auth.user, existing.fighterId)) {
        return actionError("Bout not found or not on your roster.");
    }

    try {
        await updateRequirementService(
            boutId,
            code,
            {
                ...input,
                issuedOn: input.issuedOn || null,
                validUntil: input.validUntil || null,
            },
            auth.user,
        );

        revalidateBoutPaths(boutId, existing.fighterId);
        return actionSuccess("Requirement updated.");
    } catch (error: unknown) {
        return actionError(error instanceof Error ? error.message : "Failed to update requirement.");
    }
}

export async function removeRequirementAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeCoach();
    if (!auth.ok) return auth.state;

    const boutId = formData.get("boutId") as string;
    const code = formData.get("code") as string;

    if (!boutId || !code) return actionError("Missing requirement parameters.");

    const existing = await getBout(boutId);
    if (!existing || !canAccessFighter(auth.user, existing.fighterId)) {
        return actionError("Bout not found or not on your roster.");
    }

    try {
        await removeRequirementService(boutId, code, auth.user);
        revalidateBoutPaths(boutId, existing.fighterId);
        return actionSuccess("Requirement removed.");
    } catch (error: unknown) {
        return actionError(error instanceof Error ? error.message : "Failed to remove requirement.");
    }
}
