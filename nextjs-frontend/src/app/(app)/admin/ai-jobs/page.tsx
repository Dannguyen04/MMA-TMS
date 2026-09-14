import { CircleCheck, CircleX, Clock, Cpu, Layers, LoaderCircle, TriangleAlert, type LucideIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { formatDurationSec } from "@/components/admin/admin-format";
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
import { AI_JOB_STATUS_LABELS, PIPELINE_STAGE_LABELS } from "@/lib/domain/labels";
import type { AIJob, AIJobStatus } from "@/lib/domain/types";
import { formatConfidence, formatDateTime, formatRelative, pluralize } from "@/lib/format";
import { hrefWith, paginate, parseEnum, parseSortDirection, sortItems } from "@/lib/query";
import { routes } from "@/lib/routes";
import { listAIJobs, type AIJobListItem } from "@/lib/services/ai";
import { cn, param } from "@/lib/utils";

export const metadata: Metadata = { title: "AI jobs" };

const SEGMENTS = ["all", "processing", "queued", "completed", "failed", "low_confidence"] as const;
type Segment = (typeof SEGMENTS)[number];
const SEGMENT_META: Record<Segment, { label: string; icon: LucideIcon }> = {
    all: { label: "All", icon: Layers },
    processing: { label: AI_JOB_STATUS_LABELS.processing, icon: LoaderCircle },
    queued: { label: AI_JOB_STATUS_LABELS.queued, icon: Clock },
    completed: { label: AI_JOB_STATUS_LABELS.completed, icon: CircleCheck },
    failed: { label: AI_JOB_STATUS_LABELS.failed, icon: CircleX },
    low_confidence: { label: "Low confidence", icon: TriangleAlert },
};
const STATUS_ORDER: AIJobStatus[] = ["processing", "queued", "failed", "completed"];
const SORT_KEYS = ["queued", "duration", "confidence", "status"] as const;
const PAGE_SIZE = 15;
const AUTO_REFRESH_MS = 15_000;

function inSegment(segment: Segment, { job }: AIJobListItem): boolean {
    if (segment === "all") return true;
    if (segment === "low_confidence") return job.lowConfidence;
    return job.status === segment;
}

export default async function AdminAIJobsPage({ searchParams }: PageProps<"/admin/ai-jobs">) {
    await requireRole("admin");
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

    const segments: SegmentedLinkItem[] = SEGMENTS.map((value) => ({
        href: hrefWith(pathname, params, { status: value === "all" ? null : value, page: null }),
        label: SEGMENT_META[value].label,
        icon: SEGMENT_META[value].icon,
        count: items.filter((item) => inSegment(value, item)).length,
        active: value === segment,
    }));

    return (
        <>
            <PageHeader
                title="AI jobs"
                description="Every video analysis run through the pipeline — watch progress, investigate failures and retry."
                actions={<RefreshControl renderedAt={now} autoRefreshMs={inFlight > 0 ? AUTO_REFRESH_MS : null} />}
            />

            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <SegmentedLinks label="Filter jobs by status" items={segments} />
                    <FilterBar filters={[{ type: "search", name: "q", label: "Search jobs", placeholder: "Search job, video, fighter or error" }]} />
                </div>

                <Card className="overflow-hidden">
                    <CardHeader
                        title={segment === "all" ? pluralize(filtered.length, "job") : `${pluralize(filtered.length, "job")} · ${SEGMENT_META[segment].label}`}
                        description={`${inFlight} in flight right now`}
                        icon={<Cpu />}
                    />
                    {page.total === 0 ? (
                        <CardContent>
                            {search || segment !== "all" ? (
                                <EmptyState
                                    compact
                                    title="No jobs match these filters"
                                    description="Try another status or search term."
                                    action={
                                        <ButtonLink href={pathname} variant="secondary" size="sm">
                                            Clear filters
                                        </ButtonLink>
                                    }
                                />
                            ) : (
                                <EmptyState compact title="No AI jobs yet" description="A job is created every time a coach or fighter uploads training footage." />
                            )}
                        </CardContent>
                    ) : (
                        <div className="border-t border-border">
                            <ul className="divide-y divide-border md:hidden" aria-label="AI processing jobs">
                                {page.items.map(({ job, video, fighter }) => (
                                    <li key={job.id} className="flex flex-col gap-2 px-4 py-3.5">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <Link href={routes.admin.aiJob(job.id)} className="block truncate font-mono text-[13px] font-medium text-primary-soft-fg hover:underline">
                                                    {job.id}
                                                </Link>
                                                <p className="truncate text-sm font-medium text-fg">{video?.title ?? "Video removed"}</p>
                                                <p className="truncate text-xs text-fg-muted">{fighter?.name ?? job.fighterId}</p>
                                            </div>
                                            <AIJobStatusBadge status={job.status} size="sm" className="shrink-0" />
                                        </div>
                                        <JobStage job={job} />
                                        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
                                            <span>Queued {formatRelative(job.queuedAt, now)}</span>
                                            <span>{pluralize(job.attempts, "attempt")}</span>
                                            {job.durationSec !== null && <span>{formatDurationSec(job.durationSec)}</span>}
                                            {job.avgConfidence !== null && <span>{formatConfidence(job.avgConfidence)} confidence</span>}
                                            {job.lowConfidence && <LowConfidenceBadge size="sm" />}
                                        </p>
                                    </li>
                                ))}
                            </ul>

                            <div className="hidden md:block">
                                <Table caption="AI processing jobs" className="relative min-w-[980px]">
                                    <THead>
                                        <tr>
                                            <TH>Job</TH>
                                            <TH>Video</TH>
                                            <SortableTH label="Status" sortKey="status" {...sortProps} />
                                            <TH>Stage / error</TH>
                                            <SortableTH label="Duration" sortKey="duration" align="right" className="text-right" {...sortProps} />
                                            <SortableTH label="Confidence" sortKey="confidence" {...sortProps} />
                                            <SortableTH label="Queued" sortKey="queued" {...sortProps} />
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
                                                        {video?.title ?? "Video removed"}
                                                    </p>
                                                    <p className="truncate text-xs text-fg-muted">{fighter?.name ?? job.fighterId}</p>
                                                </TD>
                                                <TD>
                                                    <AIJobStatusBadge status={job.status} size="sm" />
                                                </TD>
                                                <TD className="w-52 min-w-48">
                                                    <JobStage job={job} />
                                                </TD>
                                                <TD className="text-right whitespace-nowrap">
                                                    {job.durationSec !== null ? formatDurationSec(job.durationSec) : "—"}
                                                    <span className={cn("block text-xs", job.attempts > 1 ? "font-medium text-warning-fg" : "text-fg-subtle")}>
                                                        {pluralize(job.attempts, "attempt")}
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
                                                    <time dateTime={job.queuedAt} title={formatDateTime(job.queuedAt)} className="text-fg">
                                                        {formatRelative(job.queuedAt, now)}
                                                    </time>
                                                    <span className="block text-xs text-fg-subtle">
                                                        {job.finishedAt ? (
                                                            <>
                                                                finished{" "}
                                                                <time dateTime={job.finishedAt} title={formatDateTime(job.finishedAt)}>
                                                                    {formatRelative(job.finishedAt, now)}
                                                                </time>
                                                            </>
                                                        ) : (
                                                            "not finished"
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
                                itemLabel="jobs"
                            />
                        </div>
                    )}
                </Card>
            </div>
        </>
    );
}

/** Pipeline position: live progress while running, the error code and stopping stage when failed. */
function JobStage({ job }: { job: AIJob }) {
    if (job.status === "processing") {
        return (
            <div className="flex flex-col gap-1">
                <span className="flex justify-between gap-2 text-xs">
                    <span className="truncate text-fg">{PIPELINE_STAGE_LABELS[job.stage]}</span>
                    <span className="text-fg-muted tabular-nums">{job.progressPct}%</span>
                </span>
                <ProgressBar value={job.progressPct} label={`${job.id} progress`} size="sm" hideValue />
            </div>
        );
    }
    if (job.status === "failed") {
        return (
            <div className="flex flex-col items-start gap-1">
                <code className="rounded bg-danger-soft px-1.5 py-0.5 font-mono text-[11px] whitespace-nowrap text-danger-fg ring-1 ring-danger-border ring-inset">
                    {job.errorCode ?? "UNKNOWN_ERROR"}
                </code>
                <span className="text-xs text-fg-muted">Stopped at {PIPELINE_STAGE_LABELS[job.stage].toLowerCase()}</span>
            </div>
        );
    }
    return <span className="text-[13px] text-fg-muted">{PIPELINE_STAGE_LABELS[job.stage]}</span>;
}
