import type { BoutState, RequirementKind, RequirementStatus, WeightTrackStatus } from "@/api/bouts";

export const fighterBout = {
  title: "Trận của tôi",
  weighInTitle: "Ghi cân",
  pickBout: "Chọn trận",
  weighInAt: "Giờ cân",
  fightAt: "Thi đấu",
  venue: "Địa điểm",
  weighInIn: (days: number) =>
    days > 1 ? `Còn ${days} ngày đến buổi cân` : days === 1 ? "Ngày mai cân chính thức" : days === 0 ? "Hôm nay cân chính thức" : "Đã qua giờ cân",
  state: {
    SCHEDULED: "Đã xếp lịch",
    CAMP: "Đang tập trại",
    FIGHT_WEEK: "Tuần thi đấu",
    WEIGHED_IN: "Đã cân xong",
    COMPLETED: "Đã thi đấu",
    CANCELLED: "Đã hủy",
  } satisfies Record<BoutState, string>,
  weight: {
    cardTitle: "Cân nặng",
    homeTitle: "Cân nặng trận sắp tới",
    limit: "Giới hạn",
    weighedOn: (date: string) => `Cân ngày ${date}`,
    latest: "Lần cân gần nhất",
    none: "Chưa có số cân",
    noneDetail: "Ghi cân đầu tiên để theo dõi tiến độ.",
    remaining: (kg: string, pct: string) => `Còn ${kg} kg (${pct}%) để chạm giới hạn`,
    reached: "Đã chạm giới hạn cân",
    limitLine: (kg: string) => `Giới hạn ${kg}`,
    legendActual: "Cân thực tế",
    legendPlan: "Lộ trình dự kiến",
    record: "Ghi cân",
    recordToday: "Ghi cân hôm nay",
    openBout: "Xem trận",
    /**
     * Không có tên hạng: một dòng "Vượt X kg so với giới hạn Y kg".
     * Có tên hạng: dòng 1 "Vượt X kg so với hạng [tên]", dòng 2 "Giới hạn Y kg".
     */
    overLines: (kg: string, limit: string, className?: string | null): { title: string; detail: string | null } =>
      className?.trim()
        ? { title: `Vượt ${kg} kg so với hạng ${className.trim()}`, detail: `Giới hạn ${limit} kg` }
        : { title: `Vượt ${kg} kg so với giới hạn ${limit} kg`, detail: null },
    guide: "Cách giảm cân an toàn",
  },
  status: {
    NEUTRAL: "Đã qua cân chính thức",
    GREEN: "Đúng tiến độ",
    YELLOW: "Hơi chậm",
    RED: "Cần giảm thêm",
    GREY: "Chưa có số cân",
  } satisfies Record<WeightTrackStatus, string>,
  requirements: {
    title: "Việc cần xong cho trận",
    kind: {
      MEDICAL_CLEARANCE: "Giấy phép y tế",
      BLOOD_TEST: "Xét nghiệm máu",
      SIGNED_CONTRACT: "Hợp đồng đã ký",
      WEIGH_IN: "Cân chính thức",
    } satisfies Record<RequirementKind, string>,
    status: {
      MISSING: "Chưa có",
      PROVIDED: "Đã gửi",
      REJECTED: "Bị từ chối",
      CONFIRMED: "Đã xác nhận",
    } satisfies Record<RequirementStatus, string>,
  },
  empty: {
    title: "Chưa có trận nào",
    description: "Khi huấn luyện viên xếp lịch, trận của bạn sẽ hiện ở đây.",
    action: "Về trang chủ",
  },
  offline: {
    title: "Không có kết nối",
    description: "Kiểm tra Wi-Fi hoặc dữ liệu di động rồi thử lại.",
    withData: "Đang hiện dữ liệu đã tải lần trước. Kiểm tra mạng rồi thử lại.",
    retry: "Thử lại",
  },
  guide: {
    title: "Cách giảm cân an toàn",
    items: [
      "Uống đủ nước và không nhịn ăn đột ngột",
      "Giảm dần theo từng ngày, tránh cắt nước sát giờ cân",
      "Trao đổi với huấn luyện viên hoặc bác sĩ trước khi giảm thêm",
    ],
    closing: "Nếu thấy chóng mặt hoặc mệt, hãy dừng và báo ngay cho bác sĩ",
  },
  loadFailed: "Không tải được trận đấu",
  weigh: {
    inputLabel: "Cân nặng hôm nay",
    placeholder: "Ví dụ 66,5",
    unit: "kg",
    save: "Lưu cân nặng",
    saving: "Đang lưu…",
    forBout: (opponent: string) => `Trận gặp ${opponent}`,
    limitHint: (kg: string) => `Giới hạn ${kg} kg`,
    lastTime: (kg: string, when: string) => `Lần trước ${kg} kg, ${when}`,
    saved: (kg: string) => `Đã lưu ${kg} kg`,
    errorEmpty: "Hãy nhập cân nặng của bạn.",
    errorFormat: "Chỉ nhập số, ví dụ 66,5.",
    errorRange: "Cân nặng phải từ 30 đến 200 kg.",
    forbidden: "Tài khoản chưa được phép ghi cân. Hãy báo huấn luyện viên.",
    failed: "Chưa lưu được cân nặng. Thử lại sau.",
    network: "Không kết nối được. Kiểm tra Wi-Fi rồi thử lại.",
  },
} as const;
