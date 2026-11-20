import { StyleSheet, Text, View } from "react-native";

import { contrastRatio } from "@/theme/appearance/color-math";
import { radius, spacing, type, useThemePreference } from "@/theme";

import { useBadgeColor, type BadgeId } from "./badge-colors";

/** Status as a marked word (DESIGN.md: no chips for status). The chosen color falls back to ink when it would not read. */
export function StatusBadge({ id, label }: { id: BadgeId; label: string }) {
  const { colors, resolvedScheme } = useThemePreference();
  const chosen = useBadgeColor(id, resolvedScheme === "light" ? "light" : "dark");
  const color = contrastRatio(chosen, colors.bg) >= 4.5 ? chosen : colors.ink;
  return (
    <View style={styles.badge}>
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
    paddingVertical: 2,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: radius.pill,
  },
});
