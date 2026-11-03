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
    sessionsToday: "Buổi tập hôm nay",
    unread: "Thông báo chưa đọc",
  },
  attention: {
    title: "Cần chú ý",
    injured: (n: string) => `${n} võ sĩ chấn thương`,
    notCleared: (n: string) => `${n} chưa cho phép thi đấu`,
    injuredBtn: (n: string) => `Chấn thương (${n})`,
    notClearedBtn: (n: string) => `Chưa cho phép (${n})`,
    more: (n: string) => `và ${n} võ sĩ khác`,
  },
  medical: {
    title: "Tình trạng y tế võ sĩ",
    empty: "Chưa có võ sĩ",
    a11y: (parts: string) => `Tình trạng y tế: ${parts}`,
  },
  sessions: {
    title: "Buổi tập 7 ngày",
    rate: (v: string) => `Tỉ lệ hoàn thành 7 ngày qua: ${v}`,
    rateNone: "Chưa có buổi tập nào kết thúc",
    today: (n: string) => `Hôm nay: ${n} buổi`,
    next7: (n: string) => `7 ngày tới: ${n} buổi đã lên lịch`,
    empty: "Chưa có buổi tập nào trong 7 ngày qua",
    a11y: (parts: string) => `Buổi tập 7 ngày qua: ${parts}`,
  },
  weight: {
    title: "Võ sĩ theo hạng cân",
    empty: "Chưa có võ sĩ",
    a11y: (parts: string) => `Võ sĩ theo hạng cân: ${parts}`,
  },
  roles: {
    title: "Người dùng theo vai trò",
    total: "Tổng",
    active: (n: string) => `Đang hoạt động ${n}`,
    locked: (n: string) => `Đã khóa ${n}`,
    empty: "Chưa có người dùng",
    a11y: (parts: string) => `Người dùng theo vai trò: ${parts}`,
  },
  notifications: {
    title: "Thông báo mới",
    empty: "Chưa có thông báo",
    unread: "Chưa đọc",
    seeAll: "Xem tất cả",
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
    COACH: "HLV",
    DOCTOR: "Bác sĩ",
    ADMIN: "Quản trị",
    GUEST: "Khách",
  } satisfies Record<UserRole, string>,
  /** Nhãn hạng cân: dùng chung bảng của app (`vi.weightClass`) để mọi màn thống nhất. */
  weightLabel: vi.weightClass satisfies Record<WeightClass, string>,
} as const;
