import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { User } from "@/lib/domain/types";

const authenticatedApiRequest = vi.hoisted(() => vi.fn());
const authenticatedMutableApiRequest = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/client", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/api/client")>()),
    authenticatedApiRequest,
    authenticatedMutableApiRequest,
}));
vi.mock("./platform-features", () => import("@/test/platform-features-mock"));

import { platformFeatureAvailable } from "@/test/platform-features-mock";
import { ApiError } from "@/lib/api/client";
import {
    addCoachFeedback,
    addPlanExercise,
    cancelSession,
    createPlan,
    createSession,
    getPlan,
    listCoachFeedback,
    listExercises,
    listPlanExercises,
    listSessions,
    loadSessionClearanceConflicts,
    markSessionMissed,
    recordSessionResult,
    removePlanExercise,
    setPlanStatus,
    startSession,
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
        platformFeatureAvailable.mockReturnValue(true);
        vi.stubEnv("APP_DATA_MODE", "api");
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

        // The API has no preview; it enforces medical eligibility when a session starts, so nothing shows ahead of time.
        await expect(loadSessionClearanceConflicts(planned)).resolves.toEqual([]);

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

    it("reads a session the API returns without target intensity, exercises, videos or a coach rating", async () => {
        const current: Record<string, unknown> = { ...backendSession("COMPLETED"), coachId: null };
        for (const missing of ["targetRpe", "exercises", "videoIds", "coachRating", "resultSummary"]) delete current[missing];
        authenticatedApiRequest.mockResolvedValue({ data: [current], total: 1, hasNextPage: false });

        await expect(listSessions({ fighterIds: ["fighter-1"] })).resolves.toEqual([
            expect.objectContaining({
                coachId: null,
                durationMin: 60,
                targetRpe: null,
                exercises: [],
                videoIds: [],
                result: { completedAt: "2026-09-10T11:00:00.000Z", actualDurationMin: 55, rpe: 7, roundsCompleted: 6, coachRating: null, summary: "" },
            }),
        ]);
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

    describe("writes", () => {
        const planInput = {
            title: "Camp",
            fighterId: "fighter-1",
            coachId: "coach-1",
            objective: "Improve defense",
            phase: "build" as const,
            focusAreas: [],
            startDate: "2026-08-31T17:00:00.000Z",
            endDate: "2026-10-01T16:59:59.999Z",
            weeklySessionTarget: null,
            notes: "",
        };
        const sessionInput = {
            fighterId: "fighter-1",
            coachId: "coach-1",
            planId: "plan-1",
            title: "Heavy bag",
            type: "heavy_bag" as const,
            scheduledAt: "2026-09-10T10:00:00.000Z",
            durationMin: 60,
            location: "Main gym",
            targetRpe: null,
            exercises: [],
            notes: null,
        };
        const sent = (call: number) => JSON.parse(authenticatedMutableApiRequest.mock.calls[call][2].body);

        it("creates a plan with the service's own fields, its phase and academy days, then publishes it", async () => {
            authenticatedMutableApiRequest.mockResolvedValueOnce(backendPlan("DRAFT")).mockResolvedValueOnce(backendPlan("ACTIVE"));

            await expect(createPlan({ ...planInput, status: "active" }, actor)).resolves.toMatchObject({ status: "active" });
            expect(authenticatedMutableApiRequest.mock.calls[0][0]).toBe("/training-plans");
            expect(sent(0)).toEqual({
                fighterId: "fighter-1",
                coachId: "coach-1",
                title: "Camp",
                goals: "Improve defense",
                description: null,
                phase: "build",
                startDate: "2026-09-01",
                endDate: "2026-10-01",
            });
            expect(sent(1)).toEqual({ status: "ACTIVE" });
        });

        it("keeps the draft when publishing a new plan is refused", async () => {
            authenticatedMutableApiRequest
                .mockResolvedValueOnce(backendPlan("DRAFT"))
                .mockRejectedValueOnce(new ApiError({ message: "Conflict", kind: "http", status: 409, code: "PLAN_STATE_CONFLICT" }));

            await expect(createPlan({ ...planInput, status: "active" }, actor)).resolves.toMatchObject({ status: "draft" });
        });

        it("reads a plan the service stores with a phase but without focus areas or weekly target", async () => {
            const stored: Record<string, unknown> = backendPlan("ACTIVE");
            for (const missing of ["focusAreas", "weeklySessionTarget"]) delete stored[missing];
            authenticatedApiRequest.mockResolvedValue({ ...stored, endDate: null });

            await expect(getPlan("plan-1")).resolves.toMatchObject({
                phase: "fight_camp",
                focusAreas: [],
                weeklySessionTarget: null,
                startDate: "2026-08-31T17:00:00.000Z",
                endDate: null,
            });
        });

        it("schedules a session with the service's session type and planned seconds", async () => {
            authenticatedMutableApiRequest.mockResolvedValue({ ...backendSession("COMPLETED"), status: "SCHEDULED", completedAt: null });

            await expect(createSession(sessionInput, actor)).resolves.toMatchObject({ ok: true, conflicts: [] });
            expect(sent(0)).toEqual({
                fighterId: "fighter-1",
                coachId: "coach-1",
                planId: "plan-1",
                title: "Heavy bag",
                sessionType: "HEAVY_BAG",
                scheduledAt: "2026-09-10T10:00:00.000Z",
                plannedDurationSec: 3600,
                location: "Main gym",
                coachNotes: null,
            });
        });

        it("refuses a training type the service has no equivalent for, without asking it", async () => {
            await expect(createSession({ ...sessionInput, type: "technical_drilling" }, actor)).rejects.toMatchObject({ code: "API_OPERATION_UNSUPPORTED" });
            expect(authenticatedMutableApiRequest).not.toHaveBeenCalled();
        });

        it("saves a running session's result, then completes it", async () => {
            const running = { ...backendSession("COMPLETED"), status: "IN_PROGRESS", completedAt: null };
            authenticatedMutableApiRequest.mockResolvedValueOnce(running).mockResolvedValueOnce(backendSession("COMPLETED"));

            await expect(
                recordSessionResult("session-1", { rpe: 8, roundsCompleted: 5, actualDurationMin: null, coachRating: null, summary: "" }, actor),
            ).resolves.toMatchObject({ ok: true, session: { status: "completed" } });
            expect(authenticatedMutableApiRequest.mock.calls.map((call) => call[0])).toEqual(["/training-sessions/session-1", "/training-sessions/session-1/status"]);
            expect(sent(0)).toEqual({ reportedRpe: 8, roundCount: 5 });
            expect(sent(1)).toEqual({ status: "COMPLETED" });
        });

        it("only corrects the numbers of a session that is already completed", async () => {
            authenticatedMutableApiRequest.mockResolvedValue(backendSession("COMPLETED"));

            await recordSessionResult("session-1", { rpe: 6, roundsCompleted: 6, actualDurationMin: null, coachRating: null, summary: "" }, actor);
            expect(authenticatedMutableApiRequest).toHaveBeenCalledTimes(1);
        });

        it("starts, misses and cancels sessions through status changes", async () => {
            authenticatedMutableApiRequest.mockResolvedValue(backendSession("SKIPPED"));

            await startSession("session-1", actor);
            await markSessionMissed("session-1", actor);
            await cancelSession("session-1", "  Coach unwell  ", actor);
            expect([sent(0), sent(1), sent(2)]).toEqual([{ status: "IN_PROGRESS" }, { status: "SKIPPED" }, { status: "CANCELLED", cancellationReason: "Coach unwell" }]);
        });
    });

    it("adds a plan exercise at the end of the plan, in the service's terms", async () => {
        const stored = { id: "pe-1", planId: "plan-1", exerciseId: "ex-1", orderIndex: 3, sets: 4, reps: 10, durationSeconds: null, targetRpe: 7, coachNotes: null, createdAt: "2026-09-01T00:00:00.000Z" };
        authenticatedApiRequest.mockResolvedValue([{ ...stored, orderIndex: 2 }, { ...stored, id: "pe-0", orderIndex: 0 }]);
        authenticatedMutableApiRequest.mockResolvedValue(stored);

        await expect(listPlanExercises("plan-1")).resolves.toEqual([
            expect.objectContaining({ id: "pe-0", orderIndex: 0 }),
            expect.objectContaining({ id: "pe-1", orderIndex: 2, durationSec: null, notes: null }),
        ]);
        await addPlanExercise("plan-1", "ex-1", { sets: 4, reps: 10, durationSec: null, targetRpe: 7, notes: "  " }, actor);
        expect(authenticatedMutableApiRequest).toHaveBeenCalledWith("/training-plans/plan-1/exercises", expect.anything(), expect.objectContaining({ method: "POST" }));
        expect(JSON.parse(authenticatedMutableApiRequest.mock.calls[0][2].body)).toEqual({
            exerciseId: "ex-1",
            orderIndex: 3,
            sets: 4,
            reps: 10,
            durationSeconds: null,
            targetRpe: 7,
            coachNotes: null,
        });
    });

    it("reads a removed plan exercise as gone", async () => {
        authenticatedMutableApiRequest.mockRejectedValue(new ApiError({ message: "Not found", kind: "http", status: 404, code: "PLAN_EXERCISE_NOT_FOUND" }));

        await expect(removePlanExercise("plan-1", "pe-1", actor)).resolves.toBe(false);
    });

    it("filters sessions by type after reading them, since physical therapy reads as recovery", async () => {
        authenticatedApiRequest.mockResolvedValue({ data: [{ ...backendSession("COMPLETED"), sessionType: "PHYSICAL_THERAPY" }], total: 1, hasNextPage: false });

        await expect(listSessions({ fighterIds: ["fighter-1"], type: "recovery_mobility" })).resolves.toHaveLength(1);
        expect(authenticatedApiRequest).toHaveBeenCalledWith(expect.not.stringContaining("sessionType"), expect.anything());
    });

    it("asks nothing about coach feedback while the feedback service isn't available", async () => {
        platformFeatureAvailable.mockReturnValue(false);

        await expect(listCoachFeedback({ fighterIds: ["fighter-1"] })).resolves.toEqual([]);
        expect(authenticatedApiRequest).not.toHaveBeenCalled();
    });
});
