import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import {
  getFighterMedical,
  listFighterMedicalExaminations,
  type MedicalDossier,
  type MedicalExamination,
} from "@/api";
import {
  decisionLabel,
  formatMedicalDay,
  formatMedicalWhen,
  scopeLabel,
} from "@/components/medical/medical-format";
import { doctor } from "@/i18n/doctor";
import { doctorUi } from "@/i18n/doctor-ui";
import { medical } from "@/i18n/medical";
import { spacing, type, useThemePreference } from "@/theme";

import {
  DoctorCard,
  DoctorChrome,
  DoctorPatientBar,
  DoctorScroll,
  FighterSwitchSheet,
  clinicalMessage,
  doctorStyles,
} from "./doctor-chrome";
import {
  ClearanceSummaryCard,
  DoctorRecordsBody,
  InjurySummaryCard,
  RecoverySummaryCard,
  examDetailHref,
  examTypeLabel,
  restrictionRows,
} from "./doctor-records";
import { doctorHref } from "@/navigation/role-href";
import { ClampText, DoctorRetry, KeyValueList, SectionTitle, StatGrid, SummaryCard, useDoctorText } from "./doctor-ui";
import { StatusBadge } from "./status-badge";
import { SkeletonList } from "@/components/motion";
import { useRequestGuard } from "./request-guard";
import { useSelectedFighter } from "./selected-fighter";

const EXAM_PAGE = { page: 1, limit: 50 } as const;

function ClinicalShell({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useThemePreference();
  const { fighter } = useSelectedFighter();
  const [sheet, setSheet] = useState(false);
  return (
    <DoctorChrome title={title} back>
      <FighterSwitchSheet visible={sheet} onClose={() => setSheet(false)} />
      {!fighter ? (
        <Text style={[type.body, { color: colors.ink }]}>{doctor.pickFighterHint}</Text>
      ) : (
        <DoctorScroll contentContainerStyle={doctorStyles.list}>
          <DoctorPatientBar onChange={() => setSheet(true)} />
          {children}
        </DoctorScroll>
      )}
    </DoctorChrome>
  );
}

function useDossier(kind: "clearance" | "injuries" | "recovery") {
  const { fighter } = useSelectedFighter();
  const guard = useRequestGuard();
  const [dossier, setDossier] = useState<MedicalDossier | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    const token = guard.start();
    setDossier(null);
    setError("");
    if (!fighter) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void getFighterMedical(fighter.id)
      .then((next) => {
        if (!guard.isCurrent(token)) return;
        setDossier(next);
      })
      .catch((cause: unknown) => {
        if (!guard.isCurrent(token)) return;
        setError(clinicalMessage(cause));
      })
      .finally(() => {
        if (guard.isCurrent(token)) setLoading(false);
      });
  }, [fighter, guard]);

  useEffect(() => {
    load();
  }, [load]);

  return { dossier, error, loading, load, kind };
}

export function DoctorDossierLines({
  title,
  kind,
}: {
  title: string;
  kind: "injuries" | "recovery" | "clearance" | "records";
}) {
  if (kind === "records") return <RecordsScreen />;
  return <DossierList title={title} kind={kind} />;
}

function DossierList({
  title,
  kind,
}: {
  title: string;
  kind: "injuries" | "recovery" | "clearance";
}) {
  const t = useDoctorText();
  const router = useRouter();
  const { fighter } = useSelectedFighter();
  const { dossier, error, loading, load } = useDossier(kind);
  const empty =
    kind === "clearance"
      ? medical.noClearances
      : kind === "injuries"
        ? doctor.medical.noInjuries
        : doctor.recovery.empty;
  const rows =
    kind === "clearance"
      ? dossier?.activeClearances ?? []
      : kind === "injuries"
        ? dossier?.activeInjuries ?? []
        : dossier?.activeRecoveryPlans ?? [];

  const plansByInjury = new Map((dossier?.activeRecoveryPlans ?? []).map((plan) => [plan.injuryId, plan]));
  return (
    <ClinicalShell title={title}>
      {fighter ? (
        <>
          {loading ? <SkeletonList rows={2} height={110} /> : null}
          <DoctorRetry error={error} onRetry={load} />
          {!loading && !error && dossier && rows.length === 0 ? <Text style={t.meta}>{empty}</Text> : null}
          {kind === "clearance" ? dossier?.activeClearances.map((row) => <ClearanceSummaryCard key={row.id} row={row} />) : null}
          {kind === "injuries"
            ? dossier?.activeInjuries.map((row) => (
                <InjurySummaryCard
                  key={row.id}
                  row={row}
                  plan={plansByInjury.get(row.id)}
                  onOpenPlan={() => router.push(doctorHref.recovery)}
                />
              ))
            : null}
          {kind === "recovery" ? dossier?.activeRecoveryPlans.map((plan) => <RecoverySummaryCard key={plan.id} plan={plan} expanded />) : null}
        </>
      ) : null}
    </ClinicalShell>
  );
}

export function ExaminationListScreen() {
  const router = useRouter();
  const { fighter } = useSelectedFighter();
  const guard = useRequestGuard();
  const t = useDoctorText();
  const [rows, setRows] = useState<MedicalExamination[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    const token = guard.start();
    setRows(null);
    setError("");
    if (!fighter) return;
    void listFighterMedicalExaminations(fighter.id, EXAM_PAGE)
      .then((page) => {
        if (guard.isCurrent(token)) setRows(page.data);
      })
      .catch((cause: unknown) => {
        if (guard.isCurrent(token)) setError(clinicalMessage(cause));
      });
  }, [fighter, guard]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ClinicalShell title={medical.examsTab}>
      {fighter ? (
        <>
          <DoctorRetry error={error} onRetry={load} />
          {!rows && !error ? <SkeletonList rows={3} height={84} /> : null}
          {rows ? <SectionTitle text={doctorUi.examHistory} /> : null}
          {rows && rows.length === 0 ? <Text style={t.meta}>{medical.examsEmpty}</Text> : null}
          {rows?.map((exam) => (
            <SummaryCard
              key={exam.id}
              title={`${scopeLabel(exam.scope)} · ${examTypeLabel(exam)}`}
              badges={<StatusBadge id={`exam.${exam.decision}`} label={decisionLabel(exam.decision)} />}
              meta={formatMedicalWhen(exam.examinedAt)}
              preview={exam.details ? null : doctorUi.legacyNoDetails}
              onPress={() => router.push(examDetailHref(exam.id))}
            />
          ))}
        </>
      ) : null}
    </ClinicalShell>
  );
}

function scat6Status(status: string): string {
  if (status === "ADMINISTERED") return doctor.exam.scat6Administered;
  if (status === "NOT_ADMINISTERED") return doctor.exam.scat6Skipped;
  return status;
}

/** Chi tiết kết luận khám theo Figma 126:30221: sinh hiệu dạng ô số liệu, văn bản tự do thu gọn 2 dòng. */
export function ExaminationReadScreen() {
  const { examId } = useLocalSearchParams<{ examId: string }>();
  const { fighter } = useSelectedFighter();
  const guard = useRequestGuard();
  const t = useDoctorText();
  const [exam, setExam] = useState<MedicalExamination | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    const token = guard.start();
    setExam(null);
    setMissing(false);
    setError("");
    if (!fighter || !examId) return;
    setLoading(true);
    void listFighterMedicalExaminations(fighter.id, EXAM_PAGE)
      .then((page) => {
        if (!guard.isCurrent(token)) return;
        const found = page.data.find((row) => row.id === examId) ?? null;
        setExam(found);
        setMissing(!found);
      })
      .catch((cause: unknown) => {
        if (guard.isCurrent(token)) setError(clinicalMessage(cause));
      })
      .finally(() => {
        if (guard.isCurrent(token)) setLoading(false);
      });
  }, [examId, fighter, guard]);

  useEffect(() => {
    load();
  }, [load]);

  const details = exam?.details ?? null;
  const vitals = details?.vitals ?? null;
  const assessments = details ? [...details.assessments].sort((a, b) => Number(a.result === "NORMAL") - Number(b.result === "NORMAL")) : [];

  return (
    <ClinicalShell title={doctorUi.examDetailTitle}>
      {fighter ? (
        <>
          {loading ? <SkeletonList rows={3} height={96} /> : null}
          <DoctorRetry error={error} onRetry={load} />
          {missing ? <Text style={t.value}>{doctor.exam.notInLoadedList}</Text> : null}
          {exam ? (
            <View style={{ gap: spacing.md }}>
              <View style={{ gap: spacing.xs }}>
                <Text style={t.heading}>{`${examTypeLabel(exam)} · ${scopeLabel(exam.scope)}`}</Text>
                <Text style={t.meta}>{formatMedicalWhen(exam.examinedAt)}</Text>
                <StatusBadge id={`exam.${exam.decision}`} label={decisionLabel(exam.decision)} />
              </View>
              {!details ? <Text style={t.meta}>{medical.legacyDetails}</Text> : null}

              {vitals ? (
                <>
                  <SectionTitle text={doctorUi.examInfo} />
                  <StatGrid
                    items={[
                      { label: doctor.exam.weight, value: String(vitals.weightKg), unit: "kg" },
                      { label: doctor.exam.heart, value: String(vitals.restingHeartRate), unit: "bpm" },
                      { label: doctor.exam.bloodPressure, value: `${vitals.bloodPressureSystolic}/${vitals.bloodPressureDiastolic}`, unit: "mmHg" },
                      { label: doctor.exam.temperature, value: String(vitals.temperatureC), unit: "°C" },
                      { label: doctor.exam.spo2, value: String(vitals.spo2Pct), unit: "%" },
                      { label: doctor.exam.hydration, value: doctor.exam.hydrationLevel[vitals.hydration] ?? vitals.hydration },
                    ]}
                  />
                </>
              ) : null}

              {assessments.length ? (
                <>
                  <SectionTitle text={doctorUi.assessmentsByArea} />
                  <DoctorCard>
                    {assessments.every((row) => row.result === "NORMAL") ? <Text style={[t.meta, { color: t.colors.success }]}>{doctorUi.allNormal}</Text> : null}
                    <KeyValueList
                      rows={assessments.map((row) => ({
                        label: row.area,
                        value: `${doctor.exam.assessment[row.result] ?? row.result}${row.note ? ` — ${row.note}` : ""}`,
                        tone: row.result === "ABNORMAL" ? "danger" : row.result === "NORMAL" ? "ok" : undefined,
                      }))}
                    />
                  </DoctorCard>
                </>
              ) : null}

              {details?.scat6 ? (
                <>
                  <SectionTitle text={doctorUi.scat6Title} />
                  <DoctorCard>
                    {scat6Status(details.scat6.responses.status) ? <Text style={t.value}>{scat6Status(details.scat6.responses.status)}</Text> : null}
                    <Collapsible label={doctorUi.technical}>
                      <KeyValueList
                        rows={[
                          { label: doctorUi.formVersion, value: details.scat6.formVersion },
                          { label: doctorUi.scoringVersion, value: details.scat6.scoringVersion != null ? String(details.scat6.scoringVersion) : null },
                        ]}
                      />
                    </Collapsible>
                  </DoctorCard>
                </>
              ) : null}

              <SectionTitle text={doctorUi.extra} />
              <DoctorCard>
                <KeyValueList
                  rows={[
                    { label: doctor.exam.scope, value: scopeLabel(exam.scope) },
                    { label: medical.validUntil, value: exam.validUntil ? formatMedicalWhen(exam.validUntil) : doctor.exam.noEffect },
                    { label: doctor.exam.followUp, value: details?.followUpDate ? formatMedicalDay(details.followUpDate) : null },
                    ...restrictionRows(exam.restrictions),
                  ]}
                />
                {details?.recommendations ? <ClampText label={doctor.exam.recommendations} text={details.recommendations} /> : null}
                {exam.reason ? <ClampText label={doctorUi.doctorNote} text={exam.reason} /> : null}
              </DoctorCard>
            </View>
          ) : null}
        </>
      ) : null}
    </ClinicalShell>
  );
}

function Collapsible({ label, children }: { label: string; children: ReactNode }) {
  const t = useDoctorText();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: spacing.xs }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((v) => !v)} hitSlop={8}>
        <Text style={t.link}>{`${label} ${open ? "▴" : "▾"}`}</Text>
      </Pressable>
      {open ? children : null}
    </View>
  );
}

export function RecordsScreen() {
  const { fighter } = useSelectedFighter();
  const guard = useRequestGuard();
  const [dossier, setDossier] = useState<MedicalDossier | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    const token = guard.start();
    setDossier(null);
    setError("");
    if (!fighter) return;
    void getFighterMedical(fighter.id)
      .then((next) => {
        if (guard.isCurrent(token)) setDossier(next);
      })
      .catch((cause: unknown) => {
        if (!guard.isCurrent(token)) return;
        setError(clinicalMessage(cause));
      });
  }, [fighter, guard]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ClinicalShell title={medical.dossierTitle}>
      {fighter ? (
        <>
          <DoctorRetry error={error} onRetry={load} />
          {!dossier && !error ? <SkeletonList rows={4} height={88} /> : null}
          {dossier ? <DoctorRecordsBody dossier={dossier} /> : null}
        </>
      ) : null}
    </ClinicalShell>
  );
}
