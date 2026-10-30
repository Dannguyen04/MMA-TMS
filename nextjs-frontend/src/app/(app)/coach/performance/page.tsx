import { CalendarCheck2, ChartLine, Clock, Gauge, SearchX, TrendingUp, Users } from "lucide-react";
import type { Metadata } from "next";

import { scopedFighterIds } from "@/components/dashboard/roster-data";
import { AIGeneratedBadge } from "@/components/domain/status-badges";
import { changeDelta, percentChange, SCORE_NOISE_POINTS, weekLabel } from "@/components/performance/performance-format";
import { ScoreInfo } from "@/components/performance/score-info";
import { TeamHighlights, type TeamMember } from "@/components/performance/team-highlights";
import { TeamPerformanceTable, type TeamTableRow } from "@/components/performance/team-performance-table";
import { TeamVolumeCard } from "@/components/performance/team-volume-card";
import { PERFORMANCE_TRENDS, TREND_ORDER, trendLabel } from "@/components/performance/trend-badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState, FeatureUnavailable } from "@/components/ui/states";
import { Pagination } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/session";
import { formatDate, formatNumber } from "@/lib/format";
import { getTranslator } from "@/lib/i18n/server";
import { matchesSearch, paginate, parseEnum, parseSortDirection, sortItems } from "@/lib/query";
import { routes } from "@/lib/routes";
import { listFighters } from "@/lib/services/people";
import { getPerformanceHistory, getPerformanceSummary, getTeamPerformance, getWeeklyVolume } from "@/lib/services/performance";
import { platformFeatureAvailable } from "@/lib/services/platform-features";
import { average, param } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getTranslator();
    return { title: t("screens.performance.team.title") };
}

const CHART_WEEKS = 12;
const PAGE_SIZE = 10;
const SORT_KEYS = ["fighter", "overall", "trend", "minutes", "sessions"] as const;
type SortKey = (typeof SORT_KEYS)[number];

export default async function CoachPerformancePage({ searchParams }: PageProps<"/coach/performance">) {
    const user = await requireRole("coach");
    const { t, locale } = await getTranslator();
    if (!platformFeatureAvailable("performance")) {
        return (
            <>
                <PageHeader title={t("screens.performance.team.title")} />
                <FeatureUnavailable service="training" title={t("screens.performance.unavailable")} description={t("screens.performance.unavailableDesc")} />
            </>
        );
    }
    const params = await searchParams;
    const pathname = routes.coach.performance;

    // Scope ids don't wait for the fighter list, so every per-fighter read starts alongside it.
    const fighterList = listFighters(user);
    const idsRead = scopedFighterIds(user, fighterList);
    const [fighters, ids, teamRows, volume, summaries, histories] = await Promise.all([
        fighterList,
        idsRead,
        idsRead.then((scopeIds) => getTeamPerformance(scopeIds)),
        idsRead.then((scopeIds) => getWeeklyVolume(scopeIds, CHART_WEEKS + 1)),
        idsRead.then((scopeIds) => Promise.all(scopeIds.map((id) => getPerformanceSummary(id)))),
        idsRead.then((scopeIds) => Promise.all(scopeIds.map((id) => getPerformanceHistory(id, CHART_WEEKS + 1)))),
    ]);
    // Roster order (as assigned) keeps the table and volume columns stable.
    const fightersById = new Map(fighters.map((fighter) => [fighter.id, fighter]));
    const rosterIds = ids.filter((id) => fightersById.has(id));
    const summaryById = new Map(ids.map((id, index) => [id, summaries[index]]));
    const historyById = new Map(ids.map((id, index) => [id, histories[index]]));

    if (teamRows.length === 0) {
        return (
            <>
                <PageHeader title={t("screens.performance.team.title")} description={t("screens.performance.team.desc")} />
                <EmptyState
                    icon={<ChartLine />}
                    title={t("screens.performance.team.emptyTitle")}
                    description={t("screens.performance.team.emptyDesc")}
                    action={<ButtonLink href={routes.coach.uploadVideo}>{t("screens.performance.uploadVideo")}</ButtonLink>}
                />
            </>
        );
    }

    const members: TeamMember[] = rosterIds.flatMap((id) => {
        const fighter = fightersById.get(id);
        const summary = summaryById.get(id);
        return fighter && summary ? [{ fighter, summary }] : [];
    });

    const rows: TeamTableRow[] = teamRows.flatMap((row) => {
        const fighter = fightersById.get(row.fighterId);
        const summary = summaryById.get(row.fighterId);
        return fighter ? [{ ...row, fighter, hasComparison: (summary?.comparisonWeeks ?? 0) > 0 }] : [];
    });

    /* KPIs: latest complete week vs the week before. */
    const completeWeeks = volume.filter((week) => week.complete).slice(-CHART_WEEKS);
    const lastWeek = completeWeeks[completeWeeks.length - 1];
    const weekBefore = completeWeeks[completeWeeks.length - 2];
    const compared = rows.filter((row) => row.hasComparison);
    const improving = compared.filter((row) => row.trend === "improving").length;
    const declining = compared.filter((row) => row.trend === "declining").length;
    const minutesChange = lastWeek && weekBefore ? percentChange(lastWeek.trainingMinutes, weekBefore.trainingMinutes) : null;

    /* Table: filter, sort, paginate. */
    const search = param(params.q);
    const trendFilter = parseEnum(param(params.trend), PERFORMANCE_TRENDS);
    const sort: SortKey = parseEnum(param(params.sort), SORT_KEYS) ?? "overall";
    const direction = parseSortDirection(param(params.dir), param(params.sort) ? "asc" : "desc");
    const filtered = rows.filter(
        (row) => matchesSearch(search, row.fighter.name, row.fighter.nickname) && (!trendFilter || (row.hasComparison && row.trend === trendFilter)),
    );
    const accessor = (row: TeamTableRow): string | number => {
        if (sort === "fighter") return row.fighter.name;
        if (sort === "overall") return row.overall;
        if (sort === "trend") return TREND_ORDER[row.trend];
        if (sort === "minutes") return row.trainingMinutes;
        return row.sessionsCompleted;
    };
    const page = paginate(sortItems(filtered, accessor, direction), param(params.page), PAGE_SIZE);

    const volumeFighters = rosterIds.flatMap((id) => {
        const fighter = fightersById.get(id);
        const history = historyById.get(id) ?? [];
        return fighter && history.length > 0 ? [{ id, name: fighter.name, history }] : [];
    });

    return (
        <>
            <PageHeader
                title={t("screens.performance.team.title")}
                description={t("screens.performance.team.desc")}
                meta={
                    <>
                        {lastWeek && (
                            <span className="text-sm text-fg-muted">
                                {t("screens.performance.weekOfPrefix")}
                                <time dateTime={lastWeek.weekStart}>{formatDate(lastWeek.weekStart, locale)}</time>
                                <span className="text-fg-subtle">{t("screens.performance.latestCompleteSuffix")}</span>
                            </span>
                        )}
                        <span className="flex items-center gap-1">
                            <AIGeneratedBadge size="sm" label={t("screens.performance.aiScores")} />
                            <ScoreInfo />
                        </span>
                    </>
                }
            />

            <div className="flex flex-col gap-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard
                        label={t("screens.performance.team.avgScore")}
                        value={formatNumber(average(rows.map((row) => row.overall)), 1)}
                        unit="/ 100"
                        icon={<Gauge aria-hidden />}
                        delta={
                            compared.length > 0
                                ? changeDelta(average(compared.map((row) => row.overallDelta)), {
                                      decimals: 1,
                                      label: t("screens.performance.compare.4wk"),
                                      neutralWithin: SCORE_NOISE_POINTS,
                                  })
                                : undefined
                        }
                        locale={locale}
                    />
                    <StatCard
                        label={trendLabel("improving", locale)}
                        value={formatNumber(improving)}
                        unit={t("screens.performance.ofN", { n: formatNumber(compared.length) })}
                        icon={<TrendingUp aria-hidden />}
                        hint={t("screens.performance.team.steadyDeclining", { steady: compared.length - improving - declining, declining })}
                        locale={locale}
                    />
                    <StatCard
                        label={t("screens.performance.trainingMinutes")}
                        value={formatNumber(lastWeek?.trainingMinutes ?? 0)}
                        unit="min"
                        icon={<Clock aria-hidden />}
                        delta={
                            minutesChange === null
                                ? undefined
                                : { ...changeDelta(minutesChange, { suffix: "%", label: t("screens.performance.compare.weekBefore") }), sentiment: "neutral" }
                        }
                        locale={locale}
                    />
                    <StatCard
                        label={t("screens.performance.team.sessionsCompleted")}
                        value={formatNumber(lastWeek?.sessionsCompleted ?? 0)}
                        icon={<CalendarCheck2 aria-hidden />}
                        hint={
                            lastWeek && lastWeek.avgRpe > 0
                                ? t("screens.performance.team.rpeHint", { rpe: formatNumber(lastWeek.avgRpe, 1), n: lastWeek.fighters })
                                : undefined
                        }
                        locale={locale}
                    />
                </div>

                <TeamHighlights members={members} locale={locale} />

                <section aria-labelledby="roster-heading" className="flex flex-col gap-4">
                    <FilterBar
                        filters={[
                            { type: "search", name: "q", label: t("screens.performance.team.search"), placeholder: t("screens.performance.team.search") },
                            {
                                type: "select",
                                name: "trend",
                                label: t("screens.performance.trend"),
                                allLabel: t("screens.performance.team.allTrends"),
                                options: PERFORMANCE_TRENDS.map((trend) => ({ value: trend, label: trendLabel(trend, locale) })),
                            },
                        ]}
                    />
                    <Card className="overflow-hidden">
                        <CardHeader
                            as="h2"
                            className="border-b border-border"
                            icon={<Users aria-hidden />}
                            title={<span id="roster-heading">{t("screens.performance.team.roster")}</span>}
                            description={
                                lastWeek
                                    ? t("screens.performance.team.rosterDesc", { week: weekLabel(lastWeek.weekStart, locale) })
                                    : t("screens.performance.latestCompleteWeek")
                            }
                        />
                        {page.total === 0 ? (
                            <EmptyState
                                compact
                                className="py-12"
                                icon={<SearchX />}
                                title={t("screens.performance.team.noMatch")}
                                description={t("screens.performance.team.noMatchDesc")}
                                action={
                                    <ButtonLink href={pathname} variant="secondary" size="sm">
                                        {t("screens.performance.clearFilters")}
                                    </ButtonLink>
                                }
                            />
                        ) : (
                            <>
                                <TeamPerformanceTable rows={page.items} pathname={pathname} searchParams={params} sort={sort} direction={direction} locale={locale} />
                                <Pagination
                                    page={page.page}
                                    pageCount={page.pageCount}
                                    total={page.total}
                                    pageSize={page.pageSize}
                                    pathname={pathname}
                                    searchParams={params}
                                    itemLabel={t("screens.performance.team.itemLabel")}
                                    locale={locale}
                                />
                            </>
                        )}
                    </Card>
                </section>

                {volumeFighters.length > 0 && completeWeeks.length > 0 && (
                    <TeamVolumeCard fighters={volumeFighters} weekStarts={completeWeeks.map((week) => week.weekStart)} locale={locale} />
                )}
            </div>
        </>
    );
}
