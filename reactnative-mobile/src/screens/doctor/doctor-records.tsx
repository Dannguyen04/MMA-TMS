import { Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";

import type {
  MedicalClearance,
  MedicalDossier,
  MedicalExamination,
  MedicalInjury,
  MedicalRestrictions,
  MedicalReviewRequest,
  RecoveryPlan,
} from "@/api/types";
import { Icon } from "@/components/icon";
import {
  classifyMilestones,
  clearanceStatusLabel,
  clearanceTypeLabel,
  decisionLabel,
  formatMedicalDay,
  formatMedicalWhen,
  injuryStatusLabel,
  jointLabel,
  scopeLabel,
  sessionTypeName,
  severityLabel,
  techniqueLabel,
} from "@/components/medical/medical-format";
import { doctor } from "@/i18n/doctor";
import { doctorUi } from "@/i18n/doctor-ui";
import { medical } from "@/i18n/medical";
import { radius, spacing } from "@/theme";

import { clearanceStartsLater } from "./doctor-chrome";
import { ClampText, KeyValueList, SectionTitle, SummaryCard, useDoctorText, type KeyValue } from "./doctor-ui";
import { StatusBadge } from "./status-badge";
import { EligibilitySection } from "./eligibility";

/** Đường dẫn màn chi tiết kết luận (route tĩnh mới, không đụng file bracket). */
export function examDetailHref(examId: string): Href {
  return `/(doctor)/examinations/xem?examId=${encodeURIComponent(examId)}` as Href;
}

export function examTypeLabel(exam: MedicalExamination): string {
  if (!exam.details) return medical.currentExams;
  return doctor.exam.types[exam.details.examinationType as keyof typeof doctor.exam.types] ?? medical.currentExams;
}

export function restrictionRows(value: MedicalRestrictions | null): KeyValue[] {
  if (!value) return [];
  return [
    { label: medical.excludedJoints, value: value.excludedJoints?.map(jointLabel).join(", "), tone: "danger" },
    { label: medical.allowedSessionTypes, value: value.allowedSessionTypes?.map(sessionTypeName).join(", ") },
    { label: medical.allowedTechniqueTypes, value: value.allowedTechniqueTypes?.map(techniqueLabel).join(", ") },
    { label: medical.restrictionNotes, value: value.notes },
  ];
}

export function hasRestrictions(value: MedicalRestrictions | null): boolean {
  return restrictionRows(value).some((row) => row.value);
}

/** Thẻ tóm tắt kết luận khám: không in toàn văn lý do; mở màn chi tiết. */
export function ExamSummaryCard({ scope, exam }: { scope: string; exam: MedicalExamination | null }) {
  const router = useRouter();
  const t = useDoctorText();
  if (!exam) {
    return (
      <View style={{ flexDirection: "row", gap: spacing.sm, paddingVertical: spacing.xs }}>
        <Text style={t.value}>{scope}</Text>
        <Text style={t.meta}>· {doctorUi.noConclusion}</Text>
      </View>
    );
  }
  const meta = [
    doctorUi.examined(formatMedicalWhen(exam.examinedAt)),
    exam.validUntil ? doctorUi.validUntil(formatMedicalDay(exam.validUntil)) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <SummaryCard
      title={`${scope} · ${exam.details ? examTypeLabel(exam) : medical.currentExams}`}
      badges={<StatusBadge id={`exam.${exam.decision}`} label={decisionLabel(exam.decision)} />}
      meta={meta}
      preview={exam.details ? null : exam.reason}
      onPress={() => router.push(examDetailHref(exam.id))}
      actionLabel={doctorUi.viewDetail}
    />
  );
}

export function ClearanceSummaryCard({ row }: { row: MedicalClearance }) {
  const t = useDoctorText();
  const restrictions = restrictionRows(row.restrictions);
  return (
    <SummaryCard
      title={clearanceTypeLabel(row.clearanceType)}
      badges={<StatusBadge id={`clearance.${row.status}`} label={clearanceStatusLabel(row.status)} />}
      meta={
        clearanceStartsLater(row)
          ? doctor.clearance.notStarted
          : row.validUntil
            ? `${formatMedicalDay(row.validFrom)} → ${formatMedicalDay(row.validUntil)}`
            : `${formatMedicalDay(row.validFrom)} · ${doctor.medical.noExpiry}`
      }
    >
      {hasRestrictions(row.restrictions) ? (
        <View style={{ gap: 2, borderRadius: radius.field, padding: spacing.md, backgroundColor: t.colors.dangerSoft }}>
          <Text style={[t.meta, { color: t.colors.danger }]}>{doctorUi.restrictions}</Text>
          <KeyValueList rows={restrictions} />
        </View>
      ) : null}
      {row.notes ? <ClampText text={row.notes} label={medical.clearanceNotes} /> : null}
      {row.revokedReason ? <ClampText text={row.revokedReason} label={doctor.clearance.revokedReason} /> : null}
    </SummaryCard>
  );
}

export function InjurySummaryCard({ row, plan, onOpenPlan }: { row: MedicalInjury; plan?: RecoveryPlan; onOpenPlan?: () => void }) {
  const t = useDoctorText();
  return (
    <SummaryCard
      title={`${jointLabel(row.affectedJoint)} · ${row.injuryType}`}
      badges={
        <>
          <StatusBadge id={`injurySeverity.${row.severity}`} label={severityLabel(row.severity)} />
          <StatusBadge id={`injury.${row.status}`} label={injuryStatusLabel(row.status)} />
        </>
      }
      meta={`${medical.occurredAt} ${formatMedicalWhen(row.occurredAt)}`}
    >
      {row.description ? <ClampText text={row.description} /> : null}
      {plan ? (
        <Text style={t.link} onPress={onOpenPlan} accessibilityRole={onOpenPlan ? "link" : undefined}>
          {doctorUi.openRecovery}: {plan.title} ›
        </Text>
      ) : null}
    </SummaryCard>
  );
}

function recoveryStatus(status: string): string {
  return doctor.recovery.status[status as keyof typeof doctor.recovery.status] ?? status;
}

export function RecoverySummaryCard({ plan, expanded = false }: { plan: RecoveryPlan; expanded?: boolean }) {
  const t = useDoctorText();
  const view = classifyMilestones(plan.milestones);
  const standard = view.kind === "standard" ? view.items : [];
  const done = standard.filter((m) => m.isCompleted).length;
  const range = `${formatMedicalDay(plan.startDate)}${plan.estimatedEndDate ? ` → ${formatMedicalDay(plan.estimatedEndDate)}` : ""}`;
  return (
    <SummaryCard
      title={plan.title}
      badges={<StatusBadge id={`recovery.${plan.status}`} label={recoveryStatus(plan.status)} />}
      meta={standard.length ? `${range} · ${doctorUi.milestonesProgress(done, standard.length)}` : range}
    >
      {standard.length ? (
        <View style={{ height: 6, borderRadius: 3, backgroundColor: t.colors.surfaceMuted, overflow: "hidden" }}>
          <View style={{ width: `${Math.round((done / standard.length) * 100)}%`, height: 6, backgroundColor: t.colors.success }} />
        </View>
      ) : null}
      {plan.description ? <ClampText text={plan.description} /> : null}
      {expanded
        ? standard.map((m) => (
            <View key={m.id} style={{ flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" }}>
              <Icon name={m.isCompleted ? "success" : "circle"} size={18} color={m.isCompleted ? t.colors.success : t.muted} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={t.value}>{m.title}</Text>
                <Text style={t.meta}>
                  {[m.targetDate ? `${medical.targetDate} ${formatMedicalDay(m.targetDate)}` : null, m.criteria].filter(Boolean).join(" · ")}
                </Text>
              </View>
            </View>
          ))
        : null}
      {expanded && view.kind === "legacy" && view.items.length ? <Text style={t.meta}>{medical.legacyMilestones}</Text> : null}
    </SummaryCard>
  );
}

export function ReviewSummaryCard({ row }: { row: MedicalReviewRequest }) {
  return (
    <SummaryCard
      title={doctor.overview.requests}
      badges={<StatusBadge id={`review.${row.status}`} label={doctor.review[row.status]} />}
      meta={formatMedicalWhen(row.requestedAt)}
      preview={row.reason}
    />
  );
}

/** Hồ sơ sức khỏe gọn theo Figma 126:29763 — chỉ tóm tắt, chi tiết ở màn riêng. */
export function DoctorRecordsBody({ dossier }: { dossier: MedicalDossier }) {
  const t = useDoctorText();
  const plansByInjury = new Map(dossier.activeRecoveryPlans.map((plan) => [plan.injuryId, plan]));
  return (
    <View style={{ gap: spacing.md }}>
      <EligibilitySection dossier={dossier} />

      <SectionTitle text={medical.currentExams} />
      <ExamSummaryCard scope={scopeLabel("TRAINING")} exam={dossier.currentExaminations.training} />
      <ExamSummaryCard scope={scopeLabel("COMPETITION")} exam={dossier.currentExaminations.competition} />

      <SectionTitle text={medical.openRequests} />
      {dossier.openReviewRequests.length === 0 ? <Text style={t.meta}>{medical.reviewEmpty}</Text> : null}
      {dossier.openReviewRequests.map((row) => (
        <ReviewSummaryCard key={row.id} row={row} />
      ))}

      <SectionTitle text={medical.clearances} />
      {dossier.activeClearances.length === 0 ? <Text style={t.meta}>{medical.noClearances}</Text> : null}
      {dossier.activeClearances.map((row) => (
        <ClearanceSummaryCard key={row.id} row={row} />
      ))}

      <SectionTitle text={medical.injuries} />
      {dossier.activeInjuries.length === 0 ? <Text style={t.meta}>{medical.noInjuries}</Text> : null}
      {dossier.activeInjuries.map((row) => (
        <InjurySummaryCard key={row.id} row={row} plan={plansByInjury.get(row.id)} />
      ))}

      <SectionTitle text={medical.recoveryPlans} />
      {dossier.activeRecoveryPlans.length === 0 ? <Text style={t.meta}>{medical.noRecoveryPlans}</Text> : null}
      {dossier.activeRecoveryPlans.map((plan) => (
        <RecoverySummaryCard key={plan.id} plan={plan} />
      ))}

      <Text style={t.meta}>{medical.disclaimer}</Text>
    </View>
  );
}
