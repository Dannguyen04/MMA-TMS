import { BarChart } from "@/components/charts/bar-chart";
import { ChartFigure } from "@/components/charts/chart-figure";
import { CHART_SERIES, TECHNIQUE_COLOR } from "@/components/charts/colors";
import { LineChart } from "@/components/charts/line-chart";
import { MetricTile } from "@/components/domain/metric-tile";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { StatDelta } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/states";
import { STRIKE_TYPES, techniqueLabel } from "@/lib/domain/labels";
import type { PerformanceMetric } from "@/lib/domain/types";
import { formatNumber } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator, plural, type Translator } from "@/lib/i18n/translate";
import { cn, sum } from "@/lib/utils";
import { changeDelta, percentChange, weekLabel } from "./performance-format";

interface WeeklyCardProps {
    /** Complete weeks, oldest first. */
    weeks: PerformanceMetric[];
    heading: "h2" | "h3";
    className?: string;
    locale: Locale;
}

function weeksDescription(weeks: PerformanceMetric[], t: Translator): string {
    return plural(t, "screens.performance.completeWeeks", weeks.length);
}

/** Strikes detected in analysed footage per week, stacked by strike type. */
export function StrikeVolumeCard({ weeks, heading, className, locale }: WeeklyCardProps) {
    const t = createTranslator(locale);
    const labels = weeks.map((week) => weekLabel(week.weekStart, locale));
    return (
        <Card className={cn("min-w-0", className)}>
            <CardHeader
                as={heading}
                title={t("screens.performance.strikes.title")}
                description={t("screens.performance.strikes.desc", { weeks: weeksDescription(weeks, t) })}
            />
            <CardContent>
                <ChartFigure
                    tableCaption={t("screens.performance.strikes.caption")}
                    table={{
                        columns: [t("screens.performance.week"), ...STRIKE_TYPES.map((s) => techniqueLabel(t, s)), t("screens.performance.total")],
                        rows: weeks.map((week, index) => [
                            labels[index],
                            ...STRIKE_TYPES.map((s) => week.strikeCounts[s]),
                            sum(STRIKE_TYPES.map((s) => week.strikeCounts[s])),
                        ]),
                    }}
                >
                    <BarChart
                        ariaLabel={t("screens.performance.strikes.aria")}
                        labels={labels}
                        series={STRIKE_TYPES.map((s) => ({
                            id: s,
                            label: techniqueLabel(t, s),
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
export function SpeedCard({ weeks, heading, className, locale }: WeeklyCardProps) {
    const t = createTranslator(locale);
    const labels = weeks.map((week) => weekLabel(week.weekStart, locale));
    const punch = weeks.map((week) => (week.avgPunchSpeed > 0 ? week.avgPunchSpeed : null));
    const kick = weeks.map((week) => (week.avgKickSpeed > 0 ? week.avgKickSpeed : null));
    const format = (value: number | null) => (value === null ? "—" : `${formatNumber(value, 1)} m/s`);

    return (
        <Card className={cn("min-w-0", className)}>
            <CardHeader as={heading} title={t("screens.performance.speed.title")} description={t("screens.performance.speed.desc")} />
            <CardContent>
                {weeks.length < 2 ? (
                    <EmptyState
                        compact
                        title={t("screens.performance.speed.empty")}
                        description={t("screens.performance.speed.emptyDesc", { punch: format(punch[punch.length - 1] ?? null), kick: format(kick[kick.length - 1] ?? null) })}
                    />
                ) : (
                    <ChartFigure
                        tableCaption={t("screens.performance.speed.caption")}
                        table={{
                            columns: [t("screens.performance.week"), t("screens.performance.speed.punchSpeed"), t("screens.performance.speed.kickSpeed")],
                            rows: weeks.map((_, index) => [labels[index], format(punch[index]), format(kick[index])]),
                        }}
                    >
                        <LineChart
                            ariaLabel={t("screens.performance.speed.aria")}
                            labels={labels}
                            series={[
                                { id: "punch", label: t("screens.performance.speed.punches"), color: TECHNIQUE_COLOR.cross, values: punch },
                                { id: "kick", label: t("screens.performance.speed.kicks"), color: TECHNIQUE_COLOR.kick, values: kick },
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
export function TrainingLoadCard({ weeks, heading, className, locale }: WeeklyCardProps) {
    const t = createTranslator(locale);
    const labels = weeks.map((week) => weekLabel(week.weekStart, locale));
    const latest = weeks[weeks.length - 1];
    const previous = weeks.length > 1 ? weeks[weeks.length - 2] : null;
    const minutesChange = previous ? percentChange(latest.trainingMinutes, previous.trainingMinutes) : null;
    // More volume isn't automatically better (tapers, rehab), so load changes are shown without good/bad colouring.
    const neutral = (delta: StatDelta): StatDelta => ({ ...delta, sentiment: "neutral" });

    return (
        <Card className={cn("min-w-0", className)}>
            <CardHeader as={heading} title={t("screens.performance.load.title")} description={t("screens.performance.load.desc")} />
            <CardContent className="flex flex-col gap-4">
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    <MetricTile
                        label={t("screens.performance.load.lastWeek")}
                        value={formatNumber(latest.trainingMinutes)}
                        unit="min"
                        delta={minutesChange === null ? undefined : neutral(changeDelta(minutesChange, { suffix: "%" }))}
                    />
                    <MetricTile
                        label={t("screens.performance.sessions")}
                        value={latest.sessionsCompleted}
                        delta={previous ? neutral(changeDelta(latest.sessionsCompleted - previous.sessionsCompleted)) : undefined}
                    />
                    <MetricTile label={t("screens.performance.avgRpe")} value={latest.avgRpe > 0 ? formatNumber(latest.avgRpe, 1) : "—"} unit="/ 10" />
                </div>
                <ChartFigure
                    tableCaption={t("screens.performance.load.caption")}
                    table={{
                        columns: [t("screens.performance.week"), t("screens.performance.minutes"), t("screens.performance.sessions"), t("screens.performance.avgRpe")],
                        rows: weeks.map((week, index) => [
                            labels[index],
                            week.trainingMinutes,
                            week.sessionsCompleted,
                            week.avgRpe > 0 ? formatNumber(week.avgRpe, 1) : "—",
                        ]),
                    }}
                >
                    <BarChart
                        ariaLabel={t("screens.performance.load.aria")}
                        labels={labels}
                        series={[{ id: "minutes", label: t("screens.performance.trainingMinutes"), color: CHART_SERIES[0], values: weeks.map((week) => week.trainingMinutes) }]}
                        valueSuffix=" min"
                        height={200}
                    />
                </ChartFigure>
            </CardContent>
        </Card>
    );
}
