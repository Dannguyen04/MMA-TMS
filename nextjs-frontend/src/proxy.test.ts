import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ACCESS_EXPIRES_COOKIE, ACCESS_TOKEN_COOKIE, DEMO_SESSION_COOKIE, REFRESH_TOKEN_COOKIE } from "@/lib/auth/constants";
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

describe("proxy auth gate", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    const pageRequest = (cookie: string) => new NextRequest("http://localhost:3000/coach/dashboard", { headers: { cookie } });

    it("accepts only the demo session cookie in demo mode", async () => {
        vi.stubEnv("APP_DATA_MODE", "demo");

        expect((await proxy(pageRequest(`${DEMO_SESSION_COOKIE}=u-rafael-costa`))).status).toBe(200);
        const redirected = await proxy(pageRequest(`${ACCESS_TOKEN_COOKIE}=token`));
        expect(redirected.status).toBe(307);
        expect(redirected.headers.get("location")).toBe("http://localhost:3000/login?next=%2Fcoach%2Fdashboard");
    });

    it("ignores the demo session cookie in API mode", async () => {
        vi.stubEnv("APP_DATA_MODE", "api");

        expect((await proxy(pageRequest(`${DEMO_SESSION_COOKIE}=u-rafael-costa`))).status).toBe(307);
        expect((await proxy(pageRequest(`${REFRESH_TOKEN_COOKIE}=refresh-token-that-is-long-enough`))).status).toBe(200);
    });
});
