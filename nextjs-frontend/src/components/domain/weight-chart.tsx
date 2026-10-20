import { LineChart } from "@/components/charts/line-chart";
import { CHART_MUTED, CHART_SERIES } from "@/components/charts/colors";
import type { WeightTrack } from "@/lib/domain/types";
import { weightChartData, weightChartRange } from "@/lib/domain/weight-chart";
import { dayKey, formatNumber } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import type { Translator } from "@/lib/i18n/translate";

export interface WeightChartProps {
    track: WeightTrack;
    /** The bout's weigh-in time; the chart runs up to that day. */
    weighInAt: string;
    t: Translator;
    locale: Locale;
    height?: number;
    className?: string;
}

/**
 * Daily weigh-ins against the reference cut path and the weight limit. Days without a weigh-in leave a
 * gap. Status is never read from the line colour: the card that holds the chart shows the badge.
 */
export function WeightChart({ track, weighInAt, t, locale, height = 240, className }: WeightChartProps) {
    const { from, to } = weightChartRange(track, dayKey(weighInAt));
    const data = weightChartData(track, from, to, locale);
    const latest = track.latestKg === null ? t("chart.ariaNoWeighIn") : t("chart.ariaLatest", { kg: formatNumber(track.latestKg, 1) });

    return (
        <LineChart
            ariaLabel={t("chart.aria", { limit: formatNumber(track.limitKg, 1), latest, status: t(`weightStatus.${track.status}`) })}
            labels={data.labels}
            series={[
                { id: "weight", label: t("chart.weight"), color: CHART_SERIES[0], values: data.weight },
                { id: "reference", label: t("chart.reference"), color: CHART_MUTED, values: data.reference },
            ]}
            target={{ value: data.target.value, label: t("chart.limit") }}
            valueSuffix=" kg"
            decimals={1}
            height={height}
            className={className}
        />
    );
}
