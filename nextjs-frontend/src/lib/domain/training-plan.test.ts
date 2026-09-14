import { describe, expect, it } from "vitest";

import { isDueSession, planAdherence, planAdherencePct, planTimeline } from "./training-plan";
import type { TrainingSession } from "./types";

/** 12:00 on 14 Sep 2026 in Ho Chi Minh City. */
const NOW = "2026-09-14T05:00:00.000Z";

/** Midnight on an academy calendar day, as stored on plans. */
function academyDay(key: string): string {
    return new Date(`${key}T00:00:00+07:00`).toISOString();
}

type SessionTiming = Pick<TrainingSession, "status" | "scheduledAt">;

function session(status: TrainingSession["status"], scheduledAt: string): SessionTiming {
    return { status, scheduledAt };
}

describe("planTimeline", () => {
    it("counts down to a plan that hasn't started", () => {
        expect(planTimeline({ startDate: academyDay("2026-09-17"), endDate: academyDay("2026-10-17"), status: "active" }, NOW)).toEqual({
            elapsedPct: 0,
            text: "Starts in 3 days",
        });
        expect(planTimeline({ startDate: academyDay("2026-09-15"), endDate: academyDay("2026-10-15"), status: "active" }, NOW).text).toBe("Starts tomorrow");
    });

    it("reports the current week and the days left", () => {
        // 55-day window, 13 days in: week 2 of 8.
        expect(planTimeline({ startDate: academyDay("2026-09-01"), endDate: academyDay("2026-10-26"), status: "active" }, NOW)).toEqual({
            elapsedPct: 24,
            text: "Week 2 of 8 · 42 days left",
        });
    });

    it("starts at week 1 on the first day", () => {
        expect(planTimeline({ startDate: academyDay("2026-09-14"), endDate: academyDay("2026-10-12"), status: "active" }, NOW)).toEqual({
            elapsedPct: 0,
            text: "Week 1 of 4 · 28 days left",
        });
    });

    it("is finished once the window has passed or the plan is completed", () => {
        expect(planTimeline({ startDate: academyDay("2026-07-01"), endDate: academyDay("2026-08-01"), status: "active" }, NOW)).toEqual({
            elapsedPct: 100,
            text: "Finished",
        });
        expect(planTimeline({ startDate: academyDay("2026-09-01"), endDate: academyDay("2026-10-26"), status: "completed" }, NOW).text).toBe("Finished");
    });
});

describe("isDueSession", () => {
    it("counts sessions scheduled at or before now, except cancelled ones", () => {
        expect(isDueSession(session("completed", "2026-09-13T01:00:00.000Z"), NOW)).toBe(true);
        expect(isDueSession(session("scheduled", NOW), NOW)).toBe(true);
        expect(isDueSession(session("scheduled", "2026-09-14T05:00:01.000Z"), NOW)).toBe(false);
        expect(isDueSession(session("cancelled", "2026-09-13T01:00:00.000Z"), NOW)).toBe(false);
    });
});

describe("planAdherence", () => {
    it("divides completed sessions by the sessions that were due", () => {
        const sessions = [
            session("completed", "2026-09-10T01:00:00.000Z"),
            session("completed", "2026-09-11T01:00:00.000Z"),
            session("missed", "2026-09-12T01:00:00.000Z"),
            session("cancelled", "2026-09-13T01:00:00.000Z"),
            session("scheduled", "2026-09-15T01:00:00.000Z"),
            session("scheduled", "2026-09-16T01:00:00.000Z"),
        ];
        expect(planAdherence(sessions, NOW)).toEqual({ due: 3, completed: 2, pct: 67 });
        expect(planAdherencePct(sessions, NOW)).toBe(67);
    });

    it("never counts upcoming sessions against the fighter", () => {
        const sessions = [session("completed", "2026-09-10T01:00:00.000Z"), session("scheduled", "2026-09-20T01:00:00.000Z")];
        expect(planAdherence(sessions, NOW)).toEqual({ due: 1, completed: 1, pct: 100 });
    });

    it("is empty until something is due", () => {
        const sessions = [session("scheduled", "2026-09-20T01:00:00.000Z"), session("cancelled", "2026-09-10T01:00:00.000Z")];
        expect(planAdherence(sessions, NOW)).toBeNull();
        expect(planAdherencePct(sessions, NOW)).toBeUndefined();
        expect(planAdherence([], NOW)).toBeNull();
    });
});
