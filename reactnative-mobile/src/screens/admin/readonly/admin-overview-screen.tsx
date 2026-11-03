import { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { adminApi } from "@/api/admin";
import { coachApi } from "@/api/coach";
import { Icon, type IconName } from "@/components/icon";
import { adminRo } from "@/i18n/admin-ro";
import { ConnectionBanner, SPEC, TEXT, useDelayedFlag } from "@/screens/fighter/bout-states";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { useLoad } from "@/screens/fighter/use-load";
import { RoScreen, RowSkeletons, Stack } from "@/screens/coach/readonly/ro-ui";
import { useCoachEnabled } from "@/screens/coach/readonly/use-coach";

/** Số có dấu chấm ngăn cách hàng nghìn kiểu Việt Nam (1.234). */
export function countText(n: number): string {
  return Math.max(0, Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

type Tile = { key: string; label: string; icon: IconName; value: number | null; href: string };

/** A-1: 3 ô số lấy từ `total` của danh sách (không có API thống kê). */
export function AdminOverviewScreen() {
  const enabled = useCoachEnabled();
  const router = useRouter();
  const p = useFighterPalette();

  const unreadRun = useCallback(() => adminApi.unreadCount().then((r) => r.count), []);
  const usersRun = useCallback(() => adminApi.listUsers({ page: 1, limit: 1 }).then((r) => r.total), []);
  const fightersRun = useCallback(() => coachApi.listFighters({ page: 1, limit: 1 }).then((r) => r.total), []);
  const unread = useLoad(enabled, "ov-unread", unreadRun, { keepOnError: true });
  const users = useLoad(enabled, "ov-users", usersRun, { keepOnError: true });
  const fighters = useLoad(enabled, "ov-fighters", fightersRun, { keepOnError: true });
  const all = [unread, users, fighters];

  const loading = all.some((x) => x.loading);
  const noData = all.every((x) => x.data == null);
  const skeleton = useDelayedFlag(loading && noData);
  const error = all.find((x) => x.error)?.error ?? "";
  const reload = () => all.forEach((x) => x.reload());
  const refresh = async () => {
    await Promise.all(all.map((x) => x.refresh()));
  };

  const tiles: Tile[] = [
    { key: "unread", label: adminRo.overview.unread, icon: "notifications", value: unread.data, href: "/(admin)/thong-bao" },
    { key: "users", label: adminRo.overview.users, icon: "fighters", value: users.data, href: "/(admin)/nguoi-dung" },
    { key: "fighters", label: adminRo.overview.fighters, icon: "martialArts", value: fighters.data, href: "/(admin)/vo-si" },
  ];

  return (
    <RoScreen title={adminRo.overview.title} onRefresh={refresh} refreshing={loading && noData}>
      <Stack>
        {error ? <ConnectionBanner error={error} onRetry={reload} retrying={loading} hasData={!noData} /> : null}
        {noData && !error && loading ? skeleton ? <RowSkeletons count={3} height={128} /> : null : null}
        {!(noData && !error && loading) ? (
          <Stack>
            {tiles.map((t) => (
              <Pressable
                key={t.key}
                accessibilityRole="button"
                accessibilityLabel={`${t.label}: ${t.value == null ? adminRo.overview.unavailable : countText(t.value)}`}
                onPress={() => router.push(t.href as never)}
                style={({ pressed, focused }: { pressed: boolean; focused?: boolean }) => [
                  styles.tile,
                  { backgroundColor: p.surface, borderColor: focused ? p.ring : p.line, borderWidth: focused ? 2 : 1, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <View style={styles.head}>
                  <Icon name={t.icon} size={24} color={p.link} />
                  <Text style={[TEXT.cardTitle, { color: p.ink, flex: 1 }]}>{t.label}</Text>
                  <Icon name="chevron" size={24} color={p.ink} />
                </View>
                <Text style={[TEXT.bigNumber, { color: p.ink }]}>
                  {t.value == null ? "—" : countText(t.value)}
                </Text>
                {t.value == null ? <Text style={[TEXT.body, { color: p.ink }]}>{adminRo.overview.unavailable}</Text> : null}
              </Pressable>
            ))}
          </Stack>
        ) : null}
      </Stack>
    </RoScreen>
  );
}

const styles = StyleSheet.create({
  tile: { borderRadius: SPEC.radius, padding: SPEC.card, gap: 8, minHeight: 96 },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
});
