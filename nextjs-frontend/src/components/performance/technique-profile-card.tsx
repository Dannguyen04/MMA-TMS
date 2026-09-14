import { ChartFigure } from "@/components/charts/chart-figure";
import { CHART_MUTED, CHART_SERIES } from "@/components/charts/colors";
import { RadarChart, type RadarSeries } from "@/components/charts/radar-chart";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TECHNIQUE_LABELS, TECHNIQUES } from "@/lib/domain/labels";
import type { PerformanceMetric } from "@/lib/domain/types";
import { formatDelta } from "@/lib/format";
import { COMPARISON_WEEKS, weekLabel } from "./performance-format";

export interface TechniqueProfileCardProps {
    /** Complete weeks, oldest first; the last one is the reporting week. */
    weeks: PerformanceMetric[];
    heading: "h2" | "h3";
}

/** Octagon radar of the eight technique scores: the reporting week against four weeks earlier. */
export function TechniqueProfileCard({ weeks, heading }: TechniqueProfileCardProps) {
    const latest = weeks[weeks.length - 1];
    const earlier = weeks.length > COMPARISON_WEEKS ? weeks[weeks.length - 1 - COMPARISON_WEEKS] : null;
    const latestLabel = `Week of ${weekLabel(latest.weekStart)}`;
    const earlierLabel = earlier ? `Week of ${weekLabel(earlier.weekStart)}` : null;

    const series: RadarSeries[] = [
        { id: "latest", label: latestLabel, color: CHART_SERIES[0], values: TECHNIQUES.map((t) => latest.scores[t]) },
    ];
    if (earlier && earlierLabel) {
        series.push({ id: "earlier", label: earlierLabel, color: CHART_MUTED, values: TECHNIQUES.map((t) => earlier.scores[t]) });
    }

    return (
        <Card className="h-full min-w-0">
            <CardHeader
                as={heading}
                title="Technique profile"
                description={earlier ? "Latest complete week compared with 4 weeks earlier" : "Latest complete week"}
            />
            <CardContent>
                <ChartFigure
                    tableCaption="Technique scores by week"
                    table={{
                        columns: earlierLabel ? ["Technique", latestLabel, earlierLabel, "Change"] : ["Technique", latestLabel],
                        rows: TECHNIQUES.map((t) =>
                            earlier
                                ? [TECHNIQUE_LABELS[t], latest.scores[t], earlier.scores[t], formatDelta(latest.scores[t] - earlier.scores[t])]
                                : [TECHNIQUE_LABELS[t], latest.scores[t]],
                        ),
                    }}
                >
                    <RadarChart
                        ariaLabel={
                            earlier
                                ? `Technique profile radar for the ${latestLabel.toLowerCase()} compared with the ${earlierLabel?.toLowerCase()}`
                                : `Technique profile radar for the ${latestLabel.toLowerCase()}`
                        }
                        axes={TECHNIQUES.map((t) => ({ key: t, label: TECHNIQUE_LABELS[t] }))}
                        series={series}
                        size={300}
                    />
                </ChartFigure>
            </CardContent>
        </Card>
    );
}
