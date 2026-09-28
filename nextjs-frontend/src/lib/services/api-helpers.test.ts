import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const authenticatedApiRequest = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/client", async (loadOriginal) => ({
    ...(await loadOriginal<typeof import("@/lib/api/client")>()),
    authenticatedApiRequest,
}));

import { ApiError } from "@/lib/api/client";
import { drainNumberedPages, nullIfNotFound, queryPath } from "./api-helpers";

describe("service API helpers", () => {
    beforeEach(() => {
        authenticatedApiRequest.mockReset();
    });

    it("maps only a 404 to null", async () => {
        await expect(nullIfNotFound(Promise.reject(new ApiError({ message: "Missing", kind: "http", status: 404 })))).resolves.toBeNull();
        await expect(nullIfNotFound(Promise.reject(new ApiError({ message: "Denied", kind: "http", status: 403 })))).rejects.toThrow("Denied");
    });

    it("skips empty query values", () => {
        expect(queryPath("/items", { search: "", page: 1, status: undefined, coachId: null })).toBe("/items?page=1");
        expect(queryPath("/items", {})).toBe("/items");
    });

    it("reads numbered pages until the last one", async () => {
        authenticatedApiRequest
            .mockResolvedValueOnce({ data: ["a"], total: 2, hasNextPage: true })
            .mockResolvedValueOnce({ data: ["b"], total: 2, hasNextPage: false });

        await expect(drainNumberedPages("/items", z.string(), { search: "x" })).resolves.toEqual(["a", "b"]);
        expect(authenticatedApiRequest).toHaveBeenNthCalledWith(1, "/items?page=1&limit=100&search=x", expect.anything());
        expect(authenticatedApiRequest).toHaveBeenNthCalledWith(2, "/items?page=2&limit=100&search=x", expect.anything());
    });

    it("reads `items` pages until page × limit covers the total", async () => {
        authenticatedApiRequest
            .mockResolvedValueOnce({ items: ["a", "b"], total: 3, page: 1, limit: 2 })
            .mockResolvedValueOnce({ items: ["c"], total: 3, page: 2, limit: 2 });

        await expect(drainNumberedPages("/users", z.string())).resolves.toEqual(["a", "b", "c"]);
        expect(authenticatedApiRequest).toHaveBeenCalledTimes(2);
        expect(authenticatedApiRequest).toHaveBeenNthCalledWith(2, "/users?page=2&limit=100", expect.anything());
    });

    it("fails instead of truncating an oversized `items` list", async () => {
        authenticatedApiRequest.mockResolvedValue({ items: [], total: 501, page: 1, limit: 100 });

        await expect(drainNumberedPages("/users", z.string())).rejects.toMatchObject({ code: "PAGINATION_LIMIT_EXCEEDED" });
    });

    it("fails instead of truncating an oversized list", async () => {
        authenticatedApiRequest.mockResolvedValue({ data: [], total: 501, hasNextPage: true });

        await expect(drainNumberedPages("/items", z.string())).rejects.toMatchObject({ code: "PAGINATION_LIMIT_EXCEEDED" });
    });
});
