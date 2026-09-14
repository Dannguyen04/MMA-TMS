import "server-only";

import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import type { Permission, Role, User } from "@/lib/domain/types";
import { db } from "@/lib/mocks/db";
import { dashboardPath, routes } from "@/lib/routes";
import { isDemoAuthEnabled, SESSION_COOKIE } from "./constants";

/**
 * Mock session. The cookie stores the signed-in user id.
 * When the real backend lands, swap this module for token verification against the
 * NestJS auth service — callers only depend on the functions exported here.
 */

export const getCurrentUser = cache(async (): Promise<User | null> => {
    // The mock cookie is unsigned, so it is never trusted where demo auth is switched off.
    if (!isDemoAuthEnabled()) return null;
    const store = await cookies();
    const userId = store.get(SESSION_COOKIE)?.value;
    if (!userId) return null;
    const user = db().users.find((u) => u.id === userId);
    return user && user.status === "active" ? user : null;
});

/** Redirects to the login screen when there is no valid session. */
export async function requireUser(): Promise<User> {
    const user = await getCurrentUser();
    if (!user) redirect(routes.login);
    return user;
}

/** Guards a role area. Users of another role are sent to their own dashboard. */
export async function requireRole(role: Role): Promise<User> {
    const user = await requireUser();
    if (user.role !== role) redirect(dashboardPath(user.role));
    return user;
}

export function permissionsFor(role: Role): Permission[] {
    return db().roleDefinitions.find((r) => r.role === role)?.permissions ?? [];
}

export function hasPermission(user: User, permission: Permission): boolean {
    return permissionsFor(user.role).includes(permission);
}

/** For pages: responds as "not found" when the permission is missing, so restricted resources aren't revealed. */
export async function requirePermission(permission: Permission): Promise<User> {
    const user = await requireUser();
    if (!hasPermission(user, permission)) notFound();
    return user;
}

export type ActionAuthResult = { ok: true; user: User } | { ok: false; message: string };

/** For Server Actions: never trust the page guard, re-check on every call. */
export async function authorizeAction(permission: Permission): Promise<ActionAuthResult> {
    const user = await getCurrentUser();
    if (!user) return { ok: false, message: "Your session has expired. Sign in again." };
    if (!hasPermission(user, permission)) {
        return { ok: false, message: "You don't have permission to do this." };
    }
    return { ok: true, user };
}

/**
 * For clinical Server Actions: the permission alone isn't enough — the actor must also be a sports
 * doctor with a doctor profile, so a mis-assigned permission can't open clinical records to other roles.
 * Pair with `canAccessFighterClinically()` for the fighter being changed.
 */
export async function authorizeClinicalAction(permission: Permission): Promise<ActionAuthResult> {
    const auth = await authorizeAction(permission);
    if (!auth.ok) return auth;
    if (auth.user.role !== "doctor" || !auth.user.profileId) {
        return { ok: false, message: "Only sports doctors can change clinical records." };
    }
    return auth;
}
