/**
 * Phase 5 C: the backend still sends English inbox texts and recording guidance.
 * This file is the ONLY place they become Vietnamese. Never render the raw English:
 * an unknown code or a body that matches no template is hidden (falls back to the type title).
 * Sources (read-only): nestjs-api *_NOTIFICATION_TEXT constants, shared/contracts/notification.contract.ts,
 * python-worker/pipeline/movement_evidence.py GUIDANCE.
 */

/** Recording guidance code → Vietnamese (movement_evidence.py GUIDANCE). */
export const guidanceText: Record<string, string> = {
  QUALITY_BLOCKED: "Chất lượng video chưa đủ. Xem lại các mục kiểm tra khi quay rồi quay lại.",
  QUALITY_UNKNOWN: "Thiếu thông tin chất lượng video. Xử lý lại video trước khi dựa vào báo cáo này.",
  TRACKING_UNVERIFIED: "Chưa xác minh được người cần theo dõi. Quay rõ một người trong khung hình rồi xử lý lại.",
  MULTIPLE_PEOPLE: "Mỗi lần chỉ quay một võ sĩ; video nhiều người không xác minh được đúng người.",
  INVALID_TIMING: "Thời gian khung hình bị thiếu hoặc không đều. Xuất lại video gốc rồi xử lý lại.",
  INVALID_DIMENSIONS: "Không đọc được kích thước video. Xuất lại bản quay gốc.",
  LOW_FPS: "Dùng video quay ít nhất 20 khung hình/giây.",
  NO_REVIEW_WINDOWS: "Không có đoạn liền mạch nào để xem. Giữ các khớp cần thiết trong khung hình lâu hơn.",
  MISSING_POSE: "Giữ võ sĩ và các khớp cần thiết trong khung hình.",
  LOW_VISIBILITY: "Tăng ánh sáng, tránh quần áo, dụng cụ hay đồ vật che các khớp cần thiết.",
  NON_FRESH_POSE: "Khung xương lấy từ bộ nhớ đệm hoặc chưa xác minh không được dùng làm bằng chứng. Xử lý lại video gốc.",
  TRACKING_BREAK: "Việc theo dõi bị đổi người hoặc gián đoạn. Giữ máy quay cố định và võ sĩ luôn trong khung hình.",
  EXERCISE_NOT_DECLARED: "Chọn bài tập được giao trước khi đọc tiến bộ theo bài tập.",
  CAMERA_NOT_DECLARED: "Ghi lại góc máy quay để các lần quay sau so sánh được.",
  LIMITED_COVERAGE: "Một phần video bị loại. Chỉ xem các đoạn được liệt kê, hoặc quay lại.",
};

/** Guidance line for a code; null hides it (never show the English message). */
export function guidanceLine(code: string): string | null {
  return guidanceText[code] ?? null;
}

/** Title by notification type (all values of notification_type, incl. legacy ones). */
export const notificationTypeTitle: Record<string, string> = {
  ADMISSION_APPLICATION_SUBMITTED: "Có đơn đăng ký võ sĩ mới",
  ADMISSION_ASSESSMENT_ASSIGNED: "Bạn được giao đánh giá đơn",
  ADMISSION_ASSESSMENT_UNASSIGNED: "Đơn đã giao cho HLV khác",
  ADMISSION_DECISION_REQUIRED: "Đơn chờ quyết định",
  ADMISSION_ASSESSMENT_RESULT: "Kết quả đánh giá đơn",
  ADMISSION_DECISION_RECORDED: "Đã có quyết định về đơn",
  ADMISSION_ACTIVATION_COMPLETED: "Võ sĩ mới đã kích hoạt",
  COACH_ASSIGNMENT_STARTED: "Phân công huấn luyện mới",
  COACH_ASSIGNMENT_ENDED: "Kết thúc phân công huấn luyện",
  TRAINING_PLAN_ACTIVATED: "Giáo án đã áp dụng",
  TRAINING_SESSION_SCHEDULED: "Có buổi tập mới",
  TRAINING_SESSION_RESCHEDULED: "Buổi tập đã đổi",
  TRAINING_SESSION_CANCELLED: "Buổi tập đã huỷ",
  FIGHTER_DOCTOR_ASSIGNMENT_REQUIRED: "Cần phân công bác sĩ",
  BOUT_CREATED: "Có trận mới",
  BOUT_WEIGHT_AT_RISK: "Cân nặng có nguy cơ không đạt",
  BOUT_REQUIREMENT_REJECTED: "Hồ sơ thi đấu bị từ chối",
  BOUT_REQUIREMENT_DUE: "Hồ sơ thi đấu sắp đến hạn",
  BOUT_WEIGHT_MISSING: "Chưa ghi cân",
  SUSPENSION_CREATED: "Có đình chỉ mới",
  SUSPENSION_AWAITING_CLEARANCE: "Đình chỉ chờ bác sĩ cho phép",
  // Legacy values (still readable in the inbox, no longer published).
  ANOMALY_HIGH: "Bất thường mức cao",
  ANOMALY_MEDIUM: "Bất thường mức trung bình",
  SESSION_REMINDER: "Nhắc buổi tập",
  MEDICAL_CLEARANCE_EXPIRY: "Giấy phép y tế sắp hết hạn",
  VIDEO_PROCESSED: "Video đã xử lý xong",
  SYSTEM: "Thông báo hệ thống",
  JOINT_IMPAIRMENT_CONFIRMED: "Đã xác nhận suy giảm khớp",
};
export const NOTIFICATION_FALLBACK_TITLE = "Thông báo mới";

type Template = { title: string; titleVi: string; body: RegExp; bodyVi: (m: RegExpMatchArray) => string };
const exact = (s: string) => new RegExp(`^${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
const tpl = (title: string, titleVi: string, body: string, bodyVi: string): Template =>
  ({ title, titleVi, body: exact(body), bodyVi: () => bodyVi });

/**
 * Exact backend templates per type (none carries variable parts today; a template with
 * variables would use capture groups and keep them as sent).
 */
export const notificationTemplates: Record<string, Template[]> = {
  ADMISSION_APPLICATION_SUBMITTED: [tpl("New fighter application", "Có đơn đăng ký võ sĩ mới",
    "A Guest submitted a fighter application. Assign a Coach to evaluate it.",
    "Một khách vừa gửi đơn đăng ký võ sĩ. Hãy giao một HLV đánh giá đơn.")],
  ADMISSION_ASSESSMENT_ASSIGNED: [tpl("Application assigned to you", "Bạn được giao đánh giá đơn",
    "You were assigned to evaluate a fighter application. Record the PASS or FAIL assessment when you are done.",
    "Bạn được giao đánh giá một đơn đăng ký võ sĩ. Đánh giá xong, hãy ghi kết quả Đạt hoặc Không đạt.")],
  ADMISSION_ASSESSMENT_UNASSIGNED: [tpl("Application evaluation reassigned", "Đơn đã giao cho HLV khác",
    "A fighter application you were evaluating was reassigned to another Coach. No further action is needed from you.",
    "Đơn bạn đang đánh giá đã được giao cho HLV khác. Bạn không cần làm gì thêm.")],
  ADMISSION_DECISION_REQUIRED: [tpl("Application awaiting decision", "Đơn chờ quyết định",
    "A Coach recorded a PASS assessment. Approve or reject the application.",
    "HLV đã đánh giá Đạt. Hãy duyệt hoặc từ chối đơn.")],
  ADMISSION_ASSESSMENT_RESULT: [
    tpl("Assessment passed", "Đơn đã đạt đánh giá",
      "Your application passed the assessment and is waiting for an Admin decision. Passing does not activate your Fighter account yet.",
      "Đơn của bạn đã đạt đánh giá và đang chờ quản trị quyết định. Đạt đánh giá chưa kích hoạt tài khoản võ sĩ."),
    tpl("Assessment not passed", "Đơn chưa đạt đánh giá",
      "Your application did not pass the assessment and this attempt is closed. You may submit a new application.",
      "Đơn của bạn chưa đạt đánh giá và lần đăng ký này đã đóng. Bạn có thể gửi đơn mới."),
  ],
  ADMISSION_DECISION_RECORDED: [
    tpl("Application approved", "Đơn đã được duyệt",
      'Your application was approved. Set your password from the email we sent to activate your Fighter account (if it does not arrive, request another one with "Forgot password" on the sign-in page), then complete activation.',
      "Đơn của bạn đã được duyệt. Đặt mật khẩu từ email chúng tôi đã gửi để kích hoạt tài khoản võ sĩ (nếu chưa nhận được, bấm \"Quên mật khẩu\" ở trang đăng nhập để gửi lại), rồi hoàn tất kích hoạt."),
    tpl("Application not approved", "Đơn không được duyệt",
      "Your application was not approved. This attempt is closed.",
      "Đơn của bạn không được duyệt. Lần đăng ký này đã đóng."),
  ],
  ADMISSION_ACTIVATION_COMPLETED: [tpl("New Fighter activated", "Võ sĩ mới đã kích hoạt",
    "A new Fighter completed activation. Assign a training Coach; the admission evaluator is not assigned automatically.",
    "Một võ sĩ mới đã kích hoạt tài khoản. Hãy giao HLV huấn luyện; HLV đánh giá đơn không tự được giao.")],
  COACH_ASSIGNMENT_STARTED: [
    tpl("New Fighter assigned", "Bạn có võ sĩ mới",
      "You were assigned as training Coach for a Fighter. The Fighter appears in your roster from the assignment start.",
      "Bạn được giao làm HLV huấn luyện cho một võ sĩ. Võ sĩ hiện trong danh sách của bạn từ ngày bắt đầu phân công."),
    tpl("Training Coach assigned", "Bạn đã có HLV huấn luyện",
      "A training Coach was assigned to you.", "Bạn đã được giao một HLV huấn luyện."),
  ],
  COACH_ASSIGNMENT_ENDED: [
    tpl("Fighter assignment ended", "Kết thúc phân công võ sĩ",
      "One of your training Fighter assignments was ended.", "Một phân công huấn luyện võ sĩ của bạn đã kết thúc."),
    tpl("Training Coach assignment ended", "Kết thúc phân công HLV",
      "One of your training Coach assignments was ended.", "Một phân công HLV huấn luyện của bạn đã kết thúc."),
  ],
  TRAINING_PLAN_ACTIVATED: [tpl("Training plan active", "Giáo án đã áp dụng",
    "A training plan assigned to you is now active.", "Giáo án giao cho bạn đã bắt đầu áp dụng.")],
  TRAINING_SESSION_SCHEDULED: [tpl("Training session scheduled", "Có buổi tập mới",
    "A new training session was scheduled.", "Một buổi tập mới vừa được xếp lịch.")],
  TRAINING_SESSION_RESCHEDULED: [tpl("Training session changed", "Buổi tập đã đổi",
    "The time or location of a training session changed.", "Giờ hoặc địa điểm một buổi tập đã thay đổi.")],
  TRAINING_SESSION_CANCELLED: [tpl("Training session cancelled", "Buổi tập đã huỷ",
    "A training session was cancelled.", "Một buổi tập đã bị huỷ.")],
  FIGHTER_DOCTOR_ASSIGNMENT_REQUIRED: [tpl("Assign a Doctor", "Cần phân công bác sĩ",
    "A new Fighter needs an assigned Doctor for the baseline examination before training.",
    "Một võ sĩ mới cần được phân công bác sĩ để khám ban đầu trước khi tập.")],
};

/** Vietnamese title and body for one inbox row; `message` is "" when no template matches. */
export function viNotification(n: { type: string; title: string; message: string }): { title: string; message: string } {
  const list = notificationTemplates[n.type] ?? [];
  const hit = list.find((t) => t.title === n.title.trim()) ?? null;
  const title = hit?.titleVi ?? notificationTypeTitle[n.type] ?? NOTIFICATION_FALLBACK_TITLE;
  const text = n.message.trim();
  for (const t of hit ? [hit, ...list.filter((x) => x !== hit)] : list) {
    const m = text.match(t.body);
    if (m) return { title, message: t.bodyVi(m) };
  }
  return { title, message: "" };
}

/** Apply to a fetched row, keeping every other field. */
export function localizeNotification<T extends { type: string; title: string; message: string }>(n: T): T {
  return { ...n, ...viNotification(n) };
}

/**
 * Phase 5 C (3a): re-analysis copies the video with title `${title} (Reanalysis)`
 * (nestjs-api/src/coaching/coaching.service.ts:399); repeated re-analysis stacks the suffix.
 * Every trailing " (Reanalysis)" becomes " (Phân tích lại)"; the user's own title is kept as sent.
 */
export function videoTitle(title: string): string;
export function videoTitle(title: string | null | undefined): string | null | undefined;
export function videoTitle(title: string | null | undefined) {
  if (!title) return title;
  let base = title, n = 0;
  while (/ \(Reanalysis\)$/.test(base)) { base = base.slice(0, -" (Reanalysis)".length); n++; }
  return n ? base + " (Phân tích lại)".repeat(n) : title;
}

/**
 * Phase 5 I: examination areas are stored as the English names the baseline form sends
 * (src/clinical/baseline-payload.ts BASELINE_AREAS). Shown in Vietnamese; any other area is shown as written.
 */
const AREA_VI: Record<string, string> = { Cardiovascular: "Tim mạch", Neurological: "Thần kinh", Musculoskeletal: "Cơ xương khớp" };
export function assessmentAreaLabel(area: string): string {
  return AREA_VI[area.trim()] ?? area;
}
