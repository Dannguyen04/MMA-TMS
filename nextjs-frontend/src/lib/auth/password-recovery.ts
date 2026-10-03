import "server-only";

import { z } from "zod";

import { ApiError, apiRequest } from "@/lib/api/client";
import { isDemoAuthEnabled } from "./constants";

/**
 * Password recovery against the auth service. The service answers the same whether or not the email belongs to an
 * account, so callers never learn which accounts exist. Demo mode sends nothing.
 */

export type RecoveryResult = { ok: true } | { ok: false; message: string };

/** Asks the service to email a link for choosing a new password. */
export async function requestPasswordRecovery(email: string): Promise<RecoveryResult> {
    if (isDemoAuthEnabled()) return { ok: true };
    try {
        await apiRequest("/auth/forgot-password", z.object({ requested: z.literal(true) }), {
            method: "POST",
            body: JSON.stringify({ email: email.trim().toLowerCase() }),
        });
        return { ok: true };
    } catch (error) {
        if (error instanceof ApiError && error.status === 429) return { ok: false, message: "Too many requests. Wait a minute, then try again." };
        return { ok: false, message: "Password reset is unavailable right now. Please try again later." };
    }
}

export type ResetResult =
    | { ok: true; admissionActivationReady: boolean }
    | { ok: false; message: string; field?: "newPassword" };

const resetResponseSchema = z.object({ passwordUpdated: z.literal(true), admissionActivationReady: z.boolean() });

const RESET_FAILURES: Record<string, ResetResult & { ok: false }> = {
    RESET_PASSWORD_SAME_AS_CURRENT: { ok: false, message: "Choose a password you haven't used for this account.", field: "newPassword" },
    RESET_PASSWORD_TOO_WEAK: { ok: false, message: "That password is too easy to guess. Use a longer one with a mix of words, numbers or symbols.", field: "newPassword" },
};

/** Sets a new password from the `token_hash` in a recovery link. Demo mode accepts it without a service. */
export async function resetPassword(tokenHash: string, newPassword: string): Promise<ResetResult> {
    if (isDemoAuthEnabled()) return { ok: true, admissionActivationReady: false };
    try {
        const result = await apiRequest("/auth/reset-password", resetResponseSchema, { method: "POST", body: JSON.stringify({ tokenHash, newPassword }) });
        return { ok: true, admissionActivationReady: result.admissionActivationReady };
    } catch (error) {
        if (!(error instanceof ApiError)) throw error;
        // A link the service can't verify (expired, used, or a malformed token) is refused the same way.
        if (error.status === 401 || error.status === 400 || error.code === "VALIDATION_ERROR") {
            return { ok: false, message: "This link has expired or was already used. Request a new one." };
        }
        if (error.status === 429) return { ok: false, message: "Too many attempts. Wait a minute, then try again." };
        return RESET_FAILURES[error.code] ?? { ok: false, message: "Your password couldn't be changed right now. Please try again later." };
    }
}
