import "server-only";

import { z } from "zod";

import { isDemoAuthEnabled } from "@/lib/auth/constants";
import { ApiError, authenticatedApiRequest, authenticatedMutableApiRequest, drainAuthenticatedCursorPages } from "@/lib/api/client";
import type {
    AuditLog,
    BroadcastChannel,
    Coach,
    Doctor,
    Fighter,
    NotificationBroadcast,
    Permission,
    Role,
    RoleDefinition,
    SystemSettings,
    User,
    UserStatus,
} from "@/lib/domain/types";
import { isNotFound } from "./api-helpers";
import { adaptBackendAuditLog, backendAuditLogSchema, listAuditLogs } from "./audit";
import { adaptBackendUser, backendUserSchema, getDoctor, getFighter, getUser, listCoaches } from "./people";

type Failure<Code extends string> = { ok: false; code: Code; message: string };

const roleSchema = z.enum(["FIGHTER", "COACH", "DOCTOR", "ADMIN"]);
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
const backendRoleDefinitionSchema = z.object({
    role: roleSchema,
    label: z.string(),
    description: z.string(),
    permissions: z.array(permissionSchema),
});
const permissionCatalogEntrySchema = z.object({ permission: permissionSchema, label: z.string(), group: z.string() });
const settingsSchema = z.object({
    organizationName: z.string(),
    timezone: z.string(),
    sessionTimeoutMin: z.number().int().positive(),
    requireMfa: z.boolean(),
    videoMaxSizeMb: z.number().positive(),
    videoRetentionDays: z.number().int().nonnegative(),
    allowedVideoFormats: z.array(z.string()),
    aiConfidenceThreshold: z.number(),
    aiLowConfidenceThreshold: z.number(),
    abnormalMovementAlertsEnabled: z.boolean(),
    notifyDoctorOnAlert: z.boolean(),
    clearanceExpiryWarningDays: z.number().int().nonnegative(),
});
const backendBroadcastSchema = z.object({
    id: z.string(),
    title: z.string(),
    body: z.string(),
    audience: z.array(roleSchema),
    channel: z.enum(["IN_APP", "EMAIL", "IN_APP_EMAIL"]),
    status: z.enum(["DRAFT", "SCHEDULED", "SENT"]),
    scheduledFor: z.string().nullable(),
    sentAt: z.string().nullable(),
    recipientCount: z.number().int().nonnegative(),
    createdById: z.string(),
    createdAt: z.string(),
});
const backendOverviewSchema = z.object({
    usersByRole: z.object({ FIGHTER: z.number(), COACH: z.number(), DOCTOR: z.number(), ADMIN: z.number() }),
    activeUsers7d: z.number().int().nonnegative(),
    invitedUsers: z.number().int().nonnegative(),
    suspendedUsers: z.number().int().nonnegative(),
    videosTotal: z.number().int().nonnegative(),
    videosLast7d: z.number().int().nonnegative(),
    storageUsedGb: z.number().nonnegative(),
    recentAudit: z.array(backendAuditLogSchema),
    recentFailures: z.array(backendAuditLogSchema),
});

const roleToApi: Record<Role, z.infer<typeof roleSchema>> = {
    fighter: "FIGHTER",
    coach: "COACH",
    doctor: "DOCTOR",
    admin: "ADMIN",
};

function adaptRoleDefinition(input: z.infer<typeof backendRoleDefinitionSchema>): RoleDefinition {
    return { ...input, role: input.role.toLowerCase() as Role };
}

function adaptBroadcast(input: z.infer<typeof backendBroadcastSchema>): NotificationBroadcast {
    return {
        ...input,
        audience: input.audience.map((role) => role.toLowerCase() as Role),
        channel: input.channel.toLowerCase() as BroadcastChannel,
        status: input.status.toLowerCase() as NotificationBroadcast["status"],
    };
}

async function demoService(): Promise<typeof import("./admin.demo")> {
    return import("./admin.demo");
}

function normalizedCode(error: ApiError): string {
    return error.code.toLowerCase();
}

export interface UserFilter {
    /** Matches name, email and title. */
    search?: string;
    role?: Role;
    status?: UserStatus;
}

export interface UserDetail {
    user: User;
    /** Linked fighter, coach or doctor profile — null for admins and accounts not yet onboarded. */
    profile: Fighter | Coach | Doctor | null;
    /** The last 10 audit entries this user performed, newest first. */
    recentAudit: AuditLog[];
    /** Permissions granted by the user's role. */
    permissions: Permission[];
}

export interface InviteUserInput {
    name: string;
    email: string;
    role: Role;
    title: string;
}

export type InviteUserResult = { ok: true; user: User } | Failure<"email_taken">;

export interface UserPatch {
    name?: string;
    title?: string;
    role?: Role;
}

export type UpdateUserResult = { ok: true; user: User } | Failure<"not_found" | "own_role" | "profile_linked">;
export type SetUserStatusResult = { ok: true; user: User } | Failure<"not_found" | "own_account" | "invalid_status">;
export type ResendInviteResult = { ok: true; user: User } | Failure<"not_found" | "not_invited">;
export type UpdateRolePermissionsResult = { ok: true; role: RoleDefinition } | Failure<"not_found" | "admin_lockout" | "clinical_permission_forbidden">;
export type UpdateSettingsResult =
    | { ok: true; settings: SystemSettings }
    | (Failure<"invalid"> & { field: keyof SystemSettings });

export interface CreateBroadcastInput {
    title: string;
    body: string;
    audience: Role[];
    channel: BroadcastChannel;
    /** ISO timestamp to send later, or null to send now. */
    scheduledFor: string | null;
}

export type CreateBroadcastResult =
    | { ok: true; broadcast: NotificationBroadcast }
    | (Failure<"no_audience" | "schedule_in_past"> & { field: "audience" | "scheduledFor" });

export interface AdminOverview {
    /** All accounts per role, whatever their status. */
    usersByRole: Record<Role, number>;
    /** Active accounts seen in the last 7 days. */
    activeUsers7d: number;
    invitedUsers: number;
    suspendedUsers: number;
    videosTotal: number;
    videosLast7d: number;
    /** Total size of stored footage, in GB (one decimal). */
    storageUsedGb: number;
    /** Latest 8 audit entries. */
    recentAudit: AuditLog[];
    /** Latest 5 failed audit entries (sign-ins, AI jobs, rejected changes). */
    recentFailures: AuditLog[];
}

export interface PermissionCatalogEntry {
    permission: Permission;
    /** Plain-language description, e.g. "View full medical records". */
    label: string;
    /** Area the permission belongs to: Fighters, Training, Video & AI, Medical or Administration. */
    group: string;
}

export async function listUsers(filter: UserFilter = {}): Promise<User[]> {
    if (isDemoAuthEnabled()) return (await demoService()).listUsers(filter);
    const params = new URLSearchParams();
    if (filter.search) params.set("search", filter.search);
    if (filter.role) params.set("role", roleToApi[filter.role]);
    if (filter.status) params.set("status", filter.status.toUpperCase());
    const query = params.toString();
    return (await drainAuthenticatedCursorPages(`/users${query ? `?${query}` : ""}`, backendUserSchema)).map(adaptBackendUser);
}

export async function getUserDetail(id: string, viewer?: User | null): Promise<UserDetail | null> {
    if (isDemoAuthEnabled()) return (await demoService()).getUserDetail(id, viewer);
    const user = await getUser(id);
    if (!user) return null;
    let profile: Fighter | Coach | Doctor | null = null;
    if (user.profileId && user.role === "fighter") profile = await getFighter(user.profileId);
    if (user.profileId && user.role === "coach") profile = (await listCoaches()).find((coach) => coach.id === user.profileId) ?? null;
    if (user.profileId && user.role === "doctor") profile = await getDoctor(user.profileId);
    const [recentAudit, roles] = await Promise.all([
        listAuditLogs({ actorId: user.id }, viewer).then((logs) => logs.slice(0, 10)),
        listRoleDefinitions(),
    ]);
    return { user, profile, recentAudit, permissions: roles.find((definition) => definition.role === user.role)?.permissions ?? [] };
}

export async function inviteUser(input: InviteUserInput, actor: User): Promise<InviteUserResult> {
    if (isDemoAuthEnabled()) return (await demoService()).inviteUser(input, actor);
    try {
        const user = await authenticatedMutableApiRequest("/users/invite", backendUserSchema, {
            method: "POST",
            body: JSON.stringify({ ...input, role: roleToApi[input.role] }),
        });
        return { ok: true, user: adaptBackendUser(user) };
    } catch (error) {
        if (error instanceof ApiError && normalizedCode(error) === "email_taken") return { ok: false, code: "email_taken", message: error.message };
        throw error;
    }
}

export async function updateUser(id: string, patch: UserPatch, actor: User): Promise<UpdateUserResult> {
    if (isDemoAuthEnabled()) return (await demoService()).updateUser(id, patch, actor);
    try {
        const user = await authenticatedMutableApiRequest(`/users/${encodeURIComponent(id)}`, backendUserSchema, {
            method: "PATCH",
            body: JSON.stringify({ ...patch, ...(patch.role ? { role: roleToApi[patch.role] } : {}) }),
        });
        return { ok: true, user: adaptBackendUser(user) };
    } catch (error) {
        if (isNotFound(error)) return { ok: false, code: "not_found", message: "That user no longer exists." };
        if (error instanceof ApiError && ["own_role", "profile_linked"].includes(normalizedCode(error))) {
            return { ok: false, code: normalizedCode(error) as "own_role" | "profile_linked", message: error.message };
        }
        throw error;
    }
}

export async function setUserStatus(id: string, status: UserStatus, actor: User): Promise<SetUserStatusResult> {
    if (isDemoAuthEnabled()) return (await demoService()).setUserStatus(id, status, actor);
    try {
        const user = await authenticatedMutableApiRequest(`/users/${encodeURIComponent(id)}/status`, backendUserSchema, {
            method: "PATCH",
            body: JSON.stringify({ status: status.toUpperCase() }),
        });
        return { ok: true, user: adaptBackendUser(user) };
    } catch (error) {
        if (isNotFound(error)) return { ok: false, code: "not_found", message: "That user no longer exists." };
        if (error instanceof ApiError && ["own_account", "invalid_status"].includes(normalizedCode(error))) {
            return { ok: false, code: normalizedCode(error) as "own_account" | "invalid_status", message: error.message };
        }
        throw error;
    }
}

export async function resendInvite(id: string, actor: User): Promise<ResendInviteResult> {
    if (isDemoAuthEnabled()) return (await demoService()).resendInvite(id, actor);
    try {
        const user = await authenticatedMutableApiRequest(`/users/${encodeURIComponent(id)}/resend-invite`, backendUserSchema, {
            method: "POST",
        });
        return { ok: true, user: adaptBackendUser(user) };
    } catch (error) {
        if (isNotFound(error)) return { ok: false, code: "not_found", message: "That user no longer exists." };
        if (error instanceof ApiError && normalizedCode(error) === "not_invited") {
            return { ok: false, code: "not_invited", message: error.message };
        }
        throw error;
    }
}

export async function listRoleDefinitions(): Promise<RoleDefinition[]> {
    if (isDemoAuthEnabled()) return (await demoService()).listRoleDefinitions();
    return (await authenticatedApiRequest("/authorization/roles", z.array(backendRoleDefinitionSchema))).map(adaptRoleDefinition);
}

export async function listPermissionCatalog(): Promise<PermissionCatalogEntry[]> {
    if (isDemoAuthEnabled()) return (await demoService()).listPermissionCatalog();
    return authenticatedApiRequest("/authorization/permissions", z.array(permissionCatalogEntrySchema));
}

export async function updateRolePermissions(
    role: Role,
    permissions: Permission[],
    actor: User,
): Promise<UpdateRolePermissionsResult> {
    if (isDemoAuthEnabled()) return (await demoService()).updateRolePermissions(role, permissions, actor);
    try {
        const definition = await authenticatedMutableApiRequest(
            `/authorization/roles/${roleToApi[role]}/permissions`,
            backendRoleDefinitionSchema,
            { method: "PUT", body: JSON.stringify({ permissions }) },
        );
        return { ok: true, role: adaptRoleDefinition(definition) };
    } catch (error) {
        if (isNotFound(error)) return { ok: false, code: "not_found", message: "That role no longer exists." };
        if (error instanceof ApiError && ["admin_lockout", "clinical_permission_forbidden"].includes(normalizedCode(error))) {
            return {
                ok: false,
                code: normalizedCode(error) as "admin_lockout" | "clinical_permission_forbidden",
                message: error.message,
            };
        }
        throw error;
    }
}

export async function getSettings(): Promise<SystemSettings> {
    if (isDemoAuthEnabled()) return (await demoService()).getSettings();
    return authenticatedApiRequest("/settings", settingsSchema);
}

export async function updateSettings(patch: Partial<SystemSettings>, actor: User): Promise<UpdateSettingsResult> {
    if (isDemoAuthEnabled()) return (await demoService()).updateSettings(patch, actor);
    try {
        return {
            ok: true,
            settings: await authenticatedMutableApiRequest("/settings", settingsSchema, {
                method: "PATCH",
                body: JSON.stringify(patch),
            }),
        };
    } catch (error) {
        if (error instanceof ApiError && normalizedCode(error) === "invalid") {
            const field = z.enum(Object.keys(settingsSchema.shape) as [keyof SystemSettings, ...(keyof SystemSettings)[]]).safeParse(
                (error.details as { field?: unknown } | undefined)?.field,
            );
            if (field.success) return { ok: false, code: "invalid", field: field.data, message: error.message };
        }
        throw error;
    }
}

export async function listBroadcasts(): Promise<NotificationBroadcast[]> {
    if (isDemoAuthEnabled()) return (await demoService()).listBroadcasts();
    return (await drainAuthenticatedCursorPages("/broadcasts", backendBroadcastSchema)).map(adaptBroadcast);
}

export async function createBroadcast(input: CreateBroadcastInput, actor: User): Promise<CreateBroadcastResult> {
    if (isDemoAuthEnabled()) return (await demoService()).createBroadcast(input, actor);
    try {
        const broadcast = await authenticatedMutableApiRequest("/broadcasts", backendBroadcastSchema, {
            method: "POST",
            body: JSON.stringify({
                ...input,
                audience: input.audience.map((role) => roleToApi[role]),
                channel: input.channel.toUpperCase(),
            }),
        });
        return { ok: true, broadcast: adaptBroadcast(broadcast) };
    } catch (error) {
        if (error instanceof ApiError && ["no_audience", "schedule_in_past"].includes(normalizedCode(error))) {
            const code = normalizedCode(error) as "no_audience" | "schedule_in_past";
            return { ok: false, code, field: code === "no_audience" ? "audience" : "scheduledFor", message: error.message };
        }
        throw error;
    }
}

export async function getAdminOverview(now: Date = new Date(), viewer?: User | null): Promise<AdminOverview> {
    if (isDemoAuthEnabled()) return (await demoService()).getAdminOverview(now, viewer);
    const data = await authenticatedApiRequest(`/dashboards/admin?at=${encodeURIComponent(now.toISOString())}`, backendOverviewSchema);
    return {
        ...data,
        usersByRole: {
            fighter: data.usersByRole.FIGHTER,
            coach: data.usersByRole.COACH,
            doctor: data.usersByRole.DOCTOR,
            admin: data.usersByRole.ADMIN,
        },
        recentAudit: data.recentAudit.map(adaptBackendAuditLog),
        recentFailures: data.recentFailures.map(adaptBackendAuditLog),
    };
}
