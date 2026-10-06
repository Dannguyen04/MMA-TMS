import { MotiView } from "moti";
import { useCallback, useState, type ReactNode } from "react";
import { View, type GestureResponderEvent, type StyleProp, type ViewStyle } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

import { uiMotion } from "./tokens";

/** Scale-on-press wrapper. With reduced motion it renders a static View at rest. */
export function PressScale({
  pressed,
  children,
  style,
}: {
  pressed: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  if (reduced) {
    return <View style={style}>{children}</View>;
  }
  return (
    <MotiView
      style={style}
      animate={{ scale: pressed ? uiMotion.pressScale : 1 }}
      transition={{ type: "timing", duration: uiMotion.pressMs }}
    >
      {children}
    </MotiView>
  );
}

export function usePressState(
  onPressIn?: (e: GestureResponderEvent) => void,
  onPressOut?: (e: GestureResponderEvent) => void,
) {
  const [pressed, setPressed] = useState(false);
  const handlePressIn = useCallback(
    (e: GestureResponderEvent) => {
      setPressed(true);
      onPressIn?.(e);
    },
    [onPressIn],
  );
  const handlePressOut = useCallback(
    (e: GestureResponderEvent) => {
      setPressed(false);
      onPressOut?.(e);
    },
    [onPressOut],
  );
  return { pressed, onPressIn: handlePressIn, onPressOut: handlePressOut };
}

/** Entrance: fade + translateY 8→0. With reduced motion it renders the resting state immediately. */
export function FadeIn({
  children,
  delay = 0,
  style,
}: {
  children: ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  if (reduced) {
    return <View style={style}>{children}</View>;
  }
  return (
    <MotiView
      style={style}
      from={{ opacity: 0, translateY: uiMotion.enterOffsetY }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: uiMotion.enterMs, delay }}
    >
      {children}
    </MotiView>
  );
}
