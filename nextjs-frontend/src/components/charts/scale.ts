/** Pure geometry helpers shared by the SVG charts. */

export interface Point {
    x: number;
    y: number;
}

/** The value at `index`, or `null` when it is missing, `null` or not a finite number. */
export function valueAt(values: readonly (number | null)[], index: number): number | null {
    const value = values[index];
    return value === null || value === undefined || !Number.isFinite(value) ? null : value;
}

/** Maps a numeric domain onto a pixel range. Values outside the domain are clamped. */
export function linearScale(domain: [number, number], range: [number, number]): (value: number) => number {
    const [d0, d1] = domain;
    const [r0, r1] = range;
    const span = d1 - d0;
    return (value) => {
        if (span === 0) return (r0 + r1) / 2;
        const t = Math.min(1, Math.max(0, (value - d0) / span));
        return r0 + t * (r1 - r0);
    };
}

/** Evenly spaced positions from `start` to `end`; a single point sits in the middle. */
export function pointPositions(count: number, start: number, end: number): number[] {
    if (count <= 0) return [];
    if (count === 1) return [(start + end) / 2];
    const step = (end - start) / (count - 1);
    return Array.from({ length: count }, (_, i) => start + i * step);
}

/** Centres of `count` equal bands between `start` and `end`, plus the band width. */
export function bandLayout(count: number, start: number, end: number): { step: number; centers: number[] } {
    if (count <= 0) return { step: 0, centers: [] };
    const step = (end - start) / count;
    return { step, centers: Array.from({ length: count }, (_, i) => start + (i + 0.5) * step) };
}

/** Index of the position closest to `value` (positions must be sorted ascending). */
export function nearestIndex(positions: number[], value: number): number {
    if (positions.length === 0) return -1;
    let low = 0;
    let high = positions.length - 1;
    while (high - low > 1) {
        const mid = (low + high) >> 1;
        if (positions[mid] <= value) low = mid;
        else high = mid;
    }
    return Math.abs(positions[high] - value) < Math.abs(positions[low] - value) ? high : low;
}

/** Snaps a 1px hairline coordinate to the pixel grid so it renders crisp, not blurred across two rows. */
export function crisp(coordinate: number): number {
    return Math.round(coordinate) + 0.5;
}

/** Splits a series into runs of consecutive defined points; `null` values become gaps. */
export function definedRuns(points: (Point | null)[]): Point[][] {
    const runs: Point[][] = [];
    let current: Point[] = [];
    for (const point of points) {
        if (point) {
            current.push(point);
        } else if (current.length > 0) {
            runs.push(current);
            current = [];
        }
    }
    if (current.length > 0) runs.push(current);
    return runs;
}

const coord = (value: number) => Number(value.toFixed(2));

/** SVG path through the points of one run. */
export function linePath(points: Point[]): string {
    return points.map((p, i) => `${i === 0 ? "M" : "L"}${coord(p.x)},${coord(p.y)}`).join("");
}

/** Closed SVG path filling the area between one run and a horizontal baseline. */
export function areaPath(points: Point[], baselineY: number): string {
    if (points.length === 0) return "";
    const first = points[0];
    const last = points[points.length - 1];
    return `${linePath(points)}L${coord(last.x)},${coord(baselineY)}L${coord(first.x)},${coord(baselineY)}Z`;
}

/**
 * Column path with rounded data-end corners (top) and a square base.
 * `rounded` false draws a plain rectangle, used for interior stacked segments.
 */
export function columnPath(x: number, top: number, width: number, bottom: number, rounded: boolean, radius = 4): string {
    const height = bottom - top;
    if (width <= 0 || height <= 0) return "";
    const r = rounded ? Math.min(radius, width / 2, height) : 0;
    if (r === 0) return `M${coord(x)},${coord(bottom)}V${coord(top)}H${coord(x + width)}V${coord(bottom)}Z`;
    return (
        `M${coord(x)},${coord(bottom)}V${coord(top + r)}` +
        `A${r},${r} 0 0 1 ${coord(x + r)},${coord(top)}` +
        `H${coord(x + width - r)}` +
        `A${r},${r} 0 0 1 ${coord(x + width)},${coord(top + r)}` +
        `V${coord(bottom)}Z`
    );
}

/**
 * Angle (radians) of axis `index` of `count` on a radar chart. The first axis is rotated
 * half a segment left of 12 o'clock so an 8-axis grid is a flat-topped octagon, like the cage.
 */
export function radarAngle(index: number, count: number): number {
    const segment = (2 * Math.PI) / count;
    return -Math.PI / 2 - segment / 2 + index * segment;
}

export function polarPoint(center: Point, radius: number, angle: number): Point {
    return { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) };
}

/** Closed polygon path through `points`. */
export function polygonPath(points: Point[]): string {
    return points.length === 0 ? "" : `${linePath(points)}Z`;
}

/** Smallest absolute difference between two angles, in radians (0–π). */
export function angleDistance(a: number, b: number): number {
    const diff = Math.abs(a - b) % (2 * Math.PI);
    return diff > Math.PI ? 2 * Math.PI - diff : diff;
}
