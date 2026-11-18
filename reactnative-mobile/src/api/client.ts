import { API_BASE_URL } from "./config";
import { ApiError, apiErrorFromBody } from "./errors";
import {
  clearSession,
  getMemorySession,
  loadStoredSession,
  notifySessionExpired,
  persistSession,
  secondsLeft,
} from "./tokens";
import type { AuthResponse, AuthSession } from "./types";
import { devLog } from "@/utils/dev-log";

type SuccessEnvelope<T> = {
  success: true;
  message?: string;
  data: T;
};

export type ApiFetchOptions = RequestInit & {
  skipAuth?: boolean;
  skipRefresh?: boolean;
};

/**
 * ok: new tokens saved. expired: the server rejected the refresh token, so the session is over (tokens cleared, the
 * app is told). unavailable: offline, rate-limited or a server error — the tokens stay, the user stays signed in.
 */
export type RefreshResult = { kind: "ok"; session: AuthSession } | { kind: "expired" } | { kind: "unavailable" };

let refreshInFlight: Promise<RefreshResult> | null = null;

/** Refresh this long before the access token runs out, so requests rarely meet a 401. */
export const REFRESH_EARLY_SECONDS = 60;

/** Only a 400/401/403 answer to /auth/refresh means the refresh token itself is bad. */
export function refreshTokenRejected(cause: unknown): boolean {
  return cause instanceof ApiError && (cause.status === 400 || cause.status === 401 || cause.status === 403);
}

function joinUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${suffix}`;
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function unwrapData<T>(status: number, body: unknown): T {
  if (!body || typeof body !== "object") {
    throw apiErrorFromBody(status, body);
  }
  const row = body as { success?: boolean; data?: T };
  if (row.success === false) {
    throw apiErrorFromBody(status, body);
  }
  if (row.success === true && "data" in row) {
    return (row as SuccessEnvelope<T>).data;
  }
  throw apiErrorFromBody(status, body);
}

function shouldAttemptRefresh(path: string, options: ApiFetchOptions): boolean {
  if (options.skipAuth || options.skipRefresh) return false;
  return !path.startsWith("/auth/");
}

/** One refresh at a time; every caller waits for the same answer. */
export async function refreshSession(): Promise<RefreshResult> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async (): Promise<RefreshResult> => {
    const current = getMemorySession() ?? (await loadStoredSession());
    if (!current?.refreshToken) return { kind: "expired" };

    try {
      const data = await apiFetch<AuthResponse>("/auth/refresh", {
        method: "POST",
        skipAuth: true,
        skipRefresh: true,
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      });
      await persistSession(data.session);
      return { kind: "ok", session: data.session };
    } catch (cause) {
      if (!refreshTokenRejected(cause)) return { kind: "unavailable" };
      // Another refresh may have rotated the tokens meanwhile; only end the session we tried to refresh.
      if (getMemorySession()?.refreshToken === current.refreshToken) {
        await clearSession();
        notifySessionExpired();
      }
      return { kind: "expired" };
    }
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { skipAuth, skipRefresh: _skipRefresh, headers, ...init } = options;
  const url = joinUrl(path);
  const headerBag = new Headers(headers);

  if (init.body != null && !headerBag.has("Content-Type")) {
    headerBag.set("Content-Type", "application/json");
  }

  if (!skipAuth) {
    let session = getMemorySession() ?? (await loadStoredSession());
    // Refresh ahead of expiry (app reopened after an hour, phone woke up) instead of waiting for a 401.
    const left = session ? secondsLeft(session) : null;
    if (session && left != null && left < REFRESH_EARLY_SECONDS && shouldAttemptRefresh(path, options)) {
      const next = await refreshSession();
      if (next.kind === "ok") session = next.session;
      else if (next.kind === "expired") session = null;
    }
    if (session?.accessToken) {
      headerBag.set("Authorization", `Bearer ${session.accessToken}`);
    }
  }

  let response: Response;
  try {
    response = await fetch(url, { ...init, headers: headerBag });
  } catch (cause) {
    const name = cause instanceof Error ? cause.name : "unknown";
    const detail = cause instanceof Error ? cause.message : String(cause);
    // TypeError / failed to fetch — device never reached Nest (offline, no reverse, cleartext).
    devLog("[api] NETWORK_ERROR", { url, name, detail });
    throw new ApiError(0, "NETWORK_ERROR", "Network request failed");
  }

  if (response.status === 401 && shouldAttemptRefresh(path, options)) {
    const next = await refreshSession();
    if (next.kind === "ok") {
      return apiFetch<T>(path, { ...options, skipRefresh: true });
    }
  }

  const body = await parseJson(response);
  if (!response.ok) {
    const err = apiErrorFromBody(response.status, body);
    // HTTP 401 JSON (INVALID_CREDENTIALS) is not a network failure.
    devLog("[api] http error", {
      url,
      status: err.status,
      code: err.code,
    });
    throw err;
  }
  return unwrapData<T>(response.status, body);
}
