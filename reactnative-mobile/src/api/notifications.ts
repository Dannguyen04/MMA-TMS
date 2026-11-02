import { apiFetch } from "./client";
import { withQuery } from "./query";
import type { AppNotification, Paginated } from "./types";
import { localizeNotification } from "@/i18n/server-text";

export function listNotifications(query?: { page?: number; limit?: number; unreadOnly?: boolean }) {
  // Phase 5 C: the server sends English; rows are made Vietnamese here, once, for every inbox.
  return apiFetch<Paginated<AppNotification>>(withQuery("/notifications", query)).then((page) =>
    page && Array.isArray(page.data) ? { ...page, data: page.data.map(localizeNotification) } : page,
  );
}

export function markNotificationRead(id: string) {
  return apiFetch<AppNotification>(`/notifications/${encodeURIComponent(id)}/read`, {
    method: "PATCH",
  }).then((n) => (n && typeof n.type === "string" ? localizeNotification(n) : n));
}

/** GET /notifications/unread-count → `{ count }` (UnreadCountDto). */
export function getUnreadNotificationCount() {
  return apiFetch<{ count: number }>("/notifications/unread-count");
}
