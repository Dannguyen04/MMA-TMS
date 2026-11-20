import axios, { type AxiosRequestConfig } from "axios";

import { API_BASE_URL } from "./config";
import { getMemorySession, loadStoredSession } from "./tokens";

export type HttpRequestConfig = AxiosRequestConfig & { skipAuth?: boolean };

// 1. Shared transport: API origin, 90 s timeout (a sleeping Render free instance can take ~50 s
//    to wake), and status handling owned by apiFetch.
export const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 90_000,
  validateStatus: () => true,
  responseType: "text",
  // Callers already stringify JSON. Keep their bytes and parse response text in apiFetch.
  transformRequest: [(data) => data],
  transformResponse: [(data) => data],
});

http.interceptors.request.use(async (config) => {
  // 2. Uploads keep their native body/boundary and have no transport time limit.
  const isForm = typeof FormData !== "undefined" && config.data instanceof FormData;
  const isBlob = typeof Blob !== "undefined" && config.data instanceof Blob;
  if (isForm || isBlob) config.timeout = 0;
  if (isForm) {
    config.headers.setContentType(false);
  } else if (config.data != null && !config.headers.has("Content-Type")) {
    config.headers.setContentType("application/json");
  } else if (!config.headers.has("Content-Type")) {
    // Suppress axios's default POST/PUT/PATCH form content type for an empty body.
    config.headers.setContentType(false);
  }

  // 3. Attach the session token (apiFetch performs early refresh before this step).
  if (!(config as HttpRequestConfig).skipAuth) {
    const session = getMemorySession() ?? (await loadStoredSession());
    if (session?.accessToken) config.headers.set("Authorization", `Bearer ${session.accessToken}`);
  }
  return config;
});

// 4. apiFetch handles 401 -> single-flight refresh -> one retry, then parses text/JSON
//    and unwraps { success: true, data }. refreshSession also uses that same path.
