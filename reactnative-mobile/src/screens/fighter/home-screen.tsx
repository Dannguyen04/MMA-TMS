import { useCallback } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { useRouter, type Href } from "expo-router";

import { getMe, listPlansForFighter, listSessionsForFighter } from "@/screens/fighter/api";
import { getFighterMedical, isFighterProfile, type MedicalDossier } from "@/api";
import { EligibilityLine } from "@/components/medical/medical-dossier-view";
import { mapFighterError } from "@/screens/fighter/errors";
import { fighter } from "@/i18n/fighter";
import { medical as medicalCopy } from "@/i18n/medical";
import {
  displayName,
  formatWhen,
  planStatusLabel,
  sessionStatusLabel,
  sessionTypeLabel,
  weightClassLabel,
} from "@/screens/fighter/format";
import {
  EmptyCopy,
  FighterScreen,
  GlassCard,
  SectionLabel,
  StatusLine,
} from "@/screens/fighter/screen";
import { useFighterId } from "@/screens/fighter/use-fighter-id";
import { useLoad } from "@/screens/fighter/use-load";
import { type, useThemePreference } from "@/theme";

function startOfWeek(now: Date): Date {
  const day = now.getDay();
  const offset = day === 0 ? 6 : day - 1;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - offset);
  return start;
}

export function FighterHomeScreen() {
  const { colors } = useThemePreference();
  const router = useRouter();
  const { fighterId, profile, user, isDemo, canFetch } = useFighterId();

  const load = useCallback(async () => {
    if (!fighterId) {
      return { me: user, sessions: [], plans: [], medical: null as MedicalDossier | null };
    }
    const [meResult, sessionsResult, plansResult, medicalResult] = await Promise.allSettled([
      getMe(),
      listSessionsForFighter({ page: 1, limit: 20 }),
      listPlansForFighter(fighterId, { page: 1, limit: 5 }),
      getFighterMedical(fighterId),
    ]);
    const firstError = [meResult, sessionsResult, plansResult].find(
      (item) => item.status === "rejected",
    );
    if (
      meResult.status === "rejected" &&
      sessionsResult.status === "rejected" &&
      plansResult.status === "rejected"
    ) {
      throw meResult.reason;
    }
    return {
      me: meResult.status === "fulfilled" ? meResult.value : user,
      sessions: sessionsResult.status === "fulfilled" ? sessionsResult.value.data : [],
      plans: plansResult.status === "fulfilled" ? plansResult.value.data : [],
      medical: medicalResult.status === "fulfilled" ? medicalResult.value : null,
      medicalError: medicalResult.status === "rejected" ? medicalResult.reason : null,
      partial: firstError && firstError.status === "rejected" ? firstError.reason : null,
    };
  }, [fighterId, user]);

  const { data, error, loading, reload } = useLoad(canFetch, fighterId ?? "none", load);

  const meProfile = data?.me?.profile ?? profile;
  const fighterMe = isFighterProfile(meProfile) ? meProfile : profile;
  const first = fighterMe?.firstName ?? "";
  const last = fighterMe?.lastName ?? "";
  const weight = fighterMe?.weightClass;
  const name = displayName(first, last) || user?.email || "";
  const sessions = data?.sessions ?? [];
  const plans = data?.plans ?? [];
  const weekStart = startOfWeek(new Date());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekSessions = sessions.filter((row) => {
    const when = new Date(row.scheduledAt);
    return when >= weekStart && when < weekEnd;
  });
  const emptyHint = isDemo || !canFetch ? fighter.common.demoHint : "";
  const banner =
    error || (data?.partial ? mapFighterError(data.partial) : "");
  const medical = data?.medical;

  return (
    <FighterScreen title={fighter.home.title} refreshing={loading}>
      <Text style={[type.title, { color: colors.ink }]}>
        {fighter.home.greeting}
        {name ? `, ${name}` : ""}
      </Text>
      {weight ? (
        <Text style={[type.body, { color: colors.inkMuted }]}>
          {fighter.me.weightClass}: {weightClassLabel(weight)}
        </Text>
      ) : null}

      <StatusLine message={banner} onRetry={reload} />

      <SectionLabel text={fighter.home.health} />
      <GlassCard>
        {medical ? (
          <>
            <EligibilityLine
              eligibility={medical.eligibility.training}
              label={medicalCopy.eligibilityTraining}
            />
            {medical.openReviewRequests.length > 0 ? (
              <Text style={[type.caption, styles.meta, { color: colors.inkMuted }]}>
                {medicalCopy.openRequests}: {medical.openReviewRequests.length}
              </Text>
            ) : null}
            <Text style={[type.caption, styles.meta, { color: colors.inkMuted }]}>
              {medicalCopy.disclaimer}
            </Text>
          </>
        ) : (
          <EmptyCopy
            text={
              data?.medicalError
                ? mapFighterError(data.medicalError)
                : emptyHint || (loading ? fighter.common.loading : medicalCopy.disclaimer)
            }
          />
        )}
      </GlassCard>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.replace("/co-the" as Href)}
        style={styles.link}
      >
        <Text style={[type.link, { color: colors.lotus }]}>{fighter.home.seeHealth}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/suc-khoe/lich-su" as Href)}
        style={styles.link}
      >
        <Text style={[type.link, { color: colors.lotus }]}>Lịch sử sức khỏe</Text>
      </Pressable>

      <Text style={[type.caption, styles.meta, { color: colors.inkMuted }]}>
        {fighter.home.noScore}
      </Text>
      <Pressable accessibilityRole="button" onPress={() => router.push("/video" as Href)} style={styles.link}>
        <Text style={[type.link, { color: colors.lotus }]}>Video / bằng chứng</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.push("/muc-tieu" as Href)} style={styles.link}>
        <Text style={[type.link, { color: colors.lotus }]}>Mục tiêu</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.push("/hieu-suat" as Href)} style={styles.link}>
        <Text style={[type.link, { color: colors.lotus }]}>Hiệu suất</Text>
      </Pressable>

      <SectionLabel text={fighter.home.thisWeek} />
      <GlassCard>
        {weekSessions.length > 0 ? (
          weekSessions.map((row) => (
            <Pressable
              key={row.id}
              accessibilityRole="button"
              onPress={() => router.push(`/tap/${row.id}` as Href)}
              style={styles.row}
            >
              <Text style={[type.body, { color: colors.ink }]}>{row.title}</Text>
              <Text style={[type.caption, styles.meta, { color: colors.inkMuted }]}>
                {formatWhen(row.scheduledAt)} · {sessionTypeLabel(row.sessionType)} ·{" "}
                {sessionStatusLabel(row.status)}
              </Text>
            </Pressable>
          ))
        ) : (
          <EmptyCopy text={emptyHint || fighter.home.emptySessions} />
        )}
      </GlassCard>

      <SectionLabel text={fighter.home.recentSessions} />
      <GlassCard>
        {sessions.length > 0 ? (
          sessions.slice(0, 5).map((row) => (
            <Pressable
              key={row.id}
              accessibilityRole="button"
              onPress={() => router.push(`/tap/${row.id}` as Href)}
              style={styles.row}
            >
              <Text style={[type.body, { color: colors.ink }]}>{row.title}</Text>
              <Text style={[type.caption, styles.meta, { color: colors.inkMuted }]}>
                {formatWhen(row.scheduledAt)} · {sessionTypeLabel(row.sessionType)} ·{" "}
                {sessionStatusLabel(row.status)}
              </Text>
            </Pressable>
          ))
        ) : (
          <EmptyCopy text={emptyHint || fighter.home.emptySessions} />
        )}
      </GlassCard>
      <Pressable accessibilityRole="button" onPress={() => router.replace("/tap" as Href)} style={styles.link}>
        <Text style={[type.link, { color: colors.lotus }]}>{fighter.home.seeAllSessions}</Text>
      </Pressable>

      <SectionLabel text={fighter.home.plans} />
      <GlassCard>
        {plans.length > 0 ? (
          plans.map((row) => (
            <Pressable
              key={row.id}
              accessibilityRole="button"
              onPress={() => router.push(`/giao-an/${row.id}` as Href)}
              style={styles.row}
            >
              <Text style={[type.body, { color: colors.ink }]}>{row.title}</Text>
              <Text style={[type.caption, styles.meta, { color: colors.inkMuted }]}>
                {planStatusLabel(row.status)}
                {row.progress
                  ? ` · ${row.progress.completedSessions}/${row.progress.totalSessions} ${fighter.home.sessionsCount}`
                  : ""}
              </Text>
            </Pressable>
          ))
        ) : (
          <EmptyCopy text={emptyHint || fighter.home.emptyPlans} />
        )}
      </GlassCard>
      <Pressable accessibilityRole="button" onPress={() => router.replace("/giao-an" as Href)} style={styles.link}>
        <Text style={[type.link, { color: colors.lotus }]}>{fighter.home.seeAllPlans}</Text>
      </Pressable>
    </FighterScreen>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 44, justifyContent: "center", gap: 2 },
  meta: { lineHeight: 16 },
  link: { minHeight: 44, justifyContent: "center" },
});
