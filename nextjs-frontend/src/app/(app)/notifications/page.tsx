import { BellOff, CheckCheck, Inbox, SlidersHorizontal } from "lucide-react";
import type { Metadata } from "next";

import { MarkAllReadButton } from "@/components/account/notification-actions";
import { CategoryChips } from "@/components/account/notification-filters";
import { NotificationList } from "@/components/account/notification-list";
import { NOTIFICATION_CATEGORY_ICONS } from "@/components/domain/notification-meta";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { SegmentedLinks } from "@/components/ui/segmented-links";
import { EmptyState } from "@/components/ui/states";
import { Pagination } from "@/components/ui/table";
import { requireUser } from "@/lib/auth/session";
import { NOTIFICATION_CATEGORY_LABELS } from "@/lib/domain/labels";
import type { NotificationCategory, Role } from "@/lib/domain/types";
import { pluralize } from "@/lib/format";
import { hrefWith, parseEnum } from "@/lib/query";
import { dashboardPath, routes } from "@/lib/routes";
import { canMarkAllNotificationsRead, getNotificationPage } from "@/lib/services/notifications";
import { param } from "@/lib/utils";

export const metadata: Metadata = { title: "Notifications" };

const PAGE_SIZE = 20;
const CATEGORIES = Object.keys(NOTIFICATION_CATEGORY_LABELS) as NotificationCategory[];

const ROLE_DESCRIPTIONS: Record<Role, string> = {
    fighter: "Training updates, AI analysis results, coach feedback, goals and Medical Clearance changes.",
    coach: "Session updates, AI analyses to review, goals and clearance changes for your fighters.",
    doctor: "AI movement observations, examinations, injuries, recovery and clearance renewals.",
    admin: "Platform events, AI pipeline issues, security summaries and broadcasts.",
};

/** The inbox, a page at a time. Read-status filtering is the service's; category chips appear where it can filter by category. */
export default async function NotificationsPage({ searchParams }: PageProps<"/notifications">) {
    const user = await requireUser();
    const params = await searchParams;
    const now = new Date().toISOString();
    const pathname = routes.notifications;

    const unreadOnly = param(params.status) === "unread";
    const category = parseEnum(param(params.category), CATEGORIES);
    const requestedPage = Math.max(1, Math.floor(Number(param(params.page)) || 1));
    const page = await getNotificationPage({ id: user.id, role: user.role }, { page: requestedPage, pageSize: PAGE_SIZE, unreadOnly, category });
    const unreadCount = page.unread;
    // Viewing unread, the service doesn't count the rest, so an empty page there means "all caught up", not an empty inbox.
    const empty = page.all === 0;

    const statusItems = [
        { label: "All", count: page.all ?? undefined, active: !unreadOnly, href: hrefWith(pathname, params, { status: null, page: null }) },
        { label: "Unread", count: unreadCount, active: unreadOnly, href: hrefWith(pathname, params, { status: "unread", page: null }) },
    ];
    const categoryItems = page.categories && [
        {
            label: "All categories",
            count: page.categories.reduce((sum, item) => sum + item.count, 0),
            active: !category,
            href: hrefWith(pathname, params, { category: null, page: null }),
        },
        ...page.categories.map(({ category: value, count }) => ({
            label: NOTIFICATION_CATEGORY_LABELS[value],
            icon: NOTIFICATION_CATEGORY_ICONS[value],
            count,
            active: category === value,
            href: hrefWith(pathname, params, { category: value, page: null }),
        })),
    ];

    const preferencesLink = (
        <ButtonLink href={`${routes.settings}#notifications`} variant="secondary">
            <SlidersHorizontal aria-hidden />
            Preferences
        </ButtonLink>
    );

    return (
        <>
            <PageHeader
                title="Notifications"
                description={ROLE_DESCRIPTIONS[user.role]}
                meta={
                    unreadCount > 0 ? (
                        <Badge tone="primary" dot>
                            {pluralize(unreadCount, "unread notification")}
                        </Badge>
                    ) : (
                        <Badge tone="success" icon={CheckCheck}>
                            All caught up
                        </Badge>
                    )
                }
                actions={
                    !empty && (
                        <>
                            {preferencesLink}
                            {canMarkAllNotificationsRead() && <MarkAllReadButton unread={unreadCount} />}
                        </>
                    )
                }
            />

            {empty ? (
                <EmptyState
                    icon={<BellOff />}
                    title="No notifications yet"
                    description="When something needs your attention — a new analysis, a schedule change or a clearance update — it shows up here."
                    action={
                        <>
                            <ButtonLink href={dashboardPath(user.role)} variant="secondary">
                                Go to dashboard
                            </ButtonLink>
                            {preferencesLink}
                        </>
                    }
                />
            ) : (
                <div className="flex flex-col gap-4">
                    <div className="flex min-w-0 flex-col gap-3">
                        <SegmentedLinks items={statusItems} label="Filter by read status" />
                        {categoryItems && <CategoryChips items={categoryItems} label="Filter by category" />}
                    </div>

                    <Card className="overflow-hidden">
                        {page.total === 0 ? (
                            <EmptyNotifications
                                unreadOnly={unreadOnly}
                                category={category}
                                clearHref={pathname}
                                allHref={hrefWith(pathname, params, { status: null, page: null })}
                            />
                        ) : (
                            <>
                                <NotificationList notifications={page.items} now={now} />
                                <Pagination
                                    page={page.page}
                                    pageCount={page.pageCount}
                                    total={page.total}
                                    pageSize={page.pageSize}
                                    pathname={pathname}
                                    searchParams={params}
                                    itemLabel={page.total === 1 ? "notification" : "notifications"}
                                />
                            </>
                        )}
                    </Card>
                </div>
            )}
        </>
    );
}

function EmptyNotifications({
    unreadOnly,
    category,
    clearHref,
    allHref,
}: {
    unreadOnly: boolean;
    category: NotificationCategory | undefined;
    clearHref: string;
    allHref: string;
}) {
    if (unreadOnly && !category) {
        return (
            <EmptyState
                compact
                icon={<CheckCheck />}
                title="You're all caught up"
                description="There are no unread notifications. Everything you've already seen is still under All."
                action={
                    <ButtonLink href={allHref} variant="secondary" size="sm">
                        <Inbox aria-hidden />
                        View all notifications
                    </ButtonLink>
                }
                className="py-12"
            />
        );
    }

    const label = category ? NOTIFICATION_CATEGORY_LABELS[category] : "these filters";
    return (
        <EmptyState
            compact
            icon={unreadOnly ? <CheckCheck /> : undefined}
            title={unreadOnly ? `Nothing unread in ${label}` : `Nothing in ${label} yet`}
            description={
                unreadOnly
                    ? "You're all caught up in this category. Read notifications are still under All."
                    : "Nothing in this category yet. Clear the filters to see everything."
            }
            action={
                <>
                    {unreadOnly && (
                        <ButtonLink href={allHref} variant="secondary" size="sm">
                            <Inbox aria-hidden />
                            View all in {label}
                        </ButtonLink>
                    )}
                    <ButtonLink href={clearHref} variant={unreadOnly ? "ghost" : "secondary"} size="sm">
                        Clear filters
                    </ButtonLink>
                </>
            }
            className="py-12"
        />
    );
}
