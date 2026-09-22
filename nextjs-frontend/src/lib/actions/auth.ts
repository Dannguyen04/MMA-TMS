"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { ApiError, apiRequest } from "@/lib/api/client";
import { ACCESS_TOKEN_COOKIE, THEME_COOKIE, parseTheme } from "@/lib/auth/constants";
import { clearSessionCookies, setSessionCookies } from "@/lib/auth/session-cookies";
import { sessionTokensSchema } from "@/lib/auth/session-tokens";
import type { Role } from "@/lib/domain/types";
import { dashboardPath, roleForPath, routes, safeRedirectPath } from "@/lib/routes";
import { actionError, actionSuccess, validationError, type ActionState } from "./state";

const signInSchema = z.object({
    email: z.email("Enter a valid email address."),
    password: z.string().min(1, "Enter your password."),
    next: z.string().optional(),
});

const authResponseSchema = z.object({
    user: z.object({
        id: z.string().uuid(),
        authSubject: z.string(),
        email: z.email(),
        role: z.enum(["FIGHTER", "COACH", "DOCTOR", "ADMIN"]),
    }),
    session: sessionTokensSchema.extend({ tokenType: z.string() }),
});

function loginError(error: unknown): ActionState {
    if (error instanceof ApiError && (error.status === 400 || error.status === 401)) {
        return actionError("That email and password combination is incorrect.");
    }
    if (error instanceof ApiError) return actionError(error.message);
    return actionError("Sign-in failed. Please try again.");
}

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const parsed = signInSchema.safeParse({
        email: formData.get("email"),
        password: formData.get("password"),
        next: formData.get("next") ?? undefined,
    });
    if (!parsed.success) return validationError(parsed.error);

    let auth: z.output<typeof authResponseSchema>;
    try {
        auth = await apiRequest("/auth/login", authResponseSchema, {
            method: "POST",
            body: JSON.stringify({ email: parsed.data.email.trim().toLowerCase(), password: parsed.data.password }),
        });
    } catch (error) {
        return loginError(error);
    }

    await setSessionCookies(auth.session);
    const role = auth.user.role.toLowerCase() as Role;
    const target = safeRedirectPath(parsed.data.next ?? null);
    const targetRole = target ? roleForPath(target) : null;
    redirect(target && (targetRole === null || targetRole === role) ? target : dashboardPath(role));
}

/** Tài khoản demo không được nhập vào luồng xác thực thật. */
export async function signInAsDemo(_role: Role, _next: string | null): Promise<void> {
    void _role;
    void _next;
    redirect(routes.login);
}

const forgotSchema = z.object({ email: z.email("Enter a valid email address.") });

export async function requestPasswordReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const parsed = forgotSchema.safeParse({ email: formData.get("email") });
    if (!parsed.success) return validationError(parsed.error);
    try {
        await apiRequest("/auth/password-reset/request", z.unknown(), {
            method: "POST",
            body: JSON.stringify({ email: parsed.data.email.trim().toLowerCase() }),
        });
    } catch (error) {
        if (!(error instanceof ApiError)) return actionError("Password reset is unavailable. Please try again later.");
        return actionError(error.status === 404 ? "Password reset is not available on this server yet." : error.message);
    }
    return actionSuccess("If that email belongs to an account, reset instructions are on the way.");
}

export async function signOut(): Promise<void> {
    const store = await cookies();
    const accessToken = store.get(ACCESS_TOKEN_COOKIE)?.value;
    if (accessToken) {
        try {
            await apiRequest("/auth/logout", z.object({ loggedOut: z.literal(true) }), { method: "POST", accessToken });
        } catch {
            // Việc thu hồi phía máy chủ là best effort; cookie cục bộ luôn bị xóa.
        }
    }
    await clearSessionCookies();
    redirect(routes.login);
}

export async function setThemePreference(formData: FormData): Promise<void> {
    const store = await cookies();
    store.set(THEME_COOKIE, parseTheme(String(formData.get("theme") ?? "")), {
        path: "/",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
    });
}
