/** Chuỗi cho bộ lọc dạng bottom sheet dùng chung. */
export const filterText = {
  trigger: "Lọc",
  all: "Tất cả",
  clear: "Xoá lọc",
  apply: "Áp dụng",
  close: "Đóng",
  backdrop: "Đóng bộ lọc",
  handle: "Kéo xuống để đóng",
  selectedCount: (n: number) => `Đã chọn ${n}`,
  triggerA11y: (label: string, current: string) => `${label}: ${current}. Mở bộ lọc`,
} as const;
