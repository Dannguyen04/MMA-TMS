import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";

import { getFighterMedical, isFighterProfile, listFighterDoctors, type MedicalDossier } from "@/api";
import { useToastMessage } from "@/components/toast/app-toast";
import { nextClinicalStep, type ClinicalStep } from "@/clinical/onboarding-step";
import { medical as medicalCopy } from "@/i18n/medical";
import { getMe, listPlansForFighter, listSessionsForFighter } from "@/screens/fighter/api";
import { mapFighterError } from "@/screens/fighter/errors";
import { displayName } from "@/screens/fighter/format";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { FighterHub, HubHeader } from "@/screens/fighter/redesign/shell";
import { formatWeekRange, isInWeek, sameLocalDay, startOfWeek, weekDays } from "@/screens/fighter/redesign/week";
import { useFighterId } from "@/screens/fighter/use-fighter-id";
import { useLoad } from "@/screens/fighter/use-load";
import type { TrainingPlan, TrainingSessionSummary } from "@/api";
import { fighterHref } from "@/navigation/role-href";
import { Icon, type IconName } from "@/components/icon";
import { FadeInView, PressableScale } from "@/components/motion";
import { Skeleton } from "@/components/motion";
import { FighterHomeSkeleton } from "@/components/screen-skeletons";
import { HomeBoutCard } from "@/screens/fighter/home-bout-card";

type HomeData = {
  firstName: string;
  sessions: TrainingSessionSummary[] | null;
  sessionsError: string;
  plans: TrainingPlan[] | null;
  plansError: string;
  medical: MedicalDossier | null;
  medicalError: string;
  hasActiveDoctor: boolean;
  doctorKnown: boolean;
};

function clinicalStepCopy(step: ClinicalStep): string {
  switch (step) {
    case "assign-doctor":
      return medicalCopy.stepAssignDoctor;
    case "baseline-exam":
      return medicalCopy.stepBaseline;
    case "clearance":
      return medicalCopy.stepClearance;
    case "eligible":
      return medicalCopy.stepEligible;
    case "not-eligible":
      return medicalCopy.stepBlocked;
  }
}

export function FighterHomeScreen() {
  const colors = useFighterPalette();
  const router = useRouter();
  const { fighterId, profile, user, canFetch } = useFighterId();

  const load = useCallback(async (): Promise<HomeData> => {
    const baseName = profile?.firstName ?? "";
    if (!fighterId) {
      return {
        firstName: baseName,
        sessions: [],
        sessionsError: "",
        plans: [],
        plansError: "",
        medical: null,
        medicalError: "",
        hasActiveDoctor: false,
        doctorKnown: false,
      };
    }
    const [meResult, sessionsResult, plansResult, medicalResult, doctorResult] = await Promise.allSettled([
      getMe(),
      listSessionsForFighter({ page: 1, limit: 50 }),
      listPlansForFighter(fighterId, { page: 1, limit: 20 }),
      getFighterMedical(fighterId),
      listFighterDoctors(fighterId, { page: 1, limit: 20 }),
    ]);
    const me = meResult.status === "fulfilled" ? meResult.value : user;
    const meProfile = me && isFighterProfile(me.profile) ? me.profile : profile;
    return {
      firstName: meProfile?.firstName ?? baseName,
      sessions: sessionsResult.status === "fulfilled" ? sessionsResult.value.data : null,
      sessionsError: sessionsResult.status === "rejected" ? mapFighterError(sessionsResult.reason) : "",
      plans: plansResult.status === "fulfilled" ? plansResult.value.data : null,
      plansError: plansResult.status === "rejected" ? mapFighterError(plansResult.reason) : "",
      medical: medicalResult.status === "fulfilled" ? medicalResult.value : null,
      medicalError: medicalResult.status === "rejected" ? mapFighterError(medicalResult.reason) : "",
      hasActiveDoctor:
        doctorResult.status === "fulfilled"
          ? doctorResult.value.data.some((row) => row.endsAt == null)
          : false,
      doctorKnown: doctorResult.status === "fulfilled",
    };
  }, [fighterId, profile, user]);

  const { data, loading, reload, refresh } = useLoad(canFetch, fighterId ?? "none", load);
  useToastMessage(data?.sessionsError, "error");
  useToastMessage(data?.medicalError, "error");
  useToastMessage(data?.plansError, "error");
  const now = new Date();
  const weekStart = startOfWeek(now);
  const days = weekDays(now);
  const sessions = data?.sessions;
  const weekSessions =
    sessions?.filter((row) => isInWeek(row.scheduledAt, weekStart)) ?? [];
  const recent = sessions
    ? [...sessions].sort((a, b) => +new Date(b.scheduledAt) - +new Date(a.scheduledAt)).slice(0, 3)
    : [];
  const greeting = data?.firstName ? `Chào ${data.firstName}` : "Chào";
  const training = data?.medical?.eligibility.training;
  const planCount = data?.plans?.length;
  const clinical =
    data?.medical && data.doctorKnown
      ? nextClinicalStep({
          hasActiveDoctor: data.hasActiveDoctor,
          eligible: data.medical.eligibility.training.eligible,
          reasons: data.medical.eligibility.training.reasons,
        })
      : null;

  return (
    <FighterHub refreshing={loading && !data} onRefresh={refresh}>
      <HubHeader
        title={greeting}
        trailing={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Thông báo"
            onPress={() => router.push(fighterHref.notifications)}
            style={[styles.bell, { backgroundColor: colors.surface2 }]}
          >
            <Icon name="notifications" size={22} color={colors.ink} />
          </Pressable>
        }
      />

      {loading && !data ? (
        <View style={styles.skeleton}>
          <FighterHomeSkeleton />
        </View>
      ) : (
        <>
      <View style={[styles.agenda, { backgroundColor: colors.agenda }]}>
          <View style={styles.rowBetween}>
            <Text style={[styles.agendaTitle, { color: colors.agendaInk }]}>Tuần của bạn</Text>
            <Text style={[styles.agendaMeta, { color: colors.agendaMuted }]}>{formatWeekRange(weekStart)}</Text>
          </View>
          <View style={styles.days}>
            {days.map((day) => {
              const hasSession = weekSessions.some((row) => sameLocalDay(row.scheduledAt, day.iso));
              return (
                <View
                  key={day.key}
                  accessibilityLabel={`${day.label} ${day.date}${day.isToday ? ", hôm nay" : ""}${hasSession ? ", có buổi tập" : ""}`}
                  style={[
                    styles.day,
                    { backgroundColor: day.isToday ? colors.accent : colors.day },
                  ]}
                >
                  <Text style={[styles.dayLabel, { color: day.isToday ? colors.onAccent : colors.agendaMuted }]}>
                    {day.label}
                  </Text>
                  <Text style={[styles.dayNum, { color: day.isToday ? colors.onAccent : colors.agendaInk }]}>
                    {String(day.date).padStart(2, "0")}
                  </Text>
                  <View
                    style={[
                      styles.marker,
                      { backgroundColor: day.isToday ? colors.onAccent : hasSession ? colors.accent : colors.marker },
                    ]}
                  />
                </View>
              );
            })}
          </View>
          {data?.sessionsError ? (
            <Pressable accessibilityRole="button" onPress={reload}>
              <Text style={[styles.agendaMeta, { color: colors.agendaInk }]}>Thử lại</Text>
            </Pressable>
          ) : (
            <View style={styles.countRow}>
              <Text style={[styles.count, { color: colors.agendaInk }]}>
                {sessions ? String(weekSessions.length) : "—"}
              </Text>
              <View style={styles.flex}>
                <Text style={[styles.agendaTitle, { color: colors.agendaInk }]}>Buổi tập trong tuần</Text>
                {loading && !data ? (
                  <Skeleton width="60%" height={14} />
                ) : (
                  <Text style={[styles.agendaMeta, { color: colors.agendaMuted }]}>
                    {sessions && weekSessions.length === 0
                      ? "Chưa có lịch tập được ghi nhận."
                      : sessions
                        ? "Các buổi đã được ghi trên hệ thống."
                        : "Chưa có lịch tập được ghi nhận."}
                  </Text>
                )}
              </View>
            </View>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mở danh sách buổi tập"
            onPress={() => router.push("/tap" as Href)}
            style={styles.openList}
          >
            <Text style={styles.openListLabel}>Mở danh sách buổi tập</Text>
            <Feather name="arrow-right" size={20} color={colors.agenda} />
          </Pressable>
        </View>
  
        <View style={styles.pad}>
          <HomeBoutCard />
          {clinical ? (
            <Text style={[styles.elig, { color: colors.ink }]}>{clinicalStepCopy(clinical.step)}</Text>
          ) : null}
          {data?.medicalError ? (
            <Pressable accessibilityRole="button" onPress={reload}>
              <Text style={[styles.meta, { color: colors.accent }]}>Thử lại</Text>
            </Pressable>
          ) : training ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Xem giới hạn tại Cơ thể"
              onPress={() => router.push("/co-the" as Href)}
              style={styles.eligRow}
            >
              <MaterialCommunityIcons
                name={training.eligible ? "shield-check" : "shield-off-outline"}
                size={18}
                color={training.eligible ? colors.success : colors.warning}
              />
              <Text style={[styles.elig, { color: training.eligible ? colors.success : colors.warning }]}>
                {training.eligible ? "Đủ điều kiện tập" : "Chưa đủ điều kiện tập"} · Xem giới hạn tại Cơ thể
              </Text>
            </Pressable>
          ) : (
            <Text style={[styles.meta, { color: colors.muted }]}>Điều kiện tập sẽ hiện khi hồ sơ y tế tải xong.</Text>
          )}
  
          <View style={styles.grid}>
            <Shortcut
              index={0}
              icon="plans"
              title="Giáo án"
              subtitle={
                data?.plansError ? "Không tải được" : planCount === 0 ? "Chưa được giao" : planCount ? `${planCount} giáo án` : loading ? "…" : "—"
              }
              onPress={() => router.push("/giao-an" as Href)}
            />
            <Shortcut
              index={1}
              icon="bodyFigure"
              title="Cơ thể & giấy phép"
              subtitle="Kiểm tra điều kiện"
              onPress={() => router.push("/co-the" as Href)}
            />
            <Shortcut
              index={2}
              icon="video"
              title="Video / bằng chứng"
              subtitle="Mở kho video"
              onPress={() => router.push("/video" as Href)}
            />
            <Shortcut
              index={3}
              icon="history"
              title="Lịch sử sức khỏe"
              subtitle="Hồ sơ y tế"
              onPress={() => router.push("/suc-khoe/lich-su" as Href)}
            />
          </View>
  
          <View style={styles.linkRow}>
            <LinkChip icon="goals" label="Mục tiêu" onPress={() => router.push("/muc-tieu" as Href)} />
            <LinkChip icon="performance" label="Hiệu suất" onPress={() => router.push("/hieu-suat" as Href)} />
          </View>
  
          {sessions && recent.length === 0 ? (
            <Text style={[styles.meta, { color: colors.muted }]}>
              Chưa có buổi tập gần đây. Hiệu suất sẽ được tổng hợp khi có dữ liệu buổi tập.
            </Text>
          ) : null}
          {recent.map((row, i) => (
            <FadeInView key={row.id} index={i}>
            <PressableScale
              accessibilityRole="button"
              onPress={() => router.push(`/tap/${row.id}` as Href)}
              style={[styles.recent, { borderBottomColor: colors.line }]}
            >
              <Text style={[styles.recentTitle, { color: colors.ink }]}>{row.title}</Text>
              <Text style={[styles.meta, { color: colors.muted }]}>
                {new Date(row.scheduledAt).toLocaleString("vi-VN")}
              </Text>
            </PressableScale>
            </FadeInView>
          ))}
          {!canFetch ? (
            <Text style={[styles.meta, { color: colors.muted }]}>
              {displayName(profile?.firstName ?? "", profile?.lastName ?? "")
                ? ""
                : "Đăng nhập võ sĩ để xem lịch và hồ sơ của bạn."}
            </Text>
          ) : null}
        </View>
        </>
      )}
    </FighterHub>
  );
}

function Shortcut({
  icon,
  title,
  subtitle,
  onPress,
  index = 0,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  onPress: () => void;
  index?: number;
}) {
  const colors = useFighterPalette();
  return (
    <FadeInView index={index} style={styles.shortcutCell}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${subtitle}`}
        onPress={onPress}
        style={[styles.shortcut, { backgroundColor: colors.surface2 }]}
      >
        <Icon name={icon} size={22} color={colors.accent} />
        <Text style={[styles.shortcutTitle, { color: colors.ink }]}>{title}</Text>
        <Text style={[styles.shortcutSub, { color: colors.muted }]}>{subtitle}</Text>
      </PressableScale>
    </FadeInView>
  );
}

function LinkChip({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  const colors = useFighterPalette();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.linkChip, { borderBottomColor: colors.line }]}
    >
      <Icon name={icon} size={20} color={colors.ink} />
      <Text style={[styles.linkLabel, { color: colors.ink }]}>{label}</Text>
      <Icon name="chevron" size={16} color={colors.muted} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  skeleton: { paddingHorizontal: 20 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingBottom: 16 },
  flex: { flex: 1 },
  eyebrow: { fontSize: 12, lineHeight: 17 },
  title: { fontSize: 26, lineHeight: 36, fontWeight: "700" },
  bell: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  agenda: { padding: 20, gap: 16 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  agendaTitle: { fontSize: 14, lineHeight: 20, fontWeight: "600" },
  agendaMeta: { fontSize: 12, lineHeight: 17 },
  days: { flexDirection: "row", gap: 4 },
  day: { flex: 1, height: 64, borderRadius: 12, alignItems: "center", paddingTop: 7, gap: 4 },
  dayLabel: { fontSize: 10, lineHeight: 14 },
  dayNum: { fontSize: 16, lineHeight: 22, fontWeight: "600" },
  marker: { width: 8, height: 2, borderRadius: 1 },
  countRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  count: { fontSize: 42, lineHeight: 42, fontWeight: "700" },
  openList: {
    height: 42,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  openListLabel: { color: "#20252B", fontSize: 14, fontWeight: "600" },
  pad: { paddingHorizontal: 20, paddingTop: 16, gap: 12 },
  eligRow: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44 },
  elig: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: "500" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  shortcutCell: { width: "48%", flexGrow: 1 },
  shortcut: { flex: 1, minHeight: 100, borderRadius: 12, padding: 12, gap: 7 },
  shortcutTitle: { fontSize: 13, lineHeight: 18, fontWeight: "600" },
  shortcutSub: { fontSize: 11, lineHeight: 15 },
  linkRow: { flexDirection: "row", gap: 18 },
  linkChip: {
    flex: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
  },
  linkLabel: { flex: 1, fontSize: 14, fontWeight: "600" },
  meta: { fontSize: 12, lineHeight: 17 },
  recent: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, gap: 2 },
  recentTitle: { fontSize: 14, fontWeight: "600" },
});
