import { CalendarClock, Film, HardDrive } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { countLabel } from "@/components/admin/admin-format";
import { DeleteVideoButton } from "@/components/admin/delete-video-button";
import { formatVideoResolution, NOT_RECORDED } from "@/components/domain/domain-format";
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
import { trainingTypeLabel, VIDEO_STATUS_LABELS, VIDEO_TRAINING_TYPES } from "@/lib/domain/labels";
import type { Video, VideoStatus } from "@/lib/domain/types";
import { formatClock, formatDate, formatDateTime, formatFileSize, formatNumber, formatRelative } from "@/lib/format";
import { getTranslator } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { matchesSearch, paginate, parseEnum, parseSortDirection, sortItems } from "@/lib/query";
import { routes } from "@/lib/routes";
import { getSettings, listUsers } from "@/lib/services/admin";
import { listFighters } from "@/lib/services/people";
import { listVideos } from "@/lib/services/videos";
import { param, sum } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("screens.admin.meta.videos") };
}

const STATUSES = Object.keys(VIDEO_STATUS_LABELS) as VideoStatus[];
const SORT_KEYS = ["title", "fighter", "size", "duration", "uploaded", "status"] as const;
const PAGE_SIZE = 15;
const DAY_MS = 86_400_000;

export default async function AdminVideosPage({ searchParams }: PageProps<"/admin/videos">) {
    const admin = await requireRole("admin");
    const { t, locale } = await getTranslator();
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
    const fighterName = (id: string) => fighters.find((f) => f.id === id)?.name ?? t("screens.admin.common.unknownFighter");
    // One read of the library; the storage summary needs every video, the table only the matching ones.
    const videos = allVideos.filter(
        (v) =>
            (!fighterId || v.fighterId === fighterId) &&
            (!trainingType || v.trainingType === trainingType) &&
            (!status || v.status === status) &&
            matchesSearch(search, v.title, v.fileName, v.notes, fighterName(v.fighterId)),
    );

    const userName = (id: string) => users.find((u) => u.id === id)?.name ?? t("screens.admin.common.unknownUser");
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
    const footage = formatFileSize(sum(videos.map((v) => v.fileSizeMb)));
    const resolution = (video: Video) => {
        const text = formatVideoResolution(video);
        return text === NOT_RECORDED ? t("screens.admin.common.notRecorded") : text;
    };

    return (
        <>
            <PageHeader title={t("screens.admin.meta.videos")} description={t("screens.admin.videos.description")} />

            <div className="flex flex-col gap-6">
                <section aria-label={t("screens.admin.videos.summary")} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <StatCard
                        label={t("screens.admin.videos.storageUsed")}
                        value={formatNumber(storageMb / 1024, 1)}
                        unit="GB"
                        icon={<HardDrive aria-hidden />}
                        hint={t("screens.admin.videos.storageHint", {
                            videos: countLabel(t, "screens.admin.count.videos", allVideos.length),
                            size: formatFileSize(allVideos.length ? storageMb / allVideos.length : 0),
                        })}
                        locale={locale}
                    />
                    <StatCard
                        label={t("screens.admin.videos.lastWeek")}
                        value={formatNumber(lastWeek.length)}
                        unit={lastWeek.length === 1 ? t("screens.admin.videos.unitVideo") : t("screens.admin.videos.unitVideos")}
                        icon={<Film aria-hidden />}
                        hint={t("screens.admin.videos.added", { size: formatFileSize(sum(lastWeek.map((v) => v.fileSizeMb))) })}
                        locale={locale}
                    />
                    <StatCard
                        label={t("screens.admin.videos.retention")}
                        value={formatNumber(settings.videoRetentionDays)}
                        unit={t("screens.admin.videos.unitDays")}
                        icon={<CalendarClock aria-hidden />}
                        hint={t("screens.admin.videos.retentionHint", {
                            size: formatNumber(settings.videoMaxSizeMb),
                            formats: settings.allowedVideoFormats.map((f) => f.toUpperCase()).join(", "),
                        })}
                        href={routes.admin.settings}
                        locale={locale}
                    />
                </section>

                <div className="flex flex-col gap-4">
                    <FilterBar
                        filters={[
                            { type: "search", name: "q", label: t("screens.admin.videos.search"), placeholder: t("screens.admin.videos.searchPlaceholder") },
                            { type: "select", name: "fighter", label: t("screens.admin.videos.fighters"), options: fighters.map((f) => ({ value: f.id, label: f.name })) },
                            {
                                type: "select",
                                name: "type",
                                label: t("screens.admin.videos.trainingTypes"),
                                options: VIDEO_TRAINING_TYPES.map((value) => ({ value, label: trainingTypeLabel(t, value) })),
                            },
                            {
                                type: "select",
                                name: "status",
                                label: t("screens.admin.videos.statuses"),
                                options: STATUSES.map((value) => ({ value, label: t(`videoStatus.${value}` as MessageKey) })),
                            },
                        ]}
                    />

                    <Card className="overflow-hidden">
                        <CardHeader
                            title={hasFilters ? countLabel(t, "screens.admin.count.matchingVideos", videos.length) : countLabel(t, "screens.admin.count.videos", allVideos.length)}
                            description={hasFilters ? t("screens.admin.videos.footageFiltered", { size: footage }) : t("screens.admin.videos.footage", { size: footage })}
                            icon={<Film />}
                        />
                        {page.total === 0 ? (
                            <CardContent>
                                {hasFilters ? (
                                    <EmptyState
                                        compact
                                        title={t("screens.admin.videos.noMatchTitle")}
                                        description={t("screens.admin.videos.noMatchDescription")}
                                        action={
                                            <ButtonLink href={pathname} variant="secondary" size="sm">
                                                {t("screens.admin.common.clearFilters")}
                                            </ButtonLink>
                                        }
                                    />
                                ) : (
                                    <EmptyState compact title={t("screens.admin.videos.emptyTitle")} description={t("screens.admin.videos.emptyDescription")} />
                                )}
                            </CardContent>
                        ) : (
                            <div className="border-t border-border">
                                <ul className="divide-y divide-border md:hidden" aria-label={t("screens.admin.videos.caption")}>
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
                                                <VideoStatusBadge status={video.status} size="sm" locale={locale} />
                                                <span className="inline-flex items-center gap-1.5 text-[13px] text-fg">
                                                    <Avatar name={fighterName(video.fighterId)} size="xs" shape="octagon" />
                                                    {fighterName(video.fighterId)}
                                                </span>
                                            </div>
                                            <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-fg-muted">
                                                <span className="inline-flex items-center gap-1">
                                                    <TrainingTypeIcon type={video.trainingType} className="size-3.5" locale={locale} />
                                                    {trainingTypeLabel(t, video.trainingType)}
                                                </span>
                                                <span>
                                                    {formatFileSize(video.fileSizeMb)} · {formatClock(video.durationSec)}
                                                </span>
                                                <span>{t("screens.admin.videos.uploadedBy", { date: formatDate(video.uploadedAt, locale), name: userName(video.uploadedById) })}</span>
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
                                    <Table caption={t("screens.admin.videos.caption")} className="relative min-w-[1000px]">
                                        <THead>
                                            <tr>
                                                <SortableTH label={t("screens.admin.common.video")} sortKey="title" {...sortProps} />
                                                <SortableTH label={t("screens.admin.videos.fighterType")} sortKey="fighter" {...sortProps} />
                                                <SortableTH label={t("screens.admin.videos.size")} sortKey="size" align="right" className="text-right" {...sortProps} />
                                                <SortableTH label={t("screens.admin.common.duration")} sortKey="duration" align="right" className="text-right" {...sortProps} />
                                                <SortableTH label={t("screens.admin.videos.uploaded")} sortKey="uploaded" {...sortProps} />
                                                <SortableTH label={t("screens.admin.videos.statusJob")} sortKey="status" {...sortProps} />
                                                <TH>
                                                    <span className="sr-only">{t("screens.admin.videos.actions")}</span>
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
                                                            <TrainingTypeIcon type={video.trainingType} className="size-3.5" locale={locale} />
                                                            {trainingTypeLabel(t, video.trainingType)}
                                                        </span>
                                                    </TD>
                                                    <TD className="text-right whitespace-nowrap">
                                                        {formatFileSize(video.fileSizeMb)}
                                                        <span className="block text-xs text-fg-subtle">{resolution(video)}</span>
                                                    </TD>
                                                    <TD className="text-right">{formatClock(video.durationSec)}</TD>
                                                    <TD className="whitespace-nowrap">
                                                        <time
                                                            dateTime={video.uploadedAt}
                                                            title={`${formatDateTime(video.uploadedAt, locale)} · ${formatRelative(video.uploadedAt, now, locale)}`}
                                                        >
                                                            {formatDate(video.uploadedAt, locale)}
                                                        </time>
                                                        <span className="block text-xs text-fg-subtle">{t("screens.admin.videos.by", { name: userName(video.uploadedById) })}</span>
                                                    </TD>
                                                    <TD className="whitespace-nowrap">
                                                        <VideoStatusBadge status={video.status} size="sm" locale={locale} />
                                                        {video.jobId ? (
                                                            <Link href={routes.admin.aiJob(video.jobId)} className="mt-1 block font-mono text-xs text-primary-soft-fg hover:underline">
                                                                {video.jobId}
                                                            </Link>
                                                        ) : (
                                                            <span className="mt-1 block text-xs text-fg-subtle">{t("screens.admin.videos.noJob")}</span>
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
                                    itemLabel={t("screens.admin.videos.itemLabel")}
                                    locale={locale}
                                />
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </>
    );
}
