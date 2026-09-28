import { Pressable, Text, View } from "react-native";

import type {
  MedicalClearance,
  MedicalDossier,
  MedicalEligibility,
  MedicalExamination,
  MedicalInjury,
  MedicalRestrictionLists,
  MedicalRestrictions,
  RecoveryPlan,
} from "@/api/types";
import {
  classifyMilestones,
  clearanceStatusLabel,
  clearanceTypeLabel,
  decisionLabel,
  eligibilityReasonLabel,
  formatMedicalDay,
  formatMedicalWhen,
  injuryStatusLabel,
  jointLabel,
  legacyMilestoneText,
  recoveryStatusLabel,
  sessionTypeName,
  severityLabel,
  techniqueLabel,
} from "@/components/medical/medical-format";
import {
  MedicalCard,
  MedicalFact,
  MedicalMuted,
  MedicalSection,
  medicalStyles,
} from "@/components/medical/medical-ui";
import { medical } from "@/i18n/medical";
import { type, useThemePreference } from "@/theme";

export function EligibilityLine({ eligibility, label }: { eligibility: MedicalEligibility; label: string }) {
  const { colors } = useThemePreference();
  return (
    <View style={medicalStyles.row}>
      <Text style={[type.body, { color: eligibility.eligible ? colors.ink : colors.danger }]}>
        {label}: {eligibility.eligible ? medical.eligible : medical.notEligible}
      </Text>
      {eligibility.reasons.map((code) => (
        <MedicalMuted key={code} text={`• ${eligibilityReasonLabel(code)}`} />
      ))}
    </View>
  );
}

function RestrictionFacts({ value }: { value: MedicalRestrictionLists & { notes?: string | null } }) {
  const sessions = value.allowedSessionTypes?.length
    ? value.allowedSessionTypes.map(sessionTypeName).join(", ")
    : null;
  const techniques = value.allowedTechniqueTypes?.length
    ? value.allowedTechniqueTypes.map(techniqueLabel).join(", ")
    : null;
  const joints = value.excludedJoints?.length ? value.excludedJoints.map(jointLabel).join(", ") : null;
  return (
    <>
      {sessions ? <MedicalFact label={medical.allowedSessionTypes} value={sessions} /> : null}
      {techniques ? <MedicalFact label={medical.allowedTechniqueTypes} value={techniques} /> : null}
      {joints ? <MedicalFact label={medical.excludedJoints} value={joints} /> : null}
      {value.notes ? <MedicalFact label={medical.restrictionNotes} value={value.notes} /> : null}
    </>
  );
}

function ExamBlock({ label, exam }: { label: string; exam: MedicalExamination | null }) {
  const { colors } = useThemePreference();
  if (!exam) {
    return <MedicalFact label={label} value={medical.noExam} />;
  }
  const restrictions: MedicalRestrictions | null = exam.restrictions;
  return (
    <View style={medicalStyles.row}>
      <Text style={[type.caption, { color: colors.inkMuted, lineHeight: 16 }]}>{label}</Text>
      <Text style={[type.body, { color: exam.decision === "NOT_ELIGIBLE" ? colors.danger : colors.ink }]}>
        {decisionLabel(exam.decision)}
      </Text>
      <MedicalMuted text={formatMedicalWhen(exam.examinedAt)} />
      {exam.reason ? <MedicalFact label={medical.snapshot.reason} value={exam.reason} /> : null}
      {restrictions ? <RestrictionFacts value={restrictions} /> : null}
      <MedicalMuted
        text={`${medical.validUntil}: ${exam.validUntil ? formatMedicalWhen(exam.validUntil) : medical.noExpiry}`}
      />
    </View>
  );
}

function ClearanceRow({ row }: { row: MedicalClearance }) {
  const { colors } = useThemePreference();
  return (
    <View style={medicalStyles.row}>
      <Text style={[type.body, { color: colors.ink }]}>
        {clearanceTypeLabel(row.clearanceType)} · {clearanceStatusLabel(row.status)}
      </Text>
      <MedicalMuted
        text={row.isCurrentlyValid ? medical.currentlyValid : medical.notCurrentlyValid}
        tone={row.isCurrentlyValid ? "ok" : "muted"}
      />
      <MedicalMuted
        text={`${medical.validFrom} ${formatMedicalWhen(row.validFrom)} · ${medical.validUntil} ${
          row.validUntil ? formatMedicalWhen(row.validUntil) : medical.noExpiry
        }`}
      />
      <RestrictionFacts value={row.restrictions} />
      {row.notes ? <MedicalFact label={medical.clearanceNotes} value={row.notes} /> : null}
    </View>
  );
}

export function InjuryRow({ row, onPress }: { row: MedicalInjury; onPress?: () => void }) {
  const { colors } = useThemePreference();
  const body = (
    <View style={medicalStyles.row}>
      <Text style={[type.body, { color: colors.ink }]}>
        {jointLabel(row.affectedJoint)} · {row.injuryType}
      </Text>
      <MedicalMuted
        text={`${injuryStatusLabel(row.status)} · ${severityLabel(row.severity)} · ${formatMedicalWhen(row.occurredAt)}`}
      />
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      {body}
    </Pressable>
  );
}

export function RecoveryPlanBlock({ plan }: { plan: RecoveryPlan }) {
  const { colors } = useThemePreference();
  const view = classifyMilestones(plan.milestones);
  return (
    <View style={medicalStyles.row}>
      <Text style={[type.body, { color: colors.ink }]}>{plan.title}</Text>
      <MedicalMuted
        text={`${recoveryStatusLabel(plan.status)} · ${formatMedicalDay(plan.startDate)}${
          plan.estimatedEndDate ? ` – ${formatMedicalDay(plan.estimatedEndDate)}` : ""
        }`}
      />
      {plan.description ? <MedicalMuted text={plan.description} /> : null}
      <MedicalMuted text={view.kind === "legacy" ? medical.legacyMilestones : medical.milestones} />
      {view.items.length === 0 ? <MedicalMuted text={medical.noMilestones} /> : null}
      {view.kind === "standard"
        ? view.items.map((m) => (
            <View key={m.id} style={medicalStyles.row}>
              <Text style={[type.body, { color: colors.ink }]}>
                {m.isCompleted ? "✓" : "○"} {m.title}
              </Text>
              <MedicalMuted text={m.criteria} />
              <MedicalMuted
                text={[
                  m.isCompleted ? medical.milestoneDone : medical.milestoneOpen,
                  m.targetDate ? `${medical.targetDate} ${formatMedicalDay(m.targetDate)}` : null,
                  m.completedAt ? `${medical.completedAt} ${formatMedicalWhen(m.completedAt)}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              />
              {m.notes ? <MedicalMuted text={m.notes} /> : null}
            </View>
          ))
        : view.items.map((item, index) => (
            <MedicalMuted key={index} text={`${index + 1}. ${legacyMilestoneText(item)}`} />
          ))}
    </View>
  );
}

/** Read-only dossier. Never picks a "governing" clearance: eligibility comes from the server. */
export function MedicalDossierView({
  dossier,
  onOpenInjury,
}: {
  dossier: MedicalDossier;
  onOpenInjury?: (injuryId: string) => void;
}) {
  return (
    <View style={medicalStyles.stack}>
      <MedicalSection text={medical.eligibility} />
      <MedicalCard>
        <EligibilityLine eligibility={dossier.eligibility.training} label={medical.eligibilityTraining} />
        <EligibilityLine
          eligibility={dossier.eligibility.competition}
          label={medical.eligibilityCompetition}
        />
        <MedicalMuted text={medical.eligibilityNote} />
      </MedicalCard>

      <MedicalSection text={medical.currentExams} />
      <MedicalCard>
        <ExamBlock label={medical.scope.TRAINING} exam={dossier.currentExaminations.training} />
        <ExamBlock label={medical.scope.COMPETITION} exam={dossier.currentExaminations.competition} />
        <MedicalMuted text={medical.decisionNote} />
      </MedicalCard>

      <MedicalSection text={medical.clearances} />
      <MedicalCard>
        {dossier.activeClearances.length === 0 ? (
          <MedicalMuted text={medical.noClearances} />
        ) : (
          dossier.activeClearances.map((row) => <ClearanceRow key={row.id} row={row} />)
        )}
        <MedicalMuted text={medical.clearancesNote} />
      </MedicalCard>

      <MedicalSection text={medical.injuries} />
      <MedicalCard>
        {dossier.activeInjuries.length === 0 ? (
          <MedicalMuted text={medical.noInjuries} />
        ) : (
          dossier.activeInjuries.map((row) => (
            <InjuryRow
              key={row.id}
              row={row}
              onPress={onOpenInjury ? () => onOpenInjury(row.id) : undefined}
            />
          ))
        )}
      </MedicalCard>

      <MedicalSection text={medical.recoveryPlans} />
      <MedicalCard>
        {dossier.activeRecoveryPlans.length === 0 ? (
          <MedicalMuted text={medical.noRecoveryPlans} />
        ) : (
          dossier.activeRecoveryPlans.map((plan) => <RecoveryPlanBlock key={plan.id} plan={plan} />)
        )}
      </MedicalCard>

      <MedicalMuted text={medical.disclaimer} />
    </View>
  );
}
