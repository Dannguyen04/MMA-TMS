import { CHART_SERIES } from "./colors";
import { definedRuns, linearScale, linePath, pointPositions, type Point } from "./scale";

export interface SparklineProps {
    values: number[];
    color?: string;
    width?: number;
    height?: number;
    /** Describe the trend in words, e.g. "Jab score over 8 weeks, from 61 to 74". */
    ariaLabel: string;
    className?: string;
}

const DOT_RADIUS = 5;
const RING = 2;
const PAD = DOT_RADIUS + RING / 2;

/**
 * Tiny inline trend line with an end dot, for stat tiles and table cells. Server-compatible
 * (no hooks, no interaction) — pair it with the actual number, never use it alone.
 */
export function Sparkline({ values, color = CHART_SERIES[0], width = 96, height = 28, ariaLabel, className }: SparklineProps) {
    const finite = values.filter((value) => Number.isFinite(value));
    const min = Math.min(...finite);
    const max = Math.max(...finite);
    const y = linearScale([min, max], [height - PAD, PAD]);
    const xs = pointPositions(values.length, PAD, width - PAD);
    const points = values.map<Point | null>((value, i) => (Number.isFinite(value) ? { x: xs[i], y: y(value) } : null));
    const runs = definedRuns(points);
    const lastRun = runs[runs.length - 1];
    const end = lastRun?.[lastRun.length - 1];

    return (
        <svg role="img" aria-label={ariaLabel} width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className}>
            {runs.map((run, i) =>
                run.length > 1 ? (
                    <path key={i} d={linePath(run)} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                ) : null,
            )}
            {end && <circle cx={end.x} cy={end.y} r={DOT_RADIUS} fill={color} stroke="var(--chart-surface)" strokeWidth={RING} />}
        </svg>
    );
}
