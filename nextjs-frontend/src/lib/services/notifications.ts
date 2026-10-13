import "server-only";

import { z } from "zod";

import { ApiError, authenticatedApiRequest, authenticatedMutableApiRequest } from "@/lib/api/client";
import { isDemoAuthEnabled } from "@/lib/auth/constants";
import { getSessionAccount, type SessionAccount } from "@/lib/auth/session";
import { NOTIFICATION_CATEGORY_LABELS } from "@/lib/domain/labels";
import type { Notification, NotificationCategory, NotificationSeverity, Role } from "@/lib/domain/types";
import { paginate } from "@/lib/query";
import { routes } from "@/lib/routes";
import { isNotFound } from "./api-helpers";

/**
 * The signed-in person's inbox. The notification service keeps typed events with a target record; the interface reads
 * them as categories with a severity and a link into the reader's own area. It pages its inbox and has no category
 * filter or "mark all read", so those stay demo-only.
 */

/** Who reads the inbox: where a notification links depends on the reader's area. */
export interface NotificationReader {
    id: string;
    role: Role | "applicant";
}

const notificationSchema = z.object({
    id: z.string(),
    type: z.string(),
    title: z.string(),
    message: z.string(),
    // Older rows may carry an empty payload; a malformed one only loses its link.
    payload: z
        .object({ target: z.object({ type: z.string(), id: z.string() }).optional(), data: z.record(z.string(), z.unknown()).optional() })
        .catch({}),
    readAt: z.string().nullable(),
    createdAt: z.string(),
});
const notificationPageSchema = z.object({ data: z.array(notificationSchema), total: z.number().int().nonnegative(), hasNextPage: z.boolean() });
const unreadCountSchema = z.object({ count: z.number().int().nonnegative() });

type ApiNotification = z.output<typeof notificationSchema>;

const TYPE_CATEGORY: Record<string, NotificationCategory> = {
    ADMISSION_APPLICATION_SUBMITTED: "admission",
    ADMISSION_ASSESSMENT_ASSIGNED: "admission",
    ADMISSION_ASSESSMENT_UNASSIGNED: "admission",
    ADMISSION_DECISION_REQUIRED: "admission",
    ADMISSION_ASSESSMENT_RESULT: "admission",
    ADMISSION_DECISION_RECORDED: "admission",
    ADMISSION_ACTIVATION_COMPLETED: "admission",
    COACH_ASSIGNMENT_STARTED: "training",
    COACH_ASSIGNMENT_ENDED: "training",
    TRAINING_PLAN_ACTIVATED: "training",
    TRAINING_SESSION_SCHEDULED: "training",
    TRAINING_SESSION_RESCHEDULED: "training",
    TRAINING_SESSION_CANCELLED: "training",
    SESSION_REMINDER: "training",
    FIGHTER_DOCTOR_ASSIGNMENT_REQUIRED: "medical",
    GOAL_SET: "goal",
    GOAL_ACHIEVED: "goal",
    MEDICAL_CLEARANCE_EXPIRY: "clearance",
    VIDEO_PROCESSED: "ai_analysis",
    ANOMALY_HIGH: "ai_alert",
    ANOMALY_MEDIUM: "ai_alert",
    JOINT_IMPAIRMENT_CONFIRMED: "ai_alert",
};

/** Bad news reads as a warning, good news as a success; anything else is informational. */
function severityOf({ type, payload }: ApiNotification): NotificationSeverity {
    const outcome = payload.data?.conclusion ?? payload.data?.decision;
    if (type === "ADMISSION_ASSESSMENT_RESULT" || type === "ADMISSION_DECISION_RECORDED") {
        return outcome === "PASS" || outcome === "APPROVED" ? "success" : outcome === "FAIL" || outcome === "REJECTED" ? "warning" : "info";
    }
    if (type === "ADMISSION_ACTIVATION_COMPLETED" || type === "GOAL_ACHIEVED") return "success";
    if (type === "ANOMALY_HIGH" || type === "JOINT_IMPAIRMENT_CONFIRMED") return "danger";
    if (["FIGHTER_DOCTOR_ASSIGNMENT_REQUIRED", "TRAINING_SESSION_CANCELLED", "ANOMALY_MEDIUM", "MEDICAL_CLEARANCE_EXPIRY"].includes(type)) return "warning";
    return "info";
}

/** The page the notification's record lives on, in the reader's own area; null when the reader has none for it. */
function hrefFor(target: { type: string; id: string } | undefined, role: NotificationReader["role"]): string | null {
    if (!target) return null;
    const { type, id } = target;
    switch (type) {
        case "FIGHTER_APPLICATION":
            return role === "admin" ? routes.admin.admission(id) : role === "coach" ? routes.coach.admission(id) : role === "applicant" ? routes.apply : null;
        case "TRAINING_PLAN":
            return role === "coach" ? routes.coach.plan(id) : role === "fighter" ? routes.fighter.plan(id) : null;
        case "TRAINING_SESSION":
            return role === "coach" ? routes.coach.session(id) : role === "fighter" ? routes.fighter.session(id) : null;
        // The target is the fighter's profile; an admin assigns their care team from the account list.
        case "FIGHTER":
            return role === "coach" ? routes.coach.fighter(id) : role === "doctor" ? routes.doctor.fighter(id) : role === "admin" ? routes.admin.users : null;
        case "COACH_ASSIGNMENT":
            return role === "coach" ? routes.coach.fighters : role === "fighter" ? routes.fighter.health : null;
        // Goals have no page of their own; the goals list shows them in context.
        case "GOAL":
            return role === "coach" ? routes.coach.goals : role === "fighter" ? routes.fighter.goals : null;
        default:
            return null;
    }
}

function toNotification(notification: ApiNotification, reader: NotificationReader): Notification {
    return {
        id: notification.id,
        userId: reader.id,
        category: TYPE_CATEGORY[notification.type] ?? "system",
        severity: severityOf(notification),
        title: notification.title,
        body: notification.message,
        href: hrefFor(notification.payload.target, reader.role),
        createdAt: notification.createdAt,
        readAt: notification.readAt,
    };
}

async function demoService(): Promise<typeof import("./notifications.demo")> {
    return import("./notifications.demo");
}

const CATEGORIES = Object.keys(NOTIFICATION_CATEGORY_LABELS) as NotificationCategory[];

export interface NotificationPage {
    items: Notification[];
    page: number;
    pageSize: number;
    pageCount: number;
    /** Notifications matching the read-status filter. */
    total: number;
    /** Every notification, when known: the service only counts the filter it was asked for. */
    all: number | null;
    unread: number;
    /** Category counts in the read-status filter; null where the service can't filter by category. */
    categories: { category: NotificationCategory; count: number }[] | null;
}

/** One page of the inbox, newest first. */
export async function getNotificationPage(
    reader: NotificationReader,
    query: { page: number; pageSize: number; unreadOnly: boolean; category?: NotificationCategory },
): Promise<NotificationPage> {
    if (isDemoAuthEnabled()) {
        const all = await (await demoService()).listNotifications(reader.id);
        const inStatus = query.unreadOnly ? all.filter((n) => n.readAt === null) : all;
        const page = paginate(query.category ? inStatus.filter((n) => n.category === query.category) : inStatus, query.page, query.pageSize);
        return {
            ...page,
            all: all.length,
            unread: all.filter((n) => n.readAt === null).length,
            categories: CATEGORIES.map((category) => ({ category, count: inStatus.filter((n) => n.category === category).length })).filter(
                ({ category, count }) => count > 0 || category === query.category,
            ),
        };
    }
    const listed = (page: number) => {
        const params = new URLSearchParams({ page: String(page), limit: String(query.pageSize), ...(query.unreadOnly ? { unreadOnly: "true" } : {}) });
        return authenticatedApiRequest(`/notifications?${params}`, notificationPageSchema);
    };
    const [requested, unread] = await Promise.all([listed(query.page), authenticatedApiRequest("/notifications/unread-count", unreadCountSchema)]);
    // Past the end (read or removed since the link was made): the last page instead, as demo mode does.
    const page = Math.min(query.page, Math.max(1, Math.ceil(requested.total / query.pageSize)));
    const result = page === query.page ? requested : await listed(page);
    return {
        items: result.data.map((notification) => toNotification(notification, reader)),
        page,
        pageSize: query.pageSize,
        pageCount: Math.max(1, Math.ceil(result.total / query.pageSize)),
        total: result.total,
        all: query.unreadOnly ? null : result.total,
        unread: unread.count,
        categories: null,
    };
}

/** Unread count and the latest few, for the header bell. */
export async function getNotificationSummary(reader: NotificationReader, limit = 6): Promise<{ unread: number; latest: Notification[] }> {
    if (isDemoAuthEnabled()) return (await demoService()).getNotificationSummary(reader.id, limit);
    const page = await getNotificationPage(reader, { page: 1, pageSize: limit, unreadOnly: false });
    return { unread: page.unread, latest: page.items };
}

export interface NotificationBellData {
    unread: number;
    latest: Notification[];
    canMarkAllRead: boolean;
    /** Whether the notification service streams new notifications; otherwise the bell polls. */
    live: boolean;
    /** The full inbox; applicants have none. */
    allHref: string | null;
}

/** The header bell, or null when the notification service doesn't answer: the page still loads, without the bell. */
export async function getNotificationBell(reader: NotificationReader): Promise<NotificationBellData | null> {
    try {
        const summary = await getNotificationSummary(reader);
        return { ...summary, canMarkAllRead: canMarkAllNotificationsRead(), live: !isDemoAuthEnabled(), allHref: reader.role === "applicant" ? null : routes.notifications };
    } catch (error) {
        if (error instanceof ApiError) return null;
        throw error;
    }
}

/** The notification reader behind a session: an academy member, or an applicant hearing about their application. */
export function readerOf(account: SessionAccount): NotificationReader {
    return account.kind === "user" ? { id: account.user.id, role: account.user.role } : { id: account.applicant.id, role: "applicant" };
}

/** The signed-in reader's unread count, for polling while the live stream isn't available; null when signed out. */
export async function getUnreadNotificationCount(): Promise<number | null> {
    if (isDemoAuthEnabled()) {
        const account = await getSessionAccount();
        return account ? (await demoService()).getNotificationSummary(readerOf(account).id, 0).unread : null;
    }
    // The service counts the token's own notifications, so a poll never looks up the profile.
    return (await authenticatedApiRequest("/notifications/unread-count", unreadCountSchema)).count;
}

/** Marks one notification read; false when it no longer exists (or isn't the reader's). Marking twice is harmless. */
export async function markNotificationRead(reader: NotificationReader, notificationId: string): Promise<boolean> {
    if (isDemoAuthEnabled()) return (await demoService()).markNotificationRead(reader.id, notificationId);
    try {
        await authenticatedMutableApiRequest(`/notifications/${encodeURIComponent(notificationId)}/read`, notificationSchema, { method: "PATCH" });
        return true;
    } catch (error) {
        if (isNotFound(error)) return false;
        throw error;
    }
}

/** Whether "mark all read" exists: the notification service has no such route yet. */
export function canMarkAllNotificationsRead(): boolean {
    return isDemoAuthEnabled();
}

/** Demo only (see `canMarkAllNotificationsRead`). */
export async function markAllNotificationsRead(reader: NotificationReader): Promise<number> {
    return (await demoService()).markAllNotificationsRead(reader.id);
}
