"use client";

import type { PointerEvent } from "react";

import { cn } from "@/lib/utils";
import { ChartLegend } from "./chart-legend";
import { ChartSurface } from "./chart-surface";
import { besidePlacement, ChartTooltip, type TooltipRow } from "./chart-tooltip";
import { bandLayout, columnPath, crisp, linearScale, valueAt } from "./scale";
import { estimateTextWidth, formatChartValue, formatTick, maxTextWidth, niceScale, visibleLabelIndices, type TickScale } from "./ticks";
import { useActiveIndex } from "./use-active-index";

export interface BarSeries {
    id: string;
    label: string;
    color: string;
    /** One non-negative value per label; `null` means no data. */
    values: (number | null)[];
}

export interface BarDetail {
    id: string;
    label: string;
    /** One value per label; `null` means no data. */
    values: (number | null)[];
}

export interface BarChartProps {
    ariaLabel: string;
    /** Categories along the x axis. */
    labels: string[];
    /** One series, up to four grouped series, or any number of stacked series. */
    series: BarSeries[];
    /** Stack series into one column per category (part-to-whole). */
    stacked?: boolean;
    /**
     * Single-series charts only: breakdown rows listed under the value in the tooltip and keyboard readout
     * (e.g. each fighter's share of a team total). Not drawn; keep the full breakdown in the data table too.
     */
    details?: BarDetail[];
    /** Total height in px, including the x-axis band. */
    height?: number;
    /** Approximate number of y ticks. */
    yTicks?: number;
    /** Custom value formatter. Only usable from Client Components — prefer `valueSuffix`/`decimals`. */
    formatValue?: (value: number) => string;
    /** Unit appended to values, e.g. `" min"`. Single-character suffixes also appear on ticks. */
    valueSuffix?: string;
    decimals?: number;
    className?: string;
}

const AXIS_FONT = 11;
const X_AXIS_BAND = 28;
const MAX_BAR_WIDTH = 24;
const SURFACE_GAP = 2;
const MARGIN_TOP = 10;
const CAP_LABEL_BAND = 22;
const DIMMED_OPACITY = 0.45;

/**
 * Vertical columns over categories: single, grouped (≤4) or stacked series. Thin bars with
 * rounded data ends, 2px surface gaps, cap labels only when every label fits, and a per-bar
 * (grouped) or per-column tooltip on hover and keyboard.
 */
export function BarChart({
    ariaLabel,
    labels,
    series,
    stacked = false,
    details = [],
    height = 240,
    yTicks = 5,
    formatValue,
    valueSuffix = "",
    decimals = 0,
    className,
}: BarChartProps) {
    const grouped = !stacked && series.length > 1;
    const targetCount = grouped ? labels.length * series.length : labels.length;
    const { active, pointAt, handlers } = useActiveIndex(targetCount);
    const format = formatValue ?? ((value: number) => formatChartValue(value, { decimals, suffix: valueSuffix }));
    const scale = niceScale(0, largestColumn(labels.length, series, stacked) || 1, yTicks);

    const readout = active ? describeTarget(active.index, labels, series, grouped, stacked, format, details) : null;

    return (
        <div className={cn("flex flex-col gap-3", className)}>
            {series.length >= 2 && <ChartLegend items={series} marker="square" />}
            <ChartSurface
                ariaLabel={ariaLabel}
                height={height}
                keyboardHint={`Use the left and right arrow keys to read the value of each ${grouped ? "bar" : "column"}.`}
                announcement={active?.source === "keyboard" && readout ? readout.announcement : ""}
                handlers={handlers}
            >
                {(width) => (
                    <BarPlot
                        width={width}
                        height={height}
                        labels={labels}
                        series={series}
                        stacked={stacked}
                        grouped={grouped}
                        scale={scale}
                        format={format}
                        valueSuffix={valueSuffix}
                        activeIndex={active?.index ?? null}
                        readout={readout}
                        onPointAt={pointAt}
                    />
                )}
            </ChartSurface>
        </div>
    );
}

interface Readout {
    title: string;
    rows: TooltipRow[];
    announcement: string;
}

interface BarPlotProps {
    width: number;
    height: number;
    labels: string[];
    series: BarSeries[];
    stacked: boolean;
    grouped: boolean;
    scale: TickScale;
    format: (value: number) => string;
    valueSuffix: string;
    activeIndex: number | null;
    readout: Readout | null;
    onPointAt: (index: number) => void;
}

function BarPlot({ width, height, labels, series, stacked, grouped, scale, format, valueSuffix, activeIndex, readout, onPointAt }: BarPlotProps) {
    const count = labels.length;
    const seriesCount = Math.max(1, series.length);
    const plotBottom = height - X_AXIS_BAND;

    const tickLabels = scale.ticks.map((tick) => formatTick(tick, scale.step, valueSuffix));
    const plotLeft = Math.ceil(maxTextWidth(tickLabels, AXIS_FONT)) + 8;
    const plotRight = width - 4;
    const { step, centers } = bandLayout(count, plotLeft, Math.max(plotLeft + 1, plotRight));

    const barWidth = grouped
        ? clampWidth(Math.floor((step * 0.75 - SURFACE_GAP * (seriesCount - 1)) / seriesCount))
        : clampWidth(Math.floor(step * 0.6));
    const groupWidth = grouped ? seriesCount * barWidth + (seriesCount - 1) * SURFACE_GAP : barWidth;
    const groupLeft = (i: number) => Math.round(centers[i] - groupWidth / 2);

    const capTexts = grouped ? [] : labels.map((_, i) => (hasData(series, i) ? format(columnTotal(series, i, stacked)) : null));
    const showCaps =
        capTexts.some((text) => text !== null) &&
        capTexts.every((text) => text === null || estimateTextWidth(text, AXIS_FONT) <= step - 4);
    const plotTop = showCaps ? CAP_LABEL_BAND : MARGIN_TOP;
    const y = linearScale([0, scale.max], [plotBottom, plotTop]);
    const barTop = (value: number) => (value > 0 ? Math.min(Math.round(y(value)), plotBottom - 1) : plotBottom);

    const maxXLabelWidth = maxTextWidth(labels, AXIS_FONT);
    const shownLabels = new Set(visibleLabelIndices(count, step, maxXLabelWidth));
    const activeCategory = activeIndex === null ? null : grouped ? Math.floor(activeIndex / seriesCount) : activeIndex;
    const activeSeries = activeIndex === null || !grouped ? null : activeIndex % seriesCount;

    const handlePointer = (event: PointerEvent<SVGSVGElement>) => {
        if (count === 0 || step <= 0) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const px = event.clientX - bounds.left;
        if (px < plotLeft || px > plotRight) return;
        const category = Math.min(count - 1, Math.max(0, Math.floor((px - plotLeft) / step)));
        if (!grouped) {
            onPointAt(category);
            return;
        }
        const offset = px - groupLeft(category) + SURFACE_GAP / 2;
        const bar = Math.min(seriesCount - 1, Math.max(0, Math.floor(offset / (barWidth + SURFACE_GAP))));
        onPointAt(category * seriesCount + bar);
    };

    const opacityFor = (category: number, seriesIndex: number) => {
        if (activeCategory === null) return 1;
        if (category !== activeCategory) return DIMMED_OPACITY;
        return activeSeries === null || activeSeries === seriesIndex ? 1 : DIMMED_OPACITY;
    };

    const tooltipAnchor =
        activeCategory === null
            ? null
            : activeSeries === null
              ? centers[activeCategory]
              : groupLeft(activeCategory) + activeSeries * (barWidth + SURFACE_GAP) + barWidth / 2;

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
                                <line x1={plotLeft} x2={plotRight} y1={crisp(tickY)} y2={crisp(tickY)} stroke="var(--chart-grid)" strokeWidth={1} />
                            )}
                            <text x={plotLeft - 8} y={tickY} dy="0.32em" textAnchor="end" className="fill-fg-subtle text-[11px] tabular-nums">
                                {tickLabels[i]}
                            </text>
                        </g>
                    );
                })}

                {labels.map((label, i) => (
                    <g key={`${label}-${i}`}>
                        {grouped
                            ? series.map((s, seriesIndex) => {
                                  const value = positiveValue(s, i);
                                  const x = groupLeft(i) + seriesIndex * (barWidth + SURFACE_GAP);
                                  return (
                                      <path
                                          key={s.id}
                                          d={columnPath(x, barTop(value), barWidth, plotBottom, true)}
                                          fill={s.color}
                                          className="transition-opacity duration-150"
                                          opacity={opacityFor(i, seriesIndex)}
                                      />
                                  );
                              })
                            : stackSegments(series, i, stacked, barTop, plotBottom).map((segment) => (
                                  <path
                                      key={segment.series.id}
                                      d={columnPath(groupLeft(i), segment.top, barWidth, segment.bottom, segment.rounded)}
                                      fill={segment.series.color}
                                      className="transition-opacity duration-150"
                                      opacity={opacityFor(i, 0)}
                                  />
                              ))}

                        {showCaps && capTexts[i] !== null && (
                            <text
                                x={centers[i]}
                                y={barTop(columnTotal(series, i, stacked)) - 6}
                                textAnchor="middle"
                                className="fill-fg-muted text-[11px] tabular-nums"
                            >
                                {capTexts[i]}
                            </text>
                        )}

                        {shownLabels.has(i) && (
                            <text
                                x={clampLabelX(centers[i], estimateTextWidth(label, AXIS_FONT), width)}
                                y={plotBottom + 18}
                                textAnchor="middle"
                                className={cn("text-[11px] tabular-nums", i === activeCategory ? "fill-fg font-medium" : "fill-fg-subtle")}
                            >
                                {label}
                            </text>
                        )}
                    </g>
                ))}

                <line x1={plotLeft} x2={plotRight} y1={crisp(plotBottom)} y2={crisp(plotBottom)} stroke="var(--chart-axis)" strokeWidth={1} />
            </svg>

            {readout && tooltipAnchor !== null && (
                <ChartTooltip title={readout.title} rows={readout.rows} placement={besidePlacement(tooltipAnchor, width, plotTop, barWidth / 2 + 10)} />
            )}
        </>
    );
}

interface Segment {
    series: BarSeries;
    top: number;
    bottom: number;
    rounded: boolean;
}

/**
 * Column segments for one category. Stacked segments are separated by a 2px surface gap and
 * only the topmost segment gets the rounded data end.
 */
function stackSegments(
    series: BarSeries[],
    category: number,
    stacked: boolean,
    barTop: (value: number) => number,
    baseline: number,
): Segment[] {
    const visible = (stacked ? series : series.slice(0, 1)).filter((s) => positiveValue(s, category) > 0);
    const segments: Segment[] = [];
    let cumulative = 0;
    visible.forEach((s, i) => {
        const bottom = i === 0 ? baseline : barTop(cumulative) - SURFACE_GAP;
        cumulative += positiveValue(s, category);
        const top = barTop(cumulative);
        if (bottom - top >= 1) segments.push({ series: s, top, bottom, rounded: i === visible.length - 1 });
    });
    return segments;
}

function describeTarget(
    index: number,
    labels: string[],
    series: BarSeries[],
    grouped: boolean,
    stacked: boolean,
    format: (value: number) => string,
    details: BarDetail[] = [],
): Readout {
    const formatCell = (s: BarSeries, category: number) => {
        const value = valueAt(s.values, category);
        return value === null ? "No data" : format(value);
    };

    if (grouped) {
        const category = Math.floor(index / series.length);
        const s = series[index % series.length];
        const value = formatCell(s, category);
        return {
            title: labels[category],
            rows: [{ id: s.id, label: s.label, color: s.color, value }],
            announcement: `${labels[category]}, ${s.label}: ${value}`,
        };
    }

    const shown = stacked ? [...series].reverse() : series.slice(0, 1);
    const rows: TooltipRow[] = shown.map((s) => ({ id: s.id, label: s.label, color: s.color, value: formatCell(s, index) }));
    if (stacked && series.length > 1) {
        rows.push({ id: "__total", label: "Total", value: format(columnTotal(series, index, true)) });
    }
    if (!stacked) {
        for (const detail of details) {
            const value = valueAt(detail.values, index);
            rows.push({ id: `__detail-${detail.id}`, label: detail.label, value: value === null ? "No data" : format(value) });
        }
    }
    return {
        title: labels[index],
        rows,
        announcement: `${labels[index]}: ${rows.map((row) => `${row.label} ${row.value}`).join(", ")}`,
    };
}

/** Tallest column (stacked total or single bar) so the axis starts at zero and fits every value. */
function largestColumn(count: number, series: BarSeries[], stacked: boolean): number {
    let max = 0;
    for (let i = 0; i < count; i++) {
        max = Math.max(max, stacked ? columnTotal(series, i, true) : Math.max(0, ...series.map((s) => positiveValue(s, i))));
    }
    return max;
}

function positiveValue(series: BarSeries, index: number): number {
    return Math.max(0, valueAt(series.values, index) ?? 0);
}

function hasData(series: BarSeries[], index: number): boolean {
    return series.some((s) => valueAt(s.values, index) !== null);
}

function columnTotal(series: BarSeries[], index: number, stacked: boolean): number {
    return stacked ? series.reduce((sum, s) => sum + positiveValue(s, index), 0) : series[0] ? positiveValue(series[0], index) : 0;
}

function clampWidth(width: number): number {
    return Math.min(MAX_BAR_WIDTH, Math.max(1, width));
}

function clampLabelX(center: number, labelWidth: number, containerWidth: number): number {
    const half = labelWidth / 2;
    return Math.min(containerWidth - half, Math.max(half, center));
}
