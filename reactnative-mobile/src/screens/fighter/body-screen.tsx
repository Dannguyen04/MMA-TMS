import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";

import { getFighterMedical, type MedicalDossier, type MedicalEligibility, type ReviewRequestStatus } from "@/api";
import { useToastMessage } from "@/components/toast/app-toast";
import { clearanceTypeLabel, decisionLabel, eligibilityReasonLabel } from "@/components/medical/medical-format";
import { medical } from "@/i18n/medical";
import {
  initialBodyChrome,
  keepBodyChrome,
  measurementAvailability,
  selectBodySection,
  withExamFilter,
  withExamReason,
} from "@/screens/fighter/redesign/body-section";
import { ExamRequestSection } from "@/screens/fighter/redesign/exam-requests";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { FighterHub, HubHeader } from "@/screens/fighter/redesign/shell";
import { useFighterId } from "@/screens/fighter/use-fighter-id";
import { useLoad } from "@/screens/fighter/use-load";

function examLine(exam: { decision: string } | null): string {
  if (!exam) return "chưa có";
  return decisionLabel(exam.decision);
}

export function FighterBodyScreen() {
  const colors = useFighterPalette();
  const router = useRouter();
  const { fighterId, user, canFetch } = useFighterId();
  const [chrome, setChrome] = useState(initialBodyChrome);
  const measurements = measurementAvailability(user?.role);

  const loadDossier = useCallback(async () => {
    if (!fighterId) throw new Error("missing");
    return getFighterMedical(fighterId);
  }, [fighterId]);
  const dossier = useLoad(canFetch, `dossier:${fighterId ?? "none"}`, loadDossier);
  useToastMessage(dossier.error, "error");

  const data = dossier.data;
  const training = data?.eligibility.training;
  const competition = data?.eligibility.competition;

  const showHealth = chrome.section === "health";

  return (
    <FighterHub keyboard refreshing={dossier.loading && !data}>
      <HubHeader title="Cơ thể" />
      <View style={styles.pad}>
        <View accessibilityRole="tablist" style={styles.tabs}>
          <SectionTab
            label="Hồ sơ sức khỏe"
            selected={showHealth}
            onPress={() => setChrome((current) => selectBodySection(current, "health"))}
          />
          <SectionTab
            label="Yêu cầu khám"
            selected={!showHealth}
            onPress={() => setChrome((current) => selectBodySection(current, "exam"))}
          />
        </View>

        <View style={showHealth ? undefined : styles.hidden}>
          {dossier.error ? (
            <Pressable accessibilityRole="button" onPress={dossier.reload}>
              <Text style={[styles.meta, { color: colors.accent }]}>Thử lại</Text>
            </Pressable>
          ) : null}

          {data && training && competition ? (
            <>
              <View style={styles.cards}>
                <EligibilityCard scope="Tập luyện" eligibility={training} />
                <EligibilityCard scope="Thi đấu" eligibility={competition} />
              </View>
              <Text style={[styles.meta, { color: colors.muted }]}>
                Điều kiện tập và thi đấu là hai kết luận riêng. Giới hạn còn phụ thuộc loại buổi tập. Đối kháng vẫn có thể bị giới hạn dù đủ điều kiện tập luyện.
              </Text>
              <Profile data={data} onHistory={() => router.push("/suc-khoe/lich-su" as Href)} />
            </>
          ) : !dossier.error ? (
            <Text style={[styles.meta, { color: colors.muted }]}>
              {dossier.loading ? medical.loading : "Hồ sơ y tế sẽ hiện khi hệ thống trả về."}
            </Text>
          ) : null}

          {measurements.mayRead ? null : (
            <View style={{ gap: 4 }}>
              <Text style={[styles.section, { color: colors.ink }]}>Số đo</Text>
              <Text style={[styles.meta, { color: colors.muted }]}>{measurements.message}</Text>
            </View>
          )}

          <Text style={[styles.fine, { color: colors.muted }]}>
            Hồ sơ trên hệ thống không thay thế lời khuyên y tế trực tiếp. Nếu lo về sức khỏe, hãy gặp bác sĩ.
          </Text>
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
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useFighterPalette();
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.tab, { backgroundColor: selected ? colors.accent : colors.surface2 }]}
    >
      <Text style={[styles.tabLabel, { color: selected ? colors.onAccent : colors.ink }]}>{label}</Text>
    </Pressable>
  );
}

function EligibilityCard({
  scope,
  eligibility,
}: {
  scope: string;
  eligibility: MedicalEligibility;
}) {
  const colors = useFighterPalette();
  const ok = eligibility.eligible;
  const tone = ok ? colors.success : colors.warning;
  const bg = ok ? colors.successSoft : colors.warningSoft;
  return (
    <View style={[styles.card, { backgroundColor: bg }]} accessibilityLabel={`${scope}: ${ok ? "Đủ điều kiện" : "Chưa đủ điều kiện"}`}>
      <MaterialCommunityIcons name={ok ? "shield-check" : "shield-off-outline"} size={22} color={tone} />
      <Text style={[styles.cardLabel, { color: tone }]}>{scope}</Text>
      <Text style={[styles.cardValue, { color: tone }]}>{ok ? "Đủ điều kiện" : "Chưa đủ điều kiện"}</Text>
      {eligibility.reasons.length > 0 ? (
        <Text style={[styles.fine, { color: tone }]}>
          {eligibility.reasons.map((code) => eligibilityReasonLabel(code)).join(" · ")}
        </Text>
      ) : null}
    </View>
  );
}

function Profile({ data, onHistory }: { data: MedicalDossier; onHistory: () => void }) {
  const colors = useFighterPalette();
  const licenseLine =
    data.activeClearances.length === 0
      ? "Chưa có giấy phép được lưu"
      : data.activeClearances
          .map((item) => clearanceTypeLabel(item.clearanceType))
          .join(" · ");
  const injuryLine =
    data.activeInjuries.length === 0
      ? "Không có chấn thương đang theo dõi"
      : `${data.activeInjuries.length} chấn thương đang theo dõi`;
  const recoveryLine =
    data.activeRecoveryPlans.length === 0
      ? "Không có kế hoạch phục hồi đang hoạt động"
      : data.activeRecoveryPlans.map((plan) => plan.title).join(" · ");

  return (
    <View>
      <Text style={[styles.section, { color: colors.ink }]}>Hồ sơ hiện tại</Text>
      <Record icon="file-document-outline" title="Kết luận lâm sàng" detail={`Tập luyện: ${examLine(data.currentExaminations.training)} • Thi đấu: ${examLine(data.currentExaminations.competition)}`} />
      <Record icon="badge-account-horizontal-outline" title="Giấy phép" detail={licenseLine} />
      <Record icon="pulse" title="Chấn thương" detail={injuryLine} />
      <Record icon="heart-pulse" title="Phục hồi" detail={recoveryLine} />
      <Pressable accessibilityRole="button" onPress={onHistory} style={[styles.record, { borderBottomColor: colors.line }]}>
        <MaterialCommunityIcons name="history" size={20} color={colors.ink} />
        <Text style={[styles.recordTitle, { color: colors.ink, flex: 1 }]}>Lịch sử sức khỏe</Text>
        <MaterialCommunityIcons name="chevron-right" size={16} color={colors.muted} />
      </Pressable>
      <Text style={[styles.meta, { color: colors.muted, marginTop: 12 }]}>
        Danh sách giấy phép không xác nhận hiệu lực hiện tại. Kết luận đạt vẫn cần giấy phép do bác sĩ cấp phù hợp với kết luận hiện hành.
      </Text>
      <View style={[styles.divider, { backgroundColor: colors.line }]} />
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
  tab: { flex: 1, minHeight: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  tabLabel: { fontSize: 14, lineHeight: 20, fontWeight: "600", textAlign: "center" },
  hidden: { display: "none" },
  cards: { flexDirection: "row", gap: 10 },
  card: { flex: 1, borderRadius: 12, padding: 14, gap: 8 },
  cardLabel: { fontSize: 12, lineHeight: 17 },
  cardValue: { fontSize: 15, lineHeight: 21, fontWeight: "700" },
  section: { fontSize: 16, lineHeight: 22, fontWeight: "700", marginBottom: 4 },
  record: { flexDirection: "row", gap: 12, alignItems: "center", paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  recordTitle: { fontSize: 14, lineHeight: 20, fontWeight: "600" },
  meta: { fontSize: 12, lineHeight: 17 },
  fine: { fontSize: 11, lineHeight: 16 },
  flex: { flex: 1, gap: 3 },
  divider: { height: 1, marginTop: 20 },
});
