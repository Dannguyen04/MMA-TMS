import { describe, expect, it } from "vitest";

import { dayKey } from "@/lib/format";

import { demoCheckinsFor, demoWeightTrack, listDemoWeightAlerts, recordDemoCheckin, recordDemoSelfWeight, resetDemoCampStore } from "./bouts.demo";

const TODAY = "2026-10-16";
const NOW = new Date("2026-10-16T01:00:00.000Z");

describe("demo camp", () => {
    it("seeds a red bout, a yellow bout, and a grey bout on the coach's roster", () => {
        resetDemoCampStore(TODAY);
        expect(demoWeightTrack("b-minh-lotus", NOW)?.status).toBe("RED");
        expect(demoWeightTrack("b-kenji-pacific", NOW)?.status).toBe("YELLOW");
        expect(demoWeightTrack("b-emma-nordic", NOW)?.status).toBe("GREY");
        expect(demoWeightTrack("b-minh-lotus", NOW)?.remainingPct).toBe(9.1);

        const alerts = listDemoWeightAlerts("all", NOW);
        expect(alerts.map((alert) => alert.track.status)).toEqual(["RED", "YELLOW", "GREY"]);
        expect(alerts[0]?.wayOff).toBe(2);
    });

    it("keeps one weight per academy day and lets a later save replace it", () => {
        resetDemoCampStore(TODAY);
        recordDemoSelfWeight("f-minh-tran", 66.5, NOW);
        recordDemoSelfWeight("f-minh-tran", 66.1, NOW);
        const track = demoWeightTrack("b-minh-lotus", NOW);
        const todayPoints = track?.points.filter((point) => point.date === TODAY) ?? [];
        expect(todayPoints).toEqual([expect.objectContaining({ date: TODAY, kg: 66.1 })]);
    });

    it("replaces yesterday's plan answer when the fighter answers again today", () => {
        resetDemoCampStore(TODAY);
        expect(recordDemoCheckin("f-minh-tran", "WAY_OFF", "Late dinner", NOW)).toEqual({ ok: true });
        expect(recordDemoCheckin("f-minh-tran", "ON_PLAN", null, NOW)).toEqual({ ok: true });
        const yesterday = demoCheckinsFor("b-minh-lotus").filter((item) => item.academyDate === "2026-10-15");
        expect(yesterday).toHaveLength(1);
        expect(yesterday[0]).toMatchObject({ adherence: "ON_PLAN", note: null, loggedOn: dayKey(NOW) });
    });
});
