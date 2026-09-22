import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ACCESS_EXPIRES_COOKIE, ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/lib/auth/constants";
import { proxy } from "./proxy";

function requestWithSession(expiresAt: number) {
    const cookie = [
        `${ACCESS_TOKEN_COOKIE}=expired-access`,
        `${REFRESH_TOKEN_COOKIE}=refresh-token-that-is-long-enough`,
        `${ACCESS_EXPIRES_COOKIE}=${expiresAt}`,
    ].join("; ");
    return new NextRequest("http://localhost:3000/api/ai-jobs/job-1", { headers: { cookie } });
}

describe("proxy session refresh", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    it("replays an API request after refreshing an expired access token", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2030-01-01T00:00:00Z"));
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                Response.json({
                    success: true,
                    message: "refreshed",
                    data: {
                        session: {
                            accessToken: "rotated-access",
                            refreshToken: "rotated-refresh",
                            expiresAt: 1_893_457_800,
                            expiresIn: 900,
                        },
                    },
                }),
            ),
        );

        const response = await proxy(requestWithSession(1_893_456_000));

        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toBe("http://localhost:3000/api/ai-jobs/job-1");
        expect(response.cookies.get(ACCESS_TOKEN_COOKIE)?.value).toBe("rotated-access");
        expect(response.cookies.get(REFRESH_TOKEN_COOKIE)?.value).toBe("rotated-refresh");
        expect(response.headers.get("cache-control")).toBeNull();
    });
});
