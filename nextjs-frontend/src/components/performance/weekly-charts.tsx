import { BarChart } from "@/components/charts/bar-chart";
import { ChartFigure } from "@/components/charts/chart-figure";
import { CHART_SERIES, TECHNIQUE_COLOR } from "@/components/charts/colors";
import { LineChart } from "@/components/charts/line-chart";
import { MetricTile } from "@/components/domain/metric-tile";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { StatDelta } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/states";
import { STRIKE_TYPES, TECHNIQUE_LABELS } from "@/lib/domain/labels";
import type { PerformanceMetric } from "@/lib/domain/types";
import { formatNumber, pluralize } from "@/lib/format";
import { cn, sum } from "@/lib/utils";
import { changeDelta, percentChange, weekLabel } from "./performance-format";

interface WeeklyCardProps {
    /** Complete weeks, oldest first. */
    weeks: PerformanceMetric[];
    heading: "h2" | "h3";
    className?: string;
}

function weeksDescription(weeks: PerformanceMetric[]): string {
    return pluralize(weeks.length, "complete week");
}

/** Strikes detected in analysed footage per week, stacked by strike type. */
export function StrikeVolumeCard({ weeks, heading, className }: WeeklyCardProps) {
    const labels = weeks.map((week) => weekLabel(week.weekStart));
    return (
        <Card className={cn("min-w-0", className)}>
            <CardHeader as={heading} title="Strike volume" description={`Strikes detected in analysed footage · ${weeksDescription(weeks)}`} />
            <CardContent>
                <ChartFigure
                    tableCaption="Strikes detected per week by type"
                    table={{
                        columns: ["Week", ...STRIKE_TYPES.map((s) => TECHNIQUE_LABELS[s]), "Total"],
                        rows: weeks.map((week, index) => [
                            labels[index],
                            ...STRIKE_TYPES.map((s) => week.strikeCounts[s]),
                            sum(STRIKE_TYPES.map((s) => week.strikeCounts[s])),
                        ]),
                    }}
                >
                    <BarChart
                        ariaLabel="Strikes detected per week, stacked by jab, cross, hook and kick"
                        labels={labels}
                        series={STRIKE_TYPES.map((s) => ({
                            id: s,
                            label: TECHNIQUE_LABELS[s],
                            color: TECHNIQUE_COLOR[s],
                            values: weeks.map((week) => week.strikeCounts[s]),
                        }))}
                        stacked
                        height={240}
                    />
                </ChartFigure>
            </CardContent>
        </Card>
    );
}

/** Estimated average punch and kick speed per week; weeks without detections are gaps. */
export function SpeedCard({ weeks, heading, className }: WeeklyCardProps) {
    const labels = weeks.map((week) => weekLabel(week.weekStart));
    const punch = weeks.map((week) => (week.avgPunchSpeed > 0 ? week.avgPunchSpeed : null));
    const kick = weeks.map((week) => (week.avgKickSpeed > 0 ? week.avgKickSpeed : null));
    const format = (value: number | null) => (value === null ? "—" : `${formatNumber(value, 1)} m/s`);

    return (
        <Card className={cn("min-w-0", className)}>
            <CardHeader as={heading} title="Speed (m/s)" description="Estimated average hand and foot speed at impact" />
            <CardContent>
                {weeks.length < 2 ? (
                    <EmptyState compact title="Speed trend appears after 2 complete weeks" description={`Latest week: punches ${format(punch[punch.length - 1] ?? null)}, kicks ${format(kick[kick.length - 1] ?? null)}.`} />
                ) : (
                    <ChartFigure
                        tableCaption="Average punch and kick speed per week"
                        table={{
                            columns: ["Week", "Punch speed", "Kick speed"],
                            rows: weeks.map((_, index) => [labels[index], format(punch[index]), format(kick[index])]),
                        }}
                    >
                        <LineChart
                            ariaLabel="Average punch and kick speed per week in metres per second"
                            labels={labels}
                            series={[
                                { id: "punch", label: "Punches", color: TECHNIQUE_COLOR.cross, values: punch },
                                { id: "kick", label: "Kicks", color: TECHNIQUE_COLOR.kick, values: kick },
                            ]}
                            valueSuffix=" m/s"
                            decimals={1}
                            height={220}
                        />
                    </ChartFigure>
                )}
            </CardContent>
        </Card>
    );
}

/** Weekly training minutes with sessions and average RPE for the latest week and in the data table. */
export function TrainingLoadCard({ weeks, heading, className }: WeeklyCardProps) {
    const labels = weeks.map((week) => weekLabel(week.weekStart));
    const latest = weeks[weeks.length - 1];
    const previous = weeks.length > 1 ? weeks[weeks.length - 2] : null;
    const minutesChange = previous ? percentChange(latest.trainingMinutes, previous.trainingMinutes) : null;
    // More volume isn't automatically better (tapers, rehab), so load changes are shown without good/bad colouring.
    const neutral = (delta: StatDelta): StatDelta => ({ ...delta, sentiment: "neutral" });

    return (
        <Card className={cn("min-w-0", className)}>
            <CardHeader as={heading} title="Training load (min)" description="Weekly training minutes · sessions and average RPE are in the data table" />
            <CardContent className="flex flex-col gap-4">
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <MetricTile
                        label="Last week"
                        value={formatNumber(latest.trainingMinutes)}
                        unit="min"
                        delta={minutesChange === null ? undefined : neutral(changeDelta(minutesChange, { suffix: "%" }))}
                    />
                    <MetricTile
                        label="Sessions"
                        value={latest.sessionsCompleted}
                        delta={previous ? neutral(changeDelta(latest.sessionsCompleted - previous.sessionsCompleted)) : undefined}
                    />
                    <MetricTile label="Avg RPE" value={latest.avgRpe > 0 ? formatNumber(latest.avgRpe, 1) : "—"} unit="/ 10" />
                </div>
                <ChartFigure
                    tableCaption="Training load per week"
                    table={{
                        columns: ["Week", "Minutes", "Sessions", "Avg RPE"],
                        rows: weeks.map((week, index) => [
                            labels[index],
                            week.trainingMinutes,
                            week.sessionsCompleted,
                            week.avgRpe > 0 ? formatNumber(week.avgRpe, 1) : "—",
                        ]),
                    }}
                >
                    <BarChart
                        ariaLabel="Training minutes per week"
                        labels={labels}
                        series={[{ id: "minutes", label: "Training minutes", color: CHART_SERIES[0], values: weeks.map((week) => week.trainingMinutes) }]}
                        valueSuffix=" min"
                        height={200}
                    />
                </ChartFigure>
            </CardContent>
        </Card>
    );
}
