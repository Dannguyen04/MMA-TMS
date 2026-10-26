"use server";

import { cookies } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { ApiError, apiRequest } from "@/lib/api/client";
import { ACCESS_TOKEN_COOKIE, THEME_COOKIE, isDemoAuthEnabled, parseTheme } from "@/lib/auth/constants";
import { clearSessionCookies, setSessionCookies } from "@/lib/auth/session-cookies";
import { requestPasswordRecovery, resetPassword } from "@/lib/auth/password-recovery";
import { getSessionAccount, type SessionAccount } from "@/lib/auth/session";
import { sessionTokensSchema } from "@/lib/auth/session-tokens";
import { PASSWORD_SET_NOTICE, openApplication } from "@/lib/domain/admissions";
import type { Role } from "@/lib/domain/types";
import { hrefWith } from "@/lib/query";
import { dashboardPath, roleForPath, routes, safeRedirectPath } from "@/lib/routes";
import { listOwnApplications } from "@/lib/services/admissions";
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

const TOO_MANY_ATTEMPTS = "Too many attempts in a short time. Wait a minute, then try again.";

function loginError(error: unknown): ActionState {
    if (error instanceof ApiError && (error.status === 400 || error.status === 401)) {
        return actionError("That email and password combination is incorrect.");
    }
    if (error instanceof ApiError && error.status === 429) return actionError(TOO_MANY_ATTEMPTS);
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

/* ─── Applicants: email code ──────────────────────────────────────────────── */

/** The service lowercases the email but doesn't trim it, so both happen here. */
const applicantEmail = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address."));
const ADMISSION_CODE_FORMAT = "Enter the code from the email: 6 to 10 digits.";

/** Refusals of the email-code routes, on the field the person can fix. */
function admissionCodeError(error: unknown, field: "email" | "token"): ActionState<never> {
    if (!(error instanceof ApiError)) return actionError("Something went wrong. Please try again.");
    if (error.status === 429) return actionError(TOO_MANY_ATTEMPTS);
    const fieldMessages: Record<number, [string, string]> = {
        401: ["token", "That code is wrong, has expired or was already used. Send a new code. Staff and fighters sign in with their password."],
        409: ["email", "This email belongs to an account that signs in another way. Sign in with your password, or contact the academy."],
        422: [field, field === "email" ? "Enter a valid email address." : ADMISSION_CODE_FORMAT],
    };
    const known = fieldMessages[error.status ?? 0];
    if (known) return actionError(known[1], { [known[0]]: known[1] });
    return actionError("The sign-in service isn't answering right now. Try again in a few minutes.");
}

/**
 * Emails a sign-in code to someone applying to train, or coming back to their application. The reply is the same
 * whether or not the email can apply, so the form never reveals which accounts exist.
 */
export async function requestAdmissionCodeAction(_prev: ActionState<{ email: string }>, formData: FormData): Promise<ActionState<{ email: string }>> {
    const parsed = z.object({ email: applicantEmail }).safeParse({ email: formData.get("email") });
    if (!parsed.success) return validationError(parsed.error);
    const { email } = parsed.data;

    if (isDemoAuthEnabled()) {
        const { DEMO_ADMISSION_CODE } = await import("@/lib/auth/demo-session");
        return actionSuccess(`Demo mode doesn't send email. Use the code ${DEMO_ADMISSION_CODE}.`, { email });
    }
    try {
        await apiRequest("/auth/admission/email-code", z.object({ requested: z.literal(true) }), { method: "POST", body: JSON.stringify({ email }) });
    } catch (error) {
        return admissionCodeError(error, "email");
    }
    return actionSuccess("If this email can apply, a code is on its way. It can take a minute to arrive.", { email });
}

/** Signs the applicant in with the emailed code (a first one creates their applicant account) and opens their application. */
export async function verifyAdmissionCodeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const parsed = z
        .object({ email: applicantEmail, token: z.string().trim().regex(/^\d{6,10}$/, ADMISSION_CODE_FORMAT) })
        .safeParse({ email: formData.get("email"), token: formData.get("token") });
    if (!parsed.success) return validationError(parsed.error);
    const { email } = parsed.data;

    if (isDemoAuthEnabled()) {
        const demo = await (await import("@/lib/auth/demo-session")).signInDemoApplicantWithCode(email, parsed.data.token);
        if (!demo.ok) return actionError(demo.message, { token: demo.message });
        redirect(routes.apply);
    }
    let auth: z.output<typeof authResponseSchema>;
    try {
        auth = await apiRequest("/auth/admission/verify-email", authResponseSchema, { method: "POST", body: JSON.stringify({ email, token: parsed.data.token }) });
    } catch (error) {
        return admissionCodeError(error, "token");
    }
    await setSessionCookies(auth.session);
    redirect(routes.apply);
}

/* ─── Passwords ───────────────────────────────────────────────────────────── */

/** A new password typed twice, as the reset form asks for it. */
const choosePassword = {
    newPassword: passwordText("Choose a password."),
    confirmPassword: z.string(),
};
const passwordsMatch = (data: { newPassword: string; confirmPassword: string }) => data.newPassword === data.confirmPassword;
const PASSWORDS_DIFFER = { path: ["confirmPassword"], error: "The passwords don't match." };

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

/** `?notice=` on the sign-in page: a new password was set, either after "forgot password" or for an approved applicant. */
export type SignInNotice = "password-updated" | "activation-ready";

/**
 * Whether this browser is still signed in as the applicant whose activation now only waits for them, so they can
 * activate right away instead of signing in again. Anything unexpected sends them to sign in, which always works.
 */
async function applicantReadyToActivate(): Promise<boolean> {
    try {
        const account = await getSessionAccount();
        if (account?.kind !== "applicant") return false;
        return openApplication(await listOwnApplications(account.applicant))?.activation === "password_set";
    } catch (error) {
        unstable_rethrow(error);
        return false;
    }
}

/**
 * Sets a password from a recovery link: an approved applicant's first one (the service reports that their activation
 * is ready), or a new one for an existing account. Then the person signs in, or goes straight to activation when this
 * browser is still signed in as that applicant.
 */
export async function resetPasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const parsed = resetSchema.safeParse({
        tokenHash: formData.get("tokenHash"),
        newPassword: formData.get("newPassword"),
        confirmPassword: formData.get("confirmPassword"),
    });
    if (!parsed.success) return validationError(parsed.error);
    const result = await resetPassword(parsed.data.tokenHash, parsed.data.newPassword);
    if (!result.ok) return result.field ? actionError(FIX_FIELDS, { [result.field]: result.message }) : actionError(result.message);
    if (!result.admissionActivationReady) redirect(`${routes.login}?notice=${"password-updated" satisfies SignInNotice}`);
    if (await applicantReadyToActivate()) redirect(hrefWith(routes.apply, {}, { notice: PASSWORD_SET_NOTICE }));
    redirect(`${routes.login}?notice=${"activation-ready" satisfies SignInNotice}`);
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
