import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet } from "react-native";

import { vi } from "@/i18n/vi";
import {
  radius,
  useThemePreference,
  type ThemePreference,
} from "@/theme";

const OPTIONS: {
  value: ThemePreference;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}[] = [
  { value: "light", icon: "white-balance-sunny" },
  { value: "dark", icon: "moon-waning-crescent" },
  { value: "system", icon: "cellphone" },
];

function nextPreference(current: ThemePreference): ThemePreference {
  if (current === "light") return "dark";
  if (current === "dark") return "system";
  return "light";
}

function nextThemeLabel(current: ThemePreference): string {
  const next = nextPreference(current);
  if (next === "light") return vi.a11y.themeNextLight;
  if (next === "dark") return vi.a11y.themeNextDark;
  return vi.a11y.themeNextSystem;
}

export function ThemeToggle() {
  const { preference, setPreference, colors } = useThemePreference();
  const current = OPTIONS.find((option) => option.value === preference) ?? OPTIONS[2];

  const onCycle = () => {
    const next = nextPreference(preference);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPreference(next);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={nextThemeLabel(preference)}
      hitSlop={4}
      onPress={onCycle}
      style={[
        styles.hit,
        {
          backgroundColor: colors.surfaceMuted,
          borderColor: colors.ring,
        },
      ]}
    >
      <MaterialCommunityIcons name={current.icon} size={20} color={colors.lotus} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.field,
    borderCurve: "continuous",
    borderWidth: 1,
  },
});
