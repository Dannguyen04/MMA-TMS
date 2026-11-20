import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Platform, Text, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import Animated, { Easing, FadeIn, FadeOutLeft, LinearTransition, useReducedMotion } from "react-native-reanimated";
import { motion } from "@/theme/motion";

/**
 * Redesign motion (step 7, expo-57-ui-motion): peers fade, lists reflow, numbers count, one haptic per action.
 * Everything here collapses to an instant change with reduced motion and never gates interaction.
 */

const easeOut = Easing.bezier(...motion.easeOut);

/** Content that replaces a sibling (in-screen tabs, the selected day's list): a short fade, no slide (peers). */
export function Swap({ swapKey, children, style, testID }: { swapKey: string; children: ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  const reduced = useReducedMotion();
  const entering = reduced || !FadeIn?.duration ? undefined : FadeIn.duration(motion.enter).easing(easeOut);
  return <Animated.View key={swapKey} testID={testID} entering={entering} style={style}>{children}</Animated.View>;
}

/** A list row that leaves to the left when removed, while the rows under it close the gap. */
export function LeavingRow({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  if (reduced || !FadeOutLeft?.duration) return <Animated.View style={style}>{children}</Animated.View>;
  return <Animated.View exiting={FadeOutLeft.duration(motion.base)} layout={LinearTransition.duration(motion.base)} style={style}>{children}</Animated.View>;
}

/** A number that counts from its previous value to the new one (~320 ms ease-out). */
export function CountUp({ value, style, testID }: { value: number; style?: StyleProp<TextStyle>; testID?: string }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    from.current = value;
    if (reduced || start === value || typeof requestAnimationFrame !== "function") { setShown(value); return; }
    const t0 = Date.now(); let raf = 0;
    const tick = () => {
      const k = Math.min(1, (Date.now() - t0) / 320);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(Math.round(start + (value - start) * eased));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reduced]);
  return <Text testID={testID} accessibilityLabel={String(value)} style={style}>{shown}</Text>;
}

/** Selection tick for discrete choices (day picker). Native only, one pulse per change. */
export function selectionHaptic() {
  if (Platform.OS !== "web") void Haptics.selectionAsync?.()?.catch(() => undefined);
}
