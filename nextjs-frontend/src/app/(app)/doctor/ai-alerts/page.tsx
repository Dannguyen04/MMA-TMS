import { BellRing, CalendarClock, CircleCheck, CircleX, Layers, Radar } from "lucide-react";
import type { Metadata } from "next";

import { ObservationCard } from "@/components/clinical/observation-card";
import { AINotice } from "@/components/domain/ai-notice";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { SegmentedLinks, type SegmentedLinkItem } from "@/components/ui/segmented-links";
import { EmptyState, FeatureUnavailable } from "@/components/ui/states";
import { Pagination } from "@/components/ui/table";
import { accessibleFighterIds } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import type { AlertStatus } from "@/lib/domain/types";
import { hrefWith, paginate, parseEnum } from "@/lib/query";
import { routes } from "@/lib/routes";
import { listAlerts } from "@/lib/services/ai";
import { medicalFeatureAvailable } from "@/lib/services/medical-features";
import { listFighters } from "@/lib/services/people";
import { listVideos } from "@/lib/services/videos";
import { param } from "@/lib/utils";

export const metadata: Metadata = { title: "Quan sát AI" };

const PATH = routes.doctor.aiAlerts;
const PAGE_SIZE = 8;
const FILTERS = ["new", "follow_up", "acknowledged", "dismissed", "all"] as const;
type AlertView = (typeof FILTERS)[number];

const SEGMENTS: { value: AlertView; label: string; icon: SegmentedLinkItem["icon"] }[] = [
    { value: "new", label: "Mới", icon: BellRing },
    { value: "follow_up", label: "Theo dõi", icon: CalendarClock },
    { value: "acknowledged", label: "Đã xác nhận", icon: CircleCheck },
    { value: "dismissed", label: "Đã bỏ qua", icon: CircleX },
    { value: "all", label: "Tất cả", icon: Layers },
];

const EMPTY_COPY: Record<AlertView, { title: string; description: string }> = {
    new: {
        title: "Không có quan sát mới cần xem",
        description: "Đã xem hết. Quan sát AI mới từ Video tập luyện sẽ hiện ở đây.",
    },
    follow_up: {
        title: "Không có quan sát chờ theo dõi",
        description: "Các quan sát cần theo dõi sẽ hiện ở đây đến khi bạn ghi quyết định mới.",
    },
    acknowledged: { title: "Chưa có quan sát đã xác nhận", description: "Các quan sát bạn xác nhận có ý nghĩa lâm sàng sẽ hiện ở đây." },
    dismissed: { title: "Chưa có quan sát bị bỏ qua", description: "Các quan sát bạn bỏ qua sẽ hiện ở đây." },
    all: {
        title: "Chưa có quan sát AI",
        description: "Khi AI phát hiện mẫu chuyển động bất thường trong Video tập luyện, quan sát sẽ hiện ở đây để xem xét.",
    },
};

export default async function AIAlertsPage({ searchParams }: PageProps<"/doctor/ai-alerts">) {
    const user = await requireRole("doctor");
    if (!medicalFeatureAvailable("aiObservations")) {
        return (
            <>
                <PageHeader title="Quan sát AI" />
                <FeatureUnavailable title="Quan sát AI chưa khả dụng" />
            </>
        );
    }
    const params = await searchParams;
    const now = new Date().toISOString();
    const scope = accessibleFighterIds(user);

    // Without review every observation stays new, so the review-status filter only applies where doctors can review.
    const reviews = medicalFeatureAvailable("aiObservationReview");
    const view: AlertView = reviews ? (parseEnum(param(params.status), FILTERS) ?? "new") : "all";
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
                title="Quan sát AI"
                description={`Mẫu chuyển động AI đánh dấu trong Video tập luyện, so với video trước của chính võ sĩ.${reviews ? " Xem từng quan sát và ghi quyết định lâm sàng." : ""}`}
            />

            <div className="flex flex-col gap-5">
                <AINotice audience="doctor" />

                {reviews && (
                    <SegmentedLinks
                        label="Lọc quan sát theo trạng thái"
                        items={SEGMENTS.map((segment) => ({
                            href: hrefWith(PATH, {}, { status: segment.value === "new" ? null : segment.value }),
                            label: segment.label,
                            count: count(segment.value),
                            active: segment.value === view,
                            icon: segment.icon,
                        }))}
                    />
                )}

                <section aria-label={`Quan sát: ${SEGMENTS.find((segment) => segment.value === view)?.label ?? "Tất cả"}`}>
                    {page.total === 0 ? (
                        <EmptyState
                            icon={<Radar />}
                            title={EMPTY_COPY[view].title}
                            description={EMPTY_COPY[view].description}
                            action={
                                view !== "all" && visible.length > 0 ? (
                                    <ButtonLink href={hrefWith(PATH, {}, { status: "all" })} variant="secondary">
                                        Xem mọi quan sát
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
                                        itemLabel="quan sát"
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
