import Ionicons from "@expo/vector-icons/Ionicons";
import { MotiView } from "moti";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type DimensionValue } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

import { uiMotion } from "@/components/ui/tokens";
import { radius, spacing, type, type ColorTokens } from "@/theme";

import { toneColors, type IconName, type VisualTone } from "./tone";

type Themed = { colors: ColorTokens };

export function VisualCard({ colors, children }: Themed & { children: ReactNode }) {
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      {children}
    </View>
  );
}

export function Divider({ colors }: Themed) {
  return <View style={[styles.divider, { backgroundColor: colors.line }]} />;
}

export function StatusChip({ colors, label, tone = "neutral" }: Themed & { label: string; tone?: VisualTone }) {
  const t = toneColors(colors, tone);
  return (
    <View style={[styles.chip, { backgroundColor: t.soft, borderColor: t.border }]}>
      <Text style={[type.caption, { color: tone === "neutral" ? colors.inkMuted : t.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Opacity pulse on a palette-colored block; static when reduce-motion is on. */
export function SkeletonBlock({
  colors,
  height = 16,
  width = "100%",
  round = false,
  label,
}: Themed & { height?: number; width?: DimensionValue; round?: boolean; label?: string }) {
  const reduced = useReducedMotion();
  const block = (
    <View
      style={{
        height,
        width: round ? height : width,
        borderRadius: round ? radius.pill : radius.field,
        backgroundColor: colors.surfaceMuted,
      }}
    />
  );
  if (reduced) {
    return (
      <View accessibilityRole="progressbar" accessibilityLabel={label}>
        {block}
      </View>
    );
  }
  return (
    <MotiView
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      from={{ opacity: 0.45 }}
      animate={{ opacity: 1 }}
      transition={{ type: "timing", duration: uiMotion.pulseMs, loop: true }}
    >
      {block}
    </MotiView>
  );
}

export function InfoRow({ colors, label, value }: Themed & { label: string; value: string }) {
  return (
    <View style={styles.stackXs}>
      <Text style={[type.caption, { color: colors.inkMuted }]}>{label}</Text>
      <Text style={[type.body, { color: colors.ink }]}>{value}</Text>
    </View>
  );
}

export function LinkRow({ colors, label, onPress }: Themed & { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.linkRow}>
      <Text style={[type.link, styles.flex, { color: colors.lotus }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.lotus} />
    </Pressable>
  );
}

export function CountRow({ colors, count, label }: Themed & { count: number; label: string }) {
  return (
    <View style={[styles.countRow, { borderColor: colors.line }]}>
      <View style={[styles.countTile, { backgroundColor: colors.surfaceMuted }]}>
        <Text style={[type.title, { color: colors.ink }]}>{count}</Text>
      </View>
      <Text style={[type.body, styles.flex, { color: colors.ink }]}>{label}</Text>
      <Ionicons name="document-text-outline" size={18} color={colors.inkMuted} />
    </View>
  );
}

export type StatusBlockProps = Themed & {
  tone: VisualTone;
  icon: IconName;
  eyebrow: string;
  label: string;
  code?: string;
};

export function StatusBlock({ colors, tone, icon, eyebrow, label, code }: StatusBlockProps) {
  const t = toneColors(colors, tone);
  return (
    <View
      accessible
      accessibilityLabel={`${eyebrow}: ${label}`}
      style={[styles.statusBlock, { backgroundColor: t.soft, borderColor: t.border }]}
    >
      <View style={[styles.statusWell, { backgroundColor: colors.surface }]}>
        <Ionicons name={icon} size={24} color={t.fg} />
      </View>
      <View style={[styles.flex, styles.stackXs]}>
        <Text style={[type.caption, { color: colors.inkMuted }]}>{eyebrow}</Text>
        <Text style={[type.title, { color: t.label }]} numberOfLines={2}>
          {label}
        </Text>
        {code ? <Text style={[type.label, { color: colors.inkSubtle }]}>{code}</Text> : null}
      </View>
    </View>
  );
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

export function AvatarInitials({ colors, name, size = 56 }: Themed & { name: string; size?: number }) {
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={name}
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          backgroundColor: colors.surfaceMuted,
          borderColor: colors.line,
        },
      ]}
    >
      <Text style={[type.title, { color: colors.ink }]}>{initialsOf(name)}</Text>
    </View>
  );
}

export function PersonHeader({
  colors,
  name,
  eyebrow,
  stat,
}: Themed & { name: string; eyebrow?: string; stat?: string }) {
  return (
    <View style={styles.personRow}>
      <AvatarInitials colors={colors} name={name} />
      <View style={[styles.flex, styles.stackXs]}>
        {eyebrow ? <Text style={[type.caption, { color: colors.inkMuted }]}>{eyebrow}</Text> : null}
        <Text style={[type.title, { color: colors.ink }]} numberOfLines={3}>
          {name}
        </Text>
        {stat ? (
          <Text style={[type.caption, { color: colors.inkMuted }]} numberOfLines={2}>
            {stat}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function PersonHeaderSkeleton({ colors, label }: Themed & { label?: string }) {
  return (
    <View style={styles.personRow}>
      <SkeletonBlock colors={colors} height={56} round label={label} />
      <View style={[styles.flex, styles.stackXs]}>
        <SkeletonBlock colors={colors} height={22} width="70%" />
        <SkeletonBlock colors={colors} height={12} width="40%" />
      </View>
    </View>
  );
}

/** Card-shaped skeletons for sections whose data has not arrived yet. */
export function SkeletonCards({ colors, count, label }: Themed & { count: number; label?: string }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <VisualCard key={index} colors={colors}>
          <SkeletonBlock colors={colors} height={13} width="35%" label={index === 0 ? label : undefined} />
          <SkeletonBlock colors={colors} height={20} />
          <SkeletonBlock colors={colors} height={20} width="60%" />
        </VisualCard>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stackXs: { gap: spacing.xs },
  card: {
    borderWidth: 1,
    borderRadius: radius.panel,
    padding: spacing.lg,
    gap: spacing.md,
  },
  divider: { height: StyleSheet.hairlineWidth, width: "100%" },
  chip: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  linkRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  countRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.field,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  countTile: {
    width: 44,
    height: 44,
    borderRadius: radius.field,
    alignItems: "center",
    justifyContent: "center",
  },
  statusBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.panel,
    padding: spacing.lg,
  },
  statusWell: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    borderWidth: 1,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  personRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
});
