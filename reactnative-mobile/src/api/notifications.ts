import { apiFetch } from "./client";
import { withQuery } from "./query";
import type { AppNotification, Paginated } from "./types";

export function listNotifications(query?: { page?: number; limit?: number; unreadOnly?: boolean }) {
  return apiFetch<Paginated<AppNotification>>(withQuery("/notifications", query));
}

export function markNotificationRead(id: string) {
  return apiFetch<AppNotification>(`/notifications/${encodeURIComponent(id)}/read`, {
    method: "PATCH",
  });
}

/** GET /notifications/unread-count → `{ count }` (UnreadCountDto). */
export function getUnreadNotificationCount() {
  return apiFetch<{ count: number }>("/notifications/unread-count");
}
