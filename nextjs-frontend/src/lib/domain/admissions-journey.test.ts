import { describe, expect, it } from "vitest";

import { ACTIVATION_STATUS_LABELS, applicantJourney, awaitsFighterActivation, type OwnApplication } from "./admissions";

const base: OwnApplication = {
    id: "app-1",
    status: "submitted",
    submittedAt: "2026-09-01T09:00:00.000Z",
    applicant: {
        email: "quang.ho@example.test",
        firstName: "Quang",
        lastName: "Hồ",
        dateOfBirth: "2003-07-19",
        weightClass: "lightweight",
        nationality: null,
        contactPhone: null,
        trainingBackground: null,
        competitionBackground: null,
        motivation: null,
    },
    assessedAt: null,
    decidedAt: null,
    activation: null,
};

const states = (application: OwnApplication) => Object.fromEntries(applicantJourney(application).map((step) => [step.id, step.state]));

describe("applicantJourney", () => {
    it("starts at the coach assessment once the application is sent", () => {
        expect(states(base)).toEqual({
            email: "done",
            application: "done",
            assessment: "current",
            decision: "upcoming",
            password: "upcoming",
            activation: "upcoming",
            doctor: "upcoming",
            baseline: "upcoming",
            cleared: "upcoming",
        });
        expect(applicantJourney(base).find((step) => step.id === "application")?.date).toBe(base.submittedAt);
    });

    it("waits for the password after approval, then for activation", () => {
        const approved = { ...base, status: "approved", assessedAt: "2026-09-05T09:00:00.000Z", decidedAt: "2026-09-06T09:00:00.000Z" } as const;
        expect(states({ ...approved, activation: "pending" })).toMatchObject({ assessment: "done", decision: "done", password: "current", activation: "upcoming" });
        expect(states({ ...approved, activation: "in_progress" })).toMatchObject({ password: "current" });
        expect(states({ ...approved, activation: "password_set" })).toMatchObject({ password: "done", activation: "current" });
    });

    it("never claims the fighter steps from applicant data", () => {
        const activated: OwnApplication = { ...base, status: "activated", assessedAt: "2026-09-05T09:00:00.000Z", decidedAt: "2026-09-06T09:00:00.000Z", activation: "completed" };
        const steps = applicantJourney(activated);
        expect(steps.filter((step) => step.phase === "fighter").map((step) => step.state)).toEqual(["upcoming", "upcoming", "upcoming"]);
        expect(steps.some((step) => step.state === "current")).toBe(false);
    });

    it("ends a failed application at the assessment and a rejected one at the decision", () => {
        const failed = applicantJourney({ ...base, status: "failed", assessedAt: "2026-09-05T09:00:00.000Z" });
        expect(failed.map((step) => step.id)).toEqual(["email", "application", "assessment"]);
        expect(failed.at(-1)).toMatchObject({ state: "ended", outcome: "Did not pass", date: "2026-09-05T09:00:00.000Z" });

        const rejected = applicantJourney({ ...base, status: "rejected", assessedAt: "2026-09-05T09:00:00.000Z", decidedAt: "2026-09-06T09:00:00.000Z" });
        expect(rejected.map((step) => step.id)).toEqual(["email", "application", "assessment", "decision"]);
        expect(rejected.at(-1)).toMatchObject({ state: "ended", outcome: "Not admitted" });
        expect(rejected.some((step) => step.state === "current")).toBe(false);
    });
});

describe("awaitsFighterActivation", () => {
    it("is true only for an approved application that isn't activated yet", () => {
        expect(awaitsFighterActivation([{ status: "approved", activation: "pending" }])).toBe(true);
        expect(awaitsFighterActivation([{ status: "rejected", activation: null }, { status: "approved", activation: "password_set" }])).toBe(true);
        expect(awaitsFighterActivation([{ status: "approved", activation: "completed" }])).toBe(false);
        expect(awaitsFighterActivation([{ status: "passed", activation: null }])).toBe(false);
        expect(awaitsFighterActivation([])).toBe(false);
    });
});

describe("activation labels", () => {
    it("never calls the first password a reset", () => {
        expect(ACTIVATION_STATUS_LABELS.pending).toBe("Waiting to set a password");
        expect(Object.values(ACTIVATION_STATUS_LABELS).join(" ").toLowerCase()).not.toMatch(/reset|forgot|new password/);
    });
});
