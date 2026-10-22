"use client";

import { Bell, CheckCheck } from "lucide-react";
import Link from "next/link";
import { useRef, useTransition } from "react";

import { NOTIFICATION_CATEGORY_ICONS, NOTIFICATION_SEVERITY_TONE } from "@/components/domain/notification-meta";
import { useLocale, useT } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { Popover } from "@/components/ui/popover";
import { TONE_SOFT } from "@/components/ui/tone";
import { useToast } from "@/components/ui/toast";
import { markAllRead, markRead } from "@/lib/actions/notifications";
import { formatRelative } from "@/lib/format";
import type { NotificationBellData } from "@/lib/services/notifications";
import { cn } from "@/lib/utils";
import { useNotificationUpdates } from "./use-notification-updates";

/** The header bell: unread count, the latest notifications, kept current while the page is open. */
export function NotificationBell({ bell, now }: { bell: NotificationBellData; now: string }) {
    const { unread, latest, canMarkAllRead, live, allHref } = bell;
    const toast = useToast();
    const t = useT();
    const locale = useLocale();
    const [pending, startTransition] = useTransition();
    const headingRef = useRef<HTMLHeadingElement>(null);
    useNotificationUpdates({ unread, live });

    const markAll = () => {
        // The button is disabled while pending and once nothing is unread, so keep focus inside the panel.
        headingRef.current?.focus();
        startTransition(async () => {
            const result = await markAllRead();
            toast({ title: result.message ?? t("common.done"), tone: result.status === "error" ? "error" : "success" });
        });
    };

    const notifTitle = t("notifications.title");

    return (
        <Popover
            label={notifTitle}
            className="w-[min(24rem,calc(100vw-1.5rem))] max-sm:-right-12"
            trigger={(props) => (
                <button
                    {...props}
                    type="button"
                    className="relative inline-flex size-9 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg"
                    aria-label={unread > 0 ? `${notifTitle}, ${unread} ${t("notifications.statusUnread").toLowerCase()}` : notifTitle}
                >
                    <Bell aria-hidden className="size-[18px]" />
                    {unread > 0 && (
                        <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-danger-solid px-1 text-[10px] leading-4 font-semibold text-white tabular-nums ring-2 ring-surface">
                            {unread > 9 ? "9+" : unread}
                        </span>
                    )}
                </button>
            )}
        >
            {(close) => (
                <div>
                    <div className="flex items-center justify-between border-b border-border px-4 py-3">
                        <h2 ref={headingRef} tabIndex={-1} className="text-sm font-semibold focus:outline-none">
                            {notifTitle}
                        </h2>
                        {canMarkAllRead && (
                            <Button variant="ghost" size="sm" disabled={unread === 0} loading={pending} onClick={markAll}>
                                {!pending && <CheckCheck aria-hidden />}
                                {t("notifications.markAllRead")}
                            </Button>
                        )}
                    </div>
                    {latest.length === 0 ? (
                        <p className="px-4 py-10 text-center text-sm text-fg-muted">{t("notifications.noNotificationsYet")}</p>
                    ) : (
                        <ul className="scrollbar-thin max-h-[26rem] divide-y divide-border overflow-y-auto">
                            {latest.map((notification) => {
                                const Icon = NOTIFICATION_CATEGORY_ICONS[notification.category];
                                const content = (
                                    <>
                                        <span
                                            className={cn(
                                                "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset",
                                                TONE_SOFT[NOTIFICATION_SEVERITY_TONE[notification.severity]],
                                            )}
                                        >
                                            <Icon aria-hidden className="size-4" />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="flex items-start gap-2">
                                                <span className={cn("text-sm", notification.readAt ? "text-fg-muted" : "font-semibold text-fg")}>
                                                    {notification.title}
                                                </span>
                                                {!notification.readAt && (
                                                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary">
                                                        <span className="sr-only">{t("notifications.statusUnread")}</span>
                                                    </span>
                                                )}
                                            </span>
                                            <span className="mt-0.5 line-clamp-2 block text-[13px] text-fg-muted">{notification.body}</span>
                                            <span className="mt-1 block text-xs text-fg-subtle">{formatRelative(notification.createdAt, now, locale)}</span>
                                        </span>
                                    </>
                                );
                                return (
                                    <li key={notification.id}>
                                        {notification.href ? (
                                            <Link
                                                href={notification.href}
                                                onClick={() => {
                                                    if (!notification.readAt) void markRead(notification.id);
                                                    close();
                                                }}
                                                className="flex gap-3 px-4 py-3 hover:bg-surface-muted"
                                            >
                                                {content}
                                            </Link>
                                        ) : (
                                            <div className="flex gap-3 px-4 py-3">{content}</div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                    {allHref && (
                        <div className="border-t border-border p-2">
                            <Link
                                href={allHref}
                                onClick={close}
                                className="flex h-9 items-center justify-center rounded-lg text-sm font-medium text-primary-soft-fg hover:bg-surface-muted"
                            >
                                {t("notifications.viewAll")}
                            </Link>
                        </div>
                    )}
                </div>
            )}
        </Popover>
    );
}
