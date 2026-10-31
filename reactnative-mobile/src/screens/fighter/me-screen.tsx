import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";

import { isFighterProfile, listFighterDoctors, type DoctorAssignment } from "@/api";
import { useToastMessage } from "@/components/toast/app-toast";
import { findCountry } from "@/constants/countries";
import { medical } from "@/i18n/medical";
import { fighter } from "@/i18n/fighter";
import { formatMedicalWhen } from "@/components/medical/medical-format";
import { getMe } from "@/screens/fighter/api";
import { mapFighterError } from "@/screens/fighter/errors";
import { formatDay, stanceLabel, weightClassLabel } from "@/screens/fighter/format";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { FighterHub, HubHeader } from "@/screens/fighter/redesign/shell";
import { useFighterId } from "@/screens/fighter/use-fighter-id";
import { useLoad } from "@/screens/fighter/use-load";
import { useSession } from "@/session/session-context";
import { useAppearanceActions, useThemePreference } from "@/theme";

function initials(first: string, last: string): string {
  const a = first.trim().charAt(0);
  const b = last.trim().charAt(0);
  return `${a}${b}`.toUpperCase() || "•";
}

function countryLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return findCountry(value)?.name ?? value;
}

export function FighterMeScreen() {
  const colors = useFighterPalette();
  const { resolvedScheme } = useThemePreference();
  const { setMode } = useAppearanceActions();
  const router = useRouter();
  const { signOut } = useSession();
  const { fighterId, profile, user, canFetch } = useFighterId();

  const load = useCallback(async () => {
    const me = await getMe();
    let doctors: DoctorAssignment[] | null = null;
    let doctorError = "";
    if (fighterId) {
      try {
        const page = await listFighterDoctors(fighterId, { page: 1, limit: 20 });
        doctors = page.data;
      } catch (cause: unknown) {
        doctorError = mapFighterError(cause);
        doctors = null;
      }
    }
    return { me, doctors, doctorError };
  }, [fighterId]);

  const { data, error, loading, reload } = useLoad(canFetch, fighterId ?? "none", load);
  useToastMessage(error, "error");
  useToastMessage(data?.doctorError, "error");
  const me = data?.me ?? user;
  const row = me && isFighterProfile(me.profile) ? me.profile : profile;
  const active = data?.doctors?.find((item) => item.endsAt == null) ?? null;

  const onLogout = () => {
    void signOut().then(() => {
      router.replace("/login");
    });
  };

  return (
    <FighterHub refreshing={loading && !data}>
      <HubHeader title="Tôi" />
      <View style={styles.pad}>
        {error ? (
          <Pressable accessibilityRole="button" onPress={reload}>
            <Text style={[styles.meta, { color: colors.accent }]}>Thử lại</Text>
          </Pressable>
        ) : null}
        <View style={styles.identity}>
          <View style={[styles.avatar, { backgroundColor: colors.agenda }]}>
            <Text style={[styles.avatarText, { color: colors.agendaInk }]}>
              {initials(row?.firstName ?? "", row?.lastName ?? "")}
            </Text>
          </View>
          <View style={styles.flex}>
            <Text style={[styles.name, { color: colors.ink }]}>
              {row ? `${row.firstName} ${row.lastName}`.trim() : "—"}
            </Text>
            <Text style={[styles.meta, { color: colors.muted }]}>{row?.gym || "—"}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cài đặt"
            onPress={() => router.push("/cai-dat" as Href)}
            style={[styles.gear, { backgroundColor: colors.surface2 }]}
          >
            <MaterialCommunityIcons name="cog-outline" size={22} color={colors.ink} />
          </Pressable>
        </View>

        <View style={[styles.stats, { backgroundColor: colors.surface2 }]}>
          <Stat value={row ? weightClassLabel(row.weightClass) : "—"} label="Hạng cân" />
          <Stat value={stanceLabel(row?.dominantStance)} label="Thế đứng" />
          <Stat value={row?.heightCm != null ? `${row.heightCm} cm` : "—"} label="Chiều cao" />
          <Stat value={row?.reachCm != null ? `${row.reachCm} cm` : "—"} label="Sải tay" />
        </View>

        <View style={styles.facts}>
          <View style={styles.pair}>
            <Fact label="Họ" value={row?.lastName || "—"} />
            <Fact label="Tên" value={row?.firstName || "—"} />
          </View>
          <View style={styles.pair}>
            <Fact label="Ngày sinh" value={row ? formatDay(row.dateOfBirth) : "—"} />
            <Fact label="Quốc tịch" value={countryLabel(row?.nationality)} />
          </View>
          <Fact label="Email" value={me?.email || "—"} />
          <Fact label="Giới thiệu" value={row?.bio || "—"} />
        </View>

        <View style={styles.lock}>
          <MaterialCommunityIcons name="lock-outline" size={14} color={colors.muted} />
          <Text style={[styles.fine, { color: colors.muted, flex: 1 }]}>
            Chỉ xem trên điện thoại. Liên hệ quản trị viên để chỉnh sửa hồ sơ.
          </Text>
        </View>

        <View style={[styles.doctor, { borderColor: colors.line }]}>
          <MaterialCommunityIcons name="stethoscope" size={22} color={colors.accent} />
          <View style={styles.flex}>
            {data?.doctorError ? (
              <Pressable accessibilityRole="button" onPress={reload}>
                <Text style={[styles.meta, { color: colors.accent }]}>Thử lại</Text>
              </Pressable>
            ) : active ? (
              <>
                <Text style={[styles.rowTitle, { color: colors.ink }]}>
                  Bác sĩ phụ trách • {active.doctorName || medical.doctorFallback}
                </Text>
                <Text style={[styles.fine, { color: colors.muted }]}>
                  Đang phụ trách từ {formatMedicalWhen(active.startsAt)}
                </Text>
              </>
            ) : (
              <Text style={[styles.meta, { color: colors.muted }]}>{data ? medical.doctorsEmpty : medical.loading}</Text>
            )}
          </View>
        </View>

        <Row icon="file-document-outline" title="Hồ sơ nhập học" onPress={() => router.push("/ho-so-cua-toi" as Href)} />
        <Row
          icon="video-outline"
          title="Video / bằng chứng"
          detail="Video đã tải và trạng thái phân tích."
          onPress={() => router.push("/video" as Href)}
        />

        <View style={styles.themeRow}>
          <Text style={[styles.rowTitle, { color: colors.ink }]}>Giao diện</Text>
          <View style={[styles.toggle, { backgroundColor: colors.surface2 }]}>
            <ThemeChoice
              label="Sáng"
              icon="white-balance-sunny"
              selected={resolvedScheme === "light"}
              onPress={() => setMode("light")}
            />
            <ThemeChoice
              label="Tối"
              icon="moon-waning-crescent"
              selected={resolvedScheme === "dark"}
              onPress={() => setMode("dark")}
            />
          </View>
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel={fighter.me.logout} onPress={onLogout} style={styles.logout}>
          <MaterialCommunityIcons name="logout" size={18} color={colors.accent} />
          <Text style={[styles.logoutLabel, { color: colors.accent }]}>Đăng xuất</Text>
        </Pressable>
      </View>
    </FighterHub>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const colors = useFighterPalette();
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: colors.ink }]}>{value}</Text>
      <Text style={[styles.fine, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  const colors = useFighterPalette();
  return (
    <View style={styles.flex}>
      <Text style={[styles.fine, { color: colors.muted }]}>{label}</Text>
      <Text style={[styles.factValue, { color: colors.ink }]}>{value}</Text>
    </View>
  );
}

function Row({
  icon,
  title,
  detail,
  onPress,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  detail?: string;
  onPress: () => void;
}) {
  const colors = useFighterPalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={detail ? `${title}. ${detail}` : title}
      onPress={onPress}
      style={[styles.row, { borderBottomColor: colors.line }]}
    >
      <MaterialCommunityIcons name={icon} size={20} color={colors.ink} />
      <View style={styles.flex}>
        <Text style={[styles.rowTitle, { color: colors.ink }]}>{title}</Text>
        {detail ? <Text style={[styles.meta, { color: colors.muted }]}>{detail}</Text> : null}
      </View>
      <MaterialCommunityIcons name="chevron-right" size={16} color={colors.muted} />
    </Pressable>
  );
}

function ThemeChoice({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useFighterPalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.choice, selected ? { backgroundColor: colors.bg } : null]}
    >
      <MaterialCommunityIcons name={icon} size={14} color={colors.ink} />
      <Text style={{ color: colors.ink, fontSize: 12, fontWeight: "500" }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 20, paddingBottom: 16, gap: 14 },
  title: { fontSize: 26, lineHeight: 36, fontWeight: "700" },
  identity: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 18, fontWeight: "700" },
  name: { fontSize: 21, lineHeight: 28, fontWeight: "700" },
  flex: { flex: 1, gap: 2 },
  gear: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  stats: { flexDirection: "row", borderRadius: 12, paddingVertical: 12 },
  stat: { flex: 1, alignItems: "center", gap: 3 },
  statValue: { fontSize: 12, fontWeight: "600", textAlign: "center" },
  facts: { gap: 10 },
  pair: { flexDirection: "row", gap: 16 },
  fine: { fontSize: 11, lineHeight: 15 },
  factValue: { fontSize: 13, lineHeight: 18, fontWeight: "600" },
  meta: { fontSize: 12, lineHeight: 17 },
  lock: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  doctor: { flexDirection: "row", gap: 12, alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 12 },
  row: { flexDirection: "row", gap: 12, alignItems: "center", minHeight: 48, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 12 },
  rowTitle: { fontSize: 14, fontWeight: "600" },
  themeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 },
  toggle: { flexDirection: "row", borderRadius: 99, padding: 3, gap: 3 },
  choice: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99 },
  logout: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
  logoutLabel: { fontSize: 13, fontWeight: "600" },
});
