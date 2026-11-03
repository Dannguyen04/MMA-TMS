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
import type { NotificationCategory } from "@/lib/domain/types";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n/translate";
import { getTranslator } from "@/lib/i18n/server";
import { hrefWith, parseEnum } from "@/lib/query";
import { dashboardPath, routes } from "@/lib/routes";
import { canMarkAllNotificationsRead, getNotificationPage } from "@/lib/services/notifications";
import { param } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("notifications.title") };
}

const PAGE_SIZE = 20;
const CATEGORIES = Object.keys(NOTIFICATION_CATEGORY_LABELS) as NotificationCategory[];

/** The inbox, a page at a time. Read-status filtering is the service's; category chips appear where it can filter by category. */
export default async function NotificationsPage({ searchParams }: PageProps<"/notifications">) {
    const [user, { t, locale }] = await Promise.all([requireUser(), getTranslator()]);
    const params = await searchParams;
    const now = new Date().toISOString();
    const pathname = routes.notifications;

    const unreadOnly = param(params.status) === "unread";
    const category = parseEnum(param(params.category), CATEGORIES);
    const requestedPage = Math.max(1, Math.floor(Number(param(params.page)) || 1));
    const page = await getNotificationPage({ id: user.id, role: user.role }, { page: requestedPage, pageSize: PAGE_SIZE, unreadOnly, category });
    const unreadCount = page.unread;
    const empty = page.all === 0;

    const statusItems = [
        { label: t("notifications.statusAll"), count: page.all ?? undefined, active: !unreadOnly, href: hrefWith(pathname, params, { status: null, page: null }) },
        { label: t("notifications.statusUnread"), count: unreadCount, active: unreadOnly, href: hrefWith(pathname, params, { status: "unread", page: null }) },
    ];
    const categoryItems = page.categories && [
        {
            label: t("notifications.allCategories"),
            count: page.categories.reduce((sum, item) => sum + item.count, 0),
            active: !category,
            href: hrefWith(pathname, params, { category: null, page: null }),
        },
        ...page.categories.map(({ category: value, count }) => ({
            label: t(`notifications.category.${value}`),
            icon: NOTIFICATION_CATEGORY_ICONS[value],
            count,
            active: category === value,
            href: hrefWith(pathname, params, { category: value, page: null }),
        })),
    ];

    const preferencesLink = (
        <ButtonLink href={`${routes.settings}#notifications`} variant="secondary">
            <SlidersHorizontal aria-hidden />
            {t("notifications.preferences")}
        </ButtonLink>
    );

    return (
        <>
            <PageHeader
                title={t("notifications.title")}
                description={t(`notifications.roleDesc.${user.role}`)}
                meta={
                    unreadCount > 0 ? (
                        <Badge tone="primary" dot>
                            {t(unreadCount === 1 ? "notifications.unreadCount" : "notifications.unreadCount.plural", { count: unreadCount })}
                        </Badge>
                    ) : (
                        <Badge tone="success" icon={CheckCheck}>
                            {t("notifications.allCaughtUp")}
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
                    title={t("notifications.noNotificationsYet")}
                    description={t("notifications.noNotificationsYetDesc")}
                    action={
                        <>
                            <ButtonLink href={dashboardPath(user.role)} variant="secondary">
                                {t("notifications.goToDashboard")}
                            </ButtonLink>
                            {preferencesLink}
                        </>
                    }
                />
            ) : (
                <div className="flex flex-col gap-4">
                    <div className="flex min-w-0 flex-col gap-3">
                        <SegmentedLinks items={statusItems} label={t("notifications.filterByStatus")} />
                        {categoryItems && <CategoryChips items={categoryItems} label={t("notifications.filterByCategory")} />}
                    </div>

                    <Card className="overflow-hidden">
                        {page.total === 0 ? (
                            <EmptyNotifications
                                unreadOnly={unreadOnly}
                                category={category}
                                clearHref={pathname}
                                allHref={hrefWith(pathname, params, { status: null, page: null })}
                                locale={locale}
                            />
                        ) : (
                            <>
                                <NotificationList notifications={page.items} now={now} locale={locale} />
                                <Pagination
                                    locale={locale}
                                    page={page.page}
                                    pageCount={page.pageCount}
                                    total={page.total}
                                    pageSize={page.pageSize}
                                    pathname={pathname}
                                    searchParams={params}
                                    itemLabel={page.total === 1 ? t("notifications.itemLabel") : t("notifications.itemLabel.plural")}
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
    locale = "en",
}: {
    unreadOnly: boolean;
    category: NotificationCategory | undefined;
    clearHref: string;
    allHref: string;
    locale?: Locale;
}) {
    const translate = createTranslator(locale);

    if (unreadOnly && !category) {
        return (
            <EmptyState
                compact
                icon={<CheckCheck />}
                title={translate("notifications.emptyCaughtUpTitle")}
                description={translate("notifications.emptyCaughtUpDesc")}
                action={
                    <ButtonLink href={allHref} variant="secondary" size="sm">
                        <Inbox aria-hidden />
                        {translate("notifications.viewAll")}
                    </ButtonLink>
                }
                className="py-12"
            />
        );
    }

    const label = category ? translate(`notifications.category.${category}`) : translate("notifications.theseFilters");
    return (
        <EmptyState
            compact
            icon={unreadOnly ? <CheckCheck /> : undefined}
            title={unreadOnly ? translate("notifications.emptyCategoryUnreadTitle", { category: label }) : translate("notifications.emptyCategoryTitle", { category: label })}
            description={
                unreadOnly
                    ? translate("notifications.emptyCategoryUnreadDesc")
                    : translate("notifications.emptyCategoryDesc")
            }
            action={
                <>
                    {unreadOnly && (
                        <ButtonLink href={allHref} variant="secondary" size="sm">
                            <Inbox aria-hidden />
                            {translate("notifications.viewAllInCategory", { category: label })}
                        </ButtonLink>
                    )}
                    <ButtonLink href={clearHref} variant={unreadOnly ? "ghost" : "secondary"} size="sm">
                        {translate("notifications.clearFilters")}
                    </ButtonLink>
                </>
            }
            className="py-12"
        />
    );
}
