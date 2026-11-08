import { ScrollText } from "lucide-react";
import type { Metadata } from "next";

import { ACTOR_ROLE_LABELS, AUDIT_RESOURCE_LABELS, actorRoleLabel, auditResourceLabel } from "@/components/admin/admin-format";
import { AuditActivityList } from "@/components/admin/audit-activity-list";
import { AuditLogRows } from "@/components/admin/audit-log-rows";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, FeatureUnavailable } from "@/components/ui/states";
import { Pagination, SortableTH, Table, TH, THead } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/session";
import { getTranslator } from "@/lib/i18n/server";
import type { AuditLog, AuditResourceType } from "@/lib/domain/types";
import { dayKey } from "@/lib/format";
import { plural } from "@/lib/i18n/translate";
import { paginate, parseEnum, parseSortDirection, sortItems } from "@/lib/query";
import { routes } from "@/lib/routes";
import { listAuditLogs } from "@/lib/services/audit";
import { platformFeatureAvailable } from "@/lib/services/platform-features";
import { param } from "@/lib/utils";

export const metadata: Metadata = { title: "Audit logs" };

const ACTOR_ROLES = Object.keys(ACTOR_ROLE_LABELS) as AuditLog["actorRole"][];
/** Clinical entries are redacted for administrators, so filtering by these types would only reveal that records exist. */
const CLINICAL_RESOURCE_TYPES: AuditResourceType[] = ["examination", "injury", "treatment", "recovery_plan", "clearance", "medical_record", "ai_alert"];
const RESOURCE_TYPES = (Object.keys(AUDIT_RESOURCE_LABELS) as AuditResourceType[]).filter((type) => !CLINICAL_RESOURCE_TYPES.includes(type));
const STATUSES = ["success", "failure"] as const;
const SORT_KEYS = ["time", "actor", "action", "resource", "status"] as const;
const PAGE_SIZE = 25;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export default async function AdminAuditLogsPage({ searchParams }: PageProps<"/admin/audit-logs">) {
    const { t } = await getTranslator();
    await requireRole("admin");
    if (!platformFeatureAvailable("auditLogs")) {
        return (
            <>
                <PageHeader title={t("screens.misc.adminPages.audit.title")} />
                <FeatureUnavailable service="platform" title={t("adminBody.audit.unavailable")} />
            </>
        );
    }
    const params = await searchParams;
    const now = new Date().toISOString();
    const pathname = routes.admin.auditLogs;

    const search = param(params.q)?.trim() || undefined;
    const actorRole = parseEnum(param(params.actor), ACTOR_ROLES);
    const resourceType = parseEnum(param(params.resource), RESOURCE_TYPES);
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
    const locale = t.locale === "en" ? "en" : "vi";
    const resourceOptions = [...RESOURCE_TYPES].sort((a, b) => auditResourceLabel(t, a).localeCompare(auditResourceLabel(t, b), locale));
    const sortProps = { pathname, searchParams: params, activeSort: sort, direction: dir };

    return (
        <>
            <PageHeader
                title={t("screens.misc.adminPages.audit.title")}
                description={t("adminBody.audit.description")}
            />

            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3">
                    <FilterBar
                        label={t("adminBody.audit.filter")}
                        filters={[
                            { type: "search", name: "q", label: t("adminBody.audit.search"), placeholder: t("adminBody.audit.placeholder") },
                            { type: "select", name: "actor", label: t("adminBody.audit.actors"), options: ACTOR_ROLES.map((value) => ({ value, label: actorRoleLabel(t, value) })) },
                            { type: "select", name: "resource", label: t("adminBody.audit.resources"), options: resourceOptions.map((value) => ({ value, label: auditResourceLabel(t, value) })) },
                            { type: "select", name: "status", label: t("adminBody.audit.results"), options: [{ value: "success", label: t("adminBody.audit.success") }, { value: "failure", label: t("adminBody.audit.failed") }] },
                        ]}
                    />
                    <FilterBar
                        label={t("adminBody.audit.byDate")}
                        filters={[
                            { type: "date", name: "from", label: t("adminBody.audit.from") },
                            { type: "date", name: "to", label: t("adminBody.audit.to") },
                        ]}
                    />
                </div>

                <Card className="overflow-hidden">
                    <CardHeader
                        title={hasFilters ? plural(t, "adminBody.audit.matching", filtered.length) : plural(t, "adminBody.audit.count", filtered.length)}
                        description={failures === 0 ? t("adminBody.audit.noFailed") : plural(t, "adminBody.audit.failedCount", failures)}
                        icon={<ScrollText />}
                    />
                    {page.total === 0 ? (
                        <CardContent>
                            {hasFilters ? (
                                <EmptyState
                                    compact
                                    title={t("adminBody.audit.noneMatch")}
                                    description={t("adminBody.audit.noneMatchText")}
                                    action={
                                        <ButtonLink href={pathname} variant="secondary" size="sm">
                                            {t("adminBody.users.clear")}
                                        </ButtonLink>
                                    }
                                />
                            ) : (
                                <EmptyState compact title={t("adminBody.audit.empty")} description={t("adminBody.audit.emptyText")} />
                            )}
                        </CardContent>
                    ) : (
                        <div className="border-t border-border">
                            <AuditActivityList entries={page.items} now={now} className="md:hidden" />
                            <div className="hidden md:block">
                                <Table caption={t("adminBody.audit.caption")} className="relative min-w-[1000px]">
                                    <THead>
                                        <tr>
                                            <TH className="w-10 pl-3">
                                                <span className="sr-only">{t("adminBody.audit.details")}</span>
                                            </TH>
                                            <SortableTH label={t("adminBody.audit.time")} sortKey="time" {...sortProps} />
                                            <SortableTH label={t("adminBody.audit.actor")} sortKey="actor" {...sortProps} />
                                            <SortableTH label={t("adminBody.audit.action")} sortKey="action" {...sortProps} />
                                            <SortableTH label={t("adminBody.audit.resource")} sortKey="resource" {...sortProps} />
                                            <SortableTH label={t("adminBody.audit.result")} sortKey="status" {...sortProps} />
                                            <TH>{t("adminBody.audit.ip")}</TH>
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
                                itemLabel={t("adminBody.audit.item")}
                            />
                        </div>
                    )}
                </Card>
            </div>
        </>
    );
}
