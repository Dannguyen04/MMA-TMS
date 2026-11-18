/** Fighter Tôi, redesign step 11 (2026-11-12). One sentence per line, rows never wrap. */
export const fighterMe = {
  title: "Tôi",
  openProfile: (name: string) => `${name}. Mở hồ sơ của tôi`,
  stats: { weight: "Hạng cân", stance: "Thế đứng", height: "Chiều cao", reach: "Sải tay" },
  /** Step 14: the stat box is narrow, so the stance is one short word. */
  stanceShort: { ORTHODOX: "Phải", SOUTHPAW: "Trái", SWITCH: "Đổi thế" } as Record<string, string>,
  statA11y: (label: string, value: string) => `${label}: ${value}`,
  none: "chưa có",
  failed: "Không tải được hồ sơ",
  retry: "Thử lại",
  doctor: {
    since: (dm: string) => `Bác sĩ phụ trách · từ ${dm}`,
    none: "Chưa có bác sĩ phụ trách",
    failed: "Không tải được bác sĩ",
    fallback: "Bác sĩ",
  },
  rows: { bouts: "Trận", admission: "Hồ sơ nhập học", video: "Video", appearance: "Giao diện", settings: "Cài đặt", logout: "Đăng xuất" },
  logout: { title: "Đăng xuất khỏi tài khoản?", confirm: "Đăng xuất", cancel: "Hủy" },
  profile: {
    title: "Hồ sơ của tôi",
    last: "Họ",
    first: "Tên",
    born: "Ngày sinh",
    nationality: "Quốc tịch",
    email: "Email",
    bio: "Giới thiệu",
  },
  settings: {
    title: "Cài đặt",
    notifications: "Thông báo",
    notificationsLine: "Chưa có trên điện thoại này",
    appearanceLine: (mode: string, pct: number) => `Giao diện: ${mode}, chữ ${pct}%`,
    version: "Phiên bản",
  },
} as const;
