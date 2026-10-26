import { useEffect } from "react";
import { StyleSheet, type ColorValue } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Icon, type IconName } from "@/components/icon";
import { useThemePreference } from "@/theme";
import { paletteFromTokens } from "@/screens/fighter/redesign/palette";

/**
 * Icon tab theo Figma: tab đang chọn có pill nền accent nhạt phía sau icon.
 * Pill hiện bằng fade + scale (tắt khi bật Giảm chuyển động).
 */
export function TabIcon({
  name,
  focused,
  color,
  pillColor,
}: {
  name: IconName;
  focused: boolean;
  color: ColorValue;
  pillColor?: string;
}) {
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
  return (
    <Animated.View style={styles.wrap}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.pill,
          { backgroundColor: pillColor ?? paletteFromTokens(colors).accentSoft },
          pill,
        ]}
      />
      <Icon name={name} size={20} color={color} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 48, height: 28, alignItems: "center", justifyContent: "center" },
  pill: { borderRadius: 9999 },
});
