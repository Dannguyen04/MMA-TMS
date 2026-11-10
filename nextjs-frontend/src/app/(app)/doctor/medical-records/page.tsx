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
import { getTranslator } from "@/lib/i18n/server";
import type { Translator } from "@/lib/i18n/translate";
import { paginate, parseEnum, parseSortDirection, sortItems } from "@/lib/query";
import { routes } from "@/lib/routes";
import { getMedicalRecord } from "@/lib/services/medical";
import { medicalFeatureAvailable } from "@/lib/services/medical-features";
import { listFighters } from "@/lib/services/people";
import { cn, param } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("doctorPages.meta.records") };
}

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
    const { t, locale } = await getTranslator();
    if (!medicalFeatureAvailable("medicalRecord")) {
        return (
            <>
                <PageHeader title={t("doctorPages.meta.records")} />
                <FeatureUnavailable title={t("doctorPages.records.unavailable")} description={t("doctorPages.featureUnavailable")} />
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
    // Without a locale these shared components keep their Vietnamese wording; the dictionary words some labels differently.
    const legacy = locale === "vi" ? undefined : locale;

    return (
        <>
            <PageHeader
                title={t("doctorPages.meta.records")}
                description={t("doctorPages.records.description")}
            />

            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <FilterBar filters={[{ type: "search", name: "q", label: t("doctorPages.records.searchLabel"), placeholder: t("doctorPages.records.searchPlaceholder") }]} />
                    {rows.length > 0 && (
                        <p className="text-[13px] text-fg-muted">
                            {t("doctorPages.records.summary", { n: rows.length, allergies: withAllergies })}
                            {missing > 0 && t("doctorPages.records.summaryMissing", { n: missing })}
                        </p>
                    )}
                </div>

                {page.total === 0 ? (
                    search ? (
                        <EmptyState
                            icon={<SearchX />}
                            title={t("doctorPages.records.noMatch", { q: search })}
                            description={t("doctorPages.records.noMatchHint")}
                            action={
                                <ButtonLink href={pathname} variant="secondary">
                                    {t("doctorPages.records.clearFilters")}
                                </ButtonLink>
                            }
                        />
                    ) : (
                        <EmptyState
                            icon={<FileText />}
                            title={t("doctorPages.records.empty")}
                            description={t("doctorPages.records.emptyHint")}
                        />
                    )
                ) : (
                    <>
                        <Card className="hidden overflow-hidden md:block">
                            <Table caption={t("doctorPages.records.caption")}>
                                <THead>
                                    <tr>
                                        <SortableTH label={t("doctorPages.records.col.fighter")} sortKey="name" {...sortProps} />
                                        <SortableTH label={t("doctorPages.records.col.bloodType")} sortKey="bloodType" {...sortProps} />
                                        <SortableTH label={t("doctorPages.records.col.allergies")} sortKey="allergies" {...sortProps} />
                                        <SortableTH label={t("doctorPages.records.col.conditions")} sortKey="conditions" {...sortProps} />
                                        <SortableTH label={t("doctorPages.records.col.lastPhysical")} sortKey="lastPhysical" {...sortProps} />
                                        <SortableTH label={t("doctorPages.records.col.documents")} sortKey="documents" {...sortProps} />
                                        <SortableTH label={t("doctorPages.records.col.updated")} sortKey="updated" {...sortProps} />
                                    </tr>
                                </THead>
                                <TBody>
                                    {page.items.map(({ fighter, record }) => (
                                        <TR key={fighter.id}>
                                            <TD className="min-w-56">
                                                <FighterIdentity fighter={fighter} size="sm" href={recordHref(fighter.id)} locale={legacy} />
                                            </TD>
                                            {record ? (
                                                <>
                                                    <TD className={cn("whitespace-nowrap", record.bloodType === "Not recorded" && "text-fg-muted")}>{record.bloodType}</TD>
                                                    <TD className="min-w-40">
                                                        <AllergySummary allergies={record.allergies} t={t} />
                                                    </TD>
                                                    <TD className="max-w-64 min-w-44 text-[13px]">
                                                        {record.chronicConditions.length === 0 ? (
                                                            <span className="text-fg-muted">{t("doctorPages.records.none")}</span>
                                                        ) : (
                                                            <span className="line-clamp-2" title={record.chronicConditions.join("; ")}>
                                                                {record.chronicConditions.join("; ")}
                                                            </span>
                                                        )}
                                                    </TD>
                                                    <TD className="whitespace-nowrap text-[13px]">
                                                        <time dateTime={record.lastPhysicalAt}>{formatDate(record.lastPhysicalAt, locale)}</time>
                                                        <span className="block text-xs text-fg-muted">{formatRelative(record.lastPhysicalAt, now, locale)}</span>
                                                    </TD>
                                                    <TD className="text-[13px]">{record.documents.length}</TD>
                                                    <TD className="whitespace-nowrap text-[13px]">
                                                        <time dateTime={record.updatedAt} title={formatDateTime(record.updatedAt, locale)}>
                                                            {formatRelative(record.updatedAt, now, locale)}
                                                        </time>
                                                    </TD>
                                                </>
                                            ) : (
                                                <TD colSpan={6} className="text-[13px] text-fg-muted">
                                                    {t("doctorPages.records.notOpened")}{" "}
                                                    <Link href={recordHref(fighter.id)} className="font-medium text-primary-soft-fg hover:underline">
                                                        {t("doctorPages.records.open")}
                                                        <span className="sr-only">{t("doctorPages.records.openFor", { name: fighter.name })}</span>
                                                    </Link>
                                                </TD>
                                            )}
                                        </TR>
                                    ))}
                                </TBody>
                            </Table>
                            <Pagination {...page} pathname={pathname} searchParams={params} itemLabel={t("doctorPages.records.itemLabel")} locale={locale} />
                        </Card>

                        <div className="flex flex-col gap-3 md:hidden">
                            <ul className="grid grid-cols-1 gap-3">
                                {page.items.map(({ fighter, record }) => (
                                    <li key={fighter.id} className="relative min-w-0 rounded-xl border border-border bg-surface p-4 shadow-card">
                                        <FighterIdentity fighter={fighter} size="sm" href={recordHref(fighter.id)} stretchedLink locale={legacy} />
                                        {record ? (
                                            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
                                                <div className="min-w-0">
                                                    <dt className="text-xs text-fg-muted">{t("doctorPages.records.col.bloodType")}</dt>
                                                    <dd className="font-medium text-fg">{record.bloodType}</dd>
                                                </div>
                                                <div className="min-w-0">
                                                    <dt className="text-xs text-fg-muted">{t("doctorPages.records.col.allergies")}</dt>
                                                    <dd>
                                                        <AllergySummary allergies={record.allergies} t={t} />
                                                    </dd>
                                                </div>
                                                <div className="min-w-0">
                                                    <dt className="text-xs text-fg-muted">{t("doctorPages.records.col.lastPhysical")}</dt>
                                                    <dd className="text-fg">{formatDate(record.lastPhysicalAt, locale)}</dd>
                                                </div>
                                                <div className="min-w-0">
                                                    <dt className="text-xs text-fg-muted">{t("doctorPages.records.col.documents")}</dt>
                                                    <dd className="text-fg">{record.documents.length}</dd>
                                                </div>
                                            </dl>
                                        ) : (
                                            <p className="mt-3 text-[13px] text-fg-muted">{t("doctorPages.records.notOpenedShort")}</p>
                                        )}
                                    </li>
                                ))}
                            </ul>
                            <Card className="overflow-hidden [&>nav]:border-t-0">
                                <Pagination {...page} pathname={pathname} searchParams={params} itemLabel={t("doctorPages.records.itemLabel")} locale={locale} />
                            </Card>
                        </div>
                    </>
                )}
            </div>
        </>
    );
}

function AllergySummary({ allergies, t }: { allergies: string[]; t: Translator }) {
    if (allergies.length === 0) return <span className="text-[13px] text-fg-muted">{t("doctorPages.records.noAllergies")}</span>;
    return (
        <Badge tone="danger" icon={TriangleAlert} size="sm" title={allergies.join(", ")}>
            {allergies.join(", ")}
        </Badge>
    );
}
