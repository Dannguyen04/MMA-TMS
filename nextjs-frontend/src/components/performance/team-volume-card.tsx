import { BarChart } from "@/components/charts/bar-chart";
import { ChartFigure } from "@/components/charts/chart-figure";
import { CHART_SERIES } from "@/components/charts/colors";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { PerformanceMetric } from "@/lib/domain/types";
import { formatNumber } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator, plural } from "@/lib/i18n/translate";
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
    locale: Locale;
}

/** Team training minutes per week as single-hue totals; each fighter's minutes show in the tooltip and the data table. */
export function TeamVolumeCard({ fighters, weekStarts, locale }: TeamVolumeCardProps) {
    const t = createTranslator(locale);
    const labels = weekStarts.map((weekStart) => weekLabel(weekStart, locale));
    const minutes = fighters.map((fighter) =>
        weekStarts.map((weekStart) => fighter.history.find((week) => week.weekStart === weekStart)?.trainingMinutes ?? 0),
    );
    const totals = weekStarts.map((_, index) => sum(minutes.map((values) => values[index])));
    const busiest = totals.length > 0 ? Math.max(...totals) : 0;
    const summary = t("screens.performance.volume.summary", { avg: formatNumber(sum(totals) / Math.max(1, totals.length)), max: formatNumber(busiest) });

    return (
        <Card className="min-w-0">
            <CardHeader
                title={t("screens.performance.volume.title")}
                description={t("screens.performance.volume.desc", { weeks: plural(t, "screens.performance.completeWeeks", weekStarts.length) })}
            />
            <CardContent>
                <ChartFigure
                    title={summary}
                    description={t("screens.performance.volume.figureDesc")}
                    tableCaption={t("screens.performance.volume.caption")}
                    table={{
                        columns: [t("screens.performance.week"), ...fighters.map((fighter) => fighter.name), t("screens.performance.total")],
                        rows: weekStarts.map((_, index) => [labels[index], ...minutes.map((values) => values[index]), totals[index]]),
                    }}
                >
                    <BarChart
                        ariaLabel={t("screens.performance.volume.aria", { summary })}
                        labels={labels}
                        series={[{ id: "total", label: t("screens.performance.volume.series"), color: CHART_SERIES[0], values: totals }]}
                        details={fighters.map((fighter, index) => ({ id: fighter.id, label: fighter.name, values: minutes[index] }))}
                        valueSuffix=" min"
                        height={280}
                    />
                </ChartFigure>
            </CardContent>
        </Card>
    );
}
