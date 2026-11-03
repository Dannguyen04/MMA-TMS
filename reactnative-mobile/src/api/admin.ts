import { mockAdminApi } from "./admin.mock";
import { getUser } from "./auth";
import { listFighterCoaches } from "./fighters";
import { listFighterDoctors } from "./medical";
import { getUnreadNotificationCount, listNotifications } from "./notifications";
import { listUsers } from "./users";

/**
 * Các lệnh GET cho màn Admin chỉ đọc (A-1..A-4). Mặc định gọi API thật;
 * `EXPO_PUBLIC_ADMIN_MOCK=true` dùng dữ liệu giả lập (`admin.mock.ts`).
 * `GET /users/:id` chỉ dành cho ADMIN nên chỉ dùng ở màn Admin.
 * Danh sách võ sĩ dùng chung `coachApi` (cùng endpoint GET /fighters).
 */
export const USE_MOCK_ADMIN = process.env.EXPO_PUBLIC_ADMIN_MOCK === "true";

const realAdminApi: typeof mockAdminApi = {
  listUsers: (q) => listUsers(q),
  getUser: (id) => getUser(id),
  // Endpoint ĐÓNG BĂNG (doctor-assignment): chỉ màn A-4 "Bác sĩ phụ trách" dùng; xem ADMIN_FIGHTER_DOCTORS_ENABLED.
  listFighterDoctors: (id, q) => listFighterDoctors(id, q),
  // GET /fighters/:id/coaches (fighter.coach:read).
  listFighterCoaches: (id) => listFighterCoaches(id),
  unreadCount: () => getUnreadNotificationCount(),
  listNotifications: (q) => listNotifications(q),
};

export const adminApi: typeof mockAdminApi = USE_MOCK_ADMIN ? mockAdminApi : realAdminApi;
