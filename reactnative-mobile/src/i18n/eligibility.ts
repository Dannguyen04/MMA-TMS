/** Chuỗi cho ô "Điều kiện tham gia" và sheet giải thích (vai trò Bác sĩ, batch 7). */
export const eligibilityText = {
  chip: {
    eligible: "Đủ",
    restricted: "Đủ có giới hạn",
    notEligible: "Chưa đủ",
  },
  headline: {
    eligible: (scope: string) => `${scope}: đủ điều kiện`,
    restricted: (scope: string) => `${scope}: đủ điều kiện, có giới hạn`,
    notEligible: (scope: string) => `${scope}: chưa đủ điều kiện`,
  },
  basis: "Căn cứ",
  conclusion: "Kết luận hiện hành",
  examinedAt: "Ngày khám",
  conclusionValidUntil: "Kết luận hiệu lực đến",
  clearance: "Giấy phép",
  clearanceValidUntil: "Giấy phép hiệu lực đến",
  noConclusion: "Chưa có kết luận khám cho phạm vi này.",
  noClearance: "Chưa có giấy phép cấp từ kết luận hiện hành.",
  noExpiry: "Không ghi thời hạn",
  reasonsTitle: "Lý do chưa đủ",
  restrictionsTitle: "Giới hạn đang áp dụng",
  openSheet: (scope: string) => `Xem căn cứ điều kiện ${scope.toLocaleLowerCase("vi-VN")}`,
  /** Ánh xạ mã lý do của máy chủ (MEDICAL_ELIGIBILITY_REASON) — không in mã thô. */
  reason: {
    EXAMINATION_REQUIRED: "Chưa có kết luận khám tập luyện hiện hành (cần khám baseline).",
    REVIEW_REQUEST_PENDING: "Còn yêu cầu khám lại chưa được xử lý.",
    EXAMINATION_NOT_ELIGIBLE: "Kết luận khám hiện hành: chưa đủ điều kiện.",
    CLEARANCE_REQUIRED: "Chưa có giấy phép từ kết luận hiện hành, hoặc giấy phép đã bị thu hồi / chưa đến ngày hiệu lực.",
    CLEARANCE_EXPIRED: "Giấy phép đã hết hạn — cần đánh giá lại trước khi cấp mới.",
    SESSION_TYPE_RESTRICTED: "Loại buổi tập nằm ngoài phạm vi giấy phép.",
  } as Record<string, string>,
  unknownReason: "Máy chủ không gửi lý do cụ thể — không coi là đủ điều kiện.",
  actions: {
    openConclusion: "Mở kết luận khám",
    openExams: "Mở danh sách kết luận",
    openClearance: "Mở giấy phép y tế",
    openRequests: "Xem yêu cầu khám",
    openInjuries: "Xem chấn thương",
  },
} as const;
