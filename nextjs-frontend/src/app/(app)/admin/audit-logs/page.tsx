import { ScrollText } from "lucide-react";
import type { Metadata } from "next";

import { ACTOR_ROLES, actorRoleLabel, AUDIT_RESOURCE_TYPES, auditResourceLabel, countLabel } from "@/components/admin/admin-format";
import { auditStatusLabel } from "@/components/admin/admin-badges";
import { AuditActivityList } from "@/components/admin/audit-activity-list";
import { AuditLogRows } from "@/components/admin/audit-log-rows";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, FeatureUnavailable } from "@/components/ui/states";
import { Pagination, SortableTH, Table, TH, THead } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/session";
import type { AuditLog, AuditResourceType } from "@/lib/domain/types";
import { dayKey, formatNumber } from "@/lib/format";
import { INTL_LOCALE } from "@/lib/i18n/config";
import { getTranslator } from "@/lib/i18n/server";
import { plural } from "@/lib/i18n/translate";
import { paginate, parseEnum, parseSortDirection, sortItems } from "@/lib/query";
import { routes } from "@/lib/routes";
import { listAuditLogs } from "@/lib/services/audit";
import { platformFeatureAvailable } from "@/lib/services/platform-features";
import { param } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("screens.admin.meta.auditLogs") };
}

/** Clinical entries are redacted for administrators, so filtering by these types would only reveal that records exist. */
const CLINICAL_RESOURCE_TYPES: AuditResourceType[] = ["examination", "injury", "treatment", "recovery_plan", "clearance", "medical_record", "ai_alert"];
const FILTERABLE_RESOURCE_TYPES = AUDIT_RESOURCE_TYPES.filter((type) => !CLINICAL_RESOURCE_TYPES.includes(type));
const STATUSES = ["success", "failure"] as const;
const SORT_KEYS = ["time", "actor", "action", "resource", "status"] as const;
const PAGE_SIZE = 25;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export default async function AdminAuditLogsPage({ searchParams }: PageProps<"/admin/audit-logs">) {
    await requireRole("admin");
    const { t, locale } = await getTranslator();
    if (!platformFeatureAvailable("auditLogs")) {
        return (
            <>
                <PageHeader title={t("screens.admin.meta.auditLogs")} />
                <FeatureUnavailable service="platform" title={t("screens.admin.audit.unavailable")} description={t("screens.admin.common.unavailable.platform")} />
            </>
        );
    }
    const params = await searchParams;
    const now = new Date().toISOString();
    const pathname = routes.admin.auditLogs;
    // Resource types in the order the viewer reads them.
    const resourceTypes = [...FILTERABLE_RESOURCE_TYPES].sort((a, b) => auditResourceLabel(t, a).localeCompare(auditResourceLabel(t, b), INTL_LOCALE[locale]));

    const search = param(params.q)?.trim() || undefined;
    const actorRole = parseEnum(param(params.actor), ACTOR_ROLES);
    const resourceType = parseEnum(param(params.resource), resourceTypes);
    const status = parseEnum(param(params.status), STATUSES);
    const from = DATE_PATTERN.test(param(params.from) ?? "") ? param(params.from) : undefined;
    const to = DATE_PATTERN.test(param(params.to) ?? "") ? param(params.to) : undefined;
    const hasFilters = Boolean(search || actorRole || resourceType || status || from || to);

    const logs = await listAuditLogs({ search, actorRole, resourceType, status });
    // Date bounds compare academy calendar days, so "to" includes the whole day.
    const filtered = logs.filter((log) => {
        const day = dayKey(log.timestamp);
        return (!from || day >= from) && (!to || day <= to);
    });

    const sort = parseEnum(param(params.sort), SORT_KEYS) ?? "time";
    const dir = parseSortDirection(param(params.dir), param(params.sort) ? "asc" : "desc");
    const accessors: Record<(typeof SORT_KEYS)[number], (log: AuditLog) => string> = {
        time: (log) => log.timestamp,
        actor: (log) => log.actorName,
        action: (log) => log.action,
        resource: (log) => `${auditResourceLabel(t, log.resourceType)} ${log.resourceLabel}`,
        status: (log) => log.status,
    };
    const page = paginate(sortItems(filtered, accessors[sort], dir), param(params.page), PAGE_SIZE);
    const failures = filtered.filter((log) => log.status === "failure").length;
    const sortProps = { pathname, searchParams: params, activeSort: sort, direction: dir };

    return (
        <>
            <PageHeader title={t("screens.admin.meta.auditLogs")} description={t("screens.admin.audit.description")} />

            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3">
                    <FilterBar
                        label={t("screens.admin.audit.filter")}
                        filters={[
                            { type: "search", name: "q", label: t("screens.admin.audit.search"), placeholder: t("screens.admin.audit.searchPlaceholder") },
                            {
                                type: "select",
                                name: "actor",
                                label: t("screens.admin.audit.actorRoles"),
                                options: ACTOR_ROLES.map((value) => ({ value, label: actorRoleLabel(t, value) })),
                            },
                            {
                                type: "select",
                                name: "resource",
                                label: t("screens.admin.audit.resourceTypes"),
                                options: resourceTypes.map((value) => ({ value, label: auditResourceLabel(t, value) })),
                            },
                            {
                                type: "select",
                                name: "status",
                                label: t("screens.admin.audit.results"),
                                options: STATUSES.map((value) => ({ value, label: auditStatusLabel(t, value) })),
                            },
                        ]}
                    />
                    <FilterBar
                        label={t("screens.admin.audit.filterDate")}
                        filters={[
                            { type: "date", name: "from", label: t("screens.admin.audit.from") },
                            { type: "date", name: "to", label: t("screens.admin.audit.to") },
                        ]}
                    />
                </div>

                <Card className="overflow-hidden">
                    <CardHeader
                        title={countLabel(t, hasFilters ? "screens.admin.count.matchingEntries" : "screens.admin.count.entries", filtered.length)}
                        description={
                            failures === 0
                                ? t("screens.admin.audit.noFailures")
                                : plural(t, "screens.admin.audit.failures", failures, { n: formatNumber(failures) })
                        }
                        icon={<ScrollText />}
                    />
                    {page.total === 0 ? (
                        <CardContent>
                            {hasFilters ? (
                                <EmptyState
                                    compact
                                    title={t("screens.admin.audit.noMatchTitle")}
                                    description={t("screens.admin.audit.noMatchDescription")}
                                    action={
                                        <ButtonLink href={pathname} variant="secondary" size="sm">
                                            {t("screens.admin.common.clearFilters")}
                                        </ButtonLink>
                                    }
                                />
                            ) : (
                                <EmptyState compact title={t("screens.admin.audit.emptyTitle")} description={t("screens.admin.audit.emptyDescription")} />
                            )}
                        </CardContent>
                    ) : (
                        <div className="border-t border-border">
                            <AuditActivityList entries={page.items} now={now} locale={locale} className="md:hidden" />
                            <div className="hidden md:block">
                                <Table caption={t("screens.admin.audit.caption")} className="relative min-w-[1000px]">
                                    <THead>
                                        <tr>
                                            <TH className="w-10 pl-3">
                                                <span className="sr-only">{t("screens.admin.common.details")}</span>
                                            </TH>
                                            <SortableTH label={t("screens.admin.audit.time")} sortKey="time" {...sortProps} />
                                            <SortableTH label={t("screens.admin.audit.actor")} sortKey="actor" {...sortProps} />
                                            <SortableTH label={t("screens.admin.audit.action")} sortKey="action" {...sortProps} />
                                            <SortableTH label={t("screens.admin.audit.resource")} sortKey="resource" {...sortProps} />
                                            <SortableTH label={t("screens.admin.audit.result")} sortKey="status" {...sortProps} />
                                            <TH>{t("screens.admin.audit.ipAddress")}</TH>
                                        </tr>
                                    </THead>
                                    <AuditLogRows entries={page.items} now={now} />
                                </Table>
                            </div>
                            <Pagination
                                page={page.page}
                                pageCount={page.pageCount}
                                total={page.total}
                                pageSize={page.pageSize}
                                pathname={pathname}
                                searchParams={params}
                                itemLabel={t("screens.admin.audit.itemLabel")}
                                locale={locale}
                            />
                        </div>
                    )}
                </Card>
            </div>
        </>
    );
}
