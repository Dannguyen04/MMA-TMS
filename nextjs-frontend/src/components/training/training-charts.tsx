"use client";

import { BarChart3, Timer } from "lucide-react";

import { BarChart, type BarSeries } from "@/components/charts/bar-chart";
import { ChartFigure } from "@/components/charts/chart-figure";
import { CHART_MUTED, CHART_SERIES } from "@/components/charts/colors";
import { useLocale, useT } from "@/components/i18n/locale-provider";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { formatMinutes, formatPercent, formatShortDate } from "@/lib/format";
import { sum } from "@/lib/utils";
import type { WeeklyAdherence } from "./training-utils";

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
    title,
    description,
    headingAs = "h2",
    className,
}: AdherenceChartProps) {
    const t = useT();
    const locale = useLocale();
    const weekLabel = (weekStart: string) => formatShortDate(`${weekStart}T12:00:00Z`, locale);
    const heading = title ?? t("training.chart.adherenceTitle");
    const desc = description ?? t("training.chart.adherenceDesc");

    // Without session times (weekly progress from the service) nothing can be called due yet.
    const knowsDue = weeks.every((w) => w.due !== undefined);
    const dueOf = (w: WeeklyAdherence) => w.due ?? w.planned;
    const planned = sum(weeks.map((w) => w.planned));
    const due = sum(weeks.map(dueOf));
    const completed = sum(weeks.map((w) => w.completed));
    const upcoming = planned - due;
    const summary =
        due === 0
            ? t("training.chart.nothingDueYet")
            : t("training.chart.summary", {
                  completed,
                  due,
                  kind: knowsDue ? t("training.chart.dueSessions") : t("training.chart.plannedSessionsSoFar"),
                  pct: formatPercent((completed / due) * 100),
              });

    const series: BarSeries[] = [
        { id: "completed", label: t("training.chart.completed"), color: CHART_SERIES[0], values: weeks.map((w) => w.completed) },
        { id: "not-completed", label: t("training.chart.notCompleted"), color: CHART_MUTED, values: weeks.map((w) => dueOf(w) - w.completed) },
    ];
    if (upcoming > 0) {
        series.push({ id: "upcoming", label: t("training.chart.upcoming"), color: UPCOMING_COLOR, values: weeks.map((w) => w.planned - dueOf(w)) });
    }

    const columns = [
        t("training.chart.weekOf"),
        knowsDue ? t("training.chart.due") : t("training.chart.planned"),
        t("training.chart.completed"),
        t("training.chart.missed"),
        ...(upcoming > 0 ? [t("training.chart.upcoming")] : []),
        t("training.chart.adherenceTitle"),
    ];
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
            <CardHeader title={heading} description={desc} icon={<BarChart3 />} as={headingAs} />
            <CardContent>
                {planned === 0 ? (
                    <EmptyState compact title={t("training.chart.noSessionsPlannedTitle")} description={t("training.chart.noSessionsPlannedDesc")} />
                ) : (
                    <ChartFigure
                        title={summary}
                        description={
                            upcoming > 0
                                ? t("training.chart.upcomingNotice", {
                                      n: upcoming,
                                      unit: upcoming === 1 ? t("training.chart.sessionIsnt") : t("training.chart.sessionsArent"),
                                  })
                                : undefined
                        }
                        tableCaption={t("training.chart.tableCaption", { title: heading })}
                        table={{ columns, rows }}
                    >
                        <BarChart ariaLabel={`${heading}. ${summary}.`} labels={weeks.map((w) => weekLabel(w.weekStart))} series={series} stacked height={220} />
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
    const t = useT();
    const locale = useLocale();
    const weekLabel = (weekStart: string) => formatShortDate(`${weekStart}T12:00:00Z`, locale);
    const total = sum(weeks.map((w) => w.minutes));
    const trained = weeks.filter((w) => w.minutes > 0);
    const summary =
        total === 0
            ? t("training.chart.noCompletedTraining")
            : t("training.chart.minutesSummary", {
                  total: formatMinutes(total),
                  weeks: weeks.length,
                  avg: formatMinutes(total / Math.max(1, trained.length)),
              });

    return (
        <Card className={className}>
            <CardHeader
                title={t("training.chart.minutesTitle")}
                description={t("training.chart.minutesDesc", { weeks: weeks.length })}
                icon={<Timer />}
            />
            <CardContent>
                <ChartFigure
                    title={summary}
                    tableCaption={t("training.chart.minutesTableCaption")}
                    table={{
                        columns: [t("training.chart.weekOf"), t("training.chart.sessionsCompleted"), t("training.chart.minutes")],
                        rows: weeks.map((w) => [weekLabel(w.weekStart), w.completed, w.minutes]),
                    }}
                >
                    <BarChart
                        ariaLabel={`${t("training.chart.minutesTitle")}. ${summary}.`}
                        labels={weeks.map((w) => weekLabel(w.weekStart))}
                        series={[{ id: "minutes", label: t("training.chart.minutes"), color: CHART_SERIES[0], values: weeks.map((w) => w.minutes) }]}
                        valueSuffix={t("training.chart.minSuffix")}
                        height={220}
                    />
                </ChartFigure>
            </CardContent>
        </Card>
    );
}
