import { BellRing, CalendarClock, CircleCheck, CircleX, Layers, Radar } from "lucide-react";
import type { Metadata } from "next";

import { ObservationCard } from "@/components/clinical/observation-card";
import { AINotice } from "@/components/domain/ai-notice";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { SegmentedLinks, type SegmentedLinkItem } from "@/components/ui/segmented-links";
import { EmptyState } from "@/components/ui/states";
import { Pagination } from "@/components/ui/table";
import { accessibleFighterIds } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import type { AlertStatus } from "@/lib/domain/types";
import { hrefWith, paginate, parseEnum } from "@/lib/query";
import { routes } from "@/lib/routes";
import { listAlerts } from "@/lib/services/ai";
import { listFighters } from "@/lib/services/people";
import { listVideos } from "@/lib/services/videos";
import { param } from "@/lib/utils";

export const metadata: Metadata = { title: "AI movement observations" };

const PATH = routes.doctor.aiAlerts;
const PAGE_SIZE = 8;
const FILTERS = ["new", "follow_up", "acknowledged", "dismissed", "all"] as const;
type AlertView = (typeof FILTERS)[number];

const SEGMENTS: { value: AlertView; label: string; icon: SegmentedLinkItem["icon"] }[] = [
    { value: "new", label: "New", icon: BellRing },
    { value: "follow_up", label: "Follow-up", icon: CalendarClock },
    { value: "acknowledged", label: "Acknowledged", icon: CircleCheck },
    { value: "dismissed", label: "Dismissed", icon: CircleX },
    { value: "all", label: "All", icon: Layers },
];

const EMPTY_COPY: Record<AlertView, { title: string; description: string }> = {
    new: {
        title: "No new observations to review",
        description: "You're up to date. New AI movement observations from analysed training footage appear here.",
    },
    follow_up: {
        title: "No observations awaiting follow-up",
        description: "Observations you mark for follow-up appear here until you record a new decision.",
    },
    acknowledged: { title: "No acknowledged observations", description: "Observations you acknowledge as clinically plausible appear here." },
    dismissed: { title: "No dismissed observations", description: "Observations you dismiss as not clinically relevant appear here." },
    all: {
        title: "No AI movement observations yet",
        description: "When the AI flags an unusual movement pattern in your fighters' footage, it appears here for review.",
    },
};

export default async function AIAlertsPage({ searchParams }: PageProps<"/doctor/ai-alerts">) {
    const user = await requireRole("doctor");
    const params = await searchParams;
    const now = new Date().toISOString();
    const scope = accessibleFighterIds(user);

    const view: AlertView = parseEnum(param(params.status), FILTERS) ?? "new";
    const [alerts, fighters, videos] = await Promise.all([listAlerts({ fighterIds: scope }), listFighters(user), listVideos({ fighterIds: scope })]);
    const fightersById = new Map(fighters.map((fighter) => [fighter.id, fighter]));
    const videosById = new Map(videos.map((video) => [video.id, video]));

    const visible = alerts.filter((alert) => fightersById.has(alert.fighterId));
    const count = (value: AlertView) =>
        value === "all" ? visible.length : visible.filter((alert) => alert.status === (value as AlertStatus)).length;
    const filtered = view === "all" ? visible : visible.filter((alert) => alert.status === view);
    const page = paginate(filtered, param(params.page), PAGE_SIZE);

    return (
        <>
            <PageHeader
                title="AI movement observations"
                description="Movement patterns the AI flagged in your fighters' training footage, compared with their own earlier footage. Review each one and record your clinical decision."
            />

            <div className="flex flex-col gap-5">
                <AINotice audience="doctor" />

                <SegmentedLinks
                    label="Filter observations by review status"
                    items={SEGMENTS.map((segment) => ({
                        href: hrefWith(PATH, {}, { status: segment.value === "new" ? null : segment.value }),
                        label: segment.label,
                        count: count(segment.value),
                        active: segment.value === view,
                        icon: segment.icon,
                    }))}
                />

                <section aria-label={`${SEGMENTS.find((segment) => segment.value === view)?.label ?? "All"} observations`}>
                    {page.total === 0 ? (
                        <EmptyState
                            icon={<Radar />}
                            title={EMPTY_COPY[view].title}
                            description={EMPTY_COPY[view].description}
                            action={
                                view !== "all" && visible.length > 0 ? (
                                    <ButtonLink href={hrefWith(PATH, {}, { status: "all" })} variant="secondary">
                                        View all observations
                                    </ButtonLink>
                                ) : undefined
                            }
                        />
                    ) : (
                        <div className="flex flex-col gap-4">
                            <ul className="flex flex-col gap-4">
                                {page.items.map((alert) => {
                                    const fighter = fightersById.get(alert.fighterId);
                                    const video = videosById.get(alert.videoId);
                                    if (!fighter) return null;
                                    return (
                                        <li key={alert.id} className="min-w-0">
                                            <ObservationCard
                                                alert={alert}
                                                fighter={fighter}
                                                source={video ? { trainingType: video.trainingType, uploadedAt: video.uploadedAt } : null}
                                                now={now}
                                            />
                                        </li>
                                    );
                                })}
                            </ul>
                            {page.pageCount > 1 && (
                                <div className="overflow-hidden rounded-xl border border-border bg-surface">
                                    <Pagination
                                        page={page.page}
                                        pageCount={page.pageCount}
                                        total={page.total}
                                        pageSize={page.pageSize}
                                        pathname={PATH}
                                        searchParams={params}
                                        itemLabel="observations"
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </section>
            </div>
        </>
    );
}
