import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";

import { listNotifications, type AppNotification } from "@/api";
import { Icon, type IconName } from "@/components/icon";
import { FadeInView, PressableScale, SkeletonList } from "@/components/motion";
import { StateView } from "@/components/state-view";
import { useToastMessage } from "@/components/toast/app-toast";
import { manager } from "@/i18n/manager";
import { states } from "@/i18n/unavailable";
import { useAdminType } from "@/screens/admin/admin-page";
import { AdminScreen } from "@/screens/admin/admin-ui";
import { mapApiMessage } from "@/session/map-api-message";
import { spacing, useThemePreference } from "@/theme";
import { useMarkRead } from "@/screens/one-tap/notification-read";

/** Icon theo loại thông báo (NOTIFICATION_TYPE trong nestjs-api). */
const TYPE_ICON: Record<string, IconName> = {
  ADMISSION_APPLICATION_SUBMITTED: "folderPlus",
  ADMISSION_DECISION_REQUIRED: "clipboardCheck",
  ADMISSION_ACTIVATION_COMPLETED: "admission",
  FIGHTER_DOCTOR_ASSIGNMENT_REQUIRED: "stethoscope",
};

/** Đích mở khi chạm: payload.target {type,id} (NOTIFICATION_TARGET). */
export function notificationHref(row: Pick<AppNotification, "payload">): string | null {
  const target = row.payload?.target;
  if (!target || typeof target !== "object") return null;
  const { type, id } = target as { type?: unknown; id?: unknown };
  if (typeof id !== "string" || !id) return null;
  if (type === "FIGHTER_APPLICATION") return `/quan-tri/nhap-hoc/${encodeURIComponent(id)}`;
  if (type === "FIGHTER") return `/quan-tri/phan-cong-bac-si?fighterId=${encodeURIComponent(id)}`;
  return null;
}

/** Figma "Manager · Thông báo" (161:19200) — chỉ hộp thư nhận, chưa có API gửi. */
export function AdminInboxScreen() {
  const { colors } = useThemePreference();
  const at = useAdminType();
  const router = useRouter();
  const [rows, setRows] = useState<AppNotification[] | null>(null);
  const [error, setError] = useState("");
  useToastMessage(error, "error");

  const load = useCallback((mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") setError("");
    return listNotifications({ page: 1, limit: 30 })
      .then((page) => setRows(page.data))
      .catch((cause: unknown) => {
        if (mode === "refresh") throw cause;
        setRows((current) => current ?? []);
        setError(mapApiMessage(cause));
      });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const reads = useMarkRead();
  const open = (row: AppNotification) => {
    if (!reads.isRead(row)) reads.mark(row.id);
    const href = notificationHref(row);
    if (href) router.push(href as Href);
  };

  return (
    <AdminScreen title={manager.inbox.title} onRefresh={load}>
      <View style={styles.lead}>
        <Text style={[at.section, { color: colors.ink }]}>{manager.inbox.lead}</Text>
        <Text style={[at.meta, { color: colors.inkMuted }]}>{manager.inbox.hint}</Text>
      </View>
      {rows == null ? <SkeletonList rows={3} height={72} /> : null}
      {rows && rows.length === 0 && error ? (
        <StateView kind="error" title={states.loadFailed} description={error} actionLabel={states.retry} onAction={load} compact />
      ) : null}
      {rows && rows.length === 0 && !error ? <StateView kind="empty" title={manager.inbox.empty} compact /> : null}
      {rows && rows.length > 0 ? (
        <View>
          {rows.map((row, index) => (
            <FadeInView key={row.id} index={index}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`${row.title}. ${row.message}`}
                onPress={() => open(row)}
                scaleTo={0.985}
                style={[styles.row, { borderBottomColor: colors.line }]}
              >
                <Icon name={TYPE_ICON[row.type] ?? "notifications"} size={22} tone="accent" />
                <View style={styles.body}>
                  <Text style={[at.rowTitle, { color: colors.ink, opacity: reads.isRead(row) ? 0.8 : 1 }]}>{row.title}</Text>
                  <Text style={[at.meta, { color: colors.inkMuted }]}>{row.message}</Text>
                </View>
                {!reads.isRead(row) ? <View style={[styles.dot, { backgroundColor: colors.lotus }]} /> : null}
                {notificationHref(row) ? <Icon name="chevron" size={20} tone="muted" /> : null}
              </PressableScale>
            </FadeInView>
          ))}
        </View>
      ) : null}
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  lead: { gap: spacing.xs },
  row: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  body: { flex: 1, gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
