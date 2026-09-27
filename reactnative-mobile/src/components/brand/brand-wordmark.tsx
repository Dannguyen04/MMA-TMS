import { Pressable, StyleSheet, Text, View } from "react-native";

import { vi } from "@/i18n/vi";
import { spacing, type, useThemePreference } from "@/theme";

type BrandWordmarkProps = {
  compact?: boolean;
  onLongPress?: () => void;
};

export function BrandWordmark({ compact = false, onLongPress }: BrandWordmarkProps) {
  const { colors } = useThemePreference();
  const acronym = compact ? type.wordmarkAcronymCompact : type.wordmarkAcronym;
  const lockup = compact ? type.wordmarkLockupCompact : type.wordmarkLockup;
  const expansion = compact ? type.wordmarkExpansionCompact : type.wordmarkExpansion;
  const mark = (
    <>
      <View style={styles.lockupRow}>
        <Text style={[acronym, { color: colors.ink }]}>{vi.brand.wordmarkAcronym}</Text>
        <Text style={[lockup, { color: colors.lotus }]}>{vi.brand.wordmarkLockup}</Text>
      </View>
      {vi.brand.wordmarkExpansion ? (
        <Text style={[expansion, { color: colors.inkMuted }]}>{vi.brand.wordmarkExpansion}</Text>
      ) : null}
      {compact ? null : (
        <Text style={[type.academy, styles.academy, { color: colors.lotus }]}>
          {vi.brand.academy}
        </Text>
      )}
    </>
  );

  if (onLongPress) {
    return (
      <Pressable
        accessible
        accessibilityRole="header"
        accessibilityLabel={vi.a11y.wordmark}
        accessibilityHint={vi.login.demoMenu}
        delayLongPress={480}
        onLongPress={onLongPress}
        testID="auth-demo-trigger"
        style={styles.block}
      >
        {mark}
      </Pressable>
    );
  }

  return (
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel={vi.a11y.wordmark}
      style={styles.block}
    >
      {mark}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing.xs,
    overflow: "visible",
  },
  lockupRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs,
    overflow: "visible",
  },
  academy: {
    marginTop: spacing.sm,
  },
});
