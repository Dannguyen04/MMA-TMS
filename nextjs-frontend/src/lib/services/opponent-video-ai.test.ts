import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// No disk cache in these tests: every call reaches the mocked fetch.
vi.mock("node:fs/promises", () => ({
    readFile: vi.fn(() => Promise.reject(new Error("no cache"))),
    writeFile: vi.fn(() => Promise.resolve()),
    mkdir: vi.fn(() => Promise.resolve()),
}));

const URL_OK = "https://www.youtube.com/watch?v=abcdef123";
const reply = () =>
    new Response(
        JSON.stringify({
            candidates: [
                {
                    content: {
                        parts: [
                            {
                                text: JSON.stringify({
                                    observations: [{ kind: "HABIT", text: "Hạ tay phải sau đòn đá thấp", time: "01:02", confidence: "REPEATED" }],
                                }),
                            },
                        ],
                    },
                },
            ],
        }),
    );
const quota = () => new Response(JSON.stringify({ error: { status: "RESOURCE_EXHAUSTED" } }), { status: 429 });
const keyOf = (call: unknown[]) => (call[1] as { headers: Record<string, string> }).headers["x-goog-api-key"];

async function load() {
    vi.resetModules();
    return import("./opponent-video-ai");
}

describe("suggestObservationsFromVideo Gemini key rotation (mock fetch only)", () => {
    const fetch = vi.fn();
    beforeEach(() => {
        fetch.mockReset();
        vi.stubGlobal("fetch", fetch);
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "error").mockImplementation(() => {});
    });
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
    });

    it("moves to the next key on quota and starts there on the next call", async () => {
        vi.stubEnv("GEMINI_API_KEYS", "fake-key-1,fake-key-2,fake-key-3");
        const { suggestObservationsFromVideo } = await load();
        fetch.mockResolvedValueOnce(quota()).mockImplementation(() => Promise.resolve(reply()));
        const first = await suggestObservationsFromVideo(URL_OK, "đối thủ áo đỏ");
        expect(first.ok).toBe(true);
        expect(fetch.mock.calls.map(keyOf)).toEqual(["fake-key-1", "fake-key-2"]);

        fetch.mockClear();
        expect((await suggestObservationsFromVideo(URL_OK, "đối thủ áo xanh")).ok).toBe(true);
        expect(fetch.mock.calls.map(keyOf)).toEqual(["fake-key-2"]);
    });

    it("returns QUOTA after every key ran out and never logs a key", async () => {
        vi.stubEnv("GEMINI_API_KEYS", "fake-key-1,fake-key-2");
        const { suggestObservationsFromVideo } = await load();
        fetch.mockImplementation(() => Promise.resolve(quota()));
        expect(await suggestObservationsFromVideo(URL_OK, "đối thủ")).toEqual({ ok: false, error: "QUOTA" });
        expect(fetch).toHaveBeenCalledTimes(2);
        const logged = JSON.stringify([...vi.mocked(console.warn).mock.calls, ...vi.mocked(console.error).mock.calls]);
        expect(logged).toContain("All 2 Gemini API key(s) failed");
        expect(logged).not.toContain("fake-key");
    });

    it("returns UPSTREAM when every key is invalid", async () => {
        vi.stubEnv("GEMINI_API_KEYS", "fake-key-1,fake-key-2");
        const { suggestObservationsFromVideo } = await load();
        fetch.mockImplementation(() =>
            Promise.resolve(new Response(JSON.stringify({ error: { details: [{ reason: "API_KEY_INVALID" }] } }), { status: 400 })),
        );
        expect(await suggestObservationsFromVideo(URL_OK, "đối thủ")).toEqual({ ok: false, error: "UPSTREAM" });
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("still accepts the single GEMINI_API_KEY and is NOT_CONFIGURED without any key", async () => {
        vi.stubEnv("GEMINI_API_KEYS", "");
        vi.stubEnv("GEMINI_API_KEY", "fake-single");
        let mod = await load();
        fetch.mockImplementation(() => Promise.resolve(reply()));
        expect((await mod.suggestObservationsFromVideo(URL_OK, "đối thủ")).ok).toBe(true);
        expect(fetch.mock.calls.map(keyOf)).toEqual(["fake-single"]);

        vi.stubEnv("GEMINI_API_KEY", "");
        fetch.mockClear();
        mod = await load();
        expect(await mod.suggestObservationsFromVideo(URL_OK, "đối thủ")).toEqual({ ok: false, error: "NOT_CONFIGURED" });
        expect(fetch).not.toHaveBeenCalled();
    });
});
