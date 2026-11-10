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
import { getTranslator } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { hrefWith, paginate, parseEnum } from "@/lib/query";
import { routes } from "@/lib/routes";
import { listAlerts } from "@/lib/services/ai";
import { medicalFeatureAvailable } from "@/lib/services/medical-features";
import { listFighters } from "@/lib/services/people";
import { listVideos } from "@/lib/services/videos";
import { param } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("doctorPages.meta.aiAlerts") };
}

const PATH = routes.doctor.aiAlerts;
const PAGE_SIZE = 8;
const FILTERS = ["new", "follow_up", "acknowledged", "dismissed", "all"] as const;
type AlertView = (typeof FILTERS)[number];

const SEGMENTS: { value: AlertView; label: MessageKey; icon: SegmentedLinkItem["icon"] }[] = [
    { value: "new", label: "doctorPages.alerts.seg.new", icon: BellRing },
    { value: "follow_up", label: "doctorPages.alerts.seg.follow_up", icon: CalendarClock },
    { value: "acknowledged", label: "doctorPages.alerts.seg.acknowledged", icon: CircleCheck },
    { value: "dismissed", label: "doctorPages.alerts.seg.dismissed", icon: CircleX },
    { value: "all", label: "doctorPages.alerts.seg.all", icon: Layers },
];

const EMPTY_COPY: Record<AlertView, { title: MessageKey; description: MessageKey }> = {
    new: { title: "doctorPages.alerts.empty.new.title", description: "doctorPages.alerts.empty.new.description" },
    follow_up: { title: "doctorPages.alerts.empty.follow_up.title", description: "doctorPages.alerts.empty.follow_up.description" },
    acknowledged: { title: "doctorPages.alerts.empty.acknowledged.title", description: "doctorPages.alerts.empty.acknowledged.description" },
    dismissed: { title: "doctorPages.alerts.empty.dismissed.title", description: "doctorPages.alerts.empty.dismissed.description" },
    all: { title: "doctorPages.alerts.empty.all.title", description: "doctorPages.alerts.empty.all.description" },
};

export default async function AIAlertsPage({ searchParams }: PageProps<"/doctor/ai-alerts">) {
    const user = await requireRole("doctor");
    const { t, locale } = await getTranslator();
    if (!medicalFeatureAvailable("aiObservations")) {
        return (
            <>
                <PageHeader title={t("doctorPages.meta.aiAlerts")} />
                <FeatureUnavailable title={t("doctorPages.alerts.unavailable")} description={t("doctorPages.featureUnavailable")} />
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
                title={t("doctorPages.meta.aiAlerts")}
                description={`${t("doctorPages.alerts.description")}${reviews ? t("doctorPages.alerts.descriptionReview") : ""}`}
            />

            <div className="flex flex-col gap-5">
                {/* Without a locale the notice keeps its Vietnamese wording; the dictionary words it differently. */}
                <AINotice audience="doctor" locale={locale === "vi" ? undefined : locale} />

                {reviews && (
                    <SegmentedLinks
                        label={t("doctorPages.alerts.filterLabel")}
                        items={SEGMENTS.map((segment) => ({
                            href: hrefWith(PATH, {}, { status: segment.value === "new" ? null : segment.value }),
                            label: t(segment.label),
                            count: count(segment.value),
                            active: segment.value === view,
                            icon: segment.icon,
                        }))}
                    />
                )}

                <section aria-label={t("doctorPages.alerts.sectionAria", { label: t(SEGMENTS.find((segment) => segment.value === view)?.label ?? "doctorPages.alerts.seg.all") })}>
                    {page.total === 0 ? (
                        <EmptyState
                            icon={<Radar />}
                            title={t(EMPTY_COPY[view].title)}
                            description={t(EMPTY_COPY[view].description)}
                            action={
                                view !== "all" && visible.length > 0 ? (
                                    <ButtonLink href={hrefWith(PATH, {}, { status: "all" })} variant="secondary">
                                        {t("doctorPages.alerts.viewAll")}
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
                                        itemLabel={t("doctorPages.alerts.itemLabel")}
                                        locale={locale}
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
