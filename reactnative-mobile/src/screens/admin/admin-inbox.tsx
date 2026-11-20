import { useCallback } from "react";
import { ActivityIndicator } from "react-native";
import { useRouter, type Href } from "expo-router";

import { listNotifications, type AppNotification } from "@/api";
import type { IconName } from "@/components/icon";
import { StaggerList } from "@/components/motion/motion";
import { EmptyLine, RolePage } from "@/components/navigation/role-page";
import { adminRest as t } from "@/i18n/admin/admin-rest";
import { useCoachEnabled } from "@/screens/coach/readonly/use-coach";
import { RetryRow, SlipRow } from "@/screens/fighter/redesign/tab-page";
import { useLoad } from "@/screens/fighter/shared/use-load";
import { useMarkRead } from "@/screens/one-tap/notification-read";
import { relTime } from "@/screens/video-ai/ai-model";
import { useThemePreference } from "@/theme";

import { useAdminUnread } from "./admin-unread";

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

/**
 * Admin Thông báo tab (redesign step 22): the coach inbox grammar. One row per notification (type icon, title,
 * "when · message"); unread rows carry an ink icon and a small red square. A row with a target opens the admission or the
 * doctor-assignment page; opening marks it read.
 */
export function AdminInboxScreen() {
  const router = useRouter();
  const { colors: c } = useThemePreference();
  const enabled = useCoachEnabled();
  const unread = useAdminUnread();
  const run = useCallback(() => listNotifications({ page: 1, limit: 30 }).then((page) => page.data), []);
  const list = useLoad(enabled, "admin-inbox", run, { keepOnError: true });
  const reads = useMarkRead(() => {
    unread.refresh();
    void list.refresh().catch(() => undefined);
  });
  const rows = list.data ?? [];
  const open = (row: AppNotification) => {
    if (!reads.isRead(row)) reads.mark(row.id);
    const href = notificationHref(row);
    if (href) router.push(href as Href);
  };
  return <RolePage testID="admin-inbox" title={t.inbox} onRefresh={() => { unread.refresh(); return list.refresh(); }}>
    {list.loading && !list.data ? <ActivityIndicator color={c.lotus} style={{ paddingVertical: 32 }}/> : null}
    {list.error && !list.data ? <RetryRow message={t.inboxFailed} retry={t.retry} onRetry={list.reload}/> : null}
    {list.data && !rows.length ? <EmptyLine testID="inbox-empty" title={t.inboxEmpty}/> : null}
    {rows.length ? <StaggerList testID="inbox-list">
      {rows.map((row, k) => {
        const isRead = reads.isRead(row);
        const line = [relTime(row.createdAt), row.message].filter(Boolean).join(" · ");
        const target = notificationHref(row);
        return <SlipRow key={row.id} testID={`inbox-${row.id}`} icon={TYPE_ICON[row.type] ?? "notifications"} leadTone={isRead ? "dim" : undefined} dot={!isRead}
          title={row.title} line={line} a11y={[isRead ? "" : t.unread, row.title, line].filter(Boolean).join(", ")}
          onPress={target || !isRead ? () => open(row) : undefined} last={k === rows.length - 1}/>;
      })}
    </StaggerList> : null}
  </RolePage>;
}
