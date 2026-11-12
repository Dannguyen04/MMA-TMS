import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authenticatedApiRequest = vi.hoisted(() => vi.fn());
const authenticatedMutableApiRequest = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/client", async (loadOriginal) => ({
    ...(await loadOriginal<typeof import("@/lib/api/client")>()),
    authenticatedApiRequest,
    authenticatedMutableApiRequest,
}));
vi.mock("./videos", () => ({ listVideos: vi.fn() }));
vi.mock("./platform-features", () => import("@/test/platform-features-mock"));

import type { User } from "@/lib/domain/types";
import { DEFAULT_SYSTEM_SETTINGS } from "@/lib/domain/system-settings";
import { platformFeatureAvailable } from "@/test/platform-features-mock";
import { clearSettingsCache, getSettings, updateSettings } from "./admin";

/** A9 (docs/PERFORMANCE-PLAN.md): the academy-wide settings, kept for a minute once the service serves them. */
describe("settings cache", () => {
    const settingsReads = () => authenticatedApiRequest.mock.calls.filter(([path]) => path === "/settings").length;

    beforeEach(() => {
        vi.stubEnv("APP_DATA_MODE", "api");
        platformFeatureAvailable.mockReturnValue(true);
        clearSettingsCache();
        authenticatedApiRequest.mockReset();
        authenticatedApiRequest.mockImplementation(async () => structuredClone(DEFAULT_SYSTEM_SETTINGS));
        authenticatedMutableApiRequest.mockReset();
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-11-12T09:00:00.000Z"));
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllEnvs();
    });

    it("asks the service once a minute", async () => {
        const first = await getSettings();
        first.organizationName = "Changed by a caller";
        await expect(getSettings()).resolves.toEqual(DEFAULT_SYSTEM_SETTINGS);
        expect(settingsReads()).toBe(1);

        vi.setSystemTime(new Date("2026-11-12T09:01:01.000Z"));
        await getSettings();
        expect(settingsReads()).toBe(2);
    });

    it("shows saved settings at once", async () => {
        await getSettings();
        const saved = { ...DEFAULT_SYSTEM_SETTINGS, organizationName: "Saigon MMA" };
        authenticatedMutableApiRequest.mockResolvedValue(saved);
        await updateSettings({ organizationName: "Saigon MMA" }, {} as User);
        await expect(getSettings()).resolves.toEqual(saved);
        expect(settingsReads()).toBe(1);
    });

    it("never keeps a failed read", async () => {
        authenticatedApiRequest.mockRejectedValueOnce(new Error("backend unavailable"));
        await expect(getSettings()).rejects.toThrow("backend unavailable");
        await expect(getSettings()).resolves.toEqual(DEFAULT_SYSTEM_SETTINGS);
        expect(settingsReads()).toBe(2);
    });
});
