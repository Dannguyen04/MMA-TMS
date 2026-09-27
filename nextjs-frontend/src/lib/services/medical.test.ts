import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { User } from "@/lib/domain/types";

// Records whether the demo medical service or the mock database was ever loaded. Loading either in API
// mode would mean mock clinical data can reach real users.
const loaded = vi.hoisted(() => ({ demo: false, db: false }));

vi.mock("@/lib/mocks/db", () => {
    loaded.db = true;
    return {};
});
vi.mock("./medical.demo", () => {
    loaded.demo = true;
    return { getMedicalRecord: async () => null };
});

import { addRecoveryCheckIn, getMedicalRecord, updateHealthStatus } from "./medical";

const doctor = { id: "u-doc", role: "doctor", profileId: "d-1" } as User;

describe("medical service modes", () => {
    beforeEach(() => {
        vi.stubEnv("APP_DATA_MODE", "api");
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("refuses features the backend doesn't offer in API mode, without loading any demo data", async () => {
        const unsupported = { status: 501, code: "API_OPERATION_UNSUPPORTED" };
        await expect(getMedicalRecord("f-1")).rejects.toMatchObject(unsupported);
        await expect(updateHealthStatus("f-1", "healthy", doctor)).rejects.toMatchObject(unsupported);
        await expect(addRecoveryCheckIn("rp-1", { painLevel: 2, mobilityPct: 80, strengthPct: 70, note: "" }, doctor)).rejects.toMatchObject(unsupported);
        expect(loaded).toEqual({ demo: false, db: false });
    });

    it("loads the demo service in demo mode", async () => {
        vi.stubEnv("APP_DATA_MODE", "demo");
        await expect(getMedicalRecord("f-1")).resolves.toBeNull();
        expect(loaded.demo).toBe(true);
    });
});
