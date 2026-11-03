import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter, type Href } from "expo-router";

import { listApplications, type ApplicationStatus } from "@/api/admissions";
import { getUnreadNotificationCount } from "@/api/notifications";
import { Icon, IconBadge, type IconName } from "@/components/icon";
import { FadeInView, PressableScale } from "@/components/motion";
import { manager } from "@/i18n/manager";
import { useAdminType } from "@/screens/admin/admin-page";
import { AdminButton, AdminRow, AdminScreen, AdminSection } from "@/screens/admin/admin-ui";
import { useSession } from "@/session/session-context";
import { radius, spacing, useThemePreference } from "@/theme";
import { Skeleton } from "@/components/motion";

/** Trạng thái hồ sơ còn chờ quản lý xử lý (gán HLV hoặc ra quyết định). */
export const ACTIONABLE_STATUSES: readonly ApplicationStatus[] = ["SUBMITTED", "PASSED", "FAILED"];

/** Đếm phía client trên trang hồ sơ mới nhất (backend chưa có API thống kê). */
export function countActionable(items: readonly { status: ApplicationStatus }[]): number {
  return items.filter((item) => ACTIONABLE_STATUSES.includes(item.status)).length;
}

type Tool = { href: Href; label: string; icon: IconName; soon?: boolean };

const TOOLS: Tool[] = [
  { href: "/quan-tri/nguoi-dung", label: manager.tools.users, icon: "fighters" },
  { href: "/quan-tri/vai-tro", label: manager.tools.roles, icon: "roles", soon: true },
  { href: "/quan-tri/video", label: manager.tools.videos, icon: "video" },
  { href: "/quan-tri/job-ai", label: manager.tools.jobs, icon: "aiJobs" },
  { href: "/quan-tri/mo-hinh", label: manager.tools.models, icon: "aiModels", soon: true },
  { href: "/quan-tri/nhat-ky", label: manager.tools.audit, icon: "audit", soon: true },
];

export function AdminHomeScreen() {
  const { colors } = useThemePreference();
  const at = useAdminType();
  const router = useRouter();
  const { signOut } = useSession();
  const [pending, setPending] = useState<number | null | undefined>(undefined);
  const [unread, setUnread] = useState<number | null>(null);

  const load = useCallback((mode: "initial" | "refresh" = "initial") => {
    const a = listApplications({ page: 1, limit: 100 }).then((page) => setPending(countActionable(page.items)));
    const b = getUnreadNotificationCount().then((row) => setUnread(row.count));
    return Promise.all([a, b]).catch((cause: unknown) => {
      if (mode === "refresh") throw cause;
      void a.catch(() => setPending(null));
      void b.catch(() => setUnread(null));
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <AdminScreen title={manager.hubTitle} onBack={false} onRefresh={() => load("refresh")}>
      <FadeInView index={0} style={styles.brand}>
        <IconBadge name="martialArts" size={22} />
        <View style={styles.flex}>
          <Text style={[at.rowTitle, { color: colors.ink }]}>{manager.brand}</Text>
          <Text style={[at.meta, { color: colors.inkMuted }]}>{manager.academy}</Text>
        </View>
      </FadeInView>

      <FadeInView index={1}>
        <View style={[styles.feature, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <Icon name="folderCheck" size={24} tone="accent" />
          <Text style={[at.name, { color: colors.ink }]}>{manager.admissionsCard.title}</Text>
          <Text style={[at.body, { color: colors.inkMuted }]}>{manager.admissionsCard.body}</Text>
          {pending === undefined ? <Skeleton height={13} width="45%" /> : null}
          {pending != null && pending > 0 ? (
            <Text accessibilityLiveRegion="polite" style={[at.metaStrong, { color: colors.lotus }]}>
              {manager.admissionsCard.pending(pending)}
            </Text>
          ) : null}
          <AdminButton title={manager.admissionsCard.open} onPress={() => router.push("/quan-tri/nhap-hoc")} />
        </View>
      </FadeInView>

      <View>
        <AdminRow
          index={2}
          icon="stethoscope"
          title={manager.assignDoctorRow.title}
          subtitle={manager.assignDoctorRow.sub}
          onPress={() => router.push("/quan-tri/phan-cong-bac-si")}
        />
        <AdminRow
          index={3}
          icon="notifications"
          title={manager.inboxRow.title}
          subtitle={manager.inboxRow.sub}
          badge={unread ? String(unread) : undefined}
          onPress={() => router.push("/quan-tri/thong-bao")}
          last
        />
      </View>

      <AdminSection title={manager.toolsTitle} hint={manager.toolsHint}>
        <View>
          {TOOLS.map((tool, index) => (
            <AdminRow
              key={String(tool.href)}
              index={4 + index}
              icon={tool.icon}
              tone="ink"
              title={tool.label}
              badge={tool.soon ? manager.soon : undefined}
              onPress={() => router.push(tool.href)}
              last={index === TOOLS.length - 1}
            />
          ))}
        </View>
      </AdminSection>

      <AdminRow
        icon="sliders"
        title={manager.settingsRow.title}
        subtitle={manager.settingsRow.sub}
        onPress={() => router.push("/quan-tri/cai-dat")}
        last
      />

      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={manager.logout}
        onPress={() => {
          void signOut().then(() => router.replace("/login"));
        }}
        style={[styles.logout, { borderColor: colors.line }]}
      >
        <Icon name="logout" size={20} tone="accent" />
        <Text style={[at.rowTitle, styles.logoutText, { color: colors.ink }]}>{manager.logout}</Text>
      </PressableScale>
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  brand: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  feature: { borderRadius: radius.panel, borderWidth: StyleSheet.hairlineWidth, padding: spacing.lg, gap: spacing.md },
  logout: {
    minHeight: 52,
    borderRadius: radius.field,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  logoutText: { flex: 1, textAlign: "center", marginRight: 20 },
});
