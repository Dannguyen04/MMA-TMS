import { StyleSheet, Text, View } from "react-native";

import { blocked } from "@/i18n/blocked";
import { radius, spacing, type, useThemePreference } from "@/theme";

export function BlockedApiNotice({ extra }: { extra?: string }) {
  const { colors } = useThemePreference();
  return (
    <View
      style={[
        styles.box,
        { backgroundColor: colors.surfaceMuted, borderColor: colors.line },
      ]}
    >
      <Text style={[type.caption, { color: colors.lotus }]}>{blocked.badge}</Text>
      <Text style={[type.body, { color: colors.ink }]}>{blocked.title}</Text>
      <Text style={[type.caption, styles.copy, { color: colors.inkMuted }]}>{blocked.body}</Text>
      {extra ? (
        <Text style={[type.caption, styles.copy, { color: colors.inkMuted }]}>{extra}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderRadius: radius.panel,
    padding: spacing.md,
    gap: spacing.xs,
  },
  copy: { lineHeight: 18 },
});
