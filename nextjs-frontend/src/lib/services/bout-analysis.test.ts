import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticatedApiRequest = vi.hoisted(() => vi.fn());
const authenticatedMutableApiRequest = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/client", async (loadOriginal) => ({
    ...(await loadOriginal<typeof import("@/lib/api/client")>()),
    authenticatedApiRequest,
    authenticatedMutableApiRequest,
}));
vi.mock("@/lib/auth/constants", async (loadOriginal) => ({
    ...(await loadOriginal<typeof import("@/lib/auth/constants")>()),
    isDemoAuthEnabled: () => false,
}));
vi.mock("./platform-features", () => import("@/test/platform-features-mock"));

import { ApiError } from "@/lib/api/client";
import type { User } from "@/lib/domain/types";
import { getBoutReport, saveOpponentAnalysis, saveTacticReviews, upsertBoutRound } from "./bout-analysis";

const coach = { id: "u-1" } as User;
const httpError = (status: number, code: string) => new ApiError({ message: "x", kind: "http", status, code });

describe("bout-analysis API error codes", () => {
    beforeEach(() => vi.clearAllMocks());

    it("passes the backend code of a rejected round through to the action", async () => {
        authenticatedMutableApiRequest.mockRejectedValueOnce(httpError(422, "BOUT_ROUND_MARK_UNKNOWN"));
        await expect(upsertBoutRound("b-1", 2, {}, coach)).resolves.toEqual({ ok: false, error: "BOUT_ROUND_MARK_UNKNOWN" });
    });

    it("falls back to a generic code when the reply had none", async () => {
        authenticatedMutableApiRequest.mockRejectedValueOnce(httpError(422, "HTTP_422"));
        await expect(upsertBoutRound("b-1", 2, {}, coach)).resolves.toEqual({ ok: false, error: "BOUT_ROUND_INVALID" });
        authenticatedMutableApiRequest.mockRejectedValueOnce(httpError(409, "HTTP_409"));
        await expect(upsertBoutRound("b-1", 2, {}, coach)).resolves.toEqual({ ok: false, error: "BOUT_INVALID_TRANSITION" });
    });

    it("R3: a report before the result is a 409 the page can explain; other failures still throw", async () => {
        authenticatedApiRequest.mockRejectedValueOnce(httpError(409, "BOUT_INVALID_TRANSITION"));
        await expect(getBoutReport("b-1")).resolves.toEqual({ ok: false, error: "BOUT_INVALID_TRANSITION" });
        authenticatedApiRequest.mockRejectedValueOnce(httpError(500, "HTTP_500"));
        await expect(getBoutReport("b-1")).rejects.toThrow();
    });

    it("reads the report from the bout's report path", async () => {
        authenticatedApiRequest.mockResolvedValueOnce({ roundsRecorded: 0 });
        await expect(getBoutReport("b 1")).resolves.toEqual({ ok: true, report: { roundsRecorded: 0 } });
        expect(authenticatedApiRequest.mock.calls[0]?.[0]).toBe("/bouts/b%201/report");
    });

    it("R5: sends every review to the opponent-analysis review path and passes a rejected code through", async () => {
        const input = { reviews: [{ tacticId: "t1", outcome: "INEFFECTIVE" as const, note: "Read early" }] };
        authenticatedMutableApiRequest.mockResolvedValueOnce({});
        await expect(saveTacticReviews("b-1", input)).resolves.toEqual({ ok: true });
        expect(authenticatedMutableApiRequest.mock.calls[0]?.[0]).toBe("/bouts/b-1/opponent-analysis/review");
        expect(authenticatedMutableApiRequest.mock.calls[0]?.[2]).toMatchObject({ method: "PUT", body: JSON.stringify(input) });

        authenticatedMutableApiRequest.mockRejectedValueOnce(httpError(422, "OPPONENT_TACTIC_UNKNOWN"));
        await expect(saveTacticReviews("b-1", input)).resolves.toEqual({ ok: false, error: "OPPONENT_TACTIC_UNKNOWN" });
    });

    it("passes the backend code of a rejected analysis through", async () => {
        authenticatedMutableApiRequest.mockRejectedValueOnce(httpError(422, "OPPONENT_TACTIC_UNKNOWN"));
        await expect(saveOpponentAnalysis("b-1", { profile: {}, observations: [], tactics: [] }, coach)).resolves.toEqual({
            ok: false,
            error: "OPPONENT_TACTIC_UNKNOWN",
        });
    });
});
