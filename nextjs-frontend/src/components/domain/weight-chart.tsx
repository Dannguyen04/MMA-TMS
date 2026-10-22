"use client";

import { ChartFigure } from "@/components/charts/chart-figure";
import { CHART_MUTED, seriesColor } from "@/components/charts/colors";
import { LineChart } from "@/components/charts/line-chart";
import { useLocale, useT } from "@/components/i18n/locale-provider";
import { PLAN_ADHERENCE_LABELS } from "@/lib/domain/labels";
import { weightChartData, type PlanAdherence, type WeightChartTrack } from "@/lib/domain/weight-chart";
import { academyDayStartIso, formatNumber, formatShortDate } from "@/lib/format";
import type { Translator } from "@/lib/i18n/translate";

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
    const t = useT();
    const locale = useLocale();
    const data = weightChartData(track, from, to);
    if (data.labels.length === 0) {
        return <p className="text-sm text-fg-muted">{t("boutFighter.chart.empty")}</p>;
    }

    const labels = data.labels.map((day) => formatShortDate(academyDayStartIso(day), locale));
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
        return [[labels[index], kg(weight), kg(data.reference[index]), answer ? t(`boutLabel.adherence.${answer}`) : "—"]];
    });

    return (
        <ChartFigure
            className={className}
            tableCaption={t("boutFighter.chart.tableCaption")}
            table={{
                columns: [t("boutFighter.chart.day"), t("boutFighter.chart.weight"), t("boutFighter.chart.reference"), t("boutFighter.chart.planAnswer")],
                rows,
            }}
        >
            <LineChart
                ariaLabel={chartAriaLabel(track, t)}
                labels={labels}
                series={[
                    { id: "weight", label: t("boutFighter.chart.weight"), color: seriesColor(1), values: data.weight, pointColors },
                    { id: "reference", label: t("boutFighter.chart.reference"), color: CHART_MUTED, values: data.reference },
                ]}
                valueSuffix=" kg"
                decimals={1}
                target={track.limitKg === null ? undefined : { value: track.limitKg, label: t("boutFighter.chart.limit") }}
            />
            {hasAdherence && (
                <ul aria-label={t("boutFighter.chart.legend")} className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted">
                    {ADHERENCE_ORDER.map((answer) => (
                        <li key={answer} className="inline-flex items-center gap-1.5">
                            <span aria-hidden className="size-2 rounded-full" style={{ background: ADHERENCE_COLOR[answer] }} />
                            {t(`boutLabel.adherence.${answer}`)}
                        </li>
                    ))}
                </ul>
            )}
        </ChartFigure>
    );
}

/** Screen-reader summary in the viewer's language; the English text matches `weightChartAriaLabel`. */
function chartAriaLabel(track: WeightChartTrack, t: Translator): string {
    const latest = track.latestKg === null ? t("boutFighter.chart.ariaNoWeight") : t("boutFighter.chart.ariaLatest", { kg: formatNumber(track.latestKg, 1) });
    const status = t(`boutLabel.weightStatus.${track.status}`);
    return track.limitKg === null
        ? t("boutFighter.chart.ariaNoLimit", { latest, status })
        : t("boutFighter.chart.aria", { limit: formatNumber(track.limitKg, 1), latest, status });
}
