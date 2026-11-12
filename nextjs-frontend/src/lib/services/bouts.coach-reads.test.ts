import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { User } from "@/lib/domain/types";

const authenticatedApiRequest = vi.hoisted(() => vi.fn());
const currentUser = vi.hoisted(() => ({ value: null as Pick<User, "id" | "name" | "role"> | null }));
const getFighter = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/client", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/api/client")>()),
    authenticatedApiRequest,
}));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: async () => currentUser.value }));
vi.mock("./people", () => ({ getFighter, getUser: vi.fn(async () => null) }));
vi.mock("./platform-features", () => import("@/test/platform-features-mock"));

import { clearRulesetCache, listApiBouts, listApiRulesets, listApiSuspensions } from "./bouts.api";
import { getWeightTrack, listWeightAlerts } from "./bouts";

/*
 * A1, A5 and A9 (docs/PERFORMANCE-PLAN.md) for bouts: a coach's roster in one list read, weight alerts in two rounds,
 * and the rulesets kept for a minute. The fake service answers like the backend: an unfiltered coach read holds every
 * bout of the coach's fighters (here also D, who isn't asked for).
 */

const IDS = ["fighter-a", "fighter-b", "fighter-c"];
const PHASES = ["SCHEDULED", "CAMP", "COMPLETED", "CANCELLED"] as const;

function boutRow(fighterId: string, index: number) {
    return {
        id: `${fighterId}-b${index}`,
        fighterId,
        coachId: "coach-1",
        rulesetId: "rs-1",
        eventName: `Event ${index}`,
        weightClassCode: "LW",
        weightLimitKg: 70.3,
        catchweightKg: null,
        acuteLossLimitPct: 8,
        requirementsDueDays: 14,
        weighInAt: `2026-12-${String(10 + index).padStart(2, "0")}T08:00:00.000Z`,
        boutAt: `2026-12-${String(11 + index).padStart(2, "0")}T18:00:00.000Z`,
        status: PHASES[index % PHASES.length],
        createdAt: "2026-10-01T00:00:00.000Z",
        history: [],
    };
}

const BOUTS = [...IDS, "fighter-d"].flatMap((fighterId) => PHASES.map((_, index) => boutRow(fighterId, index)));
const RULESET = {
    id: "rs-1",
    name: "Academy rules",
    sport: "MMA",
    verified: true,
    requirementTemplates: [],
    fightWeekDays: 7,
    requirementsDueDays: 14,
    weightClasses: [{ code: "LW", label: "Lightweight", limitKg: 70.3 }],
    acuteWindowDays: 7,
    acuteLossLimitPctLong: 8,
    acuteLossLimitPctShort: 5,
};

function track(status: string) {
    return {
        limitKg: 70.3,
        points: [{ date: "2026-11-10", kg: 74 }, { date: "2026-11-11", kg: 73.6 }],
        latestKg: 73.6,
        latestOn: "2026-11-11",
        remainingPct: 4.5,
        status,
        referencePath: [{ date: "2026-11-01", kg: 75 }],
        nutrition: [{ date: "2026-11-10", adherence: "WAY_OFF" }, { date: "2026-11-09", adherence: "WAY_OFF" }],
    };
}

/** Each bout's weight status: A's camp bout is over the limit, B's is on track, C's scheduled bout is not weighed. */
const TRACKS: Record<string, string> = { "fighter-a-b1": "OVER_LIMIT", "fighter-b-b1": "ON_TRACK", "fighter-c-b0": "NOT_WEIGHED" };

function answer(path: string) {
    const url = new URL(path, "http://api.test");
    if (url.pathname === "/competition-rulesets") return [RULESET];
    if (url.pathname === "/bouts" || url.pathname === "/suspensions") {
        const fighterId = url.searchParams.get("fighterId");
        const statuses = url.searchParams.getAll("status");
        const rows = url.pathname === "/bouts" ? BOUTS : [];
        return { data: rows.filter((row) => (!fighterId || row.fighterId === fighterId) && (statuses.length === 0 || statuses.includes(row.status))), hasNextPage: false, nextCursor: null };
    }
    const weight = /^\/bouts\/([^/]+)\/weight-track$/.exec(url.pathname);
    if (weight) return track(TRACKS[weight[1]] ?? "NEUTRAL");
    const detail = /^\/bouts\/([^/]+)$/.exec(url.pathname);
    if (detail) return BOUTS.find((row) => row.id === detail[1]);
    throw new Error(`Unexpected request ${path}`);
}

const paths = () => authenticatedApiRequest.mock.calls.map(([path]) => path as string);

describe("bouts reads", () => {
    beforeEach(() => {
        vi.stubEnv("APP_DATA_MODE", "api");
        clearRulesetCache();
        authenticatedApiRequest.mockReset();
        authenticatedApiRequest.mockImplementation(async (path: string) => answer(path));
        getFighter.mockReset();
        getFighter.mockImplementation(async (id: string) => ({ id, name: `Name of ${id}` }));
        currentUser.value = null;
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllEnvs();
    });

    describe("a coach's roster (A1)", () => {
        it("reads the bouts once instead of once per fighter, with the same bouts", async () => {
            currentUser.value = { id: "u-1", name: "Doctor", role: "doctor" };
            const perFighter = await listApiBouts(IDS);
            const perFighterReads = paths().filter((path) => path.startsWith("/bouts?"));

            authenticatedApiRequest.mockClear();
            currentUser.value = { id: "u-2", name: "Coach", role: "coach" };
            const atOnce = await listApiBouts(IDS);
            const atOnceReads = paths().filter((path) => path.startsWith("/bouts?"));

            expect(atOnce).toEqual(perFighter);
            expect(atOnce).toHaveLength(12);
            expect(atOnce.every((bout) => IDS.includes(bout.fighterId))).toBe(true);
            expect(perFighterReads).toHaveLength(3);
            expect(atOnceReads).toEqual(["/bouts?limit=100"]);
        });

        it("reads suspensions the same way", async () => {
            currentUser.value = { id: "u-2", name: "Coach", role: "coach" };
            await listApiSuspensions(IDS);
            expect(paths()).toEqual(["/suspensions?limit=100"]);
        });

        it("still reads a single fighter by id", async () => {
            currentUser.value = { id: "u-2", name: "Coach", role: "coach" };
            await listApiBouts(["fighter-a"]);
            expect(paths().filter((path) => path.startsWith("/bouts?"))).toEqual(["/bouts?limit=100&fighterId=fighter-a"]);
        });

        it("asks the service for several phases as repeated status parameters", async () => {
            currentUser.value = { id: "u-2", name: "Coach", role: "coach" };
            const running = await listApiBouts(IDS, ["SCHEDULED", "CAMP"]);
            expect(paths().filter((path) => path.startsWith("/bouts?"))).toEqual(["/bouts?limit=100&status=SCHEDULED&status=CAMP"]);
            expect(running.map((bout) => bout.phase).sort()).toEqual([...Array(3).fill("CAMP"), ...Array(3).fill("SCHEDULED")]);
        });
    });

    describe("weight alerts (A5)", () => {
        it("gives the same alerts as the full weight track, in two rounds per bout and without re-reading the bout", async () => {
            currentUser.value = { id: "u-2", name: "Coach", role: "coach" };
            const now = new Date("2026-11-12T09:00:00.000Z");
            const alerts = await listWeightAlerts(IDS, now);

            expect(alerts.map((alert) => [alert.bout.id, alert.fighterName, alert.track.status, alert.wayOff])).toEqual([
                ["fighter-a-b1", "Name of fighter-a", "OVER_LIMIT", 2],
                ["fighter-c-b0", "Name of fighter-c", "NOT_WEIGHED", 2],
            ]);
            // No bout detail and no second weight-track read; the fighter is read only for bouts that alert.
            expect(paths().filter((path) => /^\/bouts\/[^/?]+$/.test(path))).toEqual([]);
            expect(paths().filter((path) => path.endsWith("/weight-track"))).toHaveLength(6);
            expect(getFighter.mock.calls.map(([id]) => id).sort()).toEqual(["fighter-a", "fighter-c"]);

            for (const alert of alerts) expect(alert.track).toEqual(await getWeightTrack(alert.bout.id, now));
        });

        it("reads a single weight track and its bout together", async () => {
            let pending = 0;
            let overlapped = false;
            authenticatedApiRequest.mockImplementation(async (path: string) => {
                pending += 1;
                if (pending > 1) overlapped = true;
                await new Promise((resolve) => setTimeout(resolve, 5));
                pending -= 1;
                return answer(path);
            });
            await getWeightTrack("fighter-a-b1", new Date("2026-11-12T09:00:00.000Z"));
            expect(overlapped).toBe(true);
        });
    });

    describe("rulesets cache (A9)", () => {
        it("asks for the rulesets once a minute, whoever reads them", async () => {
            vi.useFakeTimers({ toFake: ["Date"] });
            vi.setSystemTime(new Date("2026-11-12T09:00:00.000Z"));
            const first = await listApiRulesets();
            const second = await listApiRulesets();
            expect(second).toEqual(first);
            expect(first[0]?.id).toBe("rs-1");
            expect(paths().filter((path) => path === "/competition-rulesets")).toHaveLength(1);

            // A caller changing its copy leaves the cached rulesets alone.
            second[0]!.name = "Changed";
            expect((await listApiRulesets())[0]?.name).toBe("Academy rules");

            vi.setSystemTime(new Date("2026-11-12T09:01:01.000Z"));
            await listApiRulesets();
            expect(paths().filter((path) => path === "/competition-rulesets")).toHaveLength(2);
        });

        it("never keeps a refusal", async () => {
            authenticatedApiRequest.mockImplementation(async (path: string) => {
                if (path === "/competition-rulesets") throw new (await import("@/lib/api/client")).ApiError({ message: "Forbidden", kind: "http", status: 403 });
                return answer(path);
            });
            await expect(listApiRulesets()).resolves.toEqual([]);
            authenticatedApiRequest.mockImplementation(async (path: string) => answer(path));
            await expect(listApiRulesets()).resolves.toHaveLength(1);
            expect(paths().filter((path) => path === "/competition-rulesets")).toHaveLength(2);
        });
    });
});
