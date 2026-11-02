import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";

import { coachApi } from "@/api/coach";
import { Icon } from "@/components/icon";
import { RoleChip } from "@/components/role-chip";
import { coachRo } from "@/i18n/coach-ro";
import { ConfirmDialog } from "@/screens/doctor/redesign/confirm-dialog";
import { TEXT } from "@/screens/fighter/bout-states";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { useLoad } from "@/screens/fighter/use-load";
import { useSession } from "@/session/session-context";

import { fighterName } from "../readonly/ro-format";
import { Avatar, InfoLine, RoCard, RoScreen, Stack } from "../readonly/ro-ui";
import { useCoachEnabled } from "../readonly/use-coach";

const DAY = 86_400_000;

/** 00:00 → 24:00 hôm nay theo giờ Việt Nam, dạng ISO. */
export function todayRangeVn(now = Date.now()): { fromDate: string; toDate: string } {
  const vn = new Date(now + 7 * 3_600_000);
  const start = Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()) - 7 * 3_600_000;
  return { fromDate: new Date(start).toISOString(), toDate: new Date(start + DAY - 1).toISOString() };
}

/** Tab "Tôi" của HLV (coach-nav-v2), cùng khuôn với Doctor. */
export function CoachMeScreen() {
  const router = useRouter();
  const p = useFighterPalette();
  const enabled = useCoachEnabled();
  const { user, signOut } = useSession();
  const [confirm, setConfirm] = useState(false);

  const profile = user?.profile && "firstName" in user.profile ? user.profile : null;
  const name = profile ? fighterName(profile) : user?.email ?? "";
  const extra = (profile ?? {}) as { specialization?: unknown; isHeadCoach?: unknown };
  const specialization = typeof extra.specialization === "string" && extra.specialization.trim() ? extra.specialization.trim() : null;
  const head = extra.isHeadCoach === true;

  const run = useCallback(async () => {
    const [fighters, sessions] = await Promise.allSettled([
      coachApi.listFighters({ page: 1, limit: 1 }),
      coachApi.listSessions({ page: 1, limit: 1, ...todayRangeVn() }),
    ]);
    return {
      fighters: fighters.status === "fulfilled" ? fighters.value.total : null,
      today: sessions.status === "fulfilled" ? sessions.value.total : null,
    };
  }, []);
  const counts = useLoad(enabled, "coach-me", run, { keepOnError: true });

  const logout = () => {
    setConfirm(false);
    void signOut().then(() => router.replace("/login"));
  };

  return (
    <RoScreen title={coachRo.nav.meTitle} onRefresh={counts.refresh}>
      <Stack>
        <View style={styles.head}>
          <Avatar name={name} uri={null} size={72} />
          <Text style={[TEXT.cardTitle, styles.center, { color: p.ink }]}>{name}</Text>
          <RoleChip role="COACH" label={head ? coachRo.nav.roleHead : coachRo.nav.roleCoach} />
          {user?.email && user.email !== name ? <Text style={[TEXT.detail, styles.center, { color: p.ink }]}>{user.email}</Text> : null}
        </View>

        <RoCard title={coachRo.nav.professional}>
          <InfoLine label={coachRo.nav.specialization} value={specialization ?? coachRo.nav.noSpecialization} />
          <View style={styles.tiles}>
            <Tile
              testID="tile-fighters"
              label={coachRo.nav.assigned}
              value={counts.data?.fighters ?? null}
              hint={coachRo.nav.assignedHint}
              onPress={() => router.navigate("/(coach)/fighters" as Href)}
            />
            <Tile
              testID="tile-today"
              label={coachRo.nav.today}
              value={counts.data?.today ?? null}
              hint={coachRo.nav.todayHint}
              onPress={() => router.navigate("/(coach)/schedule" as Href)}
            />
          </View>
        </RoCard>

        <RoCard title={coachRo.nav.settings}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={coachRo.nav.appearance}
            onPress={() => router.push("/appearance" as Href)}
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.85 : 1 }]}
          >
            <Icon name="appearance" size={24} color={p.ink} />
            <Text style={[TEXT.bodyBold, { color: p.ink, flex: 1 }]}>{coachRo.nav.appearance}</Text>
            <Icon name="chevron" size={24} color={p.ink} />
          </Pressable>
        </RoCard>

        <Pressable
          testID="coach-logout"
          accessibilityRole="button"
          onPress={() => setConfirm(true)}
          style={({ pressed }) => [styles.logout, { borderColor: p.danger, opacity: pressed ? 0.85 : 1 }]}
        >
          <Icon name="logout" size={24} color={p.danger} />
          <Text style={[TEXT.bodyBold, { color: p.danger }]}>{coachRo.nav.logout}</Text>
        </Pressable>
      </Stack>
      <ConfirmDialog
        visible={confirm}
        title={coachRo.nav.logoutConfirm}
        cancelLabel={coachRo.nav.cancel}
        confirmLabel={coachRo.nav.logout}
        onCancel={() => setConfirm(false)}
        onConfirm={logout}
      />
    </RoScreen>
  );
}

function Tile({ label, value, hint, onPress, testID }: { label: string; value: number | null; hint: string; onPress: () => void; testID?: string }) {
  const p = useFighterPalette();
  const text = value === null ? "–" : String(value);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value === null ? "chưa có" : text}`}
      accessibilityHint={hint}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        pressed ? { backgroundColor: p.accentSoft, borderColor: p.accent } : { backgroundColor: p.surface2, borderColor: p.line },
      ]}
    >
      <View style={styles.tileChevron} pointerEvents="none">
        <Icon name="chevron" size={20} color={p.ink} />
      </View>
      <Text style={[styles.tileValue, { color: p.ink }]}>{text}</Text>
      <Text style={[TEXT.detail, { color: p.ink }]} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: "center", gap: 8, paddingVertical: 8 },
  center: { textAlign: "center" },
  tiles: { flexDirection: "row", gap: 12 },
  tile: { flex: 1, minHeight: 88, borderRadius: 12, borderWidth: 1, padding: 12, gap: 4, justifyContent: "center" },
  tileChevron: { position: "absolute", top: 10, right: 8 },
  tileValue: { fontSize: 28, lineHeight: 34, fontWeight: "700", fontVariant: ["tabular-nums"] },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56 },
  logout: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 48, borderRadius: 12, borderWidth: 2, backgroundColor: "transparent" },
});
