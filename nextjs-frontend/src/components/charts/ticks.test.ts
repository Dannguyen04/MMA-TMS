import { describe, expect, it } from "vitest";

import { CHART_MUTED, TECHNIQUE_COLOR, seriesColor } from "./colors";
import {
    angleDistance,
    areaPath,
    bandLayout,
    columnPath,
    crisp,
    definedRuns,
    linearScale,
    linePath,
    nearestIndex,
    pointPositions,
    polarPoint,
    radarAngle,
    valueAt,
} from "./scale";
import {
    estimateTextWidth,
    formatChartValue,
    formatTick,
    maxTextWidth,
    niceScale,
    niceStep,
    stepDecimals,
    ticksWithin,
    visibleLabelIndices,
} from "./ticks";

describe("niceStep", () => {
    it("rounds up to 1, 2, 2.5 or 5 × 10ⁿ", () => {
        expect(niceStep(25)).toBe(25);
        expect(niceStep(6.25)).toBe(10);
        expect(niceStep(1.3)).toBe(2);
        expect(niceStep(0.3)).toBe(0.5);
        expect(niceStep(335)).toBe(500);
        expect(niceStep(0.021)).toBe(0.025);
    });

    it("falls back to 1 for invalid input", () => {
        expect(niceStep(0)).toBe(1);
        expect(niceStep(-4)).toBe(1);
        expect(niceStep(Number.NaN)).toBe(1);
    });
});

describe("stepDecimals", () => {
    it("counts the decimals needed to print the step", () => {
        expect(stepDecimals(10)).toBe(0);
        expect(stepDecimals(2.5)).toBe(1);
        expect(stepDecimals(0.25)).toBe(2);
        expect(stepDecimals(0.1 + 0.2)).toBe(1);
    });
});

describe("niceScale", () => {
    it("keeps a 0–100 score scale in quarters", () => {
        expect(niceScale(0, 100, 5)).toEqual({ min: 0, max: 100, step: 25, ticks: [0, 25, 50, 75, 100] });
    });

    it("rounds a data range outwards to clean bounds", () => {
        const scale = niceScale(58, 83, 5);
        expect(scale.min).toBe(50);
        expect(scale.max).toBe(90);
        expect(scale.ticks).toEqual([50, 60, 70, 80, 90]);
    });

    it("never produces floating-point noise or negative zero", () => {
        const scale = niceScale(-0.3, 0.7, 5);
        expect(scale.ticks).toEqual([-0.5, -0.25, 0, 0.25, 0.5, 0.75]);
        expect(Object.is(scale.ticks[2], 0)).toBe(true);
        for (const tick of niceScale(0.1, 0.9, 5).ticks) expect(String(tick).length).toBeLessThanOrEqual(4);
    });

    it("expands a flat range so a scale can be drawn", () => {
        const scale = niceScale(70, 70, 5);
        expect(scale.min).toBeLessThan(70);
        expect(scale.max).toBeGreaterThan(70);
        expect(niceScale(0, 0).ticks.length).toBeGreaterThan(1);
    });

    it("stays close to the requested tick count", () => {
        for (const [min, max] of [
            [0, 7.3],
            [0, 1340],
            [12, 19],
            [55.2, 61.7],
        ]) {
            const count = niceScale(min, max, 5).ticks.length;
            expect(count).toBeGreaterThanOrEqual(3);
            expect(count).toBeLessThanOrEqual(6);
        }
    });
});

describe("ticksWithin", () => {
    it("keeps the fixed domain and places clean ticks inside it", () => {
        expect(ticksWithin(0, 100, 5)).toEqual({ min: 0, max: 100, step: 25, ticks: [0, 25, 50, 75, 100] });
        const scale = ticksWithin(3, 97, 5);
        expect(scale.min).toBe(3);
        expect(scale.max).toBe(97);
        expect(scale.ticks).toEqual([25, 50, 75]);
    });

    it("accepts a reversed domain", () => {
        expect(ticksWithin(10, 0, 3).ticks).toEqual([0, 5, 10]);
    });
});

describe("value formatting", () => {
    it("formats values with separators, decimals and suffix", () => {
        expect(formatChartValue(1240, { suffix: " min" })).toBe("1,240 min");
        expect(formatChartValue(7.25, { decimals: 1, suffix: " m/s" })).toBe("7.3 m/s");
        expect(formatChartValue(72)).toBe("72");
    });

    it("keeps only single-character suffixes on ticks", () => {
        expect(formatTick(75, 25, "%")).toBe("75%");
        expect(formatTick(1500, 500, " min")).toBe("1,500");
        expect(formatTick(2.5, 2.5, "")).toBe("2.5");
        expect(formatTick(5, 2.5, "")).toBe("5.0");
    });
});

describe("text measurement and label thinning", () => {
    it("estimates wider text for longer and wider strings", () => {
        expect(estimateTextWidth("", 11)).toBe(0);
        expect(estimateTextWidth("W37", 11)).toBeGreaterThan(estimateTextWidth("11", 11));
        expect(estimateTextWidth("Head Movement", 12)).toBeGreaterThan(estimateTextWidth("Jab", 12));
        expect(maxTextWidth(["Jab", "Head Movement"], 12)).toBe(estimateTextWidth("Head Movement", 12));
        expect(maxTextWidth([], 12)).toBe(0);
    });

    it("shows every label when there is room", () => {
        expect(visibleLabelIndices(4, 80, 30)).toEqual([0, 1, 2, 3]);
    });

    it("thins labels evenly and always keeps the latest", () => {
        const indices = visibleLabelIndices(12, 20, 30);
        expect(indices[indices.length - 1]).toBe(11);
        expect(indices).toEqual([2, 5, 8, 11]);
        expect(visibleLabelIndices(0, 20, 30)).toEqual([]);
        expect(visibleLabelIndices(1, 0, 30)).toEqual([0]);
    });
});

describe("scales", () => {
    it("maps and clamps a linear domain", () => {
        const y = linearScale([0, 100], [200, 0]);
        expect(y(0)).toBe(200);
        expect(y(50)).toBe(100);
        expect(y(100)).toBe(0);
        expect(y(140)).toBe(0);
        expect(y(-10)).toBe(200);
        expect(linearScale([5, 5], [0, 100])(5)).toBe(50);
    });

    it("spreads points edge to edge and centres a single point", () => {
        expect(pointPositions(3, 10, 110)).toEqual([10, 60, 110]);
        expect(pointPositions(1, 10, 110)).toEqual([60]);
        expect(pointPositions(0, 10, 110)).toEqual([]);
    });

    it("lays out equal bands", () => {
        expect(bandLayout(4, 0, 200)).toEqual({ step: 50, centers: [25, 75, 125, 175] });
        expect(bandLayout(0, 0, 200)).toEqual({ step: 0, centers: [] });
    });

    it("finds the nearest position", () => {
        const positions = [10, 60, 110, 160];
        expect(nearestIndex(positions, -40)).toBe(0);
        expect(nearestIndex(positions, 84)).toBe(1);
        expect(nearestIndex(positions, 86)).toBe(2);
        expect(nearestIndex(positions, 999)).toBe(3);
        expect(nearestIndex([], 5)).toBe(-1);
    });

    it("snaps hairlines to the pixel grid", () => {
        expect(crisp(12)).toBe(12.5);
        expect(crisp(12.4)).toBe(12.5);
        expect(crisp(12.6)).toBe(13.5);
    });

    it("reads defined values only", () => {
        expect(valueAt([1, null, Number.NaN], 0)).toBe(1);
        expect(valueAt([1, null, Number.NaN], 1)).toBeNull();
        expect(valueAt([1, null, Number.NaN], 2)).toBeNull();
        expect(valueAt([1], 5)).toBeNull();
    });
});

describe("paths", () => {
    it("splits series at gaps", () => {
        const a = { x: 0, y: 0 };
        const b = { x: 1, y: 1 };
        const c = { x: 3, y: 3 };
        expect(definedRuns([a, b, null, c, null])).toEqual([[a, b], [c]]);
        expect(definedRuns([null, null])).toEqual([]);
    });

    it("builds line and area paths", () => {
        const points = [
            { x: 0, y: 10 },
            { x: 50, y: 5.123 },
        ];
        expect(linePath(points)).toBe("M0,10L50,5.12");
        expect(areaPath(points, 100)).toBe("M0,10L50,5.12L50,100L0,100Z");
        expect(areaPath([], 100)).toBe("");
    });

    it("rounds only the data end of a column", () => {
        const rounded = columnPath(10, 20, 24, 100, true);
        expect(rounded.startsWith("M10,100V24A4,4")).toBe(true);
        expect(rounded.endsWith("V100Z")).toBe(true);
        expect(columnPath(10, 20, 24, 100, false)).toBe("M10,100V20H34V100Z");
        expect(columnPath(10, 100, 24, 100, true)).toBe("");
        expect(columnPath(10, 98, 24, 100, true)).toContain("A2,2");
    });
});

describe("radar geometry", () => {
    it("draws eight axes as a flat-topped octagon", () => {
        const center = { x: 0, y: 0 };
        const top = [0, 1].map((i) => polarPoint(center, 100, radarAngle(i, 8)));
        expect(top[0].y).toBeCloseTo(top[1].y, 6);
        expect(top[0].x).toBeCloseTo(-top[1].x, 6);
        expect(top[0].y).toBeLessThan(0);
    });

    it("measures the shortest angular distance", () => {
        expect(angleDistance(0, Math.PI / 2)).toBeCloseTo(Math.PI / 2);
        expect(angleDistance(-Math.PI + 0.1, Math.PI - 0.1)).toBeCloseTo(0.2);
    });
});

describe("colors", () => {
    it("assigns techniques to fixed slots", () => {
        expect(TECHNIQUE_COLOR.jab).toBe("var(--chart-1)");
        expect(TECHNIQUE_COLOR.kick).toBe("var(--chart-4)");
        expect(TECHNIQUE_COLOR.head_movement).toBe("var(--chart-8)");
    });

    it("never cycles past the eighth slot", () => {
        expect(seriesColor(1)).toBe("var(--chart-1)");
        expect(seriesColor(8)).toBe("var(--chart-8)");
        expect(seriesColor(9)).toBe(CHART_MUTED);
        expect(seriesColor(0)).toBe(CHART_MUTED);
    });
});
