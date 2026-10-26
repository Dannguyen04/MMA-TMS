import { USE_MOCK_COACH } from "./coach";
import { mockCoachNavApi } from "./coach-nav.mock";
import { listVideos } from "./media";
import { getUnreadNotificationCount, listNotifications, markNotificationRead } from "./notifications";

/**
 * Lệnh cho điều hướng Coach v2 (coach-nav-v2), chỉ dùng API đã có:
 * GET /notifications/unread-count, GET /notifications, PATCH /notifications/:id/read (mọi người dùng đã đăng nhập),
 * GET /videos (COACH, máy chủ lọc theo võ sĩ phụ trách).
 */
const realCoachNavApi: typeof mockCoachNavApi = {
  unreadCount: () => getUnreadNotificationCount(),
  listNotifications: (q) => listNotifications(q),
  markRead: async (id) => {
    await markNotificationRead(id);
  },
  listVideos: (q) => listVideos(q),
};

export const coachNavApi: typeof mockCoachNavApi = USE_MOCK_COACH ? mockCoachNavApi : realCoachNavApi;
