import { useCallback } from "react";
import { ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";

import { doctorRoApi } from "@/api/doctor-ro";
import { StaggerList } from "@/components/motion";
import { EmptyLine, RolePage } from "@/components/role-page";
import { coachInbox as t } from "@/i18n/coach-video";
import { doctorFighterHref } from "@/screens/doctor/detail/exam-model";
import { RetryRow, SlipRow } from "@/screens/fighter/redesign/tab-page";
import { useLoad } from "@/screens/fighter/use-load";
import { useMarkRead } from "@/screens/one-tap/notification-read";
import { relTime } from "@/screens/video-ai/ai-model";
import { useThemePreference } from "@/theme";

import { notificationFighterId } from "./doctor-format";
import { useDoctorRoster } from "./doctor-roster";
import { useDoctorUnread } from "./doctor-unread";

/**
 * Doctor Thông báo (redesign step 21), opened from the bell: the coach inbox grammar. One row per notification (bell,
 * title, "when · message"); unread rows carry an ink bell and a small red square. A notification about a fighter opens
 * the fighter page; opening marks it read.
 */
export function DoctorNotificationsScreen() {
  const router = useRouter();
  const { colors: c } = useThemePreference();
  const roster = useDoctorRoster();
  const unread = useDoctorUnread();
  const run = useCallback(() => doctorRoApi.listNotifications({ page: 1, limit: 30 }), []);
  const list = useLoad(roster.enabled, "doctor-inbox", run, { keepOnError: true });
  const reads = useMarkRead(() => {
    unread.refresh();
    void list.refresh().catch(() => undefined);
  });
  const rows = list.data?.data ?? [];
  const back = () => (router.canGoBack() ? router.back() : router.replace("/(doctor)/hom-nay" as never));
  return <RolePage testID="doctor-inbox" title={t.title} onBack={back} onRefresh={() => { unread.refresh(); return list.refresh(); }}>
    {list.loading && !list.data ? <ActivityIndicator color={c.lotus} style={{ paddingVertical: 32 }}/> : null}
    {list.error && !list.data ? <RetryRow message={t.failed} retry={t.retry} onRetry={list.reload}/> : null}
    {(list.data && !rows.length) || !roster.enabled ? <EmptyLine testID="inbox-empty" title={t.empty}/> : null}
    {rows.length ? <StaggerList testID="inbox-list">
      {rows.map((row, k) => {
        const fighterId = notificationFighterId(row.payload);
        const isRead = reads.isRead(row);
        const line = [relTime(row.createdAt), row.message].filter(Boolean).join(" · ");
        const open = () => {
          if (!isRead) reads.mark(row.id);
          if (fighterId) router.push(doctorFighterHref(fighterId) as never);
        };
        return <SlipRow key={row.id} testID={`inbox-${row.id}`} icon="notifications" leadTone={isRead ? "dim" : undefined} dot={!isRead}
          title={row.title} line={line} a11y={[isRead ? "" : t.unread, row.title, line].filter(Boolean).join(", ")}
          onPress={fighterId || !isRead ? open : undefined} last={k === rows.length - 1}/>;
      })}
    </StaggerList> : null}
  </RolePage>;
}
