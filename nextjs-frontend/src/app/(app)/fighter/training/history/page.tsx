import { CalendarCheck2, CalendarX2, Gauge, History, Timer } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard, type StatDelta } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/states";
import { Pagination } from "@/components/ui/table";
import { SessionTable } from "@/components/training/session-table";
import { MinutesChart } from "@/components/training/training-charts";
import { SESSION_SORT_KEYS, fromTrainingProgress, rpeLabel, sessionMinutes, sortSessions, withinDayRange } from "@/components/training/training-utils";
import { requireFighterAccess } from "@/lib/auth/access";
import { requireRole } from "@/lib/auth/session";
import { sessionStatusLabel, trainingTypeLabel } from "@/lib/domain/labels";
import type { SessionStatus, TrainingSession, TrainingType } from "@/lib/domain/types";
import { dayKey, formatDelta, formatMinutes, formatNumber } from "@/lib/format";
import { getTranslator } from "@/lib/i18n/server";
import { paginate, parseEnum, parseSortDirection } from "@/lib/query";
import { routes } from "@/lib/routes";
import { getSessionHistory, getTrainingProgress } from "@/lib/services/training";
import { average, param, sum } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("training.fighterHistory.title") };
}

const DAY_MS = 86_400_000;
const WINDOW_DAYS = 30;
const HISTORY_STATUSES: SessionStatus[] = ["completed", "missed", "cancelled"];
const TRAINING_TYPES: TrainingType[] = ["sparring", "pad_work", "bag_work", "grappling", "wrestling", "bjj", "clinch", "strength_conditioning", "mobility", "recovery", "film_study"];

interface WindowStats {
    completed: number;
    missed: number;
    minutes: number;
    avgRpe: number | null;
}

function windowStats(sessions: TrainingSession[]): WindowStats {
    const completed = sessions.filter((s) => s.status === "completed");
    const rpes = completed.flatMap((s) => (s.result?.rpe != null ? [s.result.rpe] : []));
    return {
        completed: completed.length,
        missed: sessions.filter((s) => s.status === "missed").length,
        minutes: sum(completed.map(sessionMinutes)),
        avgRpe: rpes.length > 0 ? average(rpes) : null,
    };
}

function countDelta(current: number, previous: number, higherIsBetter: boolean, label: string): StatDelta {
    const diff = current - previous;
    return {
        value: formatDelta(diff),
        direction: diff > 0 ? "up" : diff < 0 ? "down" : "flat",
        sentiment: diff === 0 ? "neutral" : diff > 0 === higherIsBetter ? "good" : "bad",
        label,
    };
}

function minutesDelta(current: number, previous: number, label: string): StatDelta {
    const diff = current - previous;
    return {
        value: diff === 0 ? "0" : `${diff > 0 ? "+" : "−"}${formatMinutes(Math.abs(diff))}`,
        direction: diff > 0 ? "up" : diff < 0 ? "down" : "flat",
        sentiment: "neutral",
        label,
    };
}

export default async function FighterHistoryPage({ searchParams }: PageProps<"/fighter/training/history">) {
    const { t, locale } = await getTranslator();
    const user = await requireRole("fighter");
    if (!user.profileId) notFound();
    const fighter = await requireFighterAccess(user, user.profileId);
    const params = await searchParams;

    const nowMs = new Date().getTime();
    const [history, progress] = await Promise.all([getSessionHistory(fighter.id), getTrainingProgress(fighter.id, 8)]);

    const windowStart = new Date(nowMs - WINDOW_DAYS * DAY_MS).toISOString();
    const previousStart = new Date(nowMs - 2 * WINDOW_DAYS * DAY_MS).toISOString();
    const current = windowStats(history.filter((s) => s.scheduledAt >= windowStart));
    const previous = windowStats(history.filter((s) => s.scheduledAt >= previousStart && s.scheduledAt < windowStart));

    const type = parseEnum(param(params.type), TRAINING_TYPES);
    const status = parseEnum(param(params.status), HISTORY_STATUSES);
    const from = param(params.from);
    const to = param(params.to);
    const sort = parseEnum(param(params.sort), SESSION_SORT_KEYS) ?? "date";
    const dir = parseSortDirection(param(params.dir), param(params.sort) ? "asc" : "desc");
    const hasFilters = Boolean(type || status || from || to);

    const filtered = history.filter(
        (s) => (!type || s.type === type) && (!status || s.status === status) && withinDayRange(dayKey(s.scheduledAt), from, to),
    );
    const page = paginate(sortSessions(filtered, sort, dir), param(params.page), 10);
    const pathname = routes.fighter.history;

    return (
        <>
            <PageHeader
                title={t("training.fighterHistory.title")}
                description={t("training.fighterHistory.description")}
            />

            <div className="flex flex-col gap-6">
                <section aria-labelledby="last-30-heading">
                    <h2 id="last-30-heading" className="sr-only">
                        {t("training.fighterHistory.statCompleted")}
                    </h2>
                    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                        <StatCard
                            label={t("training.fighterHistory.statCompleted")}
                            value={current.completed}
                            unit={t("training.fighterHistory.unitSessions")}
                            icon={<CalendarCheck2 />}
                            delta={countDelta(current.completed, previous.completed, true, t("training.fighterHistory.deltaVsPrev"))}
                        />
                        <StatCard
                            label={t("training.fighterHistory.statMissed")}
                            value={current.missed}
                            unit={t("training.fighterHistory.unitSessions")}
                            icon={<CalendarX2 />}
                            delta={countDelta(current.missed, previous.missed, false, t("training.fighterHistory.deltaVsPrev"))}
                        />
                        <StatCard
                            label={t("training.fighterHistory.statTime")}
                            value={formatMinutes(current.minutes)}
                            icon={<Timer />}
                            delta={minutesDelta(current.minutes, previous.minutes, t("training.fighterHistory.deltaVsPrev"))}
                        />
                        <StatCard
                            label={t("training.fighterHistory.statAvgRpe")}
                            value={current.avgRpe === null ? "—" : formatNumber(current.avgRpe, 1)}
                            icon={<Gauge />}
                            hint={current.avgRpe === null ? t("training.fighterHistory.noCompletedSessions") : rpeLabel(current.avgRpe)}
                        />
                    </div>
                </section>

                <MinutesChart weeks={fromTrainingProgress(progress)} />

                <Card className="overflow-hidden">
                    <CardHeader
                        title={t("training.fighterHistory.pastSessions")}
                        description={hasFilters ? t("training.fighterHistory.matchingSessions", { matching: filtered.length, total: history.length }) : t("training.fighterHistory.sessionsCount", { total: history.length })}
                        icon={<History />}
                    />
                    <div className="px-5 pb-4">
                        <FilterBar
                            filters={[
                                { type: "select", name: "type", label: t("training.fighterHistory.filterTypes"), options: TRAINING_TYPES.map((value) => ({ value, label: trainingTypeLabel(t, value) })) },
                                {
                                    type: "select",
                                    name: "status",
                                    label: t("training.fighterHistory.filterStatuses"),
                                    options: HISTORY_STATUSES.map((value) => ({ value, label: sessionStatusLabel(t, value) })),
                                },
                                { type: "date", name: "from", label: t("training.fighterHistory.filterFrom") },
                                { type: "date", name: "to", label: t("training.fighterHistory.filterTo") },
                            ]}
                        />
                    </div>
                    {page.total === 0 ? (
                        <div className="border-t border-border px-5 py-6">
                            {hasFilters ? (
                                <EmptyState
                                    compact
                                    title={t("training.fighterHistory.noMatchingTitle")}
                                    description={t("training.fighterHistory.noMatchingDesc")}
                                    action={
                                        <ButtonLink href={pathname} variant="secondary" size="sm">
                                            {t("training.fighterHistory.clearFilters")}
                                        </ButtonLink>
                                    }
                                />
                            ) : (
                                <EmptyState
                                    compact
                                    icon={<History />}
                                    title={t("training.fighterHistory.noPastTitle")}
                                    description={t("training.fighterHistory.noPastDesc")}
                                    action={
                                        <ButtonLink href={routes.fighter.schedule} variant="secondary" size="sm">
                                            {t("training.fighterTraining.viewSchedule")}
                                        </ButtonLink>
                                    }
                                />
                            )}
                        </div>
                    ) : (
                        <div className="border-t border-border">
                            <SessionTable
                                locale={locale}
                                sessions={page.items}
                                audience="fighter"
                                caption={t("training.fighterHistory.pastSessionsCaption")}
                                showVideo
                                stackOnMobile
                                sort={{ pathname, searchParams: params, sort, dir }}
                            />
                            <Pagination
                                page={page.page}
                                pageCount={page.pageCount}
                                total={page.total}
                                pageSize={page.pageSize}
                                pathname={pathname}
                                searchParams={params}
                                itemLabel={t("training.fighterHistory.itemLabel")}
                            />
                        </div>
                    )}
                </Card>
            </div>
        </>
    );
}
