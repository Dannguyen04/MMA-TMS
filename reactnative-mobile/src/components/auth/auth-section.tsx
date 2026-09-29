import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { spacing, type, useThemePreference } from "@/theme";

type AuthSectionProps = {
  title?: string;
  children: ReactNode;
};

export function AuthSection({ title, children }: AuthSectionProps) {
  const { colors } = useThemePreference();

  return (
    <View style={styles.root}>
      {title ? <Text style={[type.label, { color: colors.inkMuted }]}>{title}</Text> : null}
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: "100%",
    gap: spacing.sm,
  },
  body: {
    gap: spacing.fieldGap,
  },
});
