import { ChartLine, Info } from "lucide-react";
import type { ReactNode } from "react";

import { AIGeneratedBadge } from "@/components/domain/status-badges";
import { Callout } from "@/components/training/callout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState, FeatureUnavailable } from "@/components/ui/states";
import { TECHNIQUES } from "@/lib/domain/labels";
import type { Technique } from "@/lib/domain/types";
import { formatDate } from "@/lib/format";
import { getTranslator } from "@/lib/i18n/server";
import { plural } from "@/lib/i18n/translate";
import { getPerformanceHistory, getPerformanceSummary } from "@/lib/services/performance";
import { platformFeatureAvailable } from "@/lib/services/platform-features";
import { PerformanceKpis } from "./performance-kpis";
import { COMPARISON_WEEKS, throughWeek, weekLabel } from "./performance-format";
import { ScoreInfo } from "./score-info";
import { TechniqueProfileCard } from "./technique-profile-card";
import { TechniqueScoresCard } from "./technique-scores-card";
import { TechniqueTrendsChart } from "./technique-trends-chart";
import { SpeedCard, StrikeVolumeCard, TrainingLoadCard } from "./weekly-charts";

/** Weeks of history shown in charts (complete weeks only). */
const CHART_WEEKS = 12;

export interface PerformanceOverviewProps {
    fighterId: string;
    fighterName: string;
    /** Who is reading: changes "you" vs the fighter's name in explanatory copy. */
    audience: "fighter" | "coach";
    /** Level of the card headings: 2 under a page h1, 3 under a tab's h2. */
    headingLevel?: 2 | 3;
    /** Links technique tiles and KPIs to a technique detail page, when the area has one. */
    techniqueHref?: (technique: Technique) => string;
    /** Next step offered when there is no performance data yet. */
    emptyAction?: ReactNode;
}

/**
 * The full performance picture for one fighter — KPIs, technique profile and scores, trends,
 * volume, speed and training load. Shared by the fighter's own page and the coach's fighter tab.
 */
export async function PerformanceOverview({ fighterId, fighterName, audience, headingLevel = 2, techniqueHref, emptyAction }: PerformanceOverviewProps) {
    const { t, locale } = await getTranslator();
    if (!platformFeatureAvailable("performance")) {
        return <FeatureUnavailable service="training" title={t("screens.performance.unavailable")} description={t("screens.performance.unavailableDesc")} />;
    }
    const [history, summary] = await Promise.all([getPerformanceHistory(fighterId, CHART_WEEKS + 1), getPerformanceSummary(fighterId)]);
    const heading = headingLevel === 2 ? "h2" : "h3";

    if (!summary || history.length === 0) {
        return (
            <EmptyState
                icon={<ChartLine />}
                title={t("screens.performance.overview.emptyTitle")}
                description={
                    audience === "fighter"
                        ? t("screens.performance.overview.emptyFighter")
                        : t("screens.performance.overview.emptyCoach", { name: fighterName })
                }
                action={emptyAction}
            />
        );
    }

    const weeks = throughWeek(history, summary.latest.weekStart).slice(-CHART_WEEKS);
    const labels = weeks.map((week) => weekLabel(week.weekStart, locale));
    const scores = Object.fromEntries(TECHNIQUES.map((technique) => [technique, weeks.map((week) => week.scores[technique])])) as Record<Technique, number[]>;
    const firstName = fighterName.split(" ")[0];
    const completeWeeks = plural(t, "screens.performance.completeWeeks", weeks.length);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-fg-muted">
                <span>
                    {t("screens.performance.weekOfPrefix")}
                    <time dateTime={summary.latest.weekStart}>{formatDate(summary.latest.weekStart, locale)}</time>
                    <span className="text-fg-subtle">{t("screens.performance.latestCompleteSuffix")}</span>
                </span>
                <span className="flex items-center gap-1">
                    <AIGeneratedBadge size="sm" label={t("screens.performance.aiScores")} />
                    <ScoreInfo />
                </span>
            </div>

            {summary.comparisonWeeks < COMPARISON_WEEKS && (
                <Callout
                    tone="info"
                    icon={Info}
                    title={summary.comparisonWeeks === 0 ? t("screens.performance.overview.earlyDays") : t("screens.performance.overview.settling")}
                >
                    {summary.comparisonWeeks === 0
                        ? audience === "fighter"
                            ? t("screens.performance.overview.earlyFighter", { weeks: completeWeeks })
                            : t("screens.performance.overview.earlyCoach", { name: firstName, weeks: completeWeeks })
                        : audience === "fighter"
                          ? t("screens.performance.overview.settlingFighter", { weeks: plural(t, "screens.performance.earlierWeeks", summary.comparisonWeeks) })
                          : t("screens.performance.overview.settlingCoach", {
                                name: firstName,
                                weeks: plural(t, "screens.performance.earlierWeeks", summary.comparisonWeeks),
                            })}
                </Callout>
            )}

            <PerformanceKpis summary={summary} techniqueHref={techniqueHref} locale={locale} />

            <TechniqueScoresCard summary={summary} weeks={weeks} heading={heading} techniqueHref={techniqueHref} locale={locale} />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <div className="min-w-0 lg:col-span-5">
                    <TechniqueProfileCard weeks={weeks} heading={heading} locale={locale} />
                </div>
                <Card className="min-w-0 lg:col-span-7">
                    <CardHeader
                        as={heading}
                        title={t("screens.performance.overview.trendsTitle")}
                        description={t("screens.performance.overview.trendsDesc", { weeks: completeWeeks })}
                    />
                    <CardContent>
                        {weeks.length < 2 ? (
                            <EmptyState
                                compact
                                title={t("screens.performance.overview.trendsEmptyTitle")}
                                description={t("screens.performance.overview.trendsEmptyDesc")}
                            />
                        ) : (
                            <TechniqueTrendsChart labels={labels} scores={scores} />
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
                <StrikeVolumeCard weeks={weeks} heading={heading} className="h-full" locale={locale} />
                <SpeedCard weeks={weeks} heading={heading} className="h-full" locale={locale} />
                <TrainingLoadCard weeks={weeks} heading={heading} className="h-full lg:col-span-2 xl:col-span-1" locale={locale} />
            </div>
        </div>
    );
}
