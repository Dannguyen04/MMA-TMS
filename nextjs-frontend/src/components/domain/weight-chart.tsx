"use client";

import { CHART_MUTED, seriesColor } from "@/components/charts/colors";
import { LineChart } from "@/components/charts/line-chart";
import { weightChartAriaLabel, weightChartData, type PlanAdherence, type WeightChartTrack } from "@/lib/domain/weight-chart";
import { academyDayStartIso, formatShortDate } from "@/lib/format";

const ADHERENCE_COLOR: Record<PlanAdherence, string> = {
    ON_PLAN: "var(--success-solid)",
    SLIGHTLY_OFF: "var(--warning-solid)",
    WAY_OFF: "var(--danger-solid)",
};

const ADHERENCE_LABEL: Record<PlanAdherence, string> = {
    ON_PLAN: "On plan",
    SLIGHTLY_OFF: "Slightly off",
    WAY_OFF: "Way off",
};

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
 * with no log, and the limit is the dashed reference.
 */
export function WeightChart({ track, from, to, className }: WeightChartProps) {
    const data = weightChartData(track, from, to);
    if (data.labels.length === 0) {
        return <p className="text-sm text-fg-muted">No camp days to chart yet.</p>;
    }

    const labels = data.labels.map((day) => formatShortDate(academyDayStartIso(day)));
    const weightColor = seriesColor(1);
    const hasAdherence = data.adherence.some((answer) => answer !== null);
    const pointColors = hasAdherence
        ? data.weight.map((kg, index) => {
              const answer = data.adherence[index];
              return kg === null || answer === null ? null : ADHERENCE_COLOR[answer];
          })
        : undefined;

    return (
        <div className="flex min-w-0 flex-col gap-3">
            <LineChart
                ariaLabel={weightChartAriaLabel(track)}
                labels={labels}
                series={[
                    { id: "weight", label: "Weight", color: weightColor, values: data.weight, pointColors },
                    { id: "reference", label: "Reference", color: CHART_MUTED, values: data.reference },
                ]}
                valueSuffix=" kg"
                decimals={1}
                target={track.limitKg === null ? undefined : { value: track.limitKg, label: "Limit" }}
                className={className}
            />
            {hasAdherence && (
                <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted">
                    {(Object.keys(ADHERENCE_LABEL) as PlanAdherence[]).map((answer) => (
                        <li key={answer} className="inline-flex items-center gap-1.5">
                            <span aria-hidden className="size-2 rounded-full" style={{ background: ADHERENCE_COLOR[answer] }} />
                            {ADHERENCE_LABEL[answer]}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
