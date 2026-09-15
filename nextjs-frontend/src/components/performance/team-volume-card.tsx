import { BarChart } from "@/components/charts/bar-chart";
import { ChartFigure } from "@/components/charts/chart-figure";
import { CHART_SERIES } from "@/components/charts/colors";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { PerformanceMetric } from "@/lib/domain/types";
import { formatNumber, pluralize } from "@/lib/format";
import { sum } from "@/lib/utils";
import { weekLabel } from "./performance-format";

export interface TeamVolumeFighter {
    id: string;
    name: string;
    /** Weekly snapshots, any order. */
    history: PerformanceMetric[];
}

export interface TeamVolumeCardProps {
    /** Roster order, which is also the column order of the data table. */
    fighters: TeamVolumeFighter[];
    /** Complete week starts to show, oldest first. */
    weekStarts: string[];
}

/** Team training minutes per week as single-hue totals; each fighter's minutes show in the tooltip and the data table. */
export function TeamVolumeCard({ fighters, weekStarts }: TeamVolumeCardProps) {
    const labels = weekStarts.map(weekLabel);
    const minutes = fighters.map((fighter) =>
        weekStarts.map((weekStart) => fighter.history.find((week) => week.weekStart === weekStart)?.trainingMinutes ?? 0),
    );
    const totals = weekStarts.map((_, index) => sum(minutes.map((values) => values[index])));
    const busiest = totals.length > 0 ? Math.max(...totals) : 0;
    const summary = `${formatNumber(sum(totals) / Math.max(1, totals.length))} min a week on average · busiest week ${formatNumber(busiest)} min`;

    return (
        <Card className="min-w-0">
            <CardHeader title="Weekly training volume (min)" description={`Team training minutes · ${pluralize(weekStarts.length, "complete week")}`} />
            <CardContent>
                <ChartFigure
                    title={summary}
                    description="Each week's tooltip and the data table split the total by fighter."
                    tableCaption="Training minutes per fighter per week"
                    table={{
                        columns: ["Week", ...fighters.map((fighter) => fighter.name), "Total"],
                        rows: weekStarts.map((_, index) => [labels[index], ...minutes.map((values) => values[index]), totals[index]]),
                    }}
                >
                    <BarChart
                        ariaLabel={`Team training minutes per week. ${summary}.`}
                        labels={labels}
                        series={[{ id: "total", label: "Team minutes", color: CHART_SERIES[0], values: totals }]}
                        details={fighters.map((fighter, index) => ({ id: fighter.id, label: fighter.name, values: minutes[index] }))}
                        valueSuffix=" min"
                        height={280}
                    />
                </ChartFigure>
            </CardContent>
        </Card>
    );
}
