import "server-only";

import { cookies } from "next/headers";

import type { Role, User } from "@/lib/domain/types";
import { clamp } from "@/lib/utils";
import { DEMO_PASSWORD, DEMO_SESSION_COOKIE, isDemoAuthEnabled } from "./constants";

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

/** Theo thiết lập session-timeout của admin demo, giới hạn trong 5 phút tới 24 giờ. */
const SESSION_TIMEOUT_MIN = { min: 5, max: 1440 };

async function demoStore() {
    return (await import("@/lib/mocks/db")).db();
}

async function recordDemoAudit(actor: User | null, action: string, subject: string, failure?: string) {
    const { recordAudit } = await import("@/lib/services/audit.demo");
    recordAudit({
        actor,
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

export async function readDemoUser(): Promise<User | null> {
    if (!isDemoAuthEnabled()) return null;
    const userId = (await cookies()).get(DEMO_SESSION_COOKIE)?.value;
    if (!userId) return null;
    const store = await demoStore();
    const user = store.users.find((u) => u.id === userId);
    return user && user.status === "active" ? withDemoAccess(user, store) : null;
}

/** Lý do tài khoản demo không thể đăng nhập, hoặc null khi được phép. */
function signInBlocker(user: User): string | null {
    if (user.status === "suspended") return "This account is suspended. Contact your academy administrator.";
    if (user.status === "invited") return "This invitation hasn't been accepted yet. Check your email for the setup link.";
    return null;
}

export type DemoSignInResult = { ok: true; user: User } | { ok: false; message: string };

async function startDemoSession(user: User, store: Awaited<ReturnType<typeof demoStore>>): Promise<void> {
    const { min, max } = SESSION_TIMEOUT_MIN;
    (await cookies()).set(DEMO_SESSION_COOKIE, user.id, {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        path: "/",
        maxAge: clamp(store.settings.sessionTimeoutMin, min, max) * 60,
    });
    user.lastActiveAt = new Date().toISOString();
    await recordDemoAudit(user, "auth.sign_in", user.email);
}

export async function signInDemoWithPassword(email: string, password: string): Promise<DemoSignInResult> {
    if (!isDemoAuthEnabled()) return { ok: false, message: "Demo sign-in is not available." };
    const store = await demoStore();
    const user = store.users.find((u) => u.email === email);
    if (!user || password !== DEMO_PASSWORD) {
        await recordDemoAudit(null, "auth.sign_in", email, "Invalid credentials");
        return { ok: false, message: "That email and password combination is incorrect." };
    }
    const blocked = signInBlocker(user);
    if (blocked) return { ok: false, message: blocked };
    await startDemoSession(user, store);
    return { ok: true, user };
}

export async function signInDemoAccount(role: Role): Promise<DemoSignInResult> {
    if (!isDemoAuthEnabled()) return { ok: false, message: "Demo sign-in is not available." };
    const store = await demoStore();
    const user = store.users.find((u) => u.id === DEMO_ACCOUNTS[role]);
    if (!user || signInBlocker(user)) return { ok: false, message: "This demo account is unavailable." };
    await startDemoSession(user, store);
    return { ok: true, user };
}

export async function endDemoSession(): Promise<void> {
    const user = await readDemoUser();
    (await cookies()).delete(DEMO_SESSION_COOKIE);
    if (user) await recordDemoAudit(user, "auth.sign_out", user.email);
}
