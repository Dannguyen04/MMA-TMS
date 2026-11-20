import type { ApplicationStatus } from "@/api/admissions/admissions";

/** Trạng thái hồ sơ còn chờ quản lý xử lý (gán HLV hoặc ra quyết định). */
export const ACTIONABLE_STATUSES: readonly ApplicationStatus[] = ["SUBMITTED", "PASSED", "FAILED"];

/** Đếm phía client trên trang hồ sơ mới nhất (backend chưa có API thống kê). */
export function countActionable(items: readonly { status: ApplicationStatus }[]): number {
  return items.filter((item) => ACTIONABLE_STATUSES.includes(item.status)).length;
}
