import { describe, expect, it } from "vitest";

import { applicationAnswers, applicationBody, assessmentBody, decisionBody, evaluatorBody, openApplication, toOwnApplication, type Application } from "./admissions";

const details: Application["applicant"] = {
    email: "quang.ho@example.test",
    firstName: "Quang",
    lastName: "Hồ",
    dateOfBirth: "2003-07-19",
    weightClass: "light_heavyweight",
    nationality: "Vietnamese",
    contactPhone: null,
    trainingBackground: "Boxing",
    competitionBackground: null,
    motivation: null,
};

const application: Application = {
    id: "app-1",
    applicantId: "guest-1",
    status: "approved",
    submittedAt: "2026-09-01T09:00:00.000Z",
    applicant: details,
    accountEmail: null,
    evaluator: { coachId: "coach-1", since: "2026-09-02T09:00:00.000Z" },
    assessment: { coachId: "coach-1", conclusion: "pass", summary: "Ready.", criteria: [], assessedAt: "2026-09-05T09:00:00.000Z" },
    decision: { decision: "approved", reason: "Space in the group.", decidedAt: "2026-09-06T09:00:00.000Z" },
    activation: { status: "pending", emailAttempts: 1, lastAttemptAt: "2026-09-06T09:00:00.000Z", lastAcceptedAt: "2026-09-06T09:00:00.000Z", completedAt: null },
};

describe("admission bodies", () => {
    it("sends an application with upper-case enums, trimmed names and empty answers as null", () => {
        expect(applicationBody({ ...applicationAnswers(details), firstName: " Quang ", trainingBackground: "  " })).toEqual({
            firstName: "Quang",
            lastName: "Hồ",
            dateOfBirth: "2003-07-19",
            weightClass: "LIGHT_HEAVYWEIGHT",
            nationality: "Vietnamese",
            contactPhone: null,
            trainingBackground: null,
            competitionBackground: null,
            motivation: null,
        });
    });

    it("sends a reassignment reason only when there is one", () => {
        expect(evaluatorBody("coach-2", null)).toEqual({ coachId: "coach-2" });
        expect(evaluatorBody("coach-2", " Coach is away ")).toEqual({ coachId: "coach-2", reassignmentReason: "Coach is away" });
    });

    it("sends the assessment and the decision in the service's terms", () => {
        expect(
            assessmentBody({
                conclusion: "pass",
                summary: " Ready ",
                criteria: [{ criterionName: " Cardio ", method: "Pads", observation: "Kept pace", value: 3, unit: " rounds ", note: "" }],
            }),
        ).toEqual({ conclusion: "PASS", summary: "Ready", criteria: [{ criterionName: "Cardio", method: "Pads", observation: "Kept pace", value: 3, unit: "rounds", note: null }] });
        expect(decisionBody("rejected", " Not this intake ")).toEqual({ decision: "REJECTED", reason: "Not this intake" });
    });
});

describe("applications", () => {
    it("finds the one still in progress", () => {
        expect(openApplication([{ ...application, status: "failed" }, application])).toBe(application);
        expect(openApplication([{ ...application, status: "rejected" }])).toBeNull();
    });

    it("shows the applicant outcomes and dates without the staff notes", () => {
        expect(toOwnApplication(application)).toEqual({
            id: "app-1",
            status: "approved",
            submittedAt: application.submittedAt,
            applicant: details,
            assessedAt: "2026-09-05T09:00:00.000Z",
            decidedAt: "2026-09-06T09:00:00.000Z",
            activation: "pending",
        });
    });
});
