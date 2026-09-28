import { apiFetch } from "./client";
import type { HealthStatus } from "./types";

export function getApiHello() {
  return apiFetch<string>("/", { skipAuth: true, skipRefresh: true });
}

export function getHealth() {
  return apiFetch<HealthStatus>("/health", {
    skipAuth: true,
    skipRefresh: true,
  });
}
