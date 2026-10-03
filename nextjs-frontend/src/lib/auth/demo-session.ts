import "server-only";

import { cookies } from "next/headers";

import type { Applicant } from "@/lib/domain/admissions";
import type { Role, User } from "@/lib/domain/types";
import { clamp } from "@/lib/utils";
import { DEMO_PASSWORD, DEMO_SESSION_COOKIE, isDemoAuthEnabled } from "./constants";
import type { SessionAccount } from "./session";

/**
 * Phiên demo ngoài production: cookie chỉ lưu id người dùng trong mock DB. Cookie không được ký,
 * nên mọi hàm ở đây từ chối khi demo tắt. Mock DB chỉ được nạp động để API mode không bao giờ
 * import dữ liệu demo.
 */

export const DEMO_ACCOUNTS: Record<Role, string> = {
    fighter: "u-minh-tran",
    coach: "u-rafael-costa",
    doctor: "u-thu-le",
    admin: "u-nora-whitfield",
};

/** The applicant demo account, who hasn't applied yet. */
export const DEMO_APPLICANT = "a-quang-ho";

/** Theo thiết lập session-timeout của admin demo, giới hạn trong 5 phút tới 24 giờ. */
const SESSION_TIMEOUT_MIN = { min: 5, max: 1440 };

async function demoStore() {
    return (await import("@/lib/mocks/db")).db();
}

async function recordDemoAudit(actor: User | Applicant | null, action: string, subject: string, failure?: string) {
    const { recordAudit } = await import("@/lib/services/audit.demo");
    recordAudit({
        // Applicants aren't academy members, so their own sign-ins are recorded without an actor.
        actor: actor && "role" in actor ? actor : null,
        action,
        resourceType: "auth",
        resourceId: subject,
        resourceLabel: subject,
        ...(failure ? { status: "failure" as const, details: failure } : {}),
    });
}

/** Người dùng demo kèm quyền theo vai trò và phạm vi võ sĩ được phân công, như backend trả về. */
function withDemoAccess(user: User, store: Awaited<ReturnType<typeof demoStore>>): User {
    const permissions = store.roleDefinitions.find((r) => r.role === user.role)?.permissions ?? [];
    const fighterIds =
        user.role === "coach"
            ? store.coaches.find((c) => c.id === user.profileId)?.fighterIds
            : user.role === "doctor"
              ? store.doctors.find((d) => d.id === user.profileId)?.fighterIds
              : undefined;
    return { ...user, effectiveCapabilities: [...permissions], ...(fighterIds ? { assignmentScope: { fighterIds: [...fighterIds] } } : {}) };
}

/** The signed-in demo member or applicant; the cookie holds the account id. */
export async function readDemoAccount(): Promise<SessionAccount | null> {
    if (!isDemoAuthEnabled()) return null;
    const accountId = (await cookies()).get(DEMO_SESSION_COOKIE)?.value;
    if (!accountId) return null;
    const store = await demoStore();
    const user = store.users.find((u) => u.id === accountId);
    if (user) return user.status === "active" ? { kind: "user", user: withDemoAccess(user, store) } : null;
    const applicant = store.applicants.find((a) => a.id === accountId);
    return applicant ? { kind: "applicant", applicant } : null;
}

export async function readDemoUser(): Promise<User | null> {
    const account = await readDemoAccount();
    return account?.kind === "user" ? account.user : null;
}

/** Lý do tài khoản demo không thể đăng nhập, hoặc null khi được phép. */
function signInBlocker(user: User): string | null {
    if (user.status === "suspended") return "This account is suspended. Contact your academy administrator.";
    if (user.status === "invited") return "This invitation hasn't been accepted yet. Check your email for the setup link.";
    return null;
}

export type DemoSignInResult = { ok: true; account: SessionAccount } | { ok: false; message: string };

async function startDemoSession(account: User | Applicant, store: Awaited<ReturnType<typeof demoStore>>): Promise<void> {
    const { min, max } = SESSION_TIMEOUT_MIN;
    (await cookies()).set(DEMO_SESSION_COOKIE, account.id, {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        path: "/",
        maxAge: clamp(store.settings.sessionTimeoutMin, min, max) * 60,
    });
    if ("role" in account) account.lastActiveAt = new Date().toISOString();
    await recordDemoAudit(account, "auth.sign_in", account.email);
}

export async function signInDemoWithPassword(email: string, password: string): Promise<DemoSignInResult> {
    if (!isDemoAuthEnabled()) return { ok: false, message: "Demo sign-in is not available." };
    const store = await demoStore();
    const user = store.users.find((u) => u.email === email);
    const applicant = store.applicants.find((a) => a.email === email);
    if (password === DEMO_PASSWORD && user) {
        const blocked = signInBlocker(user);
        if (blocked) return { ok: false, message: blocked };
        await startDemoSession(user, store);
        return { ok: true, account: { kind: "user", user } };
    }
    if (password === DEMO_PASSWORD && applicant) {
        await startDemoSession(applicant, store);
        return { ok: true, account: { kind: "applicant", applicant } };
    }
    await recordDemoAudit(null, "auth.sign_in", email, "Invalid credentials");
    return { ok: false, message: "That email and password combination is incorrect." };
}

/** Registers a demo applicant and signs them in. Demo accounts all sign in with the demo password afterwards. */
export async function registerDemoApplicant(email: string): Promise<DemoSignInResult> {
    if (!isDemoAuthEnabled()) return { ok: false, message: "Demo sign-in is not available." };
    const store = await demoStore();
    if (store.users.some((u) => u.email === email) || store.applicants.some((a) => a.email === email)) {
        return { ok: false, message: "An account with this email already exists. Sign in instead." };
    }
    const applicant: Applicant = { id: (await import("@/lib/mocks/db")).newId("a"), email };
    store.applicants.push(applicant);
    await startDemoSession(applicant, store);
    return { ok: true, account: { kind: "applicant", applicant } };
}

export async function signInDemoAccount(role: Role | "applicant"): Promise<DemoSignInResult> {
    if (!isDemoAuthEnabled()) return { ok: false, message: "Demo sign-in is not available." };
    const store = await demoStore();
    if (role === "applicant") {
        const applicant = store.applicants.find((a) => a.id === DEMO_APPLICANT);
        if (!applicant) return { ok: false, message: "This demo account is unavailable." };
        await startDemoSession(applicant, store);
        return { ok: true, account: { kind: "applicant", applicant } };
    }
    const user = store.users.find((u) => u.id === DEMO_ACCOUNTS[role]);
    if (!user || signInBlocker(user)) return { ok: false, message: "This demo account is unavailable." };
    await startDemoSession(user, store);
    return { ok: true, account: { kind: "user", user } };
}

export async function endDemoSession(): Promise<void> {
    const account = await readDemoAccount();
    (await cookies()).delete(DEMO_SESSION_COOKIE);
    if (account) {
        const signedIn = account.kind === "user" ? account.user : account.applicant;
        await recordDemoAudit(signedIn, "auth.sign_out", signedIn.email);
    }
}
