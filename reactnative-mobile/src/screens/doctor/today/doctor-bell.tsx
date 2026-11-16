import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";

import { Icon } from "@/components/icon";
import { doctorToday as t } from "@/i18n/doctor-today";
import { badgeText, useDoctorUnread } from "@/screens/doctor/redesign/doctor-unread";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { fz, lh, liveSheet } from "@/theme/typography";

export const DOCTOR_NOTIFICATIONS_PATH = "/(doctor)/thong-bao";

/** Doctor notifications moved from a tab to this bell (redesign 2026-11-11). Badge up to "99+", hidden at 0. */
export function DoctorBell() {
  const router = useRouter();
  const p = useFighterPalette();
  const { count } = useDoctorUnread();
  const badge = badgeText(count);
  return <Pressable testID="doctor-bell" accessibilityRole="button" accessibilityLabel={t.bell(count)} onPress={() => router.push(DOCTOR_NOTIFICATIONS_PATH as Href)}
    style={({ pressed }) => [styles.bell, { opacity: pressed ? 0.7 : 1 }]}>
    <Icon name="notifications" size={24} color={p.ink}/>
    {badge ? <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={[styles.badge, { backgroundColor: p.accent, borderColor: p.surface }]}>
      <Text style={[styles.badgeText, { color: p.onAccent }]} maxFontSizeMultiplier={1.2}>{badge}</Text>
    </View> : null}
  </Pressable>;
}

const styles = liveSheet(() => ({
  bell: { width: 48, height: 48, margin: -2, alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: 4, left: 24, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  badgeText: { fontSize: fz(11), fontWeight: "700", lineHeight: lh(14) },
}));
