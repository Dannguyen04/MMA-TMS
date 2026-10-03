import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authenticatedApiRequest = vi.hoisted(() => vi.fn());
const authenticatedMutableApiRequest = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/client", async (loadOriginal) => ({
    ...(await loadOriginal<typeof import("@/lib/api/client")>()),
    authenticatedApiRequest,
    authenticatedMutableApiRequest,
}));

import { ApiError } from "@/lib/api/client";
import type { Applicant } from "@/lib/domain/admissions";
import type { User } from "@/lib/domain/types";
import { db } from "@/lib/mocks/db";
import {
    activateFighterAccount,
    assignEvaluator,
    decideApplication,
    getApplication,
    listApplications,
    listOwnApplications,
    submitApplication,
    submitAssessment,
} from "./admissions";

const applicant: Applicant = { id: "guest-1", email: "quang.ho@example.test" };
const admin = { id: "admin-1", role: "admin", name: "Nora" } as User;
const details = {
    email: "quang.ho@example.test",
    firstName: "Quang",
    lastName: "Hồ",
    dateOfBirth: "2003-07-19",
    weightClass: "BANTAMWEIGHT",
    nationality: null,
    contactPhone: null,
    trainingBackground: null,
    competitionBackground: null,
    motivation: null,
};
const staffApplication = {
    id: "app-1",
    guestUserId: applicant.id,
    status: "PASSED",
    submittedAt: "2026-09-01T09:00:00.000Z",
    applicant: details,
    accountEmail: details.email,
    currentAssignment: { id: "as-1", coachId: "coach-1", assignedById: admin.id, startsAt: "2026-09-02T09:00:00.000Z", endsAt: null, endedById: null, endReason: null },
    assignmentHistory: [],
    assessment: {
        id: "assess-1",
        coachId: "coach-1",
        conclusion: "PASS",
        summary: "Ready.",
        criteria: [{ criterionName: "Cardio", method: "Pads", observation: "Kept pace", value: 3, unit: "rounds" }],
        assessedAt: "2026-09-05T09:00:00.000Z",
    },
    decision: null,
    activation: null,
};
const input = { firstName: "Quang", lastName: "Hồ", dateOfBirth: "2003-07-19", weightClass: "bantamweight" as const, nationality: null, contactPhone: null, trainingBackground: null, competitionBackground: null, motivation: null };
const refused = (status: number, code: string) => new ApiError({ message: "Refused", kind: "http", status, code });

describe("admissions in API mode", () => {
    beforeEach(() => {
        vi.stubEnv("APP_DATA_MODE", "api");
        authenticatedApiRequest.mockReset();
        authenticatedMutableApiRequest.mockReset();
    });

    afterEach(() => vi.unstubAllEnvs());

    it("lists the applicant's own applications newest first, in the interface's terms", async () => {
        const own = (id: string, submittedAt: string, status: string) => ({ id, status, submittedAt, applicant: details, assessment: null, decision: null, activation: null });
        authenticatedApiRequest.mockResolvedValue({ items: [own("old", "2026-01-01T00:00:00.000Z", "FAILED"), own("new", "2026-09-01T00:00:00.000Z", "SUBMITTED")], total: 2, page: 1, limit: 100 });

        await expect(listOwnApplications(applicant)).resolves.toMatchObject([
            { id: "new", status: "submitted", applicant: { weightClass: "bantamweight" } },
            { id: "old", status: "failed" },
        ]);
        expect(authenticatedApiRequest).toHaveBeenCalledWith("/fighter-admissions/applications/me?page=1&limit=100", expect.anything());
    });

    it("reads the staff view, leaving out an account email that hasn't changed", async () => {
        authenticatedApiRequest.mockResolvedValue({ items: [staffApplication], total: 1, page: 1, limit: 100 });

        await expect(listApplications("passed")).resolves.toEqual([
            expect.objectContaining({
                applicantId: applicant.id,
                status: "passed",
                accountEmail: null,
                evaluator: { coachId: "coach-1", since: "2026-09-02T09:00:00.000Z" },
                assessment: expect.objectContaining({ conclusion: "pass", criteria: [{ criterionName: "Cardio", method: "Pads", observation: "Kept pace", value: 3, unit: "rounds", note: null }] }),
            }),
        ]);
        expect(authenticatedApiRequest).toHaveBeenCalledWith("/fighter-admissions/applications?page=1&limit=100&status=PASSED", expect.anything());
    });

    it("reads a missing application as null", async () => {
        authenticatedApiRequest.mockRejectedValue(refused(404, "FIGHTER_APPLICATION_NOT_FOUND"));

        await expect(getApplication("app-9")).resolves.toBeNull();
    });

    it("sends each write to its route", async () => {
        authenticatedMutableApiRequest.mockResolvedValue({});

        await submitApplication(applicant, input);
        await activateFighterAccount(applicant);
        await decideApplication("app-1", "approved", "Space in the group", admin);
        await submitAssessment("app-1", { conclusion: "fail", summary: "Not yet", criteria: [] }, { ...admin, role: "coach" });

        expect(authenticatedMutableApiRequest.mock.calls.map(([path]) => path)).toEqual([
            "/fighter-admissions/applications",
            "/fighter-admissions/activation",
            "/fighter-admissions/applications/app-1/decision",
            "/fighter-admissions/assigned/app-1/assessment",
        ]);
        expect(authenticatedMutableApiRequest).toHaveBeenNthCalledWith(3, expect.anything(), expect.anything(), expect.objectContaining({ body: JSON.stringify({ decision: "APPROVED", reason: "Space in the group" }) }));
    });

    it("explains refusals, on the field they concern", async () => {
        authenticatedMutableApiRequest.mockRejectedValueOnce(refused(409, "FIGHTER_APPLICATION_ALREADY_OPEN"));
        await expect(submitApplication(applicant, input)).resolves.toMatchObject({ ok: false, message: expect.stringContaining("already have an application") });

        authenticatedMutableApiRequest.mockRejectedValueOnce(refused(400, "FIGHTER_APPLICATION_REASSIGNMENT_REASON_REQUIRED"));
        await expect(assignEvaluator("app-1", "coach-2", null, admin)).resolves.toMatchObject({ ok: false, fieldErrors: { reassignmentReason: expect.any(String) } });

        authenticatedMutableApiRequest.mockRejectedValueOnce(refused(409, "FIGHTER_ACTIVATION_PASSWORD_NOT_SET"));
        await expect(activateFighterAccount(applicant)).resolves.toMatchObject({ ok: false, message: expect.stringContaining("activation email") });
    });
});

describe("admissions in demo mode", () => {
    beforeEach(() => vi.stubEnv("APP_DATA_MODE", "demo"));
    afterEach(() => vi.unstubAllEnvs());

    it("takes an applicant from application to fighter account", async () => {
        const store = db();
        const snapshot = { applicants: [...store.applicants], applications: [...store.admissionApplications], users: [...store.users], fighters: [...store.fighters] };
        const guest = store.applicants.find((candidate) => candidate.id === "a-quang-ho")!;
        const coach = store.users.find((user) => user.id === "u-rafael-costa")!;

        try {
            await expect(submitApplication(guest, input)).resolves.toEqual({ ok: true });
            await expect(submitApplication(guest, input)).resolves.toMatchObject({ ok: false });
            const [own] = await listOwnApplications(guest);

            await expect(decideApplication(own.id, "approved", "Too early", admin)).resolves.toMatchObject({ ok: false });
            await expect(assignEvaluator(own.id, "c-rafael-costa", null, admin)).resolves.toEqual({ ok: true });
            await expect(assignEvaluator(own.id, "c-anna-volkova", null, admin)).resolves.toMatchObject({ ok: false, fieldErrors: { reassignmentReason: expect.any(String) } });
            await expect(submitAssessment(own.id, { conclusion: "pass", summary: "Ready", criteria: [] }, coach)).resolves.toEqual({ ok: true });
            await expect(decideApplication(own.id, "approved", "Space in the group", admin)).resolves.toEqual({ ok: true });
            await expect(activateFighterAccount(guest)).resolves.toEqual({ ok: true });

            expect(store.users.find((user) => user.id === guest.id)).toMatchObject({ role: "fighter", name: "Quang Hồ" });
            expect(store.applicants.some((candidate) => candidate.id === guest.id)).toBe(false);
            expect(store.admissionApplications.find((candidate) => candidate.id === own.id)?.status).toBe("activated");
        } finally {
            Object.assign(store, { applicants: snapshot.applicants, admissionApplications: snapshot.applications, users: snapshot.users, fighters: snapshot.fighters });
        }
    });
});
