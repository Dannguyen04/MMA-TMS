import { ApiError } from "@/api/errors";
import type { AnalysisInput, CampStatus } from "@/api/fight-camp";

export const statusLabel: Record<CampStatus, string> = {
  SCHEDULED: "Đã lên lịch", CAMP: "Trong trại tập", FIGHT_WEEK: "Tuần thi đấu",
  WEIGHED_IN: "Đã cân chính thức", COMPLETED: "Đã kết thúc", CANCELLED: "Đã huỷ",
};
export const outcomeLabel = { EFFECTIVE: "Hiệu quả", INEFFECTIVE: "Không hiệu quả", NOT_USED: "Chưa dùng" };
export const kg = (value: number | null | undefined) => value == null ? "—" : value.toFixed(1).replace(".", ",");
export const dateLabel = (value: string) => new Date(value.length === 10 ? `${value}T12:00:00+07:00` : value).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" });
export function readKg(text: string): number {
  if (!/^\d{1,3}([.,]\d)?$/.test(text.trim())) throw new Error("Nhập số kg, tối đa một chữ số sau dấu phẩy.");
  const value = Number(text.trim().replace(",", "."));
  if (value < 30 || value > 200) throw new Error("Cân nặng phải từ 30 đến 200 kg.");
  return value;
}
export function campError(error: unknown): string {
  if (!(error instanceof ApiError)) return error instanceof Error ? error.message : "Không tải được dữ liệu. Hãy thử lại.";
  const details = error.details as { earliestOn?: string } | undefined;
  if (error.code === "BOUT_WEIGH_IN_TOO_EARLY") return `Chưa đến ngày cân chính thức${details?.earliestOn ? `. Có thể ghi từ ${dateLabel(details.earliestOn)}` : ""}. Số đã nhập được giữ lại.`;
  const labels: Record<string, string> = {
    NETWORK_ERROR: "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại; dữ liệu đang nhập được giữ nguyên.",
    BOUT_INVALID_TRANSITION: "Trạng thái trận chưa cho phép thao tác này. Hãy tải lại chi tiết trận.",
    BOUT_STATE_CONFLICT: "Trận vừa được cập nhật ở nơi khác. Tải lại trước khi tiếp tục; nội dung đang nhập vẫn được giữ.",
    BOUT_WEIGH_IN_NOT_FAILED: "Trận chưa có lần cân không đạt để thoả thuận catchweight.",
    BOUT_INVALID_CATCHWEIGHT: "Giới hạn thoả thuận không được thấp hơn số cân chính thức.",
    BOUT_ROUNDS_NOT_SET: "Trận chưa được đặt số hiệp. HLV cần cập nhật trận trước khi ghi hiệp.",
    BOUT_ROUND_OUT_OF_RANGE: "Hiệp này vượt số hiệp đã đặt cho trận.",
    BOUT_ROUND_MARK_UNKNOWN: "Chiến thuật hoặc quan sát đã thay đổi. Tải lại trận trước khi ghi.",
    BOUT_NOT_FOUND: "Không tìm thấy trận hoặc bạn không có quyền xem.",
  };
  if (labels[error.code]) return labels[error.code];
  if (error.status === 401) return "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.";
  if (error.status === 403) return "Tài khoản không có quyền thực hiện thao tác này hoặc chưa phụ trách võ sĩ.";
  if (error.status === 422) return "Thông tin chưa hợp lệ. Kiểm tra các ô nhập trước khi lưu.";
  return "Không thực hiện được thao tác. Hãy thử lại.";
}
export function validateAnalysis(a: AnalysisInput, maxRounds: number | null): void {
  if (a.observations.length > 6 || a.tactics.length > 5) throw new Error("Tối đa 6 quan sát và 5 chiến thuật.");
  for (const o of a.observations) {
    if (!o.text.trim()) throw new Error("Mỗi quan sát cần có nội dung.");
    if (!o.evidenceNote?.trim() && !o.evidenceUrl?.trim()) throw new Error("Mỗi quan sát cần đường dẫn hoặc ghi chú bằng chứng.");
    if (o.evidenceUrl && !/^https?:\/\/\S+$/i.test(o.evidenceUrl)) throw new Error("Đường dẫn bằng chứng phải bắt đầu bằng http:// hoặc https://.");
  }
  for (const t of a.tactics) {
    if (!t.text.trim()) throw new Error("Mỗi chiến thuật cần có nội dung.");
    if (!t.observationIds.length) throw new Error("Chọn ít nhất một quan sát làm căn cứ cho mỗi chiến thuật.");
    if (t.round != null && (!Number.isInteger(t.round) || t.round < 1 || t.round > (maxRounds ?? 12))) throw new Error("Hiệp áp dụng phải nằm trong số hiệp của trận.");
  }
}
