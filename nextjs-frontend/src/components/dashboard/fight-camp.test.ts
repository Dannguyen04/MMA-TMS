import { describe, expect, it } from "vitest";

import { DEFAULT_CAMP_DAYS, campDayLabel, campTimeline } from "./fight-camp";

// Academy time is Asia/Ho_Chi_Minh (UTC+7); 03:00Z is 10:00 on the same academy day.
const bout = { date: "2026-11-06T12:00:00.000Z" };
const campStart = "2026-08-29T03:00:00.000Z";
const now = "2026-09-26T03:00:00.000Z";

describe("campTimeline", () => {
    it("counts the camp from the camp plan's start", () => {
        const timeline = campTimeline(bout, campStart, now);
        expect(timeline).toMatchObject({ daysToGo: 41, campDays: 69, campDay: 29, estimatedStart: false, daysToStart: 0 });
        expect(timeline.fightWeek.slice(0, 10)).toBe("2026-10-31");
        expect(timeline.progressPct).toBe(42);
        expect(timeline.fightWeekPct).toBe(91);
        expect(campDayLabel(timeline)).toBe("Fight camp · Day 29 of 69");
    });

    it("estimates the start from the bout when there is no camp plan", () => {
        const timeline = campTimeline(bout, null, now);
        expect(timeline.estimatedStart).toBe(true);
        expect(timeline.campDays).toBe(DEFAULT_CAMP_DAYS);
        expect(timeline.campDay).toBe(DEFAULT_CAMP_DAYS - 41 + 1);
        expect(campDayLabel(timeline)).toBe(`Est. camp day ${DEFAULT_CAMP_DAYS - 40} of ${DEFAULT_CAMP_DAYS}`);
    });

    it("reports the days until a camp that hasn't started", () => {
        const early = "2026-08-24T03:00:00.000Z";
        const timeline = campTimeline(bout, campStart, early);
        expect(timeline.campDay).toBe(0);
        expect(timeline.progressPct).toBe(0);
        expect(timeline.daysToStart).toBe(5);
        expect(campDayLabel(timeline)).toBe("Camp starts in 5 days");
    });

    it("never counts past fight night", () => {
        const after = "2026-11-10T03:00:00.000Z";
        const timeline = campTimeline(bout, campStart, after);
        expect(timeline.daysToGo).toBe(0);
        expect(timeline.campDay).toBe(69);
        expect(timeline.progressPct).toBe(100);
    });
});
