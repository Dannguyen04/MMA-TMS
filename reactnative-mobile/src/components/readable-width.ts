import { useWindowDimensions, type ViewStyle } from "react-native";

/** Bề rộng tối đa của cột nội dung trên tablet (iPad dọc ~820px). */
export const READABLE_MAX_WIDTH = 640;

/**
 * Trên màn rộng (tablet), giới hạn cột nội dung và căn giữa để không kéo giãn hết chiều ngang.
 * Điện thoại: trả `null` (không đổi layout). Dùng cho `contentContainerStyle` của ScrollView.
 */
export function useReadableWidth(): ViewStyle | null {
  const { width } = useWindowDimensions();
  if (width < READABLE_MAX_WIDTH + 80) return null;
  return { width: "100%", maxWidth: READABLE_MAX_WIDTH, alignSelf: "center" };
}
