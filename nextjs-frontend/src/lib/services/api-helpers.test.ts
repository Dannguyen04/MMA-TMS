import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const authenticatedApiRequest = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/client", async (loadOriginal) => ({
    ...(await loadOriginal<typeof import("@/lib/api/client")>()),
    authenticatedApiRequest,
}));

import { ApiError } from "@/lib/api/client";
import { drainNumberedPages, nullIfNotFound, nullIfServiceFails, queryPath } from "./api-helpers";

describe("service API helpers", () => {
    beforeEach(() => {
        authenticatedApiRequest.mockReset();
    });

    it("maps only a 404 to null", async () => {
        await expect(nullIfNotFound(Promise.reject(new ApiError({ message: "Missing", kind: "http", status: 404 })))).resolves.toBeNull();
        await expect(nullIfNotFound(Promise.reject(new ApiError({ message: "Denied", kind: "http", status: 403 })))).rejects.toThrow("Denied");
    });

    it("maps a failing service to null, but not a lapsed session or a bug", async () => {
        await expect(nullIfServiceFails(Promise.reject(new ApiError({ message: "Down", kind: "http", status: 500 })))).resolves.toBeNull();
        await expect(nullIfServiceFails(Promise.reject(new ApiError({ message: "Unreachable", kind: "network" })))).resolves.toBeNull();
        await expect(nullIfServiceFails(Promise.reject(new ApiError({ message: "Expired", kind: "unauthorized", status: 401 })))).rejects.toThrow("Expired");
        await expect(nullIfServiceFails(Promise.reject(new Error("Bug")))).rejects.toThrow("Bug");
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

    it("reads a user list longer than five pages", async () => {
        const total = 553;
        authenticatedApiRequest.mockImplementation(async (path: string) => {
            const page = Number(new URLSearchParams(path.split("?")[1]).get("page"));
            const count = Math.min(100, total - (page - 1) * 100);
            return { items: Array.from({ length: count }, (_, index) => `u-${(page - 1) * 100 + index}`), total, page, limit: 100 };
        });

        await expect(drainNumberedPages("/users", z.string())).resolves.toHaveLength(total);
        expect(authenticatedApiRequest).toHaveBeenCalledTimes(6);
    });

    it("reads the pages after the first together, in order", async () => {
        let inFlight = 0;
        let mostInFlight = 0;
        authenticatedApiRequest.mockImplementation(async (path: string) => {
            const page = Number(new URLSearchParams(path.split("?")[1]).get("page"));
            inFlight += 1;
            mostInFlight = Math.max(mostInFlight, inFlight);
            await new Promise((resolve) => setTimeout(resolve, 6 - page));
            inFlight -= 1;
            return { data: [`p${page}`], total: 4, hasNextPage: page < 4 };
        });

        await expect(drainNumberedPages("/items", z.string())).resolves.toEqual(["p1", "p2", "p3", "p4"]);
        expect(mostInFlight).toBe(3);
    });

    it("fails instead of truncating an oversized `items` list", async () => {
        authenticatedApiRequest.mockResolvedValue({ items: [], total: 5001, page: 1, limit: 100 });

        await expect(drainNumberedPages("/users", z.string())).rejects.toMatchObject({ code: "PAGINATION_LIMIT_EXCEEDED" });
    });

    it("fails instead of truncating an oversized list", async () => {
        authenticatedApiRequest.mockResolvedValue({ data: [], total: 5001, hasNextPage: true });

        await expect(drainNumberedPages("/items", z.string())).rejects.toMatchObject({ code: "PAGINATION_LIMIT_EXCEEDED" });
    });
});
