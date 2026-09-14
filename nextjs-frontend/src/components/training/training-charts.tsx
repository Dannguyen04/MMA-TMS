import { BarChart3, Timer } from "lucide-react";

import { BarChart, type BarSeries } from "@/components/charts/bar-chart";
import { ChartFigure } from "@/components/charts/chart-figure";
import { CHART_MUTED, CHART_SERIES } from "@/components/charts/colors";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { formatMinutes, formatPercent, formatShortDate } from "@/lib/format";
import { sum } from "@/lib/utils";
import type { WeeklyAdherence } from "./training-utils";

const weekLabel = (weekStart: string) => formatShortDate(`${weekStart}T12:00:00Z`);

/** Sessions still ahead: a lighter step of the "not completed" neutral, so they never read as missed. */
const UPCOMING_COLOR = "color-mix(in oklab, var(--neutral-solid) 55%, var(--chart-surface))";

export interface AdherenceChartProps {
    weeks: WeeklyAdherence[];
    title?: string;
    description?: string;
    /** Card heading level; use "h3" inside a tab that already has an h2. */
    headingAs?: "h2" | "h3";
    className?: string;
}

/**
 * Sessions per week as one column: completed, due but not completed, and (in the current week) still
 * upcoming. The summary counts due sessions only, matching the adherence figure on plan cards.
 */
export function AdherenceChart({
    weeks,
    title = "Adherence",
    description = "Completed out of due sessions per week",
    headingAs = "h2",
    className,
}: AdherenceChartProps) {
    // Without session times (weekly progress from the service) nothing can be called due yet.
    const knowsDue = weeks.every((w) => w.due !== undefined);
    const dueOf = (w: WeeklyAdherence) => w.due ?? w.planned;
    const planned = sum(weeks.map((w) => w.planned));
    const due = sum(weeks.map(dueOf));
    const completed = sum(weeks.map((w) => w.completed));
    const upcoming = planned - due;
    const summary =
        due === 0
            ? "Nothing due yet"
            : `${completed} of ${due} ${knowsDue ? "due sessions" : "sessions planned so far"} completed (${formatPercent((completed / due) * 100)})`;

    const series: BarSeries[] = [
        { id: "completed", label: "Completed", color: CHART_SERIES[0], values: weeks.map((w) => w.completed) },
        { id: "not-completed", label: "Not completed", color: CHART_MUTED, values: weeks.map((w) => dueOf(w) - w.completed) },
    ];
    if (upcoming > 0) {
        series.push({ id: "upcoming", label: "Upcoming", color: UPCOMING_COLOR, values: weeks.map((w) => w.planned - dueOf(w)) });
    }

    const columns = ["Week of", knowsDue ? "Due" : "Planned", "Completed", "Missed", ...(upcoming > 0 ? ["Upcoming"] : []), "Adherence"];
    const rows = weeks.map((w) => [
        weekLabel(w.weekStart),
        dueOf(w),
        w.completed,
        w.missed,
        ...(upcoming > 0 ? [w.planned - dueOf(w)] : []),
        dueOf(w) === 0 ? "—" : formatPercent((w.completed / dueOf(w)) * 100),
    ]);

    return (
        <Card className={className}>
            <CardHeader title={title} description={description} icon={<BarChart3 />} as={headingAs} />
            <CardContent>
                {planned === 0 ? (
                    <EmptyState compact title="No sessions planned yet" description="Adherence appears once sessions are scheduled." />
                ) : (
                    <ChartFigure
                        title={summary}
                        description={upcoming > 0 ? `${upcoming} upcoming ${upcoming === 1 ? "session isn't" : "sessions aren't"} counted until they're due.` : undefined}
                        tableCaption={`${title}: completed out of due sessions per week`}
                        table={{ columns, rows }}
                    >
                        <BarChart ariaLabel={`${title}. ${summary}.`} labels={weeks.map((w) => weekLabel(w.weekStart))} series={series} stacked height={220} />
                    </ChartFigure>
                )}
            </CardContent>
        </Card>
    );
}

export interface MinutesChartProps {
    weeks: WeeklyAdherence[];
    className?: string;
}

/** Completed training minutes per week. */
export function MinutesChart({ weeks, className }: MinutesChartProps) {
    const total = sum(weeks.map((w) => w.minutes));
    const trained = weeks.filter((w) => w.minutes > 0);
    const summary =
        total === 0
            ? "No completed training in this period"
            : `${formatMinutes(total)} in ${weeks.length} weeks · ${formatMinutes(total / Math.max(1, trained.length))} per active week`;

    return (
        <Card className={className}>
            <CardHeader title="Weekly training minutes" description={`Completed sessions, last ${weeks.length} weeks (minutes)`} icon={<Timer />} />
            <CardContent>
                <ChartFigure
                    title={summary}
                    tableCaption="Completed training minutes per week"
                    table={{
                        columns: ["Week of", "Sessions completed", "Minutes"],
                        rows: weeks.map((w) => [weekLabel(w.weekStart), w.completed, w.minutes]),
                    }}
                >
                    <BarChart
                        ariaLabel={`Weekly training minutes. ${summary}.`}
                        labels={weeks.map((w) => weekLabel(w.weekStart))}
                        series={[{ id: "minutes", label: "Minutes", color: CHART_SERIES[0], values: weeks.map((w) => w.minutes) }]}
                        valueSuffix=" min"
                        height={220}
                    />
                </ChartFigure>
            </CardContent>
        </Card>
    );
}
