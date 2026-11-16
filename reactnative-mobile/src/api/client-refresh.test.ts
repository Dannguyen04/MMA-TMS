import AsyncStorage from "@react-native-async-storage/async-storage";

import { apiFetch } from "./client";
import { ApiError } from "./errors";
import { cacheUser, clearSession, getMemorySession, loadCachedUser, onSessionExpired, persistSession } from "./tokens";
import type { AuthSession } from "./types";
import { isTransientFailure, keepsSession } from "@/session/session-context";

jest.mock("expo-secure-store", () => ({ isAvailableAsync: () => Promise.resolve(false) }));

type Reply = { status: number; body: unknown } | "offline";
const calls: { url: string; auth: string | null; body?: string }[] = [];
let replies: ((url: string) => Reply)[] = [];

const ok = (data: unknown): Reply => ({ status: 200, body: { success: true, data } });
const denied = (code = "UNAUTHORIZED", message = "A valid access token is required"): Reply => ({ status: 401, body: { success: false, error: { code, message } } });
const session = (access: string, refresh: string, secondsLeft = 3600): AuthSession => ({
  accessToken: access, refreshToken: refresh, tokenType: "bearer", expiresIn: 3600, expiresAt: Math.floor(Date.now() / 1000) + secondsLeft,
});

beforeEach(async () => {
  calls.length = 0;
  replies = [];
  await clearSession();
  globalThis.fetch = jest.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const u = String(url);
    calls.push({ url: u, auth: new Headers(init?.headers).get("Authorization"), body: typeof init?.body === "string" ? init.body : undefined });
    const next = replies.shift();
    const r = next ? next(u) : ok({});
    if (r === "offline") throw new TypeError("Network request failed");
    return { status: r.status, ok: r.status < 400, text: async () => JSON.stringify(r.body) } as unknown as Response;
  }) as typeof fetch;
});

describe("staying signed in", () => {
  it("a 401 refreshes once and retries with the new access token", async () => {
    await persistSession(session("old", "r1"));
    replies = [() => denied(), () => ok({ user: {}, session: session("new", "r2") }), () => ok({ id: "me" })];
    await expect(apiFetch("/users/me")).resolves.toEqual({ id: "me" });
    expect(calls.map(c => c.url.replace(/^.*?(\/[a-z]+\/[a-z]+)$/, "$1"))).toEqual(["/users/me", "/auth/refresh", "/users/me"]);
    expect(calls[2]!.auth).toBe("Bearer new");
    expect(getMemorySession()?.refreshToken).toBe("r2");
  });

  it("an access token about to expire is refreshed before the request", async () => {
    await persistSession(session("old", "r1", 20));
    replies = [() => ok({ user: {}, session: session("new", "r2") }), () => ok({ id: "me" })];
    await apiFetch("/users/me");
    expect(calls[0]!.url).toMatch(/\/auth\/refresh$/);
    expect(calls[1]!.auth).toBe("Bearer new");
  });

  it("offline during refresh keeps the tokens and does not end the session", async () => {
    const expired = jest.fn();
    const stop = onSessionExpired(expired);
    await persistSession(session("old", "r1"));
    replies = [() => denied(), () => "offline"];
    await expect(apiFetch("/users/me")).rejects.toBeInstanceOf(ApiError);
    expect(getMemorySession()?.refreshToken).toBe("r1");
    expect(await AsyncStorage.getItem("mma.session")).not.toBeNull();
    expect(expired).not.toHaveBeenCalled();
    stop();
  });

  it("a server error or rate limit on refresh keeps the tokens too", async () => {
    await persistSession(session("old", "r1"));
    replies = [() => denied(), () => ({ status: 429, body: { success: false, error: { code: "TOO_MANY_REQUESTS", message: "x" } } })];
    await expect(apiFetch("/users/me")).rejects.toBeInstanceOf(ApiError);
    expect(getMemorySession()?.refreshToken).toBe("r1");
  });

  it("a rejected refresh token ends the session, clears the cached user and tells the app", async () => {
    const expired = jest.fn();
    const stop = onSessionExpired(expired);
    await persistSession(session("old", "r1"));
    await cacheUser({ id: "u1", role: "COACH" });
    replies = [() => denied(), () => denied("INVALID_CREDENTIALS", "Refresh token is invalid")];
    await expect(apiFetch("/users/me")).rejects.toMatchObject({ status: 401 });
    expect(getMemorySession()).toBeNull();
    expect(await loadCachedUser()).toBeNull();
    expect(expired).toHaveBeenCalledTimes(1);
    stop();
  });

  it("several 401s at once share one refresh", async () => {
    await persistSession(session("old", "r1"));
    replies = [() => denied(), () => denied(), (u) => (u.endsWith("/auth/refresh") ? ok({ user: {}, session: session("new", "r2") }) : denied()), () => ok(1), () => ok(2)];
    await Promise.all([apiFetch("/a/one"), apiFetch("/a/two")]);
    expect(calls.filter(c => c.url.endsWith("/auth/refresh"))).toHaveLength(1);
  });

  it("only offline, timeouts, rate limits and server errors count as passing failures", () => {
    expect(isTransientFailure(new ApiError(0, "NETWORK_ERROR", "x"))).toBe(true);
    expect(isTransientFailure(new ApiError(503, "AUTH_PROVIDER_UNAVAILABLE", "x"))).toBe(true);
    expect(isTransientFailure(new ApiError(429, "TOO_MANY_REQUESTS", "x"))).toBe(true);
    expect(isTransientFailure(new ApiError(401, "UNAUTHORIZED", "x"))).toBe(false);
    expect(isTransientFailure(new ApiError(403, "FORBIDDEN", "x"))).toBe(false);
  });

  it("a 401 keeps the session while the tokens are stored, and ends it once they are cleared", () => {
    const denied401 = new ApiError(401, "UNAUTHORIZED", "x");
    expect(keepsSession(denied401, true)).toBe(true);
    expect(keepsSession(denied401, false)).toBe(false);
    expect(keepsSession(new ApiError(403, "FORBIDDEN", "x"), true)).toBe(false);
    expect(keepsSession(new ApiError(0, "NETWORK_ERROR", "x"), true)).toBe(true);
  });

  it("a refresh the server cannot validate (422) keeps the tokens", async () => {
    await persistSession(session("old", "r1"));
    replies = [() => denied(), () => ({ status: 422, body: { success: false, error: { code: "VALIDATION_ERROR", message: "x" } } })];
    await expect(apiFetch("/users/me")).rejects.toMatchObject({ status: 401 });
    expect(getMemorySession()?.refreshToken).toBe("r1");
  });
});
