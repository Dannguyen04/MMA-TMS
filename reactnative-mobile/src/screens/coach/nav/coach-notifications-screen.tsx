import { useCallback } from "react";
import { Text, View } from "react-native";

import { coachNavApi } from "@/api/coach-nav";
import { Icon } from "@/components/icon";
import { coachRo } from "@/i18n/coach-ro";
import { notificationFighterId } from "@/screens/doctor/redesign/doctor-format";
import { ConnectionBanner, MessageCard, TEXT, useDelayedFlag } from "@/screens/fighter/bout-states";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { useLoad } from "@/screens/fighter/use-load";

import { RoRow, RoScreen, RowSkeletons, Stack, useGo } from "../readonly/ro-ui";
import { useCoachEnabled } from "../readonly/use-coach";
import { useCoachUnread } from "./coach-unread";
import { useMarkRead } from "@/screens/one-tap/notification-read";

export const COACH_DETAIL_PATH = "/(coach)/fighters/chi-tiet";

function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });
}

/** Màn Thông báo của HLV (mở từ chuông, có nút back). Thông báo về võ sĩ mở chi tiết võ sĩ. */
export function CoachNotificationsScreen() {
  const enabled = useCoachEnabled();
  const go = useGo();
  const unread = useCoachUnread();
  const p = useFighterPalette();
  const run = useCallback(() => coachNavApi.listNotifications({ page: 1, limit: 30 }), []);
  const list = useLoad(enabled, "coach-inbox", run, { keepOnError: true });
  const reads = useMarkRead(() => {
    unread.refresh();
    void list.refresh().catch(() => undefined);
  });
  const rows = list.data?.data ?? [];
  const firstLoad = list.loading && !list.data;
  const skeleton = useDelayedFlag(firstLoad);
  const empty = (Boolean(list.data) && rows.length === 0) || !enabled;

  return (
    <RoScreen
      title={coachRo.nav.notificationsTitle}
      back
      onRefresh={() => {
        unread.refresh();
        return list.refresh();
      }}
      refreshing={firstLoad}
    >
      <Stack>
        {list.error ? <ConnectionBanner error={list.error} onRetry={list.reload} retrying={list.loading} hasData={Boolean(list.data)} /> : null}
        {firstLoad && !list.error && skeleton ? <RowSkeletons count={4} height={88} /> : null}
        {empty ? <MessageCard icon="notifications" title={coachRo.nav.emptyNotiTitle} description={coachRo.nav.emptyNotiDesc} /> : null}
        {rows.map((row) => {
          const fighterId = notificationFighterId(row.payload);
          const lines = [row.message, when(row.createdAt)].filter(Boolean);
          const isRead = reads.isRead(row);
          const open = () => {
            if (!isRead) reads.mark(row.id);
            if (fighterId) go(COACH_DETAIL_PATH, fighterId);
          };
          return (
            <RoRow
              key={row.id}
              title={row.title}
              lines={lines}
              label={[isRead ? "" : coachRo.nav.unread, row.title, ...lines, fighterId ? coachRo.nav.openFighter : ""].filter(Boolean).join(", ")}
              leading={
                <View style={{ width: 24, alignItems: "center" }}>
                  <Icon name="notifications" size={24} color={isRead ? p.ink : p.activeInk} />
                </View>
              }
              onPress={fighterId || !isRead ? open : undefined}
            >
              {!isRead ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.activeInk }} />
                  <Text style={[TEXT.captionBold, { color: p.activeInk }]}>{coachRo.nav.unread}</Text>
                </View>
              ) : null}
            </RoRow>
          );
        })}
      </Stack>
    </RoScreen>
  );
}
