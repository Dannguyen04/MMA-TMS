import { afterEach, describe, expect, it, vi } from "vitest";

import { isDemoAuthEnabled } from "./constants";
import { DOCTOR_ONLY_PERMISSIONS, isDoctorOnlyPermission } from "./permissions";

describe("isDemoAuthEnabled", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("defaults to demo outside production until the API mode is chosen", () => {
        vi.stubEnv("NODE_ENV", "development");
        vi.stubEnv("APP_DATA_MODE", "");
        expect(isDemoAuthEnabled()).toBe(true);

        vi.stubEnv("APP_DATA_MODE", "demo");
        expect(isDemoAuthEnabled()).toBe(true);

        vi.stubEnv("APP_DATA_MODE", "api");
        expect(isDemoAuthEnabled()).toBe(false);
    });

    it("is always off in production", () => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("APP_DATA_MODE", "");
        expect(isDemoAuthEnabled()).toBe(false);

        vi.stubEnv("APP_DATA_MODE", "demo");
        expect(isDemoAuthEnabled()).toBe(false);
    });
});

describe("isDoctorOnlyPermission", () => {
    it("flags exactly the clinical permissions", () => {
        for (const permission of DOCTOR_ONLY_PERMISSIONS) expect(isDoctorOnlyPermission(permission)).toBe(true);
        expect(isDoctorOnlyPermission("medical:read_summary")).toBe(false);
        expect(isDoctorOnlyPermission("audit_logs:read")).toBe(false);
    });
});
