import { describe, expect, it } from "vitest";

import { campTimeline, type CampTimelineInput } from "./camp-timeline";

const base: CampTimelineInput = {
    startOn: "2026-10-01",
    weighInOn: "2026-10-28",
    boutOn: "2026-10-29",
    todayOn: "2026-10-15",
    fightWeekDays: 7,
    sessions: [],
    suspensions: [],
};

describe("camp timeline", () => {
    it("spans the camp from its start to bout day, with fight week ending on weigh-in day", () => {
        const model = campTimeline(base);
        expect(model.totalDays).toBe(28);
        expect(model.todayAt).toBeCloseTo(50);
        expect(model.fightWeek).toEqual({ from: (21 / 28) * 100, to: (27 / 28) * 100, fromOn: "2026-10-22" });
        expect(model.daysToBout).toBe(14);
        expect(model).toMatchObject({ week: 3, weeks: 4 });
    });

    it("places sessions by day, stacks a second session on the same day and drops sessions outside the camp", () => {
        const model = campTimeline({
            ...base,
            sessions: [
                { id: "b", title: "Bag", type: "heavy_bag", status: "completed", on: "2026-10-08" },
                { id: "a", title: "Pads", type: "pad_work", status: "completed", on: "2026-10-08" },
                { id: "c", title: "Spar", type: "sparring", status: "missed", on: "2026-10-10" },
                { id: "d", title: "Run", type: "strength_conditioning", status: "scheduled", on: "2026-10-20" },
                { id: "x", title: "Before", type: "pad_work", status: "completed", on: "2026-09-20" },
            ],
        });
        expect(model.sessions.map((s) => [s.id, s.lane])).toEqual([
            ["a", 0],
            ["b", 1],
            ["c", 0],
            ["d", 0],
        ]);
        expect(model.sessions[0].at).toBeCloseTo(25);
        expect(model.lanes).toBe(2);
        expect(model.counts).toEqual({ done: 2, upcoming: 1, missed: 1 });
    });

    it("clips suspensions to the camp and hides today once the camp is over", () => {
        const model = campTimeline({ ...base, todayOn: "2026-11-02", suspensions: [{ id: "s", from: "2026-09-25", to: "2026-10-08" }, { id: "old", from: "2026-08-01", to: "2026-08-30" }] });
        expect(model.suspensions).toEqual([{ id: "s", from: 0, to: 25, fromOn: "2026-09-25", toOn: "2026-10-08" }]);
        expect(model.todayAt).toBeNull();
        expect(model.daysToBout).toBe(-4);
        expect(model.week).toBe(4);
    });
});
