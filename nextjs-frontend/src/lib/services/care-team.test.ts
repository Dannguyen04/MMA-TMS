import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authenticatedApiRequest = vi.hoisted(() => vi.fn());
const authenticatedMutableApiRequest = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/client", async (loadOriginal) => ({
    ...(await loadOriginal<typeof import("@/lib/api/client")>()),
    authenticatedApiRequest,
    authenticatedMutableApiRequest,
}));

import { ApiError } from "@/lib/api/client";
import type { User } from "@/lib/domain/types";
import { db } from "@/lib/mocks/db";
import { assignStaff, endAssignment, getCareTeam } from "./care-team";

const admin = { id: "u-admin", name: "Nora", role: "admin" } as User;
const fighterId = "33333333-3333-4333-8333-000000000001";
const coachId = "22222222-2222-4222-8222-000000000003";

describe("care team in API mode", () => {
    beforeEach(() => {
        vi.stubEnv("APP_DATA_MODE", "api");
        authenticatedApiRequest.mockReset();
        authenticatedMutableApiRequest.mockReset();
    });

    afterEach(() => vi.unstubAllEnvs());

    it("lists the open coach and doctor assignments, with when each started", async () => {
        authenticatedApiRequest.mockImplementation(async (path: string) =>
            path.endsWith("/coaches")
                ? [
                      { id: "a-1", coachId, fighterId, startsAt: "2026-01-05T00:00:00.000Z", endsAt: null, coachName: "Rafael Costa" },
                      { id: "a-0", coachId, fighterId, startsAt: "2025-01-05T00:00:00.000Z", endsAt: "2025-06-01T00:00:00.000Z", coachName: "Rafael Costa" },
                  ]
                : { data: [], total: 0, hasNextPage: false },
        );

        await expect(getCareTeam(fighterId)).resolves.toEqual({
            coach: [{ assignmentId: "a-1", staffId: coachId, name: "Rafael Costa", since: "2026-01-05T00:00:00.000Z", primary: false }],
            doctor: [],
        });
    });

    it("says which list the service failed to give and still shows the other", async () => {
        authenticatedApiRequest.mockImplementation(async (path: string) => {
            if (path.endsWith("/coaches")) throw new ApiError({ message: "Internal server error", kind: "http", status: 500, code: "INTERNAL_SERVER_ERROR" });
            return { data: [], total: 0, hasNextPage: false };
        });

        await expect(getCareTeam(fighterId)).resolves.toEqual({ coach: null, doctor: [] });
    });

    it("assigns a coach through the fighter service and a doctor through the medical service", async () => {
        authenticatedMutableApiRequest.mockResolvedValue({ id: "a-2" });

        await expect(assignStaff(fighterId, "coach", coachId, admin)).resolves.toEqual({ ok: true });
        await expect(assignStaff(fighterId, "doctor", "doctor-profile", admin)).resolves.toEqual({ ok: true });
        expect(authenticatedMutableApiRequest).toHaveBeenNthCalledWith(1, `/fighters/${fighterId}/coaches`, expect.anything(), { method: "POST", body: JSON.stringify({ coachId }) });
        expect(authenticatedMutableApiRequest).toHaveBeenNthCalledWith(2, `/fighters/${fighterId}/doctors`, expect.anything(), {
            method: "POST",
            body: JSON.stringify({ doctorId: "doctor-profile" }),
        });
    });

    it("ends an assignment with its reason, and explains one that already ended", async () => {
        authenticatedMutableApiRequest.mockResolvedValueOnce({ id: "a-1" });
        await expect(endAssignment(fighterId, "coach", "a-1", "  Moved camp ", admin)).resolves.toEqual({ ok: true });
        expect(authenticatedMutableApiRequest).toHaveBeenCalledWith(`/fighters/${fighterId}/coaches/a-1/end`, expect.anything(), {
            method: "POST",
            body: JSON.stringify({ endReason: "Moved camp" }),
        });

        authenticatedMutableApiRequest.mockRejectedValueOnce(new ApiError({ message: "Closed", kind: "http", status: 409, code: "DOCTOR_ASSIGNMENT_ALREADY_CLOSED" }));
        await expect(endAssignment(fighterId, "doctor", "a-9", "Moved camp", admin)).resolves.toMatchObject({ ok: false, message: expect.stringContaining("already ended") });
    });

    it("puts a refusal about the chosen person on the picker", async () => {
        authenticatedMutableApiRequest.mockRejectedValueOnce(new ApiError({ message: "Conflict", kind: "http", status: 409, code: "COACH_ASSIGNMENT_ALREADY_ACTIVE" }));
        await expect(assignStaff(fighterId, "coach", coachId, admin)).resolves.toEqual({
            ok: false,
            message: "This coach is already assigned to the fighter.",
            fieldErrors: { staffId: "This coach is already assigned to the fighter." },
        });

        authenticatedMutableApiRequest.mockRejectedValueOnce(new ApiError({ message: "Not found", kind: "http", status: 404, code: "DOCTOR_NOT_FOUND" }));
        await expect(assignStaff(fighterId, "doctor", "doctor-9", admin)).resolves.toMatchObject({ ok: false, fieldErrors: { staffId: expect.stringContaining("no longer active") } });
    });
});

describe("care team in demo mode", () => {
    beforeEach(() => vi.stubEnv("APP_DATA_MODE", "demo"));
    afterEach(() => vi.unstubAllEnvs());

    it("assigns and ends on both the fighter and the coach, keeping a primary coach", async () => {
        const store = db();
        const fighter = store.fighters.find((item) => item.id === "f-minh-tran")!;
        const coach = store.coaches.find((item) => item.id === "c-rafael-costa")!;
        const before = { coachIds: [...fighter.coachIds], primaryCoachId: fighter.primaryCoachId, fighterIds: [...coach.fighterIds] };

        try {
            const team = await getCareTeam(fighter.id);
            const primary = team.coach!.find((member) => member.staffId === "c-rafael-costa")!;
            expect(primary.primary).toBe(true);

            await expect(endAssignment(fighter.id, "coach", primary.assignmentId, "Moved camp", admin)).resolves.toEqual({ ok: true });
            expect(fighter.coachIds).not.toContain("c-rafael-costa");
            expect(coach.fighterIds).not.toContain(fighter.id);
            expect(fighter.primaryCoachId).toBe(fighter.coachIds[0]);

            await expect(assignStaff(fighter.id, "coach", "c-rafael-costa", admin)).resolves.toEqual({ ok: true });
            expect(coach.fighterIds).toContain(fighter.id);
            await expect(assignStaff(fighter.id, "coach", "c-rafael-costa", admin)).resolves.toMatchObject({ ok: false, fieldErrors: { staffId: expect.any(String) } });
        } finally {
            Object.assign(fighter, { coachIds: before.coachIds, primaryCoachId: before.primaryCoachId });
            coach.fighterIds = before.fighterIds;
        }
    });
});
