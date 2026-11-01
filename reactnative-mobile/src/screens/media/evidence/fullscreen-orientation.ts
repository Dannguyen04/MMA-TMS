/**
 * Một chỗ duy nhất quyết định xoay màn khi phóng to video.
 * Hiện dự án CHƯA có `expo-screen-orientation`, nên chế độ toàn màn hình giữ máy dọc:
 * video ngang vẫn đúng tỉ lệ (contain) ở giữa màn. Khi cài thư viện, chỉ cần sửa hai hàm dưới
 * (ví dụ `ScreenOrientation.lockAsync(LANDSCAPE)` khi `aspect > 1`, rồi `unlockAsync()` khi thoát).
 */
export const CAN_ROTATE = false;

export async function enterFullscreenOrientation(_aspect: number): Promise<void> {
  // Chưa hỗ trợ xoay: không làm gì.
}

export async function exitFullscreenOrientation(): Promise<void> {
  // Chưa hỗ trợ xoay: không làm gì.
}
