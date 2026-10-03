import { beforeEach, describe, expect, it, vi } from "vitest";

const services = vi.hoisted(() => ({ submitApplication: vi.fn(), submitAssessment: vi.fn(), activateFighterAccount: vi.fn() }));
const session = vi.hoisted(() => ({ getSessionAccount: vi.fn(), authorizeAction: vi.fn() }));
const navigation = vi.hoisted(() => ({
    redirect: vi.fn((href: string) => {
        throw new Error(`redirect:${href}`);
    }),
}));

vi.mock("@/lib/services/admissions", () => services);
vi.mock("@/lib/auth/session", () => session);
vi.mock("next/navigation", () => navigation);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { activateFighterAccountAction, submitApplicationAction, submitAssessmentAction } from "./admissions";
import { IDLE } from "./state";

function form(fields: Record<string, string>): FormData {
    const data = new FormData();
    for (const [name, value] of Object.entries(fields)) data.set(name, value);
    return data;
}

const applicant = { id: "guest-1", email: "quang.ho@example.test" };
const coach = { id: "user-3", role: "coach", profileId: "coach-1" };

describe("admission actions", () => {
    beforeEach(() => {
        for (const mock of [...Object.values(services), ...Object.values(session)]) mock.mockReset();
        session.getSessionAccount.mockResolvedValue({ kind: "applicant", applicant });
        session.authorizeAction.mockResolvedValue({ ok: true, user: coach });
    });

    it("sends a valid application for the signed-in applicant, with empty answers as null", async () => {
        services.submitApplication.mockResolvedValue({ ok: true });

        await expect(submitApplicationAction(IDLE, form({ firstName: "Quang", lastName: "Hồ", dateOfBirth: "2003-07-19", weightClass: "bantamweight", motivation: "" }))).resolves.toMatchObject({
            status: "success",
        });
        expect(services.submitApplication).toHaveBeenCalledWith(applicant, expect.objectContaining({ firstName: "Quang", weightClass: "bantamweight", motivation: null, nationality: null }));
    });

    it("only takes applications from applicants", async () => {
        session.getSessionAccount.mockResolvedValue({ kind: "user", user: coach });

        await expect(submitApplicationAction(IDLE, form({ firstName: "Quang" }))).resolves.toMatchObject({ status: "error", message: expect.stringContaining("Sign in again") });
        expect(services.submitApplication).not.toHaveBeenCalled();
    });

    it("opens the fighter dashboard once the account is activated, and explains a refusal otherwise", async () => {
        services.activateFighterAccount.mockResolvedValueOnce({ ok: true });
        await expect(activateFighterAccountAction()).rejects.toThrow("redirect:/fighter/dashboard");

        services.activateFighterAccount.mockResolvedValueOnce({ ok: false, message: "Set your password first." });
        await expect(activateFighterAccountAction()).resolves.toMatchObject({ status: "error", message: "Set your password first." });
    });

    it("checks each assessed criterion before saving the assessment", async () => {
        const criteria = JSON.stringify([{ criterionName: "Cardio", method: "", observation: "Kept pace", value: "abc", unit: "", note: "" }]);
        const state = await submitAssessmentAction(IDLE, form({ applicationId: "app-1", conclusion: "pass", summary: "Ready", criteria }));

        expect(state.fieldErrors).toMatchObject({ "criteria.0.method": "Enter the method.", "criteria.0.value": expect.stringContaining("number") });
        expect(services.submitAssessment).not.toHaveBeenCalled();

        await expect(submitAssessmentAction(IDLE, form({ applicationId: "app-1", conclusion: "pass", summary: "Ready", criteria: "[]" }))).resolves.toMatchObject({
            fieldErrors: { criteria: "Add at least one thing you assessed." },
        });
    });

    it("saves a valid assessment, reading empty values as none", async () => {
        services.submitAssessment.mockResolvedValue({ ok: true });
        const criteria = JSON.stringify([{ criterionName: "Cardio", method: "Pads", observation: "Kept pace", value: "3", unit: "rounds", note: "" }]);

        await expect(submitAssessmentAction(IDLE, form({ applicationId: "app-1", conclusion: "pass", summary: "Ready", criteria }))).resolves.toMatchObject({ status: "success" });
        expect(services.submitAssessment).toHaveBeenCalledWith(
            "app-1",
            { conclusion: "pass", summary: "Ready", criteria: [{ criterionName: "Cardio", method: "Pads", observation: "Kept pace", value: 3, unit: "rounds", note: null }] },
            coach,
        );
    });

    it("lets only coaches assess", async () => {
        session.authorizeAction.mockResolvedValue({ ok: true, user: { ...coach, role: "admin" } });

        await expect(submitAssessmentAction(IDLE, form({ applicationId: "app-1" }))).resolves.toMatchObject({ status: "error", message: "Only coaches assess applicants." });
    });
});
