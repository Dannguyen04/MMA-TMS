"use client";

import { ChartFigure } from "@/components/charts/chart-figure";
import { CHART_MUTED, seriesColor } from "@/components/charts/colors";
import { LineChart } from "@/components/charts/line-chart";
import { PLAN_ADHERENCE_LABELS } from "@/lib/domain/labels";
import { weightChartAriaLabel, weightChartData, type PlanAdherence, type WeightChartTrack } from "@/lib/domain/weight-chart";
import { academyDayStartIso, formatNumber, formatShortDate } from "@/lib/format";

const ADHERENCE_COLOR: Record<PlanAdherence, string> = {
    ON_PLAN: "var(--success-solid)",
    SLIGHTLY_OFF: "var(--warning-solid)",
    WAY_OFF: "var(--danger-solid)",
};

const ADHERENCE_ORDER = Object.keys(PLAN_ADHERENCE_LABELS) as PlanAdherence[];

export interface WeightChartProps {
    track: WeightChartTrack;
    /** Academy date the axis starts on. */
    from: string;
    /** Academy date the axis ends on, usually weigh-in day. */
    to: string;
    className?: string;
}

/**
 * Camp weight against the bout limit. Uses the shared line chart: a gap is a day
 * with no log, and the limit is the dashed reference. The data table repeats every
 * day with the plan answer in words, so the coloured dots are never the only record.
 */
export function WeightChart({ track, from, to, className }: WeightChartProps) {
    const data = weightChartData(track, from, to);
    if (data.labels.length === 0) {
        return <p className="text-sm text-fg-muted">No camp days to chart yet.</p>;
    }

    const labels = data.labels.map((day) => formatShortDate(academyDayStartIso(day)));
    const hasAdherence = data.adherence.some((answer) => answer !== null);
    const pointColors = hasAdherence
        ? data.weight.map((kg, index) => {
              const answer = data.adherence[index];
              return kg === null || answer === null ? null : ADHERENCE_COLOR[answer];
          })
        : undefined;
    const kg = (value: number | null) => (value === null ? "—" : `${formatNumber(value, 1)} kg`);
    const rows = data.labels.flatMap((_, index) => {
        const weight = data.weight[index];
        const answer = data.adherence[index];
        if (weight === null && answer === null) return [];
        return [[labels[index], kg(weight), kg(data.reference[index]), answer ? PLAN_ADHERENCE_LABELS[answer] : "—"]];
    });

    return (
        <ChartFigure className={className} tableCaption="Camp weight by day" table={{ columns: ["Day", "Weight", "Reference", "Plan answer"], rows }}>
            <LineChart
                ariaLabel={weightChartAriaLabel(track)}
                labels={labels}
                series={[
                    { id: "weight", label: "Weight", color: seriesColor(1), values: data.weight, pointColors },
                    { id: "reference", label: "Reference", color: CHART_MUTED, values: data.reference },
                ]}
                valueSuffix=" kg"
                decimals={1}
                target={track.limitKg === null ? undefined : { value: track.limitKg, label: "Limit" }}
            />
            {hasAdherence && (
                <ul aria-label="Plan answer dots" className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted">
                    {ADHERENCE_ORDER.map((answer) => (
                        <li key={answer} className="inline-flex items-center gap-1.5">
                            <span aria-hidden className="size-2 rounded-full" style={{ background: ADHERENCE_COLOR[answer] }} />
                            {PLAN_ADHERENCE_LABELS[answer]}
                        </li>
                    ))}
                </ul>
            )}
        </ChartFigure>
    );
}
