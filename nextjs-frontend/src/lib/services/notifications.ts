import "server-only";

import { z } from "zod";

import { isDemoAuthEnabled } from "@/lib/auth/constants";
import { authenticatedApiRequest, authenticatedMutableApiRequest, drainAuthenticatedCursorPages } from "@/lib/api/client";
import type { Notification, NotificationCategory, NotificationSeverity } from "@/lib/domain/types";
import { isNotFound } from "./api-helpers";

const categorySchema = z.enum(["TRAINING", "AI_ANALYSIS", "AI_ALERT", "FEEDBACK", "MEDICAL", "CLEARANCE", "GOAL", "SYSTEM"]);
const severitySchema = z.enum(["INFO", "SUCCESS", "WARNING", "DANGER"]);
const backendNotificationSchema = z.object({
    id: z.string(),
    userId: z.string(),
    category: categorySchema,
    severity: severitySchema,
    title: z.string(),
    body: z.string(),
    href: z.string().nullable(),
    createdAt: z.string(),
    readAt: z.string().nullable(),
});
const summarySchema = z.object({
    unread: z.number().int().nonnegative(),
    latest: z.array(backendNotificationSchema),
});

type BackendNotification = z.infer<typeof backendNotificationSchema>;

const categoryFromApi: Record<z.infer<typeof categorySchema>, NotificationCategory> = {
    TRAINING: "training",
    AI_ANALYSIS: "ai_analysis",
    AI_ALERT: "ai_alert",
    FEEDBACK: "feedback",
    MEDICAL: "medical",
    CLEARANCE: "clearance",
    GOAL: "goal",
    SYSTEM: "system",
};
const categoryToApi: Record<NotificationCategory, keyof typeof categoryFromApi> = {
    training: "TRAINING",
    ai_analysis: "AI_ANALYSIS",
    ai_alert: "AI_ALERT",
    feedback: "FEEDBACK",
    medical: "MEDICAL",
    clearance: "CLEARANCE",
    goal: "GOAL",
    system: "SYSTEM",
};
const severityFromApi: Record<z.infer<typeof severitySchema>, NotificationSeverity> = {
    INFO: "info",
    SUCCESS: "success",
    WARNING: "warning",
    DANGER: "danger",
};

function toNotification(notification: BackendNotification): Notification {
    return {
        ...notification,
        category: categoryFromApi[notification.category],
        severity: severityFromApi[notification.severity],
    };
}

async function demoService(): Promise<typeof import("./notifications.demo")> {
    return import("./notifications.demo");
}

export async function listNotifications(
    userId: string,
    filter: { category?: NotificationCategory; unreadOnly?: boolean } = {},
): Promise<Notification[]> {
    if (isDemoAuthEnabled()) return (await demoService()).listNotifications(userId, filter);
    const params = new URLSearchParams();
    if (filter.category) params.set("category", categoryToApi[filter.category]);
    if (filter.unreadOnly) params.set("unreadOnly", "true");
    const query = params.toString();
    return (await drainAuthenticatedCursorPages(`/notifications${query ? `?${query}` : ""}`, backendNotificationSchema)).map(
        toNotification,
    );
}

export async function getNotificationSummary(
    userId: string,
    limit = 6,
): Promise<{ unread: number; latest: Notification[] }> {
    if (isDemoAuthEnabled()) return (await demoService()).getNotificationSummary(userId, limit);
    const summary = await authenticatedApiRequest(`/notifications/summary?limit=${encodeURIComponent(limit)}`, summarySchema);
    return { unread: summary.unread, latest: summary.latest.map(toNotification) };
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<boolean> {
    if (isDemoAuthEnabled()) return (await demoService()).markNotificationRead(userId, notificationId);
    try {
        await authenticatedMutableApiRequest(`/notifications/${encodeURIComponent(notificationId)}/read`, z.null(), { method: "PATCH" });
        return true;
    } catch (error) {
        if (isNotFound(error)) return false;
        throw error;
    }
}

export async function markAllNotificationsRead(userId: string): Promise<number> {
    if (isDemoAuthEnabled()) return (await demoService()).markAllNotificationsRead(userId);
    const result = await authenticatedMutableApiRequest(
        "/notifications/read-all",
        z.object({ count: z.number().int().nonnegative() }),
        { method: "POST" },
    );
    return result.count;
}
