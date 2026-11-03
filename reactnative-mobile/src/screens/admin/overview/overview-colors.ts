import type { MedicalStatus, UserRole } from "@/api/types";

import type { SessionGroup } from "./overview-data";

/**
 * Màu biểu đồ Tổng quan (admin-overview-v2, bảng "Màu"). Chỉ dùng cho thanh, chấm chú thích
 * và vòng donut; chữ/nhãn luôn là màu chữ `ink`. Đồ họa ≥ 3:1 với nền thẻ.
 */
export type ChartColors = {
  medical: Record<MedicalStatus, string>;
  session: Record<SessionGroup, string>;
  weight: string;
  role: Record<UserRole, string>;
};

export const CHART_COLORS: Record<"light" | "dark", ChartColors> = {
  light: {
    medical: { HEALTHY: "#21664B", MONITORING: "#7A4F00", RECOVERY: "#1B5FB8", INJURED: "#B4123F", NOT_CLEARED: "#616169" },
    session: { done: "#21664B", skipped: "#616169", abandoned: "#7A4F00", cancelled: "#B4123F", inProgress: "#1B5FB8", planned: "#C23A22" },
    weight: "#C23A22",
    role: { FIGHTER: "#C23A22", COACH: "#18181B", DOCTOR: "#1B5FB8", ADMIN: "#7A4F00", GUEST: "#8A8A93" },
  },
  dark: {
    medical: { HEALTHY: "#6BC48F", MONITORING: "#FFB020", RECOVERY: "#6EB5FF", INJURED: "#FF6B81", NOT_CLEARED: "#A1A1AA" },
    session: { done: "#6BC48F", skipped: "#A1A1AA", abandoned: "#FFB020", cancelled: "#FF6B81", inProgress: "#6EB5FF", planned: "#FF8066" },
    weight: "#FF8066",
    role: { FIGHTER: "#FF8066", COACH: "#F4F4F5", DOCTOR: "#6EB5FF", ADMIN: "#FFB020", GUEST: "#6A6A74" },
  },
};
