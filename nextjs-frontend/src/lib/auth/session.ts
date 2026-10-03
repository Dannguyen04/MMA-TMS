import "server-only";

import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { z } from "zod";

import { ApiError, authenticatedApiRequest } from "@/lib/api/client";
import type { Permission, Role, User } from "@/lib/domain/types";
import { dashboardPath, routes } from "@/lib/routes";
import { drainNumberedPages, fighterRosterPath } from "@/lib/services/api-helpers";
import { permissionsForRole } from "./capabilities";
import { isDemoAuthEnabled } from "./constants";

const currentUserSchema = z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    role: z.enum(["FIGHTER", "COACH", "DOCTOR", "ADMIN"]),
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

function normalizeUser(input: CurrentAccount): User {
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

/** Đọc phiên từ cookie HTTP-only và để backend xác thực danh tính (hoặc phiên demo ngoài production). */
export const getCurrentUser = cache(async (): Promise<User | null> => {
    if (isDemoAuthEnabled()) return (await import("./demo-session")).readDemoUser();
    try {
        return await withAssignmentScope(normalizeUser(await readCurrentAccount()));
    } catch (error) {
        if (error instanceof ApiError && error.kind === "unauthorized") return null;
        throw error;
    }
});

export async function requireUser(): Promise<User> {
    const user = await getCurrentUser();
    if (!user) redirect(routes.login);
    return user;
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
