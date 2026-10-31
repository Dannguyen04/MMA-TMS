import { BarChart } from "@/components/charts/bar-chart";
import { ChartFigure } from "@/components/charts/chart-figure";
import { TECHNIQUE_COLOR } from "@/components/charts/colors";
import { LineChart } from "@/components/charts/line-chart";
import { formatMeasure } from "@/components/domain/domain-format";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { techniqueLabel } from "@/lib/domain/labels";
import type { Goal, Technique } from "@/lib/domain/types";
import { formatNumber } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator, plural, type MessageKey, type Translator } from "@/lib/i18n/translate";
import type { TechniqueDetail } from "@/lib/services/performance";
import { goalForMetric, nameInText, steadyDomain, throughWeek, weekLabel } from "./performance-format";

/** Metric names used to match goals that measure exactly what a chart shows (goals keep the English name). */
export const TECHNIQUE_METRICS = {
    score: { label: "Score", unit: "pts" },
    guardUptimePct: { label: "Guard uptime", unit: "%" },
    headMovementsPerMin: { label: "Head movements per minute", unit: "/min" },
} as const;

export type TechniqueMetric = keyof typeof TECHNIQUE_METRICS;

/** A technique metric's name in the viewer's language. */
export function metricName(t: Translator, metric: TechniqueMetric): string {
    return t(`screens.performance.metric.${metric}`);
}

const COUNTED: Technique[] = ["jab", "cross", "hook", "kick", "combination"];

/** Plural noun for weekly detections ("Jabs"); techniques without one use their label. */
export function countNoun(t: Translator, technique: Technique): string {
    return COUNTED.includes(technique) ? t(`screens.performance.count.${technique}` as MessageKey) : techniqueLabel(t, technique);
}

interface TechniqueChartProps {
    technique: Technique;
    /** Detail trimmed to complete weeks. */
    detail: TechniqueDetail;
    goals: Goal[];
    locale: Locale;
}

/** Limits every weekly series of a technique detail to complete weeks up to the reporting week (at most `weeks`). */
export function detailThroughWeek(detail: TechniqueDetail, weekStart: string, weeks = 12): TechniqueDetail {
    const end = throughWeek(detail.history, weekStart).length;
    const start = Math.max(0, end - weeks);
    return {
        ...detail,
        history: detail.history.slice(start, end),
        relatedCounts: detail.relatedCounts?.slice(start, end) ?? null,
        speedSeries: detail.speedSeries ? { ...detail.speedSeries, points: detail.speedSeries.points.slice(start, end) } : null,
        rateSeries: detail.rateSeries ? { ...detail.rateSeries, points: detail.rateSeries.points.slice(start, end) } : null,
    };
}

function MinWeeks({ title, t }: { title: string; t: Translator }) {
    return <EmptyState compact title={title} description={t("screens.performance.chart.minWeeks")} />;
}

/** Weekly score with a goal target line when a goal measures the score itself. */
export function ScoreTrendCard({ technique, detail, goals, locale }: TechniqueChartProps) {
    const t = createTranslator(locale);
    const label = techniqueLabel(t, technique);
    const inText = nameInText(label, locale, false);
    const labels = detail.history.map((point) => weekLabel(point.weekStart, locale));
    const goal = goalForMetric(goals, TECHNIQUE_METRICS.score.label, TECHNIQUE_METRICS.score.unit);

    return (
        <Card className="min-w-0">
            <CardHeader
                title={t("screens.performance.scoreTrend.title")}
                description={t("screens.performance.scoreTrend.desc", {
                    technique: nameInText(label, locale),
                    weeks: plural(t, "screens.performance.completeWeeks", detail.history.length),
                })}
            />
            <CardContent>
                {detail.history.length < 2 ? (
                    <MinWeeks title={t("screens.performance.scoreTrend.empty")} t={t} />
                ) : (
                    <ChartFigure
                        tableCaption={t("screens.performance.scoreTrend.caption", { technique: inText })}
                        table={{
                            columns: [t("screens.performance.week"), metricName(t, "score")],
                            rows: detail.history.map((point, index) => [labels[index], point.score]),
                        }}
                    >
                        <LineChart
                            ariaLabel={t("screens.performance.scoreTrend.caption", { technique: inText })}
                            labels={labels}
                            series={[
                                {
                                    id: technique,
                                    label: t("screens.performance.scoreTrend.series", { technique: inText }),
                                    color: TECHNIQUE_COLOR[technique],
                                    values: detail.history.map((p) => p.score),
                                },
                            ]}
                            yDomain={steadyDomain([...detail.history.map((p) => p.score), goal?.target ?? null], { minSpan: 20, step: 5, bounds: [0, 100] })}
                            target={goal ? { value: goal.target, label: t("screens.performance.goalTarget") } : undefined}
                            highlightLast
                            height={240}
                        />
                    </ChartFigure>
                )}
            </CardContent>
        </Card>
    );
}

/** Weekly detections for strikes and combinations, or the technique's rate metric for guard and head movement. */
export function TechniqueMetricCard({ technique, detail, goals, locale }: TechniqueChartProps) {
    const t = createTranslator(locale);
    const labels = detail.history.map((point) => weekLabel(point.weekStart, locale));

    if (detail.relatedCounts) {
        const noun = countNoun(t, technique);
        const title = technique === "combination" ? t("screens.performance.counts.combinationsTitle") : t("screens.performance.counts.strikesTitle");
        return (
            <Card className="min-w-0">
                <CardHeader title={title} description={t("screens.performance.counts.desc", { noun })} />
                <CardContent>
                    <ChartFigure
                        tableCaption={t("screens.performance.counts.caption", { noun })}
                        table={{ columns: [t("screens.performance.week"), noun], rows: detail.relatedCounts.map((point, index) => [labels[index], point.value]) }}
                    >
                        <BarChart
                            ariaLabel={t("screens.performance.counts.caption", { noun })}
                            labels={labels}
                            series={[{ id: technique, label: noun, color: TECHNIQUE_COLOR[technique], values: detail.relatedCounts.map((p) => p.value) }]}
                            height={220}
                        />
                    </ChartFigure>
                </CardContent>
            </Card>
        );
    }

    if (detail.rateSeries) {
        const metric = TECHNIQUE_METRICS[detail.rateSeries.metric];
        const name = metricName(t, detail.rateSeries.metric);
        const isPercent = metric.unit === "%";
        const goal = goalForMetric(goals, metric.label, metric.unit);
        const values = detail.rateSeries.points.map((point) => point.value);
        return (
            <Card className="min-w-0">
                <CardHeader title={name} description={isPercent ? t("screens.performance.rate.guardDesc") : t("screens.performance.rate.headDesc")} />
                <CardContent>
                    {values.length < 2 ? (
                        <MinWeeks title={t("screens.performance.rate.empty", { metric: nameInText(name, locale, false) })} t={t} />
                    ) : (
                        <ChartFigure
                            tableCaption={t("screens.performance.rate.caption", { metric: nameInText(name, locale) })}
                            table={{
                                columns: [t("screens.performance.week"), name],
                                rows: values.map((value, index) => [
                                    labels[index],
                                    value === null ? t("screens.performance.rate.noSessions") : formatMeasure(value, metric.unit),
                                ]),
                            }}
                        >
                            <LineChart
                                ariaLabel={t("screens.performance.rate.caption", { metric: nameInText(name, locale) })}
                                labels={labels}
                                series={[{ id: detail.rateSeries.metric, label: name, color: TECHNIQUE_COLOR[technique], values }]}
                                valueSuffix={isPercent ? "%" : "/min"}
                                decimals={1}
                                yDomain={steadyDomain(
                                    [...values, goal?.target ?? null],
                                    isPercent ? { minSpan: 20, step: 5, bounds: [0, 100] } : { minSpan: 4, step: 1, bounds: [0, Number.POSITIVE_INFINITY] },
                                )}
                                target={goal ? { value: goal.target, label: t("screens.performance.goalTarget") } : undefined}
                                highlightLast
                                height={220}
                            />
                        </ChartFigure>
                    )}
                </CardContent>
            </Card>
        );
    }

    return null;
}

/** Estimated average hand (punches) or foot (kicks) speed per week. */
export function TechniqueSpeedCard({ technique, detail, locale }: Omit<TechniqueChartProps, "goals">) {
    if (!detail.speedSeries) return null;
    const t = createTranslator(locale);
    const labels = detail.history.map((point) => weekLabel(point.weekStart, locale));
    const isKick = detail.speedSeries.kind === "kick";
    const values = detail.speedSeries.points.map((point) => point.value);

    return (
        <Card className="min-w-0">
            <CardHeader
                title={isKick ? t("screens.performance.techSpeed.kickTitle") : t("screens.performance.techSpeed.punchTitle")}
                description={isKick ? t("screens.performance.techSpeed.kickDesc") : t("screens.performance.techSpeed.punchDesc")}
            />
            <CardContent>
                {values.length < 2 ? (
                    <MinWeeks title={t("screens.performance.speed.empty")} t={t} />
                ) : (
                    <ChartFigure
                        tableCaption={isKick ? t("screens.performance.techSpeed.kickCaption") : t("screens.performance.techSpeed.punchCaption")}
                        table={{
                            columns: [t("screens.performance.week"), t("screens.performance.techSpeed.average")],
                            rows: values.map((value, index) => [
                                labels[index],
                                value === null ? t("screens.performance.techSpeed.notDetected") : `${formatNumber(value, 1)} m/s`,
                            ]),
                        }}
                    >
                        <LineChart
                            ariaLabel={isKick ? t("screens.performance.techSpeed.kickAria") : t("screens.performance.techSpeed.punchAria")}
                            labels={labels}
                            series={[
                                {
                                    id: "speed",
                                    label: isKick ? t("screens.performance.speed.kickSpeed") : t("screens.performance.speed.punchSpeed"),
                                    color: TECHNIQUE_COLOR[technique],
                                    values,
                                },
                            ]}
                            valueSuffix=" m/s"
                            decimals={1}
                            yDomain={steadyDomain(values, { minSpan: 2, step: 0.5, bounds: [0, Number.POSITIVE_INFINITY] })}
                            highlightLast
                            height={220}
                        />
                    </ChartFigure>
                )}
            </CardContent>
        </Card>
    );
}
