import { TrendingUp } from "lucide-react";

import { BarChart } from "@/components/charts/bar-chart";
import { ChartFigure } from "@/components/charts/chart-figure";
import { CHART_SERIES } from "@/components/charts/colors";
import { DeltaText } from "@/components/performance/delta-text";
import { changeDelta, percentChange, weekLabel } from "@/components/performance/performance-format";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { formatMinutes, formatNumber } from "@/lib/format";
import type { WeeklyVolumeTotals } from "@/lib/services/performance";
import { cn } from "@/lib/utils";
import { CardLink } from "./card-link";

export interface TeamTrendCardProps {
    /** Complete weeks only, oldest first. */
    weeks: WeeklyVolumeTotals[];
    href: string;
    className?: string;
}

/** Total roster training minutes per complete week, with last week against the week before. */
export function TeamTrendCard({ weeks, href, className }: TeamTrendCardProps) {
    const latest = weeks.at(-1);
    const previous = weeks.at(-2);
    const change = latest && previous ? percentChange(latest.trainingMinutes, previous.trainingMinutes) : null;
    const labels = weeks.map((week) => weekLabel(week.weekStart));

    return (
        <Card className={cn("min-w-0", className)}>
            <CardHeader title="Team volume" description="Minutes per week" icon={<TrendingUp />} action={<CardLink href={href}>Performance</CardLink>} />
            <CardContent className="flex flex-col gap-3">
                {latest ? (
                    <>
                        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                            <span className="text-2xl font-semibold tracking-tight text-fg">{formatMinutes(latest.trainingMinutes)}</span>
                            <span className="text-[13px] text-fg-muted">last week · {formatNumber(latest.sessionsCompleted)} sessions</span>
                            {change !== null && <DeltaText delta={changeDelta(change, { suffix: "%", label: "vs week before", neutralWithin: 3 })} />}
                        </p>
                        <ChartFigure
                            tableCaption="Roster training minutes per week"
                            table={{
                                columns: ["Week of", "Minutes", "Sessions", "Fighters"],
                                rows: weeks.map((week, index) => [labels[index], week.trainingMinutes, week.sessionsCompleted, week.fighters]),
                            }}
                        >
                            <BarChart
                                ariaLabel={`Roster training minutes for the last ${weeks.length} complete weeks`}
                                labels={labels}
                                series={[{ id: "minutes", label: "Training minutes", color: CHART_SERIES[0], values: weeks.map((week) => week.trainingMinutes) }]}
                                valueSuffix=" min"
                                height={180}
                            />
                        </ChartFigure>
                    </>
                ) : (
                    <EmptyState compact icon={<TrendingUp />} title="No complete weeks yet" description="Team volume appears after the first full week of training." />
                )}
            </CardContent>
        </Card>
    );
}
