import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";

import { getFighterMedical, type MedicalDossier, type ReviewRequestStatus } from "@/api";
import { useToastMessage } from "@/components/toast/app-toast";
import { clearanceTypeLabel, decisionLabel } from "@/components/medical/medical-format";
import { fighterBody as t } from "@/i18n/fighter-body";
import { EligibilityTiles, HealthInfoButton, TodayCard } from "@/screens/fighter/redesign/health-status";
import {
  initialBodyChrome,
  keepBodyChrome,
  selectBodySection,
  withExamFilter,
  withExamReason,
} from "@/screens/fighter/redesign/body-section";
import { ExamRequestSection } from "@/screens/fighter/redesign/exam-requests";
import { MedicalReviewAction } from "@/screens/one-tap/medical-review-action";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { FighterHub, HubHeader } from "@/screens/fighter/redesign/shell";
import { useFighterId } from "@/screens/fighter/use-fighter-id";
import { useLoad } from "@/screens/fighter/use-load";
import { HealthDossierSkeleton } from "@/components/screen-skeletons";

export function FighterBodyScreen() {
  const colors = useFighterPalette();
  const router = useRouter();
  const { fighterId, canFetch } = useFighterId();
  const [chrome, setChrome] = useState(initialBodyChrome);

  const loadDossier = useCallback(async () => {
    if (!fighterId) throw new Error("missing");
    return getFighterMedical(fighterId);
  }, [fighterId]);
  const dossier = useLoad(canFetch, `dossier:${fighterId ?? "none"}`, loadDossier);
  useToastMessage(dossier.error, "error");

  const data = dossier.data;
  const pendingCount = data?.openReviewRequests.length ?? 0;
  const showHealth = chrome.section === "health";
  const toExam = () => setChrome((current) => selectBodySection(current, "exam"));

  return (
    <FighterHub keyboard refreshing={dossier.loading && !data} onRefresh={dossier.refresh}>
      <HubHeader title={t.title} trailing={<HealthInfoButton />} />
      <View style={styles.pad}>
        <View accessibilityRole="tablist" style={styles.tabs}>
          <SectionTab
            label={t.tabHealth}
            selected={showHealth}
            onPress={() => setChrome((current) => selectBodySection(current, "health"))}
          />
          <SectionTab
            label={t.tabExam}
            count={pendingCount}
            selected={!showHealth}
            onPress={toExam}
          />
        </View>

        <View style={[styles.stack, showHealth ? undefined : styles.hidden]}>
          {dossier.error ? (
            <Pressable accessibilityRole="button" onPress={dossier.reload} style={styles.retry}>
              <Text style={[styles.link, { color: colors.accent }]}>{t.retry}</Text>
            </Pressable>
          ) : null}

          {data ? (
            <>
              <TodayCard dossier={data} onRequest={toExam} />
              <EligibilityTiles dossier={data} onRequest={toExam} />
              <Profile data={data} onHistory={() => router.push("/suc-khoe/lich-su" as Href)} />
            </>
          ) : dossier.loading && !dossier.error ? (
            <HealthDossierSkeleton />
          ) : !dossier.error ? (
            <Text style={[styles.meta, { color: colors.muted }]}>{t.empty}</Text>
          ) : null}
          {/* Yêu cầu khám lại: ẩn khi dossier có yêu cầu đang mở; không đọc được dossier thì 409 từ máy chủ vẫn ra chip. */}
          {fighterId && (data || !dossier.loading) ? (
            <MedicalReviewAction fighterId={fighterId} openCount={pendingCount} onSent={dossier.reload} />
          ) : null}
        </View>

        <View style={showHealth ? styles.hidden : undefined}>
          {fighterId ? (
            <ExamRequestSection
              fighterId={fighterId}
              enabled={canFetch}
              onSubmitted={dossier.reload}
              status={chrome.filter as ReviewRequestStatus | ""}
              onStatusChange={(filter) => setChrome((current) => withExamFilter(keepBodyChrome(current), filter))}
              reason={chrome.reason}
              onReasonChange={(reason) => setChrome((current) => withExamReason(keepBodyChrome(current), reason))}
            />
          ) : null}
        </View>
      </View>
    </FighterHub>
  );
}

function SectionTab({
  label,
  selected,
  onPress,
  count = 0,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  count?: number;
}) {
  const colors = useFighterPalette();
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={count > 0 ? t.tabExamCount(count) : label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.tab, { backgroundColor: selected ? colors.accent : colors.surface2 }]}
    >
      <Text style={[styles.tabLabel, { color: selected ? colors.onAccent : colors.ink }]}>{label}</Text>
      {count > 0 ? (
        <View style={[styles.badge, { backgroundColor: selected ? colors.onAccent : colors.accent }]}>
          <Text style={[styles.badgeText, { color: selected ? colors.accent : colors.onAccent }]}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** Chỉ hiện mục có dữ liệu; lịch sử luôn ở cuối. */
function Profile({ data, onHistory }: { data: MedicalDossier; onHistory: () => void }) {
  const colors = useFighterPalette();
  const exams = [
    data.currentExaminations.training ? `${t.scope.training}: ${decisionLabel(data.currentExaminations.training.decision)}` : null,
    data.currentExaminations.competition ? `${t.scope.competition}: ${decisionLabel(data.currentExaminations.competition.decision)}` : null,
  ].filter(Boolean);
  const rows: { icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string; detail: string }[] = [];
  if (exams.length) rows.push({ icon: "file-document-outline", title: t.records.exam, detail: exams.join(" · ") });
  if (data.activeClearances.length)
    rows.push({ icon: "badge-account-horizontal-outline", title: t.records.clearance, detail: [...new Set(data.activeClearances.map((c) => clearanceTypeLabel(c.clearanceType)))].join(" · ") });
  if (data.activeInjuries.length) rows.push({ icon: "pulse", title: t.records.injuries, detail: t.records.injuryCount(data.activeInjuries.length) });
  if (data.activeRecoveryPlans.length)
    rows.push({ icon: "heart-pulse", title: t.records.recovery, detail: data.activeRecoveryPlans.map((plan) => plan.title).join(" · ") });

  return (
    <View>
      <Text accessibilityRole="header" style={[styles.section, { color: colors.ink }]}>{t.records.title}</Text>
      {rows.length === 0 ? <Text style={[styles.meta, { color: colors.muted, paddingVertical: 8 }]}>{t.records.none}</Text> : null}
      {rows.map((row) => (
        <Record key={row.title} icon={row.icon} title={row.title} detail={row.detail} />
      ))}
      <Pressable accessibilityRole="button" onPress={onHistory} style={[styles.record, { borderBottomColor: colors.line }]}>
        <MaterialCommunityIcons name="history" size={20} color={colors.ink} />
        <Text style={[styles.recordTitle, { color: colors.ink, flex: 1 }]}>{t.records.history}</Text>
        <MaterialCommunityIcons name="chevron-right" size={18} color={colors.muted} />
      </Pressable>
    </View>
  );
}

function Record({
  icon,
  title,
  detail,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  detail: string;
}) {
  const colors = useFighterPalette();
  return (
    <View style={[styles.record, { borderBottomColor: colors.line }]}>
      <MaterialCommunityIcons name={icon} size={20} color={colors.ink} />
      <View style={styles.flex}>
        <Text style={[styles.recordTitle, { color: colors.ink }]}>{title}</Text>
        <Text style={[styles.meta, { color: colors.muted }]}>{detail}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 20, paddingBottom: 24, gap: 20 },
  tabs: { flexDirection: "row", gap: 8 },
  tab: { flex: 1, minHeight: 44, borderRadius: 12, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  tabLabel: { fontSize: 14, lineHeight: 20, fontWeight: "600", textAlign: "center" },
  hidden: { display: "none" },
  stack: { gap: 16 },
  retry: { minHeight: 44, justifyContent: "center" },
  link: { fontSize: 14, lineHeight: 20, fontWeight: "600" },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: "center", justifyContent: "center" },
  badgeText: { fontSize: 12, lineHeight: 16, fontWeight: "700" },
  section: { fontSize: 16, lineHeight: 22, fontWeight: "700", marginBottom: 4 },
  record: { flexDirection: "row", gap: 12, alignItems: "center", paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  recordTitle: { fontSize: 14, lineHeight: 20, fontWeight: "600" },
  meta: { fontSize: 12, lineHeight: 17 },
  flex: { flex: 1, gap: 3 },
});
