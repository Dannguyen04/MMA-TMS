import { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { isFighterProfile } from "@/api";
import { AuthButton } from "@/components/auth/auth-button";
import { ThemeToggle } from "@/components/auth/theme-toggle";
import { DoctorAssignmentList } from "@/components/medical/doctor-assignment-list";
import { getMe } from "@/screens/fighter/api";
import { fighter } from "@/i18n/fighter";
import { formatDay, stanceLabel, weightClassLabel } from "@/screens/fighter/format";
import {
  EmptyCopy,
  FighterScreen,
  GlassCard,
  SectionLabel,
  StatusLine,
} from "@/screens/fighter/screen";
import { useFighterId } from "@/screens/fighter/use-fighter-id";
import { useLoad } from "@/screens/fighter/use-load";
import { useSession } from "@/session/session-context";
import { spacing, type, useThemePreference } from "@/theme";

/**
 * Personal profile reads `/users/me` only. Fighter baseline has no `fighter:*`
 * permission, so `/fighters/:id`, its PATCH and `/fighters/:id/coaches` are not used.
 */
export function FighterMeScreen() {
  const { colors } = useThemePreference();
  const router = useRouter();
  const { signOut } = useSession();
  const { fighterId, profile, user, isDemo, canFetch } = useFighterId();

  const load = useCallback(() => getMe(), []);
  const { data, error, loading, reload } = useLoad(canFetch, fighterId ?? "none", load);

  const me = data ?? user;
  const row = me && isFighterProfile(me.profile) ? me.profile : profile;

  const onLogout = () => {
    void signOut().then(() => {
      router.replace("/login");
    });
  };

  const facts: { label: string; value: string }[] = row
    ? [
        { label: fighter.me.lastName, value: row.lastName },
        { label: fighter.me.firstName, value: row.firstName },
        { label: fighter.me.dateOfBirth, value: formatDay(row.dateOfBirth) },
        { label: fighter.me.weightClass, value: weightClassLabel(row.weightClass) },
        { label: fighter.me.stance, value: stanceLabel(row.dominantStance) },
        { label: fighter.me.height, value: row.heightCm != null ? String(row.heightCm) : "—" },
        { label: fighter.me.reach, value: row.reachCm != null ? String(row.reachCm) : "—" },
        { label: fighter.me.nationality, value: row.nationality ?? "—" },
        { label: fighter.me.gym, value: row.gym ?? "—" },
      ]
    : [];

  return (
    <FighterScreen title={fighter.me.title} refreshing={loading}>
      <View style={styles.themeRow}>
        <ThemeToggle />
      </View>
      <StatusLine message={error} onRetry={reload} />
      {isDemo || !canFetch ? <EmptyCopy text={fighter.common.demoHint} /> : null}

      <SectionLabel text={fighter.me.profile} />
      <GlassCard>
        <Text style={[type.caption, styles.meta, { color: colors.inkMuted }]}>
          {fighter.me.email}: {me?.email ?? "—"}
        </Text>
        {facts.length > 0 ? (
          facts.map((item) => (
            <View key={item.label} style={styles.row}>
              <Text style={[type.caption, styles.meta, { color: colors.inkMuted }]}>{item.label}</Text>
              <Text style={[type.body, { color: colors.ink }]}>{item.value}</Text>
            </View>
          ))
        ) : (
          <EmptyCopy text={loading ? fighter.common.loading : fighter.me.noProfile} />
        )}
        {row?.bio ? (
          <View style={styles.row}>
            <Text style={[type.caption, styles.meta, { color: colors.inkMuted }]}>{fighter.me.bio}</Text>
            <Text style={[type.body, { color: colors.ink }]}>{row.bio}</Text>
          </View>
        ) : null}
        <Text style={[type.caption, styles.meta, { color: colors.inkMuted }]}>
          {fighter.me.readOnlyHint}
        </Text>
      </GlassCard>

      {fighterId ? (
        <DoctorAssignmentList fighterId={fighterId} enabled={canFetch} />
      ) : null}

      <AuthButton title="Hồ sơ nhập học" variant="secondary" onPress={() => router.push("/ho-so-cua-toi" as never)} />
      <AuthButton title="Thông báo" variant="secondary" onPress={() => router.push("/thong-bao" as never)} />
      <AuthButton title="Cài đặt" variant="secondary" onPress={() => router.push("/cai-dat" as never)} />
      <AuthButton title="Video" variant="secondary" onPress={() => router.push("/video" as never)} />
      <AuthButton title={fighter.me.logout} variant="secondary" onPress={onLogout} />
    </FighterScreen>
  );
}

const styles = StyleSheet.create({
  themeRow: { alignItems: "flex-end" },
  row: { gap: 2, paddingVertical: spacing.xs },
  meta: { lineHeight: 16 },
});
