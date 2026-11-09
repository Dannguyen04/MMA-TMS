import { describe, expect, it } from "vitest";

import { DEFAULT_MANUAL_BLOCKED_SESSION_TYPES } from "./intensity-tiers";
import { SESSION_TYPES } from "./medical-contract";
import {
    isLiveSuspension,
    liveSuspensions,
    pickFighterSuspension,
    sessionTypesUpToTier,
    suspensionHeadline,
    suspensionLadder,
    suspensionTierToday,
    upcomingSessions,
    weekSessionTally,
} from "./fighter-suspension-view";
import type { SessionStatus, Suspension } from "./types";

/** A suspension as `GET /suspensions` returns it; status and gradedReturn are the server's, for today. */
function suspension(overrides: Partial<Suspension> & Pick<Suspension, "id">): Suspension {
    return {
        fighterId: "f-1",
        boutId: null,
        reason: "MANDATORY_REST",
        startsOn: "2026-11-08",
        endsOn: "2026-11-14",
        lossOfConsciousness: null,
        suggestedDays: null,
        overrideReason: null,
        blockedSessionTypes: [...DEFAULT_MANUAL_BLOCKED_SESSION_TYPES],
        maxAllowedTier: 1,
        requiresClearance: false,
        clearedAt: null,
        clearedById: null,
        clearanceNote: null,
        createdById: "u-coach",
        createdAt: "2026-11-08T01:00:00.000Z",
        updatedAt: "2026-11-08T01:00:00.000Z",
        status: "ACTIVE",
        gradedReturn: null,
        issuedBy: "CLUB",
        issuerReference: null,
        earlyEndExaminationId: null,
        liftReference: null,
        ...overrides,
    };
}

const active = suspension({ id: "s-active" });
const awaiting = suspension({ id: "s-awaiting", reason: "TKO", requiresClearance: true, endsOn: "2026-11-01", status: "AWAITING_CLEARANCE" });
const graded = suspension({
    id: "s-graded",
    reason: "KO",
    requiresClearance: true,
    endsOn: "2026-11-30",
    clearedAt: "2026-11-09T02:00:00.000Z",
    status: "ENDED",
    gradedReturn: { ceiling: 3, fullReturnOn: "2026-11-11" },
});
const upcoming = suspension({ id: "s-upcoming", reason: "OTHER", startsOn: "2026-11-20", endsOn: "2026-12-31", status: "UPCOMING" });
const ended = suspension({ id: "s-ended", reason: "DQ", endsOn: "2026-10-01", status: "ENDED" });

describe("T-048 §2.1: which suspensions the fighter sees", () => {
    it("keeps UPCOMING, ACTIVE, AWAITING_CLEARANCE and ENDED in graded return; drops a plain ENDED one", () => {
        expect([active, awaiting, graded, upcoming].every(isLiveSuspension)).toBe(true);
        expect(isLiveSuspension(ended)).toBe(false);
        expect(liveSuspensions([ended, active, graded, ended]).map((s) => s.id)).toEqual(["s-active", "s-graded"]);
    });

    it("F6: nothing live gives no card", () => {
        expect(pickFighterSuspension([])).toBeNull();
        expect(pickFighterSuspension([ended])).toBeNull();
    });

    it("F7: a KO in graded return and an OTHER without it → the OTHER one, and 1 more", () => {
        const other = suspension({ id: "s-other", reason: "OTHER", endsOn: "2026-11-10" });
        expect(pickFighterSuspension([graded, other])).toEqual({ main: other, others: 1 });
        expect(pickFighterSuspension([other, graded])).toEqual({ main: other, others: 1 });
    });

    it("among suspensions without graded return, the latest endsOn wins; ended ones are not counted", () => {
        const later = suspension({ id: "s-later", endsOn: "2026-12-01" });
        expect(pickFighterSuspension([active, ended, later, awaiting])).toEqual({ main: later, others: 2 });
    });

    it("UPCOMING is shown only when nothing is in force, and counts among the others", () => {
        expect(pickFighterSuspension([upcoming, graded])).toEqual({ main: graded, others: 1 });
        expect(pickFighterSuspension([upcoming, ended])).toEqual({ main: upcoming, others: 0 });
    });
});

describe("T-048 §2.1: the card's main sentence", () => {
    it("F3: in force with an end date → suspended until endsOn, and whether clearance follows", () => {
        expect(suspensionHeadline(active)).toEqual({ kind: "active", endsOn: "2026-11-14", clearanceAfter: false });
        const ko = suspension({ id: "s-ko", reason: "KO", requiresClearance: true });
        expect(suspensionHeadline(ko)).toEqual({ kind: "active", endsOn: "2026-11-14", clearanceAfter: true });
    });

    it("F5: past endsOn and not cleared → waiting for the doctor", () => {
        expect(suspensionHeadline(awaiting)).toEqual({ kind: "awaitingClearance" });
    });

    it("F4: graded return → full training from fullReturnOn", () => {
        expect(suspensionHeadline(graded)).toEqual({ kind: "gradedReturn", fullReturnOn: "2026-11-11" });
    });

    it("UPCOMING → from startsOn to endsOn", () => {
        expect(suspensionHeadline(upcoming)).toEqual({ kind: "upcoming", startsOn: "2026-11-20", endsOn: "2026-12-31" });
    });
});

describe("T-048 §2.1 item 3: what may be trained", () => {
    it("in force: the suspension's maxAllowedTier, drawn as on the coach's page", () => {
        expect(suspensionTierToday(active)).toBe(1);
        expect(suspensionLadder(active)).toEqual({ maxAllowedTier: 1 });
    });

    it("graded return: the day's ceiling, not the stale maxAllowedTier of the ended suspension", () => {
        expect(suspensionTierToday(graded)).toBe(3);
        expect(suspensionLadder(graded)).toEqual({ maxAllowedTier: 5, ceiling: 3 });
        expect(suspensionTierToday({ ...graded, gradedReturn: { ceiling: 4, fullReturnOn: "2026-11-11" } })).toBe(4);
    });

    it("lists the session types at or under the tier, lightest first", () => {
        expect(sessionTypesUpToTier(0)).toEqual([]);
        expect(sessionTypesUpToTier(1)).toEqual(["RECOVERY", "PHYSICAL_THERAPY"]);
        expect(sessionTypesUpToTier(3)).toEqual(["RECOVERY", "PHYSICAL_THERAPY", "STRENGTH_CONDITIONING", "SHADOW_BOXING", "PAD_WORK", "HEAVY_BAG"]);
        expect(sessionTypesUpToTier(4)).toContain("GRAPPLING");
        expect(sessionTypesUpToTier(4)).not.toContain("SPARRING");
        expect([...sessionTypesUpToTier(5)].sort()).toEqual([...SESSION_TYPES].sort());
    });
});

const session = (id: string, status: SessionStatus, scheduledAt: string) => ({ id, status, scheduledAt });

describe("T-048 F2: the week's totals with pending sessions", () => {
    it("counts pending on its own, outside planned and to go; the parts add up to every session not cancelled", () => {
        const statuses: SessionStatus[] = ["completed", "missed", "scheduled", "in_progress", "pending", "pending", "pending", "cancelled"];
        const tally = weekSessionTally(statuses.map((status) => ({ status })));
        expect(tally).toEqual({ planned: 4, completed: 1, missed: 1, toGo: 2, pending: 3 });
        expect(tally.completed + tally.missed + tally.toGo).toBe(tally.planned);
        expect(tally.planned + tally.pending).toBe(statuses.filter((s) => s !== "cancelled").length);
    });

    it("F6: without pending sessions the totals are what the page counted before", () => {
        const statuses: SessionStatus[] = ["completed", "scheduled", "cancelled"];
        const before = statuses.filter((s) => s !== "cancelled");
        const tally = weekSessionTally(statuses.map((status) => ({ status })));
        expect(tally.planned).toBe(before.length);
        expect(tally.toGo).toBe(before.filter((s) => s === "scheduled" || s === "in_progress").length);
        expect(tally.pending).toBe(0);
    });
});

describe("T-048 F1: upcoming sessions keep the pending ones", () => {
    // 14:00 on 9 Nov in the academy (UTC+7).
    const now = "2026-11-09T07:00:00.000Z";
    const sessions = [
        session("later", "scheduled", "2026-11-12T02:00:00.000Z"),
        session("pending-this-morning", "pending", "2026-11-09T02:00:00.000Z"),
        session("pending-yesterday", "pending", "2026-11-08T02:00:00.000Z"),
        session("scheduled-this-morning", "scheduled", "2026-11-09T02:00:00.000Z"),
        session("pending-tomorrow", "pending", "2026-11-10T02:00:00.000Z"),
        session("cancelled", "cancelled", "2026-11-10T03:00:00.000Z"),
        session("pending-friday", "pending", "2026-11-13T02:00:00.000Z"),
        session("completed", "completed", "2026-11-09T08:00:00.000Z"),
    ];

    it("lists pending sessions from today on, soonest first, with the scheduled ones still ahead", () => {
        expect(upcomingSessions(sessions, now, 10).map((s) => s.id)).toEqual(["pending-this-morning", "pending-tomorrow", "later", "pending-friday"]);
    });

    it("the limit is for scheduled sessions; pending ones take no slot and stop 7 days ahead", () => {
        const more = [
            ...sessions,
            session("later-still", "scheduled", "2026-11-14T02:00:00.000Z"),
            session("pending-sunday", "pending", "2026-11-15T02:00:00.000Z"),
            session("pending-next-monday", "pending", "2026-11-16T02:00:00.000Z"),
        ];
        expect(upcomingSessions(more, now, 1).map((s) => s.id)).toEqual(["pending-this-morning", "pending-tomorrow", "later", "pending-friday", "pending-sunday"]);
        expect(upcomingSessions(more, now, 0).map((s) => s.id)).toEqual(["pending-this-morning", "pending-tomorrow", "pending-friday", "pending-sunday"]);
    });

    it("an earlier session in the academy day counts as today even when it is still the previous day in UTC", () => {
        // 06:00 on 10 Nov in the academy is 23:00 on 9 Nov in UTC.
        const early = session("early", "pending", "2026-11-09T23:00:00.000Z");
        expect(upcomingSessions([early], "2026-11-10T05:00:00.000Z", 4).map((s) => s.id)).toEqual(["early"]);
    });
});
