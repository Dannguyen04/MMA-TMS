/** T-038 B2: lời dặn AI trên màn ghi hiệp. Trạng thái và lỗi lấy từ backend-codes.ts, không hiện mã. */
export const roundAi = {
  ask: "AI dặn",
  askHint: (n: number) => `AI gợi ý tối đa 3 lời dặn cho hiệp ${n}, chờ tối đa 12 giây. Không có AI vẫn lưu hiệp được.`,
  loading: "AI đang soạn lời dặn…",
  heading: "Lời dặn của AI",
  hidden: (n: number) => `Đã ẩn ${n} lời dặn AI dài hơn 140 ký tự.`,
  stay: (n: number) => `Chọn lời dặn AI rồi bấm "Lưu lại hiệp ${n}", hoặc chuyển sang hiệp ${n + 1} ở thanh chọn hiệp.`,
  /** Demo mode only: fake sample lines, never sent to the server. */
  sampleLines: [
    "Giữ tay trước cao khi lùi về góc",
    "Đánh vào thân trước rồi mới lên đầu",
    "Kết thúc chuỗi đòn bằng bước sang trái",
  ],
};
