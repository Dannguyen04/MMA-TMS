import { describe, expect, it } from "vitest";

import type { Application, ApplicationStatus } from "@/lib/domain/admissions";
import type { CareTeamGap } from "@/lib/services/care-team-gaps";
import { buildAdminAttention, careTeamNextStep, type AdminAttentionInput } from "./admin-attention";

const NOW = "2026-10-11T10:00:00.000Z";

const application = (id: string, status: ApplicationStatus, overrides: Partial<Application> = {}): Application => ({
    id,
    applicantId: `u-${id}`,
    status,
    submittedAt: "2026-10-05T10:00:00.000Z",
    applicant: {
        email: `${id}@example.com`,
        firstName: "Linh",
        lastName: id.toUpperCase(),
        dateOfBirth: "2000-01-01",
        weightClass: "lightweight",
        nationality: null,
        contactPhone: null,
        trainingBackground: null,
        competitionBackground: null,
        motivation: null,
    },
    accountEmail: null,
    evaluator: null,
    assessment: null,
    decision: null,
    activation: null,
    ...overrides,
});

const gap = (fighterId: string, missing: CareTeamGap["missing"], joinedAt = "2026-10-01T10:00:00.000Z"): CareTeamGap => ({
    fighterId,
    userId: `u-${fighterId}`,
    name: `Fighter ${fighterId}`,
    joinedAt,
    missing,
});

const input = (overrides: Partial<AdminAttentionInput> = {}): AdminAttentionInput => ({
    applications: [],
    careTeamGaps: [],
    coachName: () => "Rafael Costa",
    now: NOW,
    ...overrides,
});

describe("buildAdminAttention", () => {
    it("files each hand-off under its group, fighters who can't train first", () => {
        const items = buildAdminAttention(
            input({
                applications: [
                    application("a", "submitted"),
                    application("b", "submitted", { evaluator: { coachId: "c-1", since: "2026-10-06T10:00:00.000Z" } }),
                    application("c", "passed", {
                        assessment: { coachId: "c-1", conclusion: "pass", summary: "Strong", criteria: [], assessedAt: "2026-10-09T10:00:00.000Z" },
                    }),
                    application("d", "approved"),
                    application("e", "activated"),
                    application("f", "failed"),
                ],
                careTeamGaps: [gap("f-1", ["coach"]), gap("f-2", ["doctor"]), gap("f-3", ["coach", "doctor"])],
            }),
        );

        expect(items.map((item) => [item.group, item.kind, item.action.label])).toEqual([
            ["careTeam", "No sports doctor", "Assign sports doctor"],
            ["careTeam", "No care team", "Assign care team"],
            ["decision", "Passed assessment", "Decide"],
            ["assessor", "Needs an assessor", "Assign assessor"],
            ["careTeam", "No coach", "Assign coach"],
        ]);
        expect(items.find((item) => item.group === "decision")?.detail).toBe("Assessed by Rafael Costa 2 days ago");
    });

    it("sends each item to the one page where the step happens", () => {
        const [care, decision, assessor] = buildAdminAttention(
            input({ applications: [application("c", "passed"), application("a", "submitted")], careTeamGaps: [gap("f-2", ["doctor"])] }),
        );
        expect(care).toMatchObject({ fighterHref: "/admin/users/u-f-2", action: { href: "/admin/users/u-f-2#care-team" } });
        expect(decision.action.href).toBe("/admin/admissions/c");
        expect(assessor).toMatchObject({ fighterName: "Linh A", action: { href: "/admin/admissions/a" } });
    });

    it("puts the longest-waiting first within a group", () => {
        const items = buildAdminAttention(
            input({
                applications: [
                    application("new", "submitted", { submittedAt: "2026-10-10T10:00:00.000Z" }),
                    application("old", "submitted", { submittedAt: "2026-10-01T10:00:00.000Z" }),
                ],
            }),
        );
        expect(items.map((item) => item.id)).toEqual(["assessor-old", "assessor-new"]);
    });

    it("leaves the care team group out when the assignments couldn't be read", () => {
        expect(buildAdminAttention(input({ careTeamGaps: null }))).toEqual([]);
    });
});

describe("careTeamNextStep", () => {
    it("names what is missing, and nothing once the team is complete", () => {
        expect(careTeamNextStep(["coach", "doctor"])?.title).toBe("Next: assign a coach and a sports doctor");
        expect(careTeamNextStep(["doctor"])).toEqual({ title: "Next: assign a sports doctor", action: "Assign sports doctor" });
        expect(careTeamNextStep(["coach"])?.action).toBe("Assign coach");
        expect(careTeamNextStep([])).toBeNull();
    });
});
