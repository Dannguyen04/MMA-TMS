"use client";

import type { PointerEvent } from "react";

import { cn } from "@/lib/utils";
import { ChartLegend } from "./chart-legend";
import { ChartSurface } from "./chart-surface";
import { besidePlacement, ChartTooltip } from "./chart-tooltip";
import { areaPath, crisp, definedRuns, linearScale, linePath, nearestIndex, pointPositions, valueAt, type Point } from "./scale";
import { formatChartValue, formatTick, maxTextWidth, niceScale, ticksWithin, visibleLabelIndices, type TickScale } from "./ticks";
import { useActiveIndex } from "./use-active-index";

export interface LineSeries {
    id: string;
    label: string;
    /** Series colour, e.g. `TECHNIQUE_COLOR.jab` or `seriesColor(1)`. */
    color: string;
    /** One value per label; `null` draws a gap. */
    values: (number | null)[];
}

export interface LineChartProps {
    ariaLabel: string;
    /** X categories in order, e.g. week labels. */
    labels: string[];
    series: LineSeries[];
    /** Total height in px, including the x-axis band. */
    height?: number;
    /** Fixed y domain, e.g. `[0, 100]` for scores. Defaults to clean bounds around the data. */
    yDomain?: [number, number];
    /** Approximate number of y ticks. */
    yTicks?: number;
    /** Custom value formatter. Only usable from Client Components — prefer `valueSuffix`/`decimals`. */
    formatValue?: (value: number) => string;
    /** Unit appended to values, e.g. `"%"` or `" min"`. Single-character suffixes also appear on ticks. */
    valueSuffix?: string;
    decimals?: number;
    /** Soft 10% wash under the line (single-series charts only); the y axis then starts at zero. */
    area?: boolean;
    /** Horizontal reference line, e.g. a goal target. */
    target?: { value: number; label: string };
    /** Emphasises the latest period: its x label and direct value labels at the line ends. */
    highlightLast?: boolean;
    className?: string;
}

const AXIS_FONT = 11;
const END_LABEL_FONT = 12;
const MARGIN_TOP = 12;
const X_AXIS_BAND = 28;
const DOT_RADIUS = 5;
const MIN_END_LABEL_SPACING = 14;

/**
 * Trend over ordered categories: 2px lines with end dots, hairline grid, one y axis,
 * a crosshair tooltip on hover and keyboard (ArrowLeft/ArrowRight), and gaps for missing values.
 */
export function LineChart({
    ariaLabel,
    labels,
    series,
    height = 240,
    yDomain,
    yTicks = 5,
    formatValue,
    valueSuffix = "",
    decimals = 0,
    area = false,
    target,
    highlightLast = false,
    className,
}: LineChartProps) {
    const { active, pointAt, handlers } = useActiveIndex(labels.length);
    const format = formatValue ?? ((value: number) => formatChartValue(value, { decimals, suffix: valueSuffix }));
    const showArea = area && series.length === 1;
    const scale = resolveScale(series, target, yDomain, yTicks, showArea);

    const announcement =
        active?.source === "keyboard"
            ? `${labels[active.index]}: ${series.map((s) => `${s.label} ${formatMaybe(valueAt(s.values, active.index), format)}`).join(", ")}`
            : "";

    return (
        <div className={cn("flex flex-col gap-3", className)}>
            {series.length >= 2 && <ChartLegend items={series} marker="line" />}
            <ChartSurface
                ariaLabel={ariaLabel}
                height={height}
                keyboardHint="Use the left and right arrow keys to read the values for each period."
                announcement={announcement}
                handlers={handlers}
            >
                {(width) => (
                    <LinePlot
                        width={width}
                        height={height}
                        labels={labels}
                        series={series}
                        scale={scale}
                        format={format}
                        valueSuffix={valueSuffix}
                        showArea={showArea}
                        target={target}
                        highlightLast={highlightLast}
                        activeIndex={active?.index ?? null}
                        onPointAt={pointAt}
                    />
                )}
            </ChartSurface>
        </div>
    );
}

interface LinePlotProps {
    width: number;
    height: number;
    labels: string[];
    series: LineSeries[];
    scale: TickScale;
    format: (value: number) => string;
    valueSuffix: string;
    showArea: boolean;
    target: LineChartProps["target"];
    highlightLast: boolean;
    activeIndex: number | null;
    onPointAt: (index: number) => void;
}

function LinePlot({
    width,
    height,
    labels,
    series,
    scale,
    format,
    valueSuffix,
    showArea,
    target,
    highlightLast,
    activeIndex,
    onPointAt,
}: LinePlotProps) {
    const plotTop = MARGIN_TOP;
    const plotBottom = height - X_AXIS_BAND;
    const y = linearScale([scale.min, scale.max], [plotBottom, plotTop]);
    const lastIndex = labels.length - 1;

    const tickLabels = scale.ticks.map((tick) => formatTick(tick, scale.step, valueSuffix));
    const plotLeft = Math.ceil(maxTextWidth(tickLabels, AXIS_FONT)) + 8;
    const maxXLabelWidth = maxTextWidth(labels, AXIS_FONT);
    const halfXLabel = Math.ceil(maxXLabelWidth / 2);

    const endLabels = highlightLast ? endValueLabels(series, lastIndex, y, format) : [];
    const endLabelSpace = endLabels.length > 0 ? Math.ceil(maxTextWidth(endLabels.map((l) => l.text), END_LABEL_FONT)) + 14 : 0;

    const xStart = Math.max(plotLeft + 8, halfXLabel);
    const xEnd = Math.max(xStart + 1, width - Math.max(8, halfXLabel, endLabelSpace));
    const gridRight = Math.min(width, xEnd + 8);
    const xs = pointPositions(labels.length, xStart, xEnd);
    const step = xs.length > 1 ? xs[1] - xs[0] : xEnd - xStart;
    const shownLabels = new Set(visibleLabelIndices(labels.length, step, maxXLabelWidth));

    const lines = series.map((s) => {
        const points = labels.map<Point | null>((_, i) => {
            const value = valueAt(s.values, i);
            return value === null ? null : { x: xs[i], y: y(value) };
        });
        let lastPoint: Point | null = null;
        for (const point of points) if (point) lastPoint = point;
        return { series: s, points, runs: definedRuns(points), lastPoint };
    });

    const targetY = target ? y(target.value) : null;

    const handlePointer = (event: PointerEvent<SVGSVGElement>) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        onPointAt(nearestIndex(xs, event.clientX - bounds.left));
    };

    return (
        <>
            <svg
                width={width}
                height={height}
                viewBox={`0 0 ${width} ${height}`}
                aria-hidden
                className="block touch-pan-y"
                onPointerMove={handlePointer}
                onPointerDown={handlePointer}
            >
                {scale.ticks.map((tick, i) => {
                    const tickY = y(tick);
                    return (
                        <g key={tick}>
                            {Math.abs(tickY - plotBottom) > 0.5 && (
                                <line x1={plotLeft} x2={gridRight} y1={crisp(tickY)} y2={crisp(tickY)} stroke="var(--chart-grid)" strokeWidth={1} />
                            )}
                            <text x={plotLeft - 8} y={tickY} dy="0.32em" textAnchor="end" className="fill-fg-subtle text-[11px] tabular-nums">
                                {tickLabels[i]}
                            </text>
                        </g>
                    );
                })}
                <line x1={plotLeft} x2={gridRight} y1={crisp(plotBottom)} y2={crisp(plotBottom)} stroke="var(--chart-axis)" strokeWidth={1} />

                {labels.map((label, i) =>
                    shownLabels.has(i) ? (
                        <text
                            key={`${label}-${i}`}
                            x={xs[i]}
                            y={plotBottom + 18}
                            textAnchor="middle"
                            className={cn(
                                "text-[11px] tabular-nums",
                                (highlightLast && i === lastIndex) || i === activeIndex ? "fill-fg font-medium" : "fill-fg-subtle",
                            )}
                        >
                            {label}
                        </text>
                    ) : null,
                )}

                {activeIndex !== null && (
                    <line
                        x1={crisp(xs[activeIndex])}
                        x2={crisp(xs[activeIndex])}
                        y1={plotTop}
                        y2={plotBottom}
                        stroke="var(--chart-axis)"
                        strokeWidth={1}
                    />
                )}

                {target && targetY !== null && (
                    <g>
                        <line
                            x1={plotLeft}
                            x2={gridRight}
                            y1={crisp(targetY)}
                            y2={crisp(targetY)}
                            stroke="var(--fg-subtle)"
                            strokeWidth={1}
                            strokeDasharray="4 3"
                        />
                        <text
                            x={xStart}
                            y={targetY - plotTop < 16 ? targetY + 14 : targetY - 6}
                            className="fill-fg-muted text-[11px] font-medium"
                            stroke="var(--chart-surface)"
                            strokeWidth={4}
                            strokeLinejoin="round"
                            paintOrder="stroke"
                        >
                            {`${target.label} · ${format(target.value)}`}
                        </text>
                    </g>
                )}

                {showArea &&
                    lines[0]?.runs.map((run, i) => (
                        <path key={`area-${i}`} d={areaPath(run, plotBottom)} fill={lines[0].series.color} fillOpacity={0.1} />
                    ))}

                {lines.map((line) => (
                    <g key={line.series.id}>
                        {line.runs.map((run, i) =>
                            run.length > 1 ? (
                                <path
                                    key={i}
                                    d={linePath(run)}
                                    fill="none"
                                    stroke={line.series.color}
                                    strokeWidth={2}
                                    strokeLinejoin="round"
                                    strokeLinecap="round"
                                />
                            ) : (
                                <Dot key={i} point={run[0]} color={line.series.color} />
                            ),
                        )}
                        {line.lastPoint && <Dot point={line.lastPoint} color={line.series.color} />}
                    </g>
                ))}

                {activeIndex !== null &&
                    lines.map((line) => {
                        const point = line.points[activeIndex];
                        return point ? <Dot key={`active-${line.series.id}`} point={point} color={line.series.color} /> : null;
                    })}

                {endLabels.map((label) => (
                    <text
                        key={`end-${label.id}`}
                        x={xEnd + 10}
                        y={label.y}
                        dy="0.32em"
                        className="fill-fg text-xs font-medium tabular-nums"
                    >
                        {label.text}
                    </text>
                ))}
            </svg>

            {activeIndex !== null && (
                <ChartTooltip
                    title={labels[activeIndex]}
                    rows={series.map((s) => ({
                        id: s.id,
                        label: s.label,
                        color: s.color,
                        value: formatMaybe(valueAt(s.values, activeIndex), format),
                    }))}
                    placement={besidePlacement(xs[activeIndex], width, plotTop)}
                />
            )}
        </>
    );
}

/** Data dot: at least 8px of series colour inside a 2px surface ring. */
function Dot({ point, color }: { point: Point; color: string }) {
    return <circle cx={point.x} cy={point.y} r={DOT_RADIUS} fill={color} stroke="var(--chart-surface)" strokeWidth={2} />;
}

function formatMaybe(value: number | null, format: (value: number) => string): string {
    return value === null ? "No data" : format(value);
}

function resolveScale(
    series: LineSeries[],
    target: LineChartProps["target"],
    yDomain: LineChartProps["yDomain"],
    yTicks: number,
    includeZero: boolean,
): TickScale {
    if (yDomain) return ticksWithin(yDomain[0], yDomain[1], yTicks);
    const values = series.flatMap((s) => s.values.filter((v): v is number => v !== null && Number.isFinite(v)));
    if (target) values.push(target.value);
    if (values.length === 0) return niceScale(0, 1, yTicks);
    const min = Math.min(...values);
    const max = Math.max(...values);
    return includeZero ? niceScale(Math.min(0, min), Math.max(0, max), yTicks) : niceScale(min, max, yTicks);
}

/**
 * Direct value labels for series that have a value in the latest period. Labels are never
 * nudged apart: when any two would collide, all are dropped and the legend and tooltip carry identity.
 */
function endValueLabels(
    series: LineSeries[],
    lastIndex: number,
    y: (value: number) => number,
    format: (value: number) => string,
): { id: string; y: number; text: string }[] {
    if (lastIndex < 0) return [];
    const labels = series.flatMap((s) => {
        const value = valueAt(s.values, lastIndex);
        return value === null ? [] : [{ id: s.id, y: y(value), text: format(value) }];
    });
    labels.sort((a, b) => a.y - b.y);
    const collides = labels.some((label, i) => i > 0 && label.y - labels[i - 1].y < MIN_END_LABEL_SPACING);
    return collides ? [] : labels;
}
