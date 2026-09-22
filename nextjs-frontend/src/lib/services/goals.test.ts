import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticatedApiRequest = vi.hoisted(() => vi.fn());
const authenticatedMutableApiRequest = vi.hoisted(() => vi.fn());
const drainAuthenticatedCursorPages = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/client", async (loadOriginal) => ({
    ...(await loadOriginal<typeof import("@/lib/api/client")>()),
    authenticatedApiRequest,
    authenticatedMutableApiRequest,
    drainAuthenticatedCursorPages,
}));

import type { User } from "@/lib/domain/types";
import { createGoal, listGoals } from "./goals";

const actor = {} as User;
const backendGoal = {
    id: "goal-1",
    fighterId: "fighter-1",
    coachId: "coach-1",
    title: "Guard recovery",
    technique: "HEAD_MOVEMENT",
    metricLabel: "Recovery time",
    unit: "ms",
    lowerIsBetter: true,
    baseline: 480,
    target: 320,
    current: 410,
    startDate: "2026-09-01",
    dueDate: "2026-10-01",
    status: "AT_RISK",
    history: [{ date: "2026-09-08", value: 410 }],
    createdAt: "2026-09-01T00:00:00.000Z",
};

describe("goals API adapter", () => {
    beforeEach(() => {
        vi.stubEnv("APP_DATA_MODE", "api");
        authenticatedApiRequest.mockReset();
        authenticatedMutableApiRequest.mockReset();
        drainAuthenticatedCursorPages.mockReset();
    });

    it("chuyen enum backend sang mo hinh giao dien", async () => {
        drainAuthenticatedCursorPages.mockResolvedValue([backendGoal]);

        await expect(listGoals({ status: "at_risk", technique: "head_movement" })).resolves.toEqual([
            expect.objectContaining({ status: "at_risk", technique: "head_movement" }),
        ]);
        expect(drainAuthenticatedCursorPages).toHaveBeenCalledWith(
            "/goals?status=AT_RISK&technique=HEAD_MOVEMENT",
            expect.anything(),
        );
    });

    it("gui ky thuat viet hoa khi tao muc tieu", async () => {
        authenticatedMutableApiRequest.mockResolvedValue(backendGoal);

        await createGoal(
            {
                fighterId: "fighter-1",
                coachId: "coach-1",
                title: "Guard recovery",
                technique: "head_movement",
                metricLabel: "Recovery time",
                unit: "ms",
                lowerIsBetter: true,
                baseline: 480,
                target: 320,
                startDate: "2026-09-01",
                dueDate: "2026-10-01",
            },
            actor,
        );

        expect(authenticatedMutableApiRequest).toHaveBeenCalledWith(
            "/goals",
            expect.anything(),
            expect.objectContaining({ method: "POST", body: expect.stringContaining('"technique":"HEAD_MOVEMENT"') }),
        );
    });

    it("khong lui ve du lieu demo khi API loi", async () => {
        drainAuthenticatedCursorPages.mockRejectedValue(new Error("backend unavailable"));

        await expect(listGoals()).rejects.toThrow("backend unavailable");
    });
});
