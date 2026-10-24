import { describe, expect, it } from "vitest";

import type { WeightTrack } from "./types";
import { weightChartData, weightChartRange } from "./weight-chart";

const track: WeightTrack = {
    limitKg: 60,
    points: [
        { date: "2026-10-10", kg: 66.4 },
        { date: "2026-10-11", kg: 66.2 },
        // 12/10 has no weigh-in.
        { date: "2026-10-13", kg: 65.9 },
    ],
    latestKg: 65.9,
    latestOn: "2026-10-13",
    remainingPct: 9,
    status: "OVER_LIMIT",
    referencePath: [
        { date: "2026-10-10", kg: 66.4 },
        { date: "2026-10-13", kg: 65.2 },
        { date: "2026-10-15", kg: 60 },
    ],
};

describe("weightChartData", () => {
    it("labels every day from the first point to the weigh-in day, with no gaps", () => {
        const data = weightChartData(track, "2026-10-10", "2026-10-15");
        expect(data.days).toEqual(["2026-10-10", "2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15"]);
        expect(data.labels).toHaveLength(6);
        expect(data.labels[0]).toMatch(/10/);
    });

    it("leaves null on a day without a weigh-in", () => {
        const data = weightChartData(track, "2026-10-10", "2026-10-15");
        expect(data.weight).toEqual([66.4, 66.2, null, 65.9, null, null]);
    });

    it("draws the reference path through its anchors and the limit as the target", () => {
        const data = weightChartData(track, "2026-10-10", "2026-10-15");
        expect(data.reference).toEqual([66.4, 66, 65.6, 65.2, 62.6, 60]);
        expect(data.target).toEqual({ value: 60, label: "Limit" });
    });

    it("keeps the reference series when there is no weigh-in yet", () => {
        const empty: WeightTrack = { ...track, points: [], latestKg: null, latestOn: null, remainingPct: null, status: "NOT_WEIGHED" };
        const range = weightChartRange(empty, "2026-10-15");
        expect(range).toEqual({ from: "2026-10-10", to: "2026-10-15" });
        const data = weightChartData(empty, range.from, range.to);
        expect(data.weight.every((value) => value === null)).toBe(true);
        expect(data.reference.filter((value) => value !== null)).toHaveLength(6);
    });

    it("is null outside the reference path", () => {
        const data = weightChartData(track, "2026-10-08", "2026-10-16");
        expect(data.reference[0]).toBeNull();
        expect(data.reference[data.reference.length - 1]).toBeNull();
    });
});

describe("weightChartRange", () => {
    it("runs from the first weigh-in to the weigh-in day", () => {
        expect(weightChartRange(track, "2026-10-15")).toEqual({ from: "2026-10-10", to: "2026-10-15" });
    });

    it("stretches to a weigh-in recorded after the weigh-in day", () => {
        const late = { ...track, points: [...track.points, { date: "2026-10-16", kg: 60.2 }] };
        expect(weightChartRange(late, "2026-10-15").to).toBe("2026-10-16");
    });

    it("falls back to the weigh-in day when there is no data at all", () => {
        const none: WeightTrack = { ...track, points: [], referencePath: [] };
        expect(weightChartRange(none, "2026-10-15")).toEqual({ from: "2026-10-15", to: "2026-10-15" });
    });
});
