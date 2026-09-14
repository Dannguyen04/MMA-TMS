import { afterEach, describe, expect, it, vi } from "vitest";

import { isDemoAuthEnabled } from "./constants";
import { DOCTOR_ONLY_PERMISSIONS, isDoctorOnlyPermission } from "./permissions";

describe("isDemoAuthEnabled", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("is on outside production", () => {
        vi.stubEnv("NODE_ENV", "development");
        vi.stubEnv("ALLOW_DEMO_AUTH", "");
        expect(isDemoAuthEnabled()).toBe(true);

        vi.stubEnv("NODE_ENV", "test");
        expect(isDemoAuthEnabled()).toBe(true);
    });

    it("is off in production unless explicitly allowed", () => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("ALLOW_DEMO_AUTH", "");
        expect(isDemoAuthEnabled()).toBe(false);

        vi.stubEnv("ALLOW_DEMO_AUTH", "1");
        expect(isDemoAuthEnabled()).toBe(false);

        vi.stubEnv("ALLOW_DEMO_AUTH", "true");
        expect(isDemoAuthEnabled()).toBe(true);
    });
});

describe("isDoctorOnlyPermission", () => {
    it("flags exactly the clinical permissions", () => {
        for (const permission of DOCTOR_ONLY_PERMISSIONS) expect(isDoctorOnlyPermission(permission)).toBe(true);
        expect(isDoctorOnlyPermission("medical:read_summary")).toBe(false);
        expect(isDoctorOnlyPermission("audit_logs:read")).toBe(false);
    });
});
