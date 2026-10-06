import Ionicons from "@expo/vector-icons/Ionicons";
import { useMemo, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, type TextStyle } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemeToggle } from "@/components/auth/theme-toggle";
import { blocked } from "@/i18n/blocked";
import { vi } from "@/i18n/vi";
import {
  contentTextStyle,
  fonts,
  radius,
  spacing,
  type,
  useThemePreference,
  useTypography,
  viLineHeight,
  type LiveTypography,
} from "@/theme";

/** Admin-only type scale: larger than the shared caption/label sizes. */
export const adminType = {
  screenTitle: {
    fontFamily: fonts.display,
    fontSize: 34,
    letterSpacing: 0.4,
    lineHeight: viLineHeight(34),
    textTransform: "uppercase",
  },
  name: { fontFamily: fonts.uiSemi, fontSize: 24, lineHeight: viLineHeight(24) },
  section: { fontFamily: fonts.uiSemi, fontSize: 18, lineHeight: viLineHeight(18) },
  rowTitle: { fontFamily: fonts.uiSemi, fontSize: 17, lineHeight: viLineHeight(17) },
  body: { fontFamily: fonts.ui, fontSize: 16, lineHeight: viLineHeight(16) },
  meta: { fontFamily: fonts.ui, fontSize: 14, lineHeight: viLineHeight(14) },
  metaStrong: { fontFamily: fonts.uiMedium, fontSize: 14, lineHeight: viLineHeight(14) },
  status: {
    fontFamily: fonts.display,
    fontSize: 30,
    letterSpacing: 0.3,
    lineHeight: viLineHeight(30),
    textTransform: "uppercase",
  },
} as const satisfies Record<string, TextStyle>;

type AdminTypeRole = keyof typeof adminType;

function scaledSize(base: number, factor: number) {
  return factor === 1 ? base : Math.round(base * factor * 10) / 10;
}

function liveHeading(base: TextStyle & { fontSize: number }, live: LiveTypography): TextStyle {
  const fontSize = scaledSize(base.fontSize, live.sizeFactor);
  return { ...base, fontSize, lineHeight: viLineHeight(fontSize) };
}

function liveContent(base: number, slot: keyof LiveTypography["faces"], live: LiveTypography): TextStyle {
  const fontSize = scaledSize(base, live.sizeFactor);
  return {
    fontFamily: live.faces[live.bold ? "bold" : slot],
    fontSize,
    lineHeight: Math.max(viLineHeight(fontSize), Math.ceil(fontSize * live.lineHeight)),
    letterSpacing: Math.round(live.letterSpacingEm * fontSize * 100) / 100,
  };
}

/**
 * `adminType` under the applied typography: content text uses the applied body
 * face and scale; headings keep Barlow Condensed and follow only the scale.
 */
export function useAdminType(): Record<AdminTypeRole, TextStyle> {
  const live = useTypography();
  return useMemo(
    () => ({
      screenTitle: liveHeading(adminType.screenTitle, live),
      name: liveContent(adminType.name.fontSize, "semibold", live),
      section: liveContent(adminType.section.fontSize, "semibold", live),
      rowTitle: liveContent(adminType.rowTitle.fontSize, "semibold", live),
      body: contentTextStyle("body", live),
      meta: liveContent(adminType.meta.fontSize, "regular", live),
      metaStrong: liveContent(adminType.metaStrong.fontSize, "medium", live),
      status: liveHeading(adminType.status, live),
    }),
    [live],
  );
}

export function AdminShell({
  title,
  lead,
  onBack,
  children,
}: {
  title?: string;
  lead?: string;
  onBack: boolean;
  children?: ReactNode;
}) {
  const { colors } = useThemePreference();
  const at = useAdminType();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.top}>
        {onBack ? (
          <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={8} style={styles.back}>
            <Ionicons name="chevron-back" size={22} color={colors.lotus} />
            <Text style={[at.body, { fontFamily: at.metaStrong.fontFamily, color: colors.lotus }]}>Quay lại</Text>
          </Pressable>
        ) : (
          <Text style={[type.wordmark, { color: colors.ink }]}>{vi.brand.wordmark}</Text>
        )}
        <ThemeToggle />
      </View>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {title ? (
          <View style={styles.heading}>
            <Text style={[at.screenTitle, { color: colors.ink }]}>{title}</Text>
            {lead ? <Text style={[at.body, { color: colors.inkMuted }]}>{lead}</Text> : null}
          </View>
        ) : null}
        {children}
      </ScrollView>
    </View>
  );
}

/** Placeholder page for admin tools that have no mobile API yet. */
export function AdminPage({
  title,
  extra,
  children,
  onBack,
  blockedNotice = true,
}: {
  title: string;
  extra?: string;
  children?: ReactNode;
  onBack?: boolean;
  blockedNotice?: boolean;
}) {
  return (
    <AdminShell title={title} onBack={Boolean(onBack)}>
      {blockedNotice ? <AdminBlockedNotice extra={extra} /> : null}
      {children}
    </AdminShell>
  );
}

function AdminBlockedNotice({ extra }: { extra?: string }) {
  const { colors } = useThemePreference();
  const at = useAdminType();
  return (
    <View style={[styles.notice, { borderLeftColor: colors.inkMuted }]}>
      <View style={styles.noticeHead}>
        <Ionicons name="lock-closed-outline" size={22} color={colors.inkMuted} />
        <Text style={[at.section, styles.flex, { color: colors.ink }]}>{blocked.title}</Text>
      </View>
      <Text style={[at.body, { color: colors.inkMuted }]}>{extra ?? blocked.body}</Text>
      {extra ? <Text style={[at.meta, { color: colors.inkMuted }]}>{blocked.body}</Text> : null}
    </View>
  );
}

export function AdminLink({ href, label }: { href: Href; label: string }) {
  const { colors } = useThemePreference();
  const at = useAdminType();
  const router = useRouter();
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push(href)} style={styles.link}>
      <Text style={[at.body, styles.flex, { color: colors.lotus }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={20} color={colors.lotus} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: spacing.screenX },
  top: {
    minHeight: 52,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  back: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 2 },
  scroll: { gap: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xxl },
  heading: { gap: spacing.xs },
  notice: {
    borderLeftWidth: 4,
    borderTopRightRadius: radius.field,
    borderBottomRightRadius: radius.field,
    paddingLeft: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  noticeHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  flex: { flex: 1 },
  link: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: spacing.sm },
});
