import { beforeEach, describe, expect, it, vi } from "vitest";
import type { z } from "zod";

import { ApiError } from "@/lib/api/client";

const authenticatedApiRequest = vi.hoisted(() => vi.fn());
/** React `cache` memoizes per server request; outside a render it doesn't, so the test gives it one request's memory. */
const requestMemory = vi.hoisted(() => new Map<unknown, Map<string, unknown>>());

vi.mock("react", async (importOriginal) => ({
    ...(await importOriginal<typeof import("react")>()),
    cache:
        <A extends unknown[], R>(fn: (...args: A) => R) =>
        (...args: A): R => {
            const memory = requestMemory.get(fn) ?? new Map<string, unknown>();
            requestMemory.set(fn, memory);
            const key = JSON.stringify(args);
            if (!memory.has(key)) memory.set(key, fn(...args));
            return memory.get(key) as R;
        },
}));
vi.mock("@/lib/api/client", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/api/client")>()),
    authenticatedApiRequest,
}));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: async () => null }));
vi.mock("./admin", () => ({ getSettings: vi.fn() }));
vi.mock("./people", () => ({ getDoctor: vi.fn(), getFighter: vi.fn(), listFighters: vi.fn(), listScopedFighterIds: vi.fn(async () => []) }));

import { listClearances, listInjuries, listRecoveryPlans } from "./medical.api";

/*
 * GET /medical/history: a list over several fighters reads each record type's history in one batch request instead of
 * one paginated read per fighter, and falls back to the per-fighter read when the batch fails.
 */

const IDS = ["f-1", "f-2", "f-3"];

function pastInjury(fighterId: string) {
    return {
        id: `${fighterId}-injury`,
        fighterId,
        reportedById: "doctor-1",
        affectedJoint: "LEFT_KNEE",
        injuryType: "Sprain",
        severity: "MINOR",
        occurredAt: "2026-10-01T08:00:00.000Z",
        description: null,
        status: "RESOLVED",
        resolvedAt: "2026-10-20T08:00:00.000Z",
    };
}

const entry = (fighterId: string) => ({ recordType: "INJURY", recordId: `${fighterId}-injury`, revision: 2, recordedAt: "2026-10-20T08:00:00.000Z", snapshot: pastInjury(fighterId) });

const notFound = () => new ApiError({ message: "not found", kind: "http", status: 404, code: "FIGHTER_NOT_FOUND" });

/** Answers like the backend; `historyBatch` decides what `GET /medical/history` does. */
function serve(historyBatch: (url: URL) => unknown) {
    authenticatedApiRequest.mockImplementation(async (path: string, schema: z.ZodType) => {
        const url = new URL(path, "http://api.test");
        if (url.pathname === "/medical/dossiers") return schema.parse([]);
        if (url.pathname === "/medical/history") return schema.parse(historyBatch(url));
        const single = url.pathname.match(/^\/fighters\/([^/]+)\/medical\/history$/);
        if (single) {
            const entries = url.searchParams.get("recordType") === "INJURY" ? [entry(single[1])] : [];
            return schema.parse({ data: entries, total: entries.length, hasNextPage: false });
        }
        // Single dossier reads: nothing active, so lists come from history only.
        throw notFound();
    });
}

const calls = (pattern: RegExp) => authenticatedApiRequest.mock.calls.map(([path]) => path as string).filter((path) => pattern.test(path));
const singleHistoryCalls = () => calls(/^\/fighters\/[^/]+\/medical\/history/);
const batchHistoryCalls = () => calls(/^\/medical\/history\?/);

describe("medical history batch priming", () => {
    beforeEach(() => {
        requestMemory.clear();
        authenticatedApiRequest.mockReset();
    });

    it("reads the injury history of every fighter in one request", async () => {
        serve((url) => (url.searchParams.get("fighterIds") ?? "").split(",").map((fighterId) => ({ fighterId, entries: [entry(fighterId)] })));

        const injuries = await listInjuries({ fighterIds: IDS });

        expect(batchHistoryCalls()).toEqual([`/medical/history?fighterIds=${IDS.join(",")}&recordType=INJURY`]);
        expect(singleHistoryCalls()).toEqual([]);
        expect(injuries.map((injury) => injury.id).sort()).toEqual(IDS.map((id) => `${id}-injury`));
    });

    it("sends one batch per record type for clearances and recovery plans", async () => {
        serve((url) => (url.searchParams.get("fighterIds") ?? "").split(",").map((fighterId) => ({ fighterId, entries: [] })));

        await listClearances({ fighterIds: IDS }, "2026-11-12T08:00:00.000Z");
        await listRecoveryPlans({ fighterIds: IDS });

        expect(batchHistoryCalls().map((path) => new URL(path, "http://api.test").searchParams.get("recordType"))).toEqual(["MEDICAL_CLEARANCE", "RECOVERY_PLAN"]);
        expect(singleHistoryCalls()).toEqual([]);
    });

    it("reuses the batch for later reads in the same request", async () => {
        serve((url) => (url.searchParams.get("fighterIds") ?? "").split(",").map((fighterId) => ({ fighterId, entries: [entry(fighterId)] })));

        await listInjuries({ fighterIds: IDS });
        await listInjuries({ fighterIds: IDS });

        expect(batchHistoryCalls()).toHaveLength(1);
        expect(singleHistoryCalls()).toEqual([]);
    });

    it("falls back to the per-fighter read when the batch fails", async () => {
        serve(() => {
            throw new ApiError({ message: "too large", kind: "http", status: 400, code: "MEDICAL_HISTORY_BATCH_TOO_LARGE" });
        });

        const injuries = await listInjuries({ fighterIds: IDS });

        expect(batchHistoryCalls()).toHaveLength(1);
        expect(singleHistoryCalls()).toHaveLength(IDS.length);
        expect(injuries).toHaveLength(IDS.length);
    });

    it("falls back to the per-fighter read for a fighter missing from the batch", async () => {
        serve(() => [{ fighterId: "f-1", entries: [entry("f-1")] }]);

        const injuries = await listInjuries({ fighterIds: IDS });

        expect(singleHistoryCalls().map((path) => path.split("/")[2])).toEqual(["f-2", "f-3"]);
        expect(injuries).toHaveLength(IDS.length);
    });

    it("keeps the per-fighter read for a single fighter", async () => {
        serve(() => []);

        await listInjuries({ fighterIds: ["f-1"] });

        expect(batchHistoryCalls()).toEqual([]);
        expect(singleHistoryCalls()).toHaveLength(1);
    });
});
