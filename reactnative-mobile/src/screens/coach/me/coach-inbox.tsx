import { useCallback } from "react";
import { ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";

import { coachNavApi } from "@/api/coach/coach-nav";
import { StaggerList } from "@/components/motion/motion";
import { EmptyLine, RolePage } from "@/components/navigation/role-page";
import { coachInbox as t } from "@/i18n/coach/coach-video";
import { coachFighterHref } from "@/screens/coach/fighters/fighter-model";
import { useCoachEnabled } from "@/screens/coach/readonly/use-coach";
import { notificationFighterId } from "@/screens/doctor/redesign/doctor-format";
import { RetryRow, SlipRow } from "@/screens/fighter/redesign/tab-page";
import { useLoad } from "@/screens/fighter/shared/use-load";
import { useMarkRead } from "@/screens/one-tap/notification-read";
import { relTime } from "@/screens/video-ai/ai-model";
import { useThemePreference } from "@/theme";
import { useCoachUnread } from "@/screens/coach/nav/coach-unread";

/**
 * Coach Thông báo (redesign step 19), opened from the bell: one row per notification (bell, title, "when · message").
 * Unread rows have an ink bell and a small red square; read rows a dim bell. A notification about a fighter opens the
 * fighter page; opening marks it read.
 */
export function CoachInboxScreen() {
  const router = useRouter();
  const { colors: c } = useThemePreference();
  const enabled = useCoachEnabled();
  const unread = useCoachUnread();
  const run = useCallback(() => coachNavApi.listNotifications({ page: 1, limit: 30 }), []);
  const list = useLoad(enabled, "coach-inbox", run, { keepOnError: true });
  const reads = useMarkRead(() => {
    unread.refresh();
    void list.refresh().catch(() => undefined);
  });
  const rows = list.data?.data ?? [];
  const back = () => (router.canGoBack() ? router.back() : router.replace("/(coach)/hom-nay" as never));
  return <RolePage testID="coach-inbox" title={t.title} onBack={back} onRefresh={() => { unread.refresh(); return list.refresh(); }}>
    {list.loading && !list.data ? <ActivityIndicator color={c.lotus} style={{ paddingVertical: 32 }}/> : null}
    {list.error && !list.data ? <RetryRow message={t.failed} retry={t.retry} onRetry={list.reload}/> : null}
    {(list.data && !rows.length) || !enabled ? <EmptyLine testID="inbox-empty" title={t.empty}/> : null}
    {rows.length ? <StaggerList testID="inbox-list">
      {rows.map((row, k) => {
        const fighterId = notificationFighterId(row.payload);
        const isRead = reads.isRead(row);
        const line = [relTime(row.createdAt), row.message].filter(Boolean).join(" · ");
        const open = () => {
          if (!isRead) reads.mark(row.id);
          if (fighterId) router.push(coachFighterHref(fighterId));
        };
        return <SlipRow key={row.id} testID={`inbox-${row.id}`} icon="notifications" leadTone={isRead ? "dim" : undefined} dot={!isRead}
          title={row.title} line={line} a11y={[isRead ? "" : t.unread, row.title, line].filter(Boolean).join(", ")}
          onPress={fighterId || !isRead ? open : undefined} last={k === rows.length - 1}/>;
      })}
    </StaggerList> : null}
  </RolePage>;
}
