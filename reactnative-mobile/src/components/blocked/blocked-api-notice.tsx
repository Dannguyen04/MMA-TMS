import { FeatureUnavailable } from "@/components/feedback/feature-unavailable";

/** @deprecated Dùng `FeatureUnavailable`. Giữ lại để màn cũ hiển thị cùng một empty state. */
export function BlockedApiNotice({ extra }: { extra?: string }) {
  return <FeatureUnavailable description={extra} />;
}
