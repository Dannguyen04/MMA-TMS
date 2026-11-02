import "server-only";

import { apiWriteFailure, maybeNotSavedMessage, type ServiceErrorMessages, type WriteErrorOptions, type WriteFailure } from "./api-write-errors";

export { isUnconfirmedWrite } from "./api-write-errors";

/** How the medical service's refusals read on the doctor's forms; the status rules are shared (`api-write-errors.ts`). */

export type MedicalWriteFailure = WriteFailure;
export type MedicalWriteErrorOptions = WriteErrorOptions;

export const MAYBE_NOT_SAVED = maybeNotSavedMessage("dịch vụ y tế");

/**
 * After a write the service didn't confirm, the doctor's forms read the record again before saying anything. These
 * are what they say when that read doesn't find the record, or can't be made. Neither asks for a reload: the form
 * keeps every answer, and trying again checks the record first.
 */
export const unconfirmedWriteMessages = (record: string) => ({
    notFound: `Dịch vụ y tế không xác nhận ${record} và nó chưa có trong hồ sơ võ sĩ. Câu trả lời của bạn vẫn được giữ: hãy thử lại.`,
    unchecked: `Dịch vụ y tế không phản hồi nên chưa kiểm tra được ${record} đã lưu chưa. Câu trả lời của bạn vẫn được giữ. Hãy thử lại: hồ sơ sẽ được kiểm tra trước khi gửi lại.`,
});

const NOT_FOUND_MESSAGES: Record<string, string> = {
    FIGHTER_NOT_FOUND: "Hồ sơ võ sĩ này không còn tồn tại.",
    INJURY_NOT_FOUND: "Hồ sơ chấn thương này không còn tồn tại hoặc thuộc võ sĩ khác.",
    RECOVERY_PLAN_NOT_FOUND: "Kế hoạch phục hồi này không còn tồn tại.",
    MEDICAL_EXAMINATION_NOT_FOUND: "Phiếu khám này không còn tồn tại. Hãy tải lại trang và chọn lại.",
    MEDICAL_CLEARANCE_NOT_FOUND: "Giấy phép này không còn tồn tại.",
    MEDICAL_REVIEW_REQUEST_NOT_FOUND: "Một yêu cầu xem xét không còn tồn tại. Hãy tải lại trang và chọn lại.",
    MEDICAL_REFERENCE_NOT_FOUND: "Dữ liệu liên quan đến thay đổi này không còn tồn tại. Hãy tải lại trang và thử lại.",
};

const CONFLICT_MESSAGES: Record<string, string> = {
    INVALID_INJURY_STATUS_TRANSITION: "Không được đổi trạng thái như vậy. Chấn thương đã khỏi giữ nguyên; tái phát hãy ghi chấn thương mới.",
    INVALID_RECOVERY_PLAN_STATUS_TRANSITION: "Kế hoạch phục hồi đã đóng nên không thể đổi trạng thái.",
    RECOVERY_PLAN_DATE_CONFLICT: "Ngày kết thúc không thể trước ngày bắt đầu kế hoạch.",
    EXAMINATION_NOT_ELIGIBLE_FOR_CLEARANCE:
        "Giấy phép phải được cấp từ phiếu khám đạt hiện hành cùng phạm vi, không bắt đầu sớm hơn phiếu khám và nằm trong giới hạn của nó.",
    EXAMINATION_CORRECTION_CONFLICT: "Chỉ đính chính được phiếu khám hiện hành cùng phạm vi. Có thể đã có phiếu mới hơn; hãy tải lại trang.",
    REVIEW_REQUEST_NOT_RESOLVABLE: "Một yêu cầu xem xét đã đóng hoặc được gửi sau phiếu khám này. Hãy tải lại trang và chọn lại.",
    MEDICAL_CLEARANCE_NOT_ACTIVE: "Giấy phép không còn hiệu lực nên không có gì để thu hồi.",
    MEDICAL_RECORD_CONFLICT: "Đã có hồ sơ trùng — ví dụ giấy phép cùng loại đang hiệu lực từ cùng phiếu khám.",
    MEDICAL_DATA_CONSTRAINT_CONFLICT: "Dịch vụ y tế từ chối thay đổi vì xung đột với hồ sơ hiện có của võ sĩ. Hãy tải lại trang và kiểm tra.",
};

const MEDICAL_ERRORS: ServiceErrorMessages = {
    service: "dịch vụ y tế",
    forbidden: "Dịch vụ y tế từ chối vì bạn không còn phụ trách võ sĩ này. Hãy nhờ quản trị viên kiểm tra phân công.",
    notFound: "Hồ sơ liên quan đến thay đổi này không còn tồn tại. Hãy tải lại trang.",
    codes: { ...NOT_FOUND_MESSAGES, ...CONFLICT_MESSAGES },
};

/** What to show for a failed medical write. Anything that isn't an API error is a bug and is rethrown. */
export function medicalWriteFailure(error: unknown, options: MedicalWriteErrorOptions = {}): MedicalWriteFailure {
    return apiWriteFailure(error, MEDICAL_ERRORS, options);
}
