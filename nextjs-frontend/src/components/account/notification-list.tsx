import { NOTIFICATION_CATEGORY_ICONS, NOTIFICATION_SEVERITY_TONE } from "@/components/domain/notification-meta";
import { TONE_SOFT } from "@/components/ui/tone";
import { NOTIFICATION_CATEGORY_LABELS } from "@/lib/domain/labels";
import type { Notification } from "@/lib/domain/types";
import { formatDateTime, formatRelative, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { NotificationItemActions } from "./notification-actions";
import { groupNotificationsByDay } from "./notification-groups";

/** Notifications grouped under day headings ("Today", "Yesterday", "Mon, 8 Sept"). */
export function NotificationList({ notifications, now }: { notifications: Notification[]; now: string }) {
    const groups = groupNotificationsByDay(notifications, now);

    return (
        <div>
            {groups.map((group) => {
                const headingId = `notifications-${group.key}`;
                const unread = group.items.filter((item) => item.readAt === null).length;
                return (
                    <section key={group.key} aria-labelledby={headingId} className="border-b border-border last:border-b-0">
                        <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-muted/60 px-5 py-2">
                            <h2 id={headingId} className="text-xs font-semibold tracking-wide text-fg-muted uppercase">
                                {group.label}
                            </h2>
                            <p className="text-xs text-fg-subtle">
                                {pluralize(group.items.length, "notification")}
                                {unread > 0 && ` · ${unread} unread`}
                            </p>
                        </div>
                        <ul className="divide-y divide-border">
                            {group.items.map((notification) => (
                                <NotificationRow key={notification.id} notification={notification} now={now} />
                            ))}
                        </ul>
                    </section>
                );
            })}
        </div>
    );
}

function NotificationRow({ notification, now }: { notification: Notification; now: string }) {
    const Icon = NOTIFICATION_CATEGORY_ICONS[notification.category];
    const unread = notification.readAt === null;

    return (
        <li
            data-notification
            tabIndex={-1}
            className={cn("flex gap-3 px-5 py-4 focus-visible:outline-offset-[-2px] sm:gap-4", unread && "bg-primary-soft/30")}
        >
            <span
                aria-hidden
                className={cn(
                    "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset",
                    TONE_SOFT[NOTIFICATION_SEVERITY_TONE[notification.severity]],
                )}
            >
                <Icon className="size-[18px]" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-6">
                <div className="min-w-0">
                    <h3 className={cn("text-sm leading-5 text-pretty text-fg", unread ? "font-semibold" : "font-medium")}>
                        {notification.title}
                        {unread && (
                            <span className="ml-2 inline-block size-2 rounded-full bg-primary align-middle">
                                <span className="sr-only">Unread</span>
                            </span>
                        )}
                    </h3>
                    <p className="mt-0.5 max-w-3xl text-[13px] text-pretty text-fg-muted">{notification.body}</p>
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-xs text-fg-subtle">
                        <span>{NOTIFICATION_CATEGORY_LABELS[notification.category]}</span>
                        <span aria-hidden>·</span>
                        <time dateTime={notification.createdAt} title={formatDateTime(notification.createdAt)}>
                            {formatRelative(notification.createdAt, now)}
                            <span className="sr-only"> ({formatDateTime(notification.createdAt)})</span>
                        </time>
                    </p>
                </div>
                <NotificationItemActions id={notification.id} title={notification.title} href={notification.href} unread={unread} />
            </div>
        </li>
    );
}
