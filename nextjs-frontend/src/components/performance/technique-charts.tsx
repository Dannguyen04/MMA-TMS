import { BarChart } from "@/components/charts/bar-chart";
import { ChartFigure } from "@/components/charts/chart-figure";
import { TECHNIQUE_COLOR } from "@/components/charts/colors";
import { LineChart } from "@/components/charts/line-chart";
import { formatMeasure } from "@/components/domain/domain-format";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { TECHNIQUE_LABELS } from "@/lib/domain/labels";
import type { Goal, Technique } from "@/lib/domain/types";
import { formatNumber, pluralize } from "@/lib/format";
import type { TechniqueDetail } from "@/lib/services/performance";
import { goalForMetric, steadyDomain, throughWeek, weekLabel } from "./performance-format";

/** Metric names used to match goals that measure exactly what a chart shows. */
export const TECHNIQUE_METRICS = {
    score: { label: "Score", unit: "pts" },
    guardUptimePct: { label: "Guard uptime", unit: "%" },
    headMovementsPerMin: { label: "Head movements per minute", unit: "/min" },
} as const;

const COUNT_NOUNS: Partial<Record<Technique, string>> = {
    jab: "Jabs",
    cross: "Crosses",
    hook: "Hooks",
    kick: "Kicks",
    combination: "Combinations",
};

interface TechniqueChartProps {
    technique: Technique;
    /** Detail trimmed to complete weeks. */
    detail: TechniqueDetail;
    goals: Goal[];
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

function MinWeeks({ title }: { title: string }) {
    return <EmptyState compact title={title} description="This chart fills in after 2 complete weeks of data." />;
}

/** Weekly score with a goal target line when a goal measures the score itself. */
export function ScoreTrendCard({ technique, detail, goals }: TechniqueChartProps) {
    const label = TECHNIQUE_LABELS[technique];
    const labels = detail.history.map((point) => weekLabel(point.weekStart));
    const goal = goalForMetric(goals, TECHNIQUE_METRICS.score.label, TECHNIQUE_METRICS.score.unit);

    return (
        <Card className="min-w-0">
            <CardHeader
                title="Score trend"
                description={`Weekly ${label.toLowerCase()} score (0–100) · ${pluralize(detail.history.length, "complete week")}`}
            />
            <CardContent>
                {detail.history.length < 2 ? (
                    <MinWeeks title="Score trend appears after 2 complete weeks" />
                ) : (
                    <ChartFigure
                        tableCaption={`Weekly ${label} score`}
                        table={{ columns: ["Week", "Score"], rows: detail.history.map((point, index) => [labels[index], point.score]) }}
                    >
                        <LineChart
                            ariaLabel={`Weekly ${label} score`}
                            labels={labels}
                            series={[{ id: technique, label: `${label} score`, color: TECHNIQUE_COLOR[technique], values: detail.history.map((p) => p.score) }]}
                            yDomain={steadyDomain([...detail.history.map((p) => p.score), goal?.target ?? null], { minSpan: 20, step: 5, bounds: [0, 100] })}
                            target={goal ? { value: goal.target, label: "Goal target" } : undefined}
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
export function TechniqueMetricCard({ technique, detail, goals }: TechniqueChartProps) {
    const label = TECHNIQUE_LABELS[technique];
    const labels = detail.history.map((point) => weekLabel(point.weekStart));

    if (detail.relatedCounts) {
        const noun = COUNT_NOUNS[technique] ?? label;
        const title = technique === "combination" ? "Combinations per week" : "Strikes per week";
        return (
            <Card className="min-w-0">
                <CardHeader title={title} description={`${noun} detected in analysed footage`} />
                <CardContent>
                    <ChartFigure
                        tableCaption={`${noun} detected per week`}
                        table={{ columns: ["Week", noun], rows: detail.relatedCounts.map((point, index) => [labels[index], point.value]) }}
                    >
                        <BarChart
                            ariaLabel={`${noun} detected per week`}
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
        const isPercent = metric.unit === "%";
        const goal = goalForMetric(goals, metric.label, metric.unit);
        const values = detail.rateSeries.points.map((point) => point.value);
        return (
            <Card className="min-w-0">
                <CardHeader
                    title={metric.label}
                    description={isPercent ? "Share of active time with a correct guard" : "Slips, rolls and level changes per minute of active time"}
                />
                <CardContent>
                    {values.length < 2 ? (
                        <MinWeeks title={`${metric.label} trend appears after 2 complete weeks`} />
                    ) : (
                        <ChartFigure
                            tableCaption={`Weekly ${metric.label.toLowerCase()}`}
                            table={{
                                columns: ["Week", metric.label],
                                rows: values.map((value, index) => [labels[index], value === null ? "No sessions" : formatMeasure(value, metric.unit)]),
                            }}
                        >
                            <LineChart
                                ariaLabel={`Weekly ${metric.label.toLowerCase()}`}
                                labels={labels}
                                series={[{ id: detail.rateSeries.metric, label: metric.label, color: TECHNIQUE_COLOR[technique], values }]}
                                valueSuffix={isPercent ? "%" : "/min"}
                                decimals={1}
                                yDomain={steadyDomain(
                                    [...values, goal?.target ?? null],
                                    isPercent ? { minSpan: 20, step: 5, bounds: [0, 100] } : { minSpan: 4, step: 1, bounds: [0, Number.POSITIVE_INFINITY] },
                                )}
                                target={goal ? { value: goal.target, label: "Goal target" } : undefined}
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
export function TechniqueSpeedCard({ technique, detail }: Omit<TechniqueChartProps, "goals">) {
    if (!detail.speedSeries) return null;
    const labels = detail.history.map((point) => weekLabel(point.weekStart));
    const kind = detail.speedSeries.kind === "kick" ? "Kick" : "Punch";
    const values = detail.speedSeries.points.map((point) => point.value);

    return (
        <Card className="min-w-0">
            <CardHeader
                title={`${kind} speed (m/s)`}
                description={kind === "Kick" ? "Estimated average foot speed across all kicks that week" : "Estimated average hand speed across all punches that week"}
            />
            <CardContent>
                {values.length < 2 ? (
                    <MinWeeks title="Speed trend appears after 2 complete weeks" />
                ) : (
                    <ChartFigure
                        tableCaption={`Average ${kind.toLowerCase()} speed per week`}
                        table={{
                            columns: ["Week", "Average speed"],
                            rows: values.map((value, index) => [labels[index], value === null ? "Not detected" : `${formatNumber(value, 1)} m/s`]),
                        }}
                    >
                        <LineChart
                            ariaLabel={`Average ${kind.toLowerCase()} speed per week in metres per second`}
                            labels={labels}
                            series={[{ id: "speed", label: `${kind} speed`, color: TECHNIQUE_COLOR[technique], values }]}
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
