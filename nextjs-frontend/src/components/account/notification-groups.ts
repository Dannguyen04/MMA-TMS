import type { Notification } from "@/lib/domain/types";
import { dayKey, daysBetween, formatDate, formatWeekdayDate } from "@/lib/format";

export interface NotificationDayGroup {
    /** Calendar day in the academy timezone, e.g. 2026-09-14. */
    key: string;
    label: string;
    items: Notification[];
}

/** "Today", "Yesterday", "Mon, 8 Sept" — with the year once it is more than ~10 months back. */
export function dayGroupLabel(value: string, now: string): string {
    const age = daysBetween(value, now);
    if (age === 0) return "Today";
    if (age === 1) return "Yesterday";
    return age > 300 ? formatDate(value) : formatWeekdayDate(value);
}

/** Groups notifications (already sorted newest first) into consecutive academy calendar days. */
export function groupNotificationsByDay(notifications: Notification[], now: string): NotificationDayGroup[] {
    const groups: NotificationDayGroup[] = [];
    for (const notification of notifications) {
        const key = dayKey(notification.createdAt);
        const last = groups[groups.length - 1];
        if (last?.key === key) last.items.push(notification);
        else groups.push({ key, label: dayGroupLabel(notification.createdAt, now), items: [notification] });
    }
    return groups;
}
