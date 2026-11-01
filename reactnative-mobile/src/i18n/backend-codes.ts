/**
 * Lớp dịch DUY NHẤT từ mã/enum backend sang câu tiếng Việt cho người dùng.
 * Không bao giờ hiện thẳng `error.message` của máy chủ hay lỗi JavaScript.
 * Muốn đổi câu chữ: chỉ sửa file này.
 */
import { pendingVi } from "./pending-vi";

/** Câu chung khi không biết mã lỗi. */
export const GENERIC_ERROR = "Không thực hiện được thao tác. Hãy thử lại.";
/** Hiện thay cho một giá trị enum lạ (không hiện mã thô). */
export const UNKNOWN_VALUE = "Chưa rõ";

/** Mã lỗi backend → câu cho người dùng. */
export const errorCodeText: Record<string, string> = {
  // Chung
  NETWORK_ERROR: "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại; dữ liệu đang nhập được giữ nguyên.",
  VALIDATION_ERROR: "Thông tin chưa hợp lệ. Kiểm tra các ô nhập trước khi lưu.",
  TOO_MANY_REQUESTS: "Bạn thao tác quá nhanh. Đợi một chút rồi thử lại.",
  // Trận (nestjs-api/src/bouts/bouts.error.ts)
  BOUT_NOT_FOUND: "Không tìm thấy trận hoặc bạn không có quyền xem.",
  BOUT_FIGHTER_NOT_FOUND: "Không tìm thấy võ sĩ hoặc võ sĩ không còn hoạt động.",
  BOUT_ACTIVE_EXISTS: "Võ sĩ đã có một trận đang chuẩn bị. Mỗi võ sĩ chỉ có một trận đang chạy.",
  BOUT_COACH_REQUIRED: "Cần chọn huấn luyện viên phụ trách trận.",
  BOUT_COACH_NOT_ASSIGNED: "Huấn luyện viên chưa được phân công cho võ sĩ này.",
  BOUT_NOT_IN_FUTURE: "Thời gian thi đấu phải ở tương lai.",
  BOUT_INVALID_SCHEDULE: "Lịch chưa hợp lệ: giờ cân phải trước giờ thi đấu và trận phải ở tương lai.",
  BOUT_INVALID_WEIGHT_CLASS: "Hạng cân hoặc giới hạn cân không hợp lệ với luật thi đấu đã chọn.",
  BOUT_CHANGE_REASON_REQUIRED: "Cần ghi lý do khi đổi hạng cân hoặc giới hạn cân.",
  BOUT_PLAN_INVALID: "Giáo án phải thuộc cùng võ sĩ và đang ở giai đoạn trại thi đấu.",
  BOUT_REQUIREMENT_EXISTS: "Mục hồ sơ này đã có trong trận.",
  BOUT_REQUIREMENT_INVALID: "Mục hồ sơ chưa hợp lệ. Kiểm tra lại thông tin.",
  BOUT_REQUIREMENT_NOT_FOUND: "Không tìm thấy mục hồ sơ này.",
  BOUT_REQUIREMENTS_INCOMPLETE: "Chưa đủ hồ sơ thi đấu nên chưa vào được tuần thi đấu. Bổ sung hồ sơ rồi thử lại.",
  BOUT_REQUIREMENTS_LOCKED: "Hồ sơ thi đấu đang khoá trong tuần thi đấu và sau khi cân. Cần ghi lý do mở khoá trước khi sửa.",
  BOUT_FIGHT_WEEK_TOO_EARLY: "Chưa đến lúc vào tuần thi đấu.",
  BOUT_INVALID_TRANSITION: "Trạng thái trận chưa cho phép thao tác này. Hãy tải lại chi tiết trận.",
  BOUT_STATE_CONFLICT: "Trận vừa được cập nhật ở nơi khác. Tải lại trước khi tiếp tục; nội dung đang nhập vẫn được giữ.",
  BOUT_NOT_STARTED: "Trận chưa bắt đầu nên chưa ghi được kết quả.",
  BOUT_WEIGH_IN_TOO_EARLY: "Chưa đến ngày cân chính thức. Số đã nhập được giữ lại.",
  BOUT_WEIGH_IN_NOT_FAILED: `Trận chưa có lần cân không đạt nên chưa thoả thuận ${pendingVi.catchweight} được.`,
  BOUT_INVALID_CATCHWEIGHT: "Giới hạn thoả thuận phải từ số cân chính thức trở lên và cao hơn giới hạn cũ.",
  BOUT_RESULT_INVALID: "Kết quả trận chưa hợp lệ. Kiểm tra kết quả, cách thắng và hiệp kết thúc.",
  BOUT_ROUNDS_NOT_SET: "Trận chưa được đặt số hiệp. HLV cần cập nhật trận trước khi ghi hiệp.",
  BOUT_ROUND_OUT_OF_RANGE: "Hiệp này nằm ngoài số hiệp của trận hoặc chưa đến lượt.",
  BOUT_ROUNDS_BELOW_RECORDED: "Số hiệp không được ít hơn số hiệp đã ghi.",
  BOUT_ROUNDS_INCOMPLETE: "Chưa ghi đủ các hiệp. Xác nhận nếu vẫn muốn lưu kết quả.",
  BOUT_ROUND_MARK_UNKNOWN: "Chiến thuật hoặc quan sát đã thay đổi. Tải lại trận trước khi ghi.",
  BOUT_NEXT_ROUND_PLAN_LAST_ROUND: "Hiệp cuối không có kế hoạch hiệp sau. Bỏ kế hoạch rồi lưu lại diễn biến hiệp.",
  BOUT_AI_NO_OBSERVATIONS: "Cần ít nhất một quan sát về đối thủ trước khi xin gợi ý AI.",
  BOUT_AI_ALREADY_DECIDED: "Gợi ý này đã được ghi nhận trước đó.",
  BOUT_CHECK_VIOLATION: "Dữ liệu chưa hợp lệ. Kiểm tra lại rồi thử lại.",
  BOUT_OPERATION_FAILED: GENERIC_ERROR,
  // Video (nestjs-api/src/videos)
  VIDEO_NOT_FOUND: "Không tìm thấy video.",
  VIDEO_FORMAT_UNSUPPORTED: "Định dạng video chưa được hỗ trợ. Chọn tệp MP4 hoặc MOV.",
  VIDEO_SIZE_REQUIRED: "Không đọc được dung lượng tệp. Chọn lại video.",
  VIDEO_TOO_LARGE: "Video quá lớn. Chọn tệp nhỏ hơn.",
  VIDEO_STORAGE_FILE_TOO_LARGE: "Video quá lớn. Chọn tệp nhỏ hơn.",
  VIDEO_STORAGE_REJECTED: "Kho lưu trữ không nhận tệp này. Thử lại với tệp khác.",
  VIDEO_STORAGE_UNAVAILABLE: "Kho lưu video đang tạm gián đoạn. Thử lại sau.",
  VIDEO_SESSION_MISMATCH: "Video không thuộc buổi tập đã chọn.",
  VIDEO_JOB_EXISTS: "Video này đang được phân tích. Đợi kết quả rồi thử lại.",
};

/** Lỗi API → câu cho người dùng; mã lạ dùng câu theo mã HTTP hoặc câu chung. */
export function backendErrorText(error: { code?: string; status?: number } | null | undefined): string {
  if (!error) return GENERIC_ERROR;
  if (error.code && errorCodeText[error.code]) return errorCodeText[error.code];
  if (error.status === 0) return errorCodeText.NETWORK_ERROR;
  if (error.status === 401) return "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.";
  if (error.status === 403) return "Tài khoản không có quyền thực hiện thao tác này.";
  if (error.status === 404) return "Không tìm thấy dữ liệu.";
  if (error.status === 422 || error.status === 400) return errorCodeText.VALIDATION_ERROR;
  if (error.status === 429) return errorCodeText.TOO_MANY_REQUESTS;
  return GENERIC_ERROR;
}

/** Huy hiệu trạng thái gợi ý AI (status + errorCode của /ai/*). */
export const aiStatusBadge: Record<string, string> = {
  OK: "Có gợi ý",
  FAILED: "Chưa có gợi ý",
  NOT_CONFIGURED: "AI chưa được bật",
  TIMEOUT: "AI không trả lời kịp",
  QUOTA: "AI tạm hết lượt",
  UPSTREAM: "Dịch vụ AI đang gián đoạn",
  EMPTY: "AI chưa có lời dặn phù hợp",
};
export const aiKindText: Record<string, string> = {
  PRE_BOUT_TACTICS: "Gợi ý chiến thuật trước trận",
  BETWEEN_ROUNDS: "Lời dặn giữa hiệp",
  VIDEO_OBSERVATIONS: "Quan sát từ video",
};
export const aiDecisionText: Record<string, string> = { ACCEPTED: "Đã dùng hết", PARTIAL: "Đã dùng một phần", REJECTED: "Không dùng" };
export const aiNotes = { safetyRed: "Cảnh báo an toàn đang bật", cached: "Gợi ý lấy lại từ lần trước", label: "AI", sample: "Gợi ý mẫu (demo)" };

/** Kết quả trận (BOUT_RESULTS) và cách kết thúc (BOUT_METHODS, bouts.model.ts:914-922). */
export const boutResultText: Record<string, string> = { WIN: "Thắng", LOSS: "Thua", DRAW: "Hoà", NO_CONTEST: "Không tính kết quả" };
export const boutMethodText: Record<string, string> = {
  KO: "Hạ đo ván (KO)", TKO: "Hạ đo ván kỹ thuật (TKO)", DECISION: "Tính điểm", SUBMISSION: "Khoá siết (đối thủ đầu hàng)", DQ: "Truất quyền thi đấu", OTHER: "Khác",
};
/** Đọc một enum; giá trị lạ → UNKNOWN_VALUE, không hiện mã. */
export const label = (map: Record<string, string>, value: string | null | undefined) => (value != null && map[value]) || UNKNOWN_VALUE;

/** T-041: điểm cần luyện (improvementPointSchema, bout-analysis.model.ts:475-487). Mã lạ → null để màn bỏ qua. */
export function improvementPointText(p: { code?: unknown; text?: unknown; fromRound?: unknown; tacticId?: unknown }): string | null {
  if (p.code === "TACTIC_INEFFECTIVE") return typeof p.text === "string" && p.text.trim() ? `Chưa hiệu quả: ${p.text.trim()}` : null;
  if (p.code === "ACUTE_LOSS_EXCEEDED") return "Giảm cân cấp tốc vượt ngưỡng";
  const m = typeof p.code === "string" ? /^FATIGUE_FROM_ROUND_([1-9]|1[0-2])$/.exec(p.code) : null;
  return m ? `Đuối sức từ hiệp ${m[1]}` : null;
}
