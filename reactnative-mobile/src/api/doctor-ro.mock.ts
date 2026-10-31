import { mockCoachApi } from "./coach.mock";
import { mockDoctorDetailApi } from "./doctor-detail.mock";
import { ApiError } from "./errors";
import type { AppNotification, ListFightersQuery, Paginated } from "./types";

/**
 * Dữ liệu giả lập cho màn Doctor (chỉ dev, `EXPO_PUBLIC_DOCTOR_MOCK=true`): dùng chung võ sĩ / hồ sơ y tế
 * giả lập của Coach. Kịch bản: `globalThis.__DOCTOR_MOCK_SCENARIO__` (hoặc `__COACH_MOCK_SCENARIO__`)
 * = "empty" | "offline" | "slow".
 */
function withScenario<T>(fn: () => Promise<T>): Promise<T> {
  const g = globalThis as { __DOCTOR_MOCK_SCENARIO__?: string; __COACH_MOCK_SCENARIO__?: string };
  const keep = g.__COACH_MOCK_SCENARIO__;
  if (g.__DOCTOR_MOCK_SCENARIO__) g.__COACH_MOCK_SCENARIO__ = g.__DOCTOR_MOCK_SCENARIO__;
  return fn().finally(() => {
    g.__COACH_MOCK_SCENARIO__ = keep;
  });
}

function scenario(): string {
  const g = globalThis as { __DOCTOR_MOCK_SCENARIO__?: string; __COACH_MOCK_SCENARIO__?: string };
  return g.__DOCTOR_MOCK_SCENARIO__ ?? g.__COACH_MOCK_SCENARIO__ ?? "normal";
}

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

const NOTIFICATIONS: AppNotification[] = [
  {
    id: "dn-1",
    type: "FIGHTER_MEDICAL_STATUS_CHANGED",
    title: "Cập nhật tình trạng y tế",
    message: "Phạm Gia Huy chuyển sang Chấn thương.",
    payload: { target: { type: "FIGHTER", id: "cf-4" } },
    isRead: false,
    readAt: null,
    createdAt: ago(25),
  },
  {
    id: "dn-2",
    type: "FIGHTER_DOCTOR_ASSIGNED",
    title: "Võ sĩ mới được phân công",
    message: "Bạn phụ trách thêm Lê Hoàng Phúc.",
    payload: { target: { type: "FIGHTER", id: "cf-3" } },
    isRead: false,
    readAt: null,
    createdAt: ago(180),
  },
  {
    id: "dn-3",
    type: "SYSTEM",
    title: "Bảo trì hệ thống",
    message: "Hệ thống bảo trì 22:00–23:00 tối nay.",
    payload: {},
    isRead: true,
    readAt: ago(1400),
    createdAt: ago(1500),
  },
];

export const mockDoctorRoApi = {
  listRoster: (_doctorId: string, q: ListFightersQuery) => withScenario(() => mockCoachApi.listFighters(q)),
  getMedical: (id: string) => withScenario(() => mockCoachApi.getMedical(id)),
  async listNotifications(q: { page?: number; limit?: number } = {}): Promise<Paginated<AppNotification>> {
    await new Promise<void>((resolve) => setTimeout(resolve, scenario() === "slow" ? 2500 : 350));
    if (scenario() === "offline") throw new ApiError(0, "NETWORK_ERROR", "Network request failed");
    const rows = scenario() === "empty" ? [] : NOTIFICATIONS;
    const limit = q.limit ?? 30;
    return { data: rows.slice(0, limit), total: rows.length, hasNextPage: rows.length > limit };
  },
  async unreadCount(): Promise<{ count: number }> {
    await new Promise<void>((resolve) => setTimeout(resolve, 200));
    if (scenario() === "offline") throw new ApiError(0, "NETWORK_ERROR", "Network request failed");
    return { count: scenario() === "empty" ? 0 : NOTIFICATIONS.filter((n) => !n.isRead).length };
  },
  async markRead(id: string): Promise<void> {
    const row = NOTIFICATIONS.find((n) => n.id === id);
    if (row) {
      row.isRead = true;
      row.readAt = new Date().toISOString();
    }
  },
  // Chi tiết Doctor (ghi đè getMedicalSummary của mock chung).
  ...mockDoctorDetailApi,
};

/** Chức danh giả lập cho tài khoản bác sĩ demo khi bật mock (máy chủ thật trả trong /users/me). */
export const MOCK_DOCTOR_SPECIALIZATION = "Head of Sports Medicine";
