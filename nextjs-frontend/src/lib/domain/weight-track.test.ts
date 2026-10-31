import { describe, expect, it } from "vitest";

import { buildWeightTrack } from "./weight-track";

const camp = {
    limitKg: 60,
    acuteLossLimitPct: 8,
    acuteWindowDays: 7,
    campStartedOn: "2026-09-26",
    weighInOn: "2026-10-18",
    todayOn: "2026-10-16",
};

describe("buildWeightTrack", () => {
    it("is red inside the acute window when more than the limit remains", () => {
        const track = buildWeightTrack({ ...camp, points: [{ date: "2026-10-16", kg: 66 }] });
        expect(track.remainingPct).toBe(9.1);
        expect(track.daysToWeighIn).toBe(2);
        expect(track.status).toBe("OVER_LIMIT");
        expect(track.latestKg).toBe(66);
    });

    it("is green inside the window when remaining percent is within the limit", () => {
        const track = buildWeightTrack({ ...camp, points: [{ date: "2026-10-16", kg: 64.5 }] });
        expect(track.remainingPct).toBe(7);
        expect(track.status).toBe("ON_TRACK");
    });

    it("is yellow when weigh-in is still outside the window and weight sits above the reference", () => {
        const track = buildWeightTrack({
            ...camp,
            campStartedOn: "2026-10-01",
            weighInOn: "2026-11-05",
            points: [{ date: "2026-10-01", kg: 70 }, { date: "2026-10-16", kg: 68.9 }],
        });
        expect(track.daysToWeighIn).toBe(20);
        expect(track.status).toBe("ABOVE_TARGET");
        const onToday = track.referencePath.find((point) => point.date === "2026-10-16");
        expect(onToday).toBeDefined();
        expect(68.9).toBeGreaterThan((onToday?.kg ?? 0) + 1);
    });

    it("is grey when the last weigh-in is three or more academy days ago", () => {
        const track = buildWeightTrack({ ...camp, points: [{ date: "2026-10-13", kg: 66 }] });
        expect(track.status).toBe("NOT_WEIGHED");
        expect(track.latestKg).toBe(66);
    });

    it("keeps a two-day-old weigh-in out of grey", () => {
        const track = buildWeightTrack({ ...camp, points: [{ date: "2026-10-14", kg: 64.5 }] });
        expect(track.status).not.toBe("NOT_WEIGHED");
    });

    it("is grey with no numbers when nothing has been logged", () => {
        const track = buildWeightTrack({ ...camp, points: [] });
        expect(track.status).toBe("NOT_WEIGHED");
        expect(track.latestKg).toBeNull();
        expect(track.remainingPct).toBeNull();
        expect(track.limitKg).toBe(60);
        expect(track.referencePath).toEqual([]);
    });

    it("draws the reference from the first camp weight to the limit on weigh-in day", () => {
        const track = buildWeightTrack({
            ...camp,
            points: [
                { date: "2026-10-01", kg: 70 },
                { date: "2026-10-16", kg: 66 },
            ],
            campStartedOn: "2026-10-01",
        });
        expect(track.referencePath[0]).toEqual({ date: "2026-10-01", kg: 70 });
        expect(track.referencePath[track.referencePath.length - 1]).toMatchObject({ date: "2026-10-18", kg: 60 });
        const windowOpens = track.referencePath.find((point) => point.date === "2026-10-11");
        expect(windowOpens?.kg).toBeCloseTo(60 / 0.92, 1);
    });

    it("drops a measurement from before camp and keeps one point per day", () => {
        const track = buildWeightTrack({
            ...camp,
            points: [
                { date: "2026-09-01", kg: 80 },
                { date: "2026-10-16", kg: 66.5 },
                { date: "2026-10-16", kg: 66.1 },
            ],
        });
        expect(track.points).toEqual([{ date: "2026-10-16", kg: 66.1 }]);
    });
});

describe("reference line for a fighter who starts light", () => {
    it("never climbs above the first camp weight", () => {
        const track = buildWeightTrack({
            limitKg: 60,
            acuteLossLimitPct: 5,
            acuteWindowDays: 7,
            campStartedOn: "2026-10-01",
            weighInOn: "2026-10-20",
            todayOn: "2026-10-15",
            points: [
                { date: "2026-10-01", kg: 59.6 },
                { date: "2026-10-15", kg: 58.9 },
            ],
        });
        expect(Math.max(...track.referencePath.map((point) => point.kg))).toBe(59.6);
        expect(track.status).toBe("ON_TRACK");
    });
});
