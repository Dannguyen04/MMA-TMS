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
import { doctor } from "@/i18n/doctor";
import { medical } from "@/i18n/medical";
import { type, useThemePreference } from "@/theme";
import { StatusBadge } from "@/screens/doctor/status-badge";

export function EligibilityLine({ eligibility, label }: { eligibility: MedicalEligibility; label: string }) {
  const { colors } = useThemePreference();
  return (
    <View style={medicalStyles.row}>
      <Text style={[type.body, { color: eligibility.eligible ? colors.ink : colors.danger }]}>
        {label}: {eligibility.eligible ? medical.eligible : medical.notEligible}
      </Text>
      {(eligibility.eligible ? eligibility.reasons : eligibility.reasons.length > 0 ? eligibility.reasons : ["__EMPTY__"]).map(
        (code) => (
          <MedicalMuted
            key={code}
            text={`• ${code === "__EMPTY__" ? medical.unknownReason : eligibilityReasonLabel(code)}`}
          />
        ),
      )}
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

function examTypeLabel(value: string, audience: "shared" | "doctor"): string {
  if (audience !== "doctor") return value;
  return doctor.exam.types[value as keyof typeof doctor.exam.types] ?? "—";
}

function scat6StatusLabel(status: string, audience: "shared" | "doctor"): string {
  if (audience !== "doctor") return status;
  if (status === "ADMINISTERED") return doctor.exam.scat6Administered;
  if (status === "NOT_ADMINISTERED") return doctor.exam.scat6Skipped;
  return "—";
}

function ExamBlock({
  label,
  exam,
  audience,
}: {
  label: string;
  exam: MedicalExamination | null;
  audience: "shared" | "doctor";
}) {
  const { colors } = useThemePreference();
  if (!exam) {
    return <MedicalFact label={label} value={medical.noExam} />;
  }
  const restrictions: MedicalRestrictions | null = exam.restrictions;
  return (
    <View style={medicalStyles.row}>
      <Text style={[type.caption, { color: colors.inkMuted, lineHeight: 16 }]}>{label}</Text>
      {audience === "doctor" ? (
        <StatusBadge id={`exam.${exam.decision}`} label={decisionLabel(exam.decision)} />
      ) : (
        <Text style={[type.body, { color: exam.decision === "NOT_ELIGIBLE" ? colors.danger : colors.ink }]}>
          {decisionLabel(exam.decision)}
        </Text>
      )}
      <MedicalMuted text={formatMedicalWhen(exam.examinedAt)} />
      {exam.details ? (
        <MedicalFact label={medical.currentExams} value={examTypeLabel(exam.details.examinationType, audience)} />
      ) : (
        <MedicalMuted text={medical.legacyDetails} />
      )}
      {exam.details?.scat6 ? (
        <MedicalMuted
          text={`${exam.details.scat6.formVersion} · ${scat6StatusLabel(exam.details.scat6.responses.status, audience)}${
            exam.details.scat6.scoringVersion != null
              ? ` · ${audience === "doctor" ? doctor.exam.scoringVersion : "v"}${audience === "doctor" ? " " : ""}${exam.details.scat6.scoringVersion}`
              : ""
          }`}
        />
      ) : null}
      {exam.reason ? <MedicalFact label={medical.snapshot.reason} value={exam.reason} /> : null}
      {restrictions ? <RestrictionFacts value={restrictions} /> : null}
      <MedicalMuted
        text={`${medical.validUntil}: ${
          exam.validUntil
            ? formatMedicalWhen(exam.validUntil)
            : audience === "doctor"
              ? doctor.exam.noEffect
              : medical.noExpiry
        }`}
      />
    </View>
  );
}

function startsLater(row: MedicalClearance): boolean {
  if (row.status !== "ACTIVE" || row.isCurrentlyValid) return false;
  const start = new Date(row.validFrom).getTime();
  return !Number.isNaN(start) && start > Date.now();
}

function ClearanceRow({ row, audience }: { row: MedicalClearance; audience: "shared" | "doctor" }) {
  const { colors } = useThemePreference();
  const pendingStart = audience === "doctor" && startsLater(row);
  const until = row.validUntil
    ? formatMedicalWhen(row.validUntil)
    : audience === "doctor"
      ? doctor.medical.noExpiry
      : medical.noExpiry;
  return (
    <View style={medicalStyles.row}>
      <Text style={[type.body, { color: colors.ink }]}>{clearanceTypeLabel(row.clearanceType)}</Text>
      {audience === "doctor" ? (
        <StatusBadge id={`clearance.${row.status}`} label={clearanceStatusLabel(row.status)} />
      ) : (
        <Text style={[type.body, { color: colors.ink }]}>{clearanceStatusLabel(row.status)}</Text>
      )}
      {pendingStart ? <MedicalMuted text={doctor.clearance.notStarted} /> : (
        <MedicalMuted
          text={row.isCurrentlyValid ? medical.currentlyValid : medical.notCurrentlyValid}
          tone={row.isCurrentlyValid ? "ok" : "muted"}
        />
      )}
      <MedicalMuted text={`${medical.validFrom} ${formatMedicalWhen(row.validFrom)} · ${medical.validUntil} ${until}`} />
      <RestrictionFacts value={row.restrictions} />
      {row.notes ? <MedicalFact label={medical.clearanceNotes} value={row.notes} /> : null}
      {row.revokedReason ? <MedicalFact label={doctor.clearance.revokedReason} value={row.revokedReason} /> : null}
    </View>
  );
}

export function InjuryRow({
  row,
  onPress,
  badges = false,
}: {
  row: MedicalInjury;
  onPress?: () => void;
  badges?: boolean;
}) {
  const { colors } = useThemePreference();
  const body = (
    <View style={medicalStyles.row}>
      <Text style={[type.body, { color: colors.ink }]}>
        {jointLabel(row.affectedJoint)} · {row.injuryType}
      </Text>
      {badges ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          <StatusBadge id={`injury.${row.status}`} label={injuryStatusLabel(row.status)} />
          <StatusBadge id={`injurySeverity.${row.severity}`} label={severityLabel(row.severity)} />
        </View>
      ) : null}
      <MedicalMuted
        text={badges ? formatMedicalWhen(row.occurredAt) : `${injuryStatusLabel(row.status)} · ${severityLabel(row.severity)} · ${formatMedicalWhen(row.occurredAt)}`}
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

function recoveryLabel(status: string, audience: "shared" | "doctor"): string {
  if (audience !== "doctor") return recoveryStatusLabel(status);
  return doctor.recovery.status[status as keyof typeof doctor.recovery.status] ?? "—";
}

export function RecoveryPlanBlock({
  plan,
  audience = "shared",
}: {
  plan: RecoveryPlan;
  audience?: "shared" | "doctor";
}) {
  const { colors } = useThemePreference();
  const view = classifyMilestones(plan.milestones);
  const done = audience === "doctor" ? doctor.recovery.milestoneDone : medical.milestoneDone;
  const open = audience === "doctor" ? doctor.recovery.milestoneOpen : medical.milestoneOpen;
  return (
    <View style={medicalStyles.row}>
      <Text style={[type.body, { color: colors.ink }]}>{plan.title}</Text>
      {audience === "doctor" ? (
        <StatusBadge id={`recovery.${plan.status}`} label={recoveryLabel(plan.status, audience)} />
      ) : null}
      <MedicalMuted
        text={`${audience === "doctor" ? "" : `${recoveryLabel(plan.status, audience)} · `}${formatMedicalDay(plan.startDate)}${
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
                  m.isCompleted ? done : open,
                  m.targetDate ? `${medical.targetDate} ${formatMedicalDay(m.targetDate)}` : null,
                  m.completedAt ? `${medical.completedAt} ${formatMedicalWhen(m.completedAt)}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              />
              {m.notes ? <MedicalMuted text={m.notes} /> : null}
            </View>
          ))
        : view.items.map((item, index) => {
            const completed =
              item && typeof item === "object" && "isCompleted" in item
                ? (item as { isCompleted?: unknown }).isCompleted
                : undefined;
            if (audience === "doctor" && typeof completed !== "boolean") {
              const title =
                item && typeof item === "object" && "title" in item && typeof (item as { title?: unknown }).title === "string"
                  ? (item as { title: string }).title
                  : legacyMilestoneText(item);
              return (
                <MedicalMuted key={index} text={`${title} · ${doctor.recovery.milestoneMissing}`} />
              );
            }
            return <MedicalMuted key={index} text={`${index + 1}. ${legacyMilestoneText(item)}`} />;
          })}
    </View>
  );
}

/** Read-only dossier. Never picks a "governing" clearance: eligibility comes from the server. */
export function MedicalDossierView({
  dossier,
  onOpenInjury,
  audience = "shared",
}: {
  dossier: MedicalDossier;
  onOpenInjury?: (injuryId: string) => void;
  /** Doctor screens use the locked 2026-10-10 label decisions. */
  audience?: "shared" | "doctor";
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
        <ExamBlock label={medical.scope.TRAINING} exam={dossier.currentExaminations.training} audience={audience} />
        <ExamBlock label={medical.scope.COMPETITION} exam={dossier.currentExaminations.competition} audience={audience} />
        <MedicalMuted text={medical.decisionNote} />
      </MedicalCard>

      <MedicalSection text={medical.clearances} />
      <MedicalCard>
        {dossier.activeClearances.length === 0 ? (
          <MedicalMuted text={medical.noClearances} />
        ) : (
          dossier.activeClearances.map((row) => <ClearanceRow key={row.id} row={row} audience={audience} />)
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
              badges={audience === "doctor"}
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
          dossier.activeRecoveryPlans.map((plan) => (
            <RecoveryPlanBlock key={plan.id} plan={plan} audience={audience} />
          ))
        )}
      </MedicalCard>

      <MedicalMuted text={medical.disclaimer} />
    </View>
  );
}
