/**
 * A-4 "Bác sĩ phụ trách" phụ thuộc endpoint doctor-assignment đang ĐÓNG BĂNG:
 *   GET /fighters/:id/doctors  (fighter.doctor:read)
 * Nếu bị cắt phạm vi, đặt hằng này = false: ẩn dòng liên kết trong hồ sơ võ sĩ (Admin) và
 * đường dẫn vo-si/bac-si tự quay về danh sách võ sĩ. Không cần sửa chỗ nào khác.
 */
export const ADMIN_FIGHTER_DOCTORS_ENABLED = true;
