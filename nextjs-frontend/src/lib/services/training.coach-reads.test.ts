import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { User } from "@/lib/domain/types";

const authenticatedApiRequest = vi.hoisted(() => vi.fn());
const currentUser = vi.hoisted(() => ({ value: null as Pick<User, "role"> | null }));

vi.mock("@/lib/api/client", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/api/client")>()),
    authenticatedApiRequest,
}));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: async () => currentUser.value }));
vi.mock("./platform-features", () => import("@/test/platform-features-mock"));

import { getUpcomingSessions, listPlans, listSessions } from "./training";

/*
 * A1 and T-063 (docs/PERFORMANCE-PLAN.md): a coach's roster is read in one request without `fighterId` and narrowed
 * here; a doctor names the fighters with `fighterIds`. Several statuses go in one comma-separated `status`.
 * The fake service below answers like the backend: an unfiltered coach read holds every fighter assigned to the coach
 * (here also D, who isn't asked for), a `fighterId` or `fighterIds` read holds those fighters only.
 */

const IDS = ["fighter-a", "fighter-b", "fighter-c"];
const ASSIGNED = [...IDS, "fighter-d"];
const STATUSES = ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "SKIPPED", "CANCELLED", "ABANDONED"] as const;

function session(fighterId: string, index: number) {
    const status = STATUSES[index % STATUSES.length];
    return {
        id: `${fighterId}-s${index}`,
        fighterId,
        coachId: "coach-1",
        planId: null,
        title: `Session ${index}`,
        // One a day from 1 November; the far-future ones keep "upcoming" stable whatever today is.
        scheduledAt: index < 10 ? `2026-11-${String(index + 1).padStart(2, "0")}T10:00:00.000Z` : `2099-01-${String(index - 9).padStart(2, "0")}T10:00:00.000Z`,
        plannedDurationSec: 3600,
        actualDurationSec: status === "COMPLETED" ? 3300 : null,
        roundCount: 4,
        location: null,
        sessionType: "HEAVY_BAG",
        status,
        coachNotes: null,
        cancellationReason: status === "CANCELLED" ? "Ill" : null,
        checkedInAt: null,
        completedAt: status === "COMPLETED" ? "2026-11-01T11:00:00.000Z" : null,
        abandonedAt: null,
        skippedAt: null,
        reportedRpe: null,
        isActive: true,
        createdAt: "2026-10-01T00:00:00.000Z",
        updatedAt: "2026-10-01T00:00:00.000Z",
        deletedAt: null,
        cancelledAt: null,
    };
}

function plan(fighterId: string, index: number) {
    return {
        id: `${fighterId}-p${index}`,
        fighterId,
        coachId: "coach-1",
        title: `Plan ${index}`,
        description: null,
        startDate: `2026-10-0${index + 1}`,
        endDate: null,
        status: index === 0 ? "ACTIVE" : "DRAFT",
        goals: null,
        milestones: [],
        isActive: true,
        createdAt: "2026-10-01T00:00:00.000Z",
        updatedAt: "2026-10-01T00:00:00.000Z",
        deletedAt: null,
        phase: "build",
    };
}

const SESSIONS = ASSIGNED.flatMap((fighterId) => Array.from({ length: 14 }, (_, index) => session(fighterId, index)));
const PLANS = ASSIGNED.flatMap((fighterId) => [plan(fighterId, 0), plan(fighterId, 1)]);

/** The service's numbered list, filtered the way it filters. */
function answer(path: string) {
    const url = new URL(path, "http://api.test");
    const rows: { fighterId: string; status: string; scheduledAt?: string }[] = url.pathname === "/training-sessions" ? SESSIONS : url.pathname === "/training-plans" ? PLANS : [];
    const fighterId = url.searchParams.get("fighterId");
    const fighterIds = url.searchParams.get("fighterIds")?.split(",");
    const statuses = url.searchParams.get("status")?.split(",");
    const from = url.searchParams.get("fromDate");
    const to = url.searchParams.get("toDate");
    const data = rows.filter(
        (row) =>
            (!fighterId || row.fighterId === fighterId) &&
            (!fighterIds || fighterIds.includes(row.fighterId)) &&
            (!statuses || statuses.includes(row.status)) &&
            (!from || (row.scheduledAt ?? "") >= from) &&
            (!to || (row.scheduledAt ?? "") <= to),
    );
    return { data, total: data.length, hasNextPage: false };
}

function calls(prefix: string): string[] {
    return authenticatedApiRequest.mock.calls.map(([path]) => path as string).filter((path) => path.startsWith(prefix));
}

/** Runs a read one fighter at a time (an admin), as a coach and as a doctor, returning results and request counts. */
async function threeWays<T>(read: () => Promise<T>, prefix: string) {
    const run = async (role: User["role"]) => {
        currentUser.value = { role };
        authenticatedApiRequest.mockClear();
        const result = await read();
        return { result, calls: calls(prefix) };
    };
    return { perFighter: await run("admin"), coach: await run("coach"), doctor: await run("doctor") };
}

describe("reads of several fighters (A1, T-063)", () => {
    beforeEach(() => {
        vi.stubEnv("APP_DATA_MODE", "api");
        authenticatedApiRequest.mockReset();
        authenticatedApiRequest.mockImplementation(async (path: string) => answer(path));
        currentUser.value = null;
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("reads a week of sessions once instead of once per fighter, with the same sessions", async () => {
        const { perFighter, coach, doctor } = await threeWays(
            () => listSessions({ fighterIds: IDS, from: "2026-11-01T00:00:00.000Z", to: "2026-11-07T23:59:59.999Z" }),
            "/training-sessions",
        );
        expect(perFighter.result.length).toBeGreaterThan(0);
        expect(coach.result).toEqual(perFighter.result);
        expect(doctor.result).toEqual(perFighter.result);
        expect(perFighter.calls).toHaveLength(3);
        expect(coach.calls).toEqual([expect.not.stringContaining("fighterId")]);
        expect(doctor.calls).toHaveLength(1);
        expect(new URL(doctor.calls[0], "http://api.test").searchParams.get("fighterIds")).toBe(IDS.join(","));
    });

    it("sends several statuses in one request", async () => {
        const filter = { fighterIds: IDS, status: ["completed", "cancelled"] as ("completed" | "cancelled")[], from: "2026-11-01T00:00:00.000Z", to: "2026-11-30T00:00:00.000Z" };
        const { perFighter, coach, doctor } = await threeWays(() => listSessions(filter), "/training-sessions");
        expect(coach.result).toEqual(perFighter.result);
        expect(doctor.result).toEqual(perFighter.result);
        // CANCELLED only: an ABANDONED session reads as cancelled too, but the service's status filter never matched it.
        expect(coach.result.map((item) => item.status).sort()).toEqual([...Array(3).fill("cancelled"), ...Array(6).fill("completed")]);
        expect(coach.calls).toHaveLength(1);
        expect(new URL(coach.calls[0], "http://api.test").searchParams.get("status")).toBe("COMPLETED,CANCELLED");
    });

    it("reads upcoming sessions of every fighter in one request", async () => {
        const { perFighter, coach, doctor } = await threeWays(() => getUpcomingSessions(IDS, Number.POSITIVE_INFINITY), "/training-sessions");
        expect(perFighter.result.length).toBeGreaterThan(0);
        expect(coach.result).toEqual(perFighter.result);
        expect(doctor.result).toEqual(perFighter.result);
        expect(perFighter.calls).toHaveLength(3);
        expect(coach.calls).toHaveLength(1);
        expect(doctor.calls).toHaveLength(1);
    });

    it("reads plans once, with the same plans", async () => {
        const { perFighter, coach, doctor } = await threeWays(() => listPlans({ fighterIds: IDS }), "/training-plans");
        expect(perFighter.result).toHaveLength(6);
        expect(coach.result).toEqual(perFighter.result);
        expect(doctor.result).toEqual(perFighter.result);
        expect(coach.calls).toHaveLength(1);
        expect(doctor.calls).toHaveLength(1);
    });

    it("still reads a single fighter with fighterId", async () => {
        currentUser.value = { role: "coach" };
        await listSessions({ fighterIds: ["fighter-a"] });
        expect(calls("/training-sessions")).toEqual([expect.stringContaining("fighterId=fighter-a")]);
    });

    it("splits a doctor's fighters into requests of at most 100", async () => {
        currentUser.value = { role: "doctor" };
        const many = Array.from({ length: 150 }, (_, index) => `fighter-${index}`);
        await listPlans({ fighterIds: many });
        const sent = calls("/training-plans").map((path) => new URL(path, "http://api.test").searchParams.get("fighterIds")?.split(",").length);
        expect(sent).toEqual([100, 50]);
    });

    it("falls back to one read per fighter when the coach's whole list is too long to drain", async () => {
        currentUser.value = { role: "coach" };
        authenticatedApiRequest.mockImplementation(async (path: string) => {
            const response = answer(path);
            return path.includes("fighterId=") ? response : { ...response, total: 6000 };
        });
        const sessions = await listSessions({ fighterIds: IDS });
        expect(sessions).toHaveLength(42);
        expect(calls("/training-sessions")).toHaveLength(4);
    });

    it("reads nothing for an empty scope", async () => {
        currentUser.value = { role: "coach" };
        await expect(listSessions({ fighterIds: [] })).resolves.toEqual([]);
        expect(authenticatedApiRequest).not.toHaveBeenCalled();
    });
});
