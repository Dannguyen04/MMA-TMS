import { UserPlus, Users } from "lucide-react";
import type { Metadata } from "next";

import { ROLE_ORDER, USER_STATUS_ORDER } from "@/components/admin/admin-format";
import { UserIdentity } from "@/components/admin/user-identity";
import { RoleBadge, UserStatusBadge } from "@/components/domain/status-badges";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { Pagination, SortableTH, Table, TBody, TD, THead, TR } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/session";
import { ROLE_LABELS, USER_STATUS_LABELS } from "@/lib/domain/labels";
import type { User, UserStatus } from "@/lib/domain/types";
import { formatDate, formatDateTime, formatRelative, pluralize } from "@/lib/format";
import { paginate, parseEnum, parseSortDirection, sortItems } from "@/lib/query";
import { routes } from "@/lib/routes";
import { listUsers } from "@/lib/services/admin";
import { adminFeatureAvailable } from "@/lib/services/admin-features";
import { param } from "@/lib/utils";

export const metadata: Metadata = { title: "Users" };

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
    const counts = statuses.map((value) => `${countBy(value)} ${USER_STATUS_LABELS[value].toLowerCase()}`).join(" · ");
    const userHref = (user: User) => (opensInactive || user.status === "active" ? routes.admin.user(user.id) : undefined);

    const inviteButton = canInvite && (
        <ButtonLink href={routes.admin.newUser}>
            <UserPlus aria-hidden />
            Invite user
        </ButtonLink>
    );
    const sortProps = { pathname, searchParams: params, activeSort: sort, direction: dir };

    return (
        <>
            <PageHeader
                title="Users"
                description={
                    canInvite ? "Every account on the platform — invite staff and fighters, change roles and control who can sign in." : "Every staff and fighter account on the platform."
                }
                actions={inviteButton}
            />

            <div className="flex flex-col gap-4">
                <FilterBar
                    filters={[
                        { type: "search", name: "q", label: "Search users", placeholder: "Search name, email or title" },
                        { type: "select", name: "role", label: "Roles", options: ROLE_ORDER.map((value) => ({ value, label: ROLE_LABELS[value] })) },
                        { type: "select", name: "status", label: "Statuses", options: statuses.map((value) => ({ value, label: USER_STATUS_LABELS[value] })) },
                    ]}
                />

                <Card className="overflow-hidden">
                    <CardHeader
                        title={hasFilters ? `${pluralize(users.length, "matching account")}` : `${pluralize(everyone.length, "account")}`}
                        description={opensInactive || countBy("suspended") === 0 ? counts : `${counts}. Suspended accounts can't be opened yet.`}
                        icon={<Users />}
                    />
                    {page.total === 0 ? (
                        <CardContent>
                            {hasFilters ? (
                                <EmptyState
                                    compact
                                    title="No accounts match these filters"
                                    description="Try a different name, role or status."
                                    action={
                                        <ButtonLink href={pathname} variant="secondary" size="sm">
                                            Clear filters
                                        </ButtonLink>
                                    }
                                />
                            ) : (
                                <EmptyState
                                    compact
                                    title="No accounts yet"
                                    description={canInvite ? "Invite the first coach, doctor or fighter to get started." : "Accounts created in the user service appear here."}
                                    action={inviteButton}
                                />
                            )}
                        </CardContent>
                    ) : (
                        <div className="border-t border-border">
                            <div className="hidden md:block">
                                <Table caption="User accounts">
                                    <THead>
                                        <tr>
                                            <SortableTH label="User" sortKey="name" {...sortProps} />
                                            <SortableTH label="Role" sortKey="role" {...sortProps} />
                                            <SortableTH label="Title" sortKey="title" {...sortProps} />
                                            <SortableTH label="Status" sortKey="status" {...sortProps} />
                                            {showLastActive && <SortableTH label="Last active" sortKey="lastActive" {...sortProps} />}
                                            <SortableTH label="Created" sortKey="created" {...sortProps} />
                                        </tr>
                                    </THead>
                                    <TBody>
                                        {page.items.map((user) => (
                                            <TR key={user.id}>
                                                <TD className="max-w-72">
                                                    <UserIdentity user={user} href={userHref(user)} isSelf={user.id === admin.id} />
                                                </TD>
                                                <TD>
                                                    <RoleBadge role={user.role} size="sm" />
                                                </TD>
                                                <TD className="max-w-56 truncate text-fg-muted" title={user.title || undefined}>
                                                    {user.title || <span className="text-fg-subtle">—</span>}
                                                </TD>
                                                <TD>
                                                    <UserStatusBadge status={user.status} size="sm" />
                                                </TD>
                                                {showLastActive && (
                                                    <TD className="whitespace-nowrap text-fg-muted">
                                                        <LastActive user={user} now={now} />
                                                    </TD>
                                                )}
                                                <TD className="whitespace-nowrap text-fg-muted">{formatDate(user.createdAt)}</TD>
                                            </TR>
                                        ))}
                                    </TBody>
                                </Table>
                            </div>

                            <ul className="divide-y divide-border md:hidden" aria-label="User accounts">
                                {page.items.map((user) => (
                                    <li key={user.id} className="flex flex-col gap-2.5 px-4 py-3.5">
                                        <UserIdentity user={user} href={userHref(user)} isSelf={user.id === admin.id} size="md" />
                                        <div className="flex flex-wrap items-center gap-2">
                                            <RoleBadge role={user.role} size="sm" />
                                            <UserStatusBadge status={user.status} size="sm" />
                                        </div>
                                        <p className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-[13px] text-fg-muted">
                                            <span className="min-w-0 truncate">{user.title}</span>
                                            {showLastActive && (
                                                <span className="shrink-0">
                                                    <LastActive user={user} now={now} />
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
                                itemLabel="accounts"
                            />
                        </div>
                    )}
                </Card>
            </div>
        </>
    );
}

function LastActive({ user, now }: { user: User; now: string }) {
    if (user.status === "invited") return <span className="text-fg-subtle">Invitation pending</span>;
    if (!user.lastActiveAt) return <span className="text-fg-subtle">Never</span>;
    return (
        <time dateTime={user.lastActiveAt} title={formatDateTime(user.lastActiveAt)}>
            {formatRelative(user.lastActiveAt, now)}
        </time>
    );
}
