import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";

import { listNotifications, markNotificationRead, type AppNotification } from "@/api";
import { useToastMessage } from "@/components/toast/app-toast";
import { mapApiMessage } from "@/session/map-api-message";
import { useSession } from "@/session/session-context";
import { type, useThemePreference } from "@/theme";

function targetId(row: AppNotification): string | null {
  const payload = row.payload;
  const target = payload.target;
  if (!target || typeof target !== "object") return null;
  const record = target as { type?: unknown; id?: unknown };
  if (record.type === "FIGHTER" && typeof record.id === "string") return record.id;
  return null;
}

export function NotificationInbox({ title }: { title: string }) {
  const { colors } = useThemePreference();
  const router = useRouter();
  const { user } = useSession();
  const [rows, setRows] = useState<AppNotification[]>([]);
  const [error, setError] = useState("");
  useToastMessage(error, "error");

  const load = useCallback(() => {
    void listNotifications({ page: 1, limit: 30 })
      .then((page) => setRows(page.data))
      .catch((cause: unknown) => setError(mapApiMessage(cause)));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const open = (row: AppNotification) => {
    void markNotificationRead(row.id).finally(load);
    const fighterId = targetId(row);
    if (row.type === "FIGHTER_DOCTOR_ASSIGNMENT_REQUIRED" && fighterId && user?.role === "ADMIN") {
      router.push(`/(admin)/quan-tri/phan-cong-bac-si?fighterId=${fighterId}` as Href);
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <Text style={[type.title, { color: colors.ink }]}>{title}</Text>
      {error ? (
        <Pressable accessibilityRole="button" onPress={load}>
          <Text style={[type.link, { color: colors.lotus }]}>Thử lại</Text>
        </Pressable>
      ) : null}
      {rows.length === 0 && !error ? <Text style={[type.body, { color: colors.inkMuted }]}>Chưa có thông báo.</Text> : null}
      {rows.map((row) => (
        <Pressable key={row.id} onPress={() => open(row)}>
          <Text style={[type.body, { color: colors.ink }]}>{row.title}</Text>
          <Text style={[type.caption, { color: colors.inkMuted }]}>{row.message}</Text>
        </Pressable>
      ))}
    </View>
  );
}
