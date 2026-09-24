import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticatedApiRequest = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/client", () => ({ authenticatedApiRequest }));

import { getPerformanceHistory, getTeamPerformance, getWeeklyVolume, overallScore } from "./performance";

describe("performance API adapter", () => {
    beforeEach(() => {
        vi.stubEnv("APP_DATA_MODE", "api");
        authenticatedApiRequest.mockReset();
    });

    it("lay lich su hieu suat tu API da xac thuc", async () => {
        const history = [
            {
                id: "metric-1",
                fighterId: "fighter-1",
                weekStart: "2026-09-07",
                scores: { jab: 80, cross: 81, hook: 82, kick: 83, combination: 84, footwork: 85, guard: 86, head_movement: 87 },
                strikeCounts: { jab: 20, cross: 18, hook: 11, kick: 9 },
                combinations: 7,
                sessionsCompleted: 4,
                trainingMinutes: 240,
                avgRpe: 7.2,
                avgPunchSpeed: 6.4,
                avgKickSpeed: 8.1,
                guardUptimePct: 74,
                headMovementsPerMin: 5.2,
            },
        ];
        authenticatedApiRequest.mockResolvedValue(history);

        await expect(getPerformanceHistory("fighter-1", 8)).resolves.toEqual(history);
        expect(authenticatedApiRequest).toHaveBeenCalledWith(
            "/performance/fighters/fighter-1/history?weeks=8",
            expect.anything(),
        );
    });

    it("khong lui ve du lieu demo khi API loi", async () => {
        authenticatedApiRequest.mockRejectedValue(new Error("backend unavailable"));

        await expect(getPerformanceHistory("fighter-1")).rejects.toThrow("backend unavailable");
    });

    it("khong goi API khi pham vi vo si rong", async () => {
        await expect(getTeamPerformance([])).resolves.toEqual([]);
        await expect(getWeeklyVolume([])).resolves.toEqual([]);
        expect(authenticatedApiRequest).not.toHaveBeenCalled();
    });

    it("giu phep tinh diem tong hop hien tai", () => {
        expect(
            overallScore({ jab: 80, cross: 80, hook: 80, kick: 80, combination: 80, footwork: 80, guard: 80, head_movement: 80 }),
        ).toBe(80);
    });
});
