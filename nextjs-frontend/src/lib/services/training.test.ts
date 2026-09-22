import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { User } from "@/lib/domain/types";

const authenticatedApiRequest = vi.hoisted(() => vi.fn());
const authenticatedMutableApiRequest = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/client", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/api/client")>()),
    authenticatedApiRequest,
    authenticatedMutableApiRequest,
}));

import {
    addCoachFeedback,
    createPlan,
    listCoachFeedback,
    listExercises,
    listSessions,
    loadSessionClearanceConflicts,
    setPlanStatus,
} from "./training";

const actor = {} as User;

function backendPlan(status: "DRAFT" | "ACTIVE" | "COMPLETED" | "CANCELLED") {
    return {
        id: "plan-1",
        fighterId: "fighter-1",
        coachId: "coach-1",
        title: "Fight camp",
        description: "Technical notes",
        startDate: "2026-09-01",
        endDate: "2026-10-01",
        status,
        goals: "Improve defense",
        milestones: [],
        isActive: status === "ACTIVE",
        createdAt: "2026-09-01T00:00:00.000Z",
        updatedAt: "2026-09-02T00:00:00.000Z",
        deletedAt: null,
        phase: "fight_camp",
        focusAreas: ["guard", "cross"],
        weeklySessionTarget: 4,
    };
}

function backendSession(status: "SKIPPED" | "COMPLETED") {
    return {
        id: `session-${status.toLowerCase()}`,
        fighterId: "fighter-1",
        coachId: "coach-1",
        planId: "plan-1",
        title: "Heavy bag",
        scheduledAt: "2026-09-10T10:00:00.000Z",
        plannedDurationSec: 3600,
        actualDurationSec: status === "COMPLETED" ? 3300 : null,
        roundCount: 6,
        location: "Main gym",
        sessionType: "HEAVY_BAG",
        status,
        coachNotes: "Keep the guard high",
        cancellationReason: null,
        checkedInAt: null,
        completedAt: status === "COMPLETED" ? "2026-09-10T11:00:00.000Z" : null,
        abandonedAt: null,
        skippedAt: status === "SKIPPED" ? "2026-09-10T10:00:00.000Z" : null,
        reportedRpe: status === "COMPLETED" ? 7 : null,
        isActive: true,
        createdAt: "2026-09-01T00:00:00.000Z",
        updatedAt: "2026-09-10T11:00:00.000Z",
        deletedAt: null,
        cancelledAt: null,
        targetRpe: 7,
        exercises: [],
        videoIds: [],
        coachRating: status === "COMPLETED" ? 4 : null,
        resultSummary: status === "COMPLETED" ? "Solid work" : null,
    };
}

describe("training API adapter", () => {
    beforeEach(() => {
        authenticatedApiRequest.mockReset();
        authenticatedMutableApiRequest.mockReset();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("loads demo data only when demo mode is explicitly enabled", async () => {
        vi.stubEnv("APP_DATA_MODE", "demo");

        await expect(listExercises()).resolves.not.toHaveLength(0);
        expect(authenticatedApiRequest).not.toHaveBeenCalled();
    });

    it("checks clearance conflicts through the demo service in demo mode only", async () => {
        const planned = { fighterId: "fighter-1", type: "sparring" as const, targetRpe: 8, exercises: [], scheduledAt: "2026-09-10T10:00:00.000Z" };

        await expect(loadSessionClearanceConflicts(planned)).rejects.toMatchObject({ status: 501, code: "API_OPERATION_UNSUPPORTED" });

        vi.stubEnv("APP_DATA_MODE", "demo");
        await expect(loadSessionClearanceConflicts(planned)).resolves.toBeInstanceOf(Array);
        expect(authenticatedApiRequest).not.toHaveBeenCalled();
    });

    it("maps the UI missed status to SKIPPED and back without mock data", async () => {
        authenticatedApiRequest.mockResolvedValue({ data: [backendSession("SKIPPED")], total: 1, hasNextPage: false });

        await expect(listSessions({ fighterIds: ["fighter-1"], status: "missed" })).resolves.toEqual([
            expect.objectContaining({ id: "session-skipped", status: "missed", type: "heavy_bag", durationMin: 60 }),
        ]);
        expect(authenticatedApiRequest).toHaveBeenCalledWith(
            expect.stringContaining("status=SKIPPED"),
            expect.anything(),
        );
    });

    it("maps archived plan transitions through the existing CANCELLED backend state", async () => {
        authenticatedMutableApiRequest.mockResolvedValue(backendPlan("CANCELLED"));

        await expect(setPlanStatus("plan-1", "archived", actor)).resolves.toEqual(
            expect.objectContaining({ id: "plan-1", status: "archived" }),
        );
        expect(authenticatedMutableApiRequest).toHaveBeenCalledWith(
            "/training-plans/plan-1/status",
            expect.anything(),
            expect.objectContaining({ method: "PATCH", body: JSON.stringify({ status: "CANCELLED" }) }),
        );
    });

    it("lists and creates persisted coach feedback through the backend contract", async () => {
        const backendFeedback = {
            id: "ba425c7d-f166-4800-a542-d2f5d1a96adc",
            fighterId: "c61e6859-4a4e-4313-b762-9343270153f5",
            coachId: "88f97dd5-8f68-45bf-81db-4a778d30853a",
            sessionId: null,
            videoId: null,
            kind: "PRAISE",
            body: "Good balance after the cross.",
            techniques: ["cross"],
            createdAt: "2026-09-22T03:00:00.000Z",
        } as const;
        authenticatedApiRequest.mockResolvedValue({ data: [backendFeedback], total: 1, hasNextPage: false });
        authenticatedMutableApiRequest.mockResolvedValue(backendFeedback);

        await expect(listCoachFeedback({ fighterIds: [backendFeedback.fighterId] })).resolves.toEqual([
            expect.objectContaining({ id: backendFeedback.id, kind: "praise" }),
        ]);
        await expect(
            addCoachFeedback(
                {
                    fighterId: backendFeedback.fighterId,
                    coachId: backendFeedback.coachId,
                    sessionId: null,
                    videoId: null,
                    kind: "praise",
                    body: backendFeedback.body,
                    techniques: ["cross"],
                },
                actor,
            ),
        ).resolves.toMatchObject({ id: backendFeedback.id, kind: "praise" });
        expect(authenticatedMutableApiRequest).toHaveBeenCalledWith(
            "/coach-feedback",
            expect.anything(),
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({
                    fighterId: backendFeedback.fighterId,
                    sessionId: null,
                    videoId: null,
                    kind: "PRAISE",
                    body: backendFeedback.body,
                    techniques: ["cross"],
                }),
            }),
        );
    });

    it("fails visibly instead of falling back to mocks for an unsupported write", async () => {
        await expect(
            createPlan(
                {
                    title: "Camp",
                    fighterId: "fighter-1",
                    coachId: "coach-1",
                    objective: "Improve defense",
                    phase: "fight_camp",
                    focusAreas: ["guard"],
                    startDate: "2026-09-01",
                    endDate: "2026-10-01",
                    weeklySessionTarget: 4,
                    notes: "",
                },
                actor,
            ),
        ).rejects.toMatchObject({ status: 501, code: "API_OPERATION_UNSUPPORTED" });
        expect(authenticatedMutableApiRequest).not.toHaveBeenCalled();
    });
});
