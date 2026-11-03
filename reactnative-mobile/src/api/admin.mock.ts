import { ApiError } from "./errors";
import type { AppNotification, CoachAssignment, DoctorAssignment, Paginated, PublicUser, UserListPage, UserRole } from "./types";
import { mockCoachApi } from "./coach.mock";

/**
 * Dữ liệu giả lập cho màn Admin chỉ đọc (A-1..A-4). Chỉ bật khi EXPO_PUBLIC_ADMIN_MOCK=true.
 * Kịch bản (chỉ dev): `globalThis.__ADMIN_MOCK_SCENARIO__` (hoặc `__COACH_MOCK_SCENARIO__`) =
 * "empty", "offline", "slow".
 */
type Scenario = "normal" | "empty" | "offline" | "slow";
const DAY = 86_400_000;

function scenario(): Scenario {
  const g = globalThis as { __ADMIN_MOCK_SCENARIO__?: string; __COACH_MOCK_SCENARIO__?: string };
  const v = g.__ADMIN_MOCK_SCENARIO__ ?? g.__COACH_MOCK_SCENARIO__;
  return v === "empty" || v === "offline" || v === "slow" ? v : "normal";
}

async function wait(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, scenario() === "slow" ? 2500 : 350));
  if (scenario() === "offline") throw new ApiError(0, "NETWORK_ERROR", "Network request failed");
}

const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();

type Seed = { role: UserRole; email: string; first?: string; last?: string; active?: boolean; extra?: Record<string, unknown> };
const SEEDS: Seed[] = [
  { role: "ADMIN", email: "quanly@fightcamp.vn", first: "Phạm", last: "Quang Minh" },
  { role: "COACH", email: "hung.le@fightcamp.vn", first: "Lê", last: "Hùng", extra: { isHeadCoach: true, specialization: "Boxing và Muay Thái" } },
  { role: "COACH", email: "tuan.do@fightcamp.vn", first: "Đỗ", last: "Anh Tuấn", extra: { isHeadCoach: false, specialization: "Thể lực" } },
  { role: "DOCTOR", email: "lan.nguyen@fightcamp.vn", first: "Nguyễn", last: "Thị Lan", extra: { licenseNumber: "BS-20481", specialization: "Y học thể thao" } },
  { role: "DOCTOR", email: "binh.vu@fightcamp.vn", first: "Vũ", last: "Thanh Bình", extra: { licenseNumber: "BS-31877", specialization: "Phục hồi chức năng" } },
  { role: "FIGHTER", email: "khang.nguyen@example.com", first: "Nguyễn", last: "Minh Khang", extra: { fighter: 0 } },
  { role: "FIGHTER", email: "bao.tran@example.com", first: "Trần", last: "Quốc Bảo", extra: { fighter: 1 } },
  { role: "FIGHTER", email: "phuc.le@example.com", first: "Lê", last: "Hoàng Phúc", extra: { fighter: 2 } },
  { role: "FIGHTER", email: "huy.pham@example.com", first: "Phạm", last: "Gia Huy", extra: { fighter: 3 } },
  { role: "FIGHTER", email: "tung.vo@example.com", first: "Võ", last: "Thanh Tùng", active: false, extra: { fighter: 4 } },
  { role: "GUEST", email: "khach.moi@example.com" },
  { role: "GUEST", email: "an.ho@example.com", first: "Hồ", last: "Thiên An", active: false },
];

let fighterCache: Awaited<ReturnType<typeof mockCoachApi.listFighters>>["data"] | null = null;

async function fighterRows() {
  if (!fighterCache) {
    const g = globalThis as { __COACH_MOCK_SCENARIO__?: string; __ADMIN_MOCK_SCENARIO__?: string };
    const keep = g.__COACH_MOCK_SCENARIO__;
    g.__COACH_MOCK_SCENARIO__ = "normal";
    fighterCache = (await mockCoachApi.listFighters({ limit: 100 })).data;
    g.__COACH_MOCK_SCENARIO__ = keep;
  }
  return fighterCache;
}

async function users(): Promise<PublicUser[]> {
  const fighters = await fighterRows();
  return SEEDS.map((s, i) => {
    const id = `u-${i + 1}`;
    let profile: PublicUser["profile"] = null;
    if (s.first) {
      if (s.role === "FIGHTER") {
        const f = fighters[(s.extra!.fighter as number) ?? 0]!;
        profile = {
          id: f.id, firstName: f.firstName, lastName: f.lastName, dateOfBirth: f.dateOfBirth, weightClass: f.weightClass,
          nationality: f.nationality, heightCm: f.heightCm, reachCm: f.reachCm, dominantStance: f.dominantStance, gym: f.gym,
        };
      } else if (s.role === "COACH" || s.role === "DOCTOR") {
        profile = { id: `p-${i + 1}`, firstName: s.first, lastName: s.last ?? "", ...(s.extra as object) };
      }
    }
    return {
      id, email: s.email, role: s.role, isActive: s.active !== false,
      createdAt: ago(120 - i * 7), updatedAt: ago(10 + i), deletedAt: null, profile,
    };
  });
}

const DOCTORS: Record<string, DoctorAssignment[]> = {
  "cf-1": [
    { id: "da-1", doctorId: "p-4", fighterId: "cf-1", assignedById: "u-1", startsAt: ago(20), endsAt: null, endedById: null, endReason: null, createdAt: ago(20), doctorName: "BS. Nguyễn Thị Lan" },
    { id: "da-2", doctorId: "p-5", fighterId: "cf-1", assignedById: "u-1", startsAt: ago(150), endsAt: ago(21), endedById: "u-1", endReason: "chuyen", createdAt: ago(150), doctorName: "BS. Vũ Thanh Bình" },
  ],
  "cf-2": [{ id: "da-3", doctorId: "p-5", fighterId: "cf-2", assignedById: "u-1", startsAt: ago(60), endsAt: null, endedById: null, endReason: null, createdAt: ago(60), doctorName: "BS. Vũ Thanh Bình" }],
  // Không có doctorName và doctorId không có trong danh sách bác sĩ → màn hiện chữ dự phòng "Bác sĩ".
  "cf-5": [{ id: "da-5", doctorId: "p-99", fighterId: "cf-5", assignedById: "u-1", startsAt: ago(12), endsAt: null, endedById: null, endReason: null, createdAt: ago(12) }],
  "cf-4": [{ id: "da-4", doctorId: "p-4", fighterId: "cf-4", assignedById: "u-1", startsAt: ago(35), endsAt: null, endedById: null, endReason: null, createdAt: ago(35) }],
};

const COACHES: Record<string, CoachAssignment[]> = {
  "cf-1": [
    { id: "ca-1", coachId: "p-2", fighterId: "cf-1", assignedById: "u-1", startsAt: ago(40), endsAt: null, endedById: null, endReason: null, createdAt: ago(40), coachName: "Trần Văn Hùng" },
    { id: "ca-2", coachId: "p-3", fighterId: "cf-1", assignedById: "u-1", startsAt: ago(200), endsAt: ago(41), endedById: "u-1", endReason: "Phân công nhầm", createdAt: ago(200), coachName: "Lê Quốc Bảo" },
  ],
  "cf-2": [{ id: "ca-3", coachId: "p-2", fighterId: "cf-2", assignedById: "u-1", startsAt: ago(60), endsAt: null, endedById: null, endReason: null, createdAt: ago(60), coachName: "Trần Văn Hùng" }],
};

function pageUsers(rows: PublicUser[], q: { page?: number; limit?: number }): UserListPage {
  const limit = q.limit ?? 20;
  const p = q.page ?? 1;
  return { items: rows.slice((p - 1) * limit, p * limit), total: rows.length, page: p, limit };
}

const minsAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const NOTIFICATIONS: AppNotification[] = [
  { id: "an-1", type: "FIGHTER_MEDICAL_STATUS_CHANGED", title: "Phạm Gia Huy chuyển sang Chấn thương", message: "Bác sĩ Nguyễn Thị Lan vừa cập nhật tình trạng y tế.", payload: {}, isRead: false, readAt: null, createdAt: minsAgo(18) },
  { id: "an-2", type: "USER_REGISTERED", title: "Tài khoản mới: Hồ Thiên An", message: "Khách vừa đăng ký tài khoản.", payload: {}, isRead: false, readAt: null, createdAt: minsAgo(190) },
  { id: "an-3", type: "TRAINING_SESSION_CANCELLED", title: "Buổi tập bị hủy", message: "Đấm đích tốc độ của Trần Quốc Bảo đã bị hủy.", payload: {}, isRead: true, readAt: minsAgo(1500), createdAt: minsAgo(1600) },
  { id: "an-4", type: "SYSTEM", title: "Bảo trì hệ thống", message: "Hệ thống bảo trì 22:00–23:00.", payload: {}, isRead: true, readAt: minsAgo(4000), createdAt: minsAgo(4300) },
];

export const mockAdminApi = {
  async listUsers(q: { page?: number; limit?: number; role?: UserRole; status?: "ACTIVE" | "INACTIVE"; search?: string } = {}) {
    await wait();
    if (scenario() === "empty") return pageUsers([], q);
    const s = q.search?.trim().toLowerCase();
    const rows = (await users()).filter((u) => {
      const name = u.profile ? `${u.profile.firstName} ${u.profile.lastName}`.toLowerCase() : "";
      return (
        (!q.role || u.role === q.role) &&
        (!q.status || (q.status === "ACTIVE") === u.isActive) &&
        (!s || u.email.toLowerCase().includes(s) || name.includes(s))
      );
    });
    return pageUsers(rows, q);
  },
  async getUser(id: string) {
    await wait();
    const found = (await users()).find((u) => u.id === id);
    if (!found) throw new ApiError(404, "NOT_FOUND", "Not found");
    return found;
  },
  async listFighterDoctors(fighterId: string, q: { page?: number; limit?: number } = {}): Promise<Paginated<DoctorAssignment>> {
    await wait();
    const rows = scenario() === "empty" ? [] : (DOCTORS[fighterId] ?? []);
    const limit = q.limit ?? 20;
    const p = q.page ?? 1;
    return { data: rows.slice((p - 1) * limit, p * limit), total: rows.length, hasNextPage: p * limit < rows.length };
  },
  async listFighterCoaches(fighterId: string): Promise<CoachAssignment[]> {
    await wait();
    return scenario() === "empty" ? [] : (COACHES[fighterId] ?? []);
  },
  async unreadCount() {
    await wait();
    return { count: scenario() === "empty" ? 0 : 5 };
  },
  async listNotifications(q: { page?: number; limit?: number; unreadOnly?: boolean } = {}): Promise<Paginated<AppNotification>> {
    await wait();
    const rows = scenario() === "empty" ? [] : NOTIFICATIONS.filter((n) => !q.unreadOnly || !n.isRead);
    const limit = q.limit ?? 20;
    const p = q.page ?? 1;
    return { data: rows.slice((p - 1) * limit, p * limit), total: rows.length, hasNextPage: p * limit < rows.length };
  },
};
