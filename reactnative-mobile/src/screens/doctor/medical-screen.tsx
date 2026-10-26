import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";

import {
  getFighterMedical,
  getFighterMedicalSummary,
  type FighterMedicalSummary,
  type MedicalDossier,
  type MedicalExamination,
} from "@/api";
import {
  clearanceStatusLabel,
  decisionLabel,
  formatMedicalDay,
  formatMedicalWhen,
  jointLabel,
  jointStateLabel,
  scopeLabel,
  severityLabel,
} from "@/components/medical/medical-format";
import { doctor } from "@/i18n/doctor";
import { medical } from "@/i18n/medical";
import { doctorUi } from "@/i18n/doctor-ui";
import { spacing, type, useThemePreference } from "@/theme";

import { medicalBadgeId } from "./badge-colors";
import {
  DoctorChrome,
  DoctorPatientBar,
  DoctorScroll,
  FighterSwitchSheet,
  clinicalMessage,
  doctorMuted,
  doctorStyles,
} from "./doctor-chrome";
import { DoctorRetry, KeyValueList, SectionTitle, SummaryCard, useDoctorText } from "./doctor-ui";
import { DoctorCard } from "./doctor-chrome";
import { StatusBadge } from "./status-badge";
import { useRequestGuard } from "./request-guard";
import { useSelectedFighter } from "./selected-fighter";
import { doctorHref } from "@/navigation/role-href";
import { Icon, type IconName } from "@/components/icon";
import { MedicalOverviewSkeleton } from "@/components/screen-skeletons";
import { EligibilitySection } from "./eligibility";

function examLine(label: string, exam: MedicalExamination | null): string {
  if (!exam) return `${label}: ${doctorUi.noConclusion}`;
  return `${label}: ${decisionLabel(exam.decision)}`;
}

function Destination({
  icon,
  title,
  body,
  href,
}: {
  icon: IconName;
  title: string;
  body: string;
  href: Href;
}) {
  const { colors } = useThemePreference();
  const muted = doctorMuted(colors);
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(href)}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.md,
          paddingVertical: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Icon name={icon} size={20} tone="accent" />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[type.body, { color: colors.ink }]}>{title}</Text>
        <Text style={[type.caption, { color: muted }]} numberOfLines={1}>{body}</Text>
      </View>
      <Icon name="chevron" size={18} color={muted} />
    </Pressable>
  );
}

export function DoctorMedicalScreen() {
  const t = useDoctorText();
  const router = useRouter();
  const { fighter } = useSelectedFighter();
  const guard = useRequestGuard();
  const [summary, setSummary] = useState<FighterMedicalSummary | null>(null);
  const [dossier, setDossier] = useState<MedicalDossier | null>(null);
  const [summaryError, setSummaryError] = useState("");
  const [dossierError, setDossierError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sheet, setSheet] = useState(false);

  const loadSummary = useCallback(async (token: number, fighterId: string) => {
    try {
      const next = await getFighterMedicalSummary(fighterId);
      if (!guard.isCurrent(token)) return;
      setSummary(next);
      setSummaryError("");
    } catch (cause: unknown) {
      if (!guard.isCurrent(token)) return;
      setSummary(null);
      setSummaryError(clinicalMessage(cause));
    }
  }, [guard]);

  const loadDossier = useCallback(async (token: number, fighterId: string) => {
    try {
      const next = await getFighterMedical(fighterId);
      if (!guard.isCurrent(token)) return;
      setDossier(next);
      setDossierError("");
    } catch (cause: unknown) {
      if (!guard.isCurrent(token)) return;
      setDossier(null);
      setDossierError(clinicalMessage(cause));
    }
  }, [guard]);

  const load = useCallback(async () => {
    const token = guard.start();
    setSummary(null);
    setDossier(null);
    setSummaryError("");
    setDossierError("");
    if (!fighter) {
      setLoading(false);
      return;
    }
    setLoading(true);
    await Promise.all([loadSummary(token, fighter.id), loadDossier(token, fighter.id)]);
    if (guard.isCurrent(token)) setLoading(false);
  }, [fighter, guard, loadDossier, loadSummary]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Làm mới: giữ dữ liệu cũ, chỉ thay khi tải thành công; lỗi → toast. */
  const refresh = useCallback(async () => {
    if (!fighter) return;
    const token = guard.start();
    const [nextSummary, nextDossier] = await Promise.all([
      getFighterMedicalSummary(fighter.id),
      getFighterMedical(fighter.id),
    ]);
    if (!guard.isCurrent(token)) return;
    setSummary(nextSummary);
    setDossier(nextDossier);
    setSummaryError("");
    setDossierError("");
  }, [fighter, guard]);

  const clearanceBody = !summary
    ? summaryError || doctor.overview.dossierMissing
    : summary.activeClearance
      ? `${clearanceStatusLabel(summary.activeClearance.status)} · ${
          summary.activeClearance.validUntil
            ? doctorUi.validUntil(formatMedicalDay(summary.activeClearance.validUntil))
            : doctor.medical.noExpiry
        }`
      : doctor.medical.noClearance;

  const injuryBody = !summary
    ? summaryError || doctor.overview.dossierMissing
    : summary.activeInjuries.length === 0
      ? doctor.medical.noInjuries
      : summary.activeInjuries
          .map((injury) => `${jointLabel(injury.affectedJoint)} · ${severityLabel(injury.severity)}`)
          .join(", ");

  const recoveryBody = !dossier
    ? dossierError || doctor.overview.dossierMissing
    : dossier.activeRecoveryPlans.length === 0
      ? doctor.recovery.empty
      : dossier.activeRecoveryPlans.map((plan) => plan.title).join(", ");

  const examBody = !dossier
    ? dossierError || doctor.overview.dossierMissing
    : [
        examLine(scopeLabel("TRAINING"), dossier.currentExaminations.training),
        examLine(scopeLabel("COMPETITION"), dossier.currentExaminations.competition),
      ].join(" · ");

  const injuryCount = summary?.activeInjuries.length ?? dossier?.activeInjuries.length ?? 0;
  const requests = dossier?.openReviewRequests ?? [];

  return (
    <DoctorChrome title={doctor.overview.title} back>
      <FighterSwitchSheet visible={sheet} onClose={() => setSheet(false)} />
      {!fighter ? (
        <Text style={t.value}>{doctor.pickFighterHint}</Text>
      ) : (
        <DoctorScroll contentContainerStyle={doctorStyles.list} onRefresh={refresh}>
          <DoctorPatientBar onChange={() => setSheet(true)} />
          {loading && !summary && !dossier ? (
            <MedicalOverviewSkeleton />
          ) : (
            <>

              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }}>
                <Text style={t.section}>{doctor.overview.currentStatus}</Text>
                {summary ? (
                  <StatusBadge id={medicalBadgeId(summary.currentMedicalStatus)} label={doctor.status[summary.currentMedicalStatus]} />
                ) : null}
              </View>
    
              <EligibilitySection dossier={dossier} error={dossierError} />
              <DoctorRetry error={dossierError || summaryError} onRetry={() => void load()} />
    
              {dossier && (requests.length > 0 || injuryCount > 0) ? (
                <>
                  <SectionTitle text={doctorUi.needsAction} />
                  {requests.map((row) => (
                    <SummaryCard
                      key={row.id}
                      title={doctor.overview.requests}
                      badges={<StatusBadge id={`review.${row.status}`} label={doctor.review[row.status]} />}
                      meta={formatMedicalWhen(row.requestedAt)}
                      preview={row.reason}
                      onPress={() => router.push(doctorHref.records)}
                    />
                  ))}
                </>
              ) : null}
    
              <SectionTitle text={doctor.overview.open} />
              <View>
                <Destination icon="medicalRecord" title={medical.dossierTitle} body={doctor.overview.recordsHint} href={doctorHref.records} />
                <Destination icon="clearance" title={doctor.medical.clearance} body={clearanceBody} href={doctorHref.clearance} />
                <Destination icon="injury" title={doctor.medical.injuries} body={injuryBody} href={doctorHref.injuries} />
                <Destination icon="body" title={medical.recoveryPlans} body={recoveryBody} href={doctorHref.recovery} />
                <Destination icon="plans" title={medical.examsTab} body={examBody} href={doctorHref.examinations} />
                <Destination icon="aiAlert" title={doctor.overview.aiAlerts} body={doctor.overview.aiAlertsBody} href={doctorHref.aiAlerts} />
              </View>
    
              {summary && summary.jointStates.length > 0 ? (
                <>
                  <SectionTitle text={doctor.medical.joints} />
                  <DoctorCard>
                    <KeyValueList rows={summary.jointStates.map((joint) => ({ label: jointLabel(joint.joint), value: jointStateLabel(joint.currentState) }))} />
                  </DoctorCard>
                </>
              ) : null}
            </>
          )}
        </DoctorScroll>
      )}
    </DoctorChrome>
  );
}

