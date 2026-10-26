import { MotiView } from "moti";
import { View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

import { cx, uiMotion } from "./tokens";

export type SkeletonProps = {
  /** Size/shape classes, e.g. "h-lg w-full" or "h-avatar-md w-avatar-md rounded-full". */
  className?: string;
};

/** Opacity-only pulse. With reduced motion it renders a static block at full opacity. */
export function Skeleton({ className }: SkeletonProps) {
  const reduced = useReducedMotion();
  const block = <View className={cx("h-lg w-full rounded-control bg-surface-elevated", className)} />;

  if (reduced) {
    return (
      <View accessibilityLabel="Loading" accessibilityRole="progressbar">
        {block}
      </View>
    );
  }

  return (
    <MotiView
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
      from={{ opacity: 0.45 }}
      animate={{ opacity: 1 }}
      transition={{ type: "timing", duration: uiMotion.pulseMs, loop: true }}
    >
      {block}
    </MotiView>
  );
}
