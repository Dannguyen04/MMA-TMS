/** Chuỗi dùng chung cho trạng thái "chưa khả dụng" (màn chưa có API backend). */
export const unavailable = {
  title: "Tính năng này chưa khả dụng",
  body: "Chúng tôi đang hoàn thiện tính năng này. Bạn vui lòng quay lại sau.",
  goals: "Mục tiêu tập luyện sẽ hiển thị tại đây khi tính năng sẵn sàng.",
  performance: "Hiệu suất và kỹ thuật sẽ được tổng hợp tại đây khi tính năng sẵn sàng.",
  live: "Kiểm tra động tác trực tiếp bằng camera sẽ có trong bản cập nhật sau.",
} as const;

/** Chuỗi cho các khối trạng thái có minh họa (StateView). */
export const states = {
  loadFailed: "Không tải được dữ liệu",
  analyzingTitle: "AI đang phân tích video",
  analyzingBody: "Kết quả sẽ hiện tại đây khi phân tích xong. Bạn có thể rời màn này.",
  retry: "Thử lại",
} as const;
