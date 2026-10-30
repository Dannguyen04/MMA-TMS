import { UserPlus, Users } from "lucide-react";
import type { Metadata } from "next";

import { countLabel, roleLabel, ROLE_ORDER, USER_STATUS_ORDER } from "@/components/admin/admin-format";
import { UserIdentity } from "@/components/admin/user-identity";
import { RoleBadge, UserStatusBadge } from "@/components/domain/status-badges";
import { FlashToast } from "@/components/medical/flash-toast";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { Pagination, SortableTH, Table, TBody, TD, THead, TR } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/session";
import { USER_STATUS_LABELS } from "@/lib/domain/labels";
import type { User, UserStatus } from "@/lib/domain/types";
import { formatDate, formatDateTime, formatRelative } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { getTranslator } from "@/lib/i18n/server";
import type { MessageKey, Translator } from "@/lib/i18n/translate";
import { paginate, parseEnum, parseSortDirection, sortItems } from "@/lib/query";
import { routes } from "@/lib/routes";
import { listUsers } from "@/lib/services/admin";
import { adminFeatureAvailable, usesUserServiceForms } from "@/lib/services/admin-features";
import { param } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("screens.admin.meta.users") };
}

const ALL_STATUSES = Object.keys(USER_STATUS_LABELS) as UserStatus[];
const SORT_KEYS = ["name", "role", "title", "status", "lastActive", "created"] as const;
type SortKey = (typeof SORT_KEYS)[number];
const PAGE_SIZE = 12;

const SORT_ACCESSORS: Record<SortKey, (user: User) => string | number | null> = {
    name: (u) => u.name,
    role: (u) => ROLE_ORDER.indexOf(u.role),
    title: (u) => u.title,
    status: (u) => USER_STATUS_ORDER[u.status],
    lastActive: (u) => u.lastActiveAt,
    created: (u) => u.createdAt,
};

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
    const admin = await requireRole("admin");
    const { t, locale } = await getTranslator();
    const params = await searchParams;
    const now = new Date().toISOString();
    const pathname = routes.admin.users;
    // Without invitations there is no invited status; without sign-in tracking there is no last-active column.
    const canInvite = adminFeatureAvailable("inviteUsers");
    const showLastActive = adminFeatureAvailable("lastActive");
    const opensInactive = adminFeatureAvailable("inactiveAccountDetail");
    const statuses = canInvite ? ALL_STATUSES : ALL_STATUSES.filter((value) => value !== "invited");
    const sortKeys = showLastActive ? SORT_KEYS : SORT_KEYS.filter((key) => key !== "lastActive");

    const role = parseEnum(param(params.role), ROLE_ORDER);
    const status = parseEnum(param(params.status), statuses);
    const search = param(params.q)?.trim() || undefined;
    const sort = parseEnum(param(params.sort), sortKeys) ?? "name";
    const dir = parseSortDirection(param(params.dir), "asc");
    const hasFilters = Boolean(role || status || search);

    const [everyone, filtered] = await Promise.all([listUsers(), hasFilters ? listUsers({ search, role, status }) : null]);
    const users = filtered ?? everyone;
    const page = paginate(sortItems(users, SORT_ACCESSORS[sort], dir), param(params.page), PAGE_SIZE);
    const countBy = (value: UserStatus) => everyone.filter((u) => u.status === value).length;
    const counts = statuses.map((value) => t(`screens.admin.users.statusCount.${value}` as MessageKey, { n: countBy(value) })).join(" · ");
    const userHref = (user: User) => (opensInactive || user.status === "active" ? routes.admin.user(user.id) : undefined);

    // API mode creates accounts outright; the demo sends invitations.
    const canAdd = canInvite || usesUserServiceForms();
    const inviteButton = canAdd && (
        <div className="flex flex-wrap gap-2">
            <ButtonLink href={routes.admin.newUser} variant="secondary">
                <UserPlus aria-hidden />
                {canInvite ? t("screens.admin.common.inviteUser") : t("screens.admin.common.addUser")}
            </ButtonLink>
            <ButtonLink href={routes.admin.newUserAs("fighter")}>
                <UserPlus aria-hidden />
                {canInvite ? t("screens.admin.common.inviteFighter") : t("screens.admin.common.addFighter")}
            </ButtonLink>
        </div>
    );
    const sortProps = { pathname, searchParams: params, activeSort: sort, direction: dir };

    return (
        <>
            <FlashToast
                notice={
                    param(params.notice) === "account-deleted"
                        ? { title: t("screens.admin.users.deletedTitle"), description: t("screens.admin.users.deletedDescription") }
                        : null
                }
                cleanHref={pathname}
            />
            <PageHeader
                title={t("screens.admin.common.users")}
                description={
                    canInvite
                        ? t("screens.admin.users.descriptionInvite")
                        : canAdd
                          ? t("screens.admin.users.descriptionAdd")
                          : t("screens.admin.users.description")
                }
                actions={inviteButton}
            />

            <div className="flex flex-col gap-4">
                <FilterBar
                    filters={[
                        { type: "search", name: "q", label: t("screens.admin.users.search"), placeholder: t("screens.admin.users.searchPlaceholder") },
                        { type: "select", name: "role", label: t("screens.admin.users.roles"), options: ROLE_ORDER.map((value) => ({ value, label: roleLabel(t, value) })) },
                        {
                            type: "select",
                            name: "status",
                            label: t("screens.admin.users.statuses"),
                            options: statuses.map((value) => ({ value, label: t(`userStatus.${value}` as MessageKey) })),
                        },
                    ]}
                />

                <Card className="overflow-hidden">
                    <CardHeader
                        title={hasFilters ? countLabel(t, "screens.admin.count.matchingAccounts", users.length) : countLabel(t, "screens.admin.count.accounts", everyone.length)}
                        description={opensInactive || countBy("suspended") === 0 ? counts : t("screens.admin.users.suspendedClosed", { counts })}
                        icon={<Users />}
                    />
                    {page.total === 0 ? (
                        <CardContent>
                            {hasFilters ? (
                                <EmptyState
                                    compact
                                    title={t("screens.admin.users.noMatchTitle")}
                                    description={t("screens.admin.users.noMatchDescription")}
                                    action={
                                        <ButtonLink href={pathname} variant="secondary" size="sm">
                                            {t("screens.admin.common.clearFilters")}
                                        </ButtonLink>
                                    }
                                />
                            ) : (
                                <EmptyState
                                    compact
                                    title={t("screens.admin.users.emptyTitle")}
                                    description={
                                        canAdd
                                            ? canInvite
                                                ? t("screens.admin.users.emptyInvite")
                                                : t("screens.admin.users.emptyAdd")
                                            : t("screens.admin.users.emptyService")
                                    }
                                    action={inviteButton}
                                />
                            )}
                        </CardContent>
                    ) : (
                        <div className="border-t border-border">
                            <div className="hidden md:block">
                                <Table caption={t("screens.admin.users.caption")}>
                                    <THead>
                                        <tr>
                                            <SortableTH label={t("screens.admin.users.user")} sortKey="name" {...sortProps} />
                                            <SortableTH label={t("screens.admin.common.role")} sortKey="role" {...sortProps} />
                                            <SortableTH label={t("screens.admin.users.title")} sortKey="title" {...sortProps} />
                                            <SortableTH label={t("screens.admin.common.status")} sortKey="status" {...sortProps} />
                                            {showLastActive && <SortableTH label={t("screens.admin.users.lastActive")} sortKey="lastActive" {...sortProps} />}
                                            <SortableTH label={t("screens.admin.users.created")} sortKey="created" {...sortProps} />
                                        </tr>
                                    </THead>
                                    <TBody>
                                        {page.items.map((user) => (
                                            <TR key={user.id}>
                                                <TD className="max-w-72">
                                                    <UserIdentity user={user} href={userHref(user)} isSelf={user.id === admin.id} locale={locale} />
                                                </TD>
                                                <TD>
                                                    <RoleBadge role={user.role} size="sm" locale={locale} />
                                                </TD>
                                                <TD className="max-w-56 truncate text-fg-muted" title={user.title || undefined}>
                                                    {user.title || <span className="text-fg-subtle">—</span>}
                                                </TD>
                                                <TD>
                                                    <UserStatusBadge status={user.status} size="sm" locale={locale} />
                                                </TD>
                                                {showLastActive && (
                                                    <TD className="whitespace-nowrap text-fg-muted">
                                                        <LastActive user={user} now={now} t={t} locale={locale} />
                                                    </TD>
                                                )}
                                                <TD className="whitespace-nowrap text-fg-muted">{formatDate(user.createdAt, locale)}</TD>
                                            </TR>
                                        ))}
                                    </TBody>
                                </Table>
                            </div>

                            <ul className="divide-y divide-border md:hidden" aria-label={t("screens.admin.users.caption")}>
                                {page.items.map((user) => (
                                    <li key={user.id} className="flex flex-col gap-2.5 px-4 py-3.5">
                                        <UserIdentity user={user} href={userHref(user)} isSelf={user.id === admin.id} size="md" locale={locale} />
                                        <div className="flex flex-wrap items-center gap-2">
                                            <RoleBadge role={user.role} size="sm" locale={locale} />
                                            <UserStatusBadge status={user.status} size="sm" locale={locale} />
                                        </div>
                                        <p className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-[13px] text-fg-muted">
                                            <span className="min-w-0 truncate">{user.title}</span>
                                            {showLastActive && (
                                                <span className="shrink-0">
                                                    <LastActive user={user} now={now} t={t} locale={locale} />
                                                </span>
                                            )}
                                        </p>
                                    </li>
                                ))}
                            </ul>

                            <Pagination
                                page={page.page}
                                pageCount={page.pageCount}
                                total={page.total}
                                pageSize={page.pageSize}
                                pathname={pathname}
                                searchParams={params}
                                itemLabel={t("screens.admin.users.itemLabel")}
                                locale={locale}
                            />
                        </div>
                    )}
                </Card>
            </div>
        </>
    );
}

function LastActive({ user, now, t, locale }: { user: User; now: string; t: Translator; locale: Locale }) {
    if (user.status === "invited") return <span className="text-fg-subtle">{t("screens.admin.users.invitationPending")}</span>;
    if (!user.lastActiveAt) return <span className="text-fg-subtle">{t("screens.admin.common.never")}</span>;
    return (
        <time dateTime={user.lastActiveAt} title={formatDateTime(user.lastActiveAt, locale)}>
            {formatRelative(user.lastActiveAt, now, locale)}
        </time>
    );
}
