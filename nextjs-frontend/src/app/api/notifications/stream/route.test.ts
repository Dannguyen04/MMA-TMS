import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getMutableAccessToken = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/client", async (loadOriginal) => ({
    ...(await loadOriginal<typeof import("@/lib/api/client")>()),
    getMutableAccessToken,
}));

import type { NextRequest } from "next/server";

import { ApiError } from "@/lib/api/client";
import { GET } from "./route";

const request = () => ({ signal: new AbortController().signal }) as NextRequest;

describe("notification stream relay", () => {
    beforeEach(() => {
        vi.stubEnv("APP_DATA_MODE", "api");
        getMutableAccessToken.mockReset().mockResolvedValue("token");
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
    });

    it("relays the service's stream with the session's token", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("event: ready\ndata: {}\n\n", { status: 200 }));
        const response = await GET(request());
        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toContain("text/event-stream");
        await expect(response.text()).resolves.toBe("event: ready\ndata: {}\n\n");
        expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining("/notifications/stream"), expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer token" }) }));
    });

    it("asks EventSource to retry later while the service is down or busy, instead of ending the stream", async () => {
        for (const outage of [() => Promise.resolve(new Response(null, { status: 503 })), () => Promise.resolve(new Response(null, { status: 429 })), () => Promise.reject(new TypeError("fetch failed"))]) {
            vi.spyOn(globalThis, "fetch").mockImplementationOnce(outage);
            const response = await GET(request());
            expect(response.status).toBe(200);
            await expect(response.text()).resolves.toBe("retry: 30000\n\n");
        }
    });

    it("ends the stream for a signed-out reader or a refused one", async () => {
        getMutableAccessToken.mockRejectedValueOnce(new ApiError({ message: "expired", kind: "unauthorized", status: 401, code: "UNAUTHORIZED" }));
        expect((await GET(request())).status).toBe(401);

        vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(null, { status: 403 }));
        expect((await GET(request())).status).toBe(403);
    });

    it("has no stream in demo mode", async () => {
        vi.stubEnv("APP_DATA_MODE", "demo");
        expect((await GET(request())).status).toBe(204);
    });
});
