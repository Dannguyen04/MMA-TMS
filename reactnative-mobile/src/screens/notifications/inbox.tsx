import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";

import { listNotifications, type AppNotification } from "@/api";
import { doctor } from "@/i18n/doctor";
import { useToastMessage } from "@/components/toast/app-toast";
import { mapApiMessage } from "@/session/map-api-message";
import { useSession } from "@/session/session-context";
import { type, useThemePreference } from "@/theme";
import { CONTRAST_BODY, ensureContrast } from "@/theme/appearance/color-math";
import { SkeletonRows } from "@/components/loading";
import { useMarkRead } from "@/screens/one-tap/notification-read";

function targetId(row: AppNotification): string | null {
  const payload = row.payload;
  const target = payload.target;
  if (!target || typeof target !== "object") return null;
  const record = target as { type?: unknown; id?: unknown };
  if (record.type === "FIGHTER" && typeof record.id === "string") return record.id;
  return null;
}

export function NotificationInbox({ title, showWhen = false }: { title: string; showWhen?: boolean }) {
  const { colors } = useThemePreference();
  const muted = ensureContrast(ensureContrast(colors.inkMuted, colors.bg, CONTRAST_BODY), colors.surface, CONTRAST_BODY);
  const router = useRouter();
  const { user } = useSession();
  const [rows, setRows] = useState<AppNotification[]>([]);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  useToastMessage(error, "error");

  const load = useCallback(() => {
    setError("");
    void listNotifications({ page: 1, limit: 30 })
      .then((page) => setRows(page.data))
      .catch((cause: unknown) => setError(mapApiMessage(cause)))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  const reads = useMarkRead(load);

  const open = (row: AppNotification) => {
    if (!reads.isRead(row)) reads.mark(row.id);
    const fighterId = targetId(row);
    if (row.type === "FIGHTER_DOCTOR_ASSIGNMENT_REQUIRED" && fighterId && user?.role === "ADMIN") {
      router.push(`/(admin)/quan-tri/phan-cong-bac-si?fighterId=${fighterId}` as Href);
    }
  };

  return (
    <View style={{ gap: 12 }}>
      {title ? <Text style={[type.title, { color: colors.ink }]}>{title}</Text> : null}
      {error ? (
        <Pressable accessibilityRole="button" onPress={() => load()}>
          <Text style={[type.link, { color: colors.lotus }]}>Thử lại</Text>
        </Pressable>
      ) : null}
      {!loaded ? <SkeletonRows rows={4} avatar={false} /> : null}
      {loaded && rows.length === 0 && !error ? (
        <Text style={[type.body, { color: showWhen ? colors.ink : muted }]}>
          {showWhen ? doctor.inbox.empty : "Chưa có thông báo."}
        </Text>
      ) : null}
      {rows.map((row) => (
        <Pressable
          key={row.id}
          accessibilityRole="button"
          onPress={() => open(row)}
          style={({ pressed }) => [{ gap: 4, opacity: pressed ? 0.7 : 1, paddingVertical: 8 }]}
        >
          <Text style={[type.body, { color: colors.ink, fontWeight: showWhen && !reads.isRead(row) ? "600" : "400" }]}>
            {row.title}
          </Text>
          <Text style={[type.caption, { color: muted }]}>{row.message}</Text>
          {showWhen ? (
            <Text style={[type.caption, { color: muted }]}>
              {new Date(row.createdAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}
              {" · "}
              {reads.isRead(row) ? doctor.inbox.read : doctor.inbox.unread}
            </Text>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}
