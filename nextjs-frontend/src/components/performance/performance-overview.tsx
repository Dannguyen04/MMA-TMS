import { ChartLine, Info } from "lucide-react";
import type { ReactNode } from "react";

import { AIGeneratedBadge } from "@/components/domain/status-badges";
import { Callout } from "@/components/training/callout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { TECHNIQUES } from "@/lib/domain/labels";
import type { Technique } from "@/lib/domain/types";
import { formatDate, pluralize } from "@/lib/format";
import { getPerformanceHistory, getPerformanceSummary } from "@/lib/services/performance";
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
    const [history, summary] = await Promise.all([getPerformanceHistory(fighterId, CHART_WEEKS + 1), getPerformanceSummary(fighterId)]);
    const heading = headingLevel === 2 ? "h2" : "h3";

    if (!summary || history.length === 0) {
        return (
            <EmptyState
                icon={<ChartLine />}
                title="No performance data yet"
                description={
                    audience === "fighter"
                        ? "Scores appear after your first analysed training videos and coach-rated sessions."
                        : `Scores appear after ${fighterName}'s first analysed training videos and coach-rated sessions.`
                }
                action={emptyAction}
            />
        );
    }

    const weeks = throughWeek(history, summary.latest.weekStart).slice(-CHART_WEEKS);
    const labels = weeks.map((week) => weekLabel(week.weekStart));
    const scores = Object.fromEntries(TECHNIQUES.map((t) => [t, weeks.map((week) => week.scores[t])])) as Record<Technique, number[]>;
    const subject = audience === "fighter" ? "You have" : `${fighterName.split(" ")[0]} has`;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-fg-muted">
                <span>
                    Week of <time dateTime={summary.latest.weekStart}>{formatDate(summary.latest.weekStart)}</time>
                    <span className="text-fg-subtle"> · latest complete week</span>
                </span>
                <span className="flex items-center gap-1">
                    <AIGeneratedBadge size="sm" label="AI-assisted scores" />
                    <ScoreInfo />
                </span>
            </div>

            {summary.comparisonWeeks < COMPARISON_WEEKS && (
                <Callout tone="info" icon={Info} title={summary.comparisonWeeks === 0 ? "Early days" : "Comparisons are still settling"}>
                    {summary.comparisonWeeks === 0
                        ? `${subject} ${pluralize(weeks.length, "complete week")} of data so far. Changes, trends and the 4-week comparison appear as more weeks are completed — the current week is added once it ends.`
                        : `${subject} ${pluralize(summary.comparisonWeeks, "earlier week")} to compare with, so changes use a shorter average until 4 weeks are available.`}
                </Callout>
            )}

            <PerformanceKpis summary={summary} techniqueHref={techniqueHref} />

            <TechniqueScoresCard summary={summary} weeks={weeks} heading={heading} techniqueHref={techniqueHref} />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <div className="min-w-0 lg:col-span-5">
                    <TechniqueProfileCard weeks={weeks} heading={heading} />
                </div>
                <Card className="min-w-0 lg:col-span-7">
                    <CardHeader as={heading} title="Technique trends" description={`Weekly scores · ${pluralize(weeks.length, "complete week")}`} />
                    <CardContent>
                        {weeks.length < 2 ? (
                            <EmptyState compact title="Trends appear after 2 complete weeks" description="Each technique's weekly score will be charted here." />
                        ) : (
                            <TechniqueTrendsChart labels={labels} scores={scores} />
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
                <StrikeVolumeCard weeks={weeks} heading={heading} className="h-full" />
                <SpeedCard weeks={weeks} heading={heading} className="h-full" />
                <TrainingLoadCard weeks={weeks} heading={heading} className="h-full lg:col-span-2 xl:col-span-1" />
            </div>
        </div>
    );
}
