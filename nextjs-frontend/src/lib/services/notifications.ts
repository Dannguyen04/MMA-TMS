import "server-only";

import type { Notification, NotificationCategory, NotificationSeverity, User } from "@/lib/domain/types";
import { db, newId, nowIso, simulateLatency } from "@/lib/mocks/db";

export async function listNotifications(
    userId: string,
    filter: { category?: NotificationCategory; unreadOnly?: boolean } = {},
): Promise<Notification[]> {
    await simulateLatency();
    return db()
        .notifications.filter(
            (n) =>
                n.userId === userId &&
                (!filter.category || n.category === filter.category) &&
                (!filter.unreadOnly || n.readAt === null),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Unread count and latest items for the header bell. Not delayed: rendered on every page. */
export function getNotificationSummary(userId: string, limit = 6): { unread: number; latest: Notification[] } {
    const mine = db()
        .notifications.filter((n) => n.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { unread: mine.filter((n) => n.readAt === null).length, latest: mine.slice(0, limit) };
}

export function markNotificationRead(userId: string, notificationId: string): boolean {
    const notification = db().notifications.find((n) => n.id === notificationId && n.userId === userId);
    if (!notification) return false;
    notification.readAt ??= nowIso();
    return true;
}

export function markAllNotificationsRead(userId: string): number {
    const now = nowIso();
    let count = 0;
    for (const n of db().notifications) {
        if (n.userId === userId && n.readAt === null) {
            n.readAt = now;
            count += 1;
        }
    }
    return count;
}

export interface NotifyInput {
    userIds: string[];
    category: NotificationCategory;
    severity?: NotificationSeverity;
    title: string;
    body: string;
    href?: string | null;
}

/** Creates in-app notifications — used by other services when something relevant happens. */
export function notifyUsers(input: NotifyInput): Notification[] {
    const createdAt = nowIso();
    const created = input.userIds.map<Notification>((userId) => ({
        id: newId("ntf"),
        userId,
        category: input.category,
        severity: input.severity ?? "info",
        title: input.title,
        body: input.body,
        href: input.href ?? null,
        createdAt,
        readAt: null,
    }));
    db().notifications.unshift(...created);
    return created;
}

/** Resolves user ids for staff assigned to a fighter, optionally filtered by role. */
export function staffUserIdsForFighter(fighterId: string, roles: User["role"][]): string[] {
    const store = db();
    const ids: string[] = [];
    if (roles.includes("coach")) {
        ids.push(...store.coaches.filter((c) => c.fighterIds.includes(fighterId)).map((c) => c.userId));
    }
    if (roles.includes("doctor")) {
        ids.push(...store.doctors.filter((d) => d.fighterIds.includes(fighterId)).map((d) => d.userId));
    }
    if (roles.includes("fighter")) {
        const fighter = store.fighters.find((f) => f.id === fighterId);
        if (fighter) ids.push(fighter.userId);
    }
    return ids;
}
