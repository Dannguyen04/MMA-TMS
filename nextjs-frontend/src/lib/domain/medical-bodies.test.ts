import { describe, expect, it } from "vitest";

import {
    clearanceBody,
    examinationBody,
    injuryBody,
    injuryUpdateBody,
    milestoneDrafts,
    recoveryPlanBody,
    recoveryPlanUpdateBody,
    revokeClearanceBody,
    reviewRequestBody,
    treatmentBody,
    widenedLists,
    type ExaminationDecisionInput,
    type RestrictionLists,
} from "./medical-bodies";

const NO_LIMITS: RestrictionLists = { allowedSessionTypes: null, allowedTechniqueTypes: null, excludedJoints: null };

const decision = (overrides: Partial<ExaminationDecisionInput> = {}): ExaminationDecisionInput => ({
    scope: "TRAINING",
    decision: "ELIGIBLE",
    examinedAt: "2026-09-20T02:00:00.000Z",
    reason: "  Baseline physical, no concerns.  ",
    restrictions: null,
    validUntil: null,
    supersedesId: null,
    reviewRequestIds: [],
    ...overrides,
});

describe("examinationBody", () => {
    it("sends only what an unrestricted decision needs", () => {
        expect(examinationBody(decision())).toEqual({
            scope: "TRAINING",
            decision: "ELIGIBLE",
            examinedAt: "2026-09-20T02:00:00.000Z",
            reason: "Baseline physical, no concerns.",
        });
    });

    it("keeps restrictions for a restricted decision and drops empty lists", () => {
        const body = examinationBody(
            decision({
                decision: "ELIGIBLE_WITH_RESTRICTIONS",
                restrictions: { allowedSessionTypes: ["PAD_WORK", "PAD_WORK", "RECOVERY"], allowedTechniqueTypes: [], excludedJoints: ["LEFT_KNEE"], notes: "  " },
            }),
        );
        expect(body.restrictions).toEqual({ allowedSessionTypes: ["PAD_WORK", "RECOVERY"], excludedJoints: ["LEFT_KNEE"] });
    });

    it("never sends restrictions with another decision", () => {
        const restrictions = { ...NO_LIMITS, excludedJoints: ["LEFT_KNEE" as const], notes: "Knee" };
        expect(examinationBody(decision({ decision: "ELIGIBLE", restrictions })).restrictions).toBeUndefined();
        expect(examinationBody(decision({ decision: "NOT_ELIGIBLE", restrictions })).restrictions).toBeUndefined();
    });

    it("leaves the validity date off a not-eligible decision", () => {
        expect(examinationBody(decision({ validUntil: "2027-03-01T00:00:00.000Z" })).validUntil).toBe("2027-03-01T00:00:00.000Z");
        expect(examinationBody(decision({ decision: "NOT_ELIGIBLE", validUntil: "2027-03-01T00:00:00.000Z" })).validUntil).toBeUndefined();
    });

    it("resolves review requests only from a training examination", () => {
        expect(examinationBody(decision({ reviewRequestIds: ["r1", "r1", "r2"] })).reviewRequestIds).toEqual(["r1", "r2"]);
        expect(examinationBody(decision({ scope: "COMPETITION", reviewRequestIds: ["r1"] })).reviewRequestIds).toBeUndefined();
    });

    it("marks a correction", () => {
        expect(examinationBody(decision({ supersedesId: "exam-1" })).supersedesId).toBe("exam-1");
    });
});

describe("clearanceBody", () => {
    it("inherits the examination when nothing is narrowed", () => {
        expect(clearanceBody({ examinationId: "e1", clearanceType: "TRAINING", validFrom: null, validUntil: null, restrictions: NO_LIMITS, notes: " " })).toEqual({
            examinationId: "e1",
            clearanceType: "TRAINING",
        });
    });

    it("sends the narrowed lists, dates and notes", () => {
        expect(
            clearanceBody({
                examinationId: "e1",
                clearanceType: "RETURN_FROM_INJURY",
                validFrom: "2026-09-21T00:00:00.000Z",
                validUntil: "2026-12-01T00:00:00.000Z",
                restrictions: { ...NO_LIMITS, allowedSessionTypes: ["RECOVERY"] },
                notes: "Back to light work",
            }),
        ).toEqual({
            examinationId: "e1",
            clearanceType: "RETURN_FROM_INJURY",
            validFrom: "2026-09-21T00:00:00.000Z",
            validUntil: "2026-12-01T00:00:00.000Z",
            restrictions: { allowedSessionTypes: ["RECOVERY"] },
            notes: "Back to light work",
        });
    });
});

describe("widenedLists", () => {
    const exam: RestrictionLists = { allowedSessionTypes: ["PAD_WORK", "RECOVERY"], allowedTechniqueTypes: null, excludedJoints: ["LEFT_KNEE"] };

    it("accepts the same or narrower lists", () => {
        expect(widenedLists(exam, exam)).toEqual([]);
        expect(widenedLists(exam, { allowedSessionTypes: ["RECOVERY"], allowedTechniqueTypes: ["JAB"], excludedJoints: ["LEFT_KNEE", "RIGHT_KNEE"] })).toEqual([]);
    });

    it("names each list that would allow more", () => {
        expect(widenedLists(exam, { allowedSessionTypes: ["PAD_WORK", "SPARRING"], allowedTechniqueTypes: null, excludedJoints: [] })).toEqual([
            "allowedSessionTypes",
            "excludedJoints",
        ]);
        expect(widenedLists(exam, NO_LIMITS)).toEqual(["allowedSessionTypes", "excludedJoints"]);
    });
});

describe("injury, treatment and review bodies", () => {
    it("trims text and leaves out empty optional fields", () => {
        expect(reviewRequestBody("  Sore knee after sparring ")).toEqual({ reason: "Sore knee after sparring" });
        expect(revokeClearanceBody(" New head knock ")).toEqual({ revokedReason: "New head knock" });
        expect(injuryBody({ affectedJoint: "LEFT_ANKLE", injuryType: " Sprain ", severity: "MODERATE", occurredAt: "2026-09-20T02:00:00.000Z", description: "" })).toEqual({
            affectedJoint: "LEFT_ANKLE",
            injuryType: "Sprain",
            severity: "MODERATE",
            occurredAt: "2026-09-20T02:00:00.000Z",
        });
        expect(treatmentBody({ treatmentType: "Physio", treatmentDate: "2026-09-21T02:00:00.000Z", description: null, outcomeNotes: " ", nextReviewAt: null })).toEqual({
            treatmentType: "Physio",
            treatmentDate: "2026-09-21T02:00:00.000Z",
        });
    });

    it("sends only the injury fields being changed, and clears a blank description", () => {
        expect(injuryUpdateBody({ status: "RESOLVED" })).toEqual({ status: "RESOLVED" });
        expect(injuryUpdateBody({ description: "  " })).toEqual({ description: null });
    });
});

describe("recovery plan bodies", () => {
    const stored = [
        { id: "m1", title: "Full range", criteria: "Pain-free", targetDate: "2026-10-01", isCompleted: true, completedAt: "2026-09-25T00:00:00.000Z", notes: null },
        { id: "m2", title: "Pad work", criteria: "Three rounds", targetDate: null, isCompleted: false, completedAt: null, notes: "Light" },
    ];

    it("creates milestones without ids and without defaults", () => {
        const body = recoveryPlanBody({
            injuryId: "i1",
            title: " Ankle return ",
            description: null,
            startDate: "2026-09-21",
            estimatedEndDate: null,
            milestones: [{ id: "ignored", title: "Walk", criteria: "No limp", targetDate: null, notes: null, isCompleted: false }],
        });
        expect(body).toEqual({ injuryId: "i1", title: "Ankle return", startDate: "2026-09-21", milestones: [{ title: "Walk", criteria: "No limp" }] });
    });

    it("replaces the list keeping existing ids and adding new milestones", () => {
        const drafts = milestoneDrafts(stored);
        drafts[1] = { ...drafts[1], isCompleted: true };
        const body = recoveryPlanUpdateBody({ milestones: [...drafts, { title: "Spar", criteria: "Two light rounds", targetDate: null, notes: null, isCompleted: false }] });
        expect(body.milestones).toEqual([
            { id: "m1", title: "Full range", criteria: "Pain-free", targetDate: "2026-10-01", notes: null, isCompleted: true },
            { id: "m2", title: "Pad work", criteria: "Three rounds", targetDate: null, notes: "Light", isCompleted: true },
            { title: "Spar", criteria: "Two light rounds" },
        ]);
    });

    it("sends a status change on its own", () => {
        expect(recoveryPlanUpdateBody({ status: "COMPLETED" })).toEqual({ status: "COMPLETED" });
    });
});
