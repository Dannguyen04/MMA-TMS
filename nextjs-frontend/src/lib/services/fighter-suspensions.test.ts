import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";
import * as constants from "@/lib/auth/constants";
import { upcomingSessions, weekSessionTally } from "@/lib/domain/fighter-suspension-view";
import type { User } from "@/lib/domain/types";
import { addDaysToKey, dayKey } from "@/lib/format";
import { db } from "@/lib/mocks/db";
import { TODAY_KEY } from "@/lib/mocks/time";
import { nullIfServiceFails } from "./api-helpers";
import { listLiveSuspensions } from "./suspensions";

const authenticatedApiRequest = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/client", async (loadOriginal) => ({
    ...(await loadOriginal<typeof import("@/lib/api/client")>()),
    authenticatedApiRequest,
}));

function fighterUser(profileId: string): User {
    return {
        id: `u-${profileId}`,
        email: `${profileId}@example.com`,
        name: profileId,
        role: "fighter",
        title: "Fighter",
        phone: null,
        status: "active",
        createdAt: "2026-01-01T00:00:00.000Z",
        lastActiveAt: null,
        profileId,
        effectiveCapabilities: ["fighters:read"],
    };
}

/* ─── Demo mode ───────────────────────────────────────────────────────────── */

describe("T-048 listLiveSuspensions, demo mode (T-056 sample data)", () => {
    beforeEach(() => {
        delete (globalThis as Record<string, unknown>).__mmaMockDb;
        vi.spyOn(constants, "isDemoAuthEnabled").mockReturnValue(true);
    });
    afterEach(() => vi.restoreAllMocks());

    it("Tariq Haddad: the MANDATORY_REST in force, not the TKO and DQ that ended long ago", async () => {
        const live = await listLiveSuspensions("f-tariq-haddad", fighterUser("f-tariq-haddad"));
        expect(live.map((s) => [s.id, s.reason, s.status, s.maxAllowedTier])).toEqual([["susp-mandatory-rest", "MANDATORY_REST", "ACTIVE", 1]]);
    });

    it("keeps the awaiting-clearance and the graded-return cases, which `active=true` would drop", async () => {
        const diego = await listLiveSuspensions("f-diego-alvarez", fighterUser("f-diego-alvarez"));
        expect(diego.map((s) => s.status)).toEqual(["AWAITING_CLEARANCE"]);

        const linh = await listLiveSuspensions("f-linh-pham", fighterUser("f-linh-pham"));
        expect(linh).toHaveLength(1);
        expect(linh[0]).toMatchObject({ id: "susp-graded-return", status: "ENDED", gradedReturn: { ceiling: 3 } });
    });

    it("F6: Emma Lindqvist has none", async () => {
        await expect(listLiveSuspensions("f-emma-lindqvist", fighterUser("f-emma-lindqvist"))).resolves.toEqual([]);
    });

    it("a fighter asking for another fighter's suspensions gets the backend's 403", async () => {
        await expect(listLiveSuspensions("f-marcus-hale", fighterUser("f-tariq-haddad"))).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
    });

    it("F1/F2: Tariq's pending sessions in the next 7 days sit in his active plan, are all listed and count apart", () => {
        // How many depends on the weekday the demo starts on (the rest falls Sunday–Saturday), so the case picks them by
        // what they are, not by a count (T-030-REVIEW B5-15, B5-16).
        const sessions = db().trainingSessions.filter((s) => s.fighterId === "f-tariq-haddad");
        const windowEnd = addDaysToKey(TODAY_KEY, 7);
        const pending = sessions.filter((s) => s.status === "pending" && dayKey(s.scheduledAt) >= TODAY_KEY && dayKey(s.scheduledAt) < windowEnd);
        expect(pending.length).toBeGreaterThan(0);

        const activePlan = db().trainingPlans.find((p) => p.fighterId === "f-tariq-haddad" && p.status === "active")!;
        expect(pending.every((s) => s.planId === activePlan.id)).toBe(true);
        // The training page lists every one of them beside the next 4 scheduled sessions.
        const listed = upcomingSessions(sessions.filter((s) => s.planId === activePlan.id), new Date().toISOString(), 4);
        expect(listed.filter((s) => s.status === "pending").map((s) => s.id).sort()).toEqual(pending.map((s) => s.id).sort());

        const tally = weekSessionTally(sessions.filter((s) => s.status !== "cancelled"));
        expect(tally.pending).toBe(sessions.filter((s) => s.status === "pending").length);
        expect(tally.completed + tally.missed + tally.toGo + tally.pending).toBe(sessions.filter((s) => s.status !== "cancelled").length);
    });
});

/* ─── API mode ────────────────────────────────────────────────────────────── */

function backendSuspension(id: string, status: string, gradedReturn: { ceiling: 3 | 4; fullReturnOn: string } | null = null) {
    return {
        id,
        fighterId: "f-1",
        boutId: null,
        reason: gradedReturn ? "KO" : "MANDATORY_REST",
        startsOn: "2026-11-01",
        endsOn: "2026-11-14",
        lossOfConsciousness: null,
        suggestedDays: null,
        overrideReason: null,
        blockedSessionTypes: ["SHADOW_BOXING", "PAD_WORK", "HEAVY_BAG", "SPARRING", "GRAPPLING", "STRENGTH_CONDITIONING"],
        maxAllowedTier: 1,
        requiresClearance: Boolean(gradedReturn),
        clearedAt: gradedReturn ? "2026-11-09T02:00:00.000Z" : null,
        clearedById: null,
        clearanceNote: null,
        createdById: "u-coach",
        createdAt: "2026-11-01T01:00:00.000Z",
        updatedAt: "2026-11-01T01:00:00.000Z",
        status,
        gradedReturn,
        issuedBy: "CLUB",
        issuerReference: null,
        earlyEndExaminationId: null,
        liftReference: null,
    };
}

describe("T-048 listLiveSuspensions, API mode", () => {
    beforeEach(() => {
        authenticatedApiRequest.mockReset();
        vi.spyOn(constants, "isDemoAuthEnabled").mockReturnValue(false);
    });
    afterEach(() => vi.restoreAllMocks());

    it("reads every page for the fighter without `active`, then keeps the live ones on the device", async () => {
        authenticatedApiRequest
            .mockResolvedValueOnce({
                data: [backendSuspension("s-active", "ACTIVE"), backendSuspension("s-ended", "ENDED")],
                hasNextPage: true,
                nextCursor: "c-2",
            })
            .mockResolvedValueOnce({
                data: [
                    backendSuspension("s-graded", "ENDED", { ceiling: 4, fullReturnOn: "2026-11-10" }),
                    backendSuspension("s-upcoming", "UPCOMING"),
                    backendSuspension("s-awaiting", "AWAITING_CLEARANCE"),
                ],
                hasNextPage: false,
                nextCursor: null,
            });

        const live = await listLiveSuspensions("f-1", fighterUser("f-1"));

        expect(live.map((s) => s.id)).toEqual(["s-active", "s-graded", "s-upcoming", "s-awaiting"]);
        expect(live[1]!.gradedReturn).toEqual({ ceiling: 4, fullReturnOn: "2026-11-10" });
        const paths = authenticatedApiRequest.mock.calls.map((call) => String(call[0]));
        expect(paths).toHaveLength(2);
        for (const path of paths) {
            expect(path.startsWith("/suspensions?")).toBe(true);
            expect(path).toContain("fighterId=f-1");
            expect(path).toContain("limit=100");
            expect(path).not.toContain("active=");
        }
        expect(paths[0]).not.toContain("cursor=");
        expect(paths[1]).toContain("cursor=c-2");
    });

    it("F6: no live suspension gives an empty list", async () => {
        authenticatedApiRequest.mockResolvedValueOnce({ data: [backendSuspension("s-ended", "ENDED")], hasNextPage: false, nextCursor: null });
        await expect(listLiveSuspensions("f-1", fighterUser("f-1"))).resolves.toEqual([]);
    });

    it("a failing suspensions service throws, so the page can show that the status couldn't be read", async () => {
        authenticatedApiRequest.mockRejectedValueOnce(new ApiError({ message: "down", kind: "http", status: 503, code: "HTTP_503" }));
        await expect(nullIfServiceFails(listLiveSuspensions("f-1", fighterUser("f-1")))).resolves.toBeNull();
    });
});
