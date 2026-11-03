import { StyleSheet, Text, View } from "react-native";

import { contrastRatio } from "@/theme/appearance/color-math";
import { radius, spacing, type, useThemePreference } from "@/theme";

import { useBadgeColor, type BadgeId } from "./badge-colors";

/** Colored status chip. Text stays on a surface that keeps the chosen color readable. */
export function StatusBadge({ id, label }: { id: BadgeId; label: string }) {
  const { colors, resolvedScheme } = useThemePreference();
  const color = useBadgeColor(id, resolvedScheme === "light" ? "light" : "dark");
  const onMuted = contrastRatio(color, colors.surfaceMuted) >= 4.5;
  const backgroundColor = onMuted ? colors.surfaceMuted : colors.dangerSoft;
  return (
    <View style={[styles.badge, { backgroundColor }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[type.caption, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.field,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: radius.pill,
  },
});
