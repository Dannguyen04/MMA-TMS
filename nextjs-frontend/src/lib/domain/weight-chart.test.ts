import { describe, expect, it } from "vitest";

import { weightChartAriaLabel, weightChartData, weightChartWindow } from "./weight-chart";

const track = {
    limitKg: 60,
    latestKg: 66,
    status: "RED" as const,
    weighInOn: "2026-10-18",
    points: [
        { date: "2026-10-14", kg: 68 },
        { date: "2026-10-16", kg: 66 },
    ],
    referencePath: [
        { date: "2026-10-14", kg: 68 },
        { date: "2026-10-15", kg: 67 },
        { date: "2026-10-16", kg: 66 },
        { date: "2026-10-17", kg: 63 },
        { date: "2026-10-18", kg: 60 },
    ],
};

describe("weightChartData", () => {
    it("labels every academy day from the first day through weigh-in", () => {
        const data = weightChartData(track, "2026-10-14", "2026-10-18");
        expect(data.labels).toEqual(["2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"]);
    });

    it("leaves a gap on a day with no measurement", () => {
        const data = weightChartData(track, "2026-10-14", "2026-10-18");
        expect(data.weight).toEqual([68, null, 66, null, null]);
    });

    it("keeps the reference series when no weight has been logged", () => {
        const data = weightChartData({ points: [], referencePath: track.referencePath }, "2026-10-14", "2026-10-18");
        expect(data.weight).toEqual([null, null, null, null, null]);
        expect(data.reference).toEqual([68, 67, 66, 63, 60]);
    });

    it("uses the later point when the same day is logged twice", () => {
        const data = weightChartData(
            {
                points: [
                    { date: "2026-10-16", kg: 66.5 },
                    { date: "2026-10-16", kg: 66.1 },
                ],
                referencePath: [],
            },
            "2026-10-16",
            "2026-10-16",
        );
        expect(data.weight).toEqual([66.1]);
    });

    it("returns nothing for a reversed range", () => {
        expect(weightChartData(track, "2026-10-18", "2026-10-14")).toEqual({ labels: [], weight: [], reference: [], adherence: [] });
    });
});

describe("weightChartWindow", () => {
    it("starts at the first reference day and ends on weigh-in day", () => {
        expect(weightChartWindow({ ...track, points: [] })).toEqual({ from: "2026-10-14", to: "2026-10-18" });
    });

    it("starts at the first logged day when that is earlier than the reference", () => {
        expect(
            weightChartWindow({
                ...track,
                points: [{ date: "2026-10-12", kg: 70 }],
                referencePath: [{ date: "2026-10-14", kg: 68 }],
            }),
        ).toEqual({ from: "2026-10-12", to: "2026-10-18" });
    });
});

describe("weightChartAriaLabel", () => {
    it("includes the limit, the latest weight, and the status", () => {
        expect(weightChartAriaLabel(track)).toBe("Weight against a 60.0 kg limit. Latest 66.0 kg, status Red.");
    });

    it("says when nothing has been logged", () => {
        expect(weightChartAriaLabel({ limitKg: 60, latestKg: null, status: "GREY" })).toBe(
            "Weight against a 60.0 kg limit. No weight logged, status Grey.",
        );
    });
});
