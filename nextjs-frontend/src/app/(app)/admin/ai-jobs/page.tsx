import { CircleCheck, CircleX, Clock, Cpu, Layers, LoaderCircle, TriangleAlert, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { countLabel, formatDurationSec, jobStatusLabel, pipelineStageLabel, splitAround } from "@/components/admin/admin-format";
import { RefreshControl } from "@/components/admin/refresh-control";
import { AIJobStatusBadge, LowConfidenceBadge } from "@/components/domain/status-badges";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress";
import { SegmentedLinks, type SegmentedLinkItem } from "@/components/ui/segmented-links";
import { EmptyState } from "@/components/ui/states";
import { Pagination, SortableTH, Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/session";
import type { AIJob, AIJobStatus } from "@/lib/domain/types";
import { formatConfidence, formatDateTime, formatRelative } from "@/lib/format";
import { getTranslator } from "@/lib/i18n/server";
import type { Translator } from "@/lib/i18n/translate";
import { hrefWith, paginate, parseEnum, parseSortDirection, sortItems } from "@/lib/query";
import { routes } from "@/lib/routes";
import { listAIJobs, type AIJobListItem } from "@/lib/services/ai";
import { platformFeatureAvailable } from "@/lib/services/platform-features";
import { cn, param } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("screens.admin.meta.aiJobs") };
}

const SEGMENTS = ["all", "processing", "queued", "completed", "failed", "low_confidence"] as const;
type Segment = (typeof SEGMENTS)[number];
const SEGMENT_ICONS: Record<Segment, LucideIcon> = {
    all: Layers,
    processing: LoaderCircle,
    queued: Clock,
    completed: CircleCheck,
    failed: CircleX,
    low_confidence: TriangleAlert,
};
const STATUS_ORDER: AIJobStatus[] = ["processing", "queued", "failed", "completed"];
const SORT_KEYS = ["queued", "duration", "confidence", "status"] as const;
const PAGE_SIZE = 15;
const AUTO_REFRESH_MS = 15_000;

function segmentLabel(t: Translator, segment: Segment): string {
    if (segment === "all") return t("screens.admin.common.all");
    if (segment === "low_confidence") return t("screens.admin.jobs.lowConfidence");
    return jobStatusLabel(t, segment);
}

function inSegment(segment: Segment, { job }: AIJobListItem): boolean {
    if (segment === "all") return true;
    if (segment === "low_confidence") return job.lowConfidence;
    return job.status === segment;
}

export default async function AdminAIJobsPage({ searchParams }: PageProps<"/admin/ai-jobs">) {
    await requireRole("admin");
    const { t, locale } = await getTranslator();
    const params = await searchParams;
    const now = new Date().toISOString();
    const pathname = routes.admin.aiJobs;

    const search = param(params.q)?.trim() || undefined;
    const segment = parseEnum(param(params.status), SEGMENTS) ?? "all";
    const sort = parseEnum(param(params.sort), SORT_KEYS) ?? "queued";
    const dir = parseSortDirection(param(params.dir), param(params.sort) ? "asc" : "desc");

    const items = await listAIJobs({ search });
    const filtered = items.filter((item) => inSegment(segment, item));
    const inFlight = items.filter(({ job }) => job.status === "processing" || job.status === "queued").length;

    const accessors: Record<(typeof SORT_KEYS)[number], (item: AIJobListItem) => string | number | null> = {
        queued: ({ job }) => job.queuedAt,
        duration: ({ job }) => job.durationSec,
        confidence: ({ job }) => job.avgConfidence,
        status: ({ job }) => STATUS_ORDER.indexOf(job.status),
    };
    const page = paginate(sortItems(filtered, accessors[sort], dir), param(params.page), PAGE_SIZE);
    const sortProps = { pathname, searchParams: params, activeSort: sort, direction: dir };

    // Jobs from the jobs API report no confidence, so there is no low-confidence group to offer.
    const reportsConfidence = items.some(({ job }) => job.avgConfidence !== null);
    const segments: SegmentedLinkItem[] = SEGMENTS.filter((value) => reportsConfidence || value !== "low_confidence").map((value) => ({
        href: hrefWith(pathname, params, { status: value === "all" ? null : value, page: null }),
        label: segmentLabel(t, value),
        icon: SEGMENT_ICONS[value],
        count: items.filter((item) => inSegment(value, item)).length,
        active: value === segment,
    }));
    const jobs = countLabel(t, "screens.admin.count.jobs", filtered.length);
    const [finishedBefore, finishedAfter] = splitAround(t("screens.admin.jobs.finished"), "when");

    return (
        <>
            <PageHeader
                title={t("screens.admin.common.aiJobs")}
                description={platformFeatureAvailable("aiJobControl") ? t("screens.admin.jobs.descriptionControl") : t("screens.admin.jobs.description")}
                actions={<RefreshControl renderedAt={now} autoRefreshMs={inFlight > 0 ? AUTO_REFRESH_MS : null} />}
            />

            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <SegmentedLinks label={t("screens.admin.jobs.filter")} items={segments} />
                    <FilterBar filters={[{ type: "search", name: "q", label: t("screens.admin.jobs.search"), placeholder: t("screens.admin.jobs.searchPlaceholder") }]} />
                </div>

                <Card className="overflow-hidden">
                    <CardHeader
                        title={segment === "all" ? jobs : t("screens.admin.jobs.titleSegment", { jobs, segment: segmentLabel(t, segment) })}
                        description={t("screens.admin.jobs.inFlight", { n: inFlight })}
                        icon={<Cpu />}
                    />
                    {page.total === 0 ? (
                        <CardContent>
                            {search || segment !== "all" ? (
                                <EmptyState
                                    compact
                                    title={t("screens.admin.jobs.noMatchTitle")}
                                    description={t("screens.admin.jobs.noMatchDescription")}
                                    action={
                                        <ButtonLink href={pathname} variant="secondary" size="sm">
                                            {t("screens.admin.common.clearFilters")}
                                        </ButtonLink>
                                    }
                                />
                            ) : (
                                <EmptyState compact title={t("screens.admin.jobs.emptyTitle")} description={t("screens.admin.jobs.emptyDescription")} />
                            )}
                        </CardContent>
                    ) : (
                        <div className="border-t border-border">
                            <ul className="divide-y divide-border md:hidden" aria-label={t("screens.admin.jobs.caption")}>
                                {page.items.map(({ job, video, fighter }) => (
                                    <li key={job.id} className="flex flex-col gap-2 px-4 py-3.5">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <Link href={routes.admin.aiJob(job.id)} className="block truncate font-mono text-[13px] font-medium text-primary-soft-fg hover:underline">
                                                    {job.id}
                                                </Link>
                                                <p className="truncate text-sm font-medium text-fg">{video?.title ?? t("screens.admin.common.videoRemoved")}</p>
                                                <p className="truncate text-xs text-fg-muted">{fighter?.name ?? job.fighterId}</p>
                                            </div>
                                            <AIJobStatusBadge status={job.status} size="sm" className="shrink-0" />
                                        </div>
                                        <JobStage job={job} t={t} />
                                        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
                                            <span>{t("screens.admin.jobs.queuedWhen", { when: formatRelative(job.queuedAt, now, locale) })}</span>
                                            <span>{countLabel(t, "screens.admin.count.attempts", job.attempts)}</span>
                                            {job.durationSec !== null && <span>{formatDurationSec(job.durationSec, locale)}</span>}
                                            {job.avgConfidence !== null && <span>{t("screens.admin.jobs.confidence", { pct: formatConfidence(job.avgConfidence) })}</span>}
                                            {job.lowConfidence && <LowConfidenceBadge size="sm" />}
                                        </p>
                                    </li>
                                ))}
                            </ul>

                            <div className="hidden md:block">
                                <Table caption={t("screens.admin.jobs.caption")} className="relative min-w-[980px]">
                                    <THead>
                                        <tr>
                                            <TH>{t("screens.admin.common.job")}</TH>
                                            <TH>{t("screens.admin.common.video")}</TH>
                                            <SortableTH label={t("screens.admin.common.status")} sortKey="status" {...sortProps} />
                                            <TH>{t("screens.admin.jobs.stageError")}</TH>
                                            <SortableTH label={t("screens.admin.common.duration")} sortKey="duration" align="right" className="text-right" {...sortProps} />
                                            <SortableTH label={t("screens.admin.jobs.confidenceColumn")} sortKey="confidence" {...sortProps} />
                                            <SortableTH label={t("screens.admin.common.queued")} sortKey="queued" {...sortProps} />
                                        </tr>
                                    </THead>
                                    <TBody>
                                        {page.items.map(({ job, video, fighter }) => (
                                            <TR key={job.id}>
                                                <TD className="whitespace-nowrap">
                                                    <Link href={routes.admin.aiJob(job.id)} className="font-mono text-[13px] font-medium text-primary-soft-fg hover:underline">
                                                        {job.id}
                                                    </Link>
                                                    {job.workerId && <span className="block font-mono text-xs text-fg-subtle">{job.workerId}</span>}
                                                </TD>
                                                <TD className="max-w-44">
                                                    <p className="truncate font-medium" title={video?.title}>
                                                        {video?.title ?? t("screens.admin.common.videoRemoved")}
                                                    </p>
                                                    <p className="truncate text-xs text-fg-muted">{fighter?.name ?? job.fighterId}</p>
                                                </TD>
                                                <TD>
                                                    <AIJobStatusBadge status={job.status} size="sm" />
                                                </TD>
                                                <TD className="w-52 min-w-48">
                                                    <JobStage job={job} t={t} />
                                                </TD>
                                                <TD className="text-right whitespace-nowrap">
                                                    {job.durationSec !== null ? formatDurationSec(job.durationSec, locale) : "—"}
                                                    <span className={cn("block text-xs", job.attempts > 1 ? "font-medium text-warning-fg" : "text-fg-subtle")}>
                                                        {countLabel(t, "screens.admin.count.attempts", job.attempts)}
                                                    </span>
                                                </TD>
                                                <TD className="whitespace-nowrap">
                                                    {job.avgConfidence !== null ? (
                                                        <span className="flex flex-col items-start gap-1">
                                                            {formatConfidence(job.avgConfidence)}
                                                            {job.lowConfidence && <LowConfidenceBadge size="sm" />}
                                                        </span>
                                                    ) : (
                                                        <span className="text-fg-subtle">—</span>
                                                    )}
                                                </TD>
                                                <TD className="whitespace-nowrap">
                                                    <time dateTime={job.queuedAt} title={formatDateTime(job.queuedAt, locale)} className="text-fg">
                                                        {formatRelative(job.queuedAt, now, locale)}
                                                    </time>
                                                    <span className="block text-xs text-fg-subtle">
                                                        {job.finishedAt ? (
                                                            <>
                                                                {finishedBefore}
                                                                <time dateTime={job.finishedAt} title={formatDateTime(job.finishedAt, locale)}>
                                                                    {formatRelative(job.finishedAt, now, locale)}
                                                                </time>
                                                                {finishedAfter}
                                                            </>
                                                        ) : (
                                                            t("screens.admin.jobs.notFinished")
                                                        )}
                                                    </span>
                                                </TD>
                                            </TR>
                                        ))}
                                    </TBody>
                                </Table>
                            </div>
                            <Pagination
                                page={page.page}
                                pageCount={page.pageCount}
                                total={page.total}
                                pageSize={page.pageSize}
                                pathname={pathname}
                                searchParams={params}
                                itemLabel={t("screens.admin.jobs.itemLabel")}
                                locale={locale}
                            />
                        </div>
                    )}
                </Card>
            </div>
        </>
    );
}

/** Pipeline position: live progress while running, the error code and stopping stage when failed. */
function JobStage({ job, t }: { job: AIJob; t: Translator }) {
    const stage = pipelineStageLabel(t, job.stage);
    if (job.status === "processing") {
        return (
            <div className="flex flex-col gap-1">
                <span className="flex justify-between gap-2 text-xs">
                    <span className="truncate text-fg">{stage}</span>
                    <span className="text-fg-muted tabular-nums">{job.progressPct}%</span>
                </span>
                <ProgressBar value={job.progressPct} label={t("screens.admin.common.progress", { id: job.id })} size="sm" hideValue />
            </div>
        );
    }
    if (job.status === "failed") {
        return (
            <div className="flex flex-col items-start gap-1">
                <code className="rounded bg-danger-soft px-1.5 py-0.5 font-mono text-[11px] whitespace-nowrap text-danger-fg ring-1 ring-danger-border ring-inset">
                    {job.errorCode ?? "UNKNOWN_ERROR"}
                </code>
                <span className="text-xs text-fg-muted">{t("screens.admin.jobs.stoppedAt", { stage: stage.toLowerCase() })}</span>
            </div>
        );
    }
    return <span className="text-[13px] text-fg-muted">{stage}</span>;
}
