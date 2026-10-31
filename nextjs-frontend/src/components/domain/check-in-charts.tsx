import { ChartFigure } from "@/components/charts/chart-figure";
import { CHECK_IN_COLORS } from "@/components/charts/colors";
import { LineChart } from "@/components/charts/line-chart";
import { Sparkline } from "@/components/charts/sparkline";
import { painLabel } from "@/components/clinical/clinical-copy";
import type { RecoveryCheckIn } from "@/lib/domain/types";
import { formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface CheckInChartsProps {
    /** Oldest first. */
    checkIns: RecoveryCheckIn[];
    /** Fighters read about how they felt; clinicians get the change in numbers. Charts are otherwise identical. */
    audience: "fighter" | "clinical";
    className?: string;
}

/** Recovery check-ins over time: pain on its own 0–10 chart, mobility and strength together as % of the healthy side. No dual axes. */
export function CheckInCharts({ checkIns, audience, className }: CheckInChartsProps) {
    const labels = checkIns.map((checkIn) => formatShortDate(checkIn.date));
    const first = checkIns[0];
    const last = checkIns.at(-1);
    const painText = (level: number) => `${level} (${painLabel(level).toLowerCase()})`;
    const painChange = first && last ? `from ${painText(first.painLevel)} to ${painText(last.painLevel)}` : null;

    return (
        <div className={cn("grid grid-cols-1 gap-6 xl:grid-cols-2", className)}>
            <ChartFigure
                title="Pain (0–10)"
                description={
                    audience === "clinical"
                        ? `${painChange ? `Reported ${painChange}` : "Reported pain"} — lower is better`
                        : "How much it hurt at each check-in — lower is better"
                }
                table={{ columns: ["Check-in", "Pain (0–10)"], rows: checkIns.map((checkIn, index) => [labels[index], checkIn.painLevel]) }}
                tableCaption="Reported pain at each check-in"
            >
                <LineChart
                    ariaLabel={`Reported pain across ${checkIns.length} check-ins on a scale of 0 to 10${painChange ? `, ${painChange}` : ""}`}
                    labels={labels}
                    series={[{ id: "pain", label: "Pain", color: CHECK_IN_COLORS.pain, values: checkIns.map((checkIn) => checkIn.painLevel) }]}
                    yDomain={[0, 10]}
                    yTicks={6}
                    height={220}
                    area
                    highlightLast
                />
            </ChartFigure>
            <ChartFigure
                title="Mobility and strength (%)"
                description={
                    audience === "clinical"
                        ? `${last ? `Latest ${last.mobilityPct}% mobility, ${last.strengthPct}% strength` : "Share of the healthy side"} — higher is better`
                        : "Compared with your healthy side — higher is better"
                }
                table={{
                    columns: ["Check-in", "Mobility (%)", "Strength (%)"],
                    rows: checkIns.map((checkIn, index) => [labels[index], checkIn.mobilityPct, checkIn.strengthPct]),
                }}
                tableCaption="Mobility and strength at each check-in, as a percentage of the healthy side"
            >
                <LineChart
                    ariaLabel={`Mobility and strength as a percentage of the healthy side across ${checkIns.length} check-ins`}
                    labels={labels}
                    series={[
                        { id: "mobility", label: "Mobility", color: CHECK_IN_COLORS.mobility, values: checkIns.map((checkIn) => checkIn.mobilityPct) },
                        { id: "strength", label: "Strength", color: CHECK_IN_COLORS.strength, values: checkIns.map((checkIn) => checkIn.strengthPct) },
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
