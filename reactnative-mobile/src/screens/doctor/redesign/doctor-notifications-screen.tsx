import { useCallback } from "react";
import { Text, View } from "react-native";

import { doctorRoApi } from "@/api/doctor-ro";
import { Icon } from "@/components/icon";
import { doctorRo } from "@/i18n/doctor-ro";
import { RoRow, RoScreen, RowSkeletons, Stack, useGo } from "@/screens/coach/readonly/ro-ui";
import { ConnectionBanner, MessageCard, TEXT, useDelayedFlag } from "@/screens/fighter/bout-states";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { useLoad } from "@/screens/fighter/use-load";

import { notificationFighterId } from "./doctor-format";
import { DOCTOR_DETAIL_PATH } from "./doctor-fighters-screen";
import { useDoctorRoster } from "./doctor-roster";
import { useDoctorUnread } from "./doctor-unread";
import { useMarkRead } from "@/screens/one-tap/notification-read";

function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" });
}

/** Tab Thông báo của Doctor (GET /notifications); thông báo về võ sĩ mở thẳng chi tiết võ sĩ đó. */
export function DoctorNotificationsScreen() {
  const roster = useDoctorRoster();
  const go = useGo();
  const unread = useDoctorUnread();
  const p = useFighterPalette();
  const run = useCallback(() => doctorRoApi.listNotifications({ page: 1, limit: 30 }), []);
  const list = useLoad(roster.enabled, "doctor-inbox", run, { keepOnError: true });
  const reads = useMarkRead(() => {
    unread.refresh();
    void list.refresh().catch(() => undefined);
  });
  const rows = list.data?.data ?? [];
  const firstLoad = list.loading && !list.data;
  const skeleton = useDelayedFlag(firstLoad);
  const empty = Boolean(list.data) && rows.length === 0;
  const disabledEmpty = !roster.enabled;

  return (
    <RoScreen title={doctorRo.notifications.title} onRefresh={() => {
        unread.refresh();
        return list.refresh();
      }} refreshing={firstLoad}>
      <Stack>
        {list.error ? <ConnectionBanner error={list.error} onRetry={list.reload} retrying={list.loading} hasData={Boolean(list.data)} /> : null}
        {firstLoad && !list.error && skeleton ? <RowSkeletons count={4} height={88} /> : null}
        {empty || disabledEmpty ? (
          <MessageCard icon="notifications" title={doctorRo.notifications.emptyTitle} description={doctorRo.notifications.emptyDesc} />
        ) : null}
        {rows.map((row) => {
          const fighterId = notificationFighterId(row.payload);
          const lines = [row.message, when(row.createdAt)].filter(Boolean);
          const isRead = reads.isRead(row);
          const open = () => {
            if (!isRead) reads.mark(row.id);
            if (fighterId) go(DOCTOR_DETAIL_PATH, fighterId);
          };
          return (
            <RoRow
              key={row.id}
              title={row.title}
              lines={lines}
              label={[isRead ? "" : doctorRo.notifications.unread, row.title, ...lines, fighterId ? doctorRo.notifications.openFighter : ""]
                .filter(Boolean)
                .join(", ")}
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
                  <Text style={[TEXT.captionBold, { color: p.activeInk }]}>{doctorRo.notifications.unread}</Text>
                </View>
              ) : null}
            </RoRow>
          );
        })}
      </Stack>
    </RoScreen>
  );
}
