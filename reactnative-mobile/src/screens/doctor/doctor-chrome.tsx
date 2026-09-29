import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Link, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemeToggle } from "@/components/auth/theme-toggle";
import { doctor } from "@/i18n/doctor";
import { vi } from "@/i18n/vi";
import { useSession } from "@/session/session-context";
import { radius, spacing, type, useThemePreference } from "@/theme";

export function fighterName(row: { firstName: string; lastName: string }): string {
  return `${row.firstName} ${row.lastName}`.trim();
}

export function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
}

export function DoctorChrome({
  title,
  subtitle,
  children,
  requireDoctor = true,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  requireDoctor?: boolean;
}) {
  const { colors } = useThemePreference();
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const isDoctor = user?.role === "DOCTOR";
  const showChildren = requireDoctor ? isDoctor : Boolean(user);

  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top + spacing.md }]}>
      <View style={styles.top}>
        <Text style={[type.wordmark, { color: colors.ink, fontSize: 22 }]}>{vi.brand.wordmark}</Text>
        <ThemeToggle />
      </View>
      <Text style={[type.title, { color: colors.ink }]}>{title}</Text>
      {subtitle ? <Text style={[type.body, { color: colors.inkMuted }]}>{subtitle}</Text> : null}

      {!user ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <Text style={[type.body, { color: colors.inkMuted }]}>{doctor.loginHint}</Text>
          <Link href={"/login" as Href} asChild>
            <Pressable accessibilityRole="link" style={styles.link}>
              <Text style={[type.link, { color: colors.lotus }]}>{doctor.me.login}</Text>
            </Pressable>
          </Link>
        </View>
      ) : null}

      {user && !isDoctor ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <Text style={[type.body, { color: colors.ink }]}>{doctor.roleOnly}</Text>
        </View>
      ) : null}

      {showChildren ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

export function DoctorCard({ children }: { children: ReactNode }) {
  const { colors } = useThemePreference();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      {children}
    </View>
  );
}

export const doctorStyles = StyleSheet.create({
  link: {
    minHeight: 44,
    justifyContent: "center",
  },
  list: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: spacing.screenX,
    gap: spacing.md,
  },
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  body: {
    flex: 1,
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.panel,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  link: {
    minHeight: 44,
    justifyContent: "center",
  },
});
