import "server-only";

import { z } from "zod";

import { isDemoAuthEnabled } from "@/lib/auth/constants";
import { ApiError, authenticatedApiRequest, authenticatedMutableApiRequest, drainAuthenticatedCursorPages } from "@/lib/api/client";
import { PERMISSION_CATALOG, ROLE_DEFINITIONS } from "@/lib/auth/role-catalog";
import { createAccountBody, updateAccountBody, type AccountProfile } from "@/lib/domain/account-contract";
import { DEFAULT_SYSTEM_SETTINGS } from "@/lib/domain/system-settings";
import { DAY_MS } from "@/lib/format";
import { round } from "@/lib/utils";
import {
    type AuditLog,
    type BroadcastChannel,
    type Coach,
    type Doctor,
    type Fighter,
    type NotificationBroadcast,
    type Permission,
    type PermissionCatalogEntry,
    type Role,
    type RoleDefinition,
    type SystemSettings,
    type User,
    type UserStatus,
} from "@/lib/domain/types";
import { adminFeatureAvailable } from "./admin-features";
import { drainNumberedPages, isNotFound, nullIfNotFound, unsupportedOperation } from "./api-helpers";
import { listAuditLogs } from "./audit";
import { adaptBackendUser, backendUserSchema, getApiUserWithProfile } from "./people";
import { platformFeatureAvailable } from "./platform-features";
import { listVideos } from "./videos";

type Failure<Code extends string> = { ok: false; code: Code; message: string };

const roleSchema = z.enum(["FIGHTER", "COACH", "DOCTOR", "ADMIN"]);
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

const roleToApi: Record<Role, z.infer<typeof roleSchema>> = {
    fighter: "FIGHTER",
    coach: "COACH",
    doctor: "DOCTOR",
    admin: "ADMIN",
};

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
    /** The role and profile as the user service edits them (API mode); null where the demo edits accounts its own way. */
    account: AccountProfile | null;
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
    /** Active accounts seen in the last 7 days; null when sign-ins aren't recorded. */
    activeUsers7d: number | null;
    /** Accounts that are active, whenever they last signed in. */
    activeAccounts: number;
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

/**
 * `GET /users` lists self-registered applicants (`GUEST`) and deleted accounts too. Applicants belong to fighter
 * admissions, and a deleted account can't be opened or restored, so the list drops both.
 */
const listedUserSchema = backendUserSchema.extend({ role: z.enum([...roleSchema.options, "GUEST"]) });

/** The service's account status: `INACTIVE` covers deactivated and deleted accounts. It has no invitations. */
const statusToApi: Record<UserStatus, "ACTIVE" | "INACTIVE" | null> = { active: "ACTIVE", suspended: "INACTIVE", invited: null };

export async function listUsers(filter: UserFilter = {}): Promise<User[]> {
    if (isDemoAuthEnabled()) return (await demoService()).listUsers(filter);
    const status = filter.status ? statusToApi[filter.status] : undefined;
    if (status === null) return [];
    const users = await drainNumberedPages("/users", listedUserSchema, { search: filter.search, role: filter.role && roleToApi[filter.role], status });
    return users.flatMap((user) => (user.role === "GUEST" || user.deletedAt !== null ? [] : [adaptBackendUser({ ...user, role: user.role })]));
}

export async function getUserDetail(id: string, viewer?: User | null): Promise<UserDetail | null> {
    if (isDemoAuthEnabled()) return (await demoService()).getUserDetail(id, viewer);
    const account = await getApiUserWithProfile(id);
    if (!account) return null;
    const { user, profile } = account;
    const [recentAudit, roles] = await Promise.all([
        adminFeatureAvailable("auditTrail") ? listAuditLogs({ actorId: user.id }, viewer).then((logs) => logs.slice(0, 10)) : [],
        adminFeatureAvailable("rolePermissions") ? listRoleDefinitions() : [],
    ]);
    return { user, profile, recentAudit, permissions: roles.find((definition) => definition.role === user.role)?.permissions ?? [], account: account.account };
}

/*
 * Accounts with a password and a full profile, in the user service's own terms (`usesUserServiceForms`). The demo
 * manages accounts through invitations instead, so these run in API mode only and throw the service's ApiError on
 * failure.
 */

function requireUserService(): void {
    if (isDemoAuthEnabled()) throw new Error("The demo manages accounts through invitations; this runs in API mode only.");
}

export async function createAccount(input: { email: string; password: string; account: AccountProfile }): Promise<User> {
    requireUserService();
    return adaptBackendUser(await authenticatedMutableApiRequest("/users", backendUserSchema, { method: "POST", body: JSON.stringify(createAccountBody(input)) }));
}

/** Null when the account no longer exists. */
export async function updateAccount(id: string, account: Exclude<AccountProfile, { role: "admin" }>): Promise<User | null> {
    requireUserService();
    const updated = await nullIfNotFound(
        authenticatedMutableApiRequest(`/users/${encodeURIComponent(id)}`, backendUserSchema, { method: "PATCH", body: JSON.stringify(updateAccountBody(account)) }),
    );
    return updated && adaptBackendUser(updated);
}

/** Soft-deletes an account. False when it was already gone. */
export async function deleteAccount(id: string): Promise<boolean> {
    requireUserService();
    const removed = await nullIfNotFound(authenticatedMutableApiRequest(`/users/${encodeURIComponent(id)}`, z.object({ id: z.string(), deleted: z.literal(true) }), { method: "DELETE" }));
    return removed !== null;
}

export async function inviteUser(input: InviteUserInput, actor: User): Promise<InviteUserResult> {
    if (isDemoAuthEnabled()) return (await demoService()).inviteUser(input, actor);
    if (!adminFeatureAvailable("inviteUsers")) unsupportedOperation("Inviting a user", "invitations");
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
    if (!adminFeatureAvailable("editUsers")) unsupportedOperation("Changing an account's name, title or role", "account name, title and role edits");
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
    if (!adminFeatureAvailable("accountStatus")) unsupportedOperation("Suspending or reactivating an account", "account status changes");
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
    if (!adminFeatureAvailable("accountStatus")) unsupportedOperation("Resending an invitation", "invitations");
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

/** The roles and their grants. API mode shows each role's baseline: the backend has no endpoint that lists them. */
export async function listRoleDefinitions(): Promise<RoleDefinition[]> {
    if (isDemoAuthEnabled()) return (await demoService()).listRoleDefinitions();
    return ROLE_DEFINITIONS.map((definition) => ({ ...definition, permissions: [...definition.permissions] }));
}

export async function listPermissionCatalog(): Promise<PermissionCatalogEntry[]> {
    if (isDemoAuthEnabled()) return (await demoService()).listPermissionCatalog();
    return PERMISSION_CATALOG.map((entry) => ({ ...entry }));
}

export async function updateRolePermissions(
    role: Role,
    permissions: Permission[],
    actor: User,
): Promise<UpdateRolePermissionsResult> {
    if (isDemoAuthEnabled()) return (await demoService()).updateRolePermissions(role, permissions, actor);
    // The backend grants permissions one backend capability at a time and can't list a role's grants, so the
    // interface's role matrix has nothing to save against yet. The roles page hides editing in API mode.
    unsupportedOperation("Changing a role's permissions", "role permission lists");
}

export async function getSettings(): Promise<SystemSettings> {
    if (isDemoAuthEnabled()) return (await demoService()).getSettings();
    if (!platformFeatureAvailable("systemSettings")) return DEFAULT_SYSTEM_SETTINGS;
    return authenticatedApiRequest("/settings", settingsSchema);
}

export async function updateSettings(patch: Partial<SystemSettings>, actor: User): Promise<UpdateSettingsResult> {
    if (isDemoAuthEnabled()) return (await demoService()).updateSettings(patch, actor);
    if (!platformFeatureAvailable("systemSettings")) unsupportedOperation("Saving system settings", "system settings");
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
    if (!platformFeatureAvailable("broadcasts")) return [];
    return (await drainAuthenticatedCursorPages("/broadcasts", backendBroadcastSchema)).map(adaptBroadcast);
}

export async function createBroadcast(input: CreateBroadcastInput, actor: User): Promise<CreateBroadcastResult> {
    if (isDemoAuthEnabled()) return (await demoService()).createBroadcast(input, actor);
    if (!platformFeatureAvailable("broadcasts")) unsupportedOperation("Sending a broadcast", "broadcasts");
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

/**
 * The admin dashboard's figures. API mode builds them from the user and video lists, since the backend has no
 * dashboard endpoint: it keeps no sign-in times or invitations, and audit entries aren't available yet.
 */
export async function getAdminOverview(now: Date = new Date(), viewer?: User | null): Promise<AdminOverview> {
    if (isDemoAuthEnabled()) return (await demoService()).getAdminOverview(now, viewer);
    const [users, videos] = await Promise.all([listUsers(), listVideos()]);
    const weekAgo = now.getTime() - 7 * DAY_MS;
    const accounts = (role: Role) => users.filter((user) => user.role === role).length;
    return {
        usersByRole: { fighter: accounts("fighter"), coach: accounts("coach"), doctor: accounts("doctor"), admin: accounts("admin") },
        activeUsers7d: null,
        activeAccounts: users.filter((user) => user.status === "active").length,
        invitedUsers: 0,
        suspendedUsers: users.filter((user) => user.status === "suspended").length,
        // The video list is capped at the service's 100 newest, so these are lower bounds on a large library.
        videosTotal: videos.length,
        videosLast7d: videos.filter((video) => Date.parse(video.uploadedAt) >= weekAgo).length,
        storageUsedGb: round(videos.reduce((total, video) => total + video.fileSizeMb, 0) / 1024, 1),
        recentAudit: [],
        recentFailures: [],
    };
}
