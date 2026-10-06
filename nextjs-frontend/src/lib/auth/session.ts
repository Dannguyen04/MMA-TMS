import "server-only";

import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { z } from "zod";

import { ApiError, authenticatedApiRequest } from "@/lib/api/client";
import type { Applicant } from "@/lib/domain/admissions";
import type { Permission, Role, User } from "@/lib/domain/types";
import { dashboardPath, routes } from "@/lib/routes";
import { drainNumberedPages, fighterRosterPath } from "@/lib/services/api-helpers";
import { permissionsForRole } from "./capabilities";
import { isDemoAuthEnabled } from "./constants";

const currentUserSchema = z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    role: z.enum(["FIGHTER", "COACH", "DOCTOR", "ADMIN", "GUEST"]),
    isActive: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
    profile: z
        .object({
            id: z.string().uuid(),
            firstName: z.string(),
            lastName: z.string(),
            phone: z.string().nullable().optional(),
            specialization: z.string().nullable().optional(),
        })
        .passthrough()
        .nullable(),
    // Plain strings, so a capability the interface doesn't know yet never breaks sign-in.
    effectiveCapabilities: z.array(z.string()).optional(),
    assignmentScope: z
        .object({
            fighterIds: z.array(z.string().uuid()),
        })
        .optional(),
});

export type CurrentAccount = z.output<typeof currentUserSchema>;

function normalizeUser(input: CurrentAccount & { role: Exclude<CurrentAccount["role"], "GUEST"> }): User {
    const profile = input.profile;
    const role = input.role.toLowerCase() as Role;
    return {
        id: input.id,
        email: input.email,
        name: profile ? `${profile.firstName} ${profile.lastName}`.trim() : input.email,
        role,
        title: profile?.specialization ?? "",
        phone: profile?.phone ?? null,
        status: input.isActive ? "active" : "suspended",
        createdAt: input.createdAt,
        lastActiveAt: input.updatedAt,
        profileId: profile?.id ?? null,
        effectiveCapabilities: permissionsForRole(role, input.effectiveCapabilities),
        assignmentScope: input.assignmentScope,
    };
}

const scopedFighterSchema = z.object({ id: z.string().uuid() }).passthrough();

/**
 * Coaches and doctors see only the fighters assigned to them. When `/users/me` doesn't carry that scope, it is
 * read from their roster (`fighterRosterPath`), which the backend already limits to the caller's current
 * assignments. A refusal (no active coach or doctor profile) means no fighters, never all of them.
 */
async function withAssignmentScope(user: User): Promise<User> {
    if (user.assignmentScope || (user.role !== "coach" && user.role !== "doctor")) return user;
    try {
        const fighters = await drainNumberedPages(fighterRosterPath(user), scopedFighterSchema);
        return { ...user, assignmentScope: { fighterIds: fighters.map((fighter) => fighter.id) } };
    } catch (error) {
        if (error instanceof ApiError && error.status === 403) return { ...user, assignmentScope: { fighterIds: [] } };
        throw error;
    }
}

/** `/users/me` as the service returns it, profile fields included, read once per request. API mode only. */
export const readCurrentAccount = cache((): Promise<CurrentAccount> => authenticatedApiRequest("/users/me", currentUserSchema));

/**
 * Who is signed in: an academy member, or a self-registered applicant (`GUEST`) who can only apply until their
 * fighter account is activated. Read from the HTTP-only session cookie and verified by the backend (or the demo
 * session outside production), once per request.
 */
export type SessionAccount = { kind: "user"; user: User } | { kind: "applicant"; applicant: Applicant };

export const getSessionAccount = cache(async (): Promise<SessionAccount | null> => {
    if (isDemoAuthEnabled()) return (await import("./demo-session")).readDemoAccount();
    try {
        const account = await readCurrentAccount();
        if (account.role === "GUEST") return { kind: "applicant", applicant: { id: account.id, email: account.email } };
        return { kind: "user", user: await withAssignmentScope(normalizeUser({ ...account, role: account.role })) };
    } catch (error) {
        if (error instanceof ApiError && error.kind === "unauthorized") return null;
        throw error;
    }
});

/** The signed-in academy member; null for applicants and visitors. */
export async function getCurrentUser(): Promise<User | null> {
    const account = await getSessionAccount();
    return account?.kind === "user" ? account.user : null;
}

/** Where a signed-in account starts: its role's dashboard, or the application page for an applicant. */
export function homePath(account: SessionAccount): string {
    return account.kind === "user" ? dashboardPath(account.user.role) : routes.apply;
}

export async function requireUser(): Promise<User> {
    const account = await getSessionAccount();
    if (!account) redirect(routes.login);
    if (account.kind === "applicant") redirect(routes.apply);
    return account.user;
}

/** The signed-in applicant. Academy members go to their dashboard and visitors to sign in. */
export async function requireApplicant(): Promise<Applicant> {
    const account = await getSessionAccount();
    if (!account) redirect(routes.login);
    if (account.kind === "user") redirect(dashboardPath(account.user.role));
    return account.applicant;
}

export async function requireRole(role: Role): Promise<User> {
    const user = await requireUser();
    if (user.role !== role) redirect(dashboardPath(user.role));
    return user;
}

export function permissionsFor(user: User): Permission[] {
    return user.effectiveCapabilities ?? [];
}

export function hasPermission(user: User, permission: Permission): boolean {
    return permissionsFor(user).includes(permission);
}

export async function requirePermission(permission: Permission): Promise<User> {
    const user = await requireUser();
    if (!hasPermission(user, permission)) notFound();
    return user;
}

export type ActionAuthResult = { ok: true; user: User } | { ok: false; message: string };

export async function authorizeAction(permission: Permission): Promise<ActionAuthResult> {
    const user = await getCurrentUser();
    if (!user) return { ok: false, message: "Your session has expired. Sign in again." };
    if (!hasPermission(user, permission)) return { ok: false, message: "You don't have permission to do this." };
    return { ok: true, user };
}

export async function authorizeClinicalAction(permission: Permission): Promise<ActionAuthResult> {
    const auth = await authorizeAction(permission);
    if (!auth.ok) return auth;
    if (auth.user.role !== "doctor" || !auth.user.profileId) {
        return { ok: false, message: "Only sports doctors can change clinical records." };
    }
    return auth;
}
