import LottieView, { type AnimationObject } from "lottie-react-native";
import { useMemo } from "react";
import { View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

import { IconBadge, type IconName } from "@/components/icon";
import { useThemePreference } from "@/theme";

import analyzing from "../../assets/lottie/analyzing.json";
import empty from "../../assets/lottie/empty.json";
import error from "../../assets/lottie/error.json";
import success from "../../assets/lottie/success.json";

/**
 * Minh họa Lottie cho trạng thái (Phương án B). Nguồn & giấy phép: assets/lottie/LICENSES.md.
 * Màu được tô lại lúc chạy (colorFilters) theo token theme → theo tùy chỉnh Giao diện.
 * Giảm chuyển động → icon tĩnh. Web dùng state-illustration.web.tsx (không Lottie).
 */
export type StateKind = "success" | "empty" | "error" | "analyzing" | "unavailable";

type LottieJson = AnimationObject & { layers: { nm?: string }[] };

const SOURCES = {
  success,
  empty,
  error,
  analyzing,
  unavailable: empty,
} as unknown as Record<StateKind, LottieJson>;

const FALLBACK_ICON: Record<StateKind, IconName> = {
  success: "success",
  empty: "empty",
  error: "warning",
  analyzing: "aiAlert",
  unavailable: "empty",
};

/** Lặp: chỉ "đang phân tích" lặp; còn lại chạy một lần. */
const LOOP: Record<StateKind, boolean> = {
  success: false,
  empty: false,
  error: false,
  analyzing: true,
  unavailable: false,
};

export function StateIllustration({ kind, size = 96 }: { kind: StateKind; size?: number }) {
  const { colors } = useThemePreference();
  const reduced = useReducedMotion();
  const tone =
    kind === "success" ? colors.success : kind === "error" ? colors.danger : colors.lotus;
  const source = SOURCES[kind];
  const colorFilters = useMemo(
    () =>
      source.layers
        .map((l) => l.nm)
        .filter((nm): nm is string => Boolean(nm))
        .map((keypath) => ({ keypath, color: tone })),
    [source, tone],
  );

  if (reduced) {
    return (
      <IconBadge
        name={FALLBACK_ICON[kind]}
        size={Math.round(size / 3.2)}
        tone={kind === "success" ? "success" : kind === "error" ? "danger" : "accent"}
      />
    );
  }
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size }}>
      <LottieView
        source={source}
        autoPlay
        loop={LOOP[kind]}
        colorFilters={colorFilters}
        style={{ width: size, height: size }}
      />
    </View>
  );
}
