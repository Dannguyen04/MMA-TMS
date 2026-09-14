"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { DEMO_PASSWORD, isDemoAuthEnabled, SESSION_COOKIE, THEME_COOKIE, parseTheme } from "@/lib/auth/constants";
import { getCurrentUser } from "@/lib/auth/session";
import type { Role, User } from "@/lib/domain/types";
import { db } from "@/lib/mocks/db";
import { dashboardPath, roleForPath, routes, safeRedirectPath } from "@/lib/routes";
import { recordAudit } from "@/lib/services/audit";
import { clamp } from "@/lib/utils";
import { actionError, actionSuccess, validationError, type ActionState } from "./state";

const DEMO_ACCOUNTS: Record<Role, string> = {
    fighter: "u-minh-tran",
    coach: "u-rafael-costa",
    doctor: "u-thu-le",
    admin: "u-nora-whitfield",
};

/** The cookie follows the admin session-timeout setting, kept within 5 minutes and 24 hours. */
const SESSION_TIMEOUT_MIN = { min: 5, max: 1440 };

const signInSchema = z.object({
    email: z.email("Enter a valid email address."),
    password: z.string().min(1, "Enter your password."),
    next: z.string().optional(),
});

const demoSignInSchema = z.object({
    role: z.enum(["fighter", "coach", "doctor", "admin"]),
    next: z.string().nullable().catch(null),
});

/** Why an account can't start a session, or null when it can. */
function assertCanSignIn(user: User): string | null {
    if (user.status === "suspended") return "This account is suspended. Contact your academy administrator.";
    if (user.status === "invited") return "This invitation hasn't been accepted yet. Check your email for the setup link.";
    return null;
}

async function startSession(user: User, next: string | null) {
    const store = await cookies();
    const { min, max } = SESSION_TIMEOUT_MIN;
    store.set(SESSION_COOKIE, user.id, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: clamp(db().settings.sessionTimeoutMin, min, max) * 60,
    });
    user.lastActiveAt = new Date().toISOString();
    recordAudit({ actor: user, action: "auth.sign_in", resourceType: "auth", resourceId: user.id, resourceLabel: user.email });

    const target = safeRedirectPath(next);
    const targetRole = target ? roleForPath(target) : null;
    // Only honour ?next= when it points into an area this role may open.
    redirect(target && (targetRole === null || targetRole === user.role) ? target : dashboardPath(user.role));
}

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
    if (!isDemoAuthEnabled()) return actionError("Sign-in isn't available on this deployment yet.");

    const parsed = signInSchema.safeParse({
        email: formData.get("email"),
        password: formData.get("password"),
        next: formData.get("next") ?? undefined,
    });
    if (!parsed.success) return validationError(parsed.error);

    const email = parsed.data.email.trim().toLowerCase();
    const user = db().users.find((u) => u.email === email);

    if (!user || parsed.data.password !== DEMO_PASSWORD) {
        recordAudit({
            actor: null,
            action: "auth.sign_in",
            resourceType: "auth",
            resourceId: email,
            resourceLabel: email,
            status: "failure",
            details: "Invalid credentials",
        });
        return actionError("That email and password combination is incorrect.");
    }
    const blocked = assertCanSignIn(user);
    if (blocked) return actionError(blocked);

    await startSession(user, parsed.data.next ?? null);
    return actionSuccess("Signed in.");
}

/** One-click demo sign-in. Arguments arrive from the client, so both are re-validated here. */
export async function signInAsDemo(role: Role, next: string | null): Promise<void> {
    const parsed = demoSignInSchema.safeParse({ role, next });
    if (!parsed.success || !isDemoAuthEnabled()) redirect(routes.login);

    const user = db().users.find((u) => u.id === DEMO_ACCOUNTS[parsed.data.role]);
    if (!user || assertCanSignIn(user)) redirect(routes.login);
    await startSession(user, parsed.data.next);
}

const forgotSchema = z.object({ email: z.email("Enter a valid email address.") });

export async function requestPasswordReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const parsed = forgotSchema.safeParse({ email: formData.get("email") });
    if (!parsed.success) return validationError(parsed.error);
    // Always respond the same way so the form can't be used to discover accounts.
    return actionSuccess(`If ${parsed.data.email} belongs to an account, a reset link is on its way. It expires in 30 minutes.`);
}

export async function signOut(): Promise<void> {
    const user = await getCurrentUser();
    const store = await cookies();
    store.delete(SESSION_COOKIE);
    if (user) {
        recordAudit({ actor: user, action: "auth.sign_out", resourceType: "auth", resourceId: user.id, resourceLabel: user.email });
    }
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
