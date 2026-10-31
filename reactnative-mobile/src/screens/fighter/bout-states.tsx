import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type TextStyle } from "react-native";

import { Icon, type IconName } from "@/components/icon";
import { Skeleton } from "@/components/motion";
import { fighter } from "@/i18n/fighter";
import { fighterBout as t } from "@/i18n/fighter-bout";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";

/**
 * Thước đo chung cho Trận của tôi / Ghi cân / thẻ cân nặng trang chủ (Designer FINAL).
 * Khoảng cách là bội của 8: lề màn hình 16, giữa thẻ 16, trong thẻ 16, giữa nhóm 24.
 */
export const SPEC = {
  margin: 16,
  card: 16,
  gap: 16,
  group: 24,
  radius: 12,
  button: 48,
  disabledOpacity: 0.38,
  /** Chờ quá 1 giây mới hiện skeleton. */
  skeletonDelayMs: 1000,
} as const;

/** Cỡ chữ / chiều cao dòng. */
export const TEXT = {
  screenTitle: { fontSize: 24, lineHeight: 32, fontWeight: "700" },
  cardTitle: { fontSize: 18, lineHeight: 24, fontWeight: "700" },
  body: { fontSize: 16, lineHeight: 24, fontWeight: "400" },
  bodyBold: { fontSize: 16, lineHeight: 24, fontWeight: "700" },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "400" },
  captionBold: { fontSize: 12, lineHeight: 16, fontWeight: "700" },
  bigNumber: { fontSize: 40, lineHeight: 48, fontWeight: "700", fontVariant: ["tabular-nums"] },
  kg: { fontSize: 16, lineHeight: 24, fontWeight: "400" },
  detail: { fontSize: 14, lineHeight: 20, fontWeight: "400" },
} satisfies Record<string, TextStyle>;

/** `true` khi `on` kéo dài quá `ms` (mặc định 1 giây). */
export function useDelayedFlag(on: boolean, ms: number = SPEC.skeletonDelayMs): boolean {
  const [late, setLate] = useState(false);
  useEffect(() => {
    if (!on) {
      setLate(false);
      return;
    }
    const id = setTimeout(() => setLate(true), ms);
    return () => clearTimeout(id);
  }, [on, ms]);
  return on && late;
}

/** Skeleton đúng kích thước thẻ thật. */
export function CardSkeleton({ height }: { height: number }) {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Đang tải" style={{ alignSelf: "stretch" }}>
      <Skeleton height={height} />
    </View>
  );
}

/** Nút ≥ 48dp, bo 12, vòng focus 2px, mờ 38% khi vô hiệu, spinner + khóa khi đang gửi. */
export function ActionButton({
  label,
  onPress,
  icon,
  variant = "primary",
  loading = false,
  loadingLabel,
  disabled = false,
  fullWidth = true,
  flex = false,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  variant?: "primary" | "secondary";
  loading?: boolean;
  loadingLabel?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  flex?: boolean;
}) {
  const colors = useFighterPalette();
  const [focused, setFocused] = useState(false);
  const primary = variant === "primary";
  const fg = primary ? colors.onAccent : colors.ink;
  const locked = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={loading && loadingLabel ? loadingLabel : label}
      accessibilityState={{ disabled: locked, busy: loading }}
      disabled={locked}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        styles.button,
        fullWidth && !flex && { alignSelf: "stretch" },
        flex && { flex: 1 },
        primary
          ? { backgroundColor: colors.accent }
          : { backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.ring },
        disabled && !loading && { opacity: SPEC.disabledOpacity },
        focused && { outlineWidth: 2, outlineStyle: "solid", outlineColor: colors.ring, outlineOffset: 2 } as object,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={fg} /> : icon ? <Icon name={icon} size={24} color={fg} /> : null}
      <Text style={[TEXT.bodyBold, styles.buttonText, { color: fg }]}>{loading && loadingLabel ? loadingLabel : label}</Text>
    </Pressable>
  );
}

/** Dòng vượt cân: 1 dòng (không có tên hạng) hoặc 2 dòng (tên hạng + giới hạn), cùng một màu. */
export function OverWeightText({
  over,
  limitKg,
  className,
  color,
}: {
  over: string;
  limitKg: string;
  className?: string | null;
  color: string;
}) {
  const lines = t.weight.overLines(over, limitKg, className);
  return (
    <View style={styles.flex}>
      <Text style={[TEXT.bodyBold, { color }]}>{lines.title}</Text>
      {lines.detail ? <Text style={[TEXT.detail, { color }]}>{lines.detail}</Text> : null}
    </View>
  );
}

/** Thẻ có viền + biểu tượng + chữ (không chỉ màu). */
export function MessageCard({
  icon,
  tone = "neutral",
  title,
  description,
  children,
}: {
  icon: IconName;
  tone?: "neutral" | "error";
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  const colors = useFighterPalette();
  const error = tone === "error";
  return (
    <View
      accessibilityRole={error ? "alert" : undefined}
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: error ? colors.danger : colors.line, borderWidth: error ? 2 : 1 },
      ]}
    >
      <View style={styles.cardHead}>
        <Icon name={icon} size={24} color={error ? colors.danger : colors.link} />
        <Text accessibilityRole="header" style={[TEXT.cardTitle, styles.flex, { color: colors.ink }]}>
          {title}
        </Text>
      </View>
      {description ? <Text style={[TEXT.body, { color: colors.ink }]}>{description}</Text> : null}
      {children}
    </View>
  );
}

/** Lỗi tải: mất mạng → "Không có kết nối"; lỗi khác → tiêu đề chung + câu giải thích dễ hiểu. Dữ liệu cũ (nếu có) vẫn hiện bên dưới. */
export function ConnectionBanner({
  error,
  onRetry,
  retrying,
  hasData,
}: {
  error: string;
  onRetry: () => void;
  retrying: boolean;
  hasData: boolean;
}) {
  const offline = error === fighter.common.network;
  return (
    <MessageCard
      icon={offline ? "offline" : "alertCircle"}
      tone="error"
      title={offline ? t.offline.title : t.loadFailed}
      description={offline ? (hasData ? t.offline.withData : t.offline.description) : error}
    >
      <ActionButton label={t.offline.retry} icon="retry" variant="secondary" loading={retrying} onPress={onRetry} />
    </MessageCard>
  );
}

/** Chưa có trận: biểu tượng + tiêu đề + 1 dòng mô tả + 1 nút chính. */
export function EmptyBouts({ onAction }: { onAction: () => void }) {
  return (
    <MessageCard icon="martialArts" title={t.empty.title} description={t.empty.description}>
      <ActionButton label={t.empty.action} onPress={onAction} />
    </MessageCard>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  button: {
    minHeight: SPEC.button,
    minWidth: SPEC.button,
    borderRadius: SPEC.radius,
    paddingHorizontal: SPEC.card,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buttonText: { textAlign: "center" },
  card: { borderRadius: SPEC.radius, padding: SPEC.card, gap: SPEC.gap, alignSelf: "stretch" },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 8 },
});
