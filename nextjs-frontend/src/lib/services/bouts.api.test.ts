import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticatedApiRequest = vi.hoisted(() => vi.fn());
const authenticatedMutableApiRequest = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/client", async (loadOriginal) => {
    const original = await loadOriginal<typeof import("@/lib/api/client")>();
    return { ...original, authenticatedApiRequest, authenticatedMutableApiRequest };
});

import { ApiError } from "@/lib/api/client";
import { enterApiFightWeek, linkApiCamp, listApiRulesets, updateApiRequirement } from "./bouts.api";

describe("bouts API adapter", () => {
    beforeEach(() => {
        authenticatedApiRequest.mockReset();
        authenticatedMutableApiRequest.mockReset();
    });

    it("says the service isn't there yet on 403 or 404, instead of throwing", async () => {
        authenticatedMutableApiRequest.mockRejectedValue(new ApiError({ message: "Forbidden", kind: "http", status: 403 }));
        await expect(linkApiCamp("b-1", "tp-1")).resolves.toEqual({ ok: false, message: "Bouts are not available from the server yet." });
        authenticatedApiRequest.mockRejectedValue(new ApiError({ message: "Not found", kind: "http", status: 404 }));
        await expect(listApiRulesets()).resolves.toEqual([]);
    });

    it("passes the service's own message when Gate 1 refuses fight week", async () => {
        authenticatedMutableApiRequest.mockRejectedValue(new ApiError({ message: "Brain CT is missing.", kind: "http", status: 409, code: "BOUT_REQUIREMENTS_INCOMPLETE" }));
        await expect(enterApiFightWeek("b-1")).resolves.toEqual({ ok: false, message: "Brain CT is missing.", lines: [] });
        expect(authenticatedMutableApiRequest).toHaveBeenCalledWith("/bouts/b-1/fight-week", expect.anything(), { method: "POST" });
    });

    it("patches a requirement by code", async () => {
        authenticatedMutableApiRequest.mockResolvedValue({});
        await expect(updateApiRequirement("b-1", "BRAIN_CT", { state: "PROVIDED", issuedOn: null, validUntil: "2027-01-01", statusReason: null })).resolves.toEqual({ ok: true });
        expect(authenticatedMutableApiRequest).toHaveBeenCalledWith("/bouts/b-1/requirements/BRAIN_CT", expect.anything(), {
            method: "PATCH",
            body: JSON.stringify({ status: "PROVIDED", issuedOn: null, validUntil: "2027-01-01", statusReason: null }),
        });
    });
});
