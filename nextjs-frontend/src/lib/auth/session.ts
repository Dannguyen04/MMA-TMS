import "server-only";

import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { z } from "zod";

import { ApiError, authenticatedApiRequest } from "@/lib/api/client";
import type { Permission, Role, User } from "@/lib/domain/types";
import { dashboardPath, routes } from "@/lib/routes";

const permissionSchema = z.enum([
    "fighters:read",
    "fighters:write",
    "training:read",
    "training:write",
    "videos:upload",
    "videos:manage",
    "ai_analysis:read",
    "ai_findings:review",
    "ai_alerts:review",
    "goals:write",
    "medical:read_summary",
    "medical:read",
    "medical:write",
    "clearance:manage",
    "users:manage",
    "roles:manage",
    "ai_jobs:manage",
    "ai_models:manage",
    "audit_logs:read",
    "notifications:manage",
    "settings:manage",
]);

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
    effectiveCapabilities: z.array(permissionSchema).optional().default([]),
    assignmentScope: z
        .object({
            fighterIds: z.array(z.string().uuid()),
        })
        .optional(),
});

function normalizeUser(input: z.output<typeof currentUserSchema>): User {
    const profile = input.profile;
    return {
        id: input.id,
        email: input.email,
        name: profile ? `${profile.firstName} ${profile.lastName}`.trim() : input.email,
        role: input.role.toLowerCase() as Role,
        title: profile?.specialization ?? "",
        phone: profile?.phone ?? null,
        status: input.isActive ? "active" : "suspended",
        createdAt: input.createdAt,
        lastActiveAt: input.updatedAt,
        profileId: profile?.id ?? null,
        effectiveCapabilities: input.effectiveCapabilities,
        assignmentScope: input.assignmentScope,
    };
}

/** Đọc phiên từ cookie HTTP-only và để backend xác thực danh tính. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
    try {
        return normalizeUser(await authenticatedApiRequest("/users/me", currentUserSchema));
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
