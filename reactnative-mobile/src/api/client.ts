import { API_BASE_URL } from "./config";
import { ApiError, apiErrorFromBody } from "./errors";
import {
  clearSession,
  getMemorySession,
  loadStoredSession,
  persistSession,
} from "./tokens";
import type { AuthResponse, AuthSession } from "./types";

type SuccessEnvelope<T> = {
  success: true;
  message?: string;
  data: T;
};

export type ApiFetchOptions = RequestInit & {
  skipAuth?: boolean;
  skipRefresh?: boolean;
};

let refreshInFlight: Promise<AuthSession | null> | null = null;

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

async function refreshSession(): Promise<AuthSession | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const current = getMemorySession() ?? (await loadStoredSession());
    if (!current?.refreshToken) {
      await clearSession();
      return null;
    }

    try {
      const data = await apiFetch<AuthResponse>("/auth/refresh", {
        method: "POST",
        skipAuth: true,
        skipRefresh: true,
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      });
      await persistSession(data.session);
      return data.session;
    } catch {
      await clearSession();
      return null;
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
    const session = getMemorySession() ?? (await loadStoredSession());
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
    console.log("[api] NETWORK_ERROR", { url, name, detail });
    throw new ApiError(0, "NETWORK_ERROR", "Network request failed");
  }

  if (response.status === 401 && shouldAttemptRefresh(path, options)) {
    const next = await refreshSession();
    if (next) {
      return apiFetch<T>(path, { ...options, skipRefresh: true });
    }
  }

  const body = await parseJson(response);
  if (!response.ok) {
    const err = apiErrorFromBody(response.status, body);
    // HTTP 401 JSON (INVALID_CREDENTIALS) is not a network failure.
    console.log("[api] http error", {
      url,
      status: err.status,
      code: err.code,
    });
    throw err;
  }
  return unwrapData<T>(response.status, body);
}
