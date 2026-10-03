"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { ApiError, apiRequest } from "@/lib/api/client";
import { ACCESS_TOKEN_COOKIE, THEME_COOKIE, isDemoAuthEnabled, parseTheme } from "@/lib/auth/constants";
import { clearSessionCookies, setSessionCookies } from "@/lib/auth/session-cookies";
import { requestPasswordRecovery, resetPassword } from "@/lib/auth/password-recovery";
import type { SessionAccount } from "@/lib/auth/session";
import { sessionTokensSchema } from "@/lib/auth/session-tokens";
import type { Role } from "@/lib/domain/types";
import { dashboardPath, roleForPath, routes, safeRedirectPath } from "@/lib/routes";
import { passwordText } from "./form-helpers";
import { actionError, actionSuccess, FIX_FIELDS, validationError, type ActionState } from "./state";

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
        role: z.enum(["FIGHTER", "COACH", "DOCTOR", "ADMIN", "GUEST"]),
    }),
    session: sessionTokensSchema.extend({ tokenType: z.string() }),
});

/** Where sign-in leads: an academy role's area, or the application page for a self-registered applicant. */
type SignInRole = Role | "applicant";

const signInRole = (account: SessionAccount): SignInRole => (account.kind === "user" ? account.user.role : "applicant");

function loginError(error: unknown): ActionState {
    if (error instanceof ApiError && (error.status === 400 || error.status === 401)) {
        return actionError("That email and password combination is incorrect.");
    }
    if (error instanceof ApiError) return actionError(error.message);
    return actionError("Sign-in failed. Please try again.");
}

/** Chỉ theo `?next=` khi nó trỏ vào khu vực vai trò này được mở. Applicants always land on their application. */
function redirectAfterSignIn(role: SignInRole, next: string | null): never {
    if (role === "applicant") redirect(routes.apply);
    const target = safeRedirectPath(next);
    const targetRole = target ? roleForPath(target) : null;
    redirect(target && (targetRole === null || targetRole === role) ? target : dashboardPath(role));
}

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const parsed = signInSchema.safeParse({
        email: formData.get("email"),
        password: formData.get("password"),
        next: formData.get("next") ?? undefined,
    });
    if (!parsed.success) return validationError(parsed.error);
    const email = parsed.data.email.trim().toLowerCase();

    if (isDemoAuthEnabled()) {
        const demo = await (await import("@/lib/auth/demo-session")).signInDemoWithPassword(email, parsed.data.password);
        if (!demo.ok) return actionError(demo.message);
        redirectAfterSignIn(signInRole(demo.account), parsed.data.next ?? null);
    }

    let auth: z.output<typeof authResponseSchema>;
    try {
        auth = await apiRequest("/auth/login", authResponseSchema, {
            method: "POST",
            body: JSON.stringify({ email, password: parsed.data.password }),
        });
    } catch (error) {
        return loginError(error);
    }

    await setSessionCookies(auth.session);
    redirectAfterSignIn(auth.user.role === "GUEST" ? "applicant" : (auth.user.role.toLowerCase() as Role), parsed.data.next ?? null);
}

const demoSignInSchema = z.object({
    role: z.enum(["fighter", "coach", "doctor", "admin", "applicant"]),
    next: z.string().nullable().catch(null),
});

/** Đăng nhập một chạm bằng tài khoản demo; tham số đến từ client nên được kiểm tra lại. */
export async function signInAsDemo(role: SignInRole, next: string | null): Promise<void> {
    const parsed = demoSignInSchema.safeParse({ role, next });
    if (!parsed.success || !isDemoAuthEnabled()) redirect(routes.login);
    const demo = await (await import("@/lib/auth/demo-session")).signInDemoAccount(parsed.data.role);
    if (!demo.ok) redirect(routes.login);
    redirectAfterSignIn(signInRole(demo.account), parsed.data.next);
}

/** A new password typed twice, as both the registration and the reset forms ask for it. */
const choosePassword = {
    newPassword: passwordText("Choose a password."),
    confirmPassword: z.string(),
};
const passwordsMatch = (data: { newPassword: string; confirmPassword: string }) => data.newPassword === data.confirmPassword;
const PASSWORDS_DIFFER = { path: ["confirmPassword"], error: "The passwords don't match." };

const registerSchema = z.object({ email: z.email("Enter a valid email address."), ...choosePassword }).refine(passwordsMatch, PASSWORDS_DIFFER);

const registrationSchema = z.object({ session: sessionTokensSchema.extend({ tokenType: z.string() }).nullable(), confirmationRequired: z.boolean() });

function registrationError(error: unknown): ActionState {
    if (error instanceof ApiError && error.status === 409) {
        const message = "We couldn't register this email. It may already have an account: sign in, or reset your password.";
        return actionError(message, { email: message });
    }
    if (error instanceof ApiError && (error.status ?? 500) < 500) return actionError(error.message);
    return actionError("Registration failed. Please try again.");
}

/**
 * Registers someone who wants to train at the academy. The account can only apply until an administrator approves
 * the application and the fighter account is activated. When the auth service asks for the email to be confirmed
 * first, the person signs in after confirming.
 */
export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const parsed = registerSchema.safeParse({
        email: formData.get("email"),
        newPassword: formData.get("newPassword"),
        confirmPassword: formData.get("confirmPassword"),
    });
    if (!parsed.success) return validationError(parsed.error);
    const email = parsed.data.email.trim().toLowerCase();

    if (isDemoAuthEnabled()) {
        const demo = await (await import("@/lib/auth/demo-session")).registerDemoApplicant(email);
        if (!demo.ok) return actionError(demo.message, { email: demo.message });
        redirect(routes.apply);
    }

    let registered: z.output<typeof registrationSchema>;
    try {
        registered = await apiRequest("/auth/register", registrationSchema, {
            method: "POST",
            body: JSON.stringify({ email, password: parsed.data.newPassword }),
        });
    } catch (error) {
        return registrationError(error);
    }
    if (!registered.session) redirect(`${routes.login}?notice=${"confirm-email" satisfies SignInNotice}`);
    await setSessionCookies(registered.session);
    redirect(routes.apply);
}

const forgotSchema = z.object({ email: z.email("Enter a valid email address.") });

export async function requestPasswordReset(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const parsed = forgotSchema.safeParse({ email: formData.get("email") });
    if (!parsed.success) return validationError(parsed.error);
    // Luôn trả lời giống nhau để form không lộ tài khoản nào tồn tại.
    const result = await requestPasswordRecovery(parsed.data.email);
    if (!result.ok) return actionError(result.message);
    return actionSuccess("If that email belongs to an account, reset instructions are on the way.");
}

const resetSchema = z
    .object({
        tokenHash: z.string().min(16, "This link is incomplete. Open it again from the email.").max(512, "This link is incomplete. Open it again from the email."),
        ...choosePassword,
    })
    .refine(passwordsMatch, PASSWORDS_DIFFER);

/** `?notice=` on the sign-in page: a new password was set, or a new account must confirm its email first. */
export type SignInNotice = "password-updated" | "activation-ready" | "confirm-email";

/** Sets a new password from a recovery link, then sends the person to sign in. */
export async function resetPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const parsed = resetSchema.safeParse({
        tokenHash: formData.get("tokenHash"),
        newPassword: formData.get("newPassword"),
        confirmPassword: formData.get("confirmPassword"),
    });
    if (!parsed.success) return validationError(parsed.error);
    const result = await resetPassword(parsed.data.tokenHash, parsed.data.newPassword);
    if (!result.ok) return result.field ? actionError(FIX_FIELDS, { [result.field]: result.message }) : actionError(result.message);
    const notice: SignInNotice = result.admissionActivationReady ? "activation-ready" : "password-updated";
    redirect(`${routes.login}?notice=${notice}`);
}

export async function signOut(): Promise<void> {
    if (isDemoAuthEnabled()) {
        await (await import("@/lib/auth/demo-session")).endDemoSession();
        redirect(routes.login);
    }
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
