import "server-only";

/** Trien khai quan tri demo, chi duoc nap khi che do demo duoc bat. */

import { cache } from "react";

import { isDoctorOnlyPermission } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { BROADCAST_CHANNEL_LABELS, ROLE_LABELS, USER_STATUS_LABELS } from "@/lib/domain/labels";
import type {
    AuditLog,
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
import { DAY_MS, formatConfidence, formatDateTime, pluralize } from "@/lib/format";
import { db, newId, nowIso, simulateLatency } from "@/lib/mocks/db";
import { ALL_PERMISSIONS } from "@/lib/mocks/roles";
import { matchesSearch } from "@/lib/query";
import { dashboardPath, routes } from "@/lib/routes";
import { round, sum } from "@/lib/utils";
import { recordAudit, toAuditView } from "./audit.demo";
import { notifyUsers } from "./notifications.demo";
import { syncProfileName } from "./people";
import type {
    AdminOverview,
    CreateBroadcastInput,
    CreateBroadcastResult,
    InviteUserInput,
    InviteUserResult,
    PermissionCatalogEntry,
    ResendInviteResult,
    SetUserStatusResult,
    UpdateRolePermissionsResult,
    UpdateSettingsResult,
    UpdateUserResult,
    UserDetail,
    UserFilter,
    UserPatch,
} from "./admin";

/**
 * Platform administration: user accounts, roles, system settings, broadcasts and the
 * admin overview. Admins operate the platform but have no clinical access, so nothing
 * here reads medical records.
 */

/** Permissions the Administrator role can never lose — without them nobody could restore access. */
const ADMIN_REQUIRED_PERMISSIONS: Permission[] = ["users:manage", "roles:manage"];

const RECENT_USER_AUDIT_LIMIT = 10;
const OVERVIEW_AUDIT_LIMIT = 8;
const OVERVIEW_FAILURE_LIMIT = 5;

const SETTING_LABELS: Record<keyof SystemSettings, string> = {
    organizationName: "Organization name",
    timezone: "Timezone",
    sessionTimeoutMin: "Session timeout",
    requireMfa: "Require MFA",
    videoMaxSizeMb: "Maximum video size",
    videoRetentionDays: "Video retention",
    allowedVideoFormats: "Allowed video formats",
    aiConfidenceThreshold: "AI detection threshold",
    aiLowConfidenceThreshold: "Low-confidence review threshold",
    abnormalMovementAlertsEnabled: "Abnormal movement alerts",
    notifyDoctorOnAlert: "Notify doctor on alert",
    clearanceExpiryWarningDays: "Clearance expiry warning",
};

/* ─── Users ───────────────────────────────────────────────────────────────── */

/** All accounts matching the filter, sorted by name. */
export async function listUsers(filter: UserFilter = {}): Promise<User[]> {
    await simulateLatency();
    return db()
        .users.filter(
            (user) =>
                (!filter.role || user.role === filter.role) &&
                (!filter.status || user.status === filter.status) &&
                matchesSearch(filter.search, user.name, user.email, user.title),
        )
        .sort((a, b) => a.name.localeCompare(b.name, "en"));
}

/**
 * Account, linked profile, recent activity and effective permissions; null when missing.
 * Activity is shown as `viewer` (default: the signed-in user) may see it — see `toAuditView`.
 */
export async function getUserDetail(id: string, viewer?: User | null): Promise<UserDetail | null> {
    const [reader] = await Promise.all([viewer === undefined ? getCurrentUser() : viewer, simulateLatency()]);
    const store = db();
    const user = store.users.find((u) => u.id === id);
    if (!user) return null;
    return {
        user,
        profile: linkedProfile(user),
        recentAudit: store.auditLogs
            .filter((log) => log.actorId === user.id)
            .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
            .slice(0, RECENT_USER_AUDIT_LIMIT)
            .map((log) => toAuditView(log, reader)),
        permissions: store.roleDefinitions.find((r) => r.role === user.role)?.permissions ?? [],
    };
}

/** Creates an invited account. Emails are unique regardless of case or account status. */
export async function inviteUser(input: InviteUserInput, actor: User): Promise<InviteUserResult> {
    const store = db();
    const email = input.email.trim().toLowerCase();
    if (store.users.some((u) => u.email.toLowerCase() === email)) {
        return { ok: false, code: "email_taken", message: `${email} already belongs to an account.` };
    }

    const user: User = {
        id: newId("u"),
        email,
        name: input.name.trim(),
        role: input.role,
        title: input.title.trim(),
        phone: null,
        status: "invited",
        createdAt: nowIso(),
        lastActiveAt: null,
        profileId: null,
    };
    store.users.push(user);
    recordAudit({
        actor,
        action: "user.invite",
        resourceType: "user",
        resourceId: user.id,
        resourceLabel: accountLabel(user),
        details: `Invited as ${user.title}`,
    });
    return { ok: true, user };
}

/**
 * Updates name, title and role. You can't change your own role, and accounts with a fighter,
 * coach or doctor profile keep their role (invite a new account instead).
 */
export async function updateUser(id: string, patch: UserPatch, actor: User): Promise<UpdateUserResult> {
    const user = db().users.find((u) => u.id === id);
    if (!user) return { ok: false, code: "not_found", message: "That account no longer exists." };

    const newRole = patch.role !== undefined && patch.role !== user.role ? patch.role : null;
    if (newRole && user.id === actor.id) {
        return { ok: false, code: "own_role", message: "You can't change your own role. Ask another administrator." };
    }
    if (newRole && user.profileId !== null) {
        return {
            ok: false,
            code: "profile_linked",
            message: `${user.name} has a ${ROLE_LABELS[user.role].toLowerCase()} profile, so the role can't change. Invite a new ${ROLE_LABELS[newRole].toLowerCase()} account instead.`,
        };
    }

    const changes: string[] = [];
    const name = patch.name?.trim();
    if (name && name !== user.name) {
        changes.push(`Name: ${user.name} → ${name}`);
        user.name = name;
        await syncProfileName(user);
    }
    const title = patch.title?.trim();
    if (title && title !== user.title) {
        changes.push(`Title: ${user.title} → ${title}`);
        user.title = title;
    }
    if (changes.length > 0) {
        recordAudit({
            actor,
            action: "user.update",
            resourceType: "user",
            resourceId: user.id,
            resourceLabel: accountLabel(user),
            details: changes.join(" · "),
        });
    }

    if (newRole) {
        const previousRole = user.role;
        user.role = newRole;
        recordAudit({
            actor,
            action: "user.update_role",
            resourceType: "user",
            resourceId: user.id,
            resourceLabel: accountLabel(user),
            details: `${ROLE_LABELS[previousRole]} → ${ROLE_LABELS[newRole]}`,
        });
        if (user.status === "active") {
            notifyUsers({
                userIds: [user.id],
                category: "system",
                severity: "warning",
                title: "Your role has changed",
                body: `${actor.name} changed your role from ${ROLE_LABELS[previousRole]} to ${ROLE_LABELS[newRole]}. Your menu and access now match the new role.`,
                href: dashboardPath(newRole),
            });
        }
    }
    return { ok: true, user };
}

/** Suspends, reactivates or manually activates an account. You can't suspend yourself. */
export async function setUserStatus(id: string, status: UserStatus, actor: User): Promise<SetUserStatusResult> {
    const user = db().users.find((u) => u.id === id);
    if (!user) return { ok: false, code: "not_found", message: "That account no longer exists." };
    if (status === user.status) return { ok: true, user };

    if (user.id === actor.id) {
        return { ok: false, code: "own_account", message: "You can't suspend your own account. Ask another administrator." };
    }
    if (status === "invited") {
        return {
            ok: false,
            code: "invalid_status",
            message: "An account that has been activated can't return to invited. Suspend it instead.",
        };
    }

    const previous = user.status;
    user.status = status;
    recordAudit({
        actor,
        action: status === "suspended" ? "user.suspend" : previous === "invited" ? "user.activate" : "user.reactivate",
        resourceType: "user",
        resourceId: user.id,
        resourceLabel: accountLabel(user),
        details: `${USER_STATUS_LABELS[previous]} → ${USER_STATUS_LABELS[status]}`,
    });
    if (status === "active" && previous === "suspended") {
        notifyUsers({
            userIds: [user.id],
            category: "system",
            severity: "success",
            title: "Your account has been reactivated",
            body: `${actor.name} reactivated your account. Your previous access has been restored.`,
            href: dashboardPath(user.role),
        });
    }
    return { ok: true, user };
}

/** Sends the invitation email again. Only for accounts that haven't accepted yet. */
export async function resendInvite(id: string, actor: User): Promise<ResendInviteResult> {
    const user = db().users.find((u) => u.id === id);
    if (!user) return { ok: false, code: "not_found", message: "That account no longer exists." };
    if (user.status !== "invited") {
        return { ok: false, code: "not_invited", message: `${user.name} has already accepted the invitation.` };
    }
    recordAudit({
        actor,
        action: "user.resend_invite",
        resourceType: "user",
        resourceId: user.id,
        resourceLabel: accountLabel(user),
        details: `Invitation email sent again to ${user.email}`,
    });
    return { ok: true, user };
}

/* ─── Roles ───────────────────────────────────────────────────────────────── */

/** The four role definitions with their permissions. */
export async function listRoleDefinitions(): Promise<RoleDefinition[]> {
    await simulateLatency();
    return db().roleDefinitions;
}

/** Every permission the platform knows, in display order, with its label and group. Static reference data, read once per request. */
export const listPermissionCatalog = cache(async (): Promise<PermissionCatalogEntry[]> => {
    await simulateLatency();
    return ALL_PERMISSIONS.map((entry) => ({ ...entry }));
});

/**
 * Replaces a role's permissions and tells its active members. The Administrator role must
 * keep `users:manage` and `roles:manage`, and clinical permissions stay with the sports doctor role.
 */
export async function updateRolePermissions(
    role: Role,
    permissions: Permission[],
    actor: User,
): Promise<UpdateRolePermissionsResult> {
    const store = db();
    const definition = store.roleDefinitions.find((r) => r.role === role);
    if (!definition) return { ok: false, code: "not_found", message: "That role no longer exists." };

    const next = [...new Set(permissions)];
    const clinical = next.filter(isDoctorOnlyPermission);
    if (role !== "doctor" && clinical.length > 0) {
        return {
            ok: false,
            code: "clinical_permission_forbidden",
            message: `Clinical permissions are limited to the sports doctor role. Remove ${clinical.join(", ")} from the ${definition.label} role.`,
        };
    }
    if (role === "admin" && ADMIN_REQUIRED_PERMISSIONS.some((p) => !next.includes(p))) {
        return {
            ok: false,
            code: "admin_lockout",
            message: "The Administrator role must keep users:manage and roles:manage, otherwise nobody could restore access.",
        };
    }

    const added = next.filter((p) => !definition.permissions.includes(p));
    const removed = definition.permissions.filter((p) => !next.includes(p));
    if (added.length === 0 && removed.length === 0) return { ok: true, role: definition };

    definition.permissions = next;
    recordAudit({
        actor,
        action: "role.update_permissions",
        resourceType: "role",
        resourceId: role,
        resourceLabel: `${definition.label} role`,
        details: [added.length > 0 && `Added: ${added.join(", ")}`, removed.length > 0 && `Removed: ${removed.join(", ")}`]
            .filter(Boolean)
            .join(" · "),
    });
    notifyUsers({
        userIds: store.users.filter((u) => u.role === role && u.status === "active" && u.id !== actor.id).map((u) => u.id),
        category: "system",
        title: "Permissions updated for your role",
        body: `${actor.name} changed what the ${definition.label} role can do. Some pages or actions may look different.`,
        href: dashboardPath(role),
    });
    return { ok: true, role: definition };
}

/* ─── Settings ────────────────────────────────────────────────────────────── */

/** A copy of the current system settings. */
export async function getSettings(): Promise<SystemSettings> {
    await simulateLatency();
    return structuredClone(db().settings);
}

/**
 * Validates and applies a settings patch. The AI detection threshold must stay below the
 * low-confidence review threshold, and both must be between 5% and 95%.
 */
export async function updateSettings(patch: Partial<SystemSettings>, actor: User): Promise<UpdateSettingsResult> {
    const store = db();
    const next: SystemSettings = { ...store.settings, ...normalizeSettingsPatch(patch) };
    const invalid = validateSettings(next);
    if (invalid) return { ok: false, code: "invalid", ...invalid };

    const changedKeys = (Object.keys(SETTING_LABELS) as (keyof SystemSettings)[]).filter(
        (key) => JSON.stringify(store.settings[key]) !== JSON.stringify(next[key]),
    );
    if (changedKeys.length === 0) return { ok: true, settings: structuredClone(store.settings) };

    const previous = store.settings;
    store.settings = next;
    recordAudit({
        actor,
        action: "settings.update",
        resourceType: "settings",
        resourceId: "system-settings",
        resourceLabel: "System settings",
        details: changedKeys
            .map((key) => `${SETTING_LABELS[key]}: ${formatSetting(key, previous[key])} → ${formatSetting(key, next[key])}`)
            .join(" · "),
    });
    if (changedKeys.includes("abnormalMovementAlertsEnabled")) {
        notifyUsers({
            userIds: store.users.filter((u) => u.role === "doctor" && u.status === "active").map((u) => u.id),
            category: "system",
            severity: next.abnormalMovementAlertsEnabled ? "info" : "warning",
            title: next.abnormalMovementAlertsEnabled ? "AI movement observations resumed" : "AI movement observations paused",
            body: next.abnormalMovementAlertsEnabled
                ? "New analyses will flag possible abnormal movement for your review again."
                : "New analyses won't flag possible abnormal movement until an administrator turns this back on. Existing observations are unchanged.",
            href: routes.doctor.aiAlerts,
        });
    }
    return { ok: true, settings: structuredClone(next) };
}

/* ─── Broadcasts ──────────────────────────────────────────────────────────── */

/** All broadcasts, newest first. */
export async function listBroadcasts(): Promise<NotificationBroadcast[]> {
    await simulateLatency();
    return [...db().broadcasts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Sends a broadcast now (scheduledFor null) or schedules it. Sending counts the active users in
 * the audience and, for in-app channels, delivers a notification to each of them.
 */
export async function createBroadcast(input: CreateBroadcastInput, actor: User): Promise<CreateBroadcastResult> {
    const store = db();
    const audience = [...new Set(input.audience)];
    if (audience.length === 0) {
        return { ok: false, code: "no_audience", field: "audience", message: "Choose at least one role to receive this broadcast." };
    }
    if (input.scheduledFor !== null) {
        const scheduledAt = Date.parse(input.scheduledFor);
        if (Number.isNaN(scheduledAt) || scheduledAt <= Date.now()) {
            return { ok: false, code: "schedule_in_past", field: "scheduledFor", message: "Pick a send time in the future, or send it now." };
        }
    }

    const recipients = store.users.filter((u) => u.status === "active" && audience.includes(u.role));
    const now = nowIso();
    const sendNow = input.scheduledFor === null;
    const broadcast: NotificationBroadcast = {
        id: newId("brd"),
        title: input.title.trim(),
        body: input.body.trim(),
        audience,
        channel: input.channel,
        status: sendNow ? "sent" : "scheduled",
        scheduledFor: input.scheduledFor,
        sentAt: sendNow ? now : null,
        recipientCount: recipients.length,
        createdById: actor.id,
        createdAt: now,
    };
    store.broadcasts.unshift(broadcast);

    const audienceLabel = audience.map((role) => ROLE_LABELS[role]).join(", ");
    const delivery = `${pluralize(recipients.length, "recipient")} · ${audienceLabel} · ${BROADCAST_CHANNEL_LABELS[broadcast.channel]}`;
    recordAudit({
        actor,
        action: "notification.broadcast",
        resourceType: "notification",
        resourceId: broadcast.id,
        resourceLabel: broadcast.title,
        details: sendNow ? `Sent to ${delivery}` : `Scheduled for ${formatDateTime(input.scheduledFor ?? now)} · ${delivery}`,
    });
    if (sendNow && broadcast.channel !== "email") {
        notifyUsers({
            userIds: recipients.map((u) => u.id),
            category: "system",
            title: broadcast.title,
            body: broadcast.body,
            href: routes.notifications,
        });
    }
    return { ok: true, broadcast };
}

/* ─── Overview ────────────────────────────────────────────────────────────── */

/** Headline numbers for the admin dashboard. Audit entries are shown as `viewer` (default: the signed-in user) may see them. */
export async function getAdminOverview(now: Date = new Date(), viewer?: User | null): Promise<AdminOverview> {
    const [reader] = await Promise.all([viewer === undefined ? getCurrentUser() : viewer, simulateLatency()]);
    const store = db();
    const weekAgo = now.getTime() - 7 * DAY_MS;
    const byNewest = [...store.auditLogs].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const asSeen = (logs: AuditLog[]) => logs.map((log) => toAuditView(log, reader));

    return {
        usersByRole: {
            fighter: store.users.filter((u) => u.role === "fighter").length,
            coach: store.users.filter((u) => u.role === "coach").length,
            doctor: store.users.filter((u) => u.role === "doctor").length,
            admin: store.users.filter((u) => u.role === "admin").length,
        },
        activeUsers7d: store.users.filter(
            (u) => u.status === "active" && u.lastActiveAt !== null && Date.parse(u.lastActiveAt) >= weekAgo,
        ).length,
        invitedUsers: store.users.filter((u) => u.status === "invited").length,
        suspendedUsers: store.users.filter((u) => u.status === "suspended").length,
        videosTotal: store.videos.length,
        videosLast7d: store.videos.filter((v) => Date.parse(v.uploadedAt) >= weekAgo).length,
        storageUsedGb: round(sum(store.videos.map((v) => v.fileSizeMb)) / 1024, 1),
        recentAudit: asSeen(byNewest.slice(0, OVERVIEW_AUDIT_LIMIT)),
        recentFailures: asSeen(byNewest.filter((log) => log.status === "failure").slice(0, OVERVIEW_FAILURE_LIMIT)),
    };
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function accountLabel(user: User): string {
    return `${user.name} — ${ROLE_LABELS[user.role]} account`;
}

function linkedProfile(user: User): Fighter | Coach | Doctor | null {
    if (!user.profileId) return null;
    const store = db();
    switch (user.role) {
        case "fighter":
            return store.fighters.find((f) => f.id === user.profileId) ?? null;
        case "coach":
            return store.coaches.find((c) => c.id === user.profileId) ?? null;
        case "doctor":
            return store.doctors.find((d) => d.id === user.profileId) ?? null;
        case "admin":
            return null;
    }
}

function normalizeSettingsPatch(patch: Partial<SystemSettings>): Partial<SystemSettings> {
    const normalized: Partial<SystemSettings> = { ...patch };
    if (patch.organizationName !== undefined) normalized.organizationName = patch.organizationName.trim();
    if (patch.timezone !== undefined) normalized.timezone = patch.timezone.trim();
    if (patch.allowedVideoFormats !== undefined) {
        normalized.allowedVideoFormats = [
            ...new Set(patch.allowedVideoFormats.map((format) => format.trim().toLowerCase().replace(/^\./, "")).filter(Boolean)),
        ];
    }
    return normalized;
}

function validateSettings(settings: SystemSettings): { field: keyof SystemSettings; message: string } | null {
    const outOfRange = (value: number, min: number, max: number) => !Number.isFinite(value) || value < min || value > max;

    if (settings.organizationName.length === 0) return { field: "organizationName", message: "Enter the organization name." };
    if (!isValidTimezone(settings.timezone)) return { field: "timezone", message: "Choose a valid IANA timezone, e.g. Asia/Ho_Chi_Minh." };
    if (!Number.isInteger(settings.sessionTimeoutMin) || outOfRange(settings.sessionTimeoutMin, 15, 1440)) {
        return { field: "sessionTimeoutMin", message: "Session timeout must be a whole number between 15 and 1440 minutes." };
    }
    if (!Number.isInteger(settings.videoMaxSizeMb) || outOfRange(settings.videoMaxSizeMb, 50, 4096)) {
        return { field: "videoMaxSizeMb", message: "Maximum video size must be between 50 and 4096 MB." };
    }
    if (!Number.isInteger(settings.videoRetentionDays) || outOfRange(settings.videoRetentionDays, 30, 3650)) {
        return { field: "videoRetentionDays", message: "Video retention must be between 30 and 3650 days." };
    }
    if (settings.allowedVideoFormats.length === 0) {
        return { field: "allowedVideoFormats", message: "Allow at least one video format." };
    }
    if (outOfRange(settings.aiConfidenceThreshold, 0.05, 0.95)) {
        return { field: "aiConfidenceThreshold", message: "The AI detection threshold must be between 5% and 95%." };
    }
    if (outOfRange(settings.aiLowConfidenceThreshold, 0.05, 0.95)) {
        return { field: "aiLowConfidenceThreshold", message: "The low-confidence review threshold must be between 5% and 95%." };
    }
    if (settings.aiLowConfidenceThreshold <= settings.aiConfidenceThreshold) {
        return {
            field: "aiLowConfidenceThreshold",
            message: `The low-confidence review threshold must be higher than the detection threshold (${formatConfidence(settings.aiConfidenceThreshold)}), otherwise no detection would be flagged for review.`,
        };
    }
    if (!Number.isInteger(settings.clearanceExpiryWarningDays) || outOfRange(settings.clearanceExpiryWarningDays, 1, 90)) {
        return { field: "clearanceExpiryWarningDays", message: "The clearance expiry warning must be between 1 and 90 days." };
    }
    return null;
}

function isValidTimezone(timezone: string): boolean {
    if (timezone.length === 0) return false;
    try {
        new Intl.DateTimeFormat("en", { timeZone: timezone });
        return true;
    } catch {
        return false;
    }
}

function formatSetting<K extends keyof SystemSettings>(key: K, value: SystemSettings[K]): string {
    if (typeof value === "boolean") return value ? "On" : "Off";
    if (Array.isArray(value)) return value.join(", ");
    switch (key) {
        case "sessionTimeoutMin":
            return `${value} min`;
        case "videoMaxSizeMb":
            return `${value} MB`;
        case "videoRetentionDays":
        case "clearanceExpiryWarningDays":
            return `${value} days`;
        case "aiConfidenceThreshold":
        case "aiLowConfidenceThreshold":
            return formatConfidence(Number(value));
        default:
            return String(value);
    }
}
