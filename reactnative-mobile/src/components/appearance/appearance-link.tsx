import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { appearance } from "@/i18n/appearance";
import { spacing, type, useThemePreference } from "@/theme";

/** Settings entry shared by every role; opens the one Appearance screen. */
export function AppearanceLink() {
  const { colors } = useThemePreference();
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={appearance.entry}
      accessibilityHint={appearance.entryHint}
      onPress={() => router.push("/appearance" as Href)}
      style={styles.row}
    >
      <MaterialCommunityIcons name="palette-outline" size={22} color={colors.lotus} />
      <View style={styles.flex}>
        <Text style={[type.link, { color: colors.lotus }]}>{appearance.entry}</Text>
        <Text style={[type.caption, { color: colors.inkMuted }]}>{appearance.entryHint}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={22} color={colors.lotus} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  flex: { flex: 1 },
});
