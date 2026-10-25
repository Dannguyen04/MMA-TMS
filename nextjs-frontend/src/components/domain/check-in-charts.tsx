import { ChartFigure } from "@/components/charts/chart-figure";
import { CHECK_IN_COLORS } from "@/components/charts/colors";
import { LineChart } from "@/components/charts/line-chart";
import { Sparkline } from "@/components/charts/sparkline";
import { painLabel } from "@/components/clinical/clinical-copy";
import type { RecoveryCheckIn } from "@/lib/domain/types";
import { formatShortDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";

export interface CheckInChartsProps {
    /** Oldest first. */
    checkIns: RecoveryCheckIn[];
    /** Fighters read about how they felt; clinicians get the change in numbers. Charts are otherwise identical. */
    audience: "fighter" | "clinical";
    className?: string;
    locale?: Locale;
}

/** Recovery check-ins over time: pain on its own 0–10 chart, mobility and strength together as % of the healthy side. No dual axes. */
export function CheckInCharts({ checkIns, audience, className, locale = "en" }: CheckInChartsProps) {
    const t = createTranslator(locale);
    const labels = checkIns.map((checkIn) => formatShortDate(checkIn.date, locale));
    const first = checkIns[0];
    const last = checkIns.at(-1);
    const painText = (level: number) => `${level} (${painLabel(level, locale).toLowerCase()})`;
    const painChange = first && last;

    const painDescription =
        audience === "clinical"
            ? painChange
                ? t("checkInCharts.painClinicalDesc", {
                      change: t("checkInCharts.painReportedChange", {
                          from: painText(first.painLevel),
                          to: painText(last.painLevel),
                      }),
                  })
                : t("checkInCharts.painClinicalDescDefault")
            : t("checkInCharts.painFighterDesc");

    const mobilityDescription =
        audience === "clinical"
            ? last
                ? t("checkInCharts.mobilityStrengthClinicalDesc", {
                      mobility: last.mobilityPct,
                      strength: last.strengthPct,
                  })
                : t("checkInCharts.mobilityStrengthClinicalDescDefault")
            : t("checkInCharts.mobilityStrengthFighterDesc");

    return (
        <div className={cn("grid grid-cols-1 gap-6 xl:grid-cols-2", className)}>
            <ChartFigure
                title={t("checkInCharts.painTitle")}
                description={painDescription}
                table={{
                    columns: [t("checkInCharts.painColCheckIn"), t("checkInCharts.painColPain")],
                    rows: checkIns.map((checkIn, index) => [labels[index], checkIn.painLevel]),
                }}
                tableCaption={t("checkInCharts.painTableCaption")}
            >
                <LineChart
                    ariaLabel={t("checkInCharts.painAriaLabel", {
                        count: checkIns.length,
                        change: painChange
                            ? t("checkInCharts.painChangeAria", {
                                  from: painText(first.painLevel),
                                  to: painText(last.painLevel),
                              })
                            : "",
                    })}
                    labels={labels}
                    series={[
                        {
                            id: "pain",
                            label: t("checkInCharts.painSeriesLabel"),
                            color: CHECK_IN_COLORS.pain,
                            values: checkIns.map((checkIn) => checkIn.painLevel),
                        },
                    ]}
                    yDomain={[0, 10]}
                    yTicks={6}
                    height={220}
                    area
                    highlightLast
                />
            </ChartFigure>
            <ChartFigure
                title={t("checkInCharts.mobilityStrengthTitle")}
                description={mobilityDescription}
                table={{
                    columns: [
                        t("checkInCharts.mobilityColCheckIn"),
                        t("checkInCharts.mobilityColMobility"),
                        t("checkInCharts.mobilityColStrength"),
                    ],
                    rows: checkIns.map((checkIn, index) => [labels[index], checkIn.mobilityPct, checkIn.strengthPct]),
                }}
                tableCaption={t("checkInCharts.mobilityStrengthTableCaption")}
            >
                <LineChart
                    ariaLabel={t("checkInCharts.mobilityStrengthAriaLabel", { count: checkIns.length })}
                    labels={labels}
                    series={[
                        {
                            id: "mobility",
                            label: t("checkInCharts.mobilitySeriesLabel"),
                            color: CHECK_IN_COLORS.mobility,
                            values: checkIns.map((checkIn) => checkIn.mobilityPct),
                        },
                        {
                            id: "strength",
                            label: t("checkInCharts.strengthSeriesLabel"),
                            color: CHECK_IN_COLORS.strength,
                            values: checkIns.map((checkIn) => checkIn.strengthPct),
                        },
                    ]}
                    yDomain={[0, 100]}
                    valueSuffix="%"
                    height={220}
                    highlightLast
                />
            </ChartFigure>
        </div>
    );
}

export interface CheckInTrendTileProps {
    label: string;
    value: string;
    detail: string;
    /** Oldest first; the sparkline appears from two values. */
    values: number[];
    color: string;
    ariaLabel: string;
    className?: string;
}

/** Latest value of one check-in measure with its recent trend. */
export function CheckInTrendTile({ label, value, detail, values, color, ariaLabel, className }: CheckInTrendTileProps) {
    return (
        <div className={cn("flex min-w-0 items-end justify-between gap-3 rounded-lg bg-surface-muted px-3 py-2.5", className)}>
            <p className="min-w-0 leading-tight">
                <span className="block text-xs text-fg-muted">{label}</span>
                <span className="mt-0.5 block text-lg font-semibold text-fg">{value}</span>
                <span className="mt-0.5 block text-xs text-pretty text-fg-subtle">{detail}</span>
            </p>
            {values.length >= 2 && <Sparkline values={values} color={color} width={64} height={28} className="shrink-0" ariaLabel={ariaLabel} />}
        </div>
    );
}
