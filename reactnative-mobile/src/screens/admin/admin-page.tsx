import { type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemeToggle } from "@/components/auth/theme-toggle";
import { BlockedApiNotice } from "@/components/blocked/blocked-api-notice";
import { vi } from "@/i18n/vi";
import { spacing, type, useThemePreference } from "@/theme";

export function AdminPage({
  title,
  extra,
  children,
  onBack,
}: {
  title: string;
  extra?: string;
  children?: ReactNode;
  onBack?: boolean;
}) {
  const { colors } = useThemePreference();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top + spacing.md }]}>
      <View style={styles.top}>
        {onBack ? (
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={[type.link, { color: colors.lotus }]}>Quay lại</Text>
          </Pressable>
        ) : (
          <Text style={[type.wordmark, { color: colors.ink }]}>{vi.brand.wordmark}</Text>
        )}
        <ThemeToggle />
      </View>
      <Text style={[type.title, { color: colors.ink }]}>{title}</Text>
      <ScrollView contentContainerStyle={styles.scroll}>
        <BlockedApiNotice extra={extra} />
        {children}
      </ScrollView>
    </View>
  );
}

export function AdminLink({ href, label }: { href: Href; label: string }) {
  const { colors } = useThemePreference();
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(href)}
      style={styles.link}
    >
      <Text style={[type.link, { color: colors.lotus }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: spacing.screenX, gap: spacing.md },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  link: { minHeight: 44, justifyContent: "center" },
});
