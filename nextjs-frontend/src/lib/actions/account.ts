"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { BODY_METRIC_LIMITS, NAME_MAX_LENGTH, PHONE_MAX_LENGTH, type MeasurementLimit } from "@/components/account/account-limits";
import { canAccessFighter } from "@/lib/auth/access";
import { getCurrentUser } from "@/lib/auth/session";
import { formatNumber } from "@/lib/format";
import { updateFighterProfile, updateOwnProfile } from "@/lib/services/people";
import { actionError, actionSuccess, validationError, type ActionState } from "./state";

/**
 * Self-service account actions. Being signed in is the only requirement (no role permission
 * covers your own account); fighters may also log their own body metrics. No action accepts a
 * user or fighter id from the client — the target is always the signed-in account.
 */

const SESSION_EXPIRED = "Your session has expired. Sign in again.";

/* ─── Parsing ─────────────────────────────────────────────────────────────── */

const PHONE_PATTERN = /^\+?[0-9\s().-]+$/;

const profileSchema = z.object({
    name: z
        .string({ error: "Enter your full name." })
        .trim()
        .min(2, "Enter your full name (at least 2 characters).")
        .max(NAME_MAX_LENGTH, `Keep your name under ${NAME_MAX_LENGTH} characters.`),
    phone: z
        .string()
        .trim()
        .max(PHONE_MAX_LENGTH, `Keep the phone number under ${PHONE_MAX_LENGTH} characters.`)
        .refine((value) => value === "" || PHONE_PATTERN.test(value), "Use digits and spaces, with an optional leading +.")
        .refine((value) => value === "" || value.replace(/\D/g, "").length >= 7, "Enter a phone number with at least 7 digits."),
});

function measurement(label: string, unit: string, { min, max, step }: MeasurementLimit) {
    const decimals = step < 1 ? 1 : 0;
    return z
        .string({ error: `Enter your ${label}.` })
        .trim()
        .min(1, `Enter your ${label}.`)
        .transform(Number)
        .refine(Number.isFinite, `Your ${label} must be a number.`)
        .refine((value) => value >= min && value <= max, `Enter a ${label} between ${formatNumber(min)} and ${formatNumber(max)} ${unit}.`)
        .transform((value) => Number(value.toFixed(decimals)));
}

const bodyMetricsSchema = z.object({
    weightKg: measurement("weight", "kg", BODY_METRIC_LIMITS.weightKg),
    bodyFatPct: measurement("body fat", "%", BODY_METRIC_LIMITS.bodyFatPct),
    restingHeartRate: measurement("resting heart rate", "bpm", BODY_METRIC_LIMITS.restingHeartRate),
});

function text(formData: FormData, name: string): string | undefined {
    const value = formData.get(name);
    return typeof value === "string" ? value : undefined;
}

/* ─── Actions ─────────────────────────────────────────────────────────────── */

export interface ProfileUpdateResult {
    changed: boolean;
}

export async function updateProfileAction(_prev: ActionState<ProfileUpdateResult>, formData: FormData): Promise<ActionState<ProfileUpdateResult>> {
    const user = await getCurrentUser();
    if (!user) return actionError(SESSION_EXPIRED);

    const parsed = profileSchema.safeParse({ name: text(formData, "name"), phone: text(formData, "phone") ?? "" });
    if (!parsed.success) return validationError(parsed.error);

    const { name, phone } = parsed.data;
    if (name === user.name && (phone || null) === user.phone) {
        return actionSuccess("Your name and phone number already match what's saved.", { changed: false });
    }

    const result = await updateOwnProfile(user.id, { name, phone }, user);
    if (!result.ok) return actionError(result.message);

    revalidatePath("/", "layout");
    return actionSuccess("Your name and phone number are updated everywhere your team sees them.", { changed: true });
}

export async function updateBodyMetricsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const user = await getCurrentUser();
    if (!user) return actionError(SESSION_EXPIRED);
    if (user.role !== "fighter") return actionError("Only fighters can log their own body metrics.");

    const parsed = bodyMetricsSchema.safeParse({
        weightKg: text(formData, "weightKg"),
        bodyFatPct: text(formData, "bodyFatPct"),
        restingHeartRate: text(formData, "restingHeartRate"),
    });
    if (!parsed.success) return validationError(parsed.error);

    if (!user.profileId || !canAccessFighter(user, user.profileId)) {
        return actionError("Your account isn't linked to a fighter profile yet. Ask an administrator to link it.");
    }

    const result = await updateFighterProfile(user.profileId, parsed.data, user);
    if (!result.ok) return actionError(result.message);

    revalidatePath("/", "layout");
    const { weightKg, bodyFatPct, restingHeartRate } = result.fighter;
    return actionSuccess(
        `${formatNumber(weightKg, 1)} kg · ${formatNumber(bodyFatPct, 1)}% body fat · ${restingHeartRate} bpm resting. Your coaches now see these numbers.`,
    );
}

export async function requestPasswordResetEmail(): Promise<ActionState> {
    const user = await getCurrentUser();
    if (!user) return actionError(SESSION_EXPIRED);
    return actionSuccess(`We sent a reset link to ${user.email}. It expires in 30 minutes.`);
}
