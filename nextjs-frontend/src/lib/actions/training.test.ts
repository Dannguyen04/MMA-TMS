import { beforeEach, describe, expect, it, vi } from "vitest";

const training = vi.hoisted(() => ({
    createPlan: vi.fn(),
    addPlanExercises: vi.fn(),
    getPlan: vi.fn(),
    createSession: vi.fn(),
    listExerciseCatalog: vi.fn(),
    createExercise: vi.fn(),
    loadSessionClearanceConflicts: vi.fn(),
}));
const bouts = vi.hoisted(() => ({ blockingSuspensions: vi.fn() }));
const auth = vi.hoisted(() => ({ user: { id: "user-1", role: "coach", profileId: "coach-1" } as { id: string; role: string; profileId: string | null } }));
const navigation = vi.hoisted(() => ({
    redirect: vi.fn((href: string) => {
        throw new Error(`redirect:${href}`);
    }),
}));

vi.mock("@/lib/services/training", async (loadOriginal) => ({ ...(await loadOriginal<typeof import("@/lib/services/training")>()), ...training }));
vi.mock("@/lib/services/platform-features", () => ({
    platformFeatureAvailable: () => true,
    usesTrainingServiceForms: () => true,
    PLATFORM_FEATURE_UNAVAILABLE_MESSAGE: "This isn't available yet.",
}));
vi.mock("@/lib/services/bouts", () => bouts);
vi.mock("@/lib/services/people", () => ({ getFighter: vi.fn(async () => ({ id: "fighter-1", name: "Linh Phạm" })) }));
vi.mock("@/lib/auth/access", () => ({ canAccessFighter: () => true }));
vi.mock("next/navigation", () => navigation);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ authorizeAction: vi.fn(async () => ({ ok: true, user: auth.user })) }));
vi.mock("@/lib/i18n/server", async () => {
    const { createTranslator } = await import("@/lib/i18n/translate");
    return { getTranslator: async () => ({ locale: "en", t: createTranslator("en") }) };
});

import { ApiError } from "@/lib/api/client";
import { STARTER_EXERCISES } from "@/lib/domain/training-templates";
import { addPlanExercises, createPlan, createSession, importStarterLibrary, previewSessionConflicts } from "./training";
import { IDLE } from "./state";

function form(fields: Record<string, string>): FormData {
    const data = new FormData();
    for (const [name, value] of Object.entries(fields)) data.set(name, value);
    return data;
}

const planFields = {
    fighterId: "fighter-1",
    title: "Fight camp",
    phase: "fight_camp",
    startDate: "2030-01-07",
    endDate: "2030-02-03",
    objective: "",
    notes: "",
    status: "active",
};

const row = (exerciseId: string, sets = "4") => ({ exerciseId, sets, reps: "", durationMin: "15", targetRpe: "6", notes: "" });

describe("creating a plan with its exercises", () => {
    beforeEach(() => {
        auth.user = { id: "user-1", role: "coach", profileId: "coach-1" };
        for (const mock of Object.values(training)) mock.mockReset();
    });

    it("sends the exercises in order and keeps the plan a draft when one couldn't be added", async () => {
        training.createPlan.mockResolvedValue({
            plan: { id: "plan-1", fighterId: "fighter-1", status: "draft" },
            failedExercises: [{ index: 1, exerciseId: "ex-b", message: "Gone" }],
        });

        await expect(createPlan(IDLE, form({ ...planFields, exercises: JSON.stringify([row("ex-a"), row("ex-b", "")]) }))).rejects.toThrow(
            "redirect:/coach/training-plans/plan-1?notice=exercises-failed-draft&failed=1",
        );
        const [input, , exercises] = training.createPlan.mock.calls[0];
        expect(input).toMatchObject({ title: "Fight camp", objective: "", status: "active", coachId: "coach-1" });
        expect(exercises).toEqual([
            { exerciseId: "ex-a", sets: 4, reps: null, durationSec: 900, targetRpe: 6, notes: null },
            { exerciseId: "ex-b", sets: null, reps: null, durationSec: 900, targetRpe: 6, notes: null },
        ]);
    });

    it("puts a row's bad dose on that row before anything is saved", async () => {
        const state = await createPlan(IDLE, form({ ...planFields, exercises: JSON.stringify([row("ex-a"), row("ex-b", "40")]) }));

        expect(state).toMatchObject({ status: "error", fieldErrors: { "exercises.1.sets": expect.stringContaining("Sets") } });
        expect(training.createPlan).not.toHaveBeenCalled();
    });

    it("accepts a plan without an objective but not a too-short one", async () => {
        const state = await createPlan(IDLE, form({ ...planFields, objective: "Win", exercises: "[]" }));
        expect(state.fieldErrors).toHaveProperty("objective");
    });

    it("keeps the exercises that failed when adding several to a plan", async () => {
        training.getPlan.mockResolvedValue({ id: "plan-1", fighterId: "fighter-1" });
        training.addPlanExercises.mockResolvedValue({ added: [{ id: "pe-1" }], failed: [{ index: 1, exerciseId: "ex-b", message: "That exercise is no longer in the library." }] });

        const state = await addPlanExercises("plan-1", { status: "idle" }, form({ exercises: JSON.stringify([row("ex-a"), row("ex-b")]) }));
        expect(state).toMatchObject({ status: "error", data: { failedRows: [1] } });
        expect(state.message).toContain("1 exercise added");
        expect(state.message).toContain("no longer in the library");
    });
});

describe("repeating a session weekly", () => {
    const sessionFields = {
        fighterId: "fighter-1",
        planId: "plan-1",
        title: "Pad work",
        type: "pad_work",
        date: "2030-01-07",
        time: "17:30",
        durationMin: "60",
        location: "Striking room",
        notes: "",
    };

    beforeEach(() => {
        for (const mock of Object.values(training)) mock.mockReset();
        let next = 0;
        training.createSession.mockImplementation(async (input: { scheduledAt: string }) => ({
            ok: true,
            session: { id: `s-${(next += 1)}`, fighterId: "fighter-1", planId: "plan-1", scheduledAt: input.scheduledAt },
            conflicts: [],
        }));
    });

    it("schedules one a week at the same time and stops at the plan's last day", async () => {
        // The plan ends on 25 January: the fourth week falls after it.
        training.getPlan.mockResolvedValue({ id: "plan-1", endDate: "2030-01-25T16:59:00.000Z" });

        await expect(createSession({ status: "idle" }, form({ ...sessionFields, repeat: "on", repeatCount: "4" }))).rejects.toThrow(
            "redirect:/coach/sessions/s-1?notice=repeated&created=3&failed=0&skipped=1",
        );
        expect(training.createSession.mock.calls.map(([input]) => input.scheduledAt)).toEqual([
            "2030-01-07T10:30:00.000Z",
            "2030-01-14T10:30:00.000Z",
            "2030-01-21T10:30:00.000Z",
        ]);
    });

    it("reports the weeks the service refused", async () => {
        training.getPlan.mockResolvedValue({ id: "plan-1", endDate: null });
        training.createSession
            .mockResolvedValueOnce({ ok: true, session: { id: "s-1", fighterId: "fighter-1", planId: "plan-1" }, conflicts: [] })
            .mockRejectedValueOnce(new ApiError({ message: "Conflict", kind: "http", status: 409, code: "TRAINING_CONFLICT" }));

        await expect(createSession({ status: "idle" }, form({ ...sessionFields, repeat: "on", repeatCount: "2" }))).rejects.toThrow(
            "redirect:/coach/sessions/s-1?notice=repeated&created=1&failed=1",
        );
    });

    it("refuses a repeat count out of range without scheduling anything", async () => {
        const state = await createSession({ status: "idle" }, form({ ...sessionFields, repeat: "on", repeatCount: "13" }));
        expect(state.fieldErrors).toHaveProperty("repeatCount");
        expect(training.createSession).not.toHaveBeenCalled();
    });

    it("schedules a single session as before when the box isn't ticked", async () => {
        await expect(createSession({ status: "idle" }, form({ ...sessionFields, repeatCount: "40" }))).rejects.toThrow("redirect:/coach/sessions/s-1");
        expect(training.getPlan).not.toHaveBeenCalled();
        expect(training.createSession).toHaveBeenCalledTimes(1);
    });
});

describe("previewing a session's conflicts", () => {
    const preview = { fighterId: "fighter-1", type: "sparring" as const, targetRpe: 6, exerciseIds: [], date: "2026-11-02", time: "17:00" };
    const clearanceWarning = { code: "no_clearance", severity: "warn" } as const;

    beforeEach(() => {
        auth.user = { id: "user-1", role: "coach", profileId: "coach-1" };
        training.loadSessionClearanceConflicts.mockReset().mockResolvedValue([clearanceWarning]);
        bouts.blockingSuspensions.mockReset().mockResolvedValue([]);
    });

    it("puts a suspension that blocks this session type first, as a block", async () => {
        bouts.blockingSuspensions.mockResolvedValue([{ endsOn: "2026-11-25" }]);

        const state = await previewSessionConflicts({ ...preview });

        expect(bouts.blockingSuspensions).toHaveBeenCalledWith("fighter-1", "sparring", "2026-11-02");
        expect(state.data?.conflicts).toEqual([
            { code: "suspended", severity: "block", type: "sparring", fighterName: "Linh Phạm", date: "2026-11-25" },
            clearanceWarning,
        ]);
    });

    it("leaves out the end day once the suspension only waits for a clearance", async () => {
        bouts.blockingSuspensions.mockResolvedValue([{ endsOn: "2026-10-30" }]);

        const state = await previewSessionConflicts({ ...preview });

        expect(state.data?.conflicts?.[0]).toEqual({ code: "suspended", severity: "block", type: "sparring", fighterName: "Linh Phạm" });
    });

    it("reports only the clearance conflicts when nothing is suspended", async () => {
        const state = await previewSessionConflicts({ ...preview });

        expect(state.data?.conflicts).toEqual([clearanceWarning]);
    });
});

describe("importing the starter library", () => {
    beforeEach(() => {
        auth.user = { id: "admin-1", role: "admin", profileId: null };
        for (const mock of Object.values(training)) mock.mockReset();
    });

    it("adds only the starter exercises the library lacks and reports refusals", async () => {
        training.listExerciseCatalog.mockResolvedValue([{ id: "ex-1", name: "technical SHADOW boxing" }]);
        training.createExercise.mockImplementation(async (input: { name: string }) => {
            if (input.name === "Kettlebell swings") throw new ApiError({ message: "Bad", kind: "http", status: 422, code: "VALIDATION_ERROR" });
            return { id: input.name };
        });

        const state = await importStarterLibrary();

        expect(training.createExercise).toHaveBeenCalledTimes(STARTER_EXERCISES.length - 1);
        expect(training.createExercise.mock.calls.map(([input]) => input.name)).not.toContain("Technical shadow boxing");
        expect(state.status).toBe("success");
        expect(state.data).toMatchObject({ skipped: ["Technical shadow boxing"], failed: [{ name: "Kettlebell swings" }] });
        expect(state.data?.created).toHaveLength(STARTER_EXERCISES.length - 2);
    });

    it("is for administrators only", async () => {
        auth.user = { id: "user-1", role: "coach", profileId: "coach-1" };

        await expect(importStarterLibrary()).resolves.toMatchObject({ status: "error", message: "Only administrators can change the exercise library." });
        expect(training.listExerciseCatalog).not.toHaveBeenCalled();
    });
});
