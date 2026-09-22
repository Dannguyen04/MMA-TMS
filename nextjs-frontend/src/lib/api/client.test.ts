import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const cookieValues = vi.hoisted(() => new Map<string, string>());
const setSessionCookies = vi.hoisted(() => vi.fn());
const clearSessionCookies = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
    cookies: async () => ({ get: (name: string) => (cookieValues.has(name) ? { value: cookieValues.get(name) } : undefined) }),
}));
vi.mock("@/lib/auth/session-cookies", () => ({ setSessionCookies, clearSessionCookies }));

import { ApiError, apiErrorResponse, apiRequest, authenticatedMutableApiRequest, drainAuthenticatedCursorPages } from "./client";

describe("apiErrorResponse", () => {
    it("never forwards a non-error upstream status", async () => {
        const response = apiErrorResponse(
            new ApiError({ message: "Unexpected", kind: "invalid_response", status: 200, code: "INVALID_API_RESPONSE" }),
            "Unavailable",
        );
        expect(response.status).toBe(502);
        await expect(response.json()).resolves.toEqual({ code: "INVALID_API_RESPONSE", message: "Unexpected" });
    });

    it("forwards backend error statuses and hides unexpected error messages", async () => {
        expect(apiErrorResponse(new ApiError({ message: "Gone", kind: "http", status: 404 }), "Unavailable").status).toBe(404);

        const response = apiErrorResponse(new TypeError("fetch failed: connect ECONNREFUSED 10.0.0.5:3001"), "Unavailable");
        expect(response.status).toBe(502);
        await expect(response.json()).resolves.toEqual({ message: "Unavailable" });
    });
});

describe("apiRequest", () => {
    beforeEach(() => {
        cookieValues.clear();
        setSessionCookies.mockReset();
        clearSessionCookies.mockReset();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("unwraps and validates the success envelope", async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ success: true, message: "ok", data: { id: "job-1" } }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            }),
        );
        vi.stubGlobal("fetch", fetchMock);

        await expect(apiRequest("/jobs/1", z.object({ id: z.string() }))).resolves.toEqual({ id: "job-1" });
        expect(fetchMock).toHaveBeenCalledWith(
            "http://localhost:3001/jobs/1",
            expect.objectContaining({ cache: "no-store" }),
        );
    });

    it("preserves backend status, code, message, and details", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                new Response(
                    JSON.stringify({
                        success: false,
                        error: { statusCode: 409, code: "JOB_STATUS_CONFLICT", message: "Terminal state", details: { status: "DONE" } },
                    }),
                    { status: 409, headers: { "Content-Type": "application/json" } },
                ),
            ),
        );

        const error = await apiRequest("/jobs/1", z.object({ id: z.string() })).catch((value: unknown) => value);
        expect(error).toBeInstanceOf(ApiError);
        expect(error).toMatchObject({ status: 409, code: "JOB_STATUS_CONFLICT", message: "Terminal state", details: { status: "DONE" } });
    });

    it("rejects a successful response whose data violates the contract", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                new Response(JSON.stringify({ success: true, message: "ok", data: { id: 7 } }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                }),
            ),
        );

        await expect(apiRequest("/jobs/1", z.object({ id: z.string() }))).rejects.toMatchObject({ code: "INVALID_API_RESPONSE" });
    });

    it("accepts data null when the requested contract permits it", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                new Response(JSON.stringify({ success: true, message: "deleted", data: null }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                }),
            ),
        );

        await expect(apiRequest("/jobs/1", z.null())).resolves.toBeNull();
    });

    it("rotates cookies and retries one time after an unauthorized mutable request", async () => {
        cookieValues.set("mma_access", "expired-access");
        cookieValues.set("mma_refresh", "refresh-token-that-is-long-enough");
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(
                new Response(JSON.stringify({ success: false, error: { statusCode: 401, code: "UNAUTHORIZED", message: "Expired" } }), {
                    status: 401,
                    headers: { "Content-Type": "application/json" },
                }),
            )
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        success: true,
                        message: "refreshed",
                        data: {
                            session: {
                                accessToken: "rotated-access",
                                refreshToken: "rotated-refresh",
                                expiresAt: 2_000_000_000,
                                expiresIn: 900,
                            },
                        },
                    }),
                    { status: 200, headers: { "Content-Type": "application/json" } },
                ),
            )
            .mockResolvedValueOnce(
                new Response(JSON.stringify({ success: true, message: "ok", data: { id: "job-1" } }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                }),
            );
        vi.stubGlobal("fetch", fetchMock);

        await expect(authenticatedMutableApiRequest("/jobs/1", z.object({ id: z.string() }))).resolves.toEqual({ id: "job-1" });
        expect(fetchMock).toHaveBeenCalledTimes(3);
        expect(setSessionCookies).toHaveBeenCalledWith(expect.objectContaining({ accessToken: "rotated-access", refreshToken: "rotated-refresh" }));
        expect(fetchMock.mock.calls[2]?.[1]).toEqual(expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer rotated-access" }) }));
    });

    it("drains cursor pages and preserves existing query parameters", async () => {
        cookieValues.set("mma_access", "access-token");
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(
                Response.json({
                    success: true,
                    message: "page one",
                    data: { items: [{ id: "one" }], pageInfo: { hasNextPage: true, endCursor: "next page" }, total: 2 },
                }),
            )
            .mockResolvedValueOnce(
                Response.json({
                    success: true,
                    message: "page two",
                    data: { items: [{ id: "two" }], pageInfo: { hasNextPage: false, endCursor: null }, total: 2 },
                }),
            );
        vi.stubGlobal("fetch", fetchMock);

        await expect(drainAuthenticatedCursorPages("/fighters?status=active", z.object({ id: z.string() }))).resolves.toEqual([
            { id: "one" },
            { id: "two" },
        ]);
        expect(fetchMock.mock.calls[1]?.[0]).toBe("http://localhost:3001/fighters?status=active&cursor=next+page");
    });

    it("fails visibly when cursor pagination exceeds the configured safety limit", async () => {
        cookieValues.set("mma_access", "access-token");
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                Response.json({
                    success: true,
                    message: "page",
                    data: { items: [{ id: "one" }, { id: "two" }], pageInfo: { hasNextPage: false, endCursor: null }, total: 2 },
                }),
            ),
        );

        await expect(drainAuthenticatedCursorPages("/fighters", z.object({ id: z.string() }), { maxItems: 1 })).rejects.toMatchObject({
            code: "PAGINATION_LIMIT_EXCEEDED",
        });
    });
});
