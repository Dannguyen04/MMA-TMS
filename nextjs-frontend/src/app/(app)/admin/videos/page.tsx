import { CalendarClock, Film, HardDrive } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DeleteVideoButton } from "@/components/admin/delete-video-button";
import { formatVideoResolution } from "@/components/domain/domain-format";
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
import { getTranslator } from "@/lib/i18n/server";
import { TRAINING_TYPE_LABELS, VIDEO_STATUS_LABELS, VIDEO_TRAINING_TYPES } from "@/lib/domain/labels";
import type { Video, VideoStatus } from "@/lib/domain/types";
import { formatClock, formatDate, formatDateTime, formatFileSize, formatNumber, formatRelative } from "@/lib/format";
import { plural } from "@/lib/i18n/translate";
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
    const { t } = await getTranslator();
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
    const fighterName = (id: string) => fighters.find((f) => f.id === id)?.name ?? t("adminBody.videos.unknownFighter");
    // One read of the library; the storage summary needs every video, the table only the matching ones.
    const videos = allVideos.filter(
        (v) =>
            (!fighterId || v.fighterId === fighterId) &&
            (!trainingType || v.trainingType === trainingType) &&
            (!status || v.status === status) &&
            matchesSearch(search, v.title, v.fileName, v.notes, fighterName(v.fighterId)),
    );

    const userName = (id: string) => users.find((u) => u.id === id)?.name ?? t("adminBody.videos.unknownUser");
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
            <PageHeader title={t("screens.misc.adminPages.videos.title")} description={t("screens.misc.adminPages.videos.description")} />

            <div className="flex flex-col gap-6">
                <section aria-label={t("adminBody.videos.storage")} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <StatCard
                        label={t("adminBody.videos.used")}
                        value={formatNumber(storageMb / 1024, 1)}
                        unit={t("adminBody.videos.gb")}
                        icon={<HardDrive aria-hidden />}
                        hint={plural(t, "adminBody.videos.average", allVideos.length, { size: formatFileSize(allVideos.length ? storageMb / allVideos.length : 0) })}
                    />
                    <StatCard
                        label={t("adminBody.videos.week")}
                        value={formatNumber(lastWeek.length)}
                        unit={lastWeek.length === 1 ? t("adminBody.videos.unitVideo") : t("adminBody.videos.unitVideos")}
                        icon={<Film aria-hidden />}
                        hint={t("adminBody.videos.added", { size: formatFileSize(sum(lastWeek.map((v) => v.fileSizeMb))) })}
                    />
                    <StatCard
                        label={t("adminBody.videos.retention")}
                        value={formatNumber(settings.videoRetentionDays)}
                        unit={t("adminBody.videos.days")}
                        icon={<CalendarClock aria-hidden />}
                        hint={t("adminBody.videos.max", { mb: formatNumber(settings.videoMaxSizeMb), formats: settings.allowedVideoFormats.map((f) => f.toUpperCase()).join(", ") })}
                        href={routes.admin.settings}
                    />
                </section>

                <div className="flex flex-col gap-4">
                    <FilterBar
                        filters={[
                            { type: "search", name: "q", label: t("adminBody.videos.search"), placeholder: t("adminBody.videos.placeholder") },
                            { type: "select", name: "fighter", label: t("adminBody.videos.fighters"), options: fighters.map((f) => ({ value: f.id, label: f.name })) },
                            { type: "select", name: "type", label: t("adminBody.videos.types"), options: VIDEO_TRAINING_TYPES.map((value) => ({ value, label: TRAINING_TYPE_LABELS[value] })) },
                            { type: "select", name: "status", label: t("adminBody.users.statuses"), options: STATUSES.map((value) => ({ value, label: VIDEO_STATUS_LABELS[value] })) },
                        ]}
                    />

                    <Card className="overflow-hidden">
                        <CardHeader
                            title={hasFilters ? plural(t, "adminBody.videos.matching", videos.length) : plural(t, "adminBody.videos.count", allVideos.length)}
                            description={hasFilters ? t("adminBody.videos.footageFiltered", { size: formatFileSize(sum(videos.map((v) => v.fileSizeMb))) }) : t("adminBody.videos.footage", { size: formatFileSize(sum(videos.map((v) => v.fileSizeMb))) })}
                            icon={<Film />}
                        />
                        {page.total === 0 ? (
                            <CardContent>
                                {hasFilters ? (
                                    <EmptyState
                                        compact
                                        title={t("adminBody.videos.noneMatch")}
                                        description={t("adminBody.videos.noneMatchText")}
                                        action={
                                            <ButtonLink href={pathname} variant="secondary" size="sm">
                                                {t("adminBody.users.clear")}
                                            </ButtonLink>
                                        }
                                    />
                                ) : (
                                    <EmptyState compact title={t("adminBody.videos.empty")} description={t("adminBody.videos.emptyText")} />
                                )}
                            </CardContent>
                        ) : (
                            <div className="border-t border-border">
                                <ul className="divide-y divide-border md:hidden" aria-label={t("adminBody.videos.caption")}>
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
                                                    {t("adminBody.videos.uploadedBy", { when: formatDate(video.uploadedAt), name: userName(video.uploadedById) })}
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
                                    <Table caption={t("adminBody.videos.caption")} className="relative min-w-[1000px]">
                                        <THead>
                                            <tr>
                                                <SortableTH label={t("adminBody.videos.colVideo")} sortKey="title" {...sortProps} />
                                                <SortableTH label={t("adminBody.videos.colFighter")} sortKey="fighter" {...sortProps} />
                                                <SortableTH label={t("adminBody.videos.colSize")} sortKey="size" align="right" className="text-right" {...sortProps} />
                                                <SortableTH label={t("adminBody.videos.colDuration")} sortKey="duration" align="right" className="text-right" {...sortProps} />
                                                <SortableTH label={t("adminBody.videos.colUploaded")} sortKey="uploaded" {...sortProps} />
                                                <SortableTH label={t("adminBody.videos.colStatus")} sortKey="status" {...sortProps} />
                                                <TH>
                                                    <span className="sr-only">{t("adminBody.videos.actions")}</span>
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
                                                            {formatVideoResolution(video)}
                                                        </span>
                                                    </TD>
                                                    <TD className="text-right">{formatClock(video.durationSec)}</TD>
                                                    <TD className="whitespace-nowrap">
                                                        <time dateTime={video.uploadedAt} title={`${formatDateTime(video.uploadedAt)} · ${formatRelative(video.uploadedAt, now)}`}>
                                                            {formatDate(video.uploadedAt)}
                                                        </time>
                                                        <span className="block text-xs text-fg-subtle">{t("adminBody.videos.by", { name: userName(video.uploadedById) })}</span>
                                                    </TD>
                                                    <TD className="whitespace-nowrap">
                                                        <VideoStatusBadge status={video.status} size="sm" />
                                                        {video.jobId ? (
                                                            <Link href={routes.admin.aiJob(video.jobId)} className="mt-1 block font-mono text-xs text-primary-soft-fg hover:underline">
                                                                {video.jobId}
                                                            </Link>
                                                        ) : (
                                                            <span className="mt-1 block text-xs text-fg-subtle">{t("adminBody.videos.noJob")}</span>
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
                                    itemLabel={t("adminBody.videos.item")}
                                />
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </>
    );
}
