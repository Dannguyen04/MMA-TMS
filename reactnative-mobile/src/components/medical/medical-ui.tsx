import { type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { radius, spacing, type, useThemePreference } from "@/theme";

export function MedicalCard({ children }: { children: ReactNode }) {
  const { colors } = useThemePreference();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      {children}
    </View>
  );
}

export function MedicalSection({ text }: { text: string }) {
  const { colors } = useThemePreference();
  return <Text style={[type.label, styles.section, { color: colors.lotus }]}>{text}</Text>;
}

export function MedicalFact({ label, value }: { label: string; value: string }) {
  const { colors } = useThemePreference();
  return (
    <View style={styles.fact}>
      <Text style={[type.caption, styles.meta, { color: colors.inkMuted }]}>{label}</Text>
      <Text style={[type.body, { color: colors.ink }]}>{value}</Text>
    </View>
  );
}

export function MedicalMuted({ text, tone = "muted" }: { text: string; tone?: "muted" | "danger" | "ok" }) {
  const { colors } = useThemePreference();
  const color = tone === "danger" ? colors.danger : tone === "ok" ? colors.success : colors.inkMuted;
  return <Text style={[type.caption, styles.meta, { color }]}>{text}</Text>;
}

export function MedicalChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useThemePreference();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        {
          borderColor: selected ? colors.lotus : colors.line,
          backgroundColor: selected ? colors.surface : colors.bg,
        },
      ]}
    >
      <Text style={[type.caption, { color: colors.ink, lineHeight: 16 }]}>{label}</Text>
    </Pressable>
  );
}

export function MedicalLink({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useThemePreference();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.link}>
      <Text style={[type.link, { color: colors.lotus }]}>{label}</Text>
    </Pressable>
  );
}

export const medicalStyles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  row: { gap: 2, paddingVertical: spacing.sm },
  stack: { gap: spacing.md },
});

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radius.panel,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  section: { letterSpacing: 0.8, lineHeight: 18, textTransform: "uppercase" },
  fact: { gap: 2 },
  meta: { lineHeight: 16 },
  chip: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
  },
  link: { minHeight: 44, justifyContent: "center" },
});
