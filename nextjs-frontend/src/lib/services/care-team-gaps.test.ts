import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authenticatedApiRequest = vi.hoisted(() => vi.fn());
const listFighters = vi.hoisted(() => vi.fn());
const listAssignableStaff = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/client", async (loadOriginal) => ({
    ...(await loadOriginal<typeof import("@/lib/api/client")>()),
    authenticatedApiRequest,
}));
vi.mock("./people", () => ({ listFighters }));
vi.mock("./care-team", () => ({ listAssignableStaff }));

import { ApiError } from "@/lib/api/client";
import type { Fighter, User } from "@/lib/domain/types";
import { findCareTeamGaps, listCareTeamGaps } from "./care-team-gaps";

const admin = { id: "u-admin", name: "Nora", role: "admin" } as User;

const fighter = (id: string, joinedAt: string, team: Partial<Pick<Fighter, "coachIds" | "doctorIds">> = {}) =>
    ({ id, userId: `u-${id}`, name: `Fighter ${id}`, joinedAt, coachIds: [], doctorIds: [], ...team }) as unknown as Fighter;

const staff = (staffId: string) => ({ staffId, userId: `u-${staffId}`, name: staffId, title: "", active: true });

const roster = (...ids: string[]) => ({ data: ids.map((id) => ({ id, firstName: "A", lastName: "B" })), total: ids.length, hasNextPage: false });

describe("findCareTeamGaps", () => {
    it("lists who misses a coach, a doctor or both, longest-waiting first", () => {
        const fighters = [fighter("b", "2026-10-02T00:00:00.000Z"), fighter("a", "2026-10-01T00:00:00.000Z"), fighter("c", "2026-09-01T00:00:00.000Z")];
        expect(findCareTeamGaps(fighters, { coach: new Set(["a", "c"]), doctor: new Set(["c"]) })).toEqual([
            { fighterId: "a", userId: "u-a", name: "Fighter a", joinedAt: "2026-10-01T00:00:00.000Z", missing: ["doctor"] },
            { fighterId: "b", userId: "u-b", name: "Fighter b", joinedAt: "2026-10-02T00:00:00.000Z", missing: ["coach", "doctor"] },
        ]);
    });
});

describe("listCareTeamGaps in API mode", () => {
    beforeEach(() => {
        vi.stubEnv("APP_DATA_MODE", "api");
        authenticatedApiRequest.mockReset();
        listFighters.mockReset();
        listAssignableStaff.mockReset();
    });

    afterEach(() => vi.unstubAllEnvs());

    it("reads each active coach's and doctor's roster once instead of every fighter's assignments", async () => {
        listFighters.mockResolvedValue([fighter("f-1", "2026-10-01T00:00:00.000Z"), fighter("f-2", "2026-10-03T00:00:00.000Z")]);
        listAssignableStaff.mockResolvedValue({ coach: [staff("c-1")], doctor: [staff("d-1"), staff("d-2")] });
        authenticatedApiRequest.mockImplementation(async (path: string, schema: { parse: (value: unknown) => unknown }) => {
            if (path.startsWith("/coaches/c-1/fighters")) return schema.parse(roster("f-1", "f-2"));
            if (path.startsWith("/doctors/d-1/fighters")) return schema.parse(roster("f-2"));
            // A doctor deactivated since the staff list was read.
            if (path.startsWith("/doctors/d-2/fighters")) throw new ApiError({ message: "Not found", kind: "http", status: 404, code: "DOCTOR_NOT_FOUND" });
            throw new Error(`Unexpected ${path}`);
        });

        await expect(listCareTeamGaps(admin)).resolves.toEqual([expect.objectContaining({ fighterId: "f-1", userId: "u-f-1", missing: ["doctor"] })]);
        expect(authenticatedApiRequest).toHaveBeenCalledTimes(3);
    });

    it("says it couldn't check, rather than flagging every fighter, when a roster can't be read", async () => {
        listFighters.mockResolvedValue([fighter("f-1", "2026-10-01T00:00:00.000Z")]);
        listAssignableStaff.mockResolvedValue({ coach: [staff("c-1")], doctor: [] });
        authenticatedApiRequest.mockRejectedValue(new ApiError({ message: "Down", kind: "http", status: 503, code: "SERVICE_UNAVAILABLE" }));

        await expect(listCareTeamGaps(admin)).resolves.toBeNull();
    });

    it("reads nothing more when there are no fighters", async () => {
        listFighters.mockResolvedValue([]);
        listAssignableStaff.mockResolvedValue({ coach: [staff("c-1")], doctor: [staff("d-1")] });

        await expect(listCareTeamGaps(admin)).resolves.toEqual([]);
        expect(authenticatedApiRequest).not.toHaveBeenCalled();
    });
});

describe("listCareTeamGaps in demo mode", () => {
    beforeEach(() => {
        vi.stubEnv("APP_DATA_MODE", "demo");
        listFighters.mockReset();
    });

    afterEach(() => vi.unstubAllEnvs());

    it("reads the care team kept on each fighter", async () => {
        listFighters.mockResolvedValue([
            fighter("f-1", "2026-10-01T00:00:00.000Z", { coachIds: ["c-1"], doctorIds: ["d-1"] }),
            fighter("f-2", "2026-10-02T00:00:00.000Z", { coachIds: ["c-1"] }),
        ]);

        await expect(listCareTeamGaps(admin)).resolves.toEqual([expect.objectContaining({ fighterId: "f-2", missing: ["doctor"] })]);
    });
});
