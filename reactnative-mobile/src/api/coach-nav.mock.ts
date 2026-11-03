import { ApiError } from "./errors";
import type { VideoPage, VideoRecord } from "./media";
import type { AppNotification, Paginated } from "./types";

/**
 * Dữ liệu giả lập cho điều hướng Coach v2 (chuông thông báo, tab Video). Chỉ bật khi EXPO_PUBLIC_COACH_MOCK=true.
 * Kịch bản dùng chung `globalThis.__COACH_MOCK_SCENARIO__` ("empty" | "offline" | "slow").
 * Số chưa đọc có thể ép bằng `globalThis.__COACH_MOCK_UNREAD__` (chỉ để xem thử huy hiệu "99+").
 */
function scenario(): string {
  return (globalThis as { __COACH_MOCK_SCENARIO__?: string }).__COACH_MOCK_SCENARIO__ ?? "normal";
}

async function wait(ms = 350): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, scenario() === "slow" ? 2500 : ms));
  if (scenario() === "offline") throw new ApiError(0, "NETWORK_ERROR", "Network request failed");
}

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

const NOTIFICATIONS: AppNotification[] = [
  {
    id: "cn-1",
    type: "FIGHTER_MEDICAL_STATUS_CHANGED",
    title: "Cập nhật tình trạng y tế",
    message: "Phạm Gia Huy chuyển sang Chấn thương.",
    payload: { target: { type: "FIGHTER", id: "cf-4" } },
    isRead: false,
    readAt: null,
    createdAt: ago(20),
  },
  {
    id: "cn-2",
    type: "TRAINING_SESSION_COMPLETED",
    title: "Buổi tập đã hoàn thành",
    message: "Nguyễn Minh Khang hoàn thành buổi Đấm đích.",
    payload: { target: { type: "FIGHTER", id: "cf-1" } },
    isRead: false,
    readAt: null,
    createdAt: ago(95),
  },
  {
    id: "cn-3",
    type: "FIGHTER_COACH_ASSIGNED",
    title: "Võ sĩ mới được phân công",
    message: "Bạn phụ trách thêm Đặng Anh Khoa.",
    payload: { target: { type: "FIGHTER", id: "cf-6" } },
    isRead: false,
    readAt: null,
    createdAt: ago(300),
  },
  {
    id: "cn-4",
    type: "SYSTEM",
    title: "Bảo trì hệ thống",
    message: "Hệ thống bảo trì 22:00–23:00 tối nay.",
    payload: {},
    isRead: true,
    readAt: ago(1400),
    createdAt: ago(1500),
  },
];

const V = (i: number, fighterId: string, title: string, trainingType: string, daysAgo: number): VideoRecord => ({
  id: `cv-${i}`,
  fighterId,
  uploadedById: `cu-${fighterId.slice(3)}`,
  sessionId: null,
  title,
  description: null,
  trainingType,
  cameraAngle: "FRONT",
  status: "READY",
  originalFilename: `video-${i}.mp4`,
  fileSizeBytes: 24_000_000,
  mimeType: "video/mp4",
  durationMs: 95_000 + i * 7_000,
  sourceUrl: "",
  createdAt: ago(daysAgo * 1440 + i * 13),
  updatedAt: ago(daysAgo * 1440),
});

const VIDEOS: VideoRecord[] = [
  V(1, "cf-1", "Đấm đích hiệp 3", "PAD_WORK", 0),
  V(2, "cf-2", "Đối kháng nhẹ với Bảo", "SPARRING", 1),
  V(3, "cf-1", "Bao cát 5 hiệp", "HEAVY_BAG", 2),
  V(4, "cf-4", "Đấm bóng ma khởi động", "SHADOW_BOXING", 4),
  V(5, "cf-6", "Đấm đích phối hợp chân", "PAD_WORK", 6),
  V(6, "cf-3", "Bao cát giữ nhịp", "HEAVY_BAG", 9),
];

export const mockCoachNavApi = {
  async unreadCount(): Promise<{ count: number }> {
    await wait(200);
    if (scenario() === "empty") return { count: 0 };
    const forced = (globalThis as { __COACH_MOCK_UNREAD__?: number }).__COACH_MOCK_UNREAD__;
    if (typeof forced === "number") return { count: forced };
    return { count: NOTIFICATIONS.filter((n) => !n.isRead).length };
  },
  async listNotifications(q: { page?: number; limit?: number } = {}): Promise<Paginated<AppNotification>> {
    await wait();
    const rows = scenario() === "empty" ? [] : NOTIFICATIONS;
    const limit = q.limit ?? 30;
    return { data: rows.slice(0, limit), total: rows.length, hasNextPage: rows.length > limit };
  },
  async markRead(id: string): Promise<void> {
    const row = NOTIFICATIONS.find((n) => n.id === id);
    if (row) {
      row.isRead = true;
      row.readAt = new Date().toISOString();
    }
  },
  async listVideos(q: { fighterId?: string; cursor?: string; limit?: number } = {}): Promise<VideoPage> {
    await wait();
    const rows = scenario() === "empty" ? [] : VIDEOS.filter((v) => !q.fighterId || v.fighterId === q.fighterId);
    return { items: rows, pageInfo: { hasNextPage: false, endCursor: null }, total: rows.length };
  },
};
