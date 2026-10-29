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
import { saveOpponentAnalysis, upsertBoutRound } from "./bout-analysis";

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

    it("passes the backend code of a rejected analysis through", async () => {
        authenticatedMutableApiRequest.mockRejectedValueOnce(httpError(422, "OPPONENT_TACTIC_UNKNOWN"));
        await expect(saveOpponentAnalysis("b-1", { profile: {}, observations: [], tactics: [] }, coach)).resolves.toEqual({
            ok: false,
            error: "OPPONENT_TACTIC_UNKNOWN",
        });
    });
});
