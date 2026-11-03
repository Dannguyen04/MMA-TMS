import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";

import { coachNavApi } from "@/api/coach-nav";
import { Icon } from "@/components/icon";
import { coachRo } from "@/i18n/coach-ro";
import { badgeText } from "@/screens/doctor/redesign/doctor-unread";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";

import { useCoachEnabled } from "../readonly/use-coach";

export const COACH_NOTIFICATIONS_PATH = "/(coach)/thong-bao";
/** Làm mới số chưa đọc mỗi 60 giây (coach-nav-v2). */
export const UNREAD_POLL_MS = 60_000;

type CoachUnread = { count: number; refresh: () => void };
const Ctx = createContext<CoachUnread>({ count: 0, refresh: () => undefined });

/** Số thông báo chưa đọc (GET /notifications/unread-count): tải khi mở, khi quay lại app và mỗi 60 giây. */
export function CoachUnreadProvider({ children }: { children: ReactNode }) {
  const enabled = useCoachEnabled();
  const [count, setCount] = useState(0);
  const seq = useRef(0);

  const refresh = useCallback(() => {
    const id = ++seq.current;
    if (!enabled) {
      setCount(0);
      return;
    }
    void coachNavApi
      .unreadCount()
      .then((row) => {
        if (id === seq.current) setCount(Math.max(0, Number(row.count) || 0));
      })
      .catch(() => {
        // Lỗi mạng: giữ số cũ, không làm phiền trên header.
      });
  }, [enabled]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, UNREAD_POLL_MS);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") refresh();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [refresh]);

  const value = useMemo(() => ({ count, refresh }), [count, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCoachUnread(): CoachUnread {
  return useContext(Ctx);
}

/** Chuông 24dp, vùng bấm 48dp, huy hiệu nền cta / chữ onCta, tối đa "99+", ẩn khi 0. */
export function CoachBell() {
  const router = useRouter();
  const p = useFighterPalette();
  const { count } = useCoachUnread();
  const badge = badgeText(count);
  return (
    <Pressable
      testID="coach-bell"
      accessibilityRole="button"
      accessibilityLabel={coachRo.nav.bellLabel(count)}
      onPress={() => router.push(COACH_NOTIFICATIONS_PATH as Href)}
      style={({ pressed }) => [styles.bell, { opacity: pressed ? 0.7 : 1 }]}
    >
      <Icon name="notifications" size={24} color={p.ink} />
      {badge ? (
        <View
          testID="coach-bell-badge"
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          style={[styles.badge, { backgroundColor: p.accent, borderColor: p.surface }]}
        >
          <Text style={[styles.badgeText, { color: p.onAccent }]} maxFontSizeMultiplier={1.2}>
            {badge}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bell: { width: 48, height: 48, margin: -2, alignItems: "center", justifyContent: "center" },
  badge: {
    position: "absolute",
    top: 4,
    left: 24,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 11, lineHeight: 14, fontWeight: "700", fontVariant: ["tabular-nums"] },
});
