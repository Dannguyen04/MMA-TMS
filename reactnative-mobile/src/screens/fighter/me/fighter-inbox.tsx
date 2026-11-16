import { useCallback } from "react";
import { ActivityIndicator } from "react-native";
import { useRouter, type Href } from "expo-router";

import { listNotifications } from "@/api/notifications";
import { StaggerList } from "@/components/motion";
import { EmptyLine, RolePage } from "@/components/role-page";
import { coachInbox as t } from "@/i18n/coach-video";
import { RetryRow, SlipRow } from "@/screens/fighter/redesign/tab-page";
import { useFighterId } from "@/screens/fighter/use-fighter-id";
import { useLoad } from "@/screens/fighter/use-load";
import { useMarkRead } from "@/screens/one-tap/notification-read";
import { relTime } from "@/screens/video-ai/ai-model";
import { useThemePreference } from "@/theme";

/** Where a fighter's notification leads: a training session or a training plan; anything else only marks it read. */
export function fighterNotificationHref(payload: Record<string, unknown> | null | undefined): Href | null {
  const target = payload?.target;
  if (!target || typeof target !== "object") return null;
  const { type, id } = target as { type?: unknown; id?: unknown };
  if (typeof id !== "string" || !id) return null;
  if (type === "TRAINING_SESSION") return `/tap/${id}` as Href;
  if (type === "TRAINING_PLAN") return `/giao-an/${id}` as Href;
  return null;
}

/**
 * Fighter Thông báo (redesign step 25), opened from the bell on Trang chủ: the same rows as the coach, doctor and
 * admin inbox (bell, title, "when · message"; unread = ink bell and a small red square). Opening marks it read and
 * opens the session or plan it is about. Titles and messages arrive in Vietnamese (`localizeNotification`).
 */
export function FighterInboxScreen() {
  const router = useRouter();
  const { colors: c } = useThemePreference();
  const { canFetch } = useFighterId();
  const run = useCallback(() => listNotifications({ page: 1, limit: 30 }), []);
  const list = useLoad(canFetch, "fighter-inbox", run, { keepOnError: true });
  const reads = useMarkRead(() => { void list.refresh().catch(() => undefined); });
  const rows = list.data?.data ?? [];
  const back = () => (router.canGoBack() ? router.back() : router.replace("/" as never));
  return <RolePage testID="fighter-inbox" title={t.title} onBack={back} onRefresh={canFetch ? list.refresh : undefined}>
    {list.loading && !list.data ? <ActivityIndicator color={c.lotus} style={{ paddingVertical: 32 }}/> : null}
    {list.error && !list.data ? <RetryRow message={t.failed} retry={t.retry} onRetry={list.reload}/> : null}
    {(list.data && !rows.length) || !canFetch ? <EmptyLine testID="inbox-empty" title={t.empty}/> : null}
    {rows.length ? <StaggerList testID="inbox-list">
      {rows.map((row, k) => {
        const href = fighterNotificationHref(row.payload);
        const isRead = reads.isRead(row);
        const line = [relTime(row.createdAt), row.message].filter(Boolean).join(" · ");
        const open = () => {
          if (!isRead) reads.mark(row.id);
          if (href) router.push(href);
        };
        return <SlipRow key={row.id} testID={`inbox-${row.id}`} icon="notifications" leadTone={isRead ? "dim" : undefined} dot={!isRead}
          title={row.title} line={line} a11y={[isRead ? "" : t.unread, row.title, line].filter(Boolean).join(", ")}
          onPress={href || !isRead ? open : undefined} last={k === rows.length - 1}/>;
      })}
    </StaggerList> : null}
  </RolePage>;
}
