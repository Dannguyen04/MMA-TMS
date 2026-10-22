import { describe, expect, it } from "vitest";

import type { Application } from "@/lib/domain/admissions";
import type { Fighter, Goal, TrainingPlan, TrainingSession } from "@/lib/domain/types";
import type { ReviewQueueItem } from "@/lib/services/videos";
import { buildCoachAttention, type CoachAttentionInput } from "./coach-attention";
import type { RosterEntry } from "./roster-data";

const NOW = "2026-09-28T10:00:00.000Z";

const fighter = (id: string, name: string) => ({ id, name }) as Fighter;

const entry = (overrides: Partial<RosterEntry> & Pick<RosterEntry, "fighter">): RosterEntry => ({
    clearance: null,
    clearanceState: "full",
    eligibility: null,
    revoked: false,
    daysRemaining: null,
    performance: null,
    hasComparison: false,
    overallSeries: [],
    nextSession: null,
    upcoming: [],
    ...overrides,
});

const review = (id: string, lowConfidenceFindings: number, unreviewedFindings = lowConfidenceFindings): ReviewQueueItem =>
    ({
        analysis: { id: `analysis-${id}`, processedAt: "2026-09-27T10:00:00.000Z" },
        video: { id: `video-${id}`, title: `Pad work ${id}` },
        fighter: fighter(`f-${id}`, `Fighter ${id}`),
        unreviewedFindings,
        lowConfidenceFindings,
        lowConfidenceDetections: 0,
    }) as ReviewQueueItem;

const input = (overrides: Partial<CoachAttentionInput> = {}): CoachAttentionInput => ({
    roster: [],
    weekSessions: [],
    reviewQueue: [],
    missed: [],
    goalsAtRisk: [],
    warningDays: 14,
    now: NOW,
    ...overrides,
});

describe("buildCoachAttention", () => {
    it("files every item under a queue", () => {
        const items = buildCoachAttention(
            input({
                roster: [entry({ fighter: fighter("a", "Ana"), clearanceState: "not_cleared" }), entry({ fighter: fighter("b", "Ben"), clearanceState: "none" })],
                reviewQueue: [review("1", 1)],
                missed: [{ id: "s1", fighterId: "a", title: "Pads", scheduledAt: "2026-09-26T10:00:00.000Z", type: "pad_work" } as TrainingSession],
                goalsAtRisk: [{ id: "g1", fighterId: "b", title: "Guard", dueDate: "2026-10-30", baseline: 0, current: 1, target: 4, unit: "", status: "at_risk" } as unknown as Goal],
            }),
        );
        expect(items.map((item) => [item.kind, item.group])).toEqual([
            ["Not cleared", "clearance"],
            ["No clearance", "clearance"],
            ["AI review", "reviews"],
            ["Missed session", "sessions"],
            ["Goal at risk", "goals"],
        ]);
    });

    it("queues every analysis awaiting review, low-confidence findings first", () => {
        const items = buildCoachAttention(input({ reviewQueue: [review("1", 0, 3), review("2", 2)] }));
        expect(items.map((item) => item.title)).toEqual(["2 low-confidence findings to confirm or correct", "3 findings waiting for your review"]);
    });

    it("summarises the review count when the per-analysis queue isn't available", () => {
        const [item] = buildCoachAttention(input({ reviewCount: 4 }));
        expect(item).toMatchObject({ group: "reviews", title: "4 analyses waiting for your review" });
        expect(item.fighterName).toBeUndefined();
        expect(buildCoachAttention(input({ reviewCount: 0 }))).toEqual([]);
    });

    it("asks for a plan for fighters cleared to train who have no active one", () => {
        const plan = (id: string, fighterId: string, status: TrainingPlan["status"]) =>
            ({ id, fighterId, title: `Plan ${id}`, status, updatedAt: "2026-09-20T10:00:00.000Z" }) as TrainingPlan;
        const items = buildCoachAttention(
            input({
                roster: [
                    entry({ fighter: fighter("a", "Ana"), clearanceState: "full" }),
                    entry({ fighter: fighter("b", "Ben"), clearanceState: "restricted" }),
                    entry({ fighter: fighter("c", "Cao"), clearanceState: "full" }),
                    entry({ fighter: fighter("d", "Duc"), clearanceState: "full" }),
                    // Not cleared yet: the clearance group already covers them, so no plan is asked for.
                    entry({ fighter: fighter("e", "Em"), clearanceState: "none" }),
                ],
                plans: [plan("p-1", "b", "completed"), plan("p-2", "c", "draft"), plan("p-3", "d", "active")],
            }),
        );

        expect(items.filter((item) => item.group === "onboarding").map((item) => [item.fighterName, item.kind, item.action])).toEqual([
            ["Ana", "No plan yet", { href: "/coach/training-plans/new?fighter=a", label: "Build plan" }],
            ["Ben", "No active plan", { href: "/coach/training-plans/new?fighter=b", label: "Build plan" }],
            ["Cao", "Draft plan", { href: "/coach/training-plans/p-2", label: "Finish plan" }],
        ]);
        expect(items.find((item) => item.fighterName === "Ben")?.detail).toBe("Cleared with restrictions — build the plan around them");
    });

    it("leaves plans out when they weren't read, rather than flagging every fighter", () => {
        expect(buildCoachAttention(input({ roster: [entry({ fighter: fighter("a", "Ana"), clearanceState: "full" })] }))).toEqual([]);
    });

    it("queues entrance assessments waiting for the coach, longest-waiting first, after the reviews", () => {
        const application = (id: string, since: string, overrides: Partial<Application> = {}) =>
            ({
                id,
                status: "submitted",
                submittedAt: "2026-09-20T10:00:00.000Z",
                applicant: { firstName: "Linh", lastName: id, weightClass: "lightweight" },
                evaluator: { coachId: "c-1", since },
                assessment: null,
                ...overrides,
            }) as Application;
        const items = buildCoachAttention(
            input({
                reviewQueue: [review("1", 1)],
                applicants: [
                    application("new", "2026-09-27T10:00:00.000Z"),
                    application("old", "2026-09-25T10:00:00.000Z"),
                    application("done", "2026-09-24T10:00:00.000Z", { status: "passed" }),
                ],
            }),
        );

        expect(items.map((item) => [item.group, item.fighterName])).toEqual([
            ["reviews", "Fighter 1"],
            ["applicants", "Linh old"],
            ["applicants", "Linh new"],
        ]);
        expect(items[1]).toMatchObject({ kind: "Entrance assessment", detail: "Assigned 3 days ago · Lightweight", action: { href: "/coach/admissions/old", label: "Assess" } });
    });

    it("says a pending medical review is what pauses training", () => {
        const [item] = buildCoachAttention(
            input({
                roster: [
                    entry({
                        fighter: fighter("a", "Ana"),
                        clearanceState: "not_cleared",
                        eligibility: { scope: "TRAINING", eligible: false, reasons: ["REVIEW_REQUEST_PENDING"] },
                    }),
                ],
            }),
        );
        expect(item).toMatchObject({ kind: "Medical review", title: "Paused until the sports doctor examines them", group: "clearance" });
    });
});
