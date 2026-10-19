import { LineChart } from "@/components/charts/line-chart";
import { CHART_MUTED, CHART_SERIES } from "@/components/charts/colors";
import { WEIGHT_WARNING_LABELS } from "@/lib/domain/labels";
import type { WeightTrack } from "@/lib/domain/types";
import { weightChartData, weightChartRange } from "@/lib/domain/weight-chart";
import { dayKey, formatNumber } from "@/lib/format";

export interface WeightChartProps {
    track: WeightTrack;
    /** The bout's weigh-in time; the chart runs up to that day. */
    weighInAt: string;
    height?: number;
    className?: string;
}

/**
 * Daily weigh-ins against the reference cut path and the weight limit. Days without a weigh-in leave a
 * gap. Status is never read from the line colour: the card that holds the chart shows the badge.
 */
export function WeightChart({ track, weighInAt, height = 240, className }: WeightChartProps) {
    const { from, to } = weightChartRange(track, dayKey(weighInAt));
    const data = weightChartData(track, from, to);
    const latest = track.latestKg === null ? "no weigh-in yet" : `latest ${formatNumber(track.latestKg, 1)} kg`;

    return (
        <LineChart
            ariaLabel={`Weight trend: limit ${formatNumber(track.limitKg, 1)} kg, ${latest}, status ${WEIGHT_WARNING_LABELS[track.status]}.`}
            labels={data.labels}
            series={[
                { id: "weight", label: "Weight", color: CHART_SERIES[0], values: data.weight },
                { id: "reference", label: "Reference", color: CHART_MUTED, values: data.reference },
            ]}
            target={data.target}
            valueSuffix=" kg"
            decimals={1}
            height={height}
            className={className}
        />
    );
}
