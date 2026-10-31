import Ionicons from "@expo/vector-icons/Ionicons";
import { Fragment } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";

import type { IconName } from "@/components/visuals";
import { blocked } from "@/i18n/blocked";
import { vi } from "@/i18n/vi";
import { AdminShell, useAdminType } from "@/screens/admin/admin-page";
import { useSession } from "@/session/session-context";
import { radius, spacing, useThemePreference } from "@/theme";

const TOOLS: { href: Href; label: string; icon: IconName }[] = [
  { href: "/quan-tri/nguoi-dung", label: blocked.users, icon: "people-outline" },
  { href: "/quan-tri/vai-tro", label: blocked.roles, icon: "key-outline" },
  { href: "/quan-tri/video", label: blocked.adminVideos, icon: "videocam-outline" },
  { href: "/quan-tri/job-ai", label: blocked.aiJobs, icon: "hardware-chip-outline" },
  { href: "/quan-tri/mo-hinh", label: blocked.aiModels, icon: "git-network-outline" },
  { href: "/quan-tri/nhat-ky", label: blocked.audit, icon: "list-outline" },
  { href: "/quan-tri/thong-bao", label: blocked.broadcast, icon: "megaphone-outline" },
  { href: "/quan-tri/cai-dat", label: blocked.settings, icon: "settings-outline" },
];

export function AdminHomeScreen() {
  const { colors } = useThemePreference();
  const at = useAdminType();
  const router = useRouter();
  const { signOut } = useSession();

  return (
    <AdminShell title={blocked.adminHome} onBack={false}>
      <View style={styles.group}>
        <Text style={[at.section, { color: colors.ink }]}>{blocked.adminAdmissionsGroup}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={vi.admission.staff}
          onPress={() => router.push("/quan-tri/nhap-hoc")}
          style={[styles.feature, { backgroundColor: colors.cta }]}
        >
          <View style={[styles.featureIcon, { borderColor: colors.onCta }]}>
            <Ionicons name="document-text-outline" size={26} color={colors.onCta} />
          </View>
          <View style={styles.flex}>
            <Text style={[at.name, { color: colors.onCta }]}>{vi.admission.staff}</Text>
            <Text style={[at.meta, styles.featureHint, { color: colors.onCta }]}>
              {vi.admission.adminEntryHint}
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={24} color={colors.onCta} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Phân công bác sĩ"
          onPress={() => router.push("/quan-tri/phan-cong-bac-si")}
          style={styles.toolRow}
        >
          <Ionicons name="medkit-outline" size={22} color={colors.ink} />
          <Text style={[at.body, styles.flex, { color: colors.ink }]}>Phân công bác sĩ</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.inkSubtle} />
        </Pressable>
      </View>

      <View style={styles.group}>
        <View style={styles.groupHead}>
          <Text style={[at.section, { color: colors.ink }]}>{blocked.adminToolsGroup}</Text>
          <Text style={[at.meta, { color: colors.inkMuted }]}>{blocked.adminToolsNote}</Text>
        </View>
        <View style={[styles.toolList, { borderColor: colors.line }]}>
          {TOOLS.map((tool, index) => (
            <Fragment key={String(tool.href)}>
              {index > 0 ? <View style={[styles.rule, { backgroundColor: colors.line }]} /> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${tool.label}, ${blocked.badge}`}
                onPress={() => router.push(tool.href)}
                style={styles.toolRow}
              >
                <Ionicons name={tool.icon} size={22} color={colors.inkMuted} />
                <Text style={[at.body, styles.flex, { color: colors.ink }]} numberOfLines={1}>
                  {tool.label}
                </Text>
                <Text style={[at.meta, { color: colors.inkSubtle }]}>{blocked.badge}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.inkSubtle} />
              </Pressable>
            </Fragment>
          ))}
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => {
          void signOut().then(() => router.replace("/login"));
        }}
        style={styles.logout}
      >
        <Ionicons name="log-out-outline" size={22} color={colors.danger} />
        <Text style={[at.rowTitle, { color: colors.danger }]}>{vi.dashboard.logout}</Text>
      </Pressable>
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  group: { gap: spacing.md, marginTop: spacing.sm },
  groupHead: { gap: 2 },
  feature: {
    minHeight: 112,
    borderRadius: radius.panel,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  featureIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  featureHint: { marginTop: spacing.xs, opacity: 0.8 },
  toolList: { borderTopWidth: 1, borderBottomWidth: 1 },
  rule: { height: StyleSheet.hairlineWidth, marginLeft: 38 },
  toolRow: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  logout: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
