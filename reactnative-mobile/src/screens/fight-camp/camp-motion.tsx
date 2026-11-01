import type { ReactNode } from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import Animated, { cubicBezier, Easing, FadeIn, FadeInDown, FadeOut, LinearTransition, useReducedMotion } from "react-native-reanimated";
import { motion } from "@/theme";

const easeOut = Easing.bezier(...motion.easeOut);
const transitionEase = cubicBezier(...motion.easeOut);

/** Mount only for a new screen/round or disclosure, never on a field edit. */
export function CampReveal({ children, style, disclosure = false }: { children: ReactNode; style?: StyleProp<ViewStyle>; disclosure?: boolean }) {
  const reduced = useReducedMotion();
  return <Animated.View
    entering={(reduced ? FadeIn : FadeInDown).duration(reduced ? motion.press : motion.enter).easing(easeOut)}
    exiting={disclosure ? FadeOut.duration(motion.press) : undefined}
    layout={disclosure && !reduced ? LinearTransition.duration(motion.base).easing(easeOut) : undefined}
    style={style}>{children}</Animated.View>;
}

/** Decorative only: the input/label and its hit area never move or resize. */
export function CampSelection({ selected, children }: { selected: boolean; children: ReactNode }) {
  const reduced = useReducedMotion();
  return <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={[StyleSheet.absoluteFill, { pointerEvents: "none", opacity: selected ? 1 : 0,
      transform: [{ scaleX: selected || reduced ? 1 : 0.96 }],
      transitionProperty: ["opacity", "transform"], transitionDuration: reduced ? 0 : motion.selection, transitionTimingFunction: transitionEase }]}>
    {children}
  </Animated.View>;
}
