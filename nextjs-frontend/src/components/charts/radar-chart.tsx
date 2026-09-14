"use client";

import type { PointerEvent } from "react";

import { cn } from "@/lib/utils";
import { ChartLegend } from "./chart-legend";
import { ChartSurface } from "./chart-surface";
import { ChartTooltip, type TooltipPlacement } from "./chart-tooltip";
import { angleDistance, polarPoint, polygonPath, radarAngle, valueAt, type Point } from "./scale";
import { formatChartValue, maxTextWidth } from "./ticks";
import { useActiveIndex } from "./use-active-index";

export interface RadarAxis {
    key: string;
    label: string;
}

export interface RadarSeries {
    id: string;
    label: string;
    color: string;
    /** One value per axis, on the 0–`max` scale. */
    values: number[];
}

export interface RadarChartProps {
    ariaLabel: string;
    /** Axes in clockwise order; eight axes draw the octagon grid. */
    axes: RadarAxis[];
    /** One or two series: the current profile first, then an optional comparison. */
    series: RadarSeries[];
    /** Value at the outer ring. */
    max?: number;
    /** Height of the drawing in px; the width follows the container. */
    size?: number;
    /** Unit appended to tooltip values, e.g. `"%"`. */
    valueSuffix?: string;
    decimals?: number;
    className?: string;
}

const LABEL_FONT = 12;
const LABEL_GAP = 10;
const LABEL_LINE = 14;
const EDGE_PAD = 4;
const RINGS = [0.25, 0.5, 0.75, 1];
const DOT_RADIUS = 5;
const ACTIVE_DOT_RADIUS = 6;
const HIT_OVERSHOOT = 48;
/** Wrap axis labels onto two lines only when it enlarges the radius by at least this much. */
const MIN_WRAP_GAIN = 8;

/**
 * Technique profile on a polygon grid — an octagon for the eight techniques, the product's
 * cage signature. The first series is drawn on top with dots; hover or ArrowLeft/ArrowRight
 * reads every series on one axis.
 */
export function RadarChart({ ariaLabel, axes, series, max = 100, size = 300, valueSuffix = "", decimals = 0, className }: RadarChartProps) {
    const { active, pointAt, handlers } = useActiveIndex(axes.length, { wrap: true, initial: "first" });
    const format = (value: number | null) => (value === null ? "No data" : formatChartValue(value, { decimals, suffix: valueSuffix }));

    const announcement =
        active?.source === "keyboard"
            ? `${axes[active.index].label}: ${series.map((s) => `${s.label} ${format(valueAt(s.values, active.index))}`).join(", ")}`
            : "";

    return (
        <div className={cn("flex flex-col gap-3", className)}>
            {series.length >= 2 && <ChartLegend items={series} marker="square" />}
            <ChartSurface
                ariaLabel={ariaLabel}
                height={size}
                keyboardHint="Use the left and right arrow keys to read the values on each axis."
                announcement={announcement}
                handlers={handlers}
            >
                {(width) => (
                    <RadarPlot
                        width={width}
                        size={size}
                        axes={axes}
                        series={series}
                        max={max}
                        format={format}
                        activeIndex={active?.index ?? null}
                        onPointAt={pointAt}
                    />
                )}
            </ChartSurface>
        </div>
    );
}

interface RadarPlotProps {
    width: number;
    size: number;
    axes: RadarAxis[];
    series: RadarSeries[];
    max: number;
    format: (value: number | null) => string;
    activeIndex: number | null;
    onPointAt: (index: number) => void;
}

function RadarPlot({ width, size, axes, series, max, format, activeIndex, onPointAt }: RadarPlotProps) {
    const count = axes.length;
    const center: Point = { x: width / 2, y: size / 2 };
    const angles = axes.map((_, i) => radarAngle(i, count));
    const singleLine = layoutLabels(axes, false);
    const wrapped = layoutLabels(axes, true);
    const singleLineRadius = fitRadius(width, size, angles, singleLine);
    const wrappedRadius = fitRadius(width, size, angles, wrapped);
    const wrap = wrappedRadius >= singleLineRadius + MIN_WRAP_GAIN;
    const labels = wrap ? wrapped : singleLine;
    const radius = wrap ? wrappedRadius : singleLineRadius;

    const ring = (fraction: number) => polygonPath(angles.map((angle) => polarPoint(center, radius * fraction, angle)));
    const shapes = series.map((s) => ({
        series: s,
        points: angles.map((angle, i) => polarPoint(center, radius * normalized(valueAt(s.values, i), max), angle)),
    }));

    const handlePointer = (event: PointerEvent<SVGSVGElement>) => {
        if (count < 3) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const dx = event.clientX - bounds.left - center.x;
        const dy = event.clientY - bounds.top - center.y;
        if (Math.hypot(dx, dy) > radius + HIT_OVERSHOOT) return;
        const pointer = Math.atan2(dy, dx);
        let nearest = 0;
        angles.forEach((angle, i) => {
            if (angleDistance(angle, pointer) < angleDistance(angles[nearest], pointer)) nearest = i;
        });
        onPointAt(nearest);
    };

    if (count < 3) return null;

    return (
        <>
            <svg
                width={width}
                height={size}
                viewBox={`0 0 ${width} ${size}`}
                aria-hidden
                className="block touch-pan-y"
                onPointerMove={handlePointer}
                onPointerDown={handlePointer}
            >
                {RINGS.map((fraction) => (
                    <path
                        key={fraction}
                        d={ring(fraction)}
                        fill="none"
                        stroke={fraction === 1 ? "var(--chart-axis)" : "var(--chart-grid)"}
                        strokeWidth={1}
                        strokeLinejoin="round"
                    />
                ))}

                {angles.map((angle, i) => {
                    const outer = polarPoint(center, radius, angle);
                    return (
                        <line
                            key={axes[i].key}
                            x1={center.x}
                            y1={center.y}
                            x2={outer.x}
                            y2={outer.y}
                            stroke={i === activeIndex ? "var(--chart-axis)" : "var(--chart-grid)"}
                            strokeWidth={1}
                        />
                    );
                })}

                {[...shapes].reverse().map((shape) => (
                    <path
                        key={shape.series.id}
                        d={polygonPath(shape.points)}
                        fill={shape.series.color}
                        fillOpacity={0.12}
                        stroke={shape.series.color}
                        strokeWidth={2}
                        strokeLinejoin="round"
                    />
                ))}

                {[...shapes].reverse().map((shape, reversedIndex) => {
                    const isPrimary = reversedIndex === shapes.length - 1;
                    return (
                        <g key={`dots-${shape.series.id}`}>
                            {shape.points.map((point, i) =>
                                isPrimary || i === activeIndex ? (
                                    <circle
                                        key={axes[i].key}
                                        cx={point.x}
                                        cy={point.y}
                                        r={i === activeIndex ? ACTIVE_DOT_RADIUS : DOT_RADIUS}
                                        fill={shape.series.color}
                                        stroke="var(--chart-surface)"
                                        strokeWidth={2}
                                    />
                                ) : null,
                            )}
                        </g>
                    );
                })}

                {axes.map((axis, i) => {
                    const { lines } = labels[i];
                    const position = labelPosition(center, radius, angles[i], lines.length);
                    return (
                        <text
                            key={axis.key}
                            x={position.x}
                            y={position.y}
                            textAnchor={position.anchor}
                            className={cn("text-xs", i === activeIndex ? "fill-fg font-medium" : "fill-fg-muted")}
                        >
                            {lines.map((line, lineIndex) => (
                                <tspan key={lineIndex} x={position.x} dy={lineIndex === 0 ? position.firstLineDy : LABEL_LINE}>
                                    {line}
                                </tspan>
                            ))}
                        </text>
                    );
                })}
            </svg>

            {activeIndex !== null && (
                <ChartTooltip
                    title={axes[activeIndex].label}
                    rows={series.map((s) => ({ id: s.id, label: s.label, color: s.color, value: format(valueAt(s.values, activeIndex)) }))}
                    placement={cornerPlacement(Math.cos(angles[activeIndex]), width)}
                />
            )}
        </>
    );
}

type Anchor = "start" | "middle" | "end";

function labelAnchor(angle: number): Anchor {
    const cos = Math.cos(angle);
    if (Math.abs(cos) < 0.2) return "middle";
    return cos > 0 ? "start" : "end";
}

interface AxisLabelLayout {
    lines: string[];
    width: number;
}

/** Splits a multi-word label into two lines at the space that best balances their widths. */
function wrapLabel(label: string): string[] {
    const words = label.split(/\s+/).filter(Boolean);
    let best = [label];
    let bestWidth = maxTextWidth(best, LABEL_FONT);
    for (let i = 1; i < words.length; i++) {
        const lines = [words.slice(0, i).join(" "), words.slice(i).join(" ")];
        const width = maxTextWidth(lines, LABEL_FONT);
        if (width < bestWidth) {
            best = lines;
            bestWidth = width;
        }
    }
    return best;
}

function layoutLabels(axes: RadarAxis[], wrap: boolean): AxisLabelLayout[] {
    return axes.map((axis) => {
        const lines = wrap ? wrapLabel(axis.label) : [axis.label];
        return { lines, width: maxTextWidth(lines, LABEL_FONT) };
    });
}

/** Axis label block just outside the outer ring, anchored away from the centre. */
function labelPosition(center: Point, radius: number, angle: number, lineCount: number): Point & { anchor: Anchor; firstLineDy: number } {
    const point = polarPoint(center, radius + LABEL_GAP, angle);
    const sin = Math.sin(angle);
    const extraLines = (lineCount - 1) * LABEL_LINE;
    const firstLineDy = sin < -0.3 ? -2 - extraLines : sin > 0.3 ? LABEL_FONT - 2 : LABEL_FONT * 0.32 - extraLines / 2;
    return { ...point, anchor: labelAnchor(angle), firstLineDy };
}

/** Largest radius that keeps every axis label block inside the drawing. */
function fitRadius(width: number, height: number, angles: number[], labels: AxisLabelLayout[]): number {
    let radius = Math.min(width, height) / 2 - EDGE_PAD;
    angles.forEach((angle, i) => {
        const cos = Math.abs(Math.cos(angle));
        const sin = Math.abs(Math.sin(angle));
        const { width: labelWidth, lines } = labels[i];
        const horizontalRoom = width / 2 - EDGE_PAD - (labelAnchor(angle) === "middle" ? labelWidth / 2 : labelWidth);
        if (cos > 1e-6) radius = Math.min(radius, horizontalRoom / cos - LABEL_GAP);
        const blockHeight = lines.length * LABEL_LINE;
        const verticalRoom = height / 2 - EDGE_PAD - (sin > 0.3 ? blockHeight : blockHeight / 2);
        if (sin > 1e-6) radius = Math.min(radius, verticalRoom / sin - LABEL_GAP);
    });
    return Math.max(16, Math.floor(radius));
}

/** Tooltip in the top corner opposite the active axis so it never covers that axis's values. */
function cornerPlacement(axisCos: number, width: number): TooltipPlacement {
    const maxWidth = Math.max(120, Math.floor(width / 2) - 8);
    return axisCos > 0 ? { top: 0, left: 0, maxWidth } : { top: 0, right: 0, maxWidth };
}

function normalized(value: number | null, max: number): number {
    if (value === null || max <= 0) return 0;
    return Math.min(1, Math.max(0, value / max));
}
