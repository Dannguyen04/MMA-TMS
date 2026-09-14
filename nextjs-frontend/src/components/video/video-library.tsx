import { SearchX, Upload, Video as VideoIcon } from "lucide-react";

import { ButtonLink } from "@/components/ui/button";
import { FilterBar, type FilterDefinition } from "@/components/ui/filter-bar";
import { EmptyState } from "@/components/ui/states";
import { Pagination } from "@/components/ui/table";
import { accessibleFighterIds } from "@/lib/auth/access";
import { TRAINING_TYPE_LABELS, VIDEO_STATUS_LABELS, VIDEO_TRAINING_TYPES } from "@/lib/domain/labels";
import type { User, VideoStatus } from "@/lib/domain/types";
import { pluralize } from "@/lib/format";
import { hrefWith, paginate, parseEnum, type SearchParams } from "@/lib/query";
import { listFighters } from "@/lib/services/people";
import { listVideoLibrary } from "@/lib/services/videos";
import { param } from "@/lib/utils";
import { videoHrefFor } from "@/lib/video/job-progress";
import { VideoCard } from "./video-card";

const STATUSES: VideoStatus[] = ["processing", "queued", "completed", "failed"];
const PAGE_SIZE = 12;

export interface VideoLibraryProps {
    user: User;
    role: "fighter" | "coach";
    pathname: string;
    searchParams: SearchParams;
    /** Restrict the library to one fighter (fighter profile tab). */
    fighterId?: string;
    uploadHref: string;
    now: string;
    headingLevel?: 2 | 3;
    /** Statuses the page lists elsewhere: left out of the unfiltered grid, still shown when the status filter asks for them. */
    hideStatuses?: VideoStatus[];
}

/** URL-filtered grid of video cards with pagination and helpful empty states. */
export async function VideoLibrary({ user, role, pathname, searchParams, fighterId, uploadHref, now, headingLevel = 3, hideStatuses = [] }: VideoLibraryProps) {
    const scope = fighterId ? [fighterId] : accessibleFighterIds(user);
    const showFighterFilter = role === "coach" && !fighterId;
    // ?fighter= is checked against record access up front, so the filter options and the videos load in parallel.
    const requestedFighter = param(searchParams.fighter);
    const fighterFilter = showFighterFilter && requestedFighter && (scope === "all" || scope.includes(requestedFighter)) ? requestedFighter : undefined;
    const status = parseEnum(param(searchParams.status), STATUSES);
    const trainingType = parseEnum(param(searchParams.type), VIDEO_TRAINING_TYPES);
    const search = param(searchParams.q)?.trim() || undefined;

    const [fighters, matching] = await Promise.all([
        showFighterFilter ? listFighters(user) : [],
        listVideoLibrary({ fighterIds: fighterFilter ? [fighterFilter] : scope, status, trainingType, search }),
    ]);
    const hiddenCount = status ? 0 : matching.filter((item) => hideStatuses.includes(item.video.status)).length;
    const items = hiddenCount > 0 ? matching.filter((item) => !hideStatuses.includes(item.video.status)) : matching;
    const page = paginate(items, param(searchParams.page), PAGE_SIZE);
    const filtered = Boolean(fighterFilter || status || trainingType || search);
    const hiddenNote = hiddenCount > 0 ? `${pluralize(hiddenCount, "video")} still processing or needing attention ${hiddenCount === 1 ? "is" : "are"} listed separately.` : null;
    const footnote = [page.pageCount > 1 ? null : `Showing all ${pluralize(page.total, "video")}`, hiddenNote].filter((part) => part !== null).join(" · ");

    const filters: FilterDefinition[] = [
        { type: "search", name: "q", label: "Search videos", placeholder: showFighterFilter ? "Search title, file or fighter" : "Search title or file" },
        ...(showFighterFilter
            ? [{ type: "select" as const, name: "fighter", label: "Fighters", options: fighters.map((f) => ({ value: f.id, label: f.name })) }]
            : []),
        { type: "select", name: "type", label: "Training types", options: VIDEO_TRAINING_TYPES.map((t) => ({ value: t, label: TRAINING_TYPE_LABELS[t] })) },
        { type: "select", name: "status", label: "Statuses", options: STATUSES.map((s) => ({ value: s, label: VIDEO_STATUS_LABELS[s] })) },
    ];

    const clearHref = hrefWith(pathname, searchParams, { q: null, fighter: null, type: null, status: null, page: null });

    return (
        <div className="flex flex-col gap-4">
            <FilterBar filters={filters} />
            {page.total === 0 ? (
                filtered ? (
                    <EmptyState
                        icon={<SearchX />}
                        title="No videos match these filters"
                        description={hiddenNote ? `Try a different search or training type. ${hiddenNote}` : "Try a different search, training type or status."}
                        action={
                            <ButtonLink href={clearHref} variant="secondary">
                                Clear filters
                            </ButtonLink>
                        }
                    />
                ) : (
                    <EmptyState
                        icon={<VideoIcon />}
                        title={hiddenNote ? "No analysed footage yet" : role === "fighter" ? "No videos yet" : "No footage yet"}
                        description={
                            hiddenNote ??
                            (role === "fighter"
                                ? "Upload a training clip and the AI will break down your strikes, guard and footwork for you and your coach."
                                : "Upload pad work, bag or sparring footage and the AI will detect strikes and suggest findings to review.")
                        }
                        action={
                            <ButtonLink href={uploadHref}>
                                <Upload aria-hidden />
                                Upload video
                            </ButtonLink>
                        }
                    />
                )
            ) : (
                <>
                    <ul className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                        {page.items.map((item) => (
                            <li key={item.video.id} className="flex min-w-0">
                                <VideoCard item={item} href={videoHrefFor(role, item.video.id)} now={now} showFighter={role === "coach" && !fighterId} headingLevel={headingLevel} className="w-full" />
                            </li>
                        ))}
                    </ul>
                    {page.pageCount > 1 && (
                        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-card [&>nav]:border-t-0">
                            <Pagination page={page.page} pageCount={page.pageCount} total={page.total} pageSize={page.pageSize} pathname={pathname} searchParams={searchParams} itemLabel="videos" />
                        </div>
                    )}
                    {footnote && <p className="text-[13px] text-fg-muted">{footnote}</p>}
                </>
            )}
        </div>
    );
}
