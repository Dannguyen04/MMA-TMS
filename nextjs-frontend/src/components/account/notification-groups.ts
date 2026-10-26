import type { Notification } from "@/lib/domain/types";
import { dayKey, daysBetween, formatDate, formatWeekdayDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n/translate";

export interface NotificationDayGroup {
    /** Calendar day in the academy timezone, e.g. 2026-09-14. */
    key: string;
    label: string;
    items: Notification[];
}

/** "Today", "Yesterday", "Mon, 8 Sept" — with the year once it is more than ~10 months back. */
export function dayGroupLabel(value: string, now: string, locale: Locale = "en"): string {
    const age = daysBetween(value, now);
    const t = createTranslator(locale);
    if (age === 0) return t("notifications.today");
    if (age === 1) return t("notifications.yesterday");
    return age > 300 ? formatDate(value, locale) : formatWeekdayDate(value, locale);
}

/** Groups notifications (already sorted newest first) into consecutive academy calendar days. */
export function groupNotificationsByDay(notifications: Notification[], now: string, locale: Locale = "en"): NotificationDayGroup[] {
    const groups: NotificationDayGroup[] = [];
    for (const notification of notifications) {
        const key = dayKey(notification.createdAt);
        const last = groups[groups.length - 1];
        if (last?.key === key) last.items.push(notification);
        else groups.push({ key, label: dayGroupLabel(notification.createdAt, now, locale), items: [notification] });
    }
    return groups;
}
