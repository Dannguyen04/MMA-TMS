import { FileText, SearchX, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FighterIdentity } from "@/components/domain/fighter-identity";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { Pagination, SortableTH, Table, TBody, TD, THead, TR } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/session";
import type { Fighter, MedicalRecord } from "@/lib/domain/types";
import { formatDate, formatDateTime, formatRelative, pluralize } from "@/lib/format";
import { paginate, parseEnum, parseSortDirection, sortItems } from "@/lib/query";
import { routes } from "@/lib/routes";
import { getMedicalRecord } from "@/lib/services/medical";
import { listFighters } from "@/lib/services/people";
import { cn, param } from "@/lib/utils";

export const metadata: Metadata = { title: "Medical records" };

const PAGE_SIZE = 10;
const SORTS = ["name", "bloodType", "allergies", "conditions", "lastPhysical", "documents", "updated"] as const;
type SortKey = (typeof SORTS)[number];

interface RecordRow {
    fighter: Fighter;
    record: MedicalRecord | null;
}

const SORT_ACCESSORS: Record<SortKey, (row: RecordRow) => string | number | null> = {
    name: (row) => row.fighter.name,
    bloodType: (row) => row.record?.bloodType ?? null,
    allergies: (row) => row.record?.allergies.length ?? null,
    conditions: (row) => row.record?.chronicConditions.length ?? null,
    lastPhysical: (row) => row.record?.lastPhysicalAt ?? null,
    documents: (row) => row.record?.documents.length ?? null,
    updated: (row) => row.record?.updatedAt ?? null,
};

const recordHref = (fighterId: string) => `${routes.doctor.fighter(fighterId)}?tab=record`;

export default async function MedicalRecordsPage({ searchParams }: PageProps<"/doctor/medical-records">) {
    const user = await requireRole("doctor");
    const params = await searchParams;
    const now = new Date().toISOString();

    const search = param(params.q);
    const sort = parseEnum(param(params.sort), SORTS) ?? "name";
    const dir = parseSortDirection(param(params.dir));

    const fighters = await listFighters(user, { search });
    const rows: RecordRow[] = await Promise.all(fighters.map(async (fighter) => ({ fighter, record: await getMedicalRecord(fighter.id) })));
    const page = paginate(sortItems(rows, SORT_ACCESSORS[sort], dir), param(params.page), PAGE_SIZE);
    const pathname = routes.doctor.records;
    const sortProps = { pathname, searchParams: params, activeSort: sort, direction: dir };
    const withAllergies = rows.filter((row) => (row.record?.allergies.length ?? 0) > 0).length;
    const missing = rows.filter((row) => !row.record).length;

    return (
        <>
            <PageHeader
                title="Medical records"
                description="Blood type, allergies, conditions and documents for your assigned fighters. Records are visible to sports doctors only."
            />

            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <FilterBar filters={[{ type: "search", name: "q", label: "Search records", placeholder: "Search fighter name or discipline" }]} />
                    {rows.length > 0 && (
                        <p className="text-[13px] text-fg-muted">
                            {pluralize(rows.length, "record")} · {pluralize(withAllergies, "fighter")} with allergies
                            {missing > 0 && ` · ${missing} not opened`}
                        </p>
                    )}
                </div>

                {page.total === 0 ? (
                    search ? (
                        <EmptyState
                            icon={<SearchX />}
                            title={`No records match “${search}”`}
                            description="Check the spelling or search by discipline instead."
                            action={
                                <ButtonLink href={pathname} variant="secondary">
                                    Clear filters
                                </ButtonLink>
                            }
                        />
                    ) : (
                        <EmptyState
                            icon={<FileText />}
                            title="No medical records yet"
                            description="Records appear here once fighters are assigned to you."
                        />
                    )
                ) : (
                    <>
                        <Card className="hidden overflow-hidden md:block">
                            <Table caption="Medical records">
                                <THead>
                                    <tr>
                                        <SortableTH label="Fighter" sortKey="name" {...sortProps} />
                                        <SortableTH label="Blood type" sortKey="bloodType" {...sortProps} />
                                        <SortableTH label="Allergies" sortKey="allergies" {...sortProps} />
                                        <SortableTH label="Chronic conditions" sortKey="conditions" {...sortProps} />
                                        <SortableTH label="Last physical" sortKey="lastPhysical" {...sortProps} />
                                        <SortableTH label="Documents" sortKey="documents" {...sortProps} />
                                        <SortableTH label="Updated" sortKey="updated" {...sortProps} />
                                    </tr>
                                </THead>
                                <TBody>
                                    {page.items.map(({ fighter, record }) => (
                                        <TR key={fighter.id}>
                                            <TD className="min-w-56">
                                                <FighterIdentity fighter={fighter} size="sm" href={recordHref(fighter.id)} />
                                            </TD>
                                            {record ? (
                                                <>
                                                    <TD className={cn("whitespace-nowrap", record.bloodType === "Not recorded" && "text-fg-muted")}>{record.bloodType}</TD>
                                                    <TD className="min-w-40">
                                                        <AllergySummary allergies={record.allergies} />
                                                    </TD>
                                                    <TD className="max-w-64 min-w-44 text-[13px]">
                                                        {record.chronicConditions.length === 0 ? (
                                                            <span className="text-fg-muted">None</span>
                                                        ) : (
                                                            <span className="line-clamp-2" title={record.chronicConditions.join("; ")}>
                                                                {record.chronicConditions.join("; ")}
                                                            </span>
                                                        )}
                                                    </TD>
                                                    <TD className="whitespace-nowrap text-[13px]">
                                                        <time dateTime={record.lastPhysicalAt}>{formatDate(record.lastPhysicalAt)}</time>
                                                        <span className="block text-xs text-fg-muted">{formatRelative(record.lastPhysicalAt, now)}</span>
                                                    </TD>
                                                    <TD className="text-[13px]">{record.documents.length}</TD>
                                                    <TD className="whitespace-nowrap text-[13px]">
                                                        <time dateTime={record.updatedAt} title={formatDateTime(record.updatedAt)}>
                                                            {formatRelative(record.updatedAt, now)}
                                                        </time>
                                                    </TD>
                                                </>
                                            ) : (
                                                <TD colSpan={6} className="text-[13px] text-fg-muted">
                                                    No record opened yet ·{" "}
                                                    <Link href={recordHref(fighter.id)} className="font-medium text-primary-soft-fg hover:underline">
                                                        Open record<span className="sr-only"> for {fighter.name}</span>
                                                    </Link>
                                                </TD>
                                            )}
                                        </TR>
                                    ))}
                                </TBody>
                            </Table>
                            <Pagination {...page} pathname={pathname} searchParams={params} itemLabel="records" />
                        </Card>

                        <div className="flex flex-col gap-3 md:hidden">
                            <ul className="grid grid-cols-1 gap-3">
                                {page.items.map(({ fighter, record }) => (
                                    <li key={fighter.id} className="relative min-w-0 rounded-xl border border-border bg-surface p-4 shadow-card">
                                        <FighterIdentity fighter={fighter} size="sm" href={recordHref(fighter.id)} stretchedLink />
                                        {record ? (
                                            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
                                                <div className="min-w-0">
                                                    <dt className="text-xs text-fg-muted">Blood type</dt>
                                                    <dd className="font-medium text-fg">{record.bloodType}</dd>
                                                </div>
                                                <div className="min-w-0">
                                                    <dt className="text-xs text-fg-muted">Allergies</dt>
                                                    <dd>
                                                        <AllergySummary allergies={record.allergies} />
                                                    </dd>
                                                </div>
                                                <div className="min-w-0">
                                                    <dt className="text-xs text-fg-muted">Last physical</dt>
                                                    <dd className="text-fg">{formatDate(record.lastPhysicalAt)}</dd>
                                                </div>
                                                <div className="min-w-0">
                                                    <dt className="text-xs text-fg-muted">Documents</dt>
                                                    <dd className="text-fg">{record.documents.length}</dd>
                                                </div>
                                            </dl>
                                        ) : (
                                            <p className="mt-3 text-[13px] text-fg-muted">No record opened yet.</p>
                                        )}
                                    </li>
                                ))}
                            </ul>
                            <Card className="overflow-hidden [&>nav]:border-t-0">
                                <Pagination {...page} pathname={pathname} searchParams={params} itemLabel="records" />
                            </Card>
                        </div>
                    </>
                )}
            </div>
        </>
    );
}

function AllergySummary({ allergies }: { allergies: string[] }) {
    if (allergies.length === 0) return <span className="text-[13px] text-fg-muted">None known</span>;
    return (
        <Badge tone="danger" icon={TriangleAlert} size="sm" title={allergies.join(", ")}>
            {allergies.join(", ")}
        </Badge>
    );
}
