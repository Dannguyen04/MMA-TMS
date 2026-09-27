import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { radius, spacing, useThemePreference } from "@/theme";

function Bone({
  width,
  height,
  delay = 0,
  color,
}: {
  width: number | `${number}%`;
  height: number;
  delay?: number;
  color: string;
}) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    const timeout = setTimeout(() => {
      pulse.value = withRepeat(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      );
    }, delay);
    return () => clearTimeout(timeout);
  }, [delay, pulse]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.38, 0.82]),
  }));

  return (
    <Animated.View
      style={[
        style,
        {
          width,
          height,
          borderRadius: radius.field,
          backgroundColor: color,
        },
      ]}
    />
  );
}

/** Post-live placeholder only. Not the splash leave / shard-hole reveal. */
export function DashboardSkeleton() {
  const { colors } = useThemePreference();

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.wrap, { backgroundColor: colors.bg }]}>
      <Bone width={160} height={22} color={colors.surfaceMuted} />
      <Bone width="100%" height={92} delay={80} color={colors.surfaceMuted} />
      <Bone width="100%" height={92} delay={140} color={colors.surfaceMuted} />
      <Bone width="100%" height={92} delay={200} color={colors.surfaceMuted} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.screenX,
    paddingTop: 72,
    gap: spacing.lg,
  },
});
