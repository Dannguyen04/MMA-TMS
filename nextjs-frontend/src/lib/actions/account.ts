"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { BODY_METRIC_LIMITS, NAME_MAX_LENGTH, PHONE_MAX_LENGTH, type MeasurementLimit } from "@/components/account/account-limits";
import { canAccessFighter } from "@/lib/auth/access";
import { requestPasswordRecovery } from "@/lib/auth/password-recovery";
import { getCurrentUser } from "@/lib/auth/session";
import { formatNumber } from "@/lib/format";
import { getTranslator } from "@/lib/i18n/server";
import type { Translator } from "@/lib/i18n/translate";
import { updateFighterProfile, updateOwnProfile } from "@/lib/services/people";
import { PLATFORM_FEATURE_UNAVAILABLE_MESSAGE, platformFeatureAvailable } from "@/lib/services/platform-features";
import { actionError, actionSuccess, validationError, type ActionState } from "./state";

/**
 * Self-service account actions. Being signed in is the only requirement (no role permission
 * covers your own account); fighters may also log their own body metrics. No action accepts a
 * user or fighter id from the client — the target is always the signed-in account.
 */

const PHONE_PATTERN = /^\+?[0-9\s().-]+$/;

function makeProfileSchema(t: Translator) {
    return z.object({
        name: z
            .string({ error: t("account.profile.enterName") })
            .trim()
            .min(2, t("account.profile.nameMinLength"))
            .max(NAME_MAX_LENGTH, t("account.profile.nameMaxLength", { max: NAME_MAX_LENGTH })),
        phone: z
            .string()
            .trim()
            .max(PHONE_MAX_LENGTH, t("account.profile.phoneMaxLength", { max: PHONE_MAX_LENGTH }))
            .refine((value) => value === "" || PHONE_PATTERN.test(value), t("account.profile.phonePattern"))
            .refine((value) => value === "" || value.replace(/\D/g, "").length >= 7, t("account.profile.phoneMinDigits")),
    });
}

function measurement(label: string, unit: string, { min, max, step }: MeasurementLimit, t: Translator) {
    const decimals = step < 1 ? 1 : 0;
    return z
        .string({ error: t("account.bodyMetrics.errorEnter", { label }) })
        .trim()
        .min(1, t("account.bodyMetrics.errorEnter", { label }))
        .transform(Number)
        .refine(Number.isFinite, t("account.bodyMetrics.errorNumber", { label }))
        .refine((value) => value >= min && value <= max, t("account.bodyMetrics.errorRange", { label, min: formatNumber(min), max: formatNumber(max), unit }))
        .transform((value) => Number(value.toFixed(decimals)));
}

function makeBodyMetricsSchema(t: Translator) {
    return z.object({
        weightKg: measurement(t("account.bodyMetrics.weightKg"), "kg", BODY_METRIC_LIMITS.weightKg, t),
        bodyFatPct: measurement(t("account.bodyMetrics.bodyFat"), "%", BODY_METRIC_LIMITS.bodyFatPct, t),
        restingHeartRate: measurement(t("account.bodyMetrics.restingHeartRate"), "bpm", BODY_METRIC_LIMITS.restingHeartRate, t),
    });
}

function text(formData: FormData, name: string): string | undefined {
    const value = formData.get(name);
    return typeof value === "string" ? value : undefined;
}

/* ─── Actions ─────────────────────────────────────────────────────────────── */

export interface ProfileUpdateResult {
    changed: boolean;
}

export async function updateProfileAction(_prev: ActionState<ProfileUpdateResult>, formData: FormData): Promise<ActionState<ProfileUpdateResult>> {
    const [user, { t }] = await Promise.all([getCurrentUser(), getTranslator()]);
    if (!user) return actionError(t("account.error.sessionExpired"));
    if (!platformFeatureAvailable("selfProfileEdit")) return actionError(PLATFORM_FEATURE_UNAVAILABLE_MESSAGE);

    const schema = makeProfileSchema(t);
    const parsed = schema.safeParse({ name: text(formData, "name"), phone: text(formData, "phone") ?? "" });
    if (!parsed.success) return validationError(parsed.error);

    const { name, phone } = parsed.data;
    if (name === user.name && (phone || null) === user.phone) {
        return actionSuccess(t("account.profile.noChangesSaved"), { changed: false });
    }

    const result = await updateOwnProfile(user.id, { name, phone }, user);
    if (!result.ok) return actionError(result.message);

    revalidatePath("/", "layout");
    return actionSuccess(t("account.profile.savedSuccess"), { changed: true });
}

export async function updateBodyMetricsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const [user, { t }] = await Promise.all([getCurrentUser(), getTranslator()]);
    if (!user) return actionError(t("account.error.sessionExpired"));
    if (user.role !== "fighter") return actionError(t("account.bodyMetrics.errorOnlyFighters"));
    if (!platformFeatureAvailable("bodyMetrics")) return actionError(PLATFORM_FEATURE_UNAVAILABLE_MESSAGE);

    const schema = makeBodyMetricsSchema(t);
    const parsed = schema.safeParse({
        weightKg: text(formData, "weightKg"),
        bodyFatPct: text(formData, "bodyFatPct"),
        restingHeartRate: text(formData, "restingHeartRate"),
    });
    if (!parsed.success) return validationError(parsed.error);

    if (!user.profileId || !canAccessFighter(user, user.profileId)) {
        return actionError(t("account.bodyMetrics.errorNoProfile"));
    }

    const result = await updateFighterProfile(user.profileId, parsed.data, user);
    if (!result.ok) return actionError(result.message);

    revalidatePath("/", "layout");
    const { weightKg, bodyFatPct, restingHeartRate } = parsed.data;
    return actionSuccess(
        t("account.bodyMetrics.savedSuccess", {
            weight: formatNumber(weightKg, 1),
            bodyFat: formatNumber(bodyFatPct, 1),
            bpm: restingHeartRate,
        }),
    );
}

export async function requestPasswordResetEmail(): Promise<ActionState> {
    const [user, { t }] = await Promise.all([getCurrentUser(), getTranslator()]);
    if (!user) return actionError(t("account.error.sessionExpired"));
    const result = await requestPasswordRecovery(user.email);
    if (!result.ok) return actionError(result.message);
    return actionSuccess(t("account.security.resetEmailSuccessMessage", { email: user.email }));
}
