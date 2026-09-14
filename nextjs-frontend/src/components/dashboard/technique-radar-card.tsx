import { Radar } from "lucide-react";

import { ChartFigure } from "@/components/charts/chart-figure";
import { CHART_MUTED, CHART_SERIES } from "@/components/charts/colors";
import { RadarChart, type RadarSeries } from "@/components/charts/radar-chart";
import { MetricTile } from "@/components/domain/metric-tile";
import { COMPARISON_WEEKS, scoreDelta, weekLabel } from "@/components/performance/performance-format";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { TECHNIQUE_LABELS, TECHNIQUES } from "@/lib/domain/labels";
import type { PerformanceMetric } from "@/lib/domain/types";
import { formatDelta } from "@/lib/format";
import type { PerformanceSummary } from "@/lib/services/performance";
import { cn } from "@/lib/utils";
import { CardLink } from "./card-link";

export interface TechniqueRadarCardProps {
    /** Complete weeks, oldest first; the last one is the reporting week. */
    weeks: PerformanceMetric[];
    /** Strongest technique and focus area of the reporting week, from the performance summary. */
    summary?: Pick<PerformanceSummary, "strongest" | "weakest" | "deltas" | "comparisonWeeks" | "latest"> | null;
    href: string;
    className?: string;
}

/** Octagon radar of the eight technique scores: last complete week against four weeks earlier. */
export function TechniqueRadarCard({ weeks, summary, href, className }: TechniqueRadarCardProps) {
    const latest = weeks.at(-1);
    const earlier = weeks.length > COMPARISON_WEEKS ? weeks[weeks.length - 1 - COMPARISON_WEEKS] : null;

    return (
        <Card className={cn("flex min-w-0 flex-col", className)}>
            <CardHeader
                title="Technique profile"
                description={earlier ? "Last complete week vs 4 weeks earlier" : "Last complete week"}
                icon={<Radar />}
                action={<CardLink href={href}>Performance</CardLink>}
            />
            <CardContent className="flex flex-1 flex-col gap-4">
                {latest ? (
                    <>
                        <RadarFigure latest={latest} earlier={earlier} />
                        {summary && (
                            <div className="mt-auto grid grid-cols-2 gap-2">
                                <MetricTile
                                    label="Strongest"
                                    value={TECHNIQUE_LABELS[summary.strongest]}
                                    delta={scoreDelta(summary.deltas[summary.strongest], summary.comparisonWeeks)}
                                    hint={`Score ${summary.latest.scores[summary.strongest]}`}
                                />
                                <MetricTile
                                    label="Focus area"
                                    value={TECHNIQUE_LABELS[summary.weakest]}
                                    delta={scoreDelta(summary.deltas[summary.weakest], summary.comparisonWeeks)}
                                    hint={`Score ${summary.latest.scores[summary.weakest]}`}
                                />
                            </div>
                        )}
                    </>
                ) : (
                    <EmptyState
                        compact
                        icon={<Radar />}
                        title="No technique scores yet"
                        description="Scores appear after your first full week of analysed training."
                        className="flex-1"
                    />
                )}
            </CardContent>
        </Card>
    );
}

function RadarFigure({ latest, earlier }: { latest: PerformanceMetric; earlier: PerformanceMetric | null }) {
    const latestLabel = `Week of ${weekLabel(latest.weekStart)}`;
    const earlierLabel = earlier ? `Week of ${weekLabel(earlier.weekStart)}` : null;
    const series: RadarSeries[] = [{ id: "latest", label: latestLabel, color: CHART_SERIES[0], values: TECHNIQUES.map((t) => latest.scores[t]) }];
    if (earlier && earlierLabel) {
        series.push({ id: "earlier", label: earlierLabel, color: CHART_MUTED, values: TECHNIQUES.map((t) => earlier.scores[t]) });
    }

    return (
        <ChartFigure
            tableCaption="Technique scores by week"
            table={{
                columns: earlier && earlierLabel ? ["Technique", latestLabel, earlierLabel, "Change"] : ["Technique", latestLabel],
                rows: TECHNIQUES.map((t) =>
                    earlier
                        ? [TECHNIQUE_LABELS[t], latest.scores[t], earlier.scores[t], formatDelta(latest.scores[t] - earlier.scores[t])]
                        : [TECHNIQUE_LABELS[t], latest.scores[t]],
                ),
            }}
        >
            <RadarChart
                ariaLabel={
                    earlierLabel
                        ? `Technique scores for the ${latestLabel.toLowerCase()} compared with the ${earlierLabel.toLowerCase()}`
                        : `Technique scores for the ${latestLabel.toLowerCase()}`
                }
                axes={TECHNIQUES.map((t) => ({ key: t, label: TECHNIQUE_LABELS[t] }))}
                series={series}
                size={280}
            />
        </ChartFigure>
    );
}
