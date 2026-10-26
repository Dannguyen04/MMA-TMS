import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";

import type { MedicalDossier, MedicalEligibility, MedicalExamination } from "@/api/types";
import { BottomSheet } from "@/components/filter-sheet";
import { formatMedicalDay, formatMedicalWhen } from "@/components/medical/medical-format";
import { Skeleton } from "@/components/motion";
import { eligibilityText as e } from "@/i18n/eligibility";
import { medical } from "@/i18n/medical";
import { doctor } from "@/i18n/doctor";
import { doctorHref } from "@/navigation/role-href";
import { radius, spacing, type } from "@/theme";
import { examDetailHref, examTypeLabel, restrictionRows } from "./doctor-records";
import { eligibilityLevel, governingClearance, type EligibilityLevel } from "@/components/medical/eligibility-model";
import { KeyValueList, SectionTitle, useDoctorText, type KeyValue } from "./doctor-ui";

type Scope = "training" | "competition";
export type { EligibilityLevel } from "@/components/medical/eligibility-model";
export { eligibilityLevel, governingClearance } from "@/components/medical/eligibility-model";

export function reasonText(code: string): string {
  return e.reason[code] ?? e.unknownReason;
}

function useLevelColor(level: EligibilityLevel) {
  const t = useDoctorText();
  return level === "eligible"
    ? { fg: t.colors.success, bg: t.colors.successSoft }
    : level === "restricted"
      ? { fg: t.colors.lotus, bg: t.colors.surfaceMuted }
      : { fg: t.colors.danger, bg: t.colors.dangerSoft };
}

function Chip({ level }: { level: EligibilityLevel }) {
  const c = useLevelColor(level);
  return (
    <View style={[styles.chip, { backgroundColor: c.bg }]}>
      <View style={[styles.dot, { backgroundColor: c.fg }]} />
      <Text style={[type.caption, { color: c.fg, fontWeight: "600" }]} numberOfLines={1}>
        {e.chip[level]}
      </Text>
    </View>
  );
}

/** Mục "Điều kiện tham gia": 2 ô cố định chiều cao (nhãn + chip), chạm mở sheet căn cứ. */
export function EligibilitySection({ dossier, error }: { dossier: MedicalDossier | null; error?: string }) {
  const [open, setOpen] = useState<Scope | null>(null);
  return (
    <>
      <SectionTitle text={doctor.overview.eligibilityTitle} />
      <View style={styles.tiles}>
        <Tile scope="training" dossier={dossier} error={error} onPress={() => setOpen("training")} />
        <Tile scope="competition" dossier={dossier} error={error} onPress={() => setOpen("competition")} />
      </View>
      {dossier ? <EligibilitySheet dossier={dossier} scope={open} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

function scopeLabel(scope: Scope): string {
  return scope === "training" ? medical.eligibilityTraining : medical.eligibilityCompetition;
}

function Tile({ scope, dossier, error, onPress }: { scope: Scope; dossier: MedicalDossier | null; error?: string; onPress: () => void }) {
  const t = useDoctorText();
  const label = scopeLabel(scope);
  const value = dossier?.eligibility[scope] ?? null;
  const exam = dossier?.currentExaminations[scope] ?? null;
  const level = value && dossier ? eligibilityLevel(value, exam, governingClearance(dossier, exam)) : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={level ? `${label}: ${e.chip[level]}. ${e.openSheet(label)}` : label}
      disabled={!level}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        { borderColor: t.colors.line, backgroundColor: t.colors.surface, opacity: pressed ? 0.75 : 1 },
      ]}
    >
      <Text style={t.meta} numberOfLines={1}>
        {label}
      </Text>
      {level ? <Chip level={level} /> : error ? <Text style={t.meta}>—</Text> : <Skeleton width="60%" height={22} />}
    </Pressable>
  );
}

type Action = { label: string; href: Href };

function actionsFor(dossier: MedicalDossier, value: MedicalEligibility, exam: MedicalExamination | null): Action[] {
  const out: Action[] = [];
  const add = (a: Action) => {
    if (!out.some((x) => x.label === a.label)) out.push(a);
  };
  if (exam) add({ label: e.actions.openConclusion, href: examDetailHref(exam.id) });
  else if (!value.eligible) add({ label: e.actions.openExams, href: doctorHref.examinations });
  for (const code of value.reasons) {
    if (code === "CLEARANCE_REQUIRED" || code === "CLEARANCE_EXPIRED" || code === "SESSION_TYPE_RESTRICTED")
      add({ label: e.actions.openClearance, href: doctorHref.clearance });
    if (code === "REVIEW_REQUEST_PENDING") add({ label: e.actions.openRequests, href: doctorHref.records });
  }
  if (dossier.activeInjuries.length > 0) add({ label: e.actions.openInjuries, href: doctorHref.injuries });
  return out;
}

export function EligibilitySheet({ dossier, scope, onClose }: { dossier: MedicalDossier; scope: Scope | null; onClose: () => void }) {
  const t = useDoctorText();
  const router = useRouter();
  const s = scope ?? "training";
  const label = scopeLabel(s);
  const value = dossier.eligibility[s];
  const exam = dossier.currentExaminations[s];
  const clearance = governingClearance(dossier, exam);
  const level = eligibilityLevel(value, exam, clearance);
  const color = useLevelColor(level);

  const basis: KeyValue[] = exam
    ? [
        { label: e.conclusion, value: `${examTypeLabel(exam)} · ${medical.decision[exam.decision]}` },
        { label: e.examinedAt, value: formatMedicalWhen(exam.examinedAt) },
        { label: e.conclusionValidUntil, value: exam.validUntil ? formatMedicalDay(exam.validUntil) : e.noExpiry },
        ...(clearance
          ? [
              { label: e.clearance, value: `${medical.clearanceType[clearance.clearanceType]} · ${medical.clearanceStatus[clearance.status]}` },
              { label: e.clearanceValidUntil, value: clearance.validUntil ? formatMedicalDay(clearance.validUntil) : e.noExpiry },
            ]
          : []),
      ]
    : [];
  const limits = [...restrictionRows(exam?.restrictions ?? null), ...restrictionRows(clearance?.restrictions ?? null)].filter(
    (row, i, all) => row.value && all.findIndex((x) => x.label === row.label && x.value === row.value) === i,
  );
  const reasons = value.eligible ? [] : value.reasons.length ? value.reasons.map(reasonText) : [e.unknownReason];
  const actions = actionsFor(dossier, value, exam);

  return (
    <BottomSheet
      visible={scope !== null}
      onClose={onClose}
      title={label}
      footer={
        actions.length ? (
          <View style={styles.actions}>
            {actions.map((a) => (
              <Pressable
                key={a.label}
                accessibilityRole="button"
                onPress={() => {
                  onClose();
                  router.push(a.href);
                }}
                style={({ pressed }) => [styles.action, { borderColor: t.colors.line, opacity: pressed ? 0.75 : 1 }]}
              >
                <Text style={t.link}>{a.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : undefined
      }
    >
      <View style={styles.body}>
        <Text style={[t.heading, { color: color.fg }]} accessibilityRole="header">
          {e.headline[level](label)}
        </Text>

        <SectionTitle text={e.basis} />
        {exam ? <KeyValueList rows={basis} /> : <Text style={t.value}>{e.noConclusion}</Text>}
        {exam && !clearance ? <Text style={t.meta}>{e.noClearance}</Text> : null}

        {reasons.length ? (
          <>
            <SectionTitle text={e.reasonsTitle} />
            <View style={styles.bullets}>
              {reasons.map((text) => (
                <View key={text} style={styles.bullet}>
                  <Text style={[t.value, { color: t.colors.danger }]}>•</Text>
                  <Text style={[t.value, styles.flex]}>{text}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {limits.length ? (
          <>
            <SectionTitle text={e.restrictionsTitle} />
            <KeyValueList rows={limits} />
          </>
        ) : null}
        {s === "training" ? <Text style={t.meta}>{doctor.overview.eligibilityNote}</Text> : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: "row", gap: spacing.sm },
  tile: { flex: 1, height: 76, borderWidth: 1, borderRadius: radius.field, padding: spacing.md, justifyContent: "space-between" },
  chip: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  body: { gap: spacing.md, paddingBottom: spacing.md },
  bullets: { gap: spacing.xs },
  bullet: { flexDirection: "row", gap: spacing.sm },
  flex: { flex: 1 },
  actions: { gap: spacing.sm },
  action: { minHeight: 44, borderWidth: 1, borderRadius: radius.field, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.md },
});
