import { FileText, SearchX, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FighterIdentity } from "@/components/domain/fighter-identity";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, FeatureUnavailable } from "@/components/ui/states";
import { Pagination, SortableTH, Table, TBody, TD, THead, TR } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/session";
import type { Fighter, MedicalRecord } from "@/lib/domain/types";
import { formatDate, formatDateTime, formatRelative } from "@/lib/format";
import { paginate, parseEnum, parseSortDirection, sortItems } from "@/lib/query";
import { routes } from "@/lib/routes";
import { getMedicalRecord } from "@/lib/services/medical";
import { medicalFeatureAvailable } from "@/lib/services/medical-features";
import { listFighters } from "@/lib/services/people";
import { cn, param } from "@/lib/utils";

export const metadata: Metadata = { title: "Bệnh án" };

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
    if (!medicalFeatureAvailable("medicalRecord")) {
        return (
            <>
                <PageHeader title="Bệnh án" />
                <FeatureUnavailable title="Bệnh án chưa khả dụng" />
            </>
        );
    }
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
                title="Bệnh án"
                description="Nhóm máu, dị ứng, bệnh nền và tài liệu của võ sĩ được phân công. Chỉ bác sĩ thể thao được xem."
            />

            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <FilterBar filters={[{ type: "search", name: "q", label: "Tìm bệnh án", placeholder: "Tìm tên võ sĩ hoặc môn" }]} />
                    {rows.length > 0 && (
                        <p className="text-[13px] text-fg-muted">
                            {rows.length} bệnh án · {withAllergies} võ sĩ có dị ứng
                            {missing > 0 && ` · ${missing} chưa mở`}
                        </p>
                    )}
                </div>

                {page.total === 0 ? (
                    search ? (
                        <EmptyState
                            icon={<SearchX />}
                            title={`Không có bệnh án khớp “${search}”`}
                            description="Kiểm tra chính tả hoặc tìm theo môn."
                            action={
                                <ButtonLink href={pathname} variant="secondary">
                                    Xóa bộ lọc
                                </ButtonLink>
                            }
                        />
                    ) : (
                        <EmptyState
                            icon={<FileText />}
                            title="Chưa có bệnh án"
                            description="Bệnh án sẽ hiện khi có võ sĩ được phân công."
                        />
                    )
                ) : (
                    <>
                        <Card className="hidden overflow-hidden md:block">
                            <Table caption="Bệnh án">
                                <THead>
                                    <tr>
                                        <SortableTH label="Võ sĩ" sortKey="name" {...sortProps} />
                                        <SortableTH label="Nhóm máu" sortKey="bloodType" {...sortProps} />
                                        <SortableTH label="Dị ứng" sortKey="allergies" {...sortProps} />
                                        <SortableTH label="Bệnh mạn tính" sortKey="conditions" {...sortProps} />
                                        <SortableTH label="Khám tổng quát gần nhất" sortKey="lastPhysical" {...sortProps} />
                                        <SortableTH label="Tài liệu" sortKey="documents" {...sortProps} />
                                        <SortableTH label="Cập nhật" sortKey="updated" {...sortProps} />
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
                                                            <span className="text-fg-muted">Không</span>
                                                        ) : (
                                                            <span className="line-clamp-2" title={record.chronicConditions.join("; ")}>
                                                                {record.chronicConditions.join("; ")}
                                                            </span>
                                                        )}
                                                    </TD>
                                                    <TD className="whitespace-nowrap text-[13px]">
                                                        <time dateTime={record.lastPhysicalAt}>{formatDate(record.lastPhysicalAt)}</time>
                                                        <span className="block text-xs text-fg-muted">{formatRelative(record.lastPhysicalAt, now, "vi")}</span>
                                                    </TD>
                                                    <TD className="text-[13px]">{record.documents.length}</TD>
                                                    <TD className="whitespace-nowrap text-[13px]">
                                                        <time dateTime={record.updatedAt} title={formatDateTime(record.updatedAt)}>
                                                            {formatRelative(record.updatedAt, now, "vi")}
                                                        </time>
                                                    </TD>
                                                </>
                                            ) : (
                                                <TD colSpan={6} className="text-[13px] text-fg-muted">
                                                    Chưa mở bệnh án ·{" "}
                                                    <Link href={recordHref(fighter.id)} className="font-medium text-primary-soft-fg hover:underline">
                                                        Mở bệnh án<span className="sr-only"> for {fighter.name}</span>
                                                    </Link>
                                                </TD>
                                            )}
                                        </TR>
                                    ))}
                                </TBody>
                            </Table>
                            <Pagination {...page} pathname={pathname} searchParams={params} itemLabel="bệnh án" />
                        </Card>

                        <div className="flex flex-col gap-3 md:hidden">
                            <ul className="grid grid-cols-1 gap-3">
                                {page.items.map(({ fighter, record }) => (
                                    <li key={fighter.id} className="relative min-w-0 rounded-xl border border-border bg-surface p-4 shadow-card">
                                        <FighterIdentity fighter={fighter} size="sm" href={recordHref(fighter.id)} stretchedLink />
                                        {record ? (
                                            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
                                                <div className="min-w-0">
                                                    <dt className="text-xs text-fg-muted">Nhóm máu</dt>
                                                    <dd className="font-medium text-fg">{record.bloodType}</dd>
                                                </div>
                                                <div className="min-w-0">
                                                    <dt className="text-xs text-fg-muted">Dị ứng</dt>
                                                    <dd>
                                                        <AllergySummary allergies={record.allergies} />
                                                    </dd>
                                                </div>
                                                <div className="min-w-0">
                                                    <dt className="text-xs text-fg-muted">Khám tổng quát gần nhất</dt>
                                                    <dd className="text-fg">{formatDate(record.lastPhysicalAt)}</dd>
                                                </div>
                                                <div className="min-w-0">
                                                    <dt className="text-xs text-fg-muted">Tài liệu</dt>
                                                    <dd className="text-fg">{record.documents.length}</dd>
                                                </div>
                                            </dl>
                                        ) : (
                                            <p className="mt-3 text-[13px] text-fg-muted">Chưa mở bệnh án.</p>
                                        )}
                                    </li>
                                ))}
                            </ul>
                            <Card className="overflow-hidden [&>nav]:border-t-0">
                                <Pagination {...page} pathname={pathname} searchParams={params} itemLabel="bệnh án" />
                            </Card>
                        </div>
                    </>
                )}
            </div>
        </>
    );
}

function AllergySummary({ allergies }: { allergies: string[] }) {
    if (allergies.length === 0) return <span className="text-[13px] text-fg-muted">Chưa ghi nhận</span>;
    return (
        <Badge tone="danger" icon={TriangleAlert} size="sm" title={allergies.join(", ")}>
            {allergies.join(", ")}
        </Badge>
    );
}
