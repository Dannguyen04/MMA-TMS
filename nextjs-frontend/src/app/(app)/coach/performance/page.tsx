import { CalendarCheck2, ChartLine, Clock, Gauge, SearchX, Target, TrendingUp, Users } from "lucide-react";
import type { Metadata } from "next";

import { scopedFighterIds } from "@/components/dashboard/roster-data";
import { AIGeneratedBadge } from "@/components/domain/status-badges";
import { changeDelta, percentChange, SCORE_NOISE_POINTS, weekLabel } from "@/components/performance/performance-format";
import { ScoreInfo } from "@/components/performance/score-info";
import { TeamHighlights, type TeamMember } from "@/components/performance/team-highlights";
import { TeamPerformanceTable, type TeamTableRow } from "@/components/performance/team-performance-table";
import { TeamVolumeCard } from "@/components/performance/team-volume-card";
import { PERFORMANCE_TRENDS, TREND_META, TREND_ORDER } from "@/components/performance/trend-badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { FilterBar } from "@/components/ui/filter-bar";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/states";
import { Pagination } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/session";
import { formatDate, formatNumber } from "@/lib/format";
import { matchesSearch, paginate, parseEnum, parseSortDirection, sortItems } from "@/lib/query";
import { routes } from "@/lib/routes";
import { listFighters } from "@/lib/services/people";
import { getPerformanceHistory, getPerformanceSummary, getTeamPerformance, getWeeklyVolume } from "@/lib/services/performance";
import { average, param } from "@/lib/utils";

export const metadata: Metadata = { title: "Team performance" };

const CHART_WEEKS = 12;
const PAGE_SIZE = 10;
const SORT_KEYS = ["fighter", "overall", "trend", "minutes", "sessions"] as const;
type SortKey = (typeof SORT_KEYS)[number];

export default async function CoachPerformancePage({ searchParams }: PageProps<"/coach/performance">) {
    const user = await requireRole("coach");
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
                <PageHeader title="Team performance" description="Technique scores, trends and training volume across your roster." />
                <EmptyState
                    icon={<ChartLine />}
                    title="No performance data for your roster yet"
                    description="Scores appear once your fighters' training videos are analysed and sessions are rated."
                    action={<ButtonLink href={routes.coach.uploadVideo}>Upload a training video</ButtonLink>}
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
                title="Team performance"
                description="Technique scores, trends and training volume across your roster."
                meta={
                    <>
                        {lastWeek && (
                            <span className="text-sm text-fg-muted">
                                Week of <time dateTime={lastWeek.weekStart}>{formatDate(lastWeek.weekStart)}</time>
                                <span className="text-fg-subtle"> · latest complete week</span>
                            </span>
                        )}
                        <span className="flex items-center gap-1">
                            <AIGeneratedBadge size="sm" label="AI-assisted scores" />
                            <ScoreInfo />
                        </span>
                    </>
                }
                actions={
                    <ButtonLink href={routes.coach.goals} variant="secondary">
                        <Target aria-hidden />
                        Goals
                    </ButtonLink>
                }
            />

            <div className="flex flex-col gap-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <StatCard
                        label="Team average score"
                        value={formatNumber(average(rows.map((row) => row.overall)), 1)}
                        unit="/ 100"
                        icon={<Gauge aria-hidden />}
                        delta={
                            compared.length > 0
                                ? changeDelta(average(compared.map((row) => row.overallDelta)), {
                                      decimals: 1,
                                      label: "vs 4-wk avg",
                                      neutralWithin: SCORE_NOISE_POINTS,
                                  })
                                : undefined
                        }
                    />
                    <StatCard
                        label={TREND_META.improving.label}
                        value={formatNumber(improving)}
                        unit={`of ${formatNumber(compared.length)}`}
                        icon={<TrendingUp aria-hidden />}
                        hint={`${compared.length - improving - declining} steady · ${declining} declining`}
                    />
                    <StatCard
                        label="Training minutes"
                        value={formatNumber(lastWeek?.trainingMinutes ?? 0)}
                        unit="min"
                        icon={<Clock aria-hidden />}
                        delta={minutesChange === null ? undefined : { ...changeDelta(minutesChange, { suffix: "%", label: "vs week before" }), sentiment: "neutral" }}
                    />
                    <StatCard
                        label="Sessions completed"
                        value={formatNumber(lastWeek?.sessionsCompleted ?? 0)}
                        icon={<CalendarCheck2 aria-hidden />}
                        hint={lastWeek && lastWeek.avgRpe > 0 ? `Average RPE ${formatNumber(lastWeek.avgRpe, 1)} · ${lastWeek.fighters} fighters` : undefined}
                    />
                </div>

                <TeamHighlights members={members} />

                <section aria-labelledby="roster-heading" className="flex flex-col gap-4">
                    <FilterBar
                        filters={[
                            { type: "search", name: "q", label: "Search fighters", placeholder: "Search fighters" },
                            {
                                type: "select",
                                name: "trend",
                                label: "Trend",
                                allLabel: "All trends",
                                options: PERFORMANCE_TRENDS.map((trend) => ({ value: trend, label: TREND_META[trend].label })),
                            },
                        ]}
                    />
                    <Card className="overflow-hidden">
                        <CardHeader
                            as="h2"
                            className="border-b border-border"
                            icon={<Users aria-hidden />}
                            title={<span id="roster-heading">Roster</span>}
                            description={
                                lastWeek
                                    ? `Scores and volume for the week of ${weekLabel(lastWeek.weekStart)} · change vs 4-week average`
                                    : "Latest complete week"
                            }
                        />
                        {page.total === 0 ? (
                            <EmptyState
                                compact
                                className="py-12"
                                icon={<SearchX />}
                                title="No fighters match these filters"
                                description="Try a different name or trend."
                                action={
                                    <ButtonLink href={pathname} variant="secondary" size="sm">
                                        Clear filters
                                    </ButtonLink>
                                }
                            />
                        ) : (
                            <>
                                <TeamPerformanceTable rows={page.items} pathname={pathname} searchParams={params} sort={sort} direction={direction} />
                                <Pagination
                                    page={page.page}
                                    pageCount={page.pageCount}
                                    total={page.total}
                                    pageSize={page.pageSize}
                                    pathname={pathname}
                                    searchParams={params}
                                    itemLabel="fighters"
                                />
                            </>
                        )}
                    </Card>
                </section>

                {volumeFighters.length > 0 && completeWeeks.length > 0 && (
                    <TeamVolumeCard fighters={volumeFighters} weekStarts={completeWeeks.map((week) => week.weekStart)} />
                )}
            </div>
        </>
    );
}
