import { CalendarClock, Film, HardDrive } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DeleteVideoButton } from "@/components/admin/delete-video-button";
import { TrainingTypeIcon } from "@/components/domain/training-type-icon";
import { VideoStatusBadge } from "@/components/domain/status-badges";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/states";
import { Pagination, SortableTH, Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/session";
import { TRAINING_TYPE_LABELS, VIDEO_STATUS_LABELS, VIDEO_TRAINING_TYPES } from "@/lib/domain/labels";
import type { Video, VideoStatus } from "@/lib/domain/types";
import { formatClock, formatDate, formatDateTime, formatFileSize, formatNumber, formatRelative, pluralize } from "@/lib/format";
import { matchesSearch, paginate, parseEnum, parseSortDirection, sortItems } from "@/lib/query";
import { routes } from "@/lib/routes";
import { getSettings, listUsers } from "@/lib/services/admin";
import { listFighters } from "@/lib/services/people";
import { listVideos } from "@/lib/services/videos";
import { param, sum } from "@/lib/utils";

export const metadata: Metadata = { title: "Videos" };

const STATUSES = Object.keys(VIDEO_STATUS_LABELS) as VideoStatus[];
const SORT_KEYS = ["title", "fighter", "size", "duration", "uploaded", "status"] as const;
const PAGE_SIZE = 15;
const DAY_MS = 86_400_000;

export default async function AdminVideosPage({ searchParams }: PageProps<"/admin/videos">) {
    const admin = await requireRole("admin");
    const params = await searchParams;
    const nowDate = new Date();
    const now = nowDate.toISOString();
    const pathname = routes.admin.videos;

    const search = param(params.q)?.trim() || undefined;
    const trainingType = parseEnum(param(params.type), VIDEO_TRAINING_TYPES);
    const status = parseEnum(param(params.status), STATUSES);
    const requestedFighter = param(params.fighter);

    const [fighters, users, settings, allVideos] = await Promise.all([listFighters(admin), listUsers(), getSettings(), listVideos()]);
    const fighterId = fighters.some((f) => f.id === requestedFighter) ? requestedFighter : undefined;
    const fighterName = (id: string) => fighters.find((f) => f.id === id)?.name ?? "Unknown fighter";
    // One read of the library; the storage summary needs every video, the table only the matching ones.
    const videos = allVideos.filter(
        (v) =>
            (!fighterId || v.fighterId === fighterId) &&
            (!trainingType || v.trainingType === trainingType) &&
            (!status || v.status === status) &&
            matchesSearch(search, v.title, v.fileName, v.notes, fighterName(v.fighterId)),
    );

    const userName = (id: string) => users.find((u) => u.id === id)?.name ?? "Unknown user";
    const hasFilters = Boolean(search || trainingType || status || fighterId);

    const sort = parseEnum(param(params.sort), SORT_KEYS) ?? "uploaded";
    const dir = parseSortDirection(param(params.dir), param(params.sort) ? "asc" : "desc");
    const accessors: Record<(typeof SORT_KEYS)[number], (video: Video) => string | number> = {
        title: (v) => v.title,
        fighter: (v) => fighterName(v.fighterId),
        size: (v) => v.fileSizeMb,
        duration: (v) => v.durationSec,
        uploaded: (v) => v.uploadedAt,
        status: (v) => STATUSES.indexOf(v.status),
    };
    const page = paginate(sortItems(videos, accessors[sort], dir), param(params.page), PAGE_SIZE);
    const sortProps = { pathname, searchParams: params, activeSort: sort, direction: dir };

    const storageMb = sum(allVideos.map((v) => v.fileSizeMb));
    const lastWeek = allVideos.filter((v) => nowDate.getTime() - Date.parse(v.uploadedAt) <= 7 * DAY_MS);

    return (
        <>
            <PageHeader title="Videos" description="All training footage on the platform, its storage footprint and AI processing status." />

            <div className="flex flex-col gap-6">
                <section aria-label="Storage summary" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <StatCard
                        label="Storage used"
                        value={formatNumber(storageMb / 1024, 1)}
                        unit="GB"
                        icon={<HardDrive aria-hidden />}
                        hint={`${pluralize(allVideos.length, "video")} · ${formatFileSize(allVideos.length ? storageMb / allVideos.length : 0)} on average`}
                    />
                    <StatCard
                        label="Uploaded · last 7 days"
                        value={formatNumber(lastWeek.length)}
                        unit={lastWeek.length === 1 ? "video" : "videos"}
                        icon={<Film aria-hidden />}
                        hint={`${formatFileSize(sum(lastWeek.map((v) => v.fileSizeMb)))} added`}
                    />
                    <StatCard
                        label="Retention policy"
                        value={formatNumber(settings.videoRetentionDays)}
                        unit="days"
                        icon={<CalendarClock aria-hidden />}
                        hint={`Max ${formatNumber(settings.videoMaxSizeMb)} MB · ${settings.allowedVideoFormats.map((f) => f.toUpperCase()).join(", ")}`}
                        href={routes.admin.settings}
                    />
                </section>

                <div className="flex flex-col gap-4">
                    <FilterBar
                        filters={[
                            { type: "search", name: "q", label: "Search videos", placeholder: "Search title, file or fighter" },
                            { type: "select", name: "fighter", label: "Fighters", options: fighters.map((f) => ({ value: f.id, label: f.name })) },
                            { type: "select", name: "type", label: "Training types", options: VIDEO_TRAINING_TYPES.map((value) => ({ value, label: TRAINING_TYPE_LABELS[value] })) },
                            { type: "select", name: "status", label: "Statuses", options: STATUSES.map((value) => ({ value, label: VIDEO_STATUS_LABELS[value] })) },
                        ]}
                    />

                    <Card className="overflow-hidden">
                        <CardHeader
                            title={hasFilters ? pluralize(videos.length, "matching video") : pluralize(allVideos.length, "video")}
                            description={`${formatFileSize(sum(videos.map((v) => v.fileSizeMb)))} of footage${hasFilters ? " in these results" : ""}`}
                            icon={<Film />}
                        />
                        {page.total === 0 ? (
                            <CardContent>
                                {hasFilters ? (
                                    <EmptyState
                                        compact
                                        title="No videos match these filters"
                                        description="Try another fighter, training type or status."
                                        action={
                                            <ButtonLink href={pathname} variant="secondary" size="sm">
                                                Clear filters
                                            </ButtonLink>
                                        }
                                    />
                                ) : (
                                    <EmptyState compact title="No videos uploaded yet" description="Coaches and fighters upload training footage from their video pages." />
                                )}
                            </CardContent>
                        ) : (
                            <div className="border-t border-border">
                                <ul className="divide-y divide-border md:hidden" aria-label="Training videos">
                                    {page.items.map((video) => (
                                        <li key={video.id} className="flex flex-col gap-2 px-4 py-3.5">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-medium text-fg">{video.title}</p>
                                                    <p className="truncate font-mono text-xs text-fg-subtle">{video.fileName}</p>
                                                </div>
                                                <DeleteVideoButton videoId={video.id} title={video.title} fighterName={fighterName(video.fighterId)} />
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <VideoStatusBadge status={video.status} size="sm" />
                                                <span className="inline-flex items-center gap-1.5 text-[13px] text-fg">
                                                    <Avatar name={fighterName(video.fighterId)} size="xs" shape="octagon" />
                                                    {fighterName(video.fighterId)}
                                                </span>
                                            </div>
                                            <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-fg-muted">
                                                <span className="inline-flex items-center gap-1">
                                                    <TrainingTypeIcon type={video.trainingType} className="size-3.5" />
                                                    {TRAINING_TYPE_LABELS[video.trainingType]}
                                                </span>
                                                <span>
                                                    {formatFileSize(video.fileSizeMb)} · {formatClock(video.durationSec)}
                                                </span>
                                                <span>
                                                    {formatDate(video.uploadedAt)} by {userName(video.uploadedById)}
                                                </span>
                                                {video.jobId && (
                                                    <Link href={routes.admin.aiJob(video.jobId)} className="font-mono text-primary-soft-fg hover:underline">
                                                        {video.jobId}
                                                    </Link>
                                                )}
                                            </p>
                                        </li>
                                    ))}
                                </ul>

                                <div className="hidden md:block">
                                    <Table caption="Training videos" className="relative min-w-[1000px]">
                                        <THead>
                                            <tr>
                                                <SortableTH label="Video" sortKey="title" {...sortProps} />
                                                <SortableTH label="Fighter & type" sortKey="fighter" {...sortProps} />
                                                <SortableTH label="Size" sortKey="size" align="right" className="text-right" {...sortProps} />
                                                <SortableTH label="Duration" sortKey="duration" align="right" className="text-right" {...sortProps} />
                                                <SortableTH label="Uploaded" sortKey="uploaded" {...sortProps} />
                                                <SortableTH label="Status & job" sortKey="status" {...sortProps} />
                                                <TH>
                                                    <span className="sr-only">Actions</span>
                                                </TH>
                                            </tr>
                                        </THead>
                                        <TBody>
                                            {page.items.map((video) => (
                                                <TR key={video.id}>
                                                    <TD className="max-w-60">
                                                        <p className="truncate font-medium" title={video.title}>
                                                            {video.title}
                                                        </p>
                                                        <p className="truncate font-mono text-xs text-fg-subtle" title={video.fileName}>
                                                            {video.fileName}
                                                        </p>
                                                    </TD>
                                                    <TD className="whitespace-nowrap">
                                                        <span className="flex items-center gap-2">
                                                            <Avatar name={fighterName(video.fighterId)} size="xs" shape="octagon" />
                                                            {fighterName(video.fighterId)}
                                                        </span>
                                                        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-fg-muted">
                                                            <TrainingTypeIcon type={video.trainingType} className="size-3.5" />
                                                            {TRAINING_TYPE_LABELS[video.trainingType]}
                                                        </span>
                                                    </TD>
                                                    <TD className="text-right whitespace-nowrap">
                                                        {formatFileSize(video.fileSizeMb)}
                                                        <span className="block text-xs text-fg-subtle">
                                                            {video.resolution.replace("x", "×")} · {video.fps} fps
                                                        </span>
                                                    </TD>
                                                    <TD className="text-right">{formatClock(video.durationSec)}</TD>
                                                    <TD className="whitespace-nowrap">
                                                        <time dateTime={video.uploadedAt} title={`${formatDateTime(video.uploadedAt)} · ${formatRelative(video.uploadedAt, now)}`}>
                                                            {formatDate(video.uploadedAt)}
                                                        </time>
                                                        <span className="block text-xs text-fg-subtle">by {userName(video.uploadedById)}</span>
                                                    </TD>
                                                    <TD className="whitespace-nowrap">
                                                        <VideoStatusBadge status={video.status} size="sm" />
                                                        {video.jobId ? (
                                                            <Link href={routes.admin.aiJob(video.jobId)} className="mt-1 block font-mono text-xs text-primary-soft-fg hover:underline">
                                                                {video.jobId}
                                                            </Link>
                                                        ) : (
                                                            <span className="mt-1 block text-xs text-fg-subtle">No job</span>
                                                        )}
                                                    </TD>
                                                    <TD className="text-right">
                                                        <DeleteVideoButton videoId={video.id} title={video.title} fighterName={fighterName(video.fighterId)} />
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
                                    itemLabel="videos"
                                />
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </>
    );
}
