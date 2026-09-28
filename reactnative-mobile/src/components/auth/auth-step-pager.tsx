import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { spacing } from "@/theme";

type AuthStepPagerProps = {
  step: 1 | 2;
  direction: 1 | -1;
  children: ReactNode;
  /** Ignored. Swipe on this card stole Android TextInput presses. */
  swipeEnabled?: boolean;
  onSwipe?: (next: 1 | 2 | 3) => void;
};

const ACTIVE_OFFSET_X = 16;
const FAIL_OFFSET_Y = 12;

/** Kept for tests. The pager never claims the responder — form taps win. */
export function shouldClaimAuthSwipe(enabled: boolean, dx: number, dy: number) {
  return enabled && Math.abs(dx) >= ACTIVE_OFFSET_X && Math.abs(dy) < FAIL_OFFSET_Y;
}

export function AuthStepPager({ step, children }: AuthStepPagerProps) {
  return (
    <View style={styles.host} testID="auth-step-pager" pointerEvents="box-none">
      <View key={step} collapsable={false} style={styles.pane} pointerEvents="auto">
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    width: "100%",
    overflow: "hidden",
  },
  pane: {
    width: "100%",
    gap: spacing.fieldGap,
  },
});
