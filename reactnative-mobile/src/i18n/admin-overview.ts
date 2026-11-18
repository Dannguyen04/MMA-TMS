import type { MedicalStatus, UserRole } from "@/api/types";
import type { WeightClass } from "@/constants/weight-classes";
import { vi } from "@/i18n/vi";

import type { SessionGroup } from "@/screens/admin/overview/overview-data";

/** Chữ màn Admin · Tổng quan v2. */
export const adminOverview = {
  title: "Tổng quan",
  updatedAt: (hhmm: string) => `Cập nhật lúc ${hhmm}`,
  offline: (hhmm: string) => `Đang ngoại tuyến · hiển thị dữ liệu lúc ${hhmm}`,
  tiles: {
    users: "Người dùng",
    fighters: "Võ sĩ",
    sessionsToday: "Buổi hôm nay",
    ai: "AI đang chạy",
  },
  attention: {
    title: "Cần chú ý",
    injured: (n: string) => `${n} võ sĩ chấn thương`,
    notCleared: (n: string) => `${n} chưa cho phép thi đấu`,
    injuredBtn: (n: string) => `Chấn thương · ${n}`,
    notClearedBtn: (n: string) => `Chưa cho phép · ${n}`,
    more: (n: string) => `và ${n} võ sĩ khác`,
  },
  medical: {
    title: "Tình trạng y tế",
    count: (n: string) => `${n} võ sĩ`,
    empty: "Chưa có võ sĩ",
    a11y: (parts: string) => `Tình trạng y tế: ${parts}`,
  },
  sessions: {
    title: "Buổi tập 7 ngày",
    rateLine: "buổi đã xong trong 7 ngày",
    todayLabel: "Hôm nay",
    next7Label: "7 ngày tới",
    count: (n: string) => `${n} buổi`,
    rateNone: "Chưa có buổi tập nào kết thúc",
    today: (n: string) => `Hôm nay: ${n} buổi`,
    next7: (n: string) => `7 ngày tới: ${n} buổi đã lên lịch`,
    empty: "Chưa có buổi tập nào trong 7 ngày qua",
    a11y: (parts: string) => `Buổi tập 7 ngày qua: ${parts}`,
  },
  weight: {
    title: "Hạng cân",
    empty: "Chưa có võ sĩ",
    a11y: (parts: string) => `Võ sĩ theo hạng cân: ${parts}`,
  },
  roles: {
    title: "Vai trò",
    total: "Tổng",
    activeLabel: "Đang hoạt động",
    lockedRow: "Tài khoản đã khóa",
    empty: "Chưa có người dùng",
    a11y: (parts: string) => `Người dùng theo vai trò: ${parts}`,
  },
  notifications: {
    title: "Thông báo mới",
    empty: "Chưa có thông báo",
    unread: "Chưa đọc",
    seeAll: "Xem tất cả",
  },
  failed: "Phân tích lỗi",
  tools: {
    title: "Quản trị",
    admissions: "Nhập học",
    admissionsLine: (n: number) => `${n} hồ sơ chờ xử lý`,
    admissionsNone: "Không có hồ sơ chờ",
    assign: "Phân công bác sĩ",
    aiLine: (active: number, failed: number) => [active ? `${active} đang chạy` : "", failed ? `${failed} lỗi` : ""].filter(Boolean).join(" · "),
    videos: "Video",
  },
  block: {
    error: "Không tải được dữ liệu",
    retry: "Thử lại",
    open: "Chạm để mở danh sách",
  },
  medicalLabel: {
    HEALTHY: "Khỏe",
    MONITORING: "Theo dõi",
    RECOVERY: "Phục hồi",
    INJURED: "Chấn thương",
    NOT_CLEARED: "Chưa cho phép",
  } satisfies Record<MedicalStatus, string>,
  sessionLabel: {
    done: "Hoàn thành",
    skipped: "Bỏ buổi",
    abandoned: "Bỏ dở",
    cancelled: "Đã hủy",
    inProgress: "Đang tập",
    planned: "Đã lên lịch",
  } satisfies Record<SessionGroup, string>,
  roleLabel: {
    FIGHTER: "Võ sĩ",
    COACH: "Huấn luyện viên",
    DOCTOR: "Bác sĩ",
    ADMIN: "Quản trị",
    GUEST: "Khách",
  } satisfies Record<UserRole, string>,
  /** Nhãn hạng cân: dùng chung bảng của app (`vi.weightClass`) để mọi màn thống nhất. */
  weightLabel: vi.weightClass satisfies Record<WeightClass, string>,
} as const;
