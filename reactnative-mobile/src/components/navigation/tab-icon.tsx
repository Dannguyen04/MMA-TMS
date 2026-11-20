import { useContext, useEffect } from "react";
import { StyleSheet, type ColorValue } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Icon, type IconName } from "@/components/icon";
import { SOLID_TAB_RED, TabMarkerContext } from "./tab-marker";
import { useThemePreference } from "@/theme/index";

export { SOLID_TAB_RED };

/**
 * Tab icon. Inside a bar that draws the sliding marker (redesign step 15, every role) it draws no pill:
 * the bar's one red marker sits behind it and the active icon turns white.
 * Outside such a bar it keeps its own pill (solid red, or a lotus underline), faded in place.
 */
export function TabIcon({
  name,
  focused,
  color,
  solid = false,
}: {
  name: IconName;
  focused: boolean;
  color: ColorValue;
  /** Kept for callers; the sliding marker replaced the pill colour. */
  pillColor?: string;
  /** Active tab as a solid Ring Red pill with a white icon (coach bar, owner request 2026-11-11). */
  solid?: boolean;
}) {
  const marked = useContext(TabMarkerContext);
  const { colors } = useThemePreference();
  const reduced = useReducedMotion();
  const p = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    p.value = reduced ? (focused ? 1 : 0) : withTiming(focused ? 1 : 0, { duration: 180 });
  }, [focused, p, reduced]);
  const pill = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ scaleX: 0.6 + 0.4 * p.value }],
  }));
  const white = focused && (marked || solid);
  return (
    <Animated.View style={styles.wrap}>
      {marked ? null : <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.pill,
          solid
            ? { backgroundColor: SOLID_TAB_RED, left: -4, right: -4, borderRadius: 14 }
            : { backgroundColor: colors.lotus, height: 2, top: undefined, bottom: 0, left: 14, right: 14, borderRadius: 0 },
          pill,
        ]}
      />}
      <Icon name={name} size={20} color={white ? "#FFFFFF" : color} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 48, height: 28, alignItems: "center", justifyContent: "center" },
  pill: { borderRadius: 9999 },
});
