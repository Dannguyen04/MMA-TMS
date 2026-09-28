import { StyleSheet, Text, View } from "react-native";

import { radius, spacing, type, useThemePreference } from "@/theme";

type AuthFormErrorProps = {
  message?: string;
  tone?: "danger" | "success" | "info";
};

export function AuthFormError({ message, tone = "danger" }: AuthFormErrorProps) {
  const { colors } = useThemePreference();

  if (!message) {
    return null;
  }

  const backgroundColor =
    tone === "success"
      ? colors.successSoft
      : tone === "info"
        ? colors.surfaceMuted
        : colors.dangerSoft;
  const color =
    tone === "success" ? colors.success : tone === "info" ? colors.inkMuted : colors.danger;

  return (
    <View
      accessibilityLiveRegion="assertive"
      accessibilityRole="alert"
      style={[styles.strip, { backgroundColor }]}
    >
      <Text selectable style={[type.caption, { color }]}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.field,
    overflow: "visible",
  },
});
