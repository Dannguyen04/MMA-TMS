import { StateView } from "@/components/state-view";
import { unavailable } from "@/i18n/unavailable";

/**
 * Empty state dùng chung cho màn chưa có API backend.
 * Luôn hiển thị đúng chuỗi "Tính năng này chưa khả dụng"; minh họa Lottie tô màu theo theme.
 */
export function FeatureUnavailable({
  description,
  compact = false,
}: {
  /** Mô tả ngắn thêm (tùy chọn). Mặc định dùng câu chung. */
  description?: string;
  /** Giữ để tương thích chữ ký cũ; minh họa nay là Lottie chung. */
  icon?: string;
  compact?: boolean;
}) {
  return (
    <StateView kind="unavailable" title={unavailable.title} description={description ?? unavailable.body} compact={compact} />
  );
}
