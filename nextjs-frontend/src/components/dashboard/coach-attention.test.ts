import { describe, expect, it } from "vitest";

import type { Fighter, Goal, TrainingSession } from "@/lib/domain/types";
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
