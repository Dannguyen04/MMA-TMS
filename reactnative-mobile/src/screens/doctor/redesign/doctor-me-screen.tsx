import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";

import { USE_MOCK_DOCTOR } from "@/api/doctor-ro";
import { MOCK_DOCTOR_SPECIALIZATION } from "@/api/doctor-ro.mock";
import { Icon } from "@/components/icon";
import { RoleChip } from "@/components/role-chip";
import { doctorRo } from "@/i18n/doctor-ro";
import { fighterName } from "@/screens/coach/readonly/ro-format";
import { Avatar, RoCard, RoScreen, Stack } from "@/screens/coach/readonly/ro-ui";
import { TEXT } from "@/screens/fighter/bout-states";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { useSession } from "@/session/session-context";
import { videoAiApi } from "@/api/video-ai";
import { useLoad } from "@/screens/fighter/use-load";
import { useAiEnabled } from "@/screens/video-ai/ai-data";

import { ConfirmDialog } from "./confirm-dialog";
import { attentionUnion, doctorTitleVi, rosterTiles, tileText } from "./doctor-format";
import { useDoctorRoster } from "./doctor-roster";

/** Tab "Tôi" của Doctor (doctor-redesign-v1). */
export function DoctorMeScreen() {
  const router = useRouter();
  const p = useFighterPalette();
  const { user, isDemo, signOut } = useSession();
  const roster = useDoctorRoster();
  const [confirm, setConfirm] = useState(false);

  const profile = user?.profile && "firstName" in user.profile ? user.profile : null;
  const name = profile ? fighterName(profile) : user?.email ?? "";
  const rawTitle =
    profile && "specialization" in profile && typeof profile.specialization === "string"
      ? profile.specialization
      : USE_MOCK_DOCTOR && isDemo
        ? MOCK_DOCTOR_SPECIALIZATION
        : null;
  const title = doctorTitleVi(rawTitle);
  const tiles = rosterTiles(roster);
  // Ô "Cần chú ý" cộng thêm số cảnh báo suy giảm AI (GET /jobs/impairments); lỗi thì giữ số cũ của danh sách.
  const aiEnabled = useAiEnabled();
  const impairments = useLoad(aiEnabled && roster.enabled, "me-impairments", useCallback(() => videoAiApi.listImpairmentJobs().then((r) => r.map((j) => j.fighterId).filter((id): id is string => Boolean(id))), []), { keepOnError: true });
  const attention = tiles.attention == null ? null : attentionUnion(roster.items, impairments.data ?? []);

  const openFighters = (status: "all" | "attention") =>
    router.navigate({ pathname: "/(doctor)/vo-si", params: { status, t: String(Date.now()) } } as unknown as Href);

  const openAi = () => router.navigate({ pathname: "/(doctor)/vo-si", params: { seg: "ai", t: String(Date.now()) } } as unknown as Href);

  const logout = () => {
    setConfirm(false);
    void signOut().then(() => router.replace("/login"));
  };

  return (
    <RoScreen title={doctorRo.me.title} onRefresh={() => Promise.all([roster.refresh(), impairments.refresh()])}>
      <Stack>
        <View style={styles.head}>
          <Avatar name={name} uri={null} size={72} />
          <Text style={[TEXT.cardTitle, styles.center, { color: p.ink }]}>{name}</Text>
          {user?.role ? <RoleChip role={user.role} /> : null}
          {user?.email && user.email !== name ? (
            <Text style={[TEXT.detail, styles.center, { color: p.muted }]}>{user.email}</Text>
          ) : null}
        </View>

        <RoCard title={doctorRo.me.professional}>
          {title ? (
            <Text accessibilityLabel={`${doctorRo.me.titleLabel}: ${title}`} style={[TEXT.detail, { color: p.muted }]} numberOfLines={2}>
              {title}
            </Text>
          ) : null}
          <View style={styles.tiles}>
            <Tile label={doctorRo.me.assigned} value={tileText(tiles.total)} hint={doctorRo.me.tileHint} onPress={() => openFighters("all")} />
            <Tile
              label={doctorRo.me.attention}
              value={tileText(attention)}
              hint={doctorRo.me.attentionHint}
              danger={(attention ?? 0) > 0}
              onPress={() => (tiles.attention === 0 && (impairments.data?.length ?? 0) > 0 ? openAi() : openFighters("attention"))}
            />
          </View>
        </RoCard>

        <RoCard title={doctorRo.me.settings}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={doctorRo.me.appearance}
            accessibilityHint={doctorRo.me.appearanceDesc}
            onPress={() => router.push("/appearance" as Href)}
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.85 : 1 }]}
          >
            <MaterialCommunityIcons name="palette-outline" size={24} color={p.ink} />
            <View style={{ flex: 1 }}>
              <Text style={[TEXT.bodyBold, { color: p.ink }]}>{doctorRo.me.appearance}</Text>
              <Text style={[TEXT.detail, { color: p.ink }]}>{doctorRo.me.appearanceDesc}</Text>
            </View>
            <Icon name="chevron" size={24} color={p.ink} />
          </Pressable>
        </RoCard>

        <Pressable
          accessibilityRole="button"
          onPress={() => setConfirm(true)}
          style={({ pressed }) => [styles.logout, { borderColor: p.danger, opacity: pressed ? 0.85 : 1 }]}
        >
          <Icon name="logout" size={24} color={p.danger} />
          <Text style={[TEXT.bodyBold, { color: p.danger }]}>{doctorRo.me.logout}</Text>
        </Pressable>
      </Stack>
      <ConfirmDialog
        visible={confirm}
        title={doctorRo.me.logoutConfirm}
        cancelLabel={doctorRo.me.cancel}
        confirmLabel={doctorRo.me.logout}
        onCancel={() => setConfirm(false)}
        onConfirm={logout}
      />
    </RoScreen>
  );
}

function Tile({ label, value, hint, danger, onPress }: { label: string; value: string; hint: string; danger?: boolean; onPress: () => void }) {
  const p = useFighterPalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value === "–" ? "chưa có" : value}`}
      accessibilityHint={hint}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        pressed
          ? { backgroundColor: p.accentSoft, borderColor: p.accent, transform: [{ scale: 0.98 }] }
          : { backgroundColor: p.surface2, borderColor: p.line },
      ]}
    >
      <View style={styles.tileChevron} pointerEvents="none">
        <Icon name="chevron" size={20} color={p.ink} />
      </View>
      <Text style={[styles.tileValue, { color: danger ? p.danger : p.ink }]}>{value}</Text>
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
