import { ScrollText } from "lucide-react";
import type { Metadata } from "next";

import { ACTOR_ROLE_LABELS, AUDIT_RESOURCE_LABELS } from "@/components/admin/admin-format";
import { AuditActivityList } from "@/components/admin/audit-activity-list";
import { AuditLogRows } from "@/components/admin/audit-log-rows";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { Pagination, SortableTH, Table, TH, THead } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/session";
import type { AuditLog, AuditResourceType } from "@/lib/domain/types";
import { dayKey, formatNumber, pluralize } from "@/lib/format";
import { paginate, parseEnum, parseSortDirection, sortItems } from "@/lib/query";
import { routes } from "@/lib/routes";
import { listAuditLogs } from "@/lib/services/audit";
import { param } from "@/lib/utils";

export const metadata: Metadata = { title: "Audit logs" };

const ACTOR_ROLES = Object.keys(ACTOR_ROLE_LABELS) as AuditLog["actorRole"][];
/** Clinical entries are redacted for administrators, so filtering by these types would only reveal that records exist. */
const CLINICAL_RESOURCE_TYPES: AuditResourceType[] = ["examination", "injury", "treatment", "recovery_plan", "clearance", "medical_record", "ai_alert"];
const RESOURCE_TYPES = (Object.keys(AUDIT_RESOURCE_LABELS) as AuditResourceType[])
    .filter((type) => !CLINICAL_RESOURCE_TYPES.includes(type))
    .sort((a, b) => AUDIT_RESOURCE_LABELS[a].localeCompare(AUDIT_RESOURCE_LABELS[b], "en"));
const STATUSES = ["success", "failure"] as const;
const SORT_KEYS = ["time", "actor", "action", "resource", "status"] as const;
const PAGE_SIZE = 25;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export default async function AdminAuditLogsPage({ searchParams }: PageProps<"/admin/audit-logs">) {
    await requireRole("admin");
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
        resource: (log) => `${AUDIT_RESOURCE_LABELS[log.resourceType]} ${log.resourceLabel}`,
        status: (log) => log.status,
    };
    const page = paginate(sortItems(filtered, accessors[sort], dir), param(params.page), PAGE_SIZE);
    const failures = filtered.filter((log) => log.status === "failure").length;
    const sortProps = { pathname, searchParams: params, activeSort: sort, direction: dir };

    return (
        <>
            <PageHeader
                title="Audit logs"
                description="An append-only record of sign-ins, changes and pipeline events. Entries can't be edited or deleted."
            />

            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3">
                    <FilterBar
                        label="Filter audit log"
                        filters={[
                            { type: "search", name: "q", label: "Search audit log", placeholder: "Search user, action or resource" },
                            { type: "select", name: "actor", label: "Actor roles", options: ACTOR_ROLES.map((value) => ({ value, label: ACTOR_ROLE_LABELS[value] })) },
                            { type: "select", name: "resource", label: "Resource types", options: RESOURCE_TYPES.map((value) => ({ value, label: AUDIT_RESOURCE_LABELS[value] })) },
                            { type: "select", name: "status", label: "Results", options: [{ value: "success", label: "Success" }, { value: "failure", label: "Failed" }] },
                        ]}
                    />
                    <FilterBar
                        label="Filter audit log by date"
                        filters={[
                            { type: "date", name: "from", label: "From" },
                            { type: "date", name: "to", label: "To" },
                        ]}
                    />
                </div>

                <Card className="overflow-hidden">
                    <CardHeader
                        title={hasFilters ? pluralize(filtered.length, "matching entry", "matching entries") : pluralize(filtered.length, "entry", "entries")}
                        description={failures === 0 ? "No failed actions" : `${formatNumber(failures)} failed ${failures === 1 ? "action" : "actions"} — sign-ins, rejected changes and pipeline errors`}
                        icon={<ScrollText />}
                    />
                    {page.total === 0 ? (
                        <CardContent>
                            {hasFilters ? (
                                <EmptyState
                                    compact
                                    title="No entries match these filters"
                                    description="Widen the date range or try another user, role or resource."
                                    action={
                                        <ButtonLink href={pathname} variant="secondary" size="sm">
                                            Clear filters
                                        </ButtonLink>
                                    }
                                />
                            ) : (
                                <EmptyState compact title="No audit entries yet" description="Every sign-in and change on the platform is recorded here." />
                            )}
                        </CardContent>
                    ) : (
                        <div className="border-t border-border">
                            <AuditActivityList entries={page.items} now={now} className="md:hidden" />
                            <div className="hidden md:block">
                                <Table caption="Audit log entries" className="relative min-w-[1000px]">
                                    <THead>
                                        <tr>
                                            <TH className="w-10 pl-3">
                                                <span className="sr-only">Details</span>
                                            </TH>
                                            <SortableTH label="Time" sortKey="time" {...sortProps} />
                                            <SortableTH label="Actor" sortKey="actor" {...sortProps} />
                                            <SortableTH label="Action" sortKey="action" {...sortProps} />
                                            <SortableTH label="Resource" sortKey="resource" {...sortProps} />
                                            <SortableTH label="Result" sortKey="status" {...sortProps} />
                                            <TH>IP address</TH>
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
                                itemLabel="entries"
                            />
                        </div>
                    )}
                </Card>
            </div>
        </>
    );
}
