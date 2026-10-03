import { describe, expect, it } from "vitest";

import type { MedicalReviewRequest } from "@/lib/domain/medical-contract";
import type { Fighter, MedicalClearance, MedicalExamination } from "@/lib/domain/types";
import type { DoctorOverview, FighterHealthSummary, FollowUp } from "@/lib/services/medical";
import { buildTriageQueue } from "./triage-queue";

const NOW = "2026-09-28T10:00:00.000Z";

const fighter = (id: string, name: string) => ({ id, name, joinedAt: "2025-01-01T00:00:00.000Z", upcomingBout: null }) as unknown as Fighter;

const summary = (overrides: Partial<FighterHealthSummary> & Pick<FighterHealthSummary, "fighter">): FighterHealthSummary => ({
    clearance: null,
    clearanceState: "full",
    activeInjuries: [],
    activeRecoveryPlan: null,
    latestExamination: null,
    nextFollowUp: null,
    openReviewRequests: [],
    ...overrides,
});

const overview = (overrides: Partial<DoctorOverview> = {}): DoctorOverview => ({
    healthCounts: { healthy: 0, monitoring: 0, injured: 0, recovery: 0, not_cleared: 0 },
    expiringClearances: [],
    fightersWithoutClearance: [],
    followUpsDue: [],
    activeInjuries: [],
    newAlerts: [],
    recentExaminations: [],
    ...overrides,
});

const request = (fighterId: string, requestedAt: string): MedicalReviewRequest => ({
    id: `r-${fighterId}`,
    fighterId,
    requestedById: "u-coach",
    requesterRole: "COACH",
    reason: "Limping after pad work",
    status: "OPEN",
    requestedAt,
    resolvedByExaminationId: null,
    resolvedAt: null,
});

const activeClearance = { id: "c1", status: "active", level: "full", issuedAt: "2026-09-01T00:00:00.000Z", validUntil: "2026-10-02T00:00:00.000Z" } as MedicalClearance;

describe("buildTriageQueue", () => {
    it("lists a review request instead of calling the fighter not cleared", () => {
        const ana = fighter("a", "Ana");
        const items = buildTriageQueue({
            overview: overview(),
            summaries: [summary({ fighter: ana, clearance: activeClearance, clearanceState: "not_cleared", openReviewRequests: [request("a", "2026-09-28T06:00:00.000Z")] })],
            now: NOW,
            serviceForms: true,
        });
        expect(items.map((item) => [item.kind, item.group])).toEqual([["Review requested", "reviews"]]);
        expect(items[0].action.href).toBe("/doctor/examinations/new?fighter=a&scope=TRAINING");
    });

    it("lists a fighter found not eligible even without a clearance on file", () => {
        const items = buildTriageQueue({
            overview: overview(),
            summaries: [
                summary({
                    fighter: fighter("b", "Ben"),
                    clearanceState: "not_cleared",
                    latestExamination: { date: "2026-09-25T02:00:00.000Z", outcome: "unfit" } as MedicalExamination,
                }),
            ],
            now: NOW,
            serviceForms: true,
        });
        expect(items).toHaveLength(1);
        expect(items[0]).toMatchObject({ kind: "Not cleared", detail: "Found not eligible on 25 Sept 2026" });
    });

    it("puts an overdue follow-up ahead of a clearance that only expires soon", () => {
        const cara = fighter("c", "Cara");
        const followUp = { fighter: cara, date: "2026-09-20T03:00:00.000Z", daysUntil: -8, examination: { id: "e1", type: "routine", date: "2026-09-01T00:00:00.000Z" } } as unknown as FollowUp;
        const items = buildTriageQueue({
            overview: overview({ expiringClearances: [{ fighter: cara, clearance: activeClearance, daysRemaining: 4 }], followUpsDue: [followUp] }),
            summaries: [summary({ fighter: cara })],
            now: NOW,
            serviceForms: false,
        });
        expect(items.map((item) => item.kind)).toEqual(["Follow-up overdue", "Clearance expiring"]);
    });

    it("sends demo examinations by type and service examinations by scope", () => {
        const dan = fighter("d", "Dan");
        const input = { overview: overview({ fightersWithoutClearance: [{ fighter: dan, state: "none" as const }] }), summaries: [summary({ fighter: dan, clearanceState: "none" })], now: NOW };
        expect(buildTriageQueue({ ...input, serviceForms: false })[0].action).toEqual({ href: "/doctor/examinations/new?fighter=d&type=baseline", label: "Start baseline exam" });
        expect(buildTriageQueue({ ...input, serviceForms: true })[0].action).toEqual({ href: "/doctor/examinations/new?fighter=d&scope=TRAINING", label: "Record examination" });
    });
});
