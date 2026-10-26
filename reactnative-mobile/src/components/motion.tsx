import * as Haptics from "expo-haptics";
import { Children, useEffect, type ReactNode } from "react";
import {
  Pressable,
  View,
  type DimensionValue,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { motion, radius, useThemePreference } from "@/theme";

/**
 * Primitive chuyển động dùng chung (Phương án B). Mọi hiệu ứng tắt khi bật Giảm chuyển động.
 * Màu lấy từ theme để tôn trọng tùy chỉnh Giao diện.
 */

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Nút có phản hồi co nhẹ (mặc định 0.97) khi chạm. */
export function PressableScale({
  style,
  onPressIn,
  onPressOut,
  scaleTo = 0.97,
  children,
  ...rest
}: Omit<PressableProps, "style" | "children"> & {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  children?: ReactNode;
}) {
  const reduced = useReducedMotion();
  const s = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e: GestureResponderEvent) => {
        if (!reduced) s.value = withTiming(scaleTo, { duration: motion.press });
        onPressIn?.(e);
      }}
      onPressOut={(e: GestureResponderEvent) => {
        if (!reduced) s.value = withTiming(1, { duration: motion.press * 2 });
        onPressOut?.(e);
      }}
      style={[style, reduced ? null : anim]}
    >
      {children}
    </AnimatedPressable>
  );
}

/** Độ trễ stagger cho hàng thứ `index` (chỉ 8 hàng đầu có trễ). */
export function staggerDelay(index: number, step = 35): number {
  return Math.min(Math.max(index, 0), 8) * step;
}

/** Vào màn: fade + trượt lên. `index` → stagger trong danh sách. */
export function FadeInView({
  children,
  index = 0,
  delay,
  style,
}: {
  children: ReactNode;
  index?: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  // FadeInDown có thể không tồn tại trong môi trường mock (jest) → render tĩnh.
  if (reduced || !FadeInDown?.duration) return <View style={style}>{children}</View>;
  return (
    <Animated.View style={style} entering={FadeInDown.duration(motion.enter).delay(delay ?? staggerDelay(index))}>
      {children}
    </Animated.View>
  );
}

/** Bọc từng con bằng FadeInView có stagger. */
export function StaggerList({
  children,
  gap,
  style,
}: {
  children: ReactNode;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const items = Children.toArray(children);
  return (
    <View style={[gap != null ? { gap } : null, style]}>
      {items.map((child, i) => (
        <FadeInView key={i} index={i}>
          {child}
        </FadeInView>
      ))}
    </View>
  );
}

/** Khối skeleton: nền `skeletonBase` (mặc định `surfaceMuted`), vệt sáng `skeletonHighlight` nhấp nháy lên trên. */
export function Skeleton({
  height = 16,
  width = "100%",
  round = false,
  style,
}: {
  height?: number;
  width?: DimensionValue;
  round?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useThemePreference();
  const reduced = useReducedMotion();
  const o = useSharedValue(1);
  useEffect(() => {
    if (reduced) return;
    o.value = withRepeat(withTiming(0.45, { duration: 700, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [o, reduced]);
  const anim = useAnimatedStyle(() => ({ opacity: 1 - o.value }));
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          height,
          width: round ? height : width,
          borderRadius: round ? radius.pill : radius.field,
          backgroundColor: colors.skeletonBase ?? colors.surfaceMuted,
          overflow: "hidden",
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.skeletonHighlight ?? colors.bg },
          reduced ? { opacity: 0.3 } : anim,
        ]}
      />
    </View>
  );
}

/** Danh sách skeleton dạng thẻ (đang tải). */
export function SkeletonList({ rows = 3, height = 64 }: { rows?: number; height?: number }) {
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Đang tải" style={{ gap: 12 }}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height={height} />
      ))}
    </View>
  );
}

/** Haptic chỉ dùng cho lưu / thành công (quyết định Phương án B). */
export function hapticSuccess() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}
