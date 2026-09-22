import { afterEach, describe, expect, it, vi } from "vitest";

async function loadMode() {
    vi.resetModules();
    return (await import("./pipeline-mode")).VIDEO_PIPELINE_MODE;
}

describe("VIDEO_PIPELINE_MODE", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("defaults to the mock pipeline outside production", async () => {
        vi.stubEnv("NODE_ENV", "development");
        vi.stubEnv("NEXT_PUBLIC_VIDEO_PIPELINE", "");
        expect(await loadMode()).toBe("mock");
    });

    it("defaults to the API pipeline in production", async () => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("NEXT_PUBLIC_VIDEO_PIPELINE", "");
        expect(await loadMode()).toBe("api");
    });

    it("honours an explicit choice", async () => {
        vi.stubEnv("NODE_ENV", "development");
        vi.stubEnv("NEXT_PUBLIC_VIDEO_PIPELINE", "api");
        expect(await loadMode()).toBe("api");
    });
});
