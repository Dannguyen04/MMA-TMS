import { Ban, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { GradedReturnSteps } from "@/components/domain/graded-return-steps";
import { IntensityLadder } from "@/components/domain/intensity-ladder";
import { SuspensionStatusBadge } from "@/components/domain/status-badges";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress";
import { SegmentedLinks, type SegmentedLinkItem } from "@/components/ui/segmented-links";
import { EmptyState } from "@/components/ui/states";
import { accessibleFighterIds } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { academyDateOf, daysBetweenDates, suspensionReasonLabel } from "@/lib/domain/suspension-rules";
import type { Bout, Suspension } from "@/lib/domain/types";
import { formatShortDate } from "@/lib/format";
import { getTranslator } from "@/lib/i18n/server";
import { plural, type MessageKey } from "@/lib/i18n/translate";
import { routes } from "@/lib/routes";
import { listBouts } from "@/lib/services/bouts";
import { listFighters } from "@/lib/services/people";
import { listSuspensions } from "@/lib/services/suspensions";
import { param } from "@/lib/utils";
import { ClearSuspensionButton } from "./clear-suspension-button";
import { CreateSuspensionTrigger } from "./create-suspension-trigger";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: `${t("suspensions.title")} · ${t("nav.Bouts")}` };
}

const FILTERS = {
    ALL: { labelKey: "suspensions.filter.all", matches: () => true },
    ACTIVE: { labelKey: "suspensions.filter.active", matches: (s: Suspension) => s.status === "ACTIVE" },
    AWAITING_CLEARANCE: { labelKey: "suspensions.filter.awaitingClearance", matches: (s: Suspension) => s.status === "AWAITING_CLEARANCE" },
    GRADED_RETURN: { labelKey: "suspensions.filter.gradedReturn", matches: (s: Suspension) => s.gradedReturn !== null && s.gradedReturn !== undefined },
    ENDED: { labelKey: "suspensions.filter.ended", matches: (s: Suspension) => s.status === "ENDED" && !s.gradedReturn },
} as const satisfies Record<string, { labelKey: MessageKey; matches: (s: Suspension) => boolean }>;

export default async function CoachSuspensionsPage({
    searchParams,
}: PageProps<"/coach/bouts/suspensions">) {
    const user = await requireRole("coach");
    const params = await searchParams;
    const rawStatus = param(params.status);
    const statusFilter = rawStatus && Object.hasOwn(FILTERS, rawStatus) ? (rawStatus as keyof typeof FILTERS) : "ALL";

    const [suspensions, fighters, bouts, { t, locale }] = await Promise.all([
        listSuspensions({}, user),
        listFighters(user),
        listBouts({ fighterIds: accessibleFighterIds(user) }),
        getTranslator(),
    ]);

    const todayKey = academyDateOf(new Date());
    const fightersById = new Map(fighters.map((f) => [f.id, f]));
    const boutsById = new Map<string, Bout>();
    for (const b of bouts) boutsById.set(b.id, b);

    const filterItems: SegmentedLinkItem[] = Object.entries(FILTERS).map(([status, { labelKey, matches }]) => ({
        href: status === "ALL" ? routes.coach.suspensions : `${routes.coach.suspensions}?status=${status}`,
        label: t(labelKey),
        count: suspensions.filter(matches).length,
        active: statusFilter === status,
    }));
    const filteredSuspensions = suspensions.filter(FILTERS[statusFilter].matches);

    const fighterOptions = fighters.map((f) => ({ id: f.id, name: f.name }));

    const newSuspensionButton = (
        <CreateSuspensionTrigger
            fighters={fighterOptions}
            locale={locale}
            todayKey={todayKey}
        />
    );

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title={t("suspensions.title")}
                description={plural(t, "suspensions.activeCount", suspensions.filter(FILTERS.ACTIVE.matches).length)}
                actions={newSuspensionButton}
            />

            {/* Hàng lọc có số đếm */}
            <SegmentedLinks
                label={t("suspensions.filter.navLabel")}
                items={filterItems}
            />

            {filteredSuspensions.length === 0 ? (
                <EmptyState
                    icon={<Ban className="size-6 text-fg-muted" />}
                    title={t("suspensions.emptyTitle")}
                    description={t("suspensions.emptyDescription")}
                    action={newSuspensionButton}
                />
            ) : (
                <Card className="divide-y divide-border overflow-hidden">
                    {filteredSuspensions.map((suspension) => {
                        const fighter = fightersById.get(suspension.fighterId);
                        const bout = suspension.boutId ? boutsById.get(suspension.boutId) : null;
                        const isActive = suspension.status === "ACTIVE";
                        const isEndedNoGraded =
                            suspension.status === "ENDED" && !suspension.gradedReturn;

                        const totalDays = Math.max(
                            1,
                            daysBetweenDates(suspension.startsOn, suspension.endsOn) + 1,
                        );
                        const daysPassed = Math.max(
                            1,
                            Math.min(
                                totalDays,
                                daysBetweenDates(suspension.startsOn, todayKey) + 1,
                            ),
                        );
                        const progressText = t("suspensions.row.dayProgress", {
                            elapsed: daysPassed,
                            total: totalDays,
                        });

                        return (
                            <div
                                key={suspension.id}
                                className="flex flex-col gap-4 p-4 hover:bg-surface-muted/20 transition-colors sm:p-5"
                            >
                                <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto] items-start lg:items-center gap-4">
                                    {/* Col 1: Avatar, Name, Reason, Bout, Dates & Progress */}
                                    <div className="flex items-start gap-3.5 min-w-0">
                                        <Avatar
                                            name={fighter?.name ?? t("coachBouts.unknownFighter")}
                                            shape="octagon"
                                            size="md"
                                        />
                                        <div className="flex flex-col gap-1 min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                {fighter ? (
                                                    <Link
                                                        href={routes.coach.fighter(fighter.id)}
                                                        className="font-semibold text-fg text-[15px] hover:text-primary hover:underline truncate"
                                                    >
                                                        {fighter.name}
                                                    </Link>
                                                ) : (
                                                    <span className="font-semibold text-fg text-[15px] truncate">
                                                        {t("coachBouts.unknownFighter")}
                                                    </span>
                                                )}
                                                <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium bg-surface-muted text-fg-muted border border-border">
                                                    {suspensionReasonLabel(suspension.reason, t)}
                                                </span>
                                                {bout && (
                                                    <>
                                                        <span
                                                            className="hidden sm:inline text-xs text-fg-subtle"
                                                            aria-hidden="true"
                                                        >
                                                            ·
                                                        </span>
                                                        <span className="text-xs text-fg-muted truncate">
                                                            {bout.eventName}
                                                        </span>
                                                    </>
                                                )}
                                            </div>

                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
                                                <span className="tabular-nums">
                                                    {formatShortDate(suspension.startsOn, locale)} –{" "}
                                                    {formatShortDate(suspension.endsOn, locale)}
                                                </span>
                                                {isActive && (
                                                    <ProgressBar
                                                        value={daysPassed}
                                                        max={totalDays}
                                                        tone="danger"
                                                        size="sm"
                                                        label={progressText}
                                                        showLabel={false}
                                                        hideValue={true}
                                                        valueText={progressText}
                                                        className="w-24 sm:w-32"
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Col 2: Intensity Ladder or normal training message */}
                                    <div className="shrink-0">
                                        {isEndedNoGraded ? (
                                            <span className="text-xs text-fg-muted italic">
                                                {t("suspensions.row.endedNormalTraining")}
                                            </span>
                                        ) : (
                                            <>
                                                <div className="sm:hidden w-28">
                                                    <IntensityLadder
                                                        maxAllowedTier={
                                                            suspension.gradedReturn ? 5 : suspension.maxAllowedTier
                                                        }
                                                        ceiling={suspension.gradedReturn?.ceiling}
                                                        size="sm"
                                                        locale={locale}
                                                    />
                                                </div>
                                                <div className="hidden sm:block w-40">
                                                    <IntensityLadder
                                                        maxAllowedTier={
                                                            suspension.gradedReturn ? 5 : suspension.maxAllowedTier
                                                        }
                                                        ceiling={suspension.gradedReturn?.ceiling}
                                                        size="md"
                                                        locale={locale}
                                                    />
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* Col 3: Status badge & Actions */}
                                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 shrink-0 lg:justify-end">
                                        <SuspensionStatusBadge
                                            status={
                                                suspension.gradedReturn
                                                    ? "GRADED_RETURN"
                                                    : suspension.status
                                            }
                                            startsOn={suspension.startsOn}
                                            endsOn={suspension.endsOn}
                                            today={todayKey}
                                            ceiling={suspension.gradedReturn?.ceiling}
                                            locale={locale}
                                        />

                                        <div className="flex items-center gap-2">
                                            {suspension.status === "AWAITING_CLEARANCE" && (
                                                <ClearSuspensionButton
                                                    suspension={suspension}
                                                    fighterName={fighter?.name}
                                                />
                                            )}
                                            <Link
                                                href={`${routes.coach.sessions}?fighter=${suspension.fighterId}`}
                                                className="text-xs font-medium text-primary hover:underline px-2 py-1"
                                            >
                                                {t("suspensions.row.viewSchedule")}
                                            </Link>
                                        </div>
                                    </div>
                                </div>

                                {/* Graded return steps if in graded return */}
                                {suspension.gradedReturn && (
                                    <div className="mt-1 pt-3 border-t border-border/50">
                                        <GradedReturnSteps
                                            gradedReturn={suspension.gradedReturn}
                                            locale={locale}
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </Card>
            )}

            {/* Dòng chú thích nhỏ phân biệt hai khái niệm */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-surface-muted/30 px-4 py-3 text-xs text-fg-muted">
                <div className="flex items-center gap-2 min-w-0">
                    <ShieldAlert aria-hidden className="size-4 shrink-0 text-fg-subtle" />
                    <span>{t("suspensions.distinctionNotice")}</span>
                </div>
                <Link
                    href={routes.coach.clearance}
                    className="font-medium text-primary hover:underline shrink-0"
                >
                    {t("suspensions.goToClearance")} →
                </Link>
            </div>
        </div>
    );
}
